/**
 * AI Service — Tất cả 7 features AI cho hệ thống thi CSCA
 *
 * Model: DeepSeek R1 qua Beeknoee
 * Muốn đổi model? Sửa src/config/aiConfig.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const aiConfig = require('../config/aiConfig');

// ─── Rate limiting (global, file-based) ─────────────────────────────────────────
const RATE_LIMIT_FILE = path.join(__dirname, '../../.ai_ratelimit');
let rateLimitedUntil = 0;
let lastRequestTime = 0;

try {
  const saved = JSON.parse(fs.readFileSync(RATE_LIMIT_FILE, 'utf8'));
  if (saved.until > Date.now()) {
    rateLimitedUntil = saved.until;
    console.log(`📋 AI rate limit còn ${Math.ceil((saved.until - Date.now()) / 1000)}s`);
  }
} catch { /* first run */ }

function isRateLimited() { return Date.now() < rateLimitedUntil; }
function setRateLimit(ms) {
  rateLimitedUntil = Date.now() + ms;
  try { fs.writeFileSync(RATE_LIMIT_FILE, JSON.stringify({ until: rateLimitedUntil })); } catch {}
}
function getRateLimitRemaining() { return Math.max(0, Math.ceil((rateLimitedUntil - Date.now()) / 1000)); }

// ─── Round-robin API key pool ────────────────────────────────────────────────
const BEE = aiConfig.beeknoee;
let currentKeyIndex = 0;

function getNextKey() {
  const keys = BEE.apiKeys.filter(Boolean);
  if (keys.length === 0) return null;
  const keyNumber = (currentKeyIndex % keys.length) + 1;
  const key = keys[currentKeyIndex % keys.length];
  currentKeyIndex++;
  console.log(`AI request using Beeknoee key #${keyNumber}/${keys.length}`);
  return key;
}

async function waitBetweenRequests() {
  const delay = BEE.delayBetweenRequests || 500;
  const elapsed = Date.now() - lastRequestTime;
  if (elapsed < delay) {
    const wait = delay - elapsed;
    await new Promise(r => setTimeout(r, wait));
  }
  lastRequestTime = Date.now();
}

// Global concurrency: max 3 concurrent AI requests
let concurrentCount = 0;
const MAX_CONCURRENT = BEE.maxConcurrent || 3;

async function withConcurrency(fn) {
  while (concurrentCount >= MAX_CONCURRENT) {
    await new Promise(r => setTimeout(r, 500));
  }
  concurrentCount++;
  try {
    return await fn();
  } finally {
    concurrentCount--;
  }
}

// ─── AI Core: Gọi Beeknoee  ───────────────────────────────────────
async function callBeeknoee(prompt, options = {}) {
  if (isRateLimited()) {
    const e = new Error('RATE_LIMITED');
    e.retryAfter = getRateLimitRemaining();
    throw e;
  }

  await waitBetweenRequests();

  const { maxTokens = BEE.maxTokens, temperature = BEE.temperature } = options;
  const apiKey = getNextKey();

  if (!apiKey) {
    throw new Error('Không có API key nào được cấu hình');
  }

  const payload = {
    model: BEE.model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: maxTokens,
    temperature,
  };

  return withConcurrency(async () => {
    try {
      const response = await axios.post(
        `${BEE.baseUrl}/chat/completions`,
        payload,
        {
          timeout: BEE.timeout,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
        }
      );

      // OpenAI-compatible response: choices[0].message.content
      const text = response.data?.choices?.[0]?.message?.content || '';
      return typeof text === 'string' ? text.trim() : JSON.stringify(text);
    } catch (err) {
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        const e = new Error('AI_TIMEOUT');
        throw e;
      }
      if (err.response?.status === 429) {
        // Key bị rate limit → chuyển sang key khác ngay
        const keyCount = BEE.apiKeys.filter(Boolean).length || 1;
        console.warn(`Beeknoee key #${currentKeyIndex % keyCount} hit rate limit, backing off...`);
        currentKeyIndex++;
        setRateLimit(aiConfig.general.globalBackoffMs);
        const e = new Error('RATE_LIMITED');
        e.retryAfter = getRateLimitRemaining();
        throw e;
      }
      throw err;
    }
  });
}

// ─── Parse JSON từ AI response ────────────────────────────────────────────────
function getAnswerText(options, key) {
  if (!options || !key) return '';
  const opt = options.find(o => o.key === key);
  return opt ? (opt.text || opt.text_cn || '') : '';
}
function parseAIMaybeJSON(text) {
  try { return JSON.parse(text); } catch {}
  // Thử tìm JSON block trong markdown
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    try { return JSON.parse(match[1].trim()); } catch {}
  }
  if (text) {
    console.warn('AI JSON parse failed. Preview:', String(text).slice(0, 500));
  }
  return null;
}

function asString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function asArray(value, fallback = []) {
  return Array.isArray(value) ? value.filter(item => item !== null && item !== undefined) : fallback;
}

function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeGradeColor(value, fallback = 'blue') {
  return ['emerald', 'blue', 'amber', 'red'].includes(value) ? value : fallback;
}

function normalizeExamAnalysis(ai, fallback, percentage) {
  const source = ai && typeof ai === 'object' ? ai : {};
  return {
    ...fallback,
    ...source,
    score: percentage,
    grade: asString(source.grade, fallback.grade),
    gradeColor: normalizeGradeColor(source.gradeColor, fallback.gradeColor),
    summary: asString(source.summary, fallback.summary),
    strengths: asArray(source.strengths, fallback.strengths).map(v => asString(v)).filter(Boolean),
    weaknesses: asArray(source.weaknesses, fallback.weaknesses).map(v => asString(v)).filter(Boolean),
    analysis: asString(source.analysis, fallback.analysis),
    overallAdvice: asString(source.overallAdvice, fallback.overallAdvice),
    priorityTopics: asArray(source.priorityTopics, fallback.priorityTopics).map(v => asString(v)).filter(Boolean),
    studyPlan: asString(source.studyPlan, fallback.studyPlan),
    examTips: asArray(source.examTips, fallback.examTips).map(v => asString(v)).filter(Boolean),
    commonMistakes: asArray(source.commonMistakes, fallback.commonMistakes).map(v => asString(v)).filter(Boolean),
    nextExamSuggestion: asString(source.nextExamSuggestion, fallback.nextExamSuggestion),
  };
}

function normalizeExplanationResult(ai, wrongQuestions) {
  const explanations = asArray(ai?.explanations).map((item, index) => ({
    questionNumber: asNumber(item?.questionNumber, wrongQuestions[index]?.question_number || index + 1),
    yourAnswer: asString(item?.yourAnswer),
    correctAnswer: asString(item?.correctAnswer),
    whyWrong: asString(item?.whyWrong),
    knowledgeNote: asString(item?.knowledgeNote),
    tip: asString(item?.tip),
    vocabulary: asArray(item?.vocabulary).map(v => ({
      word: asString(v?.word),
      pinyin: asString(v?.pinyin),
      meaning: asString(v?.meaning),
    })).filter(v => v.word || v.meaning),
  })).filter(item => item.whyWrong || item.knowledgeNote || item.tip);

  return { explanations };
}

function normalizeEssayGrade(ai) {
  return {
    success: true,
    totalScore: Math.max(0, Math.min(10, asNumber(ai?.totalScore, 0))),
    gradingCriteria: asArray(ai?.gradingCriteria).map(item => ({
      criterion: asString(item?.criterion, 'Tiêu chí'),
      score: Math.max(0, Math.min(10, asNumber(item?.score, 0))),
      maxScore: Math.max(1, asNumber(item?.maxScore, 10)),
      comment: asString(item?.comment),
    })),
    errors: asArray(ai?.errors).map(item => ({
      original: asString(item?.original),
      correct: asString(item?.correct),
      reason: asString(item?.reason),
      type: asString(item?.type, 'grammar'),
    })),
    modelAnswer: asString(ai?.modelAnswer),
    feedback: asString(ai?.feedback),
    suggestions: asArray(ai?.suggestions).map(v => asString(v)).filter(Boolean),
  };
}

function normalizeGrammarLesson(ai) {
  return {
    success: true,
    title: asString(ai?.title, 'Bài học ngữ pháp'),
    grammarRule: asString(ai?.grammarRule),
    examples: asArray(ai?.examples).map(item => ({
      chinese: asString(item?.chinese),
      pinyin: asString(item?.pinyin),
      vietnamese: asString(item?.vietnamese),
      usage: asString(item?.usage),
    })).filter(item => item.chinese || item.vietnamese),
    memoryTips: asArray(ai?.memoryTips).map(v => asString(v)).filter(Boolean),
    commonMistakes: asArray(ai?.commonMistakes).map(v => asString(v)).filter(Boolean),
    relatedTopics: asArray(ai?.relatedTopics).map(v => asString(v)).filter(Boolean),
  };
}

// ─── Fallback rule-based analysis ─────────────────────────────────────────────
function ruleBasedExamAnalysis(attemptData) {
  const { totalScore, totalQuestions, correctCount, subjectName, questions } = attemptData;
  const percentage = Math.round((correctCount / totalQuestions) * 100);

  const isPassing = percentage >= 60;
  const isExcellent = percentage >= 85;
  const wrongCount = totalQuestions - correctCount;

  return {
    score: percentage,
    grade: isExcellent ? 'Tuyệt vời!' : isPassing ? 'Đạt yêu cầu' : 'Cần cố gắng',
    gradeColor: isExcellent ? 'emerald' : isPassing ? 'blue' : 'red',
    summary: isExcellent
      ? `Bạn làm rất tốt với ${correctCount}/${totalQuestions} câu đúng! Kiến thức của bạn vững chắc.`
      : isPassing
      ? `Bạn đạt ${percentage}% - kết quả đạt yêu cầu. Cần ôn luyện thêm để cải thiện điểm số.`
      : `Bạn đạt ${percentage}% - cần học kỹ hơn. Hãy ôn lại lý thuyết và làm nhiều bài tập hơn.`,
    analysis: isExcellent
      ? `Bạn làm rất tốt! Kiến thức vững chắc.`
      : isPassing
      ? `Kết quả đạt yêu cầu. Cần ôn luyện thêm để cải thiện.`
      : `Bạn cần học kỹ hơn. Hãy ôn lại từ đầu, chia nhỏ từng chủ đề.`,
    strengths: isExcellent
      ? [`Bạn nắm vững kiến thức cơ bản`, `Làm bài nhanh và chính xác`, `Hiểu rõ các khái niệm quan trọng`]
      : isPassing
      ? [`Bạn nắm được một phần kiến thức`, `Có nền tảng cơ bản để phát triển`]
      : [`Bạn đã bắt đầu tiếp cận nội dung`, `Vẫn có thể cải thiện nhanh nếu chăm chỉ`],
    weaknesses: isPassing
      ? [`Còn sai ở một số câu hỏi khó`, `Cần ôn thêm phần nâng cao`]
      : [`Cần ôn lại toàn bộ kiến thức cơ bản`, `Chưa nắm vững các khái niệm trọng tâm`, `Cần luyện tập nhiều hơn`],
    overallAdvice: isExcellent
      ? 'Tiếp tục duy trì và thử thách bản thân với các đề khó hơn. Hãy tập trung vào những phần hiếm khi sai.'
      : isPassing
      ? 'Hãy tập trung vào những phần bạn sai, ôn lại kiến thức cơ bản và làm thêm bài tập.'
      : 'Học lại từ đầu, chia nhỏ từng chủ đề và luyện tập đều đặn mỗi ngày. Đừng nản lòng!',
    priorityTopics: ['Củng cố kiến thức cơ bản', 'Luyện tập theo chủ đề'],
    studyPlan: isExcellent
      ? 'Duy trì thói quen học tập, mỗi tuần làm 1-2 đề thi thử để giữ nhịp. Tập trung vào đề khó hơn.'
      : isPassing
      ? 'Tuần 1-2: Ôn lại các phần sai. Tuần 3-4: Làm đề luyện tập. Tuần 5+: Kiểm tra lại kết quả.'
      : 'Tuần 1: Học lại lý thuyết từ đầu. Tuần 2-3: Luyện bài tập cơ bản. Tuần 4+: Làm đề thi thử.',
    examTips: ['Đọc kỹ đề bài trước khi trả lời', 'Làm những câu dễ trước', 'Kiểm tra lại bài trước khi nộp'],
    commonMistakes: ['Đọc đề vội vàng dẫn đến hiểu sai', 'Chọn đáp án đầu tiên mà không xem hết các lựa chọn'],
    nextExamSuggestion: isPassing
      ? 'Nên thử đề có độ khó trung bình-cao để thử thách bản thân.'
      : 'Hãy bắt đầu với đề cơ bản để củng cố kiến thức trước.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 1: Phân tích kết quả bài thi
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Phân tích kết quả 1 bài thi cụ thể
 * @param {Object} attemptData - { totalScore, totalQuestions, correctCount, subjectName, duration, questions }
 */
async function analyzeExamResult(attemptData) {
  const { questions = [] } = attemptData;
  const { correctCount, totalQuestions } = attemptData;
  const percentage = Math.round((correctCount / totalQuestions) * 100);

  // Nếu không có câu hỏi chi tiết → rule-based
  if (!questions.length || questions.length < 3) {
    return ruleBasedExamAnalysis(attemptData);
  }

  // Phân loại câu sai theo loại
  const wrongQuestions = questions.filter(q => !q.is_correct && q.selected_answer_key);
  const easyCorrect = questions.filter(q => q.difficulty === 'easy' && q.is_correct).length;
  const mediumCorrect = questions.filter(q => q.difficulty === 'medium' && q.is_correct).length;
  const hardCorrect = questions.filter(q => q.difficulty === 'hard' && q.is_correct).length;
  const easyTotal = questions.filter(q => q.difficulty === 'easy').length || 1;
  const mediumTotal = questions.filter(q => q.difficulty === 'medium').length || 1;
  const hardTotal = questions.filter(q => q.difficulty === 'hard').length || 1;

  const difficultyBreakdown = {
    easy:   { correct: easyCorrect,   total: easyTotal,   rate: Math.round(easyCorrect / easyTotal * 100) },
    medium: { correct: mediumCorrect, total: mediumTotal, rate: Math.round(mediumCorrect / mediumTotal * 100) },
    hard:   { correct: hardCorrect,   total: hardTotal,   rate: Math.round(hardCorrect / hardTotal * 100) },
  };

  // Xây dựng prompt cho DeepSeek R1
  const prevAttempt = attemptData.previousAttempt;
  const questionsText = questions.slice(0, 80).map(q => {
    const status = q.is_correct ? '✓ ĐÚNG' : '✗ SAI';
    const userAnswer = q.selected_answer_key
      ? `${q.selected_answer_key}. ${getAnswerText(q.options, q.selected_answer_key)}`
      : 'CHƯA TRẢ LỜI';
    const correctKey = q.correct_answer_key || '?';
    const correctAnswerText = getAnswerText(q.options, correctKey);
    const optionsText = (q.options || [])
      .slice(0, 8)
      .map(o => `${o.key}. ${o.text || o.text_cn || ''}`)
      .join(' | ');
    return `Câu ${q.question_number}: [${status}]
  Loại: ${q.question_type || 'single_choice'}
  Độ khó: ${q.difficulty || 'medium'}
  Đề bài: ${q.question_text || q.question_text_cn || ''}
  Lựa chọn: ${optionsText}
  Bạn chọn: ${userAnswer}
  Đáp án đúng: ${correctKey}. ${correctAnswerText || ''}
  Giải thích: ${q.explanation || q.explanation_cn || 'Không có'}
  ${q.passage_text ? `Đoạn văn: ${q.passage_text.substring(0, 200)}` : ''}`.substring(0, 700);
  }).join('\n\n');

  // Phân loại câu sai để AI có thêm context
  const typeBreakdown = {};
  questions.forEach(q => {
    if (!q.is_correct && q.selected_answer_key) {
      const type = q.question_type || 'single_choice';
      if (!typeBreakdown[type]) typeBreakdown[type] = { total: 0, wrong: 0 };
      typeBreakdown[type].total++;
      typeBreakdown[type].wrong++;
    }
  });

  const prompt = `Bạn là giáo viên giỏi, phân tích bài thi chi tiết cho học sinh. VIẾT TIẾNG VIỆT.

HƯỚNG DẪN:
- Viết đầy đủ, chi tiết, không cắt ngắn
- Từng câu trả lời phải dài ít nhất 3-5 câu
- Đưa ra ví dụ cụ thể từ bài thi
- Nhận xét thật, gợi ý thực tế
- Dùng ngôn ngữ tự nhiên, thân thiện
- Chỉ kết luận dựa trên dữ liệu bài thi được cung cấp, không bịa chủ đề hoặc câu hỏi không có trong dữ liệu
- Khi nêu điểm yếu, phải chỉ rõ số câu hoặc nhóm câu làm căn cứ nếu dữ liệu có đủ

THÔNG TIN BÀI THI:
- Môn: ${attemptData.subjectName || 'Tiếng Trung'}
- Đúng: ${correctCount}/${totalQuestions} (${percentage}%)
- Số câu sai: ${wrongQuestions.length}
${prevAttempt ? `
SO SÁNH VỚI LẦN TRƯỚC:
- Lần trước: ${prevAttempt.score}%
- Lần này: ${percentage}%
- Thay đổi: ${prevAttempt.delta >= 0 ? '+' : ''}${prevAttempt.delta}%
${prevAttempt.delta >= 0 ? '→ Bạn đã TIẾN BỘ!' : '→ Bạn cần ÔN THÊM.'}
` : ''}

PHÂN TÍCH THEO ĐỘ KHÓ:
- Dễ: ${difficultyBreakdown.easy.rate}% đúng (${difficultyBreakdown.easy.correct}/${difficultyBreakdown.easy.total})
- TB: ${difficultyBreakdown.medium.rate}% đúng (${difficultyBreakdown.medium.correct}/${difficultyBreakdown.medium.total})
- Khó: ${difficultyBreakdown.hard.rate}% đúng (${difficultyBreakdown.hard.correct}/${difficultyBreakdown.hard.total})

CHI TIẾT TỪNG CÂU:
${questionsText}

TRẢ VỀ JSON. QUY TẮC QUAN TRỌNG: Mỗi trường text phải xuống dòng cho từng ý, dùng ký tự xuống dòng \n giữa các câu/ý. KHÔNG viết liền 1 đoạn.
{
  "score": ${percentage},
  "grade": "Mô tả đánh giá 1-2 câu",
  "gradeColor": "emerald|blue|amber|red",
  "summary": "Viết 3-5 câu, mỗi câu 1 ý, xuống dòng giữa các câu. Tổng quan về kết quả bài thi.",
  "strengths": ["Điểm mạnh 1: viết 1-2 câu chi tiết", "Điểm mạnh 2: viết 1-2 câu chi tiết"],
  "weaknesses": ["Điểm yếu 1: viết 1-2 câu, giải thích vì sao sai", "Điểm yếu 2: viết 1-2 câu"],
  "analysis": "Xuống dòng cho từng ý:\n1. Tổng quan sai ở phần nào - chỉ rõ từng nhóm kiến thức (ví dụ: 'Sai nhiều ở cơ học: câu 3, 4, 9 về lực đàn hồi, ma sát, gia tốc')\n2. Nguyên nhân cụ thể - vì sao hay sai (ví dụ: 'Học rời rạc từng công thức, chưa hiểu bản chất nên đề đổi cách hỏi là nhầm')\n3. Kiến thức cần bổ sung cụ thể - liệt kê từng phần (ví dụ: 'Cần học lại: định nghĩa lực, vectơ, hợp lực, công thức ω=v/R, chu kỳ-tần số')",
  "overallAdvice": "Xuống dòng cho từng ý:\n1. Ưu tiên học gì trước (ví dụ: 'Ưu tiên học lại phần cơ học trước vì chiếm nhiều câu sai nhất')\n2. Phương pháp ôn luyện cụ thể (ví dụ: 'Mỗi ngày học 1 công thức, hiểu bản chất trước khi nhớ')\n3. Tài liệu nên tham khảo\n4. Thời gian biểu ôn tập cụ thể (ví dụ: 'Tuần 1: ôn cơ học, Tuần 2: ôn điện từ')",
  "priorityTopics": ["Chủ đề ưu tiên 1", "Chủ đề ưu tiên 2", "Chủ đề ưu tiên 3"],
  "studyPlan": "Xuống dòng cho từng giai đoạn:\nGiai đoạn 1 (Tuần 1-2): [Học gì, ví dụ: Học lại lý thuyết cơ học - lực, vectơ, tổng hợp lực]\nGiai đoạn 2 (Tuần 3-4): [Học gì, ví dụ: Luyện bài tập cơ bản từng chủ đề]\nGiai đoạn 3 (Tuần 5+): [Học gì, ví dụ: Làm đề thi thử, kiểm tra lại kết quả]",
  "examTips": ["Mẹo thi 1", "Mẹo thi 2", "Mẹo thi 3"],
  "commonMistakes": ["Lỗi sai 1: mô tả lỗi và cách tránh", "Lỗi sai 2: mô tả lỗi và cách tránh"],
  "nextExamSuggestion": "Viết 2-3 câu, xuống dòng giữa các ý. Gợi ý nên thử đề nào, độ khó bao nhiêu, lý do tại sao."
}`;

  try {
    const fallback = ruleBasedExamAnalysis(attemptData);
    const raw = await callBeeknoee(prompt, { temperature: 0.3, maxTokens: BEE.examAnalysisMaxTokens || 6000 });
    const ai = parseAIMaybeJSON(raw);

    return {
      ...normalizeExamAnalysis(ai, fallback, percentage),
      difficultyBreakdown,
      wrongCount: wrongQuestions.length,
    };
  } catch (err) {
    if (err.message === 'RATE_LIMITED') throw err;
    console.error('AI exam analysis failed, using rule-based:', err.message);
    return ruleBasedExamAnalysis(attemptData);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 2: Giải thích câu sai
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Giải thích chi tiết các câu sai cho 1 bài thi
 * @param {Array} questions - Mảng câu hỏi đã làm
 */
async function explainWrongAnswers(questions) {
  const wrongQuestions = questions.filter(q => !q.is_correct && q.selected_answer_key);
  if (!wrongQuestions.length) return { explanations: [], message: 'Bạn không có câu sai!' };

  const fallbackExplanations = () => ({
    explanations: wrongQuestions.map((q, i) => ({
      questionNumber: q.question_number || i + 1,
      yourAnswer: `${q.selected_answer_key}. ${getAnswerText(q.options, q.selected_answer_key)}`,
      correctAnswer: `${q.correct_answer_key}. ${getAnswerText(q.options, q.correct_answer_key)}`,
      whyWrong: 'Hãy ôn lại phần này và làm lại bài.',
      knowledgeNote: q.explanation || q.explanation_cn || '',
      tip: 'Đọc kỹ đề bài, so sánh từng lựa chọn và ghi lại kiến thức liên quan.',
      vocabulary: [],
    })),
  });

  async function explainBatch(batch, offset) {
    const questionsText = batch.map((q, i) => {
    const optionsText = (q.options || [])
      .slice(0, 8)
      .map(o => `${o.key}. ${o.text || o.text_cn || ''}`)
      .join(' | ');
    return `[Câu ${offset + i + 1}]
Đề bài: ${q.question_text || q.question_text_cn || ''}
Lựa chọn: ${optionsText}
Bạn chọn: ${q.selected_answer_key || '?'}. ${getAnswerText(q.options, q.selected_answer_key)}
Đúng: ${q.correct_answer_key || '?'}. ${getAnswerText(q.options, q.correct_answer_key)}
Giải thích admin: ${q.explanation || q.explanation_cn || 'Không có'}
Loại câu: ${q.question_type || 'single_choice'}`;
    }).join('\n\n');

    const prompt = `Bạn là giáo viên tiếng Trung. Giải thích bằng TIẾNG VIỆT.

YÊU CẦU:
- Viết plain text thuần túy, không dùng **bold**, không dùng ##, không dùng bất kỳ ký hiệu markdown phức tạp nào
- Mỗi phần phải đủ ý: vì sao đáp án học sinh sai, vì sao đáp án đúng đúng, kiến thức cần ôn
- Từ tiếng Trung mới → ghi kèm pinyin ngay sau, ví dụ: 电脑 (diàn nǎo)
- Đi thẳng vào vấn đề, không lặp đề bài
- Viết tự nhiên như đang giảng cho học sinh
- Chỉ dựa trên dữ liệu câu hỏi, đáp án và giải thích admin được cung cấp

CÁC CÂU SAI:
${questionsText}

TRẢ VỀ JSON:
{
  "explanations": [
    {
      "questionNumber": 1,
      "yourAnswer": "Bạn chọn: ...",
      "correctAnswer": "Đáp án đúng: ...",
      "whyWrong": "Giải thích 1-2 câu tại sao sai",
      "knowledgeNote": "Kiến thức liên quan 1-2 câu",
      "tip": "Mẹo nhớ 1 câu",
      "vocabulary": [
        { "word": "từ vựng tiếng Trung", "pinyin": "pinyin của từ", "meaning": "nghĩa tiếng Việt" }
      ]
    }
  ]
}`;

    const raw = await callBeeknoee(prompt, { temperature: 0.35, maxTokens: BEE.explanationMaxTokens || 1800 });
    const ai = parseAIMaybeJSON(raw);
    return normalizeExplanationResult(ai, batch).explanations;
  }

  try {
    const batchSize = 6;
    const explanations = [];
    for (let i = 0; i < wrongQuestions.length; i += batchSize) {
      const batch = wrongQuestions.slice(i, i + batchSize);
      explanations.push(...await explainBatch(batch, i));
    }
    return explanations.length ? { explanations } : fallbackExplanations();
  } catch (err) {
    if (err.message === 'RATE_LIMITED') throw err;
    console.error('AI wrong-answer explanation failed, using fallback:', err.message);
    return fallbackExplanations();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 3: Phân tích theo chủ đề (Topic Analysis)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Phân tích điểm mạnh/yếu theo môn/chủ đề qua nhiều bài thi
 * @param {Array} examAttempts - Lịch sử làm bài
 */
async function analyzeTopics(examAttempts) {
  if (!examAttempts || examAttempts.length === 0) {
    return { hasEnoughData: false, message: 'Cần ít nhất 1 bài thi để phân tích.' };
  }

  // Tính stats theo subject
  const subjectStats = {};
  examAttempts.forEach(attempt => {
    const subject = attempt.subject_name || attempt.subject || 'Tổng hợp';
    const percentage = attempt.total_questions > 0
      ? (attempt.total_correct / attempt.total_questions) * 100
      : parseFloat(attempt.total_score) || 0;
    if (!subjectStats[subject]) subjectStats[subject] = { scores: [], count: 0 };
    subjectStats[subject].scores.push(percentage);
    subjectStats[subject].count += 1;
    subjectStats[subject].total = subjectStats[subject].scores.reduce((a, b) => a + b, 0);
  });

  const subjects = Object.entries(subjectStats).map(([name, stats]) => ({
    name,
    average: Math.round(stats.total / stats.count),
    count: stats.count,
    trend: stats.count > 1
      ? Math.round(stats.scores[stats.count - 1] - stats.scores[0])
      : 0,
    history: stats.scores,
  }));

  // Phân loại mạnh/yếu
  const strengths = subjects.filter(s => s.average >= 75).sort((a, b) => b.average - a.average);
  const weaknesses = subjects.filter(s => s.average < 75).sort((a, b) => a.average - b.average);

  const prompt = `Phân tích kết quả học tập qua ${examAttempts.length} bài thi. Viết TIẾNG VIỆT, mỗi phần ngắn gọn.

KẾT QUẢ THEO MÔN:
${subjects.map(s => `- ${s.name}: ${s.average}% (${s.count} lần)`).join('\n')}

TRẢ VỀ JSON:
{
  "strengths": [{"name": "...", "average": 87, "advice": "1 câu"}],
  "weaknesses": [{"name": "...", "average": 45, "advice": "1 câu"}],
  "topRecommendations": ["Gợi ý 1", "Gợi ý 2"]
}`;

  try {
    const raw = await callBeeknoee(prompt, { temperature: 0.3, maxTokens: 3000 });
    const ai = parseAIMaybeJSON(raw);
    if (!ai) throw new Error('Parse failed');

    return {
      hasEnoughData: true,
      totalAttempts: examAttempts.length,
      subjects,
      strengths: ai.strengths || strengths.map(s => ({
        name: s.name, average: s.average,
        advice: 'Bạn làm tốt phần này! Tiếp tục duy trì.',
      })),
      weaknesses: ai.weaknesses || weaknesses.map(s => ({
        name: s.name, average: s.average,
        advice: 'Cần ôn luyện thêm phần này.',
      })),
      topRecommendations: ai.topRecommendations || [],
    };
  } catch (err) {
    if (err.message === 'RATE_LIMITED') throw err;
    return {
      hasEnoughData: true,
      totalAttempts: examAttempts.length,
      subjects,
      strengths: strengths.map(s => ({
        name: s.name, average: s.average,
        advice: 'Bạn làm tốt phần này!',
      })),
      weaknesses: weaknesses.map(s => ({
        name: s.name, average: s.average,
        advice: 'Cần ôn luyện thêm.',
      })),
      topRecommendations: ['Học đều các chủ đề', 'Làm nhiều bài tập', 'Ôn lại từ vựng thường xuyên'],
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 4: Gợi ý luyện tập (Practice Recommendations)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Gợi ý bài học và dạng bài cần luyện dựa trên điểm yếu
 */
async function getPracticeRecommendations(weaknesses, availableExams = []) {
  const weakSubjects = (weaknesses || []).map(w => w.name || w.subject || '').filter(Boolean);

  if (!weakSubjects.length) {
    return {
      recommendations: [{
        type: 'maintenance',
        title: 'Tiếp tục duy trì',
        description: 'Bạn đang học rất tốt! Hãy tiếp tục ôn luyện đều đặn.',
        priority: 'high',
        suggestedExams: availableExams.slice(0, 3),
      }],
    };
  }

  const prompt = `Gợi ý bài học dựa trên điểm yếu. Viết TIẾNG VIỆT, mỗi phần ngắn gọn.

ĐIỂM YẾU: ${weakSubjects.join(', ')}

TRẢ VỀ JSON:
{
  "recommendations": [
    {
      "type": "vocabulary|grammar|reading",
      "title": "Tiêu đề ngắn gọn",
      "description": "1-2 câu mô tả tại sao cần học phần này",
      "priority": "high|medium|low",
      "actionSteps": ["Bước 1", "Bước 2", "Bước 3"]
    }
  ],
  "studyPlan": "Lịch học 1-2 câu"
}`;

  try {
    const raw = await callBeeknoee(prompt, { temperature: 0.5, maxTokens: 3000 });
    const ai = parseAIMaybeJSON(raw);
    if (!ai) throw new Error('Parse failed');

    return {
      recommendations: ai.recommendations || [],
      studyPlan: ai.studyPlan || '',
      basedOnWeaknesses: weakSubjects,
    };
  } catch (err) {
    if (err.message === 'RATE_LIMITED') throw err;
    return {
      recommendations: weakSubjects.slice(0, 3).map((w, i) => ({
        type: 'grammar',
        title: `Ôn luyện: ${w}`,
        description: `Cần cải thiện phần ${w}`,
        priority: i === 0 ? 'high' : 'medium',
        estimatedTime: '30-60 phút',
        actionSteps: ['Đọc lý thuyết', 'Làm 10 câu bài tập', 'Review lại đáp án'],
      })),
      studyPlan: 'Học đều đặn 30 phút mỗi ngày',
      basedOnWeaknesses: weakSubjects,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 5: Chatbot hỏi đáp AI
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Chatbot trả lời câu hỏi của user về bài thi/kiến thức
 * @param {string} question - Câu hỏi của user
 * @param {Object} context  - Ngữ cảnh (attemptData, questions, etc.)
 */
function getQuestionStatus(q) {
  if (q.status) return q.status;
  if (!q.selected_answer_key) return 'unanswered';
  return q.is_correct ? 'correct' : 'incorrect';
}

function formatAIQuestionLine(q) {
  const status = getQuestionStatus(q);
  const statusLabel = status === 'correct' ? 'đúng' : status === 'unanswered' ? 'bỏ qua' : 'sai';
  const selected = q.selected_answer_key
    ? `${q.selected_answer_key}. ${q.selected_answer_text || ''}`.trim()
    : 'bỏ qua';
  const correct = q.correct_answer_key
    ? `${q.correct_answer_key}. ${q.correct_answer_text || ''}`.trim()
    : q.correct_answer_text || 'chưa có';
  return `Câu ${q.question_number} (${statusLabel}): ${q.question_text || q.question_text_cn || ''}\n- Học sinh chọn: ${selected}\n- Đáp án đúng: ${correct}`;
}

function buildReviewQuestionContext(questions = []) {
  if (!questions.length) return '(không có)';
  const groups = [
    ['Câu sai cần sửa', questions.filter((q) => getQuestionStatus(q) === 'incorrect').slice(0, 6)],
    ['Câu bỏ qua cần hướng dẫn', questions.filter((q) => getQuestionStatus(q) === 'unanswered').slice(0, 6)],
    ['Câu đúng có thể củng cố', questions.filter((q) => getQuestionStatus(q) === 'correct').slice(0, 4)],
  ];
  return groups
    .filter(([, items]) => items.length > 0)
    .map(([title, items]) => `${title}:\n${items.map(formatAIQuestionLine).join('\n')}`)
    .join('\n\n') || '(không có)';
}

async function askAI(question, context = {}) {
  const { examTitle, subjectName, questions = [], userScore, questionStats } = context;

  const contextText = [
    examTitle && `Đề thi: ${examTitle}`,
    subjectName && `Môn: ${subjectName}`,
    userScore !== undefined && `Điểm của bạn: ${userScore}%`,
    questions.length > 0 && `Số câu: ${questions.length}`,
    questionStats && `Tổng quan: đúng ${questionStats.correct || 0}, sai ${questionStats.incorrect || 0}, bỏ qua ${questionStats.unanswered || 0}`,
  ].filter(Boolean).join('\n');

  const reviewQuestionContext = buildReviewQuestionContext(questions);

  const prompt = `Bạn là trợ lý AI học tập tiếng Trung thân thiện. Trả lời câu hỏi của học sinh bằng TIẾNG VIỆT có dấu.

YÊU CẦU:
- CÓ THỂ dùng bullet (dấu -) để liệt kê cho dễ đọc. Không dùng ký hiệu markdown phức tạp.
- Viết tự nhiên như đang nhắn tin hướng dẫn.
- Câu hỏi ngắn → trả lời ngắn gọn.
- Cần giải thích → giải thích đầy đủ nhưng không lan man, chia thành các ý nhỏ.
- Từ tiếng Trung mới → ghi kèm pinyin ngay sau, ví dụ: 学习 (xué xí) = học.
- Đưa ví dụ cụ thể trong đời thường khi cần.
- Nếu học sinh hỏi về câu đúng, hãy củng cố vì sao đúng và chỉ ra dấu hiệu nhận biết.
- Nếu học sinh hỏi về câu bỏ qua, hãy hướng dẫn cách suy luận từ đầu, không trách người học.

TRÁNH:
- KHÔNG lặp lại câu hỏi của user.
- KHÔNG bịa dữ liệu ngoài ngữ cảnh bài thi. Nếu thiếu dữ liệu, nói rõ và hướng dẫn cách tự kiểm tra.

Ngữ cảnh bài thi (nếu có):
${contextText || '(không có)'}
Các câu trong bài để tham chiếu:
${reviewQuestionContext}

Câu hỏi: ${question}`;

  try {
    const response = await callBeeknoee(prompt, { temperature: 0.5, maxTokens: BEE.chatMaxTokens || 2200 });
    return {
      answer: response,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.message === 'RATE_LIMITED') throw err;
    return {
      answer: 'Xin lỗi, hiện tại AI đang bận. Bạn hãy thử lại sau nhé!',
      timestamp: new Date().toISOString(),
      error: true,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 5b: Chatbot hỏi đáp AI (Streaming)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Chatbot trả lời câu hỏi của user về bài thi/kiến thức (Stream qua SSE)
 * @param {string} question - Câu hỏi của user
 * @param {Object} context  - Ngữ cảnh (attemptData, questions, etc.)
 * @param {Object} res - Express Response object (để pipe SSE)
 */
async function askAIStream(question, context = {}, res) {
  const { examTitle, subjectName, questions = [], userScore, questionStats } = context;

  const contextText = [
    examTitle && `Đề thi: ${examTitle}`,
    subjectName && `Môn: ${subjectName}`,
    userScore !== undefined && `Điểm của bạn: ${userScore}%`,
    questions.length > 0 && `Số câu: ${questions.length}`,
    questionStats && `Tổng quan: đúng ${questionStats.correct || 0}, sai ${questionStats.incorrect || 0}, bỏ qua ${questionStats.unanswered || 0}`,
  ].filter(Boolean).join('\n');

  const reviewQuestionContext = buildReviewQuestionContext(questions);

  const prompt = `Bạn là trợ lý AI học tập tiếng Trung thân thiện. Trả lời câu hỏi của học sinh bằng TIẾNG VIỆT có dấu.

YÊU CẦU:
- CÓ THỂ dùng bullet (dấu -) để liệt kê cho dễ đọc. Không dùng ký hiệu markdown phức tạp.
- Viết tự nhiên như đang nhắn tin hướng dẫn.
- Câu hỏi ngắn → trả lời ngắn gọn.
- Cần giải thích → giải thích đầy đủ nhưng không lan man, chia thành các ý nhỏ.
- Từ tiếng Trung mới → ghi kèm pinyin ngay sau, ví dụ: 学习 (xué xí) = học.
- Đưa ví dụ cụ thể trong đời thường khi cần.
- Nếu học sinh hỏi về câu đúng, hãy củng cố vì sao đúng và chỉ ra dấu hiệu nhận biết.
- Nếu học sinh hỏi về câu bỏ qua, hãy hướng dẫn cách suy luận từ đầu, không trách người học.

TRÁNH:
- KHÔNG lặp lại câu hỏi của user.
- KHÔNG bịa dữ liệu ngoài ngữ cảnh bài thi. Nếu thiếu dữ liệu, nói rõ và hướng dẫn cách tự kiểm tra.

Ngữ cảnh bài thi (nếu có):
${contextText || '(không có)'}
Các câu trong bài để tham chiếu:
${reviewQuestionContext}

Câu hỏi: ${question}`;

  if (isRateLimited()) {
    res.write(`data: ${JSON.stringify({ error: 'AI limit. Vui lòng thử lại sau.' })}\n\n`);
    res.end();
    return;
  }

  await waitBetweenRequests();

  const apiKey = getNextKey();
  if (!apiKey) {
    res.write(`data: ${JSON.stringify({ error: 'Không có cấu hình AI key' })}\n\n`);
    res.end();
    return;
  }

  const BEE = aiConfig.beeknoee;
  const payload = {
    model: BEE.model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: BEE.chatMaxTokens || 2200,
    temperature: 0.5,
    stream: true
  };

  try {
    await withConcurrency(async () => {
      const response = await axios.post(
        `${BEE.baseUrl}/chat/completions`,
        payload,
        {
          timeout: BEE.timeout,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          responseType: 'stream'
        }
      );

      let buffer = '';
      let sentDone = false;

      await new Promise((resolve) => {
        response.data.on('data', chunk => {
          buffer += chunk.toString('utf8');
          const parts = buffer.split(/\r?\n/);
          buffer = parts.pop() || '';

          for (const line of parts) {
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (!data) continue;
            if (data === '[DONE]') sentDone = true;
            res.write(`data: ${data}\n\n`);
          }
        });

        response.data.on('end', () => {
          if (!sentDone) {
            res.write('data: [DONE]\n\n');
          }
          res.end();
          resolve();
        });

        response.data.on('error', err => {
          console.error('AI Stream Error:', err);
          res.write(`data: ${JSON.stringify({ error: 'Lỗi stream AI' })}\n\n`);
          res.end();
          resolve();
        });
      });
    });
  } catch (err) {
    console.error('Lỗi khi stream AI:', err.message);
    if (err.response?.status === 429) {
      console.warn(`⚠️ Key bị rate limit, chuyển key`);
      currentKeyIndex++;
      setRateLimit(aiConfig.general?.globalBackoffMs || 60000);
    }
    res.write(`data: ${JSON.stringify({ error: 'Lỗi khi gọi AI' })}\n\n`);
    res.end();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 6: Phân tích tiến bộ (Progress Analysis)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * So sánh kết quả giữa các lần thi, nhận xét tiến bộ/thụt lùi
 * @param {Array} examAttempts - Lịch sử thi (đã sort theo thời gian)
 */
async function analyzeProgress(examAttempts) {
  if (!examAttempts || examAttempts.length < 2) {
    return {
      hasEnoughData: false,
      message: 'Cần ít nhất 2 bài thi để so sánh tiến bộ.',
    };
  }

  const sorted = [...examAttempts]
    .filter(a => a.total_questions > 0)
    .sort((a, b) => new Date(a.submit_time) - new Date(b.submit_time));

  if (sorted.length < 2) {
    return { hasEnoughData: false, message: 'Cần ít nhất 2 bài thi đã nộp.' };
  }

  // Tính score % từng lần
  const history = sorted.map(a => ({
    examId: a.exam_id,
    examTitle: a.exam_title || a.title || 'Đề thi',
    date: a.submit_time,
    score: a.total_questions > 0
      ? Math.round((a.total_correct / a.total_questions) * 100)
      : parseFloat(a.total_score) || 0,
    correct: a.total_correct,
    total: a.total_questions,
  }));

  const first = history[0].score;
  const last = history[history.length - 1].score;
  const delta = last - first;
  const avg = Math.round(history.reduce((s, h) => s + h.score, 0) / history.length);

  const prompt = `So sánh tiến bộ qua ${history.length} bài thi. Viết TIẾNG VIỆT, ngắn gọn.

LỊCH SỬ (theo thời gian):
${history.map((h, i) => `${i + 1}. ${h.examTitle}: ${h.score}% (${h.correct}/${h.total})`).join('\n')}

Hiện tại: ${last}% | Trung bình: ${avg}% | Thay đổi: ${delta > 0 ? '+' : ''}${delta}%

TRẢ VỀ JSON:
{
  "delta": ${delta},
  "trend": "improving|declining|stable",
  "summary": "Tổng kết 2-3 câu về xu hướng",
  "improvementNotes": ["Ghi chú 1", "Ghi chú 2"],
  "warningNotes": ["Cảnh báo"] (nếu có)
}`;

  try {
    const raw = await callBeeknoee(prompt, { temperature: 0.3, maxTokens: 3000 });
    const ai = parseAIMaybeJSON(raw);
    if (!ai) throw new Error('Parse failed');

    return {
      ...ai,
      history: history.map(h => ({
        ...h,
        date: new Date(h.date).toLocaleDateString('vi-VN'),
      })),
    };
  } catch (err) {
    if (err.message === 'RATE_LIMITED') throw err;
    return {
      hasEnoughData: true,
      totalAttempts: history.length,
      history: history.map(h => ({
        ...h,
        date: new Date(h.date).toLocaleDateString('vi-VN'),
      })),
      delta,
      trend: delta > 5 ? 'improving' : delta < -5 ? 'declining' : 'stable',
      summary: delta > 0
        ? `Bạn đã tiến bộ ${delta}% so với lần thi đầu tiên. Hãy tiếp tục!`
        : delta < 0
        ? `Điểm giảm ${Math.abs(delta)}%. Đừng nản, hãy ôn lại và thử lại!`
        : 'Điểm ổn định. Hãy cố gắng cải thiện thêm!',
      improvementNotes: ['Tiếp tục ôn luyện đều đặn'],
      warningNotes: delta < 0 ? ['Cần xem lại phần kiến thức yếu'] : [],
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 7: Gợi ý đề thi tiếp theo
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Gợi ý đề thi phù hợp với trình độ hiện tại
 * @param {Object} context - { userLevel, weaknesses, strongSubjects, allExams }
 */
async function recommendNextExam(context = {}) {
  const { userScore, subjectName, allExams = [] } = context;

  if (!allExams.length) {
    return { recommendations: [], message: 'Không có đề thi nào để gợi ý.' };
  }

  // Lọc đề phù hợp
  const level = userScore >= 80 ? 'hard' : userScore >= 60 ? 'medium' : 'easy';
  const recommendations = allExams
    .filter(e => e.status === 'published' || e.is_published)
    .filter(e => !subjectName || e.subject_name === subjectName)
    .slice(0, 5)
    .map(e => ({
      id: e.id,
      title: e.title,
      titleCn: e.title_cn,
      subjectName: e.subject_name,
      difficultyLevel: e.difficulty_level || 'medium',
      totalQuestions: e.total_questions,
      duration: e.duration,
      isRecommended: e.difficulty_level === level,
    }));

  const prompt = `Gợi ý đề thi tiếp theo phù hợp. Viết TIẾNG VIỆT, ngắn gọn.

TRÌNH ĐỘ: ${level} (${userScore || 'N/A'}%)
MÔN: ${subjectName || 'Tổng hợp'}

ĐỀ CÓ SẴN:
${recommendations.map(e => `- "${e.title}" (${e.difficultyLevel}, ${e.totalQuestions} câu)`).join('\n')}

TRẢ VỀ JSON:
{
  "recommendedExam": { "id": ..., "reason": "1-2 câu tại sao gợi ý đề này" },
  "studyAdvice": "Lời khuyên ngắn trước khi làm đề tiếp theo"
}`;

  try {
    const raw = await callBeeknoee(prompt, { temperature: 0.4, maxTokens: 1000 });
    const ai = parseAIMaybeJSON(raw);

    if (!ai) throw new Error('Parse failed');

    // Merge AI recommendation với data thực
    const rec = recommendations.find(e => e.id === ai.recommendedExam?.id) || recommendations[0];

    return {
      recommendedExam: rec ? { ...rec, reason: ai.recommendedExam?.reason || '' } : null,
      alternativeExams: ai.alternativeExams || recommendations.slice(1, 4),
      studyAdvice: ai.studyAdvice || '',
    };
  } catch (err) {
    if (err.message === 'RATE_LIMITED') throw err;
    return {
      recommendedExam: recommendations.find(e => e.difficultyLevel === level) || recommendations[0],
      alternativeExams: recommendations.slice(1, 4),
      studyAdvice: 'Hãy ôn lại những phần yếu trước khi làm đề mới.',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 8: Phân tích toàn diện (tổng hợp tất cả)
// ─────────────────────────────────────────────────────────────────────────────
async function generateFullAnalysis(examAttempts, allExams = []) {
  const [topicResult, progressResult] = await Promise.allSettled([
    analyzeTopics(examAttempts),
    analyzeProgress(examAttempts),
  ]);

  const topics = topicResult.status === 'fulfilled' ? topicResult.value : null;
  const progress = progressResult.status === 'fulfilled' ? progressResult.value : null;

  const latestAttempt = examAttempts?.[examAttempts.length - 1];
  const recs = await getPracticeRecommendations(
    topics?.weaknesses || [],
    allExams,
  );

  return {
    topics,
    progress,
    recommendations: recs,
    nextExam: await recommendNextExam({
      userScore: latestAttempt?.total_questions > 0
        ? Math.round((latestAttempt.total_correct / latestAttempt.total_questions) * 100)
        : parseFloat(latestAttempt?.total_score) || 60,
      subjectName: latestAttempt?.subject_name,
      allExams,
    }),
    generatedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy exports (giữ tương thích với code cũ)
// ─────────────────────────────────────────────────────────────────────────────
async function analyzeWeaknesses(examAttempts) {
  const result = await analyzeTopics(examAttempts);
  return result;
}

async function generateRoadmap(weaknesses) {
  const recs = await getPracticeRecommendations(weaknesses);
  const roadmap = recs.recommendations.slice(0, 5).map((r, i) => ({
    phase: i + 1,
    days: `${i * 3 + 1}-${i * 3 + 3}`,
    title: r.title,
    description: r.description,
    tasks: r.actionSteps || [],
  }));
  return { roadmap };
}

async function recommendMaterials(weaknesses, allMaterials) {
  return allMaterials.slice(0, 5);
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 8: Chấm điểm tự luận / Dịch thuật
// ─────────────────────────────────────────────────────────────────────────────
/**
 * AI chấm điểm câu trả lời tự luận hoặc bài dịch
 * @param {Object} params - { questionText, questionTextCn, userAnswer, correctAnswer, questionType }
 */
async function gradeEssay({ questionText, questionTextCn, userAnswer, correctAnswer, questionType = 'essay' }) {
  const isTranslation = questionType === 'translation';

  const prompt = `Bạn là giáo viên tiếng Trung chấm bài. Chấm bằng TIẾNG VIỆT.

YÊU CẦU:
- Đánh giá chi tiết từng khía cạnh
- Tìm lỗi sai cụ thể, gạch chân từ/phrase bị sai trong câu trả lời
- Đề xuất câu trả lời chuẩn, đúng ngữ pháp
- Cho điểm từng phần và tổng điểm (thang 10)
- Không cho điểm cao nếu câu trả lời quá ngắn, lạc đề, bỏ ý chính hoặc chỉ sao chép một phần đáp án
- Nhận xét phải nêu rõ lỗi ngữ pháp/từ vựng/diễn đạt và cách sửa thực tế

CÂU HỎI:
${questionText || ''}
${questionTextCn ? `Tiếng Trung: ${questionTextCn}` : ''}
${isTranslation ? '\n(Dạng: Dịch thuật)' : '\n(Dạng: Tự luận)'}

CÂU TRẢ LỜI CỦA HỌC SINH:
${userAnswer}

ĐÁP ÁN THAM KHẢO:
${correctAnswer || 'Không có'}

TRẢ VỀ JSON:
{
  "totalScore": 0-10,
  "gradingCriteria": [
    { "criterion": "Tiêu chí", "score": 0-10, "maxScore": 10, "comment": "Nhận xét" }
  ],
  "errors": [
    { "original": "từ/cụm sai", "correct": "sửa lại", "reason": "tại sao sai", "type": "grammar|vocabulary|typo" }
  ],
  "modelAnswer": "Câu trả lời mẫu chuẩn",
  "feedback": "Nhận xét tổng quát 2-3 câu",
  "suggestions": ["Gợi ý cải thiện 1", "Gợi ý 2"]
}`;

  try {
    const raw = await callBeeknoee(prompt, { temperature: 0.25, maxTokens: BEE.essayMaxTokens || 3000 });
    const ai = parseAIMaybeJSON(raw);

    if (!ai) throw new Error('Parse failed');

    return normalizeEssayGrade(ai);
  } catch (err) {
    if (err.message === 'RATE_LIMITED') throw err;
    return {
      success: true,
      totalScore: 0,
      gradingCriteria: [],
      errors: [],
      modelAnswer: '',
      feedback: 'Không thể chấm bài lúc này. Bạn hãy thử lại sau nhé!',
      suggestions: [],
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 9: Giảng lại lý thuyết (Mini-lesson)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * AI tạo bài giảng ngắn về ngữ pháp/kiến thức liên quan đến câu hỏi sai
 * @param {Object} params - { question, topic, wrongAnswer, correctAnswer, userLevel }
 */
async function teachGrammar({ question, topic, wrongAnswer, correctAnswer, userLevel = 'beginner' }) {
  const levelMap = { beginner: 'sơ cấp', intermediate: 'trung cấp', advanced: 'nâng cao' };
  const levelText = levelMap[userLevel] || 'sơ cấp';

  const prompt = `Bạn là giáo viên tiếng Trung. Tạo bài giảng ngắn bằng TIẾNG VIỆT cho học sinh trình độ ${levelText}.

CẤU TRÚC BÀI GIẢNG:
1. Giải thích ngữ pháp/qui tắc liên quan (ngắn gọn, 3-5 câu)
2. Đưa 2-3 ví dụ minh hoạ (câu thường gặp trong đời sống)
3. Mẹo ghi nhớ (1-2 mẹo)
4. Lưu ý thường sai (1-2 lưu ý)

NGỮ CẢNH:
- Câu hỏi liên quan: ${question || ''}
- Chủ đề: ${topic || 'Ngữ pháp tiếng Trung'}
- Đáp án sai của học sinh: ${wrongAnswer || 'không có'}
- Đáp án đúng: ${correctAnswer || 'không có'}

YÊU CẦU:
- Viết plain text, có thể dùng bullet (-)
- Mỗi phần 2-5 câu, đi thẳng vào vấn đề
- Ví dụ tiếng Trung bắt buộc có pinyin và nghĩa tiếng Việt
- Từ tiếng Trung gắn kèm pinyin ngay sau
- Không dùng markdown phức tạp (không **, ##)

TRẢ VỀ JSON:
{
  "title": "Tiêu đề bài học",
  "grammarRule": "Giải thích qui tắc ngữ pháp ngắn gọn",
  "examples": [
    { "chinese": "câu tiếng Trung", "pinyin": "pinyin", "vietnamese": "nghĩa tiếng Việt", "usage": "dùng khi nào" }
  ],
  "memoryTips": ["Mẹo 1", "Mẹo 2"],
  "commonMistakes": ["Lỗi thường gặp 1", "Lỗi thường gặp 2"],
  "relatedTopics": ["Chủ đề liên quan 1", "Chủ đề liên quan 2"]
}`;

  try {
    const raw = await callBeeknoee(prompt, { temperature: 0.45, maxTokens: BEE.lessonMaxTokens || 3000 });
    const ai = parseAIMaybeJSON(raw);

    if (!ai) throw new Error('Parse failed');

    return normalizeGrammarLesson(ai);
  } catch (err) {
    if (err.message === 'RATE_LIMITED') throw err;
    return {
      success: false,
      title: 'Bài học ngữ pháp',
      grammarRule: 'Không thể tải bài giảng lúc này. Bạn hãy thử lại sau nhé!',
      examples: [],
      memoryTips: [],
      commonMistakes: [],
      relatedTopics: [],
    };
  }
}

module.exports = {
  // Core functions
  callBeeknoee,
  isRateLimited,
  getRateLimitRemaining,
  // Features
  analyzeExamResult,
  explainWrongAnswers,
  analyzeTopics,
  getPracticeRecommendations,
  askAI,
  askAIStream,
  analyzeProgress,
  recommendNextExam,
  generateFullAnalysis,
  gradeEssay,
  teachGrammar,
  // Legacy
  analyzeWeaknesses,
  generateRoadmap,
  recommendMaterials,
};
