const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

const frontendRoot = path.resolve(__dirname, '../../frontend');
const frontendRequire = createRequire(path.join(frontendRoot, 'package.json'));
const ts = frontendRequire('typescript');

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
}

function loadAuthStore() {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
      },
      fileName: filename,
    }).outputText;
    const localRequire = name => name.startsWith('.')
      ? load(path.resolve(path.dirname(filename), name) + '.ts')
      : frontendRequire(name);
    vm.runInThisContext(`(function(exports, require, module) { ${compiled}\n})`, { filename })(module.exports, localRequire, module);
    return module.exports;
  }
  return load(path.join(frontendRoot, 'lib/store/authStore.ts'));
}

async function withBrowser(run) {
  const oldWindow = global.window;
  const oldLocal = global.localStorage;
  const oldSession = global.sessionStorage;
  global.localStorage = memoryStorage();
  global.sessionStorage = memoryStorage();
  global.window = {
    localStorage: global.localStorage,
    sessionStorage: global.sessionStorage,
    location: { pathname: '/login', href: '/login' },
  };
  try {
    await run(loadAuthStore());
  } finally {
    for (const [key, value] of [
      ['window', oldWindow],
      ['localStorage', oldLocal],
      ['sessionStorage', oldSession],
    ]) {
      if (value === undefined) delete global[key];
      else global[key] = value;
    }
  }
}

function persistedAuth() {
  const raw = localStorage.getItem('auth-storage');
  assert.ok(raw, 'Zustand should persist an explicit remembered/non-remembered state');
  return JSON.parse(raw).state;
}

test('login persists in the browser by default', async () => {
  await withBrowser(async ({ useAuthStore }) => {
    useAuthStore.getState().login({ id: 7 }, 'browser-access', 'browser-refresh');

    assert.equal(sessionStorage.getItem('token'), 'browser-access');
    assert.equal(sessionStorage.getItem('refreshToken'), 'browser-refresh');
    assert.equal(JSON.parse(sessionStorage.getItem('user')).id, 7);
    assert.equal(persistedAuth().token, 'browser-access');
    assert.equal(persistedAuth().refreshToken, 'browser-refresh');
    assert.equal(persistedAuth().isAuthenticated, true);
    assert.equal(persistedAuth().rememberMe, true);
  });
});

test('closing a tab and opening a new one restores the browser login', async () => {
  await withBrowser(async ({ useAuthStore }) => {
    useAuthStore.getState().login({ id: 7 }, 'browser-access', 'browser-refresh');
    const persistedBeforeClose = localStorage.getItem('auth-storage');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('refreshToken');
    sessionStorage.removeItem('user');
    useAuthStore.setState({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
    });
    localStorage.setItem('auth-storage', persistedBeforeClose);

    await useAuthStore.persist.rehydrate();

    assert.equal(useAuthStore.getState().user.id, 7);
    assert.equal(useAuthStore.getState().token, 'browser-access');
    assert.equal(useAuthStore.getState().refreshToken, 'browser-refresh');
    assert.equal(useAuthStore.getState().isAuthenticated, true);
    assert.equal(sessionStorage.getItem('token'), 'browser-access');
    assert.equal(sessionStorage.getItem('refreshToken'), 'browser-refresh');
  });
});

test('legacy callers cannot disable browser persistence', async () => {
  await withBrowser(async ({ useAuthStore }) => {
    useAuthStore.getState().login({ id: 7 }, 'browser-access', 'browser-refresh');
    useAuthStore.getState().setRememberMe(false);

    const persisted = persistedAuth();
    assert.equal(persisted.token, 'browser-access');
    assert.equal(persisted.refreshToken, 'browser-refresh');
    assert.equal(persisted.isAuthenticated, true);
    assert.equal(persisted.rememberMe, true);
    assert.equal(useAuthStore.getState().rememberMe, true);
  });
});

test('explicit logout clears both tab and browser login storage', async () => {
  await withBrowser(async ({ useAuthStore }) => {
    useAuthStore.getState().login({ id: 7 }, 'browser-access', 'browser-refresh');
    useAuthStore.getState().logout();

    assert.equal(persistedAuth().token, null);
    assert.equal(persistedAuth().refreshToken, null);
    assert.equal(persistedAuth().isAuthenticated, false);
    assert.equal(sessionStorage.getItem('token'), null);
    assert.equal(sessionStorage.getItem('refreshToken'), null);
    assert.equal(sessionStorage.getItem('user'), null);
  });
});
