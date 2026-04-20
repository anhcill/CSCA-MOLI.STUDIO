'use client';

import { useTheme } from '@/context/ThemeContext';
import { FiSun, FiMoon } from 'react-icons/fi';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
      aria-label={theme === 'dark' ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
      title={theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'}
    >
      {theme === 'dark' ? (
        <FiSun size={18} className="text-amber-500" />
      ) : (
        <FiMoon size={18} />
      )}
    </button>
  );
}
