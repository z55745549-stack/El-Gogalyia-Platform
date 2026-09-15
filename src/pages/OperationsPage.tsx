import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart2, CheckSquare, Inbox, Zap, Sparkles } from 'lucide-react';
import { TasksPage } from '@/pages/TasksPage';
import { SubmittedTasksPage } from '@/pages/SubmittedTasksPage';
import { cn } from '@/utils';

export function OperationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'submissions' ? 'submissions' : 'tasks';

  return (
    <div className="space-y-6 max-w-7xl mx-auto dir-rtl text-right font-sans pb-12">
      {/* Creative Header */}
      <div className="card card-glass p-5 sm:p-6 relative overflow-hidden mesh-bg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-[var(--brand-primary)]/15 via-cyan-500/10 to-emerald-500/10 border border-[var(--brand-primary)]/30 text-[var(--text-primary)]">
              <Zap className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
              <span>مركز القيادة الميداني للتكليفات وإنجاز المهام</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] flex items-center gap-2.5">
              <BarChart2 className="h-6 w-6 text-[var(--brand-primary)]" />
              <span>غرفة العمليات والتكليفات</span>
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-3xl leading-relaxed">
              أنشئ التكليفات وأسندها وتابع مستوى إنجازها وراجع التسليمات الواردة واعتمدها أو أعدها — كل ذلك من منظومة تحكم موحدة فائقة الكفاءة.
            </p>
          </div>

          {/* Segmented Switcher */}
          <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] self-start md:self-center shrink-0">
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
              <span>إدارة التكليفات</span>
            </button>

            <button
              type="button"
              onClick={() => setSearchParams({ tab: 'submissions' })}
              className={cn(
                'px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2',
                activeTab === 'submissions'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]'
              )}
            >
              <Inbox className="h-4 w-4" />
              <span>مراجعة التسليمات</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active View */}
      <div className="transition-all duration-200">
        {activeTab === 'tasks' ? (
          <TasksPage />
        ) : (
          <SubmittedTasksPage />
        )}
      </div>
    </div>
  );
}
