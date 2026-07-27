const assert = require("node:assert/strict");
const test = require("node:test");
const { parseMasterPlaylist, parseVariantPlaylist } = require("../src/utils/hlsManifest");
const { createR2VideoStorageAdapter } = require("../src/services/videoStorageAdapter");

test("parses supported master and VOD variant manifests", () => {
  const master = parseMasterPlaylist(`#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360,CODECS="avc1.4d401e,mp4a.40.2"
v0/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1280x720
v1/index.m3u8
`);
  assert.deepEqual(master.map((variant) => variant.resolution), ["360p", "720p"]);
  assert.equal(master[0].videoCodec, "h264");
  assert.equal(master[0].audioCodec, "aac");

  const variant = parseVariantPlaylist(`#EXTM3U
#EXT-X-TARGETDURATION:6
#EXTINF:5.5,
segment_000000.ts
#EXTINF:4,
segment_000001.ts
#EXT-X-ENDLIST
`, "v0/index.m3u8");
  assert.equal(variant.segmentCount, 2);
  assert.equal(variant.durationSeconds, 9.5);
});

test("rejects traversal, encryption, duplicate resolutions and unfinished VOD", () => {
  assert.throws(() => parseMasterPlaylist(`#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360
../index.m3u8
`), { code: "VIDEO_HLS_VARIANT_URI_INVALID" });
  assert.throws(() => parseMasterPlaylist(`#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360
v0/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=900000,RESOLUTION=640x360
v1/index.m3u8
`), { code: "VIDEO_HLS_MANIFEST_INVALID" });
  assert.throws(() => parseVariantPlaylist(`#EXTM3U
#EXT-X-KEY:METHOD=AES-128,URI="key"
#EXT-X-TARGETDURATION:6
#EXTINF:6,
segment_000000.ts
#EXT-X-ENDLIST
`, "v0/index.m3u8"), { code: "VIDEO_HLS_ENCRYPTION_UNSUPPORTED" });
  assert.throws(() => parseVariantPlaylist(`#EXTM3U
#EXT-X-TARGETDURATION:6
#EXTINF:6,
segment_000000.ts
`, "v0/index.m3u8"), { code: "VIDEO_HLS_MANIFEST_INVALID" });
});

test("signs source checksum metadata as an unhoistable R2 header", async () => {
  let signerOptions;
  const storage = createR2VideoStorageAdapter({
    config: {
      endpoint: "https://account.r2.cloudflarestorage.com",
      accessKeyId: "access-key",
      secretAccessKey: "secret-key",
      bucket: "video-bucket",
      uploadTtlSeconds: 900,
    },
    client: {},
    signer: async (_client, _command, options) => {
      signerOptions = options;
      return "https://signed-upload.example";
    },
  });

  const result = await storage.createUploadUrl({
    objectKey: "private/source/video.mp4",
    contentType: "video/mp4",
    sizeBytes: 2,
    checksumSha256: "a".repeat(64),
  });

  assert.equal(signerOptions.expiresIn, 900);
  assert.equal(signerOptions.unhoistableHeaders.has("x-amz-meta-sha256"), true);
  assert.equal(result.requiredHeaders["x-amz-meta-sha256"], "a".repeat(64));
});
