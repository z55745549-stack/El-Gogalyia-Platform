import React, { useState } from 'react';
import { toast } from 'sonner';
import { doc, updateDoc, query, collection, where, getDocs, serverTimestamp, db } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getRoleLabel, getRoleColor } from '@/utils/permissions';
import { formatOCoins, cn, formatFullName, formatTitleCaseLive, hasUnlimitedCoins } from '@/utils';
import { generateSalt, hashPassword } from '@/lib/auth-security';
import { DeviceIdentitySection } from '@/components/settings/DeviceIdentitySection';
import {
  Coins, Shield, User, Info, Users, KeyRound,
  Lock, AtSign, Eye, EyeOff, Bell, CheckCircle2, Sparkles, Infinity
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

  if (!userProfile) return null;

  const isUnlimited = hasUnlimitedCoins(userProfile.role);

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
      if (cleanUser !== (userProfile.username || '').toLowerCase()) {
        const q = query(collection(db, 'users'), where('username', '==', cleanUser));
        const snap = await getDocs(q);
        const alreadyExists = snap.docs.some((d) => d.id !== userProfile.uid);
        if (alreadyExists) {
          toast.error('اسم المستخدم هذا مستخدم بالفعل. اختر اسماً آخر.');
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
    <div className="space-y-5 max-w-3xl mx-auto font-sans text-right dir-rtl pb-14">

      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">الإعدادات والأمان</h1>
          <p className="page-subtitle mt-1">
            إدارة بيانات ملفك الشخصي، تحديث بيانات الدخول، وهوية الجهاز البيومترية.
          </p>
        </div>
      </div>

      {/* ── Section 1: Profile Card ───────────────────────────────────────────── */}
      <div className="card rounded-3xl overflow-hidden">
        {/* Gradient banner */}
        <div
          className="h-20 relative"
          style={{
            background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-accent) 100%)',
            opacity: 0.85,
          }}
        />

        {/* Profile details */}
        <div className="px-6 pb-6 -mt-10 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <div className="relative">
                <Avatar
                  src={userProfile.photoURL}
                  name={userProfile.displayName || userProfile.username || 'User'}
                  size="xl"
                  className="ring-4 ring-[var(--surface)] shadow-xl"
                />
                <span className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-[var(--surface)] rounded-full" />
              </div>
              <div className="mb-1 space-y-1">
                <h2 className="text-xl font-black text-[var(--text-primary)]">
                  {userProfile.displayName || 'عضو الفريق'}
                </h2>
                <p className="text-xs font-bold text-[var(--text-muted)] font-mono">
                  @{userProfile.username || userProfile.email}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`badge text-xs font-black uppercase ${getRoleColor(userProfile.role)}`}>
                    {getRoleLabel(userProfile.role)}
                  </span>
                  <span className={cn(
                    'badge text-xs font-bold',
                    userProfile.status === 'active'
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-rose-50 text-rose-700'
                  )}>
                    {userProfile.status === 'active' ? 'حساب نشط' : 'معلّق'}
                  </span>
                </div>
              </div>
            </div>

            {/* O Coins chip */}
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-2xl shrink-0"
              style={{
                background: 'rgba(245,158,11,0.1)',
                border: '1px solid rgba(245,158,11,0.3)',
              }}
            >
              {isUnlimited
                ? <Infinity className="h-6 w-6 shrink-0" style={{ color: 'var(--brand-warm)' }} />
                : <Coins className="h-6 w-6 shrink-0" style={{ color: 'var(--brand-warm)' }} />
              }
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold block" style={{ color: 'var(--brand-warm)', opacity: 0.8 }}>
                  رصيد المكافآت
                </span>
                <span className="text-sm font-black" style={{ color: 'var(--brand-warm)' }}>
                  {isUnlimited ? '∞ لا محدود' : `${formatOCoins(userProfile.oCoinsBalance ?? 0)} O Coins`}
                </span>
              </div>
            </div>
          </div>

          {/* Edit Display Name Form */}
          <form onSubmit={handleSaveProfile} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">الاسم الكامل (الظاهر في المنصة)</label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(formatTitleCaseLive(e.target.value))}
                  placeholder="الاسم الكامل..."
                  leftIcon={<User className="h-4 w-4" />}
                  required
                />
              </div>
              <div>
                <label className="form-label">اللجنة / القسم</label>
                <Input
                  value={userProfile.committeeName || 'لا تنتمي للجنة محددة'}
                  disabled
                  className="opacity-60 cursor-not-allowed"
                  leftIcon={<Users className="h-4 w-4" />}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" variant="default" loading={savingProfile} className="font-bold text-xs px-6">
                حفظ بيانات الملف الشخصي
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* ── Section 2: Security & Credentials ────────────────────────────────── */}
      <div className="card p-6 rounded-3xl space-y-5">
        <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] pb-4">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(108,99,255,0.12)', color: 'var(--brand-primary)' }}
          >
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-[var(--text-primary)]">
              بيانات تسجيل الدخول وكلمة المرور
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              تحديث اسم المستخدم أو تعيين كلمة مرور جديدة لحسابك.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveCredentials} className="space-y-4">
          <div>
            <label className="form-label">اسم المستخدم (Username)</label>
            <Input
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="e.g. ahmed_dev"
              leftIcon={<AtSign className="h-4 w-4" />}
              required
            />
            <p className="text-[11px] text-[var(--text-muted)] mt-1">
              هذا المعرف يُستخدم لتسجيل الدخول للنظام.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">كلمة المرور الجديدة</label>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="اتركها فارغة إذا لا تريد تغييرها"
                leftIcon={<Lock className="h-4 w-4" />}
              />
            </div>
            <div>
              <label className="form-label">تأكيد كلمة المرور الجديدة</label>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="أعد كتابة كلمة المرور الجديدة"
                leftIcon={<Lock className="h-4 w-4" />}
              />
            </div>
          </div>

          {newPassword && (
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                style={{ color: 'var(--brand-primary)' }}
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                <span>{showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}</span>
              </button>
              <span className="text-[11px] text-[var(--text-muted)]">الحد الأدنى 6 أحرف أو أرقام</span>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <Button type="submit" variant="default" loading={savingCredentials} className="font-bold text-xs px-6">
              حفظ وتحديث بيانات الأمان
            </Button>
          </div>
        </form>
      </div>

      {/* ── Section 3: Device Identity (Biometric) ───────────────────────────── */}
      <div className="card p-6 rounded-3xl">
        <DeviceIdentitySection />
      </div>

      {/* ── Section 4: Notification Preferences ──────────────────────────────── */}
      <div className="card p-6 rounded-3xl space-y-5">
        <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] pb-4">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(108,99,255,0.1)', color: 'var(--brand-primary)' }}
          >
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-[var(--text-primary)]">
              تفضيلات التنبيهات
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              جميع الإشعارات الجوهرية مفعلة تلقائياً لضمان لا تفوتك أي تحديثات.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { icon: '📋', title: 'تنبيهات المهام والتكليفات', desc: 'عند إسناد تكليف جديد أو اقتراب موعد التسليم.' },
            { icon: '🎫', title: 'تنبيهات تذاكر الدعم الفني', desc: 'عند إضافة رد جديد أو تغيير حالة التذكرة.' },
            { icon: '🗓️', title: 'الاجتماعات واللقاءات', desc: 'دعوات وتحديثات مواعيد اللقاءات الدورية.' },
            { icon: '🪙', title: 'مكافآت O Coins', desc: 'إشعار فوري عند إضافة عملات أو صرف مكافأة.' },
          ].map((item) => (
            <div
              key={item.title}
              className="flex items-start gap-3 p-4 rounded-2xl"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
            >
              <span className="text-xl mt-0.5">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-[var(--text-primary)]">{item.title}</h4>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-relaxed">{item.desc}</p>
              </div>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0" style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}>
                <CheckCircle2 className="h-3 w-3" />
                دائماً
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 5: Security Policy Info ──────────────────────────────────── */}
      <div
        className="flex items-start gap-3.5 p-5 rounded-2xl"
        style={{ background: 'rgba(108,99,255,0.06)', border: '1px solid rgba(108,99,255,0.15)' }}
      >
        <Sparkles className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'var(--brand-primary)' }} />
        <div className="space-y-1">
          <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--brand-primary)' }}>
            سياسة الأمان وحماية البيانات
          </h3>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            جميع العمليات مسجلة في سجل النشاطات. تشفير كلمات المرور بـ Salted SHA-256.
            بيانات الرصيد والمهام محفوظة بأعلى درجات الأمان في Supabase السحابية.
          </p>
        </div>
      </div>
    </div>
  );
}
