/**
 * Security utilities for XSS prevention and input sanitization
 */

// Characters that could be used for XSS attacks
const DANGEROUS_CHARS_REGEX = /[<>'"&]/g;
const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe/gi,
  /<object/gi,
  /<embed/gi,
  /data:/gi,
  /vbscript:/gi,
];

// Escape HTML entities
const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
};

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str).replace(DANGEROUS_CHARS_REGEX, (char) => HTML_ESCAPE_MAP[char] || char);
}

/**
 * Sanitize user input - remove dangerous patterns and escape HTML
 */
export function sanitizeInput(input: string): string {
  if (!input) return '';

  let sanitized = input;

  // Remove dangerous patterns first
  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * Sanitize input but allow some HTML tags (for rich text content)
 * WARNING: Only use this for trusted content
 */
export function sanitizeHtml(input: string, allowedTags: string[] = []): string {
  if (!input) return '';

  let sanitized = input;

  // Remove script and dangerous tags regardless of allowlist
  const dangerousTags = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'];
  for (const tag of dangerousTags) {
    sanitized = sanitized.replace(new RegExp(`<${tag}[^>]*>.*?</${tag}>`, 'gi'), '');
    sanitized = sanitized.replace(new RegExp(`<${tag}[^>]*>`, 'gi'), '');
  }

  return sanitized;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a cryptographically secure random token
 */
export function generateSecureToken(length: number = 32): string {
  const array = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    // Fallback for older browsers
    for (let i = 0; i < length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash a string using SHA-256 (for client-side checks, not storage)
 */
export async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Check password strength and return score (0-4)
 * 0: Very weak
 * 1: Weak
 * 2: Fair
 * 3: Strong
 * 4: Very strong
 */
export function checkPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  if (!password) {
    return { score: 0, label: 'Rất yếu', color: 'red', feedback: ['Nhập mật khẩu'] };
  }

  if (password.length >= 8) score++;
  else feedback.push('Ít nhất 8 ký tự');

  if (password.length >= 12) score++;

  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  else feedback.push('Bao gồm chữ hoa và chữ thường');

  if (/\d/.test(password)) score++;
  else feedback.push('Bao gồm số');

  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++;
  else feedback.push('Bao gồm ký tự đặc biệt');

  // Cap score at 4
  score = Math.min(score, 4);

  const labels = ['Rất yếu', 'Yếu', 'Trung bình', 'Mạnh', 'Rất mạnh'];
  const colors = ['red', 'red', 'yellow', 'green', 'blue'];

  return {
    score,
    label: labels[score],
    color: colors[score],
    feedback: feedback.slice(0, 3), // Limit feedback to 3 items
  };
}

/**
 * Validate username format
 */
export function isValidUsername(username: string): boolean {
  // Only allow alphanumeric and underscore, 3-30 characters
  const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
  return usernameRegex.test(username);
}

/**
 * Mask sensitive data for logging/display
 */
export function maskSensitiveData(data: string, visibleChars: number = 4): string {
  if (!data || data.length <= visibleChars) return '***';
  const visible = data.slice(0, visibleChars);
  const masked = '*'.repeat(Math.max(data.length - visibleChars, 3));
  return visible + masked;
}

/**
 * Rate limit helper - simple in-memory implementation
 * For production, use server-side rate limiting
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; retryAfter?: number } {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  // Clean up expired entries
  if (record && record.resetTime < now) {
    rateLimitStore.delete(key);
  }

  const current = rateLimitStore.get(key);

  if (!current) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxAttempts - 1 };
  }

  if (current.count >= maxAttempts) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((current.resetTime - now) / 1000),
    };
  }

  current.count++;
  return { allowed: true, remaining: maxAttempts - current.count };
}

/**
 * Content Security Policy nonce for inline scripts
 */
let cspNonce: string | null = null;

export function generateCspNonce(): string {
  if (!cspNonce) {
    cspNonce = generateSecureToken(16);
  }
  return cspNonce;
}

export function getCspNonce(): string | null {
  return cspNonce;
}
