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

function getCurrentLanguage(): 'ar' | 'en' {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('elgogalyia_lang');
      if (saved === 'en' || saved === 'ar') return saved;
      if (document.documentElement.lang === 'en') return 'en';
    } catch {
      // ignore
    }
  }
  return 'ar';
}

// ─── Date Formatting ──────────────────────────────────────────────────────────

export function formatDate(date: any, lang?: 'ar' | 'en'): string {
  const l = lang || getCurrentLanguage();
  try {
    return format(safeDate(date), 'd MMM yyyy', l === 'ar' ? { locale: ar } : undefined);
  } catch {
    return l === 'en' ? 'Not specified' : 'غير محدد';
  }
}

export function formatDateShort(date: any, lang?: 'ar' | 'en'): string {
  const l = lang || getCurrentLanguage();
  try {
    return format(safeDate(date), 'd MMM', l === 'ar' ? { locale: ar } : undefined);
  } catch {
    return l === 'en' ? 'Not specified' : 'غير محدد';
  }
}

export function formatDateTime(date: any, lang?: 'ar' | 'en'): string {
  const l = lang || getCurrentLanguage();
  try {
    return format(safeDate(date), 'd MMM yyyy · h:mm a', l === 'ar' ? { locale: ar } : undefined);
  } catch {
    return l === 'en' ? 'Not specified' : 'غير محدد';
  }
}

export function formatRelative(date: any, lang?: 'ar' | 'en'): string {
  const l = lang || getCurrentLanguage();
  try {
    const d = safeDate(date);
    if (isToday(d)) return formatDistanceToNow(d, { addSuffix: true, ...(l === 'ar' ? { locale: ar } : {}) });
    if (isYesterday(d)) return l === 'en' ? 'Yesterday' : 'أمس';
    return format(d, 'd MMM yyyy', l === 'ar' ? { locale: ar } : undefined);
  } catch {
    return l === 'en' ? 'Not specified' : 'غير محدد';
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

/** Returns '∞' for lead/co_lead, otherwise formatted balance */
export function getOCoinsDisplay(role: string | undefined, balance: number): string {
  if (role === 'lead' || role === 'co_lead' || role === 'head') return '∞';
  return formatOCoins(balance);
}

/** Returns true if the role gets unlimited O Coins (Leadership: Lead, Co-Lead, and Committee Heads) */
export function hasUnlimitedCoins(role: string | undefined): boolean {
  return role === 'lead' || role === 'co_lead' || role === 'head';
}


export function formatPercent(value: number): string {
  return `${(value || 0).toFixed(1)}%`;
}

// ─── Greeting ─────────────────────────────────────────────────────────────────

export function getGreeting(lang?: 'ar' | 'en'): string {
  const l = lang || getCurrentLanguage();
  const hour = new Date().getHours();
  if (l === 'en') {
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }
  if (hour < 12) return 'صباح الخير';
  if (hour < 17) return 'مساء الخير';
  return 'مساء الخير';
}

// ─── First Name ───────────────────────────────────────────────────────────────

export function getFirstName(displayName: string, lang?: 'ar' | 'en'): string {
  const fallback = (lang || getCurrentLanguage()) === 'en' ? 'User' : 'المستخدم';
  return (displayName || fallback).split(' ')[0] || displayName || fallback;
}

// ─── Task Status ──────────────────────────────────────────────────────────────

export function getStatusLabel(status: string, lang?: 'ar' | 'en'): string {
  const l = lang || getCurrentLanguage();
  if (l === 'en') {
    const enLabels: Record<string, string> = {
      draft: 'Draft',
      pending: 'Pending',
      in_progress: 'In Progress',
      submitted: 'Submitted',
      approved: 'Approved',
      completed: 'Completed',
      expired: 'Expired',
      archived: 'Archived',
      rejected: 'Revision Requested',
    };
    return enLabels[status] || status || 'Pending';
  }
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

export function getPriorityLabel(priority: string, lang?: 'ar' | 'en'): string {
  const l = lang || getCurrentLanguage();
  if (l === 'en') {
    const enLabels: Record<string, string> = {
      urgent: 'Urgent',
      high: 'High Priority',
      medium: 'Medium',
      low: 'Low',
    };
    return enLabels[priority] || priority || 'Medium';
  }
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

// ─── Name Formatting (Title Case for unified member lists) ────────────────────

export function formatFullName(name: string): string {
  if (!name) return '';
  return name
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

// ─── Arabic Character Detection ───────────────────────────────────────────────

/**
 * Returns true if the string contains any Arabic Unicode character.
 * Used to block Arabic text in username / password fields.
 */
export function hasArabic(value: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(value);
}

/**
 * Formats title case dynamically while typing (preserving trailing spaces)
 */
export function formatTitleCaseLive(input: string): string {
  if (!input) return '';
  return input.replace(/(\b[a-zA-Z])([a-zA-Z]*)/g, (_, first, rest) => {
    return first.toUpperCase() + rest.toLowerCase();
  });
}

// ─── Pinned Leadership & Alphabetical Sorting ─────────────────────────────────

/**
 * Sorts users with context-aware pinned leadership and alphabetical ordering.
 * 
 * Rules:
 * 1. For Lead:
 *    - 1st pinned: Current Lead himself
 *    - 2nd pinned: Co-Lead
 *    - Remaining: Alphabetical by displayName
 * 2. For Co-Lead:
 *    - 1st pinned: Current Co-Lead himself
 *    - 2nd pinned: Lead
 *    - Remaining: Alphabetical by displayName
 * 3. For Head:
 *    - 1st pinned: Current Head himself
 *    - 2nd pinned: Vice-Head of his committee
 *    - Remaining: Alphabetical by displayName
 * 4. For Vice-Head:
 *    - 1st pinned: Current Vice-Head himself
 *    - 2nd pinned: Head of his committee
 *    - Remaining: Alphabetical by displayName
 * 5. For Member / other:
 *    - 1st pinned: Current user himself
 *    - Remaining: Alphabetical by displayName
 */
export function sortUsersWithLeadershipPinned<T extends { uid?: string; id?: string; displayName?: string; role?: string; committeeId?: string | null }>(
  usersList: T[],
  currentUser: { uid?: string; id?: string; role?: string; committeeId?: string | null } | null
): T[] {
  if (!usersList || usersList.length === 0) return [];
  if (!currentUser) {
    return [...usersList].sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '', 'ar', { sensitivity: 'base' }));
  }

  const myId = currentUser.uid || currentUser.id;
  const myRole = currentUser.role;
  const myCommId = currentUser.committeeId;

  const firstPinnedId: string | null = myId || null;
  let secondPinnedPredicate: ((u: T) => boolean) | null = null;

  if (myRole === 'lead') {
    secondPinnedPredicate = (u) => u.role === 'co_lead';
  } else if (myRole === 'co_lead') {
    secondPinnedPredicate = (u) => u.role === 'lead';
  } else if (myRole === 'head') {
    secondPinnedPredicate = (u) => Boolean(myCommId && u.committeeId === myCommId && u.role === 'vice_head');
  } else if (myRole === 'vice_head') {
    secondPinnedPredicate = (u) => Boolean(myCommId && u.committeeId === myCommId && u.role === 'head');
  }

  const firstGroup: T[] = [];
  const secondGroup: T[] = [];
  const restGroup: T[] = [];

  for (const u of usersList) {
    const uId = u.uid || u.id;
    if (firstPinnedId && uId === firstPinnedId) {
      firstGroup.push(u);
    } else if (secondPinnedPredicate && secondPinnedPredicate(u)) {
      secondGroup.push(u);
    } else {
      restGroup.push(u);
    }
  }

  secondGroup.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '', 'ar', { sensitivity: 'base' }));
  restGroup.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '', 'ar', { sensitivity: 'base' }));

  return [...firstGroup, ...secondGroup, ...restGroup];
}
