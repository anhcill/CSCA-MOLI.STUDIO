'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import Footer from '@/components/layout/Footer';
import FloatingContactButtons from '@/components/common/FloatingContactButtons';

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Suppress footer on admin/auth/exam routes
  const isAdmin = pathname?.startsWith('/admin');
  const isAuth =
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/register') ||
    pathname?.startsWith('/forgot') ||
    pathname?.startsWith('/reset');
  const isExam = pathname?.startsWith('/exam/');
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
