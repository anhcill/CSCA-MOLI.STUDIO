import { normalizeLatexMath, normalizeRichMathText } from '@/lib/math/normalizeMath';

const COMMAND_RE =
  /\\(?:sin|cos|tan|cot|sec|csc|log|ln|lg|sqrt|lim|sum|int|vec|bar|hat|tilde|frac|binom|infty|cup|cap|circ|pi|alpha|beta|gamma|delta|theta|lambda|mu|Rightarrow|Leftrightarrow|to|le|ge|ne|approx)\b/;
const DELIMITED_MATH_RE = /(\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$|\$[^$\n]*\$|`[^`\n]*`)/g;

const GREEK_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\u03b1/g, '\\alpha '],
  [/\u03b2/g, '\\beta '],
  [/\u03b3/g, '\\gamma '],
  [/\u03b4/g, '\\delta '],
  [/\u03b8/g, '\\theta '],
  [/\u03bb/g, '\\lambda '],
  [/\u03bc/g, '\\mu '],
  [/\u03c0/g, '\\pi '],
];

function cleanOcrMathInput(input: string): string {
  return input
    .replace(/\\\s+/g, ' ')
    .replace(/^\s*\\quad\s+/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function normalizeSymbols(input: string): string {
  return GREEK_REPLACEMENTS.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), input)
    .replace(/\u2212/g, '-')
    .replace(/\u2260/g, '\\ne ')
    .replace(/\u2264/g, '\\le ')
    .replace(/\u2265/g, '\\ge ')
    .replace(/\u2248/g, '\\approx ')
    .replace(/\u221e/g, '\\infty ')
    .replace(/\u2208/g, '\\in ')
    .replace(/\u2209/g, '\\notin ')
    .replace(/\u222a/g, '\\cup ')
    .replace(/\u2229/g, '\\cap ')
    .replace(/\u00d7/g, '\\times ')
    .replace(/\u00f7/g, '\\div ')
    .replace(/\u00b1/g, '\\pm ')
    .replace(/\u21d4/g, '\\Leftrightarrow ')
    .replace(/\u21d2/g, '\\Rightarrow ')
    .replace(/\u2192/g, '\\to ')
    .replace(/<=>/g, '\\Leftrightarrow ')
    .replace(/=>/g, '\\Rightarrow ')
    .replace(/->/g, '\\to ');
}

function normalizeRoots(input: string): string {
  return input
    .replace(/\u221a\s*\(([^()]+)\)/g, '\\sqrt{$1}')
    .replace(/\u221a\s*([A-Za-z0-9]+(?:\^[{]?[A-Za-z0-9]+[}]?)?)/g, '\\sqrt{$1}')
    .replace(/\bsqrt\s*\(([^()]+)\)/gi, '\\sqrt{$1}')
    .replace(/\bsqrt\s+([A-Za-z0-9]+(?:\^[{]?[A-Za-z0-9]+[}]?)?)/gi, '\\sqrt{$1}');
}

function normalizeFunctions(input: string): string {
  return input
    .replace(/\blog\s*_\s*([0-9A-Za-z]+)\s+/gi, '\\log_{$1} ')
    .replace(/\blog([0-9]+)\s+/gi, '\\log_{$1} ')
    .replace(/(^|[^\\A-Za-z])(sin|cos|tan|cot|sec|csc)(?=\d)/gi, (_, prefix, fn) => `${prefix}\\${fn.toLowerCase()} `)
    .replace(/(^|[^\\A-Za-z])(sin|cos|tan|cot|sec|csc)([xyzt])\b/gi, (_, prefix, fn, variable) => `${prefix}\\${fn.toLowerCase()} ${variable}`)
    .replace(/(^|[^\\A-Za-z])(sin|cos|tan|cot|sec|csc|ln|lg|log)\b\s*/gi, (_, prefix, fn) => `${prefix}\\${fn.toLowerCase()} `)
    .replace(/\\(sin|cos|tan|cot|sec|csc|ln|lg|log)\s+([0-9]+)\s*(?:\u00b0|\^?\\?circ|\u5ea6)/gi, '\\$1 $2^\\circ');
}

function normalizeDegrees(input: string): string {
  return input.replace(/([0-9]+(?:\.[0-9]+)?)\s*(?:\u00b0|\u5ea6)/g, '$1^\\circ');
}

function normalizeDecorators(input: string): string {
  return input
    .replace(/\\(vec|bar|hat|tilde)\s+([A-Za-z])/g, '\\$1{$2}')
    .replace(/\|\s*\\vec\{([A-Za-z])\}\s*\|/g, '|\\vec{$1}|');
}

function normalizeCombinatorics(input: string): string {
  return input
    .replace(/\b([CA])\s*\(\s*([^,()]+)\s*,\s*([^()]+)\s*\)/g, '$1_{$2}^{$3}')
    .replace(/\b([CA])\s*[_]?\s*([A-Za-z0-9]+)\s*\^\s*([A-Za-z0-9]+)/g, '$1_{$2}^{$3}');
}

function normalizeCalculus(input: string): string {
  return input
    .replace(/\blim\s*([A-Za-z])\s*\\to\s*([^\s,;]+)/gi, '\\lim_{$1 \\to $2}')
    .replace(/\bsum\s+([A-Za-z])\s*=\s*([^\s]+)\s+(?:to|\u5230)\s+([^\s,;]+)/gi, '\\sum_{$1=$2}^{$3}')
    .replace(/\bint\s+([^\s]+)\s+(?:to|\u5230)\s+([^\s,;]+)/gi, '\\int_{$1}^{$2}')
    .replace(/\u2211\s*([A-Za-z])\s*=\s*([^\s]+)\s*(?:to|\u5230)\s*([^\s,;]+)/g, '\\sum_{$1=$2}^{$3}')
    .replace(/\u222b\s*([^\s]+)\s*(?:to|\u5230)\s*([^\s,;]+)/g, '\\int_{$1}^{$2}')
    .replace(/\u2211/g, '\\sum ')
    .replace(/\u222b/g, '\\int ');
}

function normalizeFunctionFractions(input: string): string {
  return input
    .replace(/([A-Za-z0-9])\(([^()]+)\)\s*\/\s*([A-Za-z0-9]+)(?=\s*(?:=|\\Rightarrow|\\Leftrightarrow|,|;|$))/g, '\\frac{$1($2)}{$3}')
    .replace(
      /(\\(?:sin|cos|tan|cot|sec|csc|ln|lg|log)\s+[^/\s]+)\s*\/\s*([A-Za-z0-9]+)(?=\s*(?:=|\\Rightarrow|\\Leftrightarrow|,|;|$))/g,
      '\\frac{$1}{$2}',
    );
}

function normalizeIntervals(input: string): string {
  return input
    .replace(/(^|[\s(,])\+\s*\\infty/g, '$1+\\infty')
    .replace(/(^|[\s(,])-\s*\\infty/g, '$1-\\infty')
    .replace(/\bU\b(?=\s*[\[(])/g, '\\cup ');
}

function applyOcrMathRules(input: string): string {
  return normalizeIntervals(
    normalizeFunctionFractions(
      normalizeCalculus(
        normalizeCombinatorics(
          normalizeDecorators(
            normalizeDegrees(
              normalizeFunctions(
                normalizeRoots(
                  normalizeSymbols(input),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

function isMathishChar(char: string): boolean {
  return /[A-Za-z0-9\\{}()[\]^_+\-*/=<>.,|:&\s]/.test(char);
}

function wrapCommandMathInSegment(segment: string): string {
  let out = '';
  let cursor = 0;

  while (cursor < segment.length) {
    const rest = segment.slice(cursor);
    const match = rest.match(COMMAND_RE);
    if (!match || match.index === undefined) {
      out += rest;
      break;
    }

    const commandIndex = cursor + match.index;
    let start = commandIndex;
    let end = commandIndex + match[0].length;

    while (start > cursor && isMathishChar(segment[start - 1])) start--;
    while (end < segment.length && isMathishChar(segment[end])) end++;

    const raw = segment.slice(start, end);
    const leading = raw.match(/^\s*/)?.[0] || '';
    const trailing = raw.match(/\s*$/)?.[0] || '';
    const core = raw.slice(leading.length, raw.length - trailing.length);

    out += segment.slice(cursor, start);
    out += core ? `${leading}\\(${normalizeLatexMath(core)}\\)${trailing}` : raw;
    cursor = end;
  }

  return out;
}

function wrapCommandMath(input: string): string {
  return input
    .split(DELIMITED_MATH_RE)
    .map(part => {
      if (
        !part ||
        part.startsWith('\\(') ||
        part.startsWith('\\[') ||
        part.startsWith('$$') ||
        part.startsWith('$') ||
        part.startsWith('`')
      ) return part;

      return wrapCommandMathInSegment(part);
    })
    .join('');
}

function maybeBuildCases(input: string): string {
  const lines = input
    .split(/[;\n]+/)
    .map(line => line.trim())
    .filter(Boolean);

  if (lines.length < 2 || lines.some(line => !line.includes('='))) return '';
  if (/[\u3400-\u9fff]/.test(input)) return '';

  const rows = lines.map(line => {
    const eq = line.indexOf('=');
    const left = normalizeLatexMath(line.slice(0, eq).trim());
    const right = normalizeLatexMath(line.slice(eq + 1).trim());
    return `${left}&=${right}`;
  });

  return `\\(\\begin{cases}${rows.join(' \\\\ ')}\\end{cases}\\)`;
}

export function normalizeOcrMathText(input: string): string {
  const cleaned = cleanOcrMathInput(input);
  if (!cleaned) return '';

  const enhanced = applyOcrMathRules(cleaned);
  const cases = maybeBuildCases(enhanced);
  if (cases) return cases;

  return wrapCommandMath(normalizeRichMathText(enhanced));
}
