'use client';

import { FiPlus } from 'react-icons/fi';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/authStore';
import { hasPermission } from '@/lib/utils/permissions';

interface AdminExamButtonProps {
  href: string;
  gradientClass: string;
  shadowClass: string;
  hoverClass: string;
}

export default function AdminExamButton({ href, gradientClass, shadowClass, hoverClass }: AdminExamButtonProps) {
  const { user } = useAuthStore();
  const isAdmin = hasPermission(user, 'exams.manage');

  if (!isAdmin) return null;

  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-4 py-2 bg-gradient-to-r ${gradientClass} text-white rounded-xl font-semibold text-sm shadow-lg ${shadowClass} ${hoverClass} transition-all`}
    >
      <FiPlus size={16} /> Đăng đề
    </Link>
  );
}
