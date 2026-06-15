'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { FiRefreshCw, FiX } from 'react-icons/fi';
import { APP_VERSION } from '@/lib/appVersion';

interface UpdateToastProps {
  visible: boolean;
  version?: string;
  onUpdate: () => void;
}

export default function UpdateToast({ visible, version = APP_VERSION, onUpdate }: UpdateToastProps) {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);
  const isExamPage = pathname?.startsWith('/exam/') && !pathname?.includes('/result');

  if (!visible || dismissed || isExamPage) return null;

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-4 z-[9999] flex justify-center sm:bottom-5">
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-blue-100 bg-white px-4 py-3 shadow-2xl shadow-blue-950/15">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
          <FiRefreshCw size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-slate-950">Có bản cập nhật mới</p>
          <p className="truncate text-xs font-semibold text-slate-500">Version {version} đã sẵn sàng.</p>
        </div>
        <button
          type="button"
          onClick={onUpdate}
          className="shrink-0 rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white hover:bg-blue-700"
        >
          Tải lại
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Đóng thông báo cập nhật"
        >
          <FiX size={16} />
        </button>
      </div>
    </div>
  );
}
