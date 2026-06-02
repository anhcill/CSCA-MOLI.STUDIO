const GOOGLE_WEB_CLIENT_ID_PATTERN =
  /^\d+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/;

export function getGoogleOAuthClientId() {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || '';
}

export function isGoogleOAuthConfigured(clientId = getGoogleOAuthClientId()) {
  return GOOGLE_WEB_CLIENT_ID_PATTERN.test(clientId);
}
