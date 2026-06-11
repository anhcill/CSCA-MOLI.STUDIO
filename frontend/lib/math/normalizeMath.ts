import {
  OCR_MATH_SYMBOL_REPLACEMENTS,
  normalizeOcrMathSyntax,
  repairOcrMathArtifacts,
} from './ocrMathArtifacts';

const MATH_RANGES: Array<[number, number, number]> = [
  [0x1d400, 65, 26],
  [0x1d41a, 97, 26],
  [0x1d434, 65, 26],
  [0x1d44e, 97, 26],
  [0x1d468, 65, 26],
  [0x1d482, 97, 26],
  [0x1d5a0, 65, 26],
  [0x1d5ba, 97, 26],
  [0x1d7ce, 48, 10],
  [0x1d7d8, 48, 10],
];

const SYMBOL_REPLACEMENTS: Record<string, string> = {
  ['\u2212']: '-',
  ['\u2013']: '-',
  ['\u2014']: '-',
  ['\u2260']: '\\ne ',
  ['\u2264']: '\\le ',
  ['\u2265']: '\\ge ',
  ['\u00d7']: '\\times ',
  ['\u00f7']: '\\div ',
  ['\u00b7']: '\\cdot ',
  ['\u00b1']: '\\pm ',
  ['\u21d2']: '\\Rightarrow ',
  ['\u21d4']: '\\Leftrightarrow ',
  ['\u2192']: '\\to ',
  ['\u221a']: '\\sqrt{}',
  ['\u221e']: '\\infty ',
  ['\u2205']: '\\emptyset ',
  ['\u2208']: '\\in ',
  ['\u2209']: '\\notin ',
  ['\u211d']: '\\mathbb{R} ',
  ['\u2124']: '\\mathbb{Z} ',
  ['\u2115']: '\\mathbb{N} ',
  ['\u2216']: '\\setminus ',
  ['\u222a']: '\\cup ',
  ['\u2229']: '\\cap ',
  ['\u2248']: '\\approx ',
  ['\u00b0']: '^\\circ',
  ['\u03c0']: '\\pi ',
  ['\u03b8']: '\\theta ',
  ['\u03b1']: '\\alpha ',
  ['\u03b2']: '\\beta ',
  ['\u03b3']: '\\gamma ',
  ['\u03b4']: '\\delta ',
  ['\u03bc']: '\\mu ',
  ['\u03bb']: '\\lambda ',
  ['\ud6fc']: '\\alpha ',
  ['\uff08']: '(',
  ['\uff09']: ')',
};

const INLINE_MATH_COMMAND_RE =
  /\\(?:sin|cos|tan|cot|sec|csc|log|ln|lg|sqrt|lim|sum|int|vec|bar|hat|tilde|frac|binom|mathbb|rightleftharpoons|leftrightharpoons|left|right|infty|emptyset|in|notin|setminus|cup|cap|circ|pi|alpha|beta|gamma|delta|theta|lambda|mu|Delta|partial|pm|Rightarrow|Leftrightarrow|to|leq|geq|neq|le|ge|ne|approx)\b/;
const WRAPPED_MATH_RE = /(\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$|\$[^$\n]*\$)/g;
const LATEX_COMMAND_BOUNDARY_RE =
  /\\(sin|cos|tan|cot|sec|csc|log|ln|lg|sqrt|lim|sum|int|vec|bar|hat|tilde|frac|binom|mathbb|rightleftharpoons|leftrightharpoons|left|right|infty|emptyset|in|notin|setminus|cup|cap|circ|pi|alpha|beta|gamma|delta|theta|lambda|mu|Delta|partial|pm|Rightarrow|Leftrightarrow|to|leq|geq|neq|le|ge|ne|approx)(?=[A-Za-z])/g;
const MATH_WORD_RE =
  /^(?:sin|cos|tan|cot|sec|csc|log|ln|lg|lim|sum|int|alpha|beta|gamma|delta|theta|lambda|mu|pi)$/i;
const SIMPLE_INTERVAL_ENDPOINT_RE_SOURCE =
  String.raw`[+\-]?(?:\\infty|\u221e|\d+(?:[.,]\d+)?|[A-Za-z](?:_\{[^{}]+\})?)`;
const SIMPLE_INTERVAL_RE_SOURCE =
  String.raw`[\[(]\s*${SIMPLE_INTERVAL_ENDPOINT_RE_SOURCE}\s*,\s*${SIMPLE_INTERVAL_ENDPOINT_RE_SOURCE}\s*[\])]`;
const SIMPLE_INTERVAL_CHAIN_RE_SOURCE =
  String.raw`${SIMPLE_INTERVAL_RE_SOURCE}(?:\s*(?:\\cup|\\cap|\u222a|\u2229)\s*${SIMPLE_INTERVAL_RE_SOURCE})*`;
const ESCAPED_INTERVAL_ASSIGNMENT_RE = new RegExp(
  String.raw`\b([A-Za-z](?:_\{[^{}]+\})?)\s*=\s*\\\(\s*(${SIMPLE_INTERVAL_CHAIN_RE_SOURCE})\s*\\\)`,
  'g',
);
const INTERVAL_ASSIGNMENT_RE = new RegExp(
  String.raw`\b([A-Za-z](?:_\{[^{}]+\})?)\s*=\s*(${SIMPLE_INTERVAL_CHAIN_RE_SOURCE})`,
  'g',
);

function mapMathCodePoint(codePoint: number): string | null {
  for (const [start, asciiStart, length] of MATH_RANGES) {
    if (codePoint >= start && codePoint < start + length) {
      return String.fromCharCode(asciiStart + codePoint - start);
    }
  }

  return null;
}

export function normalizeMathUnicode(input: string): string {
  let out = '';

  for (const char of input) {
    const mapped = mapMathCodePoint(char.codePointAt(0) || 0);
    out += mapped || SYMBOL_REPLACEMENTS[char] || OCR_MATH_SYMBOL_REPLACEMENTS[char] || char;
  }

  return out;
}

export function normalizeEscapedLatexBackslashes(input: string): string {
  return input.replace(
    /\\\\(?=(?:sin|cos|tan|cot|sec|csc|log|ln|lg|sqrt|lim|sum|int|vec|bar|hat|tilde|frac|binom|mathbb|begin|end|rightleftharpoons|leftrightharpoons|left|right|infty|emptyset|notin|setminus|cup|cap|circ|pi|alpha|beta|gamma|delta|theta|lambda|mu|Delta|partial|pm|Rightarrow|Leftrightarrow|to|leq|geq|neq|approx)\b|\(|\)|\[|\]|\{|\})/g,
    '\\',
  );
}

function normalizeSetOperators(input: string): string {
  return input
    .replace(/\\cup|\u222a/g, '\\cup')
    .replace(/\\cap|\u2229/g, '\\cap')
    .replace(/\\setminus|\u2216/g, '\\setminus');
}

function wrapIntervalAssignments(input: string): string {
  return input.replace(INTERVAL_ASSIGNMENT_RE, (match, variable, intervals, offset: number, whole: string) => {
    const before = whole.slice(Math.max(0, offset - 2), offset);
    const after = whole.slice(offset + match.length, offset + match.length + 2);
    if (before === '\\(' || before.endsWith('$') || after === '\\)') return match;

    return `\\(${variable}=${intervals}\\)`;
  });
}

export function repairMathFormatArtifacts(
  input: string,
  options: { wrapIntervalAssignments?: boolean } = {},
): string {
  if (!input) return '';
  const shouldWrapIntervalAssignments = options.wrapIntervalAssignments ?? true;

  const repaired = normalizeSetOperators(repairOcrMathArtifacts(normalizeEscapedLatexBackslashes(input)))
    .replace(/([=:\uff1a]\s*)\$\$+(?=\s*[\[(+\-\\A-Za-z0-9])/g, '$1')
    .replace(/\(\[\)\/\(([^)]*)\)\)/g, '[$1)')
    .replace(/\(\(\)\/\(([^)]*)\)\)/g, '($1)')
    .replace(/\bC\s*(?:\u211d|\\mathbb\{R\})\s*\(/g, 'C_{\\mathbb{R}}(')
    .replace(/\bC\s+R\s*\(/g, 'C_{\\mathbb{R}}(')
    .replace(/\bC\s*(?:\u211d|\\mathbb\{R\})\b/g, 'C_{\\mathbb{R}}')
    .replace(/\bC\s+R\b/g, 'C_{\\mathbb{R}}');

  const withIntervalAssignments = shouldWrapIntervalAssignments
    ? wrapIntervalAssignments(repaired.replace(ESCAPED_INTERVAL_ASSIGNMENT_RE, (_, variable, intervals) => (
      `\\(${variable}=${normalizeSetOperators(intervals.trim())}\\)`
    )))
    : repaired;

  return withIntervalAssignments
    .replace(/\s+([,.;:\uff0c\u3002\uff1b\uff1a\uff09)\]])/g, '$1')
    .replace(/([\uff08(\[])\s+/g, '$1');
}

function normalizeLooseMathSyntax(input: string): string {
  return repairLooseSqrtRadicands(normalizeOcrMathSyntax(input))
    .replace(/\\sqrt\{\s*\(\(\s*([^{}()\n]+?)\s*\)\s*\/\s*([^{}()\n]+?)\s*\)\)+\s*\}/g, '\\sqrt{\\frac{$1}{$2}}')
    .replace(/([=:\uff1a]\s*)\$\$(?=\s*[\[(+\-\\A-Za-z0-9])/g, '$1')
    .replace(LATEX_COMMAND_BOUNDARY_RE, (match, command: string, offset: number, whole: string) => {
      const commandText = whole.slice(offset + 1);
      if (
        (command === 'in' && (commandText.startsWith('infty') || commandText.startsWith('int'))) ||
        (command === 'le' && (commandText.startsWith('leq') || commandText.startsWith('left'))) ||
        (command === 'left' && commandText.startsWith('leftrightharpoons')) ||
        (command === 'right' && commandText.startsWith('rightleftharpoons')) ||
        (command === 'ge' && commandText.startsWith('geq')) ||
        (command === 'ne' && commandText.startsWith('neq'))
      ) {
        return match;
      }

      return `\\${command} `;
    })
    .replace(
      /(^|[^\\A-Za-z])([A-Z0-9])\s*(sin|cos|tan|cot|sec|csc)(?=(?:\\[A-Za-z]+|[A-Za-z0-9]|\s*(?:[+\-*/=,.;)\]]|$)))/gi,
      (_, prefix, coefficient, fn) => `${prefix}${coefficient}\\${fn.toLowerCase()} `,
    )
    .replace(
      /\\sqrt\{\}\s*([0-9]+)\s*(sin|cos|tan|cot|sec|csc)(?=(?:\\[A-Za-z]+|[A-Za-z]))/gi,
      (_, radicand, fn) => `\\sqrt{${radicand}}\\${fn.toLowerCase()} `,
    )
    .replace(/\\(sin|cos|tan|cot|sec|csc)\s*-\s*1\b/g, (_, fn) => `\\${fn.toLowerCase()}^{-1}`)
    .replace(/(^|[^\\A-Za-z])(sin|cos|tan|cot|sec|csc)\s*-\s*1\b/gi, (_, prefix, fn) => `${prefix}\\${fn.toLowerCase()}^{-1}`)
    .replace(/\\(sin|cos|tan|cot|sec|csc)\s*\^\s*\{?\s*([+\-]?\d+)\s*\}?/g, (_, fn, power) => `\\${fn.toLowerCase()}^{${power}}`)
    .replace(/(^|[^\\A-Za-z])(sin|cos|tan|cot|sec|csc)\b(?=\s*(?:\^|\(|\\[A-Za-z]+|[A-Za-z0-9]))/gi, (_, prefix, fn) => `${prefix}\\${fn.toLowerCase()}`)
    .replace(/(^|[^\\A-Za-z])(alpha|beta|gamma|delta|theta|lambda|mu|pi)\b/gi, (_, prefix, name) => `${prefix}\\${name.toLowerCase()}`)
    .replace(/\\sqrt\{\}\s*\(([^()]+)\)/g, '\\sqrt{$1}')
    .replace(/\\sqrt\{\}\s*((?:\\[A-Za-z]+|[A-Za-z0-9]+)(?:_\{[^{}]+\})?(?:\^\{[^{}]+\})?)/g, '\\sqrt{$1}')
    .replace(/(^|[^\\A-Za-z])(sin|cos|tan|cot|sec|csc)(?=\s*\()/gi, (_, prefix, fn) => `${prefix}\\${fn.toLowerCase()}`)
    .replace(/(^|[^\\A-Za-z])(sin|cos|tan|cot|sec|csc)([0-9]+)(?=\s*\^?\\circ)/gi, (_, prefix, fn, degrees) => `${prefix}\\${fn.toLowerCase()} ${degrees}`)
    .replace(/(^|[^\\A-Za-z])(sin|cos|tan|cot|sec|csc)\s+([0-9]+)\s*(?=(?:\\[A-Za-z]+|[A-Za-z]))/gi, (_, prefix, fn, number) => `${prefix}\\${fn.toLowerCase()} ${number}`)
    .replace(/(^|[^\\A-Za-z])(sin|cos|tan|cot|sec|csc)([0-9]+)(?=(?:\\[A-Za-z]+|[A-Za-z]))/gi, (_, prefix, fn, number) => `${prefix}\\${fn.toLowerCase()} ${number}`)
    .replace(/(^|[^\\A-Za-z])(sin|cos|tan|cot|sec|csc)(?=(?:\\[A-Za-z]+|[A-Za-z]))/gi, (_, prefix, fn) => `${prefix}\\${fn.toLowerCase()} `)
    .replace(/(^|[^\\A-Za-z])(ln|lg|log)(?=\s*\()/gi, (_, prefix, fn) => `${prefix}\\${fn.toLowerCase()}`)
    .replace(/(^|[^\\A-Za-z])log\s*([0-9]+)\s*\/\s*([0-9]+)\s*([A-Za-z0-9\\]+)\b/gi, '$1\\log_{\\frac{$2}{$3}} $4')
    .replace(/(^|[^\\A-Za-z])log\s*\^\s*\{?([0-9]+)\}?\s*\/\s*([0-9]+)\s+([0-9]+)(?:\s+\3\s+\4)?/gi, '$1\\log_{\\frac{$3}{$2}} $4')
    .replace(/(^|[^\\A-Za-z])(ln|lg|log)\s+/gi, (_, prefix, fn) => `${prefix}\\${fn.toLowerCase()} `)
    .replace(/\\log\s*([0-9]+)\s*\/\s*([0-9]+)\s*([A-Za-z0-9\\]+)\b/g, '\\log_{\\frac{$1}{$2}} $3')
    .replace(/\\log\s*\^\s*\{?([0-9]+)\}?\s*\/\s*([0-9]+)\s+([0-9]+)(?:\s+\2\s+\3)?/gi, '\\log_{\\frac{$2}{$1}} $3')
    .replace(/\\log\s*\^\s*\{?([0-9]+)\}?\s*\/\s*1\s*\^\s*\{?([0-9]+)\}?/gi, '\\log_{\\frac{1}{$1}} $2')
    .replace(/\\log\s+([2-9])([0-9])\b/g, '\\log_{$1} $2')
    .replace(/([0-9]+)\s*\\pi\s*\/\s*([0-9]+)/g, '\\frac{$1\\pi}{$2}')
    .replace(/\\pi\s*\/\s*([0-9]+)/g, '\\frac{\\pi}{$1}')
    .replace(/([A-Za-z0-9])\s*\\frac\{\s*\^\{?([^{}]+)\}?\s*\}\{/g, '\\frac{$1^{$2}}{')
    .replace(/\bC\s+(\\mathbb\{[A-Z]\})\s*\(/g, 'C_{$1}(');
}

function repairLooseSqrtRadicands(input: string): string {
  return input.replace(/\\sqrt\{\}\s*([([{][^=。\n；;，,]+)(?=\s*=)/g, (_, radicand) => {
    const clean = String(radicand || '').trim();
    return clean ? `\\sqrt{${clean}}` : '\\sqrt{}';
  });
}

function findMatchingBackward(input: string, closeIndex: number): number {
  const close = input[closeIndex];
  const open = close === ')' ? '(' : close === ']' ? '[' : '{';
  let depth = 0;

  for (let i = closeIndex; i >= 0; i--) {
    if (input[i] === close) depth++;
    if (input[i] === open) depth--;
    if (depth === 0) return i;
  }

  return -1;
}

function findMatchingForward(input: string, openIndex: number): number {
  const open = input[openIndex];
  const close = open === '(' ? ')' : open === '[' ? ']' : '}';
  let depth = 0;

  for (let i = openIndex; i < input.length; i++) {
    if (input[i] === open) depth++;
    if (input[i] === close) depth--;
    if (depth === 0) return i;
  }

  return -1;
}

function isTermSeparator(input: string, index: number): boolean {
  const char = input[index];
  if (/[,;\n=<>]/.test(char)) return true;
  if (char !== '+' && char !== '-') return false;

  const before = input[index - 1] || '';
  const after = input[index + 1] || '';
  return /\s/.test(before) || /\s/.test(after);
}

function findAtomStart(input: string, end: number): number {
  let cursor = end;
  while (cursor > 0 && /\s/.test(input[cursor - 1])) cursor--;
  if (cursor <= 0) return 0;

  const lastChar = input[cursor - 1];
  if (lastChar === ')' || lastChar === ']' || lastChar === '}') {
    const groupStart = findMatchingBackward(input, cursor - 1);
    if (groupStart >= 0) {
      const command = input.slice(0, groupStart).match(/\\[A-Za-z]+\s*$/);
      return command?.index !== undefined ? command.index : groupStart;
    }
  }

  const match = input.slice(0, cursor).match(/(?:\\[A-Za-z]+|[A-Za-z0-9]+)\s*$/);
  return match?.index ?? cursor - 1;
}

function stripOuterGroup(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 2) return trimmed;

  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  const isWrapped =
    (first === '(' && last === ')') ||
    (first === '[' && last === ']') ||
    (first === '{' && last === '}');

  if (!isWrapped) return trimmed;

  const match = findMatchingForward(trimmed, 0);
  return match === trimmed.length - 1 ? trimmed.slice(1, -1).trim() : trimmed;
}

function isMostlyMath(value: string): boolean {
  const withoutCommands = value
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/\\([{}()[\],;|])/g, '$1');
  const words = (withoutCommands.match(/[A-Za-z]{2,}/g) || [])
    .filter(word => !MATH_WORD_RE.test(word))
    .filter(word => !/^(?:d[xyztun]|mg|kg|cm|mm|dm|km|ms|mol|rad|hz|pa|ev|kw|w|j|n|v|a|c)$/i.test(word));
  if (words.length > 0) return false;

  const leftovers = withoutCommands.replace(/[0-9A-Za-z\s{}()[\]^_+\-=*/<>.,;:|&']/g, '');
  return leftovers.length === 0;
}

function findNumeratorStart(input: string, end: number): number {
  const lastChar = input[end - 1];

  if (lastChar === ')' || lastChar === ']' || lastChar === '}') {
    const groupStart = findMatchingBackward(input, end - 1);
    if (groupStart >= 0) {
      const markerIndex = groupStart - 1;
      if (input[markerIndex] === '^' || input[markerIndex] === '_') {
        return findAtomStart(input, markerIndex);
      }
      const command = input.slice(0, groupStart).match(/\\[A-Za-z]+\s*$/);
      if (command?.index !== undefined) return command.index;
      return groupStart;
    }
  }

  let depth = 0;
  for (let i = end - 1; i >= 0; i--) {
    const char = input[i];
    if (char === ')' || char === ']' || char === '}') depth++;
    if (char === '(' || char === '[' || char === '{') depth--;

    if (depth === 0 && (char === '+' || char === '-') && i > 0) {
      return i + 1;
    }

    if (depth === 0 && isTermSeparator(input, i)) {
      return i + 1;
    }
  }

  const left = input.slice(0, end);
  if (isMostlyMath(left)) return 0;

  const whitespace = left.search(/\S+\s*$/);
  return whitespace >= 0 ? whitespace : 0;
}

function splitDenominatorSuffix(raw: string): { denominator: string; suffix: string } {
  const condition = raw.match(/^([\s\S]*?)(\s+\([^)]*(?:\\ne|\\le|\\ge|=|<|>)[^)]*\)\s*)$/);
  if (condition?.[1]?.trim()) {
    return {
      denominator: condition[1].trim(),
      suffix: condition[2],
    };
  }

  const trimmed = raw.trim();
  if (/[。．]$/.test(trimmed) || (trimmed.endsWith('.') && !/\d+\.\d+$/.test(trimmed))) {
    return {
      denominator: trimmed.slice(0, -1).trim(),
      suffix: trimmed.slice(-1),
    };
  }

  return { denominator: trimmed, suffix: '' };
}

function readDenominator(input: string, start: number): { end: number; denominator: string; suffix: string } | null {
  let j = start;
  while (j < input.length && /\s/.test(input[j])) j++;
  if (j >= input.length) return null;

  if (input[j] === '(' || input[j] === '[' || input[j] === '{') {
    const end = findMatchingForward(input, j);
    if (end < 0) return null;

    return {
      end: end + 1,
      denominator: stripOuterGroup(input.slice(j, end + 1)),
      suffix: '',
    };
  }

  let depth = 0;
  let end = j;
  while (end < input.length) {
    const char = input[end];
    if (char === '(' || char === '[' || char === '{') depth++;
    if (char === ')' || char === ']' || char === '}') depth--;
    if (depth <= 0 && isTermSeparator(input, end) && !(end === j && /[+\-]/.test(char))) break;
    end++;
  }

  const split = splitDenominatorSuffix(input.slice(j, end));
  return {
    end,
    denominator: split.denominator,
    suffix: split.suffix,
  };
}

function isUsableOperand(value: string): boolean {
  if (!value || value.includes('://') || value.includes('/')) return false;
  if (!/[A-Za-z0-9\\]/.test(value)) return false;
  return isMostlyMath(value);
}

function convertOnePlainFraction(input: string): { value: string; changed: boolean } {
  let depth = 0;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '(' || char === '[' || char === '{') depth++;
    if (char === ')' || char === ']' || char === '}') depth--;

    if (char !== '/' || depth !== 0) continue;
    if (input[i - 1] === '\\' || input[i - 1] === ':' || input[i - 1] === '/' || input[i + 1] === '/') continue;

    let leftEnd = i;
    while (leftEnd > 0 && /\s/.test(input[leftEnd - 1])) leftEnd--;

    const numeratorStart = findNumeratorStart(input, leftEnd);
    const numerator = stripOuterGroup(input.slice(numeratorStart, leftEnd));
    const denominatorData = readDenominator(input, i + 1);
    if (!denominatorData) continue;

    const denominator = stripOuterGroup(denominatorData.denominator);
    if (!isUsableOperand(numerator) || !isUsableOperand(denominator)) continue;

    return {
      value: `${input.slice(0, numeratorStart)}\\frac{${numerator}}{${denominator}}${denominatorData.suffix}${input.slice(denominatorData.end)}`,
      changed: true,
    };
  }

  return { value: input, changed: false };
}

export function normalizePlainFractions(input: string): string {
  let current = input;

  for (let i = 0; i < 10; i++) {
    const next = convertOnePlainFraction(current);
    if (!next.changed) return current;
    current = next.value;
  }

  return current;
}

export function normalizeMathText(input: string): string {
  return normalizePlainFractions(
    normalizeLooseMathSyntax(
      normalizeMathUnicode(repairMathFormatArtifacts(input, { wrapIntervalAssignments: false })).replace(/\r\n?/g, '\n'),
    ),
  );
}

export function normalizeLatexMath(input: string): string {
  return escapeSetLiteralBraces(normalizeSuperscriptSyntax(
    normalizeLostSuperscripts(normalizeMathText(input)
      .replace(/(^|[^\\])\\[ \t]+/g, '$1 ')
      .replace(/[ \t]*\n[ \t]*/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()),
  ));
}

export function isLikelyLooseMathLine(input: string): boolean {
  const normalized = normalizeLatexMath(input);
  if (!normalized) return false;
  if (!/[=+\-*/^_<>]|\\(?:frac|sqrt|ne|le|ge|times|div|cdot|sin|cos|tan|cot|sec|csc|log|ln|lg|lim|sum|int|mathbb|infty|emptyset|in|notin|setminus|cup|cap|binom|circ|Rightarrow|Leftrightarrow|to|approx)\b/.test(normalized)) return false;
  return isMostlyMath(normalized);
}

function isMathishChar(char: string): boolean {
  return /[A-Za-z0-9\\{}()[\]^_+\-*/=<>.,;|\s']/.test(char) && !/[À-ỹ]/.test(char);
}

function isAsciiLetterBeforeVietnamese(input: string, index: number): boolean {
  return /[A-Za-z]/.test(input[index] || '') && /[À-ỹ]/.test(input[index + 1] || '');
}

function isBoundaryAfterVietnameseWord(input: string, index: number): boolean {
  if (!/\s/.test(input[index - 1] || '')) return false;
  const before = input.slice(0, index - 1).match(/(\S+)$/)?.[1] || '';
  return /[À-ỹ]/.test(before);
}

function hasBalancedMathGroups(input: string): boolean {
  const stack: string[] = [];
  const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (input[i - 1] === '\\') continue;
    if (char === '(' || char === '[' || char === '{') {
      stack.push(char);
    } else if (char === ')' || char === ']' || char === '}') {
      const open = stack.pop();
      const isIntervalClose =
        (char === ')' && open === '[') ||
        (char === ']' && open === '(');
      if (open !== pairs[char] && !isIntervalClose) return false;
    }
  }

  return stack.length === 0;
}

function escapeSetLiteralBraces(input: string): string {
  let out = '';
  let cursor = 0;

  while (cursor < input.length) {
    const openIndex = input.indexOf('{', cursor);
    if (openIndex < 0) {
      out += input.slice(cursor);
      break;
    }

    const before = input[openIndex - 1] || '';
    if (before === '\\' || before === '_' || before === '^') {
      out += input.slice(cursor, openIndex + 1);
      cursor = openIndex + 1;
      continue;
    }

    const closeIndex = findMatchingForward(input, openIndex);
    if (closeIndex < 0) {
      out += input.slice(cursor);
      break;
    }

    const content = input.slice(openIndex + 1, closeIndex);
    const looksLikeSetLiteral =
      /[,;\uff0c\uff1b]/.test(content) &&
      !/[{}]/.test(content) &&
      /\S/.test(content);

    if (!looksLikeSetLiteral) {
      out += input.slice(cursor, closeIndex + 1);
      cursor = closeIndex + 1;
      continue;
    }

    out += `${input.slice(cursor, openIndex)}\\{${content}\\}`;
    cursor = closeIndex + 1;
  }

  return out;
}

function normalizeLostSuperscripts(input: string): string {
  return input
    .replace(/\bf\s*\^?\s*-\s*1\s*\(/gi, 'f^{-1}(')
    .replace(/\b([A-Za-z])([2-9])\b/g, '$1^{$2}');
}

function normalizeSuperscriptSyntax(input: string): string {
  return input
    .replace(/\^\s*\{\s*([^{}]+?)\s*\}/g, '^{$1}')
    .replace(/\^\s*([+\-]?\d+|[A-Za-z]|\\[A-Za-z]+)(?![A-Za-z])/g, '^{$1}');
}

function splitLeadingListMarker(raw: string): { prefix: string; math: string } {
  const option = raw.match(/^(\s*(?:[A-H]|\d{1,3})[.．、]\s*(?:\\quad\s*)?)([\s\S]+)$/);
  if (option) {
    const prefix = option[1].replace(/\\quad\s*/g, '').replace(/\\[ \t]+/g, ' ').trimEnd();
    return {
      prefix: prefix ? `${prefix} ` : '',
      math: option[2],
    };
  }

  return { prefix: '', math: raw };
}

function wrapEqualMathInPlainText(input: string): string {
  let out = '';
  let cursor = 0;

  while (cursor < input.length) {
    const relation = input.slice(cursor).match(/=|<|>|\\(?:le|ge|ne)\b/);
    if (!relation || relation.index === undefined) break;

    const relationIndex = cursor + relation.index;
    let start = relationIndex;
    while (start > cursor && isMathishChar(input[start - 1]) && !isBoundaryAfterVietnameseWord(input, start)) start--;

    let end = relationIndex + relation[0].length;
    while (end < input.length && isMathishChar(input[end]) && !isAsciiLetterBeforeVietnamese(input, end)) end++;

    const rawCandidate = input.slice(start, end);
    const leadingWhitespace = rawCandidate.match(/^\s*/)?.[0] || '';
    const trailingWhitespace = rawCandidate.match(/\s*$/)?.[0] || '';
    const coreCandidate = rawCandidate.slice(leadingWhitespace.length, rawCandidate.length - trailingWhitespace.length);
    const { prefix, math } = splitLeadingListMarker(coreCandidate);
    const normalized = normalizeLatexMath(math);

    if (
      !normalized ||
      !/(?:=|<|>|\\(?:le|ge|ne)\b)/.test(normalized) ||
      !isMostlyMath(normalized) ||
      !hasBalancedMathGroups(normalized)
    ) {
      out += input.slice(cursor, relationIndex + relation[0].length);
      cursor = relationIndex + relation[0].length;
      continue;
    }

    out += input.slice(cursor, start);
    out += `${leadingWhitespace}${prefix}\\(${normalized}\\)${trailingWhitespace}`;
    cursor = end;
  }

  return out + input.slice(cursor);
}

function wrapStandaloneFractions(input: string): string {
  return input.replace(/\\frac\{(?:[^{}]|\{[^{}]*\})+\}\{(?:[^{}]|\{[^{}]*\})+\}/g, (match, offset, whole) => {
    const before = whole.slice(Math.max(0, offset - 3), offset);
    const after = whole.slice(offset + match.length, offset + match.length + 3);
    if (
      whole[offset - 1] === '\\' ||
      whole[offset - 1] === '$' ||
      latexGroupDepthAt(whole, offset) > 0 ||
      before.includes('\\(') ||
      before.includes('$') ||
      after.includes('\\)') ||
      after.includes('$') ||
      isInsideWrappedMath(whole, offset)
    ) return match;
    const normalized = normalizeLatexMath(match);
    return hasBalancedMathGroups(normalized) ? `\\(${normalized}\\)` : match;
  });
}

function isInsideWrappedMath(input: string, offset: number): boolean {
  for (const match of input.matchAll(WRAPPED_MATH_RE)) {
    const start = match.index ?? -1;
    if (start >= 0 && offset > start && offset < start + match[0].length) return true;
  }
  return false;
}

function latexGroupDepthAt(input: string, offset: number): number {
  let depth = 0;

  for (let i = 0; i < offset; i++) {
    if (input[i - 1] === '\\') continue;
    if (input[i] === '{') depth++;
    if (input[i] === '}') depth = Math.max(0, depth - 1);
  }

  return depth;
}

function wrapMathMatch(input: string, pattern: RegExp): string {
  return input.replace(pattern, (match, offset, whole) => {
    const before = whole.slice(Math.max(0, offset - 3), offset);
    const after = whole.slice(offset + match.length, offset + match.length + 3);
    if (
      whole[offset - 1] === '\\' ||
      whole[offset - 1] === '$' ||
      before.includes('\\(') ||
      before.includes('$') ||
      after.includes('\\)') ||
      after.includes('$') ||
      isInsideWrappedMath(whole, offset)
    ) return match;

    return `\\(${normalizeLatexMath(match)}\\)`;
  });
}

function wrapIntervalExpressions(input: string): string {
  const endpoint = String.raw`[+\-]?(?:\\infty|(?:\\pi|[A-Za-z0-9]+)(?:\^\{?[\w+\-]+\}?)?)`;
  const interval = String.raw`[\[(]\s*${endpoint}\s*,\s*${endpoint}\s*[\])]`;
  const pattern = new RegExp(`${interval}(?:\\s*\\\\cup\\s*${interval})*`, 'g');
  return wrapMathMatch(input, pattern);
}

function wrapPowerExpressions(input: string): string {
  return wrapMathMatch(
    input,
    /\b(?:[A-Za-z]|[0-9]+|\\[A-Za-z]+)\s*\^\s*(?:\{[^{}]+\}|[+\-]?\d+|[A-Za-z])\b/g,
  );
}

function wrapSubscriptExpressions(input: string): string {
  return wrapMathMatch(
    input,
    /\b[A-Za-z]\s*_\s*(?:\{[^{}]+\}|[A-Za-z0-9]+)/g,
  );
}

function wrapPointCoordinateExpressions(input: string): string {
  return wrapMathMatch(
    input,
    /\b[A-Z]\s*\(\s*[^()（）;；]{1,80}[;；]\s*[^()（）]{1,80}\)/g,
  );
}

function wrapCommandExpressionsInSegment(segment: string): string {
  let out = '';
  let cursor = 0;

  while (cursor < segment.length) {
    const rest = segment.slice(cursor);
    const match = rest.match(INLINE_MATH_COMMAND_RE);
    if (!match || match.index === undefined) {
      out += rest;
      break;
    }

    const commandIndex = cursor + match.index;
    let start = commandIndex;
    let end = commandIndex + match[0].length;

    while (start > cursor && isMathishChar(segment[start - 1]) && !isBoundaryAfterVietnameseWord(segment, start)) start--;
    while (end < segment.length && isMathishChar(segment[end]) && !isAsciiLetterBeforeVietnamese(segment, end)) end++;

    const raw = segment.slice(start, end);
    const leading = raw.match(/^\s*/)?.[0] || '';
    const trailing = raw.match(/\s*$/)?.[0] || '';
    const core = raw.slice(leading.length, raw.length - trailing.length);
    const normalized = normalizeLatexMath(core);

    out += segment.slice(cursor, start);
    out += normalized && isMostlyMath(normalized) && hasBalancedMathGroups(normalized)
      ? `${leading}\\(${normalized}\\)${trailing}`
      : raw;
    cursor = end;
  }

  return out;
}

function wrapCommandExpressions(input: string): string {
  return input
    .split(WRAPPED_MATH_RE)
    .map(segment => {
      if (
        !segment ||
        segment.startsWith('\\(') ||
        segment.startsWith('\\[') ||
        segment.startsWith('$$') ||
        segment.startsWith('$')
      ) return segment;

      return wrapCommandExpressionsInSegment(segment);
    })
    .join('');
}

function applyUndelimitedMathWraps(input: string): string {
  return wrapCommandExpressions(wrapSubscriptExpressions(wrapPowerExpressions(wrapIntervalExpressions(wrapStandaloneFractions(wrapPointCoordinateExpressions(input))))));
}

function mergeAdjacentInlineMath(input: string): string {
  return input
    .replace(/(^|[^\w\\])-\s*\\\((\\frac[\s\S]*?)\\\)/g, '$1\\(-$2\\)')
    .replace(/\\\)\\\(,\s*/g, ', ')
    .replace(/\\\)\s+\\\(/g, ' ');
}

function repairMalformedInlineDollarDelimiters(input: string): string {
  return input.replace(/\$\$?/g, (match, offset: number, whole: string) => {
    const before = whole.slice(0, offset);
    const after = whole.slice(offset + match.length);
    const lineBefore = before.slice(before.lastIndexOf('\n') + 1);
    const nextNewline = after.indexOf('\n');
    const lineAfter = nextNewline >= 0 ? after.slice(0, nextNewline) : after;
    const isLineStart = lineBefore.trim().length === 0;
    const isLineEnd = lineAfter.trim().length === 0;

    if (match === '$$' && (isLineStart || isLineEnd)) return match;

    const prev = before.match(/\S\s*$/)?.[0]?.trim() || '';
    const next = after.match(/^\s*\S/)?.[0]?.trim() || '';
    const touchesMathOperator =
      /[=<>+\-*/({[,;:|]$/.test(prev) ||
      /^[=<>+\-*/)}\],.;:|]/.test(next) ||
      /\\(?:Rightarrow|Leftrightarrow|to)\s*$/.test(before) ||
      /^\\(?:Rightarrow|Leftrightarrow|to)\b/.test(after.trimStart());

    if (match === '$$' && touchesMathOperator) return '';
    if (match === '$' && touchesMathOperator) return '';

    return match;
  });
}

export function normalizeRichMathText(input: string): string {
  if (!input) return '';

  const normalized = normalizeMathText(repairMathFormatArtifacts(repairMalformedInlineDollarDelimiters(input)))
    .replace(/(^|[^\\])\\[ \t]+/g, '$1 ')
    .split(/(\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$|\$[^$\n]*\$|`[^`\n]*`)/g)
    .map((part) => {
      if (!part || part.startsWith('`')) return part;

      if (part.startsWith('\\(') && part.endsWith('\\)')) {
        return `\\(${normalizeLatexMath(part.slice(2, -2))}\\)`;
      }

      if (part.startsWith('\\[') && part.endsWith('\\]')) {
        return `\\[${normalizeLatexMath(part.slice(2, -2))}\\]`;
      }

      if (part.startsWith('$$') && part.endsWith('$$')) {
        return `$$${normalizeLatexMath(part.slice(2, -2))}$$`;
      }

      if (part.startsWith('$') && part.endsWith('$')) {
        return `$${normalizeLatexMath(part.slice(1, -1))}$`;
      }

      const withEqualMath = wrapEqualMathInPlainText(part);
      return withEqualMath
        .split(/(\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$|\$[^$\n]*\$)/g)
        .map((segment) => {
          if (
            segment.startsWith('\\(') ||
            segment.startsWith('\\[') ||
            segment.startsWith('$$') ||
            segment.startsWith('$')
          ) return segment;

          return applyUndelimitedMathWraps(segment);
        })
        .join('');
    })
    .join('');

  return mergeAdjacentInlineMath(normalized);
}

export function normalizeAdminMathInputText(input: string): string {
  if (!input) return '';

  return normalizeRichMathText(repairMathFormatArtifacts(input));
}
