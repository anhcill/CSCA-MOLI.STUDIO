'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { FiCheck, FiChevronLeft, FiChevronRight, FiRefreshCw, FiRotateCcw, FiVolume2, FiX } from 'react-icons/fi';
import { vocabularyReviewApi, type VocabularyReviewFilters } from '@/lib/api/vocabulary';
import type { VocabularyReviewCard } from '@/lib/types/vocabulary';
import { useLanguage } from '@/context/LanguageContext';

interface Props {
  filters: VocabularyReviewFilters;
  onReviewed?: () => void;
}

const QUALITY_BUTTONS = [
  { quality: 1, labelKey: 'vocab.wrong', icon: FiX, className: 'border-rose-200 text-rose-700 hover:bg-rose-50' },
  { quality: 3, labelKey: 'vocab.hard', icon: FiRotateCcw, className: 'border-amber-200 text-amber-700 hover:bg-amber-50' },
  { quality: 5, labelKey: 'vocab.remembered', icon: FiCheck, className: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' },
];

export default function FlashcardSession({ filters, onReviewed }: Props) {
  const { language, t } = useLanguage();
  const [cards, setCards] = useState<VocabularyReviewCard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [speechError, setSpeechError] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const dragStartX = useRef<number | null>(null);
  const dragOffsetRef = useRef(0);
  const suppressNextClick = useRef(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speechRequestRef = useRef(0);

  const current = cards[index];
  const primaryMeaning = current ? (language === 'en' && current.word_en ? current.word_en : current.word_vn) : '';
  const secondaryMeaning = current ? (language === 'en' ? current.word_vn : current.word_en) : '';

  const getChineseVoice = useCallback((voices: SpeechSynthesisVoice[]) => (
    voices.find((voice) => voice.lang.toLowerCase() === 'zh-cn') ||
    voices.find((voice) => voice.lang.toLowerCase().startsWith('zh')) ||
    voices.find((voice) => /chinese|mandarin|普通话|中文/i.test(voice.name))
  ), []);

  const loadSpeechVoices = useCallback(() => new Promise<SpeechSynthesisVoice[]>((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve([]);
      return;
    }

    const synth = window.speechSynthesis;
    const readyVoices = synth.getVoices();
    if (readyVoices.length) {
      resolve(readyVoices);
      return;
    }

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      synth.removeEventListener('voiceschanged', finish);
      resolve(synth.getVoices());
    };

    synth.addEventListener('voiceschanged', finish);
    window.setTimeout(finish, 900);
  }), []);

  const stopSpeech = useCallback(() => {
    speechRequestRef.current += 1;
    utteranceRef.current = null;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }, []);

  const speakChinese = useCallback(async (text: string) => {
    if (!text) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      setSpeechError(t('vocab.speechUnsupported'));
      return;
    }

    const synth = window.speechSynthesis;
    const requestId = speechRequestRef.current + 1;
    speechRequestRef.current = requestId;
    synth.cancel();
    synth.resume();
    const voices = await loadSpeechVoices();
    if (speechRequestRef.current !== requestId) return;
    synth.resume();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.85;
    utterance.pitch = 1;

    const chineseVoice = getChineseVoice(voices);
    if (chineseVoice) {
      utterance.voice = chineseVoice;
    }

    utterance.onstart = () => {
      setSpeaking(true);
      setSpeechError('');
    };
    utterance.onend = () => {
      if (speechRequestRef.current !== requestId) return;
      if (utteranceRef.current === utterance) {
        utteranceRef.current = null;
      }
      setSpeaking(false);
    };
    utterance.onerror = (event) => {
      if (speechRequestRef.current !== requestId) return;
      if (utteranceRef.current === utterance) {
        utteranceRef.current = null;
      }
      setSpeaking(false);
      if (event.error !== 'canceled' && event.error !== 'interrupted') {
        setSpeechError(t('vocab.speechFailed'));
      }
    };

    utteranceRef.current = utterance;
    setSpeechError('');
    setSpeaking(true);
    synth.speak(utterance);

    window.setTimeout(() => {
      if (speechRequestRef.current !== requestId) return;
      if (synth.paused) synth.resume();
    }, 120);
  }, [getChineseVoice, loadSpeechVoices, t]);

  useEffect(() => {
    if (!autoSpeak || !current?.word_cn) return;

    const timer = window.setTimeout(() => {
      void speakChinese(current.word_cn);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [autoSpeak, current?.id, current?.word_cn, speakChinese]);

  useEffect(() => () => {
    speechRequestRef.current += 1;
    utteranceRef.current = null;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const goToCard = (nextIndex: number) => {
    const boundedIndex = Math.max(0, Math.min(nextIndex, cards.length - 1));
    if (boundedIndex === index) return;
    stopSpeech();
    setSpeechError('');
    setIndex(boundedIndex);
    setFlipped(false);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!current || saving) return;
    dragStartX.current = event.clientX;
    dragOffsetRef.current = 0;
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStartX.current === null) return;
    const nextOffset = event.clientX - dragStartX.current;
    dragOffsetRef.current = nextOffset;
    setDragOffset(nextOffset);
    if (Math.abs(nextOffset) > 8) {
      suppressNextClick.current = true;
    }
  };

  const finishDrag = () => {
    if (dragStartX.current === null) return;

    const threshold = 80;
    const finalOffset = dragOffsetRef.current;
    if (finalOffset <= -threshold && index < cards.length - 1) {
      goToCard(index + 1);
    } else if (finalOffset >= threshold && index > 0) {
      goToCard(index - 1);
    }

    dragStartX.current = null;
    dragOffsetRef.current = 0;
    setIsDragging(false);
    setDragOffset(0);
  };

  const handleCardClick = () => {
    if (suppressNextClick.current) {
      suppressNextClick.current = false;
      return;
    }
    setFlipped((value) => !value);
  };

  const startSession = async () => {
    try {
      setLoading(true);
      setError('');
      setSpeechError('');
      stopSpeech();
      const queue = await vocabularyReviewApi.getQueue({ ...filters, limit: 20 });
      setCards(queue);
      setIndex(0);
      setFlipped(false);
    } catch (err: any) {
      setError(err.response?.status === 401 ? t('vocab.loginRequiredFlashcard') : t('vocab.loadFlashcardError'));
    } finally {
      setLoading(false);
    }
  };

  const submitQuality = async (quality: number) => {
    if (!current) return;
    try {
      setSaving(true);
      stopSpeech();
      await vocabularyReviewApi.recordReview(current.id, quality);
      onReviewed?.();
      if (index + 1 >= cards.length) {
        setCards([]);
        setIndex(0);
      } else {
        setIndex((value) => value + 1);
      }
      setSpeechError('');
      setFlipped(false);
    } catch (err) {
      setError(t('vocab.saveReviewError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-white rounded-2xl border border-cyan-100 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-black text-gray-900">{t('vocab.flashcardTitle')}</h2>
          <p className="text-sm text-gray-500">{t('vocab.flashcardDesc')}</p>
        </div>
        <label className="inline-flex items-center gap-2 rounded-xl border border-cyan-100 px-3 py-2 text-sm font-bold text-gray-600">
          <input
            type="checkbox"
            checked={autoSpeak}
            onChange={(event) => {
              const nextAutoSpeak = event.target.checked;
              setAutoSpeak(nextAutoSpeak);
              if (!nextAutoSpeak) stopSpeech();
            }}
            className="h-4 w-4 accent-cyan-600"
          />
          {t('vocab.autoSpeak')}
        </label>
        <button
          onClick={startSession}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-xl font-bold text-sm hover:bg-cyan-700 disabled:opacity-60"
        >
          <FiRefreshCw className={loading ? 'animate-spin' : ''} />
          {t('vocab.start')}
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{error}</p>}

      {current ? (
        <>
          <div
            role="button"
            tabIndex={0}
            onClick={handleCardClick}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleCardClick();
              }
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
            onPointerLeave={finishDrag}
            style={{
              transform: `translateX(${dragOffset}px) rotate(${dragOffset / 28}deg)`,
              touchAction: 'pan-y',
            }}
            className={`w-full min-h-[240px] sm:min-h-[260px] rounded-2xl border-2 border-cyan-100 bg-gradient-to-br from-cyan-50 to-blue-50 p-4 sm:p-6 text-center hover:border-cyan-300 select-none ${
              isDragging ? 'cursor-grabbing transition-none' : 'cursor-pointer transition-all'
            }`}
          >
            {!flipped ? (
              <div className="flex min-h-[200px] sm:min-h-[210px] flex-col items-center justify-center">
                <p className="text-sm font-bold text-cyan-700 mb-3">{current.topic}</p>
                <p className="text-5xl font-black text-gray-950 leading-tight sm:text-6xl">{current.word_cn}</p>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void speakChinese(current.word_cn);
                  }}
                  onKeyDown={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerUp={(event) => event.stopPropagation()}
                  className={`mt-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-200 bg-white text-cyan-700 shadow-sm hover:bg-cyan-50 ${speaking ? 'animate-pulse' : ''}`}
                  title={speaking ? t('vocab.speaking') : t('vocab.speak')}
                  aria-label={t('vocab.speak')}
                >
                  <FiVolume2 />
                </button>
                {speechError && <p className="mt-3 text-xs font-semibold text-amber-700">{speechError}</p>}
                <p className="mt-5 text-sm text-gray-500">{t('vocab.flipHint')}</p>
              </div>
            ) : (
              <div className="flex min-h-[200px] sm:min-h-[210px] flex-col items-center justify-center">
                <div className="flex items-center justify-center gap-3">
                  <p className="text-xl font-black text-cyan-700 italic sm:text-2xl">{current.pinyin}</p>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void speakChinese(current.word_cn);
                    }}
                    onKeyDown={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                    onPointerUp={(event) => event.stopPropagation()}
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-200 bg-white text-cyan-700 shadow-sm hover:bg-cyan-50 ${speaking ? 'animate-pulse' : ''}`}
                    title={speaking ? t('vocab.speaking') : t('vocab.speak')}
                    aria-label={t('vocab.speak')}
                  >
                    <FiVolume2 />
                  </button>
                </div>
                {speechError && <p className="mt-3 text-xs font-semibold text-amber-700">{speechError}</p>}
                <p className="mt-4 text-xl font-bold text-gray-900 sm:text-2xl">{primaryMeaning}</p>
                {secondaryMeaning && <p className="mt-1 text-sm text-gray-500">{secondaryMeaning}</p>}
                {current.example_cn && (
                  <div className="mt-5 max-w-xl border-t border-cyan-100 pt-4">
                    <p className="text-sm font-semibold text-gray-800">{current.example_cn}</p>
                    {current.example_vn && <p className="text-sm text-gray-500 mt-1">{current.example_vn}</p>}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-gray-500">
              {index + 1}/{cards.length} - {current.review_state === 'new' ? t('vocab.newWord') : t('vocab.dueReview')}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goToCard(index - 1)}
                disabled={index === 0 || saving}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-100 text-cyan-700 hover:bg-cyan-50 disabled:opacity-35"
                title={t('vocab.previousCard')}
              >
                <FiChevronLeft />
              </button>
              <button
                type="button"
                onClick={() => goToCard(index + 1)}
                disabled={index >= cards.length - 1 || saving}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-100 text-cyan-700 hover:bg-cyan-50 disabled:opacity-35"
                title={t('vocab.nextCard')}
              >
                <FiChevronRight />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {QUALITY_BUTTONS.map(({ quality, labelKey, icon: Icon, className }) => (
                <button
                  key={quality}
                  onClick={() => submitQuality(quality)}
                  disabled={saving}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border font-bold text-sm disabled:opacity-40 ${className}`}
                >
                  <Icon /> {t(labelKey)}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-cyan-200 bg-cyan-50/50 py-12 text-center">
          <p className="font-bold text-gray-800">{t('vocab.noSession')}</p>
          <p className="text-sm text-gray-500 mt-1">{t('vocab.startHint')}</p>
        </div>
      )}
    </section>
  );
}
