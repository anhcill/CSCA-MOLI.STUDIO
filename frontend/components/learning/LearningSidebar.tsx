import Link from 'next/link';
import {
  FiBookOpen,
  FiCheck,
  FiCheckCircle,
  FiChevronDown,
  FiFileText,
  FiLock,
  FiPlay,
} from 'react-icons/fi';
import type { CurriculumSectionDto } from '@/lib/types/courses';

function lessonIcon(type: string) {
  return type === 'video' ? <FiPlay /> : <FiFileText />;
}

function durationLabel(seconds: number) {
  const totalSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export function LearningSidebar({
  courseSlug,
  sections,
  activeLessonId,
  progressPct,
}: {
  courseSlug: string;
  sections: CurriculumSectionDto[];
  activeLessonId: number;
  progressPct: number;
}) {
  const lessons = sections.flatMap((section) => section.lessons);
  const completedLessons = lessons.filter((lesson) => lesson.progressStatus === 'completed').length;
  const progress = Math.min(100, Math.max(0, progressPct));

  return (
    <aside aria-label="Nội dung khóa học" className="overflow-hidden rounded-2xl border border-[#dfd0c2] bg-[#fffaf4] text-[#18243b] shadow-[0_18px_42px_-30px_rgba(55,38,25,.6)] lg:sticky lg:top-[92px] lg:max-h-[calc(100vh-112px)]">
      <div className="border-b border-[#e5d9cd] bg-[#fffdf8]/95 p-5 backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[.16em] text-[#258584]">Lộ trình học tập</p>
            <h2 className="mt-1 text-2xl font-black">Nội dung khóa học</h2>
          </div>
          <FiBookOpen className="h-7 w-7 text-[#b39170]" />
        </div>
        <div className="mt-5 flex items-center justify-between text-xs font-bold text-[#625a54]">
          <span>{completedLessons} / {lessons.length} bài hoàn thành</span>
          <span className="text-[#278786]">{Math.round(progress)}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e7dfd7]">
          <div className="h-full rounded-full bg-gradient-to-r from-[#237c82] to-[#55afa4]" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {!sections.length ? <p className="p-6 text-sm text-[#786e67]">Chưa có bài học.</p> : (
        <div className="space-y-3 overflow-y-auto bg-[#f5efe8] p-3 lg:max-h-[calc(100vh-250px)]">
          {sections.map((section, sectionIndex) => {
            const sectionCompleted = section.lessons.filter((lesson) => lesson.progressStatus === 'completed').length;
            const containsActive = section.lessons.some((lesson) => lesson.id === activeLessonId);
            return (
              <details key={section.id} open={containsActive || sectionIndex === 0} className="group overflow-hidden rounded-xl border border-[#ddcbbb] bg-[#fffdf9] shadow-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-[#fcf7f1] px-5 py-4 [&::-webkit-details-marker]:hidden">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs ${sectionCompleted === section.lessons.length && section.lessons.length ? 'bg-[#2f9692] text-white' : 'border border-[#cfb99f] text-[#8e6d50]'}`}>
                      {sectionCompleted === section.lessons.length && section.lessons.length ? <FiCheck /> : sectionIndex + 1}
                    </span>
                    <h3 className="truncate text-sm font-black">{sectionIndex + 1}. {section.title}</h3>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-[11px] font-bold text-[#8b8179]">{sectionCompleted}/{section.lessons.length}</span>
                    <FiChevronDown className="transition group-open:rotate-180" />
                  </div>
                </summary>

                <div className="bg-[#fffdf9]">
                  {section.lessons.map((item, lessonIndex) => {
                    const active = item.id === activeLessonId;
                    const completed = item.progressStatus === 'completed';
                    const content = (
                      <>
                        <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs ${active ? 'bg-white/20 text-white' : completed ? 'bg-[#2f9692] text-white' : 'text-[#9b9188]'}`}>
                          {item.isLocked ? <FiLock /> : completed ? <FiCheckCircle /> : lessonIcon(item.lessonType)}
                        </span>
                        <span className="min-w-0 flex-1 leading-snug">
                          <span className="mr-1 font-black">{sectionIndex + 1}.{lessonIndex + 1}</span>{item.title}
                        </span>
                        {item.durationSeconds > 0 ? <span className={`shrink-0 text-[11px] tabular-nums ${active ? 'text-white/70' : 'text-[#8f867e]'}`}>{durationLabel(item.durationSeconds)}</span> : null}
                      </>
                    );
                    return item.isLocked ? (
                      <div key={item.id} className="flex gap-2 border-t border-[#eee6df] px-5 py-3.5 text-sm text-[#aaa098]">{content}</div>
                    ) : (
                      <Link
                        key={item.id}
                        href={`/hoc/${courseSlug}/bai-hoc/${item.id}`}
                        aria-current={active ? 'page' : undefined}
                        className={`flex gap-2 border-t border-[#eee6df] px-5 py-3.5 text-sm transition ${active ? 'bg-[#ad2033] font-bold text-white shadow-inner' : 'font-semibold text-[#5e5b5a] hover:bg-[#f7efe7] hover:text-[#902033]'}`}
                      >
                        {content}
                      </Link>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </aside>
  );
}
