'use client';

import { useEffect, useState, type ComponentProps } from 'react';
import { FiAlertCircle, FiPlus, FiTrash2 } from 'react-icons/fi';
import ImageUpload from '@/components/admin/ImageUpload';
import BaseMathInput from '@/components/admin/MathInput';
import type {
  ImportedExamItem,
  ImportedFillBlankGroupData,
  ImportedQuestionData,
  ImportedReadingGroupData,
  PdfImportPreview,
} from '@/lib/api/examAdmin';
import {
  IMPORT_ANSWER_KEYS,
  createEmptyImportedAnswer,
  createEmptyImportedFillBlankGroup,
  createEmptyImportedFillBlankSubItem,
  createEmptyImportedQuestion,
  createEmptyImportedReadingGroup,
  getImportItemsQuestionCount,
  getNextOptionKey,
} from './pdfImportUtils';

interface Props {
  preview: PdfImportPreview;
  items: ImportedExamItem[];
  saving: boolean;
  onSave: (items?: ImportedExamItem[]) => void;
  onChangeItems: (items: ImportedExamItem[]) => void;
}

const inputClass = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500';
const tinyButtonClass = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50';
const dangerButtonClass = 'inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50';

function MathInput(props: ComponentProps<typeof BaseMathInput>) {
  return <BaseMathInput {...props} commitDelayMs={350} />;
}

function ImageUrlEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (url: string) => void;
}) {
  return (
    <div className="mt-3 space-y-2">
      <ImageUpload
        compact
        label={label}
        currentImage={value || undefined}
        onImageUploaded={onChange}
      />
      <input
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
        placeholder="Hoặc dán URL ảnh"
      />
    </div>
  );
}

function isSingleChoice(item: ImportedExamItem): item is ImportedQuestionData {
  return item.itemType !== 'reading_group' && item.itemType !== 'fill_blank_group';
}

function ItemWarnings({ item }: { item: Pick<ImportedQuestionData, 'imageHint' | 'reviewNotes' | 'needsImage'> }) {
  if (!item.imageHint && !item.reviewNotes && !item.needsImage) return null;

  return (
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      {item.needsImage && <p className="font-semibold">Cần kiểm tra hoặc thêm ảnh cho mục này.</p>}
      {item.imageHint && <p>{item.imageHint}</p>}
      {item.reviewNotes && <p>{item.reviewNotes}</p>}
    </div>
  );
}

type NewImportedItemType = 'single_choice' | 'reading_group' | 'fill_blank_group';

function createImportedItem(type: NewImportedItemType): ImportedExamItem {
  if (type === 'reading_group') return createEmptyImportedReadingGroup();
  if (type === 'fill_blank_group') return createEmptyImportedFillBlankGroup();
  return createEmptyImportedQuestion();
}

function AddItemButtons({
  label,
  onAdd,
}: {
  label: string;
  onAdd: (type: NewImportedItemType) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-gray-500">{label}</span>
      <button type="button" onClick={() => onAdd('single_choice')} className={tinyButtonClass}>
        <FiPlus size={12} /> Trắc nghiệm
      </button>
      <button type="button" onClick={() => onAdd('reading_group')} className={tinyButtonClass}>
        <FiPlus size={12} /> Đọc hiểu
      </button>
      <button type="button" onClick={() => onAdd('fill_blank_group')} className={tinyButtonClass}>
        <FiPlus size={12} /> Điền từ
      </button>
    </div>
  );
}

function formatSourceSummary(source: PdfImportPreview['source']) {
  if (!source) return '';

  const parts = [source.fileName || 'File import'];
  if (source.fileType === 'pdf' || source.pages) {
    parts.push(`${source.pages || '?'} trang`);
  } else if (source.fileType) {
    parts.push(source.fileType.toUpperCase());
  }
  parts.push(`${source.textLength || 0} ký tự`);

  return parts.join(' - ');
}

export default function PdfImportReview({ preview, items: sourceItems, saving, onSave, onChangeItems }: Props) {
  const [draftItems, setDraftItems] = useState<ImportedExamItem[]>(sourceItems);
  const items = draftItems;

  useEffect(() => {
    setDraftItems(sourceItems);
  }, [preview, sourceItems]);

  const questionCount = getImportItemsQuestionCount(items);

  const updateItem = (index: number, updater: (item: ImportedExamItem) => ImportedExamItem | null) => {
    const nextItems = [...items];
    const updated = updater(nextItems[index]);
    if (!updated) return;
    nextItems[index] = updated;
    setDraftItems(nextItems);
  };

  const removeItem = (index: number) => {
    if (!confirm('Xóa mục này khỏi danh sách import?')) return;
    setDraftItems(items.filter((_, itemIndex) => itemIndex !== index));
  };

  const addItem = (type: NewImportedItemType) => {
    setDraftItems([...items, createImportedItem(type)]);
  };

  const insertItemAfter = (index: number, type: NewImportedItemType) => {
    const nextItems = [...items];
    nextItems.splice(index + 1, 0, createImportedItem(type));
    setDraftItems(nextItems);
  };

  const handleSave = () => {
    onChangeItems(items);
    onSave(items);
  };

  const updateSingle = (index: number, updates: Partial<ImportedQuestionData>) => {
    updateItem(index, (item) => (isSingleChoice(item) ? { ...item, ...updates } : null));
  };

  const updateSingleAnswer = (
    questionIndex: number,
    answerIndex: number,
    updates: Partial<{ text: string; textCn: string; imageUrl: string }>,
  ) => {
    updateItem(questionIndex, (item) => {
      if (!isSingleChoice(item)) return null;
      const answers = [...(item.answers || [])];
      answers[answerIndex] = { ...answers[answerIndex], ...updates };
      return { ...item, answers };
    });
  };

  const addSingleAnswer = (questionIndex: number) => {
    updateItem(questionIndex, (item) => {
      if (!isSingleChoice(item) || (item.answers || []).length >= IMPORT_ANSWER_KEYS.length) return null;
      return { ...item, answers: [...(item.answers || []), createEmptyImportedAnswer()] };
    });
  };

  const removeSingleAnswer = (questionIndex: number, answerIndex: number) => {
    updateItem(questionIndex, (item) => {
      if (!isSingleChoice(item)) return null;
      const answers = item.answers || [];
      if (answers.length <= 2) return null;
      const nextAnswers = answers.filter((_, index) => index !== answerIndex);
      const allowedKeys = IMPORT_ANSWER_KEYS.slice(0, nextAnswers.length);
      return {
        ...item,
        answers: nextAnswers,
        correctAnswer: allowedKeys.includes(item.correctAnswer || '') ? item.correctAnswer : '',
      };
    });
  };

  const updateReadingGroup = (index: number, updates: Partial<ImportedReadingGroupData>) => {
    updateItem(index, (item) => (item.itemType === 'reading_group' ? { ...item, ...updates } : null));
  };

  const updateReadingSubQuestion = (groupIndex: number, subIndex: number, updates: Partial<ImportedQuestionData>) => {
    updateItem(groupIndex, (item) => {
      if (item.itemType !== 'reading_group') return null;
      const subQuestions = [...item.subQuestions];
      subQuestions[subIndex] = { ...subQuestions[subIndex], ...updates };
      return { ...item, subQuestions };
    });
  };

  const addReadingSubQuestion = (groupIndex: number) => {
    updateItem(groupIndex, (item) => {
      if (item.itemType !== 'reading_group') return null;
      return { ...item, subQuestions: [...item.subQuestions, createEmptyImportedQuestion()] };
    });
  };

  const removeReadingSubQuestion = (groupIndex: number, subIndex: number) => {
    updateItem(groupIndex, (item) => {
      if (item.itemType !== 'reading_group' || item.subQuestions.length <= 1) return null;
      return { ...item, subQuestions: item.subQuestions.filter((_, index) => index !== subIndex) };
    });
  };

  const updateReadingSubAnswer = (
    groupIndex: number,
    subIndex: number,
    answerIndex: number,
    updates: Partial<{ text: string; textCn: string; imageUrl: string }>,
  ) => {
    updateItem(groupIndex, (item) => {
      if (item.itemType !== 'reading_group') return null;
      const subQuestions = [...item.subQuestions];
      const subQuestion = subQuestions[subIndex];
      const answers = [...(subQuestion.answers || [])];
      answers[answerIndex] = { ...answers[answerIndex], ...updates };
      subQuestions[subIndex] = { ...subQuestion, answers };
      return { ...item, subQuestions };
    });
  };

  const addReadingSubAnswer = (groupIndex: number, subIndex: number) => {
    updateItem(groupIndex, (item) => {
      if (item.itemType !== 'reading_group') return null;
      const subQuestions = [...item.subQuestions];
      const subQuestion = subQuestions[subIndex];
      if ((subQuestion.answers || []).length >= IMPORT_ANSWER_KEYS.length) return null;
      subQuestions[subIndex] = {
        ...subQuestion,
        answers: [...(subQuestion.answers || []), createEmptyImportedAnswer()],
      };
      return { ...item, subQuestions };
    });
  };

  const removeReadingSubAnswer = (groupIndex: number, subIndex: number, answerIndex: number) => {
    updateItem(groupIndex, (item) => {
      if (item.itemType !== 'reading_group') return null;
      const subQuestions = [...item.subQuestions];
      const subQuestion = subQuestions[subIndex];
      const answers = subQuestion.answers || [];
      if (answers.length <= 2) return null;
      const nextAnswers = answers.filter((_, index) => index !== answerIndex);
      const allowedKeys = IMPORT_ANSWER_KEYS.slice(0, nextAnswers.length);
      subQuestions[subIndex] = {
        ...subQuestion,
        answers: nextAnswers,
        correctAnswer: allowedKeys.includes(subQuestion.correctAnswer || '') ? subQuestion.correctAnswer : '',
      };
      return { ...item, subQuestions };
    });
  };

  const updateFillBlankGroup = (index: number, updates: Partial<ImportedFillBlankGroupData>) => {
    updateItem(index, (item) => (item.itemType === 'fill_blank_group' ? { ...item, ...updates } : null));
  };

  const updateFillBlankOption = (groupIndex: number, optionIndex: number, updates: Partial<{ key: string; text: string; textCn: string }>) => {
    updateItem(groupIndex, (item) => {
      if (item.itemType !== 'fill_blank_group') return null;
      const linkedOptions = [...item.linkedOptions];
      linkedOptions[optionIndex] = { ...linkedOptions[optionIndex], ...updates };
      return { ...item, linkedOptions };
    });
  };

  const addFillBlankOption = (groupIndex: number) => {
    updateItem(groupIndex, (item) => {
      if (item.itemType !== 'fill_blank_group' || item.linkedOptions.length >= IMPORT_ANSWER_KEYS.length) return null;
      const key = getNextOptionKey(item.linkedOptions.map((option) => option.key));
      return { ...item, linkedOptions: [...item.linkedOptions, { key, text: '', textCn: '' }] };
    });
  };

  const removeFillBlankOption = (groupIndex: number, optionIndex: number) => {
    updateItem(groupIndex, (item) => {
      if (item.itemType !== 'fill_blank_group' || item.linkedOptions.length <= 2) return null;
      const removedKey = item.linkedOptions[optionIndex]?.key;
      return {
        ...item,
        linkedOptions: item.linkedOptions.filter((_, index) => index !== optionIndex),
        subItems: item.subItems.map((subItem) => ({
          ...subItem,
          correctAnswerKey: subItem.correctAnswerKey === removedKey ? '' : subItem.correctAnswerKey,
        })),
      };
    });
  };

  const updateFillBlankSubItem = (
    groupIndex: number,
    subIndex: number,
    updates: Partial<ImportedFillBlankGroupData['subItems'][number]>,
  ) => {
    updateItem(groupIndex, (item) => {
      if (item.itemType !== 'fill_blank_group') return null;
      const subItems = [...item.subItems];
      subItems[subIndex] = { ...subItems[subIndex], ...updates };
      return { ...item, subItems };
    });
  };

  const addFillBlankSubItem = (groupIndex: number) => {
    updateItem(groupIndex, (item) => {
      if (item.itemType !== 'fill_blank_group') return null;
      return {
        ...item,
        subItems: [...item.subItems, createEmptyImportedFillBlankSubItem(item.subItems.length + 1)],
      };
    });
  };

  const removeFillBlankSubItem = (groupIndex: number, subIndex: number) => {
    updateItem(groupIndex, (item) => {
      if (item.itemType !== 'fill_blank_group' || item.subItems.length <= 1) return null;
      return { ...item, subItems: item.subItems.filter((_, index) => index !== subIndex) };
    });
  };

  return (
    <div className="mt-5 border-t border-gray-200 pt-5">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            Tìm thấy {questionCount} câu hỏi trong {items.length} mục
          </p>
          {preview.source && (
            <p className="text-xs text-gray-500">
              {formatSourceSummary(preview.source)}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Công thức nhập bằng LaTeX, ví dụ <code className="rounded bg-gray-100 px-1">{'\\(f^{-1}(x)=\\frac{x+3}{x-2}\\)'}</code>. Ảnh chỉ dùng cho hình/biểu đồ cần upload.
          </p>
        </div>
        <div className="flex flex-col gap-2 md:items-end">
          <AddItemButtons label="Thêm mục" onAdd={addItem} />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || items.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? 'Đang lưu...' : `Lưu ${questionCount} câu vào đề`}
          </button>
        </div>
      </div>

      {!!preview.warnings?.length && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {preview.warnings.map((warning, index) => (
            <div key={index} className="flex gap-2">
              <FiAlertCircle className="mt-0.5 shrink-0" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}

      <div className="divide-y divide-gray-200">
        {items.map((item, itemIndex) => {
          if (item.itemType === 'reading_group') {
            return (
              <div key={itemIndex} className="py-4 first:pt-0 last:pb-0">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                  <h4 className="font-semibold text-gray-900">Đọc hiểu - {item.subQuestions.length} câu</h4>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <AddItemButtons label="Thêm sau" onAdd={(type) => insertItemAfter(itemIndex, type)} />
                    <button type="button" onClick={() => removeItem(itemIndex)} className={dangerButtonClass}>
                      <FiTrash2 size={13} /> Bỏ mục
                    </button>
                  </div>
                </div>
                <MathInput
                  label="Đoạn văn"
                  value={item.passageText || ''}
                  onChange={(value) => updateReadingGroup(itemIndex, { passageText: value })}
                  placeholder="Nhập đoạn văn. Công thức dùng \\frac{tử}{mẫu}, ví dụ \\(\\frac{2x+3}{x-1}\\)"
                />
                <ImageUrlEditor
                  label="Ảnh đoạn văn"
                  value={item.passageImageUrl || ''}
                  onChange={(url) => updateReadingGroup(itemIndex, { passageImageUrl: url })}
                />
                <details className="mt-3 rounded-lg border border-gray-200 p-3" open>
                  <summary className="cursor-pointer text-sm font-semibold text-gray-800">Câu con đọc hiểu</summary>
                  <div className="mt-3 space-y-4">
                    {item.subQuestions.map((subQuestion, subIndex) => {
                      const subAnswerKeys = IMPORT_ANSWER_KEYS.slice(0, subQuestion.answers?.length || 0);
                      return (
                        <div key={subIndex} className="border-t border-gray-100 pt-3 first:border-t-0 first:pt-0">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-xs font-bold text-gray-700">Câu con {subIndex + 1}</p>
                            <button type="button" onClick={() => removeReadingSubQuestion(itemIndex, subIndex)} disabled={item.subQuestions.length <= 1} className={dangerButtonClass}>
                              <FiTrash2 size={12} /> Xóa câu con
                            </button>
                          </div>
                          <MathInput
                            label={`Câu con ${subIndex + 1}`}
                            value={subQuestion.questionText || ''}
                            onChange={(value) => updateReadingSubQuestion(itemIndex, subIndex, { questionText: value })}
                            cnLabel="Tiếng Trung"
                            cnValue={subQuestion.questionTextCn || ''}
                            onCnChange={(value) => updateReadingSubQuestion(itemIndex, subIndex, { questionTextCn: value })}
                            placeholder="Nội dung câu hỏi. Phân số: \\frac{x+3}{x-2}"
                            cnPlaceholder="Nội dung tiếng Trung"
                          />
                          <ImageUrlEditor
                            label={`Ảnh câu con ${subIndex + 1}`}
                            value={subQuestion.imageUrl || ''}
                            onChange={(url) => updateReadingSubQuestion(itemIndex, subIndex, { imageUrl: url })}
                          />
                          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                            {(subQuestion.answers || []).map((answer, answerIndex) => (
                              <div key={answerIndex} className="rounded-lg border border-gray-200 p-2">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <span className="text-xs font-semibold text-gray-500">Đáp án {IMPORT_ANSWER_KEYS[answerIndex]}</span>
                                  <button type="button" onClick={() => removeReadingSubAnswer(itemIndex, subIndex, answerIndex)} disabled={(subQuestion.answers || []).length <= 2} className={dangerButtonClass}>
                                    <FiTrash2 size={12} /> Xóa
                                  </button>
                                </div>
                                <MathInput
                                  label=""
                                  value={answer.text || ''}
                                  onChange={(value) => updateReadingSubAnswer(itemIndex, subIndex, answerIndex, { text: value })}
                                  cnLabel="Tiếng Trung"
                                  cnValue={answer.textCn || ''}
                                  onCnChange={(value) => updateReadingSubAnswer(itemIndex, subIndex, answerIndex, { textCn: value })}
                                  placeholder={`Đáp án ${IMPORT_ANSWER_KEYS[answerIndex]} (Việt/Anh)`}
                                  cnPlaceholder={`Đáp án ${IMPORT_ANSWER_KEYS[answerIndex]} (Tiếng Trung)`}
                                />
                                <ImageUrlEditor
                                  label={`Ảnh đáp án ${IMPORT_ANSWER_KEYS[answerIndex]}`}
                                  value={answer.imageUrl || ''}
                                  onChange={(url) => updateReadingSubAnswer(itemIndex, subIndex, answerIndex, { imageUrl: url })}
                                />
                              </div>
                            ))}
                          </div>
                          <button type="button" onClick={() => addReadingSubAnswer(itemIndex, subIndex)} disabled={(subQuestion.answers || []).length >= IMPORT_ANSWER_KEYS.length} className={`${tinyButtonClass} mt-2`}>
                            <FiPlus size={12} /> Thêm đáp án
                          </button>
                          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Đáp án đúng</label>
                              <select value={subQuestion.correctAnswer || ''} onChange={(event) => updateReadingSubQuestion(itemIndex, subIndex, { correctAnswer: event.target.value })} className={inputClass}>
                                <option value="">Chọn đáp án</option>
                                {subAnswerKeys.map((key) => <option key={key} value={key}>{key}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Điểm</label>
                              <input type="number" min="0.1" step="0.1" value={subQuestion.points || 1} onChange={(event) => updateReadingSubQuestion(itemIndex, subIndex, { points: Number.parseFloat(event.target.value) || 1 })} className={inputClass} />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Độ khó</label>
                              <select value={subQuestion.difficulty || 'medium'} onChange={(event) => updateReadingSubQuestion(itemIndex, subIndex, { difficulty: event.target.value })} className={inputClass}>
                                <option value="easy">Dễ</option>
                                <option value="medium">Trung bình</option>
                                <option value="hard">Khó</option>
                              </select>
                            </div>
                          </div>
                          <div className="mt-3">
                            <MathInput
                              label="Giải thích"
                              value={subQuestion.explanation || ''}
                              onChange={(value) => updateReadingSubQuestion(itemIndex, subIndex, { explanation: value })}
                              cnLabel="Tiếng Trung"
                              cnValue={subQuestion.explanationCn || ''}
                              onCnChange={(value) => updateReadingSubQuestion(itemIndex, subIndex, { explanationCn: value })}
                              placeholder="Giải thích (Việt/Anh). Phân số: \\frac{10}{\\sqrt{5}}=2\\sqrt{5}"
                              cnPlaceholder="Giải thích tiếng Trung"
                              defaultTab="cn"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button type="button" onClick={() => addReadingSubQuestion(itemIndex)} className={`${tinyButtonClass} mt-3`}>
                    <FiPlus size={12} /> Thêm câu con
                  </button>
                </details>
                <ItemWarnings item={item} />
              </div>
            );
          }

          if (item.itemType === 'fill_blank_group') {
            return (
              <div key={itemIndex} className="py-4 first:pt-0 last:pb-0">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                  <h4 className="font-semibold text-gray-900">Điền từ - {item.subItems.length} chỗ trống</h4>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <AddItemButtons label="Thêm sau" onAdd={(type) => insertItemAfter(itemIndex, type)} />
                    <button type="button" onClick={() => removeItem(itemIndex)} className={dangerButtonClass}>
                      <FiTrash2 size={13} /> Bỏ mục
                    </button>
                  </div>
                </div>
                <div className="mb-3 max-w-xs">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Dạng điền từ</label>
                  <select value={item.clozeMode || 'sentences'} onChange={(event) => updateFillBlankGroup(itemIndex, { clozeMode: event.target.value as ImportedFillBlankGroupData['clozeMode'] })} className={inputClass}>
                    <option value="sentences">Từng câu</option>
                    <option value="passage">Đoạn văn có chỗ trống</option>
                  </select>
                </div>
                <MathInput
                  label="Đoạn văn / ngữ cảnh"
                  value={item.passageText || ''}
                  onChange={(value) => updateFillBlankGroup(itemIndex, { passageText: value })}
                  placeholder="Nhập ngữ cảnh. Công thức dùng \\frac{tử}{mẫu}"
                />
                <ImageUrlEditor
                  label="Ảnh đoạn văn"
                  value={item.passageImageUrl || ''}
                  onChange={(url) => updateFillBlankGroup(itemIndex, { passageImageUrl: url })}
                />
                <details className="mt-3 rounded-lg border border-gray-200 p-3" open>
                  <summary className="cursor-pointer text-sm font-semibold text-gray-800">Pool đáp án và chỗ trống</summary>
                  <div className="mt-3 space-y-4">
                    <div>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        {item.linkedOptions.map((option, optionIndex) => (
                          <div key={`${option.key}-${optionIndex}`} className="rounded-lg border border-gray-200 p-2">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <input value={option.key || ''} onChange={(event) => updateFillBlankOption(itemIndex, optionIndex, { key: event.target.value.toUpperCase().slice(0, 1) })} className={`${inputClass} max-w-[4rem] text-center font-bold`} />
                              <button type="button" onClick={() => removeFillBlankOption(itemIndex, optionIndex)} disabled={item.linkedOptions.length <= 2} className={dangerButtonClass}>
                                <FiTrash2 size={12} /> Xóa
                              </button>
                            </div>
                            <MathInput
                              label=""
                              value={option.text || ''}
                              onChange={(value) => updateFillBlankOption(itemIndex, optionIndex, { text: value })}
                              cnLabel="Tiếng Trung"
                              cnValue={option.textCn || ''}
                              onCnChange={(value) => updateFillBlankOption(itemIndex, optionIndex, { textCn: value })}
                              placeholder="Việt/Anh"
                              cnPlaceholder="Tiếng Trung"
                            />
                          </div>
                        ))}
                      </div>
                      <button type="button" onClick={() => addFillBlankOption(itemIndex)} disabled={item.linkedOptions.length >= IMPORT_ANSWER_KEYS.length} className={`${tinyButtonClass} mt-2`}>
                        <FiPlus size={12} /> Thêm lựa chọn
                      </button>
                    </div>
                    <div className="space-y-3">
                      {item.subItems.map((subItem, subIndex) => (
                        <div key={subIndex} className="rounded-lg border border-gray-200 p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-xs font-bold text-gray-700">Chỗ trống {subIndex + 1}</p>
                            <button type="button" onClick={() => removeFillBlankSubItem(itemIndex, subIndex)} disabled={item.subItems.length <= 1} className={dangerButtonClass}>
                              <FiTrash2 size={12} /> Xóa
                            </button>
                          </div>
                          <div className="grid grid-cols-1 gap-3">
                            <MathInput
                              label=""
                              value={subItem.questionText || ''}
                              onChange={(value) => updateFillBlankSubItem(itemIndex, subIndex, { questionText: value })}
                              cnLabel="Tiếng Trung"
                              cnValue={subItem.questionTextCn || ''}
                              onCnChange={(value) => updateFillBlankSubItem(itemIndex, subIndex, { questionTextCn: value })}
                              placeholder={`Chỗ trống ${subIndex + 1} (Việt/Anh)`}
                              cnPlaceholder={`Chỗ trống ${subIndex + 1} (Tiếng Trung)`}
                            />
                          </div>
                          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Đáp án đúng</label>
                              <select value={subItem.correctAnswerKey || ''} onChange={(event) => updateFillBlankSubItem(itemIndex, subIndex, { correctAnswerKey: event.target.value })} className={inputClass}>
                                <option value="">Đáp án</option>
                                {item.linkedOptions.map((option) => <option key={option.key} value={option.key}>{option.key}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Điểm</label>
                              <input type="number" min="0.1" step="0.1" value={subItem.points || 1} onChange={(event) => updateFillBlankSubItem(itemIndex, subIndex, { points: Number.parseFloat(event.target.value) || 1 })} className={inputClass} />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Độ khó</label>
                              <select value={subItem.difficulty || 'medium'} onChange={(event) => updateFillBlankSubItem(itemIndex, subIndex, { difficulty: event.target.value })} className={inputClass}>
                                <option value="easy">Dễ</option>
                                <option value="medium">Trung bình</option>
                                <option value="hard">Khó</option>
                              </select>
                            </div>
                          </div>
                          <div className="mt-3">
                            <MathInput
                              label="Giải thích"
                              value={subItem.explanation || ''}
                              onChange={(value) => updateFillBlankSubItem(itemIndex, subIndex, { explanation: value })}
                              cnLabel="Tiếng Trung"
                              cnValue={subItem.explanationCn || ''}
                              onCnChange={(value) => updateFillBlankSubItem(itemIndex, subIndex, { explanationCn: value })}
                              placeholder="Giải thích (Việt/Anh). Phân số: \\frac{10}{\\sqrt{5}}=2\\sqrt{5}"
                              cnPlaceholder="Giải thích tiếng Trung"
                              defaultTab="cn"
                            />
                          </div>
                        </div>
                      ))}
                      <button type="button" onClick={() => addFillBlankSubItem(itemIndex)} className={tinyButtonClass}>
                        <FiPlus size={12} /> Thêm chỗ trống
                      </button>
                    </div>
                  </div>
                </details>
                <ItemWarnings item={item} />
              </div>
            );
          }

          const answerKeys = IMPORT_ANSWER_KEYS.slice(0, item.answers?.length || 0);
          return (
            <div key={itemIndex} className="py-4 first:pt-0 last:pb-0">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h4 className="font-semibold text-gray-900">Câu {itemIndex + 1}</h4>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <AddItemButtons label="Thêm sau" onAdd={(type) => insertItemAfter(itemIndex, type)} />
                  <button type="button" onClick={() => removeItem(itemIndex)} className={dangerButtonClass}>
                    <FiTrash2 size={13} /> Bỏ mục
                  </button>
                </div>
              </div>
              <MathInput
                label="Nội dung câu hỏi"
                value={item.questionText || ''}
                onChange={(value) => updateSingle(itemIndex, { questionText: value })}
                cnLabel="Tiếng Trung"
                cnValue={item.questionTextCn || ''}
                onCnChange={(value) => updateSingle(itemIndex, { questionTextCn: value })}
                placeholder="Nội dung (Việt/Anh). Phân số: \\frac{2x+3}{x-1}"
                cnPlaceholder="Nội dung tiếng Trung"
              />
              <ImageUrlEditor
                label="Ảnh câu hỏi"
                value={item.imageUrl || ''}
                onChange={(url) => updateSingle(itemIndex, { imageUrl: url })}
              />
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                {(item.answers || []).map((answer, answerIndex) => (
                  <div key={answerIndex} className="rounded-lg border border-gray-200 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-gray-500">Đáp án {IMPORT_ANSWER_KEYS[answerIndex]}</span>
                      <button type="button" onClick={() => removeSingleAnswer(itemIndex, answerIndex)} disabled={(item.answers || []).length <= 2} className={dangerButtonClass}>
                        <FiTrash2 size={12} /> Xóa
                      </button>
                    </div>
                    <MathInput
                      label=""
                      value={answer.text || ''}
                      onChange={(value) => updateSingleAnswer(itemIndex, answerIndex, { text: value })}
                      cnLabel="Tiếng Trung"
                      cnValue={answer.textCn || ''}
                      onCnChange={(value) => updateSingleAnswer(itemIndex, answerIndex, { textCn: value })}
                      placeholder="Việt/Anh"
                      cnPlaceholder="Tiếng Trung"
                    />
                    <ImageUrlEditor
                      label={`Ảnh đáp án ${IMPORT_ANSWER_KEYS[answerIndex]}`}
                      value={answer.imageUrl || ''}
                      onChange={(url) => updateSingleAnswer(itemIndex, answerIndex, { imageUrl: url })}
                    />
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => addSingleAnswer(itemIndex)} disabled={(item.answers || []).length >= IMPORT_ANSWER_KEYS.length} className={`${tinyButtonClass} mt-2`}>
                <FiPlus size={12} /> Thêm đáp án
              </button>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Đáp án đúng</label>
                  <select value={item.correctAnswer || ''} onChange={(event) => updateSingle(itemIndex, { correctAnswer: event.target.value })} className={inputClass}>
                    <option value="">Chọn đáp án</option>
                    {answerKeys.map((key) => <option key={key} value={key}>{key}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Điểm</label>
                  <input type="number" min="0.1" step="0.1" value={item.points || 1} onChange={(event) => updateSingle(itemIndex, { points: Number.parseFloat(event.target.value) || 1 })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Độ khó</label>
                  <select value={item.difficulty || 'medium'} onChange={(event) => updateSingle(itemIndex, { difficulty: event.target.value })} className={inputClass}>
                    <option value="easy">Dễ</option>
                    <option value="medium">Trung bình</option>
                    <option value="hard">Khó</option>
                  </select>
                </div>
              </div>
              <div className="mt-3">
                <MathInput
                  label="Giải thích"
                  value={item.explanation || ''}
                  onChange={(value) => updateSingle(itemIndex, { explanation: value })}
                  cnLabel="Tiếng Trung"
                  cnValue={item.explanationCn || ''}
                  onCnChange={(value) => updateSingle(itemIndex, { explanationCn: value })}
                  placeholder="Giải thích (Việt/Anh). Phân số: \\frac{10}{\\sqrt{5}}=2\\sqrt{5}"
                  cnPlaceholder="Giải thích tiếng Trung"
                  defaultTab="cn"
                />
              </div>
              <ItemWarnings item={item} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
