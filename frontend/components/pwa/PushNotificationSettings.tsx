'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiBell, FiCheckCircle, FiRefreshCw, FiSend, FiSmartphone, FiXCircle } from 'react-icons/fi';
import {
  disablePushSubscription,
  getPushStatus,
  savePushSubscription,
  sendPushTest,
  type PushStatus,
} from '@/lib/api/pushNotifications';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function isStandalonePwa() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}

function isIOSDevice() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export default function PushNotificationSettings() {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const supported = useMemo(() => (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  ), []);
  const iosNeedsInstall = supported && isIOSDevice() && !isStandalonePwa();

  const refresh = useCallback(async () => {
    if (!supported) return;
    setPermission(Notification.permission);
    try {
      const nextStatus = await getPushStatus();
      setStatus(nextStatus);
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setEnabled(Boolean(subscription));
    } catch {
      setMessage('Không tải được trạng thái thông báo.');
    }
  }, [supported]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const enablePush = useCallback(async () => {
    if (!supported || !status?.publicKey || iosNeedsInstall) return;
    try {
      setBusy(true);
      setMessage('');
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== 'granted') {
        setMessage('Trình duyệt chưa cho phép thông báo.');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(status.publicKey),
        });
      }
      await savePushSubscription(subscription);
      setEnabled(true);
      setMessage('Đã bật thông báo trên thiết bị này.');
      await refresh();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Không bật được thông báo.');
    } finally {
      setBusy(false);
    }
  }, [iosNeedsInstall, refresh, status?.publicKey, supported]);

  const disablePush = useCallback(async () => {
    if (!supported) return;
    try {
      setBusy(true);
      setMessage('');
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      await disablePushSubscription(subscription?.endpoint);
      await subscription?.unsubscribe();
      setEnabled(false);
      setMessage('Đã tắt thông báo trên thiết bị này.');
      await refresh();
    } catch {
      setMessage('Không tắt được thông báo. Hãy thử lại.');
    } finally {
      setBusy(false);
    }
  }, [refresh, supported]);

  const testPush = useCallback(async () => {
    try {
      setBusy(true);
      setMessage('');
      await sendPushTest();
      setMessage('Đã gửi thông báo thử.');
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Không gửi được thông báo thử.');
    } finally {
      setBusy(false);
    }
  }, []);

  const configured = status?.configured !== false;

  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
            <FiBell size={18} />
          </div>
          <div>
            <p className="text-sm font-black text-gray-900">Thông báo trên thiết bị</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-gray-500">
              Nhắc học, nhắc lịch thi và thông báo quan trọng. iPhone cần cài PWA ra màn hình chính trước.
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                {enabled ? <FiCheckCircle size={12} /> : <FiXCircle size={12} />}
                {enabled ? 'Đang bật' : 'Đang tắt'}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-gray-500">
                <FiSmartphone size={12} />
                {status?.activeCount || 0} thiết bị
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {!enabled ? (
            <button
              type="button"
              onClick={enablePush}
              disabled={busy || !supported || !configured || iosNeedsInstall}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? <FiRefreshCw className="animate-spin" size={14} /> : <FiBell size={14} />}
              Bật thông báo
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={testPush}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-black text-blue-700 shadow-sm hover:bg-blue-50 disabled:opacity-50"
              >
                <FiSend size={14} />
                Gửi thử
              </button>
              <button
                type="button"
                onClick={disablePush}
                disabled={busy}
                className="rounded-xl border border-blue-200 bg-white px-4 py-2 text-xs font-black text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Tắt
              </button>
            </>
          )}
        </div>
      </div>

      {!supported && (
        <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-amber-700">
          Trình duyệt này chưa hỗ trợ thông báo PWA.
        </p>
      )}
      {iosNeedsInstall && (
        <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-blue-700">
          Trên iPhone, hãy bấm Chia sẻ → Thêm vào màn hình chính, mở app từ icon rồi bật thông báo.
        </p>
      )}
      {!configured && (
        <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-rose-700">
          Server chưa có VAPID key. Cần set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` trên Railway.
        </p>
      )}
      {message && (
        <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-gray-700">
          {message}
        </p>
      )}
    </div>
  );
}
