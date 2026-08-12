'use client';

import { useState, useEffect } from 'react';
import { FiEye, FiEyeOff, FiTrash2, FiSave, FiPlus, FiX } from 'react-icons/fi';
import ImageUpload from './ImageUpload';
import MathInput from './MathInput';
import SingleQuestionOcrPaste from './SingleQuestionOcrPaste';
import RichMathText from '@/components/common/RichMathText';
import { normalizeRichMathText } from '@/lib/math/normalizeMath';
import {
  isPlainTextMathValue,
  markPlainTextMathValue,
  preservePlainTextMathMode,
  stripPlainTextMathMarker,
} from '@/lib/math/plainTextMathMode';
import type { ParsedSingleQuestionOcr } from '@/lib/ocr-question/parseSingleQuestionOcr';

// ─── Types ──────────────────────────────────────────────────────────────────────────

type QuestionType =
  | 'single_choice'
  | 'fill_blank_pool'
  | 'reading_passage';

export interface LinkedOption {
  key: string;   // 'A', 'B', 'C', 'D', 'E', 'F'
  text: string;  // tiếng Việt / mô tả
  textCn: string; // tiếng Trung
  textEn?: string;
}

export interface QuestionFormData {
  questionType: QuestionType;
  questionText: string;
  questionTextCn: string;
  questionTextEn: string;
  imageUrl: string;
  passageText: string;
  passageImageUrl: string;
  points: number;
  explanation: string;
  explanationCn: string;
  explanationEn: string;
  explanationImageUrl: string;
  answers: { text: string; textCn: string; textEn?: string; imageUrl: string }[];
  correctAnswer: string;       // cho single_choice, reading_item, true_false
  linkedOptions: LinkedOption[]; // pool A-F cho fill_blank_pool
  correctAnswerKey: string;   // 'A','B'... cho fill_blank_item
  subQuestionNumber: number;  // số câu con (34, 35, 36...)
  difficulty: string;
}

interface QuestionEditorProps {
  questionNumber: number;
  /** Initial data for existing questions (already saved in DB) */
  initialData?: Partial<QuestionFormData>;
  /** When adding a NEW question, optionally set the initial question type (e.g. reading_passage, fill_blank_pool)
   *  instead of defaulting to single_choice */
  initialQuestionType?: QuestionType;
  onSave: (data: QuestionFormData) => void;
  onDelete?: () => void;
  /** Called when the user clicks the Cancel button to exit editing */
  onCancel?: () => void;
  /** Pass an existing saved question to enable UPDATE instead of CREATE */
  savedQuestionId?: number;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────────
const DEFAULT_ANSWERS = (count = 4) =>
  Array.from({ length: count }, () => ({ text: '', textCn: '', textEn: '', imageUrl: '' }));

const DEFAULT_LINKED_OPTIONS: LinkedOption[] = [
  { key: 'A', text: '', textCn: '', textEn: '' },
  { key: 'B', text: '', textCn: '', textEn: '' },
  { key: 'C', text: '', textCn: '', textEn: '' },
  { key: 'D', text: '', textCn: '', textEn: '' },
  { key: 'E', text: '', textCn: '', textEn: '' },
  { key: 'F', text: '', textCn: '', textEn: '' },
];

function getDefaults(initial?: Partial<QuestionFormData>): QuestionFormData {
  return {
    questionType: (initial?.questionType as QuestionType) || 'single_choice',
    questionText: initial?.questionText || '',
    questionTextCn: initial?.questionTextCn || '',
    questionTextEn: initial?.questionTextEn || '',
    imageUrl: initial?.imageUrl || '',
    passageText: initial?.passageText || '',
    passageImageUrl: initial?.passageImageUrl || '',
    points: initial?.points || 1,
    explanation: initial?.explanation || '',
    explanationCn: initial?.explanationCn || '',
    explanationEn: initial?.explanationEn || '',
    explanationImageUrl: initial?.explanationImageUrl || '',
    answers: initial?.answers?.length ? initial.answers : DEFAULT_ANSWERS(),
    correctAnswer: initial?.correctAnswer || 'A',
    linkedOptions: initial?.linkedOptions?.length ? initial.linkedOptions : DEFAULT_LINKED_OPTIONS,
    correctAnswerKey: initial?.correctAnswerKey || 'A',
    subQuestionNumber: initial?.subQuestionNumber || 0,
    difficulty: initial?.difficulty || 'medium',
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────────
const QUESTION_TYPE_LABELS: Record<QuestionType, { label: string; desc: string; color: string; bg: string }> = {
  single_choice:    { label: '🔘 Trắc nghiệm A-B-C-D',  desc: 'Câu hỏi chọn 1 đáp án đúng', color: 'blue',  bg: 'bg-blue-50 border-blue-200' },
  fill_blank_pool:  { label: '📝 Điền từ (Pool A-F)',   desc: 'Bắt đầu nhóm điền từ, có 6 từ chọn', color: 'green', bg: 'bg-green-50 border-green-200' },
  reading_passage:  { label: '📖 Đọc hiểu (đầu đoạn)',  desc: 'Bắt đầu đoạn văn đọc hiểu', color: 'purple', bg: 'bg-purple-50 border-purple-200' },
};

const ANSWER_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const ADMIN_TEXTAREA_CLASS =
  'w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder:text-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:bg-white dark:text-gray-900';
const ADMIN_INPUT_CLASS =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:bg-white dark:text-gray-900';
const ADMIN_SELECT_CLASS =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:bg-white dark:text-gray-900';

// ─── Component ──────────────────────────────────────────────────────────────────
export default function QuestionEditor({ questionNumber, initialData, initialQuestionType, onSave, onDelete, onCancel, savedQuestionId }: QuestionEditorProps) {
  const [form, setForm] = useState<QuestionFormData>(getDefaults(initialData));
  const [saving, setSaving] = useState(false);
  const [showMathPreviews, setShowMathPreviews] = useState(true);
  const [previewDrafts, setPreviewDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setForm(getDefaults(initialData));
  }, [initialData]);

  // When initialQuestionType is provided (new question with specific type), apply it
  useEffect(() => {
    if (initialQuestionType && !savedQuestionId && !initialData) {
      setForm(prev => ({ ...prev, questionType: initialQuestionType }));
    }
  }, [initialQuestionType, savedQuestionId, initialData]);

  const set = <K extends keyof QuestionFormData>(key: K, value: QuestionFormData[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const setMathText = (key: 'questionText' | 'questionTextCn' | 'questionTextEn', value: string) =>
    setForm(prev => ({ ...prev, [key]: preservePlainTextMathMode(prev[key], value) }));

  const renderMathPreview = (
    value: string,
    onChange: (value: string) => void,
    title = 'Xem trước:',
    draftKey = title,
  ) => {
    const isPlainText = isPlainTextMathValue(value);
    const editableValue = stripPlainTextMathMarker(value);
    if (!editableValue) return null;

    if (!showMathPreviews) {
      return (
        <button
          type="button"
          onClick={() => setShowMathPreviews(true)}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50"
        >
          <FiEye size={13} />
          Hiện xem trước
        </button>
      );
    }

    if (isPlainText) {
      return (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-amber-800">Đang dùng text thường, không render LaTeX</span>
            <button
              type="button"
              onClick={() => onChange(editableValue)}
              className="rounded border border-blue-200 bg-white px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
            >
              Dùng LaTeX lại
            </button>
          </div>
        </div>
      );
    }

    const normalized = normalizeRichMathText(editableValue);
    const canApplyNormalized = Boolean(normalized && normalized !== editableValue);
    const draftValue = previewDrafts[draftKey] ?? editableValue;
    const editorRows = Math.min(6, Math.max(2, draftValue.split('\n').length));
    const applyDraftValue = () => {
      onChange(draftValue);
      setPreviewDrafts(prev => ({ ...prev, [draftKey]: draftValue }));
      setShowMathPreviews(false);
    };
    const applyPlainTextValue = () => {
      onChange(markPlainTextMathValue(draftValue));
      setPreviewDrafts(prev => ({ ...prev, [draftKey]: draftValue }));
      setShowMathPreviews(false);
    };

    return (
      <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <span className="block text-xs font-semibold text-gray-500">{title}</span>
          {canApplyNormalized && (
            <button
              type="button"
              onClick={() => onChange(normalized)}
              className="rounded border border-blue-200 bg-white px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
            >
              Dùng bản chuẩn hóa
            </button>
          )}
          <button
            type="button"
              onClick={applyDraftValue}
            className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            Dùng ô dưới
          </button>
          <button
            type="button"
            onClick={applyPlainTextValue}
            className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100"
          >
            Dùng text thường
          </button>
          <button
            type="button"
            onClick={() => setShowMathPreviews(false)}
            className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
          >
            <FiEyeOff size={12} />
            Ẩn
          </button>
        </div>
        <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
          <RichMathText value={normalized || editableValue} className="admin-question-preview-math text-gray-900" />
        </div>
        <label className="mt-2 block text-[11px] font-bold uppercase tracking-wide text-gray-400">
          Mã nguồn LaTeX · sửa nhanh
        </label>
        <textarea
          value={draftValue}
          onChange={event => setPreviewDrafts(prev => ({ ...prev, [draftKey]: event.target.value }))}
          rows={editorRows}
          className="mt-2 w-full rounded-md border border-gray-200 bg-white px-3 py-2 font-mono text-sm leading-6 text-gray-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-50 dark:bg-white dark:text-gray-900"
          aria-label="Sua nhanh noi dung preview"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={applyDraftValue}
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
          >
            Dùng nội dung ô dưới và ẩn preview lỗi
          </button>
        </div>
      </div>
    );
  };

  const applySingleQuestionOcr = (parsed: ParsedSingleQuestionOcr) => {
    setForm(prev => ({
      ...prev,
      questionType: 'single_choice',
      questionText: parsed.questionText,
      questionTextCn: parsed.questionTextCn,
      questionTextEn: '',
      imageUrl: '',
      answers: parsed.answers.length
        ? parsed.answers.map(answer => ({
          text: answer.text,
          textCn: answer.textCn,
          textEn: '',
          imageUrl: answer.imageUrl,
        }))
        : prev.answers,
      correctAnswer: parsed.correctAnswer || prev.correctAnswer,
      correctAnswerKey: parsed.correctAnswer || prev.correctAnswerKey,
      explanation: parsed.explanation,
      explanationCn: parsed.explanationCn,
      explanationEn: '',
      explanationImageUrl: prev.explanationImageUrl,
    }));
  };

  const clearSingleQuestionOcr = () => {
    setForm(prev => ({
      ...prev,
      questionType: 'single_choice',
      questionText: '',
      questionTextCn: '',
      questionTextEn: '',
      imageUrl: '',
      answers: DEFAULT_ANSWERS(),
      correctAnswer: 'A',
      correctAnswerKey: 'A',
      explanation: '',
      explanationCn: '',
      explanationEn: '',
      explanationImageUrl: '',
    }));
  };

  const handleSave = () => {
    if (!form.questionText.trim() && !form.questionTextCn.trim() && !form.questionTextEn.trim()) {
      alert('Vui lòng nhập nội dung câu hỏi (Tiếng Việt, Tiếng Trung hoặc English)');
      return;
    }

    if (form.questionType === 'single_choice' && !form.correctAnswer) {
      alert('Vui lòng chọn đáp án đúng');
      return;
    }

    if (form.questionType === 'single_choice' &&
        form.answers.every(a => !a.text.trim() && !a.textCn.trim() && !a.textEn?.trim())) {
      alert('Vui lòng nhập ít nhất 2 đáp án');
      return;
    }

    if (form.questionType === 'fill_blank_pool') {
      const filledOpts = form.linkedOptions.filter(o => o.text.trim() || o.textCn.trim() || o.textEn?.trim());
      if (filledOpts.length < 2) {
        alert('Điền từ cần ít nhất 2 lựa chọn có nội dung');
        return;
      }
    }

    setSaving(true);
    onSave(form);
  };

  const qtype = QUESTION_TYPE_LABELS[form.questionType];

  // ── Render loại câu hỏi ─────────────────────────────────────────────────────
  const renderQuestionTypeSelector = () => {
    const types = [
      { val: 'single_choice' as QuestionType, label: '🔘 Trắc nghiệm', bg: 'bg-blue-50 border-blue-200 hover:bg-blue-100', active: 'bg-blue-600 text-white border-blue-600' },
      { val: 'fill_blank_pool' as QuestionType, label: '📝 Điền từ', bg: 'bg-green-50 border-green-200 hover:bg-green-100', active: 'bg-green-600 text-white border-green-600' },
      { val: 'reading_passage' as QuestionType, label: '📖 Đọc hiểu', bg: 'bg-purple-50 border-purple-200 hover:bg-purple-100', active: 'bg-purple-600 text-white border-purple-600' },
    ];
    return (
      <div className="flex gap-3">
        {types.map(t => (
          <button
            key={t.val}
            type="button"
            onClick={() => set('questionType', t.val)}
            className={`flex-1 py-3 px-4 rounded-xl border-2 font-bold text-sm transition-all ${
              form.questionType === t.val ? t.active : t.bg
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    );
  };

  // ── Passage cho fill_blank_pool và reading_passage ─────────────────────────
  const renderPassageSection = () => (
    <div className={`p-4 rounded-xl border ${form.questionType === 'fill_blank_pool' ? 'bg-green-50 border-green-200' : 'bg-purple-50 border-purple-200'}`}>
      <label className="block text-sm font-bold mb-2">
        {form.questionType === 'fill_blank_pool' ? '📝 Đoạn văn điền từ + Từ chọn A-F' : '📖 Đoạn văn đọc hiểu'}
      </label>
      <textarea
        value={form.passageText}
        onChange={e => set('passageText', e.target.value)}
        rows={5}
        className={`${ADMIN_TEXTAREA_CLASS} mb-3`}
        placeholder={
          form.questionType === 'fill_blank_pool'
            ? 'Nhập đoạn văn có chỗ trống ( VD: 水在4°C时____最大。物体的____越大，惯性越大。 )'
            : 'Nhập đoạn văn đọc hiểu...'
        }
      />
      <ImageUpload
        label="Ảnh đính kèm đoạn văn (tùy chọn)"
        currentImage={form.passageImageUrl}
        onImageUploaded={url => set('passageImageUrl', url)}
      />

      {/* Linked Options cho fill_blank_pool */}
      {form.questionType === 'fill_blank_pool' && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-green-700">Từ chọn A-F (kéo theo đoạn văn)</span>
            <button
              onClick={() => {
                const nextKey = String.fromCharCode(65 + form.linkedOptions.length);
                if (form.linkedOptions.length < 12) {
                  set('linkedOptions', [...form.linkedOptions, { key: nextKey, text: '', textCn: '' }]);
                }
              }}
              className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded border border-green-200 hover:bg-green-200"
            >
              + Thêm từ
            </button>
          </div>
          <div className="space-y-2">
            {form.linkedOptions.map((opt, i) => (
              <div key={opt.key} className="flex items-center gap-2 bg-white rounded-lg p-2 border">
                <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {opt.key}
                </span>
                <input
                  type="text"
                  value={opt.text}
                  onChange={e => {
                    const opts = [...form.linkedOptions];
                    opts[i] = { ...opts[i], text: e.target.value };
                    set('linkedOptions', opts);
                  }}
                  className={`${ADMIN_INPUT_CLASS} flex-1 px-2 py-1`}
                  placeholder="Từ (Tiếng Việt)"
                />
                <input
                  type="text"
                  value={opt.textCn}
                  onChange={e => {
                    const opts = [...form.linkedOptions];
                    opts[i] = { ...opts[i], textCn: e.target.value };
                    set('linkedOptions', opts);
                  }}
                  className={`${ADMIN_INPUT_CLASS} flex-1 px-2 py-1`}
                  placeholder="词语 (中文)"
                />
                <input
                  type="text"
                  value={opt.textEn || ''}
                  onChange={e => {
                    const opts = [...form.linkedOptions];
                    opts[i] = { ...opts[i], textEn: e.target.value };
                    set('linkedOptions', opts);
                  }}
                  className={`${ADMIN_INPUT_CLASS} flex-1 px-2 py-1`}
                  placeholder="Word (English)"
                />
                {form.linkedOptions.length > 2 && (
                  <button onClick={() => set('linkedOptions', form.linkedOptions.filter((_, j) => j !== i))}
                    className="text-red-400 hover:text-red-600">
                    <FiTrash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ── Nội dung câu hỏi ───────────────────────────────────────────────────────
  const renderQuestionContent = () => (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Câu hỏi (Tiếng Việt)</label>
        <textarea
          value={stripPlainTextMathMarker(form.questionText)}
          onChange={e => setMathText('questionText', e.target.value)}
          rows={2}
          className={ADMIN_TEXTAREA_CLASS}
          placeholder="Nhập câu hỏi..."
        />
        {renderMathPreview(form.questionText, value => set('questionText', value), undefined, 'questionText')}
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">问题 (中文)</label>
        <textarea
          value={stripPlainTextMathMarker(form.questionTextCn)}
          onChange={e => setMathText('questionTextCn', e.target.value)}
          rows={2}
          className={ADMIN_TEXTAREA_CLASS}
          placeholder="输入中文问题..."
        />
        {renderMathPreview(form.questionTextCn, value => set('questionTextCn', value), undefined, 'questionTextCn')}
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Question (English)</label>
        <textarea
          value={stripPlainTextMathMarker(form.questionTextEn)}
          onChange={e => setMathText('questionTextEn', e.target.value)}
          rows={2}
          className={ADMIN_TEXTAREA_CLASS}
          placeholder="Enter English question..."
        />
        {renderMathPreview(form.questionTextEn, value => set('questionTextEn', value), undefined, 'questionTextEn')}
      </div>

      <ImageUpload
        label="Hình ảnh câu hỏi (tùy chọn)"
        currentImage={form.imageUrl}
        onImageUploaded={url => set('imageUrl', url)}
      />
    </div>
  );

  // ── Đáp án trắc nghiệm A-B-C-D ───────────────────────────────────────────
  const renderChoicesSection = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-gray-800 text-sm">Các lựa chọn</h4>
        {form.answers.length < 8 && (
          <button onClick={() => set('answers', [...form.answers, { text: '', textCn: '', textEn: '', imageUrl: '' }])}
            className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded border border-blue-200 hover:bg-blue-100">
            + Thêm lựa chọn
          </button>
        )}
      </div>

      {form.answers.map((ans, i) => {
        const key = ANSWER_KEYS[i];
        const isCorrect = form.correctAnswer === key;
        return (
          <div key={key} className={`rounded-lg p-3 border ${isCorrect ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="radio"
                name="correctAnswer"
                checked={isCorrect}
                onChange={() => set('correctAnswer', key)}
                className="w-4 h-4 text-blue-600"
              />
              <span className={`font-bold text-sm ${isCorrect ? 'text-green-700' : 'text-gray-500'}`}>
                {key}. {isCorrect && <span className="text-green-600 text-xs ml-1">✓ Đáp án đúng</span>}
              </span>
              {form.answers.length > 2 && (
                <button onClick={() => set('answers', form.answers.filter((_, j) => j !== i))}
                  className="ml-auto text-gray-400 hover:text-red-500">
                  <FiTrash2 size={13} />
                </button>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase text-gray-400">Tiếng Việt</span>
                <input
                  type="text"
                  value={stripPlainTextMathMarker(ans.text)}
                  onChange={e => {
                    const a = [...form.answers]; a[i] = { ...a[i], text: preservePlainTextMathMode(ans.text, e.target.value) };
                    set('answers', a);
                  }}
                  className={`${ADMIN_INPUT_CLASS} py-1`}
                  placeholder={`Lựa chọn ${key} (Tiếng Việt)...`}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase text-gray-400">Tiếng Trung</span>
                <input
                  type="text"
                  value={stripPlainTextMathMarker(ans.textCn)}
                  onChange={e => {
                    const a = [...form.answers]; a[i] = { ...a[i], textCn: preservePlainTextMathMode(ans.textCn, e.target.value) };
                    set('answers', a);
                  }}
                  className={`${ADMIN_INPUT_CLASS} py-1`}
                  placeholder={`选项${key} (中文)...`}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase text-gray-400">Tiếng Anh</span>
                <input
                  type="text"
                  value={stripPlainTextMathMarker(ans.textEn || '')}
                  onChange={e => {
                    const a = [...form.answers]; a[i] = { ...a[i], textEn: preservePlainTextMathMode(ans.textEn || '', e.target.value) };
                    set('answers', a);
                  }}
                  className={`${ADMIN_INPUT_CLASS} py-1`}
                  placeholder={`Option ${key} (English)...`}
                />
              </label>
            </div>

            {ans.text && renderMathPreview(ans.text, value => {
              const a = [...form.answers]; a[i] = { ...a[i], text: value };
              set('answers', a);
            }, 'Xem trước đáp án:', `answer-${i}-text`)}
            {ans.textCn && ans.textCn !== ans.text && renderMathPreview(ans.textCn, value => {
              const a = [...form.answers]; a[i] = { ...a[i], textCn: value };
              set('answers', a);
            }, 'Xem trước đáp án Trung:', `answer-${i}-textCn`)}

            {/* Ảnh đính kèm đáp án */}
            <div className="mt-2">
              <ImageUpload
                label={`Ảnh đáp án ${key} (tùy chọn)`}
                currentImage={ans.imageUrl}
                onImageUploaded={url => {
                  const answers = [...form.answers];
                  answers[i] = { ...answers[i], imageUrl: url };
                  set('answers', answers);
                }}
                compact
              />
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── Điểm & Độ khó ──────────────────────────────────────────────────────────
  const renderMeta = () => (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Điểm</label>
        <input
          type="number"
          value={form.points}
          onChange={e => set('points', Math.max(0.1, parseFloat(e.target.value) || 1))}
          min={0.1} max={100} step={0.1}
          className={ADMIN_INPUT_CLASS}
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Độ khó</label>
        <select value={form.difficulty}
          onChange={e => set('difficulty', e.target.value)}
          className={ADMIN_SELECT_CLASS}>
          <option value="easy">Dễ</option>
          <option value="medium">Trung bình</option>
          <option value="hard">Khó</option>
        </select>
      </div>
      {form.questionType === 'single_choice' && (
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Đáp án đúng</label>
          <select
            value={form.correctAnswer}
            onChange={e => set('correctAnswer', e.target.value)}
            className={ADMIN_SELECT_CLASS}>
            {ANSWER_KEYS.slice(0, Math.max(4, form.answers.length)).map(k => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );

  // ── Giải thích ────────────────────────────────────────────────────────────
  const renderExplanation = () => (
    <details className="rounded-xl border border-blue-200 bg-blue-50 shadow-sm">
      <summary className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-bold text-blue-900 transition-colors hover:bg-blue-100">
        💡 Giải thích đáp án (tùy chọn)
      </summary>
      <div className="px-4 pb-4 pt-1">
        <MathInput
          label="Giải thích (Tiếng Việt)"
          value={form.explanation}
          onChange={v => set('explanation', v)}
          placeholder="VD: Vì f'(x) = 2x + 1, nên \(f'(0) = 1\) → đáp án B"
          cnLabel="Giải thích (中文)"
          cnValue={form.explanationCn}
          onCnChange={v => set('explanationCn', v)}
          cnPlaceholder="解释正确答案..."
          enLabel="Explanation (English)"
          enValue={form.explanationEn}
          onEnChange={v => set('explanationEn', v)}
          enPlaceholder="Explain the correct answer in English..."
          defaultTab="cn"
        />
        <div className="mt-4 rounded-lg border border-blue-100 bg-white/80 p-3">
          <ImageUpload
            label="Ảnh giải thích (tùy chọn)"
            currentImage={form.explanationImageUrl}
            onImageUploaded={url => set('explanationImageUrl', url)}
            compact
          />
          <input
            value={form.explanationImageUrl}
            onChange={e => set('explanationImageUrl', e.target.value)}
            className={`${ADMIN_INPUT_CLASS} mt-3`}
            placeholder="Hoặc dán URL ảnh giải thích..."
          />
        </div>
      </div>
    </details>
  );

  // ── Render chính ─────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">

      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white font-bold text-sm">
            {questionNumber}
          </span>
          <div>
            <h3 className="text-white font-bold">
              {savedQuestionId ? `Sửa Câu ${questionNumber}` : `Câu hỏi ${questionNumber}`}
            </h3>
            <p className="text-white/70 text-xs">{qtype.desc}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {savedQuestionId && (
            <span className="px-2 py-1 bg-yellow-400/30 text-yellow-200 rounded text-xs font-semibold">
              Đã lưu
            </span>
          )}
          {onCancel && (
            <button onClick={onCancel}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 text-white rounded-lg font-semibold text-sm hover:bg-white/30">
              <FiX size={15} />
              Hủy
            </button>
          )}
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-700 rounded-lg font-semibold text-sm hover:bg-indigo-50 disabled:opacity-60">
            <FiSave size={15} />
            {saving ? 'Đang lưu...' : savedQuestionId ? 'Cập nhật' : 'Lưu'}
          </button>
          {onDelete && (
            <button onClick={onDelete}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-white rounded-lg font-semibold text-sm hover:bg-red-500/30">
              <FiTrash2 size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-5">

        {/* 1. Loại câu hỏi */}
        {renderQuestionTypeSelector()}

        {form.questionType === 'single_choice' && (
          <SingleQuestionOcrPaste onApply={applySingleQuestionOcr} onClear={clearSingleQuestionOcr} />
        )}

        {/* 2. Đoạn văn + Pool A-F (cho fill_blank_pool & reading_passage) */}
        {(form.questionType === 'fill_blank_pool' || form.questionType === 'reading_passage') &&
          renderPassageSection()}

        {/* 3. Nội dung câu hỏi */}
        {form.questionType === 'single_choice' && renderQuestionContent()}

        {/* 4. Đáp án (chỉ trắc nghiệm) */}
        {form.questionType === 'single_choice' && renderChoicesSection()}

        {/* 5. Metadata */}
        {renderMeta()}

        {/* 6. Giải thích */}
        {renderExplanation()}

      </div>
    </div>
  );
}
