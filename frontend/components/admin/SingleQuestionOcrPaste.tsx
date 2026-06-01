'use client';

import { useCallback, useMemo, useState } from 'react';
import { FiCheck, FiClipboard, FiTrash2 } from 'react-icons/fi';
import {
  parseSingleQuestionOcr,
  type ParsedSingleQuestionOcr,
} from '@/lib/ocr-question/parseSingleQuestionOcr';
import SingleQuestionImageOcrInput from './SingleQuestionImageOcrInput';
import {
  getClipboardImage,
  useSingleQuestionImageOcr,
} from './useSingleQuestionImageOcr';

interface SingleQuestionOcrPasteProps {
  onApply: (parsed: ParsedSingleQuestionOcr) => void;
  onClear: () => void;
}

function hasParsedContent(parsed: ParsedSingleQuestionOcr | null): boolean {
  if (!parsed) return false;
  return Boolean(
    parsed.questionText ||
    parsed.questionTextCn ||
    parsed.answers.length ||
    parsed.explanation ||
    parsed.explanationCn,
  );
}

export default function SingleQuestionOcrPaste({ onApply, onClear }: SingleQuestionOcrPasteProps) {
  const [ocrText, setOcrText] = useState('');
  const [applied, setApplied] = useState(false);
  const parsed = useMemo(
    () => (ocrText.trim() ? parseSingleQuestionOcr(ocrText) : null),
    [ocrText],
  );
  const canApply = hasParsedContent(parsed);
  const handleOcrTextExtracted = useCallback((text: string) => {
    setOcrText(text);
    setApplied(false);
  }, []);
  const {
    clearImageOcr,
    fileName,
    loading: imageOcrLoading,
    previewUrl,
    runImageOcr,
  } = useSingleQuestionImageOcr({ onTextExtracted: handleOcrTextExtracted });

  const handleApply = () => {
    if (!parsed || !canApply) {
      alert('Chưa tách được nội dung OCR.');
      return;
    }

    onApply(parsed);
    setApplied(true);
  };

  const handleClear = () => {
    setOcrText('');
    setApplied(false);
    clearImageOcr();
    onClear();
  };

  const handleTextareaPaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const file = getClipboardImage(event);
    if (!file) return;

    event.preventDefault();
    setApplied(false);
    void runImageOcr(file);
  };

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-100 text-amber-700">
            <FiClipboard size={16} />
          </span>
          <div>
            <h4 className="text-sm font-bold text-amber-900">Dán OCR 1 câu</h4>
            <p className="text-xs text-amber-800">Dán ảnh hoặc text OCR để tự tách đề bài, lựa chọn, đáp án, giải thích.</p>
          </div>
        </div>
        {parsed && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-amber-900">
            <span className="rounded border border-amber-200 bg-white px-2 py-1">
              {parsed.answers.length} lựa chọn
            </span>
            <span className="rounded border border-amber-200 bg-white px-2 py-1">
              Đáp án: {parsed.correctAnswer || '?'}
            </span>
          </div>
        )}
      </div>

      <SingleQuestionImageOcrInput
        fileName={fileName}
        loading={imageOcrLoading}
        previewUrl={previewUrl}
        onImageFile={runImageOcr}
      />

      <textarea
        value={ocrText}
        onChange={event => {
          setOcrText(event.target.value);
          setApplied(false);
        }}
        onPaste={handleTextareaPaste}
        rows={5}
        className="mt-3 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm font-mono text-gray-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
        placeholder={'Dán text OCR hoặc dán ảnh vào đây\n25. ...\nA. ...\nB. ...\n解析: ...'}
      />

      {parsed?.warnings.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {parsed.warnings.map(warning => (
            <span key={warning} className="rounded border border-amber-200 bg-white px-2 py-1 text-xs text-amber-800">
              {warning}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleApply}
          disabled={!canApply}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FiCheck size={15} />
          Tách vào form
        </button>
        <button
          type="button"
          onClick={handleClear}
          disabled={!ocrText && !applied && !fileName && !previewUrl && !imageOcrLoading}
          className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FiTrash2 size={15} />
          Xóa OCR + form
        </button>
        {applied && (
          <span className="text-xs font-semibold text-green-700">
            Đã đổ vào form.
          </span>
        )}
      </div>
    </section>
  );
}
