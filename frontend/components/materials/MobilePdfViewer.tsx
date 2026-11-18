'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiChevronDown, FiChevronUp, FiMaximize2, FiZoomIn, FiZoomOut } from 'react-icons/fi';

type MobilePdfViewerProps = {
  url?: string;
  data?: ArrayBuffer | Uint8Array | null;
  title: string;
  className?: string;
  scrollContainerOnly?: boolean;
  hideToolbar?: boolean;
  darkCanvasSurface?: boolean;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  onPageInfoChange?: (info: { currentPage: number; pageCount: number }) => void;
  onReady?: () => void;
  onError?: (message: string) => void;
};

type PageRatio = {
  width: number;
  height: number;
};

export const PDF_MIN_ZOOM = 0.5;
export const PDF_MAX_ZOOM = 2.5;
export const PDF_ZOOM_STEP = 0.15;

export default function MobilePdfViewer({
  url,
  data,
  title,
  className = '',
  scrollContainerOnly = false,
  hideToolbar = false,
  darkCanvasSurface = false,
  zoom: controlledZoom,
  onZoomChange,
  onPageInfoChange,
  onReady,
  onError,
}: MobilePdfViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const documentRef = useRef<any>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const pageSlotRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const renderTasksRef = useRef<Map<number, any>>(new Map());
  const renderedScaleRef = useRef<Map<number, number>>(new Map());
  const renderingPagesRef = useRef<Set<number>>(new Set());
  const visiblePagesRef = useRef<Set<number>>(new Set([1, 2, 3]));
  const ratioMapRef = useRef<Map<number, PageRatio>>(new Map());
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  const readyEmittedRef = useRef(false);

  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [internalZoom, setInternalZoom] = useState(1);
  const [containerWidth, setContainerWidth] = useState(820);
  const [initialLoading, setInitialLoading] = useState(true);
  const [renderGeneration, setRenderGeneration] = useState(0);

  const zoom = typeof controlledZoom === 'number' && Number.isFinite(controlledZoom)
    ? Math.min(PDF_MAX_ZOOM, Math.max(PDF_MIN_ZOOM, controlledZoom))
    : internalZoom;
  const zoomRef = useRef(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const updateZoom = useCallback((nextZoom: number) => {
    const clamped = Number(Math.min(PDF_MAX_ZOOM, Math.max(PDF_MIN_ZOOM, nextZoom)).toFixed(2));
    setInternalZoom(clamped);
    onZoomChange?.(clamped);
  }, [onZoomChange]);

  const updateZoomRef = useRef(updateZoom);
  useEffect(() => {
    updateZoomRef.current = updateZoom;
  }, [updateZoom]);

  useEffect(() => {
    onPageInfoChange?.({ currentPage, pageCount });
  }, [currentPage, onPageInfoChange, pageCount]);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const measure = () => {
      const nextWidth = Math.max(280, el.clientWidth - 32);
      setContainerWidth((prev) => (Math.abs(prev - nextWidth) >= 8 ? nextWidth : prev));
    };
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Prevent browser Ctrl+Wheel zoom inside PDF viewport and translate to viewer zoom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const delta = event.deltaY < 0 ? 0.1 : -0.1;
      updateZoomRef.current(zoomRef.current + delta);
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  const cancelAllRenderTasks = useCallback(() => {
    renderTasksRef.current.forEach((task) => {
      try {
        task?.cancel?.();
      } catch {
        // Ignore cancellation error
      }
    });
    renderTasksRef.current.clear();
    renderingPagesRef.current.clear();
  }, []);

  useEffect(() => {
    if (!data && !url) return undefined;
    let active = true;
    let loadingTask: any;
    readyEmittedRef.current = false;
    ratioMapRef.current.clear();
    renderedScaleRef.current.clear();
    cancelAllRenderTasks();
    visiblePagesRef.current = new Set([1, 2, 3, 4]);

    const loadDocument = async () => {
      try {
        setInitialLoading(true);
        setPageCount(0);
        setCurrentPage(1);
        setPageInput('1');

        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString();

        const source = data
          ? {
              data: data instanceof Uint8Array
                ? data.slice()
                : new Uint8Array(data.slice(0)),
            }
          : {
              url,
              rangeChunkSize: 1024 * 1024,
              disableRange: false,
              disableStream: true,
              disableAutoFetch: true,
            };

        loadingTask = pdfjs.getDocument(source);
        const pdf = await loadingTask.promise;
        if (!active) {
          await pdf.destroy();
          return;
        }
        documentRef.current = pdf;

        // Read page 1 viewport immediately so placeholders have a crisp aspect ratio before rendering
        if (pdf.numPages > 0) {
          try {
            const firstPage = await pdf.getPage(1);
            const vp = firstPage.getViewport({ scale: 1 });
            ratioMapRef.current.set(1, { width: vp.width, height: vp.height });
            firstPage.cleanup();
          } catch {
            ratioMapRef.current.set(1, { width: 794, height: 1123 });
          }
        }

        if (!active) return;
        setPageCount(pdf.numPages);
        setInitialLoading(false);
        setRenderGeneration((g) => g + 1);
      } catch (error) {
        if (!active) return;
        setInitialLoading(false);
        onErrorRef.current?.(error instanceof Error ? error.message : 'Không mở được tài liệu PDF.');
      }
    };

    void loadDocument();
    return () => {
      active = false;
      cancelAllRenderTasks();
      loadingTask?.destroy?.();
      documentRef.current?.destroy?.();
      documentRef.current = null;
    };
  }, [cancelAllRenderTasks, data, url]);

  const baseFitWidth = useMemo(() => {
    const first = ratioMapRef.current.get(1);
    const maxDesktopWidth = first && first.width > first.height ? 960 : 860;
    return Math.min(containerWidth, maxDesktopWidth);
  }, [containerWidth, pageCount]);

  const targetPageWidth = Math.max(220, Math.round(baseFitWidth * zoom));

  const getPageDimensions = useCallback((pageNum: number) => {
    const ratio = ratioMapRef.current.get(pageNum) || ratioMapRef.current.get(1) || { width: 794, height: 1123 };
    const cssWidth = targetPageWidth;
    const cssHeight = Math.max(120, Math.round((ratio.height / ratio.width) * cssWidth));
    return { cssWidth, cssHeight, baseRatio: ratio };
  }, [targetPageWidth]);

  const renderSinglePage = useCallback(async (pageNum: number, generation: number) => {
    const pdf = documentRef.current;
    const canvas = canvasRefs.current.get(pageNum);
    if (!pdf || !canvas || renderingPagesRef.current.has(pageNum)) return;

    const existingScale = renderedScaleRef.current.get(pageNum);
    if (existingScale === targetPageWidth) return;

    renderingPagesRef.current.add(pageNum);
    try {
      const prevTask = renderTasksRef.current.get(pageNum);
      if (prevTask) {
        try {
          prevTask.cancel?.();
        } catch {
          // Ignore
        }
        renderTasksRef.current.delete(pageNum);
      }

      const page = await pdf.getPage(pageNum);
      if (documentRef.current !== pdf) return;

      const baseVp = page.getViewport({ scale: 1 });
      ratioMapRef.current.set(pageNum, { width: baseVp.width, height: baseVp.height });

      const cssScale = targetPageWidth / baseVp.width;
      const outputScale = Math.min(window.devicePixelRatio || 1, 2);
      const renderViewport = page.getViewport({ scale: cssScale * outputScale });
      const cssViewport = page.getViewport({ scale: cssScale });

      const context = canvas.getContext('2d', { alpha: false });
      if (!context) return;

      canvas.width = Math.max(1, Math.floor(renderViewport.width));
      canvas.height = Math.max(1, Math.floor(renderViewport.height));
      canvas.style.width = `${Math.floor(cssViewport.width)}px`;
      canvas.style.height = `${Math.floor(cssViewport.height)}px`;

      const renderTask = page.render({ canvasContext: context, viewport: renderViewport, canvas });
      renderTasksRef.current.set(pageNum, renderTask);
      await renderTask.promise;

      if (renderTasksRef.current.get(pageNum) === renderTask) {
        renderTasksRef.current.delete(pageNum);
      }
      page.cleanup();
      renderedScaleRef.current.set(pageNum, targetPageWidth);

      if (!readyEmittedRef.current && pageNum === 1) {
        readyEmittedRef.current = true;
        onReadyRef.current?.();
      }
    } catch (error: any) {
      if (error?.name !== 'RenderingCancelledException') {
        if (!readyEmittedRef.current && pageNum === 1) {
          onErrorRef.current?.(error instanceof Error ? error.message : 'Không render được trang PDF.');
        }
      }
    } finally {
      renderingPagesRef.current.delete(pageNum);
      void generation;
    }
  }, [targetPageWidth]);

  const flushVisibleQueue = useCallback(async (generation: number) => {
    const pdf = documentRef.current;
    if (!pdf || pageCount <= 0) return;

    // Prioritize visible pages and their immediate neighbors so scrolling feels continuous
    const prioritized = new Set<number>();
    const vis = Array.from(visiblePagesRef.current).sort((a, b) => a - b);
    for (const p of vis) {
      for (let d = -1; d <= 2; d += 1) {
        const candidate = p + d;
        if (candidate >= 1 && candidate <= pageCount) prioritized.add(candidate);
      }
    }
    if (prioritized.size === 0) {
      for (let p = 1; p <= Math.min(pageCount, 3); p += 1) prioritized.add(p);
    }

    for (const p of prioritized) {
      if (documentRef.current !== pdf) return;
      await renderSinglePage(p, generation);
    }
  }, [pageCount, renderSinglePage]);

  // Re-trigger visible render pass whenever zoom changes or PDF finishes loading
  useEffect(() => {
    if (!pageCount) return;
    renderedScaleRef.current.clear();
    cancelAllRenderTasks();
    void flushVisibleQueue(renderGeneration);
  }, [cancelAllRenderTasks, flushVisibleQueue, pageCount, renderGeneration, targetPageWidth]);

  // Track visible pages via IntersectionObserver as user scrolls continuously
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !pageCount || typeof IntersectionObserver === 'undefined') return undefined;

    const visibilityRatios = new Map<number, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        let shouldRender = false;
        for (const entry of entries) {
          const rawPage = Number((entry.target as HTMLElement).dataset.pageNumber || 0);
          if (!rawPage) continue;
          if (entry.isIntersecting) {
            visiblePagesRef.current.add(rawPage);
            visibilityRatios.set(rawPage, entry.intersectionRatio || 0.01);
            shouldRender = true;
          } else {
            visiblePagesRef.current.delete(rawPage);
            visibilityRatios.delete(rawPage);
          }
        }

        // Update current visible page badge based on page with largest intersection ratio
        let bestPage = 0;
        let bestRatio = -1;
        visibilityRatios.forEach((ratio, p) => {
          if (ratio > bestRatio || (ratio === bestRatio && p < bestPage)) {
            bestRatio = ratio;
            bestPage = p;
          }
        });
        if (bestPage > 0) {
          setCurrentPage(bestPage);
          setPageInput(String(bestPage));
        }
        if (shouldRender) {
          void flushVisibleQueue(renderGeneration);
        }
      },
      {
        root,
        rootMargin: '900px 0px',
        threshold: [0, 0.25, 0.5, 0.75],
      },
    );

    pageSlotRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [flushVisibleQueue, pageCount, renderGeneration]);

  const scrollToPage = useCallback((nextPage: number) => {
    if (!pageCount) return;
    const clamped = Math.min(pageCount, Math.max(1, Math.trunc(nextPage) || 1));
    setCurrentPage(clamped);
    setPageInput(String(clamped));
    const el = pageSlotRefs.current.get(clamped);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [pageCount]);

  const changeZoom = (delta: number) => {
    updateZoom(zoom + delta);
  };

  const resetZoom = () => {
    updateZoom(1);
  };

  const pages = useMemo(() => Array.from({ length: pageCount }, (_, i) => i + 1), [pageCount]);
  const useDarkSurface = darkCanvasSurface || hideToolbar;

  return (
    <div
      className={`flex flex-col overflow-hidden ${
        useDarkSurface
          ? 'rounded-none border-0 bg-[#1e1e1e] shadow-none'
          : 'rounded-2xl border border-slate-200 bg-slate-200 shadow-sm dark:border-[#243248] dark:bg-[#091529]'
      } ${scrollContainerOnly ? 'h-full min-h-0' : 'h-[calc(100svh-6rem)]'} ${className}`}
    >
      {!hideToolbar ? (
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur dark:border-[#243248] dark:bg-[#0f1d33]/95">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scrollToPage(currentPage - 1)}
              disabled={!pageCount || currentPage <= 1}
              aria-label="Trang trước"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <FiChevronUp />
            </button>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 sm:text-sm">
              Trang
              <input
                type="number"
                min={1}
                max={Math.max(1, pageCount)}
                value={pageInput}
                onChange={(event) => {
                  setPageInput(event.target.value);
                  const val = Number(event.target.value);
                  if (Number.isFinite(val) && val >= 1 && val <= pageCount) {
                    scrollToPage(val);
                  }
                }}
                onBlur={() => setPageInput(String(currentPage))}
                className="h-8 w-14 rounded-lg border border-slate-300 bg-white text-center text-xs font-black outline-none focus:border-[#247d7e] dark:border-slate-600 dark:bg-[#091529] sm:text-sm"
                aria-label="Số trang PDF"
              />
              <span className="text-slate-500 dark:text-slate-400">/ {pageCount || '…'}</span>
            </label>
            <button
              type="button"
              onClick={() => scrollToPage(currentPage + 1)}
              disabled={!pageCount || currentPage >= pageCount}
              aria-label="Trang sau"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <FiChevronDown />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => changeZoom(-PDF_ZOOM_STEP)}
              disabled={zoom <= PDF_MIN_ZOOM}
              title="Thu nhỏ"
              aria-label="Thu nhỏ"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <FiZoomOut className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={resetZoom}
              title="Khớp vừa màn hình (100%)"
              className="h-8 min-w-[3.5rem] rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-black tabular-nums text-slate-800 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-[#091529] dark:text-slate-100 dark:hover:bg-slate-800"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => changeZoom(PDF_ZOOM_STEP)}
              disabled={zoom >= PDF_MAX_ZOOM}
              title="Phóng to"
              aria-label="Phóng to"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <FiZoomIn className="h-4 w-4" />
            </button>
            {Math.abs(zoom - 1) > 0.01 ? (
              <button
                type="button"
                onClick={resetZoom}
                title="Vừa chiều rộng"
                className="hidden items-center gap-1 rounded-lg border border-[#247d7e]/40 bg-[#247d7e]/10 px-2.5 py-1.5 text-xs font-bold text-[#247d7e] transition hover:bg-[#247d7e]/20 dark:text-[#6ac6bd] sm:inline-flex"
              >
                <FiMaximize2 className="h-3.5 w-3.5" /> Vừa khung
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className={`relative flex-1 overflow-auto ${
          useDarkSurface ? 'bg-[#1e1e1e] p-2 sm:p-4' : 'bg-slate-300/80 p-3 dark:bg-[#060f1f] sm:p-5'
        }`}
        aria-label={title}
      >
        {initialLoading ? (
          <div className="flex h-full min-h-64 flex-col items-center justify-center gap-3">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-[#247d7e]/25 border-t-[#247d7e]" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Đang chuẩn bị tài liệu PDF…</p>
          </div>
        ) : (
          <div className="mx-auto flex w-fit min-w-full flex-col items-center gap-4">
            {pages.map((pageNum) => {
              const { cssWidth, cssHeight } = getPageDimensions(pageNum);
              return (
                <div
                  key={pageNum}
                  data-page-number={pageNum}
                  ref={(el) => {
                    if (el) pageSlotRefs.current.set(pageNum, el);
                    else pageSlotRefs.current.delete(pageNum);
                  }}
                  style={{ width: `${cssWidth}px`, minHeight: `${cssHeight}px` }}
                  className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white shadow-md ring-1 ring-slate-900/10"
                >
                  <canvas
                    ref={(el) => {
                      if (el) canvasRefs.current.set(pageNum, el);
                      else canvasRefs.current.delete(pageNum);
                    }}
                    style={{ width: `${cssWidth}px`, height: `${cssHeight}px` }}
                    className="block max-w-none bg-white"
                  />
                  <span className="pointer-events-none absolute bottom-2 right-2 rounded bg-slate-900/55 px-2 py-0.5 text-[10px] font-bold text-white">
                    {pageNum}/{pageCount}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
