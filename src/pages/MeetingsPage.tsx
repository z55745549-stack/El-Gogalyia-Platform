import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Clock,
  MapPin,
  Plus,
  Trash2,
  Users,
  ExternalLink,
  Copy,
  Check,
  Video,
  Search,
  ChevronRight,
  Timer,
  CalendarDays,
  Wifi,
  Building2,
  X,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { subscribeMeetings, createMeeting, deleteMeeting, getCountdown } from '@/lib/meetings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonCard } from '@/components/ui/skeleton';
import { formatDate, cn } from '@/utils';
import type { Meeting, MeetingType, MeetingStatus } from '@/types';
import { Timestamp } from '@/lib/supabase';
import { isAdminRole } from '@/utils/permissions';

const TYPE_OPTIONS: { value: MeetingType; label: string }[] = [
  { value: 'general', label: 'اجتماع عام (General)' },
  { value: 'committee', label: 'اجتماع لجنة (Committee)' },
  { value: 'training', label: 'ورشة تدريبية (Training)' },
  { value: 'review', label: 'جلسة مراجعة وتقييم (Review)' },
];

const TYPE_CONFIG: Record<MeetingType, { label: string; color: string; bg: string; icon: string }> = {
  general:   { label: 'اجتماع عام',        color: 'text-violet-600 dark:text-violet-300', bg: 'bg-violet-500/10 border-violet-500/20', icon: '🏛️' },
  training:  { label: 'تدريب وورشة عمل',   color: 'text-amber-600 dark:text-amber-300',  bg: 'bg-amber-500/10 border-amber-500/20',  icon: '🎯' },
  committee: { label: 'اجتماع لجنة',       color: 'text-blue-600 dark:text-blue-300',    bg: 'bg-blue-500/10 border-blue-500/20',    icon: '👥' },
  review:    { label: 'مراجعة وتقييم',     color: 'text-emerald-600 dark:text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: '📊' },
};

const STATUS_CONFIG: Record<MeetingStatus, { label: string; color: string; dot: string }> = {
  scheduled:   { label: 'مجدول',      color: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  in_progress: { label: 'جارٍ الآن', color: 'text-amber-600 dark:text-amber-400',   dot: 'bg-amber-500 animate-pulse' },
  completed:   { label: 'منتهي',      color: 'text-slate-500 dark:text-slate-400',   dot: 'bg-slate-400' },
  cancelled:   { label: 'ملغي',       color: 'text-rose-600 dark:text-rose-400',     dot: 'bg-rose-500' },
};

function isUrl(str: string) {
  return str.startsWith('http://') || str.startsWith('https://') ||
    str.includes('zoom.us') || str.includes('meet.google.com') || str.includes('teams.microsoft.com');
}

// ────────────────────────────────────────────────────────────────────────────────
// Meeting Card Component
// ────────────────────────────────────────────────────────────────────────────────
function MeetingCard({
  meeting,
  isAdmin,
  onView,
  onDelete,
  index,
}: {
  meeting: Meeting;
  isAdmin: boolean;
  onView: (m: Meeting) => void;
  onDelete: (m: Meeting) => void;
  index: number;
}) {
  const typeConf = TYPE_CONFIG[meeting.type] || TYPE_CONFIG.general;
  const statusConf = STATUS_CONFIG[meeting.status] || STATUS_CONFIG.scheduled;
  const countdown = getCountdown(meeting.date, meeting.startTime);
  const hasUrl = isUrl(meeting.location);
  const isCompleted = meeting.status === 'completed';
  const isCancelled = meeting.status === 'cancelled';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3 }}
      className={cn(
        'group relative bg-white dark:bg-[#0f0b22] rounded-2xl border overflow-hidden transition-all duration-300',
        'hover:shadow-lg hover:-translate-y-0.5',
        isCancelled ? 'border-slate-200/60 dark:border-white/5 opacity-60' : 'border-slate-200/80 dark:border-[#1e1840]',
        isCompleted && 'opacity-75'
      )}
    >
      {/* Top color accent bar */}
      <div className={cn(
        'h-1 w-full',
        meeting.type === 'general'   && 'bg-gradient-to-r from-violet-500 to-purple-600',
        meeting.type === 'training'  && 'bg-gradient-to-r from-amber-400 to-orange-500',
        meeting.type === 'committee' && 'bg-gradient-to-r from-blue-500 to-indigo-600',
        meeting.type === 'review'    && 'bg-gradient-to-r from-emerald-500 to-teal-600',
      )} />

      <div className="p-5">
        {/* Header: Type badge + Status */}
        <div className="flex items-center justify-between mb-3">
          <span className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border',
            typeConf.bg, typeConf.color
          )}>
            <span>{typeConf.icon}</span>
            {typeConf.label}
          </span>
          <span className={cn('flex items-center gap-1.5 text-[11px] font-semibold', statusConf.color)}>
            <span className={cn('w-1.5 h-1.5 rounded-full', statusConf.dot)} />
            {statusConf.label}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-extrabold text-slate-900 dark:text-white text-[15px] leading-snug mb-2 line-clamp-2">
          {meeting.title}
        </h3>

        {/* Description */}
        {meeting.description && (
          <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2 mb-4">
            {meeting.description}
          </p>
        )}

        {/* Info rows */}
        <div className="space-y-2 mt-3">
          {/* Date + Countdown */}
          <div className="flex items-center gap-2 text-[12px]">
            <CalendarDays className="h-3.5 w-3.5 text-violet-500 flex-shrink-0" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">{formatDate(meeting.date)}</span>
            {countdown && !isCompleted && !isCancelled && (
              <span className="mr-auto px-2 py-0.5 rounded-md bg-amber-400/20 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-bold flex items-center gap-1">
                <Timer className="h-3 w-3" /> {countdown}
              </span>
            )}
          </div>

          {/* Time */}
          <div className="flex items-center gap-2 text-[12px] text-slate-600 dark:text-slate-400">
            <Clock className="h-3.5 w-3.5 text-pink-500 flex-shrink-0" />
            <span>{meeting.startTime} · المدة {meeting.durationMinutes} دقيقة</span>
          </div>

          {/* Location */}
          <div className="flex items-center gap-2 text-[12px] text-slate-600 dark:text-slate-400">
            {hasUrl
              ? <Wifi className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
              : <Building2 className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
            }
            <span className="truncate max-w-[200px]">{meeting.location}</span>
          </div>

          {/* Organizer */}
          <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500 pt-1">
            <Users className="h-3 w-3 flex-shrink-0" />
            <span>منظَّم بواسطة: {meeting.createdByName || 'إدارة المنصة'}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-4 pt-3.5 border-t border-slate-100 dark:border-white/5">
          <button
            onClick={() => onView(meeting)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors"
          >
            عرض التفاصيل
            <ChevronRight className="h-3.5 w-3.5 opacity-60" />
          </button>

          {hasUrl && !isCancelled && (
            <a
              href={meeting.location.startsWith('http') ? meeting.location : `https://${meeting.location}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 py-2 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 text-xs font-bold transition-colors"
            >
              <Video className="h-3.5 w-3.5" /> دخول
            </a>
          )}

          {isAdmin && (
            <button
              onClick={() => onDelete(meeting)}
              className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-500 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors"
              title="حذف الاجتماع"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Main Page
// ────────────────────────────────────────────────────────────────────────────────
export function MeetingsPage() {
  const { userProfile } = useAuth();
  const isAdmin = userProfile ? isAdminRole(userProfile.role) : false;

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | MeetingStatus>('all');
  const [filterType, setFilterType] = useState<'all' | MeetingType>('all');

  const [showCreate, setShowCreate] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Meeting | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('19:00');
  const [duration, setDuration] = useState('60');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<MeetingType>('general');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const unsub = subscribeMeetings((list) => {
      setMeetings(list);
      setLoading(false);
    });
    return unsub;
  }, []);

  const filteredMeetings = meetings.filter((m) => {
    const matchSearch = !search || m.title.toLowerCase().includes(search.toLowerCase()) ||
      (m.description || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || m.status === filterStatus;
    const matchType = filterType === 'all' || m.type === filterType;
    return matchSearch && matchStatus && matchType;
  });

  // Stats
  const stats = {
    total: meetings.length,
    upcoming: meetings.filter(m => m.status === 'scheduled').length,
    inProgress: meetings.filter(m => m.status === 'in_progress').length,
    completed: meetings.filter(m => m.status === 'completed').length,
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date || !location.trim()) {
      toast.error('يرجى كتابة عنوان الاجتماع، والتاريخ، ومكان / رابط الاجتماع.');
      return;
    }
    setSubmitting(true);
    try {
      const d = new Date(date);
      await createMeeting(
        {
          title: title.trim(),
          description: description.trim(),
          date: Timestamp.fromDate(d) as any,
          startTime,
          durationMinutes: Number(duration) || 60,
          location: location.trim(),
          type,
          status: 'scheduled',
        } as any,
        {
          uid: userProfile?.uid || '',
          email: userProfile?.email || userProfile?.username || '',
          displayName: userProfile?.displayName || 'Admin',
        }
      );
      toast.success('تم جدولة ونشر الاجتماع بنجاح! 📅');
      setTitle(''); setDate(''); setStartTime('19:00'); setDuration('60');
      setLocation(''); setDescription(''); setType('general');
      setShowCreate(false);
    } catch (err) {
      console.error(err);
      toast.error('فشل إنشاء الاجتماع.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !userProfile) return;
    setDeleting(true);
    try {
      await deleteMeeting(deleteTarget.id, deleteTarget.title, {
        email: userProfile.email || userProfile.username || '',
        displayName: userProfile.displayName,
      });
      toast.success('تم حذف الاجتماع بنجاح.');
      if (selectedMeeting?.id === deleteTarget.id) setSelectedMeeting(null);
      setDeleteTarget(null);
    } catch {
      toast.error('فشل حذف الاجتماع.');
    } finally {
      setDeleting(false);
    }
  };

  const handleCopyDetails = (m: Meeting) => {
    const text = `📌 ${m.title}\n📅 ${formatDate(m.date)}\n⏰ ${m.startTime} (${m.durationMinutes} دقيقة)\n📍 ${m.location}\n📝 ${m.description || 'لا يوجد وصف'}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('تم نسخ تفاصيل الاجتماع!');
    setTimeout(() => setCopied(false), 2500);
  };

  const resetFilters = () => {
    setSearch('');
    setFilterStatus('all');
    setFilterType('all');
  };

  const hasActiveFilters = search || filterStatus !== 'all' || filterType !== 'all';

  return (
    <div className="space-y-6 font-sans text-right" dir="rtl">

      {/* ─── Hero Banner ─────────────────────────────────────────────────── */}
      <div className="relative rounded-3xl overflow-hidden shadow-xl">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-violet-700 via-purple-800 to-indigo-900" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(139,92,246,0.4),transparent_60%)]" />
        <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-purple-500/20 blur-3xl" />
        <div className="absolute -left-10 -bottom-10 w-48 h-48 rounded-full bg-indigo-400/20 blur-2xl" />

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 30px, white 30px, white 31px), repeating-linear-gradient(90deg, transparent, transparent 30px, white 30px, white 31px)' }}
        />

        <div className="relative z-10 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
            {/* Left: Text */}
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/80 text-xs font-semibold mb-1">
                <CalendarDays className="h-3.5 w-3.5" />
                مركز الاجتماعات
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {isAdmin ? 'إدارة وجدولة الاجتماعات' : 'اجتماعات ولقاءات الفريق'}
              </h1>
              <p className="text-white/70 text-sm">
                تنسيق موحد للمواعيد والاجتماعات لجميع الفرق واللجان
              </p>
            </div>

            {/* Right: Action button */}
            {isAdmin && (
              <Button
                onClick={() => setShowCreate(true)}
                className="bg-white hover:bg-slate-50 text-violet-800 font-black gap-2 shadow-lg shrink-0 text-sm"
              >
                <Plus className="h-4 w-4" />
                جدولة اجتماع جديد
              </Button>
            )}
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            {[
              { label: 'إجمالي الاجتماعات', value: stats.total, icon: Calendar, color: 'text-white' },
              { label: 'مجدولة وقادمة', value: stats.upcoming, icon: CalendarDays, color: 'text-emerald-300' },
              { label: 'جارية الآن', value: stats.inProgress, icon: Sparkles, color: 'text-amber-300' },
              { label: 'مكتملة', value: stats.completed, icon: Check, color: 'text-blue-300' },
            ].map((s, i) => (
              <div key={i} className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl p-3 text-right">
                <div className={cn('text-2xl font-black', s.color)}>{s.value}</div>
                <div className="text-white/60 text-[11px] font-medium mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Search & Filters ───────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            className="w-full bg-white dark:bg-[#0f0b22] border border-slate-200 dark:border-[#1e1840] rounded-xl py-2.5 pr-10 pl-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
            placeholder="ابحث في الاجتماعات..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as any)}
          className="bg-white dark:bg-[#0f0b22] border border-slate-200 dark:border-[#1e1840] rounded-xl py-2.5 px-3 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
        >
          <option value="all">كل الحالات</option>
          <option value="scheduled">مجدول</option>
          <option value="in_progress">جارٍ الآن</option>
          <option value="completed">منتهي</option>
          <option value="cancelled">ملغي</option>
        </select>

        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value as any)}
          className="bg-white dark:bg-[#0f0b22] border border-slate-200 dark:border-[#1e1840] rounded-xl py-2.5 px-3 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
        >
          <option value="all">كل الأنواع</option>
          <option value="general">اجتماع عام</option>
          <option value="committee">اجتماع لجنة</option>
          <option value="training">تدريب وورشة</option>
          <option value="review">مراجعة وتقييم</option>
        </select>

        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-sm font-semibold border border-rose-200/50 dark:border-rose-900/30 hover:bg-rose-100 transition-colors shrink-0"
          >
            <X className="h-4 w-4" /> مسح
          </button>
        )}
      </div>

      {/* ─── Meetings Grid ───────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : filteredMeetings.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-8 w-8 text-slate-400" />}
          title={hasActiveFilters ? 'لا توجد نتائج مطابقة' : 'لا توجد اجتماعات مجدولة حالياً'}
          description={
            hasActiveFilters
              ? 'جرب تغيير معايير البحث أو الفلترة.'
              : isAdmin
              ? 'ابدأ بإنشاء أول اجتماع ونشره لأعضاء الفريق.'
              : 'لا توجد اجتماعات معلنة حالياً، تفقد هذه الصفحة لاحقاً.'
          }
          action={
            isAdmin && !hasActiveFilters ? (
              <Button onClick={() => setShowCreate(true)} className="font-black gap-2">
                <Plus className="h-4 w-4" /> جدولة اجتماع
              </Button>
            ) : hasActiveFilters ? (
              <Button variant="outline" onClick={resetFilters} className="font-semibold gap-2">
                <X className="h-4 w-4" /> مسح الفلاتر
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {filteredMeetings.length !== meetings.length && (
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
              يُعرض <span className="font-bold text-violet-600 dark:text-violet-400">{filteredMeetings.length}</span> من {meetings.length} اجتماع
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredMeetings.map((m, i) => (
              <MeetingCard
                key={m.id}
                meeting={m}
                isAdmin={isAdmin}
                onView={setSelectedMeeting}
                onDelete={setDeleteTarget}
                index={i}
              />
            ))}
          </div>
        </>
      )}

      {/* ─── Meeting Details Modal ───────────────────────────────────────────── */}
      <Modal
        open={Boolean(selectedMeeting)}
        onClose={() => setSelectedMeeting(null)}
        title="تفاصيل الاجتماع"
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => selectedMeeting && handleCopyDetails(selectedMeeting)}
              className="gap-1.5 text-xs font-bold"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'تم النسخ' : 'نسخ التفاصيل'}
            </Button>

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setSelectedMeeting(null)}>إغلاق</Button>
              {selectedMeeting && isUrl(selectedMeeting.location) && (
                <a
                  href={selectedMeeting.location.startsWith('http') ? selectedMeeting.location : `https://${selectedMeeting.location}`}
                  target="_blank" rel="noopener noreferrer"
                >
                  <Button className="font-black gap-1.5">
                    <Video className="h-4 w-4" /> الانضمام الآن
                  </Button>
                </a>
              )}
            </div>
          </div>
        }
      >
        {selectedMeeting && (() => {
          const typeConf = TYPE_CONFIG[selectedMeeting.type] || TYPE_CONFIG.general;
          const statusConf = STATUS_CONFIG[selectedMeeting.status] || STATUS_CONFIG.scheduled;
          const countdown = getCountdown(selectedMeeting.date, selectedMeeting.startTime);
          const hasUrl = isUrl(selectedMeeting.location);

          return (
            <div className="space-y-4 font-sans text-right" dir="rtl">
              {/* Title + badges */}
              <div className={cn('p-4 rounded-2xl border', typeConf.bg, 'space-y-3')}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className={cn('inline-flex items-center gap-1.5 text-xs font-bold', typeConf.color)}>
                    <span>{typeConf.icon}</span> {typeConf.label}
                  </span>
                  <span className={cn('flex items-center gap-1.5 text-xs font-semibold', statusConf.color)}>
                    <span className={cn('w-1.5 h-1.5 rounded-full', statusConf.dot)} />
                    {statusConf.label}
                  </span>
                </div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white leading-snug">
                  {selectedMeeting.title}
                </h2>
                {countdown && selectedMeeting.status === 'scheduled' && (
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-400/10 rounded-xl px-3 py-2">
                    <Timer className="h-3.5 w-3.5" /> {countdown}
                  </div>
                )}
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Date & Time */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-[#0f0b22] border border-slate-200/80 dark:border-[#1e1840]">
                  <div className="flex items-center gap-2 text-slate-400 text-[11px] font-bold mb-2">
                    <CalendarDays className="h-3.5 w-3.5" /> الموعد والتاريخ
                  </div>
                  <p className="text-sm font-black text-slate-900 dark:text-white">{formatDate(selectedMeeting.date)}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    الساعة {selectedMeeting.startTime} · مدة {selectedMeeting.durationMinutes} دقيقة
                  </p>
                </div>

                {/* Location */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-[#0f0b22] border border-slate-200/80 dark:border-[#1e1840]">
                  <div className="flex items-center gap-2 text-slate-400 text-[11px] font-bold mb-2">
                    {hasUrl ? <Wifi className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
                    {hasUrl ? 'رابط الاجتماع الرقمي' : 'المكان والموقع'}
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{selectedMeeting.location}</p>
                  {hasUrl ? (
                    <a
                      href={selectedMeeting.location.startsWith('http') ? selectedMeeting.location : `https://${selectedMeeting.location}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline inline-flex items-center gap-1 mt-1"
                    >
                      فتح الرابط <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <p className="text-xs text-slate-400 mt-0.5">حضور شخصي بالمقر</p>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">📝 جدول الأعمال والتفاصيل</p>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0f0b22] border border-slate-200/80 dark:border-[#1e1840] text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line min-h-[60px]">
                  {selectedMeeting.description || (
                    <span className="text-slate-400 italic">لم يتم إضافة وصف أو محاور لهذا الاجتماع.</span>
                  )}
                </div>
              </div>

              {/* Organizer */}
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5 text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> منظَّم بواسطة
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {selectedMeeting.createdByName || 'إدارة المنصة'}
                </span>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ─── Create Meeting Modal ─────────────────────────────────────────────── */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="جدولة اجتماع جديد"
        description="سيظهر الاجتماع لجميع أعضاء الفريق فور الحفظ"
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="outline" onClick={() => setShowCreate(false)} disabled={submitting}>إلغاء</Button>
            <Button onClick={handleCreate as any} loading={submitting} className="font-black gap-2">
              <Plus className="h-4 w-4" /> حفظ ونشر الاجتماع
            </Button>
          </div>
        }
      >
        <form onSubmit={handleCreate} className="space-y-4 font-sans text-right" dir="rtl">
          <Input
            label="عنوان وموضوع الاجتماع *"
            placeholder="مثال: الاجتماع الشهري لمناقشة المهام والتقييم"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="تاريخ الاجتماع *" type="date" value={date} onChange={e => setDate(e.target.value)} />
            <Input label="وقت البدء *" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="المدة التقديرية (بالدقائق) *"
              type="number"
              value={duration}
              onChange={e => setDuration(e.target.value)}
            />
            <Select
              label="نوع وتصنيف الاجتماع"
              value={type}
              onChange={e => setType(e.target.value as MeetingType)}
              options={TYPE_OPTIONS}
            />
          </div>

          <Input
            label="المكان أو رابط الاجتماع *"
            placeholder="مثال: https://meet.google.com/xyz أو قاعة الاجتماعات الرئيسية"
            value={location}
            onChange={e => setLocation(e.target.value)}
          />

          <div>
            <label className="form-label">محاور الاجتماع وجدول الأعمال</label>
            <textarea
              className="form-input min-h-[90px]"
              placeholder="اكتب النقاط الرئيسية والأهداف المرجوة من الاجتماع..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {/* Preview */}
          {isUrl(location) && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-900/30 text-xs text-blue-700 dark:text-blue-300">
              <Wifi className="h-4 w-4 shrink-0" />
              <span>سيُضاف رابط الدخول المباشر لجميع الأعضاء</span>
            </div>
          )}
          {date && title && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-900/30 text-xs text-emerald-700 dark:text-emerald-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>سيُرسَل إشعار فوري لجميع الأعضاء النشطين في المنصة</span>
            </div>
          )}
        </form>
      </Modal>

      {/* ─── Delete Confirm ───────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="تأكيد حذف الاجتماع"
        description={`هل أنت متأكد من حذف اجتماع "${deleteTarget?.title}"؟ سيتم إلغاء الموعد من شاشات جميع الأعضاء.`}
        confirmLabel="تأكيد الحذف"
        cancelLabel="إلغاء"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
