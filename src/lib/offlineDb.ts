import type { Exam, ExamAttempt, Question } from '../types';

const DB_NAME = 'arixon_offline_db';
const DB_VERSION = 1;

export interface OfflineAnswerKeyEntry {
  correctAnswer: number;
  correctOptionId: string;
  explanation: string;
  hint?: string;
  solutionSteps?: string[] | null;
  formulaUsed?: string | null;
  distractorAnalysis?: Record<string, string> | null;
}

export interface OfflineExamPackage {
  key: string; // `${uid}::${examId}`
  uid: string;
  examId: string;
  exam: Exam;
  version: number;
  downloadedAt: string;
  questions: Array<Question & { optionIds?: string[] }>;
  answerKeys: Record<string, OfflineAnswerKeyEntry>;
  sizeBytes: number;
}

export interface OfflineActiveAttempt {
  id: string; // `offline_${uidPrefix}_${examId}_${ts}`
  uid: string;
  examId: string;
  examVersion: number;
  startedAt: string;
  expectedEndAt: string;
  durationSecondsTotal: number;
  accumulatedActiveMs: number;
  lastWallCheckpointAt: number;
  lastQuestionIndex: number;
  answers: Record<string, { optionIndex: number; optionId: string }>;
  updatedAt: string;
  attemptMeta: ExamAttempt;
}

export interface PendingSubmissionRecord {
  id: string; // attemptId
  uid: string;
  examId: string;
  examTitle: string;
  examVersion: number;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  answersMap: Record<string, string>; // questionId -> `opt_${idx}`
  clientAttemptData: Record<string, any>;
  provisionalAttempt: ExamAttempt;
  retryCount: number;
  nextRetryAt: number;
  lastError?: string;
  createdAt: string;
}

export interface ViewCacheEntry<T = any> {
  key: string; // `${uid}::${cacheId}`
  uid: string;
  cacheId: string;
  data: T;
  updatedAt: string;
}

export function formatBytesAr(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 كيلوبايت';
  if (bytes < 1024) return `${bytes} بايت`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.max(1, Math.round(kb))} كيلوبايت`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} ميجابايت`;
}

export function estimateJsonByteSize(obj: any): number {
  try {
    const json = JSON.stringify(obj);
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(json).length;
    }
    return json.length * 2;
  } catch {
    return 0;
  }
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openOfflineDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('المتصفح لا يدعم التخزين المحلي IndexedDB.'));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains('packages')) {
        const pkgStore = database.createObjectStore('packages', { keyPath: 'key' });
        pkgStore.createIndex('uid', 'uid', { unique: false });
      }
      if (!database.objectStoreNames.contains('activeAttempts')) {
        const activeStore = database.createObjectStore('activeAttempts', { keyPath: 'id' });
        activeStore.createIndex('uid', 'uid', { unique: false });
        activeStore.createIndex('uidExam', ['uid', 'examId'], { unique: false });
      }
      if (!database.objectStoreNames.contains('pendingSubmissions')) {
        const pendingStore = database.createObjectStore('pendingSubmissions', { keyPath: 'id' });
        pendingStore.createIndex('uid', 'uid', { unique: false });
        pendingStore.createIndex('uidExam', ['uid', 'examId'], { unique: false });
      }
      if (!database.objectStoreNames.contains('viewCache')) {
        const viewStore = database.createObjectStore('viewCache', { keyPath: 'key' });
        viewStore.createIndex('uid', 'uid', { unique: false });
      }
    };

    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        dbPromise = null;
      };
      resolve(database);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error || new Error('تعذر فتح قاعدة البيانات المحلية.'));
    };
  });

  return dbPromise;
}

function wrapTxError(err: any): Error {
  if (err?.name === 'QuotaExceededError' || String(err?.message || '').toLowerCase().includes('quota')) {
    return new Error('مساحة التخزين على جهازك ممتلئة. احذف بعض الامتحانات المنزّلة أو حرر مساحة وحاول مجدداً.');
  }
  return err instanceof Error ? err : new Error(String(err || 'خطأ في التخزين المحلي'));
}

async function idbGet<T>(storeName: string, key: IDBValidKey): Promise<T | null> {
  try {
    const database = await openOfflineDb();
    return await new Promise<T | null>((resolve, reject) => {
      const tx = database.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => reject(wrapTxError(req.error));
    });
  } catch {
    return null;
  }
}

async function idbPut<T>(storeName: string, value: T): Promise<void> {
  const database = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).put(value);
    req.onerror = () => reject(wrapTxError(req.error));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(wrapTxError(tx.error));
    tx.onabort = () => reject(wrapTxError(tx.error));
  });
}

async function idbDelete(storeName: string, key: IDBValidKey): Promise<void> {
  const database = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).delete(key);
    req.onerror = () => reject(wrapTxError(req.error));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(wrapTxError(tx.error));
  });
}

async function idbGetAllByIndex<T>(
  storeName: string,
  indexName: string,
  indexKey: IDBValidKey
): Promise<T[]> {
  try {
    const database = await openOfflineDb();
    return await new Promise<T[]>((resolve, reject) => {
      const tx = database.transaction(storeName, 'readonly');
      const idx = tx.objectStore(storeName).index(indexName);
      const req = idx.getAll(indexKey);
      req.onsuccess = () => resolve((req.result as T[]) || []);
      req.onerror = () => reject(wrapTxError(req.error));
    });
  } catch {
    return [];
  }
}

// ---------- Exam Packages ----------

export function makePackageKey(uid: string, examId: string): string {
  return `${uid}::${examId}`;
}

export async function saveOfflinePackage(pkg: OfflineExamPackage): Promise<void> {
  await idbPut('packages', {
    ...pkg,
    key: makePackageKey(pkg.uid, pkg.examId),
  });
}

export async function getOfflinePackage(uid: string, examId: string): Promise<OfflineExamPackage | null> {
  if (!uid || !examId) return null;
  return idbGet<OfflineExamPackage>('packages', makePackageKey(uid, examId));
}

export async function getDownloadedPackagesForUser(uid: string): Promise<OfflineExamPackage[]> {
  if (!uid) return [];
  const all = await idbGetAllByIndex<OfflineExamPackage>('packages', 'uid', uid);
  return all.filter((p) => p.uid === uid);
}

export async function deleteOfflinePackage(uid: string, examId: string): Promise<void> {
  if (!uid || !examId) return;
  await idbDelete('packages', makePackageKey(uid, examId));
}

// ---------- Active Offline Attempts ----------

export async function saveActiveOfflineAttempt(attempt: OfflineActiveAttempt): Promise<void> {
  await idbPut('activeAttempts', attempt);
}

export async function getActiveOfflineAttemptById(
  uid: string,
  attemptId: string
): Promise<OfflineActiveAttempt | null> {
  const item = await idbGet<OfflineActiveAttempt>('activeAttempts', attemptId);
  if (!item || item.uid !== uid) return null;
  return item;
}

export async function getActiveOfflineAttemptForExam(
  uid: string,
  examId: string
): Promise<OfflineActiveAttempt | null> {
  if (!uid || !examId) return null;
  const items = await idbGetAllByIndex<OfflineActiveAttempt>('activeAttempts', 'uidExam', [uid, examId]);
  return items.find((i) => i.uid === uid && i.examId === examId) || null;
}

export async function getActiveOfflineAttemptsForUser(uid: string): Promise<OfflineActiveAttempt[]> {
  if (!uid) return [];
  const items = await idbGetAllByIndex<OfflineActiveAttempt>('activeAttempts', 'uid', uid);
  return items.filter((i) => i.uid === uid);
}

export async function deleteActiveOfflineAttempt(attemptId: string): Promise<void> {
  if (!attemptId) return;
  await idbDelete('activeAttempts', attemptId);
}

// ---------- Pending Submissions Queue ----------

export async function upsertPendingSubmission(record: PendingSubmissionRecord): Promise<void> {
  await idbPut('pendingSubmissions', record);
}

export async function getPendingSubmissionsForUser(uid: string): Promise<PendingSubmissionRecord[]> {
  if (!uid) return [];
  const list = await idbGetAllByIndex<PendingSubmissionRecord>('pendingSubmissions', 'uid', uid);
  return list
    .filter((item) => item.uid === uid)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export async function getPendingSubmissionForExam(
  uid: string,
  examId: string
): Promise<PendingSubmissionRecord | null> {
  if (!uid || !examId) return null;
  const list = await idbGetAllByIndex<PendingSubmissionRecord>('pendingSubmissions', 'uidExam', [uid, examId]);
  return list.find((item) => item.uid === uid && item.examId === examId) || null;
}

export async function getPendingSubmissionById(
  uid: string,
  attemptId: string
): Promise<PendingSubmissionRecord | null> {
  const item = await idbGet<PendingSubmissionRecord>('pendingSubmissions', attemptId);
  if (!item || item.uid !== uid) return null;
  return item;
}

export async function deletePendingSubmission(attemptId: string): Promise<void> {
  if (!attemptId) return;
  await idbDelete('pendingSubmissions', attemptId);
}

// ---------- Per-UID View Cache (Leaderboard, Chat, Notifications) ----------

export function makeViewCacheKey(uid: string, cacheId: string): string {
  return `${uid}::${cacheId}`;
}

export async function saveViewCache<T>(uid: string, cacheId: string, data: T): Promise<void> {
  if (!uid || !cacheId) return;
  try {
    const entry: ViewCacheEntry<T> = {
      key: makeViewCacheKey(uid, cacheId),
      uid,
      cacheId,
      data,
      updatedAt: new Date().toISOString(),
    };
    await idbPut('viewCache', entry);
  } catch (err) {
    console.warn('[offlineDb] saveViewCache notice:', err);
  }
}

export async function getViewCache<T>(uid: string, cacheId: string): Promise<ViewCacheEntry<T> | null> {
  if (!uid || !cacheId) return null;
  const entry = await idbGet<ViewCacheEntry<T>>('viewCache', makeViewCacheKey(uid, cacheId));
  if (!entry || entry.uid !== uid) return null;
  return entry;
}

export function formatCachedTimeAr(isoString?: string | null): string {
  if (!isoString) return 'غير معروف';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'غير معروف';
    return d.toLocaleString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return 'غير معروف';
  }
}
