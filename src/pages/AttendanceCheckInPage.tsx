import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, getDoc, db } from '@/lib/supabase';
import {
  CheckCircle2,
  QrCode,
  Clock,
  Calendar,
  User,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  MapPin,
  HelpCircle,
  LogIn
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { recordAttendance, ensureUserEmployeeCode } from '@/lib/attendance';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { cn } from '@/utils';
import type { AttendanceSession, AttendanceRecord } from '@/types/attendance';

export function AttendanceCheckInPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const { userProfile, loading: authLoading } = useAuth();

  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const [employeeCode, setEmployeeCode] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [recordedRecord, setRecordedRecord] = useState<AttendanceRecord | null>(null);
  const [alreadyRecorded, setAlreadyRecorded] = useState(false);

  // 1. Fetch Session Details
  useEffect(() => {
    if (!sessionId) {
      setSessionError('الرابط غير صحيح، لم يتم العثور على معرّف الجلسة.');
      setLoadingSession(false);
      return;
    }

    (async () => {
      try {
        const snap = await getDoc(doc(db, 'attendance_sessions', sessionId));
        if (!snap.exists()) {
          setSessionError('جلسة تسجيل الحضور غير موجودة أو تم حذفها.');
          setLoadingSession(false);
          return;
        }

        const sData = { id: snap.id, ...snap.data() } as AttendanceSession;

        if (token && sData.secureToken !== token) {
          setSessionError('رمز التحقق للجلسة غير صالح أو منتهي الصلاحية.');
          setLoadingSession(false);
          return;
        }

        setSession(sData);
      } catch (err: any) {
        setSessionError('تعذر جلب بيانات الجلسة.');
      } finally {
        setLoadingSession(false);
      }
    })();
  }, [sessionId, token]);

  // 2. Check if already checked in
  useEffect(() => {
    if (!sessionId || !userProfile?.uid) return;

    (async () => {
      // Ensure permanent employee code exists
      const code = await ensureUserEmployeeCode(userProfile);
      setEmployeeCode(code);

      try {
        const recordId = `${sessionId}_${userProfile.uid}`;
        const recordSnap = await getDoc(doc(db, 'attendance_records', recordId));
        if (recordSnap.exists()) {
          setAlreadyRecorded(true);
          setRecordedRecord(recordSnap.data() as AttendanceRecord);
        }
      } catch {}
    })();
  }, [sessionId, userProfile]);

  // Handle Check-in
  const handleConfirmAttendance = async () => {
    if (!sessionId || !token || !userProfile) return;

    setSubmitting(true);
    try {
      const res = await recordAttendance({
        sessionId,
        token,
        employee: userProfile,
      });

      setRecordedRecord(res.record);
      setAlreadyRecorded(res.alreadyRecorded);

      if (res.alreadyRecorded) {
        toast.info('تم تسجيل حضورك مسبقاً في هذه الجلسة.');
      } else {
        toast.success('تم تسجيل حضورك بنجاح! مرحباً بك 🚀');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'فشل تسجيل الحضور.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-[#0d081f] text-slate-400 text-xs">
        جاري التحقق من بيانات الجلسة والحساب...
      </div>
    );
  }

  // Not logged in state
  if (!userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-[#0d081f] dir-rtl text-right font-sans">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-3xl p-7 shadow-xl space-y-5 text-center"
        >
          <div className="w-14 h-14 bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] dark:text-[var(--brand-accent)] rounded-2xl flex items-center justify-center mx-auto">
            <LogIn className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">
              تسجيل الدخول لتأكيد الحضور
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              يرجى تسجيل الدخول بحسابك في منصة WorkHub ليتم تسجيل حضورك تلقائياً برقمك التعريفي الفريد.
            </p>
          </div>
          <Link to="/">
            <Button className="w-full btn-primary text-xs py-2.5">
              <span>تسجيل الدخول للمنصة الآن</span>
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  // Error state
  if (sessionError || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-[#0d081f] dir-rtl text-right font-sans">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white dark:bg-[#130d29] border border-slate-200 dark:border-[#281e4b] rounded-3xl p-7 shadow-xl space-y-4 text-center"
        >
          <div className="w-14 h-14 bg-rose-500/10 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white">
              تعذر تسجيل الحضور
            </h1>
            <p className="text-xs text-rose-600 dark:text-rose-400 mt-1.5 leading-relaxed">
              {sessionError || 'الجلسة غير متاحة حالياً.'}
            </p>
          </div>
          <Link to="/dashboard">
            <Button variant="outline" size="sm" className="w-full text-xs">
              الرجوع للوحة التحكم
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  const isClosed = session.status === 'closed' || session.status === 'paused';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-slate-50 to-slate-100 dark:from-[#0d081f] dark:to-[#170e36] dir-rtl text-right font-sans">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white dark:bg-white/[0.03] border border-slate-200/90 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6"
      >
        {/* Header Icon */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] dark:text-[var(--brand-accent)] flex items-center justify-center font-bold">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                نظام الحضور الذكي QR
              </span>
              <span className="text-xs font-black text-slate-800 dark:text-white">
                SAAS WorkHub
              </span>
            </div>
          </div>

          <span
            className={cn(
              'px-2.5 py-0.5 rounded-full text-[10px] font-black border',
              session.status === 'active'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
            )}
          >
            {session.status === 'active' ? '● الجلسة نشطة' : 'الجلسة مغلقة'}
          </span>
        </div>

        {/* Success Screen if Recorded */}
        {recordedRecord ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-6 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-3"
          >
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-base font-black text-emerald-800 dark:text-emerald-300">
                {alreadyRecorded ? 'تم تأكيد حضورك مسبقاً' : 'تم تسجيل حضورك بنجاح!'}
              </h2>
              <p className="text-xs text-emerald-700/80 dark:text-emerald-400 mt-0.5">
                أنت مسجل كـ ({recordedRecord.status === 'late' ? 'حاضر متأخر' : 'حاضر'})
              </p>
            </div>

            <div className="bg-white/80 dark:bg-black/30 rounded-2xl p-3 text-xs space-y-1.5 text-slate-700 dark:text-slate-200 text-right">
              <div className="flex items-center justify-between border-b border-emerald-500/20 pb-1.5">
                <span className="text-slate-400">اسم الموظف:</span>
                <span className="font-bold">{recordedRecord.employeeName}</span>
              </div>
              <div className="flex items-center justify-between border-b border-emerald-500/20 pb-1.5">
                <span className="text-slate-400">كود الحضور:</span>
                <span className="font-mono font-black text-[var(--brand-primary)] dark:text-[var(--brand-accent)]">
                  {recordedRecord.employeeCode}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-emerald-500/20 pb-1.5">
                <span className="text-slate-400">الجلسة:</span>
                <span className="font-bold">{recordedRecord.sessionTitle}</span>
              </div>
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-slate-400">وقت التسجيل:</span>
                <span className="font-mono font-bold">{recordedRecord.checkInTime}</span>
              </div>
            </div>

            <Link to="/my-attendance" className="block pt-2">
              <Button size="sm" className="w-full btn-primary text-xs font-bold">
                <span>عرض سجل حضوري بالكامل</span>
              </Button>
            </Link>
          </motion.div>
        ) : (
          /* Check-in Action Screen */
          <div className="space-y-5">
            {/* Session Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                بيانات جلسة الحضور
              </span>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                {session.title}
              </h2>
              {session.description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {session.description}
                </p>
              )}

              <div className="flex items-center gap-3 pt-2 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200/60 dark:border-white/5">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-[var(--brand-accent)]" />
                  <span>{session.date}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-amber-500" />
                  <span>{session.startTime} - {session.endTime}</span>
                </div>
              </div>
            </div>

            {/* Authenticated Employee Locked Card */}
            <div className="p-4 rounded-2xl bg-[var(--brand-primary)]/5 border border-[var(--brand-primary)]/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[var(--brand-primary)] dark:text-[var(--brand-accent)] uppercase tracking-wider">
                  بيانات حسابك المعتمد
                </span>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> تم التحقق
                </span>
              </div>

              <div className="flex items-center gap-3">
                <Avatar name={userProfile.displayName || userProfile.username || 'User'} src={userProfile.photoURL} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                    {userProfile.displayName}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono">
                    @{userProfile.username || userProfile.email}
                  </p>
                </div>

                <div className="text-left shrink-0 bg-white dark:bg-black/20 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-white/10">
                  <span className="text-[9px] text-slate-400 block font-bold">كود الموظف:</span>
                  <span className="font-mono text-xs font-black text-[var(--brand-primary)] dark:text-[var(--brand-accent)]">
                    {employeeCode || 'GOGA-33001'}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Button */}
            {isClosed ? (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center text-xs text-rose-700 dark:text-rose-400 font-bold">
                عذراً، جلسة تسجيل الحضور هذه مغلقة حالياً أو انتهى وقت التسجيل.
              </div>
            ) : (
              <Button
                onClick={handleConfirmAttendance}
                loading={submitting}
                size="lg"
                className="w-full btn-primary text-sm py-3 font-black cursor-pointer gap-2 border-0"
              >
                <CheckCircle2 className="h-5 w-5" />
                <span>تأكيد وتسجيل الحضور الآن 🎯</span>
              </Button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
