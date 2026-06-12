'use client';

import { useEffect, useState, useCallback } from 'react';

/**
 * Registers SW, detects new version waiting, exposes activateUpdate().
 * Does NOT auto-reload — caller decides when (avoid reload during exam).
 */
export function useServiceWorker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    let registration: ServiceWorkerRegistration | null = null;

    const onStateChange = (sw: ServiceWorker) => {
      if (sw.state === 'installed') {
        // New SW installed but waiting — there's an update
        setWaitingWorker(sw);
        setUpdateAvailable(true);
      }
    };

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        registration = reg;

        // Already a waiting worker (e.g. page refreshed after deploy)
        if (reg.waiting) {
          setWaitingWorker(reg.waiting);
          setUpdateAvailable(true);
        }

        // Listen for new installing worker
        reg.addEventListener('updatefound', () => {
          const newSW = reg.installing;
          if (newSW) {
            newSW.addEventListener('statechange', () => onStateChange(newSW));
          }
        });
      })
      .catch((err) => {
        console.warn('SW registration failed:', err);
      });

    // When the controlling SW changes (after skipWaiting), reload page
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }, []);

  /** Tell waiting SW to skipWaiting → triggers controllerchange → page reloads */
  const activateUpdate = useCallback(() => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
  }, [waitingWorker]);

  return { updateAvailable, activateUpdate };
}
