'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FiAlertTriangle, FiArrowRight, FiCheckCircle, FiLoader, FiShield } from 'react-icons/fi';
import {
  clearPendingSafeLink,
  extractAndStripSsoParams,
  isSafeRelativeRedirectPath,
  loadPendingSafeLink,
  savePendingSafeLink,
  ssoApi,
  type SsoConsumeResult,
} from '@/lib/api/sso';
import type { User } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/store/authStore';

const pendingConsumeMap = new Map<string, Promise<SsoConsumeResult>>();

function getErrorInfo(err: unknown): { code: string; message: string } {
  const e = err as { response?: { data?: { code?: string; errorCode?: string; message?: string } }; message?: string };
  const code = e?.response?.data?.code || e?.response?.data?.errorCode || 'SSO_ERROR';
  const rawMessage = e?.response?.data?.message || '';
  if (code === 'SSO_CODE_EXPIRED' || code === 'SSO_BROWSER_TX_EXPIRED') {
    return { code, message: 'Phiên đăng nhập SSO đã hết hạn. Vui lòng bấm đăng nhập lại từ CSCA-Course.' };
  }
  if (code === 'SSO_CODE_ALREADY_USED' || code === 'SSO_BROWSER_TX_ALREADY_USED') {
    return { code, message: 'Phiên đăng nhập SSO này đã được sử dụng. Vui lòng tạo phiên mới từ trang trước.' };
  }
  if (
    code === 'SSO_BROWSER_BINDING_REQUIRED'
    || code === 'SSO_BROWSER_BINDING_INVALID'
    || code === 'SSO_BROWSER_BINDING_MISMATCH'
    || code === 'SSO_BROWSER_STATE_MISMATCH'
    || code === 'SSO_PKCE_MISMATCH'
    || code === 'SSO_PKCE_REQUIRED'
  ) {
    return { code, message: 'Phiên đăng nhập phải hoàn tất trên chính trình duyệt đã khởi tạo SSO. Vui lòng thử lại từ đầu.' };
  }
  if (code === 'PRIVILEGED_ROLE_COLLISION') return { code, message: 'Tài khoản quản trị hoặc giáo viên không thể liên kết tự động qua SSO. Vui lòng đăng nhập riêng bằng tài khoản Moly.' };
  if (code === 'DEVICE_LIMIT_REACHED' || code === 'DEVICE_LIMIT_LOCKED') {
    return { code, message: rawMessage || 'Tài khoản đã đạt giới hạn thiết bị tin cậy.' };
  }
  return { code, message: rawMessage || 'Không thể xác thực SSO từ CSCA-Course. Vui lòng thử lại.' };
}

export default function MolySsoCallbackPage() {
  const router = useRouter();
  const { user: currentUser, setUser, setTokens, setLoading } = useAuthStore();

  const [phase, setPhase] = useState<'loading' | 'link_required' | 'error'>('loading');
  const [linkState, setLinkState] = useState<{
    linkToken: string;
    email: string;
    hasPassword: boolean;
    targetPath: string;
  } | null>(null);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [errorCode, setErrorCode] = useState('');

  useEffect(() => {
    const params = extractAndStripSsoParams();
    if (!params) {
      const pending = loadPendingSafeLink();
      if (!pending) {
        setPhase('error');
        setErrorCode('SSO_PARAMS_MISSING');
        setErrorMsg('Thiếu mã xác thực SSO hợp lệ. Vui lòng thử mở lại từ CSCA-Course.');
        return;
      }

      let cancelled = false;
      ssoApi.getSafeLinkStatus()
        .then((statusData) => {
          if (cancelled) return;
          const restored = {
            linkToken: pending.linkToken,
            email: statusData.email || pending.email,
            hasPassword: Boolean(statusData.hasPassword),
            targetPath: isSafeRelativeRedirectPath(statusData.targetPath) ? statusData.targetPath : pending.targetPath,
          };
          savePendingSafeLink(restored);
          setLinkState(restored);
          setPhase('link_required');
        })
        .catch(() => {
          if (cancelled) return;
          clearPendingSafeLink();
          setPhase('error');
          setErrorCode('SSO_PARAMS_MISSING');
          setErrorMsg('Phiên xác minh liên kết không còn hiệu lực trên trình duyệt này. Vui lòng mở lại từ CSCA-Course.');
        });

      return () => {
        cancelled = true;
      };
    }

    const dedupeKey = `${params.code}:${params.state}`;
    let promise = pendingConsumeMap.get(dedupeKey);
    if (!promise) {
      promise = ssoApi.consumeCode(params);
      pendingConsumeMap.set(dedupeKey, promise);
    }

    let cancelled = false;
    promise
      .then((result) => {
        if (cancelled) return;
        if (result.status === 'LINK_REQUIRED' && result.linkToken) {
          const nextLinkState = {
            linkToken: result.linkToken,
            email: result.email || '',
            hasPassword: Boolean(result.hasPassword),
            targetPath: isSafeRelativeRedirectPath(result.targetPath) ? result.targetPath : '/khoa-hoc',
          };
          savePendingSafeLink(nextLinkState);
          setLinkState(nextLinkState);
          setPhase('link_required');
          return;
        }
        if (result.status === 'AUTHENTICATED' && result.token && result.user) {
          clearPendingSafeLink();
          setUser(result.user as unknown as User);
          setTokens(result.token, result.refreshToken || '');
          setLoading(false);
          const nextPath = isSafeRelativeRedirectPath(result.redirectPath) ? result.redirectPath : '/khoa-hoc';
          router.replace(nextPath);
          return;
        }
        setPhase('error');
        setErrorMsg('Phản hồi SSO không hợp lệ.');
      })
      .catch((err) => {
        if (cancelled) return;
        const info = getErrorInfo(err);
        setErrorCode(info.code);
        setErrorMsg(info.message);
        setPhase('error');
      })
      .finally(() => {
        setTimeout(() => pendingConsumeMap.delete(dedupeKey), 3000);
      });

    return () => {
      cancelled = true;
    };
  }, [router, setLoading, setTokens, setUser]);

  const handleConfirmSafeLink = async (useSessionOnly = false) => {
    if (!linkState || submitting) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      const result = await ssoApi.confirmSafeLink({
        linkToken: linkState.linkToken,
        password: useSessionOnly ? null : password,
      });
      if (result.status === 'AUTHENTICATED' && result.token && result.user) {
        clearPendingSafeLink();
        setUser(result.user as unknown as User);
        setTokens(result.token, result.refreshToken || '');
        setLoading(false);
        const nextPath = isSafeRelativeRedirectPath(result.redirectPath) ? result.redirectPath : linkState.targetPath;
        router.replace(nextPath);
      }
    } catch (err) {
      const info = getErrorInfo(err);
      if (['SSO_LINK_TOKEN_INVALID', 'SSO_LINK_TOKEN_EXPIRED', 'SSO_BROWSER_BINDING_REQUIRED', 'SSO_BROWSER_BINDING_MISMATCH'].includes(info.code)) {
        clearPendingSafeLink();
      }
      setErrorCode(info.code);
      setErrorMsg(info.message);
    } finally {
      setSubmitting(false);
    }
  };

  const sessionMatchesCandidate = Boolean(
    currentUser?.email
    && linkState?.email
    && currentUser.email.trim().toLowerCase() === linkState.email.trim().toLowerCase(),
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8f3ec] px-4 py-12 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        {phase === 'loading' && (
          <div className="text-center">
            <FiLoader className="mx-auto h-10 w-10 animate-spin text-teal-600" />
            <h1 className="mt-4 text-xl font-black">Đang xác thực đăng nhập SSO</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Hệ thống đang đổi mã một lần với CSCA-Course và khởi tạo phiên làm việc an toàn...
            </p>
          </div>
        )}

        {phase === 'link_required' && linkState && (
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
              <FiShield /> Cần xác minh tài khoản
            </div>
            <h1 className="mt-4 text-xl font-black">Liên kết tài khoản Moly hiện có</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Email <strong className="font-bold">{linkState.email}</strong> đã tồn tại trên Moly Studio nhưng chưa liên kết với CSCA-Course. Để bảo vệ tài khoản, vui lòng xác minh chủ sở hữu trước khi liên kết.
            </p>

            {errorMsg && (
              <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200">
                {errorMsg}
              </div>
            )}

            {sessionMatchesCandidate && (
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleConfirmSafeLink(true)}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-800 disabled:opacity-50"
              >
                <FiCheckCircle /> Xác minh bằng phiên đang đăng nhập
              </button>
            )}

            {linkState.hasPassword && (
              <form
                className="mt-5 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleConfirmSafeLink(false);
                }}
              >
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Mật khẩu tài khoản Moly Studio
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu để xác nhận liên kết"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </label>
                <button
                  type="submit"
                  disabled={submitting || !password}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-teal-700 dark:hover:bg-teal-600"
                >
                  {submitting ? 'Đang xác minh...' : <>Xác minh & liên kết tài khoản <FiArrowRight /></>}
                </button>
              </form>
            )}

            {!linkState.hasPassword && !sessionMatchesCandidate && (
              <div className="mt-5 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                Tài khoản này chưa đặt mật khẩu cục bộ. Hãy đăng nhập vào Moly Studio bằng Google/Facebook với đúng email trên trước rồi quay lại bước xác minh.
                <Link href="/login" className="mt-2 inline-flex font-bold text-teal-700 underline">
                  Đăng nhập Moly Studio
                </Link>
              </div>
            )}
          </div>
        )}

        {phase === 'error' && (
          <div className="text-center">
            <FiAlertTriangle className="mx-auto h-10 w-10 text-rose-500" />
            <h1 className="mt-4 text-xl font-black">Không thể hoàn tất SSO</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{errorMsg}</p>
            {errorCode && (
              <p className="mt-2 font-mono text-xs text-slate-400">Mã lỗi: {errorCode}</p>
            )}
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-black text-white hover:bg-teal-800"
              >
                Đăng nhập Moly
              </Link>
              <Link
                href="/khoa-hoc"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200"
              >
                Về danh sách khóa học
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
