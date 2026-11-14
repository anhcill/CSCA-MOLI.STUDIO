'use client';

import { useState } from 'react';
import { FiExternalLink } from 'react-icons/fi';
import { ssoApi } from '@/lib/api/sso';

interface CourseSsoLaunchButtonProps {
  courseId?: number | null;
  targetPath?: string | null;
  label?: string;
  className?: string;
}

function getApiErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const maybeAxios = error as { response?: { data?: { message?: string } }; message?: string };
    const serverMsg = maybeAxios.response?.data?.message;
    if (typeof serverMsg === 'string' && serverMsg.trim()) return serverMsg;
    if (typeof maybeAxios.message === 'string' && maybeAxios.message.trim()) return maybeAxios.message;
  }
  return 'Không thể kết nối tới CSCA Course. Vui lòng thử lại sau.';
}

export function CourseSsoLaunchButton({
  courseId,
  targetPath,
  label = 'Vào học',
  className = '',
}: CourseSsoLaunchButtonProps) {
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState('');

  const handleLaunch = async () => {
    if (launching) return;
    setLaunching(true);
    setError('');
    try {
      const result = await ssoApi.launchCourseSso({
        courseId: courseId ?? undefined,
        targetPath: targetPath ?? undefined,
      });
      const urlStr = result?.launchUrl || '';
      if (!urlStr) {
        setError('Chưa có đường dẫn học tập cho khóa học này.');
        setLaunching(false);
        return;
      }
      const parsed = new URL(urlStr);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        setError('Liên kết chuyển hướng không hợp lệ.');
        setLaunching(false);
        return;
      }
      window.location.assign(parsed.toString());
    } catch (err) {
      setError(getApiErrorMessage(err));
      setLaunching(false);
    }
  };

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleLaunch}
        disabled={launching}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      >
        <FiExternalLink className="shrink-0 text-base" />
        <span>{launching ? 'Đang chuyển hướng...' : label}</span>
      </button>
      {error ? (
        <p
          role="alert"
          className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
