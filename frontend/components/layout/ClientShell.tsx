'use client';

import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import Footer from '@/components/layout/Footer';
import FloatingContactButtons from '@/components/common/FloatingContactButtons';
import { useAuthStore } from '@/lib/store/authStore';
import axios from '@/lib/utils/axios';

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !isAuthenticated) return;
    axios.post('/users/record-activity').catch(() => {});
  }, [mounted, isAuthenticated, pathname]);

  // Suppress footer on admin/auth/exam/chat/subject pages
  const isAdmin = pathname?.startsWith('/admin');
  const isAuth = pathname?.startsWith('/login') ||
    pathname?.startsWith('/register') ||
    pathname?.startsWith('/forgot') ||
    pathname?.startsWith('/reset');
  const isExam = pathname?.startsWith('/exam/');
  const isChat = pathname?.startsWith('/hoi-dap');
  const isSubjectPage = pathname?.match(/^\/(toan|vat-ly|hoa|tu-vung|tailieu|tiengtrung-xahoi|tiengtrung-tunhien|lo-trinh|mon)/);
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
