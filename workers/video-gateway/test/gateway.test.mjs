import assert from "node:assert/strict";
import test from "node:test";
import { createHmac, webcrypto } from "node:crypto";
import { normalizeHlsPath, rewritePlaylist } from "../src/playlist.mjs";
import { verifyPlaybackToken } from "../src/security.mjs";
import { handle } from "../src/index.mjs";

globalThis.crypto ??= webcrypto;
globalThis.atob ??= (value) => Buffer.from(value, "base64").toString("binary");
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const secret = "day-2-test-secret-that-is-at-least-32-bytes";

function token(payload) {
  const input = `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}`;
  return `${input}.${createHmac("sha256", secret).update(input).digest("base64url")}`;
}

test("verifies the Railway HS256 claim shape", async () => {
  const value = token({ iss: "csca-api", aud: "csca-video-gateway", exp: 2000, scope: "video:read", sub: "7", lessonId: "9", videoAssetId: "11", jti: "abc", assetPrefix: "private/courses/1/lessons/9/key/hls/" });
  const claims = await verifyPlaybackToken(value, { VIDEO_PLAYBACK_TOKEN_SECRET: secret }, 1000);
  assert.equal(claims.lessonId, "9");
});

test("fails closed for an expired token", async () => {
  const value = token({ iss: "csca-api", aud: "csca-video-gateway", exp: 999, scope: "video:read", sub: "7", lessonId: "9", videoAssetId: "11", jti: "abc", assetPrefix: "private/courses/1/lessons/9/key/hls/" });
  await assert.rejects(() => verifyPlaybackToken(value, { VIDEO_PLAYBACK_TOKEN_SECRET: secret }, 1000), /TOKEN_EXPIRED/);
});

test("normalizes allowed paths and rejects traversal", () => {
  assert.equal(normalizeHlsPath("/hls/v0/index.m3u8"), "v0/index.m3u8");
  assert.throws(() => normalizeHlsPath("/hls/../secret.m3u8"));
  assert.throws(() => normalizeHlsPath("/hls/v0%2Findex.m3u8"));
});

test("rewrites playlist child URIs with token propagation", () => {
  const output = rewritePlaylist("#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\nv0/index.m3u8\n", "master.m3u8", "a.b.c");
  assert.match(output, /\/hls\/v0\/index\.m3u8\?token=a.b.c/);
});

test("gateway rejects an unapproved browser origin before touching R2", async () => {
  let storageCalled = false;
  const response = await handle(new Request("https://video.example/hls/master.m3u8", {
    headers: { Origin: "https://evil.example" },
  }), {
    VIDEO_ALLOWED_ORIGINS: "https://molystudio.online",
    VIDEO_BUCKET: { get: async () => { storageCalled = true; } },
  });
  assert.equal(response.status, 403);
  assert.equal(storageCalled, false);
});

test("gateway answers an approved CORS preflight without storage access", async () => {
  const response = await handle(new Request("https://video.example/hls/master.m3u8", {
    method: "OPTIONS",
    headers: { Origin: "https://molystudio.online" },
  }), {
    VIDEO_ALLOWED_ORIGINS: "https://molystudio.online",
  });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://molystudio.online");
});

test("gateway rejects a request without a playback token", async () => {
  const response = await handle(new Request("https://video.example/hls/master.m3u8"), {
    VIDEO_PLAYBACK_TOKEN_SECRET: secret,
    VIDEO_BUCKET: { get: async () => null },
  });
  assert.equal(response.status, 401);
});
