'use client';

import { useEffect, useRef, useCallback } from 'react';

interface UseExamProtectionOptions {
  onViolation?: (type: string) => void;
  maxViolations?: number;
  enabled?: boolean;
}

/**
 * Anti-cheat protection for exam pages.
 * Detects: tab switching, window blur, right-click, text selection, print, screenshot.
 * Mobile: detects visibility changes (triggered by screenshot on many devices),
 *         resize events (split-screen), and touch callout attempts.
 */
export function useExamProtection({
  onViolation,
  maxViolations = 3,
  enabled = true,
}: UseExamProtectionOptions = {}) {
  const violations = useRef(0);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSize = useRef({ w: 0, h: 0 });

  const handleViolation = useCallback(
    (type: string) => {
      violations.current += 1;
      if (onViolation) onViolation(type);
    },
    [onViolation],
  );

  useEffect(() => {
    if (!enabled) return;

    // Record initial size for resize detection
    lastSize.current = { w: window.innerWidth, h: window.innerHeight };

    // 1. Disable right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      handleViolation('right_click');
    };
    document.addEventListener('contextmenu', handleContextMenu);

    // 2. Detect tab/window switch (visibilitychange)
    //    On mobile, screenshots often trigger this event briefly.
    //    We INSTANTLY blur the page content so the screenshot captures blur.
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Instantly blur ALL content before screenshot completes
        document.body.style.filter = 'blur(30px)';
        document.body.style.transition = 'filter 0ms';
        handleViolation('tab_switch');
      } else {
        // Restore after a brief delay (user is back)
        setTimeout(() => {
          document.body.style.filter = 'none';
          document.body.style.transition = 'filter 300ms';
        }, 500);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 3. Detect window blur (clicking outside browser)
    const handleBlur = () => {
      handleViolation('window_blur');
    };
    window.addEventListener('blur', handleBlur);

    // 4. Block keyboard shortcuts: print, save, screenshot
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block Ctrl/Cmd + P (print), S (save), C (copy in some contexts)
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === 'p' || e.key === 'PrintScreen' || e.key === 's')
      ) {
        e.preventDefault();
        handleViolation('print_shortcut');
      }
      // Block PrintScreen key
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        // Try to clear clipboard on desktop
        try {
          navigator.clipboard.writeText('').catch(() => {});
        } catch {}
        handleViolation('screenshot_key');
      }
      // Block F12 dev tools
      if (e.key === 'F12') {
        e.preventDefault();
        handleViolation('devtools');
      }
      // Block Ctrl+Shift+I (dev tools)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        handleViolation('devtools');
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    // 5. Block beforeprint event
    const handleBeforePrint = (e: Event) => {
      e.preventDefault();
      handleViolation('print_attempt');
    };
    window.addEventListener('beforeprint', handleBeforePrint);

    // 6. Mobile: Detect sudden resize (split screen / screen recording tools)
    const handleResize = () => {
      const wDiff = Math.abs(window.innerWidth - lastSize.current.w);
      const hDiff = Math.abs(window.innerHeight - lastSize.current.h);
      // Only trigger if significant resize (not keyboard opening)
      if (wDiff > 100) {
        handleViolation('resize_suspicious');
      }
      lastSize.current = { w: window.innerWidth, h: window.innerHeight };
    };
    window.addEventListener('resize', handleResize);

    // 7. Mobile: Block long-press (which can trigger screenshot on some devices)
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 2) {
        // 3+ finger gestures are often screenshot gestures
        handleViolation('multi_touch');
      }
    };
    document.addEventListener('touchstart', handleTouchStart, { passive: true });

    // 8. Prevent copy via clipboard events
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      handleViolation('copy_attempt');
    };
    document.addEventListener('copy', handleCopy);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('copy', handleCopy);
      // Clean up body blur just in case
      document.body.style.filter = '';
      document.body.style.transition = '';
      if (warningRef.current) clearTimeout(warningRef.current);
    };
  }, [enabled, handleViolation]);

  const resetViolations = useCallback(() => {
    violations.current = 0;
  }, []);

  return {
    violations: violations.current,
    resetViolations,
    maxViolations,
  };
}

/**
 * Anti-cheat CSS that must be applied to the exam container.
 * Returns className string to apply to the exam wrapper.
 */
export const examProtectionStyles = `
  /* Disable text selection */
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;

  /* Disable copy */
  -webkit-touch-callout: none;
  -webkit-user-select: none;

  /* Prevent drag */
  -webkit-user-drag: none;
  user-drag: none;

  /* Print styles - hide content when printing */
  @media print {
    body * {
      visibility: hidden;
    }
    body::after {
      content: "In nội dung đề thi không được phép!";
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 24px;
      color: #dc2626;
      font-weight: bold;
    }
  }
`;
