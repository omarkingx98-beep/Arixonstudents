import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { db, sanitizeFirestoreData } from './firebase';
import type { BroadcastNotification, BroadcastAudience, BroadcastType, StudentNotifState } from '../types';

/**
 * Create or Coalesce a Broadcast Notification (Admin only)
 * If an admin published, unpublished, or updated the same exam within the last 60 seconds,
 * coalesce into the latest broadcast instead of spamming duplicates.
 */
export async function createOrCoalesceBroadcast(params: {
  type: BroadcastType;
  title: string;
  message?: string;
  examId?: string;
  examTitle?: string;
  audience: BroadcastAudience;
  adminEmail: string;
}): Promise<string> {
  const now = new Date();
  const nowIso = now.toISOString();

  try {
    if (params.examId) {
      // Check for an existing broadcast for this exam in the last 60 seconds
      const bCol = collection(db, 'broadcasts');
      const q = query(
        bCol,
        where('examId', '==', params.examId),
        limit(5)
      );
      const snap = await getDocs(q);

      let recentDocId: string | null = null;
      snap.forEach((d) => {
        const data = d.data();
        const createdAtTime = new Date(data.updatedAt || data.createdAt).getTime();
        if (now.getTime() - createdAtTime < 60 * 1000) {
          recentDocId = d.id;
        }
      });

      if (recentDocId) {
        // Coalesce / update the recent broadcast
        const bDocRef = doc(db, 'broadcasts', recentDocId);
        await setDoc(bDocRef, sanitizeFirestoreData({
          type: params.type,
          title: params.title,
          message: params.message || '',
          examId: params.examId,
          examTitle: params.examTitle || '',
          audience: params.audience,
          createdBy: params.adminEmail,
          updatedAt: nowIso,
        }), { merge: true });
        return recentDocId;
      }
    }
  } catch (err) {
    console.warn('[broadcastService] Notice during coalescing check:', err);
  }

  // Create new broadcast
  const broadcastId = `bcast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const bDocRef = doc(db, 'broadcasts', broadcastId);

  const cleanBroadcast: BroadcastNotification = {
    id: broadcastId,
    type: params.type,
    title: params.title,
    message: params.message || '',
    examId: params.examId,
    examTitle: params.examTitle || '',
    audience: params.audience,
    createdAt: nowIso,
    createdBy: params.adminEmail,
    updatedAt: nowIso,
  };

  await setDoc(bDocRef, sanitizeFirestoreData(cleanBroadcast));
  return broadcastId;
}

/**
 * Subscribe to realtime broadcast notifications for students matching their academic track
 */
export function subscribeToStudentBroadcasts(
  userBranch: string | undefined,
  callback: (broadcasts: BroadcastNotification[]) => void
): () => void {
  const bCol = collection(db, 'broadcasts');
  const q = query(bCol, orderBy('createdAt', 'desc'), limit(30));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: BroadcastNotification[] = [];
      const cleanUserBranch = userBranch || 'علمي';

      snapshot.forEach((d) => {
        const item = { ...d.data(), id: d.id } as BroadcastNotification;
        const track = item.audience?.track;

        // Check if student is in the target audience:
        // 'all', 'مشترك' applies to everyone
        // otherwise must match user's branch ('علمي' or 'أدبي')
        const isMatch = 
          !track ||
          track === 'all' ||
          track === 'مشترك' ||
          track === cleanUserBranch ||
          (cleanUserBranch === 'علمي' && track === 'scientific') ||
          (cleanUserBranch === 'أدبي' && track === 'literary');

        if (isMatch) {
          list.push(item);
        }
      });

      callback(list);
    },
    (err) => {
      console.warn('[broadcastService] Broadcast subscription error:', err);
      callback([]);
    }
  );
}

/**
 * Fetch student notification state (lastReadAt timestamp) from users/{uid}/meta/notifState
 */
export async function getStudentNotifState(uid: string): Promise<StudentNotifState | null> {
  try {
    const stateDocRef = doc(db, 'users', uid, 'meta', 'notifState');
    const snap = await getDoc(stateDocRef);
    if (snap.exists()) {
      return snap.data() as StudentNotifState;
    }
    // Fallback to local storage if offline
    const local = localStorage.getItem(`arixon_notif_state_${uid}`);
    if (local) return JSON.parse(local);
  } catch (err) {
    console.warn('[broadcastService] Could not read notifState:', err);
  }
  return null;
}

/**
 * Update student lastReadAt timestamp in users/{uid}/meta/notifState
 * Called whenever student opens the notifications drawer
 */
export async function updateStudentNotifState(uid: string): Promise<void> {
  const now = new Date().toISOString();
  try {
    const stateDocRef = doc(db, 'users', uid, 'meta', 'notifState');
    await setDoc(stateDocRef, {
      lastReadAt: now,
      updatedAt: now,
    }, { merge: true });
  } catch (err) {
    console.warn('[broadcastService] Could not save notifState to Firestore:', err);
  }

  try {
    localStorage.setItem(`arixon_notif_state_${uid}`, JSON.stringify({ lastReadAt: now }));
  } catch {}
}

/**
 * Helper to calculate unread broadcasts count relative to lastReadAt
 */
export function calculateUnreadBroadcasts(
  broadcasts: BroadcastNotification[],
  lastReadAt?: string | null
): number {
  if (!broadcasts || broadcasts.length === 0) return 0;
  if (!lastReadAt) return broadcasts.length;

  const lastReadTime = new Date(lastReadAt).getTime();
  if (isNaN(lastReadTime)) return broadcasts.length;

  return broadcasts.filter((b) => {
    const bTime = new Date(b.createdAt).getTime();
    return bTime > lastReadTime;
  }).length;
}
