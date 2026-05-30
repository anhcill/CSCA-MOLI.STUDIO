'use client';

import { FiAlertCircle, FiPlus, FiTrash2 } from 'react-icons/fi';
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
  createEmptyImportedQuestion,
  getImportItemsQuestionCount,
  getNextOptionKey,
} from './pdfImportUtils';

interface Props {
  preview: PdfImportPreview;
  items: ImportedExamItem[];
  saving: boolean;
  onSave: () => void;
  onChangeItems: (items: ImportedExamItem[]) => void;
}

const inputClass = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500';
const tinyButtonClass = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50';
const dangerButtonClass = 'inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50';

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

export default function PdfImportReview({ preview, items, saving, onSave, onChangeItems }: Props) {
  const questionCount = getImportItemsQuestionCount(items);

  const updateItem = (index: number, updater: (item: ImportedExamItem) => ImportedExamItem | null) => {
    const nextItems = [...items];
    const updated = updater(nextItems[index]);
    if (!updated) return;
    nextItems[index] = updated;
    onChangeItems(nextItems);
  };

  const removeItem = (index: number) => {
    if (!confirm('Xóa mục này khỏi danh sách import?')) return;
    onChangeItems(items.filter((_, itemIndex) => itemIndex !== index));
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
        subItems: [
          ...item.subItems,
          {
            questionText: '',
            questionTextCn: '',
            points: 1,
            explanation: '',
            explanationCn: '',
            correctAnswerKey: '',
            difficulty: 'medium',
            subQuestionNumber: item.subItems.length + 1,
          },
        ],
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
              {preview.source.fileName} - {preview.source.pages || '?'} trang - {preview.source.textLength || 0} ký tự
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || items.length === 0}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {saving ? 'Đang lưu...' : `Lưu ${questionCount} câu vào đề`}
        </button>
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
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h4 className="font-semibold text-gray-900">Đọc hiểu - {item.subQuestions.length} câu</h4>
                  <button type="button" onClick={() => removeItem(itemIndex)} className={dangerButtonClass}>
                    <FiTrash2 size={13} /> Bỏ mục
                  </button>
                </div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Đoạn văn</label>
                <textarea value={item.passageText || ''} onChange={(event) => updateReadingGroup(itemIndex, { passageText: event.target.value })} rows={4} className={inputClass} />
                <label className="mt-3 block text-xs font-semibold text-gray-600 mb-1">URL ảnh đoạn văn</label>
                <input value={item.passageImageUrl || ''} onChange={(event) => updateReadingGroup(itemIndex, { passageImageUrl: event.target.value })} className={inputClass} placeholder="https://..." />
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
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <textarea value={subQuestion.questionText || ''} onChange={(event) => updateReadingSubQuestion(itemIndex, subIndex, { questionText: event.target.value })} rows={2} className={inputClass} placeholder={`Câu ${subIndex + 1} (Việt/Anh)`} />
                            <textarea value={subQuestion.questionTextCn || ''} onChange={(event) => updateReadingSubQuestion(itemIndex, subIndex, { questionTextCn: event.target.value })} rows={2} className={inputClass} placeholder={`Câu ${subIndex + 1} (Tiếng Trung)`} />
                          </div>
                          <input value={subQuestion.imageUrl || ''} onChange={(event) => updateReadingSubQuestion(itemIndex, subIndex, { imageUrl: event.target.value })} className={`${inputClass} mt-2`} placeholder="URL ảnh câu hỏi nếu có" />
                          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                            {(subQuestion.answers || []).map((answer, answerIndex) => (
                              <div key={answerIndex} className="rounded-lg border border-gray-200 p-2">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <span className="text-xs font-semibold text-gray-500">Đáp án {IMPORT_ANSWER_KEYS[answerIndex]}</span>
                                  <button type="button" onClick={() => removeReadingSubAnswer(itemIndex, subIndex, answerIndex)} disabled={(subQuestion.answers || []).length <= 2} className={dangerButtonClass}>
                                    <FiTrash2 size={12} /> Xóa
                                  </button>
                                </div>
                                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                  <input value={answer.text || ''} onChange={(event) => updateReadingSubAnswer(itemIndex, subIndex, answerIndex, { text: event.target.value })} className={inputClass} placeholder="Việt/Anh" />
                                  <input value={answer.textCn || ''} onChange={(event) => updateReadingSubAnswer(itemIndex, subIndex, answerIndex, { textCn: event.target.value })} className={inputClass} placeholder="Tiếng Trung" />
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-2 flex flex-wrap items-end gap-2">
                            <button type="button" onClick={() => addReadingSubAnswer(itemIndex, subIndex)} disabled={(subQuestion.answers || []).length >= IMPORT_ANSWER_KEYS.length} className={tinyButtonClass}>
                              <FiPlus size={12} /> Thêm đáp án
                            </button>
                            <select value={subQuestion.correctAnswer || ''} onChange={(event) => updateReadingSubQuestion(itemIndex, subIndex, { correctAnswer: event.target.value })} className={`${inputClass} max-w-xs`}>
                              <option value="">Chọn đáp án đúng</option>
                              {subAnswerKeys.map((key) => <option key={key} value={key}>{key}</option>)}
                            </select>
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
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h4 className="font-semibold text-gray-900">Điền từ - {item.subItems.length} chỗ trống</h4>
                  <button type="button" onClick={() => removeItem(itemIndex)} className={dangerButtonClass}>
                    <FiTrash2 size={13} /> Bỏ mục
                  </button>
                </div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Đoạn văn / ngữ cảnh</label>
                <textarea value={item.passageText || ''} onChange={(event) => updateFillBlankGroup(itemIndex, { passageText: event.target.value })} rows={3} className={inputClass} />
                <label className="mt-3 block text-xs font-semibold text-gray-600 mb-1">URL ảnh đoạn văn</label>
                <input value={item.passageImageUrl || ''} onChange={(event) => updateFillBlankGroup(itemIndex, { passageImageUrl: event.target.value })} className={inputClass} placeholder="https://..." />
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
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                              <input value={option.text || ''} onChange={(event) => updateFillBlankOption(itemIndex, optionIndex, { text: event.target.value })} className={inputClass} placeholder="Việt/Anh" />
                              <input value={option.textCn || ''} onChange={(event) => updateFillBlankOption(itemIndex, optionIndex, { textCn: event.target.value })} className={inputClass} placeholder="Tiếng Trung" />
                            </div>
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
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_10rem]">
                            <input value={subItem.questionText || ''} onChange={(event) => updateFillBlankSubItem(itemIndex, subIndex, { questionText: event.target.value })} className={inputClass} placeholder={`Chỗ trống ${subIndex + 1} (Việt/Anh)`} />
                            <input value={subItem.questionTextCn || ''} onChange={(event) => updateFillBlankSubItem(itemIndex, subIndex, { questionTextCn: event.target.value })} className={inputClass} placeholder={`Chỗ trống ${subIndex + 1} (Tiếng Trung)`} />
                            <select value={subItem.correctAnswerKey || ''} onChange={(event) => updateFillBlankSubItem(itemIndex, subIndex, { correctAnswerKey: event.target.value })} className={inputClass}>
                              <option value="">Đáp án</option>
                              {item.linkedOptions.map((option) => <option key={option.key} value={option.key}>{option.key}</option>)}
                            </select>
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
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="font-semibold text-gray-900">Câu {itemIndex + 1}</h4>
                <button type="button" onClick={() => removeItem(itemIndex)} className={dangerButtonClass}>
                  <FiTrash2 size={13} /> Bỏ mục
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Nội dung (Việt/Anh)</label>
                  <textarea value={item.questionText || ''} onChange={(event) => updateSingle(itemIndex, { questionText: event.target.value })} rows={3} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Nội dung (Tiếng Trung)</label>
                  <textarea value={item.questionTextCn || ''} onChange={(event) => updateSingle(itemIndex, { questionTextCn: event.target.value })} rows={3} className={inputClass} />
                </div>
              </div>
              <label className="mt-3 block text-xs font-semibold text-gray-600 mb-1">URL ảnh câu hỏi</label>
              <input value={item.imageUrl || ''} onChange={(event) => updateSingle(itemIndex, { imageUrl: event.target.value })} className={inputClass} placeholder="https://..." />
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                {(item.answers || []).map((answer, answerIndex) => (
                  <div key={answerIndex} className="rounded-lg border border-gray-200 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-gray-500">Đáp án {IMPORT_ANSWER_KEYS[answerIndex]}</span>
                      <button type="button" onClick={() => removeSingleAnswer(itemIndex, answerIndex)} disabled={(item.answers || []).length <= 2} className={dangerButtonClass}>
                        <FiTrash2 size={12} /> Xóa
                      </button>
                    </div>
                    <input value={answer.text || ''} onChange={(event) => updateSingleAnswer(itemIndex, answerIndex, { text: event.target.value })} className={inputClass} placeholder="Việt/Anh" />
                    <input value={answer.textCn || ''} onChange={(event) => updateSingleAnswer(itemIndex, answerIndex, { textCn: event.target.value })} className={`${inputClass} mt-2`} placeholder="Tiếng Trung" />
                    <input value={answer.imageUrl || ''} onChange={(event) => updateSingleAnswer(itemIndex, answerIndex, { imageUrl: event.target.value })} className={`${inputClass} mt-2`} placeholder="URL ảnh đáp án nếu có" />
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
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Giải thích (Việt/Anh)</label>
                  <textarea value={item.explanation || ''} onChange={(event) => updateSingle(itemIndex, { explanation: event.target.value })} rows={2} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Giải thích (Tiếng Trung)</label>
                  <textarea value={item.explanationCn || ''} onChange={(event) => updateSingle(itemIndex, { explanationCn: event.target.value })} rows={2} className={inputClass} />
                </div>
              </div>
              <ItemWarnings item={item} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
