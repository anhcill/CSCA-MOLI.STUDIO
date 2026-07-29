import { FiBookOpen, FiMapPin } from 'react-icons/fi';

type Props = {
  progress?: number | null;
  stage?: string;
};

export function LearningRoomLoading({
  progress = null,
  stage = 'Đang kết nối tới lớp học',
}: Props) {
  const measuredProgress = progress === null
    ? null
    : Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Đang mở bài học"
      className="relative grid min-h-screen place-items-center overflow-hidden bg-[#f5efe8] px-6 text-[#17243d] transition-colors dark:bg-[#050d1d] dark:text-[#f4e8d6]"
    >
      <div className="pointer-events-none absolute inset-0 opacity-70 dark:opacity-45">
        <div className="absolute -left-24 top-16 h-72 w-72 rounded-full border border-[#d9c9b8]/70 dark:border-[#30405a]" />
        <div className="absolute -right-16 bottom-12 h-80 w-80 rounded-full border border-[#d9c9b8]/60 dark:border-[#30405a]" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#e9ddd0]/60 to-transparent dark:from-[#10213a]/70" />
      </div>

      <div className="relative flex max-w-md flex-col items-center text-center">
        <div className="relative grid h-28 w-28 place-items-center">
          <div className="absolute inset-0 rounded-full border border-[#b98d68]/35" />
          <svg
            aria-hidden="true"
            viewBox="0 0 112 112"
            className="absolute inset-0 h-full w-full text-[#aa2034] motion-safe:animate-spin [animation-duration:1.45s] dark:text-[#f08091]"
          >
            <circle cx="56" cy="56" r="52" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="76 251" />
          </svg>
          <svg
            aria-hidden="true"
            viewBox="0 0 112 112"
            className="absolute inset-2 h-24 w-24 text-[#2d8885] motion-safe:animate-spin [animation-direction:reverse] [animation-duration:2.4s] dark:text-[#65c4bb]"
          >
            <circle cx="56" cy="56" r="50" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="42 272" />
          </svg>
          <div className="grid h-20 w-20 place-items-center rounded-full border border-[#c9aa8d] bg-[#fffaf5]/90 font-serif text-4xl font-black text-[#a51f32] shadow-[0_16px_35px_-22px_rgba(62,37,21,.8)] backdrop-blur dark:border-[#41516a] dark:bg-[#0b172b]/90 dark:text-[#f1a1ad]">
            学
          </div>
        </div>

        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#d7c6b5] bg-[#fffaf5]/75 px-3 py-1.5 text-[11px] font-black uppercase tracking-[.16em] text-[#287e7e] backdrop-blur dark:border-[#34435a] dark:bg-[#0b172b]/75 dark:text-[#65c4bb]">
          <FiMapPin /> CSCA Learning
        </div>
        <h1 className="mt-4 font-sans text-2xl font-black">Đang mở bài học...</h1>
        <p className="mt-1 font-serif text-sm tracking-[.22em] text-[#9c6d4b] dark:text-[#d4a276]">
          正在前往下一课
        </p>
        <p className="mt-3 text-sm text-[#756a62] dark:text-slate-400">
          Chuẩn bị video và lộ trình học của bạn
        </p>

        <div className="mt-6 flex w-56 items-center justify-between gap-3 text-xs font-semibold text-[#8b7d73] dark:text-slate-400">
          <span className="inline-flex min-w-0 items-center gap-2">
            <FiBookOpen className="shrink-0 motion-safe:animate-pulse" />
            <span className="truncate">{stage}</span>
          </span>
          <span className="shrink-0 tabular-nums text-[#247d7e] dark:text-[#65c4bb]">
            {measuredProgress === null ? '•••' : `${measuredProgress}%`}
          </span>
        </div>
        <div
          className="mt-3 h-1.5 w-56 overflow-hidden rounded-full bg-[#ddd2c8] dark:bg-[#24334a]"
          role="progressbar"
          aria-label={stage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={measuredProgress ?? undefined}
        >
          {measuredProgress === null ? (
            <div className="learning-progress-indeterminate h-full w-2/5 rounded-full bg-gradient-to-r from-[#2d8885] via-[#b48a64] to-[#a51f32]" />
          ) : (
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#2d8885] via-[#b48a64] to-[#a51f32] transition-[width] duration-500 ease-out"
              style={{ width: `${measuredProgress}%` }}
            />
          )}
        </div>
      </div>

      <span className="sr-only">Vui lòng chờ trong giây lát.</span>
      <style>{`
        @keyframes learning-progress-slide {
          from { transform: translateX(-120%); }
          to { transform: translateX(350%); }
        }
        .learning-progress-indeterminate {
          animation: learning-progress-slide 1.15s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .learning-progress-indeterminate {
            animation: none;
            transform: translateX(75%);
          }
        }
      `}</style>
    </div>
  );
}
