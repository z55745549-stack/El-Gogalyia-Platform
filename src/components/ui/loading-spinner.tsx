import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/utils';
import { Sparkles } from 'lucide-react';

export function LoadingSpinner({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeMap = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' };
  return (
    <svg
      className={cn('animate-spin text-primary', sizeMap[size], className)}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export function PageLoader() {
  return null;
}

/**
 * Skeleton Loader Components for smooth loading states across all pages
 */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn('p-5 rounded-2xl animate-pulse space-y-3', className)}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="h-4 skeleton rounded-lg w-1/3" />
        <div className="h-8 w-8 skeleton rounded-xl" />
      </div>
      <div className="h-7 skeleton rounded-lg w-1/2 mt-2" />
      <div className="h-3 skeleton rounded-lg w-2/3" />
    </div>
  );
}

export function SkeletonRow({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="p-4 rounded-xl animate-pulse flex items-center justify-between"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl skeleton shrink-0" />
            <div className="space-y-1.5">
              <div className="h-4 skeleton rounded-md w-32 sm:w-48" />
              <div className="h-3 skeleton rounded-md w-20 sm:w-32" />
            </div>
          </div>
          <div className="h-7 skeleton rounded-lg w-16" />
        </div>
      ))}
    </div>
  );
}
