import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/utils';
import { Button } from './button';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: React.ReactNode;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

export function Modal({ open, onClose, title, description, children, size = 'md', footer }: ModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className={cn(
              'relative z-10 w-full bg-[var(--bg-card)] text-[var(--text-primary)] rounded-2xl shadow-2xl border border-[var(--border-subtle)] flex flex-col max-h-[90vh] mx-auto overflow-hidden font-sans',
              sizeClasses[size]
            )}
          >
            {/* Header */}
            {title && (
              <div className="flex items-start justify-between p-4 sm:p-5 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]/40">
                <div className="pr-1">
                  <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">{title}</h2>
                  {description && <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">{description}</p>}
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} className="-mt-1 -ml-1 shrink-0 rounded-xl">
                  <X className="h-4 w-4 text-[var(--text-muted)]" />
                </Button>
              </div>
            )}
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {children}
            </div>
            {/* Footer */}
            {footer && (
              <div className="p-4 sm:p-5 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)]/40 flex items-center justify-end gap-2.5">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
