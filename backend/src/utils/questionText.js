const TRAILING_EMPTY_ANSWER_MARKER_RE = /(\s*)(?:\(\s*\)|（\s*）)\s*([。.!！？?]?)\s*$/u;

function removeTrailingEmptyAnswerMarker(value) {
  if (typeof value !== "string") return value;

  const match = value.match(TRAILING_EMPTY_ANSWER_MARKER_RE);
  if (!match || match.index === undefined) return value;

  const prefix = value.slice(0, match.index);
  const hasSeparator = match[1].length > 0;
  const previousCharacter = prefix.at(-1) || "";

  // Preserve function-call notation such as f() while removing answer placeholders.
  if (!hasSeparator && /[A-Za-z0-9_\]})）]/u.test(previousCharacter)) return value;

  const normalized = `${prefix.trimEnd()}${match[2]}`.trim();
  return normalized || value;
}

module.exports = { removeTrailingEmptyAnswerMarker };
