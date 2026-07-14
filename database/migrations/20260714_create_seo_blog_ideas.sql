CREATE TABLE IF NOT EXISTS seo_blog_ideas (
  id BIGSERIAL PRIMARY KEY,
  topic TEXT,
  category TEXT,
  primary_keyword TEXT NOT NULL UNIQUE,
  secondary_keywords TEXT[] NOT NULL DEFAULT '{}',
  search_intent TEXT NOT NULL DEFAULT 'informational',
  angle TEXT,
  focus TEXT,
  status TEXT NOT NULL DEFAULT 'unused' CHECK (status IN ('unused', 'used', 'dismissed')),
  used_post_id BIGINT REFERENCES seo_blog_posts(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_seo_blog_ideas_status_created
  ON seo_blog_ideas(status, created_at DESC);
