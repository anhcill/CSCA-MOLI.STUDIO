import { useRef } from 'react';
import { FiFileText, FiRefreshCw, FiTrash2, FiUpload } from 'react-icons/fi';
import type { AdminExamSourceFile } from '@/lib/api/examAdmin';

function formatBytes(value?: number) {
  const bytes = Number(value) || 0;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function FileSummary({ file, deletingId, onDelete }: {
  file: AdminExamSourceFile;
  deletingId: number | null;
  onDelete: (sourceFileId: number) => void;
}) {
  return (
    <div className="mt-3 rounded-lg border border-current/15 bg-white/80 px-3 py-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="truncate font-bold">{file.fileName}</p>
          <p className="mt-1 text-xs font-semibold opacity-75">
            {file.fileType?.toUpperCase()} · {formatBytes(file.fileSize)}
            {file.pages ? ` · ${file.pages} trang` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onDelete(file.id)}
          disabled={deletingId === file.id}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
        >
          <FiTrash2 size={13} />
          {deletingId === file.id ? 'Đang xóa...' : 'Xóa'}
        </button>
      </div>
    </div>
  );
}

interface ExamSourceFilePanelProps {
  sourceFiles: AdminExamSourceFile[];
  uploading: boolean;
  deletingId: number | null;
  onUpload: (file: File) => void;
  onDelete: (sourceFileId: number) => void;
}

export default function ExamSourceFilePanel({
  sourceFiles,
  uploading,
  deletingId,
  onUpload,
  onDelete,
}: ExamSourceFilePanelProps) {
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const latestSourceFile = sourceFiles.find((file) => !file.isExamPaper);

  return (
    <div className="mb-6">
      <section className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="flex items-center gap-2 font-black"><FiFileText size={16} /> File gốc đối chiếu AI</p>
            <p className="mt-1 text-violet-800">PDF/Word nguồn chỉ để AI soát dữ liệu, không hiển thị trong phòng thi.</p>
          </div>
          <input
            ref={sourceInputRef}
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
            onClick={() => sourceInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            {uploading ? <FiRefreshCw size={15} className="animate-spin" /> : <FiUpload size={15} />}
            {uploading ? 'Đang đọc...' : 'Upload file nguồn'}
          </button>
        </div>
        {latestSourceFile ? (
          <FileSummary file={latestSourceFile} deletingId={deletingId} onDelete={onDelete} />
        ) : (
          <div className="mt-3 rounded-lg border border-dashed border-violet-300 bg-white/60 px-3 py-3 text-xs font-semibold text-violet-700">Chưa có file nguồn đối chiếu AI.</div>
        )}
      </section>
    </div>
  );
}
