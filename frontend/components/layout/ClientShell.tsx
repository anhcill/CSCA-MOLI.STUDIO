'use client';

import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import Footer from '@/components/layout/Footer';
import FloatingContactButtons from '@/components/common/FloatingContactButtons';

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Suppress footer on admin/auth/exam routes
  const isAdmin = mounted && pathname?.startsWith('/admin');
  const isAuth = mounted && (
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/register') ||
    pathname?.startsWith('/forgot') ||
    pathname?.startsWith('/reset')
  );
  const isExam = mounted && pathname?.startsWith('/exam/');
  const noFooter = isAdmin || isAuth || isExam;
  const showFloatingContacts = !isAdmin && !isExam;

  return (
    <>
      {showFloatingContacts && <FloatingContactButtons />}

      <div className="min-h-screen flex flex-col">
        <div className="flex-1">
          {children}
        </div>

        {!noFooter && (
          <div id="footer-shell" className="mt-auto">
            <Footer />
          </div>
        )}
      </div>
    </>
  );
}
