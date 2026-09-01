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
// Keep this component available for future high-risk forms. Authentication
// forms currently rely on their existing rate limits instead of a widget.
export const isLoginTurnstileEnabled =
  isTurnstileEnabled && process.env.NEXT_PUBLIC_TURNSTILE_LOGIN_ENABLED === 'true';

export default function TurnstileBox({ action, disabled = false, resetKey = 0, onTokenChange }: TurnstileBoxProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const didMountRef = useRef(false);
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
      callback: (token) => onTokenChange(token),
      'expired-callback': () => onTokenChange(''),
      'error-callback': () => onTokenChange(''),
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
    onTokenChange('');
  }, [resetKey, onTokenChange]);

  if (!siteKey) return null;

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className={`min-h-[28px] ${disabled ? 'pointer-events-none opacity-60' : ''}`}
      />
      <p className="text-xs font-semibold text-[#5a4538]">
        Xác nhận Cloudflare để bảo vệ tài khoản khỏi spam.
      </p>
    </div>
  );
}
