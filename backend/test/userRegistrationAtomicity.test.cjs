const assert = require('node:assert/strict');
const test = require('node:test');
const db = require('../src/config/database');
const User = require('../src/models/User');

async function withTransactionClient(query, run) {
  const originalConnect = db.pool.connect;
  const statements = [];
  let released = false;
  db.pool.connect = async () => ({
    query: async (sql, params = []) => {
      const normalized = sql.replace(/\s+/g, ' ').trim();
      statements.push({ sql: normalized, params });
      return query(normalized, params);
    },
    release() { released = true; },
  });

  try {
    await run({ statements, released: () => released });
  } finally {
    db.pool.connect = originalConnect;
  }
}

test('local registration rolls back the user when stats creation fails', async () => {
  await withTransactionClient(async (sql) => {
    if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] };
    if (sql.startsWith('INSERT INTO users')) {
      return { rows: [{ id: 71, username: 'atomic_user', email: 'atomic@example.com' }] };
    }
    if (sql.startsWith('INSERT INTO user_stats')) throw new Error('stats insert failed');
    throw new Error(`Unexpected query: ${sql}`);
  }, async (state) => {
    await assert.rejects(User.create({
      username: 'atomic_user',
      email: 'atomic@example.com',
      password: 'Password123',
      full_name: 'Atomic User',
      termsVersion: '2026-04',
      privacyVersion: '2026-04',
    }), /stats insert failed/);

    assert.equal(state.statements[0].sql, 'BEGIN');
    assert.equal(state.statements.at(-1).sql, 'ROLLBACK');
    assert.equal(state.statements.some(item => item.sql === 'COMMIT'), false);
    assert.equal(state.released(), true);
  });
});

test('local registration stores server legal versions in the user insert transaction', async () => {
  await withTransactionClient(async (sql) => {
    if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
    if (sql.startsWith('INSERT INTO users')) {
      return { rows: [{ id: 72, username: 'legal_user', email: 'legal@example.com' }] };
    }
    if (sql.startsWith('INSERT INTO user_stats')) return { rows: [] };
    throw new Error(`Unexpected query: ${sql}`);
  }, async (state) => {
    await User.create({
      username: 'legal_user',
      email: 'legal@example.com',
      password: 'Password123',
      full_name: 'Legal User',
      termsVersion: '2026-04',
      privacyVersion: '2026-04',
    });

    const insert = state.statements.find(item => item.sql.startsWith('INSERT INTO users'));
    assert.match(insert.sql, /terms_accepted_at, terms_version, privacy_version/);
    assert.deepEqual(insert.params.slice(-2), ['2026-04', '2026-04']);
    assert.equal(state.statements.at(-1).sql, 'COMMIT');
    assert.equal(state.released(), true);
  });
});

test('Facebook registration is verified and stores legal consent atomically', async () => {
  await withTransactionClient(async (sql) => {
    if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
    if (sql.startsWith('SELECT id FROM users')) return { rows: [] };
    if (sql.startsWith('INSERT INTO users')) {
      return { rows: [{ id: 73, username: 'facebookuser', email: 'facebook@example.com', is_verified: true }] };
    }
    if (sql.startsWith('INSERT INTO user_stats')) return { rows: [] };
    throw new Error(`Unexpected query: ${sql}`);
  }, async (state) => {
    const user = await User.createFromFacebook({
      facebookId: 'facebook-73',
      email: 'facebook@example.com',
      name: 'Facebook User',
      picture: 'https://example.com/avatar.jpg',
      termsVersion: '2026-04',
      privacyVersion: '2026-04',
    });

    const insert = state.statements.find(item => item.sql.startsWith('INSERT INTO users'));
    assert.match(insert.sql, /email_verified, is_verified/);
    assert.match(insert.sql, /'facebook', true, true/);
    assert.match(insert.sql, /terms_accepted_at, terms_version, privacy_version/);
    assert.equal(user.is_verified, true);
    assert.equal(state.statements.at(-1).sql, 'COMMIT');
  });
});

test('linking Facebook verifies an existing account consistently', async () => {
  const originalQuery = db.query;
  let capturedSql = '';
  db.query = async (sql) => {
    capturedSql = sql.replace(/\s+/g, ' ').trim();
    return { rows: [{ id: 74, is_verified: true }] };
  };

  try {
    const user = await User.linkFacebookAccount(74, 'facebook-74', null);
    assert.match(capturedSql, /email_verified = true, is_verified = true/);
    assert.match(capturedSql, /RETURNING .*is_verified/);
    assert.equal(user.is_verified, true);
  } finally {
    db.query = originalQuery;
  }
});
