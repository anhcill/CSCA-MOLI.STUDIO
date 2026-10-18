export interface WelcomeSettings {
  enabled: boolean;
  version: number;
  badge: string;
  title: string;
  description: string;
  buttonText: string;
  autoTransitionDuration: number;
  autoTransitionEnabled: boolean;
  notFoundTitle: string;
  notFoundMessage: string;
  offlineTitle: string;
  offlineMessage: string;
  homeButtonText: string;
  backButtonText: string;
}

export const DEFAULT_WELCOME_SETTINGS: WelcomeSettings = {
  enabled: true,
  version: 2,
  badge: 'CSCA MOLI.STUDIO',
  title: 'Chào mừng bạn đến với CSCA MOLI.STUDIO',
  description: 'Nền tảng luyện thi CSCA, ôn học bổng CSC và chuẩn bị du học Trung Quốc hàng đầu.',
  buttonText: 'Bắt đầu khám phá ngay',
  autoTransitionDuration: 5,
  autoTransitionEnabled: true,
  notFoundTitle: 'Không tìm thấy trang',
  notFoundMessage: 'Đường dẫn bạn truy cập có thể không đúng, đã bị xóa hoặc tạm thời không thể kết nối.',
  offlineTitle: 'Mất kết nối mạng',
  offlineMessage: 'Thiết bị của bạn đang ngoại tuyến. Vui lòng kiểm tra lại đường truyền Internet.',
  homeButtonText: 'Về trang chủ',
  backButtonText: 'Quay lại',
};

const WELCOME_SETTINGS_KEY = 'moli_custom_welcome_settings';

export function getCachedWelcomeSettings(): WelcomeSettings {
  if (typeof window === 'undefined') return DEFAULT_WELCOME_SETTINGS;
  try {
    const raw = localStorage.getItem(WELCOME_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_WELCOME_SETTINGS, ...parsed };
    }
  } catch {}
  return DEFAULT_WELCOME_SETTINGS;
}

export function saveCachedWelcomeSettings(settings: Partial<WelcomeSettings>) {
  if (typeof window === 'undefined') return;
  try {
    const merged = { ...getCachedWelcomeSettings(), ...settings };
    localStorage.setItem(WELCOME_SETTINGS_KEY, JSON.stringify(merged));
  } catch {}
}

export function getWelcomeSeenKey(userId: string | number, version: number = 2): string {
  return `moli_welcome_seen_v${version}_${userId}`;
}
