import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  updateDoc, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db } from './firebase';
import type { DailyGoal, SubjectId } from '../types';

const LOCAL_STORAGE_KEY_PREFIX = 'arixon_daily_goals_';

function getLocalGoals(userId: string): DailyGoal[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${userId}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('[DailyGoals] Error reading local storage:', e);
  }
  return [];
}

function saveLocalGoals(userId: string, goals: DailyGoal[]) {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(goals));
  } catch (e) {
    console.warn('[DailyGoals] Error writing to local storage:', e);
  }
}

/**
 * Fetch daily goals for a specific user and date
 */
export async function getDailyGoals(userId: string, dateStr?: string): Promise<DailyGoal[]> {
  const targetDate = dateStr || new Date().toISOString().split('T')[0];
  const localGoals = getLocalGoals(userId);

  // If user is guest/demo or not in Firebase, return local storage directly
  if (!userId || userId.startsWith('demo-') || !db) {
    return localGoals.filter((g) => !targetDate || g.date === targetDate);
  }

  try {
    const goalsRef = collection(db, 'users', userId, 'dailyGoals');
    const q = query(goalsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const remoteGoals: DailyGoal[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as DailyGoal;
        remoteGoals.push({ ...data, id: docSnap.id });
      });

      // Merge and update local cache
      saveLocalGoals(userId, remoteGoals);
      return remoteGoals.filter((g) => !targetDate || g.date === targetDate);
    }
  } catch (err) {
    console.warn('[DailyGoals] Firestore fetch failed, falling back to local storage:', err);
  }

  return localGoals.filter((g) => !targetDate || g.date === targetDate);
}

/**
 * Add a new daily goal
 */
export async function addDailyGoal(
  userId: string,
  params: {
    text: string;
    subject?: SubjectId;
    priority?: 'normal' | 'important' | 'urgent';
    estimatedMinutes?: number;
    date?: string;
  }
): Promise<DailyGoal> {
  const goalId = 'goal_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const now = new Date().toISOString();
  const dateStr = params.date || now.split('T')[0];

  const newGoal: DailyGoal = {
    id: goalId,
    userId,
    text: params.text.trim(),
    subject: params.subject || 'other',
    priority: params.priority || 'normal',
    estimatedMinutes: params.estimatedMinutes || 30,
    completed: false,
    completedAt: null,
    date: dateStr,
    createdAt: now,
  };

  // Update local storage first
  const existing = getLocalGoals(userId);
  saveLocalGoals(userId, [newGoal, ...existing]);

  // Attempt Firestore sync if authenticated
  if (userId && !userId.startsWith('demo-') && db) {
    try {
      const docRef = doc(db, 'users', userId, 'dailyGoals', goalId);
      await setDoc(docRef, newGoal);
    } catch (err) {
      console.warn('[DailyGoals] Firestore write deferred / offline:', err);
    }
  }

  return newGoal;
}

/**
 * Toggle goal completion status
 */
export async function toggleDailyGoal(
  userId: string,
  goalId: string,
  currentStatus: boolean
): Promise<boolean> {
  const newStatus = !currentStatus;
  const now = newStatus ? new Date().toISOString() : null;

  // Update local storage
  const existing = getLocalGoals(userId);
  const updated = existing.map((g) => {
    if (g.id === goalId) {
      return { ...g, completed: newStatus, completedAt: now };
    }
    return g;
  });
  saveLocalGoals(userId, updated);

  // Attempt Firestore sync if authenticated
  if (userId && !userId.startsWith('demo-') && db) {
    try {
      const docRef = doc(db, 'users', userId, 'dailyGoals', goalId);
      await updateDoc(docRef, {
        completed: newStatus,
        completedAt: now,
      });
    } catch (err) {
      console.warn('[DailyGoals] Firestore update deferred / offline:', err);
    }
  }

  return newStatus;
}

/**
 * Delete a daily goal
 */
export async function deleteDailyGoal(userId: string, goalId: string): Promise<void> {
  // Update local storage
  const existing = getLocalGoals(userId);
  const updated = existing.filter((g) => g.id !== goalId);
  saveLocalGoals(userId, updated);

  // Attempt Firestore delete if authenticated
  if (userId && !userId.startsWith('demo-') && db) {
    try {
      const docRef = doc(db, 'users', userId, 'dailyGoals', goalId);
      await deleteDoc(docRef);
    } catch (err) {
      console.warn('[DailyGoals] Firestore delete deferred / offline:', err);
    }
  }
}

/**
 * Clear all completed daily goals for the day
 */
export async function clearCompletedGoals(userId: string, dateStr?: string): Promise<void> {
  const targetDate = dateStr || new Date().toISOString().split('T')[0];
  const existing = getLocalGoals(userId);
  const remaining = existing.filter((g) => !(g.date === targetDate && g.completed));
  const completedToDelete = existing.filter((g) => g.date === targetDate && g.completed);
  saveLocalGoals(userId, remaining);

  if (userId && !userId.startsWith('demo-') && db) {
    for (const g of completedToDelete) {
      try {
        await deleteDoc(doc(db, 'users', userId, 'dailyGoals', g.id));
      } catch (e) {
        // continue
      }
    }
  }
}
