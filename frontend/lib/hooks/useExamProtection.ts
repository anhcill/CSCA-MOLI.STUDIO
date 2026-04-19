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
 */
export function useExamProtection({
  onViolation,
  maxViolations = 3,
  enabled = true,
}: UseExamProtectionOptions = {}) {
  const violations = useRef(0);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleViolation = useCallback(
    (type: string) => {
      violations.current += 1;
      if (onViolation) onViolation(type);
    },
    [onViolation],
  );

  useEffect(() => {
    if (!enabled) return;

    // 1. Disable right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      handleViolation('right_click');
    };
    document.addEventListener('contextmenu', handleContextMenu);

    // 2. Detect tab/window switch (visibilitychange)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleViolation('tab_switch');
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 3. Detect window blur (clicking outside browser)
    const handleBlur = () => {
      handleViolation('window_blur');
    };
    window.addEventListener('blur', handleBlur);

    // 4. Block keyboard print shortcut
    const handleKeyDown = (e: KeyboardEvent) => {
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
        handleViolation('screenshot_key');
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    // 5. Block beforeprint event
    const handleBeforePrint = (e: Event) => {
      e.preventDefault();
      handleViolation('print_attempt');
    };
    window.addEventListener('beforeprint', handleBeforePrint);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('beforeprint', handleBeforePrint);
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
