import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CalendarCheck,
  QrCode,
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Award,
  ShieldCheck,
  TrendingUp,
  UserCheck
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { subscribeEmployeeAttendance, ensureUserEmployeeCode } from '@/lib/attendance';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate, cn } from '@/utils';
import type { AttendanceRecord } from '@/types/attendance';

export function MyAttendancePage() {
  const { userProfile } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeeCode, setEmployeeCode] = useState<string>('');

  useEffect(() => {
    if (!userProfile?.uid) return;

    // Ensure employee code
    ensureUserEmployeeCode(userProfile).then((code) => setEmployeeCode(code));

    const unsub = subscribeEmployeeAttendance(userProfile.uid, (list) => {
      setRecords(list);
      setLoading(false);
    });

    return unsub;
  }, [userProfile]);

  const presentCount = records.filter((r) => r.status === 'present').length;
  const lateCount = records.filter((r) => r.status === 'late').length;
  const totalCount = records.length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto dir-rtl text-right font-sans pb-16 animate-fadeIn">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              سجل الحضور والالتزام الشخصي
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[var(--brand-accent)]/15 text-[var(--brand-accent)] border border-[var(--brand-accent)]/30">
              ⚡ Attendance Hub
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
            سجل موثق لجميع فعاليات واجتماعات GDG HITU التي سجلت حضورك بها عبر نظام الباركود QR.
          </p>
        </div>
      </div>

      {/* Employee Digital Badge Card */}
      <div className="card-aurora p-6 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <Avatar
            name={userProfile?.displayName || userProfile?.username || 'User'}
            src={userProfile?.photoURL}
            size="lg"
            className="ring-2 ring-[var(--brand-primary)]/40"
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                {userProfile?.displayName}
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> تم التوثيق
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              @{userProfile?.username || userProfile?.email}
            </p>
          </div>
        </div>

        {/* Permanent Unique Employee Code Display */}
        <div className="card px-5 py-3 rounded-2xl text-center shrink-0 shadow-xs border border-[var(--border-subtle)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            كود العضو الفريد
          </span>
          <span className="font-mono text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-accent)] tracking-wider block mt-0.5">
            {employeeCode || 'HITU-33001'}
          </span>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">إجمالي الجلسات المحضورة</p>
            <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">
              {totalCount}
            </p>
          </div>
          <div className="w-12 h-12 bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] rounded-2xl flex items-center justify-center font-bold">
            <CalendarCheck className="h-6 w-6" />
          </div>
        </div>

        <div className="card p-5 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">حضور في الموعد المحدد</p>
            <p className="text-3xl font-black text-emerald-500 mt-1">
              {presentCount}
            </p>
          </div>
          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center font-bold">
            <CheckCircle2 className="h-6 w-6" />
          </div>
        </div>

        <div className="card p-5 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">حضور متأخر</p>
            <p className="text-3xl font-black text-amber-500 mt-1">
              {lateCount}
            </p>
          </div>
          <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center font-bold">
            <Clock className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Attendance History Timeline */}
      <div className="card p-5 rounded-3xl shadow-xs space-y-4">
        <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Clock className="h-5 w-5 text-[var(--brand-accent)]" />
          <span>سجل حضورك المسجل ({records.length})</span>
        </h2>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            جاري جلب سجل حضورك...
          </div>
        ) : records.length === 0 ? (
          <EmptyState
            icon={<CalendarCheck className="h-10 w-10 text-[var(--brand-accent)]" />}
            title="لا توجد تسجيلات حضور سابقة"
            description="عندما تبدأ جلسة حضور تفاعلية في الاجتماعات، امسح الباركود بهاتفك وسيظهر تأكيد حضورك هنا فوراً."
          />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/5 -mx-5 -mb-5">
            {records.map((r) => (
              <div
                key={r.id}
                className="p-5 flex items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white truncate">
                      {r.sessionTitle}
                    </h3>
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-md text-[10px] font-black border shrink-0',
                        r.status === 'present'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      )}
                    >
                      {r.status === 'present' ? '✓ حاضر' : '⏱ متأخر'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-[var(--brand-accent)]" />
                      {r.date}
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-amber-400" />
                      سُجل في: {r.checkInTime}
                    </span>
                  </div>
                </div>

                <div className="font-mono text-xs font-black text-[var(--brand-primary)] dark:text-[var(--brand-accent)] shrink-0 bg-slate-100 dark:bg-white/5 px-2.5 py-1 rounded-xl border border-white/5">
                  {r.employeeCode}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
