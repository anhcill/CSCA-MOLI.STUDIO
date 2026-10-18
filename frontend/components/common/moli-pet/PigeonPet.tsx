'use client';

import { useEffect, useRef } from 'react';
import Lottie, { type LottieRefCurrentProps } from 'lottie-react';
import pigeonAnimation from './pigeon.json';

export function PigeonPet({ motion }: { motion: boolean }) {
  const animation = useRef<LottieRefCurrentProps>(null);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncPlayback = () => {
      if (!motion || reducedMotion.matches) {
        animation.current?.goToAndStop(0, true);
      } else if (document.hidden) {
        animation.current?.pause();
      } else {
        animation.current?.play();
      }
    };
    syncPlayback();
    reducedMotion.addEventListener('change', syncPlayback);
    document.addEventListener('visibilitychange', syncPlayback);
    return () => {
      reducedMotion.removeEventListener('change', syncPlayback);
      document.removeEventListener('visibilitychange', syncPlayback);
    };
  }, [motion]);

  return (
    <Lottie
      lottieRef={animation}
      animationData={pigeonAnimation}
      autoplay={false}
      loop
      className="pointer-events-none h-full w-full"
      aria-hidden="true"
    />
  );
}
