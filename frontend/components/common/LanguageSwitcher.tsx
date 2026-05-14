'use client';

import { LANGUAGES, useLanguage } from '@/context/LanguageContext';

type LanguageSwitcherProps = {
  compact?: boolean;
  className?: string;
};

export default function LanguageSwitcher({ compact = false, className = '' }: LanguageSwitcherProps) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div
      className={`inline-flex items-center rounded-xl border border-gray-200 bg-white/90 p-1 shadow-sm dark:border-gray-700 dark:bg-gray-900/90 ${className}`}
      aria-label={t('common.language')}
    >
      {LANGUAGES.map((item) => {
        const active = item.code === language;
        return (
          <button
            key={item.code}
            type="button"
            onClick={() => setLanguage(item.code)}
            className={`min-h-8 rounded-lg px-2.5 text-xs font-black transition-colors ${
              active
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white'
            }`}
            title={item.label}
          >
            {compact ? item.shortLabel : item.nativeName}
          </button>
        );
      })}
    </div>
  );
}
