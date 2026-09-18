import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckSquare, Inbox, ShieldCheck } from 'lucide-react';
import { TasksPage } from '@/pages/TasksPage';
import { SubmittedTasksPage } from '@/pages/SubmittedTasksPage';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { cn } from '@/utils';

export function OperationsPage() {
  const { userProfile } = useAuth();
  const { t, isRTL } = useLanguage();
  const isViceHead = userProfile?.role === 'vice_head';
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab');
  const activeTab = tabParam
    ? (tabParam === 'tasks' ? 'tasks' : 'submissions')
    : (isViceHead ? 'submissions' : 'tasks');

  return (
    <div className={cn("space-y-6 max-w-7xl mx-auto font-sans pb-12 animate-fadeIn", isRTL ? "dir-rtl text-right" : "text-left")}>
      {/* Top Management Switcher Bar */}
      <div className="flex items-center justify-between p-2 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Submissions Review Tab */}
          <button
            type="button"
            onClick={() => setSearchParams({ tab: 'submissions' })}
            className={cn(
              'px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2',
              activeTab === 'submissions'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]'
            )}
          >
            <Inbox className="h-4 w-4" />
            <span>
              {isViceHead
                ? t('operations.tab_submissions_vice', 'مراجعة تسليمات أعضاء لجنتي')
                : t('operations.tab_submissions', 'مراجعة تسليمات الأعضاء')}
            </span>
          </button>

          {/* Tasks Tab */}
          <button
            type="button"
            onClick={() => setSearchParams({ tab: 'tasks' })}
            className={cn(
              'px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2',
              activeTab === 'tasks'
                ? 'bg-[var(--brand-primary)] text-white shadow-md'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]'
            )}
          >
            <CheckSquare className="h-4 w-4" />
            <span>
              {isViceHead
                ? t('operations.tab_tasks_vice', 'استعراض مهام اللجنة')
                : t('operations.tab_tasks', 'المهام والتكليفات')}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-500 text-[11px] font-black border border-emerald-500/20">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>
            {isViceHead
              ? t('operations.management_active_vice', 'صلاحيات مراجعة تسليمات اللجنة مفعّلة')
              : t('operations.management_active', 'صلاحيات الإشراف مفعّلة')}
          </span>
        </div>
      </div>

      {/* Active Component */}
      <div className="transition-all duration-200">
        {activeTab === 'tasks' ? <TasksPage /> : <SubmittedTasksPage />}
      </div>
    </div>
  );
}
