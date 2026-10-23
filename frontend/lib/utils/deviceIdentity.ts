const DEVICE_ID_KEY = 'moly-device-id';

export function getDeviceIdentity(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    let value = localStorage.getItem(DEVICE_ID_KEY);
    if (!value) {
      value = typeof crypto?.randomUUID === 'function'
        ? crypto.randomUUID().replace(/-/g, '')
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(DEVICE_ID_KEY, value);
    }
    return value;
  } catch {
    return null;
  }
}
