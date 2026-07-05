export interface VipCelebrationPayload {
  packageName?: string;
  vipExpiresAt?: string;
  amount?: number;
  orderId?: string;
}

const VIP_CELEBRATION_STORAGE_KEY = 'moly.vipPaymentCelebration.v1';

export const VIP_CELEBRATION_HOME_URL = '/?vip_success=1';

export function queueVipCelebration(payload: VipCelebrationPayload = {}) {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.setItem(
      VIP_CELEBRATION_STORAGE_KEY,
      JSON.stringify({ ...payload, queuedAt: Date.now() })
    );
  } catch (_) {}
}

export function consumeVipCelebration(): VipCelebrationPayload | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const hasUrlFlag = params.get('vip_success') === '1';
  let payload: VipCelebrationPayload | null = null;

  try {
    const raw = sessionStorage.getItem(VIP_CELEBRATION_STORAGE_KEY);
    if (raw) payload = JSON.parse(raw);
    sessionStorage.removeItem(VIP_CELEBRATION_STORAGE_KEY);
  } catch (_) {}

  if (!hasUrlFlag && !payload) return null;
  return payload || {};
}

export function clearVipCelebrationUrlFlag() {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  if (!url.searchParams.has('vip_success')) return;

  url.searchParams.delete('vip_success');
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, '', nextUrl || '/');
}
