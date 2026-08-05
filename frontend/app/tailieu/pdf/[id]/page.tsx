'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { FiDownload, FiRefreshCw } from 'react-icons/fi';

function getAuthToken() {
  const sessionToken = sessionStorage.getItem('token');
  if (sessionToken) return sessionToken;
  try {
    const stored = JSON.parse(localStorage.getItem('auth-storage') || '{}');
    return stored?.state?.token || null;
  } catch {
    return null;
  }
}

export default function MaterialPdfViewerPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params?.id;
  const title = searchParams.get('title') || 'Tài liệu PDF';
  const [pdfUrl, setPdfUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [allowDownload, setAllowDownload] = useState(true);

  const endpoint = useMemo(() => `/api/materials/pdf/${id}`, [id]);

  const loadPdf = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      window.location.href = '/login';
      return;
    }

    setLoading(true);
    setError('');
    setPdfUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return '';
    });

    try {
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error(response.status === 403 ? 'Bạn chưa có quyền xem tài liệu này.' : 'Không tải được PDF.');
      }
      setAllowDownload(response.headers.get('X-Material-Allow-Download') !== 'false');
      const blob = await response.blob();
      setPdfUrl(URL.createObjectURL(blob));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được PDF.');
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  const downloadPdf = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      window.location.href = '/login';
      return;
    }
    const response = await fetch(`${endpoint}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      setError('Không tải được PDF.');
      return;
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `${title || 'tailieu'}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
  }, [endpoint, title]);

  useEffect(() => {
    loadPdf();
    return () => {
      setPdfUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return '';
      });
    };
  }, [loadPdf]);

  return (
    <main className="flex min-h-screen flex-col bg-slate-100 text-slate-950">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-black sm:text-base">{title}</h1>
          <p className="text-xs font-medium text-slate-500">Trình xem PDF</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={loadPdf}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <FiRefreshCw size={14} />
            <span className="hidden sm:inline">Tải lại</span>
          </button>
          {allowDownload && <button
            type="button"
            onClick={downloadPdf}
            disabled={!pdfUrl}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-3 text-sm font-bold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FiDownload size={14} />
            <span className="hidden sm:inline">Tải xuống</span>
          </button>}
        </div>
      </header>

      <section className="min-h-0 flex-1 p-3 sm:p-4">
        {loading && (
          <div className="grid h-[calc(100svh-6rem)] place-items-center rounded-2xl border border-slate-200 bg-white">
            <div className="text-center">
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
              <p className="font-bold text-slate-700">Đang mở PDF...</p>
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="grid h-[calc(100svh-6rem)] place-items-center rounded-2xl border border-red-100 bg-white px-4">
            <div className="max-w-md text-center">
              <h2 className="mb-2 text-lg font-black text-red-600">Không mở được PDF</h2>
              <p className="mb-4 text-sm font-medium text-slate-600">{error}</p>
              <button
                type="button"
                onClick={loadPdf}
                className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700"
              >
                Thử lại
              </button>
            </div>
          </div>
        )}

        {!loading && pdfUrl && (
          <iframe
            src={pdfUrl}
            title={title}
            className="h-[calc(100svh-6rem)] w-full rounded-2xl border border-slate-200 bg-white shadow-sm"
          />
        )}
      </section>
    </main>
  );
}
