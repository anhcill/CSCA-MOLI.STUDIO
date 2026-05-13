'use client';

import { useRef, useState, type PointerEvent } from 'react';
import { FiCheck, FiChevronLeft, FiChevronRight, FiRefreshCw, FiRotateCcw, FiX } from 'react-icons/fi';
import { vocabularyReviewApi, type VocabularyReviewFilters } from '@/lib/api/vocabulary';
import type { VocabularyReviewCard } from '@/lib/types/vocabulary';

interface Props {
  filters: VocabularyReviewFilters;
  onReviewed?: () => void;
}

const QUALITY_BUTTONS = [
  { quality: 1, label: 'Sai', icon: FiX, className: 'border-rose-200 text-rose-700 hover:bg-rose-50' },
  { quality: 3, label: 'Khó nhớ', icon: FiRotateCcw, className: 'border-amber-200 text-amber-700 hover:bg-amber-50' },
  { quality: 5, label: 'Đã nhớ', icon: FiCheck, className: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' },
];

export default function FlashcardSession({ filters, onReviewed }: Props) {
  const [cards, setCards] = useState<VocabularyReviewCard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef<number | null>(null);
  const dragOffsetRef = useRef(0);
  const suppressNextClick = useRef(false);

  const current = cards[index];

  const goToCard = (nextIndex: number) => {
    const boundedIndex = Math.max(0, Math.min(nextIndex, cards.length - 1));
    if (boundedIndex === index) return;
    setIndex(boundedIndex);
    setFlipped(false);
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (!current || saving) return;
    dragStartX.current = event.clientX;
    dragOffsetRef.current = 0;
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
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
      const queue = await vocabularyReviewApi.getQueue({ ...filters, limit: 20 });
      setCards(queue);
      setIndex(0);
      setFlipped(false);
    } catch (err: any) {
      setError(err.response?.status === 401 ? 'Đăng nhập để dùng flashcard.' : 'Không tải được flashcard.');
    } finally {
      setLoading(false);
    }
  };

  const submitQuality = async (quality: number) => {
    if (!current) return;
    try {
      setSaving(true);
      await vocabularyReviewApi.recordReview(current.id, quality);
      onReviewed?.();
      if (index + 1 >= cards.length) {
        setCards([]);
        setIndex(0);
      } else {
        setIndex((value) => value + 1);
      }
      setFlipped(false);
    } catch (err) {
      setError('Không lưu được kết quả ôn tập.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-white rounded-2xl border border-cyan-100 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-black text-gray-900">Flashcard</h2>
          <p className="text-sm text-gray-500">Lật thẻ Hán tự, pinyin, nghĩa</p>
        </div>
        <button
          onClick={startSession}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-xl font-bold text-sm hover:bg-cyan-700 disabled:opacity-60"
        >
          <FiRefreshCw className={loading ? 'animate-spin' : ''} />
          Bắt đầu
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{error}</p>}

      {current ? (
        <>
          <button
            onClick={handleCardClick}
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
                <p className="mt-5 text-sm text-gray-500">Nhấn để lật thẻ</p>
              </div>
            ) : (
              <div className="flex min-h-[200px] sm:min-h-[210px] flex-col items-center justify-center">
                <p className="text-xl font-black text-cyan-700 italic sm:text-2xl">{current.pinyin}</p>
                <p className="mt-4 text-xl font-bold text-gray-900 sm:text-2xl">{current.word_vn}</p>
                {current.word_en && <p className="mt-1 text-sm text-gray-500">{current.word_en}</p>}
                {current.example_cn && (
                  <div className="mt-5 max-w-xl border-t border-cyan-100 pt-4">
                    <p className="text-sm font-semibold text-gray-800">{current.example_cn}</p>
                    {current.example_vn && <p className="text-sm text-gray-500 mt-1">{current.example_vn}</p>}
                  </div>
                )}
              </div>
            )}
          </button>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-gray-500">
              {index + 1}/{cards.length} - {current.review_state === 'new' ? 'Từ mới' : 'Đến lịch ôn'}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goToCard(index - 1)}
                disabled={index === 0 || saving}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-100 text-cyan-700 hover:bg-cyan-50 disabled:opacity-35"
                title="The truoc"
              >
                <FiChevronLeft />
              </button>
              <button
                type="button"
                onClick={() => goToCard(index + 1)}
                disabled={index >= cards.length - 1 || saving}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-100 text-cyan-700 hover:bg-cyan-50 disabled:opacity-35"
                title="The tiep theo"
              >
                <FiChevronRight />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {QUALITY_BUTTONS.map(({ quality, label, icon: Icon, className }) => (
                <button
                  key={quality}
                  onClick={() => submitQuality(quality)}
                  disabled={!flipped || saving}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border font-bold text-sm disabled:opacity-40 ${className}`}
                >
                  <Icon /> {label}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-cyan-200 bg-cyan-50/50 py-12 text-center">
          <p className="font-bold text-gray-800">Chưa có phiên flashcard</p>
          <p className="text-sm text-gray-500 mt-1">Bấm Bắt đầu để lấy từ mới và từ đến lịch ôn.</p>
        </div>
      )}
    </section>
  );
}

