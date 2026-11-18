'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiEye,
  FiEyeOff,
  FiRotateCcw,
  FiShuffle,
  FiVolume2,
} from 'react-icons/fi';
import type { ExternalUnitVocabularyDto } from '@/lib/types/courses';
import { useChineseSpeech } from '@/lib/utils/chineseSpeech';

interface ExternalVocabFlashcardDeckProps {
  vocabulary: ExternalUnitVocabularyDto[];
}

export function ExternalVocabFlashcardDeck({ vocabulary }: ExternalVocabFlashcardDeckProps) {
  const [orderedIds, setOrderedIds] = useState<string[]>(() =>
    vocabulary.map((item, idx) => String(item.id || `${item.term}-${idx}`)),
  );
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showPinyinFront, setShowPinyinFront] = useState(true);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [filterMode, setFilterMode] = useState<'all' | 'review'>('all');
  const [knownIds, setKnownIds] = useState<Record<string, boolean>>({});
  const { isSpeaking, speechError, speak, stop } = useChineseSpeech();
  const lastAutoSpokenKeyRef = useRef<string | null>(null);

  const itemByKey = useMemo(() => {
    const map = new Map<string, ExternalUnitVocabularyDto>();
    vocabulary.forEach((item, idx) => {
      map.set(String(item.id || `${item.term}-${idx}`), item);
    });
    return map;
  }, [vocabulary]);

  useEffect(() => {
    setOrderedIds(vocabulary.map((item, idx) => String(item.id || `${item.term}-${idx}`)));
    setIndex(0);
    setFlipped(false);
    setKnownIds({});
    lastAutoSpokenKeyRef.current = null;
  }, [vocabulary]);

  const deckKeys = useMemo(() => {
    const existing = orderedIds.filter((k) => itemByKey.has(k));
    if (filterMode === 'review') {
      const needReview = existing.filter((k) => !knownIds[k]);
      return needReview.length > 0 ? needReview : existing;
    }
    return existing;
  }, [filterMode, itemByKey, knownIds, orderedIds]);

  const safeIndex = deckKeys.length > 0 ? Math.min(index, deckKeys.length - 1) : 0;
  const currentKey = deckKeys[safeIndex] || null;
  const currentCard = currentKey ? itemByKey.get(currentKey) || null : null;

  const knownCount = useMemo(
    () => orderedIds.filter((k) => knownIds[k]).length,
    [knownIds, orderedIds],
  );

  const speakCurrentCard = useCallback((card: ExternalUnitVocabularyDto | null, cardKey?: string | null) => {
    if (!card) return;
    void speak({
      key: cardKey || card.id || card.term,
      text: card.term,
      audioUrl: card.audioUrl,
      rate: 0.85,
    });
  }, [speak]);

  useEffect(() => {
    if (!autoSpeak || !currentCard || !currentKey) return undefined;
    const speakToken = `${currentKey}::${currentCard.term}`;
    if (lastAutoSpokenKeyRef.current === speakToken) return undefined;

    const timer = window.setTimeout(() => {
      lastAutoSpokenKeyRef.current = speakToken;
      speakCurrentCard(currentCard, currentKey);
    }, 180);

    return () => window.clearTimeout(timer);
  }, [autoSpeak, currentCard, currentKey, speakCurrentCard]);

  useEffect(() => () => stop(), [stop]);

  const goPrev = useCallback(() => {
    if (!deckKeys.length) return;
    lastAutoSpokenKeyRef.current = null;
    setFlipped(false);
    setIndex((curr) => (curr - 1 + deckKeys.length) % deckKeys.length);
  }, [deckKeys.length]);

  const goNext = useCallback(() => {
    if (!deckKeys.length) return;
    lastAutoSpokenKeyRef.current = null;
    setFlipped(false);
    setIndex((curr) => (curr + 1) % deckKeys.length);
  }, [deckKeys.length]);

  const handleShuffle = () => {
    const next = [...orderedIds];
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    lastAutoSpokenKeyRef.current = null;
    setOrderedIds(next);
    setIndex(0);
    setFlipped(false);
  };

  const markCard = (learned: boolean) => {
    if (!currentKey) return;
    setKnownIds((prev) => ({ ...prev, [currentKey]: learned }));
    if (deckKeys.length > 1) {
      lastAutoSpokenKeyRef.current = null;
      setFlipped(false);
      setIndex((curr) => (curr + 1) % deckKeys.length);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        setFlipped((v) => !v);
      } else if (event.key === 'ArrowRight') {
        goNext();
      } else if (event.key === 'ArrowLeft') {
        goPrev();
      } else if (event.key.toLowerCase() === 's' || event.key.toLowerCase() === 'r') {
        event.preventDefault();
        speakCurrentCard(currentCard, currentKey);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentCard, currentKey, goNext, goPrev, speakCurrentCard]);

  if (!currentCard || !currentKey) {
    return <p className="text-slate-500 dark:text-slate-400">Chưa có từ vựng để ôn tập Flashcard.</p>;
  }

  const pct = orderedIds.length > 0 ? Math.round((knownCount / orderedIds.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#e3d4c5] bg-[#fffdf9] px-4 py-3 dark:border-[#2d3b52] dark:bg-[#101e33]">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-[#ad2033]/10 px-3 py-1 font-black text-[#ad2033] dark:text-[#f08d9c]">
            Thẻ {safeIndex + 1} / {deckKeys.length}
          </span>
          <span className="rounded-full bg-emerald-100 px-3 py-1 font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            Đã nhớ {knownCount}/{orderedIds.length} ({pct}%)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setFilterMode((m) => (m === 'all' ? 'review' : 'all'));
              lastAutoSpokenKeyRef.current = null;
              setIndex(0);
              setFlipped(false);
            }}
            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${
              filterMode === 'review'
                ? 'border-amber-500 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200'
                : 'border-[#d8c8b9] bg-white text-[#29354b] dark:border-[#34435a] dark:bg-[#0b172b] dark:text-slate-200'
            }`}
          >
            {filterMode === 'review' ? 'Đang lọc: Cần ôn' : 'Tất cả thẻ'}
          </button>
          <button
            type="button"
            onClick={() => setShowPinyinFront((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg border border-[#d8c8b9] bg-white px-2.5 py-1.5 text-xs font-bold text-[#29354b] hover:bg-slate-50 dark:border-[#34435a] dark:bg-[#0b172b] dark:text-slate-200"
          >
            {showPinyinFront ? <FiEye /> : <FiEyeOff />}
            Pinyin
          </button>
          <button
            type="button"
            onClick={() => {
              const nextAuto = !autoSpeak;
              setAutoSpeak(nextAuto);
              if (nextAuto) {
                lastAutoSpokenKeyRef.current = `${currentKey}::${currentCard.term}`;
                speakCurrentCard(currentCard, currentKey);
              } else {
                stop();
              }
            }}
            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${
              autoSpeak
                ? 'border-[#247d7e] bg-[#247d7e] text-white'
                : 'border-[#d8c8b9] bg-white text-[#29354b] dark:border-[#34435a] dark:bg-[#0b172b] dark:text-slate-200'
            }`}
          >
            <FiVolume2 /> Tự động phát âm: {autoSpeak ? 'Bật' : 'Tắt'}
          </button>
          <button
            type="button"
            onClick={handleShuffle}
            className="inline-flex items-center gap-1 rounded-lg border border-[#d8c8b9] bg-white px-2.5 py-1.5 text-xs font-bold text-[#29354b] hover:bg-slate-50 dark:border-[#34435a] dark:bg-[#0b172b] dark:text-slate-200"
          >
            <FiShuffle /> Xáo trộn
          </button>
          <button
            type="button"
            onClick={() => speakCurrentCard(currentCard, currentKey)}
            aria-label={`Phát âm ${currentCard.term}`}
            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${
              isSpeaking
                ? 'border-[#247d7e] bg-[#247d7e] text-white'
                : 'border-[#247d7e]/40 bg-[#eff9f7] text-[#247d7e] hover:bg-[#dff4f0] dark:border-[#49b6ac]/40 dark:bg-[#132c3d] dark:text-[#6ac6bd]'
            }`}
          >
            <FiVolume2 /> {isSpeaking ? 'Đang đọc...' : 'Phát âm'}
          </button>
        </div>
      </div>

      {speechError ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          {speechError}
        </p>
      ) : null}

      <div className="h-2 w-full overflow-hidden rounded-full bg-[#efe4d8] dark:bg-[#1d2d45]">
        <div
          className="h-full rounded-full bg-[#247d7e] transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => setFlipped((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setFlipped((v) => !v);
          }
        }}
        className="relative flex min-h-72 w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-[#dfd0c2] bg-gradient-to-br from-[#fffdf9] to-[#f8efe6] p-6 text-center shadow-sm transition hover:border-[#247d7e] dark:border-[#34435a] dark:from-[#101e33] dark:to-[#081326] dark:hover:border-[#49b6ac] sm:p-10"
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            speakCurrentCard(currentCard, currentKey);
          }}
          aria-label={`Nghe phát âm ${currentCard.term}`}
          className={`absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
            isSpeaking
              ? 'border-[#247d7e] bg-[#247d7e] text-white'
              : 'border-[#d8c8b9] bg-white/90 text-[#247d7e] hover:bg-[#eff9f7] dark:border-[#34435a] dark:bg-[#0b172b]'
          }`}
        >
          <FiVolume2 /> {isSpeaking ? 'Đang phát...' : 'Nghe (S)'}
        </button>

        {!flipped ? (
          <div className="space-y-3">
            <span className="inline-block rounded-full bg-[#ad2033]/10 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[#ad2033] dark:text-[#f08d9c]">
              Mặt trước · Chạm hoặc nhấn Space để lật
            </span>
            <p className="text-4xl font-black tracking-wide text-[#18243b] dark:text-white sm:text-5xl">
              {currentCard.term}
            </p>
            {showPinyinFront && currentCard.pinyin ? (
              <p className="text-lg font-bold text-[#247d7e] dark:text-[#6ac6bd]">{currentCard.pinyin}</p>
            ) : null}
            {currentCard.partOfSpeech ? (
              <span className="inline-block rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {currentCard.partOfSpeech}
              </span>
            ) : null}
          </div>
        ) : (
          <div className="max-w-xl space-y-3">
            <span className="inline-block rounded-full bg-[#247d7e]/15 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[#247d7e] dark:text-[#6ac6bd]">
              Nghĩa & Ví dụ
            </span>
            <p className="text-xl font-black text-[#18243b] dark:text-white">
              {currentCard.term}
              {currentCard.pinyin ? <span className="ml-2 text-base font-bold text-[#247d7e] dark:text-[#6ac6bd]">({currentCard.pinyin})</span> : null}
            </p>
            {currentCard.sinoVietnamese ? (
              <p className="text-xs font-bold text-amber-700 dark:text-amber-300">Hán Việt: {currentCard.sinoVietnamese}</p>
            ) : null}
            <p className="text-lg font-bold text-[#2a364e] dark:text-slate-100">{currentCard.meaning}</p>
            {currentCard.exampleSentence ? (
              <div className="mt-3 rounded-xl border border-[#e3d4c5] bg-white/80 p-3.5 text-left text-xs dark:border-[#2d3b52] dark:bg-[#0b172b]/80">
                <p className="font-bold text-[#1e2b44] dark:text-slate-100">{currentCard.exampleSentence}</p>
                {currentCard.exampleMeaning ? (
                  <p className="mt-1 text-[#6f665f] dark:text-slate-400">{currentCard.exampleMeaning}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#d8c8b9] bg-white px-4 py-2 text-xs font-black text-[#29354b] transition hover:bg-slate-50 dark:border-[#34435a] dark:bg-[#101e33] dark:text-slate-200"
          >
            <FiChevronLeft /> Thẻ trước
          </button>
          <button
            type="button"
            onClick={goNext}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#d8c8b9] bg-white px-4 py-2 text-xs font-black text-[#29354b] transition hover:bg-slate-50 dark:border-[#34435a] dark:bg-[#101e33] dark:text-slate-200"
          >
            Thẻ sau <FiChevronRight />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => markCard(false)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-black text-amber-800 transition hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
          >
            <FiRotateCcw /> Cần ôn lại
          </button>
          <button
            type="button"
            onClick={() => markCard(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700"
          >
            <FiCheck /> Đã nhớ
          </button>
        </div>
      </div>
    </div>
  );
}
