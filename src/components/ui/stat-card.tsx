import React from 'react';
import { cn } from '@/utils';
import { motion } from 'framer-motion';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  iconBg?: string;
  trend?: string;
  trendColor?: string;
  subtext?: string;
  variant?: 'default' | 'primary' | 'accent' | 'warm' | 'success';
  onClick?: () => void;
  className?: string;
}

const variantStyles = {
  default: {
    borderHover: 'hover:border-[var(--brand-primary)]/40',
    iconBox: 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]',
  },
  primary: {
    borderHover: 'hover:border-[var(--brand-primary)]/50',
    iconBox: 'bg-[var(--brand-primary)]/15 text-[var(--brand-primary)] shadow-sm shadow-[var(--brand-primary)]/20',
  },
  accent: {
    borderHover: 'hover:border-[var(--brand-accent)]/50',
    iconBox: 'bg-[var(--brand-accent)]/15 text-[var(--brand-accent)] shadow-sm shadow-[var(--brand-accent)]/20',
  },
  warm: {
    borderHover: 'hover:border-[var(--brand-warm)]/50',
    iconBox: 'bg-[var(--brand-warm)]/15 text-[var(--brand-warm)] shadow-sm shadow-[var(--brand-warm)]/20',
  },
  success: {
    borderHover: 'hover:border-[var(--brand-success)]/50',
    iconBox: 'bg-[var(--brand-success)]/15 text-[var(--brand-success)] shadow-sm shadow-[var(--brand-success)]/20',
  },
};

export function StatCard({
  title,
  value,
  icon,
  iconBg,
  trend,
  trendColor,
  subtext,
  variant = 'default',
  onClick,
  className,
}: StatCardProps) {
  const vStyle = variantStyles[variant];

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={cn(
        'card relative p-4 sm:p-5 transition-all duration-200 overflow-hidden group text-right dir-rtl',
        vStyle.borderHover,
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {/* Ambient luxury glow in corner */}
      <div
        className="absolute -top-10 -left-10 w-28 h-28 rounded-full pointer-events-none opacity-30 dark:opacity-40 group-hover:opacity-60 transition-opacity duration-300"
        style={{
          background: variant === 'warm'
            ? 'radial-gradient(circle, rgba(245,158,11,0.3) 0%, transparent 70%)'
            : variant === 'accent'
            ? 'radial-gradient(circle, rgba(34,211,238,0.3) 0%, transparent 70%)'
            : variant === 'success'
            ? 'radial-gradient(circle, rgba(16,185,129,0.3) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)',
          filter: 'blur(16px)',
        }}
      />

      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="space-y-1.5 flex-1 min-w-0">
          <p className="text-xs font-semibold text-[var(--text-muted)] tracking-wider truncate">
            {title}
          </p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
              {value}
            </p>
            {trend && (
              <span
                className={cn(
                  'text-xs font-semibold px-2 py-0.5 rounded-full',
                  trendColor ?? 'bg-[var(--brand-accent)]/10 text-[var(--brand-accent)]'
                )}
              >
                {trend}
              </span>
            )}
          </div>
          {subtext && (
            <p className="text-[11px] text-[var(--text-muted)] font-normal truncate">
              {subtext}
            </p>
          )}
        </div>

        <div
          className={cn(
            'w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110',
            iconBg || vStyle.iconBox
          )}
        >
          {icon}
        </div>
      </div>
    </motion.div>
  );
}
