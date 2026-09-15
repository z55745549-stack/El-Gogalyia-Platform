/**
 * LoginPage — منصة الجوجالية
 * Clean, premium auth interface with biometric support.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/button';
import {
  Lock, User, Mail, Sun, Moon,
  CheckCircle2, Eye, EyeOff, Layers, Award, Zap,
  ShieldCheck, Fingerprint,
} from 'lucide-react';
import { DEFAULT_COMMITTEES } from '@/types';

// ─── Types ───────────────────────────────────────────────────────────────────

type AuthMode = 'login' | 'register' | 'success';

// ─── Brand Logo ──────────────────────────────────────────────────────────────

function GogalyiaLogo({ size = 44 }: { size?: number }) {
  return (
    <div className="relative inline-flex items-center justify-center shrink-0 select-none">
      <div
        className="absolute -inset-2 rounded-xl blur-lg opacity-40 animate-pulse pointer-events-none"
        style={{ background: 'linear-gradient(135deg, #6366F1, #22D3EE, #10B981)' }}
      />
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 drop-shadow-lg"
      >
        <defs>
          <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366F1" />
            <stop offset="55%" stopColor="#4F46E5" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
          <linearGradient id="logo-gold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
        </defs>
        <rect width="48" height="48" rx="14" fill="url(#logo-grad)" />
        <rect x="1" y="1" width="46" height="46" rx="13" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
        <path
          d="M32 15C32 15 28 13 22 13C15 13 13 18 13 24C13 30 18 35 26 35C33 35 35 30 35 28"
          stroke="white"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <circle cx="24" cy="24" r="3" fill="url(#logo-gold)" />
      </svg>
    </div>
  );
}

// ─── Platform Features ────────────────────────────────────────────────────────

const FEATURES = [
  { Icon: Zap,         label: 'إدارة المهام', sub: 'متابعة حية وتسليم رقمي',   color: '#8B5CF6' },
  { Icon: Award,       label: 'O Coins',       sub: 'نظام مكافآت تنافسي',        color: '#F59E0B' },
  { Icon: Layers,      label: 'الدورات',       sub: 'محتوى تعليمي حصري',         color: '#06B6D4' },
  { Icon: ShieldCheck, label: 'الأمان',        sub: 'بيئة عمل احترافية',         color: '#10B981' },
] as const;

// ─── Input Component ──────────────────────────────────────────────────────────

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
}

function InputField({
  id, label, type = 'text', placeholder,
  value, onChange, IconLeft, rightElement,
  required, autoFocus,
}: InputFieldProps) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-xs font-semibold text-slate-600 dark:text-slate-400"
      >
        {label}
      </label>
      <div className="relative flex items-center">
        <IconLeft className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none z-10" />
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          autoFocus={autoFocus}
          className={[
            'w-full py-3 text-sm rounded-xl outline-none transition-all duration-200',
            'pr-10 bg-slate-50 dark:bg-white/[0.04]',
            'border border-slate-200 dark:border-white/[0.08]',
            'text-slate-900 dark:text-white',
            'placeholder:text-slate-400 dark:placeholder:text-slate-500',
            'focus:border-indigo-500 dark:focus:border-indigo-400',
            'focus:ring-2 focus:ring-indigo-500/15',
            rightElement ? 'pl-10' : 'pl-4',
          ].join(' ')}
        />
        {rightElement && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center">
            {rightElement}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Biometric helpers ────────────────────────────────────────────────────────

async function isBiometricAvailable(): Promise<boolean> {
  if (!window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

async function triggerBiometricVerification(): Promise<boolean> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  try {
    const result = await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: 60000,
        userVerification: 'required',
        rpId: window.location.hostname,
        allowCredentials: [],
      },
    });
    return result !== null;
  } catch (err: any) {
    if (err?.name === 'NotAllowedError') return false;
    throw err;
  }
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
      className="flex p-1 rounded-xl"
      style={{
        background: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9',
        border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid #E2E8F0',
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
                      ? '0 3px 10px rgba(99,102,241,0.3)'
                      : '0 3px 10px rgba(6,182,212,0.3)',
                  }
                : { color: isDark ? '#94A3B8' : '#64748B' }
            }
          >
            {isLogin ? 'تسجيل الدخول' : 'طلب انضمام جديد'}
          </button>
        );
      })}
    </div>
  );
}

// ─── Error Banner ─────────────────────────────────────────────────────────────

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
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          className="flex items-start gap-2.5 p-3.5 rounded-xl text-xs"
          style={{
            background: 'rgba(244,63,94,0.07)',
            border: '1px solid rgba(244,63,94,0.22)',
            color: isDark ? '#FDA4AF' : '#BE123C',
          }}
        >
          <span className="font-bold mt-0.5 shrink-0">تنبيه</span>
          <span className="flex-1 leading-relaxed">{message}</span>
          <button
            onClick={onClose}
            className="shrink-0 opacity-50 hover:opacity-100 cursor-pointer font-bold"
            aria-label="إغلاق"
          >
            ×
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Hero Panel ───────────────────────────────────────────────────────────────

function HeroPanel({ isDark }: { isDark: boolean }) {
  return (
    <div
      className="hidden lg:flex lg:w-[46%] flex-col justify-between p-10 xl:p-12 relative overflow-hidden"
      style={{
        background: isDark
          ? 'linear-gradient(150deg, #0F0F24 0%, #131330 55%, #0A0A1A 100%)'
          : 'linear-gradient(150deg, #4F46E5 0%, #6366F1 50%, #4338CA 100%)',
        borderRight: isDark ? '1px solid rgba(255,255,255,0.05)' : 'none',
      }}
    >
      {/* Decorative ambient blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div
          className="absolute w-56 h-56 rounded-full top-[-12%] right-[-12%]"
          style={{
            background: isDark ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.12)',
            filter: 'blur(40px)',
            opacity: 0.5,
          }}
        />
        <div
          className="absolute w-44 h-44 rounded-full bottom-[8%] left-[-8%]"
          style={{
            background: isDark ? 'rgba(34,211,238,0.2)' : 'rgba(255,255,255,0.1)',
            filter: 'blur(36px)',
            opacity: 0.4,
          }}
        />
      </div>

      {/* Brand */}
      <div className="relative z-10 flex items-center gap-3">
        <GogalyiaLogo size={42} />
        <div>
          <h1
            className="text-lg font-black tracking-tight leading-none"
            style={{ color: isDark ? '#F0F0FF' : '#FFFFFF' }}
          >
            منصة الجوجالية
          </h1>
          <p
            className="text-[11px] font-medium mt-0.5"
            style={{ color: isDark ? 'rgba(148,163,184,0.8)' : 'rgba(255,255,255,0.72)' }}
          >
            مجتمع الإبداع والريادة التقنية
          </p>
        </div>
      </div>

      {/* Hero copy */}
      <div className="relative z-10 space-y-5 my-auto">
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold"
          style={{
            background: isDark ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.16)',
            border: isDark ? '1px solid rgba(16,185,129,0.28)' : '1px solid rgba(255,255,255,0.3)',
            color: isDark ? '#6EE7B7' : '#FFFFFF',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          بوابة التميز المؤسسي الشاملة
        </div>

        <h2
          className="font-black tracking-tight"
          style={{
            fontSize: 'clamp(1.6rem, 3vw, 2.1rem)',
            lineHeight: 1.3,
            color: isDark ? '#F0F0FF' : '#FFFFFF',
          }}
        >
          اصنع الأثر،{' '}
          <span
            style={{
              display: 'inline-block',
              backgroundImage: isDark
                ? 'linear-gradient(90deg, #A78BFA, #67E8F9)'
                : 'linear-gradient(90deg, #FDE68A, #FCD34D)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            طوّر ذاتك،
          </span>
          {' '}وقُد المستقبل.
        </h2>

        <p
          className="text-sm leading-relaxed max-w-xs"
          style={{ color: isDark ? 'rgba(148,163,184,0.9)' : 'rgba(255,255,255,0.78)' }}
        >
          منصة مركزية صُممت لتوحيد المهام والتعليم والتحفيز بأعلى درجات الاحترافية.
        </p>

        {/* Features grid */}
        <div className="grid grid-cols-2 gap-2">
          {FEATURES.map(({ Icon, label, sub, color }) => (
            <div
              key={label}
              className="flex items-center gap-2 p-3 rounded-xl"
              style={{
                background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.14)',
                border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(255,255,255,0.25)',
              }}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: isDark ? `${color}20` : 'rgba(255,255,255,0.22)' }}
              >
                <Icon className="h-3.5 w-3.5" style={{ color: isDark ? color : '#FFFFFF' }} />
              </div>
              <div className="min-w-0">
                <p
                  className="text-[11px] font-black truncate"
                  style={{ color: isDark ? '#E2E8F0' : '#FFFFFF' }}
                >
                  {label}
                </p>
                <p
                  className="text-[10px] truncate"
                  style={{ color: isDark ? 'rgba(148,163,184,0.65)' : 'rgba(255,255,255,0.65)' }}
                >
                  {sub}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div
        className="relative z-10 flex items-center justify-between text-[11px] pt-5"
        style={{
          borderTop: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(255,255,255,0.2)',
          color: isDark ? 'rgba(100,116,139,0.8)' : 'rgba(255,255,255,0.6)',
        }}
      >
        <span>© 2026 منصة الجوجالية</span>
        <div className="flex gap-1.5">
          {['#6366F1', '#22D3EE', '#10B981', '#F59E0B'].map((c) => (
            <div key={c} className="w-2 h-2 rounded-full opacity-75" style={{ background: c }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LoginPage() {
  const { signInWithUsername, registerMember } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [mode, setMode] = useState<AuthMode>('login');
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  // Login state
  const [username, setUsername]         = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);

  // Register state
  const [regFullName, setRegFullName]               = useState('');
  const [regUsername, setRegUsername]               = useState('');
  const [regEmail, setRegEmail]                     = useState('');
  const [regPassword, setRegPassword]               = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regCommittee, setRegCommittee]             = useState(DEFAULT_COMMITTEES[0]?.id ?? 'tech-dev');
  const [regSubmitting, setRegSubmitting]           = useState(false);
  const [showRegPassword, setShowRegPassword]       = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isDark = theme === 'dark';

  useEffect(() => {
    isBiometricAvailable().then(setBiometricAvailable);
  }, []);

  function switchMode(next: 'login' | 'register') {
    setMode(next);
    setErrorMsg(null);
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    const u = username.trim();
    const p = password.trim();
    if (!u || !p) {
      toast.error('يرجى إدخال اسم المستخدم وكلمة المرور.');
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

  async function handleBiometricLogin() {
    if (!biometricAvailable) {
      toast.error('جهازك لا يدعم هذه الميزة حالياً.');
      return;
    }
    try {
      toast.info('سيظهر طلب التحقق من هويتك...');
      const verified = await triggerBiometricVerification();
      if (verified) {
        toast.info('تحقق الجهاز بنجاح — يرجى إدخال اسم المستخدم لإكمال الدخول.');
      } else {
        toast.error('لم يتم التحقق من الهوية.');
      }
    } catch {
      toast.error('تعذّر التحقق من الجهاز.');
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    const name  = regFullName.trim();
    const uname = regUsername.trim();
    const email = regEmail.trim();
    const pass  = regPassword.trim();

    if (!name || !uname || !email || !pass) {
      toast.error('يرجى تعبئة كافة الحقول المطلوبة.');
      return;
    }
    if (pass.length < 6) {
      setErrorMsg('كلمة المرور يجب ألا تقل عن 6 خانات.');
      return;
    }
    if (pass !== regConfirmPassword.trim()) {
      setErrorMsg('كلمتا المرور غير متطابقتين.');
      return;
    }

    const selectedComm = DEFAULT_COMMITTEES.find((c) => c.id === regCommittee);
    setRegSubmitting(true);
    try {
      await registerMember({
        fullName:      name,
        username:      uname,
        email,
        password:      pass,
        committeeId:   regCommittee,
        committeeName: selectedComm?.name ?? 'Tech Dev',
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
          ? 'linear-gradient(135deg, #07070E 0%, #0D0D1F 50%, #070710 100%)'
          : 'linear-gradient(135deg, #EEF2FF 0%, #F0F9FF 50%, #F8FAFC 100%)',
      }}
      dir="rtl"
    >
      {/* Background ambience */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div
          className="absolute w-[700px] h-[700px] rounded-full top-[-20%] right-[-10%] opacity-60"
          style={{
            background: isDark
              ? 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(79,70,229,0.07) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute w-[500px] h-[500px] rounded-full bottom-[-15%] left-[-8%] opacity-50"
          style={{
            background: isDark
              ? 'radial-gradient(circle, rgba(34,211,238,0.07) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(6,182,212,0.05) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(${
              isDark ? 'rgba(255,255,255,0.03)' : 'rgba(99,102,241,0.06)'
            } 1px, transparent 1px)`,
            backgroundSize: '28px 28px',
          }}
        />
      </div>

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        aria-label={isDark ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن'}
        className={[
          'absolute top-5 left-5 z-50 flex items-center gap-2 px-4 py-2 rounded-xl',
          'text-sm font-semibold transition-all cursor-pointer backdrop-blur-md',
          isDark
            ? 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/[0.08]'
            : 'bg-white/80 border border-slate-200 text-slate-700 hover:bg-white shadow-sm',
        ].join(' ')}
      >
        {isDark
          ? <><Sun className="h-4 w-4 text-amber-400" /><span className="hidden sm:inline">فاتح</span></>
          : <><Moon className="h-4 w-4 text-indigo-600" /><span className="hidden sm:inline">داكن</span></>
        }
      </button>

      {/* ═══════════ MASTER CARD ═══════════ */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-5xl mx-4 flex rounded-[28px] overflow-hidden"
        style={{
          boxShadow: isDark
            ? '0 40px 100px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.06)'
            : '0 32px 80px rgba(15,23,42,0.14), 0 0 0 1px rgba(203,213,225,0.5)',
          minHeight: '580px',
        }}
      >
        {/* Hero panel */}
        <HeroPanel isDark={isDark} />

        {/* Form panel */}
        <div
          className="flex-1 flex flex-col justify-center px-8 py-10 sm:px-10 xl:px-12 relative"
          style={{ background: isDark ? 'rgba(9,9,18,0.97)' : 'rgba(255,255,255,0.98)' }}
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <GogalyiaLogo size={36} />
            <div>
              <p className="font-black text-base text-slate-900 dark:text-white leading-none">منصة الجوجالية</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">مجتمع الإبداع والريادة</p>
            </div>
          </div>

          <AnimatePresence mode="wait">

            {/* ── LOGIN ── */}
            {mode === 'login' && (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    مرحباً بك
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    أدخل بياناتك للوصول إلى لوحة التحكم
                  </p>
                </div>

                <ModeTabs current="login" onSwitch={switchMode} isDark={isDark} />

                <ErrorBanner message={errorMsg} onClose={() => setErrorMsg(null)} isDark={isDark} />

                <form onSubmit={handleSignIn} className="space-y-4" noValidate>
                  <InputField
                    id="login-username"
                    label="اسم المستخدم أو البريد الإلكتروني"
                    placeholder="اسم المستخدم أو البريد"
                    value={username}
                    onChange={setUsername}
                    IconLeft={User}
                    required
                    autoFocus
                  />
                  <InputField
                    id="login-password"
                    label="كلمة المرور"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="كلمة المرور"
                    value={password}
                    onChange={setPassword}
                    IconLeft={Lock}
                    rightElement={
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
                        aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    }
                    required
                  />

                  <Button
                    type="submit"
                    variant="default"
                    size="lg"
                    className="w-full h-12 rounded-xl font-black text-sm text-white cursor-pointer"
                    style={{
                      background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 60%, #4338CA 100%)',
                      boxShadow: '0 6px 24px rgba(99,102,241,0.4)',
                      border: 'none',
                    }}
                    loading={loading}
                  >
                    تسجيل الدخول
                  </Button>
                </form>

                {/* Biometric login */}
                {biometricAvailable && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-slate-200 dark:bg-white/[0.06]" />
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">أو</span>
                      <div className="flex-1 h-px bg-slate-200 dark:bg-white/[0.06]" />
                    </div>
                    <button
                      type="button"
                      onClick={handleBiometricLogin}
                      className={[
                        'w-full flex items-center justify-center gap-2.5 py-3 rounded-xl',
                        'text-sm font-bold transition-all cursor-pointer border',
                        isDark
                          ? 'bg-white/[0.04] border-white/[0.09] text-slate-300 hover:bg-white/[0.07] hover:border-white/[0.15]'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100',
                      ].join(' ')}
                    >
                      <Fingerprint className="h-4 w-4 text-indigo-500" />
                      الدخول بهوية الجهاز
                    </button>
                  </div>
                )}

                <p className="text-xs text-center text-slate-500 dark:text-slate-400">
                  عضو جديد؟{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('register')}
                    className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    قدّم طلب انضمام
                  </button>
                </p>
              </motion.div>
            )}

            {/* ── REGISTER ── */}
            {mode === 'register' && (
              <motion.div
                key="register"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.25 }}
                className="space-y-5"
              >
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    طلب انضمام
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    أكمل بياناتك وسيقوم القائد بمراجعة طلبك واعتماده
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
                    onChange={setRegFullName}
                    IconLeft={User}
                    required
                  />

                  <div className="grid grid-cols-2 gap-2.5">
                    <InputField
                      id="reg-username"
                      label="اسم المستخدم"
                      placeholder="مثال: eltmsah"
                      value={regUsername}
                      onChange={(v) => setRegUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      IconLeft={User}
                      required
                    />
                    <div className="space-y-1.5">
                      <label
                        htmlFor="reg-committee"
                        className="block text-xs font-semibold text-slate-600 dark:text-slate-400"
                      >
                        اللجنة
                      </label>
                      <select
                        id="reg-committee"
                        value={regCommittee}
                        onChange={(e) => setRegCommittee(e.target.value)}
                        className={[
                          'w-full h-[46px] px-3 rounded-xl text-sm outline-none transition-all cursor-pointer',
                          'border border-slate-200 dark:border-white/[0.08]',
                          isDark ? 'bg-white/[0.04] text-white' : 'bg-slate-50 text-slate-900',
                          'focus:border-indigo-500 dark:focus:border-indigo-400',
                          'focus:ring-2 focus:ring-indigo-500/15',
                        ].join(' ')}
                      >
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
                    id="reg-email"
                    label="البريد الإلكتروني"
                    type="email"
                    placeholder="name@gmail.com"
                    value={regEmail}
                    onChange={setRegEmail}
                    IconLeft={Mail}
                    required
                  />

                  <div className="grid grid-cols-2 gap-2.5">
                    <InputField
                      id="reg-password"
                      label="كلمة المرور"
                      type={showRegPassword ? 'text' : 'password'}
                      placeholder="6 خانات على الأقل"
                      value={regPassword}
                      onChange={setRegPassword}
                      IconLeft={Lock}
                      rightElement={
                        <button
                          type="button"
                          onClick={() => setShowRegPassword((v) => !v)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
                          aria-label="إظهار / إخفاء كلمة المرور"
                        >
                          {showRegPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      }
                      required
                    />
                    <InputField
                      id="reg-confirm"
                      label="تأكيد كلمة المرور"
                      type="password"
                      placeholder="أعد كتابة كلمة المرور"
                      value={regConfirmPassword}
                      onChange={setRegConfirmPassword}
                      IconLeft={Lock}
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="default"
                    size="lg"
                    className="w-full h-12 rounded-xl font-black text-sm text-white cursor-pointer mt-1"
                    style={{
                      background: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 60%, #0284C7 100%)',
                      boxShadow: '0 6px 20px rgba(6,182,212,0.35)',
                      border: 'none',
                    }}
                    loading={regSubmitting}
                  >
                    إرسال طلب الانضمام
                  </Button>
                </form>

                <p className="text-xs text-center text-slate-500 dark:text-slate-400">
                  لديك حساب؟{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    تسجيل الدخول
                  </button>
                </p>
              </motion.div>
            )}

            {/* ── SUCCESS ── */}
            {mode === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="text-center space-y-6 py-4"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 180 }}
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
                  style={{
                    background: 'rgba(16,185,129,0.1)',
                    border: '2px solid rgba(16,185,129,0.4)',
                    boxShadow: '0 0 24px rgba(16,185,129,0.2)',
                  }}
                >
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </motion.div>

                <div className="space-y-2">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    تم استلام طلبك
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
                    بياناتك مسجّلة، وحسابك{' '}
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      بانتظار موافقة القائد
                    </span>{' '}
                    للتفعيل.
                  </p>
                </div>

                <div
                  className="p-4 rounded-xl text-right space-y-2"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                    border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #E2E8F0',
                  }}
                >
                  {[
                    { label: 'الاسم',      value: regFullName,    className: '' },
                    { label: 'المستخدم',   value: `@${regUsername}`, className: 'text-indigo-600 dark:text-cyan-400' },
                    { label: 'الحالة',     value: 'قيد المراجعة', className: 'text-amber-600 dark:text-amber-400' },
                  ].map(({ label, value, className }) => (
                    <div key={label} className="flex justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">{label}:</span>
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
