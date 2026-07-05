'use client';

import { useGoogleLogin, useGoogleOAuth } from '@react-oauth/google';
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

export default function SocialAuthButtons({
  dividerLabel,
  disabled = false,
  onGoogleAccessToken,
  onGoogleError,
  onGoogleNotConfigured,
  onFacebookClick,
}: SocialAuthButtonsProps) {
  const { clientId } = useGoogleOAuth();
  const isGoogleEnabled = isGoogleOAuthConfigured(clientId);
  const googleLogin = useGoogleLogin({
    scope: 'openid email profile',
    prompt: 'select_account',
    onSuccess: (tokenResponse) => {
      if (tokenResponse.access_token) {
        onGoogleAccessToken(tokenResponse.access_token);
        return;
      }
      onGoogleError();
    },
    onError: () => onGoogleError(),
    onNonOAuthError: () => onGoogleError(),
  });
  const buttonClass =
    'relative flex h-11 w-full min-w-0 items-center justify-center gap-2 rounded-xl border border-[#e4d3c2] px-3 text-sm font-semibold shadow-sm transition-colors hover:border-[#d6ad86] disabled:cursor-not-allowed disabled:opacity-50';

  const handleGoogleClick = () => {
    if (disabled) return;
    if (!isGoogleEnabled) {
      onGoogleNotConfigured();
      return;
    }
    googleLogin();
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-3 text-[#6a5c53]" style={{ backgroundColor: '#f7eadc' }}>{dividerLabel}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={handleGoogleClick} disabled={disabled} className={buttonClass} style={{ backgroundColor: 'rgba(255,255,255,0.82)', color: '#2d2926' }}>
          <FcGoogle className="h-5 w-5 shrink-0" />
          <span className="truncate">Google</span>
        </button>

        <button type="button" onClick={onFacebookClick} disabled={disabled} className={buttonClass} style={{ backgroundColor: 'rgba(255,255,255,0.82)', color: '#2d2926' }}>
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1877F2] text-white">
            <FaFacebookF className="h-3 w-3" />
          </span>
          <span className="truncate">Facebook</span>
        </button>
      </div>
    </div>
  );
}
