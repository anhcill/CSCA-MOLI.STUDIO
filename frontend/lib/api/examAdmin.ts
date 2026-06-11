import axios from '../utils/axios';
import { normalizeImportedItemsMath, normalizePdfImportPreviewMath } from '@/lib/pdf-import/normalizeImportedMath';
import type { PdfImportPreset } from '@/lib/pdf-import/presets';

export interface ExamCreateData {
    title: string;
    titleCn?: string;          // P0: hỗ trợ title tiếng Trung
    subjectId: number;
    duration?: number;
    totalPoints?: number;
    description?: string;
    allow_download?: boolean;
    is_premium?: boolean;
    is_simulated?: boolean;
    solution_video_url?: string;
    solution_description?: string;
    shuffle_mode?: boolean;
    vip_tier?: string; // 'basic' | 'vip' | 'premium'
    start_time?: string;
    end_time?: string;
    difficulty_level?: string; // P1: 'easy' | 'medium' | 'hard'
}

export interface QuestionData {
    questionType?: QuestionType;  // 'single_choice' | 'fill_blank_pool' | 'fill_blank_item' | 'reading_passage' | 'reading_item' | 'true_false'
    questionText: string;
    questionTextCn?: string;
    imageUrl?: string;
    points?: number;
    explanation?: string;
    explanationCn?: string;
    explanationImageUrl?: string;
    answers?: AnswerData[];       // Cho single_choice, reading_item
    correctAnswer?: string;        // 'A','B','C','D' - cho single_choice
    passageText?: string;         // Đoạn văn đọc hiểu / điền từ
    passageImageUrl?: string;
    passageGroupType?: string;
    difficulty?: string;
    // Trường mới cho đề tiếng Trung
    linkedOptions?: LinkedOption[];   // Pool A-F cho fill_blank_pool
    correctAnswerKey?: string;        // 'A','B','C'... cho fill_blank_item
    subQuestionNumber?: number;       // Số câu con (34, 35, 36...)
}

export interface ImportedQuestionData extends QuestionData {
    itemType?: 'single_choice';
    needsImage?: boolean;
    imageHint?: string;
    reviewNotes?: string;
    aiReview?: ImportedQuestionAiReview;
    importIndex?: number;
}

export interface ImportedQuestionAiReview {
    path: string;
    label?: string;
    questionId?: number;
    questionNumber?: number;
    questionType?: string;
    parentQuestionId?: number;
    status: 'ok' | 'formula_issue' | 'answer_issue' | 'explanation_issue' | 'needs_review';
    confidence: number;
    suggestedCorrectAnswer?: string;
    formulaIssues?: string[];
    explanationIssues?: string[];
    note?: string;
}

export interface ImportedItemsReviewDiagnostic {
    batch: number;
    range?: string;
    paths?: string[];
    labels?: string[];
    model?: string;
    status: 'ok' | 'failed' | 'invalid_response' | string;
    durationMs?: number;
    returnedReviews?: number;
    expectedReviews?: number;
    message?: string;
    rawPreview?: string;
    errorCode?: string;
    retryAfter?: number;
    providerStatus?: number;
    providerCode?: string;
}

export interface ImportedReadingGroupData {
    itemType: 'reading_group';
    passageText: string;
    passageImageUrl?: string;
    subQuestions: ImportedQuestionData[];
    needsImage?: boolean;
    imageHint?: string;
    reviewNotes?: string;
    importIndex?: number;
}

export interface ImportedFillBlankGroupData {
    itemType: 'fill_blank_group';
    clozeMode: 'sentences' | 'passage';
    passageText: string;
    passageImageUrl?: string;
    linkedOptions: LinkedOption[];
    subItems: {
        questionText: string;
        questionTextCn?: string;
        points?: number;
        explanation?: string;
        explanationCn?: string;
        explanationImageUrl?: string;
        correctAnswerKey: string;
        difficulty?: string;
        subQuestionNumber?: number;
        reviewNotes?: string;
        aiReview?: ImportedQuestionAiReview;
    }[];
    needsImage?: boolean;
    imageHint?: string;
    reviewNotes?: string;
    importIndex?: number;
}

export type ImportedExamItem = ImportedQuestionData | ImportedReadingGroupData | ImportedFillBlankGroupData;

export interface PdfImportPreview {
    exam?: {
        title?: string;
        duration?: number;
        totalPoints?: number;
    };
    items: ImportedExamItem[];
    questions: ImportedQuestionData[];
    totalQuestionCount?: number;
    warnings?: string[];
    source?: {
        fileName?: string;
        pages?: number | null;
        textLength?: number;
        truncated?: boolean;
        importPreset?: PdfImportPreset;
        fileType?: 'pdf' | 'doc' | 'docx' | string;
    };
}

export interface NormalizeFormulaResult {
    message: string;
    examCount?: number;
    changedCount: number;
    warningCount: number;
    changes?: Array<{
        questionId?: number;
        answerId?: number;
        questionNumber?: number;
        answerKey?: string;
        field: string;
        before: string;
        after: string;
    }>;
    warnings?: Array<{
        questionId?: number;
        answerId?: number;
        questionNumber?: number;
        answerKey?: string;
        field: string;
        message: string;
        value?: string;
    }>;
    results?: any[];
}

export interface ImportedItemsReviewResult {
    items: ImportedExamItem[];
    reviews: ImportedQuestionAiReview[];
    diagnostics?: ImportedItemsReviewDiagnostic[];
    summary: {
        total: number;
        ok: number;
        issues: number;
        formula_issue?: number;
        answer_issue?: number;
        explanation_issue?: number;
        needs_review?: number;
        aiCalls?: number;
        failedBatches?: number;
        invalidBatches?: number;
        model?: string;
        questionTotal?: number;
        reviewedCount?: number;
    };
}

export interface StoredExamReviewResult {
    examId: number;
    exam?: {
        id: number;
        title?: string;
        subjectName?: string;
        subjectCode?: string;
    };
    reviews: ImportedQuestionAiReview[];
    diagnostics?: ImportedItemsReviewDiagnostic[];
    summary: ImportedItemsReviewResult['summary'];
    safeFixPreview?: NormalizeFormulaResult;
}

export interface ApplyExamReviewFixesResult {
    examId?: number;
    message: string;
    changedCount?: number;
    answerChangedCount?: number;
    formulaChangedCount?: number;
    warningCount?: number;
    skippedCount: number;
    items?: ImportedExamItem[];
    answerChanges?: Array<{
        questionId: number;
        questionNumber?: number;
        before?: string;
        after: string;
        confidence?: number;
    }>;
    changes?: Array<{
        path?: string;
        questionId?: number;
        questionNumber?: number;
        answerKey?: string;
        field: string;
        before?: string;
        after?: string;
    }>;
    skipped?: Array<{
        path?: string;
        questionId?: number;
        questionNumber?: number;
        suggestedAnswer?: string;
        confidence?: number;
        reason: string;
    }>;
    diagnostics?: ImportedItemsReviewDiagnostic[];
    summary?: ImportedItemsReviewResult['summary'] & {
        fixed?: number;
        changedCount?: number;
        skippedCount?: number;
    };
    formulaResult?: NormalizeFormulaResult | null;
}

export interface SingleQuestionImageOcrResult {
    text: string;
    source?: {
        fileName?: string;
        mimeType?: string;
        size?: number;
    };
}

// LinkedOption cho fill_blank_pool (A-F)
export interface LinkedOption {
    key: string;      // 'A', 'B', 'C', 'D', 'E', 'F'
    text: string;    // Tiếng Anh
    textCn: string;  // Tiếng Trung
}

// Question type enum
export type QuestionType =
    | 'single_choice'      // Trắc nghiệm A-B-C-D
    | 'fill_blank_pool'   // Điền từ đầu nhóm (có pool A-F)
    | 'fill_blank_item'   // Điền từ con trong nhóm
    | 'reading_passage'    // Đọc hiểu đầu đoạn
    | 'reading_item'       // Câu con đọc hiểu
    | 'true_false';        // Đúng/Sai

export interface AnswerData {
    text: string;
    textCn?: string;
    imageUrl?: string;
}

export const examAdminApi = {
    // Create exam
    createExam: async (data: ExamCreateData) => {
        const response = await axios.post('/admin/exams', data);
        return response.data;
    },

    // Update exam
    updateExam: async (examId: number, data: Partial<ExamCreateData>) => {
        const response = await axios.put(`/admin/exams/${examId}`, data);
        return response.data;
    },

    // Get exam with questions for editing
    getExamForEdit: async (examId: number) => {
        const response = await axios.get(`/admin/exams/${examId}/edit`);
        return response.data;
    },

    // Add question to exam (append to end)
    addQuestion: async (examId: number, data: QuestionData) => {
        const response = await axios.post(`/admin/exams/${examId}/questions`, data);
        return response.data;
    },

    // Preview questions from a text PDF before saving
    previewPdfImport: async (file: File, importPreset: PdfImportPreset = 'auto', signal?: AbortSignal): Promise<PdfImportPreview> => {
        const formData = new FormData();
        formData.append('pdf', file);
        formData.append('importPreset', importPreset);
        const response = await axios.post('/admin/exams/import/pdf/preview', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 300000,
            signal,
        });
        return normalizePdfImportPreviewMath(response.data);
    },

    reviewImportedItems: async (items: ImportedExamItem[], subject?: string): Promise<ImportedItemsReviewResult> => {
        const response = await axios.post('/admin/exams/import/pdf/review', {
            items,
            subject,
        }, {
            timeout: 300000,
        });
        return response.data;
    },

    applyImportedReviewFixes: async (
        items: ImportedExamItem[],
        reviews: ImportedQuestionAiReview[],
        subject?: string,
    ): Promise<ApplyExamReviewFixesResult> => {
        const response = await axios.post('/admin/exams/import/pdf/apply-review-fixes', {
            items,
            reviews,
            subject,
        }, {
            timeout: 300000,
        });
        return response.data;
    },

    // OCR one pasted/uploaded question image before parsing into the form
    ocrSingleQuestionImage: async (file: File): Promise<SingleQuestionImageOcrResult> => {
        const formData = new FormData();
        formData.append('image', file);
        const response = await axios.post('/admin/exams/import/image/ocr', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 150000,
        });
        return response.data;
    },

    // Save reviewed imported questions to an exam
    bulkImportQuestions: async (examId: number, items: ImportedExamItem[]) => {
        const response = await axios.post(`/admin/exams/${examId}/questions/bulk-import`, { items: normalizeImportedItemsMath(items) });
        return response.data;
    },

    // Insert question at specific position (shifts existing questions)
    insertQuestion: async (examId: number, questionData: QuestionData, afterQuestionId?: number, atPosition?: number) => {
        const response = await axios.post(`/admin/exams/${examId}/questions/insert`, {
            questionData,
            afterQuestionId,
            atPosition,
        });
        return response.data;
    },

    // Update question
    updateQuestion: async (questionId: number, data: QuestionData) => {
        const response = await axios.put(`/admin/exams/questions/${questionId}`, data);
        return response.data;
    },

    // Delete question
    deleteQuestion: async (questionId: number) => {
        const response = await axios.delete(`/admin/exams/questions/${questionId}`);
        return response.data;
    },

    // Get all exams
    getAllExams: async (page = 1, limit = 20, type?: 'phong-thi' | 'tu-do' | 'mo-phong' | 'delete-requests' | 'trash', subject?: string) => {
        const response = await axios.get('/admin/exams', {
            params: { page, limit, ...(type ? { type } : {}), ...(subject ? { subject } : {}) }
        });
        return response.data;
    },

    // Delete exam
    deleteExam: async (examId: number, reason?: string) => {
        const response = await axios.delete(`/admin/exams/${examId}`, { data: { reason } });
        return response.data;
    },

    restoreExam: async (examId: number) => {
        const response = await axios.post(`/admin/exams/${examId}/restore`);
        return response.data;
    },

    permanentDeleteExam: async (examId: number, reason?: string) => {
        const response = await axios.delete(`/admin/exams/${examId}/permanent`, { data: { reason } });
        return response.data;
    },

    approveDeleteRequest: async (examId: number, reason?: string) => {
        const response = await axios.post(`/admin/exams/${examId}/delete-request/approve`, { reason });
        return response.data;
    },

    rejectDeleteRequest: async (examId: number, reason?: string) => {
        const response = await axios.post(`/admin/exams/${examId}/delete-request/reject`, { reason });
        return response.data;
    },

    // Get exam counts by type
    getCounts: async () => {
        const response = await axios.get('/admin/exams/counts');
        return response.data;
    },

    // Get overall exam statistics
    getStats: async () => {
        const response = await axios.get('/admin/exams/stats');
        return response.data;
    },

    // Update exam status
    updateExamStatus: async (examId: number, status: 'draft' | 'published' | 'archived') => {
        const response = await axios.put(`/admin/exams/${examId}`, { status });
        return response.data;
    },

    normalizeExamFormulas: async (examId: number): Promise<NormalizeFormulaResult> => {
        const response = await axios.post(`/admin/exams/${examId}/normalize-formulas`);
        return response.data;
    },

    reviewExamQuality: async (examId: number): Promise<StoredExamReviewResult> => {
        const response = await axios.post(`/admin/exams/${examId}/review-quality`, {}, {
            timeout: 300000,
        });
        return response.data;
    },

    applyExamReviewFixes: async (
        examId: number,
        data: { reviews: ImportedQuestionAiReview[]; applySafeFormulas?: boolean; applySuggestedAnswers?: boolean },
    ): Promise<ApplyExamReviewFixesResult> => {
        const response = await axios.post(`/admin/exams/${examId}/apply-ai-review-fixes`, data, {
            timeout: 300000,
        });
        return response.data;
    },

    normalizeManyExamFormulas: async (data: { subject?: string; limit?: number } = {}): Promise<NormalizeFormulaResult> => {
        const response = await axios.post('/admin/exams/normalize-formulas', data);
        return response.data;
    },

    // Set exam schedule (start/end time for phong-thi)
    setSchedule: async (examId: number, data: { start_time: string; end_time?: string | null }) => {
        const response = await axios.put(`/admin/exams/${examId}/schedule`, data);
        return response.data;
    },

    // P2: Reorder questions
    reorderQuestions: async (examId: number, orderedIds: number[]) => {
        const response = await axios.put(`/admin/exams/${examId}/questions/reorder`, { orderedIds });
        return response.data;
    },

    // ── Fill blank group (pool + sub-items) ──────────────────────────────────
    insertFillBlankGroup: async (examId: number, data: any) => {
        const response = await axios.post(`/admin/exams/${examId}/fill-blank-group`, data);
        return response.data;
    },
    updateFillBlankGroup: async (examId: number, groupId: number, data: any) => {
        const response = await axios.put(`/admin/exams/${examId}/fill-blank-group/${groupId}`, data);
        return response.data;
    },
    deleteFillBlankGroup: async (examId: number, groupId: number) => {
        const response = await axios.delete(`/admin/exams/${examId}/fill-blank-group/${groupId}`);
        return response.data;
    },

    // ── Reading passage group (passage + sub-questions) ───────────────────────
    insertReadingPassageGroup: async (examId: number, data: any) => {
        const response = await axios.post(`/admin/exams/${examId}/reading-passage-group`, data);
        return response.data;
    },
    updateReadingPassageGroup: async (examId: number, groupId: number, data: any) => {
        const response = await axios.put(`/admin/exams/${examId}/reading-passage-group/${groupId}`, data);
        return response.data;
    },
    deleteReadingPassageGroup: async (examId: number, groupId: number) => {
        const response = await axios.delete(`/admin/exams/${examId}/reading-passage-group/${groupId}`);
        return response.data;
    },
};
