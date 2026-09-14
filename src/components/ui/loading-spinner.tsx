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
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white select-none overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#FF3483]/20 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-[#7C00FE]/20 rounded-full blur-3xl pointer-events-none animate-pulse" />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative z-10 flex flex-col items-center gap-5 text-center px-4"
      >
        {/* Animated Brand Logo Mark */}
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl shadow-[#FF3483]/30 ring-2 ring-white/20" style={{ background: 'linear-gradient(135deg, #FF3483 0%, #7C00FE 100%)' }}>
            <span className="text-white font-black text-3xl tracking-tight">S</span>
          </div>
          <div className="absolute -inset-1.5 rounded-2xl border border-[#FF3483]/40 animate-ping pointer-events-none" />
        </div>

        {/* Brand Text */}
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-white font-sans">
              SAAS <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF3483] to-[#7C00FE]">Work Hub</span>
            </h1>
            <Sparkles className="h-4 w-4 text-[#FF3483] animate-spin" />
          </div>
          <p className="text-xs text-slate-400 font-medium">جاري تحميل النظام والمزامنة اللحظية...</p>
        </div>

        {/* Sleek Progress Bar */}
        <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden mt-2">
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
            className="w-full h-full bg-gradient-to-r from-[#FF3483] to-[#7C00FE] rounded-full"
          />
        </div>
      </motion.div>
    </div>
  );
}

/**
 * Skeleton Loader Components for smooth loading states across all pages
 */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('p-5 rounded-2xl bg-white dark:bg-[#140e29] border border-slate-200/80 dark:border-[#271f45] animate-pulse space-y-3', className)}>
      <div className="flex items-center justify-between">
        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-lg w-1/3" />
        <div className="h-8 w-8 bg-slate-200 dark:bg-slate-800 rounded-xl" />
      </div>
      <div className="h-7 bg-slate-200 dark:bg-slate-800 rounded-lg w-1/2 mt-2" />
      <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-lg w-2/3" />
    </div>
  );
}

export function SkeletonRow({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="p-4 rounded-xl bg-white dark:bg-[#140e29] border border-slate-200/80 dark:border-[#271f45] flex items-center justify-between animate-pulse"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800 shrink-0" />
            <div className="space-y-1.5">
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-32 sm:w-48" />
              <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-md w-20 sm:w-32" />
            </div>
          </div>
          <div className="h-7 bg-slate-200 dark:bg-slate-800 rounded-lg w-16" />
        </div>
      ))}
    </div>
  );
}
