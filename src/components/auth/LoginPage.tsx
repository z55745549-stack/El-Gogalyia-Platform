/**
 * LoginPage — منصة الجوجالية
 * Human-crafted, ultra-premium auth interface with device biometric identity.
 * Highest clean code standards, flawless RTL, zero logo clutter.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/button';
import { isWebAuthnSupported } from '@/lib/webauthn';
import {
  Lock, User, Mail, Sun, Moon,
  CheckCircle2, Eye, EyeOff, Layers, Award, Zap,
  ShieldCheck, Fingerprint, Tag
} from 'lucide-react';
import { DEFAULT_COMMITTEES } from '@/types';
import { formatFullName, formatTitleCaseLive, hasArabic } from '@/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

type AuthMode = 'login' | 'register' | 'success';

// ─── Platform Pillars ────────────────────────────────────────────────────────

const PILLARS = [
  { Icon: Zap,         label: 'إدارة المهام', sub: 'متابعة حية وتسليم معتمد' },
  { Icon: Award,       label: 'O Coins',       sub: 'نظام مكافآت ونقاط تميز' },
  { Icon: Layers,      label: 'المسارات',      sub: 'ورش عمل وتطوير مستمر' },
  { Icon: ShieldCheck, label: 'الأمان المتقدم', sub: 'حماية وحوكمة موثوقة' },
] as const;

// ─── Input Field Component (Guaranteed Zero Overlap via Flexbox) ──────────────

interface InputFieldProps {
  id: string;
  label: string;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  IconLeft: React.ElementType;
  rightElement?: React.ReactNode;
  required?: boolean;
  autoFocus?: boolean;
  isDark: boolean;
}

function InputField({
  id, label, type = 'text', placeholder,
  value, onChange, IconLeft, rightElement,
  required, autoFocus, isDark,
}: InputFieldProps) {
  return (
    <div className="space-y-1.5 text-right">
      <label
        htmlFor={id}
        className="block text-xs font-bold text-slate-700 dark:text-slate-300"
      >
        {label}
      </label>
      <div
        className={[
          'w-full flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all duration-200 border',
          isDark
            ? 'bg-white/[0.04] border-white/[0.09] focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:bg-white/[0.06]'
            : 'bg-white/90 border-slate-200/90 hover:border-slate-300 focus-within:bg-white focus-within:border-indigo-600 focus-within:ring-4 focus-within:ring-indigo-500/12 shadow-[0_2px_6px_rgba(15,23,42,0.03),inset_0_1px_1px_rgba(255,255,255,1)]',
        ].join(' ')}
      >
        <IconLeft className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          autoFocus={autoFocus}
          className="flex-1 min-w-0 bg-transparent border-0 outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium"
        />
        {rightElement && (
          <div className="shrink-0 flex items-center">
            {rightElement}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Mode Tabs ────────────────────────────────────────────────────────────────

function ModeTabs({
  current, onSwitch, isDark,
}: {
  current: 'login' | 'register';
  onSwitch: (m: 'login' | 'register') => void;
  isDark: boolean;
}) {
  return (
    <div
      className="flex p-1.5 rounded-xl transition-colors"
      style={{
        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(241,245,249,0.85)',
        border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(226,232,240,0.9)',
        boxShadow: isDark ? 'none' : 'inset 0 1px 2px rgba(0,0,0,0.03)',
      }}
    >
      {(['login', 'register'] as const).map((tab) => {
        const active = current === tab;
        const isLogin = tab === 'login';
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onSwitch(tab)}
            className="flex-1 py-2.5 rounded-lg text-xs font-black transition-all cursor-pointer"
            style={
              active
                ? {
                    background: isLogin
                      ? 'linear-gradient(135deg, #6366F1, #4F46E5)'
                      : 'linear-gradient(135deg, #06B6D4, #0891B2)',
                    color: '#FFFFFF',
                    boxShadow: isLogin
                      ? '0 3px 12px rgba(99,102,241,0.35)'
                      : '0 3px 12px rgba(6,182,212,0.35)',
                  }
                : {
                    color: isDark ? '#94A3B8' : '#64748B',
                  }
            }
          >
            {tab === 'login' ? 'تسجيل الدخول' : 'طلب انضمام جديد'}
          </button>
        );
      })}
    </div>
  );
}

// ─── Error / Notice Banner ────────────────────────────────────────────────────

function ErrorBanner({
  message, onClose, isDark,
}: {
  message: string | null;
  onClose: () => void;
  isDark: boolean;
}) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="flex items-start justify-between gap-3 p-3.5 rounded-xl text-xs font-semibold"
          style={{
            background: isDark ? 'rgba(244,63,94,0.1)' : '#FFF1F2',
            border: isDark ? '1px solid rgba(244,63,94,0.25)' : '1px solid #FECDD3',
            color: isDark ? '#FDA4AF' : '#BE123C',
          }}
          role="alert"
        >
          <div className="flex items-start gap-2">
            <span className="shrink-0 mt-0.5">⚠️</span>
            <span className="leading-relaxed">{message}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 opacity-60 hover:opacity-100 cursor-pointer font-bold text-sm px-1"
            aria-label="إغلاق"
          >
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Hero Panel (Human-Crafted Typography, No Broken Boxes, No Logos) ────────

function HeroPanel({ isDark }: { isDark: boolean }) {
  return (
    <div
      className="hidden lg:flex lg:w-[48%] flex-col justify-between p-10 xl:p-12 relative overflow-hidden"
      style={{
        background: isDark
          ? 'linear-gradient(150deg, #0D0D20 0%, #12122E 50%, #090916 100%)'
          : 'linear-gradient(150deg, rgba(255,255,255,0.98) 0%, rgba(246,249,255,0.94) 50%, rgba(240,244,255,0.9) 100%)',
        borderLeft: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(226,232,240,0.9)',
      }}
    >
      {/* Subtle ambient lighting */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div
          className="absolute w-72 h-72 rounded-full top-[-10%] right-[-10%]"
          style={{
            background: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.12)',
            filter: 'blur(55px)',
          }}
        />
        <div
          className="absolute w-60 h-60 rounded-full bottom-[-8%] left-[-8%]"
          style={{
            background: isDark ? 'rgba(34,211,238,0.18)' : 'rgba(6,182,212,0.09)',
            filter: 'blur(50px)',
          }}
        />
      </div>

      {/* Pure Human Typographic Header (Zero Logos) */}
      <div className="relative z-10">
        <div className="flex items-center gap-2">
          <span
            className="text-2xl font-black tracking-tight"
            style={{ color: isDark ? '#FFFFFF' : '#0F172A' }}
          >
            منصة الجوجالية
          </span>
          <span
            className="text-[10px] font-black px-2 py-0.5 rounded-md"
            style={{
              background: isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.08)',
              border: isDark ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(99,102,241,0.2)',
              color: isDark ? '#A78BFA' : '#4F46E5',
            }}
          >
            المنظومة الرسمية
          </span>
        </div>
        <p
          className="text-xs font-semibold mt-1"
          style={{ color: isDark ? 'rgba(148,163,184,0.85)' : '#64748B' }}
        >
          مجتمع الإبداع والريادة التقنية
        </p>
      </div>

      {/* Inspiring Human Copy */}
      <div className="relative z-10 space-y-6 my-auto">
        <div
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-bold"
          style={{
            background: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.1)',
            border: isDark ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(16,185,129,0.25)',
            color: isDark ? '#6EE7B7' : '#059669',
          }}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          بوابة العضوية والقيادة المتكاملة
        </div>

        <h2
          className="font-black tracking-tight"
          style={{
            fontSize: 'clamp(1.75rem, 3vw, 2.3rem)',
            lineHeight: 1.35,
            color: isDark ? '#FFFFFF' : '#0F172A',
          }}
        >
          اصنع الأثر،{' '}
          {isDark ? (
            <span
              style={{
                color: '#38BDF8',
                textShadow: '0 0 24px rgba(56,189,248,0.5)',
              }}
            >
              طوّر ذاتك،
            </span>
          ) : (
            <span
              className="text-transparent bg-clip-text font-black"
              style={{
                backgroundImage: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #0284C7 100%)',
              }}
            >
              طوّر ذاتك،
            </span>
          )}{' '}
          وقُد المستقبل.
        </h2>

        <p
          className="text-sm leading-relaxed max-w-sm"
          style={{ color: isDark ? 'rgba(203,213,225,0.9)' : '#475569' }}
        >
          بيئة رقمية حديثة تجمع فرق العمل، وتدير التكليفات والمسابقات والمكافآت بوضوح واحترافية متناهية.
        </p>

        {/* 4 Pillars Grid */}
        <div className="grid grid-cols-2 gap-2.5 pt-2">
          {PILLARS.map(({ Icon, label, sub }) => (
            <div
              key={label}
              className="flex items-center gap-2.5 p-3 rounded-xl transition-all hover:scale-[1.02]"
              style={{
                background: isDark ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0.95)',
                border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(226,232,240,0.9)',
                boxShadow: isDark ? 'none' : '0 4px 14px -2px rgba(79,70,229,0.06), 0 1px 3px rgba(15,23,42,0.02)',
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  background: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.08)',
                  color: isDark ? '#A78BFA' : '#4F46E5',
                  border: isDark ? 'none' : '1px solid rgba(99,102,241,0.15)',
                }}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div
                  className="text-xs font-black truncate"
                  style={{ color: isDark ? '#FFFFFF' : '#0F172A' }}
                >
                  {label}
                </div>
                <div
                  className="text-[10px] truncate"
                  style={{ color: isDark ? 'rgba(148,163,184,0.8)' : '#64748B' }}
                >
                  {sub}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Clean Footer Note */}
      <div
        className="relative z-10 flex items-center justify-between text-[11px] pt-4"
        style={{ borderTop: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(226,232,240,0.85)' }}
      >
        <span style={{ color: isDark ? 'rgba(148,163,184,0.7)' : '#64748B' }}>
          منصة الجوجالية &copy; 2026
        </span>
        <span
          className="font-bold"
          style={{ color: isDark ? '#A78BFA' : '#4F46E5' }}
        >
          مجتمع رقمي موحد
        </span>
      </div>
    </div>
  );
}

// ─── Main LoginPage Component ────────────────────────────────────────────────

export function LoginPage() {
  const { signInWithUsername, registerMember, signInWithDevice } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [mode, setMode] = useState<AuthMode>('login');
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  // Login Form State
  const [username, setUsername]         = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);

  // Register Form State
  const [regFullName, setRegFullName]               = useState('');
  const [regUsername, setRegUsername]               = useState('');
  const [regEmail, setRegEmail]                     = useState('');
  const [regPassword, setRegPassword]               = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regCommittee, setRegCommittee]             = useState(DEFAULT_COMMITTEES[0]?.id ?? 'tech-dev');
  const [regSpecialtyTag, setRegSpecialtyTag]       = useState('');
  const [regSubmitting, setRegSubmitting]           = useState(false);
  const [showRegPassword, setShowRegPassword]       = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isDark = theme === 'dark';

  useEffect(() => {
    isWebAuthnSupported().then(setBiometricAvailable);
  }, []);

  function switchMode(next: 'login' | 'register') {
    setMode(next);
    setErrorMsg(null);
  }

  // ── Password-based Login ──────────────────────────────────────────
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    const u = username.trim();
    const p = password.trim();

    if (!u || !p) {
      toast.error('يرجى إدخال اسم المستخدم وكلمة المرور.');
      return;
    }
    if (hasArabic(u)) {
      setErrorMsg('اسم المستخدم لا يمكن أن يحتوي على حروف عربية.');
      return;
    }
    if (hasArabic(p)) {
      setErrorMsg('كلمة المرور لا يمكن أن تحتوي على حروف عربية.');
      return;
    }

    setLoading(true);
    try {
      await signInWithUsername(u, p);
      toast.success('مرحباً بك في منصة الجوجالية');
      navigate('/dashboard');
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'اسم المستخدم أو كلمة المرور غير صحيحة.');
    } finally {
      setLoading(false);
    }
  }

  // ── Biometric / Device Identity Login ─────────────────────────────
  async function handleBiometricLogin() {
    if (!biometricAvailable) {
      toast.error('جهازك لا يدعم المصادقة البيومترية أو هوية الجهاز.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await signInWithDevice();
      if (res.success) {
        toast.success('تم التحقق من هوية جهازك بنجاح. مرحباً بك!');
        navigate('/dashboard');
      } else {
        const msg = res.error || 'هوية جهازك غير مربوطة بأي حساب في منصة الجوجالية — يرجى تسجيل الدخول أولاً وتفعيل الميزة من إعدادات حسابك.';
        setErrorMsg(msg);
        toast.error(msg);
      }
    } catch (err: any) {
      const msg = err?.message || 'هوية جهازك غير مربوطة بأي حساب في منصة الجوجالية — يرجى تسجيل الدخول أولاً وتفعيل الميزة من إعدادات حسابك.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  // ── Registration ──────────────────────────────────────────────────
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    const name  = regFullName.trim();
    const uname = regUsername.trim();
    const email = regEmail.trim();
    const pass  = regPassword.trim();

    if (!name || !uname || !email || !pass) {
      setErrorMsg('يرجى ملء كافة الحقول المطلوبة.');
      return;
    }
    if (hasArabic(uname)) {
      setErrorMsg('اسم المستخدم لا يمكن أن يحتوي على حروف عربية — استخدم حروف إنجليزية وأرقام فقط.');
      return;
    }
    if (hasArabic(pass)) {
      setErrorMsg('كلمة المرور لا يمكن أن تحتوي على حروف عربية — استخدم حروف إنجليزية وأرقام فقط.');
      return;
    }
    if (pass.length < 6) {
      setErrorMsg('كلمة المرور يجب أن لا تقل عن 6 خانات.');
      return;
    }
    if (pass !== regConfirmPassword.trim()) {
      setErrorMsg('كلمتا المرور غير متطابقتين.');
      return;
    }

    const isNoCommittee = regCommittee === 'none';
    const selectedComm = DEFAULT_COMMITTEES.find((c) => c.id === regCommittee);
    setRegSubmitting(true);
    try {
      await registerMember({
        fullName:      formatFullName(name),
        username:      uname,
        email,
        password:      pass,
        committeeId:   isNoCommittee ? 'none' : regCommittee,
        committeeName: isNoCommittee ? 'بدون لجنة' : (selectedComm?.name ?? 'Tech Dev'),
        specialtyTag:  regSpecialtyTag.trim() || undefined,
      });
      setMode('success');
      toast.success('تم إرسال طلب انضمامك بنجاح');
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'تعذر إرسال الطلب، حاول مجدداً.');
    } finally {
      setRegSubmitting(false);
    }
  }

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center relative overflow-hidden transition-colors duration-300"
      style={{
        background: isDark
          ? 'linear-gradient(135deg, #07070E 0%, #0C0C1C 50%, #06060D 100%)'
          : 'radial-gradient(ellipse 90% 70% at 50% -15%, #FFFFFF 0%, #F6F8FD 45%, #EEF2F8 100%)',
      }}
      dir="rtl"
    >
      {/* Background ambient lighting */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div
          className="absolute w-[650px] h-[650px] rounded-full top-[-18%] right-[-8%] opacity-60"
          style={{
            background: isDark
              ? 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute w-[500px] h-[500px] rounded-full bottom-[-15%] left-[-8%] opacity-50"
          style={{
            background: isDark
              ? 'radial-gradient(circle, rgba(34,211,238,0.08) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(6,182,212,0.09) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* Theme toggle button */}
      <button
        onClick={toggleTheme}
        aria-label={isDark ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن'}
        className={[
          'absolute top-5 left-5 z-50 flex items-center gap-2 px-3.5 py-2 rounded-xl',
          'text-xs font-bold transition-all cursor-pointer backdrop-blur-md',
          isDark
            ? 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/[0.08]'
            : 'bg-white/90 border border-slate-200 text-slate-700 hover:bg-white shadow-xs',
        ].join(' ')}
      >
        {isDark ? (
          <><Sun className="h-4 w-4 text-amber-400" /><span className="hidden sm:inline">الوضع الفاتح</span></>
        ) : (
          <><Moon className="h-4 w-4 text-indigo-600" /><span className="hidden sm:inline">الوضع الداكن</span></>
        )}
      </button>

      {/* ═══════════ MASTER LUXURY CONTAINER ═══════════ */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-5xl mx-4 flex rounded-[32px] overflow-hidden"
        style={{
          boxShadow: isDark
            ? '0 30px 90px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.06)'
            : '0 30px 85px -15px rgba(79,70,229,0.12), 0 12px 35px -8px rgba(15,23,42,0.07), 0 0 0 1px rgba(255,255,255,0.9) inset, 0 0 0 1px rgba(226,232,240,0.9)',
          minHeight: '580px',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {/* Left Hero Panel */}
        <HeroPanel isDark={isDark} />

        {/* Right Form Panel */}
        <div
          className="flex-1 flex flex-col justify-center px-8 py-10 sm:px-12 xl:px-14 relative"
          style={{ background: isDark ? 'rgba(10,10,20,0.98)' : 'rgba(255,255,255,0.96)' }}
        >
          <AnimatePresence mode="wait">

            {/* ── LOGIN MODE ── */}
            {mode === 'login' && (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -14 }}
                transition={{ duration: 0.22 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    تسجيل الدخول
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    أدخل بيانات حسابك للمتابعة إلى لوحة التحكم
                  </p>
                </div>

                <ModeTabs current="login" onSwitch={switchMode} isDark={isDark} />

                <ErrorBanner message={errorMsg} onClose={() => setErrorMsg(null)} isDark={isDark} />

                <form onSubmit={handleSignIn} className="space-y-4" noValidate>
                  <InputField
                    id="login-username"
                    label="اسم المستخدم أو البريد الإلكتروني"
                    placeholder="أدخل اسم المستخدم أو البريد"
                    value={username}
                    onChange={(v) => setUsername(v.replace(/[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g, ''))}
                    IconLeft={User}
                    required
                    autoFocus
                    isDark={isDark}
                  />

                  <InputField
                    id="login-password"
                    label="كلمة المرور"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="كلمة المرور"
                    value={password}
                    onChange={(v) => setPassword(v.replace(/[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g, ''))}
                    IconLeft={Lock}
                    rightElement={
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer p-1"
                        aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    }
                    required
                    isDark={isDark}
                  />

                  <Button
                    type="submit"
                    variant="default"
                    size="lg"
                    className="w-full h-12 rounded-xl font-black text-sm text-white cursor-pointer transition-all duration-200 active:scale-[0.99]"
                    style={{
                      background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 60%, #4338CA 100%)',
                      boxShadow: '0 8px 25px -4px rgba(99,102,241,0.45)',
                      border: 'none',
                    }}
                    loading={loading}
                  >
                    دخول إلى المنصة
                  </Button>
                </form>

                {/* Biometric / Device Identity Button */}
                {biometricAvailable && (
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-slate-200/90 dark:bg-white/[0.08]" />
                      <span className="text-[11px] text-slate-500 dark:text-slate-500 font-bold">أو عبر هوية الجهاز</span>
                      <div className="flex-1 h-px bg-slate-200/90 dark:bg-white/[0.08]" />
                    </div>

                    <button
                      type="button"
                      onClick={handleBiometricLogin}
                      disabled={loading}
                      className={[
                        'w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl',
                        'text-xs font-bold transition-all cursor-pointer border',
                        isDark
                          ? 'bg-white/[0.03] border-white/[0.09] text-slate-200 hover:bg-white/[0.06] hover:border-indigo-500/40'
                          : 'bg-white/90 border-slate-200/90 text-slate-700 hover:bg-slate-50 hover:border-indigo-400 shadow-[0_2px_6px_rgba(15,23,42,0.03)]',
                      ].join(' ')}
                    >
                      <Fingerprint className="h-4 w-4 text-indigo-500 shrink-0" />
                      <span>الدخول بهوية الجهاز (بصمة / قفل الشاشة)</span>
                    </button>
                  </div>
                )}

                <p className="text-xs text-center text-slate-500 dark:text-slate-400 pt-2">
                  عضو جديد في الجوجالية؟{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('register')}
                    className="font-black text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    قدّم طلب انضمام الآن
                  </button>
                </p>
              </motion.div>
            )}

            {/* ── REGISTER MODE ── */}
            {mode === 'register' && (
              <motion.div
                key="register"
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 14 }}
                transition={{ duration: 0.22 }}
                className="space-y-5"
              >
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    طلب انضمام جديد
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    أكمل بياناتك الشخصية لمراجعة طلبك واعتماده من قِبل القيادة
                  </p>
                </div>

                <ModeTabs current="register" onSwitch={switchMode} isDark={isDark} />

                <ErrorBanner message={errorMsg} onClose={() => setErrorMsg(null)} isDark={isDark} />

                <form onSubmit={handleRegister} className="space-y-3" noValidate>
                  <InputField
                    id="reg-fullname"
                    label="الاسم الكامل"
                    placeholder="الاسم الثلاثي أو الرباعي"
                    value={regFullName}
                    onChange={(v) => setRegFullName(formatTitleCaseLive(v))}
                    IconLeft={User}
                    required
                    isDark={isDark}
                  />

                  <div className="grid grid-cols-2 gap-2.5">
                    <InputField
                      id="reg-username"
                      label="اسم المستخدم"
                      placeholder="اسم المستخدم (مثال: user_name)"
                      value={regUsername}
                      onChange={(v) => setRegUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      IconLeft={User}
                      required
                      isDark={isDark}
                    />
                    <div className="space-y-1.5 text-right">
                      <label
                        htmlFor="reg-committee"
                        className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                      >
                        اللجنة التخصصية
                      </label>
                      <select
                        id="reg-committee"
                        value={regCommittee}
                        onChange={(e) => setRegCommittee(e.target.value)}
                        className={[
                          'w-full h-[46px] px-3 rounded-xl text-sm outline-none transition-all cursor-pointer border',
                          isDark
                            ? 'bg-white/[0.04] border-white/[0.09] text-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20'
                            : 'bg-white/90 border-slate-200/90 hover:border-slate-300 text-slate-900 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/12 shadow-[0_2px_6px_rgba(15,23,42,0.03),inset_0_1px_1px_rgba(255,255,255,1)]',
                        ].join(' ')}
                      >
                        <option
                          value="none"
                          style={{ background: isDark ? '#0F0F1A' : '#FFFFFF' }}
                        >
                          بدون لجنة (قيادة / إدارة عامة)
                        </option>
                        {DEFAULT_COMMITTEES.map((c) => (
                          <option
                            key={c.id}
                            value={c.id}
                            style={{ background: isDark ? '#0F0F1A' : '#FFFFFF' }}
                          >
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <InputField
                    id="reg-tag"
                    label="الوسم التخصصي / مجال الخبرة (اختياري)"
                    type="text"
                    placeholder="مثال: Flutter, UI/UX, بايثون، مهارات تدريس"
                    value={regSpecialtyTag}
                    onChange={setRegSpecialtyTag}
                    IconLeft={Tag}
                    isDark={isDark}
                  />

                  <InputField
                    id="reg-email"
                    label="البريد الإلكتروني"
                    type="email"
                    placeholder="name@gmail.com"
                    value={regEmail}
                    onChange={setRegEmail}
                    IconLeft={Mail}
                    required
                    isDark={isDark}
                  />

                  <div className="grid grid-cols-2 gap-2.5">
                    <InputField
                      id="reg-password"
                      label="كلمة المرور"
                      type={showRegPassword ? 'text' : 'password'}
                      placeholder="6 خانات كحد أدنى"
                      value={regPassword}
                      onChange={(v) => setRegPassword(v.replace(/[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g, ''))}
                      IconLeft={Lock}
                      rightElement={
                        <button
                          type="button"
                          onClick={() => setShowRegPassword((v) => !v)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer p-1"
                          aria-label="إظهار / إخفاء كلمة المرور"
                        >
                          {showRegPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      }
                      required
                      isDark={isDark}
                    />
                    <InputField
                      id="reg-confirm"
                      label="تأكيد كلمة المرور"
                      type="password"
                      placeholder="تأكيد الكلمة"
                      value={regConfirmPassword}
                      onChange={(v) => setRegConfirmPassword(v.replace(/[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g, ''))}
                      IconLeft={Lock}
                      required
                      isDark={isDark}
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="default"
                    size="lg"
                    className="w-full h-12 rounded-xl font-black text-sm text-white cursor-pointer mt-2 transition-all duration-200 active:scale-[0.99]"
                    style={{
                      background: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 60%, #0284C7 100%)',
                      boxShadow: '0 8px 25px -4px rgba(6,182,212,0.45)',
                      border: 'none',
                    }}
                    loading={regSubmitting}
                  >
                    إرسال طلب الانضمام
                  </Button>
                </form>

                <p className="text-xs text-center text-slate-500 dark:text-slate-400 pt-1">
                  لديك حساب مسبقاً؟{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="font-black text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    تسجيل الدخول
                  </button>
                </p>
              </motion.div>
            )}

            {/* ── SUCCESS STATE ── */}
            {mode === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="text-center space-y-6 py-4"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
                  style={{
                    background: 'rgba(16,185,129,0.12)',
                    border: '2px solid rgba(16,185,129,0.4)',
                    boxShadow: '0 0 24px rgba(16,185,129,0.25)',
                  }}
                >
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </motion.div>

                <div className="space-y-2">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    تم استلام طلبك بنجاح
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
                    تم حفظ بياناتك، والحساب حالياً{' '}
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      قيد مراجعة القيادة
                    </span>{' '}
                    للاعتماد والتفعيل.
                  </p>
                </div>

                <div
                  className="p-4 rounded-xl text-right space-y-2.5"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                    border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #E2E8F0',
                  }}
                >
                  {[
                    { label: 'الاسم الكامل', value: regFullName, className: '' },
                    { label: 'اسم المستخدم', value: `@${regUsername}`, className: 'text-indigo-600 dark:text-cyan-400' },
                    { label: 'حالة الحساب',  value: 'قيد الاعتماد', className: 'text-amber-600 dark:text-amber-400' },
                  ].map(({ label, value, className }) => (
                    <div key={label} className="flex justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">{label}:</span>
                      <span className={`font-bold text-slate-900 dark:text-white ${className}`}>{value}</span>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={() => {
                    switchMode('login');
                    setUsername(regUsername);
                    setPassword('');
                  }}
                  variant="default"
                  size="lg"
                  className="w-full h-11 rounded-xl font-black text-sm text-white cursor-pointer"
                  style={{
                    background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
                    boxShadow: '0 6px 20px rgba(99,102,241,0.35)',
                    border: 'none',
                  }}
                >
                  العودة لتسجيل الدخول
                </Button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
