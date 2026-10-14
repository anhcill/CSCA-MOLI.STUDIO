const crypto = require('crypto');
const { CourseApiError } = require('../utils/courseResponses');

const API_ORIGIN = 'https://video.bunnycdn.com';
const TUS_ENDPOINT = 'https://video.bunnycdn.com/tusupload';

function videoId(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)) {
    throw new CourseApiError(422, 'BUNNY_INVALID_VIDEO_ID', 'Expected a Bunny video GUID.');
  }
  return value;
}

function createBunnyStreamAdapter({ libraryId, apiKey, tokenKey, webhookSigningKey, fetchImpl = fetch,
  now = () => Date.now(), timeoutMs = 15000 } = {}) {
  function requireLibrary() {
    if (!/^[1-9]\d*$/.test(String(libraryId)) || !Number.isSafeInteger(Number(libraryId))) {
      throw new CourseApiError(503, 'BUNNY_NOT_CONFIGURED', 'Bunny Stream library is not configured.');
    }
    return String(libraryId);
  }
  function requireSecret(value) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new CourseApiError(503, 'BUNNY_NOT_CONFIGURED', 'Required Bunny Stream credentials are not configured.');
    }
    return value;
  }
  function expires(ttlSeconds) {
    if (!Number.isInteger(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > 86400) {
      throw new CourseApiError(422, 'BUNNY_INVALID_TTL', 'TTL must be between 60 and 86400 seconds.');
    }
    return Math.floor(now() / 1000) + ttlSeconds;
  }
  async function request(path, { method = 'GET', body } = {}) {
    const library = requireLibrary();
    const key = requireSecret(apiKey);
    let response;
    try {
      response = await fetchImpl(`${API_ORIGIN}/library/${library}/videos${path}`, {
        method, headers: { AccessKey: key, Accept: 'application/json', 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs), redirect: 'error',
      });
    } catch (_) {
      throw new CourseApiError(502, 'BUNNY_REQUEST_FAILED', 'Bunny Stream request could not be completed.');
    }
    if (!response.ok) {
      throw new CourseApiError(502, 'BUNNY_REQUEST_FAILED', 'Bunny Stream returned an unsuccessful response.', { providerStatus: response.status });
    }
    let value;
    try { value = await response.json(); }
    catch (_) { throw new CourseApiError(502, 'BUNNY_INVALID_RESPONSE', 'Bunny Stream returned invalid JSON.'); }
    if (!value || typeof value !== 'object' || Array.isArray(value)
      || String(value.videoLibraryId) !== library || typeof value.guid !== 'string'
      || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value.guid)) {
      throw new CourseApiError(502, 'BUNNY_INVALID_RESPONSE', 'Bunny Stream returned an unexpected video identity.');
    }
    return value;
  }

  async function createVideo(title) {
    if (typeof title !== 'string' || !title.trim() || title.length > 255) {
      throw new CourseApiError(422, 'BUNNY_INVALID_TITLE', 'Video title must contain 1-255 characters.');
    }
    return request('', { method: 'POST', body: { title: title.trim() } });
  }
  async function getVideo(id) {
    const guid = videoId(id);
    const value = await request(`/${guid}`);
    if (value.guid.toLowerCase() !== guid.toLowerCase()) {
      throw new CourseApiError(502, 'BUNNY_INVALID_RESPONSE', 'Bunny Stream returned a different video.');
    }
    return value;
  }
  function createTusAuthorization(id, ttlSeconds = 3600) {
    const guid = videoId(id), library = requireLibrary(), key = requireSecret(apiKey), expiration = expires(ttlSeconds);
    return {
      endpoint: TUS_ENDPOINT,
      headers: {
        AuthorizationSignature: crypto.createHash('sha256').update(library + key + expiration + guid).digest('hex'),
        AuthorizationExpire: String(expiration), LibraryId: library, VideoId: guid,
      },
      expiresAt: new Date(expiration * 1000).toISOString(),
    };
  }
  function createEmbedUrl(id, ttlSeconds = 300) {
    const guid = videoId(id), library = requireLibrary(), key = requireSecret(tokenKey), expiration = expires(ttlSeconds);
    const token = crypto.createHash('sha256').update(key + guid + expiration).digest('hex');
    const url = new URL(`https://player.mediadelivery.net/embed/${library}/${guid}`);
    url.searchParams.set('token', token);
    url.searchParams.set('expires', String(expiration));
    return { url: url.toString(), expiresAt: new Date(expiration * 1000).toISOString() };
  }
  function verifyWebhook(rawBody, headers = {}) {
    requireSecret(webhookSigningKey);
    const signature = headers['x-bunnystream-signature'];
    if (!Buffer.isBuffer(rawBody) || headers['x-bunnystream-signature-version'] !== 'v1'
      || headers['x-bunnystream-signature-algorithm'] !== 'hmac-sha256'
      || typeof signature !== 'string' || !/^[0-9a-f]{64}$/.test(signature)) return false;
    const expected = crypto.createHmac('sha256', webhookSigningKey).update(rawBody).digest();
    return crypto.timingSafeEqual(expected, Buffer.from(signature, 'hex'));
  }
  return { createVideo, getVideo, createTusAuthorization, createEmbedUrl, verifyWebhook };
}

function bunnyConfigFromEnv(env = process.env) {
  return { libraryId: env.BUNNY_STREAM_LIBRARY_ID, apiKey: env.BUNNY_STREAM_API_KEY,
    tokenKey: env.BUNNY_STREAM_TOKEN_KEY, webhookSigningKey: env.BUNNY_STREAM_WEBHOOK_SIGNING_KEY };
}

module.exports = { createBunnyStreamAdapter, bunnyConfigFromEnv };
