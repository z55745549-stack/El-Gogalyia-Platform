import React, { useState, useRef } from 'react';
import { toast } from 'sonner';
import { doc, updateDoc, query, collection, where, getDocs, serverTimestamp, db } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { VerifiedBadge } from '@/components/ui/VerifiedBadge';
import { getRoleLabel, getRoleColor, isUserVerified } from '@/utils/permissions';
import { formatOCoins, cn, formatFullName, formatTitleCaseLive, hasUnlimitedCoins, formatDate } from '@/utils';
import { generateSalt, hashPassword } from '@/lib/auth-security';
import {
  Coins, Shield, User, Users, KeyRound,
  Lock, AtSign, Eye, EyeOff, CheckCircle2, Sparkles, Infinity,
  Camera, Upload, Trash2, Check, RefreshCw, Tag,
  Calendar, ShieldCheck, ArrowUpRight, Smartphone, Fingerprint
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { DeviceIdentitySection } from '@/components/settings/DeviceIdentitySection';
import { ImageCropperModal } from '@/components/ui/ImageCropperModal';

export function SettingsPage() {
  const { userProfile, updateCurrentUserProfile } = useAuth();
  const { t, isRTL } = useLanguage();

  // Profile Edit State
  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [specialtyTag, setSpecialtyTag] = useState(userProfile?.specialtyTag || '');
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
  const verified = isUserVerified(userProfile);

  // Interactive mouse spotlight handler for cards
  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
  };

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
      } catch (e) {}
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
      toast.success('تمت إزالة صورة البروفايل بنجاح.');
    } catch (err: any) {
      toast.error(err?.message || 'فشل في إزالة صورة البروفايل.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // ─── 2. Update Display Name & Specialty Tag ──────────────────────────────
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = displayName.trim();
    const cleanTag = specialtyTag.trim();

    if (!cleanName) {
      toast.error('يرجى إدخال اسم عرض صالح.');
      return;
    }

    setSavingProfile(true);
    try {
      const updates = {
        displayName: cleanName,
        specialtyTag: cleanTag,
        updatedAt: serverTimestamp(),
      };

      await updateCurrentUserProfile(updates);
      try {
        await updateDoc(doc(db, 'users', userProfile.uid), updates);
      } catch (e) {}

      toast.success('تم حفظ وتحديث بيانات الملف الشخصي بنجاح! ✨');
    } catch (err: any) {
      toast.error(err?.message || 'فشل حفظ بيانات الملف الشخصي.');
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
    <div className={cn("space-y-6 max-w-6xl mx-auto font-sans pb-16 cyber-grid-bg p-2 sm:p-4 transition-all", isRTL ? "text-right dir-rtl" : "text-left")}>
      
      {/* ── Main Executive Grid: Identity Card on side, Settings on the other ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* ─── Column 1 (lg:col-span-5): Official Identity Card ────────────── */}
        <div className="lg:col-span-5 space-y-4">
          <div
            onMouseMove={handleCardMouseMove}
            className="glow-card-interactive rounded-3xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--surface)] shadow-2xl relative"
          >
            {/* Ambient Cyber Cover Banner */}
            <div className="h-28 relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-4 flex items-start justify-between">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-500/25 via-transparent to-transparent opacity-70 pointer-events-none" />
              <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-[var(--brand-primary)]/20 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -left-10 -top-10 w-40 h-40 bg-cyan-500/20 rounded-full blur-2xl pointer-events-none" />

              <span className="relative z-10 px-3 py-1 rounded-full text-[10px] font-mono font-black uppercase tracking-wider bg-white/10 text-white/90 border border-white/15 backdrop-blur-md">
                OFFICIAL IDENTITY
              </span>

              {verified && (
                <div className="relative z-10 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[11px] font-black backdrop-blur-md">
                  <VerifiedBadge size="xs" />
                  <span>موثق رسمياً</span>
                </div>
              )}
            </div>

            {/* Profile Content */}
            <div className="px-6 pb-6 -mt-14 relative z-10 space-y-4">
              {/* Avatar Frame with Upload Button */}
              <div className="flex flex-col items-center sm:items-start">
                <div className="relative group shrink-0">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden ring-4 ring-[var(--surface)] shadow-2xl bg-[var(--surface-elevated)] relative flex items-center justify-center border-2 border-indigo-500/30">
                    <Avatar
                      src={avatarPreview || userProfile.photoURL}
                      name={userProfile.displayName || userProfile.username || 'User'}
                      size="xl"
                      className="w-full h-full rounded-none"
                    />

                    {/* Upload Overlay */}
                    <label
                      htmlFor="avatar-file-input"
                      className="absolute inset-0 bg-black/65 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer text-white gap-1 backdrop-blur-xs"
                      title="تغيير الصورة"
                    >
                      <Camera className="h-5 w-5 text-indigo-300" />
                      <span className="text-[10px] font-bold">تغيير</span>
                    </label>
                  </div>

                  {/* Floating Camera Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className={cn(
                      "absolute -bottom-1 p-2 rounded-xl bg-[var(--brand-primary)] text-white shadow-xl hover:scale-110 active:scale-95 transition-all cursor-pointer border-2 border-[var(--surface)]",
                      isRTL ? "-left-1" : "-right-1"
                    )}
                    title="رفع واقتصاص صورة جديدة"
                  >
                    {uploadingAvatar ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Camera className="h-3.5 w-3.5" />
                    )}
                  </button>

                  <input
                    ref={fileInputRef}
                    id="avatar-file-input"
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              </div>

              {/* User Identity Details */}
              <div className="space-y-2 text-center sm:text-right">
                <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tracking-tight glow-text">
                    {formatFullName(userProfile.displayName || t('common.team_member', 'عضو الفريق'))}
                  </h2>
                  {verified && <VerifiedBadge size="sm" />}
                </div>

                <p className="text-xs font-mono font-bold text-[var(--text-muted)] flex items-center justify-center sm:justify-start gap-1">
                  <AtSign className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
                  <span>{userProfile.username || userProfile.email}</span>
                </p>

                {/* Badges Flow */}
                <div className="flex items-center justify-center sm:justify-start gap-1.5 flex-wrap pt-1">
                  <span className={cn("badge text-xs font-black uppercase shadow-xs glow-badge", getRoleColor(userProfile.role))}>
                    {getRoleLabel(userProfile.role)}
                  </span>
                  <span className="badge text-xs font-bold bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] shadow-xs">
                    🏛️ {userProfile.committeeName || 'القيادة العامة للمنظومة'}
                  </span>
                  {specialtyTag && (
                    <span className="badge text-xs font-bold bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 shadow-xs">
                      🏷️ {specialtyTag}
                    </span>
                  )}
                </div>

                {/* Avatar Action Buttons */}
                <div className="flex items-center justify-center sm:justify-start gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="text-xs font-bold gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Upload className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
                    <span>تغيير الصورة</span>
                  </Button>

                  {(avatarPreview || userProfile.photoURL) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRemoveAvatar}
                      disabled={uploadingAvatar}
                      className="text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 border-rose-500/30 gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>حذف</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Quick Meta Cards */}
              <div className="pt-4 border-t border-[var(--border-subtle)] space-y-2.5">
                {/* O-Coins Card */}
                <Link
                  to="/ocoins"
                  className="flex items-center justify-between p-3 rounded-2xl bg-[var(--surface-elevated)]/60 border border-[var(--border-subtle)] hover:border-amber-500/40 transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
                      <Coins className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-[var(--text-muted)] block">رصيد O-Coins</span>
                      <strong className="text-xs font-black text-amber-400 font-mono">
                        {isUnlimited ? '∞ خزينة لا نهائية' : `${formatOCoins(userProfile.oCoinsBalance ?? 0)} OC`}
                      </strong>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-[var(--text-muted)] group-hover:text-amber-400 transition-colors" />
                </Link>

                {/* Verification Meta */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-[var(--surface-elevated)]/60 border border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
                      <VerifiedBadge size="sm" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-[var(--text-muted)] block">حالة التوثيق (Meta)</span>
                      <strong className="text-xs font-bold text-[var(--text-primary)]">
                        {verified ? 'موثق رسمياً بالكامل' : 'عضو مسجل'}
                      </strong>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    رسمي
                  </span>
                </div>

                {/* Join Date Meta */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-[var(--surface-elevated)]/60 border border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-[var(--text-muted)] block">تاريخ الانضمام</span>
                      <strong className="text-xs font-bold text-[var(--text-primary)] font-mono">
                        {formatDate(userProfile.createdAt)}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Column 2 (lg:col-span-7): Logical Management Sections ──────── */}
        <div className="lg:col-span-7 space-y-6">

          {/* Card 1: Personal & Professional Details */}
          <div
            onMouseMove={handleCardMouseMove}
            className="glow-card-interactive p-6 sm:p-7 rounded-3xl space-y-5 border border-[var(--border-subtle)] bg-[var(--surface)] shadow-xl"
          >
            <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] pb-4">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-[var(--brand-primary)]/15 text-[var(--brand-primary)] border border-[var(--brand-primary)]/30 shrink-0">
                <User className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-[var(--text-primary)] glow-text">
                  البيانات الشخصية والمهنية
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  تحديث اسم العرض، اللقب التخصصي، واللجنة الرسمية التابع لها.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
                    {t('settings.display_name', 'الاسم الكامل')}
                  </label>
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(formatTitleCaseLive(e.target.value))}
                    placeholder={t('settings.display_name', 'الاسم الكامل...')}
                    leftIcon={<User className="h-4 w-4 text-[var(--brand-primary)]" />}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
                    {t('common.committee', 'اللجنة المسندة')}
                  </label>
                  <Input
                    value={userProfile.committeeName || t('common.no_committee', 'القيادة العليا للمنظومة')}
                    disabled
                    className="opacity-75 cursor-not-allowed bg-[var(--surface-elevated)] text-[var(--text-secondary)] font-bold"
                    leftIcon={<Users className="h-4 w-4 text-[var(--brand-primary)]" />}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
                  {t('settings.specialty_tag', 'الوسم التخصصي / مجال الاهتمام')}
                </label>
                <Input
                  value={specialtyTag}
                  onChange={(e) => setSpecialtyTag(e.target.value)}
                  placeholder="مثال: Flutter, AI Engineering, UI/UX, إدارة مشاريع..."
                  leftIcon={<Tag className="h-4 w-4 text-indigo-400" />}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  variant="default"
                  loading={savingProfile}
                  className="font-black text-xs px-7 py-2.5 gap-2 cursor-pointer shadow-lg bg-gradient-to-r from-[var(--brand-primary)] to-indigo-600 hover:from-[var(--brand-primary)]/90 hover:to-indigo-700"
                >
                  <Check className="h-4 w-4" />
                  <span>{t('settings.save_profile', 'حفظ بيانات الملف الشخصي')}</span>
                </Button>
              </div>
            </form>
          </div>

          {/* Card 2: Security & Password */}
          <div
            onMouseMove={handleCardMouseMove}
            className="glow-card-interactive p-6 sm:p-7 rounded-3xl space-y-5 border border-[var(--border-subtle)] bg-[var(--surface)] shadow-xl"
          >
            <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] pb-4">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 shrink-0">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-[var(--text-primary)] glow-text">
                  {t('settings.security_section', 'بيانات الدخول وكلمة المرور المشفرة')}
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {t('settings.security_desc', 'تحديث المعرف الرقمي أو تعيين كلمة مرور قوية جديدة لحسابك.')}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveCredentials} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
                  {t('settings.username_label', 'اسم المستخدم (Username)')}
                </label>
                <Input
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. zeyad-eltmsah"
                  leftIcon={<AtSign className="h-4 w-4 text-[var(--brand-primary)]" />}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
                    {t('settings.new_password', 'كلمة المرور الجديدة')}
                  </label>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="اتركها فارغة إذا لم ترغب في التغيير"
                    leftIcon={<Lock className="h-4 w-4 text-[var(--brand-primary)]" />}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
                    {t('settings.confirm_password', 'تأكيد كلمة المرور الجديدة')}
                  </label>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="أعد كتابة كلمة المرور للتأكيد"
                    leftIcon={<Lock className="h-4 w-4 text-[var(--brand-primary)]" />}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--brand-primary)] font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  <span>{showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}</span>
                </button>

                <Button
                  type="submit"
                  variant="default"
                  loading={savingCredentials}
                  className="font-black text-xs px-7 py-2.5 gap-2 cursor-pointer shadow-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
                >
                  <Check className="h-4 w-4" />
                  <span>{t('settings.save_credentials', 'تحديث بيانات الدخول والأمان')}</span>
                </Button>
              </div>
            </form>
          </div>

          {/* Card 3: Biometric Devices */}
          <div
            onMouseMove={handleCardMouseMove}
            className="glow-card-interactive p-6 sm:p-7 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-xl"
          >
            <DeviceIdentitySection />
          </div>

          {/* Card 4: Security Standard Compliance */}
          <div className="flex items-start gap-3.5 p-5 rounded-3xl bg-[var(--surface-elevated)]/70 border border-[var(--border-subtle)] shadow-md">
            <div className="p-2 rounded-xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] shrink-0 mt-0.5">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs font-black uppercase tracking-wider text-[var(--brand-primary)]">
                معايير الأمان والتشفير المعتمدة في المنظومة
              </h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                تخضع جميع كلمات المرور لآليات التشفير التراكمي المتقدم (PBKDF2 / Salted Hash). يتم حفظ وتخزين بياناتك، هويات أجهزتك، وصورتك الشخصية بصورة مشفرة ومؤمنة بالكامل داخل البنية السحابية لمنصة الجوجالية.
              </p>
            </div>
          </div>

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
