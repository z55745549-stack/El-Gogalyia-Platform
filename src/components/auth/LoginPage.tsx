import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Lock, User, Shield, ShieldAlert, Sun, Moon, ArrowRight, KeyRound
} from 'lucide-react';
import type { UserProfile } from '@/types';

/* ── GDG HITU Brand Logo SVG ───────────────────────────────────────── */
function GDGLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6C63FF" />
          <stop offset="50%" stopColor="#A78BFA" />
          <stop offset="100%" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="10" fill="url(#logoGrad)" />
      <text
        x="50%" y="55%"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="white"
        fontSize="14"
        fontWeight="900"
        fontFamily="Inter, Cairo, sans-serif"
        letterSpacing="-0.5"
      >G</text>
    </svg>
  );
}

/* ── Feature bullets ────────────────────────────────────────────────── */
const features = [
  { title: 'إدارة المهام والتكليفات', desc: 'تسليم ومراجعة فورية بين الأعضاء والمشرفين' },
  { title: 'محفظة O Coins', desc: 'نظام نقاط ومكافآت مدروس لتحفيز الفريق' },
  { title: 'الدورات والتدريبات', desc: 'تعلّم وتتبع تقدمك مع محتوى YouTube مدمج' },
  { title: 'حماية وأمان متعدد الطبقات', desc: 'صلاحيات منفصلة + تحقق ثنائي للمشرفين' },
];

/* ── Animated background orb ────────────────────────────────────────── */
function Orb({ className, delay = 0 }: { className: string; delay?: number }) {
  return (
    <motion.div
      className={`absolute rounded-full blur-3xl pointer-events-none ${className}`}
      animate={{ opacity: [0.4, 0.7, 0.4], scale: [1, 1.08, 1] }}
      transition={{ duration: 5 + delay, repeat: Infinity, ease: 'easeInOut', delay }}
    />
  );
}

export function LoginPage() {
  const { signInWithUsername, complete2FALogin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 2FA
  const [pending2FA, setPending2FA] = useState<{ profile: UserProfile; linkedEmail: string } | null>(null);
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);

  const handleMemberSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const u = username.trim(), p = password.trim();
    if (!u || !p) { toast.error('يرجى إدخال اسم المستخدم وكلمة المرور.'); return; }
    setLoading(true);
    try {
      const res = await signInWithUsername(u, p);
      if (typeof res === 'object' && res.requires2FA) {
        setPending2FA({ profile: res.profile, linkedEmail: res.linkedEmail });
        toast.info('حسابك محمي بالتحقق الثنائي. يرجى تأكيد الهوية عبر Google.');
        return;
      }
      toast.success('تم تسجيل الدخول بنجاح!');
      navigate('/dashboard');
    } catch (err: any) {
      setErrorMsg(err?.message || 'اسم المستخدم أو كلمة المرور غير صحيحة.');
    } finally { setLoading(false); }
  };

  const handleConfirm2FA = async () => {
    if (!pending2FA) return;
    try {
      await complete2FALogin(pending2FA.profile);
      toast.success('تم التحقق بنجاح!');
      navigate('/dashboard');
    } catch (err: any) {
      setErrorMsg(err?.message || 'فشل التحقق.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row font-sans transition-colors"
      style={{ backgroundColor: 'var(--app-bg)', color: 'var(--text-primary)' }}>

      {/* ── LEFT PANEL — Visual Identity ─────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="hidden lg:flex lg:w-[46%] flex-col justify-between p-12 xl:p-16 relative overflow-hidden mesh-bg"
      >
        {/* Animated ambient orbs */}
        <Orb className="w-96 h-96 -top-20 -right-20 bg-[#6C63FF]/20" delay={0} />
        <Orb className="w-72 h-72 bottom-10 -left-10 bg-[#22D3EE]/12" delay={1.5} />
        <Orb className="w-56 h-56 top-1/2 left-1/3 bg-[#A78BFA]/10" delay={3} />

        {/* Subtle grid */}
        <div className="absolute inset-0 grid-pattern opacity-100" />

        {/* Logo & Brand */}
        <div className="relative z-10">
          <div className="flex items-center gap-3.5">
            <GDGLogo size={42} />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-xl tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  GDG HITU
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: 'rgba(108,99,255,0.15)',
                    color: '#A78BFA',
                    border: '1px solid rgba(108,99,255,0.25)'
                  }}>
                  Platform
                </span>
              </div>
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                Google Developer Group · جامعة HITU
              </span>
            </div>
          </div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 space-y-8">
          {/* Tag */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold"
            style={{
              background: 'rgba(34,211,238,0.08)',
              border: '1px solid rgba(34,211,238,0.18)',
              color: '#67E8F9'
            }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#22D3EE] animate-pulse" />
            منصة المجتمع التقني الرسمية
          </div>

          {/* Headline */}
          <div className="space-y-3">
            <h1 className="text-3xl xl:text-4xl font-black leading-tight" style={{ color: 'var(--text-primary)' }}>
              اصنع،{' '}
              <span className="text-gradient">تعلّم،</span>
              {' '}وأثِّر.
            </h1>
            <p className="text-sm leading-relaxed max-w-xs" style={{ color: 'var(--text-secondary)' }}>
              منظومة متكاملة تجمع إدارة المهام، التعلّم المستمر، والمكافآت في مكان واحد لفريق GDG HITU.
            </p>
          </div>

          {/* Feature grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.08, duration: 0.4 }}
                className="p-3.5 rounded-xl"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <p className="text-xs font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                  {f.title}
                </p>
                <p className="text-[11px] leading-snug" style={{ color: 'var(--text-muted)' }}>
                  {f.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            © 2026 GDG HITU · جامعة حلوان التكنولوجية الدولية
          </span>
          <div className="flex gap-1.5">
            {['#6C63FF','#22D3EE','#F59E0B','#10B981'].map((c) => (
              <span key={c} className="w-2 h-2 rounded-full" style={{ backgroundColor: c, opacity: 0.7 }} />
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── RIGHT PANEL — Login Form ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-10 lg:p-14 relative">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5">
            <GDGLogo size={34} />
            <span className="font-black text-base" style={{ color: 'var(--text-primary)' }}>
              GDG HITU
            </span>
          </div>

          {/* Theme toggle */}
          <div className="mr-auto">
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl transition-all cursor-pointer"
              style={{
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-secondary)',
              }}
              title="تبديل المظهر"
            >
              {theme === 'dark'
                ? <Sun className="h-4 w-4" style={{ color: '#F59E0B' }} />
                : <Moon className="h-4 w-4" style={{ color: '#6C63FF' }} />
              }
            </button>
          </div>
        </div>

        {/* Center container */}
        <div className="w-full max-w-md mx-auto my-auto py-8 space-y-5">

          {/* Error banner */}
          <AnimatePresence>
            {errorMsg && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                className="p-4 rounded-2xl flex items-start gap-3"
                style={{
                  background: 'rgba(244,63,94,0.08)',
                  border: '1px solid rgba(244,63,94,0.2)',
                }}
              >
                <ShieldAlert className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#F43F5E' }} />
                <div className="flex-1 text-xs leading-relaxed" style={{ color: '#FDA4AF' }}>
                  <p className="font-bold mb-0.5" style={{ color: '#F43F5E' }}>تعذر تسجيل الدخول</p>
                  <p>{errorMsg}</p>
                </div>
                <button onClick={() => setErrorMsg(null)}
                  className="text-xs font-bold cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ color: '#F43F5E' }}>✕</button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Header */}
          <div className="text-center sm:text-right">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {pending2FA ? 'التحقق الثنائي' : 'مرحباً بك 👋'}
            </h2>
            <p className="text-sm mt-1.5" style={{ color: 'var(--text-secondary)' }}>
              {pending2FA
                ? 'حسابك محمي بخطوة تحقق إضافية عبر Google'
                : 'سجّل دخولك للوصول إلى منصة GDG HITU'
              }
            </p>
          </div>

          {/* ── 2FA Screen ────────────────────────────────────────────── */}
          <AnimatePresence mode="wait">
            {pending2FA ? (
              <motion.div
                key="2fa"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className="p-6 sm:p-7 rounded-2xl space-y-5 text-center"
                style={{
                  background: 'var(--surface-elevated)',
                  border: '1px solid var(--border-default)',
                  boxShadow: 'var(--shadow-md)',
                }}
              >
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto icon-box-danger">
                  <KeyRound className="h-7 w-7" />
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-base font-black" style={{ color: 'var(--text-primary)' }}>
                    مرحباً، {pending2FA.profile.displayName}
                  </h3>
                  <p className="text-xs leading-relaxed max-w-xs mx-auto" style={{ color: 'var(--text-secondary)' }}>
                    حسابك مُفعَّل عليه التحقق الثنائي. أكّد هويتك بحساب Google المرتبط:
                  </p>
                </div>

                {/* Linked email */}
                <div className="p-3.5 rounded-xl flex items-center justify-between text-right"
                  style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)' }}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center icon-box-success font-bold text-sm">
                      ✓
                    </div>
                    <div>
                      <span className="text-[10px] font-bold block uppercase" style={{ color: 'var(--text-muted)' }}>
                        حساب Google المرتبط
                      </span>
                      <span className="text-xs font-black font-mono" style={{ color: 'var(--text-primary)' }}>
                        {pending2FA.linkedEmail}
                      </span>
                    </div>
                  </div>
                  <span className="badge badge-success text-[10px]">موثق</span>
                </div>

                <div className="space-y-2 pt-1">
                  <Button type="button" onClick={handleConfirm2FA} variant="default" size="lg"
                    className="w-full flex items-center justify-center gap-3 font-black shadow-sm"
                    loading={twoFactorLoading}>
                    <GoogleSVG />
                    تأكيد الهوية عبر Google
                  </Button>
                  <Button type="button" variant="ghost" size="sm"
                    onClick={() => { setPending2FA(null); setErrorMsg(null); }}
                    className="w-full text-xs">
                    <ArrowRight className="h-3.5 w-3.5 ml-1" /> الرجوع وإلغاء تسجيل الدخول
                  </Button>
                </div>
              </motion.div>

            ) : (
              <motion.div
                key="login"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-5"
              >
              <motion.div
                key="login"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-5"
              >
                <form
                  onSubmit={handleMemberSignIn}
                  className="space-y-4"
                >
                  <div>
                    <label className="form-label font-bold text-xs">اسم المستخدم أو البريد الإلكتروني</label>
                    <Input
                      type="text"
                      placeholder="e.g. eltmsah أو admin أو البريد الإلكتروني"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      leftIcon={<User className="h-4 w-4" />}
                      autoFocus
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label font-bold text-xs">كلمة المرور</label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      leftIcon={<Lock className="h-4 w-4" />}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="default"
                    size="lg"
                    className="w-full mt-2 font-bold btn-primary"
                    loading={loading}
                  >
                    تسجيل الدخول للمنصة
                  </Button>
                </form>
              </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Mobile copyright */}
        <div className="lg:hidden text-center text-xs" style={{ color: 'var(--text-muted)' }}>
          © 2026 GDG HITU — Google Developer Group · جامعة حلوان التكنولوجية
        </div>
      </div>
    </div>
  );
}

function GoogleSVG() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}
