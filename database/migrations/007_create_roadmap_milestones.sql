-- ====================================================
-- Migration: 007_create_roadmap_milestones
-- Ensure roadmap milestones table exists with required indexes
-- ====================================================

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
);

CREATE INDEX IF NOT EXISTS idx_roadmap_milestones_active_order
    ON roadmap_milestones(is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_roadmap_milestones_sort_order
    ON roadmap_milestones(sort_order);
