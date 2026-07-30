'use client';

import { useCallback, useEffect, useState } from 'react';
import { FiAlertTriangle, FiCheckCircle, FiDatabase, FiDownload, FiFolder, FiHardDrive, FiRefreshCw } from 'react-icons/fi';
import AdminLayout from '@/components/layout/AdminLayout';
import { adminApi, type DatabaseBackupStatus } from '@/lib/api/admin';

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** unitIndex)).toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);
}

export default function AdminBackupsPage() {
  const [status, setStatus] = useState<DatabaseBackupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadBackups = useCallback(async () => {
    try {
      setError('');
      const response = await adminApi.getDatabaseBackups();
      setStatus(response.data);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Không thể tải danh sách sao lưu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBackups();
  }, [loadBackups]);

  const createBackup = async () => {
    try {
      setCreating(true);
      setMessage('');
      setError('');
      const response = await adminApi.createDatabaseBackup();
      setMessage(`${response.message} File: ${response.data.fileName}`);
      await loadBackups();
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Không thể tạo bản sao lưu.');
    } finally {
      setCreating(false);
    }
  };

  const downloadBackup = async (fileName: string) => {
    try {
      setDownloading(fileName);
      setError('');
      const blob = await adminApi.downloadDatabaseBackup(fileName);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Không thể tải file sao lưu.');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <AdminLayout title="Sao lưu dữ liệu" description="Tạo và quản lý bản sao lưu PostgreSQL — chỉ dành cho Admin tổng">
      <div className="max-w-6xl space-y-6">
        {message && (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
            <FiCheckCircle className="mt-0.5 shrink-0" size={18} />
            <p className="text-sm font-medium">{message}</p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
            <FiAlertTriangle className="mt-0.5 shrink-0" size={18} />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {status?.isRailway && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
            <FiAlertTriangle className="mt-0.5 shrink-0" size={18} />
            <p className="text-sm">Backend đang chạy trên Railway. File được lưu trên filesystem của Railway, không phải ổ C trên máy cá nhân và có thể mất khi deploy lại. Hãy tải file xuống sau khi tạo hoặc cấu hình Railway Volume.</p>
          </div>
        )}

        {status && !status.pgDumpAvailable && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
            <FiAlertTriangle className="mt-0.5 shrink-0" size={18} />
            <p className="text-sm">Máy chạy backend chưa có PostgreSQL client (`pg_dump`). Hãy cài PostgreSQL client hoặc cấu hình biến `PG_DUMP_PATH`; bản Docker production đã được cài sẵn.</p>
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300"><FiDatabase size={21} /></div>
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white">PostgreSQL backup</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Định dạng custom `.dump`, nén và phục hồi bằng pg_restore</p>
              </div>
            </div>
            <button type="button" onClick={createBackup} disabled={creating || loading || !status?.directoryWritable || !status?.pgDumpAvailable || status?.inProgress} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50">
              <FiHardDrive className={creating ? 'animate-pulse' : ''} size={17} />
              {creating ? 'Đang sao lưu…' : 'Tạo bản sao lưu ngay'}
            </button>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/70">
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Thư mục lưu</p>
              <p className="break-all text-sm font-semibold text-slate-700 dark:text-slate-200">{status?.directory || 'Đang đọc…'}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/70">
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Cơ sở dữ liệu</p>
              <p className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">{status ? `${status.database} @ ${status.host}` : 'Đang đọc…'}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/70">
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Trạng thái thư mục</p>
              <p className={`text-sm font-semibold ${status?.directoryWritable ? 'text-emerald-600' : 'text-red-600'}`}>{status?.directoryWritable ? 'Có thể ghi dữ liệu' : 'Không thể ghi dữ liệu'}</p>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <FiFolder className="text-violet-500" />
              <h2 className="font-bold text-slate-900 dark:text-white">Các bản sao lưu</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">{status?.backups.length || 0}</span>
            </div>
            <button type="button" onClick={() => { setLoading(true); loadBackups(); }} disabled={loading} className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-violet-600 disabled:opacity-50 dark:hover:bg-slate-800" title="Làm mới">
              <FiRefreshCw className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500">Đang tải danh sách…</div>
          ) : !status?.backups.length ? (
            <div className="p-10 text-center">
              <FiDatabase className="mx-auto mb-3 text-slate-300" size={34} />
              <p className="font-semibold text-slate-600 dark:text-slate-300">Chưa có bản sao lưu nào</p>
              <p className="mt-1 text-sm text-slate-400">Bấm “Tạo bản sao lưu ngay” để tạo file đầu tiên.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400 dark:bg-slate-800/60">
                  <tr><th className="px-5 py-3">Tên file</th><th className="px-5 py-3">Ngày tạo</th><th className="px-5 py-3">Dung lượng</th><th className="px-5 py-3 text-right">Thao tác</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {status.backups.map((backup) => (
                    <tr key={backup.fileName} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-4 font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">{backup.fileName}</td>
                      <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{formatDate(backup.createdAt)}</td>
                      <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{formatBytes(backup.size)}</td>
                      <td className="px-5 py-4 text-right">
                        <button type="button" onClick={() => downloadBackup(backup.fileName)} disabled={downloading === backup.fileName} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 px-3 py-1.5 text-xs font-bold text-violet-600 transition hover:bg-violet-50 disabled:opacity-50 dark:border-violet-900 dark:text-violet-300 dark:hover:bg-violet-950/30">
                          <FiDownload /> {downloading === backup.fileName ? 'Đang tải…' : 'Tải xuống'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
