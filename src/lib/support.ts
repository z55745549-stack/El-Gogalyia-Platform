import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  increment,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { logActivity, createNotification } from './firestore';
import type {
  SupportTicket,
  TicketMessage,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  TicketAttachment
} from '@/types/support';
import type { UserProfile } from '@/types';

// Generate short readable ticket numbers e.g. #TK-1042
function generateTicketNumber(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `#TK-${num}`;
}

// ─── 1. Create a Support Ticket ──────────────────────────────────────────────
export async function createSupportTicket(params: {
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  description: string;
  attachments?: TicketAttachment[];
  creator: UserProfile;
}): Promise<string> {
  const { subject, category, priority, description, attachments = [], creator } = params;

  const ticketNumber = generateTicketNumber();
  const now = serverTimestamp();

  const ticketData = {
    ticketNumber,
    subject: subject.trim(),
    category,
    priority,
    status: 'open' as TicketStatus,
    createdBy: creator.uid,
    creatorName: creator.displayName || creator.username || 'عضو الفريق',
    creatorEmail: (creator.email || creator.username || '').toLowerCase(),
    creatorPhoto: creator.photoURL || '',
    committeeId: creator.committeeId || null,
    committeeName: creator.committeeName || null,
    assignedToAdminId: null,
    assignedToAdminName: null,
    description: description.trim(),
    attachments,
    replyCount: 0,
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now,
    resolvedAt: null,
    closedAt: null,
  };

  const docRef = await addDoc(collection(db, 'supportTickets'), ticketData);
  const ticketId = docRef.id;

  // Add initial message to conversation thread
  await addDoc(collection(db, 'supportTicketMessages'), {
    ticketId,
    senderId: creator.uid,
    senderName: creator.displayName || creator.username || 'عضو الفريق',
    senderPhoto: creator.photoURL || '',
    senderRole: creator.role || 'employee',
    message: description.trim(),
    attachments,
    isInternalNote: false,
    createdAt: now,
  });

  // Log activity
  await logActivity({
    actor: creator.uid,
    actorName: creator.displayName || creator.username || 'عضو الفريق',
    actorPhoto: creator.photoURL || '',
    action: 'ticket.created',
    targetType: 'ticket',
    targetId: ticketId,
    targetName: `${ticketNumber} - ${subject}`,
    metadata: { category, priority, ticketNumber },
  });

  // Notify Admins about new ticket
  try {
    const adminSnap = await getDocs(
      query(collection(db, 'users'), where('role', 'in', ['admin', 'superAdmin']))
    );
    for (const adminDoc of adminSnap.docs) {
      const adminData = adminDoc.data();
      const adminEmail = (adminData.username || adminData.email || '').toLowerCase();
      if (adminEmail && adminDoc.id !== creator.uid) {
        await createNotification({
          recipientEmail: adminEmail,
          recipientUid: adminDoc.id,
          type: 'support_ticket_created',
          title: `تذكرة دعم فني جديدة ${ticketNumber}`,
          message: `${creator.displayName || creator.username} أنشأ تذكرة: "${subject}" (${priority})`,
          taskId: null,
          ticketId,
          relatedEntityType: 'ticket',
          relatedEntityId: ticketId,
          actionUrl: '/admin/support',
        });
      }
    }
  } catch (notifErr) {
    console.warn('Admin notification error for ticket:', notifErr);
  }

  return ticketId;
}

// ─── 2. Add Reply to Ticket ──────────────────────────────────────────────────
export async function addTicketReply(params: {
  ticketId: string;
  sender: UserProfile;
  message: string;
  attachments?: TicketAttachment[];
  isInternalNote?: boolean;
}): Promise<string> {
  const { ticketId, sender, message, attachments = [], isInternalNote = false } = params;

  const ticketRef = doc(db, 'supportTickets', ticketId);
  const ticketSnap = await getDoc(ticketRef);
  if (!ticketSnap.exists()) {
    throw new Error('التذكرة غير موجودة');
  }
  const ticket = ticketSnap.data() as SupportTicket;
  const now = serverTimestamp();

  // If internal note, verify sender is admin or superAdmin
  const isAdmin = sender.role === 'admin' || sender.role === 'superAdmin';
  const effectiveInternal = isInternalNote && isAdmin;

  // Insert message into messages collection
  const msgRef = await addDoc(collection(db, 'supportTicketMessages'), {
    ticketId,
    senderId: sender.uid,
    senderName: sender.displayName || sender.username || 'مستخدم',
    senderPhoto: sender.photoURL || '',
    senderRole: sender.role || 'employee',
    message: message.trim(),
    attachments,
    isInternalNote: effectiveInternal,
    createdAt: now,
  });

  // Update ticket timestamps, replyCount, and status appropriately
  const updates: any = {
    updatedAt: now,
    lastActivityAt: now,
  };

  if (!effectiveInternal) {
    updates.replyCount = increment(1);

    if (isAdmin) {
      // Admin replied publicly -> status becomes 'waiting_user' unless already resolved
      if (ticket.status === 'open' || ticket.status === 'in_progress') {
        updates.status = 'waiting_user';
      }
      // If admin wasn't assigned, assign them
      if (!ticket.assignedToAdminId) {
        updates.assignedToAdminId = sender.uid;
        updates.assignedToAdminName = sender.displayName || sender.username || 'مشرف';
      }
    } else {
      // User replied -> status changes back to 'in_progress'
      if (ticket.status === 'waiting_user' || ticket.status === 'open') {
        updates.status = 'in_progress';
      }
    }
  }

  await updateDoc(ticketRef, updates);

  // Send notifications (only for non-internal notes)
  if (!effectiveInternal) {
    if (isAdmin) {
      // Notify creator (employee)
      const creatorEmail = (ticket.creatorEmail || '').toLowerCase();
      if (creatorEmail && ticket.createdBy !== sender.uid) {
        await createNotification({
          recipientEmail: creatorEmail,
          recipientUid: ticket.createdBy,
          type: 'support_ticket_reply',
          title: `رد جديد على تذكرتك ${ticket.ticketNumber}`,
          message: `${sender.displayName || sender.username} أضاف رداً على: "${ticket.subject}"`,
          taskId: null,
          ticketId,
          relatedEntityType: 'ticket',
          relatedEntityId: ticketId,
          actionUrl: `/support/${ticketId}`,
        });
      }
    } else {
      // User replied -> Notify assigned admin or general admins
      if (ticket.assignedToAdminId) {
        const assignedAdminSnap = await getDoc(doc(db, 'users', ticket.assignedToAdminId));
        if (assignedAdminSnap.exists()) {
          const adm = assignedAdminSnap.data();
          const email = (adm.username || adm.email || '').toLowerCase();
          if (email) {
            await createNotification({
              recipientEmail: email,
              recipientUid: ticket.assignedToAdminId,
              type: 'support_ticket_reply',
              title: `رد جديد من الموظف في ${ticket.ticketNumber}`,
              message: `${sender.displayName || sender.username} رد على التذكرة: "${ticket.subject}"`,
              taskId: null,
              ticketId,
              relatedEntityType: 'ticket',
              relatedEntityId: ticketId,
              actionUrl: '/admin/support',
            });
          }
        }
      }
    }
  }

  // Log activity
  await logActivity({
    actor: sender.uid,
    actorName: sender.displayName || sender.username || 'مستخدم',
    actorPhoto: sender.photoURL || '',
    action: 'ticket.replied',
    targetType: 'ticket',
    targetId: ticketId,
    targetName: `${ticket.ticketNumber} - ${ticket.subject}`,
    metadata: { isInternalNote: effectiveInternal },
  });

  return msgRef.id;
}

// ─── 3. Update Ticket Status ─────────────────────────────────────────────────
export async function updateTicketStatus(params: {
  ticketId: string;
  status: TicketStatus;
  actor: UserProfile;
}): Promise<void> {
  const { ticketId, status, actor } = params;

  const ticketRef = doc(db, 'supportTickets', ticketId);
  const ticketSnap = await getDoc(ticketRef);
  if (!ticketSnap.exists()) throw new Error('التذكرة غير موجودة');

  const ticket = ticketSnap.data() as SupportTicket;
  const now = serverTimestamp();

  const updates: any = {
    status,
    updatedAt: now,
    lastActivityAt: now,
  };

  if (status === 'resolved') {
    updates.resolvedAt = now;
  } else if (status === 'closed') {
    updates.closedAt = now;
  }

  await updateDoc(ticketRef, updates);

  // Notify creator
  const creatorEmail = (ticket.creatorEmail || '').toLowerCase();
  if (creatorEmail && ticket.createdBy !== actor.uid) {
    const statusLabels: Record<TicketStatus, string> = {
      open: 'مفتوحة',
      in_progress: 'قيد المعالجة',
      waiting_user: 'بانتظار ردك',
      resolved: 'تم حل المشكلة ✅',
      closed: 'مغلقة',
    };

    await createNotification({
      recipientEmail: creatorEmail,
      recipientUid: ticket.createdBy,
      type: 'support_ticket_status',
      title: `تحديث حالة التذكرة ${ticket.ticketNumber}`,
      message: `تم تغيير حالة تذكرتك "${ticket.subject}" إلى: ${statusLabels[status]}`,
      taskId: null,
      ticketId,
      relatedEntityType: 'ticket',
      relatedEntityId: ticketId,
      actionUrl: `/support/${ticketId}`,
    });
  }

  await logActivity({
    actor: actor.uid,
    actorName: actor.displayName || actor.username || 'مشرف',
    actorPhoto: actor.photoURL || '',
    action: 'ticket.status_changed',
    targetType: 'ticket',
    targetId: ticketId,
    targetName: `${ticket.ticketNumber} - ${ticket.subject}`,
    metadata: { newStatus: status, prevStatus: ticket.status },
  });
}

// ─── 4. Assign Admin to Ticket ───────────────────────────────────────────────
export async function assignTicketAdmin(params: {
  ticketId: string;
  adminId: string;
  adminName: string;
  actor: UserProfile;
}): Promise<void> {
  const { ticketId, adminId, adminName, actor } = params;

  const ticketRef = doc(db, 'supportTickets', ticketId);
  const ticketSnap = await getDoc(ticketRef);
  if (!ticketSnap.exists()) throw new Error('التذكرة غير موجودة');

  const ticket = ticketSnap.data() as SupportTicket;
  const now = serverTimestamp();

  await updateDoc(ticketRef, {
    assignedToAdminId: adminId,
    assignedToAdminName: adminName,
    updatedAt: now,
    lastActivityAt: now,
  });

  // Notify assigned admin
  const assignedAdminSnap = await getDoc(doc(db, 'users', adminId));
  if (assignedAdminSnap.exists()) {
    const adm = assignedAdminSnap.data();
    const email = (adm.username || adm.email || '').toLowerCase();
    if (email && adminId !== actor.uid) {
      await createNotification({
        recipientEmail: email,
        recipientUid: adminId,
        type: 'support_ticket_assigned',
        title: `تم تكليفك بتذكرة دعم ${ticket.ticketNumber}`,
        message: `${actor.displayName || actor.username} كلفك بمتابعة التذكرة: "${ticket.subject}"`,
        taskId: null,
        ticketId,
        relatedEntityType: 'ticket',
        relatedEntityId: ticketId,
        actionUrl: '/admin/support',
      });
    }
  }

  await logActivity({
    actor: actor.uid,
    actorName: actor.displayName || actor.username || 'مشرف',
    actorPhoto: actor.photoURL || '',
    action: 'ticket.assigned',
    targetType: 'ticket',
    targetId: ticketId,
    targetName: `${ticket.ticketNumber} - ${ticket.subject}`,
    metadata: { assignedToAdminId: adminId, assignedToAdminName: adminName },
  });
}
