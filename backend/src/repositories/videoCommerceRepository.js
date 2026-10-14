const { productType } = require('../utils/videoCommerceContract');

const TABLES = Object.freeze({ video: 'video_packages', combo: 'combo_packages' });
const COMMON_COLUMNS = ['name', 'description', 'features', 'status', 'price_vnd', 'original_price_vnd', 'sort_order'];

function createVideoCommerceRepository(db) {
  async function transaction(work) {
    if (db.transaction) return db.transaction(work);
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  function selection(type) {
    productType(type);
    return type === 'video'
      ? `p.*, ARRAY(SELECT course_id FROM video_package_courses WHERE video_package_id = p.id ORDER BY course_id) AS course_ids`
      : 'p.*';
  }

  async function find(type, id, client = db, { lock = false } = {}) {
    const result = await client.query(
      `SELECT ${selection(type)} FROM ${TABLES[type]} p WHERE p.id = $1${lock ? ' FOR UPDATE OF p' : ''}`, [id]);
    return result.rows[0] || null;
  }

  async function list(type, { status = null, limit = 50, offset = 0 } = {}) {
    const result = await db.query(
      `SELECT ${selection(type)} FROM ${TABLES[type]} p
       WHERE ($1::text IS NULL OR p.status = $1) ORDER BY p.sort_order, p.id LIMIT $2 OFFSET $3`,
      [status, limit, offset]);
    return result.rows;
  }

  async function writeDraft(type, data, actorId, client, id = null) {
    productType(type);
    const columns = [...COMMON_COLUMNS];
    const values = [data.name, data.description, data.features, data.status, data.priceVnd, data.originalPriceVnd, data.sortOrder];
    if (type === 'video') {
      columns.push('duration_mode', 'duration_days', 'allowed_subjects', 'requires_subject_choice');
      values.push(data.durationMode, data.durationDays, data.allowedSubjects, data.requiresSubjectChoice);
    } else {
      columns.push('vip_package_id', 'video_package_id', 'vip_duration_days');
      values.push(data.vipPackageId, data.videoPackageId, data.vipDurationDays);
    }
    let result;
    if (id === null) {
      columns.push('created_by'); values.push(actorId);
      result = await client.query(
        `INSERT INTO ${TABLES[type]} (${columns.join(', ')}) VALUES (${values.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`, values);
    } else {
      values.push(id);
      result = await client.query(
        `UPDATE ${TABLES[type]} SET ${columns.map((column, i) => `${column} = $${i + 1}`).join(', ')}, updated_at = NOW()
         WHERE id = $${values.length} RETURNING id`, values);
    }
    const savedId = result.rows[0].id;
    if (type === 'video') {
      await client.query('DELETE FROM video_package_courses WHERE video_package_id = $1', [savedId]);
      await client.query(
        'INSERT INTO video_package_courses (video_package_id, course_id) SELECT $1, UNNEST($2::bigint[])', [savedId, data.courseIds]);
    }
    return find(type, savedId, client);
  }

  async function findCourses(ids, client = db) {
    const result = await client.query('SELECT id, subject_code, status FROM courses WHERE id = ANY($1::bigint[])', [ids]);
    return result.rows;
  }

  async function findVipPackage(id, client = db) {
    const result = await client.query('SELECT id, name, is_active, allowed_subjects, requires_subject_choice FROM vip_packages WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async function audit({ actorId, type, id, before, after }, client) {
    await client.query(
      `INSERT INTO video_commerce_audit (actor_id, product_type, product_id, action, before_data, after_data)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)`,
      [actorId, type, id, before ? 'draft_updated' : 'draft_created', before ? JSON.stringify(before) : null, JSON.stringify(after)]);
  }

  async function listEntitlements(userId, courseId) {
    const result = await db.query(
      `SELECT e.*, ARRAY(SELECT course_id FROM video_entitlement_courses WHERE entitlement_id = e.id) AS course_ids
       FROM user_video_entitlements e
       WHERE e.user_id = $1 AND EXISTS (
         SELECT 1 FROM video_entitlement_courses ec WHERE ec.entitlement_id = e.id AND ec.course_id = $2
       )`, [userId, courseId]);
    return result.rows;
  }

  return { transaction, find, list, writeDraft, findCourses, findVipPackage, audit, listEntitlements };
}

module.exports = { createVideoCommerceRepository };
