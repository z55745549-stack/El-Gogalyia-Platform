import React from 'react';
import { cn } from '@/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, ...props }, ref) => (
    <div className="w-full">
      {label && <label className="form-label text-[var(--text-secondary)] font-semibold mb-1.5 block text-xs sm:text-sm">{label}</label>}
      <textarea
        ref={ref}
        className={cn(
          'form-input min-h-[100px] resize-y bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-subtle)] rounded-xl p-3 text-xs sm:text-sm focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 transition-all w-full placeholder:text-[var(--text-muted)]',
          error && 'border-[var(--brand-danger)] focus:border-[var(--brand-danger)] focus:ring-[var(--brand-danger)]/20',
          className
        )}
        {...props}
      />
      {error && <p className="form-error text-[var(--brand-danger)] text-xs mt-1 font-medium">{error}</p>}
    </div>
  )
);
Textarea.displayName = 'Textarea';
