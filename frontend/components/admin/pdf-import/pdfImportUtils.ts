import type {
  ImportedExamItem,
  ImportedFillBlankGroupData,
  ImportedQuestionData,
  ImportedReadingGroupData,
  PdfImportPreview,
} from '@/lib/api/examAdmin';

export const IMPORT_ANSWER_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export const getImportItemQuestionCount = (item: ImportedExamItem) => {
  if (item.itemType === 'reading_group') return item.subQuestions.length;
  if (item.itemType === 'fill_blank_group') return item.subItems.length;
  return 1;
};

export const getImportItemsQuestionCount = (items: ImportedExamItem[]) =>
  items.reduce((sum, item) => sum + getImportItemQuestionCount(item), 0);

export const getImportPreviewItems = (preview: PdfImportPreview | null): ImportedExamItem[] => {
  if (!preview) return [];
  return preview.items?.length ? preview.items : preview.questions || [];
};

export const hasImportText = (...values: Array<string | undefined | null>) =>
  values.some(value => typeof value === 'string' && value.trim().length > 0);

export const validateImportedSingleChoice = (item: ImportedQuestionData, label: string) => {
  if (!hasImportText(item.questionText, item.questionTextCn)) {
    return `${label} can noi dung cau hoi`;
  }

  const answers = item.answers || [];
  if (answers.length < 2 || answers.length > IMPORT_ANSWER_KEYS.length) {
    return `${label} can tu 2 den 8 dap an`;
  }

  const emptyAnswerIndex = answers.findIndex(answer => !hasImportText(answer.text, answer.textCn));
  if (emptyAnswerIndex !== -1) {
    return `${label} thieu noi dung dap an ${IMPORT_ANSWER_KEYS[emptyAnswerIndex]}`;
  }

  const allowedKeys = IMPORT_ANSWER_KEYS.slice(0, answers.length);
  if (!item.correctAnswer || !allowedKeys.includes(item.correctAnswer)) {
    return `${label} can chon dap an dung`;
  }

  return '';
};

export const validateImportedItems = (items: ImportedExamItem[]) => {
  if (!items.length) return 'Khong co cau hoi de import';

  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const label = `Muc ${index + 1}`;

    if (item.itemType === 'reading_group') {
      if (!hasImportText(item.passageText)) {
        return `${label} doc hieu can doan van`;
      }
      if (!item.subQuestions?.length) {
        return `${label} doc hieu can it nhat 1 cau con`;
      }
      for (let subIndex = 0; subIndex < item.subQuestions.length; subIndex++) {
        const error = validateImportedSingleChoice(item.subQuestions[subIndex], `${label}.${subIndex + 1}`);
        if (error) return error;
      }
      continue;
    }

    if (item.itemType === 'fill_blank_group') {
      const options = item.linkedOptions || [];
      const validOptionKeys = new Set(options.map(option => option.key));

      if (options.length < 2) {
        return `${label} dien tu can it nhat 2 lua chon`;
      }
      const emptyOptionIndex = options.findIndex(option => !hasImportText(option.text, option.textCn));
      if (emptyOptionIndex !== -1) {
        return `${label} thieu noi dung lua chon ${options[emptyOptionIndex]?.key || emptyOptionIndex + 1}`;
      }
      if (item.clozeMode === 'passage' && !hasImportText(item.passageText)) {
        return `${label} dien tu dang doan van can passageText`;
      }
      if (!item.subItems?.length) {
        return `${label} dien tu can it nhat 1 cho trong`;
      }
      for (let subIndex = 0; subIndex < item.subItems.length; subIndex++) {
        const subItem = item.subItems[subIndex];
        if (item.clozeMode !== 'passage' && !hasImportText(subItem.questionText, subItem.questionTextCn)) {
          return `${label}.${subIndex + 1} can noi dung cau dien tu`;
        }
        if (!subItem.correctAnswerKey || !validOptionKeys.has(subItem.correctAnswerKey)) {
          return `${label}.${subIndex + 1} can dap an dung nam trong pool`;
        }
      }
      continue;
    }

    const error = validateImportedSingleChoice(item, label);
    if (error) return error;
  }

  return '';
};

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

export const createEmptyImportedReadingGroup = (): ImportedReadingGroupData => ({
  itemType: 'reading_group',
  passageText: '',
  passageImageUrl: '',
  subQuestions: [createEmptyImportedQuestion()],
});

export const createEmptyImportedFillBlankSubItem = (
  subQuestionNumber = 1,
): ImportedFillBlankGroupData['subItems'][number] => ({
  questionText: '',
  questionTextCn: '',
  points: 1,
  explanation: '',
  explanationCn: '',
  correctAnswerKey: '',
  difficulty: 'medium',
  subQuestionNumber,
});

export const createEmptyImportedFillBlankGroup = (): ImportedFillBlankGroupData => ({
  itemType: 'fill_blank_group',
  clozeMode: 'sentences',
  passageText: '',
  passageImageUrl: '',
  linkedOptions: [
    { key: 'A', text: '', textCn: '' },
    { key: 'B', text: '', textCn: '' },
  ],
  subItems: [createEmptyImportedFillBlankSubItem()],
});

export const getNextOptionKey = (usedKeys: string[]) => {
  const used = new Set(usedKeys);
  return IMPORT_ANSWER_KEYS.find((key) => !used.has(key)) || IMPORT_ANSWER_KEYS[usedKeys.length] || 'H';
};
