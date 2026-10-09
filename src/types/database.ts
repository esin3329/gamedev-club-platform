export type MemberStatus = 'pending' | 'active' | 'dormant' | 'withdrawn' | 'rejected';
export type GlobalRole = 'admin' | 'member';
export type ProjectRole = 'leader' | 'member';
export type Position = 'planning' | 'programming' | 'art' | 'sound';
export type ProjectStatus = 'planning' | 'recruiting' | 'developing' | 'completed' | 'paused' | 'archived';
export type Engine = 'unity' | 'unreal' | 'godot' | 'other';
export type BuildType = 'webgl' | 'pc';
export type BuildOS = 'windows' | 'macos' | 'linux';
export type BugSeverity = 'critical' | 'high' | 'medium' | 'low';
export type BugStatus = 'new' | 'confirmed' | 'in_progress' | 'fixed' | 'cannot_reproduce' | 'deferred';
export type RecruitmentStatus = 'open' | 'filled' | 'closed';
export type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface Database {
  public: {
    Tables: {
      cohorts: {
        Row: {
          id: string;
          name: string;
          start_date: string | null;
          end_date: string | null;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['cohorts']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['cohorts']['Insert']>;
      };
      profiles: {
        Row: {
          id: string;
          email: string | null;
          name: string | null;
          nickname: string | null;
          avatar_url: string | null;
          primary_position: Position | null;
          engines: Engine[];
          external_links: Record<string, string>;
          cohort_id: string | null;
          global_role: GlobalRole;
          status: MemberStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      membership_applications: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          student_id: string | null;
          desired_position: Position | null;
          introduction: string | null;
          status: ApplicationStatus;
          reviewer_id: string | null;
          reviewed_at: string | null;
          rejection_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['membership_applications']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['membership_applications']['Insert']>;
      };
      projects: {
        Row: {
          id: string;
          name: string;
          tagline: string;
          description: string | null;
          genres: string[];
          engine: Engine;
          status: ProjectStatus;
          thumbnail_url: string | null;
          external_links: Record<string, string>;
          is_board_public: boolean;
          featured_build_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['projects']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['projects']['Insert']>;
      };
      project_members: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          role: ProjectRole;
          position: Position;
          joined_at: string;
          left_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['project_members']['Row'], 'id' | 'joined_at'>;
        Update: Partial<Database['public']['Tables']['project_members']['Insert']>;
      };
      recruitment_posts: {
        Row: {
          id: string;
          project_id: string;
          position: Position;
          slots: number;
          description: string | null;
          deadline: string | null;
          status: RecruitmentStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['recruitment_posts']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['recruitment_posts']['Insert']>;
      };
      recruitment_applications: {
        Row: {
          id: string;
          recruitment_id: string;
          applicant_id: string;
          introduction: string;
          portfolio_url: string | null;
          status: ApplicationStatus;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['recruitment_applications']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['recruitment_applications']['Insert']>;
      };
      milestones: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          description: string | null;
          target_date: string | null;
          is_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['milestones']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['milestones']['Insert']>;
      };
      board_columns: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          position: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['board_columns']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['board_columns']['Insert']>;
      };
      task_cards: {
        Row: {
          id: string;
          project_id: string;
          column_id: string;
          milestone_id: string | null;
          title: string;
          description: string | null;
          position_tags: Position[];
          due_date: string | null;
          card_order: number;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['task_cards']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['task_cards']['Insert']>;
      };
      task_assignees: {
        Row: {
          id: string;
          card_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['task_assignees']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['task_assignees']['Insert']>;
      };
      builds: {
        Row: {
          id: string;
          project_id: string;
          version: string;
          build_type: BuildType;
          target_os: BuildOS | null;
          release_notes: string | null;
          test_request: string | null;
          storage_key: string;
          file_size: number;
          uploader_id: string;
          download_count: number;
          play_count: number;
          is_deleted: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['builds']['Row'], 'id' | 'download_count' | 'play_count' | 'is_deleted' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['builds']['Insert']>;
      };
      ratings: {
        Row: {
          id: string;
          build_id: string;
          user_id: string;
          overall_score: number;
          controls_score: number | null;
          graphics_score: number | null;
          sound_score: number | null;
          difficulty_score: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['ratings']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['ratings']['Insert']>;
      };
      feedback_comments: {
        Row: {
          id: string;
          build_id: string;
          author_id: string;
          content: string;
          parent_id: string | null;
          is_hidden: boolean;
          hidden_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['feedback_comments']['Row'], 'id' | 'is_hidden' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['feedback_comments']['Insert']>;
      };
      bug_reports: {
        Row: {
          id: string;
          build_id: string;
          reporter_id: string;
          title: string;
          steps_to_reproduce: string;
          expected_result: string | null;
          actual_result: string | null;
          severity: BugSeverity;
          status: BugStatus;
          environment_info: Record<string, string>;
          linked_card_id: string | null;
          is_hidden: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['bug_reports']['Row'], 'id' | 'status' | 'is_hidden' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['bug_reports']['Insert']>;
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string;
          action_type: string;
          target_type: string;
          target_id: string;
          details: Record<string, unknown>;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['audit_logs']['Row'], 'id' | 'created_at'>;
        Update: never;
      };
    };
    Enums: {
      member_status: MemberStatus;
      global_role: GlobalRole;
      project_role: ProjectRole;
      position_type: Position;
      project_status: ProjectStatus;
      engine_type: Engine;
      build_type: BuildType;
      build_os: BuildOS;
      bug_severity: BugSeverity;
      bug_status: BugStatus;
      recruitment_status: RecruitmentStatus;
      application_status: ApplicationStatus;
    };
  };
}
