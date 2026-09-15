import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { doc, updateDoc, query, collection, where, getDocs, serverTimestamp, db, auth, googleProvider, signInWithPopup, signOut as appSignOut } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { getRoleLabel, getRoleColor, isAdminRole } from '@/utils/permissions';
import { formatOCoins, cn, formatFullName, formatTitleCaseLive } from '@/utils';
import { generateSalt, hashPassword } from '@/lib/auth-security';
import { useMaintenance } from '@/hooks/useMaintenance';
import { DeviceIdentitySection } from '@/components/settings/DeviceIdentitySection';
// 2-Step admin auth removed — Lead/Co-Lead act directly
import {
  Coins, Mail, Shield, User, Info, Users, KeyRound,
  Lock, CheckCircle2, AlertTriangle, Sparkles, RefreshCw,
  Unlink, ShieldCheck, AtSign, Eye, EyeOff, Wrench, Bell
} from 'lucide-react';

export function SettingsPage() {
  const { userProfile, updateCurrentUserProfile } = useAuth();

  // Profile Edit State
  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Username & Password Change State
  const [newUsername, setNewUsername] = useState(userProfile?.username || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);

  // Maintenance Mode Hook
  const { isMaintenanceActive, maintenance, toggleMaintenance } = useMaintenance();
  const [togglingMaintenance, setTogglingMaintenance] = useState(false);
  const [customMaintenanceMsg, setCustomMaintenanceMsg] = useState('');

  if (!userProfile) return null;

  const isAdmin = isAdminRole(userProfile.role);

  // ─── 1. Update Display Name ───────────────────────────────────────────────
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formatFullName(displayName.trim());
    if (!cleanName) {
      toast.error('يرجى إدخال الاسم الظاهر.');
      return;
    }

    setSavingProfile(true);
    try {
      await updateCurrentUserProfile({ displayName: cleanName });
      toast.success('تم تحديث الاسم الظاهر بنجاح!');
    } catch (err: any) {
      toast.error(err?.message || 'فشل حفظ البيانات.');
    } finally {
      setSavingProfile(false);
    }
  };

  // ─── 2. Update Username & Password ─────────────────────────────────────────
  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = newUsername.trim().toLowerCase();
    const cleanPass = newPassword.trim();

    if (!cleanUser) {
      toast.error('يرجى كتابة اسم مستخدم صالح.');
      return;
    }

    if (cleanUser.length < 3) {
      toast.error('يجب أن يتكون اسم المستخدم من 3 أحرف على الأقل.');
      return;
    }

    // Check if new password is provided and valid
    if (cleanPass) {
      if (cleanPass.length < 6) {
        toast.error('يجب أن تتكون كلمة المرور الجديدة من 6 خانات على الأقل.');
        return;
      }
      if (cleanPass !== confirmPassword.trim()) {
        toast.error('كلمة المرور الجديدة وتأكيدها غير متطابقين.');
        return;
      }
    }

    setSavingCredentials(true);
    try {
      // If username changed, check uniqueness in Supabase
      if (cleanUser !== (userProfile.username || '').toLowerCase()) {
        const q = query(collection(db, 'users'), where('username', '==', cleanUser));
        const snap = await getDocs(q);
        const alreadyExists = snap.docs.some((d) => d.id !== userProfile.uid);
        if (alreadyExists) {
          toast.error('اسم المستخدم هذا مستخدم بالفعل من قبل شخص آخر. اختر اسماً آخر.');
          setSavingCredentials(false);
          return;
        }
      }

      const updates: any = {
        username: cleanUser,
        updatedAt: serverTimestamp(),
      };

      if (cleanPass) {
        const salt = generateSalt();
        const passwordHash = await hashPassword(cleanPass, salt);
        updates.passwordHash = passwordHash;
        updates.salt = salt;
      }

      await updateCurrentUserProfile(updates);

      // Also update Supabase doc directly
      try {
        await updateDoc(doc(db, 'users', userProfile.uid), updates);
      } catch (e) {}

      toast.success('تم تحديث بيانات الأمان واسم المستخدم بنجاح! 🔒');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err?.message || 'فشل تحديث بيانات الأمان.');
    } finally {
      setSavingCredentials(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-4xl mx-auto font-sans text-right dir-rtl pb-12">
      {/* Page Title & Context */}
      <div>
        <h1 className="page-title text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
          الإعدادات والأمان
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
          إدارة بيانات ملفك الشخصي، تحديث اسم المستخدم وكلمة المرور، وربط هوية الجهاز (بصمة / Face ID / قفل الشاشة) لتسجيل الدخول الفوري والآمن.
        </p>
      </div>

      {/* ─── Section 1: Profile Overview & Basic Details ───────────────────────── */}
      <div className="card p-6 sm:p-8 rounded-3xl space-y-6 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 border-b border-[var(--border-subtle)] pb-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar
                src={userProfile.photoURL}
                name={userProfile.displayName || userProfile.username || 'User'}
                size="xl"
                className="ring-4 ring-[var(--border-subtle)]"
              />
              <span className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-[var(--bg-card)] rounded-full" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-black text-[var(--text-primary)]">
                {userProfile.displayName || 'عضو الفريق'}
              </h2>
              <p className="text-xs font-bold text-[var(--text-muted)] font-mono">
                @{userProfile.username || userProfile.email}
              </p>
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <span className={`badge text-xs font-black uppercase ${getRoleColor(userProfile.role)}`}>
                  {getRoleLabel(userProfile.role)}
                </span>
                <span className={cn('badge text-xs font-bold', userProfile.status === 'active' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-rose-50 text-rose-700')}>
                  {userProfile.status === 'active' ? 'حساب نشط' : 'معلّق'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[var(--brand-warm)]/10 border border-[var(--brand-warm)]/30">
            <Coins className="h-6 w-6 text-[var(--brand-warm)] shrink-0" />
            <div>
              <span className="text-[10px] uppercase font-bold text-amber-800 dark:text-amber-300 block">رصيد المكافآت</span>
              <span className="text-sm font-black text-amber-900 dark:text-amber-100">{formatOCoins(userProfile.oCoinsBalance ?? 0)} O Coins</span>
            </div>
          </div>
        </div>

        {/* Edit Display Name Form */}
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label text-slate-700 dark:text-slate-300">الاسم الكامل (الظاهر في المنصة)</label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(formatTitleCaseLive(e.target.value))}
                placeholder="الاسم الكامل..."
                leftIcon={<User className="h-4 w-4" />}
                required
              />
            </div>

            <div>
              <label className="form-label text-slate-700 dark:text-slate-300">اللجنة / القسم</label>
              <Input
                value={userProfile.committeeName || 'غير مسند للجنة'}
                disabled
                className="opacity-70 bg-slate-100 dark:bg-[#1a1236] cursor-not-allowed"
                leftIcon={<Users className="h-4 w-4" />}
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              variant="default"
              loading={savingProfile}
              className="font-bold text-xs px-6"
            >
              حفظ بيانات الملف الشخصي
            </Button>
          </div>
        </form>
      </div>

      {/* ─── Section 2: Security & Credentials (Change Username & Password) ────── */}
      <div className="card p-6 sm:p-8 rounded-3xl space-y-6 transition-colors">
        <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] pb-4">
          <div className="w-10 h-10 rounded-2xl bg-[var(--brand-primary)]/15 text-[var(--brand-primary)] flex items-center justify-center font-black">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-[var(--text-primary)]">
              بيانات تسجيل الدخول وتغيير كلمة المرور
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              يمكنك تحديث اسم المستخدم أو تعيين كلمة مرور جديدة لحسابك بأمان.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveCredentials} className="space-y-4">
          {/* Username Change */}
          <div>
            <label className="form-label text-slate-700 dark:text-slate-300">اسم المستخدم (Username)</label>
            <Input
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="e.g. ahmed_dev"
              leftIcon={<AtSign className="h-4 w-4" />}
              required
            />
            <p className="text-[11px] text-slate-400 mt-1">
              اسم المستخدم هو المعرف الذي تستخدمه عند تسجيل الدخول للنظام.
            </p>
          </div>

          {/* New Password Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="form-label text-slate-700 dark:text-slate-300">كلمة المرور الجديدة</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="اتركها فارغة إذا لا تريد تغييرها"
                  leftIcon={<Lock className="h-4 w-4" />}
                />
              </div>
            </div>

            <div>
              <label className="form-label text-slate-700 dark:text-slate-300">تأكيد كلمة المرور الجديدة</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="أعد كتابة كلمة المرور الجديدة"
                  leftIcon={<Lock className="h-4 w-4" />}
                />
              </div>
            </div>
          </div>

          {newPassword && (
            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-xs font-semibold text-[#FF3483] hover:underline flex items-center gap-1 cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                <span>{showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}</span>
              </button>
              <span className="text-[11px] text-slate-400">الحد الأدنى 6 أحرف أو أرقام</span>
            </div>
          )}

          <div className="flex justify-end pt-3">
            <Button
              type="submit"
              variant="default"
              loading={savingCredentials}
              className="font-bold text-xs px-6"
            >
              حفظ وتحديث بيانات الأمان
            </Button>
          </div>
        </form>
      </div>

      {/* ─── Section 3: Device Identity (هوية الجهاز / المصادقة البيومترية) ─── */}
      <div className="card p-6 sm:p-8 rounded-3xl transition-colors">
        <DeviceIdentitySection />
      </div>

      {/* ─── Notification Preferences Section ────────────────────────────────── */}
      <div className="card p-6 sm:p-8 rounded-3xl space-y-6 transition-colors">
        <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] pb-4">
          <div className="w-10 h-10 rounded-2xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center font-bold">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-[var(--text-primary)]">
              تفضيلات وقنوات التنبيهات (Notification Preferences)
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              تحكم في فئات الإشعارات التي تتلقاها بشكل فوري على حسابك في المنصة.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              id: 'tasks',
              title: 'تنبيهات المهام والتكليفات',
              desc: 'عند إسناد تكليف جديد، اعتماد تسليمك، أو اقتراب موعد التسليم.',
              icon: '📋',
            },
            {
              id: 'support',
              title: 'تنبيهات تذاكر الدعم الفني',
              desc: 'عند إضافة رد جديد على تذكرتك أو تغيير حالتها.',
              icon: '🎫',
            },
            {
              id: 'meetings',
              title: 'الاجتماعات واللقاءات',
              desc: 'دعوات وتحديثات مواعيد اللقاءات والورش الدورية.',
              icon: '🗓️',
            },
            {
              id: 'ocoins',
              title: 'مكافآت O Coins',
              desc: 'إشعار فوري عند إضافة عملات لحسابك أو صرف مكافأة.',
              icon: '🪙',
            },
          ].map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/40 flex items-start justify-between gap-3"
            >
              <div className="flex items-start gap-3">
                <span className="text-xl">{item.icon}</span>
                <div>
                  <h4 className="text-xs font-bold text-[var(--text-primary)]">{item.title}</h4>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40 shrink-0">
                مفعل دائماً
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Admin Section: Immediate Maintenance Mode (وضعية الصيانة الفورية) ─── */}
      {isAdmin && (
        <div className="card p-6 sm:p-8 rounded-3xl border border-[var(--brand-danger)]/30 space-y-6 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[var(--brand-danger)]/10 flex items-center justify-center text-[var(--brand-danger)]">
                <Wrench className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                  <span>وضعية الصيانة الفورية للتحديثات</span>
                  {isMaintenanceActive ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-[var(--brand-danger)] text-white text-[10px] font-black uppercase animate-pulse">
                      مفعلة حالياً
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase">
                      متوقفة (المنصة متاحة)
                    </span>
                  )}
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  إيقاف المنصة مؤقتاً وحجب الوصول عن جميع الأعضاء وإظهار شاشة الصيانة الفورية أثناء إجراء التحديثات.
                </p>
              </div>
            </div>

            <Button
              variant={isMaintenanceActive ? 'destructive' : 'default'}
              loading={togglingMaintenance}
              onClick={async () => {
                if (isMaintenanceActive) {
                  // Disable maintenance mode (no verification needed to reopen platform)
                  setTogglingMaintenance(true);
                  try {
                    await toggleMaintenance(false, customMaintenanceMsg || undefined);
                    toast.success('تم إنهاء وضعية الصيانة بنجاح وإتاحة المنصة للجميع! ✨');
                  } catch {
                    toast.error('حدث خطأ أثناء تعطيل وضع الصيانة.');
                  } finally {
                    setTogglingMaintenance(false);
                  }
                } else {
                  // Enable maintenance mode — direct execution, no 2-Step
                  setTogglingMaintenance(true);
                  try {
                    await toggleMaintenance(true, customMaintenanceMsg || undefined);
                    toast.warning('تم تشغيل وضعية الصيانة الفورية! تم حجب المنصة عن الأعضاء.');
                  } catch {
                    toast.error('حدث خطأ أثناء تفعيل وضع الصيانة.');
                  } finally {
                    setTogglingMaintenance(false);
                  }
                }
              }}
              className="font-black text-xs gap-2 shrink-0"
            >
              <Wrench className="h-4 w-4" />
              <span>{isMaintenanceActive ? 'تعطيل وضع الصيانة وإتاحة المنصة' : 'تفعيل وضع الصيانة الفورية الآن'}</span>
            </Button>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-bold text-[var(--text-secondary)]">
              نص رسالة الصيانة التي تظهر للأعضاء:
            </label>
            <Input
              value={customMaintenanceMsg || maintenance.message}
              onChange={(e) => setCustomMaintenanceMsg(e.target.value)}
              placeholder="المنصة في وضعية الصيانة الفورية للتحديثات , يرجي الانتظار لانتهاء من الصيانة"
              disabled={isMaintenanceActive}
            />
            <p className="text-[11px] text-[var(--text-muted)]">
              * ملاحظة: المشرفون والمسؤولون فقط هم من يستطيعون تخطي هذه الشاشة واستخدام المنصة أثناء تفعيل الصيانة.
            </p>
          </div>

          {isMaintenanceActive && maintenance.enabledAt && (
            <div className="p-3.5 rounded-2xl bg-[var(--brand-danger)]/10 border border-[var(--brand-danger)]/20 text-xs text-[var(--brand-danger)] flex items-center justify-between">
              <span>تم التفعيل بواسطة: <strong>{maintenance.enabledByName || maintenance.enabledBy || 'المسؤول'}</strong></span>
              <span>في: {new Date(maintenance.enabledAt).toLocaleString('ar-EG')}</span>
            </div>
          )}
        </div>
      )}

      {/* ─── Section 4: System Governance & Permissions Info ─────────────────── */}
      <div className="card p-5 sm:p-6 rounded-3xl flex items-start gap-3.5 transition-colors">
        <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            سياسة الأمان وحماية البيانات في النظام
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            تخضع جميع العمليات والتسليمات وسجلات الدخول للتسجيل المباشر في سجل النشاطات (Activity Logs). 
            يتم تشفير كلمات المرور باستخدام خوارزميات التشفير القياسية Salted SHA-256، ويتم حفظ بيانات الرصيد والمهام بأعلى درجات الأمان في قواعد بيانات Supabase السحابية.
          </p>
        </div>
      </div>



      {/* 2-Step Verification for Maintenance Mode removed — Lead/Co-Lead act directly */}
    </div>
  );
}

