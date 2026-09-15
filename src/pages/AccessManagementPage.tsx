import { useState, useEffect } from 'react';
import { Plus, Search, Shield, Trash2, UserCheck, UserX, Mail, Sparkles, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import {
  addAuthorizedAdmin,
  removeAuthorizedAdmin,
  toggleAuthorizedAdminStatus,
  subscribeAuthorizedAdmins
} from '@/lib/database-service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonTable } from '@/components/ui/skeleton';
import { formatDate } from '@/utils';
import type { AuthorizedAdmin, UserRole } from '@/types';
// 2-Step admin auth removed — Lead/Co-Lead act directly
import { getRoleLabel, getRoleColor } from '@/utils/permissions';

export function AccessManagementPage() {
  const { userProfile } = useAuth();
  const [admins, setAdmins] = useState<AuthorizedAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Add Admin Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminRole, setAdminRole] = useState<UserRole>('head');
  const [submitting, setSubmitting] = useState(false);

  // Delete / Remove Modal State
  const [removeTarget, setRemoveTarget] = useState<AuthorizedAdmin | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    const unsub = subscribeAuthorizedAdmins((list) => {
      setAdmins(list);
      setLoading(false);
    });
    return unsub;
  }, []);

  const filteredAdmins = admins.filter((a) =>
    (a.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (a.displayName || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;

    const emailClean = googleEmail.trim().toLowerCase();
    if (!emailClean || !emailClean.includes('@')) {
      toast.error('يرجى إدخال بريد Google إلكتروني صحيح.');
      return;
    }

    // Direct execution — no 2-step verification required
    await executeAddAdmin();
  };

  const executeAddAdmin = async () => {
    if (!userProfile) return;
    const emailClean = googleEmail.trim().toLowerCase();
    setSubmitting(true);
    try {
      await addAuthorizedAdmin(
        {
          email: emailClean,
          displayName: adminName.trim() || emailClean.split('@')[0],
          role: adminRole,
        },
        {
          email: userProfile.email || userProfile.username,
          displayName: userProfile.displayName,
        }
      );

      toast.success(`تم تفويض حساب Google (${emailClean}) برتبة ${getRoleLabel(adminRole)} بنجاح!`);
      setShowAddModal(false);
      setGoogleEmail('');
      setAdminName('');
      setAdminRole('head');
    } catch (err: any) {
      toast.error(err?.message || 'فشل إضافة المشرف.');
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (admin: AuthorizedAdmin) => {
    if (!userProfile) return;
    if (admin.email === userProfile.email || (userProfile.googleLinkedEmail && admin.email === userProfile.googleLinkedEmail)) {
      toast.error('لا يمكنك تعطيل صلاحيات حسابك الحالي!');
      return;
    }
    try {
      await toggleAuthorizedAdminStatus(
        admin.email,
        admin.status,
        {
          email: userProfile.email || userProfile.username,
          displayName: userProfile.displayName,
        }
      );
      toast.success(`تم تحديث حالة المشرف (${admin.email}) بنجاح!`);
    } catch (err: any) {
      toast.error('فشل تحديث الحالة.');
    }
  };

  const handleRemoveAdmin = async () => {
    if (!removeTarget || !userProfile) return;
    if (removeTarget.email === userProfile.email || (userProfile.googleLinkedEmail && removeTarget.email === userProfile.googleLinkedEmail)) {
      toast.error('لا يمكنك حذف صلاحيات حسابك الحالي!');
      return;
    }
    setRemoving(true);
    try {
      await removeAuthorizedAdmin(
        removeTarget.email,
        {
          email: userProfile.email || userProfile.username,
          displayName: userProfile.displayName,
        }
      );
      toast.success(`تم إزالة المشرف (${removeTarget.email}) من القائمة المصرح لها.`);
      setRemoveTarget(null);
    } catch (err: any) {
      toast.error('فشل إزالة المشرف.');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title text-[var(--text-primary)] flex items-center gap-2.5">
            <Shield className="h-6 w-6 text-[var(--brand-primary)]" />
            إدارة المشرفين وحسابات Google المصرح لها
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
            أضف أي حساب Google لتفويضه كمسؤول في لوحة التحكم وتحديد صلاحياته بدقة.
          </p>
        </div>

        <Button
          onClick={() => setShowAddModal(true)}
          variant="default"
          size="default"
          className="flex items-center gap-2 self-start sm:self-auto font-bold"
        >
          <Plus className="h-4 w-4" />
          <span>إضافة مشرف Google جديد</span>
        </Button>
      </div>

      {/* Info Card */}
      <div className="p-4 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex items-start gap-3 text-xs leading-relaxed text-[var(--text-secondary)]">
        <Sparkles className="h-5 w-5 text-[var(--brand-warm)] flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-bold mb-0.5 text-[var(--text-primary)]">كيف يعمل نظام تفويض المشرفين؟</p>
          <p>
            بمجرد كتابة بريد Google الإلكتروني للمشرف هنا، سيتمكن فوراً من الضغط على <strong>"المتابعة باستخدام Google"</strong> في صفحة الدخول وسيتم التعرف عليه ومنحه الصلاحيات الإدارية المحددة له دون الحاجة لإنشاء كلمة مرور.
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card p-4">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="البحث بالبريد الإلكتروني أو الاسم..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-9 pl-4 py-2.5 rounded-xl text-xs bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
          />
        </div>
      </div>

      {/* Admins Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <SkeletonTable rows={5} />
        ) : filteredAdmins.length === 0 ? (
          <EmptyState
            icon={<Shield className="h-10 w-10 text-[var(--text-muted)]" />}
            title="لا يوجد مشرفين مضافين حتى الآن"
            description="اضغط على زر إضافة مشرف جديد لإضافة أول حساب Google مصرح له بالدخول."
            action={
              <Button onClick={() => setShowAddModal(true)} variant="default" size="sm">
                <Plus className="h-4 w-4" /> إضافة مشرف
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-[var(--surface-elevated)] text-[var(--text-muted)] border-b border-[var(--border-subtle)] font-bold">
                <tr>
                  <th className="p-4">حساب Google</th>
                  <th className="p-4">الاسم الظاهر</th>
                  <th className="p-4">الدور / الصلاحية</th>
                  <th className="p-4">الحالة</th>
                  <th className="p-4">تاريخ الإضافة</th>
                  <th className="p-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filteredAdmins.map((admin) => (
                  <tr key={admin.id || admin.email} className="hover:bg-[var(--surface-elevated)]/50 transition-colors">
                    <td className="p-4 font-semibold text-[var(--text-primary)] flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--brand-primary)] font-bold">
                        <Mail className="h-4 w-4" />
                      </div>
                      <span>{admin.email}</span>
                    </td>
                    <td className="p-4 text-[var(--text-secondary)] font-medium">
                      {admin.displayName || '—'}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md font-bold text-[11px] ${getRoleColor(admin.role)}`}>
                        {getRoleLabel(admin.role)}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                        admin.status === 'active'
                          ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/20'
                          : 'bg-rose-500/15 text-rose-600 border border-rose-500/20'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${admin.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        {admin.status === 'active' ? 'مفعل' : 'معطل'}
                      </span>
                    </td>
                    <td className="p-4 text-[var(--text-muted)]">
                      {formatDate(admin.createdAt)}
                    </td>
                    <td className="p-4">
                      {admin.email === userProfile?.email || (userProfile?.googleLinkedEmail && admin.email === userProfile.googleLinkedEmail) ? (
                        <div className="flex items-center justify-center">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                            حسابك الحالي (أنت)
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(admin)}
                            title={admin.status === 'active' ? 'تعطيل الحساب' : 'تفعيل الحساب'}
                            className={admin.status === 'active' ? 'text-amber-600 hover:text-amber-700' : 'text-emerald-600 hover:text-emerald-700'}
                          >
                            {admin.status === 'active' ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRemoveTarget(admin)}
                            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                            title="حذف من المشرفين"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Admin Modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="إضافة وتفويض مشرف بحساب Google"
        description="اكتب بريد Google الإلكتروني للمشرف وسيتمكن من الدخول مباشرة عبر زر Google Sign-In."
        size="md"
      >
        <form onSubmit={handleAddAdmin} className="space-y-4">
          <div>
            <label className="form-label">بريد Google الإلكتروني (مطلوب)</label>
            <Input
              type="email"
              placeholder="example@gmail.com"
              value={googleEmail}
              onChange={(e) => setGoogleEmail(e.target.value)}
              leftIcon={<Mail className="h-4 w-4" />}
              autoFocus
              required
            />
          </div>

          <div>
            <label className="form-label">الاسم الظاهر للمشرف (اختياري)</label>
            <Input
              type="text"
              placeholder="مثال: م. أحمد علي"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">مستوى الصلاحية الإدارية</label>
            <Select
              options={[
                { value: 'head', label: '👑 HEAD (رئيس لجنة - إدارة وصلاحيات إشرافية)' },
                { value: 'co_lead', label: '🌟 CO-LEAD (نائب القائد - صلاحيات قيادية عليا)' },
                ...(userProfile?.role === 'lead' ? [{ value: 'lead', label: '🏆 LEAD (قائد المنصة - أعلى صلاحية)' }] : []),
              ]}
              value={adminRole}
              onChange={(e) => setAdminRole(e.target.value as UserRole)}
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowAddModal(false)}
              disabled={submitting}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="default"
              loading={submitting}
            >
              حفظ وتفويض المشرف
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Remove Modal */}
      <ConfirmDialog
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemoveAdmin}
        title="إزالة تفويض المشرف"
        description={`هل أنت متأكد من رغبتك في إزالة حساب (${removeTarget?.email}) من قائمة المشرفين المصرح لهم؟ لن يتمكن من الدخول كمسؤول بعد الآن.`}
        confirmLabel="نعم، إزالة المشرف"
        cancelLabel="تراجع"
        variant="danger"
        loading={removing}
      />

      {/* 2-Step Authorization Modal removed — Lead/Co-Lead act directly */}
    </div>
  );
}
