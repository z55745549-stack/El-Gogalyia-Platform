import { Timestamp } from 'firebase/firestore';

export type TicketCategory =
  | 'technical'      // مشاكل تقنية ونظام
  | 'tasks'          // استفسار أو اعتراض على تكليف
  | 'ocoins'         // استفسار عن رصيد O Coins والمكافآت
  | 'account'        // الحساب وصلاحيات الدخول
  | 'affairs'        // شؤون الأعضاء والطلاب
  | 'general';       // استفسار عام

export type TicketPriority = 'urgent' | 'high' | 'medium' | 'low';

export type TicketStatus =
  | 'open'           // مفتوحة وبانتظار المشرف
  | 'in_progress'    // قيد المتابعة من قبل مشرف
  | 'waiting_user'   // بانتظار رد الموظف
  | 'resolved'       // تم حل المشكلة
  | 'closed';        // مغلقة نهائياً

export interface TicketAttachment {
  name: string;
  url: string;
  size?: number;
  type?: string;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  senderRole: 'superAdmin' | 'admin' | 'employee';
  message: string;
  attachments?: TicketAttachment[];
  isInternalNote: boolean; // strictly visible to admins only
  createdAt: Timestamp | string;
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;     // e.g. #1042
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  
  // Creator (Employee or Admin)
  createdBy: string;        // user uid
  creatorName: string;
  creatorEmail: string;
  creatorPhoto?: string;
  committeeId?: string | null;
  committeeName?: string | null;

  // Assignment
  assignedToAdminId?: string | null;
  assignedToAdminName?: string | null;

  // Metadata
  description: string;
  attachments?: TicketAttachment[];
  createdAt: Timestamp | string;
  updatedAt?: Timestamp | string;
  lastActivityAt?: Timestamp | string;
  resolvedAt?: Timestamp | string | null;
  closedAt?: Timestamp | string | null;
  
  // Stats
  replyCount?: number;
}

export const TICKET_CATEGORY_CONFIG: Record<TicketCategory, { label: string; icon: string; color: string }> = {
  technical: { label: 'مشكلة تقنية بالنظام', icon: 'Wrench', color: '#6C63FF' },
  tasks: { label: 'استفسار أو مراجعة تكليف', icon: 'CheckSquare', color: '#22D3EE' },
  ocoins: { label: 'رصيد ومكافآت O Coins', icon: 'Coins', color: '#F59E0B' },
  account: { label: 'الحساب والأمان', icon: 'Shield', color: '#F43F5E' },
  affairs: { label: 'شؤون الأعضاء والطلاب', icon: 'Users', color: '#3B82F6' },
  general: { label: 'استفسار عام', icon: 'HelpCircle', color: '#64748B' },
};

export const TICKET_STATUS_CONFIG: Record<TicketStatus, { label: string; color: string; badgeClass: string; dot: string }> = {
  open: {
    label: 'مفتوحة وجديدة',
    color: '#F43F5E',
    badgeClass: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    dot: 'bg-rose-500',
  },
  in_progress: {
    label: 'قيد المعالجة والمتابعة',
    color: '#F59E0B',
    badgeClass: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
    dot: 'bg-amber-500',
  },
  waiting_user: {
    label: 'بانتظار ردك',
    color: '#3B82F6',
    badgeClass: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    dot: 'bg-blue-500',
  },
  resolved: {
    label: 'تم الحل بنجاح',
    color: '#10B981',
    badgeClass: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
    dot: 'bg-emerald-500',
  },
  closed: {
    label: 'مغلقة',
    color: '#64748B',
    badgeClass: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    dot: 'bg-slate-500',
  },
};

export const TICKET_PRIORITY_CONFIG: Record<TicketPriority, { label: string; color: string; badgeClass: string }> = {
  urgent: {
    label: 'عاجلة جداً',
    color: '#FF3483',
    badgeClass: 'bg-[#FF3483]/10 text-[#FF3483] border-[#FF3483]/20 font-black',
  },
  high: {
    label: 'أولوية عالية',
    color: '#F97316',
    badgeClass: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border-orange-200 dark:border-orange-800 font-bold',
  },
  medium: {
    label: 'متوسطة',
    color: '#FFCF00',
    badgeClass: 'bg-[#FFCF00]/15 text-amber-800 dark:text-[#FFCF00] border-[#FFCF00]/30 font-medium',
  },
  low: {
    label: 'منخفضة',
    color: '#64748B',
    badgeClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700 font-medium',
  },
};
