import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldAlert, QrCode, Ban, CalendarCheck, Sparkles } from 'lucide-react';
import { AttendanceAdminPage } from '@/pages/AttendanceAdminPage';
import { BansPage } from '@/pages/BansPage';
import { cn } from '@/utils';

export function CompliancePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'bans' ? 'bans' : 'attendance';

  return (
    <div className="space-y-6 max-w-7xl mx-auto dir-rtl text-right font-sans pb-12">
      {/* ─── Creative Header & Hub Title ────────────────────────────────────────── */}
      <div className="card card-glass p-5 sm:p-6 relative overflow-hidden mesh-bg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-cyan-500/15 via-[var(--brand-primary)]/15 to-rose-500/15 border border-[var(--brand-primary)]/30 text-[var(--text-primary)]">
              <Sparkles className="h-3.5 w-3.5 text-cyan-500 animate-pulse" />
              <span>غرفة الرقابة الميدانية والسياسات التنظيمية</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] flex items-center gap-2.5">
              <ShieldAlert className="h-6 w-6 text-[var(--brand-primary)]" />
              <span>مرصد الانضباط والامتثال</span>
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-3xl leading-relaxed">
              المنظومة المركزية لمتابعة التزام الفريق: إدارة جلسات الحضور الذكية عبر رموز QR، ومتابعة سجلات الانضباط، وتطبيق الإجراءات التنظيمية والحظر المؤقت.
            </p>
          </div>

          {/* Segmented Switcher */}
          <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] self-start md:self-center shrink-0">
            <button
              type="button"
              onClick={() => setSearchParams({ tab: 'attendance' })}
              className={cn(
                'px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2',
                activeTab === 'attendance'
                  ? 'bg-[var(--brand-primary)] text-white shadow-md'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]'
              )}
            >
              <QrCode className="h-4 w-4" />
              <span>جلسات الحضور و QR</span>
            </button>

            <button
              type="button"
              onClick={() => setSearchParams({ tab: 'bans' })}
              className={cn(
                'px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2',
                activeTab === 'bans'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]'
              )}
            >
              <Ban className="h-4 w-4" />
              <span>سجل العقوبات والحظر</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── Active Tool View ─────────────────────────────────────────────────── */}
      <div className="transition-all duration-200">
        {activeTab === 'attendance' ? (
          <AttendanceAdminPage />
        ) : (
          <BansPage />
        )}
      </div>
    </div>
  );
}
