const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const request = require('supertest');
const { PGlite } = require('@electric-sql/pglite');
const { applyMigration, TABLES } = require('../scripts/apply_video_commerce_migration');
const { createVideoCommerceRepository } = require('../src/repositories/videoCommerceRepository');
const { createVideoCommerceService } = require('../src/services/videoCommerceService');
const { createVideoCommerceRoutes } = require('../src/routes/videoCommerceRoutes');
const { normalizeDraft } = require('../src/utils/videoCommerceContract');
const { evaluateVideoAccess } = require('../src/utils/videoEntitlements');
const { parseFeatureFlag } = require('../src/utils/courseFeatureConfig');

let db, client, repository, service, app, beforeLegacy;
const migration = name => fs.readFileSync(path.join(__dirname, '../../database/migrations', name), 'utf8');
async function legacySnapshot() {
  const values = {};
  for (const table of ['users', 'vip_packages', 'transactions', 'courses', 'course_package_access', 'user_vip_entitlements', 'video_assets']) {
    values[table] = (await db.query(`SELECT * FROM ${table} ORDER BY 1`)).rows;
  }
  return values;
}

before(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE TABLE users (id SERIAL PRIMARY KEY, is_vip BOOLEAN DEFAULT FALSE, subscription_tier TEXT DEFAULT 'basic');
    CREATE TABLE materials (id SERIAL PRIMARY KEY);
    CREATE TABLE vip_packages (id SERIAL PRIMARY KEY, name TEXT, tier TEXT, allowed_subjects TEXT[], requires_subject_choice BOOLEAN DEFAULT FALSE, price INTEGER, duration_days INTEGER, is_active BOOLEAN DEFAULT TRUE);
    CREATE TABLE transactions (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), package_id INTEGER REFERENCES vip_packages(id), amount INTEGER, status TEXT);
    CREATE TABLE user_vip_entitlements (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), package_id INTEGER REFERENCES vip_packages(id), allowed_subjects TEXT[], starts_at TIMESTAMPTZ DEFAULT NOW(), expires_at TIMESTAMPTZ, is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;
    INSERT INTO users(id, is_vip, subscription_tier) VALUES (1, TRUE, 'vip'), (2, FALSE, 'basic');
    INSERT INTO vip_packages(id, name, tier, allowed_subjects, price, duration_days) VALUES (1, 'Legacy natural sciences', 'vip', ARRAY['MATH','PHYSICS'], 123000, 90);
    INSERT INTO transactions(id, user_id, package_id, amount, status) VALUES (1, 1, 1, 123000, 'completed');
    INSERT INTO user_vip_entitlements(user_id, package_id, allowed_subjects) VALUES (1, 1, ARRAY['MATH']);
  `);
  await db.exec(migration('052_csca_courses_core.sql'));
  await db.exec(migration('053_csca_course_progress.sql'));
  await db.exec(migration('054_csca_video_assets.sql'));
  await db.exec(migration('055_csca_course_package_access.sql'));
  await db.exec(`
    INSERT INTO courses(id, external_key, slug, title, subject_code, status, access_type)
    VALUES (1, 'math', 'math', 'Math', 'MATH', 'published', 'package'),
      (2, 'physics', 'physics', 'Physics', 'PHYSICS', 'published', 'package'),
      (3, 'draft', 'draft', 'Draft', 'MATH', 'draft', 'private');
    INSERT INTO course_package_access(course_id, package_id) VALUES (1, 1);
    INSERT INTO video_assets(external_key, course_id, status, hls_master_object_key) VALUES ('legacy-asset', 1, 'ready', 'private/master.m3u8');
  `);
  beforeLegacy = await legacySnapshot();
  client = { query: async (sql, values) => values ? db.query(sql, values) : (await db.exec(sql)).at(-1) };
  await applyMigration(client);
  repository = createVideoCommerceRepository(db);
  service = createVideoCommerceService(repository);
  app = express(); app.use(express.json());
  app.use('/api/video-commerce', createVideoCommerceRoutes({ service,
    authenticate: (req, res, next) => {
      if (!req.headers['x-test-user']) return res.sendStatus(401);
      req.user = { id: Number(req.headers['x-test-user']) }; next();
    },
    authorizePermission: permission => (req, res, next) => {
      assert.equal(permission, 'users.manage');
      if (req.headers['x-test-manage'] !== 'true') return res.sendStatus(403);
      next();
    },
  }));
});

after(async () => { if (db) await db.close(); });

test('migration is repeatable and preserves legacy records, constraints and mappings', async () => {
  await applyMigration(client);
  assert.deepEqual(await legacySnapshot(), beforeLegacy);
  const tables = await db.query('SELECT table_name FROM information_schema.tables WHERE table_name = ANY($1::text[])', [TABLES]);
  assert.equal(tables.rows.length, TABLES.length);
});

test('reapplying migration also preserves new draft rows', async () => {
  const draft = await service.saveDraft('video', { name: 'Migration rerun draft' }, 1);
  await applyMigration(client);
  assert.equal((await repository.find('video', draft.id)).name, draft.name);
});

test('commerce flag defaults to disabled and requires explicit true', () => {
  assert.equal(parseFeatureFlag(undefined), false);
  assert.equal(parseFeatureFlag('false'), false);
  assert.equal(parseFeatureFlag('true'), true);
  assert.throws(() => parseFeatureFlag('yes'));
});

test('video draft can defer price and duration without granting lifetime or VIP', async () => {
  const result = await service.saveDraft('video', { name: 'Video draft', allowedSubjects: ['MATH'], courseIds: [1] }, 1);
  assert.equal(result.priceVnd, null); assert.equal(result.durationMode, 'unconfigured');
  assert.equal(result.durationDays, null); assert.equal(result.canPurchase, false);
  assert.deepEqual(result.configurationIssues, ['PRICE_REQUIRED', 'DURATION_REQUIRED']);
  assert.deepEqual(await legacySnapshot(), beforeLegacy);
});

test('admin can configure price and duration later; update preserves untouched fields', async () => {
  const original = await service.saveDraft('video', { name: 'Configure later', allowedSubjects: ['MATH'], courseIds: [1] }, 1);
  const updated = await service.saveDraft('video', { priceVnd: 100000, durationMode: 'days', durationDays: 90 }, 1, original.id);
  assert.equal(updated.name, original.name); assert.deepEqual(updated.courseIds, [1]);
  assert.equal(updated.priceVnd, 100000); assert.deepEqual(updated.configurationIssues, []);
  assert.equal(updated.status, 'draft'); assert.equal(updated.canPurchase, false);
  const logs = await db.query('SELECT action FROM video_commerce_audit WHERE product_type = $1 AND product_id = $2 ORDER BY id', ['video', original.id]);
  assert.deepEqual(logs.rows.map(row => row.action), ['draft_created', 'draft_updated']);
});

test('combo references both packages without mutating legacy package or granting rights', async () => {
  const video = await service.saveDraft('video', { name: 'Combo video' }, 1);
  const combo = await service.saveDraft('combo', { name: 'Combo', vipPackageId: 1, videoPackageId: video.id }, 1);
  assert.equal(combo.vipPackageId, 1); assert.equal(combo.videoPackageId, video.id);
  assert.equal(combo.vipDurationDays, null); assert.equal(combo.priceVnd, null);
  assert.deepEqual(await legacySnapshot(), beforeLegacy);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM user_video_entitlements')).rows[0].n, 0);
});

test('draft validation rejects invalid price, duration, subjects, IDs and publishing', () => {
  for (const change of [
    { priceVnd: -1 }, { priceVnd: '1000' }, { durationMode: 'days' },
    { durationMode: 'unconfigured', durationDays: 90 }, { durationMode: 'lifetime', durationDays: 10 },
    { allowedSubjects: ['*'] }, { allowedSubjects: ['UNKNOWN'] }, { courseIds: ['1 OR 1=1'] },
    { requiresSubjectChoice: 'true' }, { status: 'active' }, { courseIds: [[1]] },
  ]) assert.throws(() => normalizeDraft('video', { name: 'Invalid', ...change }));
});

test('patch rejects non-object input and missing or already active drafts', async () => {
  await assert.rejects(service.saveDraft('video', null, 1, 1), { code: 'VIDEO_COMMERCE_INVALID_FIELD' });
  await assert.rejects(service.saveDraft('video', { name: 'Missing' }, 1, 99999), { code: 'VIDEO_COMMERCE_NOT_FOUND' });
  const draft = await service.saveDraft('video', { name: 'Active protected', priceVnd: 0, durationMode: 'lifetime', allowedSubjects: ['MATH'], courseIds: [1] }, 1);
  await db.query("UPDATE video_packages SET status = 'active' WHERE id = $1", [draft.id]);
  await assert.rejects(service.saveDraft('video', { name: 'Cannot edit active' }, 1, draft.id), { code: 'VIDEO_COMMERCE_DRAFT_ONLY' });
  await db.query("UPDATE video_packages SET status = 'archived' WHERE id = $1", [draft.id]);
});

test('missing course, wrong subject and missing combo references are rejected without partial writes', async () => {
  const beforeCount = (await db.query('SELECT count(*)::int AS n FROM video_packages')).rows[0].n;
  await assert.rejects(service.saveDraft('video', { name: 'Missing', courseIds: [9999] }, 1), { code: 'VIDEO_COMMERCE_COURSE_NOT_FOUND' });
  await assert.rejects(service.saveDraft('video', { name: 'Wrong subject', allowedSubjects: ['MATH'], courseIds: [2] }, 1), { code: 'VIDEO_COMMERCE_COURSE_SUBJECT_MISMATCH' });
  await assert.rejects(service.saveDraft('combo', { name: 'Missing VIP', vipPackageId: 9999 }, 1), { code: 'VIDEO_COMMERCE_VIP_PACKAGE_NOT_FOUND' });
  await assert.rejects(service.saveDraft('combo', { name: 'Missing video', videoPackageId: 9999 }, 1), { code: 'VIDEO_COMMERCE_VIDEO_PACKAGE_NOT_FOUND' });
  assert.equal((await db.query('SELECT count(*)::int AS n FROM video_packages')).rows[0].n, beforeCount);
});

test('failed audit rolls back package and course mappings', async () => {
  const brokenService = createVideoCommerceService({ ...repository, audit: async () => { throw new Error('Audit failure'); } });
  await assert.rejects(brokenService.saveDraft('video', { name: 'Must roll back', courseIds: [1] }, 1), /Audit failure/);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM video_packages WHERE name = 'Must roll back'")).rows[0].n, 0);
});

test('public catalog never exposes drafts, even with status=draft query', async () => {
  const response = await request(app).get('/api/video-commerce/catalog/video?status=draft');
  assert.equal(response.status, 200); assert.deepEqual(response.body.data.items, []);
  assert.equal(response.body.data.checkoutAvailable, false);
});

test('admin API enforces authentication, permission and bounded pagination', async () => {
  assert.equal((await request(app).get('/api/video-commerce/admin/video')).status, 401);
  assert.equal((await request(app).post('/api/video-commerce/admin/video').set('x-test-user', '2').send({ name: 'Denied' })).status, 403);
  const list = await request(app).get('/api/video-commerce/admin/video?limit=1').set('x-test-user', '1').set('x-test-manage', 'true');
  assert.equal(list.status, 200); assert.equal(list.body.data.items.length, 1); assert.equal(list.body.data.hasMore, true);
  assert.equal((await request(app).get('/api/video-commerce/catalog/video?page=-1')).status, 422);
  assert.equal((await request(app).get('/api/video-commerce/catalog/anything')).status, 422);
});

test('admin API creates and patches drafts but cannot publish or buy', async () => {
  const created = await request(app).post('/api/video-commerce/admin/video').set('x-test-user', '1').set('x-test-manage', 'true').send({ name: 'API draft' });
  assert.equal(created.status, 201);
  const id = created.body.data.id;
  const updated = await request(app).patch(`/api/video-commerce/admin/video/${id}`).set('x-test-user', '1').set('x-test-manage', 'true').send({ description: 'Updated' });
  assert.equal(updated.status, 200); assert.equal(updated.body.data.description, 'Updated');
  const publish = await request(app).patch(`/api/video-commerce/admin/video/${id}`).set('x-test-user', '1').set('x-test-manage', 'true').send({ status: 'active' });
  assert.equal(publish.status, 422);
  assert.equal((await request(app).post('/api/video-commerce/payments').send({ packageId: id })).status, 404);
});

test('SQL constraints reject incomplete active products and accidental unlimited grants', async () => {
  await assert.rejects(db.query("INSERT INTO video_packages(name,status) VALUES ('Cannot sell','active')"), { code: '23514' });
  const draft = await service.saveDraft('video', { name: 'Entitlement test' }, 1);
  await assert.rejects(db.query(`INSERT INTO user_video_entitlements(user_id,video_package_id,grant_key,source,allowed_subjects,starts_at,duration_mode)
    VALUES (1,$1,'invalid-expiry','manual',ARRAY['MATH'],NOW(),'days')`, [draft.id]), { code: '23514' });
  await assert.rejects(db.query(`INSERT INTO user_video_entitlements(user_id,video_package_id,grant_key,source,allowed_subjects,starts_at,duration_mode)
    VALUES (1,$1,'invalid-subject','manual',ARRAY['*'],NOW(),'lifetime')`, [draft.id]), { code: '23514' });
});

test('database rejects an entitlement attached to a different video package than its combo', async () => {
  const first = await service.saveDraft('video', { name: 'Combo original' }, 1);
  const second = await service.saveDraft('video', { name: 'Unrelated video' }, 1);
  const combo = await service.saveDraft('combo', { name: 'Consistent combo', vipPackageId: 1, videoPackageId: first.id }, 1);
  await assert.rejects(db.query(`INSERT INTO user_video_entitlements(user_id,video_package_id,combo_package_id,grant_key,source,allowed_subjects,starts_at,duration_mode)
    VALUES (1,$1,$2,'mismatched-combo','manual',ARRAY['MATH'],NOW(),'lifetime')`, [second.id, combo.id]), { code: '23503' });
});

const right = { id: 1, user_id: 1, status: 'active', allowed_subjects: ['MATH'], course_ids: [1],
  starts_at: '2026-01-01T00:00:00Z', expires_at: '2027-01-01T00:00:00Z', duration_mode: 'days' };
const access = entitlements => evaluateVideoAccess({ userId: 1, courseId: 1, subjectCode: 'MATH', entitlements, now: '2026-10-12T00:00:00Z' });

test('video policy checks subject, course, user, start, expiry, revocation and explicit lifetime', () => {
  assert.equal(access([right]).allowed, true);
  for (const override of [
    { user_id: 2 }, { course_ids: [2] }, { allowed_subjects: ['PHYSICS'] },
    { status: 'revoked' }, { starts_at: '2027-01-01' }, { starts_at: null }, { expires_at: '2026-10-12T00:00:00Z' },
    { expires_at: 'invalid' }, { expires_at: null }, { duration_mode: 'unconfigured', expires_at: null },
  ]) assert.equal(access([{ ...right, ...override }]).allowed, false, JSON.stringify(override));
  assert.equal(access([{ ...right, duration_mode: 'lifetime', expires_at: null }]).allowed, true);
});

test('revoking one source does not cancel a second source; VIP profile alone grants nothing', () => {
  assert.deepEqual(access([{ ...right, status: 'revoked' }, { ...right, id: 2, combo_package_id: 1 }]), { allowed: true, entitlementIds: [2] });
  assert.equal(access([]).allowed, false);
  assert.equal(evaluateVideoAccess({ userId: 1, courseId: 1, subjectCode: 'MATH', entitlements: [], is_vip: true }).allowed, false);
});

test('repository access uses purchased course snapshot, independent from later catalog edits', async () => {
  const video = await service.saveDraft('video', { name: 'Snapshot', allowedSubjects: ['MATH'], courseIds: [1] }, 1);
  const inserted = await db.query(`INSERT INTO user_video_entitlements(user_id,video_package_id,grant_key,source,allowed_subjects,starts_at,expires_at,duration_mode)
    VALUES (1,$1,'snapshot-grant','manual',ARRAY['MATH'],'2026-01-01','2027-01-01','days') RETURNING id`, [video.id]);
  const entitlementId = inserted.rows[0].id;
  await db.query('INSERT INTO video_entitlement_courses(entitlement_id,course_id) VALUES ($1,1)', [entitlementId]);
  await db.query('DELETE FROM video_package_courses WHERE video_package_id = $1', [video.id]);
  assert.equal((await service.checkVideoAccess(1, 1, '2026-10-12')).allowed, true);
  assert.equal((await service.checkVideoAccess(2, 1, '2026-10-12')).allowed, false);
  assert.equal((await service.checkVideoAccess(1, 3, '2026-10-12')).allowed, false);
  assert.equal((await service.checkVideoAccess(1, 1, '2027-01-01')).allowed, false);
  await assert.rejects(db.query(`INSERT INTO user_video_entitlements(user_id,video_package_id,grant_key,source,allowed_subjects,starts_at,duration_mode)
    VALUES (1,$1,'snapshot-grant','manual',ARRAY['MATH'],NOW(),'lifetime')`, [video.id]), { code: '23505' });
  assert.deepEqual(await legacySnapshot(), beforeLegacy);
});
