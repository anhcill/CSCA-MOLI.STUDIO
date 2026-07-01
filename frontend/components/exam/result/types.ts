export interface AnswerOption {
  key: string;
  text: string;
  text_cn?: string | null;
  text_en?: string | null;
  is_correct: boolean;
}

export interface QuestionResult {
  id?: number;
  question_id?: number;
  question_number: number;
  sub_question_number?: number;
  question_text: string;
  question_text_cn?: string;
  question_text_en?: string;
  question_type?: string;
  passage_text?: string;
  selected_answer_key: string | null;
  selected_answer_text: string;
  selected_answer_text_cn?: string | null;
  selected_answer_text_en?: string | null;
  correct_answer_key: string;
  correct_answer_text: string;
  correct_answer_text_cn?: string | null;
  correct_answer_text_en?: string | null;
  is_correct: boolean | null;
  points: number;
  score_awarded?: number | string | null;
  max_score?: number | string | null;
  grading_status?: string | null;
  grading_feedback?: string | null;
  grading_result?: any;
  explanation?: string;
  explanation_cn?: string;
  explanation_en?: string;
  explanation_image_url?: string;
  options: AnswerOption[];
  difficulty?: string;
  topic_name?: string;
  question_category?: string;
}

export type ReviewAIMode = 'explain' | 'theory';

export type QuestionReviewStatus = 'correct' | 'incorrect' | 'unanswered';

export interface ReviewAITask {
  question: QuestionResult;
  mode: ReviewAIMode;
}
