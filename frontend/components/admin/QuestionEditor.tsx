'use client';

import { useState, useEffect } from 'react';
import { FiTrash2, FiSave, FiPlus } from 'react-icons/fi';
import ImageUpload from './ImageUpload';

// ─── Types ──────────────────────────────────────────────────────────────────────────

type QuestionType =
  | 'single_choice'
  | 'fill_blank_pool'
  | 'fill_blank_item'
  | 'reading_passage'
  | 'reading_item'
  | 'true_false';

export interface LinkedOption {
  key: string;   // 'A', 'B', 'C', 'D', 'E', 'F'
  text: string;  // tiếng Việt / mô tả
  textCn: string; // tiếng Trung
}

export interface QuestionFormData {
  questionType: QuestionType;
  questionText: string;
  questionTextCn: string;
  imageUrl: string;
  passageText: string;
  passageImageUrl: string;
  points: number;
  explanation: string;
  explanationCn: string;
  answers: { text: string; textCn: string; imageUrl: string }[];
  correctAnswer: string;       // cho single_choice, reading_item, true_false
  linkedOptions: LinkedOption[]; // pool A-F cho fill_blank_pool
  correctAnswerKey: string;   // 'A','B'... cho fill_blank_item
  subQuestionNumber: number;  // số câu con (34, 35, 36...)
  difficulty: string;
}

interface QuestionEditorProps {
  questionNumber: number;
  initialData?: Partial<QuestionFormData>;
  onSave: (data: QuestionFormData) => void;
  onDelete?: () => void;
  /** Pass an existing saved question to enable UPDATE instead of CREATE */
  savedQuestionId?: number;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────────
const DEFAULT_ANSWERS = (count = 4) =>
  Array.from({ length: count }, () => ({ text: '', textCn: '', imageUrl: '' }));

const DEFAULT_LINKED_OPTIONS: LinkedOption[] = [
  { key: 'A', text: '', textCn: '' },
  { key: 'B', text: '', textCn: '' },
  { key: 'C', text: '', textCn: '' },
  { key: 'D', text: '', textCn: '' },
  { key: 'E', text: '', textCn: '' },
  { key: 'F', text: '', textCn: '' },
];

function getDefaults(initial?: Partial<QuestionFormData>): QuestionFormData {
  return {
    questionType: (initial?.questionType as QuestionType) || 'single_choice',
    questionText: initial?.questionText || '',
    questionTextCn: initial?.questionTextCn || '',
    imageUrl: initial?.imageUrl || '',
    passageText: initial?.passageText || '',
    passageImageUrl: initial?.passageImageUrl || '',
    points: initial?.points || 1,
    explanation: initial?.explanation || '',
    explanationCn: initial?.explanationCn || '',
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
  fill_blank_item:  { label: '🔤 Câu điền từ con',       desc: 'Câu con trong nhóm điền từ', color: 'emerald', bg: 'bg-emerald-50 border-emerald-200' },
  reading_passage:  { label: '📖 Đọc hiểu (đầu đoạn)',  desc: 'Bắt đầu đoạn văn đọc hiểu', color: 'purple', bg: 'bg-purple-50 border-purple-200' },
  reading_item:     { label: '📋 Câu đọc hiểu con',       desc: 'Câu con trong đoạn đọc hiểu', color: 'violet', bg: 'bg-violet-50 border-violet-200' },
  true_false:       { label: '✅ Đúng / Sai',             desc: 'Chọn Đúng hoặc Sai', color: 'cyan', bg: 'bg-cyan-50 border-cyan-200' },
};

const ANSWER_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const LINKED_KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

// ─── Component ──────────────────────────────────────────────────────────────────
export default function QuestionEditor({ questionNumber, initialData, onSave, onDelete, savedQuestionId }: QuestionEditorProps) {
  const [form, setForm] = useState<QuestionFormData>(getDefaults(initialData));
  const [saving, setSaving] = useState(false);

  // Track whether we've loaded saved data (prevents overwriting with defaults on re-render)
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialData) {
      setForm(getDefaults(initialData));
      setInitialized(true);
    }
  }, [initialData]);

  const set = <K extends keyof QuestionFormData>(key: K, value: QuestionFormData[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = () => {
    // Validation cơ bản
    if (form.questionType === 'fill_blank_item') {
      // Câu con điền từ: không cần questionText
    } else if (!form.questionText.trim() && !form.questionTextCn.trim()) {
      alert('Vui lòng nhập nội dung câu hỏi (Tiếng Việt hoặc Tiếng Trung)');
      return;
    }

    if ((form.questionType === 'single_choice' || form.questionType === 'reading_item') &&
        form.answers.every(a => !a.text.trim() && !a.textCn.trim())) {
      alert('Vui lòng nhập ít nhất 2 đáp án');
      return;
    }

    if (form.questionType === 'fill_blank_pool') {
      const filledOpts = form.linkedOptions.filter(o => o.text.trim() || o.textCn.trim());
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
  const renderQuestionTypeSelector = () => (
    <div className={`p-4 rounded-xl border-2 ${qtype.bg}`}>
      <label className="block text-sm font-bold mb-2" style={{ color: `var(--tw-colors[${
        qtype.color === 'blue' ? 'blue-600' :
        qtype.color === 'green' ? 'green-600' :
        qtype.color === 'emerald' ? 'emerald-600' :
        qtype.color === 'purple' ? 'purple-600' :
        qtype.color === 'violet' ? 'violet-600' :
        'cyan-600' }])` }}>
        Loại câu hỏi
      </label>
      <select
        value={form.questionType}
        onChange={e => set('questionType', e.target.value as QuestionType)}
        className="w-full px-3 py-2 rounded-lg border bg-white font-medium"
      >
        {(Object.entries(QUESTION_TYPE_LABELS) as [QuestionType, typeof qtype][]).map(([val, info]) => (
          <option key={val} value={val}>{info.label} — {info.desc}</option>
        ))}
      </select>
    </div>
  );

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
        className="w-full px-4 py-2 border rounded-lg mb-3"
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
                  className="flex-1 px-2 py-1 border rounded text-sm"
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
                  className="flex-1 px-2 py-1 border rounded text-sm"
                  placeholder="词语 (中文)"
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
      {form.questionType !== 'fill_blank_item' && (
        <>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Câu hỏi (Tiếng Việt)</label>
            <textarea
              value={form.questionText}
              onChange={e => set('questionText', e.target.value)}
              rows={2}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="Nhập câu hỏi..."
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">问题 (中文)</label>
            <textarea
              value={form.questionTextCn}
              onChange={e => set('questionTextCn', e.target.value)}
              rows={2}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="输入中文问题..."
            />
          </div>
        </>
      )}

      {form.questionType === 'fill_blank_item' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs text-amber-700 mb-2">
            ⚠️ Câu điền từ con — nội dung câu hỏi dùng chung từ đoạn văn ở trên.
            Chỉ cần chọn đáp án đúng và số câu.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Số câu con (VD: 35, 36, 37...)</label>
              <input
                type="number"
                value={form.subQuestionNumber || ''}
                onChange={e => set('subQuestionNumber', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-1.5 border rounded-lg text-sm"
                placeholder="35"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Đáp án đúng</label>
              <select
                value={form.correctAnswerKey}
                onChange={e => set('correctAnswerKey', e.target.value)}
                className="w-full px-3 py-1.5 border rounded-lg text-sm"
              >
                {form.linkedOptions.map(opt => (
                  <option key={opt.key} value={opt.key}>
                    {opt.key}. {opt.textCn || opt.text || '...'}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {form.questionType === 'reading_item' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Số câu con (VD: 34, 35, 36...)</label>
            <input
              type="number"
              value={form.subQuestionNumber || ''}
              onChange={e => set('subQuestionNumber', parseInt(e.target.value) || 0)}
              className="w-full px-3 py-1.5 border rounded-lg text-sm"
              placeholder="34"
            />
          </div>
        </div>
      )}

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
        {form.questionType !== 'true_false' && form.answers.length < 8 && (
          <button onClick={() => set('answers', [...form.answers, { text: '', textCn: '', imageUrl: '' }])}
            className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded border border-blue-200 hover:bg-blue-100">
            + Thêm lựa chọn
          </button>
        )}
      </div>

      {form.answers.map((ans, i) => {
        const key = ANSWER_KEYS[i];
        const isCorrect = form.correctAnswer === key || form.correctAnswerKey === key;
        return (
          <div key={key} className={`rounded-lg p-3 border ${isCorrect ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="radio"
                name="correctAnswer"
                checked={isCorrect}
                onChange={() => {
                  if (form.questionType === 'fill_blank_item') set('correctAnswerKey', key);
                  else set('correctAnswer', key);
                }}
                className="w-4 h-4 text-blue-600"
              />
              <span className={`font-bold text-sm ${isCorrect ? 'text-green-700' : 'text-gray-500'}`}>
                {key}. {isCorrect && <span className="text-green-600 text-xs ml-1">✓ Đáp án đúng</span>}
              </span>
              {form.questionType !== 'true_false' && form.answers.length > 2 && (
                <button onClick={() => set('answers', form.answers.filter((_, j) => j !== i))}
                  className="ml-auto text-gray-400 hover:text-red-500">
                  <FiTrash2 size={13} />
                </button>
              )}
            </div>
            {form.questionType !== 'true_false' && (
              <>
                <input
                  type="text"
                  value={ans.text}
                  onChange={e => {
                    const a = [...form.answers]; a[i] = { ...a[i], text: e.target.value };
                    set('answers', a);
                  }}
                  className="w-full px-3 py-1 border rounded mb-1.5 text-sm"
                  placeholder={`Lựa chọn ${key} (Tiếng Việt)...`}
                />
                <input
                  type="text"
                  value={ans.textCn}
                  onChange={e => {
                    const a = [...form.answers]; a[i] = { ...a[i], textCn: e.target.value };
                    set('answers', a);
                  }}
                  className="w-full px-3 py-1 border rounded text-sm"
                  placeholder={`选项${key} (中文)...`}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );

  // ── Điểm & Độ khó ──────────────────────────────────────────────────────────
  const renderMeta = () => (
    <div className="grid grid-cols-3 gap-3">
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Điểm</label>
        <input
          type="number"
          value={form.points}
          onChange={e => set('points', Math.max(0.1, parseFloat(e.target.value) || 1))}
          min={0.1} max={100} step={0.1}
          className="w-full px-3 py-1.5 border rounded-lg text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Độ khó</label>
        <select value={form.difficulty}
          onChange={e => set('difficulty', e.target.value)}
          className="w-full px-3 py-1.5 border rounded-lg text-sm">
          <option value="easy">Dễ</option>
          <option value="medium">Trung bình</option>
          <option value="hard">Khó</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Đáp án đúng</label>
        <select
          value={form.questionType === 'fill_blank_item' ? form.correctAnswerKey : form.correctAnswer}
          onChange={e => {
            if (form.questionType === 'fill_blank_item') set('correctAnswerKey', e.target.value);
            else set('correctAnswer', e.target.value);
          }}
          className="w-full px-3 py-1.5 border rounded-lg text-sm">
          {ANSWER_KEYS.slice(0, Math.max(4, form.answers.length, form.linkedOptions.length)).map(k => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
      </div>
    </div>
  );

  // ── Giải thích ────────────────────────────────────────────────────────────
  const renderExplanation = () => (
    <details className="bg-gray-50 rounded-lg border">
      <summary className="px-4 py-2 cursor-pointer text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg">
        💡 Giải thích đáp án (tùy chọn)
      </summary>
      <div className="px-4 pb-4 space-y-2">
        <input
          type="text"
          value={form.explanation}
          onChange={e => set('explanation', e.target.value)}
          className="w-full px-3 py-1.5 border rounded-lg text-sm"
          placeholder="Giải thích (Tiếng Việt)..."
        />
        <input
          type="text"
          value={form.explanationCn}
          onChange={e => set('explanationCn', e.target.value)}
          className="w-full px-3 py-1.5 border rounded-lg text-sm"
          placeholder="解释正确答案 (中文)..."
        />
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

        {/* 2. Đoạn văn + Pool A-F (cho fill_blank_pool & reading_passage) */}
        {(form.questionType === 'fill_blank_pool' || form.questionType === 'reading_passage') &&
          renderPassageSection()}

        {/* 3. Nội dung câu hỏi */}
        {form.questionType !== 'fill_blank_pool' &&
          form.questionType !== 'reading_passage' &&
          renderQuestionContent()}

        {/* 4. Đáp án */}
        {(form.questionType === 'single_choice' || form.questionType === 'reading_item') &&
          renderChoicesSection()}

        {/* True/False */}
        {form.questionType === 'true_false' && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-700">Chọn đáp án đúng:</p>
            {['Đúng', 'Sai'].map((label, i) => {
              const key = i === 0 ? 'T' : 'F';
              return (
                <button key={key}
                  onClick={() => set('correctAnswer', key)}
                  className={`w-full p-3 rounded-lg border-2 text-left font-medium transition-all ${
                    form.correctAnswer === key
                      ? 'border-green-500 bg-green-50 text-green-800'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  {key === 'T' ? '✅ Đúng (True)' : '❌ Sai (False)'}
                </button>
              );
            })}
          </div>
        )}

        {/* 5. Metadata */}
        {renderMeta()}

        {/* 6. Giải thích */}
        {renderExplanation()}

      </div>
    </div>
  );
}
