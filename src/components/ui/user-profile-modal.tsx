/**
 * UserProfileModal — بروفايل تعريفي للمستخدم بدون بيانات شخصية حساسة
 * يعرض: الاسم، اسم المستخدم، الرتبة، اللجنة، التخصص، صورة البروفايل، تاريخ الانضمام
 * لا يعرض: البريد الإلكتروني، كلمة المرور، أي بيانات حساسة
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Tag, Shield, Users, Coins, Award } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { VerifiedBadge } from '@/components/ui/VerifiedBadge';
import { getRoleLabel, getRoleColor, isUserVerified } from '@/utils/permissions';
import { formatFullName, formatDate, hasUnlimitedCoins, cn } from '@/utils';
import { useLanguage } from '@/context/LanguageContext';
import type { UserProfile } from '@/types';

interface UserProfileModalProps {
  user: UserProfile;
  open: boolean;
  onClose: () => void;
}

export function UserProfileModal({ user, open, onClose }: UserProfileModalProps) {
  const { t, isRTL } = useLanguage();
  const name = formatFullName(user.displayName) || user.username || 'Unknown';

  const isUnlimited = hasUnlimitedCoins(user.role);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', damping: 28, stiffness: 340 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="pointer-events-auto w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border-subtle)',
              }}
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              {/* Header Banner */}
              <div className="relative h-28 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 overflow-hidden">
                {/* Decorative circles */}
                <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/5" />
                <div className="absolute -bottom-12 -left-8 w-40 h-40 rounded-full bg-white/5" />
                <div className="absolute top-3 left-3 w-16 h-16 rounded-full bg-white/5" />

                {/* Close button */}
                <button
                  onClick={onClose}
                  className={cn(
                    'absolute top-3 p-1.5 rounded-full bg-black/20 hover:bg-black/40 text-white transition-colors cursor-pointer',
                    isRTL ? 'left-3' : 'right-3'
                  )}
                  aria-label="إغلاق"
                >
                  <X className="h-4 w-4" />
                </button>

                {/* Role badge on banner */}
                <div className={cn('absolute top-3', isRTL ? 'right-3' : 'left-3')}>
                  <span
                    className={cn(
                      'inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black',
                      getRoleColor(user.role)
                    )}
                  >
                    {getRoleLabel(user.role)}
                  </span>
                </div>
              </div>

              {/* Avatar — overlaps banner */}
              <div className={cn('px-6 relative', isRTL ? 'text-right' : 'text-left')}>
                <div className="-mt-12 mb-3">
                  <Avatar
                    src={user.photoURL}
                    name={name}
                    size="xl"
                    className="ring-4 ring-[var(--surface)] shadow-xl"
                  />
                </div>

                {/* Name & Username */}
                <div className="mb-4">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h2 className="text-lg font-black text-[var(--text-primary)] leading-tight">
                      {name}
                    </h2>
                    {isUserVerified(user) && <VerifiedBadge size="sm" />}
                  </div>
                  {user.username && (
                    <p className="text-xs font-mono font-bold text-indigo-500 mt-0.5">
                      @{user.username}
                    </p>
                  )}

                  {/* Status indicator */}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span
                      className={cn(
                        'w-2 h-2 rounded-full',
                        user.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'
                      )}
                    />
                    <span className="text-[10px] font-semibold text-[var(--text-muted)]">
                      {user.status === 'active'
                        ? t('status.active', 'نشط')
                        : user.status === 'suspended'
                        ? t('status.suspended', 'معطّل')
                        : t('status.pending', 'معلق')}
                    </span>
                  </div>
                </div>

                {/* Info cards */}
                <div className="space-y-2.5 pb-6">
                  {/* Committee */}
                  {user.committeeName && (
                    <div
                      className="flex items-center gap-2.5 p-2.5 rounded-xl"
                      style={{
                        background: 'var(--surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                        <Users className="h-3.5 w-3.5 text-indigo-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                          {t('common.committee', 'اللجنة')}
                        </p>
                        <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                          {user.committeeName}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Specialty Tag */}
                  {user.specialtyTag && (
                    <div
                      className="flex items-center gap-2.5 p-2.5 rounded-xl"
                      style={{
                        background: 'var(--surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                        <Tag className="h-3.5 w-3.5 text-violet-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                          {t('common.specialty_tag', 'التخصص')}
                        </p>
                        <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                          {user.specialtyTag}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Employee Code */}
                  {user.employeeCode && (
                    <div
                      className="flex items-center gap-2.5 p-2.5 rounded-xl"
                      style={{
                        background: 'var(--surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                        <Shield className="h-3.5 w-3.5 text-purple-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                          {t('attendance.employee_code', 'كود العضوية')}
                        </p>
                        <p className="text-xs font-bold font-mono text-purple-600 dark:text-purple-300">
                          {user.employeeCode}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* O-Coins */}
                  <div
                    className="flex items-center gap-2.5 p-2.5 rounded-xl"
                    style={{
                      background: 'var(--surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                      <Coins className="h-3.5 w-3.5 text-amber-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                        {t('common.coins', 'O-Coins')}
                      </p>
                      <p className="text-xs font-bold text-amber-600 dark:text-amber-300">
                        {isUnlimited ? '∞ ' + t('common.unlimited', 'غير محدود') : `${user.oCoinsBalance ?? (user as any).ocoins_balance ?? 0} OC`}
                      </p>
                    </div>
                  </div>

                  {/* Join Date */}
                  {user.createdAt && (
                    <div
                      className="flex items-center gap-2.5 p-2.5 rounded-xl"
                      style={{
                        background: 'var(--surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <Calendar className="h-3.5 w-3.5 text-emerald-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                          {t('success.summary_status', 'تاريخ الانضمام')}
                        </p>
                        <p className="text-xs font-bold text-[var(--text-primary)]">
                          {formatDate(user.createdAt)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
