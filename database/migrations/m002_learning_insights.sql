-- ====================================
-- LEARNING INSIGHTS TABLES
-- Phân tích bài đã làm + lời khuyên cho học viên
-- ====================================

-- ====================================
-- TABLE: user_learning_insights
-- Lưu insight cá nhân hóa cho từng user
-- ====================================
CREATE TABLE IF NOT EXISTS user_learning_insights (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    insight_type VARCHAR(50) NOT NULL,
    -- insight_type values:
    -- 'weakness'        : điểm yếu theo chủ đề
    -- 'strength'        : điểm mạnh theo chủ đề
    -- 'trend'           : xu hướng điểm số (tăng/giảm)
    -- 'recommendation'  : gợi ý cá nhân hóa
    -- 'time_analysis'   : phân tích quản lý thời gian
    -- 'difficulty'      : phân tích theo độ khó

    category VARCHAR(100),
    -- 'topic'           : theo chủ đề
    -- 'difficulty'      : theo độ khó (easy/medium/hard)
    -- 'time'            : theo thời gian
    -- 'subject'         : theo môn học
    -- 'general'         : tổng quát

    priority INTEGER DEFAULT 0,
    -- 1-3: cao (hiển thị đầu tiên)
    -- 4-7: trung bình
    -- 8+: thấp

    title VARCHAR(255),
    content TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    -- Ví dụ cho weakness:
    -- {
    --   "topic_id": 5,
    --   "topic_name": "Hình học không gian",
    --   "error_rate": 0.67,
    --   "total_attempts": 15,
    --   "correct_count": 5,
    --   "advice": "Nên ôn lại công thức và luyện 10 câu..."
    -- }

    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================================
-- TABLE: user_learning_patterns
-- Lưu pattern học tập (trend, behavior)
-- ====================================
CREATE TABLE IF NOT EXISTS user_learning_patterns (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,

    metric_type VARCHAR(50) NOT NULL,
    -- 'score_trend'       : điểm TB theo thời gian
    -- 'topic_mastery'     : mức độ thành thạo theo chủ đề
    -- 'difficulty_mastery' : mức độ thành thạo theo độ khó
    -- 'time_distribution'  : phân bố thời gian làm bài
    -- 'study_frequency'    : tần suất học tập
    -- 'attempt_pattern'    : pattern về số lần thi

    data JSONB NOT NULL DEFAULT '{}',
    -- Ví dụ score_trend:
    -- {
    --   "trend": "improving",  -- 'improving', 'stable', 'declining'
    --   "change_percent": 12.5,
    --   "avg_first_3": 62.3,
    --   "avg_last_3": 74.8,
    --   "total_exams": 10
    -- }

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, metric_type)
);

-- ====================================
-- TABLE: user_study_plans
-- Lưu lịch học 7 ngày được tạo tự động
-- ====================================
CREATE TABLE IF NOT EXISTS user_study_plans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,

    plan_type VARCHAR(50) DEFAULT 'auto',
    -- 'auto'    : được tạo tự động sau khi thi
    -- 'manual'  : được tạo khi user yêu cầu

    title VARCHAR(255),
    description TEXT,
    data JSONB NOT NULL DEFAULT '[]',
    -- [
    --   {
    --     "day": 1,
    --     "date": "2026-04-22",
    --     "focus": "Hình học không gian",
    --     "tasks": ["Ôn công thức 30p", "Làm 15 câu", "Review sai lam"],
    --     "target_exams": ["MATH_005"],
    --     "is_completed": false
    --   },
    --   ...
    -- ]

    is_active BOOLEAN DEFAULT TRUE,
    starts_at DATE,
    ends_at DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================================
-- TABLE: user_recommended_exams
-- Lưu đề thi được gợi ý cho từng user
-- ====================================
CREATE TABLE IF NOT EXISTS user_recommended_exams (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE,

    reason VARCHAR(255),
    -- 'weak_topic'     : vì yếu chủ đề này
    -- 'difficulty_fit'  : phù hợp với level hiện tại
    -- 'improvement'     : để cải thiện sau khi thi gần đây
    -- 'spaced_learning': ôn lại sau 7 ngày

    priority INTEGER DEFAULT 0,
    is_viewed BOOLEAN DEFAULT FALSE,
    is_completed BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, exam_id)
);

-- ====================================
-- TABLE: daily_learning_summaries
-- Tổng kết ngày học (streak, stats)
-- ====================================
CREATE TABLE IF NOT EXISTS daily_learning_summaries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,

    date DATE NOT NULL,
    -- Tổng kết cho ngày nào

    exams_taken INTEGER DEFAULT 0,
    questions_answered INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    incorrect_answers INTEGER DEFAULT 0,
    time_spent_seconds INTEGER DEFAULT 0,

    -- Điểm trung bình ngày
    avg_score DECIMAL(5,2) DEFAULT 0,

    -- Chủ đề tập trung trong ngày
    focus_topics JSONB DEFAULT '[]',
    -- [{ "topic_id": 5, "topic_name": "...", "questions": 10 }]

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, date)
);

-- ====================================
-- INDEXES
-- ====================================
CREATE INDEX IF NOT EXISTS idx_insights_user_read ON user_learning_insights(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_insights_type ON user_learning_insights(user_id, insight_type);
CREATE INDEX IF NOT EXISTS idx_insights_priority ON user_learning_insights(priority ASC);

CREATE INDEX IF NOT EXISTS idx_patterns_user ON user_learning_patterns(user_id);

CREATE INDEX IF NOT EXISTS idx_study_plans_active ON user_study_plans(user_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_study_plans_dates ON user_study_plans(starts_at, ends_at);

CREATE INDEX IF NOT EXISTS idx_recommended_user ON user_recommended_exams(user_id, is_viewed, is_completed);
CREATE INDEX IF NOT EXISTS idx_recommended_priority ON user_recommended_exams(priority DESC);

CREATE INDEX IF NOT EXISTS idx_daily_user_date ON daily_learning_summaries(user_id, date DESC);

-- ====================================
-- TRIGGER: auto-update updated_at
-- ====================================
CREATE OR REPLACE FUNCTION update_insights_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_learning_insights_ts BEFORE UPDATE ON user_learning_insights
    FOR EACH ROW EXECUTE FUNCTION update_insights_updated_at();

CREATE TRIGGER update_user_learning_patterns_ts BEFORE UPDATE ON user_learning_patterns
    FOR EACH ROW EXECUTE FUNCTION update_insights_updated_at();

CREATE TRIGGER update_user_study_plans_ts BEFORE UPDATE ON user_study_plans
    FOR EACH ROW EXECUTE FUNCTION update_insights_updated_at();
