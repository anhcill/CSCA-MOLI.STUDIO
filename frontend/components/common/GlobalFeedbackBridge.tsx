'use client';

import { useEffect, useRef, useState } from 'react';
import { FiAlertCircle, FiCheckCircle, FiInfo, FiX, FiXCircle } from 'react-icons/fi';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

declare global {
  interface Window {
    moliToast?: (message: unknown, type?: ToastType) => void;
  }
}

const TOAST_STYLES: Record<ToastType, { icon: React.ReactNode; bar: string; iconBg: string; iconText: string; title: string }> = {
  success: {
    icon: <FiCheckCircle size={18} />,
    bar: 'bg-emerald-500',
    iconBg: 'bg-emerald-50',
    iconText: 'text-emerald-600',
    title: 'Thành công',
  },
  error: {
    icon: <FiXCircle size={18} />,
    bar: 'bg-rose-500',
    iconBg: 'bg-rose-50',
    iconText: 'text-rose-600',
    title: 'Có lỗi xảy ra',
  },
  warning: {
    icon: <FiAlertCircle size={18} />,
    bar: 'bg-amber-500',
    iconBg: 'bg-amber-50',
    iconText: 'text-amber-600',
    title: 'Cần chú ý',
  },
  info: {
    icon: <FiInfo size={18} />,
    bar: 'bg-indigo-500',
    iconBg: 'bg-indigo-50',
    iconText: 'text-indigo-600',
    title: 'Thông báo',
  },
};

function normalizeMessage(message: unknown) {
  if (message == null) return '';
  if (typeof message === 'string') return message;
  if (message instanceof Error) return message.message;
  try {
    return JSON.stringify(message);
  } catch {
    return String(message);
  }
}

function inferToastType(message: string): ToastType {
  const text = message.toLowerCase();
  if (/(thành công|đã thêm|đã tạo|đã cập nhật|đã lưu|đã xóa|hoàn tất|success|saved|created)/i.test(text)) {
    return 'success';
  }
  if (/(lỗi|thất bại|không thể|không tải|failed|error|invalid)/i.test(text)) {
    return 'error';
  }
  if (/(vui lòng|chú ý|cảnh báo|xác nhận|thiếu|chưa|không có|hãy)/i.test(text)) {
    return 'warning';
  }
  return 'info';
}

export default function GlobalFeedbackBridge() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = (id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const pushToast = (rawMessage: unknown, explicitType?: ToastType) => {
    const message = normalizeMessage(rawMessage).trim();
    if (!message) return;

    const id = Date.now() + Math.floor(Math.random() * 1000);
    const type = explicitType || inferToastType(message);
    setToasts(prev => [...prev.slice(-3), { id, message, type }]);

    const duration = type === 'error' || type === 'warning' ? 5200 : 3800;
    const timer = setTimeout(() => dismiss(id), duration);
    timers.current.set(id, timer);
  };

  useEffect(() => {
    const originalAlert = window.alert;
    window.moliToast = pushToast;
    window.alert = (message?: unknown) => pushToast(message);

    return () => {
      window.alert = originalAlert;
      delete window.moliToast;
      timers.current.forEach(timer => clearTimeout(timer));
      timers.current.clear();
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-4 top-4 z-[9999] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3 sm:right-5 sm:top-5">
      {toasts.map(toast => {
        const style = TOAST_STYLES[toast.type];
        return (
          <div
            key={toast.id}
            className="group pointer-events-auto overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl shadow-gray-900/12 ring-1 ring-black/5 animate-in slide-in-from-right-4 fade-in duration-200"
            role="status"
          >
            <div className={`h-1 ${style.bar}`} />
            <div className="flex items-start gap-3 p-4">
              <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${style.iconBg} ${style.iconText}`}>
                {style.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-900">{style.title}</p>
                <p className="mt-0.5 break-words text-sm leading-relaxed text-gray-600">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                aria-label="Đóng thông báo"
              >
                <FiX size={16} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
