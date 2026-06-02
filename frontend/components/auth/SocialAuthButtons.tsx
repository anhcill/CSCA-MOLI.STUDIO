'use client';

import { CredentialResponse, GoogleLogin } from '@react-oauth/google';
import { FaFacebookF } from 'react-icons/fa';
import { FcGoogle } from 'react-icons/fc';
import { getGoogleOAuthClientId, isGoogleOAuthConfigured } from '@/lib/utils/googleOAuth';

interface SocialAuthButtonsProps {
  dividerLabel: string;
  disabled?: boolean;
  googleText: 'signin_with' | 'signup_with';
  onGoogleSuccess: (credentialResponse: CredentialResponse) => void;
  onGoogleError: () => void;
  onGoogleNotConfigured: () => void;
  onFacebookClick: () => void;
}

export default function SocialAuthButtons({
  dividerLabel,
  disabled = false,
  googleText,
  onGoogleSuccess,
  onGoogleError,
  onGoogleNotConfigured,
  onFacebookClick,
}: SocialAuthButtonsProps) {
  const googleClientId = getGoogleOAuthClientId();
  const isGoogleEnabled = isGoogleOAuthConfigured(googleClientId);
  const buttonClass =
    'relative flex h-11 min-w-0 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white px-3 text-gray-500 dark:bg-gray-100">{dividerLabel}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="relative overflow-hidden rounded-lg focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2">
          <button
            type="button"
            onClick={isGoogleEnabled ? undefined : onGoogleNotConfigured}
            disabled={disabled}
            className={buttonClass}
            tabIndex={isGoogleEnabled ? -1 : 0}
            aria-hidden={isGoogleEnabled}
          >
            <FcGoogle className="h-5 w-5 shrink-0" />
            <span className="truncate">Google</span>
          </button>
          {isGoogleEnabled && !disabled && (
            <div className="absolute inset-0 overflow-hidden rounded-lg opacity-0">
              <GoogleLogin
                onSuccess={onGoogleSuccess}
                onError={onGoogleError}
                useOneTap={false}
                theme="outline"
                size="large"
                text={googleText}
                shape="rectangular"
                logo_alignment="center"
                width={320}
              />
            </div>
          )}
        </div>

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
