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

export default function RoomExamPaperPanel({ examId }: { examId: number }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [config, setConfig] = useState<RoomPaperConfig | null>(null);
  const [questionCount, setQuestionCount] = useState(40);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const next = await examAdminApi.getRoomPaperConfig(examId);
      setConfig(next);
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
      setUploading(true);
      await examAdminApi.uploadExamPaper(examId, file);
      await loadConfig();
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Tải đề PDF thất bại.');
    } finally {
      setUploading(false);
    }
  };

  const deletePaper = async () => {
    if (!config?.paper || !confirm('Xóa file PDF đang dùng trong phòng thi?')) return;
    try {
      setDeleting(true);
      await examAdminApi.deleteExamSourceFile(examId, config.paper.id);
      await loadConfig();
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Xóa đề PDF thất bại.');
    } finally {
      setDeleting(false);
    }
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
            ref={inputRef}
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
            onClick={() => inputRef.current?.click()}
            disabled={uploading || locked}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? <FiRefreshCw className="animate-spin" /> : <FiUpload />}
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
              disabled={deleting || locked}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            >
              <FiTrash2 /> {deleting ? 'Đang xóa...' : 'Xóa PDF'}
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
          Đề đã có {config?.attemptCount} lượt thi. File PDF và đáp án đã được khóa để bảo toàn kết quả.
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
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-gray-100"
            />
          </label>
        </div>

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
