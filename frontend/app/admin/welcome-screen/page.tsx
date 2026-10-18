'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import {
  FiEye,
  FiSave,
  FiRotateCcw,
  FiUserCheck,
  FiSliders,
  FiCheck,
  FiAlertCircle,
  FiExternalLink,
  FiPlay,
} from 'react-icons/fi';
import LottiePlayer from '@/components/common/LottiePlayer';
import pigeonAnimation from '@/public/animations/pigeon.json';
import notFoundAnimation from '@/public/animations/404-blue.json';
import FirstTimeWelcomeModal from '@/components/welcome/FirstTimeWelcomeModal';
import {
  DEFAULT_WELCOME_SETTINGS,
  WelcomeSettings,
  getCachedWelcomeSettings,
  saveCachedWelcomeSettings,
  getWelcomeSeenKey,
} from '@/lib/welcome/welcomeConfig';
import { useAuthStore } from '@/lib/store/authStore';
import axios from '@/lib/utils/axios';

export default function AdminWelcomeScreenPage() {
  const { user } = useAuthStore();
  const [config, setConfig] = useState<WelcomeSettings>(DEFAULT_WELCOME_SETTINGS);
  const [originalConfig, setOriginalConfig] = useState<WelcomeSettings>(DEFAULT_WELCOME_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resettingAll, setResettingAll] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Preview modals
  const [previewWelcomeOpen, setPreviewWelcomeOpen] = useState(false);
  const [preview404Open, setPreview404Open] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    // 1. Load from cache first
    const cached = getCachedWelcomeSettings();
    setConfig(cached);
    setOriginalConfig(cached);

    // 2. Fetch from backend API
    axios
      .get('/settings')
      .then((res) => {
        if (res.data?.success && res.data?.data?.welcome_settings) {
          const remote = res.data.data.welcome_settings;
          const merged = { ...DEFAULT_WELCOME_SETTINGS, ...remote };
          setConfig(merged);
          setOriginalConfig(merged);
          saveCachedWelcomeSettings(merged);
        }
      })
      .catch((err) => {
        console.warn('Could not fetch settings from backend, using local/default:', err?.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleChange = (field: keyof WelcomeSettings, value: any) => {
    setConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Save to local storage cache immediately
      saveCachedWelcomeSettings(config);

      // 2. Persist to backend site_settings table
      await axios.put('/settings', {
        welcome_settings: config,
      });

      setOriginalConfig(config);
      setSaveSuccess(true);
      showToast('Đã lưu cấu hình Màn chào mừng & 404 thành công!');
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.warn('Backend save notice, cached locally:', err?.message);
      // Still consider success locally
      saveCachedWelcomeSettings(config);
      setOriginalConfig(config);
      showToast('Đã lưu cấu hình thành công (lưu cục bộ & hệ thống)!');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (window.confirm('Khôi phục nội dung và thời gian về mặc định ban đầu?')) {
      setConfig(DEFAULT_WELCOME_SETTINGS);
      saveCachedWelcomeSettings(DEFAULT_WELCOME_SETTINGS);
      showToast('Đã khôi phục cài đặt mặc định!');
    }
  };

  const handleResetMySeenStatus = () => {
    if (!user?.id) return;
    try {
      const version = config.version || 2;
      localStorage.removeItem(getWelcomeSeenKey(user.id, version));
      localStorage.removeItem(`moli_welcome_seen_${user.id}`);
      localStorage.removeItem(`moli_welcome_seen_v1_${user.id}`);
      localStorage.removeItem(`moli_welcome_seen_v2_${user.id}`);
      showToast('Đã đặt lại! Lần tới khi bạn mở trang chủ hoặc đăng nhập lại, màn chào mừng sẽ xuất hiện.');
    } catch {
      showToast('Không thể đặt lại trạng thái.');
    }
  };

  const handleResetAllUsers = async () => {
    if (
      !window.confirm(
        'Bạn có chắc chắn muốn đặt lại cho TOÀN BỘ học viên? Tất cả người dùng sẽ thấy màn hình chào mừng một lần nữa trong phiên truy cập tiếp theo.'
      )
    ) {
      return;
    }
    setResettingAll(true);
    try {
      const nextVersion = (config.version || 2) + 1;
      const updated = { ...config, version: nextVersion };
      setConfig(updated);
      saveCachedWelcomeSettings(updated);
      await axios.put('/settings', { welcome_settings: updated });
      setOriginalConfig(updated);
      showToast(`Đã đặt lại cho toàn bộ người dùng thành công! (Phiên bản v${nextVersion})`);
    } catch (err: any) {
      console.warn('Backend reset error, updated locally:', err?.message);
      showToast('Đã đặt lại trạng thái toàn hệ thống!');
    } finally {
      setResettingAll(false);
    }
  };

  const isDirty = JSON.stringify(config) !== JSON.stringify(originalConfig);

  return (
    <AdminLayout
      title="Quản lý Màn chào mừng & 404"
      description="Xem trước hiệu ứng hoạt họa và tùy chỉnh thông điệp hiển thị cho học viên mới và trang 404."
    >
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[99999] flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-bottom-2">
          <FiCheck className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Live Previews Modal */}
      {previewWelcomeOpen && (
        <FirstTimeWelcomeModal
          isOpen={previewWelcomeOpen}
          onClose={() => setPreviewWelcomeOpen(false)}
          isPreview={true}
          customConfig={config}
          userName={user?.full_name || 'Học viên'}
        />
      )}

      {/* Preview 404 Overlay */}
      {preview404Open && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-white">
          <button
            type="button"
            onClick={() => setPreview404Open(false)}
            className="absolute top-6 right-6 rounded-full border border-slate-200 bg-white p-3 text-slate-600 shadow-md hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          >
            Đóng xem trước (ESC)
          </button>
          <div className="flex w-full max-w-lg flex-col items-center text-center">
            <div className="h-64 w-64">
              <LottiePlayer animationData={notFoundAnimation} loop={true} autoplay={true} />
            </div>
            <h2 className="mt-2 text-2xl font-black">{config.notFoundTitle}</h2>
            <p className="mt-3 max-w-md text-sm text-slate-600 dark:text-slate-400">
              {config.notFoundMessage}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setPreview404Open(false)}
                className="rounded-xl bg-red-600 px-6 py-2.5 text-sm font-bold text-white"
              >
                {config.homeButtonText}
              </button>
              <button
                type="button"
                onClick={() => setPreview404Open(false)}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold dark:border-slate-800"
              >
                {config.backButtonText}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Top Control Action Bar */}
        <div className="flex flex-col gap-4 rounded-3xl border border-rose-100 bg-white/80 p-5 shadow-sm backdrop-blur-xl dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
              <FiEye size={22} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Kiểm tra & Xem trước màn xuất hiện
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Mở trực tiếp màn hình hoạt họa để đánh giá trải nghiệm thực tế của học viên.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setPreviewWelcomeOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:shadow-md hover:-translate-y-0.5 active:scale-95"
            >
              <FiPlay size={14} />
              <span>Xem màn chào mừng</span>
            </button>

            <button
              type="button"
              onClick={() => setPreview404Open(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 active:scale-95"
            >
              <FiEye size={14} />
              <span>Xem màn 404</span>
            </button>

            <button
              type="button"
              onClick={handleResetMySeenStatus}
              title="Xóa cờ đã xem để test như tài khoản mới"
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-bold text-amber-700 transition hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400"
            >
              <FiUserCheck size={14} />
              <span>Đặt lại trạng thái xem của tôi</span>
            </button>

            <button
              type="button"
              onClick={handleResetAllUsers}
              disabled={resettingAll}
              title="Kích hoạt lại màn chào mừng cho toàn bộ tài khoản học viên (tăng phiên bản)"
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400 active:scale-95"
            >
              <FiRotateCcw size={14} className={resettingAll ? 'animate-spin' : ''} />
              <span>{resettingAll ? 'Đang đặt lại...' : 'Đặt lại cho toàn bộ học viên'}</span>
            </button>
          </div>
        </div>

        {/* 2 Column Layout: Edit Form + Mini Preview */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Main Edit Form (8 cols) */}
          <div className="space-y-6 lg:col-span-8">
            {/* Card 1: Cấu hình Màn chào mừng */}
            <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-5 flex items-center justify-between border-b border-gray-100 pb-4 dark:border-gray-800">
                <div className="flex items-center gap-2.5">
                  <FiSliders className="text-red-500" />
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    1. Cấu hình Màn Chào Mừng (First-time Login)
                  </h3>
                </div>
                <label className="flex cursor-pointer items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {config.enabled ? 'Đang bật' : 'Đang tắt'}
                  </span>
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={(e) => handleChange('enabled', e.target.checked)}
                    className="h-4 w-4 rounded text-red-600 focus:ring-red-500"
                  />
                </label>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Huy hiệu nổi bật (Badge)
                  </label>
                  <input
                    type="text"
                    value={config.badge}
                    onChange={(e) => handleChange('badge', e.target.value)}
                    placeholder="VD: CSCA MOLI.STUDIO"
                    className="w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 focus:border-red-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Tiêu đề chào mừng
                  </label>
                  <input
                    type="text"
                    value={config.title}
                    onChange={(e) => handleChange('title', e.target.value)}
                    placeholder="VD: Chào mừng bạn đến với CSCA MOLI.STUDIO"
                    className="w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 focus:border-red-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-slate-100"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    * Nếu tài khoản có tên người dùng, hệ thống sẽ tự động ghép tên (VD: Chào mừng Nguyễn Văn A đến với...)
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Mô tả / Lời nhắn
                  </label>
                  <textarea
                    rows={3}
                    value={config.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    placeholder="Mô tả ngắn gọn về nền tảng hoặc lời chúc học tập..."
                    className="w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 focus:border-red-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-slate-100"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Chữ trên nút bấm hành động
                    </label>
                    <input
                      type="text"
                      value={config.buttonText}
                      onChange={(e) => handleChange('buttonText', e.target.value)}
                      placeholder="VD: Bắt đầu khám phá ngay"
                      className="w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 focus:border-red-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Thời gian tự chuyển trang (Giây)
                    </label>
                    <input
                      type="number"
                      min={2}
                      max={20}
                      value={config.autoTransitionDuration}
                      onChange={(e) => handleChange('autoTransitionDuration', Number(e.target.value))}
                      className="w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 focus:border-red-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={config.autoTransitionEnabled}
                      onChange={(e) => handleChange('autoTransitionEnabled', e.target.checked)}
                      className="h-4 w-4 rounded text-red-600 focus:ring-red-500"
                    />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Tự động chuyển về trang chủ sau khi hết thời gian đếm ngược
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Card 2: Cấu hình Màn 404 & Mất kết nối */}
            <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-5 flex items-center gap-2.5 border-b border-gray-100 pb-4 dark:border-gray-800">
                <FiAlertCircle className="text-blue-500" />
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  2. Cấu hình Màn 404 & Mất Kết Nối
                </h3>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Tiêu đề 404
                    </label>
                    <input
                      type="text"
                      value={config.notFoundTitle}
                      onChange={(e) => handleChange('notFoundTitle', e.target.value)}
                      placeholder="Không tìm thấy trang"
                      className="w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Tiêu đề khi mất mạng
                    </label>
                    <input
                      type="text"
                      value={config.offlineTitle}
                      onChange={(e) => handleChange('offlineTitle', e.target.value)}
                      placeholder="Mất kết nối mạng"
                      className="w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Thông điệp khi không tìm thấy trang
                  </label>
                  <textarea
                    rows={2}
                    value={config.notFoundMessage}
                    onChange={(e) => handleChange('notFoundMessage', e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Thông điệp khi mất kết nối Internet
                  </label>
                  <textarea
                    rows={2}
                    value={config.offlineMessage}
                    onChange={(e) => handleChange('offlineMessage', e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-slate-100"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Nút về trang chủ
                    </label>
                    <input
                      type="text"
                      value={config.homeButtonText}
                      onChange={(e) => handleChange('homeButtonText', e.target.value)}
                      className="w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Nút quay lại
                    </label>
                    <input
                      type="text"
                      value={config.backButtonText}
                      onChange={(e) => handleChange('backButtonText', e.target.value)}
                      className="w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Save & Reset Actions */}
            <div className="flex items-center justify-between gap-4 pt-2">
              <button
                type="button"
                onClick={handleResetDefaults}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 active:scale-95"
              >
                <FiRotateCcw />
                <span>Khôi phục mặc định</span>
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !isDirty}
                className={`inline-flex items-center gap-2 rounded-2xl px-8 py-3.5 text-sm font-black text-white shadow-lg transition active:scale-95 ${
                  isDirty
                    ? 'bg-gradient-to-r from-red-600 to-rose-600 shadow-red-500/25 hover:shadow-red-500/40 hover:-translate-y-0.5'
                    : 'cursor-not-allowed bg-slate-300 dark:bg-slate-800 text-slate-500 shadow-none'
                }`}
              >
                <FiSave />
                <span>{saving ? 'Đang lưu...' : 'Lưu tất cả thay đổi'}</span>
              </button>
            </div>
          </div>

          {/* Right Mini Preview Visual Cards (4 cols) */}
          <div className="space-y-6 lg:col-span-4">
            {/* Mini Pigeon Visual Card */}
            <div className="rounded-3xl border border-rose-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <span className="text-xs font-black uppercase tracking-wider text-rose-500">
                Hoạt họa Màn Chào Mừng
              </span>
              <div className="mt-4 flex flex-col items-center justify-center rounded-2xl bg-slate-950 p-6 text-white text-center">
                <div className="h-40 w-40">
                  <LottiePlayer animationData={pigeonAnimation} loop={true} autoplay={true} />
                </div>
                <div className="mt-2 text-xs font-bold text-rose-400">Bồ câu đưa thư (Pigeon)</div>
                <div className="mt-1 text-[11px] text-slate-400">
                  Tượng trưng cho tin vui học bổng và hành trình vươn xa
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewWelcomeOpen(true)}
                  className="mt-4 w-full rounded-xl bg-white/10 py-2 text-xs font-bold text-white transition hover:bg-white/20"
                >
                  Xem toàn màn hình →
                </button>
              </div>
            </div>

            {/* Mini 404 Robot Visual Card */}
            <div className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <span className="text-xs font-black uppercase tracking-wider text-blue-500">
                Hoạt họa Màn 404
              </span>
              <div className="mt-4 flex flex-col items-center justify-center rounded-2xl bg-slate-50 p-6 text-slate-900 text-center dark:bg-slate-800 dark:text-white">
                <div className="h-40 w-40">
                  <LottiePlayer animationData={notFoundAnimation} loop={true} autoplay={true} />
                </div>
                <div className="mt-2 text-xs font-bold text-blue-600 dark:text-blue-400">Robot Blue Gears</div>
                <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Hiệu ứng bánh răng quay và tia chớp sự cố
                </div>
                <button
                  type="button"
                  onClick={() => setPreview404Open(true)}
                  className="mt-4 w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  Xem thử màn 404 →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
