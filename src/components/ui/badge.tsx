import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold font-sans transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border-subtle)]',
        primary: 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border border-[var(--brand-primary)]/25',
        purple: 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border border-[var(--brand-primary)]/25',
        accent: 'bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] border border-[var(--brand-accent)]/25',
        teal: 'bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] border border-[var(--brand-accent)]/25',
        warm: 'bg-[var(--brand-warm)]/12 text-[var(--brand-warm)] border border-[var(--brand-warm)]/25',
        yellow: 'bg-[var(--brand-warm)]/12 text-[var(--brand-warm)] border border-[var(--brand-warm)]/25',
        danger: 'bg-[var(--brand-danger)]/10 text-[var(--brand-danger)] border border-[var(--brand-danger)]/25',
        pink: 'bg-[var(--brand-danger)]/10 text-[var(--brand-danger)] border border-[var(--brand-danger)]/25',
        success: 'bg-[var(--brand-success)]/10 text-[var(--brand-success)] border border-[var(--brand-success)]/25',
        neutral: 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border-subtle)]',
        outline: 'border border-[var(--border-subtle)] text-[var(--text-secondary)]',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
