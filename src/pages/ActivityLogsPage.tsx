import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, limit, db } from '@/lib/supabase';
import { Search, ClipboardList, Shield, Filter, Download } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonTable } from '@/components/ui/skeleton';
import { formatDateTime } from '@/utils';
import type { ActivityLog } from '@/types';

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  'task.created': { label: 'إنشاء مهمة جديدة', color: 'text-blue-600 bg-blue-500/10 border-blue-500/20' },
  'task.updated': { label: 'تعديل بيانات مهمة', color: 'text-indigo-600 bg-indigo-500/10 border-indigo-500/20' },
  'task.deleted': { label: 'حذف / أرشفة مهمة', color: 'text-rose-600 bg-rose-500/10 border-rose-500/20' },
  'task.submitted': { label: 'تسليم عمل من موظف', color: 'text-amber-600 bg-amber-500/10 border-amber-500/20' },
  'task.approved': { label: 'اعتماد تسليم ومكافأة كوينز', color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
  'task.rejected': { label: 'رفض تسليم وإعادة للمراجعة', color: 'text-rose-600 bg-rose-500/10 border-rose-500/20' },
  'task.status_changed': { label: 'تغيير حالة المهمة', color: 'text-blue-600 bg-blue-500/10 border-blue-500/20' },
  'ocoin.awarded': { label: 'منح O Coins', color: 'text-amber-600 bg-amber-500/10 border-amber-500/20' },
  'ocoin.manual_add': { label: 'إضافة كوينز يدوية', color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
  'ocoin.manual_remove': { label: 'خصم كوينز', color: 'text-rose-600 bg-rose-500/10 border-rose-500/20' },
  'ocoin.discount_purchase': { label: 'شراء خصم بكوينز', color: 'text-purple-600 bg-purple-500/10 border-purple-500/20' },
  'user.created': { label: 'إضافة مستخدم جديد', color: 'text-blue-600 bg-blue-500/10 border-blue-500/20' },
  'user.role_changed': { label: 'تعديل رتبة المستخدم', color: 'text-purple-600 bg-purple-500/10 border-purple-500/20' },
  'user.status_changed': { label: 'تغيير حالة الحساب', color: 'text-amber-600 bg-amber-500/10 border-amber-500/20' },
  'user.removed': { label: 'إلغاء تفويض مستخدم', color: 'text-rose-600 bg-rose-500/10 border-rose-500/20' },
  'user.banned': { label: 'حظر وتعليق حساب', color: 'text-rose-600 bg-rose-500/10 border-rose-500/20' },
  'attendance.session_created': { label: 'بدء جلسة حضور QR', color: 'text-teal-600 bg-teal-500/10 border-teal-500/20' },
  'attendance.check_in': { label: 'تسجيل حضور موظف', color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
};

const FILTER_GROUPS = [
  { id: 'all', label: 'جميع العمليات' },
  { id: 'task', label: 'إدارة المهام' },
  { id: 'ocoin', label: 'المعاملات المالية و O Coins' },
  { id: 'user', label: 'المستخدمين والصلاحيات' },
  { id: 'attendance', label: 'الحضور والغياب' },
];

export function ActivityLogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'activityLogs'), orderBy('createdAt', 'desc'), limit(200)),
      (snap) => {
        setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityLog)));
        setLoading(false);
      },
      (err) => {
        console.error('ActivityLogsPage error:', err);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  const filtered = logs.filter((l) => {
    const matchesSearch =
      !search ||
      (l.actorName || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.targetName || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.action || '').toLowerCase().includes(search.toLowerCase());

    const matchesType =
      typeFilter === 'all' || (l.action && l.action.startsWith(typeFilter));

    return matchesSearch && matchesType;
  });

  const exportLogs = () => {
    const csvContent = [
      ['التاريخ والوقت', 'المسؤول', 'الإجراء', 'الهدف'].join(','),
      ...filtered.map((l) =>
        [
          `"${(l as any).createdAt ? formatDateTime((l as any).createdAt) : ''}"`,
          `"${l.actorName || l.actor || ''}"`,
          `"${ACTION_LABELS[l.action]?.label || l.action}"`,
          `"${l.targetName || ''}"`,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 text-right">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2.5">
            <Shield className="h-6 w-6 text-[var(--brand-primary)]" />
            <span className="text-[var(--text-primary)]">سجل العمليات والرقابة (Audit Logs)</span>
          </h1>
          <p className="text-xs sm:text-sm mt-1 text-[var(--text-muted)]">
            سجل غير قابل للتعديل يوثق جميع العمليات الإدارية، المالية، وتغييرات الصلاحيات بالنظام.
          </p>
        </div>

        <button
          onClick={exportLogs}
          disabled={filtered.length === 0}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--brand-primary)] cursor-pointer self-start sm:self-auto disabled:opacity-50"
        >
          <Download className="h-4 w-4 text-[var(--brand-primary)]" />
          <span>تصدير CSV ({filtered.length})</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-4 rounded-2xl flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
          <Filter className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
          {FILTER_GROUPS.map((grp) => (
            <button
              key={grp.id}
              onClick={() => setTypeFilter(grp.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                typeFilter === grp.id
                  ? 'bg-[var(--brand-primary)] text-white shadow-xs'
                  : 'bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {grp.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="ابحث باسم المشرف أو الإجراء..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-9 pl-4 py-2 rounded-xl text-xs bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
          />
        </div>
      </div>

      {/* Logs Table Card */}
      <div className="card overflow-hidden rounded-2xl">
        {loading ? (
          <SkeletonTable rows={8} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-8 w-8 text-[var(--text-muted)]" />}
            title="لا توجد عمليات مسجلة حالياً"
            description="ستظهر جميع أحداث وعمليات النظام الإدارية هنا بالترتيب الزمني."
          />
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {filtered.map((log) => {
              const actionMeta = ACTION_LABELS[log.action] || {
                label: log.action,
                color: 'text-[var(--text-secondary)] bg-[var(--surface-elevated)] border-[var(--border-subtle)]',
              };
              return (
                <div
                  key={log.id}
                  className="flex items-start gap-4 px-5 py-4 hover:bg-[var(--surface-elevated)]/60 transition-colors"
                >
                  <Avatar src={log.actorPhoto} name={log.actorName || log.actor} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">
                        {log.actorName || log.actor}
                      </strong>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-lg border ${actionMeta.color}`}>
                        {actionMeta.label}
                      </span>
                      {log.targetName && (
                        <span className="text-xs font-semibold text-[var(--text-secondary)] bg-[var(--surface-elevated)] border border-[var(--border-subtle)] px-2 py-0.5 rounded-lg">
                          {log.targetName}
                        </span>
                      )}
                    </div>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {Object.entries(log.metadata).map(([k, v]) => (
                          <span
                            key={k}
                            className="text-[10px] font-mono bg-[var(--surface-elevated)] text-[var(--text-muted)] border border-[var(--border-subtle)] px-2 py-0.5 rounded-md"
                          >
                            <span className="font-semibold text-[var(--text-secondary)]">{k}:</span> {String(v)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] shrink-0 font-medium pt-1">
                    {(log as any).createdAt ? formatDateTime((log as any).createdAt) : 'الآن'}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
