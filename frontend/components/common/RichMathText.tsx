'use client';

import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import rehypeSanitize from 'rehype-sanitize';
import remarkMath from 'remark-math';
import { isLikelyLooseMathLine, normalizeLatexMath, normalizeRichMathText } from '@/lib/math/normalizeMath';

interface RichMathTextProps {
  value: string;
  className?: string;
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

export default function RichMathText({ value, className = '' }: RichMathTextProps) {
  if (!value) return null;

  const markdown = normalizeMathDelimiters(value);

  return (
    <div className={`rich-math-text text-sm leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeSanitize, rehypeKatex]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
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
