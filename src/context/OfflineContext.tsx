import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { doc, getDoc, runTransaction, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuth } from './AuthContext';
import {
  deletePendingSubmission,
  getPendingSubmissionsForUser,
  upsertPendingSubmission,
  type PendingSubmissionRecord,
} from '../lib/offlineDb';
import type { UserProfile } from '../types';

const BACKOFF_MS = [5000, 15000, 45000, 120000, 300000];

export interface SyncSuccessNotification {
  attemptId: string;
  examId: string;
  examTitle: string;
  score: number;
  pointsAwarded: number;
  message: string;
  syncedAt: number;
}

interface OfflineContextType {
  isOnline: boolean;
  pendingSubmissions: PendingSubmissionRecord[];
  isSyncing: boolean;
  lastSyncNotification: SyncSuccessNotification | null;
  dismissSyncNotification: () => void;
  refreshPendingQueue: () => Promise<void>;
  syncNow: (forceAll?: boolean) => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

async function syncClientSideFallbackIfNeeded(
  uid: string,
  serverResult: any
): Promise<void> {
  if (!serverResult?.requiresClientSync || !serverResult?.attempt) return;
  const gradedAttempt = serverResult.attempt;
  const attemptId = gradedAttempt.id;
  if (!attemptId) return;

  try {
    const attemptDocRef = doc(db, 'attempts', attemptId);
    await setDoc(
      attemptDocRef,
      {
        ...gradedAttempt,
        status: 'submitted',
        reviews: serverResult.reviews || gradedAttempt.reviews || [],
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('[OfflineSync] Client fallback attempt write notice:', err);
  }

  if (serverResult.isFirstCompletion && gradedAttempt.pointsEarned > 0) {
    try {
      const userDocRef = doc(db, 'users', uid);
      await runTransaction(db, async (transaction) => {
        const uSnap = await transaction.get(userDocRef);
        if (uSnap.exists()) {
          const uData = uSnap.data() as UserProfile;
          const completedList: string[] = Array.isArray((uData as any).completedExamIds)
            ? (uData as any).completedExamIds
            : [];
          if (completedList.includes(gradedAttempt.examId)) return;
          transaction.update(userDocRef, {
            totalPoints: (uData.totalPoints || 0) + gradedAttempt.pointsEarned,
            weeklyPoints: (uData.weeklyPoints || 0) + gradedAttempt.pointsEarned,
            monthlyPoints: (uData.monthlyPoints || 0) + gradedAttempt.pointsEarned,
            examsCompleted: (uData.examsCompleted || 0) + 1,
            correctAnswers: (uData.correctAnswers || 0) + (gradedAttempt.correctCount || 0),
            wrongAnswers: (uData.wrongAnswers || 0) + (gradedAttempt.wrongCount || 0),
            completedExamIds: [...completedList, gradedAttempt.examId],
            updatedAt: new Date().toISOString(),
          });
        }
      });

      const pubRef = doc(db, 'publicProfiles', uid);
      const pubSnap = await getDoc(pubRef);
      const curPoints = pubSnap.exists() ? pubSnap.data().totalPoints || 0 : 0;
      await setDoc(
        pubRef,
        {
          totalPoints: curPoints + gradedAttempt.pointsEarned,
          points: curPoints + gradedAttempt.pointsEarned,
          examsCompleted: (pubSnap.exists() ? pubSnap.data().examsCompleted || 0 : 0) + 1,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('[OfflineSync] Client fallback points sync notice:', err);
    }
  }
}

export const OfflineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, refreshProfile } = useAuth();
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingSubmissions, setPendingSubmissions] = useState<PendingSubmissionRecord[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncNotification, setLastSyncNotification] =
    useState<SyncSuccessNotification | null>(null);

  const syncingRef = useRef<boolean>(false);
  const uidRef = useRef<string | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  uidRef.current = user?.uid || null;

  const refreshPendingQueue = useCallback(async () => {
    const uid = uidRef.current;
    if (!uid) {
      setPendingSubmissions([]);
      return;
    }
    const items = await getPendingSubmissionsForUser(uid);
    setPendingSubmissions(items);
  }, []);

  // Request persistent storage so OS/browser is far less likely to evict downloaded exams
  useEffect(() => {
    if (!user?.uid) return;
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      navigator.storage.persist().catch(() => {});
    }
    void refreshPendingQueue();
  }, [user?.uid, refreshPendingQueue]);

  const dismissSyncNotification = useCallback(() => {
    setLastSyncNotification(null);
  }, []);

  const syncNow = useCallback(
    async (forceAll = false) => {
      const uid = uidRef.current;
      if (!uid || syncingRef.current) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;

      const queue = await getPendingSubmissionsForUser(uid);
      if (queue.length === 0) {
        setPendingSubmissions([]);
        return;
      }

      const now = Date.now();
      const dueItems = forceAll
        ? queue
        : queue.filter((item) => !item.nextRetryAt || item.nextRetryAt <= now);

      if (dueItems.length === 0) {
        setPendingSubmissions(queue);
        return;
      }

      syncingRef.current = true;
      setIsSyncing(true);

      let anySynced = false;
      let latestNotif: SyncSuccessNotification | null = null;
      let nextEarliestRetry = 0;

      try {
        let idToken = '';
        if (auth.currentUser) {
          idToken = await auth.currentUser.getIdToken();
        }

        if (!idToken) {
          return;
        }

        // Sequential FIFO processing
        for (const item of dueItems) {
          if (typeof navigator !== 'undefined' && !navigator.onLine) {
            break;
          }

          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 20000);

            const res = await fetch('/api/exams/grade', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`,
              },
              body: JSON.stringify({
                attemptId: item.id,
                source: 'offline',
                examVersion: item.examVersion,
                startedAt: item.startedAt,
                endedAt: item.endedAt,
                durationSeconds: item.durationSeconds,
                answers: item.answersMap,
                clientAttemptData: item.clientAttemptData,
              }),
              signal: controller.signal,
            });
            clearTimeout(timer);

            const json = await res.json().catch(() => ({}));

            if (res.ok && (json.ok || json.success)) {
              await syncClientSideFallbackIfNeeded(uid, json);
              await deletePendingSubmission(item.id);
              anySynced = true;

              const gradedAttempt = json.attempt || {};
              const finalScore = Number(gradedAttempt.score ?? 0);
              const ptsAwarded = Number(json.pointsAwarded ?? 0);

              try {
                localStorage.setItem(
                  `arixon_attempt_${item.id}`,
                  JSON.stringify({ ...gradedAttempt, reviews: json.reviews || gradedAttempt.reviews || [] })
                );
                localStorage.setItem(
                  `arixon_completed_${uid}_${item.examId}`,
                  JSON.stringify({
                    attemptId: item.id,
                    examId: item.examId,
                    userId: uid,
                    score: finalScore,
                    status: 'completed',
                    submittedAt: gradedAttempt.submittedAt || new Date().toISOString(),
                  })
                );
              } catch {}

              if (json.code !== 'ALREADY_SUBMITTED') {
                latestNotif = {
                  attemptId: item.id,
                  examId: item.examId,
                  examTitle: item.examTitle,
                  score: finalScore,
                  pointsAwarded: ptsAwarded,
                  message: `تمت المزامنة: نتيجتك النهائية ${finalScore}% والنقاط +${ptsAwarded}`,
                  syncedAt: Date.now(),
                };
              }
            } else {
              // Network/5xx or temporary error -> preserve queue with exponential backoff
              const nextRetry = item.retryCount + 1;
              const backoffDelay = BACKOFF_MS[Math.min(item.retryCount, BACKOFF_MS.length - 1)];
              const nextRetryAt = Date.now() + backoffDelay;
              if (!nextEarliestRetry || nextRetryAt < nextEarliestRetry) {
                nextEarliestRetry = nextRetryAt;
              }
              await upsertPendingSubmission({
                ...item,
                retryCount: nextRetry,
                nextRetryAt,
                lastError: json?.message || `HTTP ${res.status}`,
              });
            }
          } catch (err: any) {
            const nextRetry = item.retryCount + 1;
            const backoffDelay = BACKOFF_MS[Math.min(item.retryCount, BACKOFF_MS.length - 1)];
            const nextRetryAt = Date.now() + backoffDelay;
            if (!nextEarliestRetry || nextRetryAt < nextEarliestRetry) {
              nextEarliestRetry = nextRetryAt;
            }
            await upsertPendingSubmission({
              ...item,
              retryCount: nextRetry,
              nextRetryAt,
              lastError: err?.message || 'تعذر الاتصال بالخادم',
            });
          }
        }
      } finally {
        syncingRef.current = false;
        setIsSyncing(false);
        await refreshPendingQueue();

        if (anySynced) {
          if (latestNotif) {
            setLastSyncNotification(latestNotif);
          }
          try {
            await refreshProfile();
          } catch {}
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('arixon:offline-sync-complete', {
                detail: latestNotif,
              })
            );
          }
        }

        if (nextEarliestRetry > Date.now() && typeof navigator !== 'undefined' && navigator.onLine) {
          if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
          retryTimerRef.current = setTimeout(() => {
            void syncNow(false);
          }, Math.max(1500, nextEarliestRetry - Date.now()));
        }
      }
    },
    [refreshPendingQueue, refreshProfile]
  );

  // Sync triggers: online, visibilitychange, startup, and SW sync message
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void syncNow(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void syncNow(false);
      }
    };
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'ARIXON_TRIGGER_SYNC') {
        void syncNow(true);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibility);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }

    if (user?.uid && navigator.onLine) {
      void syncNow(false);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, [user?.uid, syncNow]);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        pendingSubmissions,
        isSyncing,
        lastSyncNotification,
        dismissSyncNotification,
        refreshPendingQueue,
        syncNow,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
};

export function useOffline(): OfflineContextType {
  const ctx = useContext(OfflineContext);
  if (!ctx) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return ctx;
}
