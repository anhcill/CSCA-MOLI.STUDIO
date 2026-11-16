const crypto = require("crypto");
const { CourseApiError } = require("../utils/courseResponses");
const { resolveCorrelationId } = require("../utils/integrationLogger");
const {
  upsertLearningProgressProjectionTx,
  upsertAssessmentProjectionTx,
  upsertNoteProjectionTx,
  upsertBookmarkProjectionTx,
  upsertQaThreadProjectionTx,
} = require("./molyCourseCatalogSyncService");

function decodeDispositionFilename(headerVal) {
  if (!headerVal || typeof headerVal !== "string") return null;
  const starMatch = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(headerVal);
  if (starMatch && starMatch[1]) {
    try {
      return decodeURIComponent(starMatch[1].trim().replace(/^"|"$/g, ""));
    } catch {
      return starMatch[1].trim();
    }
  }
  const plainMatch = /filename\s*=\s*"?([^";]+)"?/i.exec(headerVal);
  return plainMatch && plainMatch[1] ? plainMatch[1].trim() : null;
}

function buildContentDisposition(disposition, rawFilename) {
  const safeDisp = String(disposition || "inline").toLowerCase() === "attachment" ? "attachment" : "inline";
  const baseName = String(rawFilename || "document").replace(/[\r\n/\\]/g, "_").trim() || "document";
  const asciiFallback = baseName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\;]/g, "_")
    .trim() || "document";
  const encodedStar = encodeURIComponent(baseName)
    .replace(/['()*!]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${safeDisp}; filename="${asciiFallback}"; filename*=UTF-8''${encodedStar}`;
}

function sanitizeFileMetadataPayload(raw) {
  if (!raw || typeof raw !== "object") return {};
  const clone = { ...raw };
  for (const key of ["signedUrl", "downloadUrl", "presignedUrl", "r2Key", "storageKey", "url"]) {
    delete clone[key];
  }
  return clone;
}

function normalizeAssetIdList(input) {
  if (Array.isArray(input)) {
    return input.map((v) => String(v || "").trim()).filter(Boolean);
  }
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((v) => String(v || "").trim()).filter(Boolean);
        }
      } catch {
        // fallback below
      }
    }
    return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function createMolyCourseLearningActionsService({
  db,
  client = null,
  withTx,
  hasProjectionTables,
  resolveProfileProjection,
  resolveUnitProjection,
  listProfileUnits,
  evaluateLiveUserAccess,
  ensureDeviceContext,
  executeWithDelegatedSession,
  mapUpstreamError,
} = {}) {
  async function resolveEntitledUnitActionContext({
    profileId,
    unitId,
    user = null,
    req = null,
    res = null,
  } = {}) {
    const caps = await hasProjectionTables();
    if (!caps.ready) {
      throw new CourseApiError(503, "CATALOG_SYNC_SCHEMA_MISSING", "Bảng dữ liệu khóa học liên kết chưa sẵn sàng.");
    }
    const { profile: profileRow } = await resolveProfileProjection({
      localCourseId: null,
      profileId,
    });
    const unitRow = await resolveUnitProjection({
      profileRow,
      localCourseId: profileRow.local_course_id,
      unitKey: unitId,
    });
    const access = await evaluateLiveUserAccess({
      user,
      localCourseId: profileRow.local_course_id,
    });
    if (!access.authenticated) {
      throw new CourseApiError(401, "AUTH_REQUIRED", "Vui lòng đăng nhập để tiếp tục.");
    }
    if (!access.entitled) {
      throw new CourseApiError(
        403,
        access.blockCode || "ENTITLEMENT_REQUIRED",
        "Bạn không có quyền truy cập nội dung học này.",
      );
    }
    const deviceCtx = await ensureDeviceContext({ req, res, user });
    return {
      profileRow,
      unitRow,
      deviceCtx,
      remoteProfileId: String(profileRow.remote_profile_id),
      remoteUnitId: String(unitRow.remote_unit_id),
      externalUserId: `moly:${user.id}`,
    };
  }

  async function resolveNextRevision(txClient, tableName, whereSql, params, explicitRevision = null) {
    if (explicitRevision != null && Number.isFinite(Number(explicitRevision)) && Number(explicitRevision) >= 1) {
      return Math.floor(Number(explicitRevision));
    }
    const res = await txClient.query(
      `SELECT COALESCE(MAX(last_revision), 0)::bigint AS max_rev FROM ${tableName} WHERE ${whereSql}`,
      params,
    ).catch(() => ({ rows: [{ max_rev: 0 }] }));
    return Math.max(1, Number(res.rows[0]?.max_rev || 0) + 1);
  }

  async function runDelegated(ctx, { user, req, delegatedSessionToken = null, correlationId }, fn) {
    return executeWithDelegatedSession(
      {
        user,
        profileRow: ctx.profileRow,
        deviceCtx: ctx.deviceCtx,
        req,
        preferredSessionToken: delegatedSessionToken,
        correlationId,
      },
      fn,
    );
  }

  // Day 5: Secure Delegated File Streaming / Metadata
  async function streamExternalUnitFile({
    profileId,
    unitId,
    fileId,
    disposition = "inline",
    mode = "stream",
    rangeHeader = null,
    delegatedSessionToken = null,
    user = null,
    req = null,
    res = null,
    correlationId = null,
  } = {}) {
    const corr = resolveCorrelationId(correlationId);
    const cleanFileId = String(fileId || "").trim();
    if (!cleanFileId) {
      throw new CourseApiError(400, "INVALID_PARAMETER", "fileId is required.");
    }
    const normalizedDisp = String(disposition || "inline").toLowerCase() === "attachment" ? "attachment" : "inline";
    const normalizedMode = String(mode || "stream").toLowerCase() === "metadata" ? "metadata" : "stream";

    const caps = await hasProjectionTables();
    if (!caps.ready) {
      throw new CourseApiError(503, "CATALOG_SYNC_SCHEMA_MISSING", "Bảng dữ liệu khóa học liên kết chưa sẵn sàng.");
    }

    const { profile: profileRow } = await resolveProfileProjection({
      localCourseId: null,
      profileId,
    });
    const unitRow = await resolveUnitProjection({
      profileRow,
      localCourseId: profileRow.local_course_id,
      unitKey: unitId,
    });

    const fileRes = await db.query(
      `SELECT *
       FROM course_file_projections
       WHERE unit_projection_id = $1::bigint
         AND remote_file_id = $2::varchar
       LIMIT 1`,
      [Number(unitRow.id), cleanFileId],
    );
    const fileRow = fileRes.rows[0] || null;
    if (fileRow && (fileRow.deleted_at != null || fileRow.is_published === false)) {
      throw new CourseApiError(404, "FILE_NOT_FOUND", "Tài liệu không còn tồn tại trong bài học.");
    }

    const access = await evaluateLiveUserAccess({
      user,
      localCourseId: profileRow.local_course_id,
    });

    let upstreamResult;
    if (access.entitled) {
      const allowDownloadEffective = fileRow?.allow_download_override != null
        ? Boolean(fileRow.allow_download_override)
        : (profileRow.allow_file_download !== false);
      if (normalizedDisp === "attachment" && !allowDownloadEffective) {
        throw new CourseApiError(
          403,
          "FILE_DOWNLOAD_FORBIDDEN",
          "Khóa học này chỉ cho phép xem trực tiếp, không cho phép tải tài liệu xuống.",
        );
      }

      const deviceCtx = await ensureDeviceContext({ req, res, user });
      upstreamResult = await executeWithDelegatedSession(
        {
          user,
          profileRow,
          deviceCtx,
          req,
          preferredSessionToken: delegatedSessionToken,
          correlationId: corr,
        },
        (sessionToken) => client.streamDelegatedFile({
          sessionToken,
          fileId: cleanFileId,
          unitId: String(unitRow.remote_unit_id),
          profileId: String(profileRow.remote_profile_id),
          disposition: normalizedDisp,
          mode: normalizedMode,
          rangeHeader,
          correlationId: corr,
        }),
      );
    } else if (unitRow.is_public_preview === true && unitRow.is_published === true) {
      if (normalizedDisp === "attachment") {
        throw new CourseApiError(
          403,
          "FILE_DOWNLOAD_FORBIDDEN",
          "Tài liệu học thử chỉ hỗ trợ xem trực tiếp, không hỗ trợ tải xuống.",
        );
      }
      if (fileRow && fileRow.allow_view_override === false) {
        throw new CourseApiError(403, "FILE_VIEW_FORBIDDEN", "Tài liệu này không khả dụng trong chế độ xem thử.");
      }
      try {
        upstreamResult = await client.streamDelegatedFile({
          sessionToken: null,
          fileId: cleanFileId,
          unitId: String(unitRow.remote_unit_id),
          profileId: String(profileRow.remote_profile_id),
          disposition: "inline",
          mode: normalizedMode,
          rangeHeader,
          correlationId: corr,
        });
      } catch (err) {
        throw mapUpstreamError(err);
      }
    } else if (!access.authenticated) {
      throw new CourseApiError(401, "AUTH_REQUIRED", "Vui lòng đăng nhập để xem tài liệu.");
    } else {
      throw new CourseApiError(
        403,
        access.blockCode || "ENTITLEMENT_REQUIRED",
        "Bạn không có quyền truy cập tài liệu này.",
      );
    }

    if (normalizedMode === "metadata") {
      return {
        mode: "metadata",
        data: sanitizeFileMetadataPayload(upstreamResult),
      };
    }

    const upstreamHeaders = upstreamResult.headers || {};
    const upstreamDispHeader = String(upstreamHeaders["content-disposition"] || "");
    const rawFilename = fileRow?.original_filename
      || fileRow?.title
      || decodeDispositionFilename(upstreamDispHeader)
      || `document-${cleanFileId}`;
    const contentType = upstreamHeaders["content-type"] || fileRow?.mime_type || "application/octet-stream";
    const acceptRanges = upstreamHeaders["accept-ranges"] || "bytes";
    const contentRange = upstreamHeaders["content-range"] || null;
    const bodyBuf = upstreamResult.bodyBufferOrStream || upstreamResult.bodyBuffer || Buffer.alloc(0);
    const contentLength = upstreamHeaders["content-length"]
      || (Buffer.isBuffer(bodyBuf) ? String(bodyBuf.length) : null);

    return {
      mode: "stream",
      status: upstreamResult.status === 206 ? 206 : 200,
      headers: {
        "Content-Type": contentType,
        "Accept-Ranges": acceptRanges,
        ...(contentRange ? { "Content-Range": contentRange } : {}),
        ...(contentLength ? { "Content-Length": contentLength } : {}),
        "Content-Disposition": buildContentDisposition(normalizedDisp, rawFilename),
        "Cache-Control": "private, no-store",
        "X-Frame-Options": "SAMEORIGIN",
        "X-Content-Type-Options": "nosniff",
      },
      bodyBuffer: bodyBuf,
    };
  }

  // Day 6: Quizzes & Assignments
  async function getExternalQuiz({
    profileId,
    unitId,
    quizId,
    delegatedSessionToken = null,
    user = null,
    req = null,
    res = null,
    correlationId = null,
  } = {}) {
    const corr = resolveCorrelationId(correlationId);
    const cleanQuizId = String(quizId || "").trim();
    if (!cleanQuizId) throw new CourseApiError(400, "INVALID_PARAMETER", "quizId is required.");

    const ctx = await resolveEntitledUnitActionContext({ profileId, unitId, user, req, res });
    return runDelegated(ctx, { user, req, delegatedSessionToken, correlationId: corr }, (sessionToken) =>
      client.fetchDelegatedQuiz({
        sessionToken,
        profileId: ctx.remoteProfileId,
        unitId: ctx.remoteUnitId,
        quizId: cleanQuizId,
        correlationId: corr,
      }));
  }

  async function startExternalQuizAttempt({
    profileId,
    unitId,
    quizId,
    newAttempt = false,
    idempotencyKey = null,
    delegatedSessionToken = null,
    user = null,
    req = null,
    res = null,
    correlationId = null,
  } = {}) {
    const corr = resolveCorrelationId(correlationId);
    const cleanQuizId = String(quizId || "").trim();
    if (!cleanQuizId) throw new CourseApiError(400, "INVALID_PARAMETER", "quizId is required.");

    const ctx = await resolveEntitledUnitActionContext({ profileId, unitId, user, req, res });
    const result = await runDelegated(
      ctx,
      { user, req, delegatedSessionToken, correlationId: corr },
      (sessionToken) => client.startDelegatedQuizAttempt({
        sessionToken,
        quizId: cleanQuizId,
        profileId: ctx.remoteProfileId,
        unitId: ctx.remoteUnitId,
        newAttempt: Boolean(newAttempt),
        idempotencyKey: idempotencyKey || undefined,
        correlationId: corr,
      }),
    );

    const attempt = result?.attempt && typeof result.attempt === "object" ? result.attempt : result;
    const attemptId = attempt?.attemptId ?? attempt?.id ?? result?.attemptId ?? null;
    await withTx(async (txClient) => {
      const rev = await resolveNextRevision(
        txClient,
        "course_assessment_projections",
        "user_id = $1 AND profile_projection_id = $2 AND item_type = 'quiz' AND remote_item_id = $3",
        [Number(user.id), Number(ctx.profileRow.id), cleanQuizId],
        result?.syncRevision ?? result?.revision ?? attempt?.revision,
      );
      await upsertAssessmentProjectionTx(txClient, {
        userId: Number(user.id),
        profileProjectionId: Number(ctx.profileRow.id),
        unitType: ctx.unitRow.unit_type,
        remoteUnitId: ctx.remoteUnitId,
        itemType: "quiz",
        remoteItemId: cleanQuizId,
        remoteAttemptOrSubId: attemptId != null ? String(attemptId) : null,
        status: attempt?.status || result?.status || "in_progress",
        attemptCount: result?.attemptCount ?? attempt?.attemptNumber ?? 1,
        maxAttempts: result?.maxAttempts ?? null,
        canViewSolution: Boolean(result?.canViewSolution ?? attempt?.canViewSolution),
        metadata: {
          startedAt: attempt?.startedAt || result?.startedAt || new Date().toISOString(),
          totalQuestions: result?.totalQuestions ?? (Array.isArray(result?.questions) ? result.questions.length : undefined),
        },
        syncRevision: rev,
        sourceUpdatedAt: attempt?.updatedAt || result?.updatedAt || new Date().toISOString(),
      });
    });

    return result;
  }

  async function saveExternalQuizAnswers({
    profileId,
    unitId,
    attemptId,
    answers = undefined,
    questionId = undefined,
    answer = undefined,
    idempotencyKey = null,
    delegatedSessionToken = null,
    user = null,
    req = null,
    res = null,
    correlationId = null,
  } = {}) {
    const corr = resolveCorrelationId(correlationId);
    const cleanAttemptId = String(attemptId || "").trim();
    if (!cleanAttemptId) throw new CourseApiError(400, "INVALID_PARAMETER", "attemptId is required.");

    const ctx = await resolveEntitledUnitActionContext({ profileId, unitId, user, req, res });
    return runDelegated(
      ctx,
      { user, req, delegatedSessionToken, correlationId: corr },
      (sessionToken) => client.saveDelegatedQuizAnswers({
        sessionToken,
        attemptId: cleanAttemptId,
        profileId: ctx.remoteProfileId,
        answers,
        questionId,
        answer,
        idempotencyKey: idempotencyKey || undefined,
        correlationId: corr,
      }),
    );
  }

  async function submitExternalQuizAttempt({
    profileId,
    unitId,
    attemptId,
    idempotencyKey = null,
    delegatedSessionToken = null,
    user = null,
    req = null,
    res = null,
    correlationId = null,
  } = {}) {
    const corr = resolveCorrelationId(correlationId);
    const cleanAttemptId = String(attemptId || "").trim();
    if (!cleanAttemptId) throw new CourseApiError(400, "INVALID_PARAMETER", "attemptId is required.");

    const ctx = await resolveEntitledUnitActionContext({ profileId, unitId, user, req, res });
    const result = await runDelegated(
      ctx,
      { user, req, delegatedSessionToken, correlationId: corr },
      (sessionToken) => client.submitDelegatedQuizAttempt({
        sessionToken,
        attemptId: cleanAttemptId,
        profileId: ctx.remoteProfileId,
        idempotencyKey: idempotencyKey || undefined,
        correlationId: corr,
      }),
    );

    const attempt = result?.attempt && typeof result.attempt === "object" ? result.attempt : result;
    const unitProgress = result?.unitProgress && typeof result.unitProgress === "object"
      ? result.unitProgress
      : (result?.progress && typeof result.progress === "object" ? result.progress : {});
    const quizId = result?.quizId || attempt?.quizId || result?.itemId || unitProgress?.quizId || null;
    const isQuizCompleted = Boolean(
      result?.isQuizCompleted ?? unitProgress?.isQuizCompleted ?? attempt?.isQuizCompleted ?? result?.passed ?? attempt?.passed ?? true,
    );
    const isUnitCompleted = Boolean(
      result?.isUnitCompleted ?? unitProgress?.isUnitCompleted ?? unitProgress?.isCompleted ?? false,
    );
    const isVideoCompleted = Boolean(
      result?.isVideoCompleted ?? unitProgress?.isVideoCompleted ?? false,
    );
    const courseCompletionPct = result?.courseProgress?.overallPercent
      ?? result?.courseCompletionPct
      ?? unitProgress?.courseCompletionPct
      ?? null;
    const canViewSolution = Boolean(result?.canViewSolution ?? attempt?.canViewSolution ?? false);

    let unlockedNextUnitId = result?.unlockedNextUnitId || unitProgress?.unlockedNextUnitId || result?.nextUnit?.id || null;
    let nextUnitType = result?.nextUnitType || unitProgress?.nextUnitType || result?.nextUnit?.unitType || null;
    if (!unlockedNextUnitId && isUnitCompleted) {
      const unitsFromUpstream = Array.isArray(result?.units) ? result.units : null;
      if (unitsFromUpstream && unitsFromUpstream.length > 0) {
        const idx = unitsFromUpstream.findIndex((u) => String(u.id) === ctx.remoteUnitId);
        const nxt = idx >= 0 && idx + 1 < unitsFromUpstream.length ? unitsFromUpstream[idx + 1] : null;
        if (nxt && !nxt.isLocked) {
          unlockedNextUnitId = String(nxt.id);
          nextUnitType = nxt.unitType || ctx.unitRow.unit_type;
        }
      } else if (typeof listProfileUnits === "function") {
        const orderedUnits = await listProfileUnits(ctx.profileRow.id);
        const idx = orderedUnits.findIndex((u) => String(u.remote_unit_id) === ctx.remoteUnitId);
        const nxt = idx >= 0 && idx + 1 < orderedUnits.length ? orderedUnits[idx + 1] : null;
        if (nxt) {
          unlockedNextUnitId = String(nxt.remote_unit_id);
          nextUnitType = nxt.unit_type;
        }
      }
    }

    const nowIso = attempt?.submittedAt || result?.submittedAt || result?.updatedAt || new Date().toISOString();
    await withTx(async (txClient) => {
      if (quizId) {
        const assessRev = await resolveNextRevision(
          txClient,
          "course_assessment_projections",
          "user_id = $1 AND profile_projection_id = $2 AND item_type = 'quiz' AND remote_item_id = $3",
          [Number(user.id), Number(ctx.profileRow.id), String(quizId)],
          result?.syncRevision ?? result?.revision,
        );
        await upsertAssessmentProjectionTx(txClient, {
          userId: Number(user.id),
          profileProjectionId: Number(ctx.profileRow.id),
          unitType: ctx.unitRow.unit_type,
          remoteUnitId: ctx.remoteUnitId,
          itemType: "quiz",
          remoteItemId: String(quizId),
          remoteAttemptOrSubId: String(attempt?.id || result?.attemptId || cleanAttemptId),
          status: attempt?.status || result?.status || "submitted",
          attemptCount: result?.attemptCount ?? attempt?.attemptNumber ?? 1,
          maxAttempts: result?.maxAttempts ?? null,
          score: attempt?.score ?? result?.score ?? null,
          maxScore: attempt?.maxScore ?? result?.maxScore ?? null,
          canViewSolution,
          gradedAt: attempt?.gradedAt || result?.gradedAt || nowIso,
          metadata: {
            submittedAt: nowIso,
            passed: result?.passed ?? attempt?.passed,
            correctCount: result?.correctCount ?? attempt?.correctCount,
            totalQuestions: result?.totalQuestions ?? attempt?.totalQuestions,
            feedback: result?.feedback ?? attempt?.feedback,
            solutionPolicy: result?.solutionPolicy,
            embargoReason: result?.embargoReason,
          },
          syncRevision: assessRev,
          sourceUpdatedAt: nowIso,
        });
      }

      const progRev = await resolveNextRevision(
        txClient,
        "course_progress_projections",
        "user_id = $1 AND profile_projection_id = $2 AND unit_type = $3 AND remote_unit_id = $4",
        [Number(user.id), Number(ctx.profileRow.id), ctx.unitRow.unit_type, ctx.remoteUnitId],
        result?.progressSyncRevision ?? result?.syncRevision,
      );
      await upsertLearningProgressProjectionTx(txClient, {
        userId: Number(user.id),
        profileProjectionId: Number(ctx.profileRow.id),
        localCourseId: Number(ctx.profileRow.local_course_id),
        unitType: ctx.unitRow.unit_type,
        remoteUnitId: ctx.remoteUnitId,
        watchedSeconds: Math.round(Number(unitProgress?.watchedSeconds ?? result?.watchedSeconds ?? 0)),
        lastPositionSeconds: Math.round(Number(unitProgress?.lastPositionSeconds ?? result?.lastPositionSeconds ?? 0)),
        completionPct: Number(unitProgress?.completionPercent ?? result?.completionPercent ?? (isUnitCompleted ? 100 : 0)),
        isVideoCompleted,
        isQuizCompleted,
        isUnitCompleted,
        isUnlocked: true,
        courseCompletionPct,
        lastUnitId: ctx.remoteUnitId,
        syncRevision: progRev,
        sourceUpdatedAt: nowIso,
        unlockedNextUnitId: unlockedNextUnitId ? String(unlockedNextUnitId) : null,
        nextUnitType: nextUnitType || null,
      });
    });

    return result;
  }

  async function getExternalAssignment({
    profileId,
    unitId,
    assignmentId,
    delegatedSessionToken = null,
    user = null,
    req = null,
    res = null,
    correlationId = null,
  } = {}) {
    const corr = resolveCorrelationId(correlationId);
    const cleanAssignmentId = String(assignmentId || "").trim();
    if (!cleanAssignmentId) throw new CourseApiError(400, "INVALID_PARAMETER", "assignmentId is required.");

    const ctx = await resolveEntitledUnitActionContext({ profileId, unitId, user, req, res });
    return runDelegated(ctx, { user, req, delegatedSessionToken, correlationId: corr }, (sessionToken) =>
      client.fetchDelegatedAssignment({
        sessionToken,
        profileId: ctx.remoteProfileId,
        unitId: ctx.remoteUnitId,
        assignmentId: cleanAssignmentId,
        correlationId: corr,
      }));
  }

  async function submitExternalAssignment({
    profileId,
    unitId,
    assignmentId,
    files = [],
    contentText = undefined,
    fileAssetIds = undefined,
    audioAssetId = undefined,
    idempotencyKey = null,
    delegatedSessionToken = null,
    user = null,
    req = null,
    res = null,
    correlationId = null,
  } = {}) {
    const corr = resolveCorrelationId(correlationId);
    const cleanAssignmentId = String(assignmentId || "").trim();
    if (!cleanAssignmentId) throw new CourseApiError(400, "INVALID_PARAMETER", "assignmentId is required.");

    const ctx = await resolveEntitledUnitActionContext({ profileId, unitId, user, req, res });
    const uploadedFiles = Array.isArray(files) ? files : [];
    const existingAssetIds = normalizeAssetIdList(fileAssetIds);

    const { result, mergedAssetIds } = await runDelegated(
      ctx,
      { user, req, delegatedSessionToken, correlationId: corr },
      async (sessionToken) => {
        const newAssetIds = [];
        for (let idx = 0; idx < uploadedFiles.length; idx += 1) {
          const f = uploadedFiles[idx];
          const digest = crypto
            .createHash("sha256")
            .update(`${user.id}:${cleanAssignmentId}:${f.originalname || ""}:${f.size || 0}:${idx}`)
            .update(f.buffer || Buffer.alloc(0))
            .digest("hex")
            .slice(0, 16);
          const assetIdem = idempotencyKey
            ? `${idempotencyKey}:asset:${idx}`
            : `asgn:${cleanAssignmentId}:${user.id}:${digest}`;
          const uploaded = await client.uploadDelegatedAssignmentAsset({
            sessionToken,
            assignmentId: cleanAssignmentId,
            profileId: ctx.remoteProfileId,
            unitId: ctx.remoteUnitId,
            assetKind: String(f.mimetype || "").startsWith("audio/") ? "audio" : "file",
            originalFilename: f.originalname || `file-${idx + 1}.bin`,
            mimeType: f.mimetype || "application/octet-stream",
            sizeBytes: Number(f.size || f.buffer?.length || 0),
            contentBase64: (f.buffer || Buffer.alloc(0)).toString("base64"),
            idempotencyKey: assetIdem,
            correlationId: corr,
          });
          const assetId = uploaded?.assetId || uploaded?.id;
          if (assetId != null) newAssetIds.push(String(assetId));
        }
        const merged = [...existingAssetIds, ...newAssetIds];
        const submitIdem = idempotencyKey || `asgn-sub:${cleanAssignmentId}:${user.id}:${corr}`;
        const submitted = await client.submitDelegatedAssignment({
          sessionToken,
          assignmentId: cleanAssignmentId,
          profileId: ctx.remoteProfileId,
          unitId: ctx.remoteUnitId,
          contentText,
          fileAssetIds: merged,
          audioAssetId: audioAssetId || undefined,
          idempotencyKey: submitIdem,
          correlationId: corr,
        });
        return { result: submitted, mergedAssetIds: merged };
      },
    );

    const sub = result?.submission && typeof result.submission === "object" ? result.submission : result;
    const nowIso = sub?.submittedAt || result?.submittedAt || result?.updatedAt || new Date().toISOString();
    await withTx(async (txClient) => {
      const rev = await resolveNextRevision(
        txClient,
        "course_assessment_projections",
        "user_id = $1 AND profile_projection_id = $2 AND item_type = 'assignment' AND remote_item_id = $3",
        [Number(user.id), Number(ctx.profileRow.id), cleanAssignmentId],
        result?.syncRevision ?? result?.revision ?? sub?.revision,
      );
      await upsertAssessmentProjectionTx(txClient, {
        userId: Number(user.id),
        profileProjectionId: Number(ctx.profileRow.id),
        unitType: ctx.unitRow.unit_type,
        remoteUnitId: ctx.remoteUnitId,
        itemType: "assignment",
        remoteItemId: cleanAssignmentId,
        remoteAttemptOrSubId: sub?.id || result?.submissionId || null,
        status: sub?.status || result?.status || "submitted",
        attemptCount: result?.attemptCount ?? 1,
        maxAttempts: result?.maxAttempts ?? null,
        score: sub?.score ?? result?.score ?? null,
        maxScore: sub?.maxScore ?? result?.maxScore ?? null,
        canViewSolution: Boolean(result?.canViewSolution ?? sub?.canViewSolution),
        gradedAt: sub?.gradedAt || result?.gradedAt || null,
        metadata: {
          submittedAt: nowIso,
          fileAssetIds: mergedAssetIds,
          audioAssetId: audioAssetId || null,
          contentText: contentText ? String(contentText).slice(0, 500) : undefined,
        },
        syncRevision: rev,
        sourceUpdatedAt: nowIso,
      });
    });

    return result;
  }

  // Day 7: Notes (CRUD + 409 REVISION_CONFLICT propagation)
  async function listExternalNotes({ profileId, unitId, delegatedSessionToken = null, user = null, req = null, res = null, correlationId = null } = {}) {
    const corr = resolveCorrelationId(correlationId);
    const ctx = await resolveEntitledUnitActionContext({ profileId, unitId, user, req, res });
    return runDelegated(ctx, { user, req, delegatedSessionToken, correlationId: corr }, (sessionToken) =>
      client.listDelegatedNotes({
        sessionToken,
        profileId: ctx.remoteProfileId,
        unitId: ctx.remoteUnitId,
        correlationId: corr,
      }));
  }

  async function createExternalNote({ profileId, unitId, timestampSeconds = 0, content, idempotencyKey = null, delegatedSessionToken = null, user = null, req = null, res = null, correlationId = null } = {}) {
    const corr = resolveCorrelationId(correlationId);
    if (!String(content || "").trim()) {
      throw new CourseApiError(422, "VALIDATION_ERROR", "Nội dung ghi chú không được để trống.");
    }
    const ctx = await resolveEntitledUnitActionContext({ profileId, unitId, user, req, res });
    const result = await runDelegated(
      ctx,
      { user, req, delegatedSessionToken, correlationId: corr },
      (sessionToken) => client.createDelegatedNote({
        sessionToken,
        profileId: ctx.remoteProfileId,
        unitId: ctx.remoteUnitId,
        timestampSeconds,
        content,
        idempotencyKey: idempotencyKey || undefined,
        correlationId: corr,
      }),
    );

    const noteObj = result?.note && typeof result.note === "object" ? result.note : result;
    const remoteNoteId = String(noteObj?.noteId || noteObj?.id || "").trim();
    if (remoteNoteId) {
      await withTx((txClient) => upsertNoteProjectionTx(txClient, {
        userId: Number(user.id),
        profileProjectionId: Number(ctx.profileRow.id),
        unitType: ctx.unitRow.unit_type,
        remoteUnitId: ctx.remoteUnitId,
        remoteNoteId,
        timestampSeconds: noteObj.timestampSeconds ?? timestampSeconds,
        content: noteObj.content ?? content,
        syncRevision: Number(noteObj.revision || 1),
        sourceUpdatedAt: noteObj.updatedAt || noteObj.createdAt || new Date().toISOString(),
      }));
    }
    return result;
  }

  async function updateExternalNote({ profileId, unitId, noteId, timestampSeconds = undefined, content = undefined, expectedRevision = undefined, idempotencyKey = null, delegatedSessionToken = null, user = null, req = null, res = null, correlationId = null } = {}) {
    const corr = resolveCorrelationId(correlationId);
    const cleanNoteId = String(noteId || "").trim();
    if (!cleanNoteId) throw new CourseApiError(400, "INVALID_PARAMETER", "noteId is required.");

    const ctx = await resolveEntitledUnitActionContext({ profileId, unitId, user, req, res });
    let result;
    try {
      result = await runDelegated(
        ctx,
        { user, req, delegatedSessionToken, correlationId: corr },
        (sessionToken) => client.updateDelegatedNote({
          sessionToken,
          profileId: ctx.remoteProfileId,
          unitId: ctx.remoteUnitId,
          noteId: cleanNoteId,
          timestampSeconds,
          content,
          expectedRevision,
          idempotencyKey: idempotencyKey || undefined,
          correlationId: corr,
        }),
      );
    } catch (err) {
      const mapped = mapUpstreamError(err);
      if (mapped?.status === 409 && mapped?.details?.note) {
        const latest = mapped.details.note;
        await withTx((txClient) => upsertNoteProjectionTx(txClient, {
          userId: Number(user.id),
          profileProjectionId: Number(ctx.profileRow.id),
          unitType: ctx.unitRow.unit_type,
          remoteUnitId: ctx.remoteUnitId,
          remoteNoteId: String(latest.noteId || latest.id || cleanNoteId),
          timestampSeconds: latest.timestampSeconds ?? 0,
          content: latest.content ?? "",
          syncRevision: Number(latest.revision || mapped.details.currentRevision || 1),
          sourceUpdatedAt: latest.updatedAt || new Date().toISOString(),
        })).catch(() => {});
      }
      throw mapped;
    }

    const noteObj = result?.note && typeof result.note === "object" ? result.note : result;
    await withTx((txClient) => upsertNoteProjectionTx(txClient, {
      userId: Number(user.id),
      profileProjectionId: Number(ctx.profileRow.id),
      unitType: ctx.unitRow.unit_type,
      remoteUnitId: ctx.remoteUnitId,
      remoteNoteId: String(noteObj?.noteId || noteObj?.id || cleanNoteId),
      timestampSeconds: noteObj?.timestampSeconds ?? timestampSeconds ?? 0,
      content: noteObj?.content ?? content ?? "",
      syncRevision: Number(noteObj?.revision || (expectedRevision ? Number(expectedRevision) + 1 : 2)),
      sourceUpdatedAt: noteObj?.updatedAt || new Date().toISOString(),
    }));
    return result;
  }

  async function deleteExternalNote({ profileId, unitId, noteId, expectedRevision = undefined, idempotencyKey = null, delegatedSessionToken = null, user = null, req = null, res = null, correlationId = null } = {}) {
    const corr = resolveCorrelationId(correlationId);
    const cleanNoteId = String(noteId || "").trim();
    if (!cleanNoteId) throw new CourseApiError(400, "INVALID_PARAMETER", "noteId is required.");

    const ctx = await resolveEntitledUnitActionContext({ profileId, unitId, user, req, res });
    const result = await runDelegated(
      ctx,
      { user, req, delegatedSessionToken, correlationId: corr },
      (sessionToken) => client.deleteDelegatedNote({
        sessionToken,
        profileId: ctx.remoteProfileId,
        unitId: ctx.remoteUnitId,
        noteId: cleanNoteId,
        expectedRevision,
        idempotencyKey: idempotencyKey || undefined,
        correlationId: corr,
      }),
    );

    await withTx(async (txClient) => {
      const rev = await resolveNextRevision(
        txClient,
        "course_note_projections",
        "profile_projection_id = $1 AND remote_note_id = $2",
        [Number(ctx.profileRow.id), cleanNoteId],
        result?.revision,
      );
      await upsertNoteProjectionTx(txClient, {
        userId: Number(user.id),
        profileProjectionId: Number(ctx.profileRow.id),
        unitType: ctx.unitRow.unit_type,
        remoteUnitId: ctx.remoteUnitId,
        remoteNoteId: cleanNoteId,
        deletedAt: result?.deletedAt || new Date().toISOString(),
        syncRevision: rev,
        sourceUpdatedAt: result?.deletedAt || new Date().toISOString(),
      });
    });
    return result;
  }

  // Day 7: Bookmarks
  async function listExternalBookmarks({ profileId, unitId, delegatedSessionToken = null, user = null, req = null, res = null, correlationId = null } = {}) {
    const corr = resolveCorrelationId(correlationId);
    const ctx = await resolveEntitledUnitActionContext({ profileId, unitId, user, req, res });
    return runDelegated(ctx, { user, req, delegatedSessionToken, correlationId: corr }, (sessionToken) =>
      client.listDelegatedBookmarks({
        sessionToken,
        profileId: ctx.remoteProfileId,
        unitId: ctx.remoteUnitId,
        correlationId: corr,
      }));
  }

  async function createExternalBookmark({ profileId, unitId, videoAssetId = null, timestampSeconds = 0, label = "", idempotencyKey = null, delegatedSessionToken = null, user = null, req = null, res = null, correlationId = null } = {}) {
    const corr = resolveCorrelationId(correlationId);
    const ctx = await resolveEntitledUnitActionContext({ profileId, unitId, user, req, res });
    const result = await runDelegated(
      ctx,
      { user, req, delegatedSessionToken, correlationId: corr },
      (sessionToken) => client.createDelegatedBookmark({
        sessionToken,
        profileId: ctx.remoteProfileId,
        unitId: ctx.remoteUnitId,
        videoAssetId,
        timestampSeconds,
        label,
        idempotencyKey: idempotencyKey || undefined,
        correlationId: corr,
      }),
    );

    const bmObj = result?.bookmark && typeof result.bookmark === "object" ? result.bookmark : result;
    const remoteBookmarkId = String(bmObj?.bookmarkId || bmObj?.id || "").trim();
    if (remoteBookmarkId) {
      await withTx((txClient) => upsertBookmarkProjectionTx(txClient, {
        userId: Number(user.id),
        profileProjectionId: Number(ctx.profileRow.id),
        unitType: ctx.unitRow.unit_type,
        remoteUnitId: ctx.remoteUnitId,
        remoteBookmarkId,
        videoAssetId: bmObj.videoAssetId ?? videoAssetId,
        timestampSeconds: bmObj.timestampSeconds ?? timestampSeconds,
        label: bmObj.label ?? label,
        syncRevision: Number(bmObj.revision || 1),
        sourceUpdatedAt: bmObj.updatedAt || bmObj.createdAt || new Date().toISOString(),
      }));
    }
    return result;
  }

  async function deleteExternalBookmark({ profileId, unitId, bookmarkId, idempotencyKey = null, delegatedSessionToken = null, user = null, req = null, res = null, correlationId = null } = {}) {
    const corr = resolveCorrelationId(correlationId);
    const cleanBmId = String(bookmarkId || "").trim();
    if (!cleanBmId) throw new CourseApiError(400, "INVALID_PARAMETER", "bookmarkId is required.");

    const ctx = await resolveEntitledUnitActionContext({ profileId, unitId, user, req, res });
    const result = await runDelegated(
      ctx,
      { user, req, delegatedSessionToken, correlationId: corr },
      (sessionToken) => client.deleteDelegatedBookmark({
        sessionToken,
        profileId: ctx.remoteProfileId,
        unitId: ctx.remoteUnitId,
        bookmarkId: cleanBmId,
        idempotencyKey: idempotencyKey || undefined,
        correlationId: corr,
      }),
    );

    await withTx(async (txClient) => {
      const rev = await resolveNextRevision(
        txClient,
        "course_bookmark_projections",
        "profile_projection_id = $1 AND remote_bookmark_id = $2",
        [Number(ctx.profileRow.id), cleanBmId],
        result?.revision,
      );
      await upsertBookmarkProjectionTx(txClient, {
        userId: Number(user.id),
        profileProjectionId: Number(ctx.profileRow.id),
        unitType: ctx.unitRow.unit_type,
        remoteUnitId: ctx.remoteUnitId,
        remoteBookmarkId: cleanBmId,
        deletedAt: result?.deletedAt || new Date().toISOString(),
        syncRevision: rev,
        sourceUpdatedAt: result?.deletedAt || new Date().toISOString(),
      });
    });
    return result;
  }

  // Day 7: Q&A Threads
  async function persistQaThreadFromResult(ctx, user, threadData) {
    const thread = threadData?.thread && typeof threadData.thread === "object" ? threadData.thread : threadData;
    const remoteThreadId = String(thread?.threadId || thread?.id || "").trim();
    if (!remoteThreadId) return;
    await withTx(async (txClient) => {
      const rev = await resolveNextRevision(
        txClient,
        "course_qa_thread_projections",
        "profile_projection_id = $1 AND remote_thread_id = $2",
        [Number(ctx.profileRow.id), remoteThreadId],
        thread?.revision,
      );
      await upsertQaThreadProjectionTx(txClient, {
        profileProjectionId: Number(ctx.profileRow.id),
        unitType: ctx.unitRow.unit_type,
        remoteUnitId: ctx.remoteUnitId,
        remoteThreadId,
        authorExternalUserId: thread.authorExternalUserId || ctx.externalUserId,
        authorUserId: Number(user.id),
        authorName: thread.authorName || user.full_name || user.username || null,
        authorRole: thread.authorRole || "student",
        title: thread.title || "",
        status: thread.status || "open",
        isPinned: Boolean(thread.isPinned),
        messageCount: thread.messageCount ?? (Array.isArray(thread.messages) ? thread.messages.length : undefined),
        messages: Array.isArray(thread.messages) ? thread.messages : undefined,
        unread: Boolean(thread.unread),
        lastMessageAt: thread.lastMessageAt || thread.updatedAt || new Date().toISOString(),
        syncRevision: rev,
        sourceUpdatedAt: thread.updatedAt || thread.createdAt || new Date().toISOString(),
      });
    });
  }

  async function listExternalQaThreads({ profileId, unitId, delegatedSessionToken = null, user = null, req = null, res = null, correlationId = null } = {}) {
    const corr = resolveCorrelationId(correlationId);
    const ctx = await resolveEntitledUnitActionContext({ profileId, unitId, user, req, res });
    return runDelegated(ctx, { user, req, delegatedSessionToken, correlationId: corr }, (sessionToken) =>
      client.listDelegatedQaThreads({
        sessionToken,
        profileId: ctx.remoteProfileId,
        unitId: ctx.remoteUnitId,
        correlationId: corr,
      }));
  }

  async function createExternalQaThread({ profileId, unitId, title, body, idempotencyKey = null, delegatedSessionToken = null, user = null, req = null, res = null, correlationId = null } = {}) {
    const corr = resolveCorrelationId(correlationId);
    if (!String(title || "").trim() || !String(body || "").trim()) {
      throw new CourseApiError(422, "VALIDATION_ERROR", "Tiêu đề và nội dung câu hỏi không được để trống.");
    }
    const ctx = await resolveEntitledUnitActionContext({ profileId, unitId, user, req, res });
    const result = await runDelegated(
      ctx,
      { user, req, delegatedSessionToken, correlationId: corr },
      (sessionToken) => client.createDelegatedQaThread({
        sessionToken,
        profileId: ctx.remoteProfileId,
        unitId: ctx.remoteUnitId,
        title,
        body,
        idempotencyKey: idempotencyKey || undefined,
        correlationId: corr,
      }),
    );
    await persistQaThreadFromResult(ctx, user, result);
    return result;
  }

  async function replyExternalQaThread({ profileId, unitId, threadId, body, expectedRevision = undefined, idempotencyKey = null, delegatedSessionToken = null, user = null, req = null, res = null, correlationId = null } = {}) {
    const corr = resolveCorrelationId(correlationId);
    const cleanThreadId = String(threadId || "").trim();
    if (!cleanThreadId) throw new CourseApiError(400, "INVALID_PARAMETER", "threadId is required.");
    if (!String(body || "").trim()) {
      throw new CourseApiError(422, "VALIDATION_ERROR", "Nội dung phản hồi không được để trống.");
    }
    const ctx = await resolveEntitledUnitActionContext({ profileId, unitId, user, req, res });
    const result = await runDelegated(
      ctx,
      { user, req, delegatedSessionToken, correlationId: corr },
      (sessionToken) => client.replyDelegatedQaThread({
        sessionToken,
        profileId: ctx.remoteProfileId,
        unitId: ctx.remoteUnitId,
        threadId: cleanThreadId,
        body,
        expectedRevision,
        idempotencyKey: idempotencyKey || undefined,
        correlationId: corr,
      }),
    );
    await persistQaThreadFromResult(ctx, user, result);
    return result;
  }

  async function updateExternalQaThreadStatus({ profileId, unitId, threadId, status, isPinned = undefined, markRead = undefined, expectedRevision = undefined, idempotencyKey = null, delegatedSessionToken = null, user = null, req = null, res = null, correlationId = null } = {}) {
    const corr = resolveCorrelationId(correlationId);
    const cleanThreadId = String(threadId || "").trim();
    if (!cleanThreadId) throw new CourseApiError(400, "INVALID_PARAMETER", "threadId is required.");
    const ctx = await resolveEntitledUnitActionContext({ profileId, unitId, user, req, res });
    const result = await runDelegated(
      ctx,
      { user, req, delegatedSessionToken, correlationId: corr },
      (sessionToken) => client.updateDelegatedQaThreadStatus({
        sessionToken,
        profileId: ctx.remoteProfileId,
        unitId: ctx.remoteUnitId,
        threadId: cleanThreadId,
        status,
        isPinned,
        markRead,
        expectedRevision,
        idempotencyKey: idempotencyKey || undefined,
        correlationId: corr,
      }),
    );
    await persistQaThreadFromResult(ctx, user, result);
    return result;
  }

  return {
    streamExternalUnitFile,
    getExternalQuiz,
    startExternalQuizAttempt,
    saveExternalQuizAnswers,
    submitExternalQuizAttempt,
    getExternalAssignment,
    submitExternalAssignment,
    listExternalNotes,
    createExternalNote,
    updateExternalNote,
    deleteExternalNote,
    listExternalBookmarks,
    createExternalBookmark,
    deleteExternalBookmark,
    listExternalQaThreads,
    createExternalQaThread,
    replyExternalQaThread,
    updateExternalQaThreadStatus,
  };
}

module.exports = {
  createMolyCourseLearningActionsService,
  buildContentDisposition,
};
