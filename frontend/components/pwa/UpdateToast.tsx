'use client';

import { usePathname } from 'next/navigation';
import { FiRefreshCw } from 'react-icons/fi';

interface UpdateToastProps {
  visible: boolean;
  onUpdate: () => void;
}

export default function UpdateToast({ visible, onUpdate }: UpdateToastProps) {
  const pathname = usePathname();
  const isExamPage = pathname?.startsWith('/exam/') && !pathname?.includes('/result');

  if (!visible || isExamPage) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[9999] -translate-x-1/2 animate-slide-up">
      <div className="flex items-center gap-3 rounded-xl bg-blue-700 px-5 py-3 text-white shadow-2xl">
        <FiRefreshCw className="h-5 w-5 animate-spin-slow" />
        <span className="text-sm font-medium">Có bản cập nhật mới</span>
        <button
          type="button"
          onClick={onUpdate}
          className="rounded-lg bg-white px-3 py-1 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-50"
        >
          Tải lại
        </button>
      </div>
    </div>
  );
}
