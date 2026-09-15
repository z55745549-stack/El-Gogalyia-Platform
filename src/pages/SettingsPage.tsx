import React, { useState, useRef } from 'react';
import { toast } from 'sonner';
import { doc, updateDoc, query, collection, where, getDocs, serverTimestamp, db } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getRoleLabel, getRoleColor } from '@/utils/permissions';
import { formatOCoins, cn, formatFullName, formatTitleCaseLive, hasUnlimitedCoins } from '@/utils';
import { generateSalt, hashPassword } from '@/lib/auth-security';
import {
  Coins, Shield, User, Info, Users, KeyRound,
  Lock, AtSign, Eye, EyeOff, CheckCircle2, Sparkles, Infinity,
  Camera, Upload, Trash2, Check, RefreshCw, Crop
} from 'lucide-react';
import { DeviceIdentitySection } from '@/components/settings/DeviceIdentitySection';
import { ImageCropperModal } from '@/components/ui/ImageCropperModal';

export function SettingsPage() {
  const { userProfile, updateCurrentUserProfile } = useAuth();

  // Profile Edit State
  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Avatar Upload & Crop State
  const [avatarPreview, setAvatarPreview] = useState<string | null>(userProfile?.photoURL || null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Username & Password Change State
  const [newUsername, setNewUsername] = useState(userProfile?.username || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);

  if (!userProfile) return null;

  const isUnlimited = hasUnlimitedCoins(userProfile.role);

  // ─── 1. Image Upload & Crop Handler ──────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار ملف صورة صالح (PNG, JPG, WEBP).');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      toast.error('حجم الصورة كبير جداً. يرجى اختيار صورة أقل من 8 ميجابايت.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      if (src) {
        setCropImageSrc(src);
        setShowCropModal(true);
      }
    };
    reader.onerror = () => {
      toast.error('فشل في قراءة ملف الصورة.');
    };
    reader.readAsDataURL(file);

    // Reset input so user can pick the same file again if desired
    e.target.value = '';
  };

  const handleCropComplete = async (croppedDataUrl: string) => {
    setUploadingAvatar(true);
    try {
      setAvatarPreview(croppedDataUrl);
      await saveAvatar(croppedDataUrl);
      setShowCropModal(false);
      setCropImageSrc(null);
    } catch (err) {
      console.error(err);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const saveAvatar = async (photoUrl: string) => {
    try {
      await updateCurrentUserProfile({ photoURL: photoUrl });
      try {
        await updateDoc(doc(db, 'users', userProfile.uid), {
          photoURL: photoUrl,
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        // Fallback handled by updateCurrentUserProfile in AuthContext
      }
      toast.success('تم اقتصاص وحفظ صورة البروفايل بنجاح! 📸');
    } catch (err: any) {
      toast.error(err?.message || 'فشل حفظ صورة البروفايل.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setUploadingAvatar(true);
    try {
      await updateCurrentUserProfile({ photoURL: '' });
      try {
        await updateDoc(doc(db, 'users', userProfile.uid), {
          photoURL: '',
          updatedAt: serverTimestamp(),
        });
      } catch (e) {}
      setAvatarPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.success('تمت إزالة صورة البروفايل.');
    } catch (err: any) {
      toast.error('فشل إزالة الصورة.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // ─── 2. Update Display Name ───────────────────────────────────────────────
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
      try {
        await updateDoc(doc(db, 'users', userProfile.uid), {
          displayName: cleanName,
          updatedAt: serverTimestamp(),
        });
      } catch (e) {}
      toast.success('تم تحديث الاسم الظاهر بنجاح!');
    } catch (err: any) {
      toast.error(err?.message || 'فشل حفظ البيانات.');
    } finally {
      setSavingProfile(false);
    }
  };

  // ─── 3. Update Username & Password ─────────────────────────────────────────
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
    <div className="space-y-6 max-w-4xl mx-auto font-sans text-right dir-rtl pb-16">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[var(--brand-primary)] via-indigo-600 to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Shield className="h-5 w-5" />
            </div>
            <span>إعدادات الحساب والأمان</span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
            إدارة الهوية الرقمية، الصورة الشخصية، وبيانات المصادقة الخاصة بحسابك في منصة الجوجالية.
          </p>
        </div>
      </div>

      {/* ── Section 1: Ultra-Premium Masculine Profile Card ───────────────────── */}
      <div className="rounded-3xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--surface)] shadow-xl relative">
        {/* Ambient Glowing Header Banner */}
        <div className="h-28 sm:h-32 relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-950 p-6 flex items-start justify-between">
          {/* Subtle Cyber Grid & Light Bleed */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent opacity-60 pointer-events-none" />
          <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-[var(--brand-primary)]/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-10 -top-10 w-48 h-48 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-[10px] font-mono font-black uppercase tracking-wider bg-white/10 text-white/90 border border-white/15 backdrop-blur-md">
              PROFILE IDENTITY · 2026
            </span>
          </div>

          {/* O Coins Chip */}
          <div className="relative z-10 flex items-center gap-2.5 px-3.5 py-1.5 rounded-2xl bg-black/40 border border-amber-500/30 backdrop-blur-md shadow-lg">
            {isUnlimited ? (
              <Infinity className="h-4 w-4 text-amber-400 shrink-0" />
            ) : (
              <Coins className="h-4 w-4 text-amber-400 shrink-0" />
            )}
            <div className="text-right">
              <span className="text-[11px] font-black text-amber-300 font-mono">
                {isUnlimited ? '∞ لا محدود' : `${formatOCoins(userProfile.oCoinsBalance ?? 0)} OC`}
              </span>
            </div>
          </div>
        </div>

        {/* Profile Details & Avatar Upload Area */}
        <div className="px-6 sm:px-8 pb-8 -mt-12 sm:-mt-14 relative z-10 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">
            {/* Avatar & Interactive Upload Badge */}
            <div className="flex items-end gap-4">
              <div className="relative group">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden ring-4 ring-[var(--surface)] shadow-2xl bg-[var(--surface-elevated)] relative flex items-center justify-center">
                  <Avatar
                    src={avatarPreview || userProfile.photoURL}
                    name={userProfile.displayName || userProfile.username || 'User'}
                    size="xl"
                    className="w-full h-full rounded-none"
                  />

                  {/* Upload Overlay on Hover */}
                  <label
                    htmlFor="avatar-file-input"
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer text-white gap-1"
                    title="تغيير الصورة الشخصية"
                  >
                    <Camera className="h-6 w-6" />
                    <span className="text-[10px] font-bold">رفع صورة</span>
                  </label>
                </div>

                {/* Floating Quick Upload Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute -bottom-1 -left-1 p-2 rounded-xl bg-[var(--brand-primary)] text-white shadow-lg hover:scale-105 active:scale-95 transition-transform cursor-pointer border-2 border-[var(--surface)]"
                  title="رفع صورة جديدة"
                >
                  {uploadingAvatar ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Camera className="h-3.5 w-3.5" />
                  )}
                </button>

                {/* Hidden File Input */}
                <input
                  ref={fileInputRef}
                  id="avatar-file-input"
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* User Identity Info */}
              <div className="space-y-1 pb-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-black text-[var(--text-primary)]">
                    {userProfile.displayName || 'عضو الفريق'}
                  </h2>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" title="متصل الآن" />
                </div>
                <p className="text-xs font-mono font-bold text-[var(--text-muted)]">
                  @{userProfile.username || userProfile.email}
                </p>
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <span className={`badge text-xs font-black uppercase ${getRoleColor(userProfile.role)}`}>
                    {getRoleLabel(userProfile.role)}
                  </span>
                  <span className="badge text-xs font-bold bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                    {userProfile.committeeName || 'عضو عام بالمنصة'}
                  </span>
                </div>
              </div>
            </div>

            {/* Avatar Actions (Remove button if present) */}
            {(avatarPreview || userProfile.photoURL) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRemoveAvatar}
                disabled={uploadingAvatar}
                className="text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 border-rose-500/30 gap-1.5 self-start sm:self-auto cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>حذف الصورة</span>
              </Button>
            )}
          </div>

          {/* Edit Display Name Form */}
          <form onSubmit={handleSaveProfile} className="pt-4 border-t border-[var(--border-subtle)] space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
                  الاسم الكامل (الظاهر في المنصة والتكليفات)
                </label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(formatTitleCaseLive(e.target.value))}
                  placeholder="الاسم الكامل..."
                  leftIcon={<User className="h-4 w-4" />}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
                  اللجنة أو المسار المعتمد
                </label>
                <Input
                  value={userProfile.committeeName || 'لا تنتمي للجنة محددة حالياً'}
                  disabled
                  className="opacity-70 cursor-not-allowed bg-[var(--surface-elevated)]"
                  leftIcon={<Users className="h-4 w-4" />}
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                variant="default"
                loading={savingProfile}
                className="font-black text-xs px-6 gap-2 cursor-pointer shadow-md bg-gradient-to-r from-[var(--brand-primary)] to-indigo-600"
              >
                <Check className="h-4 w-4" />
                <span>حفظ التعديلات على الملف الشخصي</span>
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* ── Section 2: Security & Authentication Credentials ─────────────────── */}
      <div className="card p-6 sm:p-7 rounded-3xl space-y-6 border border-[var(--border-subtle)] shadow-xl">
        <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] pb-4">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-indigo-500/15 text-indigo-400">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-[var(--text-primary)]">
              بيانات الدخول وكلمة المرور المشفرة
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              تحديث المعرف الرقمي أو تعيين كلمة مرور قوية جديدة لحسابك.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveCredentials} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
              اسم المستخدم (Username)
            </label>
            <Input
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="e.g. ahmed_dev"
              leftIcon={<AtSign className="h-4 w-4" />}
              required
            />
            <p className="text-[11px] text-[var(--text-muted)] mt-1 font-mono">
              هذا المعرف يُستخدم لتسجيل الدخول إلى النظام.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
                كلمة المرور الجديدة
              </label>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="اتركها فارغة إذا لا تريد تغييرها"
                leftIcon={<Lock className="h-4 w-4" />}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
                تأكيد كلمة المرور الجديدة
              </label>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="أعد كتابة كلمة المرور للتأكيد"
                leftIcon={<Lock className="h-4 w-4" />}
              />
            </div>
          </div>

          {newPassword && (
            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="font-semibold flex items-center gap-1.5 cursor-pointer text-[var(--brand-primary)] hover:underline"
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                <span>{showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}</span>
              </button>
              <span className="text-[11px] text-[var(--text-muted)]">الحد الأدنى 6 أحرف أو أرقام</span>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              variant="default"
              loading={savingCredentials}
              className="font-black text-xs px-6 gap-2 cursor-pointer shadow-md bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
            >
              <Check className="h-4 w-4" />
              <span>تأكيد وتحديث بيانات الأمان</span>
            </Button>
          </div>
        </form>
      </div>

      {/* ── Section 3: Device Identity (Biometric / WebAuthn) ────────────────── */}
      <div className="card p-6 rounded-3xl">
        <DeviceIdentitySection />
      </div>

      {/* ── Section 4: High-Security Compliance Banner ───────────────────────── */}
      <div className="flex items-start gap-3.5 p-5 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)]">
        <Sparkles className="h-5 w-5 shrink-0 mt-0.5 text-[var(--brand-primary)]" />
        <div className="space-y-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--brand-primary)]">
            معايير الأمان وتشفير الحسابات
          </h3>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            تخضع جميع كلمات المرور لآليات التشفير التراكمي (PBKDF2 / Salted Hash). يتم حفظ بياناتك وصورتك الشخصية بصورة مشفرة وآمنة في منصة الجوجالية السحابية.
          </p>
        </div>
      </div>

      {/* Avatar Cropper Modal */}
      <ImageCropperModal
        open={showCropModal}
        imageSrc={cropImageSrc}
        onClose={() => {
          setShowCropModal(false);
          setCropImageSrc(null);
        }}
        onCropComplete={handleCropComplete}
        loading={uploadingAvatar}
      />
    </div>
  );
}
