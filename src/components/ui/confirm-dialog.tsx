import React from 'react';
import { AlertTriangle, AlertOctagon, Archive, CheckCircle2, HelpCircle } from 'lucide-react';
import { Modal } from './modal';
import { Button } from './button';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'archive' | 'default' | 'success';
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'تأكيد الإجراء',
  cancelLabel = 'إلغاء',
  variant = 'default',
  loading,
}: ConfirmDialogProps) {
  const getIcon = () => {
    switch (variant) {
      case 'danger':
        return <div className="w-10 h-10 rounded-2xl bg-[var(--brand-danger)]/15 text-[var(--brand-danger)] flex items-center justify-center shrink-0"><AlertOctagon className="h-5 w-5" /></div>;
      case 'archive':
        return <div className="w-10 h-10 rounded-2xl bg-[var(--brand-warm)]/15 text-[var(--brand-warm)] flex items-center justify-center shrink-0"><Archive className="h-5 w-5" /></div>;
      case 'warning':
        return <div className="w-10 h-10 rounded-2xl bg-[var(--brand-warm)]/15 text-[var(--brand-warm)] flex items-center justify-center shrink-0"><AlertTriangle className="h-5 w-5" /></div>;
      case 'success':
        return <div className="w-10 h-10 rounded-2xl bg-[var(--brand-success)]/15 text-[var(--brand-success)] flex items-center justify-center shrink-0"><CheckCircle2 className="h-5 w-5" /></div>;
      default:
        return <div className="w-10 h-10 rounded-2xl bg-[var(--brand-primary)]/15 text-[var(--brand-primary)] flex items-center justify-center shrink-0"><HelpCircle className="h-5 w-5" /></div>;
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title=""
      size="sm"
      footer={
        <div className="flex items-center justify-end gap-2.5 w-full">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={
              variant === 'danger'
                ? 'danger'
                : variant === 'archive' || variant === 'warning'
                ? 'reward'
                : variant === 'success'
                ? 'accent'
                : 'primary'
            }
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="flex items-start gap-3.5 py-1">
        {getIcon()}
        <div className="flex-1 min-w-0 text-right">
          <h3 className="text-base font-bold text-[var(--text-primary)] mb-1.5">{title}</h3>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">{description}</p>
        </div>
      </div>
    </Modal>
  );
}
