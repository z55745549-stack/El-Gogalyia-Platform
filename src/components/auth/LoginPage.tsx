import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/button';
import {
  Lock, User, Mail, ShieldCheck, Sun, Moon,
  CheckCircle2, Eye, EyeOff, Layers, Award, Zap,
} from 'lucide-react';
import { DEFAULT_COMMITTEES } from '@/types';

/* ─────────────────────────────────────────────────────────────────────────────
   LOGO
───────────────────────────────────────────────────────────────────────────── */
function GogalyiaLogo({ size = 52 }: { size?: number }) {
  return (
    <div className="relative inline-flex items-center justify-center select-none shrink-0">
      <div
        className="absolute -inset-3 rounded-2xl blur-xl opacity-50 animate-pulse pointer-events-none"
        style={{ background: 'linear-gradient(135deg, #6366F1 0%, #22D3EE 60%, #10B981 100%)' }}
      />
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="relative z-10 drop-shadow-xl">
        <defs>
          <linearGradient id="lg1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366F1" />
            <stop offset="55%" stopColor="#4F46E5" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
          <linearGradient id="lg2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
        </defs>
        <rect width="48" height="48" rx="14" fill="url(#lg1)" />
        <rect x="1" y="1" width="46" height="46" rx="13" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
        <path d="M32 15C32 15 28 13 22 13C15 13 13 18 13 24C13 30 18 35 26 35C33 35 35 30 35 28"
          stroke="white" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="24" cy="24" r="3.2" fill="url(#lg2)" />
      </svg>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   ANIMATED BACKGROUND PARTICLES
───────────────────────────────────────────────────────────────────────────── */
function Particle({ x, y, size, delay, color }: { x: number; y: number; size: number; delay: number; color: string }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{ left: `${x}%`, top: `${y}%`, width: size, height: size, background: color, filter: 'blur(1px)' }}
      animate={{ y: [-10, 10, -10], opacity: [0.3, 0.7, 0.3], scale: [1, 1.2, 1] }}
      transition={{ duration: 4 + delay, repeat: Infinity, ease: 'easeInOut', delay }}
    />
  );
}

const particles = [
  { x: 10, y: 20, size: 4, delay: 0, color: 'rgba(99,102,241,0.8)' },
  { x: 85, y: 15, size: 3, delay: 1.2, color: 'rgba(34,211,238,0.8)' },
  { x: 30, y: 80, size: 5, delay: 0.7, color: 'rgba(245,158,11,0.7)' },
  { x: 70, y: 75, size: 3, delay: 2, color: 'rgba(16,185,129,0.7)' },
  { x: 50, y: 10, size: 4, delay: 1.5, color: 'rgba(167,139,250,0.7)' },
  { x: 92, y: 55, size: 3, delay: 0.4, color: 'rgba(99,102,241,0.6)' },
  { x: 5, y: 60, size: 5, delay: 2.3, color: 'rgba(34,211,238,0.6)' },
  { x: 60, y: 90, size: 3, delay: 1.8, color: 'rgba(244,63,94,0.6)' },
];

/* ─────────────────────────────────────────────────────────────────────────────
   VALUE PROPOSITIONS
───────────────────────────────────────────────────────────────────────────── */
const features = [
  { icon: Zap, label: 'إدارة المهام', sub: 'متابعة حية وتسليم رقمي', color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
  { icon: Award, label: 'O Coins', sub: 'نظام مكافآت تنافسي', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  { icon: Layers, label: 'الدورات', sub: 'محتوى تعليمي حصري', color: '#06B6D4', bg: 'rgba(6,182,212,0.12)' },
  { icon: ShieldCheck, label: 'الأمان', sub: 'بيئة عمل احترافية', color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
];

/* ─────────────────────────────────────────────────────────────────────────────
   INPUT COMPONENT
───────────────────────────────────────────────────────────────────────────── */
function FloatingInput({
  id, label, type = 'text', placeholder, value, onChange, icon: Icon, rightSlot, required, autoFocus,
}: {
  id: string; label: string; type?: string; placeholder: string;
  value: string; onChange: (v: string) => void;
  icon: React.ElementType; rightSlot?: React.ReactNode;
  required?: boolean; autoFocus?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const hasValue = value.length > 0;

  return (
    <div className="relative group">
      <label
        htmlFor={id}
        className={`absolute right-4 transition-all duration-200 pointer-events-none z-10 font-semibold ${
          focused || hasValue
            ? 'top-2 text-[10px] text-indigo-500 dark:text-indigo-400'
            : 'top-1/2 -translate-y-1/2 text-xs text-slate-400 dark:text-slate-500'
        }`}
      >
        {label}
      </label>
      <div className={`relative flex items-center rounded-2xl border transition-all duration-200 overflow-hidden ${
        focused
          ? 'border-indigo-500 dark:border-indigo-400 shadow-[0_0_0_3px_rgba(99,102,241,0.15)]'
          : 'border-slate-200 dark:border-white/[0.09] hover:border-slate-300 dark:hover:border-white/[0.15]'
      } bg-slate-50/80 dark:bg-white/[0.04]`}>
        <Icon className="absolute right-4 bottom-3 h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none z-10" style={{ bottom: focused || hasValue ? '10px' : '50%', transform: focused || hasValue ? 'none' : 'translateY(50%)', right: '14px', position: 'absolute' }} />
        <input
          id={id}
          type={type}
          placeholder={focused || hasValue ? placeholder : ''}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          required={required}
          autoFocus={autoFocus}
          className="w-full pt-6 pb-2.5 pr-11 text-sm text-slate-900 dark:text-white bg-transparent outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600"
          style={{ paddingLeft: rightSlot ? '2.75rem' : '1rem' }}
          dir="auto"
        />
        {rightSlot && <div className="absolute left-3 bottom-2.5 z-10">{rightSlot}</div>}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────────────────────── */
export function LoginPage() {
  const { signInWithUsername, registerMember } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'register' | 'success'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regCommittee, setRegCommittee] = useState(DEFAULT_COMMITTEES[0]?.id || 'tech-dev');
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);



  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const u = username.trim(), p = password.trim();
    if (!u || !p) { toast.error('يرجى إدخال اسم المستخدم وكلمة المرور.'); return; }
    setLoading(true);
    try {
      await signInWithUsername(u, p);
      toast.success('مرحباً بك في منصة الجوجالية! 🎉');
      navigate('/dashboard');
    } catch (err: any) {
      setErrorMsg(err?.message || 'اسم المستخدم أو كلمة المرور غير صحيحة.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const name = regFullName.trim(), uname = regUsername.trim();
    const email = regEmail.trim(), pass = regPassword.trim();
    if (!name || !uname || !email || !pass) { toast.error('يرجى تعبئة كافة الحقول.'); return; }
    if (pass.length < 6) { setErrorMsg('كلمة المرور يجب ألا تقل عن 6 خانات.'); return; }
    if (pass !== regConfirmPassword.trim()) { setErrorMsg('كلمتا المرور غير متطابقتين.'); return; }
    const selectedComm = DEFAULT_COMMITTEES.find(c => c.id === regCommittee);
    setRegSubmitting(true);
    try {
      await registerMember({
        fullName: name, username: uname, email, password: pass,
        committeeId: regCommittee, committeeName: selectedComm?.name || 'Tech Dev',
      });
      setMode('success');
      toast.success('تم إرسال طلب انضمامك بنجاح! ✨');
    } catch (err: any) {
      setErrorMsg(err?.message || 'تعذر إرسال الطلب، حاول مجدداً.');
    } finally {
      setRegSubmitting(false);
    }
  };

  const switchMode = (m: 'login' | 'register') => { setMode(m); setErrorMsg(null); };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center relative overflow-hidden font-sans transition-colors duration-300"
      style={{
        background: theme === 'dark'
          ? 'linear-gradient(135deg, #07070E 0%, #0D0D1F 40%, #090913 100%)'
          : 'linear-gradient(135deg, #EEF2FF 0%, #F0F9FF 40%, #F8FAFC 100%)',
      }}
      dir="rtl"
    >
      {/* ── Cosmic Background Orbs ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute w-[800px] h-[800px] rounded-full"
          style={{
            top: '-25%', right: '-15%',
            background: theme === 'dark'
              ? 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(79,70,229,0.08) 0%, transparent 70%)',
          }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full"
          style={{
            bottom: '-20%', left: '-10%',
            background: theme === 'dark'
              ? 'radial-gradient(circle, rgba(34,211,238,0.08) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(6,182,212,0.06) 0%, transparent 70%)',
          }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />
        <motion.div
          className="absolute w-[400px] h-[400px] rounded-full"
          style={{
            top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: theme === 'dark'
              ? 'radial-gradient(circle, rgba(167,139,250,0.05) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(124,58,237,0.04) 0%, transparent 70%)',
          }}
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
        />
        {/* Dot grid */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(${theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(99,102,241,0.08)'} 1px, transparent 1px)`,
            backgroundSize: '28px 28px',
          }}
        />
        {/* Floating particles */}
        {particles.map((p, i) => <Particle key={i} {...p} />)}
      </div>

      {/* ── Theme Toggle (top corner) ── */}
      <div className="absolute top-5 left-5 z-50">
        <motion.button
          onClick={toggleTheme}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 px-4 py-2 rounded-2xl border text-sm font-bold transition-all cursor-pointer backdrop-blur-lg"
          style={{
            background: theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.85)',
            border: theme === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(203,213,225,0.8)',
            color: theme === 'dark' ? '#E2E8F0' : '#1E293B',
            boxShadow: theme === 'dark' ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 16px rgba(15,23,42,0.08)',
          }}
          title={theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <><Sun className="h-4 w-4 text-amber-400" /><span className="hidden sm:inline">فاتح</span></>
          ) : (
            <><Moon className="h-4 w-4 text-indigo-600" /><span className="hidden sm:inline">داكن</span></>
          )}
        </motion.button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MASTER CONTAINER — Centered Dual-Panel Card
         ══════════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-5xl mx-4 flex rounded-[2rem] overflow-hidden"
        style={{
          boxShadow: theme === 'dark'
            ? '0 40px 120px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.07)'
            : '0 40px 100px rgba(15,23,42,0.15), 0 0 0 1px rgba(203,213,225,0.6)',
          minHeight: '600px',
        }}
      >
        {/* ── LEFT / HERO PANEL ── */}
        <div
          className="hidden lg:flex lg:w-[46%] flex-col justify-between p-10 xl:p-12 relative overflow-hidden"
          style={{
            background: theme === 'dark'
              ? 'linear-gradient(145deg, #0F0F24 0%, #131328 50%, #0A0A1A 100%)'
              : 'linear-gradient(145deg, #4F46E5 0%, #6366F1 45%, #4338CA 100%)',
            borderRight: theme === 'dark' ? '1px solid rgba(255,255,255,0.06)' : 'none',
          }}
        >
          {/* Hero background decorations */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div
              className="absolute w-64 h-64 rounded-full"
              style={{
                top: '-10%', right: '-15%',
                background: theme === 'dark'
                  ? 'radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)'
                  : 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
              }}
            />
            <div
              className="absolute w-48 h-48 rounded-full"
              style={{
                bottom: '10%', left: '-10%',
                background: theme === 'dark'
                  ? 'radial-gradient(circle, rgba(34,211,238,0.1) 0%, transparent 70%)'
                  : 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
              }}
            />
            {/* Subtle geometric lines */}
            <svg className="absolute inset-0 w-full h-full opacity-[0.06]" viewBox="0 0 400 600">
              <line x1="0" y1="150" x2="400" y2="150" stroke="white" strokeWidth="0.5" />
              <line x1="0" y1="300" x2="400" y2="300" stroke="white" strokeWidth="0.5" />
              <line x1="0" y1="450" x2="400" y2="450" stroke="white" strokeWidth="0.5" />
              <line x1="100" y1="0" x2="100" y2="600" stroke="white" strokeWidth="0.5" />
              <line x1="250" y1="0" x2="250" y2="600" stroke="white" strokeWidth="0.5" />
            </svg>
          </div>

          {/* Top brand */}
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <GogalyiaLogo size={44} />
              <div>
                <h1
                  className="text-xl font-black tracking-tight leading-tight"
                  style={{ color: theme === 'dark' ? '#F0F0FF' : '#FFFFFF' }}
                >
                  منصة الجوجالية
                </h1>
                <p
                  className="text-[11px] font-medium mt-0.5"
                  style={{ color: theme === 'dark' ? 'rgba(148,163,184,0.8)' : 'rgba(255,255,255,0.75)' }}
                >
                  مجتمع الإبداع والريادة التقنية
                </p>
              </div>
            </div>

            {/* Live badge */}
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold mt-2"
              style={{
                background: theme === 'dark' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.2)',
                border: theme === 'dark' ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.35)',
                color: theme === 'dark' ? '#6EE7B7' : '#FFFFFF',
              }}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              بوابة التميز المؤسسي الشاملة
            </div>
          </div>

          {/* Hero text */}
          <div className="relative z-10 space-y-6 my-auto">
            <div>
              <h2
                className="text-[1.85rem] xl:text-[2.1rem] font-black leading-[1.3] tracking-tight"
                style={{ color: theme === 'dark' ? '#F0F0FF' : '#FFFFFF' }}
              >
                اصنع الأثر،{' '}
                <span
                  style={{
                    background: theme === 'dark'
                      ? 'linear-gradient(90deg, #A78BFA, #22D3EE)'
                      : 'linear-gradient(90deg, #FDE68A, #FCD34D)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  طوّر ذاتك،
                </span>{' '}
                وقُد المستقبل.
              </h2>
              <p
                className="text-sm mt-4 leading-relaxed max-w-xs"
                style={{ color: theme === 'dark' ? 'rgba(148,163,184,0.9)' : 'rgba(255,255,255,0.82)' }}
              >
                منصة مركزية متطورة تُوحّد المهام والتعليم والتحفيز بأعلى درجات الاحترافية.
              </p>
            </div>

            {/* Feature chips */}
            <div className="grid grid-cols-2 gap-2.5">
              {features.map((f, i) => {
                const IC = f.icon;
                return (
                  <motion.div
                    key={f.label}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.08 }}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-2xl transition-all"
                    style={{
                      background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.18)',
                      border: theme === 'dark' ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(255,255,255,0.3)',
                      backdropFilter: 'blur(8px)',
                    }}
                  >
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: theme === 'dark' ? f.bg : 'rgba(255,255,255,0.25)' }}>
                      <IC className="h-3.5 w-3.5" style={{ color: theme === 'dark' ? f.color : '#FFFFFF' }} />
                    </div>
                    <div>
                      <p className="text-[11px] font-black" style={{ color: theme === 'dark' ? '#E2E8F0' : '#FFFFFF' }}>{f.label}</p>
                      <p className="text-[9.5px]" style={{ color: theme === 'dark' ? 'rgba(148,163,184,0.7)' : 'rgba(255,255,255,0.7)' }}>{f.sub}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div
            className="relative z-10 flex items-center justify-between text-[11px] pt-5"
            style={{
              borderTop: theme === 'dark' ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(255,255,255,0.25)',
              color: theme === 'dark' ? 'rgba(100,116,139,0.8)' : 'rgba(255,255,255,0.65)',
            }}
          >
            <span>© 2026 منصة الجوجالية</span>
            <div className="flex gap-1.5">
              {['#6366F1','#22D3EE','#10B981','#F59E0B'].map(c => (
                <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c, opacity: 0.8 }} />
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT / FORM PANEL ── */}
        <div
          className="flex-1 flex flex-col p-7 sm:p-10 xl:p-12 relative overflow-hidden"
          style={{
            background: theme === 'dark'
              ? 'rgba(10,10,20,0.97)'
              : 'rgba(255,255,255,0.98)',
          }}
        >
          {/* Inner ambient glow */}
          <div
            className="absolute top-0 left-0 w-48 h-48 rounded-full pointer-events-none"
            style={{
              background: theme === 'dark'
                ? 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)'
                : 'radial-gradient(circle, rgba(79,70,229,0.05) 0%, transparent 70%)',
            }}
          />

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-7">
            <GogalyiaLogo size={38} />
            <div>
              <span className="font-black text-base text-slate-900 dark:text-white">منصة الجوجالية</span>
              <span className="block text-[10px] text-slate-500 dark:text-slate-400">مجتمع الإبداع والريادة</span>
            </div>
          </div>

          {/* Form area — centered vertically */}
          <div className="flex-1 flex flex-col justify-center relative z-10">
            <AnimatePresence mode="wait">

              {/* ── LOGIN MODE ── */}
              {mode === 'login' && (
                <motion.div
                  key="login"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  {/* Header */}
                  <div className="space-y-1">
                    <div>
                      <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                        مرحباً بك 👋
                      </h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                        أدخل بياناتك للوصول إلى لوحة التحكم
                      </p>
                    </div>

                    {/* Tab switcher */}
                    <div
                      className="flex mt-5 p-1 rounded-2xl"
                      style={{
                        background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#F1F5F9',
                        border: theme === 'dark' ? '1px solid rgba(255,255,255,0.07)' : '1px solid #E2E8F0',
                      }}
                    >
                      <button
                        onClick={() => switchMode('login')}
                        className="flex-1 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer"
                        style={{
                          background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
                          color: '#FFFFFF',
                          boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
                        }}
                      >
                        تسجيل الدخول
                      </button>
                      <button
                        onClick={() => switchMode('register')}
                        className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        style={{ color: theme === 'dark' ? '#94A3B8' : '#64748B' }}
                      >
                        طلب انضمام جديد
                      </button>
                    </div>
                  </div>

                  {/* Error */}
                  <AnimatePresence>
                    {errorMsg && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="flex items-start gap-3 p-3.5 rounded-2xl text-xs"
                        style={{
                          background: 'rgba(244,63,94,0.08)',
                          border: '1px solid rgba(244,63,94,0.25)',
                          color: theme === 'dark' ? '#FDA4AF' : '#BE123C',
                        }}
                      >
                        <span className="font-bold mt-0.5">⚠</span>
                        <span className="flex-1 leading-relaxed">{errorMsg}</span>
                        <button onClick={() => setErrorMsg(null)} className="font-bold opacity-60 hover:opacity-100 cursor-pointer">✕</button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Form */}
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <FloatingInput
                      id="login-username"
                      label="اسم المستخدم أو البريد الإلكتروني"
                      placeholder="eltmsah أو name@gmail.com"
                      value={username}
                      onChange={setUsername}
                      icon={User}
                      required
                      autoFocus
                    />
                    <FloatingInput
                      id="login-password"
                      label="كلمة المرور"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={setPassword}
                      icon={Lock}
                      rightSlot={
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      }
                      required
                    />

                    <motion.div whileHover={{ scale: 1.005 }} whileTap={{ scale: 0.995 }}>
                      <Button
                        type="submit"
                        variant="default"
                        size="lg"
                        className="w-full h-[52px] rounded-2xl font-black text-sm text-white cursor-pointer mt-1"
                        style={{
                          background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 50%, #4338CA 100%)',
                          boxShadow: '0 8px 30px rgba(99,102,241,0.4), 0 2px 8px rgba(99,102,241,0.3)',
                          border: 'none',
                        }}
                        loading={loading}
                      >
                        {!loading && '🚀'} تسجيل الدخول إلى المنصة
                      </Button>
                    </motion.div>
                  </form>

                  <p className="text-xs text-center text-slate-500 dark:text-slate-400 pt-1">
                    عضو جديد؟{' '}
                    <button
                      onClick={() => switchMode('register')}
                      className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
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
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-5"
                >
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                      طلب انضمام 🚀
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      أكمل بياناتك وسيقوم القائد بمراجعة طلبك واعتماده
                    </p>

                    <div
                      className="flex mt-5 p-1 rounded-2xl"
                      style={{
                        background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#F1F5F9',
                        border: theme === 'dark' ? '1px solid rgba(255,255,255,0.07)' : '1px solid #E2E8F0',
                      }}
                    >
                      <button
                        onClick={() => switchMode('login')}
                        className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        style={{ color: theme === 'dark' ? '#94A3B8' : '#64748B' }}
                      >
                        تسجيل الدخول
                      </button>
                      <button
                        onClick={() => switchMode('register')}
                        className="flex-1 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer"
                        style={{
                          background: 'linear-gradient(135deg, #06B6D4, #0891B2)',
                          color: '#FFFFFF',
                          boxShadow: '0 4px 12px rgba(6,182,212,0.3)',
                        }}
                      >
                        طلب انضمام جديد
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {errorMsg && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="flex items-start gap-3 p-3 rounded-2xl text-xs"
                        style={{
                          background: 'rgba(244,63,94,0.08)',
                          border: '1px solid rgba(244,63,94,0.25)',
                          color: theme === 'dark' ? '#FDA4AF' : '#BE123C',
                        }}
                      >
                        <span className="font-bold mt-0.5">⚠</span>
                        <span className="flex-1">{errorMsg}</span>
                        <button onClick={() => setErrorMsg(null)} className="cursor-pointer opacity-60 hover:opacity-100">✕</button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <form onSubmit={handleRegister} className="space-y-3">
                    {/* Full name */}
                    <div className="relative">
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">الاسم الكامل</label>
                      <div className="relative">
                        <input
                          type="text" placeholder="زياد التمساح"
                          value={regFullName} onChange={e => setRegFullName(e.target.value)}
                          className="w-full pr-10 pl-4 py-3 rounded-2xl text-sm outline-none transition-all"
                          style={{
                            background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                            border: theme === 'dark' ? '1px solid rgba(255,255,255,0.09)' : '1px solid #E2E8F0',
                            color: theme === 'dark' ? '#F0F0FF' : '#0F172A',
                          }}
                          required
                        />
                        <User className="absolute right-3.5 top-3.5 h-4 w-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>

                    {/* Username + Committee */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">اسم المستخدم</label>
                        <input
                          type="text" placeholder="eltmsah"
                          value={regUsername} onChange={e => setRegUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                          className="w-full px-3 py-3 rounded-2xl text-sm font-mono outline-none transition-all"
                          style={{
                            background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                            border: theme === 'dark' ? '1px solid rgba(255,255,255,0.09)' : '1px solid #E2E8F0',
                            color: theme === 'dark' ? '#F0F0FF' : '#0F172A',
                          }}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">اللجنة</label>
                        <select
                          value={regCommittee} onChange={e => setRegCommittee(e.target.value)}
                          className="w-full h-[46px] px-3 rounded-2xl text-xs outline-none cursor-pointer transition-all"
                          style={{
                            background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                            border: theme === 'dark' ? '1px solid rgba(255,255,255,0.09)' : '1px solid #E2E8F0',
                            color: theme === 'dark' ? '#F0F0FF' : '#0F172A',
                          }}
                        >
                          {DEFAULT_COMMITTEES.map(c => (
                            <option key={c.id} value={c.id} style={{ background: theme === 'dark' ? '#0F0F1A' : '#FFFFFF' }}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">البريد الإلكتروني</label>
                      <div className="relative">
                        <input
                          type="email" placeholder="name@gmail.com"
                          value={regEmail} onChange={e => setRegEmail(e.target.value)}
                          className="w-full pr-10 pl-4 py-3 rounded-2xl text-sm outline-none transition-all"
                          style={{
                            background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                            border: theme === 'dark' ? '1px solid rgba(255,255,255,0.09)' : '1px solid #E2E8F0',
                            color: theme === 'dark' ? '#F0F0FF' : '#0F172A',
                          }}
                          required
                        />
                        <Mail className="absolute right-3.5 top-3.5 h-4 w-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>

                    {/* Passwords */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">كلمة المرور</label>
                        <div className="relative">
                          <input
                            type={showRegPassword ? 'text' : 'password'} placeholder="••••••••"
                            value={regPassword} onChange={e => setRegPassword(e.target.value)}
                            className="w-full pl-9 pr-3 py-3 rounded-2xl text-sm outline-none transition-all"
                            style={{
                              background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                              border: theme === 'dark' ? '1px solid rgba(255,255,255,0.09)' : '1px solid #E2E8F0',
                              color: theme === 'dark' ? '#F0F0FF' : '#0F172A',
                            }}
                            required
                          />
                          <button type="button" onClick={() => setShowRegPassword(!showRegPassword)} className="absolute left-3 top-3.5 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer">
                            {showRegPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">تأكيد كلمة المرور</label>
                        <input
                          type="password" placeholder="••••••••"
                          value={regConfirmPassword} onChange={e => setRegConfirmPassword(e.target.value)}
                          className="w-full px-3 py-3 rounded-2xl text-sm outline-none transition-all"
                          style={{
                            background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                            border: theme === 'dark' ? '1px solid rgba(255,255,255,0.09)' : '1px solid #E2E8F0',
                            color: theme === 'dark' ? '#F0F0FF' : '#0F172A',
                          }}
                          required
                        />
                      </div>
                    </div>

                    <motion.div whileHover={{ scale: 1.005 }} whileTap={{ scale: 0.995 }}>
                      <Button
                        type="submit"
                        variant="default"
                        size="lg"
                        className="w-full h-[50px] rounded-2xl font-black text-sm text-white cursor-pointer mt-1"
                        style={{
                          background: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 50%, #0284C7 100%)',
                          boxShadow: '0 8px 25px rgba(6,182,212,0.35)',
                          border: 'none',
                        }}
                        loading={regSubmitting}
                      >
                        {!regSubmitting && '✨'} إرسال طلب الانضمام
                      </Button>
                    </motion.div>
                  </form>

                  <p className="text-xs text-center text-slate-500 dark:text-slate-400">
                    لديك حساب؟{' '}
                    <button onClick={() => switchMode('login')} className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">
                      تسجيل الدخول 🔐
                    </button>
                  </p>
                </motion.div>
              )}

              {/* ── SUCCESS MODE ── */}
              {mode === 'success' && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="text-center space-y-6 py-6"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                    className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
                    style={{
                      background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.08))',
                      border: '2px solid rgba(16,185,129,0.5)',
                      boxShadow: '0 0 30px rgba(16,185,129,0.25)',
                    }}
                  >
                    <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                  </motion.div>

                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white">تم الاستلام! 🌟</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
                      تم تسجيل بياناتك بنجاح، وحسابك{' '}
                      <span className="font-bold text-amber-600 dark:text-amber-400">بانتظار موافقة القائد</span>
                      {' '}للتفعيل.
                    </p>
                  </div>

                  <div
                    className="p-4 rounded-2xl text-right space-y-2 text-sm"
                    style={{
                      background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                      border: theme === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid #E2E8F0',
                    }}
                  >
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400 text-xs">الاسم:</span>
                      <span className="font-bold text-xs text-slate-900 dark:text-white">{regFullName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400 text-xs">اسم المستخدم:</span>
                      <span className="font-mono font-bold text-xs text-indigo-600 dark:text-cyan-400">@{regUsername}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400 text-xs">الحالة:</span>
                      <span className="font-bold text-xs text-amber-600 dark:text-amber-400">⏳ قيد المراجعة</span>
                    </div>
                  </div>

                  <Button
                    onClick={() => { setMode('login'); setUsername(regUsername); setPassword(''); }}
                    variant="default"
                    size="lg"
                    className="w-full h-[50px] rounded-2xl font-black text-sm text-white cursor-pointer"
                    style={{
                      background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
                      boxShadow: '0 8px 25px rgba(99,102,241,0.35)',
                      border: 'none',
                    }}
                  >
                    العودة لتسجيل الدخول
                  </Button>
                </motion.div>
              )}

            </AnimatePresence>
          </div>

          {/* SSL Security note */}
          <div className="relative z-10 flex items-center justify-center gap-2 mt-6">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              محمي بتشفير SSL/TLS — الإصدار الرسمي 2026
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
