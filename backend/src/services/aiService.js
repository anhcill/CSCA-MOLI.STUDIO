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
  const key = keys[currentKeyIndex % keys.length];
  currentKeyIndex++;
  console.log(`🔑 Dùng API key #${(currentKeyIndex % keys.length) + 1}/${keys.length}`);
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
const MAX_CONCURRENT = 3;

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

// ─── AI Core: Gọi Beeknoee (DeepSeek R1) ───────────────────────────────────────
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
        console.warn(`⚠️ Key #${(currentKeyIndex % BEE.apiKeys.length)} bị rate limit, thử key khác...`);
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
  return null;
}

// ─── Fallback rule-based analysis ─────────────────────────────────────────────
function ruleBasedExamAnalysis(attemptData) {
  const { totalScore, totalQuestions, correctCount, subjectName, questions } = attemptData;
  const percentage = Math.round((correctCount / totalQuestions) * 100);

  const isPassing = percentage >= 60;
  const isExcellent = percentage >= 85;

  return {
    score: percentage,
    grade: isExcellent ? 'Tuyệt vời!' : isPassing ? 'Đạt yêu cầu' : 'Cần cố gắng',
    gradeColor: isExcellent ? 'emerald' : isPassing ? 'blue' : 'red',
    analysis: isExcellent
      ? `Bạn làm rất tốt! Kiến thức vững chắc.`
      : isPassing
      ? `Kết quả đạt yêu cầu. Cần ôn luyện thêm để cải thiện.`
      : `Bạn cần học kỹ hơn. Hãy ôn lại lý thuyết và làm nhiều bài tập hơn.`,
    overallAdvice: isExcellent
      ? 'Tiếp tục duy trì và thử thách bản thân với các đề khó hơn.'
      : isPassing
      ? 'Hãy tập trung vào những phần bạn sai và ôn lại kiến thức cơ bản.'
      : 'Học lại từ đầu, chia nhỏ từng chủ đề và luyện tập đều đặn.',
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
  Đề bài: ${q.question_text || q.question_text_cn || ''}
  Lựa chọn: ${optionsText}
  Bạn chọn: ${userAnswer}
  Đáp án đúng: ${correctKey}. ${correctAnswerText || ''}
  Giải thích admin: ${q.explanation || q.explanation_cn || 'Không có'}`.substring(0, 600);
  }).join('\n\n');

  const prompt = `Bạn là chuyên gia giáo dục cho kỳ thi HSK/CSCA.
Phân tích bằng TIẾNG VIỆT, NGẮN GỌN, DỄ HIỂU.

THÔNG TIN BÀI THI:
- Môn: ${attemptData.subjectName || 'Tiếng Trung'}
- Số câu đúng: ${correctCount}/${totalQuestions} (${percentage}%)
- Thời gian: ${attemptData.duration || 'N/A'} phút

CHI TIẾT TỪNG CÂU:
${questionsText}

YÊU CẦU — trả về JSON, mỗi trường text tối đa 2-3 câu:
{
  "score": ${percentage},
  "grade": "Mô tả ngắn",
  "gradeColor": "emerald|blue|amber|red",
  "summary": "Tổng kết 1-2 câu",
  "strengths": ["Điểm mạnh 1", "Điểm mạnh 2"],
  "weaknesses": ["Điểm yếu 1", "Điểm yếu 2"],
  "analysis": "Phân tích ngắn gọn 2-3 câu",
  "overallAdvice": "Lời khuyên 1-2 câu",
  "priorityTopics": ["Chủ đề 1", "Chủ đề 2"]
}`;

  try {
    const raw = await callBeeknoee(prompt, { temperature: 0.3, maxTokens: 1500 });
    const ai = parseAIMaybeJSON(raw) || ruleBasedExamAnalysis(attemptData);

    return {
      score: percentage,
      difficultyBreakdown,
      wrongCount: wrongQuestions.length,
      ...ai,
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

  const questionsText = wrongQuestions.map((q, i) => {
    const optionsText = (q.options || [])
      .slice(0, 8)
      .map(o => `${o.key}. ${o.text || o.text_cn || ''}`)
      .join(' | ');
    return `[Câu ${i + 1}]
Đề bài: ${q.question_text || q.question_text_cn || ''}
Lựa chọn: ${optionsText}
Bạn chọn: ${q.selected_answer_key || '?'}. ${getAnswerText(q.options, q.selected_answer_key)}
Đúng: ${q.correct_answer_key || '?'}. ${getAnswerText(q.options, q.correct_answer_key)}
Giải thích admin: ${q.explanation || q.explanation_cn || 'Không có'}
Loại câu: ${q.question_type || 'single_choice'}`;
  }).join('\n\n');

  const prompt = `Bạn là giáo viên tiếng Trung. Giải thích bằng TIẾNG VIỆT, NGẮN GỌN.

CÁC CÂU SAI:
${questionsText}

YÊU CẦU — trả về JSON, mỗi trường tối đa 2-3 câu:
{
  "explanations": [
    {
      "questionNumber": 1,
      "yourAnswer": "Bạn chọn: ..." ,
      "correctAnswer": "Đáp án đúng: ...",
      "whyWrong": "Tại sao sai (1-2 câu)",
      "knowledgeNote": "Kiến thức liên quan (1-2 câu)",
      "tip": "Mẹo nhớ (1 câu)",
      "vocabulary": []
    }
  ]
}`;

  try {
    const raw = await callBeeknoee(prompt, { temperature: 0.4, maxTokens: 1000 });
    const ai = parseAIMaybeJSON(raw);
    if (ai && ai.explanations) return ai;
    return { explanations: wrongQuestions.map((q, i) => ({
      questionNumber: q.question_number || i + 1,
      yourAnswer: `${q.selected_answer_key}. ${getAnswerText(q.options, q.selected_answer_key)}`,
      correctAnswer: `${q.correct_answer_key}. ${getAnswerText(q.options, q.correct_answer_key)}`,
      whyWrong: 'Hãy ôn lại phần này và làm lại bài.',
      knowledgeNote: q.explanation || q.explanation_cn || '',
      tip: 'Đọc kỹ đề bài và học thuộc từ vựng liên quan.',
      vocabulary: [],
    }))};
  } catch (err) {
    if (err.message === 'RATE_LIMITED') throw err;
    return {
      explanations: wrongQuestions.map((q, i) => ({
        questionNumber: q.question_number || i + 1,
        yourAnswer: `${q.selected_answer_key}. ${getAnswerText(q.options, q.selected_answer_key)}`,
        correctAnswer: `${q.correct_answer_key}. ${getAnswerText(q.options, q.correct_answer_key)}`,
        whyWrong: 'Hãy ôn lại phần này.',
        knowledgeNote: q.explanation || '',
        tip: 'Học thuộc từ vựng và ngữ pháp liên quan.',
        vocabulary: [],
      })),
    };
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

  const prompt = `Phân tích kết quả học tập qua ${examAttempts.length} bài thi và đưa ra lời khuyên bằng TIẾNG VIỆT.

KẾT QUẢ THEO MÔN:
${subjects.map(s => `- ${s.name}: ${s.average}% (${s.count} lần thi)`).join('\n')}

TRẢ VỀ JSON:
{
  "topicStats": [...],  // mảng các môn đã phân tích
  "strengths": [{"name": "Tên môn", "average": 87, "advice": "Lời khuyên ngắn"}],
  "weaknesses": [{"name": "Tên môn", "average": 45, "advice": "Lời khuyên ngắn"}],
  "topRecommendations": ["Gợi ý 1", "Gợi ý 2", "Gợi ý 3"]
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

  const prompt = `Dựa vào các điểm yếu sau, hãy gợi ý bài học bằng TIẾNG VIỆT:

ĐIỂM YẾU: ${weakSubjects.join(', ')}

TRẢ VỀ JSON:
{
  "recommendations": [
    {
      "type": "vocabulary|grammar|reading|listening|grammar",
      "title": "Tiêu đề gợi ý (ngắn, hấp dẫn)",
      "description": "Mô tả 1-2 câu tại sao cần học phần này",
      "priority": "high|medium|low",
      "estimatedTime": "30-60 phút",
      "actionSteps": ["Bước 1", "Bước 2", "Bước 3"]
    }
  ],
  "studyPlan": "Lịch học tổng quát 1 tuần"
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
async function askAI(question, context = {}) {
  const { examTitle, subjectName, questions = [], userScore } = context;

  const contextText = [
    examTitle && `Đề thi: ${examTitle}`,
    subjectName && `Môn: ${subjectName}`,
    userScore !== undefined && `Điểm của bạn: ${userScore}%`,
    questions.length > 0 && `Số câu: ${questions.length}`,
  ].filter(Boolean).join('\n');

  const recentWrong = questions
    .filter(q => !q.is_correct)
    .slice(0, 5)
    .map(q => `Câu ${q.question_number}: ${q.question_text || q.question_text_cn || ''} → Đúng: ${q.correct_answer_key}. ${q.correct_answer_text || ''}`)
    .join('\n');

  const prompt = `Bạn là trợ lý học tập tiếng Trung. Trả lời BẰNG TIẾNG VIỆT.

Cách trả lời:
- Viết đủ dài, chi tiết, dễ hiểu cho học sinh
- Giải thích rõ từng bước một, không bỏ qua bước nào
- Dùng ví dụ cụ thể để minh họa
- Nếu có từ mới, ghi: từ - pinyin - nghĩa
- KHÔNG dùng emoji trong câu trả lời chính
- KHÔNG dùng markdown (không *, không **, không ###)

Ngữ cảnh bài thi:
${contextText}
Các câu sai gần đây:
${recentWrong || '(không có)'}

Câu hỏi: ${question}

Trả lời chi tiết:`;

  try {
    const response = await callBeeknoee(prompt, { temperature: 0.6, maxTokens: 2000 });
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

  const prompt = `So sánh tiến bộ học tập qua ${history.length} bài thi.

LỊCH SỬ ĐIỂM (theo thứ tự thời gian):
${history.map((h, i) => `${i + 1}. ${h.examTitle} (${new Date(h.date).toLocaleDateString('vi-VN')}): ${h.score}% (${h.correct}/${h.total})`).join('\n')}

PHÂN TÍCH:
- Điểm lần đầu: ${first}%
- Điểm lần gần nhất: ${last}%
- Chênh lệch: ${delta > 0 ? '+' : ''}${delta}%
- Điểm trung bình: ${avg}%

TRẢ VỀ JSON:
{
  "hasEnoughData": true,
  "totalAttempts": ${history.length},
  "history": [...],
  "delta": ${delta},
  "trend": "improving|declining|stable",
  "summary": "Tổng kết 2-3 câu về xu hướng",
  "improvementNotes": ["Ghi chú 1", "Ghi chú 2"],
  "warningNotes": ["Cảnh báo 1"] (nếu có)
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

  const prompt = `Gợi ý đề thi tiếp theo phù hợp với trình độ của học viên.

TRÌNH ĐỘ HIỆN TẠI:
- Mức độ khuyến nghị: ${level}
- Điểm lần trước: ${userScore || 'N/A'}%
- Môn: ${subjectName || 'Tổng hợp'}

CÁC ĐỀ CÓ SẴN:
${recommendations.map(e => `- "${e.title}" (${e.difficultyLevel}, ${e.totalQuestions} câu)`).join('\n')}

TRẢ VỀ JSON:
{
  "recommendedExam": { "id": ..., "title": "...", "reason": "Tại sao gợi ý đề này" },
  "alternativeExams": [...],
  "studyAdvice": "Lời khuyên trước khi làm đề tiếp theo"
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
  analyzeProgress,
  recommendNextExam,
  generateFullAnalysis,
  // Legacy
  analyzeWeaknesses,
  generateRoadmap,
  recommendMaterials,
};
