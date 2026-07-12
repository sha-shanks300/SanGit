export type RenderStatus = "pending" | "rendering" | "ready" | "failed";
export type ReactionKind = "like" | "dislike";
export type ShareLinkKind = "public" | "private";

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  created_at: string;
}

export type Device = {
  id: string;
  user_id: string;
  name: string;
  token_hash: string;
  last_seen_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export type DevicePairing = {
  id: string;
  user_id: string;
  code: string;
  device_name: string | null;
  expires_at: string;
  claimed_at: string | null;
  created_at: string;
}

export type Project = {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  main_version_id: string | null;
  is_public: boolean;
  artwork_url: string | null;
  created_at: string;
  updated_at: string;
}

export type Branch = {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  parent_branch_id: string | null;
  created_at: string;
}

export type Version = {
  id: string;
  branch_id: string;
  project_id: string;
  user_id: string;
  display_name: string | null;
  file_name: string;
  flp_storage_path: string | null;
  mp3_storage_path: string | null;
  render_status: RenderStatus;
  render_error: string | null;
  flp_sha256: string;
  duration_secs: number | null;
  uploaded_at: string;
  created_at: string;
}

export type Reaction = {
  id: string;
  version_id: string;
  user_id: string;
  kind: ReactionKind;
  created_at: string;
}

export type Favorite = {
  user_id: string;
  project_id: string;
  created_at: string;
}

export type Comment = {
  id: string;
  version_id: string;
  user_id: string;
  body: string;
  created_at: string;
}

export type ShareLink = {
  id: string;
  user_id: string;
  version_id: string | null;
  project_id: string | null;
  token_hash: string;
  kind: ShareLinkKind;
  label: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  max_views: number | null;
  view_count: number;
  created_at: string;
}

type TableDef<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: TableDef<Profile>;
      devices: TableDef<Device>;
      device_pairings: TableDef<DevicePairing>;
      projects: TableDef<Project>;
      branches: TableDef<Branch>;
      versions: TableDef<Version>;
      reactions: TableDef<Reaction>;
      favorites: TableDef<Favorite>;
      comments: TableDef<Comment>;
      share_links: TableDef<ShareLink>;
      link_views: TableDef<{
        id: string;
        share_link_id: string;
        viewed_at: string;
        ip_hash: string | null;
        user_agent: string | null;
      }>;
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      render_status: RenderStatus;
      reaction_kind: ReactionKind;
      share_link_kind: ShareLinkKind;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
