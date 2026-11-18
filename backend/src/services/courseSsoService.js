const crypto = require("crypto");
const bcrypt = require("bcrypt");
const defaultDb = require("../config/database");
const {
  buildDeviceSlotProof,
  ensureMolyTrustedDevice,
  prepareSsoBrowserDevice,
  finalizeSsoBrowserDevice,
} = require("./molyTrustedDeviceService");
const {
  DEFAULT_BROWSER_TX_TTL_SECONDS,
  DEFAULT_SSO_TTL_SECONDS,
  SsoPolicyError,
  buildSsoAuthorizeUrl,
  buildSsoCallbackUrl,
  buildSsoStartUrl,
  computePkceChallengeS256,
  constantTimeEqual,
  generateOpaqueSsoCode,
  generatePkceVerifier,
  generateSsoNonce,
  hashSsoToken,
  readSsoCookie,
  resolveSsoTtlSeconds,
  validatePkceChallenge,
  validateSsoStateParam,
  validateSsoTargetPath,
  verifyPkceVerifierS256,
} = require("../utils/ssoPathPolicy");

const LINK_TOKEN_TTL_SECONDS = 600;
const MOLY_SSO_TX_COOKIE = "moly_sso_tx";
const MOLY_SSO_LINK_COOKIE = "moly_sso_link";
const PRIVILEGED_ROLES = new Set(["admin", "teacher", "creator", "super_admin", "staff"]);

async function assertMolyLearnerPolicy(runner, userId) {
  const user = (await runner.query(
    `SELECT u.role, u.is_active, u.device_limit_locked_at,
            COALESCE((to_jsonb(u)->>'is_banned')::boolean, FALSE) AS is_banned
     FROM users u WHERE u.id = $1`,
    [userId],
  )).rows[0];
  if (!user || !user.is_active || user.is_banned || user.device_limit_locked_at) {
    throw new SsoPolicyError(403, "SSO_USER_REVOKED", "Account is unavailable or blocked.");
  }
  const caps = (await runner.query(
    "SELECT to_regclass('user_roles') IS NOT NULL AND to_regclass('roles') IS NOT NULL AS has_rbac",
  )).rows[0];
  const roles = caps?.has_rbac ? (await runner.query(
    "SELECT r.code FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=$1",
    [userId],
  )).rows : [];
  if (PRIVILEGED_ROLES.has(user.role) || roles.some((role) => !["student", "user"].includes(role.code))) {
    throw new SsoPolicyError(403, "PRIVILEGED_ROLE_COLLISION", "Staff accounts must authenticate separately.");
  }
}

function normalizeEmail(email) {
  return typeof email === "string" && email.trim() ? email.trim().toLowerCase() : null;
}

function normalizeNamespacedCourseId(rawId) {
  const val = String(rawId || "").trim();
  if (!val) throw new SsoPolicyError(422, "SSO_INVALID_SUBJECT", "Missing CSCA-Course user identifier.");
  return val.startsWith("csca-course:") ? val : `csca-course:${val}`;
}

function stripCoursePrefix(externalUserId) {
  const val = String(externalUserId || "").trim();
  return val.startsWith("csca-course:") ? val.slice("csca-course:".length) : val;
}

function normalizeSourceRole(role) {
  const raw = String(role || "student").trim().toLowerCase();
  if (PRIVILEGED_ROLES.has(raw)) return raw;
  return "student";
}

function sanitizeUsernameSeed(rawSeed, fallbackId) {
  const base = String(rawSeed || `csca_${fallbackId}`)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  return base.length >= 3 ? base : `csca_${String(fallbackId).replace(/[^a-z0-9]/gi, "").slice(0, 12) || "user"}`;
}

async function runSsoTransaction(db, work) {
  if (typeof db.transaction === "function") return db.transaction(work);
  if (db.pool && typeof db.pool.connect === "function") {
    const conn = await db.pool.connect();
    try {
      await conn.query("BEGIN");
      const res = await work(conn);
      await conn.query("COMMIT");
      return res;
    } catch (err) {
      await conn.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      conn.release();
    }
  }
  throw new SsoPolicyError(500, "TRANSACTION_REQUIRED", "SSO requires a transactional database adapter.");
}

async function createShadowStudentOnMoly(client, { externalUserId, email, emailVerified, displayName, username }) {
  const safeEmail = email || `${externalUserId.replace(/[^a-z0-9]/gi, "_")}@sso.csca.local`;
  const baseSeed = sanitizeUsernameSeed(username || displayName || safeEmail.split("@")[0], externalUserId);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = attempt === 0 ? "" : `_${crypto.randomBytes(3).toString("hex")}`;
    const candidateUsername = `${baseSeed}${suffix}`.slice(0, 50);
    await client.query("SAVEPOINT moly_sso_shadow_user");
    try {
      const inserted = (await client.query(
        `INSERT INTO users (
           username, email, password, full_name, role, oauth_provider,
           email_verified, is_verified, is_active
         ) VALUES (
           $1, $2, NULL, $3, 'student', 'sso',
           $4, $4, TRUE
         )
         RETURNING id, username, email, full_name, avatar, avatar_url, role, is_active, is_verified,
                   is_vip, subscription_tier, vip_expires_at, vip_package_id, vip_allowed_subjects, created_at`,
        [candidateUsername, safeEmail, displayName || candidateUsername, Boolean(email && emailVerified)],
      )).rows[0];
      await client.query(
        "INSERT INTO user_stats (user_id) VALUES ($1) ON CONFLICT DO NOTHING",
        [inserted.id],
      ).catch(() => {});
      await client.query("RELEASE SAVEPOINT moly_sso_shadow_user");
      return inserted;
    } catch (error) {
      await client.query("ROLLBACK TO SAVEPOINT moly_sso_shadow_user");
      if (error?.code === "23505" && String(error?.constraint || "").includes("username") && attempt < 4) {
        continue;
      }
      throw error;
    }
  }
  throw new SsoPolicyError(409, "SSO_PROVISION_CONFLICT", "Unable to provision shadow Moly learner.");
}

async function withTransaction(db, work) {
  const conflicts = [];
  try {
    return await runSsoTransaction(db, (client) => work({
      query: (sql, params) => client.query(sql, params),
      ssoConflicts: conflicts,
    }));
  } catch (error) {
    // Rejected account changes roll back, but their security review queue survives.
    for (const { sql, params } of conflicts) await db.query(sql, params);
    throw error;
  }
}

async function recordMolyConflict(client, {
  conflictType,
  externalUserId,
  candidateUserId = null,
  existingUserId = null,
  emailHint = null,
  correlationId = null,
  reason,
  payload = {},
}) {
  const persist = async (sql, params) => {
    await client.query(sql, params);
    client.ssoConflicts?.push({ sql, params });
  };
  await persist(
    `INSERT INTO integration_conflicts (
       source_system, conflict_type, status, external_user_id,
       candidate_user_id, existing_user_id, email_hint, correlation_id,
       source_updated_at, reason, payload
     ) VALUES (
       'csca-course', $1, 'open', $2,
       $3, $4, $5, $6,
       NOW(), $7, $8::jsonb
     )`,
    [
      conflictType,
      externalUserId,
      candidateUserId,
      existingUserId,
      emailHint,
      correlationId,
      reason,
      JSON.stringify(payload),
    ],
  );
}

function createCourseSsoService({
  db = defaultDb,
  courseClient = null,
  ownership = null,
  issueMolySession = null,
  now = () => new Date(),
  env = process.env,
} = {}) {
  async function resolveCourseMappingByLocalId(runner, courseId) {
    const rows = (await runner.query(
      `SELECT id, source_system, external_course_id, local_course_id, status, metadata
       FROM external_course_mappings
       WHERE local_course_id = $1
         AND status = 'active'
         AND (source_system = 'moly' OR (source_system = 'csca-course' AND (metadata ? 'moly_external_course_id')))
       ORDER BY id ASC
       LIMIT 1`,
      [courseId],
    )).rows;
    const row = rows[0];
    if (!row) return null;
    const offeringId = row.source_system === "moly"
      ? row.external_course_id
      : row.metadata?.moly_external_course_id;
    return offeringId ? { ...row, offering_id: String(offeringId).trim() } : null;
  }

  async function resolveCourseMappingByOfferingId(runner, offeringId) {
    const cleanOffering = typeof offeringId === "string" ? offeringId.trim() : "";
    if (!cleanOffering) return null;
    const rows = (await runner.query(
      `SELECT id, source_system, external_course_id, local_course_id, status, metadata
       FROM external_course_mappings
       WHERE status = 'active'
         AND (
           (source_system = 'moly' AND external_course_id = $1)
           OR (source_system = 'csca-course' AND metadata->>'moly_external_course_id' = $1)
         )
       ORDER BY id ASC
       LIMIT 1`,
      [cleanOffering],
    )).rows;
    const row = rows[0];
    if (!row) return null;
    return { ...row, offering_id: cleanOffering };
  }

  async function assertCourseLaunchEligible({ userId, courseId = null, offeringId = null, targetPath = null }) {
    const numericUserId = Number(userId);
    if (!Number.isSafeInteger(numericUserId) || numericUserId <= 0) {
      throw new SsoPolicyError(401, "AUTH_REQUIRED", "Authentication required.");
    }

    const user = (await db.query(
      `SELECT id, username, email, full_name, role, is_active, email_verified, is_verified,
              device_limit_locked_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [numericUserId],
    )).rows[0];
    if (!user || !user.is_active) {
      throw new SsoPolicyError(403, "ACCOUNT_INACTIVE", "Account is inactive or unavailable.");
    }
    if (user.device_limit_locked_at) {
      throw new SsoPolicyError(403, "DEVICE_LIMIT_LOCKED", "Account is currently device-limit locked.");
    }
    if (PRIVILEGED_ROLES.has(String(user.role || "").toLowerCase())) {
      throw new SsoPolicyError(403, "PRIVILEGED_ROLE_SSO_BLOCKED", "Privileged accounts must sign in separately on CSCA-Course.");
    }

    await assertMolyLearnerPolicy(db, numericUserId);

    let resolvedCourseId = null;
    let resolvedOfferingId = null;
    let scopeType = "account";
    let computedTargetPath = targetPath || "/courses";

    let mapping = null;
    if (courseId !== null && courseId !== undefined && courseId !== "") {
      resolvedCourseId = Number(courseId);
      if (!Number.isSafeInteger(resolvedCourseId) || resolvedCourseId <= 0) {
        throw new SsoPolicyError(400, "INVALID_COURSE_ID", "courseId must be a positive integer.");
      }
      mapping = await resolveCourseMappingByLocalId(db, resolvedCourseId);
      if (!mapping) {
        throw new SsoPolicyError(404, "COURSE_MAPPING_MISSING", "Course does not have an active CSCA-Course offering mapping.");
      }
    } else if (typeof offeringId === "string" && offeringId.trim()) {
      mapping = await resolveCourseMappingByOfferingId(db, offeringId.trim());
      if (!mapping) {
        throw new SsoPolicyError(404, "COURSE_MAPPING_MISSING", "Course offering does not have an active local mapping.");
      }
      resolvedCourseId = Number(mapping.local_course_id);
    }

    if (mapping && resolvedCourseId) {
      resolvedOfferingId = mapping.offering_id;
      scopeType = "course";

      if (ownership) {
        const evalResult = await ownership.evaluatePackageOwnership(numericUserId, {
          courseIds: [resolvedCourseId],
          refreshFromCourse: false,
        });
        if (!evalResult.owned || ["grant_blocked", "expired", "pending_sync", "verification_required"].includes(evalResult.status)) {
          const code = evalResult.status === "grant_blocked"
            ? "COURSE_ACCESS_REVOKED"
            : evalResult.status === "expired"
              ? "COURSE_ACCESS_EXPIRED"
              : evalResult.status === "verification_required"
                ? "IDENTITY_VERIFICATION_REQUIRED"
                : evalResult.status === "pending_sync"
                  ? "ENTITLEMENT_PENDING_SYNC"
                  : "COURSE_OWNERSHIP_REQUIRED";
          throw new SsoPolicyError(403, code, evalResult.label || "Course access is not active for this account.");
        }
      }

      computedTargetPath = targetPath || `/video-courses/${encodeURIComponent(resolvedOfferingId).replace(/%3A/gi, ":")}`;
    }

    const safeTargetPath = validateSsoTargetPath(computedTargetPath, { targetSystem: "csca-course" });
    return {
      user,
      resolvedCourseId,
      resolvedOfferingId,
      scopeType,
      safeTargetPath,
    };
  }

  async function checkCourseLaunchIntent({
    userId,
    courseId = null,
    offeringId = null,
    targetPath = null,
    correlationId = null,
    courseWebBaseUrl = null,
  }) {
    const eligible = await assertCourseLaunchEligible({ userId, courseId, offeringId, targetPath });
    const corr = correlationId || crypto.randomUUID();
    const webBase = courseWebBaseUrl || courseClient?.getConfig?.().courseWebBaseUrl || env.COURSE_WEB_BASE_URL || "";
    const destinationStartUrl = webBase
      ? buildSsoStartUrl({
          webBaseUrl: webBase,
          targetPath: eligible.safeTargetPath,
          courseId: eligible.resolvedCourseId,
          offeringId: eligible.resolvedOfferingId,
        })
      : null;

    return {
      targetSystem: "csca-course",
      targetPath: eligible.safeTargetPath,
      scopeType: eligible.scopeType,
      courseId: eligible.resolvedCourseId,
      offeringId: eligible.resolvedOfferingId,
      destinationStartUrl,
      correlationId: corr,
    };
  }

  async function authorizeCourseSsoRequest({
    userId,
    state,
    codeChallenge,
    codeChallengeMethod = "S256",
    courseId = null,
    offeringId = null,
    targetPath = null,
    req = null,
    res = null,
    correlationId = null,
    courseWebBaseUrl = null,
  }) {
    const validatedState = validateSsoStateParam(state);
    const validatedChallenge = validatePkceChallenge(codeChallenge, codeChallengeMethod);
    const eligible = await assertCourseLaunchEligible({ userId, courseId, offeringId, targetPath });
    const trustedDevice = req
      ? await ensureMolyTrustedDevice({
          req,
          res,
          user: eligible.user,
          db,
          env,
          now: () => now().getTime(),
        })
      : null;

    const ttlSeconds = resolveSsoTtlSeconds(env.COURSE_SSO_TTL_SECONDS, DEFAULT_SSO_TTL_SECONDS);
    const issuedAt = now();
    const expiresAt = new Date(issuedAt.getTime() + ttlSeconds * 1000);
    const code = generateOpaqueSsoCode();
    const codeHash = hashSsoToken(code);
    const corr = correlationId || crypto.randomUUID();
    const ssoMetadata = trustedDevice?.deviceTokenHash
      ? {
          molyDeviceTokenHash: trustedDevice.deviceTokenHash,
          deviceName: trustedDevice.deviceName || null,
          userAgent: trustedDevice.userAgent || "",
          ipAddress: trustedDevice.ipAddress || null,
        }
      : {};

    await db.query(
      `INSERT INTO integration_sso_codes (
         code_hash, source_system, source_user_id, local_user_id,
         target_system, target_path, nonce, pkce_challenge, pkce_method,
         scope_type, scoped_local_course_id, scoped_external_course_id,
         metadata, correlation_id, expires_at
       ) VALUES (
         $1, 'moly', $2, $3,
         'csca-course', $4, $5, $6, 'S256',
         $7, $8, $9,
         $10::jsonb, $11, $12
       )`,
      [
        codeHash,
        String(eligible.user.id),
        eligible.user.id,
        eligible.safeTargetPath,
        validatedState,
        validatedChallenge,
        eligible.scopeType,
        eligible.resolvedCourseId,
        eligible.resolvedOfferingId,
        JSON.stringify(ssoMetadata),
        corr,
        expiresAt.toISOString(),
      ],
    );

    const webBase = courseWebBaseUrl || courseClient?.getConfig?.().courseWebBaseUrl || env.COURSE_WEB_BASE_URL || "";
    const callbackUrl = webBase
      ? buildSsoCallbackUrl({ webBaseUrl: webBase, code, state: validatedState })
      : null;

    return {
      code,
      state: validatedState,
      targetSystem: "csca-course",
      targetPath: eligible.safeTargetPath,
      scopeType: eligible.scopeType,
      courseId: eligible.resolvedCourseId,
      offeringId: eligible.resolvedOfferingId,
      expiresAt: expiresAt.toISOString(),
      expiresInSeconds: ttlSeconds,
      correlationId: corr,
      redirectUrl: callbackUrl,
      launchUrl: callbackUrl,
    };
  }

  async function issueCourseLaunch() {
    throw new SsoPolicyError(
      400,
      "SSO_PKCE_REQUIRED",
      "Legacy non-PKCE SSO launch is disabled. Use destination-initiated PKCE browser transaction flow.",
    );
  }

  async function exchangeMolySsoCode({
    code,
    nonce,
    codeVerifier = null,
    consumerSystem = "csca-course",
    consumeIp = null,
    correlationId = null,
  }) {
    if (!code || !nonce) {
      throw new SsoPolicyError(400, "SSO_INVALID_REQUEST", "SSO code and nonce are required.");
    }
    if (!codeVerifier) {
      throw new SsoPolicyError(401, "SSO_PKCE_VERIFIER_REQUIRED", "PKCE code_verifier is required.");
    }
    if (consumerSystem !== "csca-course") {
      throw new SsoPolicyError(403, "SSO_CONSUMER_MISMATCH", "Consumer system mismatch.");
    }

    const codeHash = hashSsoToken(code);
    const current = now();
    const corr = correlationId || crypto.randomUUID();

    return withTransaction(db, async (client) => {
      const ssoRow = (await client.query(
        `SELECT *
         FROM integration_sso_codes
         WHERE code_hash = $1
         FOR UPDATE`,
        [codeHash],
      )).rows[0];

      if (!ssoRow || ssoRow.source_system !== "moly" || ssoRow.target_system !== "csca-course") {
        throw new SsoPolicyError(401, "SSO_CODE_INVALID", "Invalid SSO exchange code.");
      }
      if (ssoRow.revoked_at) {
        throw new SsoPolicyError(401, "SSO_CODE_REVOKED", "SSO code has been revoked.");
      }
      if (ssoRow.used_at) {
        throw new SsoPolicyError(409, "SSO_CODE_ALREADY_USED", "SSO code has already been consumed.");
      }
      if (new Date(ssoRow.expires_at).getTime() <= current.getTime()) {
        throw new SsoPolicyError(401, "SSO_CODE_EXPIRED", "SSO code has expired.");
      }
      if (!constantTimeEqual(ssoRow.nonce, nonce)) {
        throw new SsoPolicyError(401, "SSO_STATE_MISMATCH", "SSO state/nonce verification failed.");
      }
      if (!ssoRow.pkce_challenge || String(ssoRow.pkce_method || "").toUpperCase() !== "S256") {
        throw new SsoPolicyError(400, "SSO_PKCE_REQUIRED", "Legacy non-PKCE SSO codes cannot be exchanged.");
      }
      if (!verifyPkceVerifierS256(codeVerifier, ssoRow.pkce_challenge)) {
        throw new SsoPolicyError(403, "SSO_PKCE_MISMATCH", "PKCE code_verifier verification failed.");
      }

      const user = (await client.query(
        `SELECT id, username, email, full_name, role, is_active, email_verified, is_verified,
                device_limit_locked_at
         FROM users
         WHERE id = $1
         LIMIT 1`,
        [ssoRow.local_user_id],
      )).rows[0];

      if (!user || !user.is_active || user.device_limit_locked_at) {
        throw new SsoPolicyError(403, "SSO_USER_REVOKED", "Moly user is inactive or locked.");
      }
      if (PRIVILEGED_ROLES.has(String(user.role || "").toLowerCase())) {
        throw new SsoPolicyError(403, "PRIVILEGED_ROLE_COLLISION", "Privileged Moly roles cannot authenticate across systems via SSO.");
      }

      const identities = (await client.query(
        `SELECT external_user_id, status
         FROM external_identities
         WHERE source_system = 'csca-course' AND user_id = $1
         ORDER BY updated_at DESC, id DESC`,
        [user.id],
      )).rows;
      await assertMolyLearnerPolicy(client, user.id);
      if (identities.length && !identities.some((row) => row.status === "active")) {
        throw new SsoPolicyError(403, "SSO_IDENTITY_REVOKED", "Linked identity has been revoked.");
      }

      if (ssoRow.scope_type === "course" && ssoRow.scoped_local_course_id && ownership) {
        const hasCourseEnrollments = (await client.query("SELECT to_regclass('course_enrollments') AS rel")).rows[0]?.rel;
        if (hasCourseEnrollments) {
          const revokedEnroll = (await client.query(
            `SELECT 1 FROM course_enrollments
             WHERE user_id = $1 AND course_id = $2 AND status = 'revoked'
             LIMIT 1`,
            [user.id, Number(ssoRow.scoped_local_course_id)],
          )).rows[0];
          if (revokedEnroll) {
            throw new SsoPolicyError(403, "SSO_ENTITLEMENT_REVOKED", "Course enrollment has been revoked.");
          }
        }
        const evalResult = await ownership.evaluatePackageOwnership(user.id, {
          courseIds: [Number(ssoRow.scoped_local_course_id)],
          refreshFromCourse: false,
          client,
          currentNow: current,
        });
        if (!evalResult.owned || ["grant_blocked", "expired"].includes(evalResult.status)) {
          throw new SsoPolicyError(403, "SSO_ENTITLEMENT_REVOKED", "Course entitlement has expired or been revoked.");
        }
      }

      const safeTargetPath = validateSsoTargetPath(ssoRow.target_path, { targetSystem: "csca-course" });
      await client.query(
        `UPDATE integration_sso_codes
         SET used_at = $2, used_by_system = 'csca-course', consume_ip = $3
         WHERE id = $1 AND used_at IS NULL`,
        [ssoRow.id, current.toISOString(), consumeIp ? String(consumeIp).slice(0, 64) : null],
      );

      const activeCourseIdentity = identities.find((row) => row.status === "active");
      const metaDeviceHash = typeof ssoRow.metadata?.molyDeviceTokenHash === "string"
        ? ssoRow.metadata.molyDeviceTokenHash.trim().toLowerCase()
        : null;
      let deviceSlotProof = null;
      if (metaDeviceHash && /^[0-9a-f]{64}$/.test(metaDeviceHash)) {
        try {
          deviceSlotProof = buildDeviceSlotProof({
            externalUserId: String(user.id),
            molyDeviceTokenHash: metaDeviceHash,
            deviceName: ssoRow.metadata?.deviceName || null,
            userAgent: ssoRow.metadata?.userAgent || "",
            ipAddress: ssoRow.metadata?.ipAddress || consumeIp || null,
            now: () => current.getTime(),
            env,
          }).proofObject;
        } catch {
          deviceSlotProof = null;
        }
      }
      return {
        source_system: "moly",
        source_user_id: String(user.id),
        email: normalizeEmail(user.email),
        email_verified: Boolean(user.email_verified || user.is_verified),
        username: user.username,
        display_name: user.full_name || user.username,
        role: "student",
        linked_target_user_id: activeCourseIdentity ? stripCoursePrefix(activeCourseIdentity.external_user_id) : null,
        target_path: safeTargetPath,
        scope_type: ssoRow.scope_type,
        scoped_local_course_id: ssoRow.scoped_local_course_id ?? null,
        scoped_external_course_id: ssoRow.scoped_external_course_id ?? null,
        nonce: ssoRow.nonce,
        correlation_id: ssoRow.correlation_id || corr,
        ...(deviceSlotProof ? { device_slot_proof: deviceSlotProof } : {}),
        ...(metaDeviceHash ? { moly_device_token_hash: metaDeviceHash } : {}),
      };
    });
  }

  async function resolveConsumeOutcome(client, exchanged, { current, corr }) {
    const namespacedCourseId = normalizeNamespacedCourseId(exchanged.source_user_id);
    const sourceRole = normalizeSourceRole(exchanged.role);
    const learningPersona = exchanged.learning_persona === true;
    const email = normalizeEmail(exchanged.email);
    const targetPath = validateSsoTargetPath(exchanged.target_path, { targetSystem: "moly" });
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", [
      "csca-course:identity", namespacedCourseId,
    ]);

    const existingIdentity = (await client.query(
      `SELECT ei.id, ei.user_id, ei.status,
              u.id AS u_id, u.username, u.email, u.full_name, u.avatar, u.avatar_url,
              u.role, u.is_active, u.is_verified, u.is_vip, u.subscription_tier,
              u.vip_expires_at, u.vip_package_id, u.vip_allowed_subjects, u.created_at,
              u.device_limit_locked_at
       FROM external_identities ei
       JOIN users u ON u.id = ei.user_id
       WHERE ei.source_system = 'csca-course' AND ei.external_user_id = $1
       FOR UPDATE OF ei`,
      [namespacedCourseId],
    )).rows[0];

    if (existingIdentity) {
      if (existingIdentity.status !== "active") {
        throw new SsoPolicyError(403, "SSO_IDENTITY_REVOKED", "Linked identity has been revoked or suspended.");
      }
      if (!existingIdentity.is_active || existingIdentity.device_limit_locked_at) {
        throw new SsoPolicyError(403, "SSO_USER_REVOKED", "Moly user account is inactive or locked.");
      }
      if (PRIVILEGED_ROLES.has(String(existingIdentity.role || "").toLowerCase()) || PRIVILEGED_ROLES.has(sourceRole)) {
        await recordMolyConflict(client, {
          conflictType: "PRIVILEGED_ROLE_COLLISION",
          externalUserId: namespacedCourseId,
          candidateUserId: existingIdentity.u_id,
          emailHint: email,
          correlationId: corr,
          reason: "Privileged roles cannot auto-sign-in across systems via SSO.",
        });
        throw new SsoPolicyError(403, "PRIVILEGED_ROLE_COLLISION", "Privileged accounts cannot sign in across systems via SSO.");
      }

      return {
        outcome: "AUTHENTICATED",
        user: {
          id: existingIdentity.u_id,
          username: existingIdentity.username,
          email: existingIdentity.email,
          full_name: existingIdentity.full_name,
          avatar: existingIdentity.avatar,
          avatar_url: existingIdentity.avatar_url,
          role: existingIdentity.role,
          is_active: existingIdentity.is_active,
          is_verified: existingIdentity.is_verified,
          is_vip: existingIdentity.is_vip,
          subscription_tier: existingIdentity.subscription_tier,
          vip_expires_at: existingIdentity.vip_expires_at,
          vip_package_id: existingIdentity.vip_package_id,
          vip_allowed_subjects: existingIdentity.vip_allowed_subjects,
          created_at: existingIdentity.created_at,
        },
        targetPath,
        externalUserId: namespacedCourseId,
        learningPersona,
      };
    }

    if (PRIVILEGED_ROLES.has(sourceRole)) {
      await recordMolyConflict(client, {
        conflictType: "PRIVILEGED_ROLE_COLLISION",
        externalUserId: namespacedCourseId,
        emailHint: email,
        correlationId: corr,
        reason: "Privileged source role rejected by Moly SSO policy.",
      });
      throw new SsoPolicyError(403, "PRIVILEGED_ROLE_COLLISION", "Privileged accounts cannot use cross-system SSO.");
    }

    if (email) {
      const candidates = (await client.query(
        `SELECT id, username, email, role, password, is_active, device_limit_locked_at
         FROM users
         WHERE LOWER(email) = LOWER($1)
         ORDER BY id ASC`,
        [email],
      )).rows;

      if (candidates.length > 0) {
        const privilegedCandidate = candidates.find((c) => PRIVILEGED_ROLES.has(String(c.role || "").toLowerCase()));
        if (privilegedCandidate) {
          await recordMolyConflict(client, {
            conflictType: "PRIVILEGED_ROLE_COLLISION",
            externalUserId: namespacedCourseId,
            candidateUserId: privilegedCandidate.id,
            emailHint: email,
            correlationId: corr,
            reason: "Course learner email matches a privileged Moly staff/admin account.",
          });
          throw new SsoPolicyError(403, "PRIVILEGED_ROLE_COLLISION", "Matching privileged account cannot be linked via SSO.");
        }

        const candidate = candidates[0];
        if (!candidate.is_active || candidate.device_limit_locked_at) {
          throw new SsoPolicyError(403, "SSO_USER_REVOKED", "Matching Moly account is inactive or locked.");
        }

        const linkToken = generateOpaqueSsoCode(32);
        const linkTokenHash = hashSsoToken(linkToken);
        const linkBrowserTxToken = generateOpaqueSsoCode(32);
        const linkBrowserTxHash = hashSsoToken(linkBrowserTxToken);
        const expiresAt = new Date(current.getTime() + LINK_TOKEN_TTL_SECONDS * 1000);

        await recordMolyConflict(client, {
          conflictType: "IDENTITY_EMAIL_COLLISION",
          externalUserId: namespacedCourseId,
          candidateUserId: candidate.id,
          emailHint: email,
          correlationId: corr,
          reason: "Existing unlinked Moly learner shares the same email; explicit owner verification required.",
        });

        await client.query(
          `INSERT INTO integration_sso_link_requests (
             link_token_hash, browser_tx_hash, source_system, external_user_id, candidate_user_id,
             email, source_role, target_path, sso_nonce, correlation_id, expires_at
           ) VALUES (
             $1, $2, 'csca-course', $3, $4,
             $5, $6, $7, $8, $9, $10
           )`,
          [
            linkTokenHash,
            linkBrowserTxHash,
            namespacedCourseId,
            candidate.id,
            email,
            sourceRole,
            targetPath,
            exchanged.nonce || null,
            corr,
            expiresAt.toISOString(),
          ],
        );

        return {
          outcome: "LINK_REQUIRED",
          linkToken,
          linkBrowserTxToken,
          email,
          hasPassword: Boolean(candidate.password),
          targetPath,
          candidateUserId: candidate.id,
          correlationId: corr,
        };
      }
    }

    const shadowUser = await createShadowStudentOnMoly(client, {
      externalUserId: namespacedCourseId,
      email,
      emailVerified: exchanged.email_verified === true,
      displayName: exchanged.display_name || exchanged.username,
      username: exchanged.username,
    });

    await client.query(
      `INSERT INTO external_identities (
         source_system, external_user_id, user_id, status,
         link_method, source_updated_at, last_synced_at, correlation_id
       ) VALUES (
         'csca-course', $1, $2, 'active',
         'sso', $3, $3, $4
       )`,
      [namespacedCourseId, shadowUser.id, current.toISOString(), corr],
    );

    return {
      outcome: "AUTHENTICATED",
      user: shadowUser,
      targetPath,
      externalUserId: namespacedCourseId,
      jitCreated: true,
      learningPersona,
    };
  }

  async function issueAuthResult({
    req,
    res = null,
    user,
    targetPath,
    externalUserId,
    learningPersona = false,
    syncPeer,
    nonce,
    corr,
    devicePrep = null,
  }) {
    await assertMolyLearnerPolicy(db, user.id);
    if (syncPeer && courseClient?.isConfigured?.()) {
      await courseClient.bindSsoPeerIdentity({
        externalUserId: `moly:${user.id}`,
        targetUserId: stripCoursePrefix(externalUserId),
        email: user.email,
        learningPersona,
        nonce: nonce || "sso-bind",
        correlationId: corr,
      });
    }

    if (devicePrep) {
      await finalizeSsoBrowserDevice({ req, res, db, userId: user.id, devicePrep, env });
    } else if (req) {
      await ensureMolyTrustedDevice({
        req,
        res,
        user,
        db,
        env,
        allowRotateRevoked: true,
      }).catch(() => null);
    }

    if (ownership) {
      await ownership.syncUserOwnershipFromCourse(user.id, { correlationId: corr, throwOnError: false }).catch(() => null);
    }

    const sessionData = typeof issueMolySession === "function"
      ? await issueMolySession({ req, user })
      : null;

    return {
      status: "AUTHENTICATED",
      user: sessionData?.user || user,
      token: sessionData?.token || null,
      refreshToken: sessionData?.refreshToken || null,
      redirectPath: targetPath,
      correlationId: corr,
    };
  }

  async function startIncomingCourseSsoTransaction({
    targetPath = null,
    correlationId = null,
    courseWebBaseUrl = null,
  } = {}) {
    const safeTargetPath = validateSsoTargetPath(targetPath || "/hoc", { targetSystem: "moly" });
    const browserTxToken = generateOpaqueSsoCode(32);
    const txTokenHash = hashSsoToken(browserTxToken);
    const state = generateSsoNonce();
    const codeVerifier = generatePkceVerifier();
    const codeChallenge = computePkceChallengeS256(codeVerifier);
    const ttlSeconds = resolveSsoTtlSeconds(env.SSO_BROWSER_TX_TTL_SECONDS, DEFAULT_BROWSER_TX_TTL_SECONDS);
    const issuedAt = now();
    const expiresAt = new Date(issuedAt.getTime() + ttlSeconds * 1000);
    const corr = correlationId || crypto.randomUUID();

    await db.query(
      `INSERT INTO integration_sso_browser_txs (
         tx_token_hash, direction, purpose, state,
         code_verifier, code_challenge, code_challenge_method, target_path, correlation_id, expires_at
       ) VALUES (
         $1, 'csca_course_to_moly', 'sso_login', $2,
         $3, $4, 'S256', $5, $6, $7
       )`,
      [txTokenHash, state, codeVerifier, codeChallenge, safeTargetPath, corr, expiresAt.toISOString()],
    );

    const webBase = courseWebBaseUrl || courseClient?.getConfig?.().courseWebBaseUrl || env.COURSE_WEB_BASE_URL || "";
    const authorizeUrl = webBase
      ? buildSsoAuthorizeUrl({
          webBaseUrl: webBase,
          targetSystem: "moly",
          state,
          codeChallenge,
          codeChallengeMethod: "S256",
          targetPath: safeTargetPath,
        })
      : null;

    return {
      cookieName: MOLY_SSO_TX_COOKIE,
      browserTxToken,
      ttlSeconds,
      state,
      targetPath: safeTargetPath,
      authorizeUrl,
      expiresAt: expiresAt.toISOString(),
      correlationId: corr,
    };
  }

  async function consumeCourseSso({
    code,
    state,
    req = null,
    res = null,
    browserTxToken = null,
    ipAddress = null,
    correlationId = null,
  }) {
    if (!code || !state) {
      throw new SsoPolicyError(400, "SSO_INVALID_REQUEST", "SSO code and state are required.");
    }
    if (!courseClient) {
      throw new SsoPolicyError(503, "COURSE_SSO_NOT_CONFIGURED", "CSCA-Course SSO client is unavailable.");
    }

    const rawTxToken = browserTxToken || readSsoCookie(req, MOLY_SSO_TX_COOKIE);
    if (!rawTxToken) {
      throw new SsoPolicyError(
        403,
        "SSO_BROWSER_BINDING_REQUIRED",
        "SSO login must finish in the browser session that initiated it.",
      );
    }

    const corr = correlationId || crypto.randomUUID();
    const current = now();
    const txHash = hashSsoToken(rawTxToken);

    const boundTx = await withTransaction(db, async (client) => {
      const txRow = (await client.query(
        `SELECT *
         FROM integration_sso_browser_txs
         WHERE tx_token_hash = $1
         FOR UPDATE`,
        [txHash],
      )).rows[0];

      if (!txRow || txRow.direction !== "csca_course_to_moly" || txRow.purpose !== "sso_login") {
        throw new SsoPolicyError(403, "SSO_BROWSER_BINDING_INVALID", "Invalid SSO browser transaction cookie.");
      }
      if (txRow.revoked_at) {
        throw new SsoPolicyError(403, "SSO_BROWSER_TX_REVOKED", "SSO browser transaction was revoked.");
      }
      if (txRow.consumed_at) {
        throw new SsoPolicyError(409, "SSO_BROWSER_TX_ALREADY_USED", "SSO browser transaction was already consumed.");
      }
      if (new Date(txRow.expires_at).getTime() <= current.getTime()) {
        throw new SsoPolicyError(401, "SSO_BROWSER_TX_EXPIRED", "SSO browser transaction has expired. Please try again.");
      }
      if (!constantTimeEqual(txRow.state, state)) {
        throw new SsoPolicyError(403, "SSO_BROWSER_STATE_MISMATCH", "SSO state does not match this browser transaction.");
      }

      await client.query(
        `UPDATE integration_sso_browser_txs
         SET consumed_at = $2
         WHERE id = $1 AND consumed_at IS NULL`,
        [txRow.id, current.toISOString()],
      );

      return {
        codeVerifier: txRow.code_verifier,
        targetPath: txRow.target_path,
      };
    });

    const devicePrep = await prepareSsoBrowserDevice({ req, db, env, now: () => current.getTime() });
    const deviceSlotProof = devicePrep?.canSignProof?.()
      ? devicePrep.buildProof({
          externalUserId: devicePrep.existingUserId ? `moly:${devicePrep.existingUserId}` : `sso:${state}`,
        }).proofHeader
      : null;

    let exchanged;
    try {
      exchanged = await courseClient.exchangeSsoCode({
        code,
        nonce: state,
        codeVerifier: boundTx.codeVerifier,
        consumeIp: ipAddress,
        deviceSlotProof,
        correlationId: corr,
      });
    } catch (exchangeErr) {
      if (exchangeErr?.status && exchangeErr?.code && exchangeErr.status < 500) {
        throw new SsoPolicyError(exchangeErr.status, exchangeErr.code, exchangeErr.message, exchangeErr.details);
      }
      throw exchangeErr;
    }
    if (exchanged?.source_system !== "csca-course" || !exchanged.source_user_id
      || !constantTimeEqual(exchanged.nonce, state)) {
      throw new SsoPolicyError(502, "SSO_INVALID_RESPONSE", "SSO issuer or nonce does not match this exchange.");
    }

    const resolved = await withTransaction(db, (client) =>
      resolveConsumeOutcome(client, exchanged, { current, corr }),
    );

    if (resolved.outcome === "LINK_REQUIRED") {
      return {
        status: "LINK_REQUIRED",
        linkToken: resolved.linkToken,
        linkBrowserTxToken: resolved.linkBrowserTxToken,
        linkCookieName: MOLY_SSO_LINK_COOKIE,
        linkCookieTtlSeconds: LINK_TOKEN_TTL_SECONDS,
        email: resolved.email,
        hasPassword: resolved.hasPassword,
        targetPath: resolved.targetPath,
        correlationId: corr,
      };
    }

    return issueAuthResult({
      req,
      res,
      user: resolved.user,
      targetPath: resolved.targetPath,
      externalUserId: resolved.externalUserId,
      learningPersona: resolved.learningPersona === true,
      syncPeer: true,
      nonce: exchanged.nonce || state,
      corr,
      devicePrep,
    });
  }

  async function getMolySafeLinkStatus({ req = null, linkBrowserTxToken = null } = {}) {
    const rawLinkCookie = linkBrowserTxToken || readSsoCookie(req, MOLY_SSO_LINK_COOKIE);
    if (!rawLinkCookie) {
      throw new SsoPolicyError(404, "SSO_LINK_SESSION_NOT_FOUND", "No pending link verification in this browser.");
    }
    const cookieHash = hashSsoToken(rawLinkCookie);
    const current = now();
    const row = (await db.query(
      `SELECT l.id, l.email, l.target_path, l.expires_at, l.completed_at, (u.password IS NOT NULL) AS has_password
       FROM integration_sso_link_requests l
       JOIN users u ON u.id = l.candidate_user_id
       WHERE l.browser_tx_hash = $1
         AND l.source_system = 'csca-course'
       ORDER BY l.id DESC
       LIMIT 1`,
      [cookieHash],
    )).rows[0];

    if (!row || row.completed_at) {
      throw new SsoPolicyError(404, "SSO_LINK_SESSION_NOT_FOUND", "Link verification session has already completed or is invalid.");
    }
    if (new Date(row.expires_at).getTime() <= current.getTime()) {
      throw new SsoPolicyError(401, "SSO_LINK_TOKEN_EXPIRED", "Verification challenge has expired.");
    }

    return {
      status: "LINK_REQUIRED",
      email: row.email,
      hasPassword: Boolean(row.has_password),
      targetPath: row.target_path,
      expiresAt: new Date(row.expires_at).toISOString(),
    };
  }

  async function confirmMolySafeLink({
    linkToken = "",
    password = null,
    authenticatedUser = null,
    req = null,
    res = null,
    linkBrowserTxToken = null,
    correlationId = null,
  }) {
    const rawLinkCookie = linkBrowserTxToken || readSsoCookie(req, MOLY_SSO_LINK_COOKIE);
    if (!rawLinkCookie) {
      throw new SsoPolicyError(
        403,
        "SSO_BROWSER_BINDING_REQUIRED",
        "Account link verification must be completed in the same browser session.",
      );
    }
    const trimmedLinkToken = typeof linkToken === "string" ? linkToken.trim() : "";
    const tokenHash = trimmedLinkToken ? hashSsoToken(trimmedLinkToken) : null;
    const browserTxHash = hashSsoToken(rawLinkCookie);
    const current = now();
    const corr = correlationId || crypto.randomUUID();

    const verified = await withTransaction(db, async (client) => {
      const linkRow = tokenHash
        ? (await client.query(
            `SELECT *
             FROM integration_sso_link_requests
             WHERE link_token_hash = $1
             FOR UPDATE`,
            [tokenHash],
          )).rows[0]
        : (await client.query(
            `SELECT *
             FROM integration_sso_link_requests
             WHERE browser_tx_hash = $1
               AND source_system = 'csca-course'
             ORDER BY id DESC
             LIMIT 1
             FOR UPDATE`,
            [browserTxHash],
          )).rows[0];

      if (!linkRow || linkRow.completed_at) {
        throw new SsoPolicyError(400, "SSO_LINK_TOKEN_INVALID", "Verification challenge is invalid or already used.");
      }
      if (new Date(linkRow.expires_at).getTime() <= current.getTime()) {
        throw new SsoPolicyError(401, "SSO_LINK_TOKEN_EXPIRED", "Verification challenge has expired.");
      }
      if (!linkRow.browser_tx_hash || !constantTimeEqual(linkRow.browser_tx_hash, browserTxHash)) {
        throw new SsoPolicyError(
          403,
          "SSO_BROWSER_BINDING_MISMATCH",
          "Verification challenge belongs to a different browser session.",
        );
      }
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", [
        "csca-course:identity", linkRow.external_user_id,
      ]);
      const boundIdentity = (await client.query(
        "SELECT user_id, status FROM external_identities WHERE source_system = $1 AND external_user_id = $2 FOR UPDATE",
        ["csca-course", linkRow.external_user_id],
      )).rows[0];
      if (boundIdentity && (Number(boundIdentity.user_id) !== Number(linkRow.candidate_user_id)
        || boundIdentity.status !== "active")) {
        throw new SsoPolicyError(409, "IDENTITY_ALREADY_LINKED", "Identity was linked elsewhere or disabled after this challenge was issued.");
      }

      const candidate = (await client.query(
        `SELECT id, username, email, password, full_name, avatar, avatar_url, role, is_active, is_verified,
                is_vip, subscription_tier, vip_expires_at, vip_package_id, vip_allowed_subjects, created_at,
                device_limit_locked_at
         FROM users
         WHERE id = $1
         FOR UPDATE`,
        [linkRow.candidate_user_id],
      )).rows[0];

      if (!candidate || !candidate.is_active || candidate.device_limit_locked_at) {
        throw new SsoPolicyError(403, "SSO_USER_REVOKED", "Account is unavailable or locked.");
      }
      if (PRIVILEGED_ROLES.has(String(candidate.role || "").toLowerCase())) {
        throw new SsoPolicyError(403, "PRIVILEGED_ROLE_COLLISION", "Privileged accounts cannot self-link via SSO.");
      }
      await assertMolyLearnerPolicy(client, candidate.id);

      const verifiedBySession = Boolean(
        authenticatedUser
        && Number(authenticatedUser.id) === Number(candidate.id)
        && normalizeEmail(authenticatedUser.email) === normalizeEmail(candidate.email),
      );
      if (!verifiedBySession) {
        if (typeof password !== "string" || !password || !candidate.password) {
          throw new SsoPolicyError(401, "SSO_LINK_VERIFICATION_REQUIRED", "Password or active session verification on this account is required.");
        }
        const ok = await bcrypt.compare(password, candidate.password);
        if (!ok) {
          throw new SsoPolicyError(401, "INVALID_CREDENTIALS", "Incorrect account password.");
        }
      }

      const otherIdentity = (await client.query(
        `SELECT id, external_user_id
         FROM external_identities
         WHERE source_system = 'csca-course' AND user_id = $1 AND status IN ('active', 'suspended')
         LIMIT 1`,
        [candidate.id],
      )).rows[0];
      if (otherIdentity && otherIdentity.external_user_id !== linkRow.external_user_id) {
        throw new SsoPolicyError(409, "IDENTITY_ALREADY_LINKED", "This Moly account is already linked to another Course user.");
      }

      await client.query(
        `INSERT INTO external_identities (
           source_system, external_user_id, user_id, status,
           link_method, source_updated_at, last_synced_at, correlation_id
         ) VALUES (
           'csca-course', $1, $2, 'active',
           'sso', $3, $3, $4
         )
         ON CONFLICT (source_system, external_user_id) DO NOTHING`,
        [linkRow.external_user_id, candidate.id, current.toISOString(), corr],
      );

      await client.query(
        `UPDATE integration_sso_link_requests
         SET completed_at = $2
         WHERE id = $1`,
        [linkRow.id, current.toISOString()],
      );

      await client.query(
        `UPDATE integration_conflicts
         SET status = 'resolved', resolved_by = $2, resolved_at = $3,
             resolution_note = 'Verified by account owner via SSO safe-linking flow'
         WHERE source_system = 'csca-course'
           AND external_user_id = $1
           AND candidate_user_id = $2
           AND conflict_type = 'IDENTITY_EMAIL_COLLISION'
           AND status IN ('open', 'in_review')`,
        [linkRow.external_user_id, candidate.id, current.toISOString()],
      );

      return {
        candidate,
        targetPath: validateSsoTargetPath(linkRow.target_path, { targetSystem: "moly" }),
        externalUserId: linkRow.external_user_id,
        ssoNonce: linkRow.sso_nonce,
      };
    });

    return issueAuthResult({
      req,
      res,
      user: verified.candidate,
      targetPath: verified.targetPath,
      externalUserId: verified.externalUserId,
      syncPeer: true,
      nonce: verified.ssoNonce,
      corr,
    });
  }

  async function bindPeerIdentityFromCourse({
    externalUserId,
    targetUserId,
    correlationId = null,
  }) {
    const namespacedCourseId = normalizeNamespacedCourseId(externalUserId);
    const localMolyUserId = Number(targetUserId);
    if (!Number.isSafeInteger(localMolyUserId) || localMolyUserId <= 0) {
      throw new SsoPolicyError(422, "VALIDATION_ERROR", "Valid target_user_id is required.");
    }
    const corr = correlationId || crypto.randomUUID();
    const current = now();

    return withTransaction(db, async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", [
        "csca-course:identity", namespacedCourseId,
      ]);
      const localUser = (await client.query(
        `SELECT id, email, role, is_active, device_limit_locked_at
         FROM users
         WHERE id = $1
         FOR UPDATE`,
        [localMolyUserId],
      )).rows[0];
      if (!localUser || !localUser.is_active || localUser.device_limit_locked_at) {
        throw new SsoPolicyError(404, "USER_NOT_FOUND", "Target Moly user does not exist or is inactive.");
      }
      if (PRIVILEGED_ROLES.has(String(localUser.role || "").toLowerCase())) {
        throw new SsoPolicyError(403, "PRIVILEGED_ROLE_COLLISION", "Cannot bind privileged accounts.");
      }
      await assertMolyLearnerPolicy(client, localUser.id);

      const byExternal = (await client.query(
        `SELECT id, user_id, status
         FROM external_identities
         WHERE source_system = 'csca-course' AND external_user_id = $1
         FOR UPDATE`,
        [namespacedCourseId],
      )).rows[0];
      if (byExternal) {
        if (byExternal.status !== "active") {
          throw new SsoPolicyError(403, "SSO_IDENTITY_REVOKED", "Peer identity is not active.");
        }
        if (Number(byExternal.user_id) !== localMolyUserId) {
          throw new SsoPolicyError(409, "IDENTITY_ALREADY_LINKED", "Course identity is bound to a different Moly user.");
        }
        return { bound: true, existing: true, userId: localMolyUserId, externalUserId: namespacedCourseId };
      }

      const byLocal = (await client.query(
        `SELECT id
         FROM external_identities
         WHERE source_system = 'csca-course' AND user_id = $1 AND status IN ('active', 'suspended')
         LIMIT 1`,
        [localMolyUserId],
      )).rows[0];
      if (byLocal) {
        throw new SsoPolicyError(409, "IDENTITY_ALREADY_LINKED", "Moly user is already bound to a different Course identity.");
      }

      await client.query(
        `INSERT INTO external_identities (
           source_system, external_user_id, user_id, status,
           link_method, source_updated_at, last_synced_at, correlation_id
         ) VALUES (
           'csca-course', $1, $2, 'active',
           'sso', $3, $3, $4
         )`,
        [namespacedCourseId, localMolyUserId, current.toISOString(), corr],
      );

      return { bound: true, existing: false, userId: localMolyUserId, externalUserId: namespacedCourseId };
    });
  }

  return {
    MOLY_SSO_TX_COOKIE,
    MOLY_SSO_LINK_COOKIE,
    checkCourseLaunchIntent,
    authorizeCourseSsoRequest,
    issueCourseLaunch,
    exchangeMolySsoCode,
    startIncomingCourseSsoTransaction,
    consumeCourseSso,
    getMolySafeLinkStatus,
    confirmMolySafeLink,
    bindPeerIdentityFromCourse,
  };
}

module.exports = {
  createCourseSsoService,
};
