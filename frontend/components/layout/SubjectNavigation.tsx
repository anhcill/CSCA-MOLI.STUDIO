'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  BsJournalBookmark,
  BsLightbulb,
  BsStars,
  BsGraphUp,
} from 'react-icons/bs';
import { FiFileText } from 'react-icons/fi';
import { buildSubjectScopedHref } from '@/lib/utils/subjectScope';
import { useLanguage } from '@/context/LanguageContext';

interface MenuItem {
  icon: React.ComponentType<{ className?: string }>;
  label?: string;
  labelKey?: string;
  href: string;
}

interface SubjectNavigationProps {
  subject: string;
  subjectCode: string;
  subjectSlug?: string;
  colorScheme: {
    from: string;
    via?: string;
    to: string;
  };
  menuItems?: MenuItem[];
  emoji?: string;
}

const getDefaultMenuItems = (subjectSlug?: string): MenuItem[] => {
  return [
    { icon: BsJournalBookmark, labelKey: 'course.section.structure', href: '/cau-truc-de' },
    { icon: BsLightbulb, labelKey: 'course.section.theory', href: '/ly-thuyet' },
    { icon: FiFileText, labelKey: 'course.section.formulas', href: '/cong-thuc' },
    { icon: BsStars, labelKey: 'course.section.vocabulary', href: '/tu-vung' },
    { icon: BsGraphUp, labelKey: 'course.section.solutions', href: '/giai-de-chi-tiet' },
  ];
};

export default function SubjectNavigation({
  subject,
  subjectCode,
  subjectSlug,
  colorScheme,
  menuItems,
  emoji = '📚'
}: SubjectNavigationProps) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const items = menuItems || getDefaultMenuItems(subjectSlug);

  // Build full href with subject param
  const buildSubjectHref = (href: string) => {
    return buildSubjectScopedHref(href, subjectSlug);
  };

  const isActiveHref = (href: string) => {
    const fullHref = buildSubjectHref(href);
    const full = fullHref.slice(1);
    const current = pathname + (searchParams.toString() ? '?' + searchParams.toString() : '');
    const currentWithoutSlash = current.startsWith('/') ? current.slice(1) : current;
    return currentWithoutSlash === full || currentWithoutSlash.startsWith(full + '&');
  };

  return (
    <aside className="w-full space-y-6 sticky top-24 h-fit">

      {/* Tab Controls (Floating Pills) */}
      <div className="bg-white/80 backdrop-blur-xl border border-gray-100 rounded-2xl shadow-sm p-1.5 flex gap-1 relative z-20">
        <button
          onClick={() => {}}
          className="flex-1 py-2.5 px-2 text-xs sm:text-sm font-bold transition-all duration-300 rounded-xl text-gray-900 shadow-sm bg-white"
        >
          {t('course.section.materials')}
        </button>

        <Link
          href={subjectSlug ? `/lich-su?subject=${subjectSlug}` : '/lich-su'}
          className="flex-1 py-2.5 px-2 text-xs sm:text-sm font-bold transition-all duration-300 rounded-xl text-center text-gray-500 hover:text-gray-800 hover:bg-gray-50/50"
        >
          {t('course.section.history')}
        </Link>
      </div>

      {/* Tab Content Cards */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-gray-100 shadow-sm overflow-hidden min-h-[400px]">
        <div className="p-4">
          {/* Menu */}
          <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {items.map((item, index) => {
                const Icon = item.icon;
                const href = buildSubjectHref(item.href);
                const isActive = isActiveHref(item.href);
                return (
                  <Link
                    key={index}
                    href={href}
                    className={`group flex items-center gap-4 p-3.5 rounded-2xl transition-all duration-300 ${
                        isActive
                      ? `bg-gradient-to-r ${colorScheme.from} ${colorScheme.via || ''} ${colorScheme.to} text-white shadow-md hover:shadow-lg`
                      : 'text-gray-600 hover:bg-gray-50 border border-transparent hover:border-gray-100'
                      }`}
                  >
                    <div className={`${isActive ? 'bg-white/20' : 'bg-gray-100 group-hover:bg-gray-200'} w-10 h-10 rounded-xl flex items-center justify-center transition-colors shrink-0`}>
                       <Icon className={`text-lg ${isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-700'}`} />
                    </div>
                    <span className="font-bold">{item.labelKey ? t(item.labelKey) : item.label}</span>
                  </Link>
                );
              })}
          </div>
        </div>
      </div>
    </aside>
  );
}
