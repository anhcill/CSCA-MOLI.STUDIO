const pool = require("../config/database");
const Ticket = require("../models/Ticket");

/**
 * Run database optimizations - Add indexes for better performance
 * This will run automatically when the server starts
 */
async function runOptimizations() {
  const start = Date.now();
  try {
    // Ticket tables
    await Ticket.initTables();

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
      ALTER TABLE posts
      ADD COLUMN IF NOT EXISTS post_type VARCHAR(30) DEFAULT 'community',
      ADD COLUMN IF NOT EXISTS is_official BOOLEAN DEFAULT FALSE
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
      `CREATE INDEX IF NOT EXISTS idx_posts_type ON posts(post_type, created_at DESC)`,
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
      USING total_points::NUMERIC(6,2),
      ADD COLUMN IF NOT EXISTS start_time TIMESTAMP,
      ADD COLUMN IF NOT EXISTS end_time TIMESTAMP
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

    // Roadmap milestones managed by admin
    await pool.query(`
      CREATE TABLE IF NOT EXISTS roadmap_milestones (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        min_attempts INTEGER NOT NULL DEFAULT 0,
        min_avg_score NUMERIC(4,2) NOT NULL DEFAULT 0,
        icon VARCHAR(80) DEFAULT 'FiTarget',
        color VARCHAR(80) DEFAULT 'bg-indigo-500',
        sort_order INTEGER NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(sort_order)
      )
    `);
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_roadmap_milestones_active_order ON roadmap_milestones(is_active, sort_order)`,
    );
    await pool.query(`
      INSERT INTO roadmap_milestones (title, description, min_attempts, min_avg_score, icon, color, sort_order)
      VALUES
        ('Khởi đầu vững chắc', 'Hoàn thành bài đánh giá năng lực đầu vào.', 1, 0, 'FaFlagCheckered', 'bg-green-500', 1),
        ('Vượt chướng ngại vật', 'Ôn tập kiến thức nền tảng (Yêu cầu: giải 5 đề).', 5, 0, 'FaMountain', 'bg-blue-500', 2),
        ('Tăng tốc chạy lướt', 'Luyện đề vận dụng cao (Yêu cầu: giải 15 đề, điểm TB >= 6.0).', 15, 6.0, 'FaRunning', 'bg-orange-500', 3),
        ('Về đích huy hoàng', 'Thi thử áp lực phòng VIP (Yêu cầu: giải 30 đề, điểm TB >= 8.0).', 30, 8.0, 'FaTrophy', 'bg-purple-500', 4)
      ON CONFLICT (sort_order) DO UPDATE
      SET title = EXCLUDED.title,
          description = EXCLUDED.description,
          min_attempts = EXCLUDED.min_attempts,
          min_avg_score = EXCLUDED.min_avg_score,
          icon = EXCLUDED.icon,
          color = EXCLUDED.color,
          updated_at = CURRENT_TIMESTAMP
    `);

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

    // RBAC foundation (Day 3): roles, permissions, assignments
    await pool.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        is_system BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id SERIAL PRIMARY KEY,
        code VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(120) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (role_id, permission_id)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_roles (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, role_id)
      )
    `);
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_roles_code ON roles(code)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_permissions_code ON permissions(code)`,
    );

    await pool.query(`
      INSERT INTO permissions (code, name, description)
      VALUES
        ('admin.dashboard.view', 'Admin Dashboard View', 'Truy cập dashboard quản trị tổng quan'),
        ('system.manage', 'System Management', 'Toàn quyền quản trị hệ thống'),
        ('users.manage', 'User Management', 'Quản lý người dùng và vai trò'),
        ('forum.manage', 'Forum Moderation', 'Kiểm duyệt/xóa bài viết forum'),
        ('forum.post_as_admin', 'Forum Official Posting', 'Đăng bài chính thức dưới danh nghĩa admin'),
        ('roadmap.manage', 'Roadmap Management', 'Quản trị lộ trình học tập'),
        ('exams.manage', 'Exam Management', 'Quản lý đề thi và lịch thi phòng thi'),
        ('content.manage', 'Content Management', 'Quản lý tài liệu, từ vựng, media admin')
      ON CONFLICT (code) DO UPDATE
      SET name = EXCLUDED.name,
          description = EXCLUDED.description
    `);

    await pool.query(`
      INSERT INTO roles (code, name, description, is_system)
      VALUES
        ('super_admin', 'Super Admin', 'Quản trị viên tổng hệ thống', TRUE),
        ('user_admin', 'User Admin', 'Quản trị người dùng', TRUE),
        ('forum_admin', 'Forum Admin', 'Quản trị forum', TRUE),
        ('roadmap_admin', 'Roadmap Admin', 'Quản trị lộ trình', TRUE),
        ('exam_admin', 'Exam Admin', 'Quản trị đề thi và phòng thi', TRUE),
        ('content_admin', 'Content Admin', 'Quản trị nội dung', TRUE),
        ('student', 'Student', 'Người dùng học tập mặc định', TRUE)
      ON CONFLICT (code) DO UPDATE
      SET name = EXCLUDED.name,
          description = EXCLUDED.description,
          is_system = EXCLUDED.is_system,
          updated_at = CURRENT_TIMESTAMP
    `);

    const rolePermissions = {
      super_admin: [
        "admin.dashboard.view",
        "system.manage",
        "users.manage",
        "forum.manage",
        "forum.post_as_admin",
        "roadmap.manage",
        "exams.manage",
        "content.manage",
      ],
      user_admin: ["admin.dashboard.view", "users.manage"],
      forum_admin: ["admin.dashboard.view", "forum.manage", "forum.post_as_admin"],
      roadmap_admin: ["admin.dashboard.view", "roadmap.manage"],
      exam_admin: ["admin.dashboard.view", "exams.manage"],
      content_admin: ["admin.dashboard.view", "content.manage"],
      student: [],
    };

    for (const [roleCode, permissionCodes] of Object.entries(rolePermissions)) {
      if (permissionCodes.length === 0) continue;
      await pool.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         SELECT r.id, p.id
         FROM roles r
         JOIN permissions p ON p.code = ANY($2::text[])
         WHERE r.code = $1
         ON CONFLICT (role_id, permission_id) DO NOTHING`,
        [roleCode, permissionCodes],
      );
    }

    // Backfill: chỉ gán super_admin nếu user admin chưa có bất kỳ admin role nào khác
    await pool.query(`
      INSERT INTO user_roles (user_id, role_id, assigned_by)
      SELECT u.id, r.id, NULL
      FROM users u
      JOIN roles r ON r.code = CASE WHEN u.role = 'admin' THEN 'super_admin' ELSE 'student' END
      WHERE NOT EXISTS (
        SELECT 1 FROM user_roles ur2
        JOIN roles r2 ON r2.id = ur2.role_id
        WHERE ur2.user_id = u.id
          AND r2.code = ANY(ARRAY['super_admin','user_admin','exam_admin','content_admin','forum_admin','roadmap_admin'])
      )
      ON CONFLICT (user_id, role_id) DO NOTHING
    `);

    await pool.query(`
      CREATE OR REPLACE FUNCTION sync_legacy_user_role_to_rbac()
      RETURNS TRIGGER AS $$
      DECLARE
        mapped_role_id INTEGER;
        has_module_role BOOLEAN;
        module_role_codes TEXT[] := ARRAY['user_admin','exam_admin','content_admin','forum_admin','roadmap_admin'];
      BEGIN
        -- Kiểm tra user đã có module-specific admin role chưa
        SELECT EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN roles r ON r.id = ur.role_id
          WHERE ur.user_id = NEW.id AND r.code = ANY(module_role_codes)
        ) INTO has_module_role;

        IF NEW.role = 'admin' THEN
          IF NOT has_module_role THEN
            -- Chỉ gán super_admin nếu chưa có role module cụ thể
            SELECT id INTO mapped_role_id FROM roles WHERE code = 'super_admin';
            IF mapped_role_id IS NOT NULL THEN
              INSERT INTO user_roles (user_id, role_id, assigned_by)
              VALUES (NEW.id, mapped_role_id, NULL)
              ON CONFLICT (user_id, role_id) DO NOTHING;
            END IF;
          END IF;
          -- Xóa student role dù sao
          DELETE FROM user_roles
          WHERE user_id = NEW.id
            AND role_id IN (SELECT id FROM roles WHERE code = 'student');
        ELSE
          -- Downgrade về student: xóa hết admin roles
          SELECT id INTO mapped_role_id FROM roles WHERE code = 'student';
          IF mapped_role_id IS NOT NULL THEN
            INSERT INTO user_roles (user_id, role_id, assigned_by)
            VALUES (NEW.id, mapped_role_id, NULL)
            ON CONFLICT (user_id, role_id) DO NOTHING;
          END IF;
          DELETE FROM user_roles
          WHERE user_id = NEW.id
            AND role_id IN (
              SELECT id FROM roles
              WHERE code = ANY(ARRAY['super_admin'] || module_role_codes)
            );
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await pool.query(`DROP TRIGGER IF EXISTS trg_sync_legacy_user_role_to_rbac ON users`);
    await pool.query(`
      CREATE TRIGGER trg_sync_legacy_user_role_to_rbac
      AFTER INSERT OR UPDATE OF role ON users
      FOR EACH ROW
      EXECUTE FUNCTION sync_legacy_user_role_to_rbac()
    `);

    // ── VIP / Subscription ────────────────────────────────────────────────────
    // Thêm cột is_vip và vip_expires_at vào users (nếu chưa có)
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS vip_expires_at TIMESTAMPTZ
    `);
    // Tạo function tự động reset VIP khi hết hạn (chạy qua trigger mỗi login)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_vip ON users(is_vip) WHERE is_vip = TRUE
    `);

    // Bảng transactions (giao dịch thanh toán)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id              SERIAL PRIMARY KEY,
        user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount          BIGINT NOT NULL,
        payment_method  VARCHAR(30) DEFAULT 'momo',
        package_duration INTEGER NOT NULL,
        package_name    VARCHAR(100),
        transaction_code VARCHAR(255) UNIQUE,
        status          VARCHAR(20) DEFAULT 'pending',
        payment_channel VARCHAR(50),
        trans_id        VARCHAR(100),
        raw_response    JSONB,
        paid_at         TIMESTAMP,
        vip_expires_at  TIMESTAMP,
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Thêm cột mới nếu bảng đã tồn tại (cho môi trường dev đang chạy)
    await pool.query(`
      ALTER TABLE transactions
      ADD COLUMN IF NOT EXISTS package_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS payment_channel VARCHAR(50),
      ADD COLUMN IF NOT EXISTS trans_id VARCHAR(100),
      ADD COLUMN IF NOT EXISTS raw_response JSONB,
      ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS vip_expires_at TIMESTAMP
    `);
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id, created_at DESC)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_transactions_code ON transactions(transaction_code)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status)`,
    );

    // Exam schedule audit log (Ngày 11-12)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS exam_schedule_logs (
        id            SERIAL PRIMARY KEY,
        exam_id       INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
        changed_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
        changed_by_name VARCHAR(120),
        old_start_time TIMESTAMP,
        old_end_time   TIMESTAMP,
        new_start_time TIMESTAMP,
        new_end_time   TIMESTAMP,
        reason        TEXT,
        changed_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_exam_schedule_logs_exam ON exam_schedule_logs(exam_id, changed_at DESC)`,
    );

    // Ngày 14: allow_download cho đề thi + subscription_tier cho users
    await pool.query(`
      ALTER TABLE exams
      ADD COLUMN IF NOT EXISTS allow_download BOOLEAN DEFAULT FALSE
    `);
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(20) DEFAULT 'basic',
      ADD COLUMN IF NOT EXISTS full_name_edit VARCHAR(255)
    `);
    // Sync full_name_edit từ full_name cho users hiện tại
    await pool.query(`
      UPDATE users SET subscription_tier = 'vip' WHERE is_vip = TRUE AND vip_expires_at > NOW()
    `);

    // Add user_agent column to user_activities if missing
    await pool.query(`
      ALTER TABLE user_activities
      ADD COLUMN IF NOT EXISTS user_agent TEXT
    `);

    // ── Device Session Management ──────────────────────────────────────────────
    // Track active sessions per device for VIP/Premium device limits
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id            SERIAL PRIMARY KEY,
        user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        jti           VARCHAR(64) UNIQUE NOT NULL,
        device_info   VARCHAR(500),
        ip_address    VARCHAR(45),
        user_agent    TEXT,
        last_active   TIMESTAMPTZ DEFAULT NOW(),
        expires_at    TIMESTAMPTZ NOT NULL,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id, last_active DESC)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_user_sessions_jti ON user_sessions(jti)`,
    );

    // Subscription tier device limits
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS max_devices INTEGER DEFAULT 1
    `);

    // Video giải đề chi tiết (Premium feature)
    await pool.query(`
      ALTER TABLE exams
      ADD COLUMN IF NOT EXISTS solution_video_url TEXT,
      ADD COLUMN IF NOT EXISTS solution_description TEXT,
      ADD COLUMN IF NOT EXISTS shuffle_mode BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS vip_tier VARCHAR(20) DEFAULT 'basic'
    `);

    // VIP tier for materials
    await pool.query(`
      ALTER TABLE materials
      ADD COLUMN IF NOT EXISTS vip_tier VARCHAR(20) DEFAULT 'basic'
    `);

    // VIP packages management
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vip_packages (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        duration_days INTEGER NOT NULL,
        price INTEGER NOT NULL DEFAULT 0,
        description TEXT,
        features TEXT[] DEFAULT '{}',
        is_active BOOLEAN DEFAULT TRUE,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Seed default VIP packages if none exist
    const pkgCount = await pool.query('SELECT COUNT(*)::int FROM vip_packages');
    if (pkgCount.rows[0].count === 0) {
      await pool.query(`
        INSERT INTO vip_packages (name, duration_days, price, description, features, sort_order) VALUES
        ('Gói Xem', 30, 199000, 'Truy cập nội dung lý thuyết và tài liệu VIP trong 30 ngày', ARRAY['Truy cập tài liệu VIP', 'Xem giải đề chi tiết', 'Hỗ trợ ưu tiên'], 1),
        ('Gói Kiểm tra', 180, 499000, 'Truy cập đầy đủ trong 6 tháng - tiết kiệm 56%', ARRAY['Truy cập đề thi premium', 'Giải đề chi tiết', 'Phân tích kết quả nâng cao', 'Hỗ trợ 24/7'], 2),
        ('Gói Làm bài', 365, 799000, 'Gói năm - truy cập toàn diện trong 12 tháng', ARRAY['Tất cả tính năng VIP', 'Thống kê học tập', 'Lộ trình cá nhân hóa', 'Hỗ trợ ưu tiên'], 3)
      `);
    }

    console.log(
      `✅ Database ready (migrations + indexes + analyze in ${Date.now() - start}ms)`,
    );
  } catch (error) {
    console.error("❌ Database optimization error:", error.message);
  }
}

module.exports = { runOptimizations };
