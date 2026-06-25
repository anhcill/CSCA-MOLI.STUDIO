import { useRef } from 'react';
import { FiFileText, FiRefreshCw, FiTrash2, FiUpload } from 'react-icons/fi';
import type { AdminExamSourceFile } from '@/lib/api/examAdmin';

function formatBytes(value?: number) {
  const bytes = Number(value) || 0;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function formatSourceDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

interface ExamSourceFilePanelProps {
  sourceFiles: AdminExamSourceFile[];
  uploading: boolean;
  deletingId: number | null;
  onUpload: (file: File) => void;
  onDelete: (sourceFileId: number) => void;
}

export default function ExamSourceFilePanel({ sourceFiles, uploading, deletingId, onUpload, onDelete }: ExamSourceFilePanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const latestFile = sourceFiles[0];

  return (
    <div className="mb-6 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="flex items-center gap-2 font-black">
            <FiFileText size={16} />
            File gốc đối chiếu
          </p>
          <p className="mt-1 text-violet-800">Upload PDF/Word gốc để AI so đề trong DB với nguồn ban đầu, nhất là đáp án bị thiếu hoặc lệch khi import.</p>
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) onUpload(file);
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? <FiRefreshCw size={15} className="animate-spin" /> : <FiUpload size={15} />}
            {uploading ? 'Đang đọc file...' : 'Upload file gốc'}
          </button>
        </div>
      </div>

      {latestFile ? (
        <div className="mt-3 rounded-lg border border-violet-200 bg-white/80 px-3 py-2">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="truncate font-bold text-violet-950">{latestFile.fileName}</p>
              <p className="mt-1 text-xs font-semibold text-violet-700">
                {latestFile.fileType?.toUpperCase()} · {formatBytes(latestFile.fileSize)} · {latestFile.textLength || 0} ký tự
                {latestFile.pages ? ` · ${latestFile.pages} trang` : ''}
                {latestFile.createdAt ? ` · ${formatSourceDate(latestFile.createdAt)}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onDelete(latestFile.id)}
              disabled={deletingId === latestFile.id}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiTrash2 size={13} />
              {deletingId === latestFile.id ? 'Đang xóa...' : 'Xóa'}
            </button>
          </div>
          {sourceFiles.length > 1 && (
            <p className="mt-2 text-xs font-semibold text-violet-700">AI sẽ dùng file mới nhất. Đang lưu thêm {sourceFiles.length - 1} file cũ.</p>
          )}
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-dashed border-violet-300 bg-white/60 px-3 py-3 text-xs font-semibold text-violet-700">
          Chưa có file gốc. AI vẫn soát theo dữ liệu DB, nhưng không đối chiếu được nguồn import ban đầu.
        </div>
      )}
    </div>
  );
}
