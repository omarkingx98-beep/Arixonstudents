import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch,
  getDocs,
  limit,
} from 'firebase/firestore';
import { db, auth, sanitizeFirestoreData } from './firebase';
import type { AppNotification } from '../types';

/**
 * Subscribe to realtime notifications for the current student
 */
export function subscribeToNotifications(
  userId: string,
  callback: (notifications: AppNotification[], unreadCount: number) => void
): () => void {
  if (!userId) {
    callback([], 0);
    return () => {};
  }

  const notifsRef = collection(db, 'notifications');
  const q = query(
    notifsRef,
    where('recipientId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(50)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: AppNotification[] = [];
      let unread = 0;
      snapshot.forEach((d) => {
        const item = { ...d.data(), id: d.id } as AppNotification;
        items.push(item);
        if (!item.read) unread++;
      });
      callback(items, unread);
    },
    (err) => {
      console.warn('[notificationService] Subscription error:', err);
      callback([], 0);
    }
  );
}

/**
 * Send an in-app notification
 */
export async function sendAppNotification(
  notif: Omit<AppNotification, 'id' | 'createdAt' | 'read'> & { id?: string }
): Promise<string> {
  const notifId = notif.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const record: AppNotification = {
    ...notif,
    id: notifId,
    read: false,
    createdAt: now,
  };

  await setDoc(doc(db, 'notifications', notifId), sanitizeFirestoreData(record));
  return notifId;
}

/**
 * Mark a single notification as read
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const ref = doc(db, 'notifications', notificationId);
  await updateDoc(ref, { read: true });
}

/**
 * Mark all notifications for a student as read
 */
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  const notifsRef = collection(db, 'notifications');
  const q = query(notifsRef, where('recipientId', '==', userId), where('read', '==', false));
  const snap = await getDocs(q);

  if (snap.empty) return;

  const batch = writeBatch(db);
  snap.forEach((d) => {
    batch.update(d.ref, { read: true });
  });
  await batch.commit();
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  await deleteDoc(doc(db, 'notifications', notificationId));
}

/**
 * Admin: Broadcast a notification to all students
 */
export async function broadcastAdminNotification(params: {
  title: string;
  message: string;
  studentIds: string[];
}): Promise<void> {
  const now = new Date().toISOString();
  const batch = writeBatch(db);

  for (const uid of params.studentIds) {
    const notifId = `notif_bc_${uid}_${Date.now()}`;
    const ref = doc(db, 'notifications', notifId);
    batch.set(ref, sanitizeFirestoreData({
      id: notifId,
      recipientId: uid,
      senderName: 'إدارة منصة أريكسون',
      type: 'admin_announcement',
      title: params.title,
      message: params.message,
      read: false,
      createdAt: now,
    }));
  }

  await batch.commit();
}
