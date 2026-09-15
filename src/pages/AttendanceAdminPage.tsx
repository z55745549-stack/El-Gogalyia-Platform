import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import {
  QrCode,
  Plus,
  Play,
  Pause,
  StopCircle,
  Users,
  CheckCircle2,
  Clock,
  Calendar,
  Search,
  Filter,
  Download,
  ExternalLink,
  ChevronLeft,
  Shield,
  Eye,
  AlertCircle,
  Copy,
  Check
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import {
  subscribeAttendanceSessions,
  createAttendanceSession,
  updateSessionStatus,
  subscribeSessionRecords
} from '@/lib/attendance';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate, formatRelative, cn } from '@/utils';
import type { AttendanceSession, AttendanceRecord, AttendanceSessionStatus } from '@/types/attendance';

export function AttendanceAdminPage() {
  const { userProfile } = useAuth();

  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);

  // New Session Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('17:00');
  const [endTime, setEndTime] = useState('18:00');
  const [creating, setCreating] = useState(false);

  // Live QR Display Modal
  const [activeSessionForQR, setActiveSessionForQR] = useState<AttendanceSession | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Session Detail / Records Drawer
  const [selectedSessionForDetails, setSelectedSessionForDetails] = useState<AttendanceSession | null>(null);
  const [sessionRecords, setSessionRecords] = useState<AttendanceRecord[]>([]);
  const [recordSearch, setRecordSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'late'>('all');

  // Dynamic 60s auto-renewing QR
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [qrTimestamp, setQrTimestamp] = useState(Date.now());

  useEffect(() => {
    if (!activeSessionForQR) return;
    setSecondsLeft(60);
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setQrTimestamp(Date.now());
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeSessionForQR?.id]);

  // 1. Realtime Sessions Subscription
  useEffect(() => {
    const unsub = subscribeAttendanceSessions((list) => {
      setSessions(list);
      setLoading(false);

      // Keep active session updated in QR modal
      if (activeSessionForQR) {
        const found = list.find((s) => s.id === activeSessionForQR.id);
        if (found) setActiveSessionForQR(found);
      }
      if (selectedSessionForDetails) {
        const found = list.find((s) => s.id === selectedSessionForDetails.id);
        if (found) setSelectedSessionForDetails(found);
      }
    });

    return unsub;
  }, [activeSessionForQR?.id, selectedSessionForDetails?.id]);

  // 2. Realtime Records Subscription for Selected Session
  useEffect(() => {
    if (!selectedSessionForDetails && !activeSessionForQR) return;
    const targetId = selectedSessionForDetails?.id || activeSessionForQR?.id;
    if (!targetId) return;

    const unsub = subscribeSessionRecords(targetId, (records) => {
      setSessionRecords(records);
    });

    return unsub;
  }, [selectedSessionForDetails?.id, activeSessionForQR?.id]);

  // Handlers
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !userProfile) return;

    setCreating(true);
    try {
      const newId = await createAttendanceSession({
        title: title.trim(),
        description: description.trim(),
        date: sessionDate,
        startTime,
        endTime,
        creator: userProfile,
      });

      toast.success('تم إنشاء وبدء جلسة الحضور بنجاح! 🎉');
      setShowCreateModal(false);
      setTitle('');
      setDescription('');

      // Automatically open live QR code screen
      const s = sessions.find((item) => item.id === newId);
      if (s) setActiveSessionForQR(s);
    } catch (err: any) {
      toast.error(err.message || 'فشل إنشاء جلسة الحضور.');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateStatus = async (session: AttendanceSession, newStatus: AttendanceSessionStatus) => {
    if (!userProfile) return;
    try {
      await updateSessionStatus(session.id, newStatus, userProfile);
      toast.success(
        newStatus === 'closed'
          ? 'تم إغلاق جلسة الحضور نهائياً.'
          : newStatus === 'paused'
          ? 'تم إيقاف الجلسة مؤقتاً.'
          : 'تم تفعيل الجلسة واستقبال الحضور.'
      );
    } catch {
      toast.error('فشل تحديث حالة الجلسة.');
    }
  };

  const activeSessionsCount = sessions.filter((s) => s.status === 'active').length;
  const totalAttendeesAll = sessions.reduce((sum, s) => sum + (s.attendeesCount || 0), 0);

  // Filter records in drawer
  const filteredRecords = sessionRecords.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (recordSearch.trim()) {
      const q = recordSearch.toLowerCase();
      return (
        r.employeeName.toLowerCase().includes(q) ||
        r.employeeCode.toLowerCase().includes(q) ||
        r.checkInTime.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getQRUrl = (session: AttendanceSession) => {
    const origin = window.location.origin;
    const timeBucket = Math.floor(qrTimestamp / 60000);
    return `${origin}/attendance/check?sessionId=${session.id}&token=${session.secureToken}&tb=${timeBucket}`;
  };

  const copyQRLink = (session: AttendanceSession) => {
    const url = getQRUrl(session);
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    toast.success('تم نسخ رابط الحضور المباشر للحافظة!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const exportSessionCSV = () => {
    if (!selectedSessionForDetails) return;
    const csvContent = [
      ['اسم العضو', 'كود الموظف', 'وقت الحضور', 'الحالة'].join(','),
      ...filteredRecords.map((r) =>
        [
          `"${r.employeeName || ''}"`,
          `"${r.employeeCode || ''}"`,
          `"${r.checkInTime || ''}"`,
          `"${r.status === 'present' ? 'حاضر في الموعد' : 'متأخر'}"`,
        ].join(',')
      ),
    ].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${selectedSessionForDetails.title}-${selectedSessionForDetails.date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('تم تصدير سجل الحضور كـ CSV بنجاح!');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto dir-rtl text-right font-sans pb-16">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="page-title text-2xl font-black text-slate-900 dark:text-white">
              نظام وجلسات الحضور الذكي QR
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[var(--brand-accent)]/15 text-[var(--brand-accent-dark)] dark:text-[var(--brand-accent)] border border-[var(--brand-accent)]/30">
              ⚡ Live Scanner
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
            إدارة جلسات الحضور بالباركود التفاعلي، التحقق الفوري من هوية الموظفين بالأكواد الدائمة (GOGA-XXXXX).
          </p>
        </div>

        <Button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary font-black text-xs gap-2 shadow-xs shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>بدء جلسة حضور جديدة</span>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5 rounded-2xl bg-white dark:bg-[#130d29] border border-slate-200/90 dark:border-[#281e4b] flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">الجلسات النشطة حالياً</p>
            <p className="text-3xl font-black text-emerald-500 dark:text-emerald-400 mt-1">
              {activeSessionsCount}
            </p>
          </div>
          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center border border-emerald-500/20 font-bold">
            <Play className="h-6 w-6" />
          </div>
        </div>

        <div className="card p-5 rounded-2xl bg-white dark:bg-[#130d29] border border-slate-200/90 dark:border-[#281e4b] flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">إجمالي الحضور المسجل</p>
            <p className="text-3xl font-black text-[var(--brand-primary)] dark:text-[var(--brand-primary)] mt-1">
              {totalAttendeesAll}
            </p>
          </div>
          <div className="w-12 h-12 bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] rounded-2xl flex items-center justify-center border border-[var(--brand-primary)]/20 font-bold">
            <Users className="h-6 w-6" />
          </div>
        </div>

        <div className="card p-5 rounded-2xl bg-white dark:bg-[#130d29] border border-slate-200/90 dark:border-[#281e4b] flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">إجمالي الجلسات المنعقدة</p>
            <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">
              {sessions.length}
            </p>
          </div>
          <div className="w-12 h-12 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 rounded-2xl flex items-center justify-center border border-slate-200 dark:border-white/10 font-bold">
            <Calendar className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Sessions Table & List */}
      <div className="card p-5 rounded-3xl bg-white dark:bg-[#130d29] border border-slate-200/90 dark:border-[#281e4b] shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <QrCode className="h-5 w-5 text-[var(--brand-primary)] dark:text-[var(--brand-accent)]" />
            <span>جلسات تسجيل الحضور ({sessions.length})</span>
          </h2>
          <span className="text-xs text-slate-400">محدث لحظياً بالـ Realtime</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            جاري تحميل جلسات الحضور...
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={<QrCode className="h-10 w-10 text-[var(--brand-accent)]" />}
            title="لا توجد جلسات حضور حتى الآن"
            description="اضغط على زر (بدء جلسة حضور جديدة) لتوليد رمز QR فوري وعرضه لأعضاء الفريق لمسحه وتأكيد الحضور."
            action={
              <Button
                onClick={() => setShowCreateModal(true)}
                className="mt-3 btn-primary text-xs font-bold"
              >
                بدء أول جلسة الآن
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-[#241a49] -mx-5 -mb-5">
            {sessions.map((s) => {
              const isActive = s.status === 'active';
              const isPaused = s.status === 'paused';

              return (
                <div
                  key={s.id}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span
                        className={cn(
                          'px-2.5 py-0.5 rounded-full text-[10px] font-black border',
                          isActive
                            ? 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/20'
                            : isPaused
                            ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                            : 'bg-slate-100 dark:bg-white/5 text-slate-500 border-slate-200 dark:border-white/10'
                        )}
                      >
                        {isActive ? '● نشطة وتقبل الحضور' : isPaused ? '⏸ موقوفة مؤقتاً' : 'مغلقة'}
                      </span>

                      <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                        {s.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-[var(--brand-accent)]" />
                        {s.date}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-[#FFCF00]" />
                        {s.startTime} - {s.endTime}
                      </span>
                      <span>·</span>
                      <span>أنشأها: {s.createdByName}</span>
                    </div>
                  </div>

                  {/* Attendees Counter & Actions */}
                  <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                    <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#181233] border border-slate-200 dark:border-[#281e4b] text-center">
                      <span className="text-[10px] text-slate-400 block font-bold">عدد الحاضرين</span>
                      <span className="text-sm font-black text-slate-900 dark:text-white">
                        {s.attendeesCount || 0} حاضر
                      </span>
                    </div>

                    {/* Show QR Screen Button */}
                    <Button
                      size="sm"
                      onClick={() => setActiveSessionForQR(s)}
                      className="btn-accent font-black text-xs gap-1.5 border-0 shadow-xs"
                    >
                      <QrCode className="h-4 w-4" />
                      <span>عرض الـ QR</span>
                    </Button>

                    {/* View Records Table */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedSessionForDetails(s)}
                      className="text-xs font-bold gap-1.5"
                    >
                      <Users className="h-4 w-4" />
                      <span>سجل الحضور</span>
                    </Button>

                    {/* Control Actions */}
                    {isActive && (
                      <button
                        onClick={() => handleUpdateStatus(s, 'paused')}
                        title="إيقاف مؤقت"
                        className="p-2 rounded-xl text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 border border-slate-200 dark:border-[#281e4b] transition-colors"
                      >
                        <Pause className="h-4 w-4" />
                      </button>
                    )}

                    {isPaused && (
                      <button
                        onClick={() => handleUpdateStatus(s, 'active')}
                        title="استئناف الجلسة"
                        className="p-2 rounded-xl text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 border border-slate-200 dark:border-[#281e4b] transition-colors"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                    )}

                    {s.status !== 'closed' && (
                      <button
                        onClick={() => handleUpdateStatus(s, 'closed')}
                        title="إغلاق الجلسة نهائياً"
                        className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 border border-slate-200 dark:border-[#281e4b] transition-colors"
                      >
                        <StopCircle className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal 1: Create New Session */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="بدء جلسة حضور ذكية جديدة"
        description="أنشئ جلسة جديدة لتوليد باركود QR ذكي ومؤمّن لتسجيل حضور الفريق فورياً."
        size="md"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateModal(false)}
              disabled={creating}
              className="text-xs"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleCreateSession as any}
              loading={creating}
              size="sm"
              disabled={!title.trim()}
              className="btn-primary text-xs font-bold"
            >
              إنشاء وتوليد الـ QR
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateSession} className="space-y-4 text-right font-sans dir-rtl">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              عنوان جلسة الحضور / الاجتماع *
            </label>
            <Input
              required
              placeholder="مثال: الاجتماع الأسبوعي العام للجنة الإعلامية"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              تاريخ الجلسة *
            </label>
            <Input
              type="date"
              required
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                وقت البدء *
              </label>
              <Input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                وقت الانتهاء *
              </label>
              <Input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              ملاحظات أو وصف إضافي (اختياري)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="اكتب أي تعليمات للحاضرين..."
              className="w-full p-3 rounded-xl text-xs bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] resize-none"
            />
          </div>
        </form>
      </Modal>

      {/* Modal 2: Live Fullscreen QR Code Display */}
      <Modal
        open={Boolean(activeSessionForQR)}
        onClose={() => setActiveSessionForQR(null)}
        title={activeSessionForQR?.title || 'باركود الحضور الذكي'}
        description="وجّه الشاشة لأعضاء الفريق لمسح الباركود بهواتفهم وتأكيد الحضور تلقائياً."
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => activeSessionForQR && copyQRLink(activeSessionForQR)}
                className="text-xs gap-1.5"
              >
                {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                <span>نسخ الرابط المباشر</span>
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveSessionForQR(null)}
              className="text-xs"
            >
              إغلاق
            </Button>
          </div>
        }
      >
        {activeSessionForQR && (
          <div className="space-y-6 text-center font-sans dir-rtl py-2">
            {/* Live Status Badge */}
            <div className="flex items-center justify-center gap-3">
              <span
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-black border flex items-center gap-1.5',
                  activeSessionForQR.status === 'active'
                    ? 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/30 animate-pulse'
                    : 'bg-rose-500/10 text-rose-600 border-rose-500/30'
                )}
              >
                <span className="w-2 h-2 rounded-full bg-current" />
                {activeSessionForQR.status === 'active' ? 'الجلسة نشطة واستقبال الحضور متاح' : 'الجلسة متوقفة أو مغلقة'}
              </span>

              <span className="px-3 py-1 rounded-full text-xs font-black bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] dark:text-[var(--brand-accent)] border border-[var(--brand-primary)]/20">
                👥 {sessionRecords.length} مسجلين حتى الآن
              </span>
            </div>

            {/* Giant QR Code Container */}
            <div className="p-6 bg-white dark:bg-[var(--bg-card)] rounded-3xl inline-block shadow-xl border-4 border-[var(--brand-primary)]/20">
              <QRCodeSVG
                value={getQRUrl(activeSessionForQR)}
                size={260}
                level="H"
                includeMargin
                imageSettings={{
                  src: '',
                  x: undefined,
                  y: undefined,
                  height: 24,
                  width: 24,
                  excavate: true,
                }}
              />
            </div>

            {/* 60-Second Auto-Renewing Countdown Progress */}
            <div className="max-w-xs mx-auto p-3 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-[var(--text-muted)] flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
                  <span>تجديد الرمز التلقائي</span>
                </span>
                <span className="text-[var(--brand-primary)] font-mono">
                  {secondsLeft} ثانية
                </span>
              </div>
              <div className="w-full bg-[var(--surface)] h-2 rounded-full overflow-hidden border border-[var(--border-subtle)]">
                <div
                  className="bg-[var(--brand-primary)] h-full transition-all duration-1000"
                  style={{ width: `${(secondsLeft / 60) * 100}%` }}
                />
              </div>
              <p className="text-[10px] text-[var(--text-muted)]">
                حماية أمنية: يتجدد الرمز تلقائياً كل دقيقة لمنع تصوير الشاشة وتناقلها خارج القاعة.
              </p>
            </div>

            <div className="max-w-md mx-auto space-y-1">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                امسح الـ QR بكاميرا الهاتف للدخول المباشر إلى صفحة التحقق وتأكيد الحضور
              </p>
              <p className="text-[11px] text-slate-400 font-mono">
                {activeSessionForQR.startTime} ➜ {activeSessionForQR.endTime} · {activeSessionForQR.date}
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal 3: Session Attendance Records Table */}
      <Modal
        open={Boolean(selectedSessionForDetails)}
        onClose={() => setSelectedSessionForDetails(null)}
        title={`سجل حضور: ${selectedSessionForDetails?.title || ''}`}
        description="قائمة بجميع أعضاء الفريق المسجلين في هذه الجلسة مع وقت تسجيل الدخول الدقيق."
        size="xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={exportSessionCSV}
              disabled={filteredRecords.length === 0}
              className="text-xs gap-1.5 font-bold"
            >
              <Download className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
              <span>تصدير CSV ({filteredRecords.length})</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedSessionForDetails(null)}
              className="text-xs"
            >
              إغلاق
            </Button>
          </div>
        }
      >
        {selectedSessionForDetails && (
          <div className="space-y-4 font-sans text-right dir-rtl">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="ابحث باسم الموظف أو الكود..."
                  value={recordSearch}
                  onChange={(e) => setRecordSearch(e.target.value)}
                  className="w-full pr-9 pl-4 py-2 rounded-xl text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                />
              </div>

              <div className="flex items-center gap-1.5">
                {[
                  { id: 'all', label: 'الكل' },
                  { id: 'present', label: 'حاضر في الموعد' },
                  { id: 'late', label: 'حاضر متأخر' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id as any)}
                    className={cn(
                      'px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer',
                      statusFilter === tab.id
                        ? 'btn-primary shadow-xs'
                        : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300'
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="border border-slate-200/90 dark:border-white/10 rounded-2xl overflow-hidden bg-white dark:bg-white/[0.02]">
              {filteredRecords.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  لا توجد سجلات حضور مطابقة حتى الآن.
                </div>
              ) : (
                <table className="w-full text-xs text-right">
                  <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-200/90 dark:border-white/10 text-slate-500 dark:text-slate-400 font-bold">
                    <tr>
                      <th className="p-3">الموظف / العضو</th>
                      <th className="p-3">كود الموظف الفريد</th>
                      <th className="p-3">وقت الحضور</th>
                      <th className="p-3">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {filteredRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                        <td className="p-3 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <Avatar name={r.employeeName} src={r.employeePhoto} size="xs" />
                          <span>{r.employeeName}</span>
                        </td>
                        <td className="p-3 font-mono font-black text-[var(--brand-primary)] dark:text-[var(--brand-accent)]">
                          {r.employeeCode}
                        </td>
                        <td className="p-3 font-mono text-slate-600 dark:text-slate-300">
                          {r.checkInTime}
                        </td>
                        <td className="p-3">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-md text-[10px] font-black border',
                              r.status === 'present'
                                ? 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                            )}
                          >
                            {r.status === 'present' ? '✓ حاضر' : '⏱ متأخر'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
