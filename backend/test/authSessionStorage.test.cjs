const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

const frontendRoot = path.resolve(__dirname, '../../frontend');
const frontendRequire = createRequire(path.join(frontendRoot, 'package.json'));
const ts = frontendRequire('typescript');
const rawAxios = frontendRequire('axios');

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
}

function loadFrontend() {
  // Run the actual TypeScript modules with browser storage and Axios adapters,
  // avoiding a browser, network requests, and a production database.
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
      fileName: filename,
    }).outputText;
    const localRequire = name => name.startsWith('.')
      ? load(path.resolve(path.dirname(filename), name) + '.ts')
      : frontendRequire(name);
    vm.runInThisContext(`(function(exports, require, module) { ${compiled}\n})`, { filename })(module.exports, localRequire, module);
    return module.exports;
  }
  return {
    auth: load(path.join(frontendRoot, 'lib/store/authStore.ts')),
    http: load(path.join(frontendRoot, 'lib/utils/axios.ts')),
    identity: load(path.join(frontendRoot, 'lib/utils/previousSession.ts')),
  };
}

async function withBrowser(run) {
  const oldWindow = global.window;
  const oldLocal = global.localStorage;
  const oldSession = global.sessionStorage;
  const oldAdapter = rawAxios.defaults.adapter;
  global.localStorage = memoryStorage();
  global.sessionStorage = memoryStorage();
  global.window = { localStorage: global.localStorage, sessionStorage: global.sessionStorage,
    location: { pathname: '/login', href: '/login' } };
  try { await run(loadFrontend()); }
  finally {
    rawAxios.defaults.adapter = oldAdapter;
    for (const [key, value] of [['window', oldWindow], ['localStorage', oldLocal], ['sessionStorage', oldSession]]) {
      if (value === undefined) delete global[key];
      else global[key] = value;
    }
  }
}

test('automatic auth clearing preserves browser identity for a later login', async () => {
  await withBrowser(async ({ auth, http, identity }) => {
    auth.useAuthStore.getState().login({ id: 7 }, 'old-signed-session', 'old-refresh');
    http.clearStoredAuth(true);
    assert.equal(sessionStorage.getItem('token'), null);
    assert.equal(localStorage.getItem('auth-storage'), null);
    assert.equal(identity.getPreviousSessionToken(), 'old-signed-session');
    let captured;
    http.default.defaults.adapter = async config => {
      captured = config;
      return { data: {}, status: 200, headers: {}, config };
    };
    await http.default.post('/auth/login', { email: 'student@example.com', password: 'test' });
    assert.equal(captured.headers['X-Previous-Session'], 'old-signed-session');
    await http.default.get('/exams');
    assert.equal(captured.headers['X-Previous-Session'], undefined);
  });
});

test('refresh is shared by concurrent requests and persisted for reopening the app', async () => {
  await withBrowser(async ({ auth, http, identity }) => {
    auth.useAuthStore.getState().setRememberMe(true);
    auth.useAuthStore.getState().login({ id: 7 }, 'old-access', 'old-refresh');
    let refreshCalls = 0;
    rawAxios.defaults.adapter = async config => {
      assert.ok(config.url.endsWith('/auth/refresh'));
      refreshCalls++;
      await new Promise(resolve => setTimeout(resolve, 10));
      return { data: { data: { token: 'new-access', refreshToken: 'new-refresh' } }, status: 200, headers: {}, config };
    };
    http.default.defaults.adapter = async config => {
      if (config.headers.Authorization === 'Bearer old-access') {
        throw new rawAxios.AxiosError('Expired', 'ERR_BAD_REQUEST', config, null,
          { status: 401, data: { code: 'TOKEN_EXPIRED' }, headers: {}, config });
      }
      assert.equal(config.headers.Authorization, 'Bearer new-access');
      return { data: { success: true }, status: 200, headers: {}, config };
    };
    await Promise.all([http.default.get('/exams'), http.default.get('/profile')]);
    assert.equal(refreshCalls, 1);
    assert.equal(auth.useAuthStore.getState().refreshToken, 'new-refresh');
    assert.equal(JSON.parse(localStorage.getItem('auth-storage')).state.refreshToken, 'new-refresh');
    assert.equal(sessionStorage.getItem('refreshToken'), 'new-refresh');
    assert.equal(identity.getPreviousSessionToken(), 'new-access');
    // Simulate reopening: clear per-tab storage, then hydrate the persisted store.
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('refreshToken');
    await auth.useAuthStore.persist.rehydrate();
    assert.equal(sessionStorage.getItem('token'), 'new-access');
    assert.equal(sessionStorage.getItem('refreshToken'), 'new-refresh');
  });
});

test('a changed login replaces the cached authorization token immediately', async () => {
  await withBrowser(async ({ auth, http }) => {
    let seen;
    http.default.defaults.adapter = async config => {
      seen = config.headers.Authorization;
      return { data: {}, status: 200, headers: {}, config };
    };
    auth.useAuthStore.getState().login({ id: 7 }, 'first-access', 'first-refresh');
    await http.default.get('/exams');
    assert.equal(seen, 'Bearer first-access');
    auth.useAuthStore.getState().login({ id: 7 }, 'second-access', 'second-refresh');
    await http.default.get('/exams');
    assert.equal(seen, 'Bearer second-access');
  });
});

for (const status of [undefined, 429, 500, 503]) {
  test(`refresh failure ${status || 'network timeout'} preserves login and allows retry`, async () => {
    await withBrowser(async ({ auth, http }) => {
      auth.useAuthStore.getState().setRememberMe(true);
      auth.useAuthStore.getState().login({ id: 7 }, 'old-access', 'old-refresh');
      rawAxios.defaults.adapter = async config => {
        throw new rawAxios.AxiosError('Unavailable', 'ERR_NETWORK', config, null,
          status ? { status, data: {}, headers: {}, config } : undefined);
      };
      http.default.defaults.adapter = async config => {
        if (config.headers.Authorization === 'Bearer old-access') {
          throw new rawAxios.AxiosError('Expired', 'ERR_BAD_REQUEST', config, null,
            { status: 401, data: { code: 'TOKEN_EXPIRED' }, headers: {}, config });
        }
        return { data: {}, status: 200, headers: {}, config };
      };
      await assert.rejects(http.default.get('/profile'));
      assert.equal(sessionStorage.getItem('token'), 'old-access');
      assert.equal(JSON.parse(localStorage.getItem('auth-storage')).state.refreshToken, 'old-refresh');
      rawAxios.defaults.adapter = async config => ({ data: { data: { token: 'new-access', refreshToken: 'new-refresh' } },
        status: 200, headers: {}, config });
      await http.default.get('/profile');
      assert.equal(sessionStorage.getItem('token'), 'new-access');
    });
  });
}

test('definitively rejected refresh clears credentials', async () => {
  await withBrowser(async ({ auth, http }) => {
    auth.useAuthStore.getState().login({ id: 7 }, 'old-access', 'old-refresh');
    rawAxios.defaults.adapter = async config => {
      throw new rawAxios.AxiosError('Revoked', 'ERR_BAD_REQUEST', config, null,
        { status: 401, data: { code: 'SESSION_REVOKED' }, headers: {}, config });
    };
    http.default.defaults.adapter = async config => {
      throw new rawAxios.AxiosError('Expired', 'ERR_BAD_REQUEST', config, null,
        { status: 401, data: { code: 'TOKEN_EXPIRED' }, headers: {}, config });
    };
    await assert.rejects(http.default.get('/profile'));
    assert.equal(sessionStorage.getItem('token'), null);
    assert.equal(sessionStorage.getItem('refreshToken'), null);
  });
});

test('an old tab adopts the newer remembered login before processing revocation', async () => {
  await withBrowser(async ({ auth, http }) => {
    auth.useAuthStore.getState().setRememberMe(true);
    auth.useAuthStore.getState().login({ id: 7 }, 'old-access', 'old-refresh');
    http.default.defaults.adapter = async config => {
      if (config.headers.Authorization === 'Bearer old-access') {
        const persisted = JSON.parse(localStorage.getItem('auth-storage'));
        persisted.state.token = 'other-tab-access';
        persisted.state.refreshToken = 'other-tab-refresh';
        localStorage.setItem('auth-storage', JSON.stringify(persisted));
        throw new rawAxios.AxiosError('Revoked', 'ERR_BAD_REQUEST', config, null,
          { status: 401, data: { code: 'SESSION_REVOKED' }, headers: {}, config });
      }
      assert.equal(config.headers.Authorization, 'Bearer other-tab-access');
      return { data: {}, status: 200, headers: {}, config };
    };
    await http.default.get('/profile');
    assert.equal(auth.useAuthStore.getState().token, 'other-tab-access');
    assert.equal(sessionStorage.getItem('refreshToken'), 'other-tab-refresh');
  });
});

test('a delayed refresh response cannot overwrite a newer login', async () => {
  await withBrowser(async ({ auth, http }) => {
    auth.useAuthStore.getState().login({ id: 7 }, 'old-access', 'old-refresh');
    rawAxios.defaults.adapter = async config => {
      auth.useAuthStore.getState().login({ id: 8 }, 'new-login', 'new-login-refresh');
      return { data: { data: { token: 'stale-refresh-access', refreshToken: 'stale-refresh' } },
        status: 200, headers: {}, config };
    };
    http.default.defaults.adapter = async config => {
      throw new rawAxios.AxiosError('Expired', 'ERR_BAD_REQUEST', config, null,
        { status: 401, data: { code: 'TOKEN_EXPIRED' }, headers: {}, config });
    };
    await assert.rejects(http.default.get('/profile'));
    assert.equal(auth.useAuthStore.getState().user.id, 8);
    assert.equal(sessionStorage.getItem('token'), 'new-login');
  });
});

for (const code of ['TOKEN_EXPIRED', 'SESSION_REVOKED', 'TOKEN_REVOKED']) {
  test(`${code}: a delayed account A request is never replayed under account B`, async () => {
    await withBrowser(async ({ auth, http }) => {
      auth.useAuthStore.getState().login({ id: 7 }, 'account-a-access', 'account-a-refresh');
      let requests = 0;
      http.default.defaults.adapter = async config => {
        requests++;
        assert.equal(config.headers.Authorization, 'Bearer account-a-access');
        auth.useAuthStore.getState().login({ id: 8 }, 'account-b-access', 'account-b-refresh');
        throw new rawAxios.AxiosError('Delayed failure', 'ERR_BAD_REQUEST', config, null,
          { status: 401, data: { code }, headers: {}, config });
      };
      rawAxios.defaults.adapter = async () => assert.fail('must not refresh account B for account A');
      await assert.rejects(http.default.post('/profile', { full_name: 'Account A edit' }));
      assert.equal(requests, 1);
      assert.equal(auth.useAuthStore.getState().user.id, 8);
      assert.equal(sessionStorage.getItem('token'), 'account-b-access');
    });
  });
}

test('a rejected refresh from account A never clears the newer account B login', async () => {
  await withBrowser(async ({ auth, http }) => {
    auth.useAuthStore.getState().login({ id: 7 }, 'account-a-access', 'account-a-refresh');
    http.default.defaults.adapter = async config => {
      throw new rawAxios.AxiosError('Expired', 'ERR_BAD_REQUEST', config, null,
        { status: 401, data: { code: 'TOKEN_EXPIRED' }, headers: {}, config });
    };
    rawAxios.defaults.adapter = async config => {
      auth.useAuthStore.getState().login({ id: 8 }, 'account-b-access', 'account-b-refresh');
      throw new rawAxios.AxiosError('Revoked', 'ERR_BAD_REQUEST', config, null,
        { status: 401, data: {}, headers: {}, config });
    };
    await assert.rejects(http.default.get('/profile'));
    assert.equal(sessionStorage.getItem('token'), 'account-b-access');
    assert.equal(sessionStorage.getItem('refreshToken'), 'account-b-refresh');
  });
});

test('a changed account between retry scheduling and dispatch cancels the request', async () => {
  await withBrowser(async ({ auth, http }) => {
    auth.useAuthStore.getState().login({ id: 8 }, 'account-b-access', 'account-b-refresh');
    http.default.defaults.adapter = async () => assert.fail('must not dispatch a request owned by account A');
    await assert.rejects(http.default.post('/profile', { full_name: 'Account A edit' },
      { _authAccountId: '7' }), error => rawAxios.isCancel(error));
    assert.equal(sessionStorage.getItem('token'), 'account-b-access');
  });
});
