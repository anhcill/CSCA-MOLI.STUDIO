const PREVIOUS_SESSION_KEY = 'previous-session-token';

// Retain signed session identity across automatic logout. The server only uses
// it to replace this browser's own active slot after login OTP succeeds.
export function rememberPreviousSession(token: string | null) {
  if (!token || typeof window === 'undefined') return;
  try {
    localStorage.setItem(PREVIOUS_SESSION_KEY, token);
  } catch {
    // Login still works when browser storage is unavailable.
  }
}

export function getPreviousSessionToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem('token') || localStorage.getItem(PREVIOUS_SESSION_KEY);
  } catch {
    return null;
  }
}
