import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/button';
import {
  Lock, User, Mail, Sparkles, ShieldCheck, Sun, Moon,
  CheckCircle2, Eye, EyeOff, Layers, Award, Zap, ArrowLeft,
  ChevronRight, Laptop, HelpCircle
} from 'lucide-react';
import { DEFAULT_COMMITTEES } from '@/types';

/* ── Luxury Brand Logo SVG for منصة الجوجالية ───────────────────────── */
function GogalyiaLogo({ size = 48 }: { size?: number }) {
  return (
    <div className="relative inline-flex items-center justify-center select-none shrink-0">
      <div
        className="absolute -inset-2 rounded-2xl blur-lg opacity-60 animate-pulse pointer-events-none"
        style={{
          background: 'linear-gradient(135deg, #6C63FF 0%, #22D3EE 50%, #10B981 100%)',
        }}
      />
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="relative z-10 drop-shadow-md">
        <defs>
          <linearGradient id="gogLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366F1" />
            <stop offset="50%" stopColor="#4F46E5" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
          <linearGradient id="goldAccent" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
        </defs>
        {/* Rounded Diamond Badge Base */}
        <rect width="48" height="48" rx="14" fill="url(#gogLogoGrad)" />
        <rect x="1" y="1" width="46" height="46" rx="13" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
        {/* Stylized Arabic "ج" & Orbit */}
        <path
          d="M32 15C32 15 28 13 22 13C15 13 13 18 13 24C13 30 18 35 26 35C33 35 35 30 35 28"
          stroke="white"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        {/* Crown / Golden Center Dot */}
        <circle cx="24" cy="24" r="3.2" fill="url(#goldAccent)" />
      </svg>
    </div>
  );
}

/* ── Atmospheric dynamic orbs with light/dark adaptation ─────────────── */
function AmbientOrb({ className, delay = 0 }: { className: string; delay?: number }) {
  return (
    <motion.div
      className={`absolute rounded-full blur-3xl pointer-events-none transition-opacity duration-700 ${className}`}
      animate={{ opacity: [0.25, 0.55, 0.25], scale: [1, 1.1, 1] }}
      transition={{ duration: 7 + delay, repeat: Infinity, ease: 'easeInOut', delay }}
    />
  );
}

/* ── Value Propositions for الجوجالية ───────────────────────────────── */
const highlights = [
  {
    icon: Zap,
    title: 'إدارة المهام والتكليفات',
    desc: 'متابعة حية وتسليم رقمي مرن بين الأعضاء ورؤساء اللجان',
    gradient: 'from-violet-500 to-indigo-600',
    color: '#8B5CF6',
  },
  {
    icon: Award,
    title: 'محفظة نقاط O Coins',
    desc: 'نظام مكافآت تنافسي ذكي يُقدّر إنجازات وتفاني كل عضو',
    gradient: 'from-amber-500 to-orange-600',
    color: '#F59E0B',
  },
  {
    icon: Layers,
    title: 'المسارات والدورات التدريبية',
    desc: 'ورش عمل تقنية متقدمة ومحتوى تعليمي حصري للمجتمع',
    gradient: 'from-cyan-500 to-blue-600',
    color: '#06B6D4',
  },
  {
    icon: ShieldCheck,
    title: 'منظومة إشراف واعتماد موثوقة',
    desc: 'إشراف قيادي محكم وبيئة عمل احترافية مبنية بأحدث المعايير',
    gradient: 'from-emerald-500 to-teal-600',
    color: '#10B981',
  },
];

export function LoginPage() {
  const { signInWithUsername, registerMember } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // Mode: 'login' | 'register' | 'registered_success'
  const [mode, setMode] = useState<'login' | 'register' | 'registered_success'>('login');

  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Registration form state
  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regCommittee, setRegCommittee] = useState(DEFAULT_COMMITTEES[0]?.id || 'tech-dev');
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);

  // ── Quick Fill Demo Lead Account ────────────────────────────────────
  const fillLeadDemo = () => {
    setUsername('eltmsah');
    setPassword('admin');
    setErrorMsg(null);
    toast.info('تمت تعبئة بيانات حساب القائد (eltmsah) بنجاح!');
  };

  // ── Handle Sign In ──────────────────────────────────────────────────
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const u = username.trim(), p = password.trim();
    if (!u || !p) {
      toast.error('يرجى كتابة اسم المستخدم أو البريد الإلكتروني وكلمة المرور.');
      return;
    }
    setLoading(true);
    try {
      await signInWithUsername(u, p);
      toast.success('مرحباً بك في منصة الجوجالية!');
      navigate('/dashboard');
    } catch (err: any) {
      setErrorMsg(err?.message || 'اسم المستخدم أو كلمة المرور غير صحيحة.');
    } finally {
      setLoading(false);
    }
  };

  // ── Handle Join Request (Registration) ──────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const name = regFullName.trim();
    const uname = regUsername.trim();
    const email = regEmail.trim();
    const pass = regPassword.trim();
    const confirmPass = regConfirmPassword.trim();

    if (!name || !uname || !email || !pass) {
      toast.error('يرجى تعبئة كافة الحقول المطلوبة.');
      return;
    }

    if (pass.length < 6) {
      setErrorMsg('كلمة المرور يجب ألا تقل عن 6 خانات.');
      return;
    }

    if (pass !== confirmPass) {
      setErrorMsg('كلمة المرور وتأكيد كلمة المرور غير متطابقين.');
      return;
    }

    const selectedCommObj = DEFAULT_COMMITTEES.find(c => c.id === regCommittee);
    const committeeName = selectedCommObj ? selectedCommObj.name : 'Tech Dev';

    setRegSubmitting(true);
    try {
      await registerMember({
        fullName: name,
        username: uname,
        email: email,
        password: pass,
        committeeId: regCommittee,
        committeeName: committeeName,
      });

      setMode('registered_success');
      toast.success('تم إرسال طلب انضمامك بنجاح!');
    } catch (err: any) {
      setErrorMsg(err?.message || 'تعذر إرسال طلب الانضمام، يرجى المحاولة لاحقاً.');
    } finally {
      setRegSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col lg:flex-row font-sans relative overflow-x-hidden select-none transition-colors duration-300 bg-[#F8FAFC] dark:bg-[#07070E] text-slate-900 dark:text-[#F0F0FF]"
      dir="rtl"
    >
      {/* ── Dynamic Ambient Background Glowing Orbs ─────────────────── */}
      <AmbientOrb className="w-[500px] h-[500px] -top-32 -right-32 bg-indigo-500/15 dark:bg-indigo-600/20" delay={0} />
      <AmbientOrb className="w-[420px] h-[420px] top-1/2 -left-20 bg-cyan-500/15 dark:bg-cyan-600/15" delay={2} />
      <AmbientOrb className="w-[380px] h-[380px] -bottom-20 right-1/4 bg-emerald-500/10 dark:bg-emerald-600/15" delay={4} />

      {/* ── Subtle Futuristic Cyber Grid / Dot Matrix ───────────────── */}
      <div className="absolute inset-0 bg-[radial-gradient(#4f46e512_1px,transparent_1px)] dark:bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

      {/* ═══════════════════════════════════════════════════════════════════
          LEFT / SHOWCASE HERO PANEL (Desktop)
         ═══════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="hidden lg:flex lg:w-[48%] flex-col justify-between p-12 xl:p-16 relative z-10 border-l border-slate-200/80 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.01] backdrop-blur-md"
      >
        {/* Top Branding Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <GogalyiaLogo size={46} />
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  منصة الجوجالية
                </h1>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200/80 dark:border-indigo-400/30 text-indigo-700 dark:text-cyan-300">
                  الإصدار الرسمي 2026
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                مجتمع الإبداع والريادة التقنية والعمل المشترك
              </p>
            </div>
          </div>
        </div>

        {/* Hero Narrative & Catchphrase */}
        <div className="space-y-8 my-auto py-8">
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.1] text-indigo-700 dark:text-cyan-300 shadow-xs backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>بوابة التميز المؤسسي الشاملة لفريق الجوجالية</span>
          </div>

          <div className="space-y-3 max-w-md">
            <h2 className="text-4xl xl:text-5xl font-black leading-[1.2] text-slate-900 dark:text-white">
              اصنع الأثر،{' '}
              <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-500 dark:from-violet-400 dark:via-purple-300 dark:to-cyan-400 bg-clip-text text-transparent">
                طوّر ذاتك،
              </span>{' '}
              وقُد المستقبل.
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300/80 leading-relaxed font-normal">
              منصة مركزية متطورة صُممت خصيصاً لمجتمع الجوجالية لتوحيد المهام، والتعليم المستمر، والتحفيز بنقاط O Coins بأعلى درجات الاحترافية والتنظيم.
            </p>
          </div>

          {/* Value props grid */}
          <div className="grid grid-cols-2 gap-3.5 max-w-lg">
            {highlights.map((item, index) => {
              const IconComp = item.icon;
              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + index * 0.08, duration: 0.45 }}
                  className="p-4 rounded-2xl bg-white/80 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.07] hover:border-indigo-400 dark:hover:border-white/20 transition-all group backdrop-blur-md shadow-xs hover:shadow-md"
                >
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${item.color}20` }}
                    >
                      <IconComp className="h-4 w-4" style={{ color: item.color }} />
                    </div>
                    <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-white transition-colors">
                      {item.title}
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    {item.desc}
                  </p>
                </motion.div>
              );
            })}
          </div>

          {/* Live Platform Security Status Badge */}
          <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
            <span>خوادم المنصة مؤمنة بالكامل بتشفير SSL/TLS عالي الموثوقية</span>
          </div>
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200/80 dark:border-white/[0.06] pt-5">
          <span>© 2026 منصة الجوجالية · جميع الحقوق محفوظة</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          </div>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════
          RIGHT PANEL — Ultra-Glass Dual-Mode Login / Register Form
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col justify-between p-5 sm:p-8 lg:p-12 relative z-10">
        {/* Top Header bar */}
        <div className="flex items-center justify-between w-full">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3">
            <GogalyiaLogo size={36} />
            <div>
              <span className="font-black text-base text-slate-900 dark:text-white">منصة الجوجالية</span>
              <span className="block text-[10px] text-slate-500 dark:text-slate-400">مجتمع الإبداع والريادة</span>
            </div>
          </div>

          {/* Controls: Quick Demo Fill & Theme Switcher */}
          <div className="mr-auto flex items-center gap-2">
            {mode === 'login' && (
              <button
                type="button"
                onClick={fillLeadDemo}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/70 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all cursor-pointer"
                title="تعبئة تلقائية لبيانات حساب القائد"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span>تجربة حساب القائد</span>
              </button>
            )}

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08] shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              title={theme === 'dark' ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن'}
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400 animate-spin-slow" />
              ) : (
                <Moon className="h-4 w-4 text-indigo-600" />
              )}
              <span className="text-xs font-bold hidden md:inline">
                {theme === 'dark' ? 'فاتح' : 'داكن'}
              </span>
            </button>
          </div>
        </div>

        {/* Center Container: Glassmorphism Card */}
        <div className="w-full max-w-md mx-auto my-auto py-6">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="rounded-3xl p-6 sm:p-9 bg-white/90 dark:bg-slate-950/75 backdrop-blur-2xl border border-slate-200/90 dark:border-white/[0.1] shadow-[0_20px_60px_-15px_rgba(15,23,42,0.1)] dark:shadow-[0_25px_80px_rgba(0,0,0,0.85)] relative transition-all"
          >
            {/* Ambient inner glow */}
            <div className="absolute top-0 right-1/4 w-32 h-32 bg-indigo-500/10 dark:bg-indigo-600/20 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute bottom-0 left-1/4 w-32 h-32 bg-cyan-500/10 dark:bg-cyan-600/20 rounded-full blur-2xl pointer-events-none" />

            {/* Mode Switcher Tabs (Sign In vs Join Request) */}
            {mode !== 'registered_success' && (
              <div className="grid grid-cols-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/[0.08] mb-6 relative">
                <button
                  type="button"
                  onClick={() => { setMode('login'); setErrorMsg(null); }}
                  className={`py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    mode === 'login'
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/25'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold'
                  }`}
                >
                  تسجيل الدخول
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('register'); setErrorMsg(null); }}
                  className={`py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    mode === 'register'
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-600/25'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold'
                  }`}
                >
                  طلب انضمام جديد
                </button>
              </div>
            )}

            {/* Error Banner */}
            <AnimatePresence>
              {errorMsg && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5"
                >
                  <span className="text-rose-500 font-bold mt-0.5">⚠️</span>
                  <div className="flex-1 leading-relaxed">
                    <p className="font-bold text-rose-600 dark:text-rose-400">تنبيه:</p>
                    <p>{errorMsg}</p>
                  </div>
                  <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700 font-bold text-sm cursor-pointer">✕</button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── MODE 1: SIGN IN ────────────────────────────────────────── */}
            {mode === 'login' && (
              <motion.div
                key="login-view"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-5"
              >
                <div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    مرحباً بك مجدداً 👋
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    أدخل بيانات حسابك للوصول إلى لوحة تحكم منصة الجوجالية
                  </p>
                </div>

                <form onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      اسم المستخدم أو البريد الإلكتروني
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g. eltmsah أو البريد الإلكتروني"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full pr-10 pl-4 py-3 rounded-xl bg-slate-50/90 dark:bg-black/30 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs sm:text-sm focus:outline-none focus:bg-white dark:focus:bg-black/50 focus:border-indigo-600 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-xs transition-all"
                        autoFocus
                        required
                      />
                      <User className="absolute right-3.5 top-3.5 h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        كلمة المرور
                      </label>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pr-10 pl-10 py-3 rounded-xl bg-slate-50/90 dark:bg-black/30 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs sm:text-sm focus:outline-none focus:bg-white dark:focus:bg-black/50 focus:border-indigo-600 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-xs transition-all"
                        required
                      />
                      <Lock className="absolute right-3.5 top-3.5 h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-3.5 top-3.5 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                        title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    variant="default"
                    size="lg"
                    className="w-full h-12 rounded-xl font-black text-sm bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-600 hover:opacity-95 text-white shadow-lg shadow-indigo-600/25 active:scale-[0.99] transition-all cursor-pointer mt-2"
                    loading={loading}
                  >
                    تسجيل الدخول للمنصة
                  </Button>
                </form>

                <div className="pt-3 text-center border-t border-slate-200/80 dark:border-white/[0.06]">
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    عضو جديد وتريد الانضمام للفريق؟{' '}
                    <button
                      type="button"
                      onClick={() => { setMode('register'); setErrorMsg(null); }}
                      className="font-bold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                    >
                      قدّم طلب انضمام الآن 🚀
                    </button>
                  </p>
                </div>
              </motion.div>
            )}

            {/* ── MODE 2: REGISTER / JOIN REQUEST ────────────────────────── */}
            {mode === 'register' && (
              <motion.div
                key="register-view"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    طلب انضمام جديد 🚀
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    أنشئ حسابك وسيقوم قائد الجوجالية بمراجعته واعتماده للتفعيل المباشر
                  </p>
                </div>

                <form onSubmit={handleRegister} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      الاسم بالكامل (ثلاثي أو رباعي)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g. زياد التمساح"
                        value={regFullName}
                        onChange={(e) => setRegFullName(e.target.value)}
                        className="w-full pr-9 pl-3.5 py-2.5 rounded-xl bg-slate-50/90 dark:bg-black/30 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs focus:outline-none focus:bg-white dark:focus:bg-black/50 focus:border-cyan-600 dark:focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 shadow-xs transition-all"
                        required
                      />
                      <User className="absolute right-3 top-3 h-3.5 w-3.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        اسم المستخدم (Username)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. eltmsah"
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-50/90 dark:bg-black/30 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs font-mono focus:outline-none focus:bg-white dark:focus:bg-black/50 focus:border-cyan-600 dark:focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 shadow-xs transition-all"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        اللجنة التابع لها
                      </label>
                      <select
                        value={regCommittee}
                        onChange={(e) => setRegCommittee(e.target.value)}
                        className="w-full h-[38px] bg-slate-50/90 dark:bg-black/40 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white rounded-xl px-2 text-xs focus:outline-none focus:border-cyan-600 dark:focus:border-cyan-500 cursor-pointer shadow-xs transition-all"
                      >
                        {DEFAULT_COMMITTEES.map((comm) => (
                          <option key={comm.id} value={comm.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                            {comm.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      البريد الإلكتروني (Gmail / الجامعي)
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        placeholder="name@gmail.com"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        className="w-full pr-9 pl-3.5 py-2.5 rounded-xl bg-slate-50/90 dark:bg-black/30 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs focus:outline-none focus:bg-white dark:focus:bg-black/50 focus:border-cyan-600 dark:focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 shadow-xs transition-all"
                        required
                      />
                      <Mail className="absolute right-3 top-3 h-3.5 w-3.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        كلمة المرور
                      </label>
                      <div className="relative">
                        <input
                          type={showRegPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          className="w-full pr-3 pl-8 py-2.5 rounded-xl bg-slate-50/90 dark:bg-black/30 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs focus:outline-none focus:bg-white dark:focus:bg-black/50 focus:border-cyan-600 dark:focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 shadow-xs transition-all"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegPassword(!showRegPassword)}
                          className="absolute left-2.5 top-3 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                        >
                          {showRegPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        تأكيد كلمة المرور
                      </label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-50/90 dark:bg-black/30 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs focus:outline-none focus:bg-white dark:focus:bg-black/50 focus:border-cyan-600 dark:focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 shadow-xs transition-all"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    variant="default"
                    size="lg"
                    className="w-full h-11 rounded-xl font-black text-xs bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:opacity-95 text-white shadow-lg shadow-cyan-600/25 active:scale-[0.99] transition-all cursor-pointer mt-2"
                    loading={regSubmitting}
                  >
                    إرسال طلب الانضمام والاعتماد ✨
                  </Button>
                </form>

                <div className="pt-2 text-center border-t border-slate-200/80 dark:border-white/[0.06]">
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    لديك حساب بالفعل؟{' '}
                    <button
                      type="button"
                      onClick={() => { setMode('login'); setErrorMsg(null); }}
                      className="font-bold text-indigo-600 dark:text-violet-400 hover:underline cursor-pointer"
                    >
                      تسجيل الدخول 🔐
                    </button>
                  </p>
                </div>
              </motion.div>
            )}

            {/* ── MODE 3: SUCCESS CONFIRMATION ───────────────────────────── */}
            {mode === 'registered_success' && (
              <motion.div
                key="success-view"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-4 py-4"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-500/15 border-2 border-emerald-500 flex items-center justify-center mx-auto text-emerald-500 shadow-lg shadow-emerald-500/25 animate-bounce">
                  <CheckCircle2 className="h-8 w-8" />
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    تم استلام طلبك بنجاح! 🌟
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-xs mx-auto">
                    تم تسجيل بياناتك في منصة الجوجالية، وحسابك الآن <span className="text-amber-600 dark:text-amber-400 font-bold">بانتظار موافقة واعتماد القائد (Lead / Co-Lead)</span> للتفعيل.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-right space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">الاسم:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{regFullName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">اسم المستخدم:</span>
                    <span className="font-mono text-cyan-600 dark:text-cyan-300 font-bold">{regUsername}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">الحالة:</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">قيد المراجعة والاعتماد ⏳</span>
                  </div>
                </div>

                <Button
                  onClick={() => {
                    setMode('login');
                    setUsername(regUsername);
                    setPassword('');
                  }}
                  variant="default"
                  size="lg"
                  className="w-full h-11 rounded-xl font-black text-xs bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/25 active:scale-[0.99] cursor-pointer"
                >
                  العودة إلى شاشة تسجيل الدخول
                </Button>
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* Bottom Mobile Copyright */}
        <div className="lg:hidden text-center text-xs text-slate-500 dark:text-slate-400 py-2">
          © 2026 منصة الجوجالية · جميع الحقوق محفوظة
        </div>
      </div>
    </div>
  );
}
