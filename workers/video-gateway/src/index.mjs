import { allowedOrigin, verifyPlaybackToken } from "./security.mjs";
import { normalizeHlsPath, rewritePlaylist } from "./playlist.mjs";

const EXPOSE_HEADERS = "Content-Length, Content-Range, Accept-Ranges, ETag";
const MAX_PLAYLIST_BYTES = 1024 * 1024;

function corsHeaders(origin) {
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Range, Content-Type",
    "Access-Control-Expose-Headers": EXPOSE_HEADERS,
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function response(status, message, origin = null, extraHeaders = {}) {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(origin),
      ...extraHeaders,
    },
  });
}

function contentType(path) {
  if (path.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  if (path.endsWith(".ts")) return "video/mp2t";
  if (path.endsWith(".m4s")) return "video/iso.segment";
  if (path.endsWith(".mp4")) return "video/mp4";
  if (path.endsWith(".aac")) return "audio/aac";
  return "application/octet-stream";
}

function objectHeaders(object, path, origin, ranged = false) {
  const headers = new Headers(corsHeaders(origin));
  object.writeHttpMetadata?.(headers);
  headers.set("Content-Type", contentType(path));
  headers.set("Accept-Ranges", "bytes");
  if (object.etag) headers.set("ETag", object.httpEtag || object.etag);
  if (object.range && Number.isInteger(object.range.offset) && Number.isInteger(object.range.length)) {
    const end = object.range.offset + object.range.length - 1;
    headers.set("Content-Range", `bytes ${object.range.offset}-${end}/${object.size}`);
    headers.set("Content-Length", String(object.range.length));
  } else if (Number.isInteger(object.size)) {
    headers.set("Content-Length", String(object.size));
  }
  headers.set("Cache-Control", path.endsWith(".m3u8") ? "private, no-store" : "private, max-age=86400, immutable");
  if (ranged) headers.set("Vary", [headers.get("Vary"), "Range"].filter(Boolean).join(", "));
  return headers;
}

async function handle(request, env) {
  const origin = allowedOrigin(request, env);
  if (origin === false) return response(403, "Origin not allowed");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== "GET" && request.method !== "HEAD") {
    return response(405, "Method not allowed", origin, { Allow: "GET, HEAD, OPTIONS" });
  }
  if (!env.VIDEO_BUCKET || typeof env.VIDEO_BUCKET.get !== "function") return response(503, "Gateway unavailable", origin);

  const url = new URL(request.url);
  let relativePath;
  try {
    relativePath = normalizeHlsPath(url.pathname);
  } catch {
    return response(404, "Not found", origin);
  }

  const token = url.searchParams.get("token");
  let claims;
  try {
    claims = await verifyPlaybackToken(token, env);
  } catch (error) {
    const unavailable = error?.message === "GATEWAY_CONFIG_MISSING";
    return response(unavailable ? 503 : 401, unavailable ? "Gateway unavailable" : "Unauthorized", origin);
  }

  // The R2 key is derived solely from the signed prefix plus a normalized path.
  const objectKey = `${claims.assetPrefix}${relativePath}`;
  try {
    if (request.method === "HEAD") {
      const object = await env.VIDEO_BUCKET.head(objectKey);
      if (!object) return response(404, "Not found", origin);
      return new Response(null, { status: 200, headers: objectHeaders(object, relativePath, origin) });
    }

    const range = request.headers.has("Range") ? request.headers : undefined;
    const object = await env.VIDEO_BUCKET.get(objectKey, range ? { range } : undefined);
    if (!object) return response(404, "Not found", origin);
    if (relativePath.endsWith(".m3u8")) {
      if (!Number.isInteger(object.size) || object.size < 1 || object.size > MAX_PLAYLIST_BYTES) {
        return response(500, "Gateway error", origin);
      }
      const rewritten = rewritePlaylist(await object.text(), relativePath, token);
      const headers = objectHeaders(object, relativePath, origin);
      headers.delete("Content-Length");
      return new Response(rewritten, { status: 200, headers });
    }
    const ranged = Boolean(object.range);
    return new Response(object.body, { status: ranged ? 206 : 200, headers: objectHeaders(object, relativePath, origin, ranged) });
  } catch {
    // Never include the object key, query string, or token in logs/errors.
    return response(500, "Gateway error", origin);
  }
}

export { handle };
export default { fetch: handle };
