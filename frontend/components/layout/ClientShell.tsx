'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import Footer from '@/components/layout/Footer';
import FloatingContactButtons from '@/components/common/FloatingContactButtons';
import MoliPet from '@/components/common/MoliPet';
import DailyGiftBox from '@/components/daily-gift/DailyGiftBox';
import PWAInstallBanner from '@/components/pwa/PWAInstallBanner';
import PWAInstallPrompt from '@/components/pwa/PWAInstallPrompt';
import UpdateToast from '@/components/pwa/UpdateToast';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { useAuthStore } from '@/lib/store/authStore';
import axios from '@/lib/utils/axios';

const ACTIVITY_RECORD_TTL = 5 * 60 * 1000;
let lastActivityRecordedAt = 0;
let activityRecordRequest: Promise<unknown> | null = null;
const CURRENT_ROUTE_KEY = 'moli:currentRoute';
const PREVIOUS_ROUTE_KEY = 'moli:previousRoute';

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams?.toString();
  const currentRoute = `${pathname || '/'}${queryString ? `?${queryString}` : ''}`;
  const [mounted, setMounted] = useState(false);
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;

    const previousCurrentRoute = sessionStorage.getItem(CURRENT_ROUTE_KEY);
    if (previousCurrentRoute && previousCurrentRoute !== currentRoute) {
      sessionStorage.setItem(PREVIOUS_ROUTE_KEY, previousCurrentRoute);
    }
    sessionStorage.setItem(CURRENT_ROUTE_KEY, currentRoute);
  }, [mounted, currentRoute]);

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
  const isChat = pathname?.startsWith('/hoi-dap') ||
    pathname?.startsWith('/gop-y') ||
    pathname?.startsWith('/tin-nhan') ||
    pathname?.startsWith('/ho-tro/messages');
  const isGame = pathname?.startsWith('/games');
  const isCoursePage = pathname?.startsWith('/khoa-hoc') || pathname?.startsWith('/hoc');
  const isSubjectPage = pathname?.match(/^\/(toan|vat-ly|hoa|tu-vung|cau-truc-de|ly-thuyet|cong-thuc|giai-de-chi-tiet|tailieu|tiengtrung-xahoi|tiengtrung-tunhien|lo-trinh|mon)/);
  const isSubjectScopedPage = !!searchParams?.get('subject') && pathname?.match(/^\/(lich-su|tu-vung|cau-truc-de|ly-thuyet|cong-thuc|giai-de-chi-tiet|lo-trinh)$/);
  const noFooter = isAdmin || isAuth || isExam || isChat || isGame || isCoursePage || isSubjectPage || isSubjectScopedPage;
  const showFloatingContacts = !isAdmin && !isAuth && !isExam && !isChat && !isGame && !isSubjectPage && !isSubjectScopedPage;
  const showMoliPet = !isAdmin && !isAuth && !isExam && !isChat && !isGame;
  const showDailyGift = showMoliPet && isAuthenticated;
  const showPwaBanner = !isAdmin && !isAuth && !isExam && !isGame && !isChat;
  const showPwaPrompt = !isAuth && !isChat;
  const showUpdateToast = !isChat;
  const moliPetPosition = 'left';

  // Register service worker + detect updates
  const { updateAvailable, updateVersion, activateUpdate } = useServiceWorker();

  return (
    <>
      {showFloatingContacts && mounted && <FloatingContactButtons />}
      {showMoliPet && mounted && <MoliPet defaultPosition={moliPetPosition} />}
      {showDailyGift && mounted && <DailyGiftBox />}
      {mounted && showPwaPrompt && <PWAInstallPrompt />}
      {mounted && showUpdateToast && (
        <UpdateToast
          visible={updateAvailable}
          version={updateVersion}
          onUpdate={activateUpdate}
        />
      )}

      <div className="min-h-[100dvh] flex flex-col">
        {mounted && showPwaBanner && <PWAInstallBanner />}
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
