export type AuthFormMode = 'login' | 'register';

export interface ParsedAuthFormErrors {
  general?: string;
  email?: string;
  password?: string;
  username?: string;
  full_name?: string;
  confirmPassword?: string;
  terms?: string;
}

type ApiValidationError = {
  field?: unknown;
  path?: unknown;
  message?: unknown;
  msg?: unknown;
};

type ApiErrorPayload = {
  code?: unknown;
  message?: unknown;
  errors?: unknown;
};

type RequestError = {
  code?: unknown;
  response?: {
    status?: number;
    data?: ApiErrorPayload;
  };
};

const fieldAliases: Record<string, keyof ParsedAuthFormErrors> = {
  username: 'username',
  email: 'email',
  password: 'password',
  full_name: 'full_name',
  acceptedTerms: 'terms',
  termsVersion: 'terms',
  privacyVersion: 'terms',
};

const translatedMessages: Record<string, string> = {
  'Username must be between 3 and 50 characters': 'Tên đăng nhập phải có từ 3 đến 30 ký tự.',
  'Username can only contain letters, numbers, and underscores': 'Tên đăng nhập chỉ được chứa chữ cái, số và dấu gạch dưới.',
  'Please provide a valid email address': 'Email không đúng định dạng.',
  'Full name must be between 1 and 100 characters': 'Họ và tên phải có từ 1 đến 100 ký tự.',
};

const normalizeMessage = (value: unknown) => {
  if (typeof value !== 'string') return '';
  const message = value.trim();
  return translatedMessages[message] || message;
};

const inferField = (
  message: string,
  mode: AuthFormMode,
  status?: number,
): keyof ParsedAuthFormErrors | undefined => {
  const normalized = message.toLocaleLowerCase('vi-VN');

  if (normalized.includes('email không hợp lệ') || normalized.includes('email không đúng định dạng')) {
    return 'email';
  }
  if (mode === 'register' && normalized.includes('email') && normalized.includes('đăng ký')) {
    return 'email';
  }
  if (mode === 'register' && normalized.includes('tên đăng nhập')) {
    return 'username';
  }
  if (mode === 'register' && normalized.includes('mật khẩu')) {
    return 'password';
  }
  if (mode === 'register' && (normalized.includes('điều khoản') || normalized.includes('chính sách bảo mật'))) {
    return 'terms';
  }
  if (mode === 'login' && status === 400 && normalized.includes('mật khẩu')) {
    return 'password';
  }

  return undefined;
};

export function parseAuthFormError(
  error: unknown,
  mode: AuthFormMode,
  fallback: string,
): ParsedAuthFormErrors {
  const requestError = (error || {}) as RequestError;
  const response = requestError.response;
  const actionLabel = mode === 'login' ? 'Đăng nhập' : 'Đăng ký';

  if (!response) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { general: `${actionLabel} chưa thành công: thiết bị đang mất kết nối mạng.` };
    }
    if (requestError.code === 'ECONNABORTED') {
      return { general: `${actionLabel} chưa thành công: máy chủ phản hồi quá chậm. Vui lòng thử lại.` };
    }
    return { general: `${actionLabel} chưa thành công: không thể kết nối tới máy chủ. Vui lòng thử lại.` };
  }

  const payload = response.data || {};
  const parsed: ParsedAuthFormErrors = {};
  const validationErrors = Array.isArray(payload.errors)
    ? payload.errors as ApiValidationError[]
    : [];

  for (const item of validationErrors) {
    const rawField = typeof item.field === 'string'
      ? item.field
      : typeof item.path === 'string' ? item.path : '';
    const targetField = fieldAliases[rawField];
    const message = normalizeMessage(item.message ?? item.msg);
    if (targetField && message && !parsed[targetField]) {
      parsed[targetField] = message;
    }
  }

  if (Object.keys(parsed).length > 0) {
    parsed.general = `${actionLabel} chưa thành công. Vui lòng kiểm tra các mục được đánh dấu bên dưới.`;
    return parsed;
  }

  let message = normalizeMessage(payload.message);
  if (!message || message === 'Validation failed') message = fallback;

  const inferredField = inferField(message, mode, response.status);
  if (inferredField) {
    parsed[inferredField] = message;
    parsed.general = `${actionLabel} chưa thành công. Vui lòng kiểm tra mục được đánh dấu bên dưới.`;
    return parsed;
  }

  parsed.general = `${actionLabel} chưa thành công: ${message}`;
  return parsed;
}
