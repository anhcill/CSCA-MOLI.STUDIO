'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { FiRefreshCw, FiX, FiZap } from 'react-icons/fi';

interface UpdateToastProps {
  visible: boolean;
  version?: string;
  onUpdate: () => void;
}

export default function UpdateToast({ visible, version = '3.0', onUpdate }: UpdateToastProps) {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);
  const isExamPage = pathname?.startsWith('/exam/') && !pathname?.includes('/result');

  if (!visible || dismissed || isExamPage) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-blue-100 bg-white p-6 text-center shadow-2xl">
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Đóng thông báo cập nhật"
        >
          <FiX size={18} />
        </button>

        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
          <FiZap size={28} />
        </div>

        <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Bản cập nhật mới</p>
        <h2 className="mt-2 text-2xl font-black text-slate-950">Version {version} đã sẵn sàng</h2>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
          Bấm cập nhật để tải giao diện và tính năng mới nhất. Nếu đang làm bài thi, thông báo này sẽ chờ đến khi bạn ra khỏi trang thi.
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onUpdate}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700"
          >
            <FiRefreshCw size={16} />
            Cập nhật ngay
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
          >
            Để sau
          </button>
        </div>
      </div>
    </div>
  );
}
