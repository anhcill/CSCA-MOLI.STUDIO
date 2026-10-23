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
import OnlineClassAnnouncement from '@/components/layout/OnlineClassAnnouncement';
import ExamCountdownNotice from '@/components/exam/ExamCountdownNotice';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { useAuthStore } from '@/lib/store/authStore';
import axios from '@/lib/utils/axios';
import { disconnectSocket, initSocket } from '@/lib/socket';
import { isNationalDayThemeActive, NATIONAL_DAY_THEME_END } from '@/lib/nationalDayTheme';
import FirstTimeWelcomeModal from '@/components/welcome/FirstTimeWelcomeModal';
import {
  getCachedWelcomeSettings,
  saveCachedWelcomeSettings,
  getWelcomeSeenKey,
} from '@/lib/welcome/welcomeConfig';

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
  const { isAuthenticated, token, user } = useAuthStore();
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [welcomeSettingsReady, setWelcomeSettingsReady] = useState(false);
  const [welcomeSettingsRevision, setWelcomeSettingsRevision] = useState(0);

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

  // Suppress footer on admin/auth/exam/chat/subject/topic-practice pages
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
  const isVideoCommerce = ['/goi-video', '/thanh-toan-khoa-hoc', '/tai-khoan/goi-video'].includes(pathname || '');
  const isTopicPractice = pathname?.startsWith('/luyen-chu-de');
  const isSubjectPage = pathname?.match(/^\/(toan|vat-ly|hoa|tu-vung|cau-truc-de|ly-thuyet|cong-thuc|giai-de-chi-tiet|tailieu|tiengtrung-xahoi|tiengtrung-tunhien|lo-trinh|mon)/);
  const isSubjectScopedPage = Boolean(new URLSearchParams(queryString).get('subject')) && pathname?.match(/^\/(lich-su|tu-vung|cau-truc-de|ly-thuyet|cong-thuc|giai-de-chi-tiet|lo-trinh)$/);
  const isStudyStation = pathname?.startsWith('/tram-dong-luc');
  const noFooter = isAdmin || isAuth || isExam || isChat || isGame || isCoursePage || isVideoCommerce || isTopicPractice || isSubjectPage || isSubjectScopedPage || isStudyStation;
  const showFloatingContacts = !isAdmin && !isAuth && !isExam && !isChat && !isGame && !isSubjectPage && !isSubjectScopedPage && !isStudyStation;
  const showMoliPet = isAuthenticated && !isAdmin && !isAuth && !isExam && !isChat && !isGame && !isStudyStation;
  // The National Day greeting takes the daily letter's exact corner position
  // during the campaign.  The original daily-letter behavior resumes after it.
  const showDailyGift = showMoliPet && isAuthenticated && !nationalDayTheme;
  const showNationalDayGreeting = nationalDayTheme && !isAdmin && !isAuth && !isExam && !isChat && !isGame;
  // Keep public pages distraction-free. Guests still receive service-worker
  // updates silently, but PWA and update prompts are reserved for signed-in learners.
  const showPwaBanner = isAuthenticated && !isAdmin && !isAuth && !isExam && !isGame && !isChat;
  const showOnlineClassAnnouncement = !isAdmin && !isAuth && !isExam && !isGame && !isChat;
  const showNotificationPrompt = isAuthenticated && !isAdmin && !isAuth && !isExam && !isGame && !isChat;
  const showExamCountdownNotice = isAuthenticated && !isAdmin && !isAuth && !isExam && !isGame && !isChat;
  const showUpdateToast = isAuthenticated && !isChat;
  const moliPetPosition = 'left';

  // Register service worker + detect updates
  const { updateAvailable, updateVersion, activateUpdate } = useServiceWorker();

  // Sync public site settings (welcome, etc.) from backend
  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    fetch(`${apiUrl}/settings/public`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.data?.welcome_settings) {
          saveCachedWelcomeSettings(json.data.welcome_settings);
          if (!cancelled) setWelcomeSettingsRevision((revision) => revision + 1);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setWelcomeSettingsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [mounted]);

  // First-time login welcome modal check (reset for all users via versioning)
  useEffect(() => {
    if (!mounted || !welcomeSettingsReady || !isAuthenticated || !user) return;
    if (pathname?.startsWith('/admin')) return;

    try {
      const config = getCachedWelcomeSettings();
      if (!config.enabled) return;

      const version = config.version || 2;
      const key = getWelcomeSeenKey(user.id, version);
      const seen = localStorage.getItem(key);
      if (!seen) {
        setShowWelcomeModal(true);
      }
    } catch {}
  }, [mounted, welcomeSettingsReady, welcomeSettingsRevision, isAuthenticated, user, pathname]);

  const handleWelcomeDismiss = () => {
    setShowWelcomeModal(false);
    if (user?.id) {
      try {
        const config = getCachedWelcomeSettings();
        const version = config.version || 2;
        const key = getWelcomeSeenKey(user.id, version);
        localStorage.setItem(key, 'true');
      } catch {}
    }
  };

  return (
    <>
      {showWelcomeModal && mounted && (
        <FirstTimeWelcomeModal
          isOpen={showWelcomeModal}
          onClose={handleWelcomeDismiss}
          userName={user?.full_name}
        />
      )}
      {showFloatingContacts && mounted && !isVideoCommerce && <FloatingContactButtons />}
      {showMoliPet && mounted && !isVideoCommerce && <MoliPet defaultPosition={moliPetPosition} />}
      {showDailyGift && mounted && !isVideoCommerce && <DailyGiftBox />}
      {showNationalDayGreeting && mounted && !isVideoCommerce && <NationalDayGreeting />}
      {showOnlineClassAnnouncement && mounted && !isVideoCommerce && !showWelcomeModal && <OnlineClassAnnouncement />}
      {showExamCountdownNotice && mounted && !isVideoCommerce && !showWelcomeModal && <ExamCountdownNotice />}
      {mounted && showNotificationPrompt && !isVideoCommerce && <NotificationPermissionPrompt />}
      {mounted && showUpdateToast && (
        <UpdateToast
          visible={updateAvailable}
          version={updateVersion}
          onUpdate={activateUpdate}
        />
      )}

      <div className="min-h-[100dvh] flex flex-col">
        {mounted && showPwaBanner && !isVideoCommerce && <PWAInstallBanner />}
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
