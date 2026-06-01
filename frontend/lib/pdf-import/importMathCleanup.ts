import { normalizeLatexMath, normalizeRichMathText } from '@/lib/math/normalizeMath';
import type { ImportedQuestionData } from '@/lib/api/examAdmin';

const ANSWER_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

function repairImportedPdfText(input: string): string {
  const subscriptLetters = Array.from(new Set(
    Array.from(input.matchAll(/\b([A-Za-z])(?:\s+(?:n|\d)|_\{?(?:n|\d)\}?)\b/g)).map(match => match[1]),
  ));

  let repaired = input
    .replace(/\(\[\)\/\(([^)]*)\)\)/g, '[$1)')
    .replace(/\(\(\)\/\(([^)]*)\)\)/g, '($1)')
    .replace(/\u221a\(\s*(\d+)\s*=\s*(\d+)\s*\)\s*\/\s*\(\s*\u221a\s*\)/g, (_, total, coefficient) => {
      const remaining = Number(total) / Number(coefficient) ** 2;
      return Number.isInteger(remaining) && remaining > 1
        ? `\u221a${total}=${coefficient}\u221a${remaining}`
        : `\u221a${total}=${coefficient}\u221a`;
    })
    .replace(/\(\s*\u221a\s*\)\s*\/\s*\(\s*(\d+)\s*=\s*(\d+)([。.]?)\s*\)/g, '\u221a$1=$2$3')
    .replace(
      /\u221a\s*\(?\s*([+-]?\d+(?:\.\d+)?)\s*\)?\s*\^\s*2\s*\+\s*\(?\s*([+-]?\d+(?:\.\d+)?)\s*\)?\s*\^\s*2\s*=\s*\u221a\s*(\d+)/g,
      (_, left, right, total) => {
        const leftTerm = Number(left) < 0 ? `(${left})^2` : `${left}^2`;
        const rightTerm = Number(right) < 0 ? `(${right})^2` : `${right}^2`;
        return `\\sqrt{${leftTerm}+${rightTerm}}=\\sqrt{${total}}`;
      },
    )
    .replace(/\b([A-Za-z])\s+([0-9n])\b/g, '$1_{$2}')
    .replace(/\bf\s*[′']\s*\(/g, "f'(")
    .replace(/\s+([,.;:，。；：）)\]])/g, '$1')
    .replace(/([（(\[])\s+/g, '$1');

  for (const letter of subscriptLetters) {
    if (/^[xyzt]$/i.test(letter)) continue;
    const escaped = letter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    repaired = repaired.replace(new RegExp(`\\b${escaped}\\s*\\^\\s*\\{?([0-9n])\\}?`, 'g'), `${letter}_{$1}`);
  }

  return repaired.replace(/([,，;；]\s*)([xyzt])\s*\^\s*\{?([0-9n])\}?(\s*=)/gi, '$1$2_{$3}$4');
}

export function normalizeImportedText(value?: string): string | undefined {
  if (!value) return value;
  return normalizeRichMathText(repairImportedPdfText(value));
}

function stripMathDelimiters(input: string): string {
  return input
    .replace(/\\\(|\\\)|\\\[|\\\]|\$\$/g, '')
    .replace(/\$/g, '');
}

function comparableText(value?: string): string {
  if (!value) return '';
  return stripMathDelimiters(normalizeRichMathText(repairImportedPdfText(value)))
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '$1/$2')
    .replace(/\\sqrt\{([^{}]+)\}/g, 'sqrt($1)')
    .replace(/\\mathbb\{([^{}]+)\}/g, '$1')
    .replace(/\\(?:sin|cos|tan|cot|sec|csc|ln|lg|log)\s*/g, '')
    .replace(/\\(?:le|ge|ne|approx|infty|cup|cap|in|notin|setminus|emptyset|circ)\b/g, '')
    .replace(/[{}\\]/g, '')
    .replace(/[，。；：,.;:\s]/g, '')
    .toLowerCase();
}

function mathComparable(value?: string): string {
  if (!value) return '';
  return normalizeLatexMath(repairImportedPdfText(value))
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '$1/$2')
    .replace(/\\sqrt\{([^{}]+)\}/g, 'sqrt($1)')
    .replace(/\\mathbb\{([^{}]+)\}/g, '$1')
    .replace(/[{}\\\s]/g, '')
    .toLowerCase();
}

function explicitAnswerKey(value: string): string {
  const match = value.match(
    /(?:\u7b54\u6848|\u6b63\u786e\u7b54\u6848|\u6b63\u89e3|\u6545\u9009|\u5e94\u9009|\u9009|answer|correct\s*answer)\s*[:：为是]?\s*([A-H])/i,
  );
  return match?.[1]?.toUpperCase() || '';
}

function markerScore(explanation: string, answer: string): number {
  if (!answer) return 0;

  const escaped = answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const boundary = '(?:$|[)\\]}），。；;,.]|\\b)';
  const markerPattern = new RegExp(`(?:=|=>|->|:|\u4e3a|\u5f97|\u5171|\u662f|\u5373)${escaped}${boundary}`);
  if (markerPattern.test(explanation)) return 4;
  if (new RegExp(`${escaped}${boundary}`).test(explanation)) return 3;
  if (answer.length >= 2 && explanation.includes(answer)) return 2;
  return 0;
}

export function inferImportedCorrectAnswer(question: ImportedQuestionData): string {
  const answers = question.answers || [];
  const allowed = ANSWER_KEYS.slice(0, answers.length);
  const existing = (question.correctAnswer || '').toUpperCase();
  if (allowed.includes(existing)) return existing;

  const combined = [
    question.explanation,
    question.explanationCn,
    question.questionText,
    question.questionTextCn,
  ].filter(Boolean).join('\n');

  const explicit = explicitAnswerKey(combined);
  if (allowed.includes(explicit)) return explicit;

  const comparableExplanation = comparableText(combined);
  const scored = answers
    .map((answer, index) => {
      const values = [answer.text, answer.textCn]
        .map(value => [comparableText(value), mathComparable(value)])
        .flat()
        .filter(Boolean);
      const score = Math.max(0, ...values.map(value => markerScore(comparableExplanation, value)));
      return { key: ANSWER_KEYS[index], score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return '';
  if (scored.length > 1 && scored[0].score === scored[1].score) return '';
  return scored[0].key;
}
