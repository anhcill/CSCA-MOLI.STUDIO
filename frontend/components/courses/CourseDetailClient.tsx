'use client';

import { useEffect, useRef, useState } from 'react';
import { FiCheck, FiLayers, FiRefreshCw, FiTarget } from 'react-icons/fi';
import coursesApi from '@/lib/api/courses';
import type { CourseDetailDto } from '@/lib/types/courses';
import { publicCourseModeLabel, publicCourseProfileLabel } from '@/lib/coursePresentation';
import { CourseAccessCard } from './CourseAccessCard';
import { CourseHero } from './CourseHero';
import { CurriculumAccordion } from './CurriculumAccordion';

export function CourseDetailClient({ slug }: { slug: string }) {
  const [course, setCourse] = useState<CourseDetailDto | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null | undefined>(undefined);
  const loadedSlugRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [switchingProfile, setSwitchingProfile] = useState(false);
  const [error, setError] = useState('');
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    loadedSlugRef.current = null;
    const initialProfileId = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('profileId')
      : null;
    setSelectedProfileId(initialProfileId);
  }, [slug]);

  useEffect(() => {
    if (selectedProfileId === undefined) return;
    let active = true;
    const isInitial = loadedSlugRef.current !== slug;
    if (isInitial) setLoading(true);
    else setSwitchingProfile(true);
    setError('');
    coursesApi.getCourse(slug, { profileId: selectedProfileId })
      .then((data) => {
        if (!active) return;
        loadedSlugRef.current = slug;
        setCourse(data);
      })
      .catch(() => active && setError('Không tìm thấy khóa học hoặc khóa học chưa được công bố.'))
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setSwitchingProfile(false);
      });
    return () => { active = false; };
  }, [slug, selectedProfileId, requestVersion]);

  const handleSelectProfile = (remoteProfileId: string) => {
    setSelectedProfileId(remoteProfileId);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('profileId', remoteProfileId);
      window.history.replaceState({}, '', url.toString());
    }
  };

  if (loading) return <div aria-label="Đang tải khóa học" className="space-y-8"><div className="h-[430px] animate-pulse rounded-[2rem] bg-slate-200 dark:bg-slate-800" /><div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]"><div className="h-96 animate-pulse rounded-[1.75rem] bg-slate-200 dark:bg-slate-800" /><div className="h-96 animate-pulse rounded-[1.75rem] bg-slate-200 dark:bg-slate-800" /></div></div>;
  if (error || !course) return <div role="alert" className="rounded-[2rem] border border-red-200 bg-white p-12 text-center shadow-sm dark:border-red-900/70 dark:bg-slate-900"><p className="text-lg font-black text-red-700 dark:text-red-300">{error || 'Không có dữ liệu khóa học.'}</p><button type="button" onClick={() => setRequestVersion((value) => value + 1)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-700"><FiRefreshCw /> Thử lại</button></div>;

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px] xl:gap-10">
      <main className="space-y-8">
        <CourseHero course={course} />
        <section className="rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#0b1427] sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Lộ trình từng bước</p><h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white sm:text-3xl">Nội dung khóa học</h2></div><p className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{course.totalSections} chương · {course.totalLessons} bài</p></div>
            {course.projectedProfiles && course.projectedProfiles.length > 0 ? (
              <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                    <FiLayers /> Chọn hồ sơ / hình thức học ({course.projectedProfiles.length})
                  </p>
                  {switchingProfile ? <span className="text-xs font-bold text-indigo-600 dark:text-indigo-300">Đang tải chương trình...</span> : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {course.projectedProfiles.map((profile) => {
                    const isActive = (course.activeProfileId || course.projectedProfiles?.[0]?.remoteProfileId) === profile.remoteProfileId;
                    const modeText = publicCourseModeLabel(profile.mode);
                    return (
                      <button
                        key={profile.remoteProfileId}
                        type="button"
                        onClick={() => handleSelectProfile(profile.remoteProfileId)}
                        className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-left text-xs font-bold transition ${
                          isActive
                            ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                        }`}
                      >
                        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : profile.mode === 'MIRROR'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        }`}>
                          {modeText}
                        </span>
                        <span>{publicCourseProfileLabel(profile.title, profile.mode)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div className={`mt-6 transition-opacity ${switchingProfile ? 'pointer-events-none opacity-60' : ''}`}><CurriculumAccordion sections={course.curriculum} courseSlug={course.slug} /></div>
        </section>

        <section className="rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#0b1427] sm:p-8">
          <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-xl text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"><FiTarget /></span><div><p className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Kết quả sau khóa học</p><h2 className="text-2xl font-black text-slate-950 dark:text-white sm:text-3xl">Bạn sẽ học được gì?</h2></div></div>
          {course.outcomes.length ? <ul className="mt-6 grid gap-3 sm:grid-cols-2">{course.outcomes.map((outcome) => <li key={outcome} className="flex gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm font-semibold leading-6 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs text-white"><FiCheck /></span>{outcome}</li>)}</ul> : <p className="mt-4 text-slate-500 dark:text-slate-400">Nội dung đang được cập nhật.</p>}
        </section>

        {course.descriptionHtml ? <section className="rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#0b1427] sm:p-8"><h2 className="text-2xl font-black text-slate-950 dark:text-white">Giới thiệu khóa học</h2><div className="prose prose-slate mt-5 max-w-none text-slate-600 dark:prose-invert dark:text-slate-300" dangerouslySetInnerHTML={{ __html: course.descriptionHtml }} /></section> : null}

        {course.requirements.length ? <section className="rounded-[1.75rem] border border-amber-200/80 bg-amber-50 p-6 dark:border-amber-900/60 dark:bg-amber-950/25 sm:p-8"><h2 className="text-xl font-black text-amber-950 dark:text-amber-100">Bạn cần chuẩn bị gì?</h2><ul className="mt-4 grid gap-3 sm:grid-cols-2">{course.requirements.map((item) => <li key={item} className="flex gap-2 text-sm font-semibold leading-6 text-amber-900 dark:text-amber-200"><FiCheck className="mt-1 shrink-0 text-amber-600 dark:text-amber-400" /> {item}</li>)}</ul></section> : null}
      </main>
      <CourseAccessCard course={course} />
    </div>
  );
}
