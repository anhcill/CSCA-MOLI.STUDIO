const encoder = new TextEncoder();

export function base64UrlDecode(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error("INVALID_BASE64URL");
  }
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJsonPart(value) {
  const decoded = new TextDecoder("utf-8", { fatal: true }).decode(base64UrlDecode(value));
  return JSON.parse(decoded);
}

function stringClaim(payload, key) {
  if (typeof payload[key] !== "string" || !payload[key]) throw new Error(`INVALID_${key.toUpperCase()}`);
  return payload[key];
}

export function validateAssetPrefix(value) {
  const prefix = String(value || "");
  if (!/^private\/courses\/[A-Za-z0-9_-]+\/lessons\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/hls\/$/.test(prefix)) {
    throw new Error("INVALID_ASSET_PREFIX");
  }
  return prefix;
}

export async function verifyPlaybackToken(token, env, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (typeof token !== "string" || token.length < 16 || token.length > 4096) throw new Error("INVALID_TOKEN");
  if (typeof env.VIDEO_PLAYBACK_TOKEN_SECRET !== "string" || env.VIDEO_PLAYBACK_TOKEN_SECRET.length < 32) {
    throw new Error("GATEWAY_CONFIG_MISSING");
  }

  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("INVALID_TOKEN");
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJsonPart(encodedHeader);
  const payload = decodeJsonPart(encodedPayload);
  if (header.alg !== "HS256" || header.typ !== "JWT") throw new Error("INVALID_ALGORITHM");

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(env.VIDEO_PLAYBACK_TOKEN_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlDecode(encodedSignature),
    encoder.encode(`${encodedHeader}.${encodedPayload}`)
  );
  if (!valid) throw new Error("INVALID_SIGNATURE");

  const issuer = String(env.VIDEO_PLAYBACK_TOKEN_ISSUER || "csca-api");
  const audience = String(env.VIDEO_PLAYBACK_TOKEN_AUDIENCE || "csca-video-gateway");
  if (payload.iss !== issuer || payload.aud !== audience) throw new Error("INVALID_TOKEN_CONTEXT");
  if (payload.scope !== "video:read") throw new Error("INVALID_SCOPE");
  if (!Number.isInteger(payload.exp) || payload.exp <= nowSeconds) throw new Error("TOKEN_EXPIRED");
  if (payload.nbf !== undefined && (!Number.isInteger(payload.nbf) || payload.nbf > nowSeconds + 30)) {
    throw new Error("TOKEN_NOT_ACTIVE");
  }

  stringClaim(payload, "sub");
  stringClaim(payload, "lessonId");
  stringClaim(payload, "videoAssetId");
  stringClaim(payload, "jti");
  payload.assetPrefix = validateAssetPrefix(payload.assetPrefix);
  return payload;
}

export function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  const allowlist = String(env.VIDEO_ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return allowlist.includes(origin) ? origin : false;
}
