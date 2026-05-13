-- Sync tables that exist on Railway but were missing from local SQL files.
-- Generated from information_schema. Review before running on production.

CREATE TABLE IF NOT EXISTS "ai_insights" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "insight_type" VARCHAR(50) NOT NULL,
  "data" JSONB NOT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "attempt_id" INTEGER,
  CONSTRAINT "ai_insights_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "answers" (
  "id" SERIAL NOT NULL,
  "question_id" INTEGER,
  "answer_key" CHAR(1) NOT NULL,
  "answer_text" TEXT NOT NULL,
  "answer_text_cn" TEXT,
  "answer_text_en" TEXT,
  "is_correct" BOOLEAN DEFAULT false,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "image_url" VARCHAR(500),
  CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "comment_likes" (
  "id" SERIAL NOT NULL,
  "comment_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "comment_likes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "comment_likes_comment_id_user_id_key" UNIQUE ("comment_id", "user_id")
);

CREATE TABLE IF NOT EXISTS "exam_attempts" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER,
  "exam_id" INTEGER,
  "attempt_number" INTEGER DEFAULT 1,
  "start_time" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "end_time" TIMESTAMP,
  "submit_time" TIMESTAMP,
  "duration_seconds" INTEGER,
  "total_score" NUMERIC(5,2),
  "total_correct" INTEGER,
  "total_incorrect" INTEGER,
  "total_unanswered" INTEGER,
  "status" VARCHAR(20) DEFAULT 'in_progress'::character varying,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "started_at" TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT "exam_attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exam_attempts_user_id_exam_id_attempt_number_key" UNIQUE ("user_id", "exam_id", "attempt_number")
);

CREATE TABLE IF NOT EXISTS "forum_blocks" (
  "id" SERIAL NOT NULL,
  "blocker_id" INTEGER NOT NULL,
  "blocked_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP DEFAULT now(),
  CONSTRAINT "forum_blocks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "forum_blocks_blocker_id_blocked_id_key" UNIQUE ("blocker_id", "blocked_id")
);

CREATE TABLE IF NOT EXISTS "forum_messages" (
  "id" SERIAL NOT NULL,
  "sender_id" INTEGER NOT NULL,
  "receiver_id" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "is_read" BOOLEAN DEFAULT false,
  "created_at" TIMESTAMP DEFAULT now(),
  "reply_to_id" INTEGER,
  "is_deleted" BOOLEAN DEFAULT false,
  "deleted_at" TIMESTAMP,
  CONSTRAINT "forum_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "forum_reports" (
  "id" SERIAL NOT NULL,
  "reporter_id" INTEGER NOT NULL,
  "reported_user_id" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "status" VARCHAR(20) DEFAULT 'pending'::character varying,
  "resolved_by" INTEGER,
  "resolved_at" TIMESTAMP,
  "created_at" TIMESTAMP DEFAULT now(),
  CONSTRAINT "forum_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "post_comments" (
  "id" SERIAL NOT NULL,
  "post_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "parent_id" INTEGER,
  "reply_to_user_id" INTEGER,
  CONSTRAINT "post_comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "question_topic_mapping" (
  "question_id" INTEGER NOT NULL,
  "topic_id" INTEGER NOT NULL,
  CONSTRAINT "question_topic_mapping_pkey" PRIMARY KEY ("question_id", "topic_id")
);

CREATE TABLE IF NOT EXISTS "question_topics" (
  "id" SERIAL NOT NULL,
  "subject_id" INTEGER,
  "name" VARCHAR(200) NOT NULL,
  "name_cn" VARCHAR(200),
  "description" TEXT,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "question_topics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "site_settings" (
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "updated_at" TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT "site_settings_pkey" PRIMARY KEY ("key")
);

CREATE TABLE IF NOT EXISTS "subjects" (
  "id" SERIAL NOT NULL,
  "code" VARCHAR(50) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "name_cn" VARCHAR(100),
  "description" TEXT,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "slug" VARCHAR(100) NOT NULL,
  CONSTRAINT "subjects_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "subjects_code_key" UNIQUE ("code"),
  CONSTRAINT "subjects_slug_key" UNIQUE ("slug")
);

CREATE TABLE IF NOT EXISTS "support_replies" (
  "id" SERIAL NOT NULL,
  "ticket_id" INTEGER,
  "sender_id" INTEGER,
  "is_admin_reply" BOOLEAN DEFAULT false,
  "content" TEXT NOT NULL,
  "image_url" VARCHAR(255),
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_replies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "support_tickets" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER,
  "category" VARCHAR(50) DEFAULT 'general'::character varying,
  "reference_url" VARCHAR(255),
  "content" TEXT NOT NULL,
  "image_url" VARCHAR(255),
  "status" VARCHAR(50) DEFAULT 'pending'::character varying,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "user_answers" (
  "id" SERIAL NOT NULL,
  "attempt_id" INTEGER,
  "question_id" INTEGER,
  "selected_answer_id" INTEGER,
  "selected_answer_key" CHAR(1),
  "is_correct" BOOLEAN,
  "time_spent_seconds" INTEGER,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "essay_answer" TEXT,
  CONSTRAINT "user_answers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_answers_attempt_id_question_id_key" UNIQUE ("attempt_id", "question_id")
);

CREATE TABLE IF NOT EXISTS "user_quests" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "quest_type" VARCHAR(50) NOT NULL,
  "target" INTEGER DEFAULT 1 NOT NULL,
  "progress" INTEGER DEFAULT 0 NOT NULL,
  "is_completed" BOOLEAN DEFAULT false,
  "reward_coins" INTEGER DEFAULT 10,
  "date" DATE DEFAULT CURRENT_DATE,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_quests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_quests_user_id_quest_type_date_key" UNIQUE ("user_id", "quest_type", "date")
);

CREATE TABLE IF NOT EXISTS "user_topic_stats" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER,
  "subject_id" INTEGER,
  "topic_id" INTEGER,
  "total_questions" INTEGER DEFAULT 0,
  "correct_answers" INTEGER DEFAULT 0,
  "incorrect_answers" INTEGER DEFAULT 0,
  "error_percentage" NUMERIC(5,2),
  "last_updated" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_topic_stats_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_topic_stats_user_id_subject_id_topic_id_key" UNIQUE ("user_id", "subject_id", "topic_id")
);

CREATE TABLE IF NOT EXISTS "vocabulary_items" (
  "id" SERIAL NOT NULL,
  "word_cn" VARCHAR(100) NOT NULL,
  "pinyin" VARCHAR(200) NOT NULL,
  "word_vn" VARCHAR(255) NOT NULL,
  "word_en" VARCHAR(255),
  "subject" VARCHAR(100) NOT NULL,
  "topic" VARCHAR(100) NOT NULL,
  "example_cn" TEXT,
  "example_vn" TEXT,
  "is_active" BOOLEAN DEFAULT true,
  "created_by" INTEGER,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "is_premium" BOOLEAN DEFAULT false,
  "vip_tier" VARCHAR(20) DEFAULT 'basic'::character varying,
  CONSTRAINT "vocabulary_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "vocabulary_items_word_cn_subject_key" UNIQUE ("word_cn", "subject")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_insights_user_id_fkey') THEN
    ALTER TABLE "ai_insights" ADD CONSTRAINT "ai_insights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'answers_question_id_fkey') THEN
    ALTER TABLE "answers" ADD CONSTRAINT "answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comment_likes_comment_id_fkey') THEN
    ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "post_comments"("id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comment_likes_user_id_fkey') THEN
    ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exam_attempts_exam_id_fkey') THEN
    ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exam_attempts_user_id_fkey') THEN
    ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'forum_blocks_blocked_id_fkey') THEN
    ALTER TABLE "forum_blocks" ADD CONSTRAINT "forum_blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'forum_blocks_blocker_id_fkey') THEN
    ALTER TABLE "forum_blocks" ADD CONSTRAINT "forum_blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'forum_messages_receiver_id_fkey') THEN
    ALTER TABLE "forum_messages" ADD CONSTRAINT "forum_messages_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'forum_messages_reply_to_id_fkey') THEN
    ALTER TABLE "forum_messages" ADD CONSTRAINT "forum_messages_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "forum_messages"("id") ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'forum_messages_sender_id_fkey') THEN
    ALTER TABLE "forum_messages" ADD CONSTRAINT "forum_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'forum_reports_reported_user_id_fkey') THEN
    ALTER TABLE "forum_reports" ADD CONSTRAINT "forum_reports_reported_user_id_fkey" FOREIGN KEY ("reported_user_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'forum_reports_reporter_id_fkey') THEN
    ALTER TABLE "forum_reports" ADD CONSTRAINT "forum_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'forum_reports_resolved_by_fkey') THEN
    ALTER TABLE "forum_reports" ADD CONSTRAINT "forum_reports_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'post_comments_parent_id_fkey') THEN
    ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "post_comments"("id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'post_comments_post_id_fkey') THEN
    ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'post_comments_reply_to_user_id_fkey') THEN
    ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_reply_to_user_id_fkey" FOREIGN KEY ("reply_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'post_comments_user_id_fkey') THEN
    ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'question_topic_mapping_question_id_fkey') THEN
    ALTER TABLE "question_topic_mapping" ADD CONSTRAINT "question_topic_mapping_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'question_topic_mapping_topic_id_fkey') THEN
    ALTER TABLE "question_topic_mapping" ADD CONSTRAINT "question_topic_mapping_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "question_topics"("id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'question_topics_subject_id_fkey') THEN
    ALTER TABLE "question_topics" ADD CONSTRAINT "question_topics_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_replies_sender_id_fkey') THEN
    ALTER TABLE "support_replies" ADD CONSTRAINT "support_replies_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_replies_ticket_id_fkey') THEN
    ALTER TABLE "support_replies" ADD CONSTRAINT "support_replies_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_tickets_user_id_fkey') THEN
    ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_answers_attempt_id_fkey') THEN
    ALTER TABLE "user_answers" ADD CONSTRAINT "user_answers_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_answers_question_id_fkey') THEN
    ALTER TABLE "user_answers" ADD CONSTRAINT "user_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_answers_selected_answer_id_fkey') THEN
    ALTER TABLE "user_answers" ADD CONSTRAINT "user_answers_selected_answer_id_fkey" FOREIGN KEY ("selected_answer_id") REFERENCES "answers"("id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_quests_user_id_fkey') THEN
    ALTER TABLE "user_quests" ADD CONSTRAINT "user_quests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_topic_stats_subject_id_fkey') THEN
    ALTER TABLE "user_topic_stats" ADD CONSTRAINT "user_topic_stats_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_topic_stats_topic_id_fkey') THEN
    ALTER TABLE "user_topic_stats" ADD CONSTRAINT "user_topic_stats_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "question_topics"("id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_topic_stats_user_id_fkey') THEN
    ALTER TABLE "user_topic_stats" ADD CONSTRAINT "user_topic_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vocabulary_items_created_by_fkey') THEN
    ALTER TABLE "vocabulary_items" ADD CONSTRAINT "vocabulary_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ai_insights_attempt ON public.ai_insights USING btree (attempt_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_type ON public.ai_insights USING btree (insight_type);
CREATE INDEX IF NOT EXISTS idx_ai_insights_user ON public.ai_insights USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_answers_question ON public.answers USING btree (question_id);
CREATE INDEX IF NOT EXISTS idx_answers_question_id ON public.answers USING btree (question_id, answer_key);
CREATE UNIQUE INDEX IF NOT EXISTS comment_likes_comment_id_user_id_key ON public.comment_likes USING btree (comment_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS exam_attempts_user_id_exam_id_attempt_number_key ON public.exam_attempts USING btree (user_id, exam_id, attempt_number);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam ON public.exam_attempts USING btree (exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam_user ON public.exam_attempts USING btree (exam_id, user_id, status);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_score ON public.exam_attempts USING btree (exam_id, user_id, total_score) WHERE ((status)::text = 'completed'::text);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_user ON public.exam_attempts USING btree (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS forum_blocks_blocker_id_blocked_id_key ON public.forum_blocks USING btree (blocker_id, blocked_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON public.forum_blocks USING btree (blocked_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON public.forum_blocks USING btree (blocker_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON public.forum_messages USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON public.forum_messages USING btree (receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.forum_messages USING btree (sender_id);
CREATE INDEX IF NOT EXISTS idx_reports_reported ON public.forum_reports USING btree (reported_user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.forum_reports USING btree (status);
CREATE INDEX IF NOT EXISTS idx_post_comments_created_at ON public.post_comments USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON public.post_comments USING btree (post_id);
CREATE INDEX IF NOT EXISTS idx_subjects_code ON public.subjects USING btree (code);
CREATE INDEX IF NOT EXISTS idx_subjects_slug ON public.subjects USING btree (slug);
CREATE UNIQUE INDEX IF NOT EXISTS subjects_code_key ON public.subjects USING btree (code);
CREATE UNIQUE INDEX IF NOT EXISTS subjects_slug_key ON public.subjects USING btree (slug);
CREATE INDEX IF NOT EXISTS idx_user_answers_attempt ON public.user_answers USING btree (attempt_id);
CREATE INDEX IF NOT EXISTS idx_user_answers_attempt_id ON public.user_answers USING btree (attempt_id);
CREATE INDEX IF NOT EXISTS idx_user_answers_question_id ON public.user_answers USING btree (question_id);
CREATE UNIQUE INDEX IF NOT EXISTS user_answers_attempt_id_question_id_key ON public.user_answers USING btree (attempt_id, question_id);
CREATE INDEX IF NOT EXISTS idx_user_quests_user_date ON public.user_quests USING btree (user_id, date);
CREATE UNIQUE INDEX IF NOT EXISTS user_quests_user_id_quest_type_date_key ON public.user_quests USING btree (user_id, quest_type, date);
CREATE INDEX IF NOT EXISTS idx_user_topic_stats_user ON public.user_topic_stats USING btree (user_id, subject_id);
CREATE UNIQUE INDEX IF NOT EXISTS user_topic_stats_user_id_subject_id_topic_id_key ON public.user_topic_stats USING btree (user_id, subject_id, topic_id);
CREATE INDEX IF NOT EXISTS idx_vocab_is_premium ON public.vocabulary_items USING btree (is_premium) WHERE (is_premium = true);
CREATE INDEX IF NOT EXISTS idx_vocab_search ON public.vocabulary_items USING btree (word_cn, pinyin, word_vn) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_vocab_subject ON public.vocabulary_items USING btree (subject);
CREATE INDEX IF NOT EXISTS idx_vocab_subject_topic ON public.vocabulary_items USING btree (subject, topic) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_vocab_topic ON public.vocabulary_items USING btree (subject, topic);
CREATE UNIQUE INDEX IF NOT EXISTS vocabulary_items_word_cn_subject_key ON public.vocabulary_items USING btree (word_cn, subject);
