const {
  PUBLIC_AI_IDENTITY_MESSAGE,
  PUBLIC_AI_UNAVAILABLE_MESSAGE,
  askAIStream,
  isAIPrivacyQuestion,
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
});
