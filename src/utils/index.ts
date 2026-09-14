import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, isPast, isToday, isYesterday } from 'date-fns';
import { ar } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Safe Date Parser ─────────────────────────────────────────────────────────

export function safeDate(date: any): Date {
  if (!date) return new Date();
  if (date instanceof Date) return date;
  if (typeof date.toDate === 'function') return date.toDate();
  if (typeof date.toMillis === 'function') return new Date(date.toMillis());
  if (typeof date === 'number') return new Date(date);
  if (typeof date === 'string') {
    const parsed = new Date(date);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }
  return new Date();
}

// ─── Date Formatting ──────────────────────────────────────────────────────────

export function formatDate(date: any): string {
  try {
    return format(safeDate(date), 'd MMM yyyy', { locale: ar });
  } catch {
    return 'غير محدد';
  }
}

export function formatDateShort(date: any): string {
  try {
    return format(safeDate(date), 'd MMM', { locale: ar });
  } catch {
    return 'غير محدد';
  }
}

export function formatDateTime(date: any): string {
  try {
    return format(safeDate(date), 'd MMM yyyy · h:mm a', { locale: ar });
  } catch {
    return 'غير محدد';
  }
}

export function formatRelative(date: any): string {
  try {
    const d = safeDate(date);
    if (isToday(d)) return formatDistanceToNow(d, { addSuffix: true, locale: ar });
    if (isYesterday(d)) return 'أمس';
    return format(d, 'd MMM yyyy', { locale: ar });
  } catch {
    return 'غير محدد';
  }
}

export function isOverdue(deadline: any, status: string): boolean {
  try {
    if (!deadline) return false;
    const d = safeDate(deadline);
    return isPast(d) && status !== 'approved' && status !== 'completed' && status !== 'archived';
  } catch {
    return false;
  }
}

export function getDaysUntil(date: any): number {
  try {
    const d = safeDate(date);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
}

// ─── Number Formatting ────────────────────────────────────────────────────────

export function formatOCoins(amount: number): string {
  return new Intl.NumberFormat('en-US').format(amount || 0);
}

export function formatPercent(value: number): string {
  return `${(value || 0).toFixed(1)}%`;
}

// ─── Greeting ─────────────────────────────────────────────────────────────────

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'صباح الخير';
  if (hour < 17) return 'مساء الخير';
  return 'مساء الخير';
}

// ─── First Name ───────────────────────────────────────────────────────────────

export function getFirstName(displayName: string): string {
  return (displayName || 'المستخدم').split(' ')[0] || displayName || 'المستخدم';
}

// ─── Task Status ──────────────────────────────────────────────────────────────

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'مسودة',
    pending: 'قيد الانتظار',
    in_progress: 'قيد التنفيذ',
    submitted: 'تم التسليم',
    approved: 'مقبولة',
    completed: 'مكتملة',
    expired: 'منتهية',
    archived: 'مؤرشفة',
    rejected: 'مرفوضة',
  };
  return labels[status] || status || 'قيد الانتظار';
}

export function getPriorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    urgent: 'عاجل جداً',
    high: 'أولوية عالية',
    medium: 'متوسط',
    low: 'منخفض',
  };
  return labels[priority] || priority || 'متوسط';
}

// ─── Initials ─────────────────────────────────────────────────────────────────

export function getInitials(name: string): string {
  if (!name) return 'م';
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .join('')
    .slice(0, 2);
}

// ─── Notification Icons ───────────────────────────────────────────────────────

export function getNotificationEmoji(type: string): string {
  const emojiMap: Record<string, string> = {
    task_assigned: '📋',
    task_approved: '✅',
    task_rejected: '❌',
    task_submitted: '📤',
    ocoin_added: '🪙',
    ocoin_removed: '💸',
    deadline_approaching: '⏰',
    deadline_changed: '📅',
    'ban.suspended': '⛔',
    'ban.lifted': '🟢',
    'meeting.created': '📅',
    'meeting.updated': '✏️',
    'meeting.cancelled': '🚫',
    'opportunity.created': '🎓',
    'opportunity.updated': '💡',
    discount_purchased: '🎟️',
    course_published: '📚',
    support_ticket_created: '🎫',
    support_ticket_reply: '💬',
    support_ticket_status: '🔄',
    support_ticket_assigned: '👤',
  };
  return emojiMap[type] || '🔔';
}
