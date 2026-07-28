import Link from 'next/link';
import { FiCheckCircle, FiFileText, FiLock, FiPlayCircle } from 'react-icons/fi';
import type { CurriculumSectionDto } from '@/lib/types/courses';

function lessonIcon(type: string) {
  return type === 'video' ? <FiPlayCircle /> : <FiFileText />;
}

export function LearningSidebar({ courseSlug, sections, activeLessonId }: { courseSlug: string; sections: CurriculumSectionDto[]; activeLessonId: number }) {
  const lessons = sections.flatMap((section) => section.lessons);
  const completedLessons = lessons.filter((lesson) => lesson.progressStatus === 'completed').length;

  return (
    <aside aria-label="Nội dung khóa học" className="h-full overflow-y-auto border-l border-slate-200 bg-slate-50 text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 p-5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-indigo-600 dark:text-indigo-300">Lộ trình học</p>
            <h2 className="mt-1 text-xl font-black">Nội dung khóa học</h2>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">{completedLessons}/{lessons.length}</span>
        </div>
      </div>

      {!sections.length ? <p className="p-6 text-sm text-slate-500 dark:text-slate-400">Chưa có bài học.</p> : (
        <div className="space-y-3 p-3">
          {sections.map((section, sectionIndex) => {
            const sectionCompleted = section.lessons.filter((lesson) => lesson.progressStatus === 'completed').length;
            return (
              <section key={section.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/70">
                  <h3 className="text-sm font-black"><span className="mr-2 text-indigo-600 dark:text-indigo-300">{String(sectionIndex + 1).padStart(2, '0')}</span>{section.title}</h3>
                  <span className="text-[11px] font-bold text-slate-400">{sectionCompleted}/{section.lessons.length}</span>
                </div>
                <div>
                  {section.lessons.map((item, lessonIndex) => {
                    const active = item.id === activeLessonId;
                    const completed = item.progressStatus === 'completed';
                    const content = (
                      <>
                        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-sm ${active ? 'bg-indigo-600 text-white' : completed ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}>
                          {item.isLocked ? <FiLock /> : completed ? <FiCheckCircle /> : lessonIcon(item.lessonType)}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Bài {sectionIndex + 1}.{lessonIndex + 1}</span>
                          <span className="mt-0.5 block leading-snug">{item.title}</span>
                        </span>
                      </>
                    );
                    return item.isLocked ? (
                      <div key={item.id} className="flex gap-3 border-b border-slate-100 px-4 py-3.5 text-sm text-slate-400 last:border-b-0 dark:border-slate-800 dark:text-slate-500">{content}</div>
                    ) : (
                      <Link
                        key={item.id}
                        href={`/hoc/${courseSlug}/bai-hoc/${item.id}`}
                        aria-current={active ? 'page' : undefined}
                        className={`flex gap-3 border-b border-slate-100 px-4 py-3.5 text-sm transition last:border-b-0 dark:border-slate-800 ${active ? 'bg-indigo-50 font-black text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200' : 'font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/70'}`}
                      >
                        {content}
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </aside>
  );
}
