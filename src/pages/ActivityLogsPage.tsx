import { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, limit, db } from '@/lib/supabase';
import { Search, ClipboardList, Shield, Filter, Download, Users, Crown, Eye, Info, Copy, Check, Calendar, User, Tag } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonTable } from '@/components/ui/skeleton';
import { Modal } from '@/components/ui/modal';
import { toast } from 'sonner';
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
  const { t } = useLanguage();
  const { userProfile } = useAuth();
  const isHighLeadership = userProfile?.role === 'lead' || userProfile?.role === 'co_lead';

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [copied, setCopied] = useState(false);

  // Subscribe to users and tasks for all roles so IDs can be resolved to actual names
  useEffect(() => {
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
  }, []);

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

    // 2. Real-time Supabase snapshot listener with smart deduplication
    const unsub = onSnapshot(
      query(collection(db, 'activityLogs'), orderBy('createdAt', 'desc'), limit(200)),
      (snap) => {
        const remote = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityLog));

        // Deduplication fingerprint to catch duplicate local vs remote or repeated actions
        const getFingerprint = (l: any) => {
          const t = new Date(l.createdAt?.toDate?.() || l.createdAt || 0).getTime();
          // Group timestamps within 15 seconds to collapse duplicate local+remote calls
          const timeBucket = Math.round(t / 15000);
          const act = (l.actorId || l.actor || l.actorName || '').toLowerCase().trim();
          const target = (l.targetId || l.targetName || '').toLowerCase().trim();
          return `${act}__${l.action}__${target}__${timeBucket}`;
        };

        const seenFps = new Set<string>();
        const deduplicated: ActivityLog[] = [];

        // Add remote records first (they are canonical)
        for (const r of remote) {
          const fp = getFingerprint(r);
          if (!seenFps.has(fp)) {
            seenFps.add(fp);
            deduplicated.push(r);
          }
        }

        // Add local-only records that haven't arrived via remote
        for (const l of getLocal()) {
          const fp = getFingerprint(l);
          if (!seenFps.has(fp)) {
            seenFps.add(fp);
            deduplicated.push(l);
          }
        }

        deduplicated.sort((a: any, b: any) => {
          const tA = new Date(a.createdAt?.toDate?.() || a.createdAt || 0).getTime();
          const tB = new Date(b.createdAt?.toDate?.() || b.createdAt || 0).getTime();
          return tB - tA;
        });

        setLogs(deduplicated);
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
      [t('activitylogs.col_time', 'التاريخ والوقت'), t('activitylogs.col_actor', 'القائم بالعملية'), t('activitylogs.col_action', 'نوع الإجراء'), t('activitylogs.col_target', 'الهدف / المستهدف')].join(','),
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

  const usersMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => {
      if (u.uid) map.set(u.uid, u.displayName || u.username);
      if (u.username) map.set(u.username, u.displayName || u.username);
      if (u.email) map.set(u.email, u.displayName || u.username);
    });
    if (userProfile?.uid) map.set(userProfile.uid, userProfile.displayName || userProfile.username);
    return map;
  }, [users, userProfile]);

  const METADATA_KEY_LABELS: Record<string, string> = {
    assignedTo: 'المسند إليه',
    reward: 'المكافأة (O Coins)',
    priority: 'الأولوية',
    deadline: 'الموعد النهائي',
    role: 'الرتبة',
    newRole: 'الرتبة الجديدة',
    status: 'الحالة',
    newStatus: 'الحالة الجديدة',
    committee: 'اللجنة',
    committeeId: 'معرف اللجنة',
    committeeName: 'اسم اللجنة',
    amount: 'المبلغ',
    reason: 'السبب',
    notes: 'ملاحظات',
    location: 'المقر / الرابط',
  };

  const formatMetaValue = (key: string, val: any): string => {
    if (val === null || val === undefined) return '';
    if (Array.isArray(val)) {
      return val.map((item) => usersMap.get(String(item)) || String(item)).join('، ');
    }
    const str = String(val);
    if (usersMap.has(str)) return usersMap.get(str)!;
    if (key === 'priority') {
      if (str === 'high') return 'عاجلة / قصوى';
      if (str === 'medium') return 'متوسطة';
      if (str === 'low') return 'عادية / منخفضة';
    }
    return str;
  };

  const handleCopyLog = (log: ActivityLog) => {
    const text = `سجل عملية: ${ACTION_LABELS[log.action]?.label || log.action}
المسؤول: ${log.actorName || log.actor}
الهدف: ${log.targetName || ''} (${log.targetType})
التاريخ: ${(log as any).createdAt ? formatDateTime((log as any).createdAt) : ''}
المعرف: ${log.id}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('تم نسخ تفاصيل السجل للحافظة');
    setTimeout(() => setCopied(false), 2000);
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
            سجل غير قابل للتعديل يوثق جميع العمليات الإدارية، المالية، وتغييرات الصلاحيات بالنظام. انقر على أي عملية لعرض تفاصيلها.
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
                  onClick={() => setSelectedLog(log)}
                  className="flex items-start gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 sm:py-4 hover:bg-[var(--surface-elevated)]/80 transition-all cursor-pointer group active:scale-[0.998]"
                  title="انقر لعرض كامل تفاصيل العملية"
                >
                  <Avatar src={log.actorPhoto} name={log.actorName || log.actor} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-xs sm:text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--brand-primary)] transition-colors">
                        {log.actorName || log.actor}
                      </strong>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-lg border ${actionMeta.color}`}>
                        {actionMeta.label}
                      </span>
                      {log.targetName && (
                        <span className="text-xs font-semibold text-[var(--text-secondary)] bg-[var(--surface-elevated)] border border-[var(--border-subtle)] px-2 py-0.5 rounded-lg truncate max-w-[200px] sm:max-w-xs">
                          {log.targetName}
                        </span>
                      )}
                    </div>

                    {/* Human-readable metadata chips */}
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {Object.entries(log.metadata).map(([k, v]) => {
                          const label = METADATA_KEY_LABELS[k] || k;
                          const valStr = formatMetaValue(k, v);
                          if (!valStr) return null;
                          return (
                            <span
                              key={k}
                              className="text-[10px] font-medium bg-[var(--surface-elevated)] text-[var(--text-muted)] border border-[var(--border-subtle)] px-2 py-0.5 rounded-md"
                            >
                              <span className="font-bold text-[var(--text-secondary)]">{label}:</span> {valStr}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0 pt-0.5">
                    <p className="text-[11px] text-[var(--text-muted)] font-medium">
                      {(log as any).createdAt ? formatDateTime((log as any).createdAt) : 'الآن'}
                    </p>
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[10px] text-[var(--brand-primary)] font-bold">
                      <Eye className="h-3 w-3" /> التفاصيل
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Log Details Modal */}
      <Modal
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title="تفاصيل العملية المسجلة (Audit Log Details)"
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <button
              onClick={() => selectedLog && handleCopyLog(selectedLog)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--brand-primary)] cursor-pointer"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-[var(--text-muted)]" />}
              <span>{copied ? 'تم النسخ' : 'نسخ البيانات'}</span>
            </button>
            <button
              onClick={() => setSelectedLog(null)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--brand-primary)] text-white hover:opacity-90 cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        }
      >
        {selectedLog && (
          <div className="space-y-5 text-right font-sans">
            {/* Action Badge & Timestamp Banner */}
            <div className="p-3.5 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-3 py-1 rounded-xl border ${ACTION_LABELS[selectedLog.action]?.color || 'text-indigo-600 bg-indigo-500/10 border-indigo-500/20'}`}>
                  {ACTION_LABELS[selectedLog.action]?.label || selectedLog.action}
                </span>
                <span className="text-xs font-mono text-[var(--text-muted)] bg-[var(--surface)] px-2 py-0.5 rounded-md border border-[var(--border-subtle)]">
                  {selectedLog.action}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] font-medium">
                <Calendar className="h-3.5 w-3.5" />
                <span>{(selectedLog as any).createdAt ? formatDateTime((selectedLog as any).createdAt) : 'الآن'}</span>
              </div>
            </div>

            {/* Actor & Target Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Actor Card */}
              <div className="p-3.5 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)]">
                  <User className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
                  <span>المسؤول المنفّذ (Actor)</span>
                </div>
                <div className="flex items-center gap-2.5 pt-1">
                  <Avatar src={selectedLog.actorPhoto} name={selectedLog.actorName || selectedLog.actor} size="md" />
                  <div>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{selectedLog.actorName || selectedLog.actor}</p>
                    <p className="text-[11px] text-[var(--text-muted)] font-mono">{(selectedLog as any).actorId || selectedLog.actor}</p>
                  </div>
                </div>
              </div>

              {/* Target Card */}
              <div className="p-3.5 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)]">
                  <Tag className="h-3.5 w-3.5 text-[var(--brand-accent)]" />
                  <span>الهدف / العنصر المتأثر (Target)</span>
                </div>
                <div className="pt-1">
                  <p className="text-sm font-bold text-[var(--text-primary)]">{selectedLog.targetName || 'غير محدد'}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    نوع العنصر: <span className="font-bold text-[var(--text-secondary)]">{selectedLog.targetType}</span>
                    {selectedLog.targetId && (
                      <span className="font-mono mr-1">({selectedLog.targetId})</span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Human-Readable Metadata Breakdown */}
            {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
              <div className="p-4 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] space-y-2.5">
                <h4 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
                  <span>البيانات المرتبطة بالعملية (Operation Metadata)</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {Object.entries(selectedLog.metadata).map(([k, v]) => {
                    const label = METADATA_KEY_LABELS[k] || k;
                    const val = formatMetaValue(k, v);
                    if (!val) return null;
                    return (
                      <div key={k} className="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)]">
                        <p className="text-[11px] font-bold text-[var(--text-muted)]">{label}</p>
                        <p className="text-xs font-semibold text-[var(--text-primary)] mt-0.5 break-words">{val}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Optional Details */}
            {(selectedLog as any).details && (
              <div className="p-3.5 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] space-y-1">
                <p className="text-xs font-bold text-[var(--text-muted)]">تفاصيل إضافية:</p>
                <p className="text-xs text-[var(--text-primary)] leading-relaxed">{(selectedLog as any).details}</p>
              </div>
            )}

            {/* Footer Audit Signature */}
            <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] font-mono px-1">
              <span>معرف السجل: {selectedLog.id}</span>
              <span className="text-emerald-500 font-bold">✓ موثق ومحمى من التعديل</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
