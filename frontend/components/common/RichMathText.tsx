'use client';

import ReactMarkdown from 'react-markdown';
import { memo, useMemo } from 'react';
import rehypeKatex from 'rehype-katex';
import rehypeSanitize from 'rehype-sanitize';
import remarkMath from 'remark-math';
import { isLikelyLooseMathLine, normalizeLatexMath, normalizeRichMathText } from '@/lib/math/normalizeMath';

interface RichMathTextProps {
  value: string;
  className?: string;
  readableBreaks?: boolean;
}

function tidyReadableBreaks(value: string) {
  return value
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function applyReadableBreakRules(value: string) {
  return value
    .replace(/\s*((?:前\s*n\s*[项項]和公式|通[项項]公式|代入(?:数据|數據)?解不等式|验证|驗證|检验|檢驗|结论|結論|所以)\s*[:：])/g, '\n$1')
    .replace(/\s*((?:Công thức|Thay|Kiểm tra|Kết luận|Chọn|Vậy)\s*[:：])/gi, '\n$1')
    .replace(/\s*((?:考[虑慮]?|考虑|考慮)\s*[A-H]\s*[：:])/g, '\n$1')
    .replace(/\s*((?:垂直条件|垂直條件|计算|計算|方程组|方程組|由两西不等式|由两式不等式|由兩式不等式)\s*[:：])/g, '\n$1')
    .replace(/\s*((?:步骤|步驟|Bước)\s*\d+\s*(?:[（(][^）)]{1,24}[）)])?\s*[:：])/gi, '\n$1')
    .replace(/\s*(⇔|=>|⇒|\\Rightarrow)\s*/g, '\n$1 ')
    .replace(/([。.;；])\s*(?=(?:过点|過點|设直线|設直線|考虑|考慮|由|由于|因|当|比較|比较|代入|验证|驗證|因此|所以|故|选|答案|解析|得|Suy ra|Vậy|n\s*=))/g, '$1\n')
    .replace(/([，,])\s*(?=(?:n|x|m|k)\s*=\s*-?\d+\s*(?:时|時))/g, '$1\n')
    .replace(/[，,]\s*(?=(?:代入|值域|定义域|反函数|由于|因此|所以|故|选|答案|得))/g, '，\n')
    .replace(/([:：])\s*(?=(?:[A-Za-z0-9\\(√]|\\log|\\frac|\\sqrt))/g, '$1\n')
    .replace(/\s*(选\s*[A-H][.。]?)/gi, '\n$1')
    .replace(/\n\s*\n(?=(?:⇔|=>|⇒|\\Rightarrow))/g, '\n');
}

function restoreReadableBreaks(value: string) {
  const normalized = value
    .replace(/\\n/g, '\n')
    .replace(/\r\n?/g, '\n');

  return tidyReadableBreaks(applyReadableBreakRules(normalized));
}

function normalizeMathDelimiters(value: string) {
  const normalizeText = (text: string) =>
    autoWrapLooseMathLines(
      normalizeRichMathText(text)
        .replace(/\\\[([\s\S]*?)\\\]/g, (_, formula) => `$$\n${normalizeLatexMath(formula)}\n$$`)
        .replace(/\\\(([\s\S]*?)\\\)/g, (_, formula) => `$${normalizeLatexMath(formula)}$`)
        .replace(/(^|\n)\$\$([^\n]+?)\$\$(?=\n|$)/g, (_, prefix, formula) => `${prefix}$$\n${normalizeLatexMath(formula)}\n$$`),
    );

  return value
    .replace(/\r\n?/g, '\n')
    .split(/(```[\s\S]*?```|~~~[\s\S]*?~~~)/g)
    .map((part) => {
      if (part.startsWith('```') || part.startsWith('~~~')) return part;

      return part
        .split(/(`[^`\n]*`)/g)
        .map((inlinePart) => (inlinePart.startsWith('`') ? inlinePart : normalizeText(inlinePart)))
        .join('');
    })
    .join('');
}

function autoWrapLooseMathLines(text: string) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes('$') || !isLikelyLooseMathLine(line)) {
      out.push(line);
      continue;
    }

    const group = [line];
    while (i + 1 < lines.length && !lines[i + 1].includes('$') && isLikelyLooseMathLine(lines[i + 1])) {
      group.push(lines[i + 1]);
      i++;
    }

    out.push(`$${normalizeLatexMath(group.join('\n'))}$`);
  }

  return out.join('\n');
}

function RichMathText({ value, className = '', readableBreaks = false }: RichMathTextProps) {
  const source = useMemo(() => (readableBreaks ? restoreReadableBreaks(value) : value), [readableBreaks, value]);
  const markdown = useMemo(() => (source ? normalizeMathDelimiters(source) : ''), [source]);

  if (!value) return null;

  return (
    <div className={`rich-math-text text-sm leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeSanitize, rehypeKatex]}
        components={{
          p: ({ children }) => <p className="mb-2 whitespace-pre-wrap last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-2 list-disc pl-5 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 list-decimal pl-5 space-y-1">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          code: ({ children }) => (
            <code className="rounded bg-black/5 px-1 py-0.5 font-mono text-[0.92em]">
              {children}
            </code>
          ),
          }}
        >
          {markdown}
        </ReactMarkdown>
    </div>
  );
}

export default memo(RichMathText);
