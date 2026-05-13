-- Official exam workflow: registration, rooms, proctors, violations, certificates.

CREATE TABLE IF NOT EXISTS exam_registrations (
  id BIGSERIAL PRIMARY KEY,
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(30) NOT NULL DEFAULT 'registered',
  note TEXT,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exam_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_registrations_exam_status
  ON exam_registrations(exam_id, status);
CREATE INDEX IF NOT EXISTS idx_exam_registrations_user
  ON exam_registrations(user_id, registered_at DESC);

CREATE TABLE IF NOT EXISTS exam_rooms (
  id BIGSERIAL PRIMARY KEY,
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  room_name VARCHAR(120) NOT NULL,
  location VARCHAR(255),
  capacity INTEGER NOT NULL DEFAULT 30 CHECK (capacity > 0),
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exam_id, room_name)
);

CREATE INDEX IF NOT EXISTS idx_exam_rooms_exam
  ON exam_rooms(exam_id, room_name);

CREATE TABLE IF NOT EXISTS exam_room_students (
  id BIGSERIAL PRIMARY KEY,
  room_id BIGINT NOT NULL REFERENCES exam_rooms(id) ON DELETE CASCADE,
  registration_id BIGINT NOT NULL REFERENCES exam_registrations(id) ON DELETE CASCADE,
  seat_number INTEGER,
  assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (registration_id),
  UNIQUE (room_id, seat_number)
);

CREATE INDEX IF NOT EXISTS idx_exam_room_students_room
  ON exam_room_students(room_id, seat_number);

CREATE TABLE IF NOT EXISTS exam_proctor_assignments (
  id BIGSERIAL PRIMARY KEY,
  room_id BIGINT NOT NULL REFERENCES exam_rooms(id) ON DELETE CASCADE,
  proctor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(30) NOT NULL DEFAULT 'proctor',
  assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, proctor_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_proctor_assignments_proctor
  ON exam_proctor_assignments(proctor_id);

CREATE TABLE IF NOT EXISTS exam_violations (
  id BIGSERIAL PRIMARY KEY,
  attempt_id INTEGER REFERENCES exam_attempts(id) ON DELETE CASCADE,
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  registration_id BIGINT REFERENCES exam_registrations(id) ON DELETE SET NULL,
  room_id BIGINT REFERENCES exam_rooms(id) ON DELETE SET NULL,
  violation_type VARCHAR(80) NOT NULL,
  violation_count INTEGER NOT NULL DEFAULT 1,
  severity VARCHAR(20) NOT NULL DEFAULT 'warning',
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exam_violations_exam
  ON exam_violations(exam_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exam_violations_attempt
  ON exam_violations(attempt_id);
CREATE INDEX IF NOT EXISTS idx_exam_violations_user
  ON exam_violations(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS exam_certificates (
  id BIGSERIAL PRIMARY KEY,
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  attempt_id INTEGER NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  certificate_code VARCHAR(64) NOT NULL UNIQUE,
  total_score NUMERIC(8,2) NOT NULL DEFAULT 0,
  pass_score NUMERIC(8,2) NOT NULL DEFAULT 60,
  status VARCHAR(30) NOT NULL DEFAULT 'issued',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  issued_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  UNIQUE (attempt_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_certificates_user
  ON exam_certificates(user_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_exam_certificates_exam
  ON exam_certificates(exam_id, issued_at DESC);
