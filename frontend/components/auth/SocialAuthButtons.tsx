'use client';

import { useGoogleOAuth } from '@react-oauth/google';
import { FaFacebookF } from 'react-icons/fa';
import { FcGoogle } from 'react-icons/fc';
import { isGoogleOAuthConfigured } from '@/lib/utils/googleOAuth';

interface SocialAuthButtonsProps {
  dividerLabel: string;
  disabled?: boolean;
  onGoogleAccessToken: (accessToken: string) => void;
  onGoogleError: () => void;
  onGoogleNotConfigured: () => void;
  onFacebookClick: () => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (options: {
            client_id: string;
            scope: string;
            prompt?: string;
            callback: (response: { access_token?: string; error?: string }) => void;
            error_callback?: () => void;
          }) => { requestAccessToken: () => void };
        };
      };
    };
  }
}

const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

function loadGoogleIdentityScript() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_SCRIPT_SRC}"]`);
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Google Identity script failed')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Identity script failed'));
    document.head.appendChild(script);
  });
}

export default function SocialAuthButtons({
  dividerLabel,
  disabled = false,
  onGoogleAccessToken,
  onGoogleError,
  onGoogleNotConfigured,
  onFacebookClick,
}: SocialAuthButtonsProps) {
  const { clientId } = useGoogleOAuth();
  const resolvedClientId = clientId?.trim() || '';
  const isGoogleEnabled = isGoogleOAuthConfigured(resolvedClientId);
  const buttonClass =
    'relative flex h-11 w-full min-w-0 items-center justify-center gap-2 rounded-xl border border-[#d8bfa8] bg-white/[0.92] px-3 text-sm font-bold text-[#2d2926] shadow-sm transition-colors hover:border-[#bd8f68] hover:bg-white disabled:cursor-not-allowed disabled:opacity-50';

  const handleGoogleClick = async () => {
    if (disabled) return;
    if (!isGoogleEnabled) {
      onGoogleNotConfigured();
      return;
    }

    try {
      await loadGoogleIdentityScript();
      const tokenClient = window.google?.accounts?.oauth2?.initTokenClient({
        client_id: resolvedClientId,
        scope: 'openid email profile',
        prompt: 'select_account',
        callback: (tokenResponse) => {
          if (tokenResponse.access_token) {
            onGoogleAccessToken(tokenResponse.access_token);
            return;
          }
          onGoogleError();
        },
        error_callback: () => onGoogleError(),
      });

      if (!tokenClient) {
        onGoogleError();
        return;
      }

      tokenClient.requestAccessToken();
    } catch {
      onGoogleError();
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[#c8a884]" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-3 font-bold text-[#3f352f]" style={{ backgroundColor: 'rgba(255, 247, 239, 0.94)' }}>{dividerLabel}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={handleGoogleClick} disabled={disabled} className={buttonClass}>
          <FcGoogle className="h-5 w-5 shrink-0" />
          <span className="truncate">Google</span>
        </button>

        <button type="button" onClick={onFacebookClick} disabled={disabled} className={buttonClass}>
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1877F2] text-white">
            <FaFacebookF className="h-3 w-3" />
          </span>
          <span className="truncate">Facebook</span>
        </button>
      </div>
    </div>
  );
}
