'use client';

import { useMemo } from 'react';
import { checkPasswordStrength } from '@/lib/utils/security';

interface PasswordStrengthIndicatorProps {
  password: string;
}

export default function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const strength = useMemo(() => checkPasswordStrength(password), [password]);

  if (!password) return null;

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
          {strength.label}
        </span>
        {strength.feedback.length > 0 && (
          <span className="text-xs text-gray-500">
            {strength.feedback[0]}
          </span>
        )}
      </div>

      {/* Feedback suggestions */}
      {strength.feedback.length > 0 && strength.score < 3 && (
        <ul className="text-xs text-gray-500 space-y-0.5">
          {strength.feedback.map((item, index) => (
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
