import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { Search, ClipboardList, Shield, Filter } from 'lucide-react';
import { db } from '@/lib/firebase';
import { Avatar } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonTable } from '@/components/ui/skeleton';
import { formatDateTime } from '@/utils';
import type { ActivityLog } from '@/types';

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  'task.created': { label: 'إنشاء مهمة جديدة', color: 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30' },
  'task.updated': { label: 'تعديل بيانات مهمة', color: 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800' },
  'task.deleted': { label: 'حذف / أرشفة مهمة', color: 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30' },
  'task.submitted': { label: 'تسليم عمل من موظف', color: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30' },
  'task.approved': { label: 'اعتماد تسليم ومكافأة كوينز', color: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30' },
  'task.rejected': { label: 'رفض تسليم وإعادة للمراجعة', color: 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30' },
  'task.status_changed': { label: 'تغيير حالة المهمة', color: 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30' },
  'ocoin.awarded': { label: 'منح O Coins', color: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30' },
  'ocoin.manual_add': { label: 'إضافة كوينز يدوية', color: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30' },
  'ocoin.manual_remove': { label: 'خصم كوينز', color: 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30' },
  'ocoin.discount_purchase': { label: 'شراء خصم بكوينز', color: 'text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30' },
  'user.created': { label: 'إضافة مستخدم جديد', color: 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30' },
  'user.role_changed': { label: 'تعديل رتبة المستخدم', color: 'text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30' },
  'user.status_changed': { label: 'تغيير حالة الحساب', color: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30' },
  'user.removed': { label: 'إلغاء تفويض مستخدم', color: 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30' },
  'user.banned': { label: 'حظر وتعليق حساب', color: 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30' },
  'attendance.session_created': { label: 'بدء جلسة حضور QR', color: 'text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/30' },
  'attendance.check_in': { label: 'تسجيل حضور موظف', color: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30' },
};

export function ActivityLogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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

  const filtered = logs.filter((l) =>
    !search ||
    (l.actorName || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.targetName || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.action || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 text-right">
      <div>
        <h1 className="page-title flex items-center gap-2.5">
          <Shield className="h-6 w-6 text-[var(--brand-primary)] dark:text-[var(--brand-accent)]" />
          <span>سجل العمليات والرقابة (Audit Logs)</span>
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
          سجل غير قابل للتعديل يوثق جميع العمليات الإدارية، المالية، وتغييرات الصلاحيات بالنظام.
        </p>
      </div>

      <div className="card p-4 rounded-2xl bg-white dark:bg-[#181820] border border-slate-200 dark:border-[#2A2A35] shadow-xs">
        <Input
          placeholder="ابحث باسم المشرف، الإجراء، أو العنصر المستهدف..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          rightIcon={<Search className="h-4 w-4 text-slate-400" />}
        />
      </div>

      <div className="card overflow-hidden rounded-2xl bg-white dark:bg-[#181820] border border-slate-200 dark:border-[#2A2A35] shadow-xs">
        {loading ? (
          <SkeletonTable rows={8} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-8 w-8 text-slate-400" />}
            title="لا توجد عمليات مسجلة حالياً"
            description="ستظهر جميع أحداث وعمليات النظام الإدارية هنا بالترتيب الزمني."
          />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-[#2A2A35]">
            {filtered.map((log) => {
              const actionMeta = ACTION_LABELS[log.action] || { label: log.action, color: 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800' };
              return (
                <div key={log.id} className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-[#1E1E28]/60 transition-colors">
                  <Avatar src={log.actorPhoto} name={log.actorName || log.actor} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-xs sm:text-sm font-bold text-slate-900 dark:text-[#F7F7FA]">{log.actorName || log.actor}</strong>
                      <span className={`badge text-[10px] font-bold px-2 py-0.5 rounded-lg ${actionMeta.color}`}>
                        {actionMeta.label}
                      </span>
                      {log.targetName && (
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-[#2A2A35] px-2 py-0.5 rounded-lg">
                          {log.targetName}
                        </span>
                      )}
                    </div>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-1.5 bg-slate-50 dark:bg-[#13131A] border border-slate-100 dark:border-[#2A2A35] px-2 py-1 rounded-lg inline-block ltr:text-left">
                        {JSON.stringify(log.metadata)}
                      </p>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0 font-medium">
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
