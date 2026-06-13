const PLAIN_TEXT_MATH_MARKER = '\u2063\u2063\u2063';

export function isPlainTextMathValue(value: string): boolean {
  return value.startsWith(PLAIN_TEXT_MATH_MARKER);
}

export function stripPlainTextMathMarker(value: string): string {
  return isPlainTextMathValue(value) ? value.slice(PLAIN_TEXT_MATH_MARKER.length) : value;
}

export function markPlainTextMathValue(value: string): string {
  const clean = stripPlainTextMathMarker(value);
  return clean ? `${PLAIN_TEXT_MATH_MARKER}${clean}` : '';
}

export function preservePlainTextMathMode(currentValue: string, nextValue: string): string {
  return isPlainTextMathValue(currentValue) ? markPlainTextMathValue(nextValue) : nextValue;
}
