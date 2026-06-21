const aiConfig = require("../config/aiConfig");
const aiService = require("./aiService");
const { repairOcrMathArtifacts } = require("./ocrMathRepairService");

const ANSWER_KEYS = ["A", "B", "C", "D", "E", "F", "G", "H"];
function parsePositiveIntEnv(name, fallback, max = Number.MAX_SAFE_INTEGER) {
  const value = Number.parseInt(process.env[name], 10);
  const normalized = Number.isFinite(value) && value > 0 ? value : fallback;
  return Math.max(1, Math.min(max, normalized));
}

function estimateTokenCount(value) {
  const text = stringValue(value);
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

const REVIEW_BATCH_SIZE = parsePositiveIntEnv("AI_EXAM_REVIEW_BATCH_SIZE", 6, 12);
const REVIEW_PARALLEL_BATCHES = parsePositiveIntEnv("AI_EXAM_REVIEW_PARALLEL_BATCHES", 3, 3);
const REVIEW_MAX_ITEMS = parsePositiveIntEnv("AI_EXAM_REVIEW_MAX_ITEMS", 120, 300);
const REVIEW_MAX_TOKENS = parsePositiveIntEnv("AI_EXAM_REVIEW_MAX_TOKENS", 5000, 12000);
const REVIEW_TIMEOUT_MS = parsePositiveIntEnv("AI_EXAM_REVIEW_TIMEOUT_MS", 120000, 300000);
const EXPLANATION_MAX_ITEMS = Number.parseInt(process.env.AI_EXAM_EXPLANATION_MAX_QUESTIONS || "300", 10);
const REVIEW_APPLY_MIN_CONFIDENCE = Number.parseFloat(process.env.AI_EXAM_REVIEW_APPLY_MIN_CONFIDENCE || "0.75");

function getReviewModel() {
  return aiConfig.adminExam?.reviewModel || "cx/gpt-5.5";
}

function getReviewModels() {
  return aiConfig.adminExam?.reviewModels?.length ? aiConfig.adminExam.reviewModels : [getReviewModel()];
}

function getFixModel() {
  return aiConfig.adminExam?.fixModel || aiConfig.adminExam?.reviewModel || "cx/gpt-5.5";
}

function getFixModels() {
  return aiConfig.adminExam?.fixModels?.length ? aiConfig.adminExam.fixModels : [getFixModel()];
}

function stringValue(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function compactWhitespace(value) {
  return stringValue(value)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

const WRAPPED_MATH_RE = /(\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$|\$[^$\n]*\$)/g;
const LATEX_COMMAND_RE = /\\(?:sin|cos|tan|cot|sec|csc|log|ln|lg|sqrt|lim|sum|int|vec|bar|hat|tilde|frac|binom|mathbb|mathrm|operatorname|text|begin|end|infty|emptyset|in|notin|setminus|cup|cap|times|div|cdot|quad|qquad|circ|pi|alpha|beta|gamma|delta|theta|lambda|mu|Delta|partial|pm|Rightarrow|Leftrightarrow|to|le|ge|ne|leq|geq|neq|approx)\b/;
const MATH_WORD_RE = /^(?:sin|cos|tan|cot|sec|csc|log|ln|lg|lim|sum|int|alpha|beta|gamma|delta|theta|lambda|mu|pi)$/i;
const ZERO_WIDTH_RE = /[\u200b-\u200f\ufeff\u2060]/g;

function cleanStackedMathLine(value) {
  return stringValue(value).replace(ZERO_WIDTH_RE, "").trim();
}

function isStackedMathFragmentLine(value) {
  const text = cleanStackedMathLine(value);
  if (!text || text.length > 24) return false;
  if (/\\\(|\\\[|\$\$?/.test(text)) return false;
  if (/[\u4e00-\u9fff]/.test(text)) return false;

  const compact = text.replace(/\s+/g, "");
  if (!compact || compact.length > 24) return false;
  const mathOnly = /^(?:log|ln|lg|sin|cos|tan|cot|sec|csc|sqrt|lim|[A-Za-z0-9+\-−–*/=<>≤≥≠≈∈∉∩∪∖\\|∣()[\]{}.,;，；:_^⁡°∞!⋅·]+)$/iu.test(compact);
  if (!mathOnly) return false;
  return (
    /^(?:log|ln|lg|sin|cos|tan|cot|sec|csc|sqrt|lim)$/iu.test(compact) ||
    /^[A-Za-z]$/.test(compact) ||
    /^[0-9]+$/.test(compact) ||
    /^[+\-−–*/=<>≤≥≠≈∈∉∩∪∖\\|∣()[\]{}.,;，；:_^⁡°∞!⋅·]+$/u.test(compact)
  );
}

const STACKED_MATH_SIGNAL_RE = /(?:log|ln|lg|sin|cos|tan|cot|sec|csc|sqrt|lim|[=<>+\-*/{}()[\]^_\\|!\u22c5\u00b7]|\u2264|\u2265|\u2260|\u2248|\u2208|\u2209|\u2229|\u222a|\u2216|\u2223|\u2212|\u2013)/iu;

function compactStackedMathText(value) {
  return cleanStackedMathLine(value).replace(/[\s.,;:\u3001\uff0c\u3002\uff1b\uff1a]/g, "");
}

function hasStackedMathSignal(value) {
  return STACKED_MATH_SIGNAL_RE.test(stringValue(value));
}

function hasRenderedDuplicateAfter(lines, cursor, signal) {
  const compactSignal = compactStackedMathText(signal);
  if (compactSignal.length < 2) return false;

  let checked = 0;
  for (let index = cursor; index < lines.length && checked < 3; index += 1) {
    const compactLine = compactStackedMathText(lines[index]);
    if (!compactLine) continue;
    checked += 1;
    if (
      compactLine.includes(compactSignal) ||
      (compactSignal.length >= 2 && compactLine.startsWith(compactSignal))
    ) {
      return true;
    }
  }

  return false;
}

function hasStackedOcrMathFragments(value) {
  const lines = stringValue(value).split(/\r?\n/);
  let count = 0;
  let signal = "";

  for (const line of lines) {
    if (isStackedMathFragmentLine(line)) {
      count += 1;
      signal += cleanStackedMathLine(line);
      if (count >= 3 && hasStackedMathSignal(signal)) {
        return true;
      }
      continue;
    }
    if (!cleanStackedMathLine(line)) continue;
    count = 0;
    signal = "";
  }

  return false;
}

function stripStackedOcrMathFragments(value) {
  const lines = stringValue(value).split(/\r?\n/);
  const kept = [];

  for (let index = 0; index < lines.length;) {
    if (!isStackedMathFragmentLine(lines[index])) {
      kept.push(lines[index]);
      index += 1;
      continue;
    }

    const start = index;
    let cursor = index;
    let fragmentCount = 0;
    let signal = "";
    while (cursor < lines.length) {
      const line = lines[cursor];
      if (!cleanStackedMathLine(line)) {
        cursor += 1;
        continue;
      }
      if (!isStackedMathFragmentLine(line)) break;
      fragmentCount += 1;
      signal += cleanStackedMathLine(line);
      cursor += 1;
    }

    const hasRenderedDuplicate = hasRenderedDuplicateAfter(lines, cursor, signal);
    const isShortPrefixDuplicate = fragmentCount === 1 && compactStackedMathText(signal).length >= 2;
    if ((fragmentCount >= 3 || isShortPrefixDuplicate) && hasRenderedDuplicate) {
      if (kept.length && cleanStackedMathLine(kept[kept.length - 1]) === "") {
        kept.pop();
      }
      index = cursor;
      continue;
    }

    kept.push(...lines.slice(start, cursor));
    index = cursor;
  }

  return kept.join("\n").replace(/\n{3,}/g, "\n\n");
}

function normalizeMathUnicode(value) {
  const replacements = [
    [/−/g, "-"],
    [/≤/g, "\\le "],
    [/≥/g, "\\ge "],
    [/≠/g, "\\ne "],
    [/≈/g, "\\approx "],
    [/∞/g, "\\infty "],
    [/∈/g, "\\in "],
    [/∉/g, "\\notin "],
    [/∪/g, "\\cup "],
    [/∩/g, "\\cap "],
    [/∅/g, "\\emptyset "],
    [/×/g, "\\times "],
    [/÷/g, "\\div "],
    [/⋅|·/g, "\\cdot "],
    [/±/g, "\\pm "],
    [/<=/g, "\\le "],
    [/>=/g, "\\ge "],
    [/!=/g, "\\ne "],
    [/⇒|=>/g, "\\Rightarrow "],
    [/⇔|<=>/g, "\\Leftrightarrow "],
    [/→|->/g, "\\to "],
    [/√/g, "\\sqrt"],
    [/∑/g, "\\sum "],
    [/∫/g, "\\int "],
    [/π/g, "\\pi "],
    [/α/g, "\\alpha "],
    [/β/g, "\\beta "],
    [/γ/g, "\\gamma "],
    [/δ/g, "\\delta "],
    [/θ/g, "\\theta "],
    [/λ/g, "\\lambda "],
    [/μ/g, "\\mu "],
  ];
  return replacements.reduce((text, [pattern, replacement]) => (
    text.replace(pattern, () => replacement)
  ), stringValue(value));
}

function normalizeEscapedLatexBackslashes(value) {
  return stringValue(value).replace(
    /\\{2,}(?=(?:sin|cos|tan|cot|sec|csc|log|ln|lg|sqrt|lim|sum|int|vec|bar|hat|tilde|frac|binom|mathbb|mathrm|operatorname|text|begin|end|rightleftharpoons|leftrightharpoons|left|right|infty|emptyset|notin|setminus|cup|cap|times|div|cdot|quad|qquad|circ|pi|alpha|beta|gamma|delta|theta|lambda|mu|Delta|partial|pm|Rightarrow|Leftrightarrow|to|leq|geq|neq|approx)\b|\(|\)|\[|\]|\{|\}|[,;!:])/g,
    "\\",
  );
}

const LATEX_TWO_ARG_COMMANDS = new Set(["frac", "dfrac", "tfrac", "binom"]);

function readLatexGroup(input, index) {
  let cursor = index;
  while (/\s/.test(input[cursor] || "")) cursor += 1;

  const escaped = input[cursor] === "\\" && input[cursor + 1] === "{";
  const normal = input[cursor] === "{";
  if (!escaped && !normal) return null;

  if (escaped) {
    const start = cursor + 2;
    let depth = 1;
    for (let i = start; i < input.length; i += 1) {
      if (input[i] === "\\" && input[i + 1] === "{") {
        depth += 1;
        i += 1;
        continue;
      }
      if (input[i] === "\\" && input[i + 1] === "}") {
        depth -= 1;
        if (depth === 0) return { body: input.slice(start, i), end: i + 2 };
        i += 1;
      }
    }
    return null;
  }

  const start = cursor + 1;
  let depth = 1;
  for (let i = start; i < input.length; i += 1) {
    if (input[i] === "\\") {
      i += 1;
      continue;
    }
    if (input[i] === "{") depth += 1;
    if (input[i] === "}") {
      depth -= 1;
      if (depth === 0) return { body: input.slice(start, i), end: i + 1 };
    }
  }
  return null;
}

function normalizeEscapedLatexGroupBraces(value) {
  const input = stringValue(value);
  let out = "";

  for (let index = 0; index < input.length;) {
    const commandMatch = input.slice(index).match(/^\\(dfrac|tfrac|frac|binom|sqrt|mathbb|mathrm|mathbf|operatorname|text)\b/);
    if (!commandMatch) {
      out += input[index];
      index += 1;
      continue;
    }

    const command = commandMatch[1];
    const first = readLatexGroup(input, index + commandMatch[0].length);
    if (!first) {
      out += commandMatch[0];
      index += commandMatch[0].length;
      continue;
    }

    if (LATEX_TWO_ARG_COMMANDS.has(command)) {
      const second = readLatexGroup(input, first.end);
      if (!second) {
        out += commandMatch[0];
        index += commandMatch[0].length;
        continue;
      }
      out += `\\${command}{${first.body.trim()}}{${second.body.trim()}}`;
      index = second.end;
      continue;
    }

    out += `\\${command}{${first.body.trim()}}`;
    index = first.end;
  }

  return out.replace(/([_^])\\\{([^\\{}]{1,180})\\\}/g, (_, marker, body) => `${marker}{${String(body).trim()}}`);
}

function findMatchingForward(input, openIndex) {
  const open = input[openIndex];
  const close = open === "(" ? ")" : open === "[" ? "]" : "}";
  let depth = 0;

  for (let i = openIndex; i < input.length; i++) {
    if (input[i - 1] === "\\") continue;
    if (input[i] === open) depth++;
    if (input[i] === close) depth--;
    if (depth === 0) return i;
  }

  return -1;
}

function escapeSetLiteralBraces(input) {
  let out = "";
  let cursor = 0;

  while (cursor < input.length) {
    const openIndex = input.indexOf("{", cursor);
    if (openIndex < 0) {
      out += input.slice(cursor);
      break;
    }

    const before = input[openIndex - 1] || "";
    const commandArgPrefix = input.slice(Math.max(0, openIndex - 240), openIndex);
    const isCommandArg =
      /\\(?:frac|dfrac|tfrac|binom|sqrt|mathbb|mathrm|mathbf|operatorname|text|vec|bar|hat|tilde)\s*$/.test(commandArgPrefix) ||
      /\\(?:frac|dfrac|tfrac|binom)\s*\{(?:[^{}]|\{[^{}]*\})*\}\s*$/.test(commandArgPrefix);
    if (before === "\\" || before === "_" || before === "^" || isCommandArg) {
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
    const looksLikeSetLiteral = /[,;，；]/.test(content) && !/[{}]/.test(content) && /\S/.test(content);
    if (looksLikeSetLiteral) {
      out += `${input.slice(cursor, openIndex)}\\{${content}\\}`;
    } else {
      out += input.slice(cursor, closeIndex + 1);
    }
    cursor = closeIndex + 1;
  }

  return out;
}

function normalizeLooseMathSyntax(value) {
  return escapeSetLiteralBraces(normalizeMathUnicode(normalizeEscapedLatexGroupBraces(normalizeEscapedLatexBackslashes(value)))
    .replace(/(^|\n)-(?=\s*[A-Z]\s*(?:\\cap|\\cup|\\setminus)\b)/g, "$1")
    .replace(/(^|[^\\A-Za-z])(sin|cos|tan|cot|sec|csc|ln|lg|log)\b\s*/gi, (_, prefix, fn) => `${prefix}\\${fn.toLowerCase()} `)
    .replace(/\\(sin|cos|tan|cot|sec|csc)\s*-\s*1\b/g, (_, fn) => `\\${fn}^{-1}`)
    .replace(/\\(sin|cos|tan|cot|sec|csc|ln|lg|log)\s+([0-9]+)\s*(?:°|\^?\\?circ|度)/gi, "\\$1 $2^\\circ")
    .replace(/\bsqrt\s*\(([^()]+)\)/gi, "\\sqrt{$1}")
    .replace(/\bsqrt\s+((?:\\[A-Za-z]+|[A-Za-z0-9]+)(?:\^[{]?[A-Za-z0-9]+[}]?)?)/gi, "\\sqrt{$1}")
    .replace(/\\sqrt\s*\(([^()]+)\)/g, "\\sqrt{$1}")
    .replace(/\\sqrt\{\}\s*([A-Za-z0-9\\]+(?:\^\{[^{}]+\})?)/g, "\\sqrt{$1}")
    .replace(/\\sqrt\s*([A-Za-z0-9])\b/g, "\\sqrt{$1}")
    .replace(/\\frac\s*([0-9A-Za-z])\s*(\\[A-Za-z]+)\s*\}?\s*\{?([0-9A-Za-z]+)\}?/g, "\\frac{$1$2}{$3}")
    .replace(/\\frac\{((?:[^{}]|\{[^{}]*\})+)\}\s*([0-9A-Za-z]+)\b/g, "\\frac{$1}{$2}")
    .replace(/\\frac\s*([0-9A-Za-z])\s*\{([0-9A-Za-z]+)\}/g, "\\frac{$1}{$2}")
    .replace(/(^|[^\\}])\b([A-Za-z0-9](?:\^\{[^{}]+\}|\^[A-Za-z0-9])?)\s*\/\s*([+\-]?\d+)\b/g, "$1\\frac{$2}{$3}")
    .replace(/\\frac\s*([A-Za-z0-9])\s*([A-Za-z0-9])\b/g, "\\frac{$1}{$2}")
    .replace(/(^|[\s=([{,;:])([+\-]?\d+)\s*\/\s*([+\-]?\d+)(?=\s*(?:[),.;:\]}]|$))/g, "$1\\frac{$2}{$3}")
    .replace(/\blog\s*_\s*([0-9A-Za-z]+)\s+/gi, "\\log_{$1} ")
    .replace(/\blog([2-9])\s+/gi, "\\log_{$1} ")
    .replace(/([=+\-*/(,]\s*)([2-9])\s+([0-9])(?=\s*(?:[=+\-*/),，。;；]|$))/g, "$1$2^{$3}")
    .replace(/\^\s*([+\-]?\d+|[A-Za-z]|\\[A-Za-z]+)(?![A-Za-z])/g, "^{$1}")
    .replace(/\b([A-Za-z])\s*(?:\\in)\s*([NZQR])\b/g, "$1\\in \\mathbb{$2}")
    .replace(/\bU\b(?=\s*[\[(])/g, "\\cup "));
}

function isMostlyMath(value) {
  const text = stringValue(value).replace(LATEX_COMMAND_RE, "").replace(/\s/g, "");
  if (!text) return true;
  const words = (text.match(/[A-Za-zÀ-ỹ]{2,}/g) || []).filter(word => !MATH_WORD_RE.test(word));
  if (words.length > 0) return false;
  const mathChars = (text.match(/[A-Za-z0-9{}()[\]^_+\-*/=<>.,;|\\!−–⋅·]/g) || []).length;
  return mathChars / Math.max(text.length, 1) >= 0.75;
}

function isLikelyLooseMathLine(value) {
  const normalized = normalizeLooseMathSyntax(value);
  if (!normalized) return false;
  if (!/[=+\-*/^_<>]|\\(?:frac|sqrt|ne|le|ge|times|div|cdot|sin|cos|tan|cot|sec|csc|log|ln|lg|lim|sum|int|mathbb|infty|emptyset|in|notin|setminus|cup|cap|binom|circ|Rightarrow|Leftrightarrow|to|approx)\b/.test(normalized)) return false;
  return isMostlyMath(normalized);
}

function wrapLooseMathLines(input) {
  return stringValue(input)
    .split("\n")
    .map((line) => {
      if (!line.trim() || line.includes("$") || line.includes("\\(") || line.includes("\\[")) return line;
      const labeledMath = line.match(/^(\s*[^:：]{1,50}[:：])\s*(.+)$/);
      if (labeledMath && /[A-Za-zÀ-ỹ\u4e00-\u9fff]/.test(labeledMath[1])) {
        const math = labeledMath[2].trim();
        return isLikelyLooseMathLine(math)
          ? `${labeledMath[1]}\n\\(${normalizeLooseMathSyntax(math).trim()}\\)`
          : line;
      }
      return isLikelyLooseMathLine(line) ? `\\(${normalizeLooseMathSyntax(line).trim()}\\)` : line;
    })
    .join("\n");
}

function normalizeMathSegments(input) {
  return stringValue(input)
    .split(WRAPPED_MATH_RE)
    .map((part) => {
      if (!part) return part;
      if (part.startsWith("\\(") && part.endsWith("\\)")) {
        return `\\(${normalizeLooseMathSyntax(part.slice(2, -2)).trim()}\\)`;
      }
      if (part.startsWith("\\[") && part.endsWith("\\]")) {
        return `\\[${normalizeLooseMathSyntax(part.slice(2, -2)).trim()}\\]`;
      }
      if (part.startsWith("$$") && part.endsWith("$$")) {
        return `\\[${normalizeLooseMathSyntax(part.slice(2, -2)).trim()}\\]`;
      }
      if (part.startsWith("$") && part.endsWith("$")) {
        return `\\(${normalizeLooseMathSyntax(part.slice(1, -1)).trim()}\\)`;
      }
      return wrapLooseMathLines(normalizeLooseMathSyntax(part));
    })
    .join("");
}

function repairLatexControlChars(value) {
  return stringValue(value)
    .replace(/([A-Za-z0-9}\\)])\n(?:e)\b/g, (_, prefix) => `${prefix}\\ne`)
    .replace(/([A-Za-z0-9}\\)])\n(?:otin)\b/g, (_, prefix) => `${prefix}\\notin`)
    .replace(/([A-Za-z0-9}\\)])\t(?:imes)\b/g, (_, prefix) => `${prefix}\\times`)
    .replace(/([A-Za-z0-9}\\)])\t(?:heta)\b/g, (_, prefix) => `${prefix}\\theta`)
    .replace(/([A-Za-z0-9}\\)])\t(?:o)\b/g, (_, prefix) => `${prefix}\\to`);
}

function repairMalformedInlineDollarDelimiters(value) {
  return stringValue(value)
    .replace(/\$\$([^$\n]{1,240}?)\$(?!\$)/g, (_, formula) => `\\(${String(formula).trim()}\\)`)
    .replace(/\$\$([^$\n]{1,240}?)(?=(?:[。.;]|$|\n))/g, (_, formula) => `\\(${String(formula).trim()}\\)`)
    .replace(/\$\$?/g, (match, offset, whole) => {
    const before = whole.slice(0, offset);
    const after = whole.slice(offset + match.length);
    const lineBefore = before.slice(before.lastIndexOf("\n") + 1);
    const nextNewline = after.indexOf("\n");
    const lineAfter = nextNewline >= 0 ? after.slice(0, nextNewline) : after;
    const isLineStart = lineBefore.trim().length === 0;
    const isLineEnd = lineAfter.trim().length === 0;

    if (match === "$$" && (isLineStart || isLineEnd)) return match;

    const prev = before.match(/\S\s*$/)?.[0]?.trim() || "";
    const next = after.match(/^\s*\S/)?.[0]?.trim() || "";
    const hasPairedDollarOnLine = match === "$" && (/^[^\n$]*\$/.test(after) || /\$[^\n$]*$/.test(before));
    if (hasPairedDollarOnLine) return match;

    const touchesMathOperator =
      /[=<>+\-*/({[,;:|]$/.test(prev) ||
      /^[=<>+\-*/)}\],.;:|]/.test(next) ||
      /\\(?:Rightarrow|Leftrightarrow|to)\s*$/.test(before) ||
      /^\\(?:Rightarrow|Leftrightarrow|to)\b/.test(after.trimStart());

    if (touchesMathOperator) return "";
    return match;
  });
}

function wrapRawFormulaRuns(value) {
  return stringValue(value)
    .split(WRAPPED_MATH_RE)
    .map((part) => {
      if (
        !part ||
        part.startsWith("\\(") ||
        part.startsWith("\\[") ||
        part.startsWith("$$") ||
        part.startsWith("$")
      ) return part;

      return part.replace(
        /(^|[\s:：为是得])([A-Za-z][A-Za-z0-9_']*\s*(?:=|<|>|\\le|\\ge|\\ne|\\approx)\s*[^。；;，,\n]{1,180})/g,
        (match, prefix, formula) => {
          const raw = stringValue(formula).trim();
          if (!/[=<>^_\\/]|\\[A-Za-z]+|\d|sin|cos|tan|log|sqrt|frac|theta|alpha|beta|gamma|mu|pi/i.test(raw)) {
            return match;
          }

          const normalized = normalizeLooseMathSyntax(raw).trim();
          if (!normalized || !isMostlyMath(normalized)) return match;
          return `${prefix}\\(${normalized}\\)`;
        },
      );
    })
    .join("");
}

function normalizeStoredFormulaText(value, options = {}) {
  const input = repairMalformedInlineDollarDelimiters(stripStackedOcrMathFragments(stringValue(value).replace(/\0/g, "")));
  if (!input.trim()) return "";

  let out = wrapRawFormulaRuns(normalizeMathSegments(repairOcrMathArtifacts(input)))
    .replace(/\\{2,}(?=(?:sin|cos|tan|cot|sec|csc|log|ln|lg|sqrt|lim|sum|int|vec|bar|hat|tilde|frac|binom|mathbb|mathrm|operatorname|text|begin|end|rightleftharpoons|leftrightharpoons|left|right|infty|emptyset|notin|setminus|cup|cap|times|div|cdot|quad|qquad|circ|pi|alpha|beta|gamma|delta|theta|lambda|mu|Delta|partial|pm|Rightarrow|Leftrightarrow|to|leq|geq|neq|approx)\b|\(|\)|\[|\]|\{|\}|[,;!:])/g, "\\")
    .replace(/\\right\s+leftharpoons/g, "\\rightleftharpoons")
    .replace(/\\left\s+right/g, "\\leftright")
    .replace(/\\le\s+ft/g, "\\left")
    .replace(/\\in\s+t/g, "\\int")
    .replace(/\\frac\s*([A-Za-z0-9])\s*([A-Za-z0-9])\b/g, "\\frac{$1}{$2}")
    .replace(/([A-Za-z0-9])\s*\\frac\{\s*\^\{?([^{}]+)\}?\s*\}\{/g, "\\frac{$1^{$2}}{")
    .replace(/\\sqrt\s*([A-Za-z0-9])\b/g, "\\sqrt{$1}")
    .replace(/\(\[\)\/\(([^)]*)\)\)/g, "[$1)")
    .replace(/\(\(\)\/\(([^)]*)\)\)/g, "($1)")
    .replace(/\bC\s*(?:\u211d|R)\s*\(/g, "C_{\\mathbb{R}}(")
    .replace(/\bC\s*(?:\u211d|R)\b/g, "C_{\\mathbb{R}}")
    .replace(/\\cup|\u222a/g, "\\cup")
    .replace(/\\cap|\u2229/g, "\\cap")
    .replace(/\\setminus|\u2216/g, "\\setminus")
    .replace(/\b([A-Za-z])\s*[\u20d7]+/g, "\\vec{$1}")
    .replace(/(\d)\s*o\b/g, "$1°")
    .replace(/\s+([,.;:\uff0c\u3002\uff1b\uff1a\uff09)\]])/g, "$1")
    .replace(/([\uff08(\[])\s+/g, "$1");

  out = out
    .replace(/(^|\n)([^\n$]*\\(?:sin|cos|tan|cot|sec|csc|log|ln|lg|sqrt|frac|left|right|pi|cap|cup|setminus)[^\n$]*)\$(?=\n|$)/g, (_, prefix, formula) => `${prefix}\\(${String(formula).trim()}\\)`)
    .replace(/(^|\n)\$([^\n$]*\\(?:sin|cos|tan|cot|sec|csc|log|ln|lg|sqrt|frac|left|right|pi|cap|cup|setminus)[^\n$]*)(?=\n|$)/g, (_, prefix, formula) => `${prefix}\\(${String(formula).trim()}\\)`);

  if (options.explanation) {
    out = out
      .replace(/\\n/g, "\n")
      .replace(/\r\n?/g, "\n")
      .replace(/\s*((?:Công thức|Thay|Kiểm tra|Kết luận|Chọn|Vậy)\s*[:：])/gi, "\n$1")
      .replace(/\s*((?:Suy ra)\s*[:：])/gi, "\n$1")
      .replace(/\s*((?:步骤|步驟|Bước)\s*\d+\s*(?:[（(][^）)]{1,24}[）)])?\s*[:：])/gi, "\n$1")
      .replace(/\s*(=>|⇒|\\Rightarrow)\s*/g, "\n$1 ")
      .replace(/([。.;；])\s*(?=(?:过点|過點|设直线|設直線|考虑|考慮|由|由于|因|当|比較|比较|代入|验证|驗證|因此|所以|故|选|答案|解析|得|Suy ra|Vậy|n\s*=))/g, "$1\n")
      .replace(/([:：])\s*(?=(?:[A-Za-z0-9\\(√]|\\log|\\frac|\\sqrt))/g, "$1\n");
  }

  return repairLatexControlChars(compactWhitespace(repairLatexControlChars(out)));
}

function isSuspiciousFormulaText(value) {
  const text = stringValue(value);
  if (!text) return false;

  const openInline = (text.match(/\\\(/g) || []).length;
  const closeInline = (text.match(/\\\)/g) || []).length;
  const openDisplay = (text.match(/\\\[/g) || []).length;
  const closeDisplay = (text.match(/\\\]/g) || []).length;

  return (
    openInline !== closeInline ||
    openDisplay !== closeDisplay ||
    /\\(?:frac|sqrt|left|right)\s+(?=[A-Za-z])/i.test(text) ||
    /\\(?:le\s+ft|in\s+t|right\s+leftharpoons)/i.test(text) ||
    /\$\$?/.test(text)
  );
}

function normalizeField(value, options = {}) {
  const before = stringValue(value).trim();
  const stackedCleanup = hasStackedOcrMathFragments(before);
  const after = normalizeStoredFormulaText(before, options);
  if (before === after) {
    return { before, after, changed: false, suspicious: isSuspiciousFormulaText(after) };
  }

  const beforeLen = Math.max(before.length, 1);
  const ratio = after.length / beforeLen;
  const safe = ratio >= (stackedCleanup ? 0.25 : 0.5) && ratio <= 1.8 && !/<[^>]+>/.test(after);
  const suspicious = !safe || isSuspiciousFormulaText(after);
  return { before, after, changed: safe && !suspicious, suspicious };
}

function normalizeFixValue(value, options = {}) {
  const normalized = normalizeField(value, options);
  return normalized.changed ? normalized.after : normalized.before;
}

function normalizeExplanationValue(value) {
  const before = stringValue(value).trim();
  if (!before) return "";
  const after = normalizeStoredFormulaText(before, { explanation: true });
  if (!after || /<[^>]+>/.test(after)) return before;

  const ratio = after.length / Math.max(before.length, 1);
  if (ratio < 0.2 || ratio > 2.4) return before;
  return after;
}

function pushChange(changes, question, field, before, after) {
  changes.push({
    questionId: question.id,
    questionNumber: question.question_number,
    field,
    before,
    after,
  });
}

function normalizeLinkedOptions(rawOptions) {
  if (!rawOptions) return { value: rawOptions, changes: [], warnings: [] };

  const options = typeof rawOptions === "string" ? JSON.parse(rawOptions) : rawOptions;
  if (!Array.isArray(options)) return { value: rawOptions, changes: [], warnings: [] };

  const changes = [];
  const warnings = [];
  const nextOptions = options.map((option, index) => {
    const next = { ...option };
    for (const key of ["text", "textCn"]) {
      const normalized = normalizeField(option?.[key]);
      if (normalized.changed) {
        next[key] = normalized.after;
        changes.push({ index, field: key, before: normalized.before, after: normalized.after });
      } else if (normalized.suspicious) {
        warnings.push({ index, field: key, value: normalized.before });
      }
    }
    return next;
  });

  return { value: nextOptions, changes, warnings };
}

function parseJsonValue(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

async function normalizeExamFormulas(client, examId, options = {}) {
  const apply = options.apply !== false;
  const questionsResult = await client.query(
    `SELECT id, question_number, question_text, question_text_cn, explanation, explanation_cn, passage_text, linked_options
     FROM questions
     WHERE exam_id = $1 AND deleted_at IS NULL
     ORDER BY question_number, id`,
    [examId],
  );
  const answersResult = await client.query(
    `SELECT a.id, a.question_id, a.answer_key, a.answer_text, a.answer_text_cn, q.question_number
     FROM answers a
     JOIN questions q ON q.id = a.question_id
     WHERE q.exam_id = $1 AND q.deleted_at IS NULL
     ORDER BY q.question_number, a.answer_key`,
    [examId],
  );

  const changes = [];
  const warnings = [];

  for (const question of questionsResult.rows) {
    const updates = [];
    const params = [];

    for (const field of ["question_text", "question_text_cn", "passage_text"]) {
      const normalized = normalizeField(question[field]);
      if (normalized.changed) {
        params.push(normalized.after);
        updates.push(`${field} = $${params.length}`);
        pushChange(changes, question, field, normalized.before, normalized.after);
      } else if (normalized.suspicious) {
        warnings.push({
          questionId: question.id,
          questionNumber: question.question_number,
          field,
          message: "Công thức còn nghi lỗi, cần xem tay.",
          value: normalized.before,
        });
      }
    }

    for (const field of ["explanation", "explanation_cn"]) {
      const normalized = normalizeField(question[field], { explanation: true });
      if (normalized.changed) {
        params.push(normalized.after);
        updates.push(`${field} = $${params.length}`);
        pushChange(changes, question, field, normalized.before, normalized.after);
      } else if (normalized.suspicious) {
        warnings.push({
          questionId: question.id,
          questionNumber: question.question_number,
          field,
          message: "Lời giải còn nghi lỗi công thức, cần xem tay.",
          value: normalized.before,
        });
      }
    }

    if (question.linked_options) {
      try {
        const linked = normalizeLinkedOptions(question.linked_options);
        if (linked.changes.length) {
          params.push(JSON.stringify(linked.value));
          updates.push(`linked_options = $${params.length}`);
          for (const change of linked.changes) {
            pushChange(changes, question, `linked_options.${change.index}.${change.field}`, change.before, change.after);
          }
        }
        for (const warning of linked.warnings) {
          warnings.push({
            questionId: question.id,
            questionNumber: question.question_number,
            field: `linked_options.${warning.index}.${warning.field}`,
            message: "Lựa chọn điền từ còn nghi lỗi công thức, cần xem tay.",
            value: warning.value,
          });
        }
      } catch (error) {
        warnings.push({
          questionId: question.id,
          questionNumber: question.question_number,
          field: "linked_options",
          message: "Không đọc được linked_options để chuẩn hóa.",
        });
      }
    }

    if (apply && updates.length) {
      params.push(question.id);
      await client.query(
        `UPDATE questions SET ${updates.join(", ")} WHERE id = $${params.length}`,
        params,
      );
    }
  }

  for (const answer of answersResult.rows) {
    const updates = [];
    const params = [];
    for (const field of ["answer_text", "answer_text_cn"]) {
      const normalized = normalizeField(answer[field]);
      if (normalized.changed) {
        params.push(normalized.after);
        updates.push(`${field} = $${params.length}`);
        changes.push({
          answerId: answer.id,
          questionId: answer.question_id,
          questionNumber: answer.question_number,
          answerKey: answer.answer_key,
          field,
          before: normalized.before,
          after: normalized.after,
        });
      } else if (normalized.suspicious) {
        warnings.push({
          answerId: answer.id,
          questionId: answer.question_id,
          questionNumber: answer.question_number,
          answerKey: answer.answer_key,
          field,
          message: "Đáp án còn nghi lỗi công thức, cần xem tay.",
          value: normalized.before,
        });
      }
    }

    if (apply && updates.length) {
      params.push(answer.id);
      await client.query(
        `UPDATE answers SET ${updates.join(", ")} WHERE id = $${params.length}`,
        params,
      );
    }
  }

  if (apply && changes.length) {
    await client.query("UPDATE exams SET updated_at = NOW() WHERE id = $1", [examId]);
  }

  return {
    examId: Number(examId),
    questionCount: questionsResult.rowCount,
    answerCount: answersResult.rowCount,
    changedCount: changes.length,
    warningCount: warnings.length,
    changes: changes.slice(0, 80),
    warnings: warnings.slice(0, 80),
  };
}

function stripAiNoise(raw) {
  return stringValue(raw)
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function parseAiJson(raw) {
  const text = stripAiNoise(raw);
  try {
    return JSON.parse(text);
  } catch {}

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {}
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {}
  }
  return null;
}

function getAiItems(parsed, keys = [], singleFields = []) {
  if (!parsed) return [];
  if (Array.isArray(parsed)) return parsed;

  for (const key of keys) {
    const value = parsed?.[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object" && singleFields.some(field => !isBlankText(value[field]))) {
      return [value];
    }
  }

  for (const key of ["data", "result", "response", "item"]) {
    const value = parsed?.[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") {
      for (const childKey of keys) {
        if (Array.isArray(value?.[childKey])) return value[childKey];
      }
      if (singleFields.some(field => !isBlankText(value[field]))) return [value];
    }
  }

  if (singleFields.some(field => !isBlankText(parsed[field]))) return [parsed];
  return [];
}

function normalizeReviewStatus(value) {
  const status = stringValue(value).toLowerCase();
  if (["ok", "question_issue", "formula_issue", "answer_issue", "explanation_issue", "needs_review"].includes(status)) {
    return status;
  }
  return "needs_review";
}

function collectImportedQuestions(items) {
  const questions = [];
  (items || []).forEach((item, itemIndex) => {
    if (item?.itemType === "reading_group") {
      (item.subQuestions || []).forEach((question, subIndex) => {
        questions.push({
          path: `${itemIndex}.subQuestions.${subIndex}`,
          label: `Mục ${itemIndex + 1}.${subIndex + 1}`,
          itemIndex,
          subIndex,
          kind: "reading",
          contextText: item.passageText || "",
          contextImageUrl: item.passageImageUrl || "",
          question,
        });
      });
      return;
    }

    if (item?.itemType === "fill_blank_group") {
      (item.subItems || []).forEach((question, subIndex) => {
        questions.push({
          path: `${itemIndex}.subItems.${subIndex}`,
          label: `Mục ${itemIndex + 1}.${subIndex + 1}`,
          itemIndex,
          subIndex,
          kind: "fill_blank",
          contextText: item.passageText || "",
          contextImageUrl: item.passageImageUrl || "",
          question: {
            ...question,
            answers: item.linkedOptions || [],
            correctAnswer: question.correctAnswerKey,
          },
        });
      });
      return;
    }

    questions.push({
      path: `${itemIndex}`,
      label: `Mục ${itemIndex + 1}`,
      itemIndex,
      kind: "single",
      contextText: item.passageText || "",
      contextImageUrl: item.passageImageUrl || "",
      question: item,
    });
  });
  return questions.slice(0, REVIEW_MAX_ITEMS);
}

function buildReviewPrompt(batch, context = {}) {
  const payload = batch.map((entry, index) => {
    const q = entry.question || {};
    return {
      index,
      path: entry.path,
      label: entry.label,
      contextText: entry.contextText || q.passageText || q.passage_text || "",
      contextImageUrl: entry.contextImageUrl || q.passageImageUrl || q.passage_image_url || "",
      questionText: q.questionText || "",
      questionTextCn: q.questionTextCn || "",
      questionImageUrl: q.imageUrl || q.image_url || "",
      answers: (q.answers || []).map((answer, answerIndex) => ({
        key: answer.key || ANSWER_KEYS[answerIndex],
        text: answer.text || answer.answer_text || "",
        textCn: answer.textCn || answer.answer_text_cn || "",
        imageUrl: answer.imageUrl || answer.image_url || "",
      })),
      currentCorrectAnswer: q.correctAnswer || q.correctAnswerKey || "",
      explanation: q.explanation || "",
      explanationCn: q.explanationCn || "",
      explanationImageUrl: q.explanationImageUrl || q.explanation_image_url || "",
    };
  });

  return `Bạn là giáo viên soát đề CSCA. Hãy giải lại từng câu từ đầu, không tin đáp án/lời giải cũ.

Yêu cầu:
- Chỉ trả JSON hợp lệ, không markdown.
- Return exactly one review object for every input item. Never skip index 0 or the first questions in a batch.
- First solve the question independently from questionText/questionTextCn/contextText/options, then compare with currentCorrectAnswer and current explanations.
- If currentCorrectAnswer is empty but the answer can be inferred confidently from text/options/context, use status="answer_issue" and suggestedCorrectAnswer.
- For Chinese language exams, preserve Chinese meaning, pinyin, word-bank context, and reading passage context. Do not translate the question while reviewing.
- Không tự sửa nội dung đề trong JSON.
- contextText là đoạn đọc hiểu/đoạn điền từ nếu có; phải dùng khi giải câu con.
- Nếu có imageUrl/contextImageUrl/explanationImageUrl mà ảnh cần để giải nhưng bạn không đọc được ảnh, status="needs_review".
- Nếu đáp án hiện tại đúng, status="ok".
- Nếu công thức/LaTeX/OCR làm câu khó hiểu hoặc sai, status="formula_issue".
- Soát kỹ lỗi format toán: thiếu dấu \\, thiếu ngoặc {}, thiếu delimiter, tập hợp {1;2}, sin/cos/log/sqrt/int/frac viết sai, dấu ≤ ≥ ≠ ∈ ∩ ∪ bị OCR sai.
- Chỉ báo formula_issue khi lỗi format có thể làm hiển thị/sai nghĩa; không bắt lỗi style nhỏ.
- Nếu đáp án hiện tại có vẻ sai, status="answer_issue" và đưa suggestedCorrectAnswer.
- Nếu lời giải sai, thiếu, hoặc trình bày không khớp đáp án, status="explanation_issue".
- If explanation is only Chinese in explanation, or only Vietnamese in explanationCn, mark explanation_issue so the fix/explanation step can put each language into the correct field.
- If formula/display format is broken but the answer is still clear, prefer formula_issue over answer_issue.
- Nếu thiếu hình/dữ kiện hoặc không chắc, status="needs_review".
- Nếu đề bài/câu hỏi bị sai chữ, thiếu dữ kiện, OCR lệch nghĩa, trộn ngôn ngữ hoặc mất đoạn quan trọng, dùng status="question_issue" và ghi rõ vào questionIssues.
- confidence từ 0 đến 1. Câu đỏ chỉ khi confidence >= 0.75.

Môn/ngữ cảnh: ${context.subject || "CSCA đa môn"}.

Trả dạng:
{
  "reviews": [
    {
      "index": 0,
      "path": "0",
      "status": "ok|question_issue|formula_issue|answer_issue|explanation_issue|needs_review",
      "confidence": 0.9,
      "suggestedCorrectAnswer": "A",
      "questionIssues": ["..."],
      "formulaIssues": ["..."],
      "explanationIssues": ["..."],
      "note": "ngắn gọn tiếng Việt"
    }
  ]
}

Dữ liệu:
${JSON.stringify(payload)}`;
}

function buildFallbackReview(entry, note) {
  return {
    path: entry.path,
    label: entry.label,
    questionId: entry.questionId,
    questionNumber: entry.questionNumber,
    questionType: entry.questionType,
    parentQuestionId: entry.parentQuestionId,
    status: "needs_review",
    confidence: 0,
    suggestedCorrectAnswer: "",
    questionIssues: [],
    formulaIssues: [],
    explanationIssues: [],
    note,
  };
}

function getReviewErrorDiagnostic(error) {
  const errorCode = error?.message || "AI_REVIEW_ERROR";
  const providerMessage = stringValue(error?.providerMessage).slice(0, 500);
  const message = providerMessage || (
    errorCode === "RATE_LIMITED"
      ? "AI đang bị giới hạn, thử lại sau."
      : errorCode === "AI_TIMEOUT"
        ? "AI soát đề quá thời gian."
        : stringValue(error?.message || "AI review lỗi, cần chạy lại.").slice(0, 500)
  );

  return {
    errorCode,
    message,
    retryAfter: Number.isFinite(error?.retryAfter) ? error.retryAfter : undefined,
    providerStatus: Number.isFinite(error?.providerStatus) ? error.providerStatus : undefined,
    providerCode: error?.providerCode,
  };
}

function getBatchLabelRange(batch) {
  const labels = batch.map(entry => entry.label).filter(Boolean);
  if (!labels.length) return "";
  if (labels.length === 1) return labels[0];
  return `${labels[0]} - ${labels[labels.length - 1]}`;
}

function throwIfAiRequestAborted(context = {}) {
  if (!context.signal?.aborted) return;
  throw new Error("AI_REQUEST_ABORTED");
}

async function reviewQuestionEntriesWithAI(sourceEntries, context = {}) {
  const entries = (sourceEntries || []).slice(0, REVIEW_MAX_ITEMS);
  if (!entries.length) {
    return {
      summary: {
        total: 0,
        ok: 0,
        issues: 0,
        aiCalls: 0,
        failedBatches: 0,
        invalidBatches: 0,
        model: getReviewModel(),
        questionTotal: 0,
        reviewedCount: 0,
      },
      reviews: [],
      diagnostics: [{
        batch: 0,
        range: "Không có câu hợp lệ",
        labels: [],
        paths: [],
        model: getReviewModel(),
        status: "no_questions",
        message: "Không gom được câu hỏi hợp lệ từ dữ liệu này nên chưa gọi model.",
      }],
    };
  }

  const reviews = [];
  const diagnostics = [];
  const batchSize = Math.max(1, Math.min(12, REVIEW_BATCH_SIZE || 6));
  const parallelBatches = Math.max(1, Math.min(3, REVIEW_PARALLEL_BATCHES || 3));
  const batches = [];
  for (let i = 0; i < entries.length; i += batchSize) {
    batches.push({
      batch: entries.slice(i, i + batchSize),
      batchNumber: Math.floor(i / batchSize) + 1,
      model: getReviewModel(),
    });
  }

  async function reviewBatch(batchJob) {
    throwIfAiRequestAborted(context);
    const { batch, batchNumber, model } = batchJob;
    const startedAt = Date.now();
    const prompt = buildReviewPrompt(batch, context);
    const inputTokenEstimate = estimateTokenCount(prompt);
    try {
      const raw = await aiService.callAdminExamAI(prompt, {
        model,
        models: getReviewModels(),
        fallbackOnTimeout: false,
        temperature: 0.1,
        maxTokens: REVIEW_MAX_TOKENS,
        timeout: REVIEW_TIMEOUT_MS,
        signal: context.signal,
      });
      const parsed = parseAiJson(raw);
      const batchReviews = Array.isArray(parsed?.reviews) ? parsed.reviews : [];
      const outputTokenEstimate = estimateTokenCount(raw);
      diagnostics.push({
        batch: batchNumber,
        range: getBatchLabelRange(batch),
        paths: batch.map(entry => entry.path),
        labels: batch.map(entry => entry.label),
        model,
        status: batchReviews.length ? "ok" : "invalid_response",
        durationMs: Date.now() - startedAt,
        inputTokenEstimate,
        outputTokenEstimate,
        tokenEstimate: inputTokenEstimate + outputTokenEstimate,
        maxOutputTokens: REVIEW_MAX_TOKENS,
        maxTokenBudget: inputTokenEstimate + REVIEW_MAX_TOKENS,
        returnedReviews: batchReviews.length,
        expectedReviews: batch.length,
        message: batchReviews.length
          ? `AI đã trả ${batchReviews.length}/${batch.length} review.`
          : "AI đã được gọi nhưng phản hồi không có JSON reviews hợp lệ.",
        rawPreview: batchReviews.length ? undefined : stringValue(raw).slice(0, 500),
      });
      if (!batchReviews.length) {
        for (const entry of batch) {
          reviews.push(buildFallbackReview(entry, "AI không trả JSON review hợp lệ cho batch này. Cần chạy lại hoặc xem log."));
        }
        return;
      }
      for (const entry of batch) {
        const localIndex = batch.indexOf(entry);
        const review = findAiItemForEntry(batchReviews, entry, localIndex);
        if (!review) {
          reviews.push(buildFallbackReview(entry, "AI không trả review cho câu này. Xem log tổng hợp phía trên."));
          continue;
        }
        reviews.push({
          path: entry.path,
          label: entry.label,
          questionId: entry.questionId,
          questionNumber: entry.questionNumber,
          questionType: entry.questionType,
          parentQuestionId: entry.parentQuestionId,
          status: normalizeReviewStatus(review.status),
          confidence: Math.max(0, Math.min(1, Number(review.confidence) || 0)),
          suggestedCorrectAnswer: stringValue(review.suggestedCorrectAnswer).toUpperCase().slice(0, 1),
          questionIssues: Array.isArray(review.questionIssues) ? review.questionIssues.map(stringValue).filter(Boolean) : [],
          formulaIssues: Array.isArray(review.formulaIssues) ? review.formulaIssues.map(stringValue).filter(Boolean) : [],
          explanationIssues: Array.isArray(review.explanationIssues) ? review.explanationIssues.map(stringValue).filter(Boolean) : [],
          note: stringValue(review.note).slice(0, 600),
        });
      }
    } catch (error) {
      if (error.message === "AI_REQUEST_ABORTED") throw error;
      const diagnostic = {
        batch: batchNumber,
        range: getBatchLabelRange(batch),
        paths: batch.map(entry => entry.path),
        labels: batch.map(entry => entry.label),
        model,
        status: "failed",
        durationMs: Date.now() - startedAt,
        expectedReviews: batch.length,
        inputTokenEstimate,
        tokenEstimate: inputTokenEstimate,
        maxOutputTokens: REVIEW_MAX_TOKENS,
        maxTokenBudget: inputTokenEstimate + REVIEW_MAX_TOKENS,
        ...getReviewErrorDiagnostic(error),
      };
      diagnostics.push(diagnostic);
      console.warn("AI imported exam review batch failed:", diagnostic);
      for (const entry of batch) {
        reviews.push(buildFallbackReview(entry, "AI phát hiện lỗi bị lỗi ở batch này. Cần chạy lại hoặc xem log."));
      }
    }
  }

  for (let i = 0; i < batches.length; i += parallelBatches) {
    throwIfAiRequestAborted(context);
    await Promise.all(batches.slice(i, i + parallelBatches).map(reviewBatch));
  }

  const entryOrder = new Map(entries.map((entry, index) => [entry.path, index]));
  diagnostics.sort((a, b) => (Number(a.batch) || 0) - (Number(b.batch) || 0));
  reviews.sort((a, b) => (
    (entryOrder.get(a.path) ?? Number.MAX_SAFE_INTEGER) -
    (entryOrder.get(b.path) ?? Number.MAX_SAFE_INTEGER)
  ));

  const counts = reviews.reduce((acc, review) => {
    acc.total += 1;
    if (review.status === "ok") acc.ok += 1;
    else acc.issues += 1;
    acc[review.status] = (acc[review.status] || 0) + 1;
    return acc;
  }, { total: 0, ok: 0, issues: 0 });
  counts.aiCalls = diagnostics.filter(item => item.status === "ok" || item.status === "invalid_response").length;
  counts.failedBatches = diagnostics.filter(item => item.status === "failed").length;
  counts.invalidBatches = diagnostics.filter(item => item.status === "invalid_response").length;
  counts.model = getReviewModel();
  counts.questionTotal = entries.length;
  counts.reviewedCount = reviews.length;
  counts.inputTokenEstimate = diagnostics.reduce((sum, item) => sum + (Number(item.inputTokenEstimate) || 0), 0);
  counts.outputTokenEstimate = diagnostics.reduce((sum, item) => sum + (Number(item.outputTokenEstimate) || 0), 0);
  counts.tokenEstimate = diagnostics.reduce((sum, item) => sum + (Number(item.tokenEstimate) || 0), 0);
  counts.maxTokenBudget = diagnostics.reduce((sum, item) => sum + (Number(item.maxTokenBudget) || 0), 0);
  counts.batchSize = batchSize;
  counts.parallelBatches = parallelBatches;
  counts.timeoutMs = REVIEW_TIMEOUT_MS;

  return {
    reviews,
    summary: counts,
    diagnostics,
  };
}

function applyReviewsToImportedItems(items, reviews) {
  const nextItems = JSON.parse(JSON.stringify(items || []));
  for (const review of reviews) {
    const parts = review.path.split(".");
    const itemIndex = Number.parseInt(parts[0], 10);
    const item = nextItems[itemIndex];
    if (!item) continue;

    let target = item;
    if (parts[1] === "subQuestions") target = item.subQuestions?.[Number.parseInt(parts[2], 10)];
    if (parts[1] === "subItems") target = item.subItems?.[Number.parseInt(parts[2], 10)];
    if (!target) continue;

    target.aiReview = review;
    if (review.status !== "ok") {
      const noteParts = [
        `[AI ${review.status}] ${review.note || "Cần kiểm tra lại."}`,
        review.suggestedCorrectAnswer ? `Gợi ý đáp án: ${review.suggestedCorrectAnswer}` : "",
        ...review.formulaIssues.map((issue) => `Công thức: ${issue}`),
        ...review.explanationIssues.map((issue) => `Lời giải: ${issue}`),
      ].filter(Boolean);
      target.reviewNotes = [target.reviewNotes, ...noteParts].filter(Boolean).join("\n");
    }
  }
  return nextItems;
}

async function reviewImportedItemsWithAI(items, context = {}) {
  const entries = collectImportedQuestions(items);
  const result = await reviewQuestionEntriesWithAI(entries, context);
  return {
    items: applyReviewsToImportedItems(items, result.reviews),
    ...result,
  };
}

function getReviewFixTargetEntries(entries, reviews = []) {
  const reviewByPath = new Map();
  for (const review of Array.isArray(reviews) ? reviews : []) {
    if (!review?.path || review.status === "ok") continue;
    reviewByPath.set(review.path, review);
  }

  return entries
    .filter((entry) => reviewByPath.has(entry.path))
    .map((entry) => ({ ...entry, review: reviewByPath.get(entry.path) }))
    .slice(0, REVIEW_MAX_ITEMS);
}

function buildFixPrompt(batch, context = {}) {
  const payload = batch.map((entry, index) => {
    const q = entry.question || {};
    return {
      index,
      path: entry.path,
      label: entry.label,
      questionId: entry.questionId,
      questionNumber: entry.questionNumber,
      review: entry.review,
      contextText: entry.contextText || q.passageText || q.passage_text || "",
      contextImageUrl: entry.contextImageUrl || q.passageImageUrl || q.passage_image_url || "",
      questionText: q.questionText || "",
      questionTextCn: q.questionTextCn || "",
      questionImageUrl: q.imageUrl || q.image_url || "",
      answers: (q.answers || []).map((answer, answerIndex) => ({
        key: answer.key || answer.answer_key || ANSWER_KEYS[answerIndex],
        text: answer.text || answer.answer_text || "",
        textCn: answer.textCn || answer.answer_text_cn || "",
        imageUrl: answer.imageUrl || answer.image_url || "",
      })),
      currentCorrectAnswer: q.correctAnswer || q.correctAnswerKey || "",
      explanation: q.explanation || "",
      explanationCn: q.explanationCn || "",
      explanationImageUrl: q.explanationImageUrl || q.explanation_image_url || "",
    };
  });

  return `Bạn là giáo viên CSCA và kỹ thuật viên LaTeX. Hãy sửa toàn bộ lỗi trong log AI review dưới đây.

Yêu cầu:
- Chỉ trả JSON hợp lệ, không markdown.
- Return exactly one fix object for every input item, even when the result is "skip with note".
- Apply the review log directly. Fix all clear questionIssues, formulaIssues, explanationIssues, and answer issues in the same pass.
- Chỉ sửa những trường cần sửa. Không tự chế đề mới.
- For Chinese CSCA language exams, preserve Chinese text in questionTextCn/textCn/explanationCn and Vietnamese text in questionText/text/explanation. If a field contains the wrong language, move/translate it into the correct field.
- Nếu sửa đáp án, correctAnswer phải là một key đang có trong answers.
- If currentCorrectAnswer is empty and the correct key is clear from the question/options/context, set correctAnswer. If not clear, do not guess; explain in note.
- Nếu sửa công thức/lời giải, trả lại nguyên field đã sửa hoàn chỉnh, giữ đúng ngôn ngữ gốc.
- Công thức toán phải dùng LaTeX chuẩn, bọc inline bằng \\(...\\) khi field có cả chữ và công thức. Tập hợp dùng \\{...\\}; giao/hợp dùng \\cap/\\cup; hàm dùng \\sin, \\cos, \\log, \\sqrt{...}, \\frac{...}{...}.
- Lời giải dài phải xuống dòng theo bước: Công thức, Thay, Suy ra/Kết luận, Chọn.
- Nếu không đủ dữ kiện hoặc cần hình ảnh không đọc được, không sửa bừa; đưa note ngắn.
- Phải trả một object fix cho từng mục trong dữ liệu. Nếu không sửa được mục nào, vẫn trả path/index của mục đó kèm note lý do, không gửi field sửa.
- Note phải nói rõ đã sửa field nào, hoặc lý do chính xác vì sao bỏ qua.
- Ưu tiên sửa lỗi trong review.note, formulaIssues, explanationIssues.
- For display-only OCR/math issues, rewrite the whole broken field cleanly using language understanding, not only regex patterns. Keep semantic meaning unchanged.

Môn/ngữ cảnh: ${context.subject || "CSCA đa môn"}.

Trả dạng:
{
  "fixes": [
    {
      "index": 0,
      "path": "0",
      "confidence": 0.9,
      "correctAnswer": "B",
      "questionText": "chỉ gửi nếu cần thay",
      "questionTextCn": "chỉ gửi nếu cần thay",
      "answers": [{"key": "A", "text": "chỉ gửi nếu cần thay", "textCn": "chỉ gửi nếu cần thay"}],
      "explanation": "chỉ gửi nếu cần thay",
      "explanationCn": "chỉ gửi nếu cần thay",
      "note": "đã sửa gì hoặc vì sao bỏ qua"
    }
  ]
}

Dữ liệu:
${JSON.stringify(payload)}`;
}

function normalizeAiFix(rawFix, entry) {
  const answerKeys = new Set((entry.question?.answers || []).map((answer, index) => (
    stringValue(answer?.key || answer?.answer_key || ANSWER_KEYS[index]).toUpperCase().slice(0, 1)
  )).filter(Boolean));
  const correctAnswer = stringValue(rawFix?.correctAnswer).trim().toUpperCase().slice(0, 1);
  const normalized = {
    path: entry.path,
    label: entry.label,
    questionId: entry.questionId,
    questionNumber: entry.questionNumber,
    questionType: entry.questionType,
    parentQuestionId: entry.parentQuestionId,
    confidence: Math.max(0, Math.min(1, Number(rawFix?.confidence) || 0)),
    correctAnswer: answerKeys.has(correctAnswer) ? correctAnswer : "",
    questionText: normalizeFixValue(rawFix?.questionText),
    questionTextCn: normalizeFixValue(rawFix?.questionTextCn),
    explanation: normalizeExplanationValue(rawFix?.explanation),
    explanationCn: normalizeExplanationValue(rawFix?.explanationCn),
    note: stringValue(rawFix?.note).slice(0, 600),
    answers: [],
  };

  if (Array.isArray(rawFix?.answers)) {
    normalized.answers = rawFix.answers.map((answer) => {
      const key = stringValue(answer?.key).trim().toUpperCase().slice(0, 1);
      if (!answerKeys.has(key)) return null;
      return {
        key,
        text: normalizeFixValue(answer?.text),
        textCn: normalizeFixValue(answer?.textCn),
      };
    }).filter(Boolean);
  }

  return normalized;
}

function isBlankText(value) {
  return !stringValue(value).trim();
}

function normalizeGeneratedExplanation(value) {
  return compactWhitespace(normalizeExplanationValue(value))
    .replace(/\0/g, "")
    .replace(/<[^>]*>/g, "")
    .slice(0, 6000);
}

const VIETNAMESE_DIACRITIC_RE = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
const UNACCENTED_VIETNAMESE_HINT_RE = /\b(phan tich|dieu kien|cong thuc|ket luan|dap an|loi giai|giai thich|tap hop|phan tu|so tap|chon|nen|voi|cua|khong|dung|sai|suy ra|ta co|thay vao)\b/i;
const CJK_TEXT_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

function countMatches(value, regex) {
  return (stringValue(value).match(regex) || []).length;
}

function hasCjkText(value) {
  return CJK_TEXT_RE.test(stringValue(value));
}

function hasVietnameseText(value) {
  return VIETNAMESE_DIACRITIC_RE.test(stringValue(value));
}

function hasLatinExplanationText(value) {
  const text = compactWhitespace(value);
  return /[A-Za-zÀ-ỹ]{3,}/.test(text);
}

function isLikelyChineseExplanation(value) {
  const text = compactWhitespace(value);
  if (!text || !hasCjkText(text)) return false;
  const cjkCount = countMatches(text, /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g);
  const latinCount = countMatches(text, /[A-Za-zÀ-ỹ]/g);
  if (cjkCount >= 4 && !hasVietnameseText(text)) return true;
  return cjkCount >= 8 && cjkCount >= latinCount;
}

function isLikelyVietnameseExplanation(value) {
  const text = compactWhitespace(value);
  if (!text || !hasVietnameseText(text)) return false;
  const cjkCount = countMatches(text, /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g);
  const latinCount = countMatches(text, /[A-Za-zÀ-ỹ]/g);
  return latinCount >= cjkCount;
}

function needsVietnameseExplanationPolish(value) {
  const text = compactWhitespace(value);
  if (text.length < 18) return false;
  if (UNACCENTED_VIETNAMESE_HINT_RE.test(text) && !VIETNAMESE_DIACRITIC_RE.test(text)) return true;
  return /\b(Phan tich|Dieu kien|Cong thuc|Ket luan|Dap an|Loi giai|Giai thich)\s*:/i.test(text);
}

function hasDisplayFormatIssue(value) {
  const text = stringValue(value).trim();
  if (!text) return false;
  const withoutWrapped = text.replace(WRAPPED_MATH_RE, " ");
  return (
    hasStackedOcrMathFragments(text) ||
    isSuspiciousFormulaText(text) ||
    LATEX_COMMAND_RE.test(withoutWrapped) ||
    /(^|[\s:：为是得])[A-Za-z][A-Za-z0-9_']*\s*(?:=|<|>|\\le|\\ge|\\ne|\\approx)\s*[^。；;，,\n]{1,180}/.test(withoutWrapped) ||
    /\\\w+\^\{?\d{2,}\}?\^\{?\\circ\}?/i.test(text) ||
    /\^\{?\\circ\}?\}/i.test(text) ||
    /(?:^|[^\w])(?:sin|cos|tan|sqrt|frac|log|ln)\s*[\^_{(]/i.test(text) ||
    /[{}]\s*(?:的值是|的值为|答案|解析|Giải thích|Phân tích)/i.test(text)
  );
}

function getMissingExplanationTargets(entries) {
  return (entries || []).filter((entry) => {
    const q = entry.question || {};
    if (q.explanationImageUrl || q.explanation_image_url) return false;
    const missingMain = isBlankText(q.explanation) || isLikelyChineseExplanation(q.explanation);
    const missingChinese = isBlankText(q.explanationCn) || isLikelyVietnameseExplanation(q.explanationCn);
    const hasPromptText = !isBlankText(q.questionText) || !isBlankText(q.questionTextCn) || !isBlankText(entry.contextText);
    const hasAnswer = !isBlankText(q.correctAnswer || q.correctAnswerKey);
    return hasPromptText && hasAnswer && (missingMain || missingChinese);
  }).slice(0, EXPLANATION_MAX_ITEMS);
}

function getPolishExplanationTargets(entries) {
  return (entries || []).filter((entry) => {
    const q = entry.question || {};
    return !isBlankText(q.explanation) && needsVietnameseExplanationPolish(q.explanation);
  }).slice(0, REVIEW_MAX_ITEMS);
}

function getDisplayFormatTargets(entries) {
  return (entries || []).filter((entry) => {
    const q = entry.question || {};
    if (hasDisplayFormatIssue(entry.contextText)) return true;
    if (hasDisplayFormatIssue(q.questionText)) return true;
    if (hasDisplayFormatIssue(q.questionTextCn)) return true;
    if (hasDisplayFormatIssue(q.explanation)) return true;
    if (hasDisplayFormatIssue(q.explanationCn)) return true;
    return (q.answers || []).some(answer => (
      hasDisplayFormatIssue(answer?.text || answer?.answer_text) ||
      hasDisplayFormatIssue(answer?.textCn || answer?.answer_text_cn)
    ));
  }).slice(0, REVIEW_MAX_ITEMS);
}

function buildMissingExplanationsPrompt(batch, context = {}) {
  const payload = batch.map((entry, index) => {
    const q = entry.question || {};
    return {
      index,
      path: entry.path,
      label: entry.label,
      questionId: entry.questionId,
      questionNumber: entry.questionNumber,
      questionType: entry.questionType,
      contextText: entry.contextText || "",
      contextImageUrl: entry.contextImageUrl || "",
      questionText: q.questionText || "",
      questionTextCn: q.questionTextCn || "",
      questionImageUrl: q.imageUrl || q.image_url || "",
      answers: (q.answers || []).map((answer, answerIndex) => ({
        key: answer.key || answer.answer_key || ANSWER_KEYS[answerIndex],
        text: answer.text || answer.answer_text || "",
        textCn: answer.textCn || answer.answer_text_cn || "",
        imageUrl: answer.imageUrl || answer.image_url || "",
      })),
      correctAnswer: q.correctAnswer || q.correctAnswerKey || "",
      currentExplanation: q.explanation || "",
      currentExplanationCn: q.explanationCn || "",
      missingExplanation: isBlankText(q.explanation) || isLikelyChineseExplanation(q.explanation),
      missingExplanationCn: isBlankText(q.explanationCn) || isLikelyVietnameseExplanation(q.explanationCn),
    };
  });

  return `Bạn là giáo viên CSCA. Hãy tạo lời giải ngắn vừa đủ cho các câu đang thiếu giải thích.

Yêu cầu:
- Chỉ trả JSON hợp lệ, không markdown.
- Return exactly one explanations object for every input item. Never skip the first item in a batch.
- Use correctAnswer/currentCorrectAnswer and the matching option as the anchor. Do not choose a new answer unless the prompt explicitly asks for review/fix.
- Không sửa đề, không sửa đáp án, chỉ tạo explanation/explanationCn.
- Trường explanation bắt buộc viết bằng tiếng Việt CÓ DẤU. Không được viết kiểu không dấu như "Tap hop", "dap an", "loi giai".
- explanation ngắn vừa đủ, 2-5 dòng, đúng trọng tâm cách ra đáp án.
- Nếu missingExplanationCn=true, bắt buộc tạo explanationCn bằng tiếng Trung gọn, tương đương nội dung explanation/currentExplanation.
- Nếu missingExplanation=true thì bắt buộc trả explanation tiếng Việt có dấu. Không được chỉ trả explanationCn.
- Nếu missingExplanation=true và currentExplanation đang là tiếng Trung, hãy viết lại nội dung đó sang tiếng Việt có dấu trong explanation.
- Nếu missingExplanationCn=true và currentExplanationCn đang là tiếng Việt, hãy viết lại nội dung đó sang tiếng Trung trong explanationCn.
- Tuyệt đối không đặt tiếng Trung vào field explanation. Tuyệt đối không đặt tiếng Việt vào field explanationCn.
- Nếu thiếu cả 2 field, bắt buộc trả cả explanation tiếng Việt và explanationCn tiếng Trung.
- If the source question is Chinese and missingExplanation=true, explanation must be Vietnamese with full diacritics, not a copy of Chinese text.
- If the source question is Vietnamese/Chinese bilingual and missingExplanationCn=true, explanationCn must be natural Chinese, not Vietnamese written in the Chinese field.
- Do not output stacked OCR/ruby fragments. Never split one formula over many one-character lines; write one readable formula only, e.g. \\(xy=1\\).
- Never output escaped LaTeX group braces like \\frac\\{a\\}\\{b\\} or \\sqrt\\{x\\}; use \\frac{a}{b} and \\sqrt{x}.
- For word-bank/fill-blank items, explain why the selected word fits the blank in that sentence or passage, not just "chon dap an".
- For reading groups, cite the key sentence/idea from contextText briefly.
- Nếu currentExplanation đã có tiếng Việt và thiếu explanationCn, hãy dịch/diễn đạt lại sang tiếng Trung trong explanationCn.
- Nếu currentExplanationCn đã có tiếng Trung và thiếu explanation, hãy dịch/diễn đạt lại sang tiếng Việt có dấu trong explanation.
- Nếu có questionImageUrl/contextImageUrl nhưng text, đáp án và đáp án đúng đã đủ để giải, vẫn phải tạo explanation. Chỉ để trống khi hình là dữ kiện bắt buộc không thể suy ra từ text.
- Công thức dùng LaTeX chuẩn: inline \\(...\\), phân số \\frac{...}{...}, căn \\sqrt{...}, tập hợp \\{...\\}, giao/hợp \\cap/\\cup.
- Không để công thức thô trong câu. Mọi biểu thức có =, ^, /, \\sin, \\cos, \\theta, \\mu, \\frac, \\sqrt phải nằm trong \\(...\\). Ví dụ: "FA=BIL=(B^2L^2v\\cos\\theta)/R" phải viết "\\(F_A=BIL=\\frac{B^2L^2v\\cos\\theta}{R}\\)".
- Không dùng dấu $ hoặc $$ trong explanation/explanationCn. Chỉ dùng \\(...\\) cho inline math và \\[...\\] cho công thức dài đứng riêng.
- Nếu lời giải dùng tiếng Trung trong explanationCn, phần chữ có thể là tiếng Trung nhưng công thức vẫn phải theo LaTeX chuẩn như trên.
- Lời giải nên xuống dòng theo ý: Công thức/Phân tích, Thay tính, Kết luận/Chọn.
- Nếu cần đọc ảnh nhưng không đủ dữ liệu từ text/answers để giải chắc, để explanation rỗng và note lý do, không đoán bừa.
- Mỗi item trong dữ liệu phải có một object trong explanations.

Môn/ngữ cảnh: ${context.subject || "CSCA đa môn"}.

Trả dạng:
{
  "explanations": [
    {
      "index": 0,
      "path": "question:1",
      "questionId": 1,
      "confidence": 0.9,
      "explanation": "Lời giải tiếng Việt có dấu nếu cần điền",
      "explanationCn": "中文解析 nếu cần điền",
      "note": "ngắn gọn"
    }
  ]
}

Dữ liệu:
${JSON.stringify(payload)}`;
}

function buildPolishExplanationsPrompt(batch, context = {}) {
  const payload = batch.map((entry, index) => {
    const q = entry.question || {};
    return {
      index,
      path: entry.path,
      label: entry.label,
      questionId: entry.questionId,
      questionNumber: entry.questionNumber,
      questionText: q.questionText || "",
      questionTextCn: q.questionTextCn || "",
      answers: (q.answers || []).map((answer, answerIndex) => ({
        key: answer.key || answer.answer_key || ANSWER_KEYS[answerIndex],
        text: answer.text || answer.answer_text || "",
        textCn: answer.textCn || answer.answer_text_cn || "",
      })),
      correctAnswer: q.correctAnswer || q.correctAnswerKey || "",
      explanation: q.explanation || "",
    };
  });

  return `Bạn là biên tập viên lời giải CSCA. Hãy chuẩn hóa các lời giải tiếng Việt cũ.

Yêu cầu:
- Chỉ trả JSON hợp lệ, không markdown.
- Return exactly one explanations object for every input item.
- Chỉ sửa trường explanation. Không sửa đề, không sửa đáp án, không thêm ý mới làm đổi nghĩa.
- Bắt buộc viết tiếng Việt CÓ DẤU. Chuyển "Phan tich", "Dieu kien", "Cong thuc", "Ket luan", "dap an" thành tiếng Việt đúng dấu.
- Giữ nguyên công thức, ký hiệu, đáp án chọn và ý nghĩa toán/lý/hóa. Nếu thấy LaTeX thô, có thể bọc công thức bằng \\(...\\) nhưng không đổi nội dung.
- Không để công thức thô trong câu. Mọi biểu thức có =, ^, /, \\sin, \\cos, \\theta, \\mu, \\frac, \\sqrt phải nằm trong \\(...\\). Ví dụ: "v1 = v cos theta" phải thành "\\(v_1=v\\cos\\theta\\)".
- Không dùng dấu $ hoặc $$ trong explanation. Chỉ dùng \\(...\\) hoặc \\[...\\].
- Trình bày dễ đọc bằng dòng ngắn: Phân tích, Điều kiện/Công thức, Suy ra/Kết luận, Chọn.
- Do not output stacked OCR/ruby fragments. Never split one formula over many one-character lines; write one readable formula only.
- Never output escaped LaTeX group braces like \\frac\\{a\\}\\{b\\} or \\sqrt\\{x\\}; use \\frac{a}{b} and \\sqrt{x}.
- If explanation contains Chinese text, do not keep it in explanation; return explanation empty with note unless you can safely rewrite it into Vietnamese with full diacritics.
- Nếu không chắc cách thêm dấu mà có thể đổi nghĩa, trả explanation rỗng và note lý do.

Môn/ngữ cảnh: ${context.subject || "CSCA đa môn"}.

Trả dạng:
{
  "explanations": [
    {
      "index": 0,
      "path": "question:1",
      "questionId": 1,
      "confidence": 0.95,
      "explanation": "Phân tích:\\n...",
      "note": "đã thêm dấu và xuống dòng"
    }
  ]
}

Dữ liệu:
${JSON.stringify(payload)}`;
}

function buildDisplayFormatPrompt(batch, context = {}) {
  const payload = batch.map((entry, index) => {
    const q = entry.question || {};
    return {
      index,
      path: entry.path,
      label: entry.label,
      questionId: entry.questionId,
      questionNumber: entry.questionNumber,
      questionType: entry.questionType,
      contextText: entry.contextText || "",
      questionText: q.questionText || "",
      questionTextCn: q.questionTextCn || "",
      answers: (q.answers || []).map((answer, answerIndex) => ({
        key: answer.key || answer.answer_key || ANSWER_KEYS[answerIndex],
        text: answer.text || answer.answer_text || "",
        textCn: answer.textCn || answer.answer_text_cn || "",
      })),
      correctAnswer: q.correctAnswer || q.correctAnswerKey || "",
      explanation: q.explanation || "",
      explanationCn: q.explanationCn || "",
      formatterInstructions: [
        "Rewrite the whole broken field into a clean natural version in the same original language when format is broken.",
        "Remove stray malformed $ or $$ delimiters.",
        "Never leave $$ inside a sentence. Convert inline math to \\(...\\), for example: hay $$(x+1)^{2}+(y+1)^{2}=2 -> hay \\((x+1)^2+(y+1)^2=2\\).",
        "Examples: (x-2)^{2}+(y+1)^{2}$$=5 -> \\((x-2)^2+(y+1)^2=5\\); y^2$$/16 -> \\frac{y^2}{16}; (4,0)$$: -> \\((4,0)\\):.",
        "Never output escaped group braces like \\frac\\{a\\}\\{b\\} or \\sqrt\\{x\\}; output \\frac{a}{b} and \\sqrt{x}.",
        "Remove stacked OCR/ruby fragments such as one formula split across many one-character lines; keep one clean readable formula only.",
        "Keep meaning and correct answer unchanged.",
      ],
    };
  });

  return `Bạn là kỹ thuật viên LaTeX/OCR cho đề CSCA. Hãy sửa lỗi FORMAT HIỂN THỊ trong dữ liệu dưới đây.

Yêu cầu bắt buộc:
- Chỉ trả JSON hợp lệ, không markdown.
- Return exactly one fix object for every input item. If no safe change is needed, return only index/path/note/confidence.
- Use language understanding to repair broken OCR/LaTeX when regex did not catch it, but only for format/display. Do not re-solve the exam here.
- Không đổi đáp án đúng, không gửi correctAnswer, không chấm lại bài.
- Không đổi ý toán/lý/hóa. Chỉ sửa OCR/LaTeX/format hiển thị chắc chắn.
- Giữ đúng ngôn ngữ gốc của từng field: questionTextCn/explanationCn giữ tiếng Trung; questionText/explanation giữ tiếng Việt nếu đang là tiếng Việt.
- If a field has duplicated rendered text, stacked single-character OCR lines, stray duplicated formulas, or mixed preview artifacts, rewrite that whole field into one clean readable version.
- Do not output stacked OCR/ruby fragments. Never split one formula over many one-character lines; write one readable formula only.
- Never output escaped LaTeX group braces like \\frac\\{a\\}\\{b\\} or \\sqrt\\{x\\}; use \\frac{a}{b} and \\sqrt{x}.
- If Chinese and Vietnamese are accidentally mixed in one field, keep the original field language and remove/relocate only the obvious duplicate translation when it is safe.
- Bọc công thức inline bằng \\(...\\). Ví dụ: P=... 的值是 -> \\(P=...\\) 的值是.
- Sửa lệnh LaTeX thô/sai rõ ràng: \\sin, \\cos, \\tan, \\sqrt{}, \\frac{}{}, \\circ, \\mathbb{}, \\in, \\cap, \\cup.
- Với lỗi OCR lượng giác rõ ràng như \\sin^{215}^{\\circ}, hiểu là \\sin^2 15^\\circ; \\sin^{275}^{\\circ} hiểu là \\sin^2 75^\\circ.
- Lời giải phải xuống dòng dễ đọc, giữ kết luận/đáp án hiện có.
- Nếu cần suy luận có thể đổi nghĩa hoặc không chắc, không sửa field đó; ghi note ngắn.
- Never output "$" or "$$". Use \\(...\\) for inline math and \\[...\\] only for a standalone long formula.

Môn/ngữ cảnh: ${context.subject || "CSCA đa môn"}.

Trả dạng:
{
  "fixes": [
    {
      "index": 0,
      "path": "question:1",
      "questionId": 1,
      "confidence": 0.95,
      "questionText": "chỉ gửi nếu cần thay",
      "questionTextCn": "chỉ gửi nếu cần thay",
      "answers": [{"key": "A", "text": "chỉ gửi nếu cần thay", "textCn": "chỉ gửi nếu cần thay"}],
      "explanation": "chỉ gửi nếu cần thay",
      "explanationCn": "chỉ gửi nếu cần thay",
      "note": "đã sửa format nào hoặc vì sao bỏ qua"
    }
  ]
}

Dữ liệu:
${JSON.stringify(payload)}`;
}

function normalizeGeneratedExplanationItem(rawItem, entry) {
  let explanation = normalizeGeneratedExplanation(rawItem?.explanation || rawItem?.explanationVi || rawItem?.explanation_vi || rawItem?.vietnameseExplanation);
  let explanationCn = normalizeGeneratedExplanation(rawItem?.explanationCn || rawItem?.explanation_cn || rawItem?.chineseExplanation || rawItem?.zhExplanation);

  if (isLikelyChineseExplanation(explanation) && isLikelyVietnameseExplanation(explanationCn)) {
    [explanation, explanationCn] = [explanationCn, explanation];
  } else {
    if (isLikelyChineseExplanation(explanation) && isBlankText(explanationCn)) {
      explanationCn = explanation;
      explanation = "";
    }
    if (isLikelyVietnameseExplanation(explanationCn) && isBlankText(explanation)) {
      explanation = explanationCn;
      explanationCn = "";
    }
  }

  return {
    path: entry.path,
    label: entry.label,
    questionId: entry.questionId,
    questionNumber: entry.questionNumber,
    needsExplanation: isBlankText(entry.question?.explanation) || isLikelyChineseExplanation(entry.question?.explanation),
    needsExplanationCn: isBlankText(entry.question?.explanationCn) || isLikelyVietnameseExplanation(entry.question?.explanationCn),
    confidence: Math.max(0, Math.min(1, Number(rawItem?.confidence) || 0)),
    explanation,
    explanationCn,
    note: stringValue(rawItem?.note).slice(0, 600),
  };
}

function findAiItemForEntry(items, entry, localIndex) {
  return (items || []).find((candidate) => {
    if (!candidate) return false;
    const candidatePath = stringValue(candidate.path);
    if (candidatePath && candidatePath === entry.path) return true;

    const candidateQuestionId = Number.parseInt(candidate.questionId || candidate.question_id, 10);
    if (candidateQuestionId && candidateQuestionId === Number(entry.questionId)) return true;

    const candidateIndex = Number.parseInt(candidate.index ?? candidate.idx, 10);
    return Number.isFinite(candidateIndex) && candidateIndex === localIndex;
  });
}

async function generateDisplayFormatFixesWithAI(entries, context = {}) {
  const targets = getDisplayFormatTargets(entries);
  if (!targets.length) {
    return {
      fixes: [],
      diagnostics: [{
        batch: 0,
        range: "Không có lỗi format rõ ràng",
        status: "no_questions",
        message: "Không tìm thấy field có dấu hiệu LaTeX/OCR cần AI sửa format.",
      }],
      summary: { total: 0, fixed: 0, aiCalls: 0, failedBatches: 0, invalidBatches: 0, model: getFixModel() },
    };
  }

  const fixes = [];
  const diagnostics = [];
  const batchSize = Math.max(1, Math.min(8, Number.parseInt(process.env.AI_EXAM_DISPLAY_FORMAT_BATCH_SIZE || "5", 10)));

  for (let i = 0; i < targets.length; i += batchSize) {
    throwIfAiRequestAborted(context);
    const batch = targets.slice(i, i + batchSize);
    const model = getFixModel();
    const startedAt = Date.now();
    try {
      const raw = await aiService.callAdminExamAI(buildDisplayFormatPrompt(batch, context), {
        model,
        models: getFixModels(),
        temperature: 0.03,
        maxTokens: Number.parseInt(process.env.AI_EXAM_DISPLAY_FORMAT_MAX_TOKENS || "5000", 10),
        timeout: Number.parseInt(process.env.AI_EXAM_DISPLAY_FORMAT_TIMEOUT_MS || "120000", 10),
        signal: context.signal,
      });
      const parsed = parseAiJson(raw);
      const batchFixes = Array.isArray(parsed?.fixes) ? parsed.fixes : [];
      diagnostics.push({
        batch: Math.floor(i / batchSize) + 1,
        range: getBatchLabelRange(batch),
        paths: batch.map(entry => entry.path),
        labels: batch.map(entry => entry.label),
        model,
        status: batchFixes.length ? "ok" : "invalid_response",
        durationMs: Date.now() - startedAt,
        returnedFixes: batchFixes.length,
        expectedFixes: batch.length,
        message: batchFixes.length
          ? `AI đã trả ${batchFixes.length}/${batch.length} bản sửa format.`
          : "AI đã được gọi nhưng phản hồi không có JSON fixes hợp lệ.",
        rawPreview: batchFixes.length ? undefined : stringValue(raw).slice(0, 500),
      });

      for (const entry of batch) {
        const localIndex = batch.indexOf(entry);
        const fix = findAiItemForEntry(batchFixes, entry, localIndex);
        if (fix) fixes.push(normalizeAiFix({ ...fix, correctAnswer: "" }, entry));
      }
    } catch (error) {
      if (error.message === "AI_REQUEST_ABORTED") throw error;
      const diagnostic = {
        batch: Math.floor(i / batchSize) + 1,
        range: getBatchLabelRange(batch),
        paths: batch.map(entry => entry.path),
        labels: batch.map(entry => entry.label),
        model,
        status: "failed",
        durationMs: Date.now() - startedAt,
        expectedFixes: batch.length,
        ...getReviewErrorDiagnostic(error),
      };
      diagnostics.push(diagnostic);
      console.warn("AI display format batch failed:", diagnostic);
    }
  }

  return {
    fixes,
    diagnostics,
    summary: {
      total: targets.length,
      fixed: fixes.length,
      aiCalls: diagnostics.filter(item => item.status === "ok" || item.status === "invalid_response").length,
      failedBatches: diagnostics.filter(item => item.status === "failed").length,
      invalidBatches: diagnostics.filter(item => item.status === "invalid_response").length,
      model: getFixModel(),
    },
  };
}

async function polishExplanationsWithAI(entries, context = {}) {
  const targets = getPolishExplanationTargets(entries);
  if (!targets.length) {
    return {
      explanations: [],
      diagnostics: [{
        batch: 0,
        range: "Không có lời giải cần chuẩn hóa",
        status: "no_questions",
        message: "Không tìm thấy lời giải không dấu hoặc cần chuẩn hóa.",
      }],
      summary: { total: 0, generated: 0, aiCalls: 0, failedBatches: 0, invalidBatches: 0, model: getFixModel() },
    };
  }

  const explanations = [];
  const diagnostics = [];
  const batchSize = Math.max(1, Math.min(12, Number.parseInt(process.env.AI_EXAM_EXPLANATION_POLISH_BATCH_SIZE || "8", 10)));

  for (let i = 0; i < targets.length; i += batchSize) {
    throwIfAiRequestAborted(context);
    const batch = targets.slice(i, i + batchSize);
    const model = getFixModel();
    const startedAt = Date.now();
    try {
      const raw = await aiService.callAdminExamAI(buildPolishExplanationsPrompt(batch, context), {
        model,
        models: getFixModels(),
        temperature: 0.05,
        maxTokens: Number.parseInt(process.env.AI_EXAM_EXPLANATION_POLISH_MAX_TOKENS || "5000", 10),
        timeout: Number.parseInt(process.env.AI_EXAM_EXPLANATION_POLISH_TIMEOUT_MS || "120000", 10),
        signal: context.signal,
      });
      const parsed = parseAiJson(raw);
      const batchItems = getAiItems(parsed, ["explanations", "items", "results"], ["explanation", "explanationCn", "explanation_cn", "explanationVi", "explanation_vi", "vietnameseExplanation", "chineseExplanation", "zhExplanation"]);
      diagnostics.push({
        batch: Math.floor(i / batchSize) + 1,
        range: getBatchLabelRange(batch),
        paths: batch.map(entry => entry.path),
        labels: batch.map(entry => entry.label),
        model,
        status: batchItems.length ? "ok" : "invalid_response",
        durationMs: Date.now() - startedAt,
        returnedExplanations: batchItems.length,
        expectedExplanations: batch.length,
        message: batchItems.length
          ? `AI đã chuẩn hóa ${batchItems.length}/${batch.length} lời giải.`
          : "AI đã được gọi nhưng phản hồi không có JSON explanations hợp lệ.",
        rawPreview: batchItems.length ? undefined : stringValue(raw).slice(0, 500),
      });

      for (const entry of batch) {
        const localIndex = batch.indexOf(entry);
        const item = findAiItemForEntry(batchItems, entry, localIndex) || (
          batchItems.length === batch.length ? batchItems[localIndex] : null
        );
        explanations.push(normalizeGeneratedExplanationItem(
          item || { note: "AI không trả lời giải cho câu này." },
          entry,
        ));
      }
    } catch (error) {
      if (error.message === "AI_REQUEST_ABORTED") throw error;
      const diagnostic = {
        batch: Math.floor(i / batchSize) + 1,
        range: getBatchLabelRange(batch),
        paths: batch.map(entry => entry.path),
        labels: batch.map(entry => entry.label),
        model,
        status: "failed",
        durationMs: Date.now() - startedAt,
        expectedExplanations: batch.length,
        ...getReviewErrorDiagnostic(error),
      };
      diagnostics.push(diagnostic);
      console.warn("AI explanation polish batch failed:", diagnostic);
    }
  }

  return {
    explanations,
    diagnostics,
    summary: {
      total: targets.length,
      generated: explanations.filter(item => item.explanation || item.explanationCn).length,
      aiCalls: diagnostics.filter(item => item.status === "ok" || item.status === "invalid_response").length,
      failedBatches: diagnostics.filter(item => item.status === "failed").length,
      invalidBatches: diagnostics.filter(item => item.status === "invalid_response").length,
      model: getFixModel(),
    },
  };
}

async function generateMissingExplanationsWithAI(entries, context = {}) {
  const targets = getMissingExplanationTargets(entries);
  if (!targets.length) {
    return {
      explanations: [],
      diagnostics: [{
        batch: 0,
        range: "Khong co cau thieu giai thich",
        status: "no_questions",
        message: "Khong co cau nao can AI them giai thich.",
      }],
      summary: { total: 0, generated: 0, aiCalls: 0, failedBatches: 0, invalidBatches: 0, model: getFixModel() },
    };
  }

  const explanations = [];
  const diagnostics = [];
  const batchSize = Math.max(1, Math.min(12, Number.parseInt(process.env.AI_EXAM_EXPLANATION_BATCH_SIZE || "8", 10)));

  for (let i = 0; i < targets.length; i += batchSize) {
    throwIfAiRequestAborted(context);
    const batch = targets.slice(i, i + batchSize);
    const model = getFixModel();
    const startedAt = Date.now();
    try {
      const raw = await aiService.callAdminExamAI(buildMissingExplanationsPrompt(batch, context), {
        model,
        models: getFixModels(),
        temperature: 0.1,
        maxTokens: Number.parseInt(process.env.AI_EXAM_EXPLANATION_MAX_TOKENS || "5000", 10),
        timeout: Number.parseInt(process.env.AI_EXAM_EXPLANATION_TIMEOUT_MS || "120000", 10),
        signal: context.signal,
      });
      const parsed = parseAiJson(raw);
      const batchItems = getAiItems(parsed, ["explanations", "items", "results"], ["explanation", "explanationCn", "explanation_cn", "explanationVi", "explanation_vi", "vietnameseExplanation", "chineseExplanation", "zhExplanation"]);
      diagnostics.push({
        batch: Math.floor(i / batchSize) + 1,
        range: getBatchLabelRange(batch),
        paths: batch.map(entry => entry.path),
        labels: batch.map(entry => entry.label),
        model,
        status: batchItems.length ? "ok" : "invalid_response",
        durationMs: Date.now() - startedAt,
        returnedExplanations: batchItems.length,
        expectedExplanations: batch.length,
        message: batchItems.length
          ? `AI da tao ${batchItems.length}/${batch.length} loi giai.`
          : "AI da duoc goi nhung phan hoi khong co JSON explanations hop le.",
        rawPreview: batchItems.length ? undefined : stringValue(raw).slice(0, 500),
      });

      const retryEntries = [];
      for (const entry of batch) {
        const localIndex = batch.indexOf(entry);
        const item = findAiItemForEntry(batchItems, entry, localIndex) || (
          batchItems.length === batch.length ? batchItems[localIndex] : null
        );
        if (item) {
          explanations.push(normalizeGeneratedExplanationItem(item, entry));
        } else {
          retryEntries.push(entry);
        }
      }

      if (retryEntries.length && batch.length > 1) {
        for (const entry of retryEntries) {
          throwIfAiRequestAborted(context);
          const retryStartedAt = Date.now();
          try {
            const retryRaw = await aiService.callAdminExamAI(buildMissingExplanationsPrompt([entry], context), {
              model,
              models: getFixModels(),
              temperature: 0.1,
              maxTokens: Number.parseInt(process.env.AI_EXAM_EXPLANATION_SINGLE_MAX_TOKENS || "1200", 10),
              timeout: Number.parseInt(process.env.AI_EXAM_EXPLANATION_TIMEOUT_MS || "120000", 10),
              signal: context.signal,
            });
            const retryParsed = parseAiJson(retryRaw);
            const retryItems = getAiItems(retryParsed, ["explanations", "items", "results"], ["explanation", "explanationCn", "explanation_cn", "explanationVi", "explanation_vi", "vietnameseExplanation", "chineseExplanation", "zhExplanation"]);
            const retryItem = findAiItemForEntry(retryItems, entry, 0) || (retryItems.length === 1 ? retryItems[0] : null);
            diagnostics.push({
              batch: `${Math.floor(i / batchSize) + 1}.${entry.questionNumber || entry.questionId || "retry"}`,
              range: entry.label,
              paths: [entry.path],
              labels: [entry.label],
              model,
              status: retryItem ? "retry_ok" : "retry_invalid_response",
              durationMs: Date.now() - retryStartedAt,
              returnedExplanations: retryItems.length,
              expectedExplanations: 1,
              message: retryItem ? "AI đã retry riêng câu này." : "AI retry riêng nhưng vẫn không trả lời giải hợp lệ.",
              rawPreview: retryItem ? undefined : stringValue(retryRaw).slice(0, 500),
            });
            explanations.push(normalizeGeneratedExplanationItem(
              retryItem || { note: "AI không trả lời giải cho câu này sau khi retry riêng." },
              entry,
            ));
          } catch (retryError) {
            if (retryError.message === "AI_REQUEST_ABORTED") throw retryError;
            diagnostics.push({
              batch: `${Math.floor(i / batchSize) + 1}.${entry.questionNumber || entry.questionId || "retry"}`,
              range: entry.label,
              paths: [entry.path],
              labels: [entry.label],
              model,
              status: "retry_failed",
              durationMs: Date.now() - retryStartedAt,
              expectedExplanations: 1,
              ...getReviewErrorDiagnostic(retryError),
            });
            explanations.push(normalizeGeneratedExplanationItem(
              { note: "AI retry riêng câu này vẫn lỗi. Cần chạy lại hoặc xem log." },
              entry,
            ));
          }
        }
      } else {
        for (const entry of retryEntries) {
          explanations.push(normalizeGeneratedExplanationItem(
            { note: "AI không trả lời giải cho câu này." },
            entry,
          ));
        }
      }
    } catch (error) {
      if (error.message === "AI_REQUEST_ABORTED") throw error;
      const diagnostic = {
        batch: Math.floor(i / batchSize) + 1,
        range: getBatchLabelRange(batch),
        paths: batch.map(entry => entry.path),
        labels: batch.map(entry => entry.label),
        model,
        status: "failed",
        durationMs: Date.now() - startedAt,
        expectedExplanations: batch.length,
        ...getReviewErrorDiagnostic(error),
      };
      diagnostics.push(diagnostic);
      console.warn("AI missing explanation batch failed:", diagnostic);
      for (const entry of batch) {
        explanations.push(normalizeGeneratedExplanationItem(
          { note: "AI thêm giải thích lỗi ở batch này. Cần chạy lại hoặc xem log." },
          entry,
        ));
      }
    }
  }

  return {
    explanations,
    diagnostics,
    summary: {
      total: targets.length,
      generated: explanations.filter(item => item.explanation || item.explanationCn).length,
      aiCalls: diagnostics.filter(item => item.status === "ok" || item.status === "invalid_response").length,
      failedBatches: diagnostics.filter(item => item.status === "failed").length,
      invalidBatches: diagnostics.filter(item => item.status === "invalid_response").length,
      model: getFixModel(),
    },
  };
}

async function generateReviewFixesWithAI(entries, reviews, context = {}) {
  const targets = getReviewFixTargetEntries(entries, reviews);
  if (!targets.length) {
    return {
      fixes: [],
      diagnostics: [{
        batch: 0,
        range: "Không có log lỗi",
        status: "no_questions",
        message: "Không có log lỗi cần AI sửa.",
      }],
      summary: { total: 0, fixed: 0, aiCalls: 0, failedBatches: 0, invalidBatches: 0, model: getFixModel() },
    };
  }

  const fixes = [];
  const diagnostics = [];
  const batchSize = Math.max(1, Math.min(8, Number.parseInt(process.env.AI_EXAM_FIX_BATCH_SIZE || "4", 10)));

  for (let i = 0; i < targets.length; i += batchSize) {
    throwIfAiRequestAborted(context);
    const batch = targets.slice(i, i + batchSize);
    const model = getFixModel();
    const startedAt = Date.now();
    try {
      const raw = await aiService.callAdminExamAI(buildFixPrompt(batch, context), {
        model,
        models: getFixModels(),
        temperature: 0.05,
        maxTokens: Number.parseInt(process.env.AI_EXAM_FIX_MAX_TOKENS || "4500", 10),
        timeout: Number.parseInt(process.env.AI_EXAM_FIX_TIMEOUT_MS || "120000", 10),
        signal: context.signal,
      });
      const parsed = parseAiJson(raw);
      const batchFixes = Array.isArray(parsed?.fixes) ? parsed.fixes : [];
      diagnostics.push({
        batch: Math.floor(i / batchSize) + 1,
        range: getBatchLabelRange(batch),
        paths: batch.map(entry => entry.path),
        labels: batch.map(entry => entry.label),
        model,
        status: batchFixes.length ? "ok" : "invalid_response",
        durationMs: Date.now() - startedAt,
        returnedFixes: batchFixes.length,
        expectedFixes: batch.length,
        message: batchFixes.length
          ? `AI đã trả ${batchFixes.length}/${batch.length} bản sửa.`
          : "AI đã được gọi nhưng phản hồi không có JSON fixes hợp lệ.",
        rawPreview: batchFixes.length ? undefined : stringValue(raw).slice(0, 500),
      });

      for (const entry of batch) {
        const localIndex = batch.indexOf(entry);
        const fix = findAiItemForEntry(batchFixes, entry, localIndex);
        if (fix) fixes.push(normalizeAiFix(fix, entry));
      }
    } catch (error) {
      if (error.message === "AI_REQUEST_ABORTED") throw error;
      const diagnostic = {
        batch: Math.floor(i / batchSize) + 1,
        range: getBatchLabelRange(batch),
        paths: batch.map(entry => entry.path),
        labels: batch.map(entry => entry.label),
        model,
        status: "failed",
        durationMs: Date.now() - startedAt,
        expectedFixes: batch.length,
        ...getReviewErrorDiagnostic(error),
      };
      diagnostics.push(diagnostic);
      console.warn("AI exam fix batch failed:", diagnostic);
    }
  }

  return {
    fixes,
    diagnostics,
    summary: {
      total: targets.length,
      fixed: fixes.length,
      aiCalls: diagnostics.filter(item => item.status === "ok" || item.status === "invalid_response").length,
      failedBatches: diagnostics.filter(item => item.status === "failed").length,
      invalidBatches: diagnostics.filter(item => item.status === "invalid_response").length,
      model: getFixModel(),
    },
  };
}

function collectRemainingImportedReviewIssues(items) {
  return collectImportedQuestions(items)
    .map((entry) => {
      const review = entry.question?.aiReview;
      if (!review || review.status === "ok") return null;
      return {
        path: entry.path,
        label: review.label || entry.label,
        status: review.status,
        confidence: review.confidence,
        suggestedCorrectAnswer: review.suggestedCorrectAnswer,
        note: review.note,
        questionIssues: review.questionIssues || [],
        formulaIssues: review.formulaIssues || [],
        explanationIssues: review.explanationIssues || [],
      };
    })
    .filter(Boolean);
}

function applyFixesToImportedItems(items, fixes = [], entries = []) {
  const nextItems = JSON.parse(JSON.stringify(items || []));
  const changes = [];
  const skipped = [];
  const entryByPath = new Map((entries || []).map((entry) => [entry.path, entry]));

  const makeMeta = (path) => {
    const entry = entryByPath.get(path) || {};
    return {
      path,
      label: entry.review?.label || entry.label,
      status: entry.review?.status,
      confidence: entry.review?.confidence,
      note: entry.review?.note,
    };
  };

  const pushSkipped = (fix, reason) => {
    skipped.push({
      ...makeMeta(fix.path),
      reason,
    });
  };

  const setField = (target, field, value, change) => {
    if (!value || target[field] === value) return;
    const before = target[field] || "";
    target[field] = value;
    changes.push({
      ...makeMeta(change.path),
      ...change,
      before,
      after: value,
    });
  };

  for (const fix of fixes) {
    const parts = stringValue(fix.path).split(".");
    const itemIndex = Number.parseInt(parts[0], 10);
    const item = nextItems[itemIndex];
    if (!item) {
      pushSkipped(fix, "Không tìm thấy mục import.");
      continue;
    }

    let target = item;
    if (parts[1] === "subQuestions") target = item.subQuestions?.[Number.parseInt(parts[2], 10)];
    if (parts[1] === "subItems") target = item.subItems?.[Number.parseInt(parts[2], 10)];
    if (!target) {
      pushSkipped(fix, "Không tìm thấy câu cần sửa.");
      continue;
    }

    const beforeCount = changes.length;
    setField(target, "questionText", fix.questionText, { path: fix.path, field: "questionText" });
    setField(target, "questionTextCn", fix.questionTextCn, { path: fix.path, field: "questionTextCn" });
    setField(target, "explanation", fix.explanation, { path: fix.path, field: "explanation" });
    setField(target, "explanationCn", fix.explanationCn, { path: fix.path, field: "explanationCn" });

    if (fix.correctAnswer) {
      if (parts[1] === "subItems") {
        if (target.correctAnswerKey !== fix.correctAnswer) {
          const before = target.correctAnswerKey || "";
          target.correctAnswerKey = fix.correctAnswer;
          changes.push({ ...makeMeta(fix.path), path: fix.path, field: "correctAnswerKey", before, after: fix.correctAnswer });
        }
      } else if (target.correctAnswer !== fix.correctAnswer) {
        const before = target.correctAnswer || "";
        target.correctAnswer = fix.correctAnswer;
        changes.push({ ...makeMeta(fix.path), path: fix.path, field: "correctAnswer", before, after: fix.correctAnswer });
      }
    }

    if (Array.isArray(fix.answers) && fix.answers.length) {
      const answerTarget = parts[1] === "subItems" ? item.linkedOptions : target.answers;
      if (Array.isArray(answerTarget)) {
        for (const answerFix of fix.answers) {
          const answer = answerTarget.find((entry) => entry.key === answerFix.key);
          if (!answer) continue;
          setField(answer, "text", answerFix.text, { path: fix.path, field: `answers.${answerFix.key}.text` });
          setField(answer, "textCn", answerFix.textCn, { path: fix.path, field: `answers.${answerFix.key}.textCn` });
        }
      }
    }

    if (changes.length > beforeCount) {
      target.aiReview = {
        ...(target.aiReview || {}),
        status: "ok",
        confidence: fix.confidence || target.aiReview?.confidence || 0,
        note: fix.note || "Đã áp dụng AI sửa toàn bộ log.",
      };
      target.reviewNotes = [target.reviewNotes, `Đã áp dụng AI sửa: ${fix.note || "cập nhật theo log."}`]
        .filter(Boolean)
        .join("\n");
    } else {
      pushSkipped(fix, fix.note || "AI không trả field có thể áp dụng.");
    }
  }

  const fixedIssueCount = new Set(changes.map((change) => change.path).filter(Boolean)).size;
  const remainingIssues = collectRemainingImportedReviewIssues(nextItems);

  return {
    items: nextItems,
    changedCount: changes.length,
    fixedIssueCount,
    remainingIssueCount: remainingIssues.length,
    skippedCount: skipped.length,
    changes: changes.slice(0, 100),
    skipped: skipped.slice(0, 100),
    remainingIssues: remainingIssues.slice(0, 100),
  };
}

async function applyImportedReviewFixesWithAI(items, reviews = [], context = {}) {
  const entries = collectImportedQuestions(items);
  const targets = getReviewFixTargetEntries(entries, reviews);
  const generated = await generateReviewFixesWithAI(entries, reviews, context);
  const applied = applyFixesToImportedItems(items, generated.fixes, entries);
  const returnedFixPaths = new Set(generated.fixes.map((fix) => fix.path).filter(Boolean));
  const missingFixes = targets
    .filter((entry) => !returnedFixPaths.has(entry.path))
    .map((entry) => ({
      path: entry.path,
      label: entry.review?.label || entry.label,
      status: entry.review?.status,
      confidence: entry.review?.confidence,
      note: entry.review?.note,
      reason: "AI không trả bản sửa cho log này.",
    }));
  const skipped = [...(applied.skipped || []), ...missingFixes].slice(0, 100);
  const skippedCount = skipped.length;

  return {
    ...applied,
    skipped,
    skippedCount,
    fixes: generated.fixes,
    diagnostics: generated.diagnostics,
    summary: {
      ...generated.summary,
      changedCount: applied.changedCount,
      fixedIssueCount: applied.fixedIssueCount,
      remainingIssueCount: applied.remainingIssueCount,
      skippedCount,
    },
    message: `AI đã sửa ${applied.fixedIssueCount}/${generated.summary.total || 0} log, còn ${applied.remainingIssueCount} log cần xem lại.`,
  };
}

function normalizeReviewAnswers(question) {
  const answers = Array.isArray(question.answers) ? question.answers.filter(Boolean) : [];
  const linkedOptions = parseJsonValue(question.effective_linked_options || question.linked_options, []);
  if (
    question.question_type === "fill_blank_item" &&
    Array.isArray(linkedOptions) &&
    linkedOptions.length
  ) {
    return linkedOptions.map((option, index) => ({
      key: option?.key || ANSWER_KEYS[index],
      text: option?.text || option?.answer_text || "",
      textCn: option?.textCn || option?.text_cn || option?.answer_text_cn || "",
      imageUrl: option?.imageUrl || option?.image_url || "",
    }));
  }

  return answers.map((answer, index) => ({
    key: answer?.answer_key || answer?.key || ANSWER_KEYS[index],
    text: answer?.answer_text || answer?.text || "",
    textCn: answer?.answer_text_cn || answer?.textCn || "",
    imageUrl: answer?.image_url || answer?.imageUrl || "",
  }));
}

function getCurrentCorrectAnswer(question) {
  const answers = Array.isArray(question.answers) ? question.answers : [];
  const correct = answers.find((answer) => answer?.is_correct);
  return stringValue(correct?.answer_key || correct?.key).toUpperCase().slice(0, 1);
}

async function loadStoredExamReviewEntries(client, examId) {
  const examResult = await client.query(
    `SELECT e.id, e.title, s.name as subject_name, s.code as subject_code
     FROM exams e
     LEFT JOIN subjects s ON s.id = e.subject_id
     WHERE e.id = $1 AND e.deleted_at IS NULL
     LIMIT 1`,
    [examId],
  );

  if (!examResult.rows.length) {
    const error = new Error("EXAM_NOT_FOUND");
    error.statusCode = 404;
    throw error;
  }

  const questionsResult = await client.query(
    `SELECT
       q.id,
       q.question_number,
       q.question_type,
       q.question_text,
       q.question_text_cn,
       q.image_url,
       q.explanation,
       q.explanation_cn,
       q.explanation_image_url,
       q.passage_text,
       q.passage_image_url,
       q.linked_options,
       q.sub_question_number,
       q.passage_group_id,
       COALESCE(
         q.linked_options,
         (SELECT linked_options FROM questions parent
          WHERE parent.id = q.passage_group_id
            AND parent.question_type = 'fill_blank_pool')
       ) as effective_linked_options,
       COALESCE(
         q.passage_text,
         (SELECT passage_text FROM questions parent
          WHERE parent.id = q.passage_group_id
            AND parent.passage_text IS NOT NULL
          ORDER BY parent.id LIMIT 1)
       ) as effective_passage_text,
       COALESCE(
         q.passage_image_url,
         (SELECT passage_image_url FROM questions parent
          WHERE parent.id = q.passage_group_id
            AND parent.passage_image_url IS NOT NULL
          ORDER BY parent.id LIMIT 1)
       ) as effective_passage_image_url,
       json_agg(
         json_build_object(
           'id', a.id,
           'answer_key', a.answer_key,
           'answer_text', a.answer_text,
           'answer_text_cn', a.answer_text_cn,
           'image_url', a.image_url,
           'is_correct', a.is_correct
         ) ORDER BY a.answer_key
       ) FILTER (WHERE a.id IS NOT NULL) as answers
     FROM questions q
     LEFT JOIN answers a ON a.question_id = q.id
     WHERE q.exam_id = $1
       AND q.deleted_at IS NULL
       AND q.question_type NOT IN ('reading_passage', 'fill_blank_pool')
     GROUP BY q.id
     ORDER BY q.question_number, q.id`,
    [examId],
  );

  const entries = questionsResult.rows.map((question) => {
    const questionNumber = question.sub_question_number || question.question_number;
    return {
      path: `question:${question.id}`,
      label: `Câu ${questionNumber}`,
      kind: "stored",
      questionId: question.id,
      questionNumber,
      questionType: question.question_type,
      parentQuestionId: question.passage_group_id || undefined,
      contextText: question.effective_passage_text || question.passage_text || "",
      contextImageUrl: question.effective_passage_image_url || question.passage_image_url || "",
      question: {
        questionText: question.question_text || "",
        questionTextCn: question.question_text_cn || "",
        imageUrl: question.image_url || "",
        answers: normalizeReviewAnswers(question),
        correctAnswer: getCurrentCorrectAnswer(question),
        explanation: question.explanation || "",
        explanationCn: question.explanation_cn || "",
        explanationImageUrl: question.explanation_image_url || "",
      },
    };
  });

  return { exam: examResult.rows[0], entries };
}

function getSuggestedAnswerKey(review) {
  const answer = stringValue(review?.suggestedCorrectAnswer).trim().toUpperCase().slice(0, 1);
  return ANSWER_KEYS.includes(answer) ? answer : "";
}

async function applySuggestedAnswerFixes(client, examId, reviews = []) {
  const answerChanges = [];
  const skipped = [];
  const seenQuestions = new Set();

  for (const review of Array.isArray(reviews) ? reviews : []) {
    if (!review || review.status === "ok") continue;

    const questionId = Number.parseInt(review.questionId, 10);
    const confidence = Math.max(0, Math.min(1, Number(review.confidence) || 0));
    const suggestedAnswer = getSuggestedAnswerKey(review);

    if (!questionId || seenQuestions.has(questionId)) continue;
    seenQuestions.add(questionId);

    if (!suggestedAnswer) {
      skipped.push({
        questionId,
        questionNumber: review.questionNumber,
        reason: "AI chưa đưa đáp án gợi ý rõ ràng.",
      });
      continue;
    }

    if (confidence < REVIEW_APPLY_MIN_CONFIDENCE) {
      skipped.push({
        questionId,
        questionNumber: review.questionNumber,
        suggestedAnswer,
        confidence,
        reason: `Độ tin cậy dưới ${Math.round(REVIEW_APPLY_MIN_CONFIDENCE * 100)}%.`,
      });
      continue;
    }

    const questionResult = await client.query(
      `SELECT id, question_number
       FROM questions
       WHERE id = $1 AND exam_id = $2 AND deleted_at IS NULL
       LIMIT 1`,
      [questionId, examId],
    );
    const question = questionResult.rows[0];
    if (!question) {
      skipped.push({
        questionId,
        questionNumber: review.questionNumber,
        suggestedAnswer,
        reason: "Câu không còn thuộc đề này.",
      });
      continue;
    }

    const answersResult = await client.query(
      `SELECT id, answer_key, is_correct
       FROM answers
       WHERE question_id = $1
       ORDER BY answer_key`,
      [questionId],
    );
    const answers = answersResult.rows;
    const targetAnswer = answers.find((answer) => answer.answer_key === suggestedAnswer);
    if (!targetAnswer) {
      skipped.push({
        questionId,
        questionNumber: question.question_number,
        suggestedAnswer,
        reason: "Không tìm thấy lựa chọn này trong câu.",
      });
      continue;
    }

    const currentAnswer = answers.find((answer) => answer.is_correct)?.answer_key || "";
    if (currentAnswer === suggestedAnswer) {
      continue;
    }

    await client.query(
      `UPDATE answers
       SET is_correct = (answer_key = $2)
       WHERE question_id = $1`,
      [questionId, suggestedAnswer],
    );
    answerChanges.push({
      questionId,
      questionNumber: question.question_number,
      before: currentAnswer,
      after: suggestedAnswer,
      confidence,
    });
  }

  if (answerChanges.length) {
    await client.query("UPDATE exams SET updated_at = NOW() WHERE id = $1", [examId]);
  }

  return { answerChanges, skipped };
}

async function applyExamReviewFixes(client, examId, reviews = [], options = {}) {
  const applySafeFormulas = options.applySafeFormulas !== false;
  const { exam, entries } = await loadStoredExamReviewEntries(client, examId);
  const generated = await generateReviewFixesWithAI(entries, reviews, {
    subject: options.subject || exam.subject_name || exam.subject_code || "CSCA",
  });

  const changes = [];
  const skipped = [];

  for (const fix of generated.fixes) {
    const questionId = Number.parseInt(fix.questionId, 10);
    if (!questionId) {
      skipped.push({ path: fix.path, reason: "AI không trả questionId hợp lệ." });
      continue;
    }

    const questionResult = await client.query(
      `SELECT id, question_number
       FROM questions
       WHERE id = $1 AND exam_id = $2 AND deleted_at IS NULL
       LIMIT 1`,
      [questionId, examId],
    );
    const question = questionResult.rows[0];
    if (!question) {
      skipped.push({ path: fix.path, questionId, reason: "Câu không còn thuộc đề này." });
      continue;
    }

    const fields = [];
    const params = [];
    const addField = (column, value) => {
      if (!value) return;
      params.push(value);
      fields.push(`${column} = $${params.length}`);
      changes.push({ questionId, questionNumber: question.question_number, field: column });
    };

    addField("question_text", fix.questionText);
    addField("question_text_cn", fix.questionTextCn);
    addField("explanation", fix.explanation);
    addField("explanation_cn", fix.explanationCn);

    if (fields.length) {
      params.push(questionId);
      await client.query(
        `UPDATE questions SET ${fields.join(", ")} WHERE id = $${params.length}`,
        params,
      );
    }

    const answersResult = await client.query(
      `SELECT id, answer_key, is_correct
       FROM answers
       WHERE question_id = $1
       ORDER BY answer_key`,
      [questionId],
    );
    const answerKeys = new Set(answersResult.rows.map((answer) => answer.answer_key));

    if (fix.correctAnswer) {
      if (answerKeys.has(fix.correctAnswer)) {
        const currentAnswer = answersResult.rows.find((answer) => answer.is_correct)?.answer_key || "";
        if (currentAnswer !== fix.correctAnswer) {
          await client.query(
            `UPDATE answers
             SET is_correct = (answer_key = $2)
             WHERE question_id = $1`,
            [questionId, fix.correctAnswer],
          );
          changes.push({
            questionId,
            questionNumber: question.question_number,
            field: "correct_answer",
            before: currentAnswer,
            after: fix.correctAnswer,
          });
        }
      } else {
        skipped.push({
          path: fix.path,
          questionId,
          suggestedAnswer: fix.correctAnswer,
          reason: "Đáp án AI trả không có trong lựa chọn hiện tại.",
        });
      }
    }

    if (Array.isArray(fix.answers)) {
      for (const answerFix of fix.answers) {
        if (!answerKeys.has(answerFix.key)) continue;
        const updateFields = [];
        const updateParams = [];
        if (answerFix.text) {
          updateParams.push(answerFix.text);
          updateFields.push(`answer_text = $${updateParams.length}`);
        }
        if (answerFix.textCn) {
          updateParams.push(answerFix.textCn);
          updateFields.push(`answer_text_cn = $${updateParams.length}`);
        }
        if (!updateFields.length) continue;

        updateParams.push(questionId, answerFix.key);
        await client.query(
          `UPDATE answers SET ${updateFields.join(", ")}
           WHERE question_id = $${updateParams.length - 1} AND answer_key = $${updateParams.length}`,
          updateParams,
        );
        changes.push({
          questionId,
          questionNumber: question.question_number,
          answerKey: answerFix.key,
          field: "answer_text",
        });
      }
    }
  }

  const formulaResult = applySafeFormulas
    ? await normalizeExamFormulas(client, examId, { apply: true })
    : null;

  if (changes.length || formulaResult?.changedCount) {
    await client.query("UPDATE exams SET updated_at = NOW() WHERE id = $1", [examId]);
  }

  return {
    examId: Number(examId),
    message: `AI đã sửa ${changes.length} chỗ theo log và ${formulaResult?.changedCount || 0} chỗ công thức chắc chắn.`,
    changedCount: changes.length,
    answerChangedCount: changes.filter(change => change.field === "correct_answer").length,
    formulaChangedCount: formulaResult?.changedCount || 0,
    warningCount: formulaResult?.warningCount || 0,
    skippedCount: skipped.length,
    changes: changes.slice(0, 100),
    skipped: skipped.slice(0, 100),
    fixes: generated.fixes,
    diagnostics: generated.diagnostics,
    summary: generated.summary,
    formulaResult,
  };
}

async function applyExamDisplayFormatFixes(client, examId, options = {}) {
  const { exam, entries } = await loadStoredExamReviewEntries(client, examId);
  const generated = await generateDisplayFormatFixesWithAI(entries, {
    subject: options.subject || exam.subject_name || exam.subject_code || "CSCA",
  });

  const changes = [];
  const skipped = [];

  for (const fix of generated.fixes) {
    const questionId = Number.parseInt(fix.questionId, 10);
    if (!questionId) {
      skipped.push({ path: fix.path, reason: "AI không trả questionId hợp lệ." });
      continue;
    }
    if (fix.confidence && fix.confidence < 0.7) {
      skipped.push({ path: fix.path, questionId, questionNumber: fix.questionNumber, reason: "Độ tin cậy sửa format dưới 70%." });
      continue;
    }

    const questionResult = await client.query(
      `SELECT id, question_number, question_text, question_text_cn, explanation, explanation_cn
       FROM questions
       WHERE id = $1 AND exam_id = $2 AND deleted_at IS NULL
       LIMIT 1`,
      [questionId, examId],
    );
    const question = questionResult.rows[0];
    if (!question) {
      skipped.push({ path: fix.path, questionId, reason: "Câu không còn thuộc đề này." });
      continue;
    }

    const fields = [];
    const params = [];
    const addQuestionField = (column, value) => {
      const next = normalizeFixValue(value, column.includes("explanation") ? { explanation: true } : {}).trim();
      if (!next) return;
      const before = stringValue(question[column]).trim();
      if (!before || before === next) return;
      params.push(next);
      fields.push(`${column} = $${params.length}`);
      changes.push({ path: fix.path, questionId, questionNumber: question.question_number, field: column, before, after: next });
    };

    addQuestionField("question_text", fix.questionText);
    addQuestionField("question_text_cn", fix.questionTextCn);
    addQuestionField("explanation", fix.explanation);
    addQuestionField("explanation_cn", fix.explanationCn);

    if (fields.length) {
      params.push(questionId);
      await client.query(
        `UPDATE questions SET ${fields.join(", ")} WHERE id = $${params.length}`,
        params,
      );
    }

    if (Array.isArray(fix.answers) && fix.answers.length) {
      const answersResult = await client.query(
        `SELECT id, answer_key, answer_text, answer_text_cn
         FROM answers
         WHERE question_id = $1
         ORDER BY answer_key`,
        [questionId],
      );
      const answerByKey = new Map(answersResult.rows.map((answer) => [answer.answer_key, answer]));

      for (const answerFix of fix.answers) {
        const current = answerByKey.get(answerFix.key);
        if (!current) continue;

        const answerFields = [];
        const answerParams = [];
        const addAnswerField = (column, value) => {
          const next = normalizeFixValue(value).trim();
          if (!next) return;
          const before = stringValue(current[column]).trim();
          if (!before || before === next) return;
          answerParams.push(next);
          answerFields.push(`${column} = $${answerParams.length}`);
          changes.push({
            path: fix.path,
            questionId,
            questionNumber: question.question_number,
            answerKey: answerFix.key,
            field: column,
            before,
            after: next,
          });
        };

        addAnswerField("answer_text", answerFix.text);
        addAnswerField("answer_text_cn", answerFix.textCn);
        if (!answerFields.length) continue;

        answerParams.push(current.id);
        await client.query(
          `UPDATE answers SET ${answerFields.join(", ")} WHERE id = $${answerParams.length}`,
          answerParams,
        );
      }
    }
  }

  const formulaResult = await normalizeExamFormulas(client, examId, { apply: true });
  if (changes.length || formulaResult.changedCount) {
    await client.query("UPDATE exams SET updated_at = NOW() WHERE id = $1", [examId]);
  }

  return {
    examId: Number(examId),
    message: `AI đã sửa ${changes.length} chỗ format và rule đã chuẩn hóa ${formulaResult.changedCount || 0} chỗ.`,
    changedCount: changes.length,
    formulaChangedCount: formulaResult.changedCount || 0,
    warningCount: formulaResult.warningCount || 0,
    skippedCount: skipped.length,
    changes: changes.slice(0, 100),
    skipped: skipped.slice(0, 100),
    diagnostics: generated.diagnostics,
    summary: {
      ...generated.summary,
      changedCount: changes.length,
      formulaChangedCount: formulaResult.changedCount || 0,
      warningCount: formulaResult.warningCount || 0,
      skippedCount: skipped.length,
    },
    formulaResult,
  };
}

async function generateMissingExamExplanations(client, examId, options = {}) {
  const { exam, entries } = await loadStoredExamReviewEntries(client, examId);
  const generated = await generateMissingExplanationsWithAI(entries, {
    subject: options.subject || exam.subject_name || exam.subject_code || "CSCA",
  });

  const changes = [];
  const skipped = [];

  for (const item of generated.explanations) {
    const questionId = Number.parseInt(item.questionId, 10);
    if (!questionId) {
      skipped.push({ path: item.path, reason: "AI khong tra questionId hop le." });
      continue;
    }

    const questionResult = await client.query(
      `SELECT id, question_number, explanation, explanation_cn, explanation_image_url
       FROM questions
       WHERE id = $1 AND exam_id = $2 AND deleted_at IS NULL
       LIMIT 1`,
      [questionId, examId],
    );
    const question = questionResult.rows[0];
    if (!question) {
      skipped.push({ path: item.path, questionId, reason: "Cau khong con thuoc de nay." });
      continue;
    }
    if (!isBlankText(question.explanation_image_url)) {
      skipped.push({ path: item.path, questionId, questionNumber: question.question_number, reason: "Cau da co anh giai thich." });
      continue;
    }

    const needsExplanation = isBlankText(question.explanation) || isLikelyChineseExplanation(question.explanation);
    const needsExplanationCn = isBlankText(question.explanation_cn) || isLikelyVietnameseExplanation(question.explanation_cn);
    const nextExplanation = normalizeGeneratedExplanation(item.explanation);
    const nextExplanationCn = normalizeGeneratedExplanation(item.explanationCn);
    const hasValidVietnamese = !isBlankText(nextExplanation) && !isLikelyChineseExplanation(nextExplanation) && (isLikelyVietnameseExplanation(nextExplanation) || hasLatinExplanationText(nextExplanation));
    const hasValidChinese = !isBlankText(nextExplanationCn) && hasCjkText(nextExplanationCn) && !isLikelyVietnameseExplanation(nextExplanationCn);

    const fields = [];
    const params = [];
    const addField = (column, value, before, shouldReplace) => {
      if (!shouldReplace || isBlankText(value)) return;
      params.push(value);
      fields.push(`${column} = $${params.length}`);
      changes.push({
        path: item.path,
        questionId,
        questionNumber: question.question_number,
        field: column,
        before,
        after: value,
      });
    };

    if (needsExplanation) {
      if (hasValidVietnamese) {
        addField("explanation", nextExplanation, question.explanation, true);
      } else {
        skipped.push({
          path: item.path,
          questionId,
          questionNumber: question.question_number,
          reason: item.note || "AI chua tra explanation tieng Viet co dau hop le.",
        });
      }
    }

    if (needsExplanationCn) {
      if (hasValidChinese) {
        addField("explanation_cn", nextExplanationCn, question.explanation_cn, true);
      } else {
        skipped.push({
          path: item.path,
          questionId,
          questionNumber: question.question_number,
          reason: item.note || "AI chua tra explanationCn tieng Trung hop le.",
        });
      }
    }

    if (!fields.length) {
      skipped.push({
        path: item.path,
        questionId,
        questionNumber: question.question_number,
        reason: item.note || "AI chua tao duoc loi giai hop le hoac cau da co giai thich.",
      });
      continue;
    }

    params.push(questionId);
    await client.query(
      `UPDATE questions SET ${fields.join(", ")} WHERE id = $${params.length}`,
      params,
    );
  }

  if (changes.length) {
    await client.query("UPDATE exams SET updated_at = NOW() WHERE id = $1", [examId]);
  }

  return {
    examId: Number(examId),
    message: changes.length
      ? `AI da them giai thich cho ${new Set(changes.map(change => change.questionId)).size} cau.`
      : "Khong co giai thich moi duoc luu.",
    changedCount: changes.length,
    questionChangedCount: new Set(changes.map(change => change.questionId)).size,
    skippedCount: skipped.length,
    changes: changes.slice(0, 100),
    skipped: skipped.slice(0, 100),
    diagnostics: generated.diagnostics,
    summary: {
      ...generated.summary,
      changedCount: changes.length,
      questionChangedCount: new Set(changes.map(change => change.questionId)).size,
      skippedCount: skipped.length,
    },
  };
}

async function polishExamExplanations(client, examId, options = {}) {
  const { exam, entries } = await loadStoredExamReviewEntries(client, examId);
  const generated = await polishExplanationsWithAI(entries, {
    subject: options.subject || exam.subject_name || exam.subject_code || "CSCA",
  });

  const changes = [];
  const skipped = [];

  for (const item of generated.explanations) {
    const questionId = Number.parseInt(item.questionId, 10);
    if (!questionId) {
      skipped.push({ path: item.path, reason: "AI không trả questionId hợp lệ." });
      continue;
    }

    const nextExplanation = normalizeGeneratedExplanation(item.explanation);
    if (!nextExplanation || !VIETNAMESE_DIACRITIC_RE.test(nextExplanation)) {
      skipped.push({
        path: item.path,
        questionId,
        questionNumber: item.questionNumber,
        reason: item.note || "AI chưa trả lời giải tiếng Việt có dấu hợp lệ.",
      });
      continue;
    }

    const questionResult = await client.query(
      `SELECT id, question_number, explanation
       FROM questions
       WHERE id = $1 AND exam_id = $2 AND deleted_at IS NULL
       LIMIT 1`,
      [questionId, examId],
    );
    const question = questionResult.rows[0];
    if (!question) {
      skipped.push({ path: item.path, questionId, reason: "Câu không còn thuộc đề này." });
      continue;
    }

    const before = stringValue(question.explanation).trim();
    if (!before || before === nextExplanation) continue;
    if (!needsVietnameseExplanationPolish(before)) {
      skipped.push({
        path: item.path,
        questionId,
        questionNumber: question.question_number,
        reason: "Lời giải hiện tại không còn cần chuẩn hóa.",
      });
      continue;
    }

    await client.query(
      `UPDATE questions SET explanation = $1 WHERE id = $2`,
      [nextExplanation, questionId],
    );
    changes.push({
      path: item.path,
      questionId,
      questionNumber: question.question_number,
      field: "explanation",
      before,
      after: nextExplanation,
    });
  }

  if (changes.length) {
    await client.query("UPDATE exams SET updated_at = NOW() WHERE id = $1", [examId]);
  }

  return {
    examId: Number(examId),
    message: changes.length
      ? `AI đã chuẩn hóa lời giải cho ${changes.length} câu.`
      : "Không có lời giải nào được chuẩn hóa.",
    changedCount: changes.length,
    questionChangedCount: changes.length,
    skippedCount: skipped.length,
    changes: changes.slice(0, 100),
    skipped: skipped.slice(0, 100),
    diagnostics: generated.diagnostics,
    summary: {
      ...generated.summary,
      changedCount: changes.length,
      questionChangedCount: changes.length,
      skippedCount: skipped.length,
    },
  };
}

async function reviewStoredExamWithAI(client, examId, context = {}) {
  const examResult = await client.query(
    `SELECT e.id, e.title, s.name as subject_name, s.code as subject_code
     FROM exams e
     LEFT JOIN subjects s ON s.id = e.subject_id
     WHERE e.id = $1 AND e.deleted_at IS NULL
     LIMIT 1`,
    [examId],
  );

  if (!examResult.rows.length) {
    const error = new Error("EXAM_NOT_FOUND");
    error.statusCode = 404;
    throw error;
  }

  const questionsResult = await client.query(
    `SELECT
       q.id,
       q.question_number,
       q.question_type,
       q.question_text,
       q.question_text_cn,
       q.image_url,
       q.explanation,
       q.explanation_cn,
       q.explanation_image_url,
       q.passage_text,
       q.passage_image_url,
       q.linked_options,
       q.sub_question_number,
       q.passage_group_id,
       COALESCE(
         q.linked_options,
         (SELECT linked_options FROM questions parent
          WHERE parent.id = q.passage_group_id
            AND parent.question_type = 'fill_blank_pool')
       ) as effective_linked_options,
       COALESCE(
         q.passage_text,
         (SELECT passage_text FROM questions parent
          WHERE parent.id = q.passage_group_id
            AND parent.passage_text IS NOT NULL
          ORDER BY parent.id LIMIT 1)
       ) as effective_passage_text,
       COALESCE(
         q.passage_image_url,
         (SELECT passage_image_url FROM questions parent
          WHERE parent.id = q.passage_group_id
            AND parent.passage_image_url IS NOT NULL
          ORDER BY parent.id LIMIT 1)
       ) as effective_passage_image_url,
       json_agg(
         json_build_object(
           'id', a.id,
           'answer_key', a.answer_key,
           'answer_text', a.answer_text,
           'answer_text_cn', a.answer_text_cn,
           'image_url', a.image_url,
           'is_correct', a.is_correct
         ) ORDER BY a.answer_key
       ) FILTER (WHERE a.id IS NOT NULL) as answers
     FROM questions q
     LEFT JOIN answers a ON a.question_id = q.id
     WHERE q.exam_id = $1
       AND q.deleted_at IS NULL
       AND q.question_type NOT IN ('reading_passage', 'fill_blank_pool')
     GROUP BY q.id
     ORDER BY q.question_number, q.id`,
    [examId],
  );

  const entries = questionsResult.rows.map((question) => {
    const questionNumber = question.sub_question_number || question.question_number;
    return {
      path: `question:${question.id}`,
      label: `Câu ${questionNumber}`,
      kind: "stored",
      questionId: question.id,
      questionNumber,
      questionType: question.question_type,
      parentQuestionId: question.passage_group_id || undefined,
      contextText: question.effective_passage_text || question.passage_text || "",
      contextImageUrl: question.effective_passage_image_url || question.passage_image_url || "",
      question: {
        questionText: question.question_text || "",
        questionTextCn: question.question_text_cn || "",
        imageUrl: question.image_url || "",
        answers: normalizeReviewAnswers(question),
        correctAnswer: getCurrentCorrectAnswer(question),
        explanation: question.explanation || "",
        explanationCn: question.explanation_cn || "",
        explanationImageUrl: question.explanation_image_url || "",
      },
    };
  });

  const exam = examResult.rows[0];
  const result = await reviewQuestionEntriesWithAI(entries, {
    ...context,
    subject: context.subject || exam.subject_name || exam.subject_code || "CSCA",
  });
  const safeFixPreview = await normalizeExamFormulas(client, examId, { apply: false });

  return {
    examId: Number(examId),
    exam: {
      id: exam.id,
      title: exam.title,
      subjectName: exam.subject_name,
      subjectCode: exam.subject_code,
    },
    ...result,
    safeFixPreview,
  };
}

module.exports = {
  normalizeExamFormulas,
  normalizeField,
  normalizeStoredFormulaText,
  generateMissingExamExplanations,
  polishExamExplanations,
  applyExamDisplayFormatFixes,
  applyExamReviewFixes,
  applyImportedReviewFixesWithAI,
  reviewStoredExamWithAI,
  reviewImportedItemsWithAI,
};
