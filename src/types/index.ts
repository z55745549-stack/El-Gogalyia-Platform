// ─── Timestamp compatibility ─────────────────────────────────────────────────
// Supports both Timestamp objects and ISO string dates (Supabase)
export interface Timestamp {
  seconds: number;
  nanoseconds: number;
  toDate(): Date;
  toMillis(): number;
}

// ─── User & Auth ────────────────────────────────────────────────────────────

export type UserRole =
  | 'lead'       // LEAD - قائد المنصة (أعلى سلطة وصلاحيات كاملة على كل شيء)
  | 'co_lead'    // CO-LEAD - نائب القائد (صلاحيات كاملة فوق السوبر أدمن)
  | 'head'       // HEAD - رئيس لجنة (بديل السوبر أدمن - إدارة المنصة واللجان)
  | 'vice_head'  // VICE-HEAD / CO-HEAD - نائب رئيس لجنة (مهام وحضور مثل الموظف)
  | 'member'     // MEMBER - عضو (بديل رتبة الموظف)
  // Legacy aliases
  | 'superAdmin'
  | 'admin'
  | 'employee';
export type UserStatus = 'active' | 'inactive' | 'suspended';

export interface AuthorizedUser {
  email?: string;
  username: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  permissions: Permission[];
  status: UserStatus;
  uid: string | null;
  createdAt: Timestamp;
  createdBy: string;
}

export interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  email?: string;
  photoURL?: string;
  role: UserRole;
  permissions: Permission[];
  status: UserStatus;
  committeeId?: string | null;
  committeeName?: string | null;
  passwordHash?: string;
  salt?: string;
  googleLinkedEmail?: string;
  isTwoFactorEnabled?: boolean;
  googleLinkedUid?: string;
  employeeCode?: string; // Unique permanent attendance code e.g. GOGA-33001
  oCoinsBalance: number;
  createdAt: Timestamp | string;
  updatedAt?: Timestamp | string;
}

// ─── Committees ───────────────────────────────────────────────────────────────

export type CommitteeStatus = 'active' | 'archived';

export interface Committee {
  id: string;
  name: string;
  slug: string;
  description?: string;
  color: string; // hex e.g. #7C00FE
  icon?: string;
  status: CommitteeStatus;
  memberCount?: number;
  createdAt: Timestamp | string;
  updatedAt?: Timestamp | string;
  createdBy: string;
}

export const DEFAULT_COMMITTEES: Omit<Committee, 'createdAt' | 'createdBy'>[] = [
  { id: 'operation', name: 'Operation', slug: 'operation', description: 'Logistics, event operations & field execution', color: '#F5004F', status: 'active' },
  { id: 'pr-media', name: 'PR-Media', slug: 'pr-media', description: 'Public relations, social media, photography & coverage', color: '#7C00FE', status: 'active' },
  { id: 'hr', name: 'HR', slug: 'hr', description: 'Human resources, member engagement & team performance', color: '#06B6D4', status: 'active' },
  { id: 'service-dev', name: 'Service Dev', slug: 'service-dev', description: 'Service design, operations development & workflow optimization', color: '#0ea5e9', status: 'active' },
  { id: 'teaching', name: 'Teaching', slug: 'teaching', description: 'Curriculum development, workshops, instructors & mentoring', color: '#FFAF00', status: 'active' },
  { id: 'moderator', name: 'Moderator', slug: 'moderator', description: 'Community moderation, quality control & platform support', color: '#ec4899', status: 'active' },
  { id: 'tech-dev', name: 'Tech Dev', slug: 'tech-dev', description: 'System software development, technical tools & infrastructure', color: '#10b981', status: 'active' },
  { id: 'students-affairs', name: 'Students Affairs', slug: 'students-affairs', description: 'Student support, registrations & member affairs', color: '#8b5cf6', status: 'active' },
];

// ─── Permissions ─────────────────────────────────────────────────────────────

export type Permission =
  | 'tasks.create'
  | 'tasks.edit'
  | 'tasks.delete'
  | 'tasks.assign'
  | 'tasks.review'
  | 'tasks.view_all'
  | 'employees.view'
  | 'employees.manage'
  | 'ocoins.manage'
  | 'ocoins.view_all'
  | 'reports.view'
  | 'reports.export'
  | 'access.manage'
  | 'activity.view'
  | 'notifications.send';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  lead: [
    'tasks.create', 'tasks.edit', 'tasks.delete', 'tasks.assign',
    'tasks.review', 'tasks.view_all',
    'employees.view', 'employees.manage',
    'ocoins.manage', 'ocoins.view_all',
    'reports.view', 'reports.export',
    'access.manage',
    'activity.view',
    'notifications.send',
  ],
  co_lead: [
    'tasks.create', 'tasks.edit', 'tasks.delete', 'tasks.assign',
    'tasks.review', 'tasks.view_all',
    'employees.view', 'employees.manage',
    'ocoins.manage', 'ocoins.view_all',
    'reports.view', 'reports.export',
    'access.manage',
    'activity.view',
    'notifications.send',
  ],
  superAdmin: [
    'tasks.create', 'tasks.edit', 'tasks.delete', 'tasks.assign',
    'tasks.review', 'tasks.view_all',
    'employees.view', 'employees.manage',
    'ocoins.manage', 'ocoins.view_all',
    'reports.view', 'reports.export',
    'access.manage',
    'activity.view',
    'notifications.send',
  ],
  head: [
    'tasks.create', 'tasks.edit', 'tasks.delete', 'tasks.assign',
    'tasks.review', 'tasks.view_all',
    'employees.view', 'employees.manage',
    'ocoins.manage', 'ocoins.view_all',
    'reports.view', 'reports.export',
    'access.manage',
    'activity.view',
    'notifications.send',
  ],
  vice_head: [
    'tasks.create', 'tasks.edit', 'tasks.assign',
    'tasks.review', 'tasks.view_all',
    'employees.view',
    'notifications.send',
  ],
  admin: [
    'tasks.create', 'tasks.edit', 'tasks.delete', 'tasks.assign',
    'tasks.review', 'tasks.view_all',
    'employees.view', 'employees.manage',
    'ocoins.manage', 'ocoins.view_all',
    'reports.view', 'reports.export',
    'access.manage',
    'activity.view',
    'notifications.send',
  ],
  member: [],
  employee: [],
};

export interface AuthorizedAdmin {
  id: string; // doc id (usually email normalized)
  email: string;
  displayName?: string;
  role: UserRole;
  status: 'active' | 'inactive';
  createdAt: Timestamp | string;
  createdBy?: string;
  lastLogin?: Timestamp | string;
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';
export type TaskStatus =
  | 'draft'
  | 'pending'
  | 'in_progress'
  | 'submitted'
  | 'approved'
  | 'completed'
  | 'expired'
  | 'archived';

export interface TaskAttachment {
  name: string;
  url: string;
  size: number;
  type: string;
}

export interface TaskSubmission {
  id: string;
  submittedBy: string;
  submittedByName: string;
  submittedByPhoto: string;
  files: TaskAttachment[];
  note: string;
  submittedAt: Timestamp;
  reviewedBy: string | null;
  reviewedByName: string | null;
  reviewedAt: Timestamp | null;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason: string | null;
}

export interface UserTaskStatus {
  status: TaskStatus | 'pending' | 'in_progress' | 'submitted' | 'approved' | 'rejected';
  submissionId?: string;
  submittedAt?: Timestamp | string;
  reviewedBy?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: Timestamp | string | null;
  rejectionReason?: string | null;
  oCoinsAwarded?: number;
  note?: string;
  files?: TaskAttachment[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  requirements: string;
  priority: TaskPriority;
  deadline: Timestamp;
  oCoinsReward: number;
  status: TaskStatus;
  assignedTo: string[];           // array of stable user UIDs (legacy may contain username/email lowercased)
  assignedToNames: string[];
  createdBy: string;
  createdByName: string;
  committeeId?: string | null;
  committeeName?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  attachments: TaskAttachment[];
  latestSubmission: TaskSubmission | null;
  userStatuses?: Record<string, UserTaskStatus>;
}

export interface CreateTaskData {
  title: string;
  description: string;
  requirements: string;
  priority: TaskPriority;
  deadline: Date;
  oCoinsReward: number;
  assignedTo: string[];
  attachments?: File[];
}

// ─── Opportunities & Training (الفرص والتدريبات) ──────────────────────────────

export type OpportunityCategory = 'training' | 'job' | 'scholarship' | 'workshop' | 'competition';
export type OpportunityStatus = 'active' | 'expired' | 'closed';

export interface Opportunity {
  id: string;
  title: string;
  provider: string; // جهة التدريب / المؤسسة
  description: string;
  requirements?: string;
  applicationUrl: string;
  deadline: Timestamp | string;
  category: OpportunityCategory;
  status: OpportunityStatus;
  isTeamExclusive?: boolean; // Always true for team members
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp | string;
  updatedAt?: Timestamp | string;
}

// ─── Bans ────────────────────────────────────────────────────────────────────

export type BanStatus = 'active' | 'expired' | 'ended_early';

export interface Ban {
  id: string;
  employeeId: string; // uid
  employeeUsername: string;
  employeeName: string;
  employeePhoto?: string;
  committeeId?: string | null;
  createdBy: string; // admin uid/email
  createdByName: string;
  startAt: Timestamp | string;
  endAt: Timestamp | string;
  reason: string;
  internalNote?: string;
  status: BanStatus;
  coinPenalty: number;
  createdAt: Timestamp | string;
  endedAt?: Timestamp | string | null;
  endedBy?: string | null;
  endedByName?: string | null;
}

// ─── Meetings ─────────────────────────────────────────────────────────────────

export type MeetingType = 'general' | 'committee' | 'training' | 'review';
export type MeetingStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface Meeting {
  id: string;
  title: string;
  description: string;
  date: Timestamp | string; // start date
  startTime: string; // e.g. "19:00"
  durationMinutes: number;
  endTime?: string;
  location: string;
  type: MeetingType;
  status: MeetingStatus;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp | string;
  updatedAt?: Timestamp | string;
}

// ─── O Coins ─────────────────────────────────────────────────────────────────

export type OCoinTransactionType =
  | 'manual_reward'
  | 'manual_add'
  | 'manual_remove'
  | 'task_reward'
  | 'task_approved'
  | 'meeting_reward'
  | 'achievement_reward'
  | 'admin_adjustment'
  | 'penalty_deduction'
  | 'ban_penalty'
  | 'discount_purchase'
  | 'shop_purchase'
  | 'refund'
  | 'system_reward';

export interface OCoinTransaction {
  id: string;
  userEmail: string;
  userDisplayName: string;
  uid: string;
  employeeId?: string;
  employeeName?: string;
  amount: number;
  type: OCoinTransactionType;
  reason: string;
  description?: string;
  taskId?: string | null;
  taskTitle?: string | null;
  discountId?: string | null;
  discountTitle?: string | null;
  referenceId?: string | null;
  referenceType?: 'task' | 'discount' | 'meeting' | 'ban' | 'admin';
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp | string;
  source?: string;
  previousBalance?: number;
  newBalance?: number;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationType =
  | 'task_assigned'
  | 'task_approved'
  | 'task_rejected'
  | 'task_submitted'
  | 'ocoin_added'
  | 'ocoin_removed'
  | 'deadline_approaching'
  | 'deadline_changed'
  | 'ban.suspended'
  | 'ban.lifted'
  | 'meeting.created'
  | 'meeting.updated'
  | 'meeting.cancelled'
  | 'opportunity.created'
  | 'opportunity.updated'
  | 'discount_purchased'
  | 'course_published'
  | 'support_ticket_created'
  | 'support_ticket_reply'
  | 'support_ticket_status'
  | 'support_ticket_assigned';

export interface Notification {
  id: string;
  recipientEmail: string;
  recipientUid: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  taskId: string | null;
  ticketId?: string | null;
  relatedEntityType?: 'task' | 'ticket' | 'meeting' | 'opportunity' | 'ocoin' | 'discount' | 'course' | 'system';
  relatedEntityId?: string | null;
  actionUrl?: string | null;
  createdAt: Timestamp;
}

// ─── Activity Logs ────────────────────────────────────────────────────────────

export type ActivityAction =
  | 'task.created'
  | 'task.updated'
  | 'task.deleted'
  | 'task.assigned'
  | 'task.submitted'
  | 'task.approved'
  | 'task.rejected'
  | 'task.status_changed'
  | 'ocoin.awarded'
  | 'ocoin.manual_add'
  | 'ocoin.manual_remove'
  | 'ocoin.ban_penalty'
  | 'ocoin.discount_purchase'
  | 'discount.created'
  | 'discount.updated'
  | 'discount.deleted'
  | 'discount.purchased'
  | 'discount.status_changed'
  | 'course.created'
  | 'course.updated'
  | 'course.deleted'
  | 'course.published'
  | 'course.status_changed'
  | 'course.playlist_synced'
  | 'category.created'
  | 'category.updated'
  | 'category.deleted'
  | 'user.created'
  | 'user.role_changed'
  | 'user.status_changed'
  | 'user.removed'
  | 'user.permissions_changed'
  | 'user.banned'
  | 'user.unbanned'
  | 'committee.created'
  | 'committee.updated'
  | 'meeting.created'
  | 'meeting.updated'
  | 'meeting.deleted'
  | 'opportunity.created'
  | 'opportunity.updated'
  | 'opportunity.deleted'
  | 'ticket.created'
  | 'ticket.replied'
  | 'ticket.status_changed'
  | 'ticket.assigned';

export interface ActivityLog {
  id: string;
  actor: string;
  actorName: string;
  actorPhoto: string;
  action: ActivityAction;
  targetType: 'task' | 'user' | 'ocoin' | 'system' | 'ban' | 'meeting' | 'committee' | 'opportunity' | 'ticket' | 'discount' | 'course' | 'course_category';
  targetId: string;
  targetName: string;
  metadata: Record<string, unknown>;
  timestamp: Timestamp;
}

export * from './discounts';
export * from './courses';

// ─── Reports ─────────────────────────────────────────────────────────────────

export interface OverallReport {
  totalEmployees: number;
  activeEmployees: number;
  totalTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  submittedTasks: number;
  completedTasks: number;
  overdueTasks: number;
  totalOCoinsDistributed: number;
  averageCompletionRate: number;
}

export interface EmployeeReport {
  email: string;
  displayName: string;
  photoURL: string;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  submittedTasks: number;
  overdueTasks: number;
  completionRate: number;
  totalOCoins: number;
}

// ─── UI State ─────────────────────────────────────────────────────────────────

export type DateFilter = 'today' | 'week' | 'month' | 'custom';

export interface DateRange {
  from: Date;
  to: Date;
}
