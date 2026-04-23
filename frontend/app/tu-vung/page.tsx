'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import { FiBook, FiSearch, FiChevronRight, FiChevronLeft, FiX } from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import axios from '@/lib/utils/axios';
import { useAuthStore } from '@/lib/store/authStore';

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

const SUBJECT_META: Record<string, { label: string; icon: string; color: string }> = {
  'toan':            { label: 'Toán học',        icon: '📐', color: 'from-blue-500 to-indigo-600' },
  'vat-ly':          { label: 'Vật Lý',          icon: '⚡', color: 'from-yellow-500 to-orange-600' },
  'hoa-hoc':         { label: 'Hóa Học',         icon: '🧪', color: 'from-green-500 to-teal-600' },
  'tieng-trung-xh':  { label: 'Tiếng Trung XH',  icon: '📖', color: 'from-red-500 to-rose-600' },
  'tieng-trung-tn':  { label: 'Tiếng Trung TN',  icon: '🔬', color: 'from-purple-500 to-violet-600' },
};

function VocabularyContent() {
  const searchParams = useSearchParams();
  const subjectParam = searchParams.get('subject');

  const [topics, setTopics] = useState<Array<{ topic: string; subject: string }>>([]);
  const [words, setWords] = useState<VocabItem[]>([]);
  const [selectedSubject, setSelectedSubject] = useState(subjectParam || '');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadTopics(); }, [selectedSubject]);


  useEffect(() => {
    if (selectedTopic || searchQuery) loadWords();
  }, [selectedTopic, searchQuery]);

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

  // Load topics with VIP awareness
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
  const getMeta = (subject: string) => SUBJECT_META[subject] || { label: subject, icon: '📚', color: 'from-gray-500 to-gray-600' };

  const exportPdf = () => {
    const params = new URLSearchParams();
    if (selectedSubject) params.set('subject', selectedSubject);
    if (selectedTopic) params.set('topic', selectedTopic);
    window.open(`/tu-vung/print?${params.toString()}`, '_blank');
  };

  // Group topics by subject
  const groupedTopics = topics.reduce((acc, t) => {
    if (!acc[t.subject]) acc[t.subject] = [];
    if (!acc[t.subject].find((x: any) => x.topic === t.topic)) acc[t.subject].push(t);
    return acc;
  }, {} as Record<string, typeof topics>);

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-blue-50 to-sky-50">
      <Header />
      <main className="container mx-auto px-6 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
            <FiBook className="text-white text-2xl" />
          </div>
          <div>
            <h1 className="text-4xl font-black bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">Từ Vựng Chuyên Ngành</h1>
            <p className="text-gray-600 mt-1">Từ vựng thuật ngữ theo từng môn học</p>
          </div>
        </div>

        {selectedTopic ? (
          /* Chi tiết topic */
          <div>
            <div className="mb-6 flex items-center gap-3 flex-wrap">
              <button onClick={closeTopic} className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border-2 border-gray-200 hover:border-cyan-400 transition-colors text-gray-700 font-medium">
                <FiChevronLeft size={18} /> Quay lại
              </button>
              <div className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r ${getMeta(selectedSubject).color} text-white font-semibold text-sm`}>
                <span>{getMeta(selectedSubject).icon}</span>
                <span>{getMeta(selectedSubject).label}</span>
                <span>›</span>
                <span>{selectedTopic}</span>
              </div>
              <div className="flex-1 min-w-[200px] relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Tìm trong chủ đề..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-8 py-2 bg-white border-2 border-gray-200 rounded-xl focus:border-cyan-400 outline-none text-sm" />
                {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><FiX size={14} /></button>}
              </div>
              <button
                onClick={exportPdf}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors shadow-md"
                title="Xuất danh sách từ vựng ra PDF"
              >
                📄 Xuất PDF
              </button>
            </div>
            {loading ? (
              <div className="text-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500 mx-auto" /></div>
            ) : words.length === 0 ? (
              <div className="text-center py-20 text-gray-500">Không tìm thấy từ vựng nào</div>
            ) : (
              <>
                {/* 4-column table header */}
                <div className="bg-gradient-to-r from-cyan-600 to-blue-600 rounded-2xl overflow-hidden shadow-lg mb-4">
                  <div className="grid grid-cols-4 text-white text-sm font-black uppercase tracking-wider">
                    <div className="px-5 py-3.5 text-center">Tiếng Trung</div>
                    <div className="px-5 py-3.5 text-center border-l border-white/20">Pinyin</div>
                    <div className="px-5 py-3.5 text-center border-l border-white/20">English</div>
                    <div className="px-5 py-3.5 text-center border-l border-white/20">Tiếng Việt</div>
                  </div>
                </div>

                {/* Vocabulary rows */}
                <div className="space-y-2">
                  {words.map((word, index) => (
                    <div
                      key={word.id}
                      className="bg-white rounded-xl border border-gray-100 hover:border-cyan-300 hover:shadow-md transition-all group"
                    >
                      {/* Mobile: stacked cards */}
                      <div className="hidden sm:grid sm:grid-cols-4 group-hover:bg-cyan-50/30 transition-colors rounded-xl">
                        {/* Chinese */}
                        <div className="px-5 py-4 flex items-center gap-2">
                          <span className="text-2xl font-black text-gray-900 group-hover:text-cyan-700 transition-colors">
                            {word.word_cn}
                          </span>
                          {word.is_premium && (
                            <span className="inline-flex items-center justify-center w-5 h-5 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full shadow-sm shrink-0" title="Nội dung VIP">
                              <FaCrown size={10} className="text-white" />
                            </span>
                          )}
                        </div>
                        {/* Pinyin */}
                        <div className="px-5 py-4 flex items-center border-l border-gray-100">
                          <span className="text-base text-cyan-700 font-semibold italic group-hover:text-cyan-900 transition-colors">
                            {word.pinyin}
                          </span>
                        </div>
                        {/* English */}
                        <div className="px-5 py-4 flex items-center border-l border-gray-100">
                          <span className="text-sm text-gray-600 group-hover:text-gray-800 transition-colors">
                            {word.word_en || '—'}
                          </span>
                        </div>
                        {/* Vietnamese */}
                        <div className="px-5 py-4 flex items-center border-l border-gray-100">
                          <span className="text-sm text-gray-700 font-medium group-hover:text-gray-900 transition-colors">
                            {word.word_vn}
                          </span>
                        </div>
                      </div>

                      {/* Mobile card layout */}
                      <div className="sm:hidden p-4 space-y-2">
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-black text-gray-900">{word.word_cn}</span>
                          <span className="text-sm text-cyan-600 italic">{word.pinyin}</span>
                        </div>
                        {word.word_en && (
                          <div className="text-xs text-gray-500"><span className="font-semibold text-gray-400 uppercase">EN:</span> {word.word_en}</div>
                        )}
                        <div className="text-sm text-gray-700"><span className="font-semibold text-gray-400 uppercase">VN:</span> {word.word_vn}</div>
                        {word.example_cn && (
                          <div className="mt-2 pt-2 border-t border-gray-100">
                            <p className="text-red-600 text-xs italic">{word.example_cn}</p>
                            {word.example_vn && <p className="text-gray-400 text-xs mt-0.5">{word.example_vn}</p>}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          /* Danh sách topics */
          <div>
            {/* Subject filter */}
            <div className="mb-6 flex flex-wrap gap-2">
              <button onClick={() => setSelectedSubject('')}
                className={`px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${!selectedSubject ? 'border-cyan-500 bg-cyan-50 text-cyan-700' : 'border-gray-200 text-gray-600 hover:border-cyan-300'}`}>
                Tất cả môn
              </button>
              {Object.entries(SUBJECT_META).map(([key, meta]) => (
                <button key={key} onClick={() => setSelectedSubject(selectedSubject === key ? '' : key)}
                  className={`px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${selectedSubject === key ? 'border-cyan-500 bg-cyan-50 text-cyan-700' : 'border-gray-200 text-gray-600 hover:border-cyan-300'}`}>
                  {meta.icon} {meta.label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="text-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500 mx-auto" /></div>
            ) : topics.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-gray-500 text-lg mb-2">Chưa có từ vựng nào trong hệ thống</p>
                <p className="text-gray-400 text-sm">Admin có thể thêm từ vựng tại trang quản trị</p>
              </div>
            ) : (
              <div className="space-y-8">
                {Object.entries(groupedTopics).map(([subject, subjectTopics]) => {
                  const meta = getMeta(subject);
                  return (
                    <div key={subject}>
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${meta.color} flex items-center justify-center text-xl shadow`}>{meta.icon}</div>
                        <h2 className="text-2xl font-black text-gray-800">{meta.label}</h2>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {subjectTopics.map(t => (
                          <button key={t.topic} onClick={() => openTopic(t.topic, t.subject)}
                            className="group bg-white rounded-2xl p-5 border-2 border-gray-100 hover:border-cyan-300 hover:shadow-lg transition-all text-left">
                            <div className="flex items-start justify-between">
                              <h3 className="font-bold text-gray-900 text-lg">{t.topic}</h3>
                              <FiChevronRight className="text-gray-400 group-hover:text-cyan-500 group-hover:translate-x-1 transition-all" size={20} />
                            </div>
                            <p className="text-sm text-cyan-600 font-semibold mt-4">Xem từ vựng →</p>
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
}

export default function VocabularyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500" /></div>}>
      <VocabularyContent />
    </Suspense>
  );
}
