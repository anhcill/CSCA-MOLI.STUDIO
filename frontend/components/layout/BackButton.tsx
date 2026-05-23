'use client';

import { useRouter } from 'next/navigation';
import { FiArrowLeft } from 'react-icons/fi';

interface BackButtonProps {
  fallbackHref?: string;
  label?: string;
  className?: string;
}

export default function BackButton({
  fallbackHref = '/',
  label = 'Quay về',
  className = '',
}: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className={`inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-600 shadow-sm transition hover:border-violet-200 hover:text-violet-700 ${className}`}
    >
      <FiArrowLeft size={16} />
      {label}
    </button>
  );
}
