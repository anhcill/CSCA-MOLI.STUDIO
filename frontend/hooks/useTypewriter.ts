'use client';

import { useState, useEffect, useRef } from 'react';

interface UseTypewriterOptions {
  speed?: number;       // ms per character, default 15
  startDelay?: number;  // ms before starting, default 100
}

export function useTypewriter(text: string, options: UseTypewriterOptions = {}) {
  const { speed = 15, startDelay = 100 } = options;
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  const indexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!text) { setDisplayed(''); setDone(false); indexRef.current = 0; return; }

    setDisplayed('');
    setDone(false);
    indexRef.current = 0;

    const initialDelay = setTimeout(() => {
      const tick = () => {
        if (indexRef.current >= text.length) {
          setDone(true);
          return;
        }
        indexRef.current++;
        setDisplayed(text.slice(0, indexRef.current));
        timerRef.current = setTimeout(tick, speed);
      };
      tick();
    }, startDelay);

    return () => {
      clearTimeout(initialDelay);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [text, speed, startDelay]);

  return { displayed, done };
}
