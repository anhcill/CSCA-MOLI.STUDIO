'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Footer from '@/components/layout/Footer';

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prevPathname = useRef(pathname);

  // ── Mounted guard (avoid SSR hydration mismatch) ─────────────────────────
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // ── Navigation progress bar ──────────────────────────────────────────────
  const [progress, setProgress] = useState(0);
  const [barVisible, setBarVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startProgress = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setProgress(0);
    setBarVisible(true);
    let val = 0;
    timerRef.current = setInterval(() => {
      val += Math.random() * 12 * (1 - val / 100);
      if (val > 90) val = 90;
      setProgress(val);
    }, 120);
  };

  const finishProgress = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setProgress(100);
    setTimeout(() => { setBarVisible(false); setProgress(0); }, 300);
  };

  // ── Click listener — start progress when moving to another route ─────────
  useEffect(() => {
    const onLinkClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a');
      if (!a) return;
      const href = a.getAttribute('href') ?? '';
      if (
        href.startsWith('/') &&
        !href.startsWith('//') &&
        href.split('?')[0] !== pathname
      ) {
        startProgress();
      }
    };
    document.addEventListener('click', onLinkClick, true);
    return () => document.removeEventListener('click', onLinkClick, true);
  }, [pathname]);

  // ── Pathname change — finish progress once route is settled ──────────────
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      finishProgress();
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [pathname]);

  // ── Route-based footer suppression ──────────────────────────────────────
  const isAdmin = pathname?.startsWith('/admin');
  const isAuth =
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/register') ||
    pathname?.startsWith('/forgot') ||
    pathname?.startsWith('/reset');
  const isExam = pathname?.startsWith('/exam/');
  const noFooter = isAdmin || isAuth || isExam;

  return (
    <>
      {/* Progress bar */}
      {mounted && barVisible && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            height: '3px',
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #7c3aed, #a855f7)',
            transition: progress === 100 ? 'width 0.15s ease-out' : 'width 0.12s ease',
            zIndex: 9999,
            borderRadius: '0 2px 2px 0',
            pointerEvents: 'none',
          }}
        />
      )}

      <div className="min-h-screen flex flex-col">
        <div className="flex-1">
          {children}
        </div>

        {mounted && !noFooter && (
          <div id="footer-shell" className="mt-auto">
            <Footer />
          </div>
        )}
      </div>
    </>
  );
}
