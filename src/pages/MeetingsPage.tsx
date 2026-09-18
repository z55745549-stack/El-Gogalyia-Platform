import { useState, useEffect } from 'react';
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
  CalendarCheck,
  Radio,
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
import { useLanguage } from '@/context/LanguageContext';

const TYPE_OPTIONS: { value: MeetingType; label: string }[] = [
  { value: 'general', label: 'اجتماع عام (General)' },
  { value: 'committee', label: 'اجتماع لجنة (Committee)' },
  { value: 'training', label: 'ورشة تدريبية (Training)' },
  { value: 'review', label: 'جلسة مراجعة وتقييم (Review)' },
];

const TYPE_CONFIG: Record<MeetingType, { label: string; color: string; bg: string; icon: string; border: string }> = {
  general:   { label: 'اجتماع عام',        color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/25', icon: '🏛️' },
  training:  { label: 'تدريب وورشة عمل',   color: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/25',  icon: '🎯' },
  committee: { label: 'اجتماع لجنة',       color: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-500/10',   border: 'border-blue-500/25',   icon: '👥' },
  review:    { label: 'مراجعة وتقييم',     color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', icon: '📊' },
};

const STATUS_CONFIG: Record<MeetingStatus, { label: string; color: string; dot: string }> = {
  scheduled:   { label: 'مجدول وقادم', color: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  in_progress: { label: 'جارٍ الآن',   color: 'text-amber-600 dark:text-amber-400',     dot: 'bg-amber-500 animate-pulse' },
  completed:   { label: 'منتهي',        color: 'text-[var(--text-muted)]',               dot: 'bg-slate-400' },
  cancelled:   { label: 'ملغي',         color: 'text-rose-600 dark:text-rose-400',       dot: 'bg-rose-500' },
};

function isUrl(str: string) {
  if (!str) return false;
  return (
    str.startsWith('http://') ||
    str.startsWith('https://') ||
    str.includes('zoom.us') ||
    str.includes('meet.google.com') ||
    str.includes('teams.microsoft.com')
  );
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
  const { t, language } = useLanguage();
  const typeConf = TYPE_CONFIG[meeting.type] || TYPE_CONFIG.general;
  const statusConf = STATUS_CONFIG[meeting.status] || STATUS_CONFIG.scheduled;
  const countdown = getCountdown(meeting.date, meeting.startTime);
  const hasUrl = isUrl(meeting.location);
  const isCompleted = meeting.status === 'completed';
  const isCancelled = meeting.status === 'cancelled';
  const isInProgress = meeting.status === 'in_progress';

  const typeLabel = language === 'en'
    ? (meeting.type === 'general' ? 'General Meeting' : meeting.type === 'training' ? 'Training Workshop' : meeting.type === 'committee' ? 'Committee Meeting' : 'Review & Evaluation')
    : typeConf.label;

  const statusLabel = language === 'en'
    ? (meeting.status === 'scheduled' ? 'Scheduled' : meeting.status === 'in_progress' ? 'In Progress' : meeting.status === 'completed' ? 'Completed' : 'Cancelled')
    : statusConf.label;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.3), duration: 0.25 }}
      className={cn(
        'group relative rounded-2xl border transition-all duration-300 flex flex-col justify-between overflow-hidden',
        'bg-[var(--surface)] border-[var(--border-subtle)] hover:border-[var(--brand-primary)]/40 hover:shadow-lg',
        isCancelled && 'opacity-60 grayscale-[40%]',
        isCompleted && 'opacity-80'
      )}
    >
      {/* Top Subtle Accent Strip */}
      <div
        className={cn(
          'h-1 w-full',
          meeting.type === 'general'   && 'bg-indigo-500',
          meeting.type === 'training'  && 'bg-amber-500',
          meeting.type === 'committee' && 'bg-blue-500',
          meeting.type === 'review'    && 'bg-emerald-500'
        )}
      />

      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Header Badges: Type & Status */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border',
                typeConf.bg,
                typeConf.color,
                typeConf.border
              )}
            >
              <span>{typeConf.icon}</span>
              {typeLabel}
            </span>

            <span className={cn('flex items-center gap-1.5 text-xs font-bold', statusConf.color)}>
              <span className={cn('w-2 h-2 rounded-full', statusConf.dot)} />
              {statusLabel}
            </span>
          </div>

          {/* Title */}
          <h3 className="font-black text-[var(--text-primary)] text-base leading-snug mb-2 line-clamp-2">
            {meeting.title}
          </h3>

          {/* Description */}
          {meeting.description && (
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-2 mb-4">
              {meeting.description}
            </p>
          )}

          {/* Key Meeting Metadata */}
          <div className="space-y-2.5 mt-3 pt-3 border-t border-[var(--border-subtle)]/60 text-xs">
            {/* Date & Countdown */}
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-indigo-500 shrink-0" />
              <span className="font-bold text-[var(--text-primary)]">{formatDate(meeting.date, language)}</span>
              {countdown && !isCompleted && !isCancelled && (
                <span className="mr-auto px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[11px] font-black flex items-center gap-1">
                  <Timer className="h-3 w-3" /> {countdown}
                </span>
              )}
            </div>

            {/* Time */}
            <div className="flex items-center gap-2 text-[var(--text-secondary)]">
              <Clock className="h-4 w-4 text-[var(--brand-primary)] shrink-0" />
              <span>
                {language === 'en' ? 'Time ' : 'الساعة '}
                <strong className="text-[var(--text-primary)] font-bold">{meeting.startTime}</strong>
                {language === 'en' ? ` · Duration ${meeting.durationMinutes} mins` : ` · المدة ${meeting.durationMinutes} دقيقة`}
              </span>
            </div>

            {/* Location */}
            <div className="flex items-center gap-2 text-[var(--text-secondary)]">
              {hasUrl ? (
                <Wifi className="h-4 w-4 text-blue-500 shrink-0" />
              ) : (
                <Building2 className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
              )}
              <span className="truncate max-w-[220px] font-medium" title={meeting.location}>
                {meeting.location}
              </span>
            </div>

            {/* Organizer */}
            <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] pt-0.5">
              <Users className="h-3.5 w-3.5 shrink-0" />
              <span>{t('meetings.organized_by', 'منظَّم بواسطة:')} {meeting.createdByName || (language === 'en' ? 'Platform Management' : 'إدارة المنصة')}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 mt-5 pt-3.5 border-t border-[var(--border-subtle)]">
          <button
            onClick={() => onView(meeting)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-xl bg-[var(--surface-elevated)] hover:bg-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-black transition-colors cursor-pointer border border-[var(--border-subtle)]/70"
          >
            <span>{t('meetings.view_details', 'عرض التفاصيل')}</span>
            <ChevronRight className="h-3.5 w-3.5 opacity-60" />
          </button>

          {hasUrl && !isCancelled && (
            <a
              href={meeting.location.startsWith('http') ? meeting.location : `https://${meeting.location}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-all shadow-xs cursor-pointer"
            >
              <Video className="h-3.5 w-3.5" />
              <span>{t('meetings.join', 'دخول')}</span>
            </a>
          )}

          {isAdmin && (
            <button
              onClick={() => onDelete(meeting)}
              className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition-colors cursor-pointer"
              title={t('meetings.delete', 'حذف الاجتماع')}
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
  const { t, isRTL, language } = useLanguage();
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
    const matchSearch =
      !search ||
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      (m.description || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || m.status === filterStatus;
    const matchType = filterType === 'all' || m.type === filterType;
    return matchSearch && matchStatus && matchType;
  });

  // Calculate live stats
  const stats = {
    total: meetings.length,
    upcoming: meetings.filter((m) => m.status === 'scheduled').length,
    inProgress: meetings.filter((m) => m.status === 'in_progress').length,
    completed: meetings.filter((m) => m.status === 'completed').length,
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date || !startTime || !location.trim()) {
      toast.error('يرجى ملء جميع الحقول الإلزامية (*)');
      return;
    }

    setSubmitting(true);
    try {
      const creator = {
        uid: userProfile?.uid || '',
        email: userProfile?.email || userProfile?.username || 'admin',
        displayName: userProfile?.displayName || 'القيادة',
      };

      await createMeeting(
        {
          title: title.trim(),
          description: description.trim(),
          date,
          startTime,
          durationMinutes: parseInt(duration, 10) || 60,
          location: location.trim(),
          type,
          status: 'scheduled',
          createdBy: creator.email,
          createdByName: creator.displayName,
        },
        creator
      );

      toast.success('تم جدولة ونشر الاجتماع بنجاح! 🎉');
      setTitle('');
      setDate('');
      setStartTime('19:00');
      setDuration('60');
      setLocation('');
      setDescription('');
      setType('general');
      setShowCreate(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'فشل إنشاء الاجتماع.');
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
    <div className={cn("space-y-6 font-sans", isRTL ? "text-right dir-rtl" : "text-left")}>
      {/* ─── Platform Header ─────────────────────────────────────────────── */}
      <div className="card p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-[var(--border-subtle)] bg-[var(--surface)] shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] flex items-center gap-2.5">
            <Calendar className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            <span>{isAdmin ? t('meetings.title_admin') : t('meetings.title_member')}</span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            {t('meetings.subtitle')}
          </p>
        </div>

        {isAdmin && (
          <Button
            onClick={() => setShowCreate(true)}
            className="gap-2 font-black text-xs py-2.5 px-4 rounded-xl shadow-sm cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>{t('meetings.schedule_new')}</span>
          </Button>
        )}
      </div>

      {/* ─── KPI Metrics Bar ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total */}
        <div className="card p-4 rounded-2xl flex items-center justify-between border border-[var(--border-subtle)] bg-[var(--surface)] shadow-xs">
          <div>
            <p className="text-xs font-bold text-[var(--text-muted)]">{t('meetings.stat_total')}</p>
            <p className="text-2xl font-black text-[var(--text-primary)] mt-1">{stats.total}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20 shrink-0">
            <Calendar className="h-5 w-5" />
          </div>
        </div>

        {/* Upcoming */}
        <div className="card p-4 rounded-2xl flex items-center justify-between border border-[var(--border-subtle)] bg-[var(--surface)] shadow-xs">
          <div>
            <p className="text-xs font-bold text-[var(--text-muted)]">{t('meetings.stat_upcoming')}</p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{stats.upcoming}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shrink-0">
            <CalendarCheck className="h-5 w-5" />
          </div>
        </div>

        {/* In Progress */}
        <div className="card p-4 rounded-2xl flex items-center justify-between border border-[var(--border-subtle)] bg-[var(--surface)] shadow-xs">
          <div>
            <p className="text-xs font-bold text-[var(--text-muted)]">{t('meetings.stat_in_progress')}</p>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{stats.inProgress}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 shrink-0">
            <Radio className="h-5 w-5 animate-pulse" />
          </div>
        </div>

        {/* Completed */}
        <div className="card p-4 rounded-2xl flex items-center justify-between border border-[var(--border-subtle)] bg-[var(--surface)] shadow-xs">
          <div>
            <p className="text-xs font-bold text-[var(--text-muted)]">{t('meetings.stat_completed')}</p>
            <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{stats.completed}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20 shrink-0">
            <Check className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* ─── Search & Filters Bar ─────────────────────────────────────────── */}
      <div className="card p-3.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] flex flex-col sm:flex-row gap-3 shadow-xs">
        <div className="relative flex-1">
          <Search className={cn("absolute top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)] pointer-events-none", isRTL ? "right-3" : "left-3")} />
          <input
            className={cn(
              "w-full bg-[var(--surface-elevated)] border border-[var(--border-subtle)] rounded-xl py-2.5 text-xs sm:text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 transition-all",
              isRTL ? "pr-10 pl-4" : "pl-10 pr-4"
            )}
            placeholder={t('meetings.search_placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="bg-[var(--surface-elevated)] border border-[var(--border-subtle)] rounded-xl py-2.5 px-3.5 text-xs sm:text-sm text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 cursor-pointer font-bold"
        >
          <option value="all">{t('meetings.filter_all_status')}</option>
          <option value="scheduled">{t('meetings.filter_scheduled')}</option>
          <option value="in_progress">{t('meetings.filter_in_progress')}</option>
          <option value="completed">{t('meetings.filter_completed')}</option>
          <option value="cancelled">{t('meetings.filter_cancelled')}</option>
        </select>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as any)}
          className="bg-[var(--surface-elevated)] border border-[var(--border-subtle)] rounded-xl py-2.5 px-3.5 text-xs sm:text-sm text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 cursor-pointer font-bold"
        >
          <option value="all">{t('meetings.filter_all_types')}</option>
          <option value="general">{t('meetings.filter_general')}</option>
          <option value="committee">{t('meetings.filter_committee')}</option>
          <option value="training">{t('meetings.filter_training')}</option>
          <option value="review">{t('meetings.filter_review')}</option>
        </select>

        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold border border-rose-500/20 hover:bg-rose-500/20 transition-colors shrink-0 cursor-pointer"
          >
            <X className="h-4 w-4" />
            <span>{t('meetings.reset_filters')}</span>
          </button>
        )}
      </div>

      {/* ─── Meetings Grid ───────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filteredMeetings.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-10 w-10 text-[var(--text-muted)]" />}
          title={
            hasActiveFilters
              ? (language === 'en' ? 'No meetings match your search' : 'لا توجد اجتماعات تطابق معايير البحث')
              : (language === 'en' ? 'No meetings scheduled currently' : 'لا توجد اجتماعات معلنة حالياً')
          }
          description={
            hasActiveFilters
              ? (language === 'en' ? 'Try adjusting search terms or resetting filters.' : 'جرّب تعديل كلمات البحث أو مسح فلاتر الحالة والتصنيف.')
              : isAdmin
              ? (language === 'en' ? 'Start scheduling the first meeting for the team.' : 'ابدأ بجدولة أول اجتماع للفريق ونشر الرابط والموعد.')
              : (language === 'en' ? 'Check back later for upcoming meetings and sessions.' : 'تفقد الصفحة لاحقاً للاطلاع على المواعيد واللقاءات القادمة.')
          }
          action={
            isAdmin && !hasActiveFilters ? (
              <Button onClick={() => setShowCreate(true)} className="font-black gap-2">
                <Plus className="h-4 w-4" /> {t('meetings.schedule_new')}
              </Button>
            ) : hasActiveFilters ? (
              <Button variant="outline" onClick={resetFilters} className="font-bold gap-2">
                <X className="h-4 w-4" /> {t('meetings.reset_filters')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {filteredMeetings.length !== meetings.length && (
            <p className="text-xs text-[var(--text-muted)] font-bold">
              {language === 'en'
                ? `Showing ${filteredMeetings.length} of ${meetings.length} meetings`
                : `يُعرض ${filteredMeetings.length} من أصل ${meetings.length} اجتماع`}
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
        title={language === 'en' ? 'Meeting Details' : 'تفاصيل الاجتماع'}
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
              <span>{copied ? (language === 'en' ? 'Copied' : 'تم النسخ') : (language === 'en' ? 'Copy Details' : 'نسخ التفاصيل')}</span>
            </Button>

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setSelectedMeeting(null)}>
                {language === 'en' ? 'Close' : 'إغلاق'}
              </Button>
              {selectedMeeting && isUrl(selectedMeeting.location) && (
                <a
                  href={
                    selectedMeeting.location.startsWith('http')
                      ? selectedMeeting.location
                      : `https://${selectedMeeting.location}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button className="font-black gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white">
                    <Video className="h-4 w-4" />
                    <span>{language === 'en' ? 'Join Now' : 'الانضمام الآن'}</span>
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
              {/* Header Box */}
              <div className={cn('p-4 rounded-2xl border', typeConf.bg, typeConf.border, 'space-y-3')}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className={cn('inline-flex items-center gap-1.5 text-xs font-black', typeConf.color)}>
                    <span>{typeConf.icon}</span> {typeConf.label}
                  </span>
                  <span className={cn('flex items-center gap-1.5 text-xs font-bold', statusConf.color)}>
                    <span className={cn('w-2 h-2 rounded-full', statusConf.dot)} />
                    {statusConf.label}
                  </span>
                </div>
                <h2 className="text-xl font-black text-[var(--text-primary)] leading-snug">
                  {selectedMeeting.title}
                </h2>
                {countdown && selectedMeeting.status === 'scheduled' && (
                  <div className="flex items-center gap-2 text-xs font-black text-amber-700 dark:text-amber-300 bg-amber-500/15 border border-amber-500/30 rounded-xl px-3 py-2">
                    <Timer className="h-4 w-4" /> {countdown}
                  </div>
                )}
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Date & Time */}
                <div className="p-4 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2 text-[var(--text-muted)] text-xs font-bold mb-2">
                    <CalendarDays className="h-4 w-4 text-indigo-500" />
                    <span>الموعد والوقت</span>
                  </div>
                  <p className="text-sm font-black text-[var(--text-primary)]">{formatDate(selectedMeeting.date)}</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    الساعة {selectedMeeting.startTime} · مدة {selectedMeeting.durationMinutes} دقيقة
                  </p>
                </div>

                {/* Location */}
                <div className="p-4 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2 text-[var(--text-muted)] text-xs font-bold mb-2">
                    {hasUrl ? <Wifi className="h-4 w-4 text-blue-500" /> : <Building2 className="h-4 w-4 text-slate-400" />}
                    <span>{hasUrl ? 'رابط الاجتماع الرقمي' : 'المكان والمقر'}</span>
                  </div>
                  <p className="text-sm font-bold text-[var(--text-primary)] truncate">{selectedMeeting.location}</p>
                  {hasUrl ? (
                    <a
                      href={
                        selectedMeeting.location.startsWith('http')
                          ? selectedMeeting.location
                          : `https://${selectedMeeting.location}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline inline-flex items-center gap-1 mt-1.5"
                    >
                      <span>فتح الرابط المباشر</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">حضور شخصي بالمقر</p>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <p className="text-xs font-bold text-[var(--text-muted)] mb-2">📝 جدول الأعمال والمحاور</p>
                <div className="p-4 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-xs sm:text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-line min-h-[70px]">
                  {selectedMeeting.description || (
                    <span className="text-[var(--text-muted)] italic">لم يتم إدراج وصف أو محاور تفصيلية لهذا الاجتماع.</span>
                  )}
                </div>
              </div>

              {/* Organizer Info */}
              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-xs">
                <span className="text-[var(--text-muted)] flex items-center gap-1.5 font-medium">
                  <Users className="h-3.5 w-3.5" /> منظَّم بواسطة
                </span>
                <span className="font-bold text-[var(--text-primary)]">
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
        description="سيظهر الاجتماع في جدول المواعيد وتصل تنبيهات لجميع الأعضاء المعنيين"
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="outline" onClick={() => setShowCreate(false)} disabled={submitting}>
              إلغاء
            </Button>
            <Button
              onClick={handleCreate as any}
              loading={submitting}
              className="font-black gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Plus className="h-4 w-4" />
              <span>حفظ ونشر الاجتماع</span>
            </Button>
          </div>
        }
      >
        <form onSubmit={handleCreate} className="space-y-4 font-sans text-right" dir="rtl">
          <Input
            label="عنوان وموضوع الاجتماع *"
            placeholder="مثال: الاجتماع التنسيقي الأسبوعي للجان"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="تاريخ الاجتماع *"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
            <Input
              label="وقت البدء *"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="المدة التقديرية (بالدقائق) *"
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              required
            />
            <Select
              label="نوع وتصنيف الاجتماع"
              value={type}
              onChange={(e) => setType(e.target.value as MeetingType)}
              options={TYPE_OPTIONS}
            />
          </div>

          <Input
            label="المكان أو رابط الاجتماع *"
            placeholder="مثال: https://meet.google.com/xyz أو قاعة المؤتمرات"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
          />

          <div>
            <label className="form-label text-xs font-bold text-[var(--text-primary)] block mb-1.5">
              محاور الاجتماع وجدول الأعمال
            </label>
            <textarea
              className="w-full min-h-[95px] p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] text-xs sm:text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 transition-all"
              placeholder="اكتب النقاط الرئيسية، الأجندة، والمخرجات المستهدفة من اللقاء..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Contextual Notices */}
          {isUrl(location) && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs font-bold text-blue-700 dark:text-blue-300">
              <Wifi className="h-4 w-4 shrink-0" />
              <span>سيتاح زر الانضمام الرقمي المباشر لجميع الأعضاء</span>
            </div>
          )}
          {date && title && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-700 dark:text-emerald-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>سيُسجل الاجتماع في المنظومة ويتم إشعار أعضاء الفريق بالموعد</span>
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
        description={`هل أنت متأكد من حذف اجتماع "${deleteTarget?.title}"؟ سيتم إلغاء الموعد فوراً من شاشات جميع الأعضاء.`}
        confirmLabel="تأكيد الحذف"
        cancelLabel="إلغاء"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
