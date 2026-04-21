import axios from '../utils/axios';

export interface ExamCreateData {
    title: string;
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
    vip_tier?: string; // 'basic' | 'vip_thong_minh' | 'vip_pro'
}

export interface QuestionData {
    questionText: string;
    questionTextCn?: string;
    imageUrl?: string;
    points?: number;
    explanation?: string;
    explanationCn?: string;
    answers: AnswerData[];
    correctAnswer: string;
    passageText?: string;
    passageImageUrl?: string;
    questionGroupType?: string;
}

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

    // Add question to exam
    addQuestion: async (examId: number, data: QuestionData) => {
        const response = await axios.post(`/admin/exams/${examId}/questions`, data);
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
    }
};
