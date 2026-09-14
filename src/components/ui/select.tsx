import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, placeholder, ...props }, ref) => (
    <div className="w-full">
      {label && <label className="form-label text-[var(--text-secondary)] font-semibold mb-1.5 block text-xs sm:text-sm">{label}</label>}
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            'form-input appearance-none bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-subtle)] pl-9 pr-3.5 py-2.5 rounded-xl cursor-pointer w-full text-xs sm:text-sm focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 transition-all',
            error && 'border-[var(--brand-danger)] focus:border-[var(--brand-danger)] focus:ring-[var(--brand-danger)]/20',
            className
          )}
          {...props}
        >
          {placeholder && <option value="" className="bg-[var(--bg-surface)] text-[var(--text-muted)]">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[var(--bg-surface)] text-[var(--text-primary)]">
              {opt.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center px-3 text-[var(--text-muted)]">
          <ChevronDown className="h-4 w-4" />
        </div>
      </div>
      {error && <p className="form-error text-[var(--brand-danger)] text-xs mt-1">{error}</p>}
    </div>
  )
);
Select.displayName = 'Select';
