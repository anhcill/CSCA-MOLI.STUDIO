'use client';

import { useGoogleLogin, useGoogleOAuth } from '@react-oauth/google';
import { FaFacebookF } from 'react-icons/fa';
import { FcGoogle } from 'react-icons/fc';
import { isGoogleOAuthConfigured } from '@/lib/utils/googleOAuth';

interface SocialAuthButtonsProps {
  dividerLabel: string;
  disabled?: boolean;
  onGoogleAccessToken: (accessToken: string) => void;
  onGoogleError: (errorDetails?: { type?: string; message?: string }) => void;
  onGoogleNotConfigured: () => void;
  onFacebookClick: () => void;
  onBeforeSocialAuth?: () => boolean;
}

export default function SocialAuthButtons({
  dividerLabel,
  disabled = false,
  onGoogleAccessToken,
  onGoogleError,
  onGoogleNotConfigured,
  onFacebookClick,
  onBeforeSocialAuth,
}: SocialAuthButtonsProps) {
  const { clientId } = useGoogleOAuth();
  const resolvedClientId = clientId?.trim() || '';
  const isGoogleEnabled = isGoogleOAuthConfigured(resolvedClientId);

  const googleLogin = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      if (tokenResponse.access_token) {
        onGoogleAccessToken(tokenResponse.access_token);
      } else {
        onGoogleError();
      }
    },
    onError: (errorResponse) => {
      onGoogleError(errorResponse ? { type: errorResponse.error, message: errorResponse.error_description } : undefined);
    },
    onNonOAuthError: (nonOAuthError) => {
      onGoogleError(nonOAuthError ? { type: nonOAuthError.type, message: (nonOAuthError as any).message } : undefined);
    },
    prompt: 'select_account',
  });

  const handleGoogleClick = () => {
    if (disabled) return;
    if (onBeforeSocialAuth && !onBeforeSocialAuth()) return;
    if (!isGoogleEnabled) {
      onGoogleNotConfigured();
      return;
    }
    googleLogin();
  };

  const buttonClass =
    'relative flex h-11 w-full min-w-0 items-center justify-center gap-2 rounded-xl border border-[#d8bfa8] bg-white/[0.92] px-3 text-sm font-bold text-[#2d2926] shadow-sm transition-colors hover:border-[#bd8f68] hover:bg-white disabled:cursor-not-allowed disabled:opacity-50';

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

        <button
          type="button"
          onClick={() => {
            if (onBeforeSocialAuth && !onBeforeSocialAuth()) return;
            onFacebookClick();
          }}
          disabled={disabled}
          className={buttonClass}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1877F2] text-white">
            <FaFacebookF className="h-3 w-3" />
          </span>
          <span className="truncate">Facebook</span>
        </button>
      </div>
    </div>
  );
}
