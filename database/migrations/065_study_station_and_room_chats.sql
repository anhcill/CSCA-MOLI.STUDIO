-- Migration 064: Study Station and Room Chats
-- Supports live motivation chat (TikTok station) and virtual study room chat & rooms persistence

-- 1. Community live chat for Trạm Động Lực (Motivation Station)
CREATE TABLE IF NOT EXISTS study_station_chats (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  sender_name VARCHAR(120) NOT NULL,
  sender_avatar TEXT,
  badge VARCHAR(120) DEFAULT 'Chiến binh CSCA',
  badge_color VARCHAR(120) DEFAULT 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  text TEXT NOT NULL,
  video_id VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_station_chats_created 
ON study_station_chats(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_study_station_chats_video 
ON study_station_chats(video_id, created_at DESC) 
WHERE video_id IS NOT NULL;

-- 2. Virtual Study Room persistent chat messages
CREATE TABLE IF NOT EXISTS study_room_messages (
  id BIGSERIAL PRIMARY KEY,
  room_code VARCHAR(60) NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  sender_name VARCHAR(120) NOT NULL,
  sender_avatar TEXT,
  text TEXT NOT NULL,
  message_type VARCHAR(30) NOT NULL DEFAULT 'text',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_room_messages_room_created 
ON study_room_messages(room_code, created_at ASC);

-- 3. Study Rooms Table (allows user rooms to persist across sessions)
CREATE TABLE IF NOT EXISTS study_rooms (
  id VARCHAR(100) PRIMARY KEY,
  code VARCHAR(60) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  host_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  host_name VARCHAR(120) NOT NULL,
  host_avatar TEXT,
  subject VARCHAR(120) NOT NULL DEFAULT 'Toán học CSCA',
  goal TEXT,
  member_count INTEGER NOT NULL DEFAULT 1,
  max_members INTEGER NOT NULL DEFAULT 6,
  is_private BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_rooms_active_created 
ON study_rooms(is_active, created_at DESC);
