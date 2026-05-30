import type { ImportedExamItem, ImportedQuestionData } from '@/lib/api/examAdmin';

export const IMPORT_ANSWER_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export const getImportItemQuestionCount = (item: ImportedExamItem) => {
  if (item.itemType === 'reading_group') return item.subQuestions.length;
  if (item.itemType === 'fill_blank_group') return item.subItems.length;
  return 1;
};

export const getImportItemsQuestionCount = (items: ImportedExamItem[]) =>
  items.reduce((sum, item) => sum + getImportItemQuestionCount(item), 0);

export const createEmptyImportedAnswer = () => ({
  text: '',
  textCn: '',
  imageUrl: '',
});

export const createEmptyImportedQuestion = (): ImportedQuestionData => ({
  itemType: 'single_choice',
  questionType: 'single_choice',
  questionText: '',
  questionTextCn: '',
  imageUrl: '',
  points: 1,
  explanation: '',
  explanationCn: '',
  answers: [createEmptyImportedAnswer(), createEmptyImportedAnswer()],
  correctAnswer: '',
  difficulty: 'medium',
});

export const getNextOptionKey = (usedKeys: string[]) => {
  const used = new Set(usedKeys);
  return IMPORT_ANSWER_KEYS.find((key) => !used.has(key)) || IMPORT_ANSWER_KEYS[usedKeys.length] || 'H';
};
