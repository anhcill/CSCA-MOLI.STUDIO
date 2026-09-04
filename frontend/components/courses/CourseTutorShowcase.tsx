'use client';

import { useState } from 'react';
import {
  FiAward,
  FiBookOpen,
  FiCheck,
  FiMessageCircle,
  FiStar,
  FiX,
} from 'react-icons/fi';
import { MOLY_ZALO_DISPLAY, MOLY_ZALO_URL } from '@/lib/constants/moly';
import { MOLY_TUTORS } from '@/lib/data/molyTutors';

export function CourseTutorShowcase({ courseTitle }: { courseTitle: string }) {
  const [selectedTutorId, setSelectedTutorId] = useState<string | null>(null);
  const selectedTutor = MOLY_TUTORS.find((tutor) => tutor.id === selectedTutorId);

  return (
    <>
    <section className="relative mt-8 overflow-hidden rounded-[2rem] border border-[#e4d5c8] bg-[#fffaf4] p-5 shadow-[0_20px_60px_-38px_rgba(81,45,28,.6)] dark:border-[#2d3b52] dark:bg-[#0b172b] sm:p-8" aria-labelledby="course-tutors-heading">
      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-rose-200/35 blur-3xl dark:bg-indigo-700/15" />
      <div className="relative flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#f0c8b9] bg-[#fff1eb] px-3 py-1.5 text-[11px] font-black uppercase tracking-[.16em] text-[#a34239] dark:border-[#633c4b] dark:bg-[#281a2c] dark:text-[#f3a5a5]">
            <FiStar className="fill-current" /> Đội ngũ gia sư MOLY
          </p>
          <h2 id="course-tutors-heading" className="mt-4 font-sans text-2xl font-black leading-tight text-[#1d2941] dark:text-[#f7e7d4] sm:text-3xl">
            Học cùng người hiểu bạn cần gì
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#71665d] dark:text-slate-300 sm:text-base">
            Gặp gỡ các gia sư đồng hành cùng <span className="font-black text-[#a34239] dark:text-[#f3a5a5]">{courseTitle}</span>. Vuốt ngang để gặp thêm các thầy cô, rồi nhấn vào ảnh để xem profile chi tiết nha ✨ Cần tư vấn lớp và lộ trình phù hợp, nhắn Zalo MOLY: <span className="font-black text-[#a34239] dark:text-[#f3a5a5]">{MOLY_ZALO_DISPLAY}</span>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a href={MOLY_ZALO_URL} target="_blank" rel="noopener noreferrer" className="hidden items-center gap-2 rounded-full border border-[#d9c8b9] bg-white px-4 py-2.5 text-sm font-black text-[#6b493b] transition hover:border-[#a34239] hover:text-[#a34239] dark:border-[#40506a] dark:bg-[#101e33] dark:text-[#f1d6bc] dark:hover:border-[#e79a92] sm:inline-flex">
            <FiMessageCircle className="text-[#cf543f]" /> Đăng ký qua Zalo
          </a>
        </div>
      </div>

      <div className="relative mt-7 flex h-[286px] snap-x snap-mandatory items-end gap-4 overflow-x-auto pb-3 [scrollbar-color:#cf9b88_transparent] [scrollbar-width:thin] sm:h-[338px]">
        {MOLY_TUTORS.map((tutor, index) => (
          <button
            type="button"
            key={tutor.id}
            onClick={() => setSelectedTutorId(tutor.id)}
            aria-label={`Xem hồ sơ giảng viên ${tutor.name}`}
            className="group relative block h-[252px] min-w-[188px] snap-start overflow-hidden rounded-[1.35rem] bg-[#19233a] shadow-[0_10px_22px_rgba(0,0,0,.16)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_30px_rgba(0,0,0,.28)] sm:h-[300px] sm:min-w-[224px]"
            style={{
              clipPath: index % 2 === 0
                ? 'polygon(0 0, 100% 4%, 100% 100%, 0 100%)'
                : 'polygon(0 4%, 100% 0, 100% 100%, 0 100%)',
            }}
          >
            <img src={tutor.avatarUrl} alt={`Ảnh đại diện ${tutor.name}`} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
            <div className={`absolute inset-0 bg-gradient-to-t ${tutor.accent} opacity-15 mix-blend-multiply`} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/5 to-transparent" />

            <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-[#202020]/90 px-2.5 py-1 text-[10px] font-black text-[#ffd23f] shadow-lg backdrop-blur">
              <FiCheck /> CSCA
            </span>

            <div className="absolute inset-x-0 bottom-0 p-4 pr-14 text-white">
              <p className="line-clamp-1 text-[9px] font-black uppercase tracking-[.12em] text-white/75">{tutor.role}</p>
              <h3 className="mt-1 line-clamp-2 font-sans text-lg font-black leading-tight drop-shadow">{tutor.name}</h3>
            </div>
          </button>
        ))}
      </div>

    </section>

    {selectedTutor && (
      <div className="fixed inset-0 z-[100] flex items-end bg-[#071228]/65 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6" role="presentation" onMouseDown={() => setSelectedTutorId(null)}>
        <article
          role="dialog"
          aria-modal="true"
          aria-labelledby="tutor-profile-name"
          className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[2rem] bg-[#fffaf4] shadow-2xl dark:bg-[#0b172b] sm:max-w-5xl sm:rounded-[2rem] lg:h-[min(720px,calc(100dvh-3rem))] lg:max-h-none lg:overflow-hidden"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button type="button" onClick={() => setSelectedTutorId(null)} aria-label="Đóng hồ sơ giảng viên" className="absolute right-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-full border border-white/30 bg-[#071228]/75 text-white backdrop-blur transition hover:bg-[#a34239]">
            <FiX className="h-5 w-5" />
          </button>

          <div className="grid lg:h-full lg:grid-cols-[minmax(280px,.82fr)_1.35fr]">
            <div className="relative min-h-[280px] overflow-hidden bg-[#18253d] lg:min-h-0">
              <img src={selectedTutor.avatarUrl} alt={`Ảnh đại diện ${selectedTutor.name}`} className="absolute inset-0 h-full w-full object-cover" />
              <div className={`absolute inset-0 bg-gradient-to-t ${selectedTutor.accent} opacity-25 mix-blend-multiply`} />
              <div className="absolute inset-0 bg-gradient-to-t from-[#071228]/95 via-[#071228]/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-8">
                <p className="text-[11px] font-black uppercase tracking-[.15em] text-[#ffe2c4]">{selectedTutor.role}</p>
                <h3 id="tutor-profile-name" className="mt-2 font-sans text-3xl font-black leading-tight sm:text-4xl">{selectedTutor.name}</h3>
                <p className="mt-3 text-sm font-bold leading-6 text-white/85">“{selectedTutor.tagline}”</p>
              </div>
            </div>

            <div className="p-5 sm:p-6 lg:p-5">
              <p className="text-sm leading-6 text-[#61584f] dark:text-slate-300">{selectedTutor.bio}</p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-[#eadbd0] bg-white/70 p-3.5 dark:border-[#35445b] dark:bg-[#101e33]">
                  <p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[.12em] text-[#a34239] dark:text-[#f09a96]"><FiBookOpen /> Chuyên môn</p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {selectedTutor.subjects.map((subject) => <span key={subject} className="rounded-full bg-[#f5eee7] px-2.5 py-1 text-[11px] font-bold text-[#715b4e] dark:bg-[#192a42] dark:text-[#dfc6a9]">{subject}</span>)}
                  </div>
                  <p className="mt-3 text-xs font-bold text-[#453d37] dark:text-slate-200">Dạy bằng {selectedTutor.teachingLanguage} · {selectedTutor.experience}</p>
                </div>

                <div className="rounded-2xl border border-[#eadbd0] bg-white/70 p-3.5 dark:border-[#35445b] dark:bg-[#101e33]">
                  <p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[.12em] text-[#a34239] dark:text-[#f09a96]"><FiAward /> Thành tích nổi bật</p>
                  <ul className="mt-2.5 space-y-1.5">
                    {selectedTutor.achievements.map((achievement) => <li key={achievement} className="flex gap-2 text-xs leading-5 text-[#61584f] dark:text-slate-300"><FiCheck className="mt-0.5 shrink-0 text-[#2d8a84]" /> {achievement}</li>)}
                  </ul>
                </div>
              </div>

              <section className="mt-4">
                <p className="text-[11px] font-black uppercase tracking-[.12em] text-[#a34239] dark:text-[#f09a96]">Phong cách giảng dạy</p>
                <p className="mt-2 rounded-2xl border-l-4 border-[#d35b46] bg-[#fff1eb] px-4 py-2.5 text-xs leading-5 text-[#604a41] dark:bg-[#281a2c] dark:text-slate-200">{selectedTutor.teachingStyle}</p>
              </section>

              <section className="mt-4">
                <p className="text-[11px] font-black uppercase tracking-[.12em] text-[#a34239] dark:text-[#f09a96]">Khóa học online của giảng viên</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {selectedTutor.courses.map((course) => (
                    <div key={course.title} className="rounded-2xl border border-[#eadbd0] bg-white/70 p-3 dark:border-[#35445b] dark:bg-[#101e33]">
                      <p className="font-sans text-sm font-black text-[#1b2942] dark:text-[#f7e4cd]">{course.title}</p>
                      <p className="mt-1 text-[11px] leading-4 text-[#776d64] dark:text-slate-400">{course.detail}</p>
                    </div>
                  ))}
                </div>
              </section>

              <a href={MOLY_ZALO_URL} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#c9503e] px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-rose-900/15 transition hover:bg-[#a83b35] sm:w-auto">
                <FiMessageCircle /> Đăng ký học cùng {selectedTutor.name} qua Zalo
              </a>
            </div>
          </div>
        </article>
      </div>
    )}
    </>
  );
}
