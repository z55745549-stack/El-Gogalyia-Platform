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

function AnimatedNumber({ value }: { value: number | string }) {
  const [displayValue, setDisplayValue] = React.useState<number | string>(() => {
    return typeof value === 'number' ? 0 : value;
  });

  React.useEffect(() => {
    if (typeof value !== 'number') {
      setDisplayValue(value);
      return;
    }
    let start = 0;
    const end = value;
    if (end === 0) {
      setDisplayValue(0);
      return;
    }
    const duration = 750; // ms
    const startTime = performance.now();

    const update = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (end - start) * ease);
      setDisplayValue(current);
      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        setDisplayValue(end);
      }
    };

    const animId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animId);
  }, [value]);

  return <>{displayValue}</>;
}

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

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
  };

  const glowColorVariant =
    variant === 'warm'
      ? 'glow-warm'
      : variant === 'accent'
      ? 'glow-accent'
      : variant === 'success'
      ? 'glow-success'
      : 'glow-primary';

  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.01 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      onMouseMove={handleMouseMove}
      className={cn(
        'glow-card-interactive relative p-4 sm:p-5 transition-all duration-200 overflow-hidden group text-right dir-rtl',
        glowColorVariant,
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {/* Dynamic ambient color glow */}
      <div
        className="absolute -top-10 -left-10 w-32 h-32 rounded-full pointer-events-none opacity-25 dark:opacity-35 group-hover:opacity-75 transition-opacity duration-300"
        style={{
          background:
            variant === 'warm'
              ? 'radial-gradient(circle, rgba(245,158,11,0.45) 0%, transparent 70%)'
              : variant === 'accent'
              ? 'radial-gradient(circle, rgba(34,211,238,0.45) 0%, transparent 70%)'
              : variant === 'success'
              ? 'radial-gradient(circle, rgba(16,185,129,0.45) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(108,99,255,0.45) 0%, transparent 70%)',
          filter: 'blur(20px)',
        }}
      />

      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="space-y-1.5 flex-1 min-w-0">
          <p className="text-xs font-semibold text-[var(--text-muted)] tracking-wider truncate group-hover:text-[var(--text-secondary)] transition-colors">
            {title}
          </p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight glow-text font-mono">
              <AnimatedNumber value={value} />
            </p>
            {trend && (
              <span
                className={cn(
                  'text-xs font-semibold px-2 py-0.5 rounded-full glow-badge',
                  trendColor ?? 'bg-[var(--brand-accent)]/10 text-[var(--brand-accent)]'
                )}
              >
                {trend}
              </span>
            )}
          </div>
          {subtext && (
            <p className="text-[11px] text-[var(--text-muted)] font-normal truncate group-hover:text-[var(--text-secondary)] transition-colors">
              {subtext}
            </p>
          )}
        </div>

        <div
          className={cn(
            'w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 glow-icon',
            iconBg || vStyle.iconBox
          )}
        >
          {icon}
        </div>
      </div>
    </motion.div>
  );
}
