const assert = require("node:assert/strict");
const test = require("node:test");
const { parseMasterPlaylist, parseVariantPlaylist } = require("../src/utils/hlsManifest");
const { createR2VideoStorageAdapter } = require("../src/services/videoStorageAdapter");
const { createCourseMediaService } = require("../src/services/courseMediaService");

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

test("deletes every object under only the requested video asset prefix", async () => {
  const calls = [];
  const client = {
    async send(command) {
      calls.push({ name: command.constructor.name, input: command.input });
      if (command.constructor.name === "ListObjectsV2Command") {
        if (!command.input.ContinuationToken) {
          return {
            Contents: [
              { Key: "private/courses/1/lessons/2/asset/source/video.mp4" },
              { Key: "private/courses/1/lessons/2/asset/hls/master.m3u8" },
            ],
            IsTruncated: true,
            NextContinuationToken: "page-2",
          };
        }
        return {
          Contents: [{ Key: "private/courses/1/lessons/2/asset/hls/v0/segment.ts" }],
          IsTruncated: false,
        };
      }
      if (command.constructor.name === "DeleteObjectsCommand") return {};
      throw new Error(`Unexpected command: ${command.constructor.name}`);
    },
  };
  const storage = createR2VideoStorageAdapter({
    config: {
      endpoint: "https://account.r2.cloudflarestorage.com",
      accessKeyId: "access-key",
      secretAccessKey: "secret-key",
      bucket: "video-bucket",
      uploadTtlSeconds: 900,
    },
    client,
  });

  const result = await storage.deletePrefix({
    prefix: "private/courses/1/lessons/2/asset/",
  });

  assert.equal(result.deletedObjectCount, 3);
  assert.deepEqual(calls.map((call) => call.name), [
    "ListObjectsV2Command",
    "DeleteObjectsCommand",
    "ListObjectsV2Command",
    "DeleteObjectsCommand",
  ]);
  assert.equal(calls[0].input.Prefix, "private/courses/1/lessons/2/asset/");
});

test("deletes R2 objects before detaching and soft-deleting a video asset", async () => {
  const events = [];
  const service = createCourseMediaService({
    storage: {
      async deletePrefix({ prefix }) {
        events.push(["storage", prefix]);
        return { deletedObjectCount: 7 };
      },
    },
    repository: {
      async findAssetForDelete(assetId) {
        assert.equal(assetId, 12);
        return {
          id: 12,
          external_key: "asset-key",
          course_id: 3,
          lesson_id: 4,
          status: "ready",
          deleted_at: null,
        };
      },
      async markAssetDeleted(assetId) {
        events.push(["database", assetId]);
        return {
          assetId,
          courseId: 3,
          lessonId: 4,
          detached: true,
          alreadyDeleted: false,
        };
      },
    },
  });

  const result = await service.deleteVideoAsset(12, { id: 9 });

  assert.deepEqual(events, [
    ["storage", "private/courses/3/lessons/4/asset-key/"],
    ["database", 12],
  ]);
  assert.equal(result.status, "deleted");
  assert.equal(result.deletedObjectCount, 7);
  assert.equal(result.detached, true);
});
