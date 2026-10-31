'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { FiArrowRight, FiX } from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';
import LottiePlayer from '@/components/common/LottiePlayer';
import pigeonAnimation from '@/public/animations/pigeon.json';
import {
  DEFAULT_WELCOME_SETTINGS,
  WelcomeSettings,
  getCachedWelcomeSettings,
} from '@/lib/welcome/welcomeConfig';

interface FirstTimeWelcomeModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  isPreview?: boolean;
  customConfig?: Partial<WelcomeSettings> | null;
  userName?: string | null;
}

export default function FirstTimeWelcomeModal({
  isOpen = true,
  onClose,
  isPreview = false,
  customConfig = null,
  userName = null,
}: FirstTimeWelcomeModalProps) {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(isOpen);
  const [progress, setProgress] = useState(0);

  const config = useMemo(() => {
    return {
      ...DEFAULT_WELCOME_SETTINGS,
      ...getCachedWelcomeSettings(),
      ...(customConfig || {}),
    };
  }, [customConfig]);

  const durationSec = Math.max(2, Number(config.autoTransitionDuration) || 5);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    if (onClose) {
      onClose();
    } else if (!isPreview) {
      router.push('/');
    }
  }, [onClose, isPreview, router]);

  // Handle auto-transition countdown
  useEffect(() => {
    if (!isVisible || !config.autoTransitionEnabled) return;

    const intervalMs = 50;
    const step = (intervalMs / (durationSec * 1000)) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev + step >= 100) {
          clearInterval(timer);
          return 100;
        }
        return prev + step;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isVisible, config.autoTransitionEnabled, durationSec]);

  useEffect(() => {
    if (isVisible && config.autoTransitionEnabled && progress >= 100) {
      handleDismiss();
    }
  }, [isVisible, config.autoTransitionEnabled, progress, handleDismiss]);

  useEffect(() => {
    setIsVisible(isOpen);
    if (isOpen) {
      setProgress(0);
    }
  }, [isOpen]);

  if (!isVisible) return null;

  const displayName = userName?.trim() || '';

  return (
    <AnimatePresence>
      <motion.div
        key="welcome-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden bg-slate-950/95 px-4 text-white backdrop-blur-2xl"
      >
        {/* Ambient atmospheric glowing orbs */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-red-600/25 via-rose-500/15 to-transparent blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-gradient-to-tl from-indigo-600/25 via-purple-500/15 to-transparent blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[350px] w-[350px] rounded-full bg-rose-500/10 blur-3xl"
        />

        {/* Close button for Preview Mode */}
        {isPreview && (
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Đóng xem trước"
            className="absolute top-6 right-6 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/80 backdrop-blur-md transition-all hover:scale-105 hover:bg-white/20 hover:text-white active:scale-95 z-50"
          >
            <FiX size={20} />
          </button>
        )}

        <div className="relative z-10 mx-auto flex w-full max-w-xl flex-col items-center text-center">
          {/* Animated Pigeon Character */}
          <motion.div
            initial={{ scale: 0.4, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex items-center justify-center select-none"
          >
            {/* Pulsing light ring behind pigeon */}
            <motion.div
              animate={{
                scale: [1, 1.25, 1],
                opacity: [0.35, 0.65, 0.35],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -inset-4 rounded-full bg-gradient-to-r from-red-500/30 via-rose-400/20 to-amber-400/30 blur-2xl pointer-events-none"
            />

            <div className="relative h-56 w-56 sm:h-64 sm:w-64 filter drop-shadow-[0_20px_35px_rgba(244,63,94,0.35)]">
              <LottiePlayer
                animationData={pigeonAnimation}
                loop={true}
                autoplay={true}
                className="h-full w-full"
              />
            </div>
          </motion.div>

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: 'easeOut' }}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-rose-400/30 bg-rose-500/10 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.2)] backdrop-blur-md"
          >
            <HiSparkles className="text-rose-400 animate-pulse" />
            <span>{config.badge}</span>
          </motion.div>

          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45, ease: 'easeOut' }}
            className="mt-5 text-2xl font-black tracking-tight sm:text-3xl md:text-4xl leading-tight"
          >
            {displayName ? (
              <>
                Chào mừng <span className="bg-gradient-to-r from-rose-400 via-amber-200 to-rose-400 bg-clip-text text-transparent">{displayName}</span>
                <br />
                đến với CSCA MOLI.STUDIO!
              </>
            ) : (
              config.title
            )}
          </motion.h1>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6, ease: 'easeOut' }}
            className="mt-3.5 max-w-md text-sm text-slate-300 sm:text-base leading-relaxed"
          >
            {config.description}
          </motion.p>

          {/* Action Button */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.75, ease: 'easeOut' }}
            className="mt-8 flex flex-col items-center gap-3 w-full sm:w-auto"
          >
            <button
              type="button"
              onClick={handleDismiss}
              className="group relative inline-flex items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-500 px-8 py-3.5 text-sm sm:text-base font-extrabold text-white shadow-[0_8px_25px_rgba(225,29,72,0.4)] transition-all duration-200 hover:scale-105 hover:shadow-[0_12px_32px_rgba(225,29,72,0.6)] active:scale-95"
            >
              <span>{config.buttonText}</span>
              <FiArrowRight className="transition-transform group-hover:translate-x-1" />
            </button>

            {/* Auto transition indicator */}
            {config.autoTransitionEnabled && (
              <div className="flex flex-col items-center gap-1.5 pt-1">
                <span className="text-[11px] font-medium text-slate-400">
                  Tự động chuyển về trang chủ...
                </span>
                <div className="h-1 w-36 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-rose-500 to-amber-300 transition-all duration-75"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
