-- ====================================
-- CSCA DATABASE SCHEMA
-- Website Luyện Thi Đầu Vào Học Bổng Trung Quốc
-- ====================================

-- Drop existing tables if they exist
DROP TABLE IF EXISTS user_exam_attempts CASCADE;
DROP TABLE IF EXISTS user_stats CASCADE;
DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS exams CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS post_likes CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS materials CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ====================================
-- TABLE: users
-- ====================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL, -- hashed password
    full_name VARCHAR(100),
    avatar VARCHAR(500) DEFAULT 'https://ui-avatars.com/api/?name=User',
    role VARCHAR(20) DEFAULT 'student', -- student, teacher, admin
    bio TEXT,
    phone VARCHAR(20),
    study_goal TEXT,
    target_score INTEGER,
    is_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    is_vip BOOLEAN DEFAULT false,
    vip_expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================================
-- TABLE: posts (Forum/Feed)
-- ====================================
CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(50) NOT NULL, -- Toán, Vật Lí, Hóa Học, Tiếng Trung, Thắc mắc
    subject VARCHAR(50), -- Optional: chi tiết hơn category
    tags TEXT[], -- Array of tags
    image_url VARCHAR(500),
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    is_pinned BOOLEAN DEFAULT false,
    is_published BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================================
-- TABLE: post_likes
-- ====================================
CREATE TABLE post_likes (
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, user_id)
);

-- ====================================
-- TABLE: comments
-- ====================================
CREATE TABLE comments (
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE, -- For nested comments
    content TEXT NOT NULL,
    likes_count INTEGER DEFAULT 0,
    is_edited BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================================
-- TABLE: exams (Đề thi)
-- ====================================
CREATE TABLE exams (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL, -- Đề 015, Đề 014, etc.
    description TEXT,
    subject VARCHAR(100) NOT NULL, -- Toán, Vật Lí, Hóa Học, Tiếng Trung Xã Hội, Tiếng Trung Tự Nhiên
    exam_type VARCHAR(50) DEFAULT 'mock', -- mock, practice, official
    exam_date DATE, -- Ngày thi
    duration INTEGER NOT NULL, -- Thời gian làm bài (phút)
    total_questions INTEGER NOT NULL,
    total_points INTEGER DEFAULT 100,
    difficulty_level VARCHAR(20) DEFAULT 'medium', -- easy, medium, hard
    instructions TEXT,
    is_published BOOLEAN DEFAULT true,
    is_premium BOOLEAN DEFAULT false,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================================
-- TABLE: questions (Câu hỏi)
-- ====================================
CREATE TABLE questions (
    id SERIAL PRIMARY KEY,
    exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE,
    question_number INTEGER NOT NULL, -- Số thứ tự câu hỏi
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) DEFAULT 'multiple_choice', -- multiple_choice, true_false, essay
    question_category VARCHAR(100), -- Hình học, Đại số, Cơ học, etc.
    options JSONB, -- Array of options: [{key: 'A', text: '...'}, {key: 'B', text: '...'}]
    correct_answer VARCHAR(10) NOT NULL, -- A, B, C, D or multiple answers
    explanation TEXT, -- Giải thích đáp án
    points INTEGER DEFAULT 1,
    difficulty VARCHAR(20) DEFAULT 'medium',
    image_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================================
-- TABLE: user_exam_attempts (Lượt thi)
-- ====================================
CREATE TABLE user_exam_attempts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE,
    score DECIMAL(5,2) NOT NULL, -- Điểm số
    total_correct INTEGER DEFAULT 0,
    total_wrong INTEGER DEFAULT 0,
    total_skipped INTEGER DEFAULT 0,
    answers JSONB NOT NULL, -- [{question_id: 1, user_answer: 'A', is_correct: true, time_spent: 30}]
    time_taken INTEGER, -- Thời gian làm bài thực tế (giây)
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    is_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================================
-- TABLE: user_stats (Thống kê)
-- ====================================
CREATE TABLE user_stats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    total_exams_taken INTEGER DEFAULT 0,
    total_exams_completed INTEGER DEFAULT 0,
    average_score DECIMAL(5,2) DEFAULT 0,
    highest_score DECIMAL(5,2) DEFAULT 0,
    lowest_score DECIMAL(5,2) DEFAULT 0,
    total_time_spent INTEGER DEFAULT 0, -- Tổng thời gian học (giây)
    current_streak INTEGER DEFAULT 0, -- Số ngày học liên tiếp
    longest_streak INTEGER DEFAULT 0,
    weak_topics JSONB, -- [{topic: 'Hình học không gian', error_rate: 0.34}]
    strong_topics JSONB,
    subject_scores JSONB, -- {Toán: 85, 'Vật Lí': 90, ...}
    last_active_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================================
-- TABLE: materials (Tài liệu học tập)
-- ====================================
CREATE TABLE materials (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content TEXT,
    category VARCHAR(100) NOT NULL, -- Cấu trúc đề, Lí thuyết, Từ vựng, Đề mô phỏng
    subject VARCHAR(100), -- Toán, Vật Lí, Hóa, Tiếng Trung
    file_url VARCHAR(500),
    file_type VARCHAR(50), -- pdf, video, text
    thumbnail_url VARCHAR(500),
    view_count INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    is_premium BOOLEAN DEFAULT false,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================================
-- INDEXES for Performance
-- ====================================
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_category ON posts(category);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);

CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);

CREATE INDEX idx_questions_exam_id ON questions(exam_id);
CREATE INDEX idx_questions_category ON questions(question_category);

CREATE INDEX idx_attempts_user_id ON user_exam_attempts(user_id);
CREATE INDEX idx_attempts_exam_id ON user_exam_attempts(exam_id);
CREATE INDEX idx_attempts_completed ON user_exam_attempts(is_completed);

CREATE INDEX idx_exams_subject ON exams(subject);
CREATE INDEX idx_exams_date ON exams(exam_date DESC);

CREATE INDEX idx_materials_category ON materials(category);
CREATE INDEX idx_materials_subject ON materials(subject);

-- ====================================
-- TRIGGERS for auto-update timestamps
-- ====================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exams_updated_at BEFORE UPDATE ON exams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ====================================
-- TRIGGER for auto-increment comments_count
-- ====================================
CREATE OR REPLACE FUNCTION increment_post_comments()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_comments AFTER INSERT ON comments
    FOR EACH ROW EXECUTE FUNCTION increment_post_comments();

CREATE OR REPLACE FUNCTION decrement_post_comments()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE posts SET comments_count = comments_count - 1 WHERE id = OLD.post_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_decrement_comments AFTER DELETE ON comments
    FOR EACH ROW EXECUTE FUNCTION decrement_post_comments();

-- ====================================
-- TRIGGER for auto-increment likes_count
-- ====================================
CREATE OR REPLACE FUNCTION increment_post_likes()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_likes AFTER INSERT ON post_likes
    FOR EACH ROW EXECUTE FUNCTION increment_post_likes();

CREATE OR REPLACE FUNCTION decrement_post_likes()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE posts SET likes_count = likes_count - 1 WHERE id = OLD.post_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_decrement_likes AFTER DELETE ON post_likes
    FOR EACH ROW EXECUTE FUNCTION decrement_post_likes();

-- ====================================
-- END OF SCHEMA
-- ====================================

-- ====================================
-- TABLE: transactions (Lịch sử giao dịch)
-- ====================================
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    amount INTEGER NOT NULL,
    payment_method VARCHAR(50), -- 'bank_transfer', 'momo', 'vnpay'
    package_duration INTEGER, -- Số ngày của gói (VD: 30, 90, 365)
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'cancelled'
    transaction_code VARCHAR(100) UNIQUE, -- Mã giao dịch hiển thị (ví dụ: CSCA12345)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

