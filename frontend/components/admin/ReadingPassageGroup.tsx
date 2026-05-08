'use client';

import { useState } from 'react';
import { FiTrash2, FiSave, FiPlus, FiChevronDown, FiChevronUp, FiImage } from 'react-icons/fi';
import ImageUpload from './ImageUpload';
import MathInput from './MathInput';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReadingSubQuestion {
  _localId: string;
  questionText: string;
  questionTextCn: string;
  imageUrl: string;
  points: number;
  explanation: string;
  explanationCn: string;
  answers: { text: string; textCn: string; imageUrl: string }[];
  correctAnswer: string;
  difficulty: string;
  subQuestionNumber: number; // 73, 74, 75...
}

export interface ReadingPassageGroupData {
  _id: string;
  _localId: string;
  passageText: string;
  passageImageUrl: string;
  subQuestions: ReadingSubQuestion[];
}

interface ReadingPassageGroupProps {
  /** Số thứ tự bắt đầu của đoạn văn (VD: 73) */
  startNumber: number;
  initialData?: ReadingPassageGroupData;
  onSave: (data: ReadingPassageGroupData) => void;
  onDelete?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ANSWER_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

function makeSubQuestion(startNum: number, index: number): ReadingSubQuestion {
  return {
    _localId: `sq-${Date.now()}-${index}`,
    questionText: '',
    questionTextCn: '',
    imageUrl: '',
    points: 1,
    explanation: '',
    explanationCn: '',
    answers: [
      { text: '', textCn: '', imageUrl: '' },
      { text: '', textCn: '', imageUrl: '' },
      { text: '', textCn: '', imageUrl: '' },
      { text: '', textCn: '', imageUrl: '' },
    ],
    correctAnswer: 'A',
    difficulty: 'medium',
    subQuestionNumber: startNum + index,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReadingPassageGroup({
  startNumber,
  initialData,
  onSave,
  onDelete,
}: ReadingPassageGroupProps) {
  const [group, setGroup] = useState<ReadingPassageGroupData>(() =>
    initialData
      ? { ...initialData }
      : {
          _id: `rg-${Date.now()}`,
          _localId: `rg-${Date.now()}`,
          passageText: '',
          passageImageUrl: '',
          subQuestions: [makeSubQuestion(startNumber, 0)],
        }
  );

  const [saving, setSaving] = useState(false);
  const [expandedSubs, setExpandedSubs] = useState<Record<string, boolean>>({});

  const toggleSub = (id: string) =>
    setExpandedSubs(prev => ({ ...prev, [id]: !prev[id] }));

  // ── Passage ──────────────────────────────────────────────────────────────
  const setPassage = (key: keyof Pick<ReadingPassageGroupData, 'passageText' | 'passageImageUrl'>, value: string) =>
    setGroup(prev => ({ ...prev, [key]: value }));

  // ── Sub question helpers ─────────────────────────────────────────────────
  const setSubQuestion = <K extends keyof ReadingSubQuestion>(
    localId: string,
    key: K,
    value: ReadingSubQuestion[K]
  ) =>
    setGroup(prev => ({
      ...prev,
      subQuestions: prev.subQuestions.map(sq =>
        sq._localId === localId ? { ...sq, [key]: value } : sq
      ),
    }));

  const updateSubAnswer = (
    localId: string,
    index: number,
    key: 'text' | 'textCn' | 'imageUrl',
    value: string
  ) =>
    setGroup(prev => ({
      ...prev,
      subQuestions: prev.subQuestions.map(sq => {
        if (sq._localId !== localId) return sq;
        const answers = sq.answers.map((a, i) =>
          i === index ? { ...a, [key]: value } : a
        );
        return { ...sq, answers };
      }),
    }));

  const addSubQuestion = () =>
    setGroup(prev => ({
      ...prev,
      subQuestions: [
        ...prev.subQuestions,
        makeSubQuestion(startNumber, prev.subQuestions.length),
      ],
    }));

  const removeSubQuestion = (localId: string) =>
    setGroup(prev => ({
      ...prev,
      subQuestions: prev.subQuestions.filter(sq => sq._localId !== localId),
    }));

  // ── Save ────────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!group.passageText.trim()) {
      alert('Vui lòng nhập đoạn văn đọc hiểu');
      return;
    }

    // Check at least one question has content
    const hasContent = group.subQuestions.some(
      sq => sq.questionText.trim() || sq.questionTextCn.trim()
    );
    if (!hasContent) {
      alert('Vui lòng nhập ít nhất một câu hỏi');
      return;
    }

    setSaving(true);
    onSave(group);
    setTimeout(() => setSaving(false), 1500);
  };

  // ── Auto number labels ─────────────────────────────────────────────────
  const getQuestionLabel = (index: number) => {
    const num = startNumber + index;
    return `Câu ${num}`;
  };

  // ── Render single sub-question ─────────────────────────────────────────
  const renderSubQuestion = (sq: ReadingSubQuestion, index: number) => {
    const isExpanded = expandedSubs[sq._localId] ?? true;
    const isCorrect = (key: string) => sq.correctAnswer === key;

    return (
      <div key={sq._localId} className="border border-violet-200 rounded-xl overflow-hidden bg-violet-50/30">
        {/* Sub-question header */}
        <button
          type="button"
          onClick={() => toggleSub(sq._localId)}
          className="w-full flex items-center justify-between px-4 py-3 bg-violet-100/60 hover:bg-violet-200/60 transition-colors text-left"
        >
          <span className="font-bold text-violet-800 text-sm">
            {getQuestionLabel(index)}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-violet-600">
              {sq.questionTextCn || sq.questionText
                ? sq.questionTextCn.slice(0, 40) + (sq.questionTextCn.length > 40 ? '...' : '')
                : '— chưa nhập câu hỏi'}
            </span>
            {isExpanded ? (
              <FiChevronUp size={14} className="text-violet-500 flex-shrink-0" />
            ) : (
              <FiChevronDown size={14} className="text-violet-500 flex-shrink-0" />
            )}
          </div>
        </button>

        {isExpanded && (
          <div className="p-4 space-y-3">
            {/* Question text */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Câu hỏi (Tiếng Việt)</label>
              <textarea
                value={sq.questionText}
                onChange={e => setSubQuestion(sq._localId, 'questionText', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                placeholder="Nhập câu hỏi..."
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">问题 (中文)</label>
              <textarea
                value={sq.questionTextCn}
                onChange={e => setSubQuestion(sq._localId, 'questionTextCn', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                placeholder="输入中文问题..."
              />
            </div>

            {/* Answers */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h5 className="text-xs font-semibold text-gray-600">Các lựa chọn</h5>
                {sq.answers.length < 8 && (
                  <button
                    type="button"
                    onClick={() =>
                      setSubQuestion(sq._localId, 'answers', [
                        ...sq.answers,
                        { text: '', textCn: '', imageUrl: '' },
                      ])
                    }
                    className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded border border-blue-200 hover:bg-blue-100"
                  >
                    + Thêm
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {sq.answers.map((ans, i) => {
                  const key = ANSWER_KEYS[i];
                  return (
                    <div
                      key={key}
                      className={`rounded-lg p-2 border ${
                        isCorrect(key) ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <input
                          type="radio"
                          name={`correct-${sq._localId}`}
                          checked={isCorrect(key)}
                          onChange={() => setSubQuestion(sq._localId, 'correctAnswer', key)}
                          className="w-3.5 h-3.5 text-blue-600"
                        />
                        <span className={`text-xs font-bold ${isCorrect(key) ? 'text-green-700' : 'text-gray-500'}`}>
                          {key}. {isCorrect(key) && <span className="text-green-600 ml-1">✓</span>}
                        </span>
                        {sq.answers.length > 2 && (
                          <button
                            type="button"
                            onClick={() =>
                              setSubQuestion(
                                sq._localId,
                                'answers',
                                sq.answers.filter((_, j) => j !== i)
                              )
                            }
                            className="ml-auto text-gray-400 hover:text-red-500"
                          >
                            <FiTrash2 size={12} />
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={ans.text}
                        onChange={e => updateSubAnswer(sq._localId, i, 'text', e.target.value)}
                        className="w-full px-2 py-1 border rounded text-xs mb-1"
                        placeholder={`${key} (Tiếng Việt)...`}
                      />
                      <input
                        type="text"
                        value={ans.textCn}
                        onChange={e => updateSubAnswer(sq._localId, i, 'textCn', e.target.value)}
                        className="w-full px-2 py-1 border rounded text-xs"
                        placeholder={`${key} (中文)...`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Điểm</label>
                <input
                  type="number"
                  value={sq.points}
                  onChange={e =>
                    setSubQuestion(sq._localId, 'points', Math.max(0.1, parseFloat(e.target.value) || 1))
                  }
                  min={0.1}
                  max={100}
                  step={0.1}
                  className="w-full px-2 py-1.5 border rounded-lg text-sm bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Độ khó</label>
                <select
                  value={sq.difficulty}
                  onChange={e => setSubQuestion(sq._localId, 'difficulty', e.target.value)}
                  className="w-full px-2 py-1.5 border rounded-lg text-sm bg-white"
                >
                  <option value="easy">Dễ</option>
                  <option value="medium">Trung bình</option>
                  <option value="hard">Khó</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Đáp án</label>
                <select
                  value={sq.correctAnswer}
                  onChange={e => setSubQuestion(sq._localId, 'correctAnswer', e.target.value)}
                  className="w-full px-2 py-1.5 border rounded-lg text-sm bg-white"
                >
                  {ANSWER_KEYS.slice(0, Math.max(4, sq.answers.length)).map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Explanation */}
            <details className="bg-gray-50 rounded-lg border">
              <summary className="px-3 py-1.5 cursor-pointer text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-lg">
                💡 Giải thích (tùy chọn)
              </summary>
              <div className="px-3 pb-2">
                <MathInput
                  value={sq.explanation}
                  onChange={v => setSubQuestion(sq._localId, 'explanation', v)}
                  placeholder="VD: Vì f'(x) = 2x + 1, nên \(f'(0) = 1\) → đáp án B"
                  cnValue={sq.explanationCn}
                  onCnChange={v => setSubQuestion(sq._localId, 'explanationCn', v)}
                  cnPlaceholder="解释正确答案..."
                />
              </div>
            </details>

            {/* Remove */}
            {group.subQuestions.length > 1 && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => removeSubQuestion(sq._localId)}
                  className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded border border-red-200 hover:bg-red-50"
                >
                  <FiTrash2 size={12} />
                  Xóa câu này
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── Main render ──────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl shadow-lg border border-purple-300 overflow-hidden">
      {/* Card header */}
      <div className="bg-gradient-to-r from-purple-600 to-violet-600 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📖</span>
          <div>
            <h3 className="text-white font-bold">
              Đoạn đọc hiểu — {getQuestionLabel(0)}
              {group.subQuestions.length > 1 && ` → ${getQuestionLabel(group.subQuestions.length - 1)}`}
            </h3>
            <p className="text-white/70 text-xs">
              {group.subQuestions.length} câu hỏi · Điều chỉnh đoạn văn một lần, không cần lặp lại
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-white text-purple-700 rounded-lg font-semibold text-sm hover:bg-purple-50 disabled:opacity-60"
          >
            <FiSave size={15} />
            {saving ? 'Đang lưu...' : 'Lưu đoạn văn'}
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-white rounded-lg font-semibold text-sm hover:bg-red-500/30"
            >
              <FiTrash2 size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Passage text */}
        <div className="bg-purple-50/60 border border-purple-200 rounded-xl p-4">
          <label className="block text-sm font-bold text-purple-800 mb-2">
            📝 Đoạn văn đọc hiểu
          </label>
          <textarea
            value={group.passageText}
            onChange={e => setPassage('passageText', e.target.value)}
            rows={6}
            className="w-full px-4 py-2 border border-purple-200 rounded-lg bg-white text-sm leading-relaxed"
            placeholder="粘贴中文短文... (Dán đoạn văn tiếng Trung vào đây)"
          />
          <ImageUpload
            label="Ảnh đính kèm đoạn văn (tùy chọn)"
            currentImage={group.passageImageUrl}
            onImageUploaded={url => setPassage('passageImageUrl', url)}
          />
        </div>

        {/* Sub-questions */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-gray-800 text-sm">
              📋 Câu hỏi ({group.subQuestions.length})
            </h4>
            <button
              type="button"
              onClick={addSubQuestion}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-violet-100 text-violet-700 rounded-lg border border-violet-200 hover:bg-violet-200 font-semibold"
            >
              <FiPlus size={13} />
              Thêm câu hỏi
            </button>
          </div>

          {group.subQuestions.map((sq, index) => renderSubQuestion(sq, index))}
        </div>
      </div>
    </div>
  );
}
