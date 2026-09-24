'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { FiCheck, FiFileText, FiRefreshCw, FiSave, FiTrash2, FiUpload } from 'react-icons/fi';
import { examAdminApi, RoomPaperConfig } from '@/lib/api/examAdmin';

const OPTION_KEYS = ['A', 'B', 'C', 'D'];

function formatBytes(value?: number) {
  const bytes = Number(value) || 0;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export default function RoomExamPaperPanel({
  examId,
  onConfigChange,
  showSolutionFile = false,
}: {
  examId: number;
  onConfigChange?: (config: RoomPaperConfig) => void;
  showSolutionFile?: boolean;
}) {
  const paperInputRef = useRef<HTMLInputElement>(null);
  const solutionInputRef = useRef<HTMLInputElement>(null);
  const [config, setConfig] = useState<RoomPaperConfig | null>(null);
  const [questionCount, setQuestionCount] = useState(40);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [uploadingPaper, setUploadingPaper] = useState(false);
  const [uploadingSolution, setUploadingSolution] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingPaper, setDeletingPaper] = useState(false);
  const [deletingSolution, setDeletingSolution] = useState(false);
  const [bulkAnswerText, setBulkAnswerText] = useState('');
  const [bulkAnswerMessage, setBulkAnswerMessage] = useState('');

  const loadConfig = async () => {
    try {
      setLoading(true);
      const next = await examAdminApi.getRoomPaperConfig(examId);
      setConfig(next);
      onConfigChange?.(next);
      setQuestionCount(next.questionCount || 40);
      setAnswers(Object.fromEntries((next.answers || []).map((item) => [item.questionNumber, item.answerKey])));
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Không tải được đề PDF và đáp án.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (examId) loadConfig();
  }, [examId]);

  const answeredCount = useMemo(
    () => Array.from({ length: questionCount }, (_, index) => answers[index + 1])
      .filter((key) => OPTION_KEYS.includes(key)).length,
    [answers, questionCount],
  );
  const locked = Number(config?.attemptCount) > 0;

  const uploadPaper = async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      alert('Chỉ nhận file PDF.');
      return;
    }
    try {
      setUploadingPaper(true);
      await examAdminApi.uploadExamPaper(examId, file);
      await loadConfig();
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Tải đề PDF thất bại.');
    } finally {
      setUploadingPaper(false);
    }
  };

  const deletePaper = async () => {
    if (!config?.paper || !confirm('Xóa file PDF đang dùng trong phòng thi?')) return;
    try {
      setDeletingPaper(true);
      await examAdminApi.deleteExamSourceFile(examId, config.paper.id);
      await loadConfig();
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Xóa đề PDF thất bại.');
    } finally {
      setDeletingPaper(false);
    }
  };

  const uploadSolution = async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      alert('Chỉ nhận file PDF.');
      return;
    }
    try {
      setUploadingSolution(true);
      await examAdminApi.uploadExamSolutionFile(examId, file);
      await loadConfig();
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Tải file PDF lời giải thất bại.');
    } finally {
      setUploadingSolution(false);
    }
  };

  const deleteSolution = async () => {
    if (!config?.solution || !confirm('Xóa file PDF lời giải?')) return;
    try {
      setDeletingSolution(true);
      await examAdminApi.deleteExamSourceFile(examId, config.solution.id);
      await loadConfig();
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Xóa file PDF lời giải thất bại.');
    } finally {
      setDeletingSolution(false);
    }
  };

  const applyBulkAnswers = () => {
    const answerPattern = /(?:CÂU\s*)?(\d{1,3})\s*(?:[.:\-/]\s*)?(?:Đ\/A|ĐÁP\s*ÁN)?\s*[:.-]?\s*([A-D])\b/gi;
    const parsed = new Map<number, string>();
    const duplicateNumbers = new Set<number>();
    let match: RegExpExecArray | null;

    while ((match = answerPattern.exec(bulkAnswerText.toUpperCase())) !== null) {
      const questionNumber = Number.parseInt(match[1], 10);
      const answerKey = match[2];
      if (!Number.isInteger(questionNumber) || questionNumber < 1 || questionNumber > 200) continue;
      if (parsed.has(questionNumber)) duplicateNumbers.add(questionNumber);
      parsed.set(questionNumber, answerKey);
    }

    if (parsed.size === 0) {
      setBulkAnswerMessage('Chưa đọc được đáp án. Hãy dán theo dạng “1 B  2 C  3 A” hoặc “Câu 1: B”.');
      return;
    }

    const highestQuestionNumber = Math.max(...parsed.keys());
    const nextQuestionCount = answeredCount === 0
      ? highestQuestionNumber
      : Math.max(questionCount, highestQuestionNumber);
    setQuestionCount(Math.min(200, nextQuestionCount));
    setAnswers((current) => ({ ...current, ...Object.fromEntries(parsed) }));
    setBulkAnswerMessage(
      `Đã tự điền ${parsed.size} đáp án${duplicateNumbers.size ? ` (đã dùng đáp án xuất hiện sau cùng cho ${duplicateNumbers.size} câu trùng)` : ''}. Kiểm tra bảng bên dưới trước khi lưu và đăng.`,
    );
  };

  const saveAnswers = async () => {
    if (!config?.paper) return alert('Hãy tải file PDF đề thi trước.');
    const missing = Array.from({ length: questionCount }, (_, index) => index + 1)
      .filter((number) => !OPTION_KEYS.includes(answers[number]));
    if (missing.length > 0) {
      alert(`Chưa chọn đáp án câu ${missing.slice(0, 12).join(', ')}${missing.length > 12 ? '...' : ''}.`);
      return;
    }
    if (!confirm(`Lưu đáp án cho ${questionCount} câu? Cấu hình câu hỏi cũ của đề sẽ được thay bằng bảng đáp án này.`)) return;
    try {
      setSaving(true);
      const result = await examAdminApi.saveRoomPaperConfig(examId, {
        questionCount,
        answers: Array.from({ length: questionCount }, (_, index) => ({
          questionNumber: index + 1,
          answerKey: answers[index + 1],
        })),
      });
      alert(result.message || 'Đã lưu đáp án.');
      await loadConfig();
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Lưu đáp án thất bại.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !config) {
    return (
      <div className="flex min-h-60 items-center justify-center rounded-2xl border border-gray-200 bg-white">
        <FiRefreshCw className="animate-spin text-violet-600" size={28} />
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-blue-950 shadow-sm dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black"><FiFileText /> Đề PDF phòng thi</h2>
            <p className="mt-1 max-w-3xl text-sm text-blue-800 dark:text-blue-200">
              Thí sinh đọc đề trực tiếp từ PDF. Admin chỉ cần tải file, nhập số câu và chọn đáp án đúng; không OCR và không nhập lại nội dung câu hỏi.
            </p>
          </div>
          <input
            ref={paperInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) uploadPaper(file);
            }}
          />
          <button
            type="button"
            onClick={() => paperInputRef.current?.click()}
            disabled={uploadingPaper || locked}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploadingPaper ? <FiRefreshCw className="animate-spin" /> : <FiUpload />}
            {config?.paper ? 'Thay file PDF' : 'Tải file PDF'}
          </button>
        </div>

        {config?.paper ? (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-blue-200 bg-white p-4 text-sm md:flex-row md:items-center md:justify-between dark:bg-slate-900">
            <div className="min-w-0">
              <p className="truncate font-black">{config.paper.fileName}</p>
              <p className="mt-1 text-xs text-gray-500">
                {formatBytes(config.paper.fileSize)}{config.paper.pages ? ` · ${config.paper.pages} trang` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={deletePaper}
              disabled={deletingPaper || locked}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            >
              <FiTrash2 /> {deletingPaper ? 'Đang xóa...' : 'Xóa PDF'}
            </button>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-blue-300 bg-white/60 p-4 text-sm font-bold text-blue-700">
            Chưa có file PDF đề thi.
          </div>
        )}
      </div>

      {locked && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
          {showSolutionFile
            ? `Đề đã có ${config?.attemptCount} lượt thi. File PDF và đáp án đã được khóa để bảo toàn kết quả; bạn vẫn có thể cập nhật file lời giải.`
            : `Đề đã có ${config?.attemptCount} lượt thi. File PDF và đáp án đã được khóa để bảo toàn kết quả.`}
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 border-b border-gray-100 pb-5 dark:border-slate-800 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-black text-gray-900 dark:text-white">Bảng đáp án chấm thi</h2>
            <p className="mt-1 text-sm text-gray-500">Đã nhập {answeredCount}/{questionCount} câu.</p>
          </div>
          <label className="w-full max-w-48 text-sm font-bold text-gray-700 dark:text-slate-200">
            Số câu trong đề
            <input
              type="number"
              min={1}
              max={200}
              value={questionCount}
              disabled={locked}
              onChange={(event) => setQuestionCount(Math.max(1, Math.min(200, Number(event.target.value) || 1)))}
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-gray-900 outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-gray-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:disabled:bg-slate-800"
            />
          </label>
        </div>

        {showSolutionFile && <div className="mt-4 flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/25 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-black text-emerald-950 dark:text-emerald-100"><FiFileText /> File lời giải PDF <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700 dark:bg-emerald-900/70 dark:text-emerald-100">Tùy chọn</span></p>
            {config?.solution ? (
              <p className="mt-1 truncate text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                {config.solution.fileName} · {formatBytes(config.solution.fileSize)}{config.solution.pages ? ` · ${config.solution.pages} trang` : ''}
              </p>
            ) : (
              <p className="mt-1 text-xs font-semibold text-emerald-800 dark:text-emerald-200">Hiển thị cho học viên sau khi đã nộp bài.</p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <input
              ref={solutionInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) uploadSolution(file);
              }}
            />
            <button
              type="button"
              onClick={() => solutionInputRef.current?.click()}
              disabled={uploadingSolution}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploadingSolution ? <FiRefreshCw className="animate-spin" /> : <FiUpload />}
              {config?.solution ? 'Thay file lời giải' : 'Tải file lời giải'}
            </button>
            {config?.solution && <button
              type="button"
              onClick={deleteSolution}
              disabled={deletingSolution}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:bg-slate-950 dark:text-rose-300 dark:hover:bg-rose-950/40"
            >
              <FiTrash2 /> {deletingSolution ? 'Đang xóa...' : 'Xóa'}
            </button>}
          </div>
        </div>}

        {showSolutionFile && config?.solution && <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/70 p-4 dark:border-violet-900 dark:bg-violet-950/25">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <label className="block min-w-0 flex-1 text-sm font-black text-violet-950 dark:text-violet-100">
              Dán bảng đáp án từ file lời giải
              <textarea
                value={bulkAnswerText}
                disabled={locked}
                onChange={(event) => {
                  setBulkAnswerText(event.target.value);
                  setBulkAnswerMessage('');
                }}
                className="mt-2 min-h-24 w-full rounded-lg border border-violet-200 bg-white p-3 font-mono text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-violet-500 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-violet-900 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-800"
                placeholder={'Câu  Đ/A    Câu  Đ/A\n1     B      11    B\n2     C      12    B\n3     A      13    B'}
              />
            </label>
            <button
              type="button"
              onClick={applyBulkAnswers}
              disabled={locked || !bulkAnswerText.trim()}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-black text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FiCheck /> Tự điền đáp án
            </button>
          </div>
          <p className="mt-2 text-xs font-semibold text-violet-800 dark:text-violet-200">Hỗ trợ dạng <span className="font-mono">1 B  2 C  3 A</span> hoặc <span className="font-mono">Câu 1: B</span>. Sau khi tự điền, bạn vẫn có thể sửa từng ô trước khi lưu.</p>
          {bulkAnswerMessage && <p className="mt-2 text-xs font-black text-violet-700 dark:text-violet-200">{bulkAnswerMessage}</p>}
        </div>}

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: questionCount }, (_, index) => index + 1).map((number) => (
            <div key={number} className="rounded-xl border border-gray-200 p-3 dark:border-slate-700">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-black text-gray-900 dark:text-white">Câu {number}</span>
                {answers[number] && <FiCheck className="text-emerald-500" />}
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {OPTION_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    disabled={locked}
                    onClick={() => setAnswers((current) => ({ ...current, [number]: key }))}
                    className={`rounded-lg border py-2 text-sm font-black transition-colors disabled:cursor-not-allowed ${
                      answers[number] === key
                        ? 'border-violet-600 bg-violet-600 text-white'
                        : 'border-gray-200 text-gray-600 hover:border-violet-300 hover:bg-violet-50 dark:border-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {key}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-gray-100 pt-5 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
          <p className={`text-sm font-bold ${config?.ready ? 'text-emerald-600' : 'text-amber-600'}`}>
            {config?.ready ? 'Đề đã sẵn sàng mở phòng thi.' : 'Cần có PDF và nhập đủ đáp án rồi bấm Lưu.'}
          </p>
          <button
            type="button"
            onClick={saveAnswers}
            disabled={saving || locked}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-black text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <FiRefreshCw className="animate-spin" /> : <FiSave />}
            {saving ? 'Đang lưu...' : 'Lưu bảng đáp án'}
          </button>
        </div>
      </div>
    </section>
  );
}
