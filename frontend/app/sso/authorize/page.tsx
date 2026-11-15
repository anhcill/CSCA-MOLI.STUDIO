'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FiAlertTriangle, FiLoader } from 'react-icons/fi';
import { ssoApi, type SsoAuthorizeResult } from '@/lib/api/sso';
import { useAuthStore } from '@/lib/store/authStore';

const pendingAuthorizeMap = new Map<string, Promise<SsoAuthorizeResult>>();

function MolySsoAuthorizeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, token, isAuthenticated, isLoading } = useAuthStore();
  const [hydrated, setHydrated] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (useAuthStore.persist?.hasHydrated?.()) {
      setHydrated(true);
      return;
    }
    const unsub = useAuthStore.persist?.onFinishHydration?.(() => {
      setHydrated(true);
    });
    const fallback = setTimeout(() => setHydrated(true), 150);
    return () => {
      unsub?.();
      clearTimeout(fallback);
    };
  }, []);

  useEffect(() => {
    if (!hydrated || isLoading) return;

    const sessionToken = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
    if (!isAuthenticated || (!token && !sessionToken) || !user) {
      const returnPath = typeof window !== 'undefined'
        ? `${window.location.pathname}${window.location.search}`
        : '/sso/authorize';
      router.replace(`/login?redirect=${encodeURIComponent(returnPath)}`);
      return;
    }

    const state = (searchParams.get('state') || '').trim();
    const codeChallenge = (searchParams.get('code_challenge') || '').trim();
    const codeChallengeMethod = (searchParams.get('code_challenge_method') || 'S256').trim();
    const targetPath = searchParams.get('target_path');
    const offeringId = searchParams.get('offering_id');
    const rawCourseId = searchParams.get('course_id');
    const courseId = rawCourseId && Number.isFinite(Number(rawCourseId)) ? Number(rawCourseId) : null;

    if (!state || !codeChallenge) {
      setErrorMsg('Thiếu tham số bảo mật PKCE hoặc state để chuyển hướng sang CSCA-Course.');
      return;
    }

    const dedupeKey = `${state}:${codeChallenge}`;
    let promise = pendingAuthorizeMap.get(dedupeKey);
    if (!promise) {
      promise = ssoApi.authorizeCourseSso({
        state,
        codeChallenge,
        codeChallengeMethod,
        courseId,
        offeringId,
        targetPath,
      });
      pendingAuthorizeMap.set(dedupeKey, promise);
    }

    let cancelled = false;
    promise
      .then((result) => {
        if (cancelled) return;
        const urlStr = result?.redirectUrl || result?.launchUrl || '';
        const parsed = new URL(urlStr);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
          setErrorMsg('Liên kết chuyển hướng CSCA-Course không hợp lệ.');
          return;
        }
        window.location.assign(parsed.toString());
      })
      .catch((err) => {
        if (cancelled) return;
        const e = err as { response?: { status?: number; data?: { message?: string } }; message?: string };
        if (e?.response?.status === 401) {
          const returnPath = typeof window !== 'undefined'
            ? `${window.location.pathname}${window.location.search}`
            : '/sso/authorize';
          router.replace(`/login?redirect=${encodeURIComponent(returnPath)}`);
          return;
        }
        setErrorMsg(e?.response?.data?.message || e?.message || 'Không thể cấp quyền đăng nhập sang CSCA-Course.');
      })
      .finally(() => {
        setTimeout(() => pendingAuthorizeMap.delete(dedupeKey), 3000);
      });

    return () => {
      cancelled = true;
    };
  }, [hydrated, isLoading, isAuthenticated, token, user, searchParams, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8f3ec] px-4 py-12 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
        {!errorMsg ? (
          <>
            <FiLoader className="mx-auto h-10 w-10 animate-spin text-teal-600" />
            <h1 className="mt-4 text-xl font-black">Đang xác nhận quyền vào học</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Hệ thống đang xác thực tài khoản Moly Studio và chuyển bạn sang CSCA-Course...
            </p>
          </>
        ) : (
          <>
            <FiAlertTriangle className="mx-auto h-10 w-10 text-rose-500" />
            <h1 className="mt-4 text-xl font-black">Không thể chuyển sang CSCA-Course</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{errorMsg}</p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/hoc" className="rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-black text-white">
                Về khóa học của tôi
              </Link>
              <Link href="/khoa-hoc" className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-bold">
                Danh sách khóa học
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default function MolySsoAuthorizePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Đang tải...</div>}>
      <MolySsoAuthorizeInner />
    </Suspense>
  );
}
