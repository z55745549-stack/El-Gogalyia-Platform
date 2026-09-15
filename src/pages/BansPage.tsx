import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Ban, Clock, Shield, Search, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { subscribeBans, deleteBan, clearAllBans } from '@/lib/bans';
import { canViewAllBans } from '@/lib/security';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { Avatar } from '@/components/ui/avatar';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SkeletonCard } from '@/components/ui/skeleton';
import { formatDateTime } from '@/utils';
import type { Ban as BanRecord } from '@/types';

export function BansPage() {
  const { userProfile } = useAuth();
  const isPrivileged = canViewAllBans(userProfile);
  const [bans, setBans] = useState<BanRecord[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [deleteTarget, setDeleteTarget] = useState<BanRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showClearAll, setShowClearAll] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    const unsub = subscribeBans((list) => {
      setBans(list);
      setLoading(false);
    });
    return unsub;
  }, []);

  const filtered = bans.filter((b) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (b.employeeName || '').toLowerCase().includes(q) ||
      (b.employeeUsername || '').toLowerCase().includes(q) ||
      (b.reason || '').toLowerCase().includes(q)
    );
  });

  const handleDeleteBan = async () => {
    if (!deleteTarget || !userProfile) return;
    setDeleting(true);
    try {
      await deleteBan(deleteTarget.id, {
        uid: userProfile.uid,
        email: userProfile.email || userProfile.username || '',
        displayName: userProfile.displayName,
      });
      toast.success('تم حذف سجل الحظر واستعادة الحساب بنجاح.');
      setDeleteTarget(null);
    } catch {
      toast.error('فشل حذف سجل الحظر.');
    } finally {
      setDeleting(false);
    }
  };

  const handleClearAllBans = async () => {
    if (!userProfile) return;
    setClearing(true);
    try {
      await clearAllBans({
        uid: userProfile.uid,
        email: userProfile.email || userProfile.username || '',
        displayName: userProfile.displayName,
      });
      toast.success('تم مسح جميع سجلات الحظر بنجاح.');
      setShowClearAll(false);
    } catch {
      toast.error('فشل مسح سجلات الحظر.');
    } finally {
      setClearing(false);
    }
  };

  if (!isPrivileged) {
    return (
      <div className="space-y-6 text-right">
        <div className="rounded-2xl p-8 bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-center">
          <Shield className="h-8 w-8 text-[var(--brand-warm)] mx-auto" />
          <h2 className="text-lg font-bold text-[var(--text-primary)] mt-3">وصول مقيد للإدارة فقط</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">سجل العقوبات والحظر العام متاح للمشرفين فقط. يمكنك التحقق من حالة حسابك عبر لوحة التحكم.</p>
        </div>
        <div className="space-y-3">
          {filtered.map((b) => (
            <div key={b.id} className="card p-5 rounded-2xl">
              <p className="font-bold text-sm text-[var(--text-primary)]">{b.reason}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                ينتهي في: {formatDateTime(b.endAt)} • الحالة: {b.status === 'active' ? 'نشط' : 'منتهي'}
              </p>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-sm text-[var(--text-muted)] text-center py-8">لا توجد عقوبات أو حظر مسجل على حسابك.</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-right">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Ban className="h-7 w-7 text-[var(--brand-danger)]" />
            <span className="text-[var(--text-primary)]">سجل الحظر والعقوبات</span>
          </h1>
          <p className="text-[var(--text-muted)] text-xs sm:text-sm mt-1">
            سجل إداري موثق لعقوبات الحظر، الخصومات التأديبية، وتاريخ إيقاف الحسابات.
          </p>
        </div>
        {isPrivileged && bans.length > 0 && (
          <button
            onClick={() => setShowClearAll(true)}
            className="text-xs font-bold text-[var(--brand-danger)] hover:bg-[var(--brand-danger)]/10 px-3.5 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 self-start sm:self-auto border border-[var(--brand-danger)]/20"
            title="مسح جميع سجلات الحظر"
          >
            <Trash2 className="h-4 w-4" />
            <span>مسح جميع سجلات الحظر</span>
          </button>
        )}
      </div>

      <div className="card p-4 rounded-2xl">
        <Input
          placeholder="ابحث بالاسم، اسم المستخدم، أو سبب العقوبة..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          rightIcon={<Search className="h-4 w-4 text-[var(--text-muted)]" />}
        />
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="h-8 w-8 text-emerald-500" />}
            title="لا توجد سجلات حظر حالياً"
            description="جميع حسابات أعضاء الفريق تعمل بشكل سليم ولا توجد عقوبات نشطة."
          />
        ) : (
          filtered.map((b) => {
            const active = b.status === 'active' && new Date(b.endAt as any).getTime() > Date.now();
            return (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="card p-5 rounded-2xl transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-3 items-center">
                    <Avatar name={b.employeeName} size="sm" />
                    <div>
                      <p className="font-bold text-sm text-[var(--text-primary)]">
                        {b.employeeName}{' '}
                        <span className="font-mono text-xs text-[var(--brand-primary)]">@{b.employeeUsername}</span>
                      </p>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        اللجنة: {(b as any).committeeId || '—'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        active
                          ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400'
                          : b.status === 'expired'
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          : 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {active ? 'حظر نشط' : b.status === 'expired' ? 'منتهي الصلاحية' : 'تم الرفع مسبقاً'}
                    </span>
                    {isPrivileged && (
                      <button
                        onClick={() => setDeleteTarget(b)}
                        title="حذف هذا السجل وإلغاء الحظر"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-3.5 grid sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-[var(--surface-elevated)] rounded-xl border border-[var(--border-subtle)]">
                    <p className="font-bold text-[var(--text-primary)] flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
                      <span>فترة سريان الحظر</span>
                    </p>
                    <p className="mt-1 text-[var(--text-secondary)]">
                      من: {formatDateTime(b.startAt)} <br />
                      إلى: {formatDateTime(b.endAt)}
                    </p>
                  </div>
                  <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/20">
                    <p className="font-bold text-rose-600 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>سبب العقوبة</span>
                    </p>
                    <p className="mt-1 text-[var(--text-primary)]">{b.reason}</p>
                  </div>
                </div>

                {b.internalNote && (
                  <div className="mt-3 p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                    <p className="text-xs font-bold text-amber-600">ملاحظة داخلية (للمشرفين فقط)</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">{b.internalNote}</p>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-muted)]">
                  <span>
                    الخصم التأديبي:{' '}
                    <strong className="text-rose-600 font-bold">{b.coinPenalty} كوينز</strong>
                  </span>
                  <span>• المشرف: {b.createdByName}</span>
                  {b.endedBy && <span>• تم الرفع بواسطة: {b.endedByName}</span>}
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Confirm Delete Single Ban */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteBan}
        loading={deleting}
        title="حذف سجل الحظر"
        description={`هل أنت متأكد من حذف سجل الحظر للموظف "${deleteTarget?.employeeName}"؟ ${
          deleteTarget?.status === 'active' ? 'ملاحظة: هذا الحظر نشط حالياً، وحذفه سيعيد تفعيل حساب الموظف فوراً.' : ''
        }`}
        confirmLabel="حذف السجل واستعادة الحساب"
        cancelLabel="إلغاء"
        variant="danger"
      />

      {/* Confirm Clear All Bans */}
      <ConfirmDialog
        open={showClearAll}
        onClose={() => setShowClearAll(false)}
        onConfirm={handleClearAllBans}
        loading={clearing}
        title="مسح جميع سجلات الحظر"
        description="تحذير: هل أنت متأكد من رغبتك في مسح كافة سجلات وتاريخ الحظر بالكامل من قاعدة البيانات؟ لا يمكن التراجع عن هذا الإجراء."
        confirmLabel="نعم، مسح كل السجلات"
        cancelLabel="إلغاء"
        variant="danger"
      />
    </div>
  );
}
