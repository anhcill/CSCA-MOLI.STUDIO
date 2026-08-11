'use client';

import { useRef } from 'react';

const ACCEPT = 'image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,application/pdf,.doc,.docx';
const MAX_FILES = 20;

function key(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export function CourseFilePicker({
  files,
  onChange,
  disabled = false,
  label = 'Chọn hoặc dán ảnh/file',
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const append = (incoming: File[]) => {
    const accepted = incoming.filter((file) => (
      file.type.startsWith('image/')
      || file.type === 'application/pdf'
      || file.type === 'application/msword'
      || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      || /\.(doc|docx|pdf)$/i.test(file.name)
    ));
    const merged = new Map(files.map((file) => [key(file), file]));
    accepted.forEach((file) => merged.set(key(file), file));
    onChange(Array.from(merged.values()).slice(0, MAX_FILES));
  };

  return (
    <div
      onPaste={(event) => {
        if (disabled) return;
        const pasted = Array.from(event.clipboardData.items)
          .filter((item) => item.kind === 'file')
          .map((item) => item.getAsFile())
          .filter((file): file is File => Boolean(file));
        if (pasted.length) {
          event.preventDefault();
          append(pasted);
        }
      }}
      tabIndex={disabled ? -1 : 0}
      className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-4 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-indigo-500/10"
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        disabled={disabled}
        className="hidden"
        onChange={(event) => {
          append(Array.from(event.target.files || []));
          event.target.value = '';
        }}
      />
      <button type="button" disabled={disabled} onClick={() => inputRef.current?.click()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 dark:bg-indigo-600">
        {label}
      </button>
      <p className="mt-2 text-xs text-slate-500">Có thể chọn nhiều file hoặc bấm vào vùng này rồi Ctrl+V để dán nhiều ảnh. Tối đa 20 file, mỗi file 25 MB.</p>
      {files.length ? (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {files.map((file) => (
            <li key={key(file)} className="flex items-center justify-between gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs dark:bg-slate-800">
              <span className="min-w-0 truncate font-semibold">{file.name}</span>
              <button type="button" disabled={disabled} onClick={() => onChange(files.filter((item) => key(item) !== key(file)))} className="shrink-0 font-black text-red-600">Xóa</button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
