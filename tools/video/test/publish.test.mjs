import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  argumentMap, orderUploadFiles, uploadAll, validateHlsDirectory,
} from "../Publish-CscaHls.mjs";

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "csca-hls-"));
  await mkdir(join(root, "v0"));
  await writeFile(join(root, "master.m3u8"), `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360
v0/index.m3u8
`);
  await writeFile(join(root, "v0", "index.m3u8"), `#EXTM3U
#EXT-X-TARGETDURATION:6
#EXTINF:6,
segment_000000.ts
#EXT-X-ENDLIST
`);
  await writeFile(join(root, "v0", "segment_000000.ts"), "segment");
  return root;
}

function filesFor(root) {
  return [
    { absolute: join(root, "master.m3u8"), relative: "master.m3u8" },
    { absolute: join(root, "v0", "index.m3u8"), relative: "v0/index.m3u8" },
    { absolute: join(root, "v0", "segment_000000.ts"), relative: "v0/segment_000000.ts" },
  ];
}

test("parses boolean arguments and orders master manifest last", () => {
  const args = argumentMap(["--directory", "out", "--resume", "--dry-run"]);
  assert.equal(args.get("resume"), true);
  assert.equal(args.get("dry-run"), true);
  const ordered = orderUploadFiles(filesFor("C:/fixture"));
  assert.deepEqual(ordered.map((file) => file.relative), [
    "v0/segment_000000.ts", "v0/index.m3u8", "master.m3u8",
  ]);
});

test("validates referenced playlists and segments locally", async (context) => {
  const root = await fixture();
  context.after(() => rm(root, { recursive: true, force: true }));
  assert.deepEqual(await validateHlsDirectory(filesFor(root)), { variants: 1, segments: 1 });
});

test("uses upload barriers so master is committed after segments and variants", async (context) => {
  const root = await fixture();
  context.after(() => rm(root, { recursive: true, force: true }));
  const events = [];
  const client = {
    async send(command) {
      const key = command.input.Key;
      events.push(`start:${key}`);
      if (key.endsWith(".ts")) await new Promise((resolve) => setTimeout(resolve, 20));
      events.push(`done:${key}`);
      assert.match(command.input.Metadata.sha256, /^[a-f0-9]{64}$/);
      return {};
    },
  };
  const result = await uploadAll({
    client, bucket: "bucket", prefix: "prefix/", files: filesFor(root), concurrency: 3,
  });
  assert.deepEqual(result, { uploaded: 3, skipped: 0, total: 3 });
  assert.ok(events.indexOf("start:prefix/v0/index.m3u8") > events.indexOf("done:prefix/v0/segment_000000.ts"));
  assert.ok(events.indexOf("start:prefix/master.m3u8") > events.indexOf("done:prefix/v0/index.m3u8"));
});

test("resume skips an object only when size and SHA-256 metadata match", async (context) => {
  const root = await fixture();
  context.after(() => rm(root, { recursive: true, force: true }));
  const masterOnly = [{ absolute: join(root, "master.m3u8"), relative: "master.m3u8" }];
  const masterBody = await readFile(masterOnly[0].absolute);
  const checksum = createHash("sha256").update(masterBody).digest("hex");
  let puts = 0;
  let matching = true;
  const client = {
    async send(command) {
      if (command.constructor.name === "HeadObjectCommand") {
        return {
          ContentLength: masterBody.length,
          Metadata: { sha256: matching ? checksum : "different-checksum" },
        };
      }
      puts += 1;
      return {};
    },
  };
  const result = await uploadAll({
    client, bucket: "bucket", prefix: "prefix/", files: masterOnly, concurrency: 1, resume: true,
  });
  assert.equal(puts, 0);
  assert.deepEqual(result, { uploaded: 0, skipped: 1, total: 1 });

  matching = false;
  const changedResult = await uploadAll({
    client, bucket: "bucket", prefix: "prefix/", files: masterOnly, concurrency: 1, resume: true,
  });
  assert.equal(puts, 1);
  assert.deepEqual(changedResult, { uploaded: 1, skipped: 0, total: 1 });
});
