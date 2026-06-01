'use client';

import { useMemo } from 'react';
import { checkPasswordStrength } from '@/lib/utils/security';
import { useLanguage } from '@/context/LanguageContext';

interface PasswordStrengthIndicatorProps {
  password: string;
}

export default function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const strength = useMemo(() => checkPasswordStrength(password), [password]);
  const { t } = useLanguage();

  if (!password) return null;

  const labelKeys: Record<string, string> = {
    'Rất yếu': 'auth.passwordStrength.veryWeak',
    'Yếu': 'auth.passwordStrength.weak',
    'Trung bình': 'auth.passwordStrength.fair',
    'Mạnh': 'auth.passwordStrength.strong',
    'Rất mạnh': 'auth.passwordStrength.veryStrong',
  };
  const feedbackKeys: Record<string, string> = {
    'Nhập mật khẩu': 'auth.passwordFeedback.enter',
    'Ít nhất 8 ký tự': 'auth.passwordFeedback.min8',
    'Bao gồm chữ hoa và chữ thường': 'auth.passwordFeedback.case',
    'Bao gồm số': 'auth.passwordFeedback.number',
    'Bao gồm ký tự đặc biệt': 'auth.passwordFeedback.special',
  };
  const feedback = strength.feedback.map((item) => t(feedbackKeys[item] || item));

  const getColor = (color: string) => {
    switch (color) {
      case 'red':
        return 'bg-red-500';
      case 'yellow':
        return 'bg-yellow-500';
      case 'green':
        return 'bg-green-500';
      case 'blue':
        return 'bg-blue-500';
      default:
        return 'bg-gray-300';
    }
  };

  const getTextColor = (color: string) => {
    switch (color) {
      case 'red':
        return 'text-red-600';
      case 'yellow':
        return 'text-yellow-600';
      case 'green':
        return 'text-green-600';
      case 'blue':
        return 'text-blue-600';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className="mt-2 space-y-2">
      {/* Strength bar */}
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((index) => (
          <div
            key={index}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              index <= strength.score ? getColor(strength.color) : 'bg-gray-200 dark:bg-gray-700'
            }`}
          />
        ))}
      </div>

      {/* Strength label */}
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium ${getTextColor(strength.color)}`}>
          {t(labelKeys[strength.label] || strength.label)}
        </span>
        {feedback.length > 0 && (
          <span className="text-xs text-gray-500">
            {feedback[0]}
          </span>
        )}
      </div>

      {/* Feedback suggestions */}
      {feedback.length > 0 && strength.score < 3 && (
        <ul className="text-xs text-gray-500 space-y-0.5">
          {feedback.map((item, index) => (
            <li key={index} className="flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-gray-400"></span>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
