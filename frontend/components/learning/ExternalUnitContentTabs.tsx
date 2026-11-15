'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import katex from 'katex';
import {
  FiBookOpen,
  FiBookmark,
  FiCheckCircle,
  FiClock,
  FiCpu,
  FiFileText,
  FiLayers,
  FiList,
  FiLock,
  FiPlay,
  FiSave,
  FiVolume2,
} from 'react-icons/fi';
import type {
  ExternalUnitDetailDto,
  ExternalUnitTimestampDto,
  ExternalWorkspaceCapabilitiesDto,
  ExternalWorkspaceUnitSummaryDto,
} from '@/lib/types/courses';
import { CourseSsoLaunchButton } from '@/components/courses/CourseSsoLaunchButton';
import RichMathText from '@/components/common/RichMathText';

type ExternalTabId =
  | 'theory'
  | 'vocabulary'
  | 'formulas'
  | 'files'
  | 'assessments'
  | 'notes'
  | 'curriculum';

interface Props {
  courseId: number;
  courseSlug: string;
  ssoTargetPath: string | null;
  unit: ExternalUnitDetailDto | null;
  capabilities: ExternalWorkspaceCapabilitiesDto;
  isPublicPreviewAccess: boolean;
  units: ExternalWorkspaceUnitSummaryDto[];
  activeUnitProjectionId: number;
  onSeekVideo: (seconds: number) => void;
}

const ALLOWED_HTML_TAGS = new Set([
  'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'DEL', 'SUB', 'SUP',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE',
  'CODE', 'PRE', 'HR', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD',
  'SPAN', 'DIV', 'A', 'IMG',
]);

function isSafeHttpOrRelativeUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.toString();
    return null;
  } catch {
    return null;
  }
}

function sanitizeTheoryHtml(rawHtml: string): string {
  if (!rawHtml) return '';
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return rawHtml
      .replace(/<(script|style|iframe|object|embed|form|input|meta|link)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/<(script|style|iframe|object|embed|form|input|meta|link)\b[^>]*>/gi, '')
      .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  }

  const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const el = child as Element;
      const tag = el.tagName.toUpperCase();
      if (!ALLOWED_HTML_TAGS.has(tag)) {
        el.remove();
        continue;
      }
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        if (name.startsWith('on') || name === 'srcdoc' || name === 'style') {
          el.removeAttribute(attr.name);
          continue;
        }
        if (tag === 'A' && name === 'href') {
          const safe = isSafeHttpOrRelativeUrl(attr.value);
          if (!safe && !attr.value.startsWith('#')) el.removeAttribute('href');
          else {
            el.setAttribute('rel', 'noopener noreferrer');
            el.setAttribute('target', '_blank');
          }
        } else if (tag === 'IMG' && name === 'src') {
          const safe = isSafeHttpOrRelativeUrl(attr.value);
          if (!safe) el.removeAttribute('src');
        } else if (!['alt', 'title', 'colspan', 'rowspan', 'href', 'src', 'rel', 'target'].includes(name)) {
          el.removeAttribute(attr.name);
        }
      }
      walk(el);
    }
  };
  walk(doc.body);
  return doc.body.innerHTML;
}

function parseTimestampSeconds(ts: ExternalUnitTimestampDto): number {
  if (typeof ts.timeSeconds === 'number' && Number.isFinite(ts.timeSeconds)) return Math.max(0, Math.floor(ts.timeSeconds));
  if (typeof ts.seconds === 'number' && Number.isFinite(ts.seconds)) return Math.max(0, Math.floor(ts.seconds));
  if (typeof ts.time === 'string') {
    const parts = ts.time.split(':').map((n) => Number(n));
    if (parts.every((n) => Number.isFinite(n) && n >= 0)) {
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
  }
  return 0;
}

function formatDuration(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const rem = sec % 60;
  if (hours > 0) return `${hours}:${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderLatexToHtml(latex: string): string {
  try {
    return katex.renderToString(latex || '', {
      displayMode: true,
      throwOnError: false,
      strict: false,
      trust: false,
    });
  } catch {
    return '';
  }
}

export function ExternalUnitContentTabs({
  courseId,
  courseSlug,
  ssoTargetPath,
  unit,
  capabilities,
  isPublicPreviewAccess,
  units,
  activeUnitProjectionId,
  onSeekVideo,
}: Props) {
  const [activeTab, setActiveTab] = useState<ExternalTabId>('theory');
  const [localNote, setLocalNote] = useState('');
  const [localNoteSaved, setLocalNoteSaved] = useState(false);
  const [playingVocabId, setPlayingVocabId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const vocabulary = unit?.vocabulary ?? [];
  const formulas = unit?.formulas ?? [];
  const files = unit?.files ?? [];
  const quizzes = unit?.quizzes ?? [];
  const assignments = unit?.assignments ?? [];
  const notes = unit?.notes ?? [];

  useEffect(() => {
    setActiveTab('theory');
    if (typeof window !== 'undefined' && activeUnitProjectionId > 0) {
      setLocalNote(window.localStorage.getItem(`csca-ext-unit-note:${activeUnitProjectionId}`) || '');
    }
    setLocalNoteSaved(false);
  }, [activeUnitProjectionId]);

  const sanitizedTheoryHtml = useMemo(
    () => sanitizeTheoryHtml(unit?.theory?.contentHtml || ''),
    [unit?.theory?.contentHtml],
  );

  const saveLocalNote = () => {
    if (typeof window !== 'undefined' && activeUnitProjectionId > 0) {
      window.localStorage.setItem(`csca-ext-unit-note:${activeUnitProjectionId}`, localNote);
      setLocalNoteSaved(true);
      window.setTimeout(() => setLocalNoteSaved(false), 1800);
    }
  };

  const playVocabAudio = (id: string, url: string) => {
    const safeUrl = isSafeHttpOrRelativeUrl(url);
    if (!safeUrl) return;
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(safeUrl);
    audioRef.current = audio;
    setPlayingVocabId(id);
    audio.onended = () => setPlayingVocabId((curr) => (curr === id ? null : curr));
    audio.onerror = () => setPlayingVocabId((curr) => (curr === id ? null : curr));
    void audio.play().catch(() => setPlayingVocabId(null));
  };

  const tabs: Array<{ id: ExternalTabId; label: string; icon: typeof FiBookOpen }> = [
    { id: 'theory', label: 'Lý thuyết & Transcript', icon: FiBookOpen },
    { id: 'vocabulary', label: `Từ vựng (${vocabulary.length})`, icon: FiLayers },
    { id: 'formulas', label: `Công thức (${formulas.length})`, icon: FiCpu },
    { id: 'files', label: `Tài liệu (${files.length})`, icon: FiFileText },
    { id: 'assessments', label: `Quiz & Bài tập (${quizzes.length + assignments.length})`, icon: FiCheckCircle },
    { id: 'notes', label: `Ghi chú (${notes.length})`, icon: FiBookmark },
    { id: 'curriculum', label: `Danh sách bài (${units.length})`, icon: FiList },
  ];

  const timestamps = unit?.theory?.timestamps ?? [];
  const takeaways = unit?.theory?.keyTakeaways ?? [];
  const profileAllowsDownload = !isPublicPreviewAccess && capabilities.allowFileDownload !== false;

  return (
    <article className="overflow-hidden rounded-2xl border border-[#dfd0c2] bg-[#fffaf4] shadow-sm transition-colors dark:border-[#2d3b52] dark:bg-[#0b172b]">
      <div className="border-b border-[#e5d9ce] px-4 dark:border-[#2d3b52] sm:px-6">
        <div className="flex max-w-full gap-1 overflow-x-auto [scrollbar-width:none]">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-4 text-sm font-bold transition ${
                activeTab === id
                  ? 'border-[#ad2033] text-[#ad2033] dark:text-[#f08d9c]'
                  : 'border-transparent text-[#6f665f] hover:text-[#29354b] dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Icon /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-48 p-5 text-sm leading-7 text-[#5d5854] dark:text-slate-300 sm:p-8">
        {activeTab === 'theory' ? (
          <div className="space-y-6">
            {unit?.description ? (
              <p className="text-base font-semibold text-[#3e4655] dark:text-slate-200">{unit.description}</p>
            ) : null}

            {unit?.theory?.summary ? (
              <div className="rounded-xl border border-[#e3d4c5] bg-[#fffdf9] p-4 dark:border-[#2d3b52] dark:bg-[#101e33]">
                <p className="text-xs font-black uppercase tracking-wider text-[#247d7e]">Tóm tắt bài học</p>
                <p className="mt-1 font-medium text-[#2c3548] dark:text-slate-200">{unit.theory.summary}</p>
              </div>
            ) : null}

            {takeaways.length > 0 ? (
              <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/70 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/25">
                <p className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Điểm trọng tâm</p>
                <ul className="mt-2 space-y-1.5">
                  {takeaways.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-emerald-950 dark:text-emerald-100">
                      <FiCheckCircle className="mt-1 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {sanitizedTheoryHtml ? (
              <div
                className="prose prose-slate max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: sanitizedTheoryHtml }}
              />
            ) : !unit?.theory?.transcript ? (
              <p className="text-slate-500 dark:text-slate-400">
                Bài học này chưa có nội dung lý thuyết chi tiết. Bạn có thể xem video, từ vựng, công thức và tài liệu ở các tab bên cạnh.
              </p>
            ) : null}

            {timestamps.length > 0 ? (
              <div className="rounded-xl border border-[#ddcfc2] bg-[#fffdf9] p-4 dark:border-[#34435a] dark:bg-[#101e33]">
                <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#247d7e]">
                  <FiClock /> Mốc thời gian bài giảng
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {timestamps.map((ts, index) => {
                    const sec = parseTimestampSeconds(ts);
                    const label = ts.title || ts.label || ts.description || `Mốc ${index + 1}`;
                    return (
                      <button
                        key={`${sec}-${index}`}
                        type="button"
                        onClick={() => onSeekVideo(sec)}
                        className="flex items-center gap-3 rounded-lg border border-[#e6d9cc] bg-[#fffaf4] px-3 py-2 text-left transition hover:border-[#247d7e] hover:bg-[#eff9f7] dark:border-[#2c3a52] dark:bg-[#0b172b] dark:hover:bg-[#142542]"
                      >
                        <span className="shrink-0 rounded-md bg-[#247d7e] px-2 py-0.5 font-mono text-xs font-black text-white">
                          {ts.time || formatDuration(sec)}
                        </span>
                        <span className="truncate font-semibold text-[#233048] dark:text-slate-200">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {unit?.theory?.transcript ? (
              <div className="rounded-xl border border-[#ddcfc2] bg-[#fffdf9] p-4 dark:border-[#34435a] dark:bg-[#101e33]">
                <p className="mb-2 text-xs font-black uppercase tracking-wider text-[#6f665f] dark:text-slate-400">Transcript bài giảng</p>
                <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-[#343f54] dark:text-slate-300">
                  {unit.theory.transcript}
                </pre>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === 'vocabulary' ? (
          vocabulary.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {vocabulary.map((item, idx) => {
                const key = item.id || `${item.term}-${idx}`;
                const audioSafe = isSafeHttpOrRelativeUrl(item.audioUrl);
                return (
                  <div key={key} className="rounded-xl border border-[#dfd0c2] bg-[#fffdf9] p-4 shadow-sm dark:border-[#334159] dark:bg-[#101e33]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xl font-black text-[#18243b] dark:text-white">{item.term}</p>
                        {item.pinyin ? <p className="text-xs font-bold text-[#247d7e] dark:text-[#6ac6bd]">{item.pinyin}</p> : null}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {item.partOfSpeech ? (
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {item.partOfSpeech}
                          </span>
                        ) : null}
                        {audioSafe ? (
                          <button
                            type="button"
                            onClick={() => playVocabAudio(key, audioSafe)}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                              playingVocabId === key
                                ? 'border-[#247d7e] bg-[#247d7e] text-white'
                                : 'border-[#d8c8b9] text-[#247d7e] hover:bg-[#eff9f7] dark:border-[#34435a]'
                            }`}
                            aria-label={`Nghe phát âm ${item.term}`}
                          >
                            <FiVolume2 />
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {item.sinoVietnamese ? (
                      <p className="mt-1 text-xs font-bold text-amber-700 dark:text-amber-300">Hán Việt: {item.sinoVietnamese}</p>
                    ) : null}
                    <p className="mt-2 font-semibold text-[#2a364e] dark:text-slate-200">{item.meaning}</p>
                    {item.exampleSentence ? (
                      <div className="mt-3 border-t border-[#efe4d8] pt-2 text-xs dark:border-[#26354b]">
                        <p className="font-semibold text-[#1e2b44] dark:text-slate-200">{item.exampleSentence}</p>
                        {item.exampleMeaning ? <p className="text-[#6f665f] dark:text-slate-400">{item.exampleMeaning}</p> : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-slate-500 dark:text-slate-400">Chưa có từ vựng nào cho bài học này.</p>
          )
        ) : null}

        {activeTab === 'formulas' ? (
          formulas.length ? (
            <div className="space-y-4">
              {formulas.map((formula, idx) => {
                const formulaHtml = renderLatexToHtml(formula.latexExpression);
                return (
                  <div key={formula.id || idx} className="rounded-xl border border-[#dfd0c2] bg-[#fffdf9] p-5 shadow-sm dark:border-[#334159] dark:bg-[#101e33]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-base font-black text-[#18243b] dark:text-white">
                          {formula.nameVi || formula.nameZh || `Công thức ${idx + 1}`}
                        </h3>
                        {(formula.nameZh || formula.pinyin) ? (
                          <p className="text-xs font-semibold text-[#6f665f] dark:text-slate-400">
                            {formula.nameZh} {formula.pinyin ? `(${formula.pinyin})` : ''}
                          </p>
                        ) : null}
                      </div>
                      {formula.chapterName || formula.subject ? (
                        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                          {formula.chapterName || formula.subject}
                        </span>
                      ) : null}
                    </div>

                    <div className="my-4 overflow-x-auto rounded-xl border border-[#ebe0d4] bg-[#fffaf4] px-4 py-3 text-slate-900 dark:border-[#26354b] dark:bg-[#071326] dark:text-slate-50 [&_.katex-display]:my-1">
                      {formulaHtml ? (
                        <div dangerouslySetInnerHTML={{ __html: formulaHtml }} />
                      ) : (
                        <code className="text-sm">{formula.latexExpression}</code>
                      )}
                    </div>

                    {formula.description ? (
                      <RichMathText value={formula.description} className="text-sm leading-6 text-[#3d4657] dark:text-slate-300" />
                    ) : null}

                    {formula.variablesExplanation && formula.variablesExplanation.length > 0 ? (
                      <div className="mt-3 rounded-lg bg-[#f8f1e9] p-3 text-xs dark:bg-[#0b172b]">
                        <p className="mb-1.5 font-black uppercase tracking-wider text-[#6f665f] dark:text-slate-400">Chú giải biến số</p>
                        <ul className="space-y-1">
                          {formula.variablesExplanation.map((v, vIdx) => (
                            <li key={`${v.symbol || v.name}-${vIdx}`} className="flex flex-wrap gap-2">
                              <span className="font-mono font-black text-[#ad2033] dark:text-[#f08d9c]">{v.symbol || '•'}</span>
                              {v.name ? <span className="font-bold text-[#1f2c43] dark:text-slate-200">{v.name}</span> : null}
                              {v.unit ? <span className="text-[#247d7e] dark:text-[#6ac6bd]">({v.unit})</span> : null}
                              {v.description ? <span>: {v.description}</span> : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-slate-500 dark:text-slate-400">Chưa có công thức toán học/khoa học cho bài học này.</p>
          )
        ) : null}

        {activeTab === 'files' ? (
          files.length ? (
            <div className="space-y-4">
              {!profileAllowsDownload ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                  Quyền tải tài liệu hiện bị tắt cho hồ sơ này hoặc chế độ Xem thử miễn phí.
                </div>
              ) : null}
              <ul className="grid gap-3">
                {files.map((file) => {
                  const fileCanDownload = profileAllowsDownload && file.allowDownload !== false;
                  return (
                    <li
                      key={file.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#ddcfc2] bg-[#fffdf9] px-4 py-3 dark:border-[#34435a] dark:bg-[#101e33]"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-bold text-[#1e2b44] dark:text-slate-100">{file.title || file.fileName}</p>
                        <p className="text-xs text-[#6f665f] dark:text-slate-400">
                          {file.fileName} · {formatFileSize(file.sizeBytes)}
                        </p>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                        fileCanDownload
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {fileCanDownload ? <FiCheckCircle /> : <FiLock />}
                        {fileCanDownload ? 'Cho phép tải trên CSCA-Course' : 'Chỉ xem / Khóa tải'}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {profileAllowsDownload && !isPublicPreviewAccess ? (
                <div className="max-w-xs pt-2">
                  <CourseSsoLaunchButton
                    courseId={courseId}
                    targetPath={ssoTargetPath}
                    label="Mở trên CSCA-Course để tải tài liệu"
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-slate-500 dark:text-slate-400">Chưa có tài liệu đính kèm cho bài học này.</p>
          )
        ) : null}

        {activeTab === 'assessments' ? (
          (quizzes.length + assignments.length) > 0 ? (
            <div className="space-y-6">
              {quizzes.length > 0 ? (
                <div>
                  <h3 className="mb-3 text-base font-black text-[#18243b] dark:text-white">Bài kiểm tra (Quiz)</h3>
                  <div className="grid gap-3">
                    {quizzes.map((q) => (
                      <div key={q.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#ddcfc2] bg-[#fffdf9] p-4 dark:border-[#34435a] dark:bg-[#101e33]">
                        <div>
                          <p className="font-bold text-[#1e2b44] dark:text-slate-100">{q.title}</p>
                          <p className="text-xs text-[#6f665f] dark:text-slate-400">
                            {q.durationMinutes ? `${q.durationMinutes} phút · ` : ''}
                            Điểm đạt: {q.passingScore ?? '—'} · Số lần làm: {q.attemptsCount ?? 0}
                            {q.bestScore !== null && q.bestScore !== undefined ? ` · Điểm cao nhất: ${q.bestScore}${q.maxScore ? `/${q.maxScore}` : ''}` : ''}
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${
                          q.isCompleted
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}>
                          {q.isCompleted ? 'Đã đạt' : 'Chưa hoàn thành'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {assignments.length > 0 ? (
                <div>
                  <h3 className="mb-3 text-base font-black text-[#18243b] dark:text-white">Bài tập tự luận / Thực hành</h3>
                  <div className="grid gap-3">
                    {assignments.map((a) => (
                      <div key={a.id} className="rounded-xl border border-[#ddcfc2] bg-[#fffdf9] p-4 dark:border-[#34435a] dark:bg-[#101e33]">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-bold text-[#1e2b44] dark:text-slate-100">{a.title}</p>
                          <span className={`rounded-full px-3 py-1 text-xs font-black ${
                            a.isSubmitted
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                          }`}>
                            {a.isSubmitted ? (a.score !== null && a.score !== undefined ? `Đã chấm: ${a.score}` : 'Đã nộp') : 'Chưa nộp'}
                          </span>
                        </div>
                        {a.description ? <p className="mt-1 text-xs text-[#6f665f] dark:text-slate-400">{a.description}</p> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {!isPublicPreviewAccess ? (
                <div className="max-w-xs">
                  <CourseSsoLaunchButton
                    courseId={courseId}
                    targetPath={ssoTargetPath}
                    label="Làm bài / Nộp bài trên CSCA-Course"
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-slate-500 dark:text-slate-400">Bài học này không có quiz hoặc bài tập.</p>
          )
        ) : null}

        {activeTab === 'notes' ? (
          <div className="space-y-6">
            {notes.length > 0 ? (
              <div>
                <h3 className="mb-3 text-base font-black text-[#18243b] dark:text-white">Ghi chú đã lưu từ CSCA-Course</h3>
                <ul className="space-y-2.5">
                  {notes.map((item) => (
                    <li key={item.id} className="rounded-xl border border-[#ddcfc2] bg-[#fffdf9] p-3.5 dark:border-[#34435a] dark:bg-[#101e33]">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onSeekVideo(item.timestampSeconds)}
                          className="rounded-md bg-[#247d7e] px-2 py-0.5 font-mono text-xs font-black text-white hover:bg-[#1c6465]"
                        >
                          {formatDuration(item.timestampSeconds)}
                        </button>
                        {item.createdAt ? (
                          <span className="text-xs text-[#8b8178] dark:text-slate-500">
                            {new Date(item.createdAt).toLocaleString('vi-VN')}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-[#29354b] dark:text-slate-200">{item.content}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <section id="lesson-notes">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-[#202c43] dark:text-[#f2e4cf]">Ghi chú nhanh trên Moly</h3>
                  <p className="text-xs text-[#8b8178] dark:text-slate-500">Ghi chú được lưu trên trình duyệt của thiết bị này.</p>
                </div>
                <button type="button" onClick={saveLocalNote} className="inline-flex items-center gap-2 rounded-lg bg-[#237e80] px-4 py-2 font-black text-white">
                  <FiSave /> {localNoteSaved ? 'Đã lưu' : 'Lưu ghi chú'}
                </button>
              </div>
              <textarea
                value={localNote}
                onChange={(event) => setLocalNote(event.target.value)}
                placeholder="Ghi lại công thức, ý chính hoặc câu hỏi của bạn..."
                className="mt-4 min-h-40 w-full rounded-xl border border-[#d9cabc] bg-[#fffdf9] p-4 outline-none focus:border-[#258886] focus:ring-4 focus:ring-[#258886]/10 dark:border-[#34435a] dark:bg-[#071426] dark:text-slate-200 dark:placeholder:text-slate-600"
              />
            </section>
          </div>
        ) : null}

        {activeTab === 'curriculum' ? (
          <div className="space-y-2">
            {units.map((u, idx) => {
              const active = u.unitProjectionId === activeUnitProjectionId;
              const href = u.href || `/hoc/${courseSlug}/bai-hoc/u-${u.unitProjectionId}`;
              return (
                <Link
                  key={u.unitProjectionId}
                  href={href}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                    active
                      ? 'border-[#ad2033] bg-[#ad2033] font-bold text-white'
                      : 'border-[#ddcfc2] bg-[#fffdf9] font-semibold text-[#414c61] hover:bg-[#f7efe7] dark:border-[#34435a] dark:bg-[#101e33] dark:text-slate-200'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="shrink-0">{u.isLocked ? <FiLock /> : u.isCompleted ? <FiCheckCircle /> : <FiPlay />}</span>
                    <span className="truncate">{idx + 1}. {u.title}</span>
                  </span>
                  {u.durationSeconds > 0 ? (
                    <span className="shrink-0 font-mono text-xs">{formatDuration(u.durationSeconds)}</span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    </article>
  );
}
