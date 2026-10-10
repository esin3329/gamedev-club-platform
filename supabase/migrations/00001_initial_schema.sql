-- ============================================================================
-- 게임 개발 동아리 플랫폼 - 초기 데이터베이스 스키마
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ENUM 타입 정의
-- ----------------------------------------------------------------------------

-- 회원 상태
CREATE TYPE member_status AS ENUM (
  'pending',    -- 승인 대기
  'active',     -- 활동 중
  'dormant',    -- 휴면
  'withdrawn',  -- 탈퇴
  'rejected'    -- 가입 거절됨
);

-- 전역 역할 (동아리 전체)
CREATE TYPE global_role AS ENUM (
  'admin',   -- 운영진
  'member'   -- 일반 동아리원
);

-- 프로젝트 내 역할
CREATE TYPE project_role AS ENUM (
  'leader',  -- 프로젝트 리더
  'member'   -- 팀원
);

-- 포지션 (직군)
CREATE TYPE position_type AS ENUM (
  'planning',     -- 기획
  'programming',  -- 프로그래밍
  'art',          -- 아트
  'sound'         -- 사운드
);

-- 프로젝트 상태
CREATE TYPE project_status AS ENUM (
  'planning',    -- 기획 중
  'recruiting',  -- 팀원 모집 중
  'developing',  -- 개발 중
  'completed',   -- 완료
  'paused',      -- 보류
  'archived'     -- 보관됨
);

-- 게임 엔진
CREATE TYPE engine_type AS ENUM (
  'unity',
  'unreal',
  'godot',
  'other'
);

-- 빌드 타입
CREATE TYPE build_type AS ENUM (
  'webgl',
  'pc'
);

-- 빌드 대상 OS
CREATE TYPE build_os AS ENUM (
  'windows',
  'macos',
  'linux'
);

-- 버그 심각도
CREATE TYPE bug_severity AS ENUM (
  'critical',  -- 치명적
  'high',      -- 높음
  'medium',    -- 보통
  'low'        -- 낮음
);

-- 버그 상태
CREATE TYPE bug_status AS ENUM (
  'new',              -- 신규
  'confirmed',        -- 확인됨
  'in_progress',      -- 수정 중
  'fixed',            -- 수정 완료
  'cannot_reproduce', -- 재현 불가
  'deferred'          -- 보류
);

-- 모집 상태
CREATE TYPE recruitment_status AS ENUM (
  'open',    -- 모집 중
  'filled',  -- 충원 완료
  'closed'   -- 마감
);

-- 지원 상태
CREATE TYPE application_status AS ENUM (
  'pending',   -- 검토 중
  'approved',  -- 승인
  'rejected',  -- 거절
  'cancelled'  -- 취소
);

-- ----------------------------------------------------------------------------
-- 기수 (Cohorts)
-- ----------------------------------------------------------------------------
CREATE TABLE cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,                    -- 예: "11기"
  start_date DATE,                              -- 활동 시작일
  end_date DATE,                                -- 활동 종료일
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cohorts_name ON cohorts(name);

-- ----------------------------------------------------------------------------
-- 회원 프로필 (Profiles)
-- auth.users와 1:1 관계
-- ----------------------------------------------------------------------------
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255),
  name VARCHAR(100),
  nickname VARCHAR(50),
  avatar_url TEXT,
  primary_position position_type,
  engines engine_type[] DEFAULT '{}',           -- 사용 가능한 엔진들
  external_links JSONB DEFAULT '{}',            -- {"github": "...", "portfolio": "..."}
  cohort_id UUID REFERENCES cohorts(id) ON DELETE SET NULL,
  global_role global_role NOT NULL DEFAULT 'member',
  status member_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_cohort ON profiles(cohort_id);
CREATE INDEX idx_profiles_status ON profiles(status);
CREATE INDEX idx_profiles_global_role ON profiles(global_role);

-- ----------------------------------------------------------------------------
-- 가입 신청 (Membership Applications)
-- ----------------------------------------------------------------------------
CREATE TABLE membership_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  student_id VARCHAR(50),                        -- 학번 (선택)
  desired_position position_type,
  introduction TEXT,
  status application_status NOT NULL DEFAULT 'pending',
  reviewer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_membership_applications_user ON membership_applications(user_id);
CREATE INDEX idx_membership_applications_status ON membership_applications(status);

-- ----------------------------------------------------------------------------
-- 프로젝트 (Projects)
-- ----------------------------------------------------------------------------
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  tagline VARCHAR(300) NOT NULL,                 -- 한 줄 소개
  description TEXT,                              -- 상세 소개 (마크다운)
  genres VARCHAR(50)[] DEFAULT '{}',             -- 장르 태그들
  engine engine_type NOT NULL DEFAULT 'unity',
  status project_status NOT NULL DEFAULT 'planning',
  thumbnail_url TEXT,
  external_links JSONB DEFAULT '{}',             -- {"github": "...", "docs": "..."}
  is_board_public BOOLEAN NOT NULL DEFAULT TRUE, -- 작업 보드 공개 여부
  featured_build_id UUID,                        -- 대표 빌드 (나중에 FK 추가)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_engine ON projects(engine);
CREATE INDEX idx_projects_updated ON projects(updated_at DESC);

-- ----------------------------------------------------------------------------
-- 프로젝트 멤버 (Project Members)
-- 프로젝트와 회원의 다대다 관계
-- ----------------------------------------------------------------------------
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role project_role NOT NULL DEFAULT 'member',
  position position_type NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,                           -- 탈퇴 시 기록
  UNIQUE(project_id, user_id)
);

CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);
CREATE INDEX idx_project_members_role ON project_members(role);

-- ----------------------------------------------------------------------------
-- 모집 공고 (Recruitment Posts)
-- ----------------------------------------------------------------------------
CREATE TABLE recruitment_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  position position_type NOT NULL,
  slots INT NOT NULL DEFAULT 1 CHECK (slots > 0),  -- 모집 인원
  description TEXT,
  deadline TIMESTAMPTZ,
  status recruitment_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recruitment_posts_project ON recruitment_posts(project_id);
CREATE INDEX idx_recruitment_posts_status ON recruitment_posts(status);
CREATE INDEX idx_recruitment_posts_position ON recruitment_posts(position);

-- ----------------------------------------------------------------------------
-- 프로젝트 지원서 (Recruitment Applications)
-- ----------------------------------------------------------------------------
CREATE TABLE recruitment_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruitment_id UUID NOT NULL REFERENCES recruitment_posts(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  introduction TEXT NOT NULL,
  portfolio_url TEXT,
  status application_status NOT NULL DEFAULT 'pending',
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(recruitment_id, applicant_id)
);

CREATE INDEX idx_recruitment_applications_recruitment ON recruitment_applications(recruitment_id);
CREATE INDEX idx_recruitment_applications_applicant ON recruitment_applications(applicant_id);
CREATE INDEX idx_recruitment_applications_status ON recruitment_applications(status);

-- ----------------------------------------------------------------------------
-- 마일스톤 (Milestones)
-- ----------------------------------------------------------------------------
CREATE TABLE milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  target_date DATE,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_milestones_project ON milestones(project_id);
CREATE INDEX idx_milestones_target_date ON milestones(target_date);

-- ----------------------------------------------------------------------------
-- 칸반 보드 컬럼 (Board Columns)
-- ----------------------------------------------------------------------------
CREATE TABLE board_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  position INT NOT NULL DEFAULT 0,               -- 정렬 순서
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_board_columns_project ON board_columns(project_id);
CREATE INDEX idx_board_columns_position ON board_columns(project_id, position);

-- ----------------------------------------------------------------------------
-- 작업 카드 (Task Cards)
-- ----------------------------------------------------------------------------
CREATE TABLE task_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  column_id UUID NOT NULL REFERENCES board_columns(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL,
  title VARCHAR(300) NOT NULL,
  description TEXT,
  position_tags position_type[] DEFAULT '{}',
  due_date DATE,
  card_order INT NOT NULL DEFAULT 0,             -- 컬럼 내 순서
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_task_cards_project ON task_cards(project_id);
CREATE INDEX idx_task_cards_column ON task_cards(column_id);
CREATE INDEX idx_task_cards_milestone ON task_cards(milestone_id);
CREATE INDEX idx_task_cards_order ON task_cards(column_id, card_order);

-- ----------------------------------------------------------------------------
-- 작업 담당자 (Task Assignees)
-- 카드와 담당자의 다대다 관계
-- ----------------------------------------------------------------------------
CREATE TABLE task_assignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES task_cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(card_id, user_id)
);

CREATE INDEX idx_task_assignees_card ON task_assignees(card_id);
CREATE INDEX idx_task_assignees_user ON task_assignees(user_id);

-- ----------------------------------------------------------------------------
-- 빌드 (Builds)
-- ----------------------------------------------------------------------------
CREATE TABLE builds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version VARCHAR(100) NOT NULL,                 -- 예: "v0.3", "게임잼 제출본"
  build_type build_type NOT NULL,
  target_os build_os,                            -- PC 빌드인 경우만
  release_notes TEXT,
  test_request TEXT,                             -- 테스트 요청 사항
  storage_key VARCHAR(500) NOT NULL,             -- R2 저장소 키
  file_size BIGINT NOT NULL CHECK (file_size > 0),
  uploader_id UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  download_count INT NOT NULL DEFAULT 0,
  play_count INT NOT NULL DEFAULT 0,             -- WebGL 플레이 횟수
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,     -- 소프트 삭제
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_builds_project ON builds(project_id);
CREATE INDEX idx_builds_type ON builds(build_type);
CREATE INDEX idx_builds_created ON builds(project_id, created_at DESC);

-- projects.featured_build_id FK 추가
ALTER TABLE projects 
  ADD CONSTRAINT fk_featured_build 
  FOREIGN KEY (featured_build_id) REFERENCES builds(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- 평점 (Ratings)
-- 빌드당 사용자당 하나의 평점
-- ----------------------------------------------------------------------------
CREATE TABLE ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id UUID NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  overall_score INT NOT NULL CHECK (overall_score >= 1 AND overall_score <= 5),
  controls_score INT CHECK (controls_score >= 1 AND controls_score <= 5),     -- 조작감
  graphics_score INT CHECK (graphics_score >= 1 AND graphics_score <= 5),     -- 그래픽
  sound_score INT CHECK (sound_score >= 1 AND sound_score <= 5),              -- 사운드
  difficulty_score INT CHECK (difficulty_score >= 1 AND difficulty_score <= 5), -- 난이도
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(build_id, user_id)
);

CREATE INDEX idx_ratings_build ON ratings(build_id);
CREATE INDEX idx_ratings_user ON ratings(user_id);

-- ----------------------------------------------------------------------------
-- 피드백 코멘트 (Feedback Comments)
-- 답글 지원 (parent_id)
-- ----------------------------------------------------------------------------
CREATE TABLE feedback_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id UUID NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES feedback_comments(id) ON DELETE CASCADE,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  hidden_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feedback_comments_build ON feedback_comments(build_id);
CREATE INDEX idx_feedback_comments_author ON feedback_comments(author_id);
CREATE INDEX idx_feedback_comments_parent ON feedback_comments(parent_id);

-- ----------------------------------------------------------------------------
-- 버그 리포트 (Bug Reports)
-- ----------------------------------------------------------------------------
CREATE TABLE bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id UUID NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  title VARCHAR(300) NOT NULL,
  steps_to_reproduce TEXT NOT NULL,
  expected_result TEXT,
  actual_result TEXT,
  severity bug_severity NOT NULL,
  status bug_status NOT NULL DEFAULT 'new',
  environment_info JSONB DEFAULT '{}',           -- {"os": "Windows 11", "browser": "Chrome 120"}
  linked_card_id UUID REFERENCES task_cards(id) ON DELETE SET NULL,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bug_reports_build ON bug_reports(build_id);
CREATE INDEX idx_bug_reports_reporter ON bug_reports(reporter_id);
CREATE INDEX idx_bug_reports_status ON bug_reports(status);
CREATE INDEX idx_bug_reports_severity ON bug_reports(severity);

-- ----------------------------------------------------------------------------
-- 버그 리포트 스크린샷 (Bug Report Screenshots)
-- ----------------------------------------------------------------------------
CREATE TABLE bug_report_screenshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_report_id UUID NOT NULL REFERENCES bug_reports(id) ON DELETE CASCADE,
  storage_key VARCHAR(500) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bug_screenshots_report ON bug_report_screenshots(bug_report_id);

-- ----------------------------------------------------------------------------
-- 감사 로그 (Audit Logs)
-- 운영진 주요 행위 기록
-- ----------------------------------------------------------------------------
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  action_type VARCHAR(100) NOT NULL,             -- 예: "approve_member", "hide_content"
  target_type VARCHAR(100) NOT NULL,             -- 예: "membership_application", "feedback_comment"
  target_id UUID NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action_type);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- ----------------------------------------------------------------------------
-- 트리거: updated_at 자동 갱신
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 각 테이블에 트리거 적용
CREATE TRIGGER tr_cohorts_updated_at
  BEFORE UPDATE ON cohorts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_membership_applications_updated_at
  BEFORE UPDATE ON membership_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_recruitment_posts_updated_at
  BEFORE UPDATE ON recruitment_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_recruitment_applications_updated_at
  BEFORE UPDATE ON recruitment_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_milestones_updated_at
  BEFORE UPDATE ON milestones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_task_cards_updated_at
  BEFORE UPDATE ON task_cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_ratings_updated_at
  BEFORE UPDATE ON ratings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_feedback_comments_updated_at
  BEFORE UPDATE ON feedback_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_bug_reports_updated_at
  BEFORE UPDATE ON bug_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ----------------------------------------------------------------------------
-- 기본 칸반 컬럼 생성 함수
-- 프로젝트 생성 시 호출
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_default_board_columns(p_project_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO board_columns (project_id, name, position) VALUES
    (p_project_id, '할 일', 0),
    (p_project_id, '진행 중', 1),
    (p_project_id, '검토', 2),
    (p_project_id, '완료', 3);
END;
$$ LANGUAGE plpgsql;

-- 프로젝트 생성 시 기본 컬럼 자동 생성 트리거
CREATE OR REPLACE FUNCTION on_project_created()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_default_board_columns(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_project_created
  AFTER INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION on_project_created();

-- ----------------------------------------------------------------------------
-- 뷰: 빌드별 평균 평점
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW build_rating_stats AS
SELECT 
  b.id AS build_id,
  b.project_id,
  COUNT(r.id) AS rating_count,
  COALESCE(AVG(r.overall_score), 0) AS avg_overall,
  COALESCE(AVG(r.controls_score), 0) AS avg_controls,
  COALESCE(AVG(r.graphics_score), 0) AS avg_graphics,
  COALESCE(AVG(r.sound_score), 0) AS avg_sound,
  COALESCE(AVG(r.difficulty_score), 0) AS avg_difficulty
FROM builds b
LEFT JOIN ratings r ON b.id = r.build_id
GROUP BY b.id, b.project_id;
