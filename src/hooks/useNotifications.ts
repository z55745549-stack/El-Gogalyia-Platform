import { useState, useEffect, useMemo } from 'react';
import {
  collection, query, orderBy, onSnapshot, limit, db, doc, updateDoc,
} from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Notification } from '@/types';

interface NotificationState {
  notifications: Notification[];
  loading: boolean;
  unreadCount: number;
}

// ─── Shared Reactive Singleton Store ──────────────────────────────────────────
// Prevents duplicate queries, multiple realtime channels, and redundant polling
let cachedNotifications: Notification[] = [];
let cachedLoading = true;
let cachedUnreadCount = 0;
let currentActiveKey = '';
let activeUnsub: (() => void) | null = null;
let cleanupTimer: any = null;
const subscribers = new Set<(state: NotificationState) => void>();

function notifySubscribers() {
  const state: NotificationState = {
    notifications: cachedNotifications,
    loading: cachedLoading,
    unreadCount: cachedUnreadCount,
  };
  subscribers.forEach((cb) => {
    try {
      cb(state);
    } catch (e) {
      console.warn('Notification subscriber callback error:', e);
    }
  });
}

function startNotificationListener(userKey: string, validIdentifiers: string[], userUid?: string) {
  if (cleanupTimer) {
    clearTimeout(cleanupTimer);
    cleanupTimer = null;
  }

  // Already listening for this exact user
  if (currentActiveKey === userKey && activeUnsub) {
    return;
  }

  // Teardown previous listener if switched user
  if (activeUnsub) {
    activeUnsub();
    activeUnsub = null;
  }

  currentActiveKey = userKey;
  cachedLoading = cachedNotifications.length === 0;

  try {
    const q = query(
      collection(db, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    activeUnsub = onSnapshot(
      q,
      (snap) => {
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notification));
        const userNotifications = all.filter((n: any) => {
          const rEmail = (n.recipientEmail || n.recipient_email || '').toLowerCase();
          const rUid = n.recipientUid || n.recipient_uid || '';
          if (userUid && rUid && userUid === rUid) return true;
          if (rEmail && validIdentifiers.includes(rEmail)) return true;
          return false;
        });

        cachedNotifications = userNotifications;
        cachedUnreadCount = userNotifications.filter((n) => !n.read).length;
        cachedLoading = false;
        notifySubscribers();
      },
      (err) => {
        console.warn('Notifications shared listener notice:', err);
        cachedLoading = false;
        notifySubscribers();
      }
    );
  } catch (e) {
    console.warn('Failed to start notifications shared listener:', e);
    cachedLoading = false;
    notifySubscribers();
  }
}

function stopNotificationListenerDelayed() {
  if (subscribers.size === 0) {
    if (cleanupTimer) clearTimeout(cleanupTimer);
    cleanupTimer = setTimeout(() => {
      if (subscribers.size === 0 && activeUnsub) {
        activeUnsub();
        activeUnsub = null;
        currentActiveKey = '';
      }
    }, 10000); // 10s grace period to preserve cache during fast route transitions
  }
}

export function useNotifications(maxCount = 50) {
  const { userProfile } = useAuth();
  const [state, setState] = useState<NotificationState>(() => ({
    notifications: cachedNotifications,
    loading: cachedLoading,
    unreadCount: cachedUnreadCount,
  }));

  const userKey = userProfile?.uid || userProfile?.email || userProfile?.username || '';

  useEffect(() => {
    if (!userKey) {
      setState({ notifications: [], loading: false, unreadCount: 0 });
      return;
    }

    const validIdentifiers = [
      userProfile?.email?.toLowerCase(),
      userProfile?.username?.toLowerCase(),
      userProfile?.uid?.toLowerCase(),
    ].filter(Boolean) as string[];
    const userUid = userProfile?.uid;

    const onUpdate = (newState: NotificationState) => {
      setState(newState);
    };

    subscribers.add(onUpdate);
    startNotificationListener(userKey, validIdentifiers, userUid);

    // Provide initial state immediately from cache
    setState({
      notifications: cachedNotifications,
      loading: cachedLoading,
      unreadCount: cachedUnreadCount,
    });

    return () => {
      subscribers.delete(onUpdate);
      stopNotificationListenerDelayed();
    };
  }, [userKey, userProfile?.email, userProfile?.username, userProfile?.uid]);

  const slicedNotifications = useMemo(() => {
    return state.notifications.slice(0, maxCount);
  }, [state.notifications, maxCount]);

  return {
    notifications: slicedNotifications,
    loading: state.loading,
    unreadCount: state.unreadCount,
  };
}

export function useNotificationCount(): number {
  const { userProfile } = useAuth();
  const [count, setCount] = useState<number>(() => cachedUnreadCount);
  const userKey = userProfile?.uid || userProfile?.email || userProfile?.username || '';

  useEffect(() => {
    if (!userKey) {
      setCount(0);
      return;
    }

    const validIdentifiers = [
      userProfile?.email?.toLowerCase(),
      userProfile?.username?.toLowerCase(),
      userProfile?.uid?.toLowerCase(),
    ].filter(Boolean) as string[];
    const userUid = userProfile?.uid;

    const onUpdate = (newState: NotificationState) => {
      setCount(newState.unreadCount);
    };

    subscribers.add(onUpdate);
    startNotificationListener(userKey, validIdentifiers, userUid);

    setCount(cachedUnreadCount);

    return () => {
      subscribers.delete(onUpdate);
      stopNotificationListenerDelayed();
    };
  }, [userKey, userProfile?.email, userProfile?.username, userProfile?.uid]);

  return count;
}

