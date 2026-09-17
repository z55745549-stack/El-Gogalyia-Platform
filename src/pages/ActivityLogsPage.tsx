import { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, limit, db } from '@/lib/supabase';
import { Search, ClipboardList, Shield, Filter, Download, Users, Crown } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonTable } from '@/components/ui/skeleton';
import { formatDateTime } from '@/utils';
import type { ActivityLog, UserProfile, Task } from '@/types';

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  // Authentication & Join Requests
  'auth.login': { label: 'تسجيل دخول للنظام', color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
  'auth.join_request': { label: 'تقديم طلب انضمام جديد', color: 'text-amber-600 bg-amber-500/10 border-amber-500/20' },
  // Tasks
  'task.created': { label: 'إنشاء مهمة جديدة', color: 'text-blue-600 bg-blue-500/10 border-blue-500/20' },
  'task.updated': { label: 'تعديل بيانات مهمة', color: 'text-indigo-600 bg-indigo-500/10 border-indigo-500/20' },
  'task.deleted': { label: 'حذف / أرشفة مهمة', color: 'text-rose-600 bg-rose-500/10 border-rose-500/20' },
  'task.submitted': { label: 'تسليم عمل من عضو', color: 'text-amber-600 bg-amber-500/10 border-amber-500/20' },
  'task.approved': { label: 'اعتماد تسليم ومكافأة كوينز', color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
  'task.rejected': { label: 'رفض تسليم وإعادة للمراجعة', color: 'text-rose-600 bg-rose-500/10 border-rose-500/20' },
  'task.status_changed': { label: 'تغيير حالة المهمة', color: 'text-blue-600 bg-blue-500/10 border-blue-500/20' },
  // O-Coins
  'ocoin.awarded': { label: 'منح O Coins', color: 'text-amber-600 bg-amber-500/10 border-amber-500/20' },
  'ocoin.manual_add': { label: 'إضافة كوينز يدوية', color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
  'ocoin.manual_remove': { label: 'خصم كوينز', color: 'text-rose-600 bg-rose-500/10 border-rose-500/20' },
  'ocoin.discount_purchase': { label: 'شراء خصم بكوينز', color: 'text-purple-600 bg-purple-500/10 border-purple-500/20' },
  // Users & Members
  'user.created': { label: 'إضافة عضو جديد', color: 'text-blue-600 bg-blue-500/10 border-blue-500/20' },
  'user.approved': { label: 'قبول واعتماد عضو جديد', color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
  'user.rejected': { label: 'رفض طلب انضمام', color: 'text-rose-600 bg-rose-500/10 border-rose-500/20' },
  'user.updated': { label: 'تعديل بيانات العضو', color: 'text-indigo-600 bg-indigo-500/10 border-indigo-500/20' },
  'user.role_changed': { label: 'تعديل رتبة المستخدم', color: 'text-purple-600 bg-purple-500/10 border-purple-500/20' },
  'user.status_changed': { label: 'تغيير حالة الحساب', color: 'text-amber-600 bg-amber-500/10 border-amber-500/20' },
  'user.removed': { label: 'إلغاء تفويض / حذف عضو', color: 'text-rose-600 bg-rose-500/10 border-rose-500/20' },
  'user.banned': { label: 'حظر وتعليق حساب', color: 'text-rose-600 bg-rose-500/10 border-rose-500/20' },
  'user.unbanned': { label: 'رفع الحظر عن حساب', color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
  // Committees & Broadcasts
  'committee.created': { label: 'إنشاء لجنة جديدة', color: 'text-purple-600 bg-purple-500/10 border-purple-500/20' },
  'broadcast.sent': { label: 'إذاعة تنبيه عام للمنظومة', color: 'text-cyan-600 bg-cyan-500/10 border-cyan-500/20' },
  // Attendance
  'attendance.session_created': { label: 'بدء جلسة حضور QR', color: 'text-teal-600 bg-teal-500/10 border-teal-500/20' },
  'attendance.check_in': { label: 'تسجيل حضور موظف', color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
  // Opportunities, Discounts, Courses, Support
  'opportunity.created': { label: 'نشر فرصة جديدة', color: 'text-blue-600 bg-blue-500/10 border-blue-500/20' },
  'discount.created': { label: 'إضافة عرض خصم جديد', color: 'text-purple-600 bg-purple-500/10 border-purple-500/20' },
  'course.created': { label: 'نشر دورة تدريبية جديدة', color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
  'ticket.created': { label: 'فتح تذكرة دعم فني', color: 'text-amber-600 bg-amber-500/10 border-amber-500/20' },
  'ticket.replied': { label: 'رد على تذكرة دعم', color: 'text-indigo-600 bg-indigo-500/10 border-indigo-500/20' },
  'ticket.closed': { label: 'إغلاق تذكرة دعم', color: 'text-slate-600 bg-slate-500/10 border-slate-500/20' },
};

const FILTER_GROUPS = [
  { id: 'all', label: 'جميع العمليات' },
  { id: 'auth', label: 'تسجيل الدخول والطلبات' },
  { id: 'task', label: 'إدارة المهام' },
  { id: 'ocoin', label: 'المعاملات المالية و O Coins' },
  { id: 'user', label: 'المستخدمين والأعضاء' },
  { id: 'attendance', label: 'الحضور والغياب' },
  { id: 'committee', label: 'اللجان والتعميمات' },
];

export function ActivityLogsPage() {
  const { userProfile } = useAuth();
  const isHighLeadership = userProfile?.role === 'lead' || userProfile?.role === 'co_lead';

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // If not high leadership, subscribe to users and tasks to accurately isolate committee members and tasks
  useEffect(() => {
    if (isHighLeadership) return;

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const uList = snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile));
      setUsers(uList);
    });

    const unsubTasks = onSnapshot(collection(db, 'tasks'), (snap) => {
      const tList = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task));
      setTasks(tList);
    });

    return () => {
      unsubUsers();
      unsubTasks();
    };
  }, [isHighLeadership]);

  useEffect(() => {
    // 1. Instant paint from local cache
    const getLocal = (): ActivityLog[] => {
      try {
        return JSON.parse(localStorage.getItem('elgogalyia_activity_logs') || '[]');
      } catch {
        return [];
      }
    };

    const localList = getLocal();
    if (localList.length > 0) {
      setLogs(localList);
      setLoading(false);
    }

    // 2. Real-time Supabase snapshot listener
    const unsub = onSnapshot(
      query(collection(db, 'activityLogs'), orderBy('createdAt', 'desc'), limit(200)),
      (snap) => {
        const remote = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityLog));
        const mergedMap = new Map<string, ActivityLog>();
        // Add remote first
        for (const r of remote) mergedMap.set(r.id, r);
        // Add local
        for (const l of getLocal()) {
          if (!mergedMap.has(l.id)) mergedMap.set(l.id, l);
        }

        const mergedList = Array.from(mergedMap.values()).sort((a: any, b: any) => {
          const tA = new Date(a.createdAt?.toDate?.() || a.createdAt || 0).getTime();
          const tB = new Date(b.createdAt?.toDate?.() || b.createdAt || 0).getTime();
          return tB - tA;
        });

        setLogs(mergedList);
        setLoading(false);
      },
      (err) => {
        console.error('ActivityLogsPage error:', err);
        setLoading(false);
      }
    );

    // 3. Same-tab instant update event listener
    const handleLocalUpdate = () => {
      const updated = getLocal();
      if (updated.length > 0) setLogs(updated);
    };
    window.addEventListener('elgogalyia_activity_logged', handleLocalUpdate);

    return () => {
      unsub();
      window.removeEventListener('elgogalyia_activity_logged', handleLocalUpdate);
    };
  }, []);

  // Map of committee members and tasks for isolation
  const committeeMemberIds = useMemo(() => {
    if (isHighLeadership || !userProfile?.committeeId) return new Set<string>();
    const ids = new Set<string>();
    ids.add(userProfile.uid);
    users.forEach((u) => {
      if (u.committeeId === userProfile.committeeId) {
        ids.add(u.uid);
      }
    });
    return ids;
  }, [isHighLeadership, userProfile, users]);

  const committeeMemberNames = useMemo(() => {
    if (isHighLeadership || !userProfile?.committeeId) return new Set<string>();
    const names = new Set<string>();
    if (userProfile.displayName) names.add(userProfile.displayName.toLowerCase().trim());
    if (userProfile.username) names.add(userProfile.username.toLowerCase().trim());
    users.forEach((u) => {
      if (u.committeeId === userProfile.committeeId) {
        if (u.displayName) names.add(u.displayName.toLowerCase().trim());
        if (u.username) names.add(u.username.toLowerCase().trim());
      }
    });
    return names;
  }, [isHighLeadership, userProfile, users]);

  const committeeTaskIds = useMemo(() => {
    if (isHighLeadership || !userProfile?.committeeId) return new Set<string>();
    const tIds = new Set<string>();
    tasks.forEach((t) => {
      if (t.committeeId === userProfile.committeeId) {
        tIds.add(t.id);
      }
    });
    return tIds;
  }, [isHighLeadership, userProfile, tasks]);

  // 1. Committee Head IDs and Names (used to strictly exclude Head logs from Vice-Head view)
  const committeeHeadIds = useMemo(() => {
    if (!userProfile?.committeeId) return new Set<string>();
    const ids = new Set<string>();
    users.forEach((u) => {
      if (u.committeeId === userProfile.committeeId && u.role === 'head') {
        ids.add(u.uid);
      }
    });
    return ids;
  }, [userProfile, users]);

  const committeeHeadNames = useMemo(() => {
    if (!userProfile?.committeeId) return new Set<string>();
    const names = new Set<string>();
    users.forEach((u) => {
      if (u.committeeId === userProfile.committeeId && u.role === 'head') {
        if (u.displayName) names.add(u.displayName.toLowerCase().trim());
        if (u.username) names.add(u.username.toLowerCase().trim());
      }
    });
    return names;
  }, [userProfile, users]);

  // Scoped logs:
  // - Lead & Co-Lead: see everything across the platform.
  // - Head: sees all activities of his committee members + himself.
  // - Vice-Head: sees himself + committee members, BUT CANNOT see the committee Head's logs.
  // - Member: sees ONLY his own personal activities.
  const scopedLogs = useMemo(() => {
    if (isHighLeadership) return logs;

    const myRole = userProfile?.role;
    const myUid = userProfile?.uid;
    const myName = (userProfile?.displayName || '').toLowerCase().trim();
    const myUsername = (userProfile?.username || '').toLowerCase().trim();

    const isPersonalLog = (l: any) => {
      if (l.actorId === myUid || l.actor === myUid || l.targetId === myUid) return true;
      const actName = (l.actorName || '').toLowerCase().trim();
      const tgtName = (l.targetName || '').toLowerCase().trim();
      if (myName && (actName === myName || tgtName === myName)) return true;
      if (myUsername && (actName === myUsername || tgtName === myUsername)) return true;
      return false;
    };

    const isHeadLog = (l: any) => {
      if (l.actorId && committeeHeadIds.has(l.actorId)) return true;
      if (l.targetId && committeeHeadIds.has(l.targetId)) return true;
      const actName = (l.actorName || '').toLowerCase().trim();
      const tgtName = (l.targetName || '').toLowerCase().trim();
      if (actName && committeeHeadNames.has(actName)) return true;
      if (tgtName && committeeHeadNames.has(tgtName)) return true;
      return false;
    };

    // ── Member (العضو): يشوف سجله فقط وليس الباقي ──
    if (myRole === 'member' || (!['lead', 'co_lead', 'head', 'vice_head'].includes(myRole || ''))) {
      return logs.filter((l: any) => isPersonalLog(l));
    }

    // ── Vice-Head (نائب رئيس اللجنة): يشوف نفسه وأفراد التيم ولكن لا يشوف سجل الهيد ──
    if (myRole === 'vice_head') {
      return logs.filter((l: any) => {
        // If personal to the vice-head (e.g. action done by/on vice-head), show it
        if (isPersonalLog(l)) return true;

        // If it involves the committee Head, strictly EXCLUDE it
        if (isHeadLog(l)) return false;

        // Otherwise show team/committee members activity
        if ((l.actorId && committeeMemberIds.has(l.actorId)) || (l.actor && committeeMemberIds.has(l.actor))) {
          return true;
        }
        if (l.targetId && committeeMemberIds.has(l.targetId)) {
          return true;
        }
        const actName = (l.actorName || '').toLowerCase().trim();
        if (actName && committeeMemberNames.has(actName)) {
          return true;
        }
        const tgtName = (l.targetName || '').toLowerCase().trim();
        if (tgtName && committeeMemberNames.has(tgtName)) {
          return true;
        }
        if (l.targetId && committeeTaskIds.has(l.targetId)) {
          return true;
        }
        if (l.targetType === 'committee' && l.targetId === userProfile?.committeeId) {
          return true;
        }
        if (l.metadata?.committeeId && l.metadata.committeeId === userProfile?.committeeId) {
          return true;
        }

        return false;
      });
    }

    // ── Head (رئيس اللجنة): يشوف كل شيء خاص بأفراد لجنته وبه هو شخصياً ──
    return logs.filter((l: any) => {
      if (isPersonalLog(l)) return true;
      if ((l.actorId && committeeMemberIds.has(l.actorId)) || (l.actor && committeeMemberIds.has(l.actor))) {
        return true;
      }
      if (l.targetId && committeeMemberIds.has(l.targetId)) {
        return true;
      }
      const actName = (l.actorName || '').toLowerCase().trim();
      if (actName && committeeMemberNames.has(actName)) {
        return true;
      }
      const tgtName = (l.targetName || '').toLowerCase().trim();
      if (tgtName && committeeMemberNames.has(tgtName)) {
        return true;
      }
      if (l.targetId && committeeTaskIds.has(l.targetId)) {
        return true;
      }
      if (l.targetType === 'committee' && l.targetId === userProfile?.committeeId) {
        return true;
      }
      if (l.metadata?.committeeId && l.metadata.committeeId === userProfile?.committeeId) {
        return true;
      }

      return false;
    });
  }, [
    logs,
    isHighLeadership,
    userProfile,
    committeeHeadIds,
    committeeHeadNames,
    committeeMemberIds,
    committeeMemberNames,
    committeeTaskIds,
  ]);

  const filtered = scopedLogs.filter((l) => {
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

      {/* Role-Specific Scope Badge */}
      {isHighLeadership ? (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20 text-purple-800 dark:text-purple-200 text-xs font-bold">
          <Crown className="h-4 w-4 text-purple-500 shrink-0" />
          <span>صلاحيات القيادة العليا (Lead / Co-Lead): عرض شامل لجميع سجلات وعمليات المنصة بالكامل لكافة الأفراد واللجان.</span>
        </div>
      ) : userProfile?.role === 'head' ? (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-200 text-xs font-bold">
          <Shield className="h-4 w-4 text-blue-500 shrink-0" />
          <span>صلاحيات رئيس اللجنة (Head): يقتصر العرض على أعضاء لجنتك ({userProfile?.committeeName || 'اللجنة'}) وعملياتك الإدارية والشخصية.</span>
        </div>
      ) : userProfile?.role === 'vice_head' ? (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-teal-500/10 to-emerald-500/10 border border-teal-500/20 text-teal-800 dark:text-teal-200 text-xs font-bold">
          <Users className="h-4 w-4 text-teal-500 shrink-0" />
          <span>صلاحيات نائب رئيس اللجنة (Vice-Head): يقتصر العرض على أفراد الفريق وعملياتك الشخصية (مستثنى منها سجلات رئيس اللجنة).</span>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-slate-500/10 to-sky-500/10 border border-slate-500/20 text-slate-700 dark:text-slate-200 text-xs font-bold">
          <Users className="h-4 w-4 text-sky-500 shrink-0" />
          <span>سجل العمليات الشخصي: يقتصر العرض على العمليات والأنشطة الخاصة بك شخصياً فقط.</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="card p-4 rounded-2xl flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-wrap items-center gap-2 pb-1 sm:pb-0">
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
