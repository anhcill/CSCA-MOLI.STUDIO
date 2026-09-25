'use client';

import { useEffect, useRef, useState } from 'react';

type PdfComparisonDocumentProps = {
  url: string;
  title: string;
};

type ViewerStatus = 'loading' | 'ready' | 'error';

export default function PdfComparisonDocument({ url, title }: PdfComparisonDocumentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [status, setStatus] = useState<ViewerStatus>('loading');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => {
      const nextWidth = Math.floor(container.clientWidth);
      // Rendering pages can introduce a scrollbar that changes width by a few
      // pixels. Ignore that tiny oscillation so PDF.js does not reload forever.
      setContainerWidth((currentWidth) => (
        currentWidth === 0 || Math.abs(currentWidth - nextWidth) >= 24
          ? nextWidth
          : currentWidth
      ));
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!containerWidth) return;

    let active = true;
    let loadingTask: any;
    let pdfDocument: any;
    const renderTasks: any[] = [];

    const renderDocument = async () => {
      const container = containerRef.current;
      if (!container) return;

      try {
        setStatus('loading');
        container.replaceChildren();
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString();

        loadingTask = pdfjs.getDocument({
          url,
          rangeChunkSize: 1024 * 1024,
          disableRange: false,
          disableStream: true,
          disableAutoFetch: true,
        });
        pdfDocument = await loadingTask.promise;
        if (!active) return;

        const availableWidth = Math.max(260, containerWidth - 28);
        const outputScale = Math.min(window.devicePixelRatio || 1, 1.5);

        for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
          const page = await pdfDocument.getPage(pageNumber);
          if (!active) {
            page.cleanup();
            return;
          }

          const baseViewport = page.getViewport({ scale: 1 });
          const cssScale = availableWidth / baseViewport.width;
          const cssViewport = page.getViewport({ scale: cssScale });
          const renderViewport = page.getViewport({ scale: cssScale * outputScale });
          const pageShell = document.createElement('div');
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d', { alpha: false });
          if (!context) throw new Error('Trình duyệt không hỗ trợ canvas PDF.');

          pageShell.className = 'mb-3 last:mb-0';
          canvas.width = Math.floor(renderViewport.width);
          canvas.height = Math.floor(renderViewport.height);
          canvas.style.width = `${Math.floor(cssViewport.width)}px`;
          canvas.style.height = `${Math.floor(cssViewport.height)}px`;
          canvas.className = 'mx-auto block bg-white shadow-sm';
          pageShell.appendChild(canvas);
          container.appendChild(pageShell);

          const renderTask = page.render({ canvasContext: context, viewport: renderViewport, canvas });
          renderTasks.push(renderTask);
          await renderTask.promise;
          page.cleanup();
        }

        if (active) setStatus('ready');
      } catch (error: any) {
        if (error?.name === 'RenderingCancelledException' || !active) return;
        console.error('Render comparison PDF error:', error);
        setStatus('error');
      }
    };

    renderDocument();
    return () => {
      active = false;
      renderTasks.forEach((task) => task.cancel?.());
      loadingTask?.destroy?.();
      pdfDocument?.destroy?.();
    };
  }, [containerWidth, url]);

  return (
    <div className="relative h-full overflow-y-scroll bg-slate-100 p-3 [scrollbar-gutter:stable] sm:p-4" aria-label={title}>
      <div ref={containerRef} />
      {status === 'loading' && (
        <div className="absolute inset-0 grid place-items-center bg-white/80">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-600" />
        </div>
      )}
      {status === 'error' && (
        <div className="grid h-full place-items-center text-center text-sm font-bold text-slate-500">Không thể hiển thị PDF này.</div>
      )}
    </div>
  );
}
