'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FiAlertTriangle, FiLoader } from 'react-icons/fi';
import { isSafeRelativeRedirectPath, ssoApi, type SsoStartResult } from '@/lib/api/sso';

const pendingStartMap = new Map<string, Promise<SsoStartResult>>();

function MolySsoStartInner() {
  const searchParams = useSearchParams();
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const rawTarget = searchParams.get('target_path');
    const targetPath = isSafeRelativeRedirectPath(rawTarget) ? rawTarget : '/khoa-hoc';
    const dedupeKey = targetPath;

    let promise = pendingStartMap.get(dedupeKey);
    if (!promise) {
      promise = ssoApi.startIncomingCourseSso({ targetPath });
      pendingStartMap.set(dedupeKey, promise);
    }

    let cancelled = false;
    promise
      .then((result) => {
        if (cancelled) return;
        const urlStr = result?.authorizeUrl || '';
        const parsed = new URL(urlStr);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
          setErrorMsg('Liên kết xác thực SSO không hợp lệ.');
          return;
        }
        window.location.assign(parsed.toString());
      })
      .catch((err) => {
        if (cancelled) return;
        const e = err as { response?: { data?: { message?: string } }; message?: string };
        setErrorMsg(e?.response?.data?.message || e?.message || 'Không thể khởi tạo phiên đăng nhập SSO.');
      })
      .finally(() => {
        setTimeout(() => pendingStartMap.delete(dedupeKey), 3000);
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8f3ec] px-4 py-12 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
        {!errorMsg ? (
          <>
            <FiLoader className="mx-auto h-10 w-10 animate-spin text-teal-600" />
            <h1 className="mt-4 text-xl font-black">Đang khởi tạo đăng nhập an toàn</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Trình duyệt đang thiết lập phiên xác thực tới CSCA-Course...
            </p>
          </>
        ) : (
          <>
            <FiAlertTriangle className="mx-auto h-10 w-10 text-rose-500" />
            <h1 className="mt-4 text-xl font-black">Không thể bắt đầu phiên SSO</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{errorMsg}</p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/login" className="rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-black text-white">
                Đăng nhập Moly
              </Link>
              <Link href="/khoa-hoc" className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-bold">
                Về khóa học
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default function MolySsoStartPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Đang tải...</div>}>
      <MolySsoStartInner />
    </Suspense>
  );
}
