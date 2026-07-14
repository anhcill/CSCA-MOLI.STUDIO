CREATE TABLE IF NOT EXISTS seo_blog_posts (
  id BIGSERIAL PRIMARY KEY,
  primary_keyword TEXT NOT NULL,
  secondary_keywords TEXT[] NOT NULL DEFAULT '{}',
  search_intent TEXT,
  topic TEXT,
  title TEXT NOT NULL,
  meta_title TEXT,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  meta_description TEXT,
  content TEXT NOT NULL DEFAULT '',
  cover_image TEXT,
  cover_image_alt TEXT,
  cover_image_source TEXT,
  cover_image_source_url TEXT,
  category TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  author TEXT NOT NULL DEFAULT 'MOLI.STUDIO',
  read_time INTEGER NOT NULL DEFAULT 1,
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','published','archived','failed')),
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  generated_provider TEXT,
  generated_model TEXT,
  generation_prompt JSONB,
  generation_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE seo_blog_posts ADD COLUMN IF NOT EXISTS meta_title TEXT;
CREATE INDEX IF NOT EXISTS idx_seo_blog_public ON seo_blog_posts(status, scheduled_at, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_seo_blog_keyword ON seo_blog_posts(LOWER(primary_keyword));
CREATE INDEX IF NOT EXISTS idx_seo_blog_category ON seo_blog_posts(category, published_at DESC);
