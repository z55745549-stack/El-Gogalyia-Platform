import React from 'react';
import { cn } from '@/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, leftIcon, rightIcon, ...props }, ref) => (
    <div className="w-full">
      {label && <label className="form-label text-[var(--text-secondary)] font-semibold mb-1.5 block text-xs sm:text-sm">{label}</label>}
      <div className="relative">
        {rightIcon && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none flex items-center justify-center">
            {rightIcon}
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            'form-input bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-subtle)] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 transition-all w-full placeholder:text-[var(--text-muted)]',
            rightIcon && 'pr-10',
            leftIcon && 'pl-10',
            error && 'border-[var(--brand-danger)] focus:border-[var(--brand-danger)] focus:ring-[var(--brand-danger)]/20',
            className
          )}
          {...props}
        />
        {leftIcon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none flex items-center justify-center">
            {leftIcon}
          </div>
        )}
      </div>
      {error && <p className="form-error text-[var(--brand-danger)] text-xs mt-1 font-medium">{error}</p>}
    </div>
  )
);
Input.displayName = 'Input';
