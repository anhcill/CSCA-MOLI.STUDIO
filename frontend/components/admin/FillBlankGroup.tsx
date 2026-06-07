'use client';

import { useState } from 'react';
import { FiChevronDown, FiChevronUp, FiPlus, FiSave, FiTrash2 } from 'react-icons/fi';
import ImageUpload from './ImageUpload';
import MathInput from './MathInput';

export type ClozeMode = 'sentences' | 'passage';

export interface BlankSubItem {
  _localId: string;
  questionText: string;
  questionTextCn: string;
  points: number;
  explanation: string;
  explanationCn: string;
  correctAnswerKey: string;
  difficulty: string;
  subQuestionNumber: number;
}

export interface FillBlankGroupData {
  _id: string;
  _localId: string;
  insertPosition?: number;
  clozeMode: ClozeMode;
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
  startNumber: number;
  initialData?: FillBlankGroupData;
  onSave: (data: FillBlankGroupData) => void;
  onDelete?: () => void;
}

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

function countBlanks(text: string) {
  return (text.match(/_{2,}|＿+/g) || []).length;
}

function normalizeInitialData(data: FillBlankGroupData | undefined, startNumber: number): FillBlankGroupData {
  if (!data) {
    return {
      _id: `fbg-${Date.now()}`,
      _localId: `fbg-${Date.now()}`,
      clozeMode: 'sentences',
      passageText: '',
      passageImageUrl: '',
      linkedOptions: getDefaultLinkedOptions(),
      subItems: [makeSubItem(startNumber, 0)],
    };
  }

  return {
    ...data,
    clozeMode: data.clozeMode || 'sentences',
    linkedOptions: data.linkedOptions?.length ? data.linkedOptions : getDefaultLinkedOptions(),
    subItems: data.subItems?.length ? data.subItems : [makeSubItem(startNumber, 0)],
  };
}

export default function FillBlankGroup({
  startNumber,
  initialData,
  onSave,
  onDelete,
}: FillBlankGroupProps) {
  const [group, setGroup] = useState<FillBlankGroupData>(() => normalizeInitialData(initialData, startNumber));
  const [saving, setSaving] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const blankCount = countBlanks(group.passageText);
  const filledOptionCount = group.linkedOptions.filter((o) => o.text.trim() || o.textCn.trim()).length;

  const getItemLabel = (index: number) => `Câu ${startNumber + index}`;

  const setPassage = (key: 'passageText' | 'passageImageUrl', value: string) => {
    setGroup((prev) => ({ ...prev, [key]: value }));
  };

  const setLinkedOption = (index: number, field: 'text' | 'textCn', value: string) => {
    setGroup((prev) => ({
      ...prev,
      linkedOptions: prev.linkedOptions.map((opt, i) => (i === index ? { ...opt, [field]: value } : opt)),
    }));
  };

  const setSubItem = <K extends keyof BlankSubItem>(localId: string, key: K, value: BlankSubItem[K]) => {
    setGroup((prev) => ({
      ...prev,
      subItems: prev.subItems.map((item) => (item._localId === localId ? { ...item, [key]: value } : item)),
    }));
  };

  const addLinkedOption = () => {
    if (group.linkedOptions.length >= 12) return;
    const nextKey = String.fromCharCode(65 + group.linkedOptions.length);
    setGroup((prev) => ({
      ...prev,
      linkedOptions: [...prev.linkedOptions, { key: nextKey, text: '', textCn: '' }],
    }));
  };

  const removeLinkedOption = (index: number) => {
    setGroup((prev) => ({
      ...prev,
      linkedOptions: prev.linkedOptions.filter((_, i) => i !== index),
      subItems: prev.subItems.map((item) => {
        const removedKey = prev.linkedOptions[index]?.key;
        const firstRemainingKey = prev.linkedOptions.find((_, i) => i !== index)?.key || 'A';
        return item.correctAnswerKey === removedKey ? { ...item, correctAnswerKey: firstRemainingKey } : item;
      }),
    }));
  };

  const addSubItem = () => {
    setGroup((prev) => ({
      ...prev,
      subItems: [...prev.subItems, makeSubItem(startNumber, prev.subItems.length)],
    }));
  };

  const removeSubItem = (localId: string) => {
    setGroup((prev) => ({
      ...prev,
      subItems: prev.subItems.length > 1 ? prev.subItems.filter((item) => item._localId !== localId) : prev.subItems,
    }));
  };

  const handleSave = () => {
    if (group.clozeMode === 'passage' && !group.passageText.trim()) {
      alert('Dạng đoạn văn cần có nội dung đoạn văn.');
      return;
    }

    if (group.clozeMode === 'sentences') {
      const missingSentence = group.subItems.some((item) => !item.questionText.trim() && !item.questionTextCn.trim());
      if (missingSentence) {
        alert('Dạng câu rời cần nhập nội dung cho từng câu.');
        return;
      }
    }

    if (group.clozeMode === 'passage' && blankCount > 0 && blankCount !== group.subItems.length) {
      alert(`Số chỗ trống trong đoạn (${blankCount}) không khớp số đáp án (${group.subItems.length}).`);
      return;
    }

    const filledOpts = group.linkedOptions.filter((o) => o.text.trim() || o.textCn.trim());
    if (filledOpts.length < 2) {
      alert('Cần ít nhất 2 từ chọn có nội dung.');
      return;
    }

    setSaving(true);
    onSave(group);
    setTimeout(() => setSaving(false), 1000);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-green-300 overflow-hidden">
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4 flex items-center justify-between">
        <div>
          <h3 className="text-white font-bold">
            Điền từ - {getItemLabel(0)}
            {group.subItems.length > 1 && ` -> ${getItemLabel(group.subItems.length - 1)}`}
          </h3>
          <p className="text-white/75 text-xs">
            {group.clozeMode === 'passage' ? 'Đoạn văn' : 'Câu rời'} - {group.subItems.length} chỗ trống - Pool A-
            {String.fromCharCode(65 + Math.max(0, filledOptionCount - 1))}
          </p>
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
        <div className="bg-white border border-green-200 rounded-xl p-3">
          <label className="block text-xs font-bold text-green-800 mb-2">Dạng điền từ</label>
          <div className="grid grid-cols-2 gap-2">
            {(['sentences', 'passage'] as ClozeMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setGroup((prev) => ({ ...prev, clozeMode: mode }))}
                className={`px-3 py-2 rounded-lg border text-sm font-semibold ${
                  group.clozeMode === mode
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white text-green-700 border-green-200 hover:bg-green-50'
                }`}
              >
                {mode === 'sentences' ? 'Câu rời' : 'Đoạn văn'}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-green-50/60 border border-green-200 rounded-xl p-4">
          <label className="block text-sm font-bold text-green-800 mb-2">
            {group.clozeMode === 'passage' ? 'Đoạn văn điền từ' : 'Ghi chú nhóm'}
          </label>
          <textarea
            value={group.passageText}
            onChange={(e) => setPassage('passageText', e.target.value)}
            rows={group.clozeMode === 'passage' ? 5 : 3}
            className="w-full px-4 py-2 border border-green-200 rounded-lg bg-white text-sm leading-relaxed"
            placeholder={
              group.clozeMode === 'passage'
                ? '我们周围世界的物质处在不断___中。...'
                : 'VD: 第一组 备选词：A.符号 B.体积 C.直线...'
            }
          />
          <p className="text-xs text-green-600 mt-1 mb-3">
            {group.clozeMode === 'passage'
              ? `Dùng ___ làm chỗ trống. Hiện có ${blankCount} chỗ trống.`
              : 'Mỗi chỗ trống sẽ có một câu riêng bên dưới.'}
          </p>

          <ImageUpload
            label="Ảnh đính kèm nhóm điền từ"
            currentImage={group.passageImageUrl}
            onImageUploaded={(url) => setPassage('passageImageUrl', url)}
          />

          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-green-700">
                Từ chọn A-{String.fromCharCode(65 + group.linkedOptions.length - 1)}
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
                    onChange={(e) => setLinkedOption(i, 'text', e.target.value)}
                    className="flex-1 px-2 py-1 border rounded text-sm bg-white"
                    placeholder="Nghĩa/Việt"
                  />
                  <input
                    type="text"
                    value={opt.textCn}
                    onChange={(e) => setLinkedOption(i, 'textCn', e.target.value)}
                    className="flex-1 px-2 py-1 border rounded text-sm bg-white"
                    placeholder="词语"
                  />
                  {group.linkedOptions.length > 2 && (
                    <button type="button" onClick={() => removeLinkedOption(i)} className="text-red-400 hover:text-red-600">
                      <FiTrash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-gray-800 text-sm">Chỗ trống ({group.subItems.length})</h4>
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
            const currentAnswer = group.linkedOptions.find((o) => o.key === item.correctAnswerKey);
            return (
              <div key={item._localId} className="border border-emerald-200 rounded-xl overflow-hidden bg-emerald-50/30">
                <button
                  type="button"
                  onClick={() => setExpandedItems((prev) => ({ ...prev, [item._localId]: !prev[item._localId] }))}
                  className="w-full flex items-center justify-between px-4 py-3 bg-emerald-100/60 hover:bg-emerald-200/60 transition-colors text-left"
                >
                  <span className="font-bold text-emerald-800 text-sm">{getItemLabel(index)}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-emerald-600">
                      Đáp án: {item.correctAnswerKey} - {currentAnswer?.textCn || currentAnswer?.text || 'chưa chọn'}
                    </span>
                    {isExpanded ? <FiChevronUp size={14} className="text-emerald-500" /> : <FiChevronDown size={14} className="text-emerald-500" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="p-4 space-y-3">
                    {group.clozeMode === 'sentences' && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Nội dung câu</label>
                        <MathInput
                          value={item.questionText}
                          onChange={(v) => setSubItem(item._localId, 'questionText', v)}
                          placeholder="VD: 冰___后变成水。"
                          cnValue={item.questionTextCn}
                          onCnChange={(v) => setSubItem(item._localId, 'questionTextCn', v)}
                          cnPlaceholder="中文题目..."
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Đáp án đúng</label>
                        <select
                          value={item.correctAnswerKey}
                          onChange={(e) => setSubItem(item._localId, 'correctAnswerKey', e.target.value)}
                          className="w-full px-2 py-1.5 border rounded-lg text-sm bg-white"
                        >
                          {group.linkedOptions.map((opt) => (
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
                          onChange={(e) => setSubItem(item._localId, 'points', Math.max(0.1, parseFloat(e.target.value) || 1))}
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
                          onChange={(e) => setSubItem(item._localId, 'difficulty', e.target.value)}
                          className="w-full px-2 py-1.5 border rounded-lg text-sm bg-white"
                        >
                          <option value="easy">Dễ</option>
                          <option value="medium">Trung bình</option>
                          <option value="hard">Khó</option>
                        </select>
                      </div>
                    </div>

                    <details className="rounded-xl border border-blue-200 bg-blue-50 shadow-sm">
                      <summary className="cursor-pointer rounded-xl px-3 py-2 text-sm font-bold text-blue-900 transition-colors hover:bg-blue-100">
                        Giải thích
                      </summary>
                      <div className="px-3 pb-3 pt-1">
                        <MathInput
                          value={item.explanation}
                          onChange={(v) => setSubItem(item._localId, 'explanation', v)}
                          placeholder="Giải thích đáp án..."
                          cnLabel="Tiếng Trung"
                          cnValue={item.explanationCn}
                          onCnChange={(v) => setSubItem(item._localId, 'explanationCn', v)}
                          cnPlaceholder="解释正确答案..."
                          defaultTab="cn"
                        />
                      </div>
                    </details>

                    {group.subItems.length > 1 && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeSubItem(item._localId)}
                          className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded border border-red-200 hover:bg-red-50"
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
