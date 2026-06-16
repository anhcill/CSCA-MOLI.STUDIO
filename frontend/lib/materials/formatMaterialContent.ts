function textFromHtmlFallback(html: string) {
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|h[1-6]|li|ul|ol|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<sup[^>]*>([\s\S]*?)<\/sup>/gi, '^{$1}')
    .replace(/<sub[^>]*>([\s\S]*?)<\/sub>/gi, '_{$1}')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function compactInline(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function nodeToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  if (tag === 'script' || tag === 'style' || tag === 'noscript') return '';
  if (tag === 'br') return '\n';

  const children = Array.from(el.childNodes).map(nodeToMarkdown).join('');
  const text = children.trim();
  if (!text) return '';

  if (tag === 'h1') return `\n\n# ${compactInline(text)}\n\n`;
  if (tag === 'h2') return `\n\n## ${compactInline(text)}\n\n`;
  if (tag === 'h3') return `\n\n### ${compactInline(text)}\n\n`;
  if (tag === 'h4' || tag === 'h5' || tag === 'h6') return `\n\n#### ${compactInline(text)}\n\n`;
  if (tag === 'p' || tag === 'div' || tag === 'section' || tag === 'article') return `\n\n${text}\n\n`;
  if (tag === 'li') return `\n- ${compactInline(text)}\n`;
  if (tag === 'ul' || tag === 'ol') return `\n${children}\n`;
  if (tag === 'sup') return `^{${compactInline(text)}}`;
  if (tag === 'sub') return `_{${compactInline(text)}}`;
  if (tag === 'td' || tag === 'th') return `${compactInline(text)} | `;
  if (tag === 'tr') return `\n${children}`;
  if (tag === 'table') return `\n\n${children}\n\n`;
  if (tag === 'strong' || tag === 'b') return `**${compactInline(text)}**`;
  if (tag === 'em' || tag === 'i') return `*${compactInline(text)}*`;

  return children;
}

function htmlToMarkdown(html: string) {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return textFromHtmlFallback(html);
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,style,noscript').forEach((el) => el.remove());
  return Array.from(doc.body.childNodes)
    .map(nodeToMarkdown)
    .join('')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function formatMaterialContentForMath(input: { content_html?: string | null; content_text?: string | null }) {
  const html = (input.content_html || '').trim();
  const text = (input.content_text || '').trim();
  return html ? htmlToMarkdown(html) : text;
}
