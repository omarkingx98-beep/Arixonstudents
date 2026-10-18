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
  updateDoc 
} from 'firebase/firestore';
import { db, sanitizeFirestoreData } from './firebase';

export interface StudentReport {
  id: string;
  reporterId: string;
  reporterName?: string;
  reporterUsername?: string;
  reportedId: string;
  reportedName?: string;
  reportedUsername?: string;
  reason: string;
  note?: string;
  createdAt: string;
  status: 'pending' | 'reviewed' | 'action_taken' | 'dismissed';
  adminNotes?: string;
}

/**
 * Submit a report about a user.
 * Strict rules:
 * - Cannot report oneself
 * - Limit 1 report per reported person per day
 * - Stored in 'reports' collection with (reporterId, reportedId, reason, createdAt, status)
 */
export async function submitStudentReport(params: {
  reporterId: string;
  reporterName?: string;
  reporterUsername?: string;
  reportedId: string;
  reportedName?: string;
  reportedUsername?: string;
  reason: string;
  note?: string;
}): Promise<{ success: boolean; message: string }> {
  if (params.reporterId === params.reportedId) {
    throw new Error('لا يمكن إبلاغ النفس.');
  }

  const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const reportDocId = `rep_${params.reporterId}_${params.reportedId}_${todayStr}`;
  const reportRef = doc(db, 'reports', reportDocId);

  // Check if a report was already submitted today for this user
  const existingSnap = await getDoc(reportRef);
  if (existingSnap.exists()) {
    throw new Error('لقد قمت بتقديم بلاغ عن هذا الطالب اليوم بالفعل. يسمح ببلاغ واحد لكل شخص يومياً.');
  }

  const now = new Date().toISOString();
  const reportData: StudentReport = {
    id: reportDocId,
    reporterId: params.reporterId,
    reporterName: params.reporterName || 'طالب',
    reporterUsername: params.reporterUsername || 'student',
    reportedId: params.reportedId,
    reportedName: params.reportedName || 'طالب',
    reportedUsername: params.reportedUsername || 'student',
    reason: params.reason.trim(),
    note: params.note ? params.note.trim() : '',
    createdAt: now,
    status: 'pending',
  };

  await setDoc(reportRef, sanitizeFirestoreData(reportData));
  return { success: true, message: 'تم إرسال البلاغ بنجاح إلى إدارة المنصة للمراجعة واتخاذ الإجراء اللازم.' };
}

/**
 * Admin: Fetch all reports from the 'reports' collection
 */
export async function fetchAllReports(): Promise<StudentReport[]> {
  try {
    const colRef = collection(db, 'reports');
    const q = query(colRef, orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    const list: StudentReport[] = [];
    snap.forEach((d) => {
      list.push({ ...d.data(), id: d.id } as StudentReport);
    });
    return list;
  } catch (err) {
    console.warn('[reportService] Error fetching reports:', err);
    return [];
  }
}

/**
 * Admin: Update status of a report
 */
export async function updateReportStatus(
  reportId: string, 
  status: StudentReport['status'], 
  adminNotes?: string
): Promise<void> {
  const reportRef = doc(db, 'reports', reportId);
  await updateDoc(reportRef, {
    status,
    adminNotes: adminNotes || '',
    reviewedAt: new Date().toISOString(),
  });
}
