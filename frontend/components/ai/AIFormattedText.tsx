'use client';

import RichMathText from '@/components/common/RichMathText';

interface AIFormattedTextProps {
  value?: string | null;
  className?: string;
}

const BULLET_MARKER = String.raw`(?:[\u2022\u25cf\u25e6\u25aa\u25ab\u2023\u2043\u2219*]|\-|\u2013|\u2014|\u00b7|\u00e2\u20ac\u00a2|\u00e2\u20ac\u201c|\u00e2\u20ac\u201d)`;
const BULLET_ONLY_RE = new RegExp(`^${BULLET_MARKER}$`);
const BULLET_PREFIX_RE = new RegExp(`^${BULLET_MARKER}\\s+(.+)$`);

function stripInlineMarkdown(value: string) {
  return value
    .replace(/^#{1,6}\s+/, '')
    .replace(/^\*\*(.+)\*\*$/, '$1')
    .replace(/^__(.+)__$/, '$1')
    .trim();
}

function hasMathSignal(value: string) {
  return /(\\\(|\\\[|\\\{|\\frac|\\sqrt|\\sum|\\int|\\cup|\\cap|\\setminus|\\ne|\\le|\\ge|[$=<>^_{}])/.test(value);
}

function isLikelySectionHeading(value: string) {
  const text = stripInlineMarkdown(value);
  if (text.length < 3 || text.length > 72) return false;
  if (hasMathSignal(text)) return false;
  if (/^[A-Z]\s*[:.)]/i.test(text)) return false;
  if (/[:\uFF1A]$/.test(text)) return true;
  if (/[?？]$/.test(text) && /^(vì sao|tai sao|tại sao|vi sao|cách|cach|lưu ý|luu y|nhận xét|nhan xet)/i.test(text)) return true;
  return false;
}

function formatSectionHeading(value: string) {
  const text = stripInlineMarkdown(value).replace(/[:\uFF1A]\s*$/, '').trim();
  return /[?？]$/.test(text) ? `**${text}**` : `**${text}:**`;
}

function formatLeadingLabel(value: string) {
  const match = value.match(/^([^:\uFF1A]{2,40}[:\uFF1A])\s+(.+)$/);
  if (!match) return value;

  const label = stripInlineMarkdown(match[1]).replace(/[:\uFF1A]\s*$/, '').trim();
  const body = match[2].trim();
  if (!label || !body || hasMathSignal(label)) return value;

  return `**${label}:** ${body}`;
}

export function normalizeAIFormattedText(value: string) {
  const lines = value
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .split('\n');

  const out: string[] = [];
  let pendingBullet = false;
  let inFence = false;

  const pushBlankBeforeHeading = () => {
    if (out.length > 0 && out[out.length - 1] !== '') out.push('');
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const fence = line.match(/^(```|~~~)/);

    if (fence) {
      pendingBullet = false;
      inFence = !inFence;
      out.push(rawLine);
      continue;
    }

    if (inFence) {
      out.push(rawLine);
      continue;
    }

    if (!line) {
      if (pendingBullet) continue;
      if (out.length > 0 && out[out.length - 1] !== '') out.push('');
      continue;
    }

    if (BULLET_ONLY_RE.test(line)) {
      pendingBullet = true;
      continue;
    }

    const bulletMatch = line.match(BULLET_PREFIX_RE);
    const bulletText = bulletMatch?.[1]?.trim();

    if (bulletText && isLikelySectionHeading(bulletText)) {
      pushBlankBeforeHeading();
      out.push(formatSectionHeading(bulletText));
      out.push('');
      pendingBullet = false;
      continue;
    }

    if (pendingBullet && isLikelySectionHeading(line)) {
      pushBlankBeforeHeading();
      out.push(formatSectionHeading(line));
      out.push('');
      pendingBullet = false;
      continue;
    }

    if (bulletText) {
      out.push(`- ${formatLeadingLabel(bulletText)}`);
      pendingBullet = false;
      continue;
    }

    if (pendingBullet) {
      out.push(`- ${formatLeadingLabel(line)}`);
      pendingBullet = false;
      continue;
    }

    if (isLikelySectionHeading(line)) {
      pushBlankBeforeHeading();
      out.push(formatSectionHeading(line));
      out.push('');
      continue;
    }

    out.push(formatLeadingLabel(rawLine.trimEnd()));
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export default function AIFormattedText({ value, className = '' }: AIFormattedTextProps) {
  if (!value) return null;
  return <RichMathText value={normalizeAIFormattedText(value)} className={className} />;
}
