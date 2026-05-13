export const CANONICAL_SITE_URL = 'https://www.molystudio.online';

export function getCanonicalSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '');

  if (!configured) return CANONICAL_SITE_URL;

  try {
    const url = new URL(configured);
    const host = url.hostname.toLowerCase();

    if (host.endsWith('.vercel.app') || host === 'moly-studio.io.vn') {
      return CANONICAL_SITE_URL;
    }

    return url.origin;
  } catch {
    return CANONICAL_SITE_URL;
  }
}
