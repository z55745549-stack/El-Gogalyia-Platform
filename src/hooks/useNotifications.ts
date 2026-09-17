import { useState, useEffect } from 'react';
import {
  collection, query, where, orderBy, onSnapshot, limit, db,
} from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Notification } from '@/types';

export function useNotifications(maxCount = 50) {
  const { userProfile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userProfile?.uid && !userProfile?.email && !userProfile?.username) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const validIdentifiers = [
      userProfile?.email?.toLowerCase(),
      userProfile?.username?.toLowerCase(),
      userProfile?.uid?.toLowerCase(),
    ].filter(Boolean) as string[];
    const userUid = userProfile?.uid;

    try {
      const q = query(
        collection(db, 'notifications'),
        orderBy('createdAt', 'desc')
      );

      const unsub = onSnapshot(
        q,
        (snap) => {
          const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notification));
          const userNotifications = all.filter((n: any) => {
            const rEmail = (n.recipientEmail || n.recipient_email || '').toLowerCase();
            const rUid = n.recipientUid || n.recipient_uid || '';
            if (userUid && rUid && userUid === rUid) return true;
            if (rEmail && validIdentifiers.includes(rEmail)) return true;
            return false;
          }).slice(0, maxCount);

          setNotifications(userNotifications);
          setLoading(false);
        },
        (err) => {
          console.warn('Notifications onSnapshot notice:', err);
          setLoading(false);
        }
      );

      return unsub;
    } catch (e) {
      console.warn('Failed to query notifications:', e);
      setLoading(false);
    }
  }, [userProfile?.uid, userProfile?.email, userProfile?.username, maxCount]);

  return { notifications, loading };
}

export function useNotificationCount(): number {
  const { userProfile } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userProfile?.uid && !userProfile?.email && !userProfile?.username) {
      setCount(0);
      return;
    }

    const validIdentifiers = [
      userProfile?.email?.toLowerCase(),
      userProfile?.username?.toLowerCase(),
      userProfile?.uid?.toLowerCase(),
    ].filter(Boolean) as string[];
    const userUid = userProfile?.uid;

    try {
      const q = query(
        collection(db, 'notifications'),
        where('read', '==', false)
      );

      const unsub = onSnapshot(
        q,
        (snap) => {
          const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notification));
          const unreadCount = all.filter((n: any) => {
            const rEmail = (n.recipientEmail || n.recipient_email || '').toLowerCase();
            const rUid = n.recipientUid || n.recipient_uid || '';
            if (userUid && rUid && userUid === rUid) return true;
            if (rEmail && validIdentifiers.includes(rEmail)) return true;
            return false;
          }).length;
          setCount(unreadCount);
        },
        (err) => {
          console.warn('Notification count notice:', err);
        }
      );

      return unsub;
    } catch {
      setCount(0);
    }
  }, [userProfile?.uid, userProfile?.email, userProfile?.username]);

  return count;
}
