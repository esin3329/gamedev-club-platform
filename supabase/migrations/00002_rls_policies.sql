-- ============================================================================
-- 게임 개발 동아리 플랫폼 - Row Level Security 정책
-- PRD 섹션 4.2 권한 매트릭스 기반
-- ============================================================================

-- RLS 활성화
ALTER TABLE cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruitment_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruitment_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE builds ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE bug_report_screenshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 헬퍼 함수들
-- ----------------------------------------------------------------------------

-- 현재 사용자가 활성 회원인지 확인
CREATE OR REPLACE FUNCTION is_active_member()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 현재 사용자가 운영진인지 확인
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND status = 'active' AND global_role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 현재 사용자가 특정 프로젝트의 팀원인지 확인
CREATE OR REPLACE FUNCTION is_project_member(p_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM project_members 
    WHERE project_id = p_project_id 
      AND user_id = auth.uid() 
      AND left_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 현재 사용자가 특정 프로젝트의 리더인지 확인
CREATE OR REPLACE FUNCTION is_project_leader(p_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM project_members 
    WHERE project_id = p_project_id 
      AND user_id = auth.uid() 
      AND role = 'leader'
      AND left_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 빌드가 속한 프로젝트의 팀원인지 확인
CREATE OR REPLACE FUNCTION is_build_project_member(p_build_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_project_id UUID;
BEGIN
  SELECT project_id INTO v_project_id FROM builds WHERE id = p_build_id;
  RETURN is_project_member(v_project_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 기수 (cohorts) 정책
-- ----------------------------------------------------------------------------
-- 활성 회원은 조회 가능, 운영진만 관리
CREATE POLICY "cohorts_select" ON cohorts
  FOR SELECT TO authenticated
  USING (is_active_member() OR is_admin());

CREATE POLICY "cohorts_insert" ON cohorts
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "cohorts_update" ON cohorts
  FOR UPDATE TO authenticated
  USING (is_admin());

CREATE POLICY "cohorts_delete" ON cohorts
  FOR DELETE TO authenticated
  USING (is_admin());

-- ----------------------------------------------------------------------------
-- 프로필 (profiles) 정책
-- ----------------------------------------------------------------------------
-- 본인 프로필은 항상 조회 가능
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- 활성 회원은 다른 활성 회원 프로필 조회 가능
CREATE POLICY "profiles_select_active" ON profiles
  FOR SELECT TO authenticated
  USING (status = 'active' AND is_active_member());

-- 운영진은 모든 프로필 조회 가능
CREATE POLICY "profiles_select_admin" ON profiles
  FOR SELECT TO authenticated
  USING (is_admin());

-- 본인 프로필 생성
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- 본인 프로필 수정 (상태, 역할 제외)
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 운영진은 모든 프로필 수정 가능
CREATE POLICY "profiles_update_admin" ON profiles
  FOR UPDATE TO authenticated
  USING (is_admin());

-- ----------------------------------------------------------------------------
-- 가입 신청 (membership_applications) 정책
-- ----------------------------------------------------------------------------
-- 본인 신청 조회
CREATE POLICY "membership_apps_select_own" ON membership_applications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 운영진은 모든 신청 조회
CREATE POLICY "membership_apps_select_admin" ON membership_applications
  FOR SELECT TO authenticated
  USING (is_admin());

-- 본인 신청 생성
CREATE POLICY "membership_apps_insert" ON membership_applications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 운영진만 신청 상태 변경
CREATE POLICY "membership_apps_update_admin" ON membership_applications
  FOR UPDATE TO authenticated
  USING (is_admin());

-- ----------------------------------------------------------------------------
-- 프로젝트 (projects) 정책
-- ----------------------------------------------------------------------------
-- 활성 회원은 보관되지 않은 프로젝트 조회 (보관된 건 필터로 별도)
CREATE POLICY "projects_select" ON projects
  FOR SELECT TO authenticated
  USING (is_active_member() OR is_admin());

-- 활성 회원은 프로젝트 생성 가능
CREATE POLICY "projects_insert" ON projects
  FOR INSERT TO authenticated
  WITH CHECK (is_active_member());

-- 프로젝트 리더 또는 운영진만 수정
CREATE POLICY "projects_update" ON projects
  FOR UPDATE TO authenticated
  USING (is_project_leader(id) OR is_admin());

-- 프로젝트 리더 또는 운영진만 삭제(보관)
CREATE POLICY "projects_delete" ON projects
  FOR DELETE TO authenticated
  USING (is_project_leader(id) OR is_admin());

-- ----------------------------------------------------------------------------
-- 프로젝트 멤버 (project_members) 정책
-- ----------------------------------------------------------------------------
-- 활성 회원은 조회 가능
CREATE POLICY "project_members_select" ON project_members
  FOR SELECT TO authenticated
  USING (is_active_member());

-- 프로젝트 리더만 멤버 추가/수정/삭제
CREATE POLICY "project_members_insert" ON project_members
  FOR INSERT TO authenticated
  WITH CHECK (is_project_leader(project_id));

CREATE POLICY "project_members_update" ON project_members
  FOR UPDATE TO authenticated
  USING (is_project_leader(project_id));

CREATE POLICY "project_members_delete" ON project_members
  FOR DELETE TO authenticated
  USING (is_project_leader(project_id));

-- 프로젝트 생성자가 첫 멤버(리더)로 등록할 수 있도록
CREATE POLICY "project_members_insert_creator" ON project_members
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND role = 'leader');

-- ----------------------------------------------------------------------------
-- 모집 공고 (recruitment_posts) 정책
-- ----------------------------------------------------------------------------
CREATE POLICY "recruitment_posts_select" ON recruitment_posts
  FOR SELECT TO authenticated
  USING (is_active_member());

CREATE POLICY "recruitment_posts_insert" ON recruitment_posts
  FOR INSERT TO authenticated
  WITH CHECK (is_project_leader(project_id));

CREATE POLICY "recruitment_posts_update" ON recruitment_posts
  FOR UPDATE TO authenticated
  USING (is_project_leader(project_id));

CREATE POLICY "recruitment_posts_delete" ON recruitment_posts
  FOR DELETE TO authenticated
  USING (is_project_leader(project_id));

-- ----------------------------------------------------------------------------
-- 프로젝트 지원서 (recruitment_applications) 정책
-- ----------------------------------------------------------------------------
-- 본인 지원서 조회
CREATE POLICY "recruitment_apps_select_own" ON recruitment_applications
  FOR SELECT TO authenticated
  USING (applicant_id = auth.uid());

-- 프로젝트 리더는 해당 모집의 지원서 조회
CREATE POLICY "recruitment_apps_select_leader" ON recruitment_applications
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM recruitment_posts rp
      WHERE rp.id = recruitment_id AND is_project_leader(rp.project_id)
    )
  );

-- 활성 회원은 지원 가능
CREATE POLICY "recruitment_apps_insert" ON recruitment_applications
  FOR INSERT TO authenticated
  WITH CHECK (
    applicant_id = auth.uid() 
    AND is_active_member()
    AND NOT is_project_member(
      (SELECT project_id FROM recruitment_posts WHERE id = recruitment_id)
    )
  );

-- 본인 지원 취소 (상태가 pending일 때만)
CREATE POLICY "recruitment_apps_update_own" ON recruitment_applications
  FOR UPDATE TO authenticated
  USING (applicant_id = auth.uid() AND status = 'pending');

-- 프로젝트 리더만 지원 승인/거절
CREATE POLICY "recruitment_apps_update_leader" ON recruitment_applications
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM recruitment_posts rp
      WHERE rp.id = recruitment_id AND is_project_leader(rp.project_id)
    )
  );

-- ----------------------------------------------------------------------------
-- 마일스톤 (milestones) 정책
-- ----------------------------------------------------------------------------
CREATE POLICY "milestones_select" ON milestones
  FOR SELECT TO authenticated
  USING (is_active_member());

CREATE POLICY "milestones_insert" ON milestones
  FOR INSERT TO authenticated
  WITH CHECK (is_project_leader(project_id));

CREATE POLICY "milestones_update" ON milestones
  FOR UPDATE TO authenticated
  USING (is_project_leader(project_id));

CREATE POLICY "milestones_delete" ON milestones
  FOR DELETE TO authenticated
  USING (is_project_leader(project_id));

-- ----------------------------------------------------------------------------
-- 칸반 컬럼 (board_columns) 정책
-- ----------------------------------------------------------------------------
-- 공개 보드이거나 팀원인 경우 조회
CREATE POLICY "board_columns_select" ON board_columns
  FOR SELECT TO authenticated
  USING (
    is_project_member(project_id) 
    OR (is_active_member() AND EXISTS (
      SELECT 1 FROM projects WHERE id = project_id AND is_board_public = TRUE
    ))
    OR is_admin()
  );

CREATE POLICY "board_columns_insert" ON board_columns
  FOR INSERT TO authenticated
  WITH CHECK (is_project_leader(project_id));

CREATE POLICY "board_columns_update" ON board_columns
  FOR UPDATE TO authenticated
  USING (is_project_leader(project_id));

CREATE POLICY "board_columns_delete" ON board_columns
  FOR DELETE TO authenticated
  USING (is_project_leader(project_id));

-- ----------------------------------------------------------------------------
-- 작업 카드 (task_cards) 정책
-- ----------------------------------------------------------------------------
CREATE POLICY "task_cards_select" ON task_cards
  FOR SELECT TO authenticated
  USING (
    is_project_member(project_id) 
    OR (is_active_member() AND EXISTS (
      SELECT 1 FROM projects WHERE id = project_id AND is_board_public = TRUE
    ))
    OR is_admin()
  );

-- 팀원만 카드 생성/수정/이동
CREATE POLICY "task_cards_insert" ON task_cards
  FOR INSERT TO authenticated
  WITH CHECK (is_project_member(project_id));

CREATE POLICY "task_cards_update" ON task_cards
  FOR UPDATE TO authenticated
  USING (is_project_member(project_id));

CREATE POLICY "task_cards_delete" ON task_cards
  FOR DELETE TO authenticated
  USING (is_project_leader(project_id));

-- ----------------------------------------------------------------------------
-- 작업 담당자 (task_assignees) 정책
-- ----------------------------------------------------------------------------
CREATE POLICY "task_assignees_select" ON task_assignees
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM task_cards tc 
      WHERE tc.id = card_id 
      AND (
        is_project_member(tc.project_id)
        OR (is_active_member() AND EXISTS (
          SELECT 1 FROM projects WHERE id = tc.project_id AND is_board_public = TRUE
        ))
      )
    )
  );

CREATE POLICY "task_assignees_insert" ON task_assignees
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM task_cards tc 
      WHERE tc.id = card_id AND is_project_member(tc.project_id)
    )
  );

CREATE POLICY "task_assignees_delete" ON task_assignees
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM task_cards tc 
      WHERE tc.id = card_id AND is_project_member(tc.project_id)
    )
  );

-- ----------------------------------------------------------------------------
-- 빌드 (builds) 정책
-- ----------------------------------------------------------------------------
-- 활성 회원은 빌드 조회 가능 (플레이/다운로드)
CREATE POLICY "builds_select" ON builds
  FOR SELECT TO authenticated
  USING (is_active_member() AND is_deleted = FALSE);

-- 팀원만 빌드 업로드
CREATE POLICY "builds_insert" ON builds
  FOR INSERT TO authenticated
  WITH CHECK (is_project_member(project_id) AND uploader_id = auth.uid());

-- 업로더 본인 또는 리더만 수정
CREATE POLICY "builds_update" ON builds
  FOR UPDATE TO authenticated
  USING (uploader_id = auth.uid() OR is_project_leader(project_id));

-- 업로더 본인 또는 리더 또는 운영진만 삭제
CREATE POLICY "builds_delete" ON builds
  FOR DELETE TO authenticated
  USING (uploader_id = auth.uid() OR is_project_leader(project_id) OR is_admin());

-- ----------------------------------------------------------------------------
-- 평점 (ratings) 정책
-- PRD F5-3: 팀원은 자기 프로젝트 빌드에 평점 불가
-- ----------------------------------------------------------------------------
CREATE POLICY "ratings_select" ON ratings
  FOR SELECT TO authenticated
  USING (is_active_member());

-- 평점 생성: 본인 빌드가 아닌 경우만
CREATE POLICY "ratings_insert" ON ratings
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() 
    AND is_active_member()
    AND NOT is_build_project_member(build_id)
  );

-- 본인 평점만 수정
CREATE POLICY "ratings_update" ON ratings
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND NOT is_build_project_member(build_id));

-- 본인 평점만 삭제
CREATE POLICY "ratings_delete" ON ratings
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 피드백 코멘트 (feedback_comments) 정책
-- ----------------------------------------------------------------------------
CREATE POLICY "feedback_comments_select" ON feedback_comments
  FOR SELECT TO authenticated
  USING (is_active_member() AND (is_hidden = FALSE OR author_id = auth.uid() OR is_admin()));

CREATE POLICY "feedback_comments_insert" ON feedback_comments
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND is_active_member());

-- 본인 코멘트 수정
CREATE POLICY "feedback_comments_update_own" ON feedback_comments
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid());

-- 운영진은 숨김 처리 가능
CREATE POLICY "feedback_comments_update_admin" ON feedback_comments
  FOR UPDATE TO authenticated
  USING (is_admin());

CREATE POLICY "feedback_comments_delete" ON feedback_comments
  FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR is_admin());

-- ----------------------------------------------------------------------------
-- 버그 리포트 (bug_reports) 정책
-- ----------------------------------------------------------------------------
CREATE POLICY "bug_reports_select" ON bug_reports
  FOR SELECT TO authenticated
  USING (is_active_member() AND (is_hidden = FALSE OR reporter_id = auth.uid() OR is_admin()));

CREATE POLICY "bug_reports_insert" ON bug_reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid() AND is_active_member());

-- 본인 리포트 수정
CREATE POLICY "bug_reports_update_own" ON bug_reports
  FOR UPDATE TO authenticated
  USING (reporter_id = auth.uid());

-- 팀원은 버그 상태 변경 가능
CREATE POLICY "bug_reports_update_team" ON bug_reports
  FOR UPDATE TO authenticated
  USING (is_build_project_member(build_id));

-- 운영진은 숨김 처리 가능
CREATE POLICY "bug_reports_update_admin" ON bug_reports
  FOR UPDATE TO authenticated
  USING (is_admin());

CREATE POLICY "bug_reports_delete" ON bug_reports
  FOR DELETE TO authenticated
  USING (reporter_id = auth.uid() OR is_admin());

-- ----------------------------------------------------------------------------
-- 버그 스크린샷 (bug_report_screenshots) 정책
-- ----------------------------------------------------------------------------
CREATE POLICY "bug_screenshots_select" ON bug_report_screenshots
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bug_reports br 
      WHERE br.id = bug_report_id 
      AND (br.is_hidden = FALSE OR br.reporter_id = auth.uid() OR is_admin())
    )
  );

CREATE POLICY "bug_screenshots_insert" ON bug_report_screenshots
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bug_reports br 
      WHERE br.id = bug_report_id AND br.reporter_id = auth.uid()
    )
  );

CREATE POLICY "bug_screenshots_delete" ON bug_report_screenshots
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bug_reports br 
      WHERE br.id = bug_report_id 
      AND (br.reporter_id = auth.uid() OR is_admin())
    )
  );

-- ----------------------------------------------------------------------------
-- 감사 로그 (audit_logs) 정책
-- 운영진만 조회 가능
-- ----------------------------------------------------------------------------
CREATE POLICY "audit_logs_select" ON audit_logs
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "audit_logs_insert" ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());
