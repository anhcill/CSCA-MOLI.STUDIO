'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

type MobilePdfViewerProps = {
  url: string;
  title: string;
  twoPage?: boolean;
  onReady?: () => void;
  onError?: (message: string) => void;
};

export default function MobilePdfViewer({ url, title, twoPage = false, onReady, onError }: MobilePdfViewerProps) {
  const firstCanvasRef = useRef<HTMLCanvasElement>(null);
  const secondCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const documentRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let loadingTask: any;

    const loadDocument = async () => {
      try {
        setPageLoading(true);
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
        const pdf = await loadingTask.promise;
        if (!active) {
          await pdf.destroy();
          return;
        }
        documentRef.current = pdf;
        setPageCount(pdf.numPages);
        setPageNumber(1);
      } catch (error) {
        if (!active) return;
        onError?.(error instanceof Error ? error.message : 'Không mở được PDF trên điện thoại.');
      }
    };

    loadDocument();
    return () => {
      active = false;
      renderTaskRef.current?.cancel?.();
      loadingTask?.destroy?.();
      documentRef.current?.destroy?.();
      documentRef.current = null;
    };
  }, [onError, url]);

  const renderPage = useCallback(async () => {
    const pdf = documentRef.current;
    const container = containerRef.current;
    if (!pdf || !firstCanvasRef.current || !container || !pageCount) return;

    try {
      setPageLoading(true);
      renderTaskRef.current?.cancel?.();
      const visiblePages = twoPage && pageNumber < pageCount ? [pageNumber, pageNumber + 1] : [pageNumber];
      const canvases = [firstCanvasRef.current, secondCanvasRef.current];
      const availableWidth = Math.max(
        twoPage ? 260 : 280,
        (container.clientWidth - (twoPage ? 28 : 16)) / visiblePages.length,
      );
      const outputScale = Math.min(window.devicePixelRatio || 1, 2);

      for (let index = 0; index < visiblePages.length; index += 1) {
        const canvas = canvases[index];
        if (!canvas) continue;
        const page = await pdf.getPage(visiblePages[index]);
        const baseViewport = page.getViewport({ scale: 1 });
        const cssScale = availableWidth / baseViewport.width;
        const renderViewport = page.getViewport({ scale: cssScale * outputScale });
        const cssViewport = page.getViewport({ scale: cssScale });
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) throw new Error('Trình duyệt không hỗ trợ canvas PDF.');

        canvas.width = Math.floor(renderViewport.width);
        canvas.height = Math.floor(renderViewport.height);
        canvas.style.width = `${Math.floor(cssViewport.width)}px`;
        canvas.style.height = `${Math.floor(cssViewport.height)}px`;
        const renderTask = page.render({ canvasContext: context, viewport: renderViewport, canvas });
        renderTaskRef.current = renderTask;
        await renderTask.promise;
        page.cleanup();
      }
      setPageLoading(false);
      onReady?.();
    } catch (error: any) {
      if (error?.name === 'RenderingCancelledException') return;
      onError?.(error instanceof Error ? error.message : 'Không render được trang PDF.');
    }
  }, [onError, onReady, pageCount, pageNumber, twoPage]);

  useEffect(() => {
    renderPage();
    const handleResize = () => renderPage();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderPage]);

  const goToPage = (nextPage: number) => {
    if (!pageCount) return;
    const clampedPage = Math.min(pageCount, Math.max(1, Math.trunc(nextPage) || 1));
    setPageNumber(twoPage ? clampedPage - ((clampedPage - 1) % 2) : clampedPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const pageStep = twoPage ? 2 : 1;
  const lastVisiblePage = Math.min(pageCount, pageNumber + (twoPage ? 1 : 0));

  return (
    <div className="flex min-h-[calc(100svh-6rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 shadow-sm">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-2 py-2 shadow-sm">
        <button type="button" onClick={() => goToPage(pageNumber - pageStep)} disabled={pageNumber <= 1 || pageLoading} className="inline-flex h-10 items-center gap-1 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 disabled:opacity-40">
          <FiChevronLeft /> Trước
        </button>
        <label className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
          Trang
          <input type="number" min={1} max={Math.max(1, pageCount)} value={pageNumber} onChange={(event) => goToPage(Number(event.target.value))} className="h-9 w-16 rounded-lg border border-slate-300 text-center outline-none focus:border-violet-500" aria-label="Số trang PDF" />
          {twoPage && lastVisiblePage > pageNumber ? `–${lastVisiblePage}` : ''} / {pageCount || '…'}
        </label>
        <button type="button" onClick={() => goToPage(pageNumber + pageStep)} disabled={!pageCount || lastVisiblePage >= pageCount || pageLoading} className="inline-flex h-10 items-center gap-1 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 disabled:opacity-40">
          Sau <FiChevronRight />
        </button>
      </div>

      <div ref={containerRef} className="relative flex flex-1 items-start justify-center gap-3 overflow-auto p-2" aria-label={title}>
        {pageLoading && (
          <div className="absolute inset-0 z-[1] grid place-items-center bg-white/80">
            <div className="text-center">
              <div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
              <p className="text-sm font-bold text-slate-600">Đang tải trang {pageNumber}…</p>
            </div>
          </div>
        )}
        <canvas ref={firstCanvasRef} className="h-fit max-w-full bg-white shadow-lg" />
        {twoPage && pageNumber < pageCount && <canvas ref={secondCanvasRef} className="h-fit max-w-full bg-white shadow-lg" />}
      </div>
    </div>
  );
}
