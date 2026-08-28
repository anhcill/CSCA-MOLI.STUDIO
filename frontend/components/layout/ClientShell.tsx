'use client';

import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import Footer from '@/components/layout/Footer';
import FloatingContactButtons from '@/components/common/FloatingContactButtons';
import MoliPet from '@/components/common/MoliPet';
import DailyGiftBox from '@/components/daily-gift/DailyGiftBox';
import NationalDayGreeting from '@/components/national-day/NationalDayGreeting';
import PWAInstallBanner from '@/components/pwa/PWAInstallBanner';
import NotificationPermissionPrompt from '@/components/pwa/NotificationPermissionPrompt';
import UpdateToast from '@/components/pwa/UpdateToast';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { useAuthStore } from '@/lib/store/authStore';
import axios from '@/lib/utils/axios';
import { disconnectSocket, initSocket } from '@/lib/socket';
import { isNationalDayThemeActive, NATIONAL_DAY_THEME_END } from '@/lib/nationalDayTheme';

const ACTIVITY_RECORD_TTL = 5 * 60 * 1000;
let lastActivityRecordedAt = 0;
let activityRecordRequest: Promise<unknown> | null = null;
const CURRENT_ROUTE_KEY = 'moli:currentRoute';
const PREVIOUS_ROUTE_KEY = 'moli:previousRoute';

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [queryString, setQueryString] = useState('');
  const currentRoute = `${pathname || '/'}${queryString ? `?${queryString}` : ''}`;
  const [mounted, setMounted] = useState(false);
  const [nationalDayTheme, setNationalDayTheme] = useState(isNationalDayThemeActive);
  const { isAuthenticated, token } = useAuthStore();

  // Keep query-dependent shell behavior without useSearchParams(), which would
  // force the entire root Suspense boundary into client-side rendering.
  useEffect(() => {
    const syncQueryString = () => {
      setQueryString(window.location.search.replace(/^\?/, ''));
    };

    syncQueryString();
    window.addEventListener('popstate', syncQueryString);
    return () => window.removeEventListener('popstate', syncQueryString);
  }, [pathname]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!nationalDayTheme) return;

    const remaining = NATIONAL_DAY_THEME_END.getTime() - Date.now();
    if (remaining <= 0) {
      setNationalDayTheme(false);
      return;
    }

    const timer = window.setTimeout(() => setNationalDayTheme(false), remaining);
    return () => window.clearTimeout(timer);
  }, [nationalDayTheme]);

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

  useEffect(() => {
    if (!mounted) return;

    if (!isAuthenticated || !token) {
      disconnectSocket();
      return;
    }

    const socket = initSocket();
    if (!socket) return;

    const presencePayload = () => ({
      path: pathname || '/',
      title: document.title,
      visible: document.visibilityState === 'visible',
    });
    const reportPresence = () => socket.emit('presence:update', presencePayload());
    const reportHeartbeat = () => socket.emit('presence:heartbeat', presencePayload());
    const reportPageHidden = () => socket.emit('presence:update', {
      ...presencePayload(),
      visible: false,
    });

    socket.on('connect', reportPresence);
    reportPresence();

    document.addEventListener('visibilitychange', reportPresence);
    window.addEventListener('pagehide', reportPageHidden);
    const heartbeat = window.setInterval(reportHeartbeat, 25_000);

    return () => {
      socket.off('connect', reportPresence);
      document.removeEventListener('visibilitychange', reportPresence);
      window.removeEventListener('pagehide', reportPageHidden);
      window.clearInterval(heartbeat);
    };
  }, [mounted, isAuthenticated, token, pathname]);

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
  const isSubjectScopedPage = Boolean(new URLSearchParams(queryString).get('subject')) && pathname?.match(/^\/(lich-su|tu-vung|cau-truc-de|ly-thuyet|cong-thuc|giai-de-chi-tiet|lo-trinh)$/);
  const noFooter = isAdmin || isAuth || isExam || isChat || isGame || isCoursePage || isSubjectPage || isSubjectScopedPage;
  const showFloatingContacts = !isAdmin && !isAuth && !isExam && !isChat && !isGame && !isSubjectPage && !isSubjectScopedPage;
  const showMoliPet = !isAdmin && !isAuth && !isExam && !isChat && !isGame;
  // The National Day greeting takes the daily letter's exact corner position
  // during the campaign.  The original daily-letter behavior resumes after it.
  const showDailyGift = showMoliPet && isAuthenticated && !nationalDayTheme;
  const showNationalDayGreeting = nationalDayTheme && !isAdmin && !isAuth && !isExam && !isChat && !isGame;
  const showPwaBanner = !isAdmin && !isAuth && !isExam && !isGame && !isChat;
  const showNotificationPrompt = isAuthenticated && !isAdmin && !isAuth && !isExam && !isGame && !isChat;
  const showUpdateToast = !isChat;
  const moliPetPosition = 'left';

  // Register service worker + detect updates
  const { updateAvailable, updateVersion, activateUpdate } = useServiceWorker();

  return (
    <>
      {showFloatingContacts && mounted && <FloatingContactButtons />}
      {showMoliPet && mounted && <MoliPet defaultPosition={moliPetPosition} />}
      {showDailyGift && mounted && <DailyGiftBox />}
      {showNationalDayGreeting && mounted && <NationalDayGreeting />}
      {mounted && showNotificationPrompt && <NotificationPermissionPrompt />}
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
