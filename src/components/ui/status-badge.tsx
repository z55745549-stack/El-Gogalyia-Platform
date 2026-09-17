import React from 'react';
import { cn } from '@/utils';
import { useLanguage } from '@/context/LanguageContext';
import type { TaskStatus, TaskPriority } from '@/types';
import { getStatusLabel, getPriorityLabel } from '@/utils';
import { AlertCircle, Clock, CheckCircle2, Send, AlertTriangle, Archive, FileText, Ban } from 'lucide-react';

const statusConfig: Record<TaskStatus, { classes: string; dot: string; icon: React.ReactNode }> = {
  draft: {
    classes: 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)]',
    dot: 'bg-slate-400',
    icon: <FileText className="h-3 w-3 text-slate-400" />
  },
  pending: {
    classes: 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)]',
    dot: 'bg-slate-400',
    icon: <Clock className="h-3 w-3 text-slate-400" />
  },
  in_progress: {
    classes: 'bg-[var(--brand-warm)]/10 text-[var(--brand-warm)] border-[var(--brand-warm)]/25',
    dot: 'bg-[var(--brand-warm)]',
    icon: <Clock className="h-3 w-3 text-[var(--brand-warm)]" />
  },
  submitted: {
    classes: 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border-[var(--brand-primary)]/25',
    dot: 'bg-[var(--brand-primary)]',
    icon: <Send className="h-3 w-3 text-[var(--brand-primary)]" />
  },
  approved: {
    classes: 'bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] border-[var(--brand-accent)]/25',
    dot: 'bg-[var(--brand-accent)]',
    icon: <CheckCircle2 className="h-3 w-3 text-[var(--brand-accent)]" />
  },
  completed: {
    classes: 'bg-[var(--brand-success)]/10 text-[var(--brand-success)] border-[var(--brand-success)]/25',
    dot: 'bg-[var(--brand-success)]',
    icon: <CheckCircle2 className="h-3 w-3 text-[var(--brand-success)]" />
  },
  expired: {
    classes: 'bg-[var(--brand-danger)]/10 text-[var(--brand-danger)] border-[var(--brand-danger)]/25',
    dot: 'bg-[var(--brand-danger)]',
    icon: <Ban className="h-3 w-3 text-[var(--brand-danger)]" />
  },
  archived: {
    classes: 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border-[var(--border-subtle)]',
    dot: 'bg-slate-500',
    icon: <Archive className="h-3 w-3 text-slate-500" />
  },
};

const priorityConfig: Record<TaskPriority, { classes: string; indicator: string; icon: React.ReactNode }> = {
  urgent: {
    classes: 'bg-[var(--brand-danger)]/12 text-[var(--brand-danger)] border-[var(--brand-danger)]/25 font-bold',
    indicator: 'bg-[var(--brand-danger)]',
    icon: <AlertTriangle className="h-3 w-3 text-[var(--brand-danger)]" />
  },
  high: {
    classes: 'bg-[var(--brand-primary)]/12 text-[var(--brand-primary)] border-[var(--brand-primary)]/25 font-semibold',
    indicator: 'bg-[var(--brand-primary)]',
    icon: <AlertCircle className="h-3 w-3 text-[var(--brand-primary)]" />
  },
  medium: {
    classes: 'bg-[var(--brand-warm)]/12 text-[var(--brand-warm)] border-[var(--brand-warm)]/25 font-medium',
    indicator: 'bg-[var(--brand-warm)]',
    icon: <Clock className="h-3 w-3 text-[var(--brand-warm)]" />
  },
  low: {
    classes: 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border-[var(--border-subtle)] font-normal',
    indicator: 'bg-slate-400',
    icon: null
  },
};

export function StatusBadge({ status, overdue }: { status: TaskStatus; overdue?: boolean }) {
  const { t } = useLanguage();
  if (overdue && status !== 'approved' && status !== 'completed' && status !== 'archived') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[var(--brand-danger)]/12 text-[var(--brand-danger)] border border-[var(--brand-danger)]/25 shadow-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-danger)] animate-ping" />
        {t('attendance.overdue', 'منتهية الصلاحية')}
      </span>
    );
  }
  const config = statusConfig[status] || statusConfig.pending;
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-colors', config.classes)}>
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', config.dot)} />
      {getStatusLabel(status)}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const config = priorityConfig[priority] || priorityConfig.medium;
  return (
    <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold border', config.classes)}>
      {config.icon}
      {getPriorityLabel(priority)}
    </span>
  );
}
