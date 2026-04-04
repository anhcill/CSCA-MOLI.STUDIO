const pool = require("../config/database");

/**
 * Run database optimizations - Add indexes for better performance
 * This will run automatically when the server starts
 */
async function runOptimizations() {
  const start = Date.now();
  try {
    // Forum tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        image_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS post_likes (
        id SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(post_id, user_id)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS post_comments (
        id SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Indexes
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam_user ON exam_attempts(exam_id, user_id, status)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_exam_attempts_score ON exam_attempts(exam_id, user_id, total_score) WHERE status = 'completed'`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_questions_exam_id ON questions(exam_id)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_subjects_code ON subjects(code)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_exams_subject_status ON exams(subject_id, status, publish_date DESC)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_answers_question_id ON answers(question_id, answer_key)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_user_answers_attempt_id ON user_answers(attempt_id)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_user_answers_question_id ON user_answers(question_id)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_vocab_subject_topic ON vocabulary_items(subject, topic) WHERE is_active = TRUE`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_vocab_search ON vocabulary_items(word_cn, pinyin, word_vn) WHERE is_active = TRUE`,
    );

    // Allow decimal scoring for exam setup and per-question points.
    await pool.query(`
      ALTER TABLE exams
      ALTER COLUMN total_points TYPE NUMERIC(6,2)
      USING total_points::NUMERIC(6,2)
    `);
    await pool.query(`
      ALTER TABLE questions
      ALTER COLUMN points TYPE NUMERIC(6,2)
      USING points::NUMERIC(6,2)
    `);

    // Analyze tables
    const tables = [
      "exams",
      "exam_attempts",
      "questions",
      "answers",
      "subjects",
      "posts",
      "post_likes",
      "post_comments",
      "user_answers",
    ];
    await Promise.all(tables.map((t) => pool.query(`ANALYZE ${t}`)));

    // Google OAuth columns
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE,
      ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(20) DEFAULT 'local',
      ADD COLUMN IF NOT EXISTS avatar_url TEXT,
      ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE
    `);
    await pool.query(`ALTER TABLE users ALTER COLUMN password DROP NOT NULL`);
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)`,
    );
    await pool.query(
      `UPDATE users SET oauth_provider = 'local' WHERE oauth_provider IS NULL`,
    );

    // Password reset columns (moved from authController IIFE)
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(64),
      ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMPTZ
    `);

    // Email verification columns (S11)
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS email_verify_token VARCHAR(64),
      ADD COLUMN IF NOT EXISTS email_verify_expires TIMESTAMPTZ
    `);

    // Materials table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS materials (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        file_url TEXT NOT NULL,
        file_type VARCHAR(20) DEFAULT 'pdf',
        category VARCHAR(50) NOT NULL,
        subject VARCHAR(100),
        uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_materials_subject ON materials(subject)`,
    );

    // AI Insights table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_insights (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        insight_type VARCHAR(50) NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_ai_insights_user ON ai_insights(user_id, created_at DESC)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_ai_insights_type ON ai_insights(insight_type)`,
    );

    // JWT Token Blacklist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS token_blacklist (
        id          SERIAL PRIMARY KEY,
        token_jti   VARCHAR(255) UNIQUE NOT NULL,
        user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
        expires_at  TIMESTAMP NOT NULL,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_token_blacklist_jti ON token_blacklist(token_jti)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON token_blacklist(expires_at)`,
    );

    // Notifications
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id           SERIAL PRIMARY KEY,
        recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        actor_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
        type         VARCHAR(30) NOT NULL,
        post_id      INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        comment_id   INTEGER,
        is_read      BOOLEAN DEFAULT false,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, is_read, created_at DESC)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_notifications_post ON notifications(post_id)`,
    );

    console.log(
      `✅ Database ready (migrations + indexes + analyze in ${Date.now() - start}ms)`,
    );
  } catch (error) {
    console.error("❌ Database optimization error:", error.message);
  }
}

module.exports = { runOptimizations };
