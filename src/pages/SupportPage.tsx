import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  db
} from '@/lib/supabase';
import {
  LifeBuoy,
  Plus,
  Search,
  Clock,
  CheckCircle2,
  MessageSquare,
  Sparkles,
  ChevronLeft,
  Send,
  HeadphonesIcon,
  ShieldCheck
} from 'lucide-react';
import { AdminSupportPage } from '@/pages/AdminSupportPage';
import { useAuth } from '@/context/AuthContext';
import { createSupportTicket } from '@/lib/support';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonCard } from '@/components/ui/skeleton';
import { cn } from '@/utils';
import { toast } from 'sonner';
import {
  TICKET_CATEGORY_CONFIG,
  TICKET_STATUS_CONFIG,
  TICKET_PRIORITY_CONFIG
} from '@/types/support';
import type {
  SupportTicket,
  TicketCategory,
  TicketPriority
} from '@/types/support';

// Knowledge Base / FAQ Questions
const FAQS = [
  {
    q: 'كيف أستلم عملات O Coins الخاصة بإنجاز التكليف؟',
    a: 'يتم صرف العملات تلقائياً في محفظتك فور مراجعة المشرف لتسليمك وتغيير حالة التكليف إلى معتمدة.',
    category: 'ocoins'
  },
  {
    q: 'فاتني الموعد النهائي لتسليم المهمة، ماذا أفعل؟',
    a: 'يمكنك تسليم المهمة حتى لو أصبحت متأخرة، أو فتح تذكرة دعم هنا للتواصل مع مشرف اللجنة لتمديد الموعد.',
    category: 'tasks'
  },
  {
    q: 'كيف أقوم بتفعيل التحقق المزدوج (2FA) لحسابي؟',
    a: 'ادخل على الإعدادات والأمان ثم اضغط على زر ربط حساب Google وتفعيل 2FA لحماية حسابك.',
    category: 'account'
  },
  {
    q: 'تم تعليق حسابي مؤقتاً، كيف أستعيده؟',
    a: 'يتم رفع الحظر تلقائياً بانتهاء المدة المحددة. يمكنك فتح تذكرة لتقديم التماس للمشرفين.',
    category: 'account'
  }
];

export function SupportPage() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const canManageTickets = ['lead', 'co_lead', 'head'].includes(userProfile?.role || '');
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'manage' && canManageTickets ? 'manage' : 'my_tickets';
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<TicketCategory>('technical');
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!userProfile?.uid) return;

    const q = query(
      collection(db, 'supportTickets'),
      where('createdBy', '==', userProfile.uid),
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
        console.warn('Supabase tickets query error:', err);
        setLoading(false);
      }
    );

    return unsub;
  }, [userProfile?.uid]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    if (!subject.trim()) {
      toast.error('يرجى كتابة عنوان التذكرة');
      return;
    }
    if (!description.trim()) {
      toast.error('يرجى توضيح تفاصيل المشكلة أو الاستفسار');
      return;
    }

    setSubmitting(true);
    try {
      const ticketId = await createSupportTicket({
        subject,
        category,
        priority,
        description,
        creator: userProfile,
      });

      toast.success('تم إنشاء تذكرة الدعم بنجاح! سيتم الرد عليك قريباً ✨');
      setShowCreateModal(false);
      setSubject('');
      setDescription('');
      setCategory('technical');
      setPriority('medium');
      navigate(`/support/${ticketId}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'فشل إرسال تذكرة الدعم');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTickets = tickets.filter((t) => {
    const matchesSearch =
      t.subject.toLowerCase().includes(search.toLowerCase()) ||
      t.ticketNumber.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const openTicketsCount = tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length;
  const waitingUserCount = tickets.filter((t) => t.status === 'waiting_user').length;
  const resolvedCount = tickets.filter((t) => t.status === 'resolved' || t.status === 'closed').length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto dir-rtl text-right font-sans">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl card card-glass mesh-bg p-6 sm:p-8 shadow-lg border border-[var(--brand-primary)]/30">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full badge-primary text-xs font-bold mb-3">
              <LifeBuoy className="h-4 w-4 text-[var(--brand-accent)]" />
              <span>مركز المساعدة والدعم الفني المباشر · منصة الجوجالية</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--text-primary)]">
              كيف يمكننا مساعدتك اليوم؟
            </h1>
            <p className="text-[var(--text-secondary)] text-xs sm:text-sm mt-1.5 max-w-xl leading-relaxed">
              فريق الإشراف الفني والإداري متاح للإجابة على استفساراتك وحل أي عقبات تقنية أو إدارية تواجهك في المنصة.
            </p>
          </div>

          <Button
            onClick={() => setShowCreateModal(true)}
            size="lg"
            variant="accent"
            className="w-full md:w-auto justify-center cursor-pointer shrink-0 gap-2 border-0 font-black shadow-md shadow-[var(--brand-accent)]/20"
          >
            <Plus className="h-5 w-5" />
            <span>فتح تذكرة دعم جديدة</span>
          </Button>
        </div>

        {/* Ambient shapes */}
        <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-[var(--brand-accent)]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-20 -top-10 w-48 h-48 bg-[var(--brand-primary)]/15 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Admin / Member Switcher for Support Tickets */}
      {canManageTickets && (
        <div className="flex items-center justify-between p-1.5 sm:p-2 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] overflow-hidden">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none snap-x w-full">
            <button
              type="button"
              onClick={() => setSearchParams({})}
              className={cn(
                'snap-start shrink-0 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 active:scale-95',
                activeTab === 'my_tickets'
                  ? 'bg-[var(--brand-primary)] text-white shadow-md'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]'
              )}
            >
              <LifeBuoy className="h-4 w-4" />
              <span>تذاكري واستفساراتي</span>
            </button>

            <button
              type="button"
              onClick={() => setSearchParams({ tab: 'manage' })}
              className={cn(
                'snap-start shrink-0 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 active:scale-95',
                activeTab === 'manage'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]'
              )}
            >
              <HeadphonesIcon className="h-4 w-4" />
              <span>إدارة جميع تذاكر المنصة (مشرف)</span>
            </button>
          </div>

          <div className="items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-500/10 text-blue-500 text-[11px] font-black border border-blue-500/20 hidden lg:flex shrink-0">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>صلاحيات الإشراف مفعّلة</span>
          </div>
        </div>
      )}

      {activeTab === 'manage' && canManageTickets ? (
        <AdminSupportPage />
      ) : (
        <>
      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[var(--text-muted)]">تذاكر قيد المتابعة</p>
            <p className="text-2xl font-black text-[var(--text-primary)] mt-1">{openTicketsCount}</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-[var(--brand-warm)]/15 text-[var(--brand-warm)] flex items-center justify-center font-bold">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        <div className="card p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[var(--text-muted)]">بانتظار ردك وتأكيدك</p>
            <p className="text-2xl font-black text-[var(--brand-primary)] mt-1">{waitingUserCount}</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-[var(--brand-primary)]/15 text-[var(--brand-primary)] flex items-center justify-center font-bold">
            <MessageSquare className="h-5 w-5" />
          </div>
        </div>

        <div className="card p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[var(--text-muted)]">تذاكر محلولة</p>
            <p className="text-2xl font-black text-[var(--brand-success)] mt-1">{resolvedCount}</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-[var(--brand-success)]/15 text-[var(--brand-success)] flex items-center justify-center font-bold">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Quick Knowledge Base / FAQs */}
      <div className="card p-6 rounded-3xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[var(--brand-warm)]" />
            <h2 className="text-base font-black text-[var(--text-primary)]">
              الأسئلة الشائعة وقاعدة المعرفة السريعة
            </h2>
          </div>
          <span className="text-xs text-[var(--text-muted)]">إجابات فورية لأكثر التساؤلات شيوعاً</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FAQS.map((faq, idx) => {
            const isExpanded = activeFaq === idx;
            return (
              <div
                key={idx}
                onClick={() => setActiveFaq(isExpanded ? null : idx)}
                className={cn(
                  'p-4 rounded-2xl border transition-all cursor-pointer text-right',
                  isExpanded
                    ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5'
                    : 'border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)]/60'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-[var(--text-primary)]">
                    {faq.q}
                  </h3>
                </div>
                {isExpanded && (
                  <p className="text-xs text-[var(--text-secondary)] mt-2 leading-relaxed pt-2 border-t border-[var(--border-subtle)]">
                    {faq.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Support Tickets Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-[var(--text-primary)]">سجل تذاكرك ومحادثات الدعم</h2>
            <p className="text-xs text-[var(--text-muted)]">متابعة حالة التذاكر والردود المباشرة من الإشراف</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs bg-[var(--surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] cursor-pointer"
            >
              <option value="all">جميع التصنيفات</option>
              {Object.entries(TICKET_CATEGORY_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>
                  {cfg.label}
                </option>
              ))}
            </select>

            <div className="relative flex-1 sm:w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="ابحث برقم التذكرة أو الموضوع..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pr-9 pl-4 py-2 rounded-xl text-xs bg-[var(--surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
              />
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5 pb-1">
          {[
            { id: 'all', label: 'جميع الحالات' },
            { id: 'open', label: 'مفتوحة' },
            { id: 'in_progress', label: 'قيد المعالجة' },
            { id: 'waiting_user', label: 'بانتظار ردك' },
            { id: 'resolved', label: 'محلولة' },
            { id: 'closed', label: 'مغلقة' },
          ].map((status) => (
            <button
              key={status.id}
              onClick={() => setStatusFilter(status.id)}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95',
                statusFilter === status.id
                  ? 'bg-[var(--brand-primary)] text-white shadow-xs'
                  : 'bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
            >
              {status.label}
            </button>
          ))}
        </div>

        {/* Tickets Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : filteredTickets.length === 0 ? (
          <EmptyState
            icon={<LifeBuoy className="h-10 w-10 text-[var(--text-muted)]" />}
            title="لا توجد تذاكر دعم فني حالياً"
            description="إذا واجهتك أي مشكلة تقنية أو كان لديك استفسار، يمكنك فتح تذكرة جديدة وسيقوم الفريق بمساعدتك."
            action={
              <Button
                onClick={() => setShowCreateModal(true)}
                className="mt-2 btn-primary font-bold text-xs"
              >
                <Plus className="h-4 w-4" />
                فتح تذكرة جديدة
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTickets.map((t) => {
              const statusCfg = TICKET_STATUS_CONFIG[t.status] || TICKET_STATUS_CONFIG.open;
              const priorityCfg = TICKET_PRIORITY_CONFIG[t.priority] || TICKET_PRIORITY_CONFIG.medium;
              const catCfg = TICKET_CATEGORY_CONFIG[t.category] || TICKET_CATEGORY_CONFIG.general;

              return (
                <div
                  key={t.id}
                  onClick={() => navigate(`/support/${t.id}`)}
                  className="card p-5 rounded-2xl hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black text-[var(--brand-primary)]">
                          {t.ticketNumber}
                        </span>
                        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-black border', statusCfg.badgeClass)}>
                          {statusCfg.label}
                        </span>
                      </div>
                      <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-bold border', priorityCfg.badgeClass)}>
                        {priorityCfg.label}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--brand-primary)] transition-colors line-clamp-1">
                        {t.subject}
                      </h3>
                      <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2 leading-relaxed">
                        {t.description}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-accent)]" />
                      <span>{catCfg.label}</span>
                    </div>

                    <div className="flex items-center gap-1 text-[var(--brand-primary)] group-hover:text-[var(--brand-accent)] font-bold group-hover:translate-x-[-3px] transition-transform">
                      <span>عرض المحادثة</span>
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
        </>
      )}

      {/* Modal: Create Support Ticket */}
      <Modal
        open={showCreateModal}
        onClose={() => !submitting && setShowCreateModal(false)}
        title="فتح تذكرة دعم فني أو استفسار جديد"
        description="يرجى كتابة تفاصيل المشكلة بدقة لمساعدة فريق الدعم في سرعة حلها."
        size="lg"
      >
        <form onSubmit={handleCreateTicket} className="space-y-4 font-sans text-right dir-rtl">
          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              عنوان التذكرة أو ملخص المشكلة *
            </label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="مثال: استفسار حول تسليم مهمة التصميم الأسبوعية"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                القسم المعني بالتذكرة
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TicketCategory)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
              >
                <option value="technical">مشكلة تقنية بالنظام</option>
                <option value="tasks">استفسار أو مراجعة تكليف</option>
                <option value="ocoins">رصيد ومكافآت O Coins</option>
                <option value="account">الحساب والأمان</option>
                <option value="affairs">شؤون الأعضاء والطلاب</option>
                <option value="general">استفسار عام</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                درجة الأهمية والأولوية
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
              >
                <option value="low">منخفضة (استفسار عادي)</option>
                <option value="medium">متوسطة (طلب معتاد)</option>
                <option value="high">عالية (تأخير أو مشكلة مؤثرة)</option>
                <option value="urgent">عاجلة جداً (خلل حرج يمنع العمل)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              شرح وتفاصيل المشكلة *
            </label>
            <textarea
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="اكتب شرحاً وافياً عن المشكلة، والخطوات التي قمت بها، وما الذي حدث..."
              className="w-full p-3 rounded-xl text-xs bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] resize-none"
              required
            />
          </div>

          <div className="p-3 rounded-2xl bg-[var(--brand-warm)]/10 border border-[var(--brand-warm)]/20 flex items-start gap-2.5 text-[11px] text-[var(--brand-warm)]">
            <Sparkles className="h-4 w-4 shrink-0 text-[var(--brand-warm)] mt-0.5" />
            <span>
              سيتم إشعار المشرفين تلقائياً بمجرد إرسال التذكرة، وستتلقى تنبيهاً فورياً عند إضافة أي رد.
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCreateModal(false)}
              disabled={submitting}
              className="text-xs"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              loading={submitting}
              variant="primary"
              className="font-bold text-xs gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              <span>إرسال التذكرة الآن</span>
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
