'use client';

import { useMemo } from 'react';
import RichMathText from '@/components/common/RichMathText';
import { formatMaterialContentForMath } from '@/lib/materials/formatMaterialContent';

interface MaterialContentViewerProps {
  contentHtml?: string | null;
  contentText?: string | null;
  className?: string;
}

export default function MaterialContentViewer({
  contentHtml,
  contentText,
  className = '',
}: MaterialContentViewerProps) {
  const content = useMemo(
    () => formatMaterialContentForMath({ content_html: contentHtml, content_text: contentText }),
    [contentHtml, contentText],
  );

  if (!content) return null;

  return (
    <article className={`material-content-viewer bg-white px-5 py-6 text-gray-800 sm:px-8 ${className}`}>
      <RichMathText
        value={content}
        readableBreaks
        className="text-[15px] leading-8 [&_.katex-display]:my-4 [&_.katex-display]:overflow-x-auto [&_.katex]:text-[1.04em] [&_h1]:mb-4 [&_h1]:text-2xl [&_h1]:font-black [&_h2]:mb-4 [&_h2]:text-xl [&_h2]:font-black [&_h3]:mb-3 [&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-bold [&_p]:mb-3"
      />
    </article>
  );
}
