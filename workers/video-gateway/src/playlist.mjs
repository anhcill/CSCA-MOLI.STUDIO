function assertRelativeHlsUri(value) {
  const uri = String(value || "").trim();
  if (!uri || uri.length > 1024 || uri.includes("\\") || /%(?:2f|5c)/i.test(uri)) throw new Error("INVALID_HLS_URI");
  if (/^[a-z][a-z0-9+.-]*:/i.test(uri) || uri.startsWith("//") || uri.startsWith("/")) {
    throw new Error("EXTERNAL_HLS_URI");
  }
  return uri;
}

export function normalizeHlsPath(rawPathname) {
  if (!rawPathname.startsWith("/hls/") || /%(?:2f|5c)/i.test(rawPathname) || rawPathname.includes("\\")) {
    throw new Error("INVALID_HLS_PATH");
  }
  let relative;
  try {
    relative = decodeURIComponent(rawPathname.slice(5));
  } catch {
    throw new Error("INVALID_HLS_PATH");
  }
  if (!relative || relative.length > 1024 || relative.startsWith("/") || relative.includes("\\")) {
    throw new Error("INVALID_HLS_PATH");
  }
  const parts = relative.split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || !/^[A-Za-z0-9._-]+$/.test(part))) {
    throw new Error("INVALID_HLS_PATH");
  }
  if (!/\.(?:m3u8|ts|m4s|mp4|aac)$/i.test(relative)) throw new Error("INVALID_HLS_EXTENSION");
  return relative;
}

function resolvePlaylistUri(playlistPath, input) {
  const uri = assertRelativeHlsUri(input);
  const [pathPart] = uri.split(/[?#]/, 1);
  let decoded;
  try {
    decoded = decodeURIComponent(pathPart);
  } catch {
    throw new Error("INVALID_HLS_URI");
  }
  const baseParts = playlistPath.split("/");
  baseParts.pop();
  for (const part of decoded.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!baseParts.length) throw new Error("INVALID_HLS_URI");
      baseParts.pop();
    } else if (!/^[A-Za-z0-9._-]+$/.test(part)) {
      throw new Error("INVALID_HLS_URI");
    } else {
      baseParts.push(part);
    }
  }
  const resolved = baseParts.join("/");
  return normalizeHlsPath(`/hls/${resolved}`);
}

function gatewayUri(playlistPath, childUri, token) {
  const path = resolvePlaylistUri(playlistPath, childUri);
  return `/hls/${path}?token=${encodeURIComponent(token)}`;
}

export function rewritePlaylist(content, playlistPath, token) {
  if (typeof content !== "string" || !content.startsWith("#EXTM3U")) throw new Error("INVALID_PLAYLIST");
  return content
    .split(/\r?\n/)
    .map((line) => {
      if (!line) return line;
      if (!line.startsWith("#")) return gatewayUri(playlistPath, line, token);
      return line.replace(/URI="([^"]+)"/g, (_match, uri) => `URI="${gatewayUri(playlistPath, uri, token)}"`);
    })
    .join("\n");
}
