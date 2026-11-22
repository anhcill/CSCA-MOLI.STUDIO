'use client';

import { useEffect, useState } from 'react';
import coursesApi from '@/lib/api/courses';
import type { CourseReviewsDto } from '@/lib/types/courses';

export function CourseReviews({ slug, onRatingChange }: { slug: string; onRatingChange?: (avg: number, count: number) => void }) {
  const [reviews, setReviews] = useState<CourseReviewsDto | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    coursesApi.getReviews(slug).then((data) => {
      if (!active) return;
      setReviews(data);
      setRating(data.myReview?.rating ?? 5);
      setComment(data.myReview?.comment ?? '');
    }).catch(() => active && setError('Chưa tải được đánh giá. Vui lòng thử lại sau.'));
    return () => { active = false; };
  }, [slug]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const updated = await coursesApi.saveReview(slug, rating, comment);
      setReviews(await coursesApi.getReviews(slug));
      onRatingChange?.(updated.ratingAvg, updated.ratingCount);
    } catch {
      setError('Không thể lưu đánh giá. Vui lòng kiểm tra quyền học và thử lại.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
    <h2 className="text-2xl font-black text-slate-950 dark:text-white">Đánh giá khóa học</h2>
    <div className="mt-3 flex items-center gap-3 text-amber-500" aria-label={reviews?.ratingCount ? `${reviews.ratingAvg.toFixed(1)} trên 5 sao` : 'Chưa có đánh giá'}>
      <span className="text-2xl tracking-wide">{Array.from({ length: 5 }, (_, i) => i < Math.round(reviews?.ratingAvg ?? 0) ? '★' : '☆').join('')}</span>
      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{reviews?.ratingCount ? `${reviews.ratingAvg.toFixed(1)}/5 · ${reviews.ratingCount} đánh giá` : 'Chưa có đánh giá'}</span>
    </div>
    {reviews?.canReview ? <form onSubmit={submit} className="mt-6 space-y-3">
      <p className="font-bold text-slate-800 dark:text-slate-100">{reviews.myReview ? 'Sửa đánh giá của bạn' : 'Đánh giá của bạn'}</p>
      <div role="radiogroup" aria-label="Số sao" className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" role="radio" aria-checked={rating === star} aria-label={`${star} sao`} onClick={() => setRating(star)} className="text-3xl text-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">{star <= rating ? '★' : '☆'}</button>)}
      </div>
      <textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={2000} rows={3} placeholder="Chia sẻ trải nghiệm học của bạn (không bắt buộc)" className="w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
      <button disabled={busy} className="rounded-xl bg-indigo-700 px-5 py-2.5 font-bold text-white disabled:opacity-50">{busy ? 'Đang lưu...' : 'Gửi đánh giá'}</button>
    </form> : null}
    {error ? <p role="alert" className="mt-3 text-sm text-red-600">{error}</p> : null}
    <div className="mt-6 space-y-4">{reviews?.items.map((review, index) => <div key={`${review.authorName}-${review.updatedAt}-${index}`} className="border-t border-slate-200 pt-4 dark:border-slate-700">
      <p className="font-bold text-slate-900 dark:text-white">{review.authorName}{review.isMine ? ' · Bạn' : ''} <span className="ml-2 text-amber-500">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span></p>
      {review.comment ? <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{review.comment}</p> : null}
    </div>)}</div>
  </section>;
}
