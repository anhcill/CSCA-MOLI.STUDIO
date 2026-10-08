const {
  PUBLIC_AI_IDENTITY_MESSAGE,
  PUBLIC_AI_UNAVAILABLE_MESSAGE,
  askAIStream,
  isAIPrivacyQuestion,
  prependFocusedQuestionRestatement,
  sanitizeAIAnswerForQuestion,
} = require('../aiService');

describe('public AI privacy routing', () => {
  test('does not classify a normal study question as an internal-info question', () => {
    expect(isAIPrivacyQuestion('Giải thích vì sao A giao B là tập giao của hai tập hợp.')).toBe(false);
    expect(isAIPrivacyQuestion('Tại sao mô hình toán này dùng điều kiện x > 0?')).toBe(false);
  });

  test('keeps the privacy notice for a direct configuration question', () => {
    expect(isAIPrivacyQuestion('Bạn đang dùng model gì vậy?')).toBe(true);
    expect(sanitizeAIAnswerForQuestion('Bạn đang dùng GPT-5.', 'Bạn đang dùng model gì vậy?'))
      .toBe(PUBLIC_AI_IDENTITY_MESSAGE);
  });

  test('does not show the privacy notice as a study answer', () => {
    const studyQuestion = 'Giải thích công thức này giúp mình.';
    expect(sanitizeAIAnswerForQuestion(PUBLIC_AI_IDENTITY_MESSAGE, studyQuestion))
      .toBe(PUBLIC_AI_UNAVAILABLE_MESSAGE);
    expect(sanitizeAIAnswerForQuestion('Model: gpt-5. Hãy dùng đáp án này.', studyQuestion))
      .toBe(PUBLIC_AI_UNAVAILABLE_MESSAGE);
  });

  test('ends the stream after a direct reply so the chat composer unlocks', async () => {
    const res = {
      writableEnded: false,
      destroyed: false,
      write: jest.fn(),
      end: jest.fn(function end() { this.writableEnded = true; }),
    };

    await askAIStream('Bạn đang dùng model gì vậy?', {}, res);

    expect(res.write).toHaveBeenCalledWith('data: [DONE]\n\n');
    expect(res.end).toHaveBeenCalledTimes(1);
  });

  test('shows the complete exam question before explaining a requested question number', () => {
    const context = {
      questions: [{
        question_number: 30,
        passage_text: 'Cho các hàm số sau.',
        question_text: 'Hàm số nào là hàm số chẵn?',
        answer_options: [
          { answer_key: 'A', answer_text: 'y = sin x' },
          { answer_key: 'B', answer_text: 'y = cos x' },
        ],
        selected_answer_key: 'A',
        selected_answer_text: 'y = sin x',
        correct_answer_key: 'B',
        correct_answer_text: 'y = cos x',
        status: 'incorrect',
      }],
    };

    const answer = prependFocusedQuestionRestatement(
      'Vì cos(-x) = cos(x), nên y = cos x là hàm chẵn.',
      'chữa câu 30',
      context,
    );

    expect(answer).toContain('Đề bài - Câu 30:');
    expect(answer).toContain('Đoạn dẫn:\nCho các hàm số sau.');
    expect(answer).toContain('A. y = sin x');
    expect(answer).toContain('B. y = cos x');
    expect(answer).toContain('- Bạn chọn: A. y = sin x');
    expect(answer).toContain('- Đáp án đúng: B. y = cos x');
    expect(answer).toContain('Giải thích:\nVì cos(-x) = cos(x)');
  });
});
