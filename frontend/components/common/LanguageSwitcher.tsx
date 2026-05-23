'use client';

import { useState, useRef, useEffect } from 'react';
import { LANGUAGES, useLanguage, AppLanguage } from '@/context/LanguageContext';
import { FiChevronDown } from 'react-icons/fi';

type LanguageSwitcherProps = {
  compact?: boolean;
  className?: string;
};

const FLAG_EMOJIS: Record<AppLanguage, string> = {
  vi: '🇻🇳',
  en: '🇺🇸',
  zh: '🇨🇳',
};

export default function LanguageSwitcher({ compact = false, className = '' }: LanguageSwitcherProps) {
  const { language, setLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentLang = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 shadow-sm transition-all hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-750"
      >
        <span className="text-sm leading-none">{FLAG_EMOJIS[language]}</span>
        <span>{compact ? currentLang.shortLabel : currentLang.nativeName}</span>
        <FiChevronDown className={`text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} size={12} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[150] mt-2 w-36 overflow-hidden rounded-2xl border border-gray-100 bg-white py-1 shadow-xl animate-in fade-in slide-in-from-top-2 duration-150 dark:border-gray-700 dark:bg-gray-850">
          {LANGUAGES.map((item) => (
            <button
              key={item.code}
              type="button"
              onClick={() => {
                setLanguage(item.code);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold transition-colors ${
                item.code === language
                  ? 'bg-violet-50 text-violet-700 dark:bg-violet-950/20 dark:text-violet-400'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white'
              }`}
            >
              <span className="text-sm leading-none">{FLAG_EMOJIS[item.code]}</span>
              <span>{item.nativeName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
