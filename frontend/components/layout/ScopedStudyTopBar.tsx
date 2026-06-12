'use client';

import { useRouter } from 'next/navigation';
import { FiChevronLeft } from 'react-icons/fi';
import { getSubjectMeta } from '@/lib/utils/subjectScope';

interface ScopedStudyTopBarProps {
  title: string;
  subject?: string | null;
  fallbackIcon?: string;
}

export default function ScopedStudyTopBar({
  title,
  subject,
  fallbackIcon = '📚',
}: ScopedStudyTopBarProps) {
  const router = useRouter();
  const activeMeta = getSubjectMeta(subject);

  return (
    <div className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-cyan-600 font-medium transition-colors py-2"
        >
          <FiChevronLeft size={22} />
          <span className="hidden sm:inline">Quay lại</span>
        </button>

        <div className="font-black text-gray-800 text-sm sm:text-xl text-center absolute left-1/2 -translate-x-1/2 max-w-[55%] sm:max-w-none truncate flex items-center gap-2">
          {activeMeta ? (
            <>
              <span>{activeMeta.icon}</span>
              <span>{activeMeta.label}</span>
            </>
          ) : (
            <>
              <span>{fallbackIcon}</span>
              <span>{title}</span>
            </>
          )}
        </div>

        <div className="w-20" />
      </div>
    </div>
  );
}
