'use client';

import { useState } from 'react';
import { FiTrash2, FiSave, FiPlus, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import ImageUpload from './ImageUpload';
import MathInput from './MathInput';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BlankSubItem {
  _localId: string;
  questionText: string;      // câu hỏi (có thể trống nếu chỉ cần điền từ)
  questionTextCn: string;   // 中文问题
  points: number;
  explanation: string;
  explanationCn: string;
  correctAnswerKey: string;  // 'A', 'B', 'C', 'D', 'E'... — đáp án đúng
  difficulty: string;
  subQuestionNumber: number; // 44, 45, 46, 47, 48...
}

export interface FillBlankGroupData {
  _localId: string;
  passageText: string;
  passageImageUrl: string;
  linkedOptions: {
    key: string;
    text: string;
    textCn: string;
  }[];
  subItems: BlankSubItem[];
}

interface FillBlankGroupProps {
  /** Số bắt đầu (VD: 44) */
  startNumber: number;
  initialData?: FillBlankGroupData;
  onSave: (data: FillBlankGroupData) => void;
  onDelete?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSubItem(startNum: number, index: number): BlankSubItem {
  return {
    _localId: `fbi-${Date.now()}-${index}`,
    questionText: '',
    questionTextCn: '',
    points: 1,
    explanation: '',
    explanationCn: '',
    correctAnswerKey: 'A',
    difficulty: 'medium',
    subQuestionNumber: startNum + index,
  };
}

function getDefaultLinkedOptions() {
  return [
    { key: 'A', text: '', textCn: '' },
    { key: 'B', text: '', textCn: '' },
    { key: 'C', text: '', textCn: '' },
    { key: 'D', text: '', textCn: '' },
    { key: 'E', text: '', textCn: '' },
    { key: 'F', text: '', textCn: '' },
  ];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FillBlankGroup({
  startNumber,
  initialData,
  onSave,
  onDelete,
}: FillBlankGroupProps) {
  const [group, setGroup] = useState<FillBlankGroupData>(() =>
    initialData
      ? { ...initialData }
      : {
          _localId: `fbg-${Date.now()}`,
          passageText: '',
          passageImageUrl: '',
          linkedOptions: getDefaultLinkedOptions(),
          subItems: [makeSubItem(startNumber, 0)],
        }
  );

  const [saving, setSaving] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const toggleItem = (id: string) =>
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));

  // ── Passage ──────────────────────────────────────────────────────────────
  const setPassage = (key: 'passageText' | 'passageImageUrl', value: string) =>
    setGroup(prev => ({ ...prev, [key]: value }));

  // ── Linked options (pool A-F) ─────────────────────────────────────────────
  const setLinkedOption = (index: number, field: 'text' | 'textCn', value: string) =>
    setGroup(prev => ({
      ...prev,
      linkedOptions: prev.linkedOptions.map((opt, i) =>
        i === index ? { ...opt, [field]: value } : opt
      ),
    }));

  const addLinkedOption = () => {
    const nextKey = String.fromCharCode(65 + group.linkedOptions.length);
    if (group.linkedOptions.length < 12) {
      setGroup(prev => ({
        ...prev,
        linkedOptions: [...prev.linkedOptions, { key: nextKey, text: '', textCn: '' }],
      }));
    }
  };

  const removeLinkedOption = (index: number) =>
    setGroup(prev => ({
      ...prev,
      linkedOptions: prev.linkedOptions.filter((_, i) => i !== index),
    }));

  // ── Sub items ───────────────────────────────────────────────────────────
  const setSubItem = <K extends keyof BlankSubItem>(
    localId: string,
    key: K,
    value: BlankSubItem[K]
  ) =>
    setGroup(prev => ({
      ...prev,
      subItems: prev.subItems.map(item =>
        item._localId === localId ? { ...item, [key]: value } : item
      ),
    }));

  const addSubItem = () =>
    setGroup(prev => ({
      ...prev,
      subItems: [...prev.subItems, makeSubItem(startNumber, prev.subItems.length)],
    }));

  const removeSubItem = (localId: string) =>
    setGroup(prev => ({
      ...prev,
      subItems: prev.subItems.filter(item => item._localId !== localId),
    }));

  // ── Save ────────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!group.passageText.trim()) {
      alert('Vui lòng nhập đoạn văn điền từ');
      return;
    }

    const filledOpts = group.linkedOptions.filter(
      o => o.text.trim() || o.textCn.trim()
    );
    if (filledOpts.length < 2) {
      alert('Cần ít nhất 2 từ chọn có nội dung (A-F)');
      return;
    }

    setSaving(true);
    onSave(group);
    setTimeout(() => setSaving(false), 1500);
  };

  const getItemLabel = (index: number) => {
    const num = startNumber + index;
    return `Câu ${num}`;
  };

  const filledOptionCount = group.linkedOptions.filter(
    o => o.text.trim() || o.textCn.trim()
  ).length;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl shadow-lg border border-green-300 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📝</span>
          <div>
            <h3 className="text-white font-bold">
              Điền từ — {getItemLabel(0)}
              {group.subItems.length > 1 && ` → ${getItemLabel(group.subItems.length - 1)}`}
            </h3>
            <p className="text-white/70 text-xs">
              {group.subItems.length} chỗ trống · Pool {String.fromCharCode(65)}-
              {String.fromCharCode(65 + Math.max(0, filledOptionCount - 1))}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-white text-green-700 rounded-lg font-semibold text-sm hover:bg-green-50 disabled:opacity-60"
          >
            <FiSave size={15} />
            {saving ? 'Đang lưu...' : 'Lưu nhóm'}
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

        {/* Passage + Pool */}
        <div className="bg-green-50/60 border border-green-200 rounded-xl p-4">
          <label className="block text-sm font-bold text-green-800 mb-2">
            📝 Đoạn văn điền từ + Từ chọn A-F
          </label>
          <textarea
            value={group.passageText}
            onChange={e => setPassage('passageText', e.target.value)}
            rows={5}
            className="w-full px-4 py-2 border border-green-200 rounded-lg bg-white text-sm leading-relaxed"
            placeholder="粘贴中文短文，有空格的地方写____。例如：水在4°C时____最大。物体的____越大，惯性越大。"
          />
          <p className="text-xs text-green-600 mt-1 mb-3">
            💡 Dùng <code className="bg-green-100 px-1 rounded">____</code> làm chỗ trống trong đoạn văn
          </p>

          <ImageUpload
            label="Ảnh đính kèm đoạn văn (tùy chọn)"
            currentImage={group.passageImageUrl}
            onImageUploaded={url => setPassage('passageImageUrl', url)}
          />

          {/* Pool A-F */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-green-700">
                Từ chọn ({String.fromCharCode(65)}-{String.fromCharCode(65 + group.linkedOptions.length - 1)})
              </span>
              {group.linkedOptions.length < 12 && (
                <button
                  type="button"
                  onClick={addLinkedOption}
                  className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded border border-green-200 hover:bg-green-200"
                >
                  + Thêm từ
                </button>
              )}
            </div>
            <div className="space-y-2">
              {group.linkedOptions.map((opt, i) => (
                <div key={opt.key} className="flex items-center gap-2 bg-white rounded-lg p-2 border border-green-100">
                  <span className="w-7 h-7 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {opt.key}
                  </span>
                  <input
                    type="text"
                    value={opt.text}
                    onChange={e => setLinkedOption(i, 'text', e.target.value)}
                    className="flex-1 px-2 py-1 border rounded text-sm bg-white"
                    placeholder="Từ (Tiếng Việt)"
                  />
                  <input
                    type="text"
                    value={opt.textCn}
                    onChange={e => setLinkedOption(i, 'textCn', e.target.value)}
                    className="flex-1 px-2 py-1 border rounded text-sm bg-white"
                    placeholder="词语 (中文)"
                  />
                  {group.linkedOptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeLinkedOption(i)}
                      className="text-red-400 hover:text-red-600"
                    >
                      <FiTrash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sub-items: từng chỗ trống */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-gray-800 text-sm">
              🔤 Chỗ trống ({group.subItems.length})
            </h4>
            <button
              type="button"
              onClick={addSubItem}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 hover:bg-emerald-200 font-semibold"
            >
              <FiPlus size={13} />
              Thêm chỗ trống
            </button>
          </div>

          {group.subItems.map((item, index) => {
            const isExpanded = expandedItems[item._localId] ?? true;
            return (
              <div key={item._localId} className="border border-emerald-200 rounded-xl overflow-hidden bg-emerald-50/30">
                {/* Item header */}
                <button
                  type="button"
                  onClick={() => toggleItem(item._localId)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-emerald-100/60 hover:bg-emerald-200/60 transition-colors text-left"
                >
                  <span className="font-bold text-emerald-800 text-sm">
                    {getItemLabel(index)}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-emerald-600">
                      Đáp án: {item.correctAnswerKey} · {item.correctAnswerKey &&
                        (group.linkedOptions.find(o => o.key === item.correctAnswerKey)?.textCn ||
                         group.linkedOptions.find(o => o.key === item.correctAnswerKey)?.text ||
                         '— chưa chọn')}
                    </span>
                    {isExpanded ? (
                      <FiChevronUp size={14} className="text-emerald-500 flex-shrink-0" />
                    ) : (
                      <FiChevronDown size={14} className="text-emerald-500 flex-shrink-0" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="p-4 space-y-3">
                    {/* Đáp án đúng */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Đáp án đúng</label>
                        <select
                          value={item.correctAnswerKey}
                          onChange={e => setSubItem(item._localId, 'correctAnswerKey', e.target.value)}
                          className="w-full px-2 py-1.5 border rounded-lg text-sm bg-white"
                        >
                          {group.linkedOptions.map(opt => (
                            <option key={opt.key} value={opt.key}>
                              {opt.key}. {opt.textCn || opt.text || '...'}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Điểm</label>
                        <input
                          type="number"
                          value={item.points}
                          onChange={e =>
                            setSubItem(item._localId, 'points', Math.max(0.1, parseFloat(e.target.value) || 1))
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
                          value={item.difficulty}
                          onChange={e => setSubItem(item._localId, 'difficulty', e.target.value)}
                          className="w-full px-2 py-1.5 border rounded-lg text-sm bg-white"
                        >
                          <option value="easy">Dễ</option>
                          <option value="medium">Trung bình</option>
                          <option value="hard">Khó</option>
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
                          value={item.explanation}
                          onChange={v => setSubItem(item._localId, 'explanation', v)}
                          placeholder="VD: Vì f'(x) = 2x + 1, nên \(f'(0) = 1\) → đáp án A"
                          cnValue={item.explanationCn}
                          onCnChange={v => setSubItem(item._localId, 'explanationCn', v)}
                          cnPlaceholder="解释正确答案..."
                        />
                      </div>
                    </details>

                    {/* Remove */}
                    {group.subItems.length > 1 && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeSubItem(item._localId)}
                          className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded border border-red-200 hover:bg-red-50"
                        >
                          <FiTrash2 size={12} />
                          Xóa chỗ trống này
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
