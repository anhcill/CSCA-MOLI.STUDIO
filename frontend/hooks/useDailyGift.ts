'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from '@/lib/utils/axios';

export interface DailyGiftLetter {
  id: number;
  gift_date: string;
  title: string;
  greeting: string;
  encouragement: string;
  study_reminder: string;
  blessing: string;
  mood?: string | null;
  source_model?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface DailyGiftResponse {
  success: boolean;
  data?: {
    letter: DailyGiftLetter;
    giftDate: string;
    openedToday: boolean;
  };
}

const STORAGE_PREFIX = 'daily_gift_letter_opened';

function getVietnamDateKey(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function getStorageKey(dateKey: string) {
  return `${STORAGE_PREFIX}:${dateKey}`;
}

function getLocalOpened(dateKey: string) {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(getStorageKey(dateKey)) === '1';
}

function setLocalOpened(dateKey: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(getStorageKey(dateKey), '1');
}

export function useDailyGift(enabled = true) {
  const todayKey = useMemo(() => getVietnamDateKey(), []);
  const [letter, setLetter] = useState<DailyGiftLetter | null>(null);
  const [giftDate, setGiftDate] = useState(todayKey);
  const [openedToday, setOpenedToday] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const localOpened = getLocalOpened(todayKey);
    setOpenedToday(localOpened);

    if (localOpened) return;

    setLoading(true);
    setError(null);

    axios.get<DailyGiftResponse>('/ai/daily-gift-letter')
      .then(({ data }) => {
        if (cancelled || !data?.success || !data.data?.letter) return;
        const nextDate = data.data.giftDate || data.data.letter.gift_date || todayKey;
        const isOpened = data.data.openedToday || getLocalOpened(nextDate);
        setGiftDate(nextDate);
        setLetter(data.data.letter);
        setOpenedToday(isOpened);
        if (isOpened) setLocalOpened(nextDate);
      })
      .catch(() => {
        if (!cancelled) setError('Không tải được quà hôm nay.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, todayKey]);

  const markOpened = useCallback(async () => {
    setLocalOpened(giftDate);
    setOpenedToday(true);
    setAccepting(true);

    try {
      await axios.post('/ai/daily-gift-letter/open');
    } catch {
      // Local state still hides the claimed gift for this browser today.
    } finally {
      setAccepting(false);
    }
  }, [giftDate]);

  return {
    letter,
    giftDate,
    openedToday,
    loading,
    accepting,
    error,
    shouldShow: enabled && Boolean(letter) && !openedToday,
    markOpened,
  };
}
