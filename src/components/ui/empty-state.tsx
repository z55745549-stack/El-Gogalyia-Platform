import React from 'react';
import { cn } from '@/utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 sm:py-16 px-4 text-center select-none', className)}>
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-[#1E1E28] border border-slate-200/60 dark:border-[#2A2A35] flex items-center justify-center mb-4 text-slate-400 dark:text-slate-500 shadow-xs">
          {icon}
        </div>
      )}
      <h3 className="text-base font-bold text-slate-800 dark:text-[#F7F7FA] mb-1.5">{title}</h3>
      {description && <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-5 max-w-sm leading-relaxed">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
