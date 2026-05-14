'use client';

import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import Footer from '@/components/layout/Footer';
import FloatingContactButtons from '@/components/common/FloatingContactButtons';
import { useAuthStore } from '@/lib/store/authStore';
import axios from '@/lib/utils/axios';

const ACTIVITY_RECORD_TTL = 5 * 60 * 1000;
let lastActivityRecordedAt = 0;
let activityRecordRequest: Promise<unknown> | null = null;

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !isAuthenticated) return;

    const now = Date.now();
    if (now - lastActivityRecordedAt < ACTIVITY_RECORD_TTL || activityRecordRequest) return;

    activityRecordRequest = axios.post('/users/record-activity')
      .then(() => { lastActivityRecordedAt = Date.now(); })
      .catch(() => {})
      .finally(() => { activityRecordRequest = null; });
  }, [mounted, isAuthenticated, pathname]);

  // Suppress footer on admin/auth/exam/chat/subject pages
  const isAdmin = pathname?.startsWith('/admin');
  const isAuth = pathname?.startsWith('/login') ||
    pathname?.startsWith('/register') ||
    pathname?.startsWith('/forgot') ||
    pathname?.startsWith('/reset');
  const isExam = pathname?.startsWith('/exam/');
  const isChat = pathname?.startsWith('/hoi-dap');
  const isSubjectPage = pathname?.match(/^\/(toan|vat-ly|hoa|tu-vung|cau-truc-de|ly-thuyet|giai-de-chi-tiet|tailieu|tiengtrung-xahoi|tiengtrung-tunhien|lo-trinh|mon)/);
  const noFooter = isAdmin || isAuth || isExam || isChat || isSubjectPage;
  const showFloatingContacts = !isAdmin && !isExam && !isChat && !isSubjectPage;

  return (
    <>
      {showFloatingContacts && mounted && <FloatingContactButtons />}

      <div className="min-h-[100dvh] flex flex-col">
        <div className="flex-1">
          {children}
        </div>

        {mounted && !noFooter && (
          <div id="footer-shell">
            <Footer />
          </div>
        )}
      </div>
    </>
  );
}
