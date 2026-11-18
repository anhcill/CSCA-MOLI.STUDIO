import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDisplayAnswer,
  isQuestionAnswered,
  itemsHaveChinese,
  localizedOptionText,
  localizedPassageText,
  localizedQuestionText,
  mergeItemGroupsWithReview,
} from '../quizHelpers.ts';

test('quizHelpers localizes Chinese stems, passages, and options by default', () => {
  const q = {
    id: '571',
    questionType: 'single_choice',
    prompt: 'Vietnamese prompt',
    questionText: 'Vietnamese prompt',
    questionTextCn: '经过多次试验，研究团队在这一领域取得了显著的进展。',
    options: [
      { key: 'A', text: 'Vi opt', textCn: '明显' },
      { key: 'B', text: 'Vi opt B', textCn: '剧烈' },
    ],
  };

  assert.equal(localizedQuestionText(q, true), '经过多次试验，研究团队在这一领域取得了显著的进展。');
  assert.equal(localizedQuestionText(q, false), 'Vietnamese prompt');
  assert.equal(localizedOptionText(q.options[0], true), '明显');
  assert.equal(localizedOptionText(q.options[0], false), 'Vi opt');
  assert.equal(itemsHaveChinese([{ id: '571', kind: 'question', questions: [q] }], [q]), true);
});

test('quizHelpers evaluates answered states across all Course question types', () => {
  assert.equal(isQuestionAnswered({ id: '1', questionType: 'single_choice', prompt: '' }, 'A'), true);
  assert.equal(isQuestionAnswered({ id: '1', questionType: 'single_choice', prompt: '' }, ''), false);

  assert.equal(isQuestionAnswered({ id: '2', questionType: 'multiple_choice', prompt: '' }, ['A', 'C']), true);
  assert.equal(isQuestionAnswered({ id: '2', questionType: 'multiple_choice', prompt: '' }, []), false);

  assert.equal(
    isQuestionAnswered({ id: '3', questionType: 'essay', prompt: '' }, { text: 'My answer', attachments: [] }),
    true,
  );
  assert.equal(
    isQuestionAnswered(
      { id: '4', questionType: 'translation', prompt: '' },
      { text: '', attachments: [{ assetId: '99', name: 'img.png' }] },
    ),
    true,
  );
  assert.equal(
    isQuestionAnswered({ id: '5', questionType: 'essay', prompt: '' }, { text: '   ', attachments: [] }),
    false,
  );
});

test('quizHelpers preserves Pool A-F and passage context when merging review items', () => {
  const baseFillGroup = {
    id: '1',
    kind: 'fill_blank_group',
    groupType: 'fill_blank_pool',
    clozeMode: 'sentences',
    passageText: 'Nối bộ thủ',
    passageTextCn: null,
    linkedOptions: [
      { key: 'A', text: 'Ngôn ngữ (语言)' },
      { key: 'C', text: 'Bệnh tật (疾病)' },
    ],
    questions: [
      {
        id: '549',
        questionType: 'fill_blank_item',
        prompt: '(1) Bộ 疒 (Nạch)',
        questionText: '(1) Bộ 疒 (Nạch)',
        options: [],
      },
    ],
  };
  const flatReview = [
    {
      id: '549',
      questionId: '549',
      questionType: 'fill_blank_item',
      prompt: '(1) Bộ 疒 (Nạch)',
      questionText: '(1) Bộ 疒 (Nạch)',
      correctAnswer: 'C',
      studentAnswer: 'A',
      isCorrect: false,
      explanation: 'Bộ 疒 biểu thị bệnh tật.',
      options: [],
    },
  ];

  const merged = mergeItemGroupsWithReview([baseFillGroup], [], flatReview);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].kind, 'fill_blank_group');
  assert.equal(merged[0].linkedOptions?.length, 2);
  assert.equal(localizedPassageText(merged[0], true), 'Nối bộ thủ');
  assert.equal(
    formatDisplayAnswer('C', merged[0].questions[0], true, merged[0].linkedOptions),
    'C. Bệnh tật (疾病)',
  );
});
