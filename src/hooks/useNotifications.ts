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
    // Accept both username and email as the recipient identifier
    const recipientId = (userProfile?.email || userProfile?.username || '').toLowerCase();
    if (!recipientId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    try {
      const q = query(
        collection(db, 'notifications'),
        where('recipientEmail', '==', recipientId),
        orderBy('createdAt', 'desc'),
        limit(maxCount)
      );

      const unsub = onSnapshot(
        q,
        (snap) => {
          setNotifications(
            snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notification))
          );
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
  }, [userProfile?.email, userProfile?.username, maxCount]);

  return { notifications, loading };
}

export function useNotificationCount(): number {
  const { userProfile } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    const recipientId = (userProfile?.email || userProfile?.username || '').toLowerCase();
    if (!recipientId) {
      setCount(0);
      return;
    }

    try {
      const q = query(
        collection(db, 'notifications'),
        where('recipientEmail', '==', recipientId),
        where('read', '==', false)
      );

      const unsub = onSnapshot(
        q,
        (snap) => {
          setCount(snap.size);
        },
        (err) => {
          console.warn('Notification count notice:', err);
        }
      );

      return unsub;
    } catch {
      setCount(0);
    }
  }, [userProfile?.email, userProfile?.username]);

  return count;
}
