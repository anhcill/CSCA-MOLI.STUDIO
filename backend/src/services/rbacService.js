const db = require("../config/database");

const AUTHZ_CACHE_TTL_MS = 60 * 1000;
const authzCache = new Map();

function buildCacheKey(userId) {
  return String(userId);
}

function normalizeAuthorizationRows(rows) {
  const roles = new Set();
  const permissions = new Set();

  rows.forEach((row) => {
    if (row.role_code) roles.add(row.role_code);
    if (row.permission_code) permissions.add(row.permission_code);
  });

  return {
    roles: Array.from(roles),
    permissions: Array.from(permissions),
  };
}

async function getAuthorizationContext(userId, options = {}) {
  const { forceRefresh = false } = options;
  const cacheKey = buildCacheKey(userId);
  const now = Date.now();

  if (!forceRefresh) {
    const cached = authzCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }
  }

  const { rows } = await db.query(
    `SELECT
       r.code AS role_code,
       p.code AS permission_code
     FROM user_roles ur
     INNER JOIN roles r ON ur.role_id = r.id
     LEFT JOIN role_permissions rp ON rp.role_id = r.id
     LEFT JOIN permissions p ON p.id = rp.permission_id
     WHERE ur.user_id = $1`,
    [userId],
  );

  const data = normalizeAuthorizationRows(rows);
  authzCache.set(cacheKey, {
    data,
    expiresAt: now + AUTHZ_CACHE_TTL_MS,
  });

  return data;
}

async function hasAnyPermission(userId, permissionCodes = []) {
  if (!Array.isArray(permissionCodes) || permissionCodes.length === 0) {
    return false;
  }

  const authz = await getAuthorizationContext(userId);
  if (authz.roles.includes("super_admin") || authz.permissions.includes("*")) {
    return true;
  }

  return permissionCodes.some((code) => authz.permissions.includes(code));
}

function invalidateAuthorizationCache(userId) {
  if (userId === undefined || userId === null) return;
  authzCache.delete(buildCacheKey(userId));
}

function clearAuthorizationCache() {
  authzCache.clear();
}

module.exports = {
  getAuthorizationContext,
  hasAnyPermission,
  invalidateAuthorizationCache,
  clearAuthorizationCache,
};
