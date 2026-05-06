import axios from '@/lib/utils/axios';

// ─── AI API — gọi đến /api/ai/... ─────────────────────────────────────────────

// ─── Types ────────────────────────────────────────────────────────────────────────
export interface AIAnalysis {
    score: number;
    grade: string;
    gradeColor: 'emerald' | 'blue' | 'amber' | 'red';
    summary: string;
    strengths: string[];
    weaknesses: string[];
    analysis: string;
    overallAdvice: string;
    priorityTopics: string[];
    difficultyBreakdown?: {
        easy:   { correct: number; total: number; rate: number };
        medium: { correct: number; total: number; rate: number };
        hard:   { correct: number; total: number; rate: number };
    };
    wrongCount?: number;
}

export interface AIExamResult {
    success: boolean;
    attempt: {
        id: number;
        examTitle: string;
        subjectName: string;
        totalScore: number;
        totalQuestions: number;
        correctCount: number;
        duration?: number;
        submittedAt: string;
    };
    aiAnalysis: AIAnalysis;
    rateLimited?: boolean;
    retryAfter?: number;
}

export interface AIExplanation {
    questionNumber: number;
    yourAnswer: string;
    correctAnswer: string;
    whyWrong: string;
    knowledgeNote: string;
    tip: string;
    vocabulary?: { word: string; pinyin: string; meaning: string }[];
}

export interface AIExplanationsResult {
    success: boolean;
    wrongCount: number;
    explanations: { explanations: AIExplanation[] };
    rateLimited?: boolean;
}

export interface AITopicsResult {
    success: boolean;
    hasEnoughData: boolean;
    message?: string;
    subjects: { name: string; average: number; count: number }[];
    strengths: { name: string; average: number; advice: string }[];
    weaknesses: { name: string; average: number; advice: string }[];
    topRecommendations: string[];
}

export interface AIProgressResult {
    success: boolean;
    hasEnoughData: boolean;
    message?: string;
    totalAttempts: number;
    history: { examTitle: string; date: string; score: number; correct?: number; total?: number }[];
    delta: number;
    trend: 'improving' | 'declining' | 'stable';
    summary: string;
    improvementNotes: string[];
    warningNotes: string[];
}

export interface AINextExamResult {
    success: boolean;
    userScore: number;
    recommendedExam: {
        id: number;
        title: string;
        subjectName: string;
        difficultyLevel: string;
        totalQuestions: number;
        duration: number;
        reason?: string;
    } | null;
    alternativeExams: any[];
    studyAdvice: string;
}

// ─── 🥇 FEATURE 1: Phân tích kết quả bài thi ───────────────────────────────────
export async function analyzeExamResult(attemptId: number): Promise<AIExamResult> {
    const res = await axios.post(`/ai/exam-result/${attemptId}`);
    return res.data;
}

// ─── 🥈 FEATURE 2: Giải thích câu sai ────────────────────────────────────────
export async function getWrongAnswerExplanations(attemptId: number): Promise<AIExplanationsResult> {
    const res = await axios.get(`/ai/exam/${attemptId}/explanations`);
    return res.data;
}

// ─── 🥉 FEATURE 3: Phân tích theo chủ đề ────────────────────────────────────
export async function analyzeTopics(): Promise<AITopicsResult> {
    const res = await axios.post('/ai/topics');
    return res.data;
}

// ─── 🔥 FEATURE 4: Gợi ý luyện tập ────────────────────────────────────────────
export async function getPracticeRecommendations(weaknesses?: any[], examId?: number): Promise<any> {
    const res = await axios.post('/ai/practice', { weaknesses, examId });
    return res.data;
}

// ─── 🚀 FEATURE 5: Chatbot hỏi đáp ────────────────────────────────────────────
export async function askAI(question: string, attemptId?: number): Promise<{ success: boolean; answer: string }> {
    const res = await axios.post('/ai/ask', { question, attemptId });
    return res.data;
}

// ─── 🧠 FEATURE 6: Phân tích tiến bộ ─────────────────────────────────────────
export async function analyzeProgress(): Promise<AIProgressResult> {
    const res = await axios.get('/ai/progress');
    return res.data;
}

// ─── ⚡ FEATURE 7: Gợi ý đề tiếp theo ──────────────────────────────────────
export async function recommendNextExam(): Promise<AINextExamResult> {
    const res = await axios.get('/ai/next-exam');
    return res.data;
}
