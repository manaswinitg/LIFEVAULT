export interface UserProfile {
  phone: string;
  timezone: string;
  storage_used_bytes: number;
  storage_limit_bytes: number;
  notification_email_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  is_verified: boolean;
  two_factor_enabled: boolean;
  profile?: UserProfile;
  created_at: string;
  updated_at: string;
}

export interface DocumentCategory {
  id: string;
  name: string;
  display_name: string;
  description: string;
  icon: string;
  is_system: boolean;
}

export interface DocumentTag {
  id: string;
  name: string;
  color: string;
}

export interface DocumentVersion {
  id: string;
  version_number: number;
  version_notes: string;
  uploaded_by_email: string;
  file_size: number;
  sha256_hash: string;
  created_at: string;
}

export interface DocumentItem {
  id: string;
  title: string;
  description: string;
  category: DocumentCategory | null;
  category_id?: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  sha256_hash: string;
  current_version: number;
  issue_date: string | null;
  expiry_date: string | null;
  issuer: string;
  reference_number?: string;
  tags: DocumentTag[];
  versions?: DocumentVersion[];
  is_archived: boolean;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShareAccessLog {
  id: string;
  accessed_by_email?: string;
  ip_address: string;
  user_agent: string;
  action: string;
  success: boolean;
  accessed_at: string;
}

export interface ShareGrant {
  id: string;
  document_id: string;
  document_title: string;
  owner_email: string;
  shared_with_email: string | null;
  permission: 'view' | 'download';
  expires_at: string | null;
  max_downloads: number | null;
  download_count: number;
  is_revoked: boolean;
  revoked_at: string | null;
  created_at: string;
  access_logs?: ShareAccessLog[];
  access_token?: string;
  share_url?: string;
}

export interface NotificationItem {
  id: string;
  document_id: string | null;
  document_title: string | null;
  title: string;
  message: string;
  notification_type: 'expiry' | 'share' | 'emergency' | 'security' | 'system';
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface TrustedContact {
  id: string;
  contact_name: string;
  contact_email: string;
  phone: string;
  relationship: string;
  is_verified: boolean;
  created_at: string;
}

export interface EmergencyAccessPolicy {
  id: string;
  trusted_contact: TrustedContact;
  waiting_period_hours: number;
  can_access_all: boolean;
  specific_documents?: DocumentItem[];
  is_active: boolean;
  created_at: string;
}

export interface EmergencyAccessRequest {
  id: string;
  policy_id: string;
  contact_name: string;
  contact_email: string;
  owner_email: string;
  status: 'pending' | 'approved' | 'cancelled' | 'rejected' | 'expired';
  trigger_reason: string;
  requested_at: string;
  cancellation_deadline: string;
  approved_at: string | null;
  expires_at: string | null;
}

export interface AuditEventItem {
  id: string;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_id: string;
  ip_address: string;
  user_agent: string;
  details: Record<string, any>;
  prev_hash: string;
  current_hash: string;
  timestamp: string;
}

export interface DashboardSummary {
  total_documents: number;
  archived_count: number;
  storage_used_bytes: number;
  storage_limit_bytes: number;
  category_distribution: {
    id: string;
    name: string;
    display_name: string;
    icon: string;
    count: number;
  }[];
  recent_documents: DocumentItem[];
  upcoming_expirations: DocumentItem[];
  active_shares_count: number;
  unresolved_reminders_count: number;
  unread_notifications_count: number;
  recent_audit_events: AuditEventItem[];
}
