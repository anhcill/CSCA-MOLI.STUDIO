export interface VocabularyItem {
  id: number;
  word_cn: string;
  pinyin: string;
  word_vn: string;
  word_en?: string;
  subject: string;
  topic: string;
  example_cn?: string;
  example_vn?: string;
  is_premium?: boolean;
  vip_tier?: string;
}

export interface VocabularyReviewCard extends VocabularyItem {
  easiness?: number;
  interval_days?: number;
  repetitions?: number;
  lapses?: number;
  last_quality?: number;
  due_at?: string;
  correct_count?: number;
  wrong_count?: number;
  review_state: 'new' | 'due' | 'scheduled';
}

export interface VocabularyReviewSummary {
  total_words: number;
  started_words: number;
  due_now: number;
  due_today: number;
  mastered_words: number;
  weak_words: number;
  new_words: number;
}

export interface VocabularyTopicReviewStats {
  subject: string;
  topic: string;
  total_words: number;
  started_words: number;
  due_now: number;
  mastered_words: number;
  weak_words: number;
}

export interface VocabularyReviewDashboard {
  summary: VocabularyReviewSummary;
  topics: VocabularyTopicReviewStats[];
}

export interface MiniTestQuestion {
  vocabulary_id: number;
  word_cn: string;
  pinyin: string;
  subject: string;
  topic: string;
  choices: string[];
}

export interface MiniTestResultItem {
  vocabulary_id: number;
  word_cn: string;
  pinyin: string;
  selected: string;
  correct_answer: string;
  correct: boolean;
}

export interface MiniTestResult {
  score: number;
  total: number;
  results: MiniTestResultItem[];
}

export interface AdminVocabularyReviewStats {
  summary: {
    active_learners: number;
    tracked_words: number;
    total_reviews: number;
    due_now: number;
    weak_reviews: number;
    mastered_reviews: number;
  };
  topics: Array<{
    subject: string;
    topic: string;
    learners: number;
    tracked_words: number;
    due_now: number;
    weak_words: number;
    mastered_words: number;
  }>;
}

