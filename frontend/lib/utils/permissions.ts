import { User } from '@/lib/api/auth';

export type TierLevel = 'basic' | 'vip' | 'premium';

// ─── Tier metadata ─────────────────────────────────────────────────────────────
export const TIER_META: Record<TierLevel, {
  label: string;
  shortLabel: string;
  badgeColor: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  devices: number;
}> = {
  basic: {
    label: 'Miễn phí',
    shortLabel: 'Free',
    badgeColor: 'bg-gray-100 text-gray-600 border-gray-200',
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-600',
    borderColor: 'border-gray-200',
    devices: 1,
  },
  vip: {
    label: 'VIP',
    shortLabel: 'VIP',
    badgeColor: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    bgColor: 'bg-indigo-50',
    textColor: 'text-indigo-700',
    borderColor: 'border-indigo-200',
    devices: 2,
  },
  premium: {
    label: 'Pre',
    shortLabel: 'Pre',
    badgeColor: 'bg-amber-100 text-amber-700 border-amber-200',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
    devices: 3,
  },
};

// ─── Check active VIP ─────────────────────────────────────────────────────────
export function isVipActive(user: User | null | undefined): boolean {
  if (!user) return false;
  const isVip = user.is_vip === true;
  const hasTier = user.subscription_tier === 'vip' || user.subscription_tier === 'premium';
  const notExpired = !user.vip_expires_at || new Date(user.vip_expires_at) > new Date();
  return (isVip || hasTier) && notExpired;
}

function normalizeSubjectCode(subjectCode?: string | null): string {
  return String(subjectCode || '').trim().toUpperCase();
}

function getAllowedSubjects(user: User | null | undefined): string[] {
  if (!isVipActive(user)) return [];
  if (user?.subscription_tier === 'premium') return ['*'];
  const subjects = Array.isArray(user?.vip_allowed_subjects)
    ? user.vip_allowed_subjects.map(normalizeSubjectCode).filter(Boolean)
    : [];
  return subjects.length > 0 ? Array.from(new Set(subjects)) : ['*'];
}

export function canAccessSubject(user: User | null | undefined, subjectCode?: string | null): boolean {
  const subjects = getAllowedSubjects(user);
  if (!subjectCode) return subjects.length > 0;
  const normalized = normalizeSubjectCode(subjectCode);
  return subjects.includes('*') || subjects.includes(normalized);
}

// ─── Check Premium access (AI + Video + Chat) ─────────────────────────────────────
export function isPremiumActive(user: User | null | undefined): boolean {
  if (!user) return false;
  const isPremium = user.subscription_tier === 'premium';
  const notExpired = !user.vip_expires_at || new Date(user.vip_expires_at) > new Date();
  return isPremium && notExpired;
}

// ─── Can use AI features (Premium or VIP) ──────────────────────────────────
export function canUseAI(user: User | null | undefined): boolean {
  if (!user) return false;
  return isPremiumActive(user) || isVipActive(user);
}

// ─── Can watch video explanations (Premium only) ─────────────────────────────────
export function canWatchVideo(user: User | null | undefined): boolean {
  return isPremiumActive(user);
}

// ─── Can chat with instructor (Premium only) ────────────────────────────────────
export function canChatInstructor(user: User | null | undefined): boolean {
  return isPremiumActive(user);
}

// ─── Get user tier level ──────────────────────────────────────────────────────
export function getTierLevel(user: User | null | undefined): TierLevel {
  if (!user) return 'basic';
  const isActive = isVipActive(user);
  if (!isActive) return 'basic';
  return user.subscription_tier === 'premium' ? 'premium'
       : user.subscription_tier === 'vip' ? 'vip'
       : user.is_vip ? 'vip' : 'basic';
}

// ─── Check if user can access content at given tier ──────────────────────────
export function canAccessContent(user: User | null | undefined, contentTier: TierLevel, subjectCode?: string | null): boolean {
  const userTier = getTierLevel(user);
  const tierOrder: TierLevel[] = ['basic', 'vip', 'premium'];
  if (tierOrder.indexOf(userTier) < tierOrder.indexOf(contentTier)) return false;
  if (contentTier === 'basic') return true;
  return canAccessSubject(user, subjectCode);
}

// ─── Display helpers ─────────────────────────────────────────────────────────
export function getVipDisplay(user: User | null | undefined): {
  isVip: boolean;
  tier: TierLevel;
  expiresAt: string | null;
  daysLeft: number | null;
} {
  if (!user || !isVipActive(user)) {
    return { isVip: false, tier: 'basic', expiresAt: null, daysLeft: null };
  }
  const tier = getTierLevel(user);
  const expiresAt = user.vip_expires_at || null;
  let daysLeft: number | null = null;
  if (expiresAt) {
    const diff = new Date(expiresAt).getTime() - Date.now();
    daysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }
  return { isVip: true, tier, expiresAt, daysLeft };
}

// ─── RBAC ────────────────────────────────────────────────────────────────────
export function getTierBadge(tier: TierLevel): { label: string; color: string } {
  const meta = TIER_META[tier];
  return { label: meta.label, color: meta.textColor };
}

const ADMIN_PANEL_PERMISSION_PRIORITY: Array<{ permission: string; route: string }> = [
  { permission: 'users.manage', route: '/admin/users' },
  { permission: 'game.manage', route: '/admin/gamification' },
  { permission: 'exams.manage', route: '/admin/exams' },
  { permission: 'content.manage', route: '/admin/materials' },
  { permission: 'courses.manage_assigned', route: '/admin/courses' },
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
  { role: 'course_teacher', route: '/admin/courses' },
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
  if (user?.role === 'admin' && (!user?.roles || user.roles.length === 0)) {
    if (typeof window !== 'undefined') {
      console.warn('[RBAC] Legacy admin session detected — missing RBAC roles. Please re-login.');
    }
    set.add('*');
  }
  if (hasAnyAdminRole(user)) {
    set.add('admin.dashboard.view');
  }
  return set;
}

export function hasPermission(user: User | null | undefined, permission: string): boolean {
  if (!user || !permission) return false;
  if (getRoleSet(user).has('super_admin')) return true;
  const permissions = getPermissionSet(user);
  return permissions.has('*') || permissions.has(permission);
}

export function hasAnyPermission(user: User | null | undefined, permissionCodes: string[]): boolean {
  if (!user || !Array.isArray(permissionCodes) || permissionCodes.length === 0) return false;
  if (getRoleSet(user).has('super_admin')) return true;
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
  if (roleSet.has('super_admin')) return '/admin';
  if (user.role === 'admin' && roleSet.size === 0) return '/admin';
  for (const item of ADMIN_PANEL_PERMISSION_PRIORITY) {
    if (hasPermission(user, item.permission)) return item.route;
  }
  for (const item of ADMIN_ROLE_ROUTE_PRIORITY) {
    if (roleSet.has(item.role)) return item.route;
  }
  return '/';
}
