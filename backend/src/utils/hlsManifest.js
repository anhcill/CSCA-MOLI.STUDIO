const RESOLUTION_NAMES = new Map([
  [360, "360p"],
  [480, "480p"],
  [720, "720p"],
  [1080, "1080p"],
]);

function manifestError(code = "VIDEO_HLS_MANIFEST_INVALID") {
  const error = new Error(code);
  error.code = code;
  return error;
}

function linesOf(text) {
  if (typeof text !== "string" || text.length === 0 || text.length > 1024 * 1024) {
    throw manifestError();
  }
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines[0] !== "#EXTM3U") throw manifestError();
  return lines;
}

function parseAttributes(value) {
  const attributes = {};
  const pattern = /(?:^|,)([A-Z0-9-]+)=("(?:[^"\\]|\\.)*"|[^,]*)/g;
  let match;
  while ((match = pattern.exec(value)) !== null) {
    const raw = match[2];
    attributes[match[1]] = raw.startsWith('"') ? raw.slice(1, -1) : raw;
  }
  return attributes;
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function safeVariantUri(value) {
  const uri = String(value || "");
  if (!/^v\d+\/index\.m3u8$/.test(uri)) throw manifestError("VIDEO_HLS_VARIANT_URI_INVALID");
  return uri;
}

function parseMasterPlaylist(text) {
  const lines = linesOf(text);
  const variants = [];
  const seen = new Set();
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.startsWith("#EXT-X-STREAM-INF:")) continue;
    const attributes = parseAttributes(line.slice("#EXT-X-STREAM-INF:".length));
    const resolutionMatch = String(attributes.RESOLUTION || "").match(/^(\d+)x(\d+)$/);
    const bandwidthBps = positiveNumber(attributes.BANDWIDTH);
    if (!resolutionMatch || !bandwidthBps) throw manifestError();
    const width = Number(resolutionMatch[1]);
    const height = Number(resolutionMatch[2]);
    const resolution = RESOLUTION_NAMES.get(height);
    if (!resolution || width <= 0 || width > 4096 || seen.has(resolution)) throw manifestError();
    let uri = null;
    for (let next = index + 1; next < lines.length; next += 1) {
      if (lines[next].startsWith("#EXT-X-STREAM-INF:")) throw manifestError();
      if (!lines[next].startsWith("#")) { uri = safeVariantUri(lines[next]); index = next; break; }
    }
    if (!uri) throw manifestError();
    const codecs = String(attributes.CODECS || "").toLowerCase();
    variants.push({
      resolution,
      width,
      height,
      bandwidthBps: Math.round(bandwidthBps),
      averageBandwidthBps: positiveNumber(attributes["AVERAGE-BANDWIDTH"]),
      frameRate: positiveNumber(attributes["FRAME-RATE"]),
      videoCodec: codecs.includes("avc1") ? "h264" : "unknown",
      audioCodec: codecs.includes("mp4a") ? "aac" : "none",
      playlistRelativePath: uri,
    });
    seen.add(resolution);
  }
  if (variants.length === 0 || variants.length > RESOLUTION_NAMES.size) throw manifestError();
  return variants.sort((a, b) => a.height - b.height);
}

function parseVariantPlaylist(text, playlistRelativePath) {
  const lines = linesOf(text);
  if (lines.some((line) => line.startsWith("#EXT-X-KEY"))) {
    throw manifestError("VIDEO_HLS_ENCRYPTION_UNSUPPORTED");
  }
  const directory = safeVariantUri(playlistRelativePath).split("/")[0];
  const segments = [];
  let pendingDuration = null;
  let targetDuration = null;
  let hasEndList = false;
  for (const line of lines) {
    if (line.startsWith("#EXT-X-TARGETDURATION:")) {
      targetDuration = positiveNumber(line.slice("#EXT-X-TARGETDURATION:".length));
    } else if (line.startsWith("#EXTINF:")) {
      pendingDuration = positiveNumber(line.slice("#EXTINF:".length).split(",", 1)[0]);
      if (!pendingDuration || pendingDuration > 30) throw manifestError();
    } else if (line === "#EXT-X-ENDLIST") {
      hasEndList = true;
    } else if (!line.startsWith("#")) {
      if (!pendingDuration || !/^segment_\d{6}\.ts$/.test(line)) throw manifestError();
      segments.push({ relativePath: `${directory}/${line}`, durationSeconds: pendingDuration });
      pendingDuration = null;
    }
  }
  if (!hasEndList || pendingDuration !== null || !targetDuration || targetDuration > 30 || segments.length === 0) {
    throw manifestError();
  }
  return {
    segments,
    segmentCount: segments.length,
    durationSeconds: segments.reduce((total, segment) => total + segment.durationSeconds, 0),
    targetDurationSeconds: targetDuration,
  };
}

module.exports = { parseMasterPlaylist, parseVariantPlaylist };
