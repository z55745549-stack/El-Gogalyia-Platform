import React from 'react';
import { cn } from '@/utils';

interface VerifiedBadgeProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  tooltip?: string;
}

const sizeClasses = {
  xs: 'w-3 h-3',
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
  xl: 'w-6 h-6',
};

/**
 * Meta Verified Badge (Instagram / Facebook official scalloped rosette with white checkmark)
 */
export function VerifiedBadge({
  size = 'md',
  className,
  tooltip = 'حساب موثق رسمياً في منصة الجوجالية',
}: VerifiedBadgeProps) {
  return (
    <span
      className={cn("inline-flex items-center justify-center shrink-0 select-none align-middle", className)}
      title={tooltip}
      aria-label={tooltip}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={cn(sizeClasses[size], "drop-shadow-[0_1px_3px_rgba(0,149,246,0.35)] transition-transform hover:scale-110")}
      >
        <defs>
          <linearGradient id="meta-verified-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0095F6" />
            <stop offset="100%" stopColor="#0064E0" />
          </linearGradient>
        </defs>
        {/* Meta 10-scallop rosette path */}
        <path
          d="M19.965 8.521C19.988 8.347 20 8.173 20 8c0-2.379-2.143-4.288-4.521-3.965C14.786 2.802 13.466 2 12 2s-2.786.802-3.479 2.035C6.143 3.712 4 5.621 4 8c0 .173.012.347.035.521C2.802 9.214 2 10.534 2 12s.802 2.786 2.035 3.479C4.012 15.653 4 15.827 4 16c0 2.379 2.143 4.288 4.521 3.965C9.214 21.198 10.534 22 12 22s2.786-.802 3.479-2.035C17.857 20.288 20 18.379 20 16c0-.173-.012-.347-.035-.521C21.198 14.786 22 13.466 22 12s-.802-2.786-2.035-3.479z"
          fill="url(#meta-verified-gradient)"
        />
        {/* Crisp checkmark */}
        <path
          d="M10.025 15.525l-3.55-3.55 1.425-1.425 2.125 2.125 5.575-5.575 1.425 1.425-7 7z"
          fill="#FFFFFF"
        />
      </svg>
    </span>
  );
}
