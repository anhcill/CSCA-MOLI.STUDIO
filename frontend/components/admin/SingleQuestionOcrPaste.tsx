'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiCheck, FiClipboard, FiPlus, FiTrash2 } from 'react-icons/fi';
import {
  parseSingleQuestionOcr,
  type ParsedSingleQuestionOcr,
  type ParsedSingleQuestionOcrAnswer,
} from '@/lib/ocr-question/parseSingleQuestionOcr';
import MathInput from './MathInput';
import SingleQuestionImageOcrInput from './SingleQuestionImageOcrInput';
import {
  getClipboardImage,
  useSingleQuestionImageOcr,
} from './useSingleQuestionImageOcr';

interface SingleQuestionOcrPasteProps {
  onApply: (parsed: ParsedSingleQuestionOcr) => void;
  onClear: () => void;
}

const OCR_ANSWER_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

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

function hasText(...values: Array<string | undefined | null>): boolean {
  return values.some(value => Boolean(value?.trim()));
}

function getDraftWarnings(parsed: ParsedSingleQuestionOcr | null): string[] {
  if (!parsed) return [];

  const warnings: string[] = [];
  if (!hasText(parsed.questionText, parsed.questionTextCn)) warnings.push('Thiếu nội dung câu hỏi.');
  if (parsed.answers.length < 2) warnings.push('Thiếu ít nhất 2 lựa chọn.');
  if (!parsed.correctAnswer) warnings.push('Chưa chọn đáp án đúng.');

  return warnings;
}

function createOcrAnswer(key: string): ParsedSingleQuestionOcrAnswer {
  return { key, text: '', textCn: '', imageUrl: '' };
}

export default function SingleQuestionOcrPaste({ onApply, onClear }: SingleQuestionOcrPasteProps) {
  const [ocrText, setOcrText] = useState('');
  const [parsedDraft, setParsedDraft] = useState<ParsedSingleQuestionOcr | null>(null);
  const [applied, setApplied] = useState(false);
  const parsed = useMemo(
    () => (ocrText.trim() ? parseSingleQuestionOcr(ocrText) : null),
    [ocrText],
  );
  const draftWarnings = useMemo(() => getDraftWarnings(parsedDraft), [parsedDraft]);
  const canApply = hasParsedContent(parsedDraft);

  useEffect(() => {
    setParsedDraft(parsed);
  }, [parsed]);

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
    if (!parsedDraft || !canApply) {
      alert('Chưa tách được nội dung OCR.');
      return;
    }

    onApply(parsedDraft);
    setApplied(true);
  };

  const handleClear = () => {
    setOcrText('');
    setParsedDraft(null);
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

  const updateDraft = (updates: Partial<ParsedSingleQuestionOcr>) => {
    setParsedDraft(prev => prev ? { ...prev, ...updates } : prev);
    setApplied(false);
  };

  const updateDraftAnswer = (answerIndex: number, updates: Partial<ParsedSingleQuestionOcrAnswer>) => {
    setParsedDraft(prev => {
      if (!prev) return prev;
      const answers = [...prev.answers];
      answers[answerIndex] = { ...answers[answerIndex], ...updates };
      return { ...prev, answers };
    });
    setApplied(false);
  };

  const addDraftAnswer = () => {
    setParsedDraft(prev => {
      if (!prev || prev.answers.length >= OCR_ANSWER_KEYS.length) return prev;
      const key = OCR_ANSWER_KEYS[prev.answers.length] || OCR_ANSWER_KEYS[OCR_ANSWER_KEYS.length - 1];
      return { ...prev, answers: [...prev.answers, createOcrAnswer(key)] };
    });
    setApplied(false);
  };

  const removeDraftAnswer = (answerIndex: number) => {
    setParsedDraft(prev => {
      if (!prev || prev.answers.length <= 2) return prev;
      const answers = prev.answers
        .filter((_, index) => index !== answerIndex)
        .map((answer, index) => ({ ...answer, key: OCR_ANSWER_KEYS[index] || answer.key }));
      const answerKeys = answers.map(answer => answer.key);

      return {
        ...prev,
        answers,
        correctAnswer: answerKeys.includes(prev.correctAnswer) ? prev.correctAnswer : '',
      };
    });
    setApplied(false);
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

      {parsedDraft && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-white p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-amber-900">Xem trước OCR</p>
            <button
              type="button"
              onClick={addDraftAnswer}
              disabled={parsedDraft.answers.length >= OCR_ANSWER_KEYS.length}
              className="inline-flex items-center gap-1 rounded-lg border border-amber-200 px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FiPlus size={12} />
              Thêm đáp án
            </button>
          </div>

          <MathInput
            label="Câu hỏi OCR"
            value={parsedDraft.questionText}
            onChange={value => updateDraft({ questionText: value })}
            cnLabel="Tiếng Trung"
            cnValue={parsedDraft.questionTextCn}
            onCnChange={value => updateDraft({ questionTextCn: value })}
            placeholder="Nội dung câu hỏi"
            cnPlaceholder="Nội dung tiếng Trung"
            defaultTab={parsedDraft.questionText || !parsedDraft.questionTextCn ? 'vi' : 'cn'}
          />

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            {parsedDraft.answers.map((answer, answerIndex) => (
              <div key={`${answer.key}-${answerIndex}`} className="rounded-lg border border-gray-200 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-gray-500">Đáp án {answer.key}</span>
                  <button
                    type="button"
                    onClick={() => removeDraftAnswer(answerIndex)}
                    disabled={parsedDraft.answers.length <= 2}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FiTrash2 size={12} />
                    Xóa
                  </button>
                </div>
                <MathInput
                  label=""
                  value={answer.text}
                  onChange={value => updateDraftAnswer(answerIndex, { text: value })}
                  cnLabel="Tiếng Trung"
                  cnValue={answer.textCn}
                  onCnChange={value => updateDraftAnswer(answerIndex, { textCn: value })}
                  placeholder={`Đáp án ${answer.key}`}
                  cnPlaceholder={`Đáp án ${answer.key} tiếng Trung`}
                  defaultTab={answer.text || !answer.textCn ? 'vi' : 'cn'}
                />
              </div>
            ))}
          </div>

          <div className="mt-3 max-w-xs">
            <label className="mb-1 block text-xs font-semibold text-gray-600">Đáp án đúng</label>
            <select
              value={parsedDraft.correctAnswer}
              onChange={event => updateDraft({ correctAnswer: event.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            >
              <option value="">Chọn đáp án</option>
              {parsedDraft.answers.map(answer => (
                <option key={answer.key} value={answer.key}>{answer.key}</option>
              ))}
            </select>
          </div>

          <div className="mt-3">
            <MathInput
              label="Giải thích"
              value={parsedDraft.explanation}
              onChange={value => updateDraft({ explanation: value })}
              cnLabel="Tiếng Trung"
              cnValue={parsedDraft.explanationCn}
              onCnChange={value => updateDraft({ explanationCn: value })}
              placeholder="Giải thích"
              cnPlaceholder="Giải thích tiếng Trung"
              defaultTab={parsedDraft.explanation || !parsedDraft.explanationCn ? 'vi' : 'cn'}
            />
          </div>
        </div>
      )}

      {draftWarnings.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {draftWarnings.map(warning => (
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
