import { FiBookOpen, FiMapPin } from 'react-icons/fi';

export function LearningRoomLoading() {
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
          <div className="absolute inset-2 rounded-full border border-dashed border-[#aa2034]/45 motion-safe:animate-spin [animation-duration:10s] dark:border-[#dd6f80]/50" />
          <div className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full bg-[#aa2034] shadow-[0_0_16px_rgba(170,32,52,.65)] dark:bg-[#f08091]" />
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

        <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-[#8b7d73] dark:text-slate-500">
          <FiBookOpen className="motion-safe:animate-pulse" />
          <span>Học từng bước, tiến bộ từng ngày</span>
        </div>
        <div className="mt-4 h-1 w-52 overflow-hidden rounded-full bg-[#ddd2c8] dark:bg-[#24334a]">
          <div className="h-full w-2/5 rounded-full bg-gradient-to-r from-[#2d8885] via-[#b48a64] to-[#a51f32] motion-safe:animate-pulse" />
        </div>
      </div>

      <span className="sr-only">Vui lòng chờ trong giây lát.</span>
    </div>
  );
}
