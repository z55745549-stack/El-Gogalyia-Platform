import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, getDocs, query, where, serverTimestamp, db } from '@/lib/supabase';
import { motion } from 'framer-motion';
import {
  Users, UserPlus, Shield, MoreVertical, KeyRound, Edit3, Trash2, UserX, UserCheck, Search, CheckSquare, Ban as BanIcon, Gavel, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { generateSalt, hashPassword } from '@/lib/auth-security';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { UserProfile, UserRole, UserStatus, Permission, Committee, Ban as BanRecord } from '@/types';
import { subscribeCommittees, assignUserCommittee, createCommittee } from '@/lib/committees';
import { subscribeBans, createBan, endBan, getActiveBan } from '@/lib/bans';
import { AdminActionConfirmModal } from '@/components/auth/AdminActionConfirmModal';
import type { AdminActionType } from '@/lib/action-auth';
import { generateEmployeeCode } from '@/lib/attendance';
import { canManageRole, isTopTierRole, getRoleLabel, getRoleColor } from '@/utils/permissions';

const AVAILABLE_PERMISSIONS: { key: Permission; label: string }[] = [
  { key: 'employees.manage' as Permission, label: 'إدارة الموظفين (manageEmployees)' },
  { key: 'tasks.create' as Permission, label: 'إنشاء المهام (createTasks)' },
  { key: 'tasks.edit' as Permission, label: 'تعديل المهام (editTasks)' },
  { key: 'tasks.delete' as Permission, label: 'حذف المهام (deleteTasks)' },
  { key: 'tasks.review' as Permission, label: 'مراجعة وتسليمات المهام (reviewSubmissions)' },
  { key: 'ocoins.manage' as Permission, label: 'إدارة الـ O Coins (manageOCoin)' },
  { key: 'activity.view' as Permission, label: 'عرض سجل النشاطات (viewActivityLogs)' },
  { key: 'notifications.send' as Permission, label: 'إرسال الإشعارات (manageNotifications)' },
  { key: 'tasks.view_all' as Permission, label: 'عرض جميع المهام (viewAllTasks)' },
];

export function EmployeesPage() {
  const { userProfile } = useAuth();
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [committeeFilter, setCommitteeFilter] = useState<string>('');
  const [bans, setBans] = useState<BanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  // Form states
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('employee');
  const [formStatus, setFormStatus] = useState<UserStatus>('active');
  const [formCommitteeId, setFormCommitteeId] = useState<string>('');
  const [formPermissions, setFormPermissions] = useState<Permission[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Password reset state
  const [newPassword, setNewPassword] = useState('');
  // Committee creation
  const [showCommitteeModal, setShowCommitteeModal] = useState(false);
  const [newCommitteeName, setNewCommitteeName] = useState('');
  const [newCommitteeDesc, setNewCommitteeDesc] = useState('');
  const [newCommitteeColor, setNewCommitteeColor] = useState('#7C00FE');
  // Ban
  const [showBanModal, setShowBanModal] = useState(false);
  const [banTarget, setBanTarget] = useState<UserProfile | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banNote, setBanNote] = useState('');
  const [banDuration, setBanDuration] = useState<string>('7');
  const [banCustomEnd, setBanCustomEnd] = useState('');

  // Admin Action Authorization 2-Step Verification
  const [authActionType, setAuthActionType] = useState<AdminActionType | null>(null);
  const [authActionCallback, setAuthActionCallback] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => {
    const unsubCommittees = subscribeCommittees((list) => setCommittees(list));
    const unsubBans = subscribeBans((list) => setBans(list));
    // Real-time Supabase snapshot listener for users collection
    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const list: UserProfile[] = snapshot.docs.map((docSnap) => ({
          uid: docSnap.id,
          ...docSnap.data(),
        })) as UserProfile[];
        setEmployees(list);
        setLoading(false);
      },
      (err) => {
        console.warn('Supabase users snapshot notice:', err);
        // Local storage fallback listener
        const loadLocal = () => {
          const localList: UserProfile[] = JSON.parse(localStorage.getItem('elgogalyia_local_users') || '[]');
          setEmployees(localList);
          setLoading(false);
        };
        loadLocal();
        window.addEventListener('elgogalyia_data_change', loadLocal);
        return () => window.removeEventListener('elgogalyia_data_change', loadLocal);
      }
    );
    return () => { unsubscribe(); unsubCommittees(); unsubBans(); };
  }, []);

  const resetForm = () => {
    setFormDisplayName('');
    setFormUsername('');
    setFormPassword('');
    setFormRole('employee');
    setFormStatus('active');
    setFormCommitteeId('');
    setFormPermissions([]);
    setSelectedUser(null);
    setNewPassword('');
  };

  const handleOpenEdit = (user: UserProfile) => {
    setSelectedUser(user);
    setFormDisplayName(user.displayName);
    setFormUsername(user.username || '');
    setFormRole(user.role);
    setFormStatus(user.status);
    setFormCommitteeId(user.committeeId || '');
    setFormPermissions(user.permissions || []);
    setShowEditModal(true);
  };

  const handleTogglePermission = (perm: Permission) => {
    setFormPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  // Add Employee Handler (Protected by 2-Step Admin Auth)
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDisplayName.trim() || !formUsername.trim() || !formPassword.trim()) {
      toast.error('يرجى ملء جميع الحقول المطلوبة (الاسم، اسم المستخدم، وكلمة المرور).');
      return;
    }

    // Minimum password strength requirement
    if (formPassword.trim().length < 8) {
      toast.error('كلمة المرور يجب أن تكون 8 أحرف على الأقل.');
      return;
    }

    const unameLower = formUsername.trim().toLowerCase();

    // 1. Check Username Uniqueness (local state + Supabase double-check for race conditions)
    const existingLocal = employees.find((u) => (u.username || '').toLowerCase() === unameLower);
    if (existingLocal) {
      toast.error('اسم المستخدم مستخدم بالفعل');
      return;
    }
    try {
      const q = query(collection(db, 'users'), where('username', '==', unameLower));
      const snap = await getDocs(q);
      if (!snap.empty) {
        toast.error('اسم المستخدم مستخدم بالفعل');
        return;
      }
    } catch {}

    const targetAction: AdminActionType = formRole === 'admin' ? 'add_admin' : 'add_employee';

    const executeAdd = async () => {
      setSubmitting(true);
      try {
        // 2. Hash Password securely — NEVER store plaintext
        const salt = generateSalt();
        const passwordHash = await hashPassword(formPassword.trim(), salt);
        const generatedUid = 'user_' + unameLower.replace(/[^a-z0-9]/g, '_');

        const committee = committees.find(c => c.id === formCommitteeId) || null;

        // SECURITY: 'password' plaintext field intentionally omitted
        const newEmpDoc = {
          uid: generatedUid,
          username: unameLower,
          displayName: formDisplayName.trim(),
          role: formRole,
          status: formStatus,
          committeeId: committee?.id || null,
          committeeName: committee?.name || null,
          permissions: formPermissions,
          passwordHash,
          salt,
          oCoinsBalance: 0,
          createdAt: serverTimestamp(),
        };

        // Save to Supabase (Primary source of truth — must succeed)
        try {
          await setDoc(doc(db, 'users', generatedUid), newEmpDoc);
        } catch (e: any) {
          const errMsg = e?.code === 'permission-denied'
            ? 'خطأ في الصلاحيات. تأكد من تفعيل Supabase Rules الصحيحة.'
            : 'فشل الحفظ في Supabase. تحقق من الاتصال.';
          toast.error(errMsg);
          return; // Do not proceed if Supabase failed
        }

        toast.success(`تم إضافة ${formRole === 'admin' ? 'المشرف' : 'الموظف'} (${formDisplayName}) بنجاح!`);
        setShowAddModal(false);
        resetForm();
      } catch (err) {
        toast.error('حدث خطأ أثناء إضافة الحساب.');
      } finally {
        setSubmitting(false);
      }
    };

    setAuthActionCallback(() => executeAdd);
    setAuthActionType(targetAction);
  };

  // Update Employee Handler
  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setSubmitting(true);
    try {
      const committee = committees.find(c => c.id === formCommitteeId) || null;
      const updates = {
        displayName: formDisplayName.trim(),
        role: formRole,
        status: formStatus,
        committeeId: committee?.id || null,
        committeeName: committee?.name || null,
        permissions: formPermissions,
        updatedAt: new Date().toISOString(),
      };

      try {
        await updateDoc(doc(db, 'users', selectedUser.uid), updates);
      } catch (e) {}

      const localUsers: UserProfile[] = JSON.parse(localStorage.getItem('elgogalyia_local_users') || '[]');
      const updated = localUsers.map((u) => (u.uid === selectedUser.uid ? { ...u, ...updates } : u));
      localStorage.setItem('elgogalyia_local_users', JSON.stringify(updated));
      window.dispatchEvent(new Event('elgogalyia_data_change'));

      toast.success('تم تحديث بيانات الموظف بنجاح!');
      setShowEditModal(false);
      resetForm();
    } catch (err) {
      toast.error('حدث خطأ أثناء التحديث.');
    } finally {
      setSubmitting(false);
    }
  };

  // Change Password Handler (Protected by 2-Step Admin Auth)
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !newPassword.trim()) {
      toast.error('يرجى إدخال كلمة المرور الجديدة.');
      return;
    }
    if (newPassword.trim().length < 8) {
      toast.error('كلمة المرور يجب أن تكون 8 أحرف على الأقل.');
      return;
    }

    const targetUser = selectedUser;
    const pwd = newPassword.trim();

    const executeChangePassword = async () => {
      setSubmitting(true);
      try {
        const salt = generateSalt();
        const passwordHash = await hashPassword(pwd, salt);

        // Update only hashed credentials — NEVER store plaintext password
        await updateDoc(doc(db, 'users', targetUser.uid), {
          passwordHash,
          salt,
          updatedAt: serverTimestamp(),
        });

        toast.success(`تم تغيير كلمة المرور للموظف (${targetUser.displayName}) بنجاح!`);
        setShowPassModal(false);
        resetForm();
      } catch (err: any) {
        const errMsg = err?.code === 'permission-denied'
          ? 'ليس لديك صلاحية تغيير كلمة المرور.'
          : 'فشل تغيير كلمة المرور.';
        toast.error(errMsg);
      } finally {
        setSubmitting(false);
      }
    };

    setAuthActionCallback(() => executeChangePassword);
    setAuthActionType('change_user_password');
  };

  // Disable Employee Handler
  const handleToggleStatus = async (user: UserProfile) => {
    const nextStatus: UserStatus = user.status === 'active' ? 'suspended' : 'active';
    try {
      try {
        await updateDoc(doc(db, 'users', user.uid), { status: nextStatus });
      } catch (e) {}

      const localUsers: UserProfile[] = JSON.parse(localStorage.getItem('elgogalyia_local_users') || '[]');
      const updated = localUsers.map((u) => (u.uid === user.uid ? { ...u, status: nextStatus } : u));
      localStorage.setItem('elgogalyia_local_users', JSON.stringify(updated));
      window.dispatchEvent(new Event('elgogalyia_data_change'));

      toast.success(nextStatus === 'suspended' ? 'تم تعطيل حساب الموظف.' : 'تم تفعيل حساب الموظف.');
    } catch (e) {
      toast.error('فشل تغيير حالة الموظف.');
    }
  };

  // Delete Employee Handler (Preserves Audit History)
  const handleDeleteEmployee = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      try {
        await deleteDoc(doc(db, 'users', selectedUser.uid));
      } catch (e) {}

      const localUsers: UserProfile[] = JSON.parse(localStorage.getItem('elgogalyia_local_users') || '[]');
      const filtered = localUsers.filter((u) => u.uid !== selectedUser.uid);
      localStorage.setItem('elgogalyia_local_users', JSON.stringify(filtered));
      window.dispatchEvent(new Event('elgogalyia_data_change'));

      toast.success('تم حذف حساب الموظف بنجاح (مع الحفاظ على سجلات المهام والـ O Coins التاريخية).');
      setShowDeleteModal(false);
      resetForm();
    } catch (e) {
      toast.error('حدث خطأ أثناء الحذف.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCommittee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommitteeName.trim()) { toast.error('اسم اللجنة مطلوب'); return; }
    setSubmitting(true);
    try {
      await createCommittee({ name: newCommitteeName.trim(), description: newCommitteeDesc.trim(), color: newCommitteeColor }, userProfile?.username || 'admin');
      toast.success(`تم إنشاء اللجنة "${newCommitteeName}" بنجاح`);
      setNewCommitteeName(''); setNewCommitteeDesc(''); setNewCommitteeColor('#7C00FE');
      setShowCommitteeModal(false);
    } catch (err) { console.error(err); toast.error('فشل إنشاء اللجنة'); }
    finally { setSubmitting(false); }
  };

  const openBanModal = (emp: UserProfile) => {
    const active = getActiveBan(bans, emp.uid);
    if (active) { toast.error('Employee already has an active suspension'); return; }
    setBanTarget(emp); setBanReason(''); setBanNote(''); setBanDuration('7'); setBanCustomEnd(''); setShowBanModal(true);
  };
  // Ban confirmation handler (Protected by 2-Step Admin Auth)
  const handleConfirmBan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!banTarget || !banReason.trim()) { toast.error('سبب الحظر مطلوب'); return; }
    let end: Date;
    if (banDuration === 'custom') {
      if (!banCustomEnd) { toast.error('يرجى تحديد تاريخ نهاية الحظر'); return; }
      end = new Date(banCustomEnd);
    } else {
      const days = Number(banDuration);
      end = new Date(); end.setDate(end.getDate() + days);
    }
    if (end.getTime() <= Date.now()) { toast.error('يجب أن يكون تاريخ النهاية في المستقبل'); return; }

    const targetEmp = banTarget;
    const reasonText = banReason.trim();
    const noteText = banNote.trim();

    const executeBan = async () => {
      setSubmitting(true);
      try {
        await createBan({
          employee: targetEmp,
          startAt: new Date(),
          endAt: end,
          reason: reasonText,
          internalNote: noteText,
          actor: {
            uid: userProfile?.uid || '',
            email: userProfile?.email || userProfile?.username || '',
            displayName: userProfile?.displayName || 'Admin'
          }
        });
        toast.success(`تم حظر ${targetEmp.displayName} حتى ${end.toLocaleDateString('ar-EG')} وتصفير رصيد الـ O Coins بنجاح`);
        setShowBanModal(false);
        setBanTarget(null);
      } catch (err: any) {
        console.error(err);
        toast.error(err?.message || 'فشل تنفيذ الحظر');
      } finally {
        setSubmitting(false);
      }
    };

    setAuthActionCallback(() => executeBan);
    setAuthActionType('confirm_ban');
  };
  const handleEndBan = async (emp: UserProfile) => {
    const active = getActiveBan(bans, emp.uid);
    if (!active) { toast.error('No active ban'); return; }
    setSubmitting(true);
    try {
      await endBan(active.id, { uid: userProfile?.uid || '', email: userProfile?.email || userProfile?.username || '', displayName: userProfile?.displayName || 'Admin' });
      toast.success('Suspension lifted');
    } catch (e) { toast.error('Failed to lift'); }
    finally { setSubmitting(false); }
  };

  const filteredEmployees = employees.filter((e) => {
    const matchSearch = !search || (e.displayName || '').toLowerCase().includes(search.toLowerCase()) || (e.username || '').toLowerCase().includes(search.toLowerCase()) || (e.committeeName || '').toLowerCase().includes(search.toLowerCase());
    const matchCommittee = !committeeFilter || e.committeeId === committeeFilter;
    return matchSearch && matchCommittee;
  });

  return (
    <div className="space-y-6 font-sans dir-rtl text-right">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <Users className="h-7 w-7 text-blue-600" />
            إدارة الموظفين (Employee Management)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            إضافة وتعديل حسابات الموظفين، إسناد الصلاحيات، وإدارة حالات الدخول
          </p>
        </div>

        <Button
          onClick={() => { resetForm(); setShowAddModal(true); }}
          className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-3 rounded-xl shadow-md shadow-blue-600/20"
        >
          <UserPlus className="h-4 w-4" /> إضافة موظف جديد
        </Button>
      </div>

      {/* Search + Committee Filter */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Input
            placeholder="البحث بالاسم أو اسم المستخدم أو اللجنة..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="h-4 w-4 text-slate-400" />}
          />
        </div>
        <div className="flex gap-2">
          <Select
            value={committeeFilter}
            onChange={(e) => setCommitteeFilter(e.target.value)}
            options={[
              { value: '', label: 'كل اللجان' },
              ...committees.map((c) => ({ value: c.id, label: c.name })),
            ]}
            className="flex-1 lg:w-56"
          />
          <Button variant="outline" onClick={() => setShowCommitteeModal(true)} className="whitespace-nowrap gap-1.5 border-[#7C00FE]/20 text-[#7C00FE] hover:bg-[#7C00FE]/10">
            <Shield className="h-4 w-4" /> لجنة جديدة
          </Button>
        </div>
      </div>
      {/* Committee chips quick filter */}
      <div className="flex flex-wrap gap-2">
        {committees.map((c) => (
          <button
            key={c.id}
            onClick={() => setCommitteeFilter(committeeFilter === c.id ? '' : c.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-1.5 ${committeeFilter === c.id ? 'text-white shadow-sm' : 'bg-white hover:bg-slate-50'}`}
            style={committeeFilter === c.id ? { backgroundColor: c.color, borderColor: c.color } : { borderColor: '#e2e8f0', color: '#475569', backgroundColor: '#fff' }}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: committeeFilter === c.id ? '#fff' : c.color }} />
            {c.name}
          </button>
        ))}
      </div>

      {/* Employees Table - Desktop */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden hidden lg:block">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs sm:text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
              <tr>
                <th className="p-4">الموظف</th>
                <th className="p-4">اسم المستخدم (Username)</th>
                <th className="p-4 hidden md:table-cell">اللجنة (Committee)</th>
                <th className="p-4">الرتبة (Role)</th>
                <th className="p-4">الحالة (Status)</th>
                <th className="p-4">رصيد O Coins</th>
                <th className="p-4 text-left">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredEmployees.map((emp) => (
                <tr key={emp.uid} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={emp.displayName} src={emp.photoURL} size="sm" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-900">{emp.displayName}</p>
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                            {emp.employeeCode || generateEmployeeCode(emp.username || emp.uid)}
                          </span>
                        </div>
                        {emp.email && <p className="text-[11px] text-slate-400">{emp.email}</p>}
                      </div>
                    </div>
                  </td>

                  <td className="p-4 font-mono font-bold text-blue-600">
                    @{emp.username || 'n/a'}
                  </td>

                  <td className="p-4 hidden md:table-cell">
                    {emp.committeeName ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border" style={{ backgroundColor: committees.find(c=>c.id===emp.committeeId)?.color + '15' || '#f3f0ff', borderColor: committees.find(c=>c.id===emp.committeeId)?.color || '#7C00FE', color: committees.find(c=>c.id===emp.committeeId)?.color || '#7C00FE' }}>
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: committees.find(c=>c.id===emp.committeeId)?.color || '#7C00FE' }} />
                        {emp.committeeName}
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">—</span>
                    )}
                  </td>

                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${getRoleColor(emp.role)}`}>
                      {getRoleLabel(emp.role)}
                    </span>
                  </td>

                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                      emp.status === 'active'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${emp.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      {emp.status === 'active' ? 'نشط (Active)' : emp.status === 'suspended' ? 'معطّل (Suspended)' : 'غير نشط (Inactive)'}
                    </span>
                  </td>

                  <td className="p-4 font-bold text-slate-800">
                    🪙 {emp.oCoinsBalance ?? 0}
                  </td>

                  <td className="p-4 text-left">
                    {canManageRole(userProfile?.role ?? 'employee', emp.role) && (
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleOpenEdit(emp)} title="تعديل" className="p-2 hover:bg-slate-100 rounded-lg text-slate-600"><Edit3 className="h-4 w-4" /></button>
                        <button onClick={() => { setSelectedUser(emp); setShowPassModal(true); }} title="كلمة المرور" className="p-2 hover:bg-amber-50 rounded-lg text-amber-600"><KeyRound className="h-4 w-4" /></button>
                        {(() => { const ab = getActiveBan(bans, emp.uid); return ab ? (
                          <button onClick={() => handleEndBan(emp)} title={`Suspended until ${new Date(ab.endAt as any).toLocaleDateString()} — click to lift`} className="p-2 bg-rose-100 hover:bg-emerald-50 rounded-lg text-rose-700 hover:text-emerald-700 flex items-center gap-1 text-[10px] font-bold"><BanIcon className="h-3.5 w-3.5" /> Lift</button>
                        ) : (
                          <button onClick={() => openBanModal(emp)} title="Suspend employee" className="p-2 hover:bg-[#F5004F]/10 rounded-lg text-[#F5004F]"><Gavel className="h-4 w-4" /></button>
                        );})()}
                        <button onClick={() => handleToggleStatus(emp)} title={emp.status === 'active' ? 'تعطيل' : 'تفعيل'} className={`p-2 rounded-lg ${emp.status === 'active' ? 'hover:bg-rose-50 text-rose-600' : 'hover:bg-emerald-50 text-emerald-600'}`}>{emp.status === 'active' ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}</button>
                        <button onClick={() => { setSelectedUser(emp); setShowDeleteModal(true); }} title="حذف" className="p-2 hover:bg-rose-50 rounded-lg text-rose-600"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Employees Cards - Mobile */}
      <div className="lg:hidden space-y-3">
        {filteredEmployees.map((emp) => (
          <div key={`m-${emp.uid}`} className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar name={emp.displayName} src={emp.photoURL} size="sm" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-slate-900 text-sm">{emp.displayName}</p>
                    <span className="font-mono text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200">
                      {emp.employeeCode || generateEmployeeCode(emp.username || emp.uid)}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-[#7C00FE]">@{emp.username}</p>
                  {emp.committeeName && (
                    <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold border" style={{ backgroundColor: committees.find(c=>c.id===emp.committeeId)?.color + '12' || '#f3f0ff', color: committees.find(c=>c.id===emp.committeeId)?.color || '#7C00FE', borderColor: committees.find(c=>c.id===emp.committeeId)?.color + '30' || '#e9e5ff' }}>{emp.committeeName}</span>
                  )}
                </div>
              </div>
              <span className="text-xs font-black px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">🪙 {emp.oCoinsBalance ?? 0}</span>
            </div>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${getRoleColor(emp.role)}`}>{getRoleLabel(emp.role)}</span>
              <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${emp.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{emp.status}</span>
            </div>
            {canManageRole(userProfile?.role ?? 'employee', emp.role) && (
              <div className="grid grid-cols-5 gap-1.5 mt-3">
                <button onClick={() => handleOpenEdit(emp)} className="py-2 rounded-xl bg-slate-50 hover:bg-[#7C00FE]/10 text-slate-700 flex flex-col items-center gap-1 text-[10px] font-bold"><Edit3 className="h-4 w-4" /> Edit</button>
                <button onClick={() => { setSelectedUser(emp); setShowPassModal(true); }} className="py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 flex flex-col items-center gap-1 text-[10px] font-bold"><KeyRound className="h-4 w-4" /> Pass</button>
                {(() => { const ab = getActiveBan(bans, emp.uid); return ab ? (
                  <button onClick={() => handleEndBan(emp)} className="py-2 rounded-xl bg-emerald-50 text-emerald-700 flex flex-col items-center gap-1 text-[10px] font-bold"><BanIcon className="h-4 w-4" /> Unban</button>
                ) : (
                  <button onClick={() => openBanModal(emp)} className="py-2 rounded-xl bg-[#F5004F]/10 text-[#F5004F] flex flex-col items-center gap-1 text-[10px] font-bold"><Gavel className="h-4 w-4" /> Ban</button>
                );})()}
                <button onClick={() => handleToggleStatus(emp)} className={`py-2 rounded-xl flex flex-col items-center gap-1 text-[10px] font-bold ${emp.status === 'active' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>{emp.status === 'active' ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}{emp.status === 'active' ? 'Off' : 'On'}</button>
                <button onClick={() => { setSelectedUser(emp); setShowDeleteModal(true); }} className="py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex flex-col items-center gap-1 text-[10px] font-bold"><Trash2 className="h-4 w-4" /> Del</button>
              </div>
            )}
          </div>
        ))}
        {filteredEmployees.length === 0 && <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">No employees match your filters</div>}
      </div>

      {/* Modal: Add Employee */}
      <Modal
        open={showAddModal}
        onClose={() => { setShowAddModal(false); resetForm(); }}
        title="إضافة موظف جديد"
        description="أدخل البيانات واسم المستخدم وكلمة المرور وحدد الصلاحيات الدقيقة"
        size="lg"
      >
        <form onSubmit={handleAddEmployee} className="space-y-4 text-right dir-rtl">
          <Input
            label="الاسم الكامل (Display Name) *"
            placeholder="مثال: أحمد محمد"
            value={formDisplayName}
            onChange={(e) => setFormDisplayName(e.target.value)}
          />

          <Input
            label="اسم المستخدم (Username) *"
            placeholder="مثال: ahmed01"
            value={formUsername}
            onChange={(e) => setFormUsername(e.target.value)}
          />

          <Input
            label="كلمة المرور (Password) *"
            type="password"
            placeholder="••••••••"
            value={formPassword}
            onChange={(e) => setFormPassword(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="الرتبة (Role) *"
              value={formRole}
              onChange={(e) => setFormRole(e.target.value as UserRole)}
              options={[
                { value: 'member', label: '👤 MEMBER (عضو)' },
                { value: 'vice_head', label: '🔹 VICE-HEAD (نائب رئيس لجنة)' },
                { value: 'head', label: '🔸 HEAD (رئيس لجنة)' },
                { value: 'admin', label: '🛡️ Admin (مدير نظام - Legacy)' },
                ...(isTopTierRole(userProfile?.role ?? 'member') ? [
                  { value: 'superAdmin', label: '⭐ Super Admin' },
                  { value: 'co_lead', label: '🥈 CO-LEAD' },
                  { value: 'lead', label: '👑 LEAD' },
                ] : []),
              ]}
            />

            <Select
              label="الحالة (Status) *"
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value as UserStatus)}
              options={[
                { value: 'active', label: 'نشط (Active)' },
                { value: 'inactive', label: 'غير نشط (Inactive)' },
                { value: 'suspended', label: 'معطّل (Suspended)' },
              ]}
            />
          </div>

          <Select
            label="اللجنة (Committee)"
            value={formCommitteeId}
            onChange={(e) => setFormCommitteeId(e.target.value)}
            options={[
              { value: '', label: 'بدون لجنة' },
              ...committees.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />

          {/* Permissions Checkboxes */}
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <label className="form-label text-xs font-bold text-slate-700">الصلاحيات التفصيلية (Permissions)</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 border border-slate-200 rounded-xl bg-slate-50">
              {AVAILABLE_PERMISSIONS.map((p) => (
                <label key={p.key} className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200/60 cursor-pointer hover:bg-blue-50/50 text-xs">
                  <input
                    type="checkbox"
                    checked={formPermissions.includes(p.key)}
                    onChange={() => handleTogglePermission(p.key)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  <span className="font-semibold text-slate-800">{p.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>إلغاء</Button>
            <Button type="submit" loading={submitting} className="bg-blue-600 text-white font-bold">حفظ وإضافة الموظف</Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Employee */}
      <Modal
        open={showEditModal}
        onClose={() => { setShowEditModal(false); resetForm(); }}
        title="تعديل بيانات الموظف والصلاحيات"
        size="lg"
      >
        <form onSubmit={handleUpdateEmployee} className="space-y-4 text-right dir-rtl">
          <Input
            label="الاسم الكامل"
            value={formDisplayName}
            onChange={(e) => setFormDisplayName(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="الرتبة (Role)"
              value={formRole}
              onChange={(e) => setFormRole(e.target.value as UserRole)}
              options={[
                { value: 'member', label: '👤 MEMBER (عضو)' },
                { value: 'vice_head', label: '🔹 VICE-HEAD (نائب رئيس لجنة)' },
                { value: 'head', label: '🔸 HEAD (رئيس لجنة)' },
                { value: 'admin', label: '🛡️ Admin (مدير نظام - Legacy)' },
                ...(isTopTierRole(userProfile?.role ?? 'member') ? [
                  { value: 'superAdmin', label: '⭐ Super Admin' },
                  { value: 'co_lead', label: '🥈 CO-LEAD' },
                  { value: 'lead', label: '👑 LEAD' },
                ] : []),
              ]}
            />

            <Select
              label="الحالة (Status)"
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value as UserStatus)}
              options={[
                { value: 'active', label: 'نشط (Active)' },
                { value: 'inactive', label: 'غير نشط (Inactive)' },
                { value: 'suspended', label: 'معطّل (Suspended)' },
              ]}
            />
          </div>

          <Select
            label="اللجنة (Committee)"
            value={formCommitteeId}
            onChange={(e) => setFormCommitteeId(e.target.value)}
            options={[
              { value: '', label: 'بدون لجنة' },
              ...committees.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />

          <div className="pt-3 border-t border-slate-100 space-y-2">
            <label className="form-label text-xs font-bold text-slate-700">الصلاحيات التفصيلية (Permissions)</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 border border-slate-200 rounded-xl bg-slate-50">
              {AVAILABLE_PERMISSIONS.map((p) => (
                <label key={p.key} className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200/60 cursor-pointer hover:bg-blue-50/50 text-xs">
                  <input
                    type="checkbox"
                    checked={formPermissions.includes(p.key)}
                    onChange={() => handleTogglePermission(p.key)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  <span className="font-semibold text-slate-800">{p.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>إلغاء</Button>
            <Button type="submit" loading={submitting} className="bg-blue-600 text-white font-bold">تحديث البيانات</Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Change Password */}
      <Modal
        open={showPassModal}
        onClose={() => { setShowPassModal(false); resetForm(); }}
        title={`تغيير كلمة المرور للموظف: ${selectedUser?.displayName}`}
        size="sm"
      >
        <form onSubmit={handleChangePassword} className="space-y-4 text-right dir-rtl">
          <Input
            label="كلمة المرور الجديدة *"
            type="password"
            placeholder="••••••••"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowPassModal(false)}>إلغاء</Button>
            <Button type="submit" loading={submitting} className="bg-amber-600 hover:bg-amber-700 text-white font-bold">حفظ كلمة المرور الجديدة</Button>
          </div>
        </form>
      </Modal>

      {/* Dialog: Delete Confirmation */}
      <ConfirmDialog
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteEmployee}
        title="تأكيد حذف الموظف"
        description={`هل أنت متأكد من حذف حساب الموظف (${selectedUser?.displayName})؟ سيتم منع الحساب من الدخول نهائياً مع الحفاظ الكامل على سجل التسليمات والـ O Coins التاريخية.`}
        confirmLabel="تأكيد الحذف"
        cancelLabel="إلغاء"
        variant="danger"
        loading={submitting}
      />

      {/* Modal: Create Committee */}
      <Modal
        open={showCommitteeModal}
        onClose={() => setShowCommitteeModal(false)}
        title="إنشاء لجنة جديدة"
        description="أنشئ لجنة جديدة لتنظيم الموظفين وتسهيل الفلترة والتكليف"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowCommitteeModal(false)} disabled={submitting}>إلغاء</Button>
            <Button onClick={handleCreateCommittee as any} loading={submitting} className="bg-[#7C00FE] text-white">إنشاء اللجنة</Button>
          </>
        }
      >
        <div className="space-y-4 text-right dir-rtl">
          <Input label="اسم اللجنة *" placeholder="مثال: Marketing" value={newCommitteeName} onChange={(e) => setNewCommitteeName(e.target.value)} />
          <div>
            <label className="form-label">الوصف</label>
            <textarea className="form-input min-h-[70px]" placeholder="وصف مختصر للجنة..." value={newCommitteeDesc} onChange={(e) => setNewCommitteeDesc(e.target.value)} />
          </div>
          <div>
            <label className="form-label">اللون المميز</label>
            <div className="flex items-center gap-3">
              <input type="color" value={newCommitteeColor} onChange={(e) => setNewCommitteeColor(e.target.value)} className="h-10 w-16 rounded-xl border border-slate-200 p-1" />
              <span className="text-xs font-bold px-3 py-1.5 rounded-full text-white" style={{ backgroundColor: newCommitteeColor }}>{newCommitteeName || 'معاينة'}</span>
            </div>
            <div className="flex gap-2 mt-2 flex-wrap">
              {['#4338CA','#6366F1','#06b6d4','#10b981','#0ea5e9','#8b5cf6','#ec4899','#f59e0b'].map((col) => (
                <button key={col} type="button" onClick={() => setNewCommitteeColor(col)} className="w-7 h-7 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: col, outline: newCommitteeColor===col ? `2px solid ${col}` : 'none', outlineOffset: '2px' }} />
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal: Ban Employee */}
      <Modal
        open={showBanModal}
        onClose={() => { setShowBanModal(false); setBanTarget(null); }}
        title={`Suspension — ${banTarget?.displayName || ''}`}
        description={`Suspend ${banTarget?.username || ''} • All O Coins will be cleared (single penalty)`}
        size="md"
        footer={<><Button variant="outline" onClick={() => setShowBanModal(false)} disabled={submitting}>Cancel</Button><Button onClick={handleConfirmBan as any} loading={submitting} className="bg-[#F5004F] text-white gap-2"><BanIcon className="h-4 w-4" /> Confirm Suspension</Button></>}
      >
        <div className="space-y-4 text-left">
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-600 mt-0.5" />
            <p className="text-xs text-rose-800 leading-relaxed"><strong>Penalty:</strong> All {banTarget?.oCoinsBalance ?? 0} O Coins will be removed once, recorded as <code className="bg-white px-1 rounded">BAN_PENALTY</code>. Duplicate penalties prevented.</p>
          </div>
          <div>
            <label className="form-label">Duration *</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { v: '1', l: '1 Day' },
                { v: '3', l: '3 Days' },
                { v: '7', l: '7 Days' },
                { v: '14', l: '14 Days' },
                { v: '30', l: '1 Month' },
                { v: 'custom', l: 'Custom' },
              ].map((o) => (
                <button key={o.v} type="button" onClick={() => setBanDuration(o.v)} className={`py-2.5 rounded-xl text-xs font-bold border-2 ${banDuration===o.v ? 'bg-[#7C00FE] text-white border-[#7C00FE]' : 'bg-white text-slate-700 border-slate-200 hover:border-[#7C00FE]/30'}`}>{o.l}</button>
              ))}
            </div>
          </div>
          {banDuration === 'custom' && (
            <Input label="Custom End Date/Time *" type="datetime-local" value={banCustomEnd} onChange={(e) => setBanCustomEnd(e.target.value)} />
          )}
          <div>
            <label className="form-label">Reason *</label>
            <textarea className="form-input min-h-[80px]" placeholder="e.g. Repeated team policy violation..." value={banReason} onChange={(e) => setBanReason(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Internal note (optional)</label>
            <Input placeholder="Private admin note..." value={banNote} onChange={(e) => setBanNote(e.target.value)} />
          </div>
          <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border">
            Start: now • End: {banDuration === 'custom' ? (banCustomEnd ? new Date(banCustomEnd).toLocaleString() : '—') : `${banDuration} day(s) from now`} • Auto-expires without manual unban.
          </div>
        </div>
      </Modal>

      {/* 2-Step Admin Action Authorization Modal */}
      <AdminActionConfirmModal
        open={Boolean(authActionType)}
        actionType={authActionType}
        onClose={() => {
          setAuthActionType(null);
          setAuthActionCallback(null);
        }}
        onVerified={async () => {
          if (authActionCallback) {
            await authActionCallback();
          }
        }}
        loading={submitting}
      />
    </div>
  );
}
