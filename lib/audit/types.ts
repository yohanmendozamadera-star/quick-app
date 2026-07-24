export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "import"
  | "export"
  | "status_change"
  | "restore";

export type AuditLogRow = {
  id: string;
  user_id: string | null;
  action: AuditAction;
  module: string;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
  user: { full_name: string } | null;
};
