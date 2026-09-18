import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { QrCode, Ban, ShieldCheck } from 'lucide-react';
import { AttendanceAdminPage } from '@/pages/AttendanceAdminPage';
import { BansPage } from '@/pages/BansPage';
import { useLanguage } from '@/context/LanguageContext';
import { cn } from '@/utils';

export function CompliancePage() {
  const { t, isRTL } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'bans' ? 'bans' : 'attendance';

  return (
    <div className={cn("space-y-6 max-w-7xl mx-auto font-sans pb-12 animate-fadeIn", isRTL ? "dir-rtl text-right" : "text-left")}>
      {/* Top Management Switcher Bar (Courses & Opportunities Style) */}
      <div className="flex items-center justify-between p-2 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setSearchParams({})}
            className={cn(
              'px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2',
              activeTab === 'attendance'
                ? 'bg-[var(--brand-primary)] text-white shadow-md'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]'
            )}
          >
            <QrCode className="h-4 w-4" />
            <span>{t('compliance.tab_attendance', 'جلسات الحضور و QR')}</span>
          </button>

          <button
            type="button"
            onClick={() => setSearchParams({ tab: 'bans' })}
            className={cn(
              'px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2',
              activeTab === 'bans'
                ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-md'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]'
            )}
          >
            <Ban className="h-4 w-4" />
            <span>{t('compliance.tab_bans', 'سجل الانضباط والحظر')}</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-500 text-[11px] font-black border border-emerald-500/20">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>{t('compliance.management_active', 'صلاحيات الإشراف مفعّلة')}</span>
        </div>
      </div>

      {/* Active Component */}
      <div className="transition-all duration-200">
        {activeTab === 'attendance' ? <AttendanceAdminPage /> : <BansPage />}
      </div>
    </div>
  );
}
