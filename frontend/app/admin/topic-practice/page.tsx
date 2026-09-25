'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiAlertCircle, FiBarChart2, FiCheck, FiChevronRight, FiFileText, FiPlus, FiRefreshCw,
  FiFolder, FiLayers, FiTarget, FiUsers, FiX,
} from 'react-icons/fi';
import type { IconType } from 'react-icons';
import RoomExamPaperPanel from '@/components/admin/RoomExamPaperPanel';
import AdminLayout from '@/components/layout/AdminLayout';
import {
  examAdminApi,
  type RoomPaperConfig,
  type TopicPracticeAdminItem,
  type TopicPracticeAdminTopic,
  type TopicPracticeParticipant,
} from '@/lib/api/examAdmin';
import axios from '@/lib/utils/axios';

type Subject = { id: number; name: string; code: string };
type EditorFile = {
  examId: number;
  title: string;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  status: string;
  languageMode: string;
  topicId?: number;
};

const LANGUAGE_LABELS: Record<string, string> = {
  vi: 'Tiếng Việt',
  en: 'English',
  zh: '中文',
  vi_zh: 'Việt + 中文',
  vi_en: 'Việt + English',
  zh_vi: '中文 + Việt',
  zh_en: '中文 + English',
  en_vi: 'English + Việt',
  en_zh: 'English + 中文',
};

function languageLabel(value?: string | null) {
  return LANGUAGE_LABELS[String(value || '').trim().toLowerCase()] || '中文';
}

function formatDate(value?: string | null) {
  if (!value) return 'Chưa có';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Chưa có' : date.toLocaleString('vi-VN');
}

function toEditorFile(item: TopicPracticeAdminItem): EditorFile {
  return {
    examId: item.exam_id,
    title: item.title,
    subjectId: item.subject_id,
    subjectCode: item.subject_code,
    subjectName: item.subject_name,
    status: item.status,
    languageMode: item.language_mode || 'zh',
    topicId: item.topic_id || undefined,
  };
}

function PracticeEditor({ file, onClose, onChanged }: { file: EditorFile; onClose: () => void; onChanged: () => Promise<void> }) {
  const [topics, setTopics] = useState<TopicPracticeAdminTopic[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState(String(file.topicId || ''));
  const [paperConfig, setPaperConfig] = useState<RoomPaperConfig | null>(null);
  const [participants, setParticipants] = useState<TopicPracticeParticipant[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [savingTopic, setSavingTopic] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [status, setStatus] = useState(file.status);
  const [languageMode, setLanguageMode] = useState(file.languageMode || 'zh');

  useEffect(() => {
    setSelectedTopicId(String(file.topicId || ''));
    setStatus(file.status);
    setLanguageMode(file.languageMode || 'zh');
    setPaperConfig(null);
    setParticipants([]);
    examAdminApi.getTopicPracticeTopics(file.subjectCode)
      .then(setTopics)
      .catch(() => setTopics([]));
  }, [file.examId, file.subjectCode, file.topicId]);

  const saveTopic = async () => {
    const topicId = Number(selectedTopicId);
    if (!Number.isInteger(topicId) || topicId <= 0) return alert('Chọn chủ đề trước khi lưu.');
    if (!paperConfig?.ready) return alert('Hãy tải PDF và lưu đủ bảng đáp án trước khi gán chủ đề.');
    try {
      setSavingTopic(true);
      const result = await examAdminApi.setTopicPracticeTopic(file.examId, topicId);
      alert(result.message);
      await onChanged();
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Không thể gán file vào chủ đề.');
    } finally {
      setSavingTopic(false);
    }
  };

  const setPublished = async () => {
    if (!paperConfig?.ready || !selectedTopicId) {
      alert('Chỉ có thể đăng khi PDF, toàn bộ đáp án và chủ đề đã sẵn sàng.');
      return;
    }
    try {
      setPublishing(true);
      const nextStatus = status === 'published' ? 'draft' : 'published';
      if (nextStatus === 'published') {
        await examAdminApi.setTopicPracticeTopic(file.examId, Number(selectedTopicId));
      }
      await examAdminApi.updateExamStatus(file.examId, nextStatus);
      setStatus(nextStatus);
      await onChanged();
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Không thể cập nhật trạng thái đăng.');
    } finally {
      setPublishing(false);
    }
  };

  const loadParticipants = async () => {
    try {
      setParticipantsLoading(true);
      setParticipants(await examAdminApi.getTopicPracticeParticipants(file.examId));
    } catch {
      alert('Không tải được danh sách người học.');
    } finally {
      setParticipantsLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-5xl overflow-y-auto bg-[#f8fafc] p-4 shadow-2xl dark:bg-[#07111f] sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-widest text-red-500">File luyện theo chủ đề</p>
            <h2 className="mt-1 truncate text-2xl font-black text-slate-950 dark:text-white">{file.title}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-300">{file.subjectName} · {languageLabel(languageMode)} · ID #{file.examId}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:text-red-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"><FiX size={20} /></button>
        </div>

        <div className="mb-5 grid gap-3 rounded-2xl border border-red-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#111b2d] md:grid-cols-[1fr_auto] md:items-end">
          <label className="block text-sm font-black text-slate-800 dark:text-slate-100">
            Chủ đề hiển thị cho học viên
            <select value={selectedTopicId} onChange={(event) => setSelectedTopicId(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-red-500/20">
              <option value="">Chọn chủ đề</option>
              {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={saveTopic} disabled={savingTopic} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-black text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-500/35 dark:bg-red-500/10 dark:text-red-200 dark:hover:bg-red-500/20"><FiTarget /> {savingTopic ? 'Đang lưu...' : 'Gán chủ đề'}</button>
            <button type="button" onClick={setPublished} disabled={publishing} className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black text-white disabled:opacity-50 ${status === 'published' ? 'bg-slate-700 hover:bg-slate-800' : 'bg-emerald-600 hover:bg-emerald-700'}`}><FiCheck /> {publishing ? 'Đang cập nhật...' : status === 'published' ? 'Gỡ đăng' : 'Đăng cho học viên'}</button>
          </div>
          <p className="md:col-span-2 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-300">Trình tự: chủ đề → file → tải PDF → lưu đủ đáp án → đăng. File lời giải PDF là tùy chọn và chỉ mở cho học viên sau khi nộp bài. Sau khi có người làm, hệ thống khóa đổi PDF, đáp án và chủ đề để bảo toàn thống kê.</p>
        </div>

        <RoomExamPaperPanel
          examId={file.examId}
          onConfigChange={setPaperConfig}
          showSolutionFile
          workspace="topic"
          languageMode={languageMode}
        />

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111b2d]">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div><h3 className="flex items-center gap-2 text-lg font-black text-slate-950 dark:text-white"><FiUsers /> Người đã luyện file này</h3><p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-300">Theo dõi ai đã luyện, số lượt và điểm cao nhất.</p></div>
            <button type="button" onClick={loadParticipants} disabled={participantsLoading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><FiRefreshCw className={participantsLoading ? 'animate-spin' : ''} /> Xem danh sách</button>
          </div>
          {participants.length > 0 && <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead><tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400 dark:border-slate-800"><th className="pb-3">Người học</th><th className="pb-3 text-center">Lượt làm</th><th className="pb-3 text-center">Đã nộp</th><th className="pb-3 text-center">Điểm cao</th><th className="pb-3 text-right">Hoạt động cuối</th></tr></thead><tbody>{participants.map((person) => <tr key={person.user_id} className="border-b border-slate-50 dark:border-slate-800/80"><td className="py-3"><p className="font-bold text-slate-900 dark:text-white">{person.user_name}</p><p className="text-xs text-slate-400">{person.user_email}</p></td><td className="py-3 text-center font-bold text-slate-700 dark:text-slate-200">{person.attempt_count}</td><td className="py-3 text-center font-bold text-emerald-600 dark:text-emerald-300">{person.completed_count}</td><td className="py-3 text-center font-black text-slate-900 dark:text-white">{Number(person.best_score).toFixed(1)}</td><td className="py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-300">{formatDate(person.last_activity_at)}</td></tr>)}</tbody></table></div>}
        </section>
      </aside>
    </>
  );
}

export default function AdminTopicPracticePage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [items, setItems] = useState<TopicPracticeAdminItem[]>([]);
  const [topics, setTopics] = useState<TopicPracticeAdminTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorFile, setEditorFile] = useState<EditorFile | null>(null);
  const [showCreateTopic, setShowCreateTopic] = useState(false);
  const [showCreateFile, setShowCreateFile] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<TopicPracticeAdminTopic | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newSubjectId, setNewSubjectId] = useState('');
  const [newLanguageMode, setNewLanguageMode] = useState('zh');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [nextItems, nextTopics] = await Promise.all([
        examAdminApi.getTopicPracticeOverview(subjectFilter || undefined),
        examAdminApi.getTopicPracticeTopics(subjectFilter || undefined),
      ]);
      setItems(nextItems);
      setTopics(nextTopics);
    } catch {
      setItems([]);
      setTopics([]);
    } finally {
      setLoading(false);
    }
  }, [subjectFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    axios.get('/subjects')
      .then((response) => setSubjects(Array.isArray(response.data?.data) ? response.data.data : (Array.isArray(response.data) ? response.data : [])))
      .catch(() => setSubjects([]));
  }, []);

  const totals = useMemo(() => ({
    topics: topics.length,
    files: items.length,
    learners: items.reduce((sum, item) => sum + Number(item.learner_count || 0), 0),
    attempts: items.reduce((sum, item) => sum + Number(item.attempt_count || 0), 0),
    published: items.filter((item) => item.status === 'published').length,
  }), [items, topics]);

  const filesByTopic = useCallback((topicId: number) => items.filter((item) => item.topic_id === topicId), [items]);

  const createTopic = async () => {
    const subject = subjects.find((item) => item.id === Number(newSubjectId));
    if (!newTitle.trim() || !subject) return alert('Nhập tên chủ đề và chọn môn học.');
    try {
      setCreating(true);
      const result = await examAdminApi.createTopicPracticeTopic({
        subjectId: subject.id,
        name: newTitle.trim(),
        description: newDescription.trim() || undefined,
      });
      setShowCreateTopic(false);
      setNewTitle('');
      setNewDescription('');
      setNewSubjectId('');
      await load();
      setSelectedTopic(result.data);
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Không tạo được chủ đề luyện.');
    } finally {
      setCreating(false);
    }
  };

  const createPracticeFile = async () => {
    const subject = subjects.find((item) => item.id === selectedTopic?.subject_id);
    if (!newTitle.trim() || !selectedTopic || !subject) return alert('Hãy chọn chủ đề và nhập tên file.');
    try {
      setCreating(true);
      const result = await examAdminApi.createExam({
        title: newTitle.trim(),
        subjectId: subject.id,
        duration: 60,
        totalPoints: 100,
        description: newDescription.trim(),
        languageMode: newLanguageMode,
        is_simulated: false,
      });
      setEditorFile({ examId: result.exam.id, title: result.exam.title, subjectId: subject.id, subjectCode: subject.code, subjectName: subject.name, status: result.exam.status, languageMode: result.exam.language_mode || newLanguageMode, topicId: selectedTopic.id });
      setShowCreateFile(false);
      setNewTitle('');
      setNewDescription('');
      setNewLanguageMode('zh');
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Không tạo được file luyện.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <AdminLayout title="Luyện chủ đề" description="Tạo chủ đề trước, sau đó thêm PDF và đáp án vào từng chủ đề">
      <section className="space-y-5">
        <div className="rounded-3xl border border-red-100 bg-gradient-to-br from-white via-rose-50 to-red-50 p-6 shadow-sm dark:border-slate-800 dark:from-[#111b2d] dark:via-[#101c31] dark:to-[#1d1730] dark:shadow-none">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><p className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-red-700 dark:bg-red-500/15 dark:text-red-200"><FiTarget /> Quản lý kho luyện</p><h2 className="mt-3 text-2xl font-black text-slate-950 dark:text-white">Chủ đề → bộ PDF đa ngôn ngữ → đáp án → thống kê</h2><p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">Mỗi chủ đề có nhiều bộ luyện. Trong từng bộ, admin lần lượt tải PDF Việt, Anh hoặc Trung; học viên tự chọn phiên bản muốn làm.</p></div><div className="flex flex-wrap gap-3"><Link href="/admin/risk-center" className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white/75 px-4 py-3 text-sm font-black text-red-700 hover:bg-red-50 dark:border-red-500/35 dark:bg-slate-950/40 dark:text-red-200 dark:hover:bg-red-500/10"><FiAlertCircle /> Risk Center</Link><button type="button" onClick={() => setShowCreateTopic(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white hover:bg-red-700"><FiPlus /> Tạo chủ đề</button></div></div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{([
          ['Chủ đề luyện', totals.topics, FiLayers, 'text-red-600 dark:text-red-300'],
          ['File đã cấu hình', totals.files, FiFileText, 'text-emerald-600 dark:text-emerald-300'],
          ['Người học', totals.learners, FiUsers, 'text-blue-600 dark:text-blue-300'],
          ['Tổng lượt luyện', totals.attempts, FiBarChart2, 'text-violet-600 dark:text-violet-300'],
        ] as Array<[string, number, IconType, string]>).map(([label, value, Icon, color]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#111b2d] dark:shadow-none"><Icon className={color} size={20} /><p className="mt-3 text-2xl font-black text-slate-950 dark:text-white">{value}</p><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p></div>)}</div>

        <div className="flex flex-wrap items-center gap-3"><select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><option value="">Tất cả môn</option>{subjects.map((subject) => <option key={subject.id} value={subject.code}>{subject.name}</option>)}</select><button type="button" onClick={load} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"><FiRefreshCw className={loading ? 'animate-spin' : ''} /> Làm mới</button></div>

        <section>
          <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-lg font-black text-slate-950 dark:text-white">Chủ đề luyện</h3><p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-300">Mở một chủ đề, tạo một bộ luyện rồi tải các phiên bản PDF theo từng ngôn ngữ.</p></div><span className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-black text-red-700 dark:bg-red-500/15 dark:text-red-200">Bước 1</span></div>
          {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-400 dark:border-slate-800 dark:bg-[#111b2d]">Đang tải chủ đề...</div> : topics.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-9 text-center dark:border-slate-700 dark:bg-[#111b2d]"><FiFolder className="mx-auto text-red-500" size={28} /><p className="mt-3 font-black text-slate-800 dark:text-white">Chưa có chủ đề luyện</p><p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-300">Tạo chủ đề đầu tiên trước khi thêm file.</p><button type="button" onClick={() => setShowCreateTopic(true)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-black text-white hover:bg-red-700"><FiPlus /> Tạo chủ đề đầu tiên</button></div> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{topics.map((topic) => { const files = filesByTopic(topic.id); return <article key={topic.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-red-200 dark:border-slate-800 dark:bg-[#111b2d] dark:hover:border-red-500/40"><div className="flex items-start justify-between gap-3"><span className="rounded-xl bg-red-50 p-2.5 text-red-600 dark:bg-red-500/15 dark:text-red-300"><FiFolder size={19} /></span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">{topic.subject_name}</span></div><h4 className="mt-4 truncate text-base font-black text-slate-950 dark:text-white">{topic.name}</h4><p className="mt-1 line-clamp-2 min-h-10 text-sm font-medium text-slate-500 dark:text-slate-300">{topic.description || 'Thêm các file PDF cùng nội dung vào chủ đề này.'}</p><div className="mt-4 flex items-center justify-between gap-3"><span className="text-xs font-bold text-slate-500 dark:text-slate-300">{files.length} file · {files.filter((file) => file.status === 'published').length} đã đăng</span><button type="button" onClick={() => { setSelectedTopic(topic); setNewTitle(''); setNewDescription(''); setNewLanguageMode('zh'); setShowCreateFile(true); }} className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-2 text-xs font-black text-white hover:bg-red-700"><FiPlus /> Thêm file</button></div></article>; })}</div>}
        </section>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#111b2d] dark:shadow-none">
          {loading ? <div className="p-12 text-center text-sm font-bold text-slate-400">Đang tải file luyện...</div> : items.length === 0 ? <div className="p-12 text-center text-sm font-bold text-slate-400">Chưa có file PDF luyện tập. Hãy tạo chủ đề, mở card chủ đề rồi thêm file.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-sm"><thead><tr className="border-b border-slate-100 text-left text-[11px] font-black uppercase tracking-wide text-slate-400 dark:border-slate-800"><th className="px-5 py-4">File / chủ đề</th><th className="px-4 py-4">Trạng thái</th><th className="px-4 py-4 text-center">Đáp án</th><th className="px-4 py-4 text-center">Người học</th><th className="px-4 py-4 text-center">Lượt luyện</th><th className="px-4 py-4 text-center">Điểm TB</th><th className="px-5 py-4 text-right">Thao tác</th></tr></thead><tbody>{items.map((item) => <tr key={item.exam_id} className="border-b border-slate-50 last:border-0 hover:bg-red-50/40 dark:border-slate-800/70 dark:hover:bg-slate-800/40"><td className="px-5 py-4"><p className="font-black text-slate-950 dark:text-white">{item.title}</p><p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-300">{item.subject_name} · {item.topic_name || 'Chưa gán chủ đề'} · {languageLabel(item.language_mode)}</p><p className="mt-1 text-xs text-slate-400">{item.file_name} · {item.question_count} câu</p></td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${item.status === 'published' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200'}`}>{item.status === 'published' ? 'Đã đăng' : 'Nháp'}</span></td><td className="px-4 py-4 text-center"><span className={`font-black ${item.answers_ready ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>{item.answered_count}/{item.question_count}</span></td><td className="px-4 py-4 text-center font-black text-slate-700 dark:text-slate-200">{item.learner_count}</td><td className="px-4 py-4 text-center font-black text-slate-700 dark:text-slate-200">{item.attempt_count}</td><td className="px-4 py-4 text-center font-black text-slate-700 dark:text-slate-200">{Number(item.average_score).toFixed(1)}</td><td className="px-5 py-4 text-right"><button type="button" onClick={() => setEditorFile(toEditorFile(item))} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white hover:bg-slate-700 dark:bg-red-600 dark:hover:bg-red-700">Quản lý <FiChevronRight /></button></td></tr>)}</tbody></table></div>}
        </div>
      </section>

      {showCreateTopic && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"><div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-[#111b2d]"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-black text-slate-950 dark:text-white">Tạo chủ đề luyện</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Chủ đề là nơi chứa các file PDF cùng một nội dung.</p></div><button type="button" onClick={() => setShowCreateTopic(false)} className="text-slate-400 hover:text-red-600"><FiX size={22} /></button></div><label className="mt-5 block text-sm font-bold text-slate-700 dark:text-slate-200">Môn<select value={newSubjectId} onChange={(event) => setNewSubjectId(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-red-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="">Chọn môn</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label><label className="mt-4 block text-sm font-bold text-slate-700 dark:text-slate-200">Tên chủ đề<input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-red-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="Ví dụ: Hàm số" /></label><label className="mt-4 block text-sm font-bold text-slate-700 dark:text-slate-200">Mô tả (không bắt buộc)<textarea value={newDescription} onChange={(event) => setNewDescription(event.target.value)} className="mt-1.5 min-h-24 w-full rounded-xl border border-slate-200 bg-white p-3 outline-none focus:border-red-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="Nội dung trọng tâm của chủ đề" /></label><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setShowCreateTopic(false)} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300">Hủy</button><button type="button" onClick={createTopic} disabled={creating} className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-black text-white hover:bg-red-700 disabled:opacity-50">{creating ? 'Đang tạo...' : 'Tạo chủ đề'}</button></div></div></div>}
      {showCreateFile && selectedTopic && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"><div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-[#111b2d]"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-widest text-red-500">Thêm file vào chủ đề</p><h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">{selectedTopic.name}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-300">{selectedTopic.subject_name} · Mỗi ngôn ngữ là một file PDF và có file lời giải riêng.</p></div><button type="button" onClick={() => setShowCreateFile(false)} className="text-slate-400 hover:text-red-600"><FiX size={22} /></button></div><label className="mt-5 block text-sm font-bold text-slate-700 dark:text-slate-200">Tên file<input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-red-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="Ví dụ: Hàm số — Bộ 01" /></label><label className="mt-4 block text-sm font-bold text-slate-700 dark:text-slate-200">Ngôn ngữ của file PDF<select value={newLanguageMode} onChange={(event) => setNewLanguageMode(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-red-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="vi">Tiếng Việt</option><option value="en">English</option><option value="zh">中文</option></select></label><label className="mt-4 block text-sm font-bold text-slate-700 dark:text-slate-200">Ghi chú (không bắt buộc)<textarea value={newDescription} onChange={(event) => setNewDescription(event.target.value)} className="mt-1.5 min-h-24 w-full rounded-xl border border-slate-200 bg-white p-3 outline-none focus:border-red-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="Nội dung trọng tâm của file" /></label><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setShowCreateFile(false)} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300">Hủy</button><button type="button" onClick={createPracticeFile} disabled={creating} className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-black text-white hover:bg-red-700 disabled:opacity-50">{creating ? 'Đang tạo...' : 'Tạo và cấu hình'}</button></div></div></div>}
      {editorFile && <PracticeEditor file={editorFile} onClose={() => setEditorFile(null)} onChanged={load} />}
    </AdminLayout>
  );
}
