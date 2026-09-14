import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Wrench,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  LogIn,
  LogOut,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { isAdminRole } from '@/utils/permissions';

interface MaintenanceScreenProps {
  message?: string;
  onRefresh?: () => void;
}

export function MaintenanceScreen({ message, onRefresh }: MaintenanceScreenProps) {
  const { userProfile, signInWithGoogleAdmin, signOut } = useAuth();
  const [adminSigningIn, setAdminSigningIn] = useState(false);
  const [checking, setChecking] = useState(false);

  const isCurrentAdmin = userProfile ? isAdminRole(userProfile.role) : false;

  const handleAdminLogin = async () => {
    setAdminSigningIn(true);
    try {
      await signInWithGoogleAdmin();
      toast.success('مرحباً بك يا مسؤول! تم تخطي وضع الصيانة بنجاح.');
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || 'فشل تسجيل الدخول كمسؤول.');
    } finally {
      setAdminSigningIn(false);
    }
  };

  const handleManualCheck = () => {
    setChecking(true);
    if (onRefresh) onRefresh();
    setTimeout(() => {
      setChecking(false);
      window.location.reload();
    }, 800);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-[#07070E] text-[#F7F7FA] relative overflow-hidden font-sans dir-rtl text-right select-none mesh-bg">
      {/* Background glowing aurora orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[var(--brand-primary)]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-[var(--brand-accent)]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-xl card card-glass p-6 sm:p-10 text-center flex flex-col items-center"
      >
        {/* Animated Icon Badge */}
        <div className="relative mb-6">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-tr from-[var(--brand-primary)] to-[var(--brand-accent)] p-0.5 flex items-center justify-center shadow-lg shadow-[var(--brand-primary)]/25">
            <div className="w-full h-full bg-[#07070E]/90 rounded-[22px] flex items-center justify-center backdrop-blur-sm">
              <Wrench className="h-10 w-10 sm:h-12 sm:w-12 text-[var(--brand-accent)] animate-spin-slow" />
            </div>
          </div>
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--brand-danger)] opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-[var(--brand-danger)] ring-2 ring-[#07070E]" />
          </span>
        </div>

        {/* Status Tag */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--brand-danger)]/15 border border-[var(--brand-danger)]/30 text-[var(--brand-danger)] text-xs font-black tracking-wider uppercase mb-4">
          <ShieldAlert className="h-4 w-4 text-[var(--brand-danger)]" />
          <span>تنبيه عاجل · وضع الصيانة نشط</span>
        </div>

        {/* Main Required Text */}
        <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] leading-tight mb-3">
          المنصة في وضعية الصيانة الفورية للتحديثات
        </h1>

        <p className="text-base sm:text-lg font-bold text-[var(--brand-accent)] mb-6 leading-relaxed">
          {message || 'المنصة في وضعية الصيانة الفورية للتحديثات , يرجي الانتظار لانتهاء من الصيانة'}
        </p>

        {/* Detail Note */}
        <div className="bg-[var(--bg-elevated)]/60 border border-[var(--border-subtle)] rounded-2xl p-4 sm:p-5 text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed text-right mb-6 w-full space-y-2">
          <div className="flex items-center gap-2 text-[var(--brand-warm)] font-bold">
            <Clock className="h-4 w-4 shrink-0" />
            <span>ماذا يحدث الآن؟</span>
          </div>
          <p className="text-[var(--text-muted)] text-xs sm:text-sm leading-normal">
            يقوم المشرفون والمهندسون بتطبيق تحديثات أمنية وتطويرية فورية لتحسين أداء المنصة وربط الصلاحيات.
            تم إيقاف دخول الموظفين مؤقتاً لضمان سلامة العمليات وعدم فقدان البيانات.
          </p>
          <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <span className="flex items-center gap-1.5 text-[var(--brand-success)]">
              <CheckCircle2 className="h-3.5 w-3.5" /> المزامنة اللحظية مفعلة
            </span>
            <span>ستفتح المنصة تلقائياً فور انتهاء الصيانة</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
          <button
            onClick={handleManualCheck}
            disabled={checking}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[var(--bg-elevated)] hover:brightness-125 active:scale-95 border border-[var(--border-subtle)] text-xs sm:text-sm font-bold text-[var(--text-primary)] flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin text-[var(--brand-accent)]' : ''}`} />
            <span>{checking ? 'جاري التحقق...' : 'إعادة فحص الحالة الآن'}</span>
          </button>

          {/* Admin bypass button if user is not logged in as admin */}
          {!isCurrentAdmin && (
            <button
              onClick={handleAdminLogin}
              disabled={adminSigningIn}
              className="w-full sm:w-auto px-6 py-3 rounded-xl btn-primary active:scale-95 text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {adminSigningIn ? (
                <LoadingSpinner size="sm" />
              ) : (
                <LogIn className="h-4 w-4 text-[var(--brand-accent)]" />
              )}
              <span>دخول المشرفين (Admin Portal)</span>
            </button>
          )}

          {/* If employee is currently logged in, give option to sign out */}
          {userProfile && (
            <button
              onClick={() => signOut()}
              className="w-full sm:w-auto px-4 py-3 rounded-xl hover:bg-[var(--brand-danger)]/15 border border-transparent hover:border-[var(--brand-danger)]/30 text-xs sm:text-sm font-bold text-[var(--brand-danger)] flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>تسجيل الخروج</span>
            </button>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-8 text-[11px] text-[var(--text-muted)] flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-[var(--brand-accent)]" />
          <span>منظومة العمل الطلابية الذكية · GDG HITU Platform</span>
        </div>
      </motion.div>
    </div>
  );
}
