import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  getDocs,
  where,
  db
} from '@/lib/supabase';
import {
  LifeBuoy,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  UserCheck,
  ChevronLeft,
  ArrowUpDown,
  MessageSquare,
  Shield,
  Send,
  Lock,
  Layers,
  Sparkles
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonCard } from '@/components/ui/skeleton';
import { formatRelative, cn } from '@/utils';
import {
  TICKET_CATEGORY_CONFIG,
  TICKET_STATUS_CONFIG,
  TICKET_PRIORITY_CONFIG
} from '@/types/support';
import type {
  SupportTicket,
  TicketStatus,
  TicketCategory,
  TicketPriority
} from '@/types/support';

export function AdminSupportPage() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'unassigned' | 'mine'>('all');

  useEffect(() => {
    const q = query(
      collection(db, 'supportTickets'),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as SupportTicket));
        setTickets(list);
        setLoading(false);
      },
      (err) => {
        console.warn('Admin tickets snapshot error:', err);
        setLoading(false);
      }
    );

    return unsub;
  }, []);

  const openCount = tickets.filter((t) => t.status === 'open').length;
  const inProgressCount = tickets.filter((t) => t.status === 'in_progress').length;
  const urgentCount = tickets.filter((t) => t.priority === 'urgent' && t.status !== 'closed' && t.status !== 'resolved').length;
  const resolvedCount = tickets.filter((t) => t.status === 'resolved' || t.status === 'closed').length;

  const filteredTickets = tickets.filter((t) => {
    const matchesSearch =
      t.subject.toLowerCase().includes(search.toLowerCase()) ||
      t.ticketNumber.toLowerCase().includes(search.toLowerCase()) ||
      t.creatorName.toLowerCase().includes(search.toLowerCase()) ||
      t.creatorEmail.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
    const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;

    let matchesAssignment = true;
    if (assignmentFilter === 'unassigned') matchesAssignment = !t.assignedToAdminId;
    if (assignmentFilter === 'mine') matchesAssignment = t.assignedToAdminId === userProfile?.uid;

    return matchesSearch && matchesStatus && matchesCategory && matchesPriority && matchesAssignment;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto dir-rtl text-right font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="page-title text-2xl font-black text-slate-900 dark:text-white">
              مركز إدارة الدعم الفني وتذاكر الموظفين
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] dark:text-[var(--brand-accent)] border border-[var(--brand-primary)]/20">
              {tickets.length} تذكرة إجمالاً
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
            صندوق الوارد الموحد لمتابعة استفسارات ومشاكل فريق العمل والطلاب وحلها في أسرع وقت.
          </p>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card p-5 rounded-2xl bg-white dark:bg-[#130d29] border border-slate-200/90 dark:border-[#281e4b] flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">تذاكر جديدة ومفتوحة</p>
            <p className="text-2xl font-black text-[#FF3483] mt-1">{openCount}</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-[#FF3483]/10 text-[#FF3483] flex items-center justify-center font-bold">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>

        <div className="card p-5 rounded-2xl bg-white dark:bg-[#130d29] border border-slate-200/90 dark:border-[#281e4b] flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">قيد المتابعة والمعالجة</p>
            <p className="text-2xl font-black text-amber-600 dark:text-[#FFCF00] mt-1">{inProgressCount}</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-[#FFCF00]/15 text-[#FFCF00] flex items-center justify-center font-bold">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        <div className="card p-5 rounded-2xl bg-white dark:bg-[#130d29] border border-slate-200/90 dark:border-[#281e4b] flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">عالية الأهمية / عاجلة</p>
            <p className="text-2xl font-black text-rose-600 mt-1">{urgentCount}</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center font-bold">
            <Shield className="h-5 w-5" />
          </div>
        </div>

        <div className="card p-5 rounded-2xl bg-white dark:bg-[#130d29] border border-slate-200/90 dark:border-[#281e4b] flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">تم الحل والإغلاق</p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{resolvedCount}</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 flex items-center justify-center font-bold">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-4 rounded-2xl bg-white dark:bg-[#130d29] border border-slate-200/90 dark:border-[#281e4b] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="بحث برقم التذكرة، العنوان، اسم أو بريد صاحب التذكرة..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-9 pl-4 py-2 rounded-xl text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[var(--foreground)] focus:outline-hidden"
          >
            <option value="all">كافة الحالات</option>
            <option value="open">مفتوحة فقط</option>
            <option value="in_progress">قيد المتابعة</option>
            <option value="waiting_user">بانتظار رد الموظف</option>
            <option value="resolved">محلولة</option>
            <option value="closed">مغلقة</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[var(--foreground)] focus:outline-hidden"
          >
            <option value="all">جميع الأقسام</option>
            <option value="technical">مشاكل تقنية</option>
            <option value="tasks">استفسارات المهام</option>
            <option value="ocoins">رصيد O Coins</option>
            <option value="account">الحساب والأمان</option>
            <option value="affairs">شؤون الطلاب</option>
            <option value="general">عام</option>
          </select>

          {/* Assignment Filter */}
          <select
            value={assignmentFilter}
            onChange={(e) => setAssignmentFilter(e.target.value as any)}
            className="px-3 py-2 rounded-xl text-xs bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[var(--foreground)] focus:outline-hidden"
          >
            <option value="all">جميع التكليفات</option>
            <option value="unassigned">غير مسندة لمشرف</option>
            <option value="mine">مسندة لي</option>
          </select>
        </div>
      </div>

      {/* Tickets Table / List */}
      <div className="card rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-8">
            <SkeletonCard />
          </div>
        ) : filteredTickets.length === 0 ? (
          <EmptyState
            icon={<LifeBuoy className="h-10 w-10 text-slate-400" />}
            title="لا توجد تذاكر تطابق معايير البحث الحالية"
            description="يمكنك تعديل خيارات الفلترة أو إفراغ خانة البحث لعرض كافة التذاكر."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50/75 dark:bg-white/[0.02] border-b border-slate-200/80 dark:border-[#281e4b] text-slate-500 font-bold">
                <tr>
                  <th className="py-3.5 px-4">رقم التذكرة والموضوع</th>
                  <th className="py-3.5 px-4">صاحب التذكرة</th>
                  <th className="py-3.5 px-4">القسم</th>
                  <th className="py-3.5 px-4">الأولوية</th>
                  <th className="py-3.5 px-4">الحالة</th>
                  <th className="py-3.5 px-4">المشرف المكلف</th>
                  <th className="py-3.5 px-4">آخر نشاط</th>
                  <th className="py-3.5 px-4 text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#241a49]">
                {filteredTickets.map((t) => {
                  const statusCfg = TICKET_STATUS_CONFIG[t.status] || TICKET_STATUS_CONFIG.open;
                  const priorityCfg = TICKET_PRIORITY_CONFIG[t.priority] || TICKET_PRIORITY_CONFIG.medium;
                  const catCfg = TICKET_CATEGORY_CONFIG[t.category] || TICKET_CATEGORY_CONFIG.general;

                  return (
                    <tr
                      key={t.id}
                      onClick={() => navigate(`/support/${t.id}`)}
                      className="hover:bg-slate-50/80 dark:hover:bg-white/[0.03] transition-colors cursor-pointer group"
                    >
                      <td className="py-4 px-4 font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[var(--brand-primary)] dark:text-[var(--brand-accent)]">
                            {t.ticketNumber}
                          </span>
                          <span className="line-clamp-1 group-hover:text-[var(--brand-primary)] dark:group-hover:text-[var(--brand-accent)] transition-colors">
                            {t.subject}
                          </span>
                        </div>
                      </td>

                      <td className="py-4 px-4 text-slate-600 dark:text-slate-300">
                        <div>
                          <p className="font-bold">{t.creatorName}</p>
                          <p className="text-[10px] text-slate-400">{t.creatorEmail}</p>
                        </div>
                      </td>

                      <td className="py-4 px-4 text-slate-600 dark:text-slate-300">
                        {catCfg.label}
                      </td>

                      <td className="py-4 px-4">
                        <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-bold border', priorityCfg.badgeClass)}>
                          {priorityCfg.label}
                        </span>
                      </td>

                      <td className="py-4 px-4">
                        <span className={cn('px-2.5 py-0.5 rounded-full text-[10px] font-black border', statusCfg.badgeClass)}>
                          {statusCfg.label}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-slate-600 dark:text-slate-300">
                        {t.assignedToAdminName ? (
                          <span className="font-bold text-[var(--brand-primary)] dark:text-[var(--brand-accent)]">
                            {t.assignedToAdminName}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">
                            لم يتم التكليف بعد
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-[11px] text-slate-400 font-medium">
                        {t.lastActivityAt ? formatRelative(t.lastActivityAt) : formatRelative(t.createdAt)}
                      </td>

                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center gap-1 text-[var(--brand-primary)] dark:text-[var(--brand-accent)] font-bold group-hover:translate-x-[-3px] transition-transform">
                          <span>فتح التذكرة</span>
                          <ChevronLeft className="h-4 w-4" />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
