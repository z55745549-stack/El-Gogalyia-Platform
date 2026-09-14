import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Lock, User, Eye, EyeOff, AlertTriangle, KeyRound } from 'lucide-react';
import {
  AdminActionType,
  ADMIN_ACTION_CONFIGS,
  verifyAdminActionRemote,
} from '@/lib/action-auth';

interface AdminActionConfirmModalProps {
  open: boolean;
  actionType: AdminActionType | null;
  onClose: () => void;
  onVerified: () => Promise<void> | void;
  loading?: boolean;
}

export function AdminActionConfirmModal({
  open,
  actionType,
  onClose,
  onVerified,
  loading = false,
}: AdminActionConfirmModalProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setUsername('');
      setPassword('');
      setShowPassword(false);
      setError(null);
      setSubmitting(false);
    }
  }, [open, actionType]);

  if (!actionType) return null;

  const config = ADMIN_ACTION_CONFIGS[actionType];
  if (!config) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const verification = await verifyAdminActionRemote(actionType, username, password);
      if (!verification.success) {
        setError(verification.error || 'بيانات التفويض غير صحيحة.');
        setSubmitting(false);
        return;
      }

      await onVerified();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء تنفيذ الإجراء.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={loading || submitting ? () => {} : onClose}
      size="md"
    >
      <div className="space-y-4 text-right" dir="rtl">
        {/* Header */}
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-[#271f45]">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 mb-1">
              <ShieldCheck className="w-3 h-3" />
              {config.badgeLabel}
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {config.title}
            </h3>
          </div>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-[#181130]/60 p-3 rounded-xl border border-slate-200/60 dark:border-[#271f45]">
          {config.description}
        </p>

        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5 pt-1">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              اسم المستخدم للتفويض (Username)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                autoComplete="off"
                dir="ltr"
                placeholder="أدخل اسم المستخدم..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading || submitting}
                className="w-full pr-9 pl-3 py-2.5 bg-slate-50 dark:bg-[#181130] border border-slate-200 dark:border-[#2b224d] rounded-xl text-sm font-mono text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              كلمة مرور التفويض (Password)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="off"
                dir="ltr"
                placeholder="أدخل كلمة المرور..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading || submitting}
                className="w-full pr-9 pl-10 py-2.5 bg-slate-50 dark:bg-[#181130] border border-slate-200 dark:border-[#2b224d] rounded-xl text-sm font-mono text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-[#271f45] flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading || submitting}
              className="px-4 text-xs font-medium"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={loading || submitting || !username.trim() || !password.trim()}
              loading={loading || submitting}
              className="bg-amber-600 hover:bg-amber-700 text-white border-0 px-5 text-xs font-semibold shadow-lg shadow-amber-500/20"
            >
              تأكيد وتنفيذ الإجراء
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
