import { User } from '@/lib/api/auth';

export function isVipActive(user: User | null | undefined): boolean {
  if (!user) return false;
  const isVip = user.is_vip === true;
  const hasTier = user.subscription_tier === 'vip' || user.subscription_tier === 'premium';
  const notExpired = !user.vip_expires_at || new Date(user.vip_expires_at) > new Date();
  return (isVip || hasTier) && notExpired;
}

export function getVipDisplay(user: User | null | undefined): { isVip: boolean; expiresAt: string | null; daysLeft: number | null } {
  if (!user || !isVipActive(user)) {
    return { isVip: false, expiresAt: null, daysLeft: null };
  }
  const expiresAt = user.vip_expires_at || null;
  let daysLeft: number | null = null;
  if (expiresAt) {
    const diff = new Date(expiresAt).getTime() - Date.now();
    daysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }
  return { isVip: true, expiresAt, daysLeft };
}

const ADMIN_PANEL_PERMISSION_PRIORITY: Array<{ permission: string; route: string }> = [
  { permission: 'users.manage', route: '/admin/users' },
  { permission: 'exams.manage', route: '/admin/exams' },
  { permission: 'content.manage', route: '/admin/materials' },
  { permission: 'forum.manage', route: '/admin/posts' },
  { permission: 'roadmap.manage', route: '/admin/roadmap' },
  { permission: 'system.manage', route: '/admin' },
  { permission: 'admin.dashboard.view', route: '/admin' },
];

const ADMIN_PANEL_PERMISSIONS = ADMIN_PANEL_PERMISSION_PRIORITY.map((item) => item.permission);

const ADMIN_ROLE_ROUTE_PRIORITY: Array<{ role: string; route: string }> = [
  { role: 'super_admin', route: '/admin' },
  { role: 'user_admin', route: '/admin/users' },
  { role: 'exam_admin', route: '/admin/exams' },
  { role: 'content_admin', route: '/admin/materials' },
  { role: 'forum_admin', route: '/admin/posts' },
  { role: 'roadmap_admin', route: '/admin/roadmap' },
];

const ADMIN_ROLE_CODES = ADMIN_ROLE_ROUTE_PRIORITY.map((item) => item.role);

function getRoleSet(user?: User | null) {
  return new Set<string>((user?.roles || []).filter(Boolean));
}

function hasAnyAdminRole(user?: User | null) {
  const roleSet = getRoleSet(user);
  return ADMIN_ROLE_CODES.some((roleCode) => roleSet.has(roleCode));
}

function getPermissionSet(user?: User | null) {
  const set = new Set<string>((user?.permissions || []).filter(Boolean));

  // Keep legacy compatibility while old role-only sessions still exist.
  // ⚠ DEPRECATED: Token phải chứa RBAC roles. Session cũ sẽ bị vô hiệu sau khi đăng xuất.
  if (user?.role === 'admin' && (!user?.roles || user.roles.length === 0)) {
    if (typeof window !== 'undefined') {
      console.warn('[RBAC] Legacy admin session detected — missing RBAC roles. Please re-login.');
    }
    set.add('*');
  }

  // Fallback for cases where role assignments exist but permissions are not hydrated yet.
  if (hasAnyAdminRole(user)) {
    set.add('admin.dashboard.view');
  }

  return set;
}

export function hasPermission(user: User | null | undefined, permission: string): boolean {
  if (!user || !permission) return false;

  const permissions = getPermissionSet(user);
  return permissions.has('*') || permissions.has(permission);
}

export function hasAnyPermission(user: User | null | undefined, permissionCodes: string[]): boolean {
  if (!user || !Array.isArray(permissionCodes) || permissionCodes.length === 0) {
    return false;
  }

  const permissions = getPermissionSet(user);
  if (permissions.has('*')) return true;

  return permissionCodes.some((code) => permissions.has(code));
}

export function canAccessAdminPanel(user: User | null | undefined): boolean {
  return hasAnyPermission(user, ADMIN_PANEL_PERMISSIONS) || hasAnyAdminRole(user);
}

export function getDefaultAdminRoute(user: User | null | undefined): string {
  if (!user) return '/';

  const roleSet = getRoleSet(user);

  // Keep super admin on the full dashboard by default.
  if (roleSet.has('super_admin')) {
    return '/admin';
  }

  // Legacy admin sessions without RBAC roles should still land on dashboard.
  if (user.role === 'admin' && roleSet.size === 0) {
    return '/admin';
  }

  for (const item of ADMIN_PANEL_PERMISSION_PRIORITY) {
    if (hasPermission(user, item.permission)) {
      return item.route;
    }
  }

  for (const item of ADMIN_ROLE_ROUTE_PRIORITY) {
    if (roleSet.has(item.role)) {
      return item.route;
    }
  }

  return '/';
}
