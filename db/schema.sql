-- DEVER Arena PostgreSQL Schema (Production)
-- Generated from docs/DATABASE_SCHEMA.md + docs/DESIGN_SYSTEM.md
-- Run: psql -d dever_arena -f db/schema.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Users & Clans
CREATE TABLE clans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(80) UNIQUE NOT NULL,
  tag VARCHAR(20) UNIQUE NOT NULL,
  clan_type VARCHAR(30) NOT NULL CHECK (clan_type IN ('cohort','specialty','icpc')),
  total_rating INT NOT NULL DEFAULT 0,
  leader_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(120),
  clan_id UUID REFERENCES clans(id) ON DELETE SET NULL,
  rating INT NOT NULL DEFAULT 1200 CHECK (rating >= 0),
  max_rating INT NOT NULL DEFAULT 1200,
  rank_tier VARCHAR(30) NOT NULL DEFAULT 'Newbie',
  role VARCHAR(20) NOT NULL DEFAULT 'PARTICIPANT' CHECK (role IN ('GUEST','PARTICIPANT','ADMIN')),
  avatar TEXT,
  statistics JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE clans ADD CONSTRAINT fk_clan_leader FOREIGN KEY (leader_id) REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX idx_users_rating ON users(rating DESC);
CREATE INDEX idx_users_clan ON users(clan_id);
CREATE INDEX idx_users_username_trgm ON users USING gin (username gin_trgm_ops);

-- Contests
CREATE TABLE contests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(120) UNIQUE NOT NULL,
  contest_format VARCHAR(20) NOT NULL DEFAULT 'CODEFORCES' CHECK (contest_format IN ('CODEFORCES','ICPC','IOI')),
  start_time TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 135,
  hack_duration_minutes INT NOT NULL DEFAULT 15,
  status VARCHAR(20) NOT NULL DEFAULT 'REGISTRATION' CHECK (status IN ('REGISTRATION','CODING','HACK_PHASE','SYSTEM_TESTING','FINISHED')),
  is_rated BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_contests_status ON contests(status);
CREATE INDEX idx_contests_start ON contests(start_time DESC);

-- Problems
CREATE TABLE problems (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contest_id UUID REFERENCES contests(id) ON DELETE CASCADE,
  code VARCHAR(10) NOT NULL,
  title VARCHAR(200) NOT NULL,
  statement_markdown TEXT NOT NULL,
  editorial_markdown TEXT,
  time_limit_ms INT NOT NULL DEFAULT 1000,
  memory_limit_kb INT NOT NULL DEFAULT 262144,
  base_points INT NOT NULL DEFAULT 500,
  tags VARCHAR(50)[] DEFAULT '{}',
  solved_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(contest_id, code)
);
CREATE INDEX idx_problems_tags ON problems USING gin (tags);
CREATE INDEX idx_problems_rating ON problems(base_points);
CREATE INDEX idx_problems_contest ON problems(contest_id);

-- Testcases
CREATE TABLE testcases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  problem_id UUID REFERENCES problems(id) ON DELETE CASCADE,
  order_index INT NOT NULL,
  stdin TEXT NOT NULL,
  expected_stdout TEXT NOT NULL,
  is_sample BOOLEAN DEFAULT false,
  is_pretest BOOLEAN DEFAULT true,
  subtask_id INT,
  UNIQUE(problem_id, order_index)
);

-- Submissions
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  problem_id UUID REFERENCES problems(id) ON DELETE CASCADE,
  contest_id UUID REFERENCES contests(id) ON DELETE CASCADE,
  language VARCHAR(20) NOT NULL CHECK (language IN ('CPP20','PYTHON3','JAVA17','JS')),
  source_code TEXT NOT NULL,
  verdict VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (verdict IN ('PENDING','AC','WA','TLE','MLE','RTE','CE','HACKED','FST')),
  execution_time_ms INT,
  memory_used_kb INT,
  points_awarded INT DEFAULT 0,
  is_hacked BOOLEAN DEFAULT false,
  submitted_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_submissions_contest_user ON submissions(contest_id, user_id, problem_id, submitted_at DESC);
CREATE INDEX idx_submissions_live_stream ON submissions(submitted_at DESC);
CREATE INDEX idx_submissions_user ON submissions(user_id);

-- Hack events
CREATE TABLE hack_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contest_id UUID REFERENCES contests(id) ON DELETE CASCADE,
  hacker_id UUID REFERENCES users(id) ON DELETE CASCADE,
  target_submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  input_payload TEXT NOT NULL,
  is_successful BOOLEAN NOT NULL,
  points_delta INT NOT NULL,
  executed_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_hack_events_contest ON hack_events(contest_id, executed_at DESC);

-- Discussions
CREATE TABLE discussions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  problem_id UUID REFERENCES problems(id) ON DELETE CASCADE,
  author_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200),
  content TEXT NOT NULL,
  upvotes INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE discussion_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  discussion_id UUID REFERENCES discussions(id) ON DELETE CASCADE,
  author_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  upvotes INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Contest participants (registration + room)
CREATE TABLE contest_participants (
  contest_id UUID REFERENCES contests(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  room_id VARCHAR(50),
  registered_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (contest_id, user_id)
);
CREATE INDEX idx_participants_room ON contest_participants(contest_id, room_id);
