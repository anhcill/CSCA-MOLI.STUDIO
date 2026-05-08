import axios from '../utils/axios';

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
    getAllExams: async (page = 1, limit = 20, type?: 'phong-thi' | 'tu-do' | 'mo-phong') => {
        const response = await axios.get('/admin/exams', {
            params: { page, limit, ...(type ? { type } : {}) }
        });
        return response.data;
    },

    // Delete exam
    deleteExam: async (examId: number) => {
        const response = await axios.delete(`/admin/exams/${examId}`);
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

    // Set exam schedule (start/end time for phong-thi)
    setSchedule: async (examId: number, data: { start_time: string; end_time?: string | null }) => {
        const response = await axios.put(`/admin/exams/${examId}/schedule`, data);
        return response.data;
    },

    // P2: Reorder questions
    reorderQuestions: async (examId: number, orderedIds: number[]) => {
        const response = await axios.put(`/admin/exams/${examId}/questions/reorder`, { orderedIds });
        return response.data;
    }
};
