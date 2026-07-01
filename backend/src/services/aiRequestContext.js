const { AsyncLocalStorage } = require('async_hooks');

const storage = new AsyncLocalStorage();

function aiRequestContextMiddleware(req, _res, next) {
  storage.run({ req }, next);
}

function getCurrentRequest() {
  return storage.getStore()?.req || null;
}

function getCurrentUserId() {
  const id = getCurrentRequest()?.user?.id;
  const parsed = Number.parseInt(id, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

module.exports = {
  aiRequestContextMiddleware,
  getCurrentRequest,
  getCurrentUserId,
};
