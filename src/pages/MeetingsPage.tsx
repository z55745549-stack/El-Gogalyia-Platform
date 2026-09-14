import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar,
  Clock,
  MapPin,
  Plus,
  Trash2,
  Users,
  ExternalLink,
  Info,
  Copy,
  Check,
  Video
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

const TYPE_OPTIONS: { value: MeetingType; label: string }[] = [
  { value: 'general', label: 'اجتماع عام (General)' },
  { value: 'committee', label: 'اجتماع لجنة (Committee)' },
  { value: 'training', label: 'ورشة تدريبية (Training)' },
  { value: 'review', label: 'جلسة مراجعة وتقييم (Review)' },
];

const getTypeBadge = (type: MeetingType) => {
  switch (type) {
    case 'general':
      return { label: 'اجتماع عام', classes: 'bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800/40' };
    case 'training':
      return { label: 'تدريب وورشة عمل', classes: 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/40' };
    case 'committee':
      return { label: 'اجتماع لجنة', classes: 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/40' };
    case 'review':
      return { label: 'مراجعة وتقييم', classes: 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40' };
    default:
      return { label: type, classes: 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300' };
  }
};

const getStatusBadge = (status: MeetingStatus) => {
  switch (status) {
    case 'scheduled':
      return { label: 'مجدول وقادم', classes: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40' };
    case 'in_progress':
      return { label: 'جاري الآن', classes: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/40 animate-pulse' };
    case 'completed':
      return { label: 'منتهي ومكتمل', classes: 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400' };
    case 'cancelled':
      return { label: 'ملغي', classes: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/40' };
    default:
      return { label: status, classes: 'bg-slate-100 text-slate-600' };
  }
};

export function MeetingsPage() {
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'superAdmin';
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
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
      toast.success('تم جدولة ونشر الاجتماع بنجاح لجميع الموظفين! 📅');
      setTitle('');
      setDate('');
      setStartTime('19:00');
      setDuration('60');
      setLocation('');
      setDescription('');
      setType('general');
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

  const isUrl = (str: string) => {
    return str.startsWith('http://') || str.startsWith('https://') || str.includes('zoom.us') || str.includes('meet.google.com') || str.includes('teams.microsoft.com');
  };

  const handleCopyDetails = (m: Meeting) => {
    const text = `📌 تفاصيل الاجتماع: ${m.title}
📅 التاريخ: ${formatDate(m.date)}
⏰ الوقت: ${m.startTime} (المدة: ${m.durationMinutes} دقيقة)
📍 المكان / الرابط: ${m.location}
📝 جدول الأعمال:
${m.description || 'لا يوجد وصف إضافي'}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('تم نسخ تفاصيل الاجتماع إلى الحافظة!');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6 font-sans text-right dir-rtl">
      {/* Top Banner */}
      <div
        className="rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl border border-white/10"
        style={{ background: 'linear-gradient(135deg, var(--brand-primary) 0%, #312E81 50%, var(--brand-accent-dark) 100%)' }}
      >
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {isAdmin ? 'إدارة وجدولة الاجتماعات' : 'اجتماعات ولقاءات الفريق'}
            </h1>
            <p className="text-white/80 text-xs sm:text-sm mt-1.5 font-medium">
              إجمالي {meetings.length} اجتماع · مواعيد دقيقة وتنسيق موحد لجميع الفرق واللجان
            </p>
          </div>
          {isAdmin && (
            <Button
              onClick={() => setShowCreate(true)}
              className="bg-white hover:bg-slate-100 text-slate-950 font-black gap-2 shadow-lg cursor-pointer text-xs sm:text-sm"
            >
              <Plus className="h-4 w-4 text-[var(--brand-primary)]" /> جدولة اجتماع جديد
            </Button>
          )}
        </div>
        <div className="absolute -left-10 -bottom-10 w-48 h-48 rounded-full bg-[var(--brand-accent)]/20 blur-3xl pointer-events-none" />
      </div>

      {/* Meetings Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : meetings.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-8 w-8 text-slate-400" />}
          title="لا توجد اجتماعات مجدولة حالياً"
          description={isAdmin ? 'ابدأ بإنشاء أول اجتماع ونشره لجميع أعضاء الفريق.' : 'لا توجد اجتماعات معلنة حالياً، تفقد هذه الصفحة لاحقاً.'}
          action={
            isAdmin ? (
              <Button
                onClick={() => setShowCreate(true)}
                className="font-black gap-2"
              >
                <Plus className="h-4 w-4" /> إضافة اجتماع
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {meetings.map((m) => {
            const countdown = getCountdown(m.date, m.startTime);
            const typeInfo = getTypeBadge(m.type);
            const statusInfo = getStatusBadge(m.status);
            const hasUrl = isUrl(m.location);

            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'bg-white dark:bg-[#130d29] rounded-2xl border border-slate-200/80 dark:border-[#291f4a] p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between',
                  m.status === 'cancelled' && 'opacity-60'
                )}
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-black border', typeInfo.classes)}>
                      {typeInfo.label}
                    </span>
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold border', statusInfo.classes)}>
                      {statusInfo.label}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-extrabold text-slate-900 dark:text-white mt-3 text-base leading-snug">
                    {m.title}
                  </h3>

                  {/* Description preview */}
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {m.description || 'لا يوجد وصف مضاف لهذا الاجتماع.'}
                  </p>

                  {/* Metas */}
                  <div className="mt-4 space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-amber-500 flex-shrink-0" />
                      <span className="font-bold">{formatDate(m.date)}</span>
                      {countdown && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-800 dark:text-amber-300 font-bold text-[10px] mr-auto">
                          {countdown}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-pink-500 flex-shrink-0" />
                      <span>{m.startTime} · المدة: {m.durationMinutes} دقيقة</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {hasUrl ? <Video className="h-4 w-4 text-blue-500 flex-shrink-0" /> : <MapPin className="h-4 w-4 text-slate-400 flex-shrink-0" />}
                      <span className="truncate max-w-[220px]">
                        {m.location}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-400 text-[11px] pt-1">
                      <Users className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>منظم الاجتماع: {m.createdByName || 'إدارة المنصة'}</span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center gap-2 mt-5 pt-4 border-t border-slate-100 dark:border-white/5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedMeeting(m)}
                    className="flex-1 gap-1.5 text-xs font-bold bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10"
                  >
                    <Info className="h-3.5 w-3.5 text-amber-500" /> عرض التفاصيل
                  </Button>

                  {hasUrl && (
                    <a
                      href={m.location.startsWith('http') ? m.location : `https://${m.location}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 hover:bg-blue-100 text-xs font-bold flex items-center gap-1 transition-colors"
                    >
                      <Video className="h-3.5 w-3.5" /> دخول
                    </a>
                  )}

                  {isAdmin && (
                    <button
                      onClick={() => setDeleteTarget(m)}
                      title="حذف الاجتماع"
                      className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Meeting Details Modal */}
      <Modal
        open={Boolean(selectedMeeting)}
        onClose={() => setSelectedMeeting(null)}
        title="تفاصيل الاجتماع الكاملة"
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full gap-2">
            {selectedMeeting && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopyDetails(selectedMeeting)}
                className="gap-1.5 text-xs font-bold"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'تم النسخ' : 'نسخ بيانات الاجتماع'}
              </Button>
            )}

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setSelectedMeeting(null)}>
                إغلاق
              </Button>
              {selectedMeeting && isUrl(selectedMeeting.location) && (
                <a
                  href={selectedMeeting.location.startsWith('http') ? selectedMeeting.location : `https://${selectedMeeting.location}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button className="font-black gap-1.5 shadow-sm">
                    <Video className="h-4 w-4" /> الانضمام للاجتماع الآن
                  </Button>
                </a>
              )}
            </div>
          </div>
        }
      >
        {selectedMeeting && (
          <div className="space-y-4 font-sans text-right dir-rtl">
            {/* Header info */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className={cn('px-2.5 py-1 rounded-full text-xs font-black border', getTypeBadge(selectedMeeting.type).classes)}>
                  {getTypeBadge(selectedMeeting.type).label}
                </span>
                <span className={cn('px-2.5 py-1 rounded-full text-xs font-bold border', getStatusBadge(selectedMeeting.status).classes)}>
                  {getStatusBadge(selectedMeeting.status).label}
                </span>
              </div>

              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-snug">
                {selectedMeeting.title}
              </h2>
            </div>

            {/* Timing & Location Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-white dark:bg-[#181135] border border-slate-200/80 dark:border-[#291f4a] space-y-1">
                <span className="text-[11px] font-bold text-slate-400 block">📅 الموعد والتاريخ</span>
                <p className="text-sm font-black text-slate-900 dark:text-white">
                  {formatDate(selectedMeeting.date)}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-bold mt-0.5">
                  الساعة: {selectedMeeting.startTime} (المدة المتوقعة: {selectedMeeting.durationMinutes} دقيقة)
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-white dark:bg-[#181135] border border-slate-200/80 dark:border-[#291f4a] space-y-1">
                <span className="text-[11px] font-bold text-slate-400 block">📍 المكان / المنصة</span>
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {selectedMeeting.location}
                </p>
                {isUrl(selectedMeeting.location) ? (
                  <a
                    href={selectedMeeting.location.startsWith('http') ? selectedMeeting.location : `https://${selectedMeeting.location}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline inline-flex items-center gap-1 mt-0.5"
                  >
                    رابط الاجتماع المباشر <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-xs text-slate-500">حضور فعلي بالمقر</span>
                )}
              </div>
            </div>

            {/* Description / Agenda */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                📝 جدول أعمال الاجتماع والتفاصيل:
              </span>
              <div className="p-4 rounded-xl bg-white dark:bg-[#181135] border border-slate-200/80 dark:border-[#291f4a] text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                {selectedMeeting.description || 'لم يتم إدراج وصف أو محاور إضافية لهذا الاجتماع.'}
              </div>
            </div>

            {/* Organizer Info */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>منظم ومُنشئ الاجتماع:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{selectedMeeting.createdByName || 'إدارة المنصة'}</span>
            </div>
          </div>
        )}
      </Modal>

      {/* Schedule Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="جدولة اجتماع جديد"
        description="سيتم إرسال إشعار وظهور الاجتماع لجميع الموظفين والطلاب في النظام"
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="outline" onClick={() => setShowCreate(false)} disabled={submitting}>
              إلغاء
            </Button>
            <Button
              onClick={handleCreate as any}
              loading={submitting}
              className="font-black"
            >
              <Plus className="h-4 w-4" /> حفظ ونشر الاجتماع
            </Button>
          </div>
        }
      >
        <form onSubmit={handleCreate} className="space-y-4 font-sans text-right dir-rtl">
          <Input
            label="عنوان وموضوع الاجتماع *"
            placeholder="مثال: الاجتماع الشهري لمناقشة المهام والتقييم"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="تاريخ الاجتماع *"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <Input
              label="وقت البدء *"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="المدة التقديرية (بالدقائق) *"
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
            <Select
              label="نوع وتصنيف الاجتماع"
              value={type}
              onChange={(e) => setType(e.target.value as MeetingType)}
              options={TYPE_OPTIONS}
            />
          </div>

          <Input
            label="المكان أو رابط الاجتماع (Zoom / Google Meet / المقر) *"
            placeholder="مثال: https://meet.google.com/xyz أو قاعة الاجتماعات الرئيسية"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />

          <div>
            <label className="form-label">محاور الاجتماع وجدول الأعمال</label>
            <textarea
              className="form-input min-h-[90px]"
              placeholder="اكتب النقاط الرئيسية والأهداف المرجوة من الاجتماع..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="تأكيد حذف الاجتماع"
        description={`هل أنت متأكد من حذف اجتماع "${deleteTarget?.title}"؟ سيتم إلغاء الموعد وحذفه من شاشات جميع الموظفين.`}
        confirmLabel="تأكيد الحذف"
        cancelLabel="إلغاء"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
