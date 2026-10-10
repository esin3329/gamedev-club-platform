-- ============================================================================
-- Migration: 00003_notices_and_events.sql
-- Description: 공지사항(notices) 및 일정(events) 테이블 (F6 기능)
-- Related PRD: F6 공지·일정
-- ============================================================================

-- ============================================================================
-- 1. ENUM TYPES
-- ============================================================================

-- 공지 카테고리
CREATE TYPE notice_category AS ENUM (
  'general',      -- 일반
  'game_jam',     -- 게임잼
  'showcase',     -- 쇼케이스
  'recruitment',  -- 모집
  'other'         -- 기타
);

-- 일정 유형
CREATE TYPE event_type AS ENUM (
  'game_jam',      -- 게임잼
  'showcase',      -- 쇼케이스
  'deadline',      -- 마감일
  'regular_meeting', -- 정기 모임
  'other'          -- 기타
);

-- ============================================================================
-- 2. NOTICES TABLE (공지사항)
-- ============================================================================

CREATE TABLE notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 기본 정보
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL, -- 마크다운 형식
  category notice_category NOT NULL DEFAULT 'general',
  
  -- 표시 설정
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE, -- 상단 고정 여부
  
  -- 작성자 정보
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- 관련 일정 (선택) - events 테이블 생성 후 ALTER로 추가
  related_event_id UUID,
  
  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- 소프트 삭제
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ
);

-- 인덱스
CREATE INDEX idx_notices_category ON notices(category) WHERE NOT is_deleted;
CREATE INDEX idx_notices_pinned ON notices(is_pinned DESC, created_at DESC) WHERE NOT is_deleted;
CREATE INDEX idx_notices_author ON notices(author_id);

-- ============================================================================
-- 3. NOTICE_ATTACHMENTS TABLE (공지 첨부파일)
-- ============================================================================

CREATE TABLE notice_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id UUID NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
  
  -- 파일 정보
  storage_key VARCHAR(512) NOT NULL, -- R2 저장 경로
  file_name VARCHAR(255) NOT NULL,   -- 원본 파일명
  file_size INTEGER NOT NULL,        -- 바이트 단위
  mime_type VARCHAR(100) NOT NULL,
  
  -- 업로드 정보
  uploader_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notice_attachments_notice ON notice_attachments(notice_id);

-- ============================================================================
-- 4. EVENTS TABLE (일정)
-- ============================================================================

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 기본 정보
  title VARCHAR(255) NOT NULL,
  event_type event_type NOT NULL DEFAULT 'other',
  description TEXT, -- 일정 설명
  
  -- 시간 정보
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ, -- NULL이면 종일 또는 단일 시점
  
  -- 장소 정보
  location VARCHAR(500), -- 장소 또는 온라인 링크
  
  -- 관련 공지 (선택, 양방향 참조 가능)
  related_notice_id UUID REFERENCES notices(id) ON DELETE SET NULL,
  
  -- 작성자 정보
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- 소프트 삭제
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  
  -- 제약 조건: 종료일은 시작일 이후여야 함
  CONSTRAINT check_event_dates CHECK (end_at IS NULL OR end_at >= start_at)
);

-- 인덱스
CREATE INDEX idx_events_type ON events(event_type) WHERE NOT is_deleted;
CREATE INDEX idx_events_start ON events(start_at) WHERE NOT is_deleted;
CREATE INDEX idx_events_author ON events(author_id);

-- ============================================================================
-- 5. EVENT_PROJECTS TABLE (행사-프로젝트 연결, P1이지만 테이블은 미리 생성)
-- ============================================================================

CREATE TABLE event_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- 참가 신청 정보
  registered_by UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL, -- 신청자 (보통 리더)
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- 유니크 제약: 같은 프로젝트가 같은 행사에 중복 등록 불가
  CONSTRAINT unique_event_project UNIQUE (event_id, project_id)
);

CREATE INDEX idx_event_projects_event ON event_projects(event_id);
CREATE INDEX idx_event_projects_project ON event_projects(project_id);

-- ============================================================================
-- 6. ALTER notices to add foreign key to events (순환 참조 해결)
-- ============================================================================

-- notices.related_event_id 외래 키는 events 테이블 생성 후 추가
ALTER TABLE notices
  ADD CONSTRAINT fk_notices_related_event
  FOREIGN KEY (related_event_id) REFERENCES events(id) ON DELETE SET NULL;

-- ============================================================================
-- 7. TRIGGERS
-- ============================================================================

-- notices updated_at 트리거
CREATE TRIGGER trigger_notices_updated_at
  BEFORE UPDATE ON notices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- events updated_at 트리거
CREATE TRIGGER trigger_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 8. RLS (Row Level Security) 정책
-- ============================================================================

-- RLS 활성화
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE notice_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_projects ENABLE ROW LEVEL SECURITY;

-- ------------------------
-- notices 정책
-- ------------------------

-- 조회: 활성 회원만 조회 가능 (삭제되지 않은 공지만)
CREATE POLICY notices_select_policy ON notices
  FOR SELECT
  TO authenticated
  USING (
    is_active_member() AND NOT is_deleted
  );

-- 생성: 운영진만 가능
CREATE POLICY notices_insert_policy ON notices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin() AND author_id = auth.uid()
  );

-- 수정: 운영진만 가능
CREATE POLICY notices_update_policy ON notices
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 삭제: 운영진만 가능 (소프트 삭제 권장)
CREATE POLICY notices_delete_policy ON notices
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- ------------------------
-- notice_attachments 정책
-- ------------------------

-- 조회: 활성 회원만
CREATE POLICY notice_attachments_select_policy ON notice_attachments
  FOR SELECT
  TO authenticated
  USING (
    is_active_member()
  );

-- 생성: 운영진만
CREATE POLICY notice_attachments_insert_policy ON notice_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- 삭제: 운영진만
CREATE POLICY notice_attachments_delete_policy ON notice_attachments
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- ------------------------
-- events 정책
-- ------------------------

-- 조회: 활성 회원만 (삭제되지 않은 일정만)
CREATE POLICY events_select_policy ON events
  FOR SELECT
  TO authenticated
  USING (
    is_active_member() AND NOT is_deleted
  );

-- 생성: 운영진만
CREATE POLICY events_insert_policy ON events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin() AND author_id = auth.uid()
  );

-- 수정: 운영진만
CREATE POLICY events_update_policy ON events
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 삭제: 운영진만
CREATE POLICY events_delete_policy ON events
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- ------------------------
-- event_projects 정책 (P1이지만 미리 정의)
-- ------------------------

-- 조회: 활성 회원
CREATE POLICY event_projects_select_policy ON event_projects
  FOR SELECT
  TO authenticated
  USING (is_active_member());

-- 생성: 프로젝트 리더만 자기 프로젝트를 등록 가능
CREATE POLICY event_projects_insert_policy ON event_projects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_project_leader(project_id) AND registered_by = auth.uid()
  );

-- 삭제: 프로젝트 리더 또는 운영진
CREATE POLICY event_projects_delete_policy ON event_projects
  FOR DELETE
  TO authenticated
  USING (
    is_project_leader(project_id) OR is_admin()
  );

-- ============================================================================
-- 9. VIEWS
-- ============================================================================

-- 다가오는 일정 뷰 (2주 이내)
CREATE VIEW upcoming_events AS
SELECT 
  e.id,
  e.title,
  e.event_type,
  e.start_at,
  e.end_at,
  e.location,
  e.related_notice_id,
  n.title AS related_notice_title
FROM events e
LEFT JOIN notices n ON e.related_notice_id = n.id AND NOT n.is_deleted
WHERE 
  NOT e.is_deleted
  AND e.start_at >= NOW()
  AND e.start_at <= NOW() + INTERVAL '14 days'
ORDER BY e.start_at;

-- 최근 공지 뷰 (고정 우선, 최신순)
CREATE VIEW recent_notices AS
SELECT 
  n.id,
  n.title,
  n.category,
  n.is_pinned,
  n.author_id,
  p.nickname AS author_name,
  n.created_at,
  n.related_event_id,
  e.title AS related_event_title
FROM notices n
LEFT JOIN profiles p ON n.author_id = p.id
LEFT JOIN events e ON n.related_event_id = e.id AND NOT e.is_deleted
WHERE NOT n.is_deleted
ORDER BY n.is_pinned DESC, n.created_at DESC;

-- ============================================================================
-- 10. COMMENTS
-- ============================================================================

COMMENT ON TABLE notices IS 'F6-1, F6-2: 동아리 공지사항';
COMMENT ON COLUMN notices.is_pinned IS 'F6-2: 상단 고정 여부';
COMMENT ON COLUMN notices.category IS '카테고리: 일반/게임잼/쇼케이스/모집/기타';

COMMENT ON TABLE events IS 'F6-3, F6-4: 동아리 일정 (캘린더)';
COMMENT ON COLUMN events.event_type IS '유형: 게임잼/쇼케이스/마감일/정기모임/기타';
COMMENT ON COLUMN events.start_at IS '시작 일시';
COMMENT ON COLUMN events.end_at IS '종료 일시 (NULL이면 단일 시점)';

COMMENT ON TABLE event_projects IS 'P1: 게임잼 등 행사에 프로젝트 참가 등록';
