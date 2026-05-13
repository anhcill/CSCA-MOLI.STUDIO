'use client';

import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import rehypeSanitize from 'rehype-sanitize';
import remarkMath from 'remark-math';

interface RichMathTextProps {
  value: string;
  className?: string;
}

function normalizeMathDelimiters(value: string) {
  const normalizeText = (text: string) =>
    text
      .replace(/\\\[([\s\S]*?)\\\]/g, (_, formula) => `$$\n${formula.trim()}\n$$`)
      .replace(/\\\(([\s\S]*?)\\\)/g, (_, formula) => `$${formula}$`)
      .replace(/(^|\n)\$\$([^\n]+?)\$\$(?=\n|$)/g, (_, prefix, formula) => `${prefix}$$\n${formula.trim()}\n$$`);

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
