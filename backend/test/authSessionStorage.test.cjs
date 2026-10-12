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
    http.clearStoredAuth();
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
