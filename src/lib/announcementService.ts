import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db, auth, sanitizeFirestoreData } from './firebase';
import type { Announcement } from '../types';

/**
 * Fetch currently active announcements for the top ticker
 * Checks published == true and expiresAt > Date.now()
 */
export async function fetchActiveAnnouncements(): Promise<Announcement[]> {
  try {
    const colRef = collection(db, 'announcements');
    const q = query(
      colRef,
      where('published', '==', true),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    const now = Date.now();
    const list: Announcement[] = [];

    snap.forEach((d) => {
      const data = d.data() as Announcement;
      const id = d.id;
      // Filter out expired announcements
      if (data.expiresAt) {
        const expTime = new Date(data.expiresAt).getTime();
        if (!isNaN(expTime) && expTime <= now) {
          return;
        }
      }
      list.push({ ...data, id });
    });

    return list;
  } catch (err) {
    console.warn('[announcementService] Error fetching active announcements:', err);
    return [];
  }
}

/**
 * Delete an announcement from Firestore (Admin only)
 */
export async function deleteAnnouncement(announcementId: string): Promise<void> {
  const docRef = doc(db, 'announcements', announcementId);
  await deleteDoc(docRef);
}

/**
 * Save or update announcement with expiration date support
 */
export async function saveAnnouncementWithExpiry(
  ann: Omit<Announcement, 'id'> & { id?: string }
): Promise<string> {
  const isNew = !ann.id;
  const id = ann.id || `ann_${Date.now()}`;
  const now = new Date().toISOString();

  const data: Announcement = {
    id,
    title: ann.title.trim(),
    content: ann.content.trim(),
    image: ann.image || undefined,
    priority: ann.priority || 'medium',
    published: ann.published ?? true,
    scheduledAt: ann.scheduledAt || null,
    expiresAt: ann.expiresAt || null,
    createdAt: ann.createdAt || now,
    updatedAt: now,
    publishedAt: ann.published ? (ann.publishedAt || now) : null,
    createdBy: ann.createdBy || auth.currentUser?.email || 'admin',
  };

  await setDoc(doc(db, 'announcements', id), sanitizeFirestoreData(data), { merge: true });
  return id;
}
