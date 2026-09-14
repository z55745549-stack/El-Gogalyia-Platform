import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none select-none cursor-pointer',
  {
    variants: {
      variant: {
        // Primary Brand Action: Cosmic Indigo
        default: 'bg-[var(--brand-primary)] text-white hover:brightness-110 active:brightness-95 shadow-md shadow-[var(--brand-primary)]/20 active:scale-[0.98]',
        primary: 'bg-[var(--brand-primary)] text-white hover:brightness-110 active:brightness-95 shadow-md shadow-[var(--brand-primary)]/20 active:scale-[0.98]',

        // Accent Action: Aurora Cyan
        accent: 'bg-[var(--brand-accent)] text-[#07070E] font-bold hover:brightness-110 active:brightness-95 shadow-md shadow-[var(--brand-accent)]/20 active:scale-[0.98]',
        teal: 'bg-[var(--brand-accent)] text-[#07070E] font-bold hover:brightness-110 active:brightness-95 shadow-md shadow-[var(--brand-accent)]/20 active:scale-[0.98]',

        // Reward / O-Coins Action: Amber Gold
        reward: 'bg-[var(--brand-warm)] text-[#07070E] font-bold hover:brightness-110 active:brightness-95 shadow-md shadow-[var(--brand-warm)]/20 active:scale-[0.98]',
        yellow: 'bg-[var(--brand-warm)] text-[#07070E] font-bold hover:brightness-110 active:brightness-95 shadow-md shadow-[var(--brand-warm)]/20 active:scale-[0.98]',

        // Danger / Critical Action: Vivid Rose
        destructive: 'bg-[var(--brand-danger)] text-white hover:brightness-110 active:brightness-95 shadow-md shadow-[var(--brand-danger)]/20 active:scale-[0.98]',
        danger: 'bg-[var(--brand-danger)] text-white hover:brightness-110 active:brightness-95 shadow-md shadow-[var(--brand-danger)]/20 active:scale-[0.98]',
        pink: 'bg-[var(--brand-danger)] text-white hover:brightness-110 active:brightness-95 shadow-md shadow-[var(--brand-danger)]/20 active:scale-[0.98]',

        // Neutral Secondary
        secondary: 'bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:bg-[var(--border-subtle)] border border-[var(--border-subtle)] shadow-xs active:scale-[0.98]',

        // Bordered Outline
        outline: 'border border-[var(--border-subtle)] bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] active:scale-[0.98]',

        // Success Action: Emerald
        success: 'bg-[var(--brand-success)] text-[#07070E] font-bold hover:brightness-110 active:brightness-95 shadow-xs active:scale-[0.98]',

        // Warning Action: Amber
        warning: 'bg-[var(--brand-warm)] text-[#07070E] font-bold hover:brightness-110 shadow-xs active:scale-[0.98]',

        // Ghost
        ghost: 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]',

        // Link
        link: 'text-[var(--brand-primary)] hover:text-[var(--brand-accent)] underline-offset-4 hover:underline p-0 h-auto font-medium',
      },
      size: {
        default: 'h-9 px-4 py-2 text-xs sm:text-sm',
        sm: 'h-8 px-3 text-xs rounded-lg',
        lg: 'h-11 px-5 text-sm sm:text-base rounded-xl',
        icon: 'h-9 w-9 p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-3.5 w-3.5 text-current" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  )
);
Button.displayName = 'Button';
