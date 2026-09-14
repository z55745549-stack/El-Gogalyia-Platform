import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  doc,
  collection,
  query,
  where,
  onSnapshot
} from 'firebase/firestore';
import {
  LifeBuoy,
  ChevronRight,
  Send,
  User,
  Shield,
  Clock,
  CheckCircle2,
  Lock,
  MessageSquare,
  AlertCircle,
  HelpCircle,
  FileText,
  Paperclip,
  CheckCheck,
  EyeOff,
  Sparkles,
  Info,
  Check,
  XCircle,
  ArrowRight
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { addTicketReply, updateTicketStatus } from '@/lib/support';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { SkeletonCard } from '@/components/ui/skeleton';
import { formatDate, formatRelative, cn } from '@/utils';
import { toast } from 'sonner';
import {
  TICKET_CATEGORY_CONFIG,
  TICKET_STATUS_CONFIG,
  TICKET_PRIORITY_CONFIG
} from '@/types/support';
import type {
  SupportTicket,
  TicketMessage,
  TicketStatus
} from '@/types/support';

export function SupportTicketDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [isInternalNote, setIsInternalNote] = useState(false); // only for admins
  const [statusUpdating, setStatusUpdating] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'superAdmin';

  // 1. Subscribe to ticket document
  useEffect(() => {
    if (!ticketId) return;
    const unsub = onSnapshot(doc(db, 'supportTickets', ticketId), (docSnap) => {
      if (docSnap.exists()) {
        const t = { id: docSnap.id, ...docSnap.data() } as SupportTicket;
        // Security check: If not admin and not creator, redirect
        if (!isAdmin && userProfile && t.createdBy !== userProfile.uid) {
          toast.error('غير مصرح لك بالاطلاع على هذه التذكرة');
          navigate('/support');
          return;
        }
        setTicket(t);
      } else {
        toast.error('التذكرة غير موجودة');
        navigate(isAdmin ? '/admin/support' : '/support');
      }
      setLoading(false);
    });

    return unsub;
  }, [ticketId, isAdmin, userProfile?.uid, navigate]);

  // 2. Subscribe to messages thread (Query without orderBy to avoid composite index requirement, sorted client-side)
  useEffect(() => {
    if (!ticketId) return;

    const q = query(
      collection(db, 'supportTicketMessages'),
      where('ticketId', '==', ticketId)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TicketMessage));
        
        // Sort safely in-memory
        const sorted = msgs.sort((a, b) => {
          const timeA = a.createdAt
            ? (a.createdAt as any).toDate
              ? (a.createdAt as any).toDate().getTime()
              : new Date(a.createdAt as any).getTime()
            : 0;
          const timeB = b.createdAt
            ? (b.createdAt as any).toDate
              ? (b.createdAt as any).toDate().getTime()
              : new Date(b.createdAt as any).getTime()
            : 0;
          return timeA - timeB;
        });

        // CRITICAL SECURITY RULE: Employees must NEVER see internal notes
        const visibleMsgs = isAdmin ? sorted : sorted.filter((m) => !m.isInternalNote);
        setMessages(visibleMsgs);
      },
      (err) => {
        console.warn('supportTicketMessages snapshot notice:', err);
      }
    );

    return unsub;
  }, [ticketId, isAdmin]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Admin Reply Handler
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !userProfile || !ticketId || !isAdmin) return;

    setSending(true);
    try {
      await addTicketReply({
        ticketId,
        sender: userProfile,
        message: replyText.trim(),
        isInternalNote,
      });

      setReplyText('');
      setIsInternalNote(false);
      toast.success(isInternalNote ? 'تم حفظ الملاحظة الداخلية السرية بنجاح 🔒' : 'تم إرسال الرد للموظف بنجاح! 🚀');
    } catch (err) {
      console.error(err);
      toast.error('فشل إرسال الرد، يرجى المحاولة لاحقاً');
    } finally {
      setSending(false);
    }
  };

  // Admin Status Update Handler
  const handleStatusChange = async (newStatus: TicketStatus) => {
    if (!ticketId || !userProfile || !isAdmin) return;
    setStatusUpdating(true);
    try {
      await updateTicketStatus({
        ticketId,
        status: newStatus,
        actor: userProfile,
      });
      toast.success(`تم تغيير حالة التذكرة إلى: ${TICKET_STATUS_CONFIG[newStatus]?.label}`);
    } catch {
      toast.error('فشل تحديث حالة التذكرة');
    } finally {
      setStatusUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto p-4 dir-rtl text-right font-sans">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (!ticket) return null;

  const catConfig = TICKET_CATEGORY_CONFIG[ticket.category] || TICKET_CATEGORY_CONFIG.general;
  const statusConfig = TICKET_STATUS_CONFIG[ticket.status] || TICKET_STATUS_CONFIG.open;
  const priorityConfig = TICKET_PRIORITY_CONFIG[ticket.priority] || TICKET_PRIORITY_CONFIG.medium;
  const isResolvedOrClosed = ticket.status === 'resolved' || ticket.status === 'closed';

  return (
    <div className="space-y-6 max-w-4xl mx-auto dir-rtl text-right font-sans pb-16">
      {/* Back Navigation Bar */}
      <div className="flex items-center justify-between">
        <Link
          to={isAdmin ? '/admin/support' : '/support'}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--brand-primary)] transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
          <span>{isAdmin ? 'الرجوع إلى مركز إدارة الدعم الفني' : 'الرجوع إلى تذاكر الدعم الخاصة بي'}</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-black text-[var(--text-muted)] bg-[var(--bg-elevated)] px-2.5 py-1 rounded-lg">
            {ticket.ticketNumber}
          </span>
          <span className={cn('px-3 py-1 rounded-full text-xs font-black border', statusConfig.badgeClass)}>
            {statusConfig.label}
          </span>
        </div>
      </div>

      {/* Ticket Header & Metadata Card */}
      <div className="card p-6 sm:p-7 space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('px-2.5 py-0.5 rounded-md text-[11px] font-black border', priorityConfig.badgeClass)}>
                {priorityConfig.label}
              </span>
              <span className="text-xs font-bold text-[var(--text-secondary)]">
                قسم: {catConfig.label}
              </span>
              {ticket.committeeName && (
                <span className="text-[11px] font-bold text-[var(--brand-primary)] bg-[var(--brand-primary)]/10 px-2 py-0.5 rounded-md border border-[var(--brand-primary)]/20">
                  🏛 {ticket.committeeName}
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] leading-tight">
              {ticket.subject}
            </h1>
          </div>

          {/* Admin Status Switcher */}
          {isAdmin && (
            <div className="flex items-center gap-2 shrink-0">
              <select
                value={ticket.status}
                disabled={statusUpdating}
                onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] cursor-pointer"
              >
                <option value="open">مفتوحة وجديدة</option>
                <option value="in_progress">قيد المعالجة</option>
                <option value="waiting_user">بانتظار رد العضو</option>
                <option value="resolved">تم الحل والإنجاز ✓</option>
                <option value="closed">مغلقة نهائياً</option>
              </select>
            </div>
          )}
        </div>

        {/* Creator & Assignment info */}
        <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Avatar name={ticket.creatorName} src={ticket.creatorPhoto} size="xs" />
            <span className="font-bold text-slate-700 dark:text-slate-300">
              {ticket.creatorName}
            </span>
            <span className="font-mono text-[10px] text-slate-400">
              ({ticket.creatorEmail})
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span>
              أُنشئت {ticket.createdAt ? formatRelative(ticket.createdAt) : 'الآن'}
            </span>
            {ticket.assignedToAdminName && (
              <span className="font-bold text-[var(--brand-accent)]">
                المشرف المسؤول: {ticket.assignedToAdminName}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Conversation & Thread Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-[var(--brand-accent)]" />
            <span>سجل المحادثة والمتابعة ({messages.length})</span>
          </h2>
          <span className="text-[11px] text-slate-400">تحديث فوري مباشر</span>
        </div>

        {/* Message Thread Container */}
        <div className="space-y-3.5">
          {messages.map((msg, index) => {
            const isMsgAdmin = msg.senderRole === 'admin' || msg.senderRole === 'superAdmin';
            const isMyMsg = msg.senderId === userProfile?.uid;

            // Internal note styling (strictly visible to admins)
            if (msg.isInternalNote) {
              return (
                <div
                  key={msg.id || index}
                  className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-black text-amber-700 dark:text-amber-300">
                      <Lock className="h-3.5 w-3.5" />
                      <span>ملاحظة إدارية داخلية (خاصة بالمشرفين فقط - مخفية عن الموظف)</span>
                    </div>
                    <span className="text-[10px] text-amber-600/80 dark:text-amber-400 font-mono">
                      {msg.createdAt ? formatRelative(msg.createdAt) : 'الآن'}
                    </span>
                  </div>
                  <p className="text-slate-800 dark:text-slate-100 whitespace-pre-wrap leading-relaxed font-medium">
                    {msg.message}
                  </p>
                  <p className="text-[10px] text-slate-400 pt-1">
                    كتبها المشرف: {msg.senderName}
                  </p>
                </div>
              );
            }

            // Public Messages: Distinguish clearly between Employee Request and Admin Response
            return (
              <div
                key={msg.id || index}
                className={cn(
                  'p-5 rounded-3xl border transition-all text-xs space-y-2.5 shadow-xs',
                  isMsgAdmin
                    ? 'bg-gradient-to-br from-[var(--brand-primary)]/10 via-[var(--brand-primary)]/5 to-transparent border-[var(--brand-primary)]/30 mr-4 sm:mr-8'
                    : 'bg-[var(--bg-elevated)]/50 border-[var(--border-subtle)] ml-4 sm:ml-8'
                )}
              >
                {/* Message Header */}
                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={msg.senderName} src={msg.senderPhoto} size="xs" />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[var(--text-primary)] text-xs">
                          {msg.senderName}
                        </span>
                        <span
                          className={cn(
                            'px-2 py-0.2 rounded-full text-[10px] font-black',
                            isMsgAdmin
                              ? 'bg-[var(--brand-primary)] text-white'
                              : 'bg-[var(--bg-card)] text-[var(--text-secondary)]'
                          )}
                        >
                          {isMsgAdmin ? '🛡️ المشرف / الدعم الفني' : '👤 صاحب التذكرة'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] text-[var(--text-muted)] font-mono">
                    {msg.createdAt ? formatRelative(msg.createdAt) : 'الآن'}
                  </span>
                </div>

                {/* Message Body */}
                <p className="text-[var(--text-primary)] text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-medium">
                  {msg.message}
                </p>
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* FOOTER ACTION AREA: Strictly separated by Role */}

      {/* 1. EMPLOYEE VIEW: Informative Banner ONLY (No input box) */}
      {!isAdmin && (
        <div className="mt-6">
          {isResolvedOrClosed ? (
            <div className="p-6 rounded-3xl bg-[var(--brand-success)]/10 border border-[var(--brand-success)]/30 text-[var(--text-primary)] text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-[var(--brand-success)]/20 text-[var(--brand-success)] flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-black text-[var(--brand-success)]">
                تمت مراجعة وحل هذه التذكرة بنجاح ✓
              </h3>
              <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto leading-relaxed">
                إذا كنت بحاجة إلى مساعدة إضافية في أي موضوع آخر، يمكنك في أي وقت فتح تذكرة دعم فني جديدة.
              </p>
              <div className="pt-2">
                <Link to="/support">
                  <Button size="sm" variant="primary" className="text-xs font-bold gap-1.5">
                    <span>فتح تذكرة جديدة</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="card p-5 rounded-3xl flex items-center gap-3.5 text-xs text-[var(--text-secondary)]">
              <div className="w-9 h-9 rounded-2xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center shrink-0">
                <Info className="h-5 w-5" />
              </div>
              <div className="leading-relaxed">
                <p className="font-bold text-[var(--text-primary)]">
                  طلبك مسجل ومُحال إلى فريق الإشراف والدعم الفني 🚀
                </p>
                <p className="text-[var(--text-muted)] text-[11px] mt-0.5">
                  سيصلك إشعار فوري وتنبيه على حسابك بمجرد قيام المشرف بالرد على استفسارك ومتابعة تذكرتك هنا.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. ADMIN VIEW: Full Reply & Note Box */}
      {isAdmin && (
        <div className="card p-5 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-[var(--text-primary)] flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-[var(--brand-primary)]" />
              <span>إرسال رد رسمي على تذكرة العضو</span>
            </h3>

            {/* Internal Note Checkbox (Admin Only) */}
            <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-[var(--brand-warm)] bg-[var(--brand-warm)]/10 px-3 py-1 rounded-xl border border-[var(--brand-warm)]/30">
              <input
                type="checkbox"
                checked={isInternalNote}
                onChange={(e) => setIsInternalNote(e.target.checked)}
                className="rounded text-[var(--brand-warm)] focus:ring-[var(--brand-warm)]"
              />
              <Lock className="h-3 w-3" />
              <span>ملاحظة سرية للمشرفين فقط</span>
            </label>
          </div>

          <form onSubmit={handleSendReply} className="space-y-3">
            <textarea
              rows={3}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={
                isInternalNote
                  ? 'اكتب ملاحظة داخلية سرية للمشرفين فقط (لن يراها العضو)...'
                  : 'اكتب رد المشرف وتوجيهات الحل للعضو...'
              }
              className={cn(
                'w-full p-3.5 rounded-2xl text-xs bg-[var(--bg-elevated)]/40 border focus:outline-none focus:ring-2 resize-none leading-relaxed text-[var(--text-primary)]',
                isInternalNote
                  ? 'border-[var(--brand-warm)]/40 focus:ring-[var(--brand-warm)]'
                  : 'border-[var(--border-subtle)] focus:ring-[var(--brand-primary)]'
              )}
            />

            <div className="flex items-center justify-between">
              <p className="text-[11px] text-[var(--text-muted)]">
                {isInternalNote ? '🔒 سيتم حفظ الملاحظة للمشرفين فقط' : '✉️ سيتم إشعار العضو فوراً بالرد الجديد'}
              </p>

              <Button
                type="submit"
                size="sm"
                loading={sending}
                disabled={!replyText.trim()}
                variant={isInternalNote ? 'warning' : 'primary'}
                className="text-xs font-bold gap-2"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{isInternalNote ? 'حفظ الملاحظة السرية' : 'إرسال الرد'}</span>
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
