'use client';

import { useRouter } from 'next/navigation';

interface Props {
  userId: number;
  name: string;
  avatar?: string | null;
  avatarUrl?: string | null;
  time: string;
  role?: string;
  isVip?: boolean;
  size?: 'sm' | 'md' | 'lg';
  badge?: string;
}

const isAdminRole = (role?: string | null) =>
  ['admin', 'super_admin', 'forum_admin', 'exam_admin', 'content_admin', 'user_admin', 'roadmap_admin'].includes(String(role || '').toLowerCase());

export default function PostAuthor({
  userId, name, avatar, avatarUrl, time, role, isVip, size = 'md', badge
}: Props) {
  const router = useRouter();

  const avatarSize = size === 'sm' ? 28 : size === 'lg' ? 52 : 40;
  const textSize = size === 'sm' ? 'text-[12px]' : size === 'lg' ? 'text-base' : 'text-sm';
  const subTextSize = size === 'sm' ? '[11px]' : size === 'lg' ? 'text-xs' : 'text-[11px]';

  const getAvatar = () =>
    avatarUrl || avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=${avatarSize * 2}`;

  return (
    <div className="flex items-center gap-3">
      {/* Avatar → nhảy thẳng sang trang profile */}
      <div
        onClick={() => router.push(`/profile/user/${userId}`)}
        className="relative shrink-0 cursor-pointer group"
      >
        <img
          src={getAvatar()}
          alt={name}
          className="rounded-2xl object-cover ring-2 ring-white/50 dark:ring-slate-700/70 shadow-md transition-transform duration-200 group-hover:scale-105"
          style={{ width: avatarSize, height: avatarSize }}
        />
        {isVip && (
          <div
            className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-amber-400 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center"
            title="VIP"
          >
            <div className="w-1.5 h-1.5 bg-amber-600 rounded-full" />
          </div>
        )}
      </div>

      {/* Name + meta */}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`font-bold text-gray-900 dark:text-white ${textSize} truncate`}>{name}</span>
          {isAdminRole(role) && (
            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-emerald-100 text-emerald-700">Amin</span>
          )}
          {role === 'moderator' && (
            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-blue-100 text-blue-700">Mod</span>
          )}
          {isVip && (
            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-100 text-amber-700">VIP</span>
          )}
          {badge && (
            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-violet-100 text-violet-700">{badge}</span>
          )}
        </div>
        <p className={`text-gray-400 dark:text-slate-400 font-medium ${subTextSize} flex items-center gap-1.5`}>
          {time}
          <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-slate-600" />
          <span>Công khai</span>
        </p>
      </div>
    </div>
  );
}
