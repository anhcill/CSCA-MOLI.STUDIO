/**
 * Synchronizes `course_profile_projections.checkout_ready` from live local pricing
 * and course/profile lifecycle state.
 *
 * `checkout_ready` is NEVER enabled by catalog sync alone. It becomes TRUE only when:
 * 1. The parent course has `content_origin = 'csca_course'`, `status = 'published'`, and `tombstoned_at IS NULL`.
 * 2. The profile projection has `status = 'active'` and `deleted_at IS NULL`.
 * 3. Explicit positive local pricing (`price > 0`) is configured via either:
 *    - `courses.price_vnd > 0`
 *    - an active `video_packages` (+ optional active `combo_packages`) covering the course with positive price
 *    - `courses.access_type = 'package'` linked to an active priced `vip_packages` row (`price > 0`)
 *
 * Updating `checkout_ready` intentionally leaves `last_revision` and `source_updated_at`
 * untouched so monotonic revision triggers never reject local pricing updates.
 */

async function detectCheckoutReadySchema(runner) {
  try {
    const res = await runner.query(
      `SELECT
         to_regclass('course_profile_projections') IS NOT NULL AS has_profiles,
         EXISTS (
           SELECT 1 FROM pg_attribute
           WHERE attrelid = to_regclass('courses')
             AND NOT attisdropped
             AND attname = 'content_origin'
         ) AS has_origin,
         EXISTS (
           SELECT 1 FROM pg_attribute
           WHERE attrelid = to_regclass('courses')
             AND NOT attisdropped
             AND attname = 'tombstoned_at'
         ) AS has_tombstoned_at,
         to_regclass('video_packages') IS NOT NULL AS has_video_packages,
         EXISTS (
           SELECT 1 FROM pg_attribute
           WHERE attrelid = to_regclass('video_packages') AND NOT attisdropped AND attname = 'requires_subject_choice'
         ) AND EXISTS (
           SELECT 1 FROM pg_attribute
           WHERE attrelid = to_regclass('video_packages') AND NOT attisdropped AND attname = 'subject_prices'
         ) AS has_vp_subject_prices,
         to_regclass('video_package_courses') IS NOT NULL AS has_video_pkg_courses,
         to_regclass('combo_packages') IS NOT NULL AS has_combo_packages,
         EXISTS (
           SELECT 1 FROM pg_attribute
           WHERE attrelid = to_regclass('combo_packages') AND NOT attisdropped AND attname = 'subject_prices'
         ) AS has_combo_subject_prices,
         to_regclass('course_package_access') IS NOT NULL AS has_pkg_access,
         to_regclass('vip_packages') IS NOT NULL AS has_vip_packages,
         EXISTS (
           SELECT 1 FROM pg_attribute
           WHERE attrelid = to_regclass('vip_packages')
             AND NOT attisdropped
             AND attname = 'price'
         ) AND EXISTS (
           SELECT 1 FROM pg_attribute
           WHERE attrelid = to_regclass('vip_packages')
             AND NOT attisdropped
             AND attname = 'is_active'
         ) AS has_vip_pkg_cols`,
    );
    return res.rows[0] || {};
  } catch {
    return {};
  }
}

async function syncProfileCheckoutReadyForCourses(runner, courseIds = []) {
  const cleanIds = [...new Set((courseIds || []).map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))];
  if (!cleanIds.length) return { updated: 0, rows: [] };

  const caps = await detectCheckoutReadySchema(runner);
  if (!caps.has_profiles || !caps.has_origin) {
    return { updated: 0, rows: [], skipped: true };
  }

  const pricedClauses = ["COALESCE(c.price_vnd, 0) > 0"];

  if (caps.has_video_packages && caps.has_video_pkg_courses) {
    const vpSubjectClause = caps.has_vp_subject_prices
      ? `OR (
            COALESCE(vp.requires_subject_choice, FALSE) = TRUE
            AND vp.subject_prices IS NOT NULL
            AND COALESCE(vp.subject_prices ->> c.subject_code, '') ~ '^[0-9]+(\\.[0-9]+)?$'
            AND (vp.subject_prices ->> c.subject_code)::numeric > 0
          )`
      : "";
    pricedClauses.push(`EXISTS (
      SELECT 1
      FROM video_package_courses vpc
      JOIN video_packages vp ON vp.id = vpc.video_package_id
      WHERE vpc.course_id = c.id
        AND vp.status = 'active'
        AND (
          COALESCE(vp.price_vnd, 0) > 0
          ${vpSubjectClause}
        )
    )`);

    if (caps.has_combo_packages) {
      const comboSubjectClause = caps.has_combo_subject_prices
        ? `OR (
              cp.subject_prices IS NOT NULL
              AND COALESCE(cp.subject_prices ->> c.subject_code, '') ~ '^[0-9]+(\\.[0-9]+)?$'
              AND (cp.subject_prices ->> c.subject_code)::numeric > 0
            )`
        : "";
      pricedClauses.push(`EXISTS (
        SELECT 1
        FROM combo_packages cp
        JOIN video_packages vp ON vp.id = cp.video_package_id
        JOIN video_package_courses vpc ON vpc.video_package_id = vp.id
        WHERE vpc.course_id = c.id
          AND cp.status = 'active'
          AND vp.status = 'active'
          AND (
            COALESCE(cp.price_vnd, 0) > 0
            ${comboSubjectClause}
          )
      )`);
    }
  }

  if (caps.has_pkg_access && caps.has_vip_packages && caps.has_vip_pkg_cols) {
    pricedClauses.push(`(
      c.access_type = 'package'
      AND EXISTS (
        SELECT 1
        FROM course_package_access cpa
        JOIN vip_packages vip ON vip.id = cpa.package_id
        WHERE cpa.course_id = c.id
          AND vip.is_active = TRUE
          AND COALESCE(vip.price, 0) > 0
      )
    )`);
  }

  const tombstonedGuard = caps.has_tombstoned_at ? "AND c.tombstoned_at IS NULL" : "";
  const pricedExpr = pricedClauses.join(" OR ");

  const res = await runner.query(
    `UPDATE course_profile_projections p
     SET checkout_ready = (
           COALESCE(c.content_origin, 'moly_native') = 'csca_course'
           AND c.status = 'published'
           ${tombstonedGuard}
           AND p.status = 'active'
           AND p.deleted_at IS NULL
           AND (${pricedExpr})
         ),
         updated_at = NOW()
     FROM courses c
     WHERE c.id = p.local_course_id
       AND p.local_course_id = ANY($1::bigint[])
     RETURNING p.id, p.local_course_id, p.remote_profile_id, p.checkout_ready`,
    [cleanIds],
  );

  return {
    updated: res.rows.length,
    rows: res.rows,
  };
}

module.exports = {
  detectCheckoutReadySchema,
  syncProfileCheckoutReadyForCourses,
};
