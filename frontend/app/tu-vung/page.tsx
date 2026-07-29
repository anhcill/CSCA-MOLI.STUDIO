'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { FiBook, FiBookmark, FiSearch, FiChevronRight, FiChevronLeft, FiX, FiList } from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import SubjectStudyShell from '@/components/layout/SubjectStudyShell';
import axios from '@/lib/utils/axios';
import VocabularyLearningPanel from '@/components/vocabulary/VocabularyLearningPanel';
import { deleteBookmark, saveBookmark } from '@/lib/api/insights';
import { useLanguage } from '@/context/LanguageContext';

interface VocabItem {
  id: number;
  word_cn: string;
  pinyin: string;
  word_vn: string;
  word_en: string;
  subject: string;
  topic: string;
  example_cn: string;
  example_vn: string;
  is_premium?: boolean;
  vip_tier?: string;
}

const SUBJECT_META: Record<string, { icon: string; color: string }> = {
  'toan':            { icon: '📐', color: 'from-blue-500 to-indigo-600' },
  'vat-ly':          { icon: '⚡', color: 'from-yellow-500 to-orange-600' },
  'hoa-hoc':         { icon: '🧪', color: 'from-green-500 to-teal-600' },
  'tieng-trung-xh':  { icon: '📖', color: 'from-red-500 to-rose-600' },
  'tieng-trung-tn':  { icon: '🔬', color: 'from-purple-500 to-violet-600' },
};

const SUBJECT_LABEL_KEYS: Record<string, string> = {
  toan: 'subject.math',
  'vat-ly': 'subject.physics',
  'hoa-hoc': 'subject.chemistry',
  'tieng-trung-xh': 'subject.chineseSoc',
  'tieng-trung-tn': 'subject.chineseSci',
};

function VocabularyContent() {
  const { t, format } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const subjectParam = searchParams.get('subject');
  const isStrictSubject = !!subjectParam;

  const [topics, setTopics] = useState<Array<{ topic: string; subject: string }>>([]);
  const [words, setWords] = useState<VocabItem[]>([]);
  const [selectedSubject, setSelectedSubject] = useState(subjectParam || '');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [bookmarkedWords, setBookmarkedWords] = useState<Set<number>>(new Set());

  useEffect(() => { loadTopics(); }, [selectedSubject]);

  useEffect(() => {
    if (selectedTopic || searchQuery.trim()) loadWords();
    else setWords([]);
  }, [selectedSubject, selectedTopic, searchQuery]);

  const loadWords = async () => {
    try {
      setLoading(true);
      const params: any = { limit: 200 };
      if (selectedSubject) params.subject = selectedSubject;
      if (selectedTopic) params.topic = selectedTopic;
      if (searchQuery) params.search = searchQuery;
      const res = await axios.get('/vocabulary', { params });
      setWords(res.data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadTopics = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (selectedSubject) params.subject = selectedSubject;
      const res = await axios.get('/vocabulary/topics', { params });
      setTopics(res.data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const openTopic = (topic: string, subject: string) => {
    setSelectedTopic(topic); setSelectedSubject(subject); setSearchQuery('');
  };
  const closeTopic = () => { setSelectedTopic(''); setWords([]); setSearchQuery(''); };
  const getMeta = (subject: string) => SUBJECT_META[subject] || { icon: '📚', color: 'from-gray-500 to-gray-600' };
  const subjectLabel = (subject: string) => {
    const key = SUBJECT_LABEL_KEYS[subject];
    return key ? t(key) : subject;
  };

  const exportPdf = () => {
    const params = new URLSearchParams();
    if (selectedSubject) params.set('subject', selectedSubject);
    if (selectedTopic) params.set('topic', selectedTopic);
    window.open(`/tu-vung/print?${params.toString()}`, '_blank');
  };

  const toggleWordBookmark = async (word: VocabItem) => {
    const next = new Set(bookmarkedWords);
    const shouldBookmark = !next.has(word.id);
    if (shouldBookmark) next.add(word.id);
    else next.delete(word.id);
    setBookmarkedWords(next);

    try {
      if (shouldBookmark) {
        await saveBookmark({
          entity_type: 'vocabulary',
          entity_id: word.id,
          title: `${word.word_cn} - ${word.word_vn}`,
          metadata: { pinyin: word.pinyin, subject: word.subject, topic: word.topic },
        });
      } else {
        await deleteBookmark('vocabulary', word.id);
      }
    } catch {
      const rollback = new Set(bookmarkedWords);
      setBookmarkedWords(rollback);
    }
  };

  const groupedTopics = topics.reduce((acc, t) => {
    if (!acc[t.subject]) acc[t.subject] = [];
    if (!acc[t.subject].find((x: any) => x.topic === t.topic)) acc[t.subject].push(t);
    return acc;
  }, {} as Record<string, typeof topics>);

  const activeMeta = isStrictSubject ? getMeta(subjectParam || '') : null;

  const page = (
    <div className={isStrictSubject ? '' : 'min-h-screen bg-gray-50'}>
      {/* Custom Top Navigation */}
      {!isStrictSubject && (
      <div className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-200">
        <div className="container mx-auto px-3 sm:px-4 min-h-16 py-2 flex items-center justify-between gap-2">
          <button 
            onClick={() => router.back()} 
            className="flex items-center gap-2 text-gray-600 hover:text-cyan-600 font-medium transition-colors py-2"
          >
            <FiChevronLeft size={22} />
            <span className="hidden sm:inline">{t('vocab.back')}</span>
          </button>
          <div className="pointer-events-none min-w-0 flex-1 px-2 text-center text-base font-black text-gray-800 sm:text-xl">
            {activeMeta ? (
              <>
                <span>{activeMeta.icon}</span>
                <span className={`truncate bg-gradient-to-r ${activeMeta.color} bg-clip-text text-transparent`}>
                  {format('course.title.vocabulary', { subject: subjectLabel(subjectParam || '') })}
                </span>
              </>
            ) : (
              <span className="inline-flex max-w-full items-center justify-center gap-2 truncate bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                <FiBook /> {t('vocab.courseTitle')}
              </span>
            )}
          </div>
          <div className="w-16" /> {/* Spacer for perfect centering */}
        </div>
      </div>
      )}

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-6xl">
        {selectedTopic ? (
          /* Chi tiết topic */
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Topic Header & Tools */}
            <div className="mb-6 bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-stretch md:items-center gap-4 justify-between">
              <div className="flex items-center gap-3 w-full md:w-auto min-w-0">
                <button onClick={closeTopic} className="p-2.5 bg-gray-50 text-gray-600 rounded-xl hover:bg-cyan-50 hover:text-cyan-600 transition-colors">
                  <FiList size={20} />
                </button>
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold text-gray-900 sm:text-xl">{selectedTopic}</h2>
                  <p className="text-sm text-cyan-600 font-medium flex items-center gap-1 mt-0.5">
                    {getMeta(selectedSubject).icon} {subjectLabel(selectedSubject)}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 w-full sm:flex-row md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder={t('vocab.searchWords')}
                    value={searchQuery} 
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:border-cyan-400 focus:bg-white outline-none text-sm transition-all shadow-inner" 
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <FiX size={16} />
                    </button>
                  )}
                </div>
                <button
                  onClick={exportPdf}
                  className="px-4 py-2.5 bg-gray-900 text-white rounded-xl font-medium text-sm hover:bg-gray-800 transition-colors shadow-sm shrink-0"
                  title={t('vocab.exportPdfTitle')}
                >
                  📄 {t('vocab.exportPdf')}
                </button>
              </div>
            </div>

            {/* Flashcard & Mini Test Tools */}
            <VocabularyLearningPanel subject={selectedSubject} topic={selectedTopic} />

            {/* Word List */}
            <div className="mt-8">
              {loading ? (
                <div className="text-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500 mx-auto" /></div>
              ) : words.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FiSearch className="text-gray-400 text-2xl" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{t('vocab.noWordsFound')}</h3>
                  <p className="text-gray-500">{t('vocab.tryAnotherKeyword')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="font-bold text-gray-800 text-lg">{t('vocab.wordList')}</h3>
                    <span className="text-sm font-medium px-3 py-1 bg-cyan-100 text-cyan-800 rounded-full">
                      {format('vocab.wordsCount', { count: words.length })}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {words.map((word) => (
                      <div
                        key={word.id}
                        className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:border-cyan-300 hover:shadow-md transition-all group relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 p-3 flex gap-2">
                          {word.is_premium && (
                            <span className="inline-flex items-center justify-center w-6 h-6 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full shadow-sm" title={t('vocab.vipContent')}>
                              <FaCrown size={12} className="text-white" />
                            </span>
                          )}
                          <button
                            onClick={() => toggleWordBookmark(word)}
                            className={`p-2 rounded-xl transition-colors ${bookmarkedWords.has(word.id) ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
                          >
                            <FiBookmark size={18} className={bookmarkedWords.has(word.id) ? 'fill-current' : ''} />
                          </button>
                        </div>

                        <div className="pr-16">
                          <div className="flex items-end gap-3 mb-1">
                            <span className="text-3xl font-black text-gray-900 group-hover:text-cyan-700 transition-colors">
                              {word.word_cn}
                            </span>
                          </div>
                          <p className="text-base text-cyan-600 font-semibold italic mb-3">
                            {word.pinyin}
                          </p>
                          
                          <div className="space-y-1.5">
                            <div className="flex items-start gap-2">
                              <span className="text-xs font-bold text-gray-400 uppercase w-8 mt-0.5 shrink-0">VN</span>
                              <span className="text-sm text-gray-800 font-medium leading-tight">{word.word_vn}</span>
                            </div>
                            {word.word_en && (
                              <div className="flex items-start gap-2">
                                <span className="text-xs font-bold text-gray-400 uppercase w-8 mt-0.5 shrink-0">EN</span>
                                <span className="text-sm text-gray-600 leading-tight">{word.word_en}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {word.example_cn && (
                          <div className="mt-4 pt-3 border-t border-gray-50">
                            <p className="text-gray-800 text-sm">{word.example_cn}</p>
                            {word.example_vn && <p className="text-gray-500 text-sm mt-1">{word.example_vn}</p>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Danh sách topics */
          <div className="animate-in fade-in duration-500">
            {/* Subject filter (Only show if not in strict mode) */}
            {!isStrictSubject && (
              <div className="mb-8 flex gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:justify-center sm:gap-3 sm:overflow-visible sm:pb-0">
                <button 
                  onClick={() => setSelectedSubject('')}
                  className={`shrink-0 px-4 sm:px-5 py-2.5 rounded-xl border-2 text-sm font-bold transition-all shadow-sm ${!selectedSubject ? 'border-cyan-500 bg-cyan-50 text-cyan-700 sm:scale-105' : 'border-white bg-white text-gray-600 hover:border-gray-200 hover:scale-105'}`}
                >
                  {t('vocab.allSubjects')}
                </button>
                {Object.entries(SUBJECT_META).map(([key, meta]) => (
                  <button 
                    key={key} 
                    onClick={() => setSelectedSubject(selectedSubject === key ? '' : key)}
                    className={`shrink-0 px-4 sm:px-5 py-2.5 rounded-xl border-2 text-sm font-bold flex items-center gap-2 transition-all shadow-sm ${selectedSubject === key ? `border-transparent bg-gradient-to-r ${meta.color} text-white sm:scale-105` : 'border-white bg-white text-gray-600 hover:border-gray-200 hover:scale-105'}`}
                  >
                    <span className="text-lg">{meta.icon}</span> {subjectLabel(key)}
                  </button>
                ))}
              </div>
            )}

            <div className="relative mx-auto mb-8 max-w-2xl">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={t('vocab.searchWords')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-11 pr-10 text-sm shadow-sm outline-none transition-all focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <FiX size={16} />
                </button>
              )}
            </div>

            {loading ? (
              <div className="text-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500 mx-auto" /></div>
            ) : searchQuery.trim() ? (
              words.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FiSearch className="text-gray-400 text-2xl" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{t('vocab.noWordsFound')}</h3>
                  <p className="text-gray-500">{t('vocab.tryAnotherKeyword')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="font-bold text-gray-800 text-lg">{t('vocab.wordList')}</h3>
                    <span className="text-sm font-medium px-3 py-1 bg-cyan-100 text-cyan-800 rounded-full">
                      {format('vocab.wordsCount', { count: words.length })}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {words.map((word) => (
                      <button
                        key={word.id}
                        onClick={() => openTopic(word.topic, word.subject)}
                        className="group relative bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:border-cyan-300 hover:shadow-md transition-all text-left"
                      >
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-3xl font-black text-gray-900 group-hover:text-cyan-700">{word.word_cn}</p>
                            <p className="mt-1 text-base text-cyan-600 font-semibold italic">{word.pinyin}</p>
                          </div>
                          {word.is_premium && (
                            <span className="inline-flex items-center justify-center w-7 h-7 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full shadow-sm" title={t('vocab.vipContent')}>
                              <FaCrown size={12} className="text-white" />
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-gray-800">{word.word_vn}</p>
                        {word.word_en && <p className="mt-1 text-sm text-gray-500">{word.word_en}</p>}
                        <div className="mt-4 flex items-center justify-between text-xs font-bold text-cyan-700">
                          <span>{subjectLabel(word.subject)} · {word.topic}</span>
                          <FiChevronRight size={16} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )
            ) : topics.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 sm:p-16 text-center border border-gray-100 shadow-sm max-w-2xl mx-auto mt-10">
                <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <FiBook className="text-gray-300 text-4xl" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{t('vocab.noWords')}</h3>
                <p className="text-gray-500">{t('vocab.updatingWords')}</p>
              </div>
            ) : (
              <div className="space-y-12">
                {Object.entries(groupedTopics).map(([subject, subjectTopics]) => {
                  const meta = getMeta(subject);
                  return (
                    <div key={subject} className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8">
                      <div className="flex items-center gap-4 mb-6">
                        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${meta.color} flex items-center justify-center text-3xl shadow-lg`}>
                          {meta.icon}
                        </div>
                        <div>
                          <h2 className="text-2xl font-black text-gray-900 dark:text-slate-100">{subjectLabel(subject)}</h2>
                          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{format('vocab.topicsCount', { count: subjectTopics.length })}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {subjectTopics.map(topicItem => (
                          <button
                            key={topicItem.topic}
                            onClick={() => openTopic(topicItem.topic, topicItem.subject)}
                            className="group relative flex h-full flex-col overflow-hidden rounded-2xl border-2 border-transparent bg-gray-50 p-5 text-left transition-all hover:border-cyan-400 hover:bg-white hover:shadow-xl dark:border-slate-700 dark:bg-slate-800/70 dark:hover:border-cyan-500/70 dark:hover:bg-slate-800 dark:hover:shadow-black/20"
                          >
                            <div className="absolute right-0 top-0 -mr-10 -mt-10 h-24 w-24 rounded-full bg-gradient-to-br from-white/40 to-transparent transition-transform duration-500 group-hover:scale-150 dark:from-slate-600/35" />
                            
                            <h3 className="relative z-10 mb-4 pr-6 text-lg font-bold leading-tight text-gray-900 dark:text-slate-100">
                              {topicItem.topic}
                            </h3>
                            
                            <div className="mt-auto flex items-center justify-between relative z-10">
                              <span className="text-sm text-cyan-600 font-bold group-hover:text-cyan-700">
                                {t('vocab.startLearning')}
                              </span>
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-100 text-cyan-600 transition-colors group-hover:bg-cyan-500 group-hover:text-white dark:bg-slate-700 dark:text-cyan-400">
                                <FiChevronRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );

  if (isStrictSubject) {
    return (
      <SubjectStudyShell
        title={activeMeta ? format('course.title.vocabulary', { subject: subjectLabel(subjectParam || '') }) : t('vocab.courseTitle')}
        subjectSlug={subjectParam}
        activeSection="tu-vung"
        searchPlaceholder={t('vocab.searchWords')}
      >
        {page}
      </SubjectStudyShell>
    );
  }

  return page;
}

export default function VocabularyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500" /></div>}>
      <VocabularyContent />
    </Suspense>
  );
}
