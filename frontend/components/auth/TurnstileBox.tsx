'use client';

import { useEffect, useRef, useState } from 'react';

type TurnstileBoxProps = {
  action: string;
  disabled?: boolean;
  resetKey?: number;
  onTokenChange: (token: string) => void;
};

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          action?: string;
          theme?: 'auto' | 'light' | 'dark';
          execution?: 'render' | 'execute';
          appearance?: 'always' | 'execute' | 'interaction-only';
          'refresh-expired'?: 'auto' | 'manual' | 'never';
          'before-interactive-callback'?: () => void;
          'timeout-callback'?: () => void;
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
export const isTurnstileEnabled = Boolean(siteKey);

export default function TurnstileBox({ action, disabled = false, resetKey = 0, onTokenChange }: TurnstileBoxProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const didMountRef = useRef(false);
  const [status, setStatus] = useState<'verifying' | 'verified' | 'interaction' | 'error'>('verifying');
  const [scriptReady, setScriptReady] = useState(() =>
    typeof window !== 'undefined' && Boolean(window.turnstile),
  );

  useEffect(() => {
    if (!siteKey) return;

    let cancelled = false;
    let retryTimer: number | undefined;

    const detectTurnstile = () => {
      if (window.turnstile) {
        setScriptReady(true);
        return;
      }

      if (!cancelled) {
        retryTimer = window.setTimeout(detectTurnstile, 50);
      }
    };

    detectTurnstile();
    window.addEventListener('load', detectTurnstile);

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      window.removeEventListener('load', detectTurnstile);
    };
  }, []);

  useEffect(() => {
    if (!siteKey || !scriptReady || !containerRef.current || !window.turnstile) return;

    if (widgetIdRef.current) {
      window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action,
      theme: 'auto',
      // Non-interactive mode itself is configured on the Cloudflare widget.
      execution: 'render',
      appearance: 'interaction-only',
      'refresh-expired': 'auto',
      callback: (token) => { setStatus('verified'); onTokenChange(token); },
      'expired-callback': () => { setStatus('verifying'); onTokenChange(''); },
      'error-callback': () => { setStatus('error'); onTokenChange(''); },
      'timeout-callback': () => { setStatus('error'); onTokenChange(''); },
      'before-interactive-callback': () => { setStatus('interaction'); onTokenChange(''); },
    });

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [action, scriptReady, onTokenChange]);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (!widgetIdRef.current || !window.turnstile) return;
    window.turnstile.reset(widgetIdRef.current);
    setStatus('verifying');
    onTokenChange('');
  }, [resetKey, onTokenChange]);

  if (!siteKey) return null;

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className={disabled ? 'pointer-events-none opacity-60' : ''}
      />
      <p role="status" className="text-xs font-semibold text-[#5a4538]">
        {status === 'verified' ? 'Đã xác minh bảo mật.'
          : status === 'interaction' ? 'Cloudflare cần bạn xác nhận thêm để tiếp tục.'
          : status === 'error' ? 'Chưa thể xác minh bảo mật. Kiểm tra kết nối hoặc tải lại trang.'
          : 'Đang tự động xác minh bảo mật…'}
      </p>
    </div>
  );
}
