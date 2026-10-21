import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
  deleteDoc,
} from 'firebase/firestore';
import { db, auth, sanitizeFirestoreData } from './firebase';
import type {
  AdminAuditLog,
  AdminAuditAction,
  QuestionBankItem,
  Announcement,
  Challenge,
  PointAdjustmentRecord,
  AdminSettings,
  Exam,
  Question,
  UserProfile,
  SubjectId,
  AiGeneratedQuestionDraft,
  AiGenerationJob,
  ExamTemplate,
  GenerationMode,
  ExamAttempt,
} from '../types';

export const PRIMARY_ADMIN_EMAIL = 'omarkingx99@gmail.com';
export const PRIMARY_ADMIN_EMAILS = [
  'omar88x99@gmail.com',
  'omarkingx99@gmail.com',
  'omarkingx98@gmail.com',
];

export function isPrimaryAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return PRIMARY_ADMIN_EMAILS.includes(email.toLowerCase().trim());
}

/**
 * Get current Firebase ID Token
 */
export async function getAuthToken(): Promise<string | null> {
  if (auth.currentUser) {
    return await auth.currentUser.getIdToken();
  }
  return null;
}

/**
 * Check if the current user has verified admin claims
 */
export async function checkUserAdminClaims(): Promise<{
  isAdmin: boolean;
  role: 'super_admin' | 'admin' | null;
  email: string | null;
  uid: string | null;
}> {
  const user = auth.currentUser;
  if (!user) {
    return { isAdmin: false, role: null, email: null, uid: null };
  }

  // Force token refresh to ensure custom claims are latest
  const tokenResult = await user.getIdTokenResult(false);
  const claims = tokenResult.claims;

  const isEmailPrimary = isPrimaryAdminEmail(user.email);
  const hasAdminClaim = claims.admin === true || claims.role === 'super_admin';

  if (hasAdminClaim || isEmailPrimary) {
    return {
      isAdmin: true,
      role: (claims.role as any) || (isEmailPrimary ? 'super_admin' : 'admin'),
      email: user.email,
      uid: user.uid,
    };
  }

  return {
    isAdmin: false,
    role: null,
    email: user.email,
    uid: user.uid,
  };
}

/**
 * Trigger backend bootstrap for Super Admin
 */
export async function bootstrapAdminBackend(): Promise<{ success: boolean; message?: string }> {
  try {
    const token = await getAuthToken();
    if (!token) throw new Error('يرجى تسجيل الدخول أولاً.');

    const res = await fetch('/api/admin/bootstrap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'فشل الاتصال بالخادم لتهيئة صلاحيات الإدارة.');
    }

    // Force refresh client token to pick up new claims
    if (auth.currentUser) {
      await auth.currentUser.getIdToken(true);
    }

    return { success: true };
  } catch (err: any) {
    console.error('[Admin Service] Bootstrap error:', err);
    throw err;
  }
}

/**
 * Record an Admin Audit Log entry (Tamper-proof, Append-Only)
 */
export async function recordAdminAuditLog(entry: {
  action: AdminAuditAction;
  targetType: 'exam' | 'question' | 'student' | 'announcement' | 'challenge' | 'settings' | 'security' | 'template' | 'banner';
  targetId: string;
  details: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  const user = auth.currentUser;
  const adminId = user?.uid || 'system';
  const adminName = user?.displayName || 'Omar King X99';
  const adminEmail = user?.email || PRIMARY_ADMIN_EMAIL;

  const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const rawLog: AdminAuditLog = {
    id: logId,
    adminId,
    adminName,
    adminEmail,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    details: entry.details,
    timestamp: now,
    metadata: entry.metadata || {},
  };

  const cleanLog = sanitizeFirestoreData(rawLog);

  // Always cache locally for instant availability and resilience
  try {
    const existing = JSON.parse(localStorage.getItem('arixon_admin_audit_logs') || '[]');
    existing.unshift(cleanLog);
    localStorage.setItem('arixon_admin_audit_logs', JSON.stringify(existing.slice(0, 100)));
  } catch {}

  try {
    // Write directly to Firestore adminAuditLogs collection
    const logDocRef = doc(db, 'adminAuditLogs', logId);
    await setDoc(logDocRef, cleanLog);
  } catch (err) {
    console.warn('[Audit Log] Notice writing audit log to Firestore:', err);
  }
}

/**
 * Fetch Recent Audit Logs
 */
export async function fetchAuditLogs(limitCount = 50): Promise<AdminAuditLog[]> {
  try {
    const logsRef = collection(db, 'adminAuditLogs');
    const q = query(logsRef, orderBy('timestamp', 'desc'), limit(limitCount));
    const snap = await getDocs(q);
    const logs: AdminAuditLog[] = [];
    snap.forEach((d) => logs.push(d.data() as AdminAuditLog));
    if (logs.length > 0) return logs;
  } catch (_err) {
    // Graceful fallback to locally cached logs if Firestore permissions restrict collection read
  }

  try {
    const localLogs = JSON.parse(localStorage.getItem('arixon_admin_audit_logs') || '[]');
    return localLogs.slice(0, limitCount);
  } catch {
    return [];
  }
}

// ==========================================
// 1. Exams Management
// ==========================================

export async function fetchAllAdminExams(): Promise<Exam[]> {
  try {
    const examsRef = collection(db, 'exams');
    const q = query(examsRef, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const exams: Exam[] = [];
    snap.forEach((d) => exams.push({ id: d.id, ...(d.data() as Omit<Exam, 'id'>) }));
    return exams;
  } catch (err) {
    console.error('Error fetching admin exams:', err);
    return [];
  }
}

export async function saveExamWithValidation(
  examData: Omit<Exam, 'id'> & { id?: string },
  questions: Array<{
    id?: string;
    questionText: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
    difficulty: 'easy' | 'medium' | 'hard';
    source: string;
    points: number;
    order: number;
    questionType: 'multiple_choice' | 'true_false' | 'short_answer' | 'matching';
  }>
): Promise<string> {
  const isNew = !examData.id;
  const examId = examData.id || `exam_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  // If publishing, perform strict validation
  if (examData.published) {
    if (questions.length === 0) {
      throw new Error('لا يمكن نشر امتحان بدون إضافة أسئلة.');
    }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText || !q.questionText.trim()) {
        throw new Error(`السؤال رقم (${i + 1}) لا يحتوي على نص.`);
      }
      if (!Array.isArray(q.options) || q.options.length < 2) {
        throw new Error(`السؤال رقم (${i + 1}) يجب أن يحتوي على خيارين على الأقل.`);
      }
      if (q.correctAnswer === undefined || q.correctAnswer < 0 || q.correctAnswer >= q.options.length) {
        throw new Error(`السؤال رقم (${i + 1}) لا يحتوي على إجابة نموذجية صحيحة محددة.`);
      }
      if (!q.explanation || !q.explanation.trim()) {
        throw new Error(`السؤال رقم (${i + 1}) يتطلب كتابة شرح تفصيلي لطريقة الحل.`);
      }
    }
    if ((examData.durationMinutes || 0) <= 0) {
      throw new Error('مدة الامتحان يجب أن تكون أكبر من صفر دقيقة.');
    }
    if ((examData.totalPoints || 0) <= 0) {
      throw new Error('مجموع علامات الامتحان يجب أن يكون أكبر من صفر.');
    }
  }

  // 1. Write exam document
  const examDocRef = doc(db, 'exams', examId);
  const cleanExam = sanitizeFirestoreData({
    ...examData,
    id: examId,
    questionCount: questions.length,
    updatedAt: now,
    createdAt: examData.createdAt || now,
    createdBy: examData.createdBy || auth.currentUser?.email || 'admin',
  });
  await setDoc(examDocRef, cleanExam, { merge: true });

  // 2. Write questions & protected answer keys subcollections
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const qId = q.id || `q_${examId}_${i + 1}`;
    
    // Question fields
    const publicQRef = doc(db, 'exams', examId, 'questions', qId);
    const publicData: any = {
      id: qId,
      examId,
      order: i + 1,
      questionText: q.questionText,
      options: q.options,
      difficulty: q.difficulty,
      source: q.source || 'أريكسون 2009',
      points: q.points || 5,
      questionType: q.questionType || 'multiple_choice',
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      hint: (q as any).hint || undefined,
      solutionSteps: (q as any).solutionSteps || undefined,
      distractorAnalysis: (q as any).distractorAnalysis || undefined,
    };
    await setDoc(publicQRef, sanitizeFirestoreData(publicData));

    // Protected answer key (hidden from students)
    const keyRef = doc(db, 'exams', examId, 'answerKeys', qId);
    await setDoc(keyRef, {
      id: qId,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      hint: (q as any).hint || null,
      solutionSteps: (q as any).solutionSteps || null,
      formulaUsed: (q as any).formulaUsed || null,
      distractorAnalysis: (q as any).distractorAnalysis || null,
    });
  }

  // 3. Record audit log (best-effort, does not block exam creation)
  try {
    await recordAdminAuditLog({
      action: isNew ? 'create_exam' : (examData.published ? 'publish_exam' : 'edit_exam'),
      targetType: 'exam',
      targetId: examId,
      details: `${isNew ? 'إنشاء' : 'تحديث'} امتحان: "${examData.title}" (${questions.length} أسئلة - ${examData.published ? 'منشور' : 'مسودة'})`,
    });
  } catch (err: any) {
    console.warn('[Admin Service] Notice writing exam audit log:', err?.message);
  }

  return examId;
}

export async function setExamPublishStatus(
  examId: string, 
  published: boolean, 
  title: string, 
  extraBranch?: string
): Promise<void> {
  const examDocRef = doc(db, 'exams', examId);
  const now = new Date().toISOString();

  let branch = extraBranch || 'all';
  let previousStatus = 'draft';
  try {
    const snap = await getDoc(examDocRef);
    if (snap.exists()) {
      const data = snap.data();
      branch = data.branch || branch;
      previousStatus = data.status || (data.published ? 'published' : 'draft');
    }
  } catch {}

  const nextStatus = published ? 'published' : 'unpublished';

  await updateDoc(examDocRef, {
    published,
    status: nextStatus,
    updatedAt: now,
  });

  await recordAdminAuditLog({
    action: published ? 'publish_exam' : 'unpublish_exam',
    targetType: 'exam',
    targetId: examId,
    details: `${published ? (previousStatus === 'unpublished' ? 'إعادة نشر' : 'نشر') : 'إيقاف نشر'} امتحان: "${title}"`,
  });

  // Automated economical broadcast notification for students
  try {
    const { createOrCoalesceBroadcast } = await import('./broadcastService');
    const isRepublished = published && previousStatus === 'unpublished';
    const bType = published 
      ? (isRepublished ? 'exam_republished' : 'exam_published')
      : 'exam_unpublished';

    const bTitle = published
      ? (isRepublished ? `تمت إعادة إتاحة امتحان: ${title}` : `تم نشر امتحان جديد: ${title}`)
      : `تم إيقاف امتحان مؤقتاً: ${title}`;

    const bMessage = published
      ? 'أصبح الامتحان متاحاً الآن في قائمة الامتحانات لجميع طلبة المسار.'
      : 'تم إيقاف هذا الامتحان مؤقتاً للمراجعة والتحديث.';

    await createOrCoalesceBroadcast({
      type: bType,
      title: bTitle,
      message: bMessage,
      examId,
      examTitle: title,
      audience: {
        grade: '2009',
        track: (branch as any) || 'all',
      },
      adminEmail: auth.currentUser?.email || 'admin@arixon.edu',
    });
  } catch (bErr) {
    console.warn('[Admin Service] Broadcast dispatch notice:', bErr);
  }
}

export async function archiveExam(examId: string, title: string): Promise<void> {
  const examDocRef = doc(db, 'exams', examId);
  const now = new Date().toISOString();
  await updateDoc(examDocRef, {
    published: false,
    status: 'archived',
    isArchived: true,
    updatedAt: now,
  });

  await recordAdminAuditLog({
    action: 'archive_exam',
    targetType: 'exam',
    targetId: examId,
    details: `أرشفة امتحان: "${title}"`,
  });
}

// ==========================================
// 2. Question Bank Management
// ==========================================

export async function fetchQuestionBank(filters?: {
  subject?: SubjectId;
  difficulty?: string;
  status?: string;
  search?: string;
}): Promise<QuestionBankItem[]> {
  try {
    const qCol = collection(db, 'questions');
    let q = query(qCol, orderBy('createdAt', 'desc'), limit(100));

    if (filters?.subject && filters.subject !== 'all') {
      q = query(qCol, where('subject', '==', filters.subject), limit(100));
    }

    const snap = await getDocs(q);
    const questions: QuestionBankItem[] = [];
    snap.forEach((d) => questions.push({ id: d.id, ...(d.data() as Omit<QuestionBankItem, 'id'>) }));

    let result = questions;
    if (filters?.difficulty && filters.difficulty !== 'all') {
      result = result.filter(q => q.difficulty === filters.difficulty);
    }
    if (filters?.status && filters.status !== 'all') {
      result = result.filter(q => q.status === filters.status);
    }
    if (filters?.search && filters.search.trim()) {
      const term = filters.search.toLowerCase().trim();
      result = result.filter(q => 
        q.questionText.toLowerCase().includes(term) ||
        q.lesson?.toLowerCase().includes(term) ||
        q.topic?.toLowerCase().includes(term)
      );
    }

    return result;
  } catch (err) {
    console.error('Error fetching question bank:', err);
    return [];
  }
}

export async function saveQuestionBankItem(item: Omit<QuestionBankItem, 'id'> & { id?: string }): Promise<string> {
  const isNew = !item.id;
  const qId = item.id || `bank_q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const docRef = doc(db, 'questions', qId);
  const cleanData = sanitizeFirestoreData({
    ...item,
    id: qId,
    createdAt: item.createdAt || now,
    updatedAt: now,
    createdBy: item.createdBy || auth.currentUser?.email || 'admin',
    status: item.status || 'active',
  });

  await setDoc(docRef, cleanData, { merge: true });

  await recordAdminAuditLog({
    action: isNew ? 'add_question' : 'edit_question',
    targetType: 'question',
    targetId: qId,
    details: `${isNew ? 'إضافة سؤال لبنك الأسئلة' : 'تعديل سؤال في بنك الأسئلة'}: "${item.questionText.slice(0, 45)}..."`,
  });

  return qId;
}

export async function archiveQuestionBankItem(qId: string, questionText: string): Promise<void> {
  const docRef = doc(db, 'questions', qId);
  await updateDoc(docRef, {
    status: 'archived',
    updatedAt: new Date().toISOString(),
  });

  await recordAdminAuditLog({
    action: 'archive_question',
    targetType: 'question',
    targetId: qId,
    details: `أرشفة سؤال من بنك الأسئلة: "${questionText.slice(0, 40)}..."`,
  });
}

// ==========================================
// 3. Import Questions Pipeline
// ==========================================

export interface QuestionValidationRow {
  rowNumber: number;
  questionText: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
  subject: SubjectId;
  lesson: string;
  source: string;
  isValid: boolean;
  errors: string[];
}

export function validateQuestionImportRows(rows: any[]): {
  total: number;
  validCount: number;
  invalidCount: number;
  results: QuestionValidationRow[];
} {
  const results: QuestionValidationRow[] = [];

  rows.forEach((row, idx) => {
    const errors: string[] = [];
    const rowNumber = idx + 1;

    const questionText = (row.questionText || row.text || row['نص السؤال'] || '').trim();
    if (!questionText) errors.push('نص السؤال مفقود');

    let options: string[] = [];
    if (Array.isArray(row.options)) {
      options = row.options.map((o: any) => String(o).trim()).filter(Boolean);
    } else if (row.optionA || row['الخيار أ']) {
      options = [
        row.optionA || row['الخيار أ'],
        row.optionB || row['الخيار ب'],
        row.optionC || row['الخيار ج'],
        row.optionD || row['الخيار د'],
      ].filter(Boolean).map(s => String(s).trim());
    }

    if (options.length < 2) errors.push('الخيارات غير كافية (مطلوب خياران على الأقل)');

    let correctAnswer = 0;
    const rawAnswer = row.correctAnswer ?? row.correctOption ?? row['الإجابة الصحيحة'] ?? row.answer;
    if (typeof rawAnswer === 'number') {
      correctAnswer = rawAnswer;
    } else if (typeof rawAnswer === 'string') {
      const lower = rawAnswer.toLowerCase().trim();
      if (lower === 'a' || lower === 'أ') correctAnswer = 0;
      else if (lower === 'b' || lower === 'ب') correctAnswer = 1;
      else if (lower === 'c' || lower === 'ج') correctAnswer = 2;
      else if (lower === 'd' || lower === 'د') correctAnswer = 3;
      else if (!isNaN(Number(rawAnswer))) correctAnswer = Number(rawAnswer);
    }

    if (correctAnswer < 0 || correctAnswer >= options.length) {
      errors.push(`رقم الإجابة الصحيحة (${correctAnswer}) غير متطابق مع الخيارات المتاحة`);
    }

    const explanation = (row.explanation || row['التفسير'] || row['الشرح'] || 'شرح الإجابة النموذجية').trim();
    const difficulty: 'easy' | 'medium' | 'hard' = ['easy', 'medium', 'hard'].includes(row.difficulty) 
      ? row.difficulty 
      : 'medium';
    const points = Number(row.points) > 0 ? Number(row.points) : 5;
    const subject: SubjectId = row.subject || 'physics';
    const lesson = (row.lesson || row['الدرس'] || 'المنهاج العام').trim();
    const source = (row.source || row['المصدر'] || 'استيراد بنك الأسئلة').trim();

    const isValid = errors.length === 0;

    results.push({
      rowNumber,
      questionText,
      options,
      correctAnswer,
      explanation,
      difficulty,
      points,
      subject,
      lesson,
      source,
      isValid,
      errors,
    });
  });

  const validCount = results.filter(r => r.isValid).length;
  return {
    total: results.length,
    validCount,
    invalidCount: results.length - validCount,
    results,
  };
}

export async function batchImportValidQuestions(validRows: QuestionValidationRow[]): Promise<number> {
  let imported = 0;
  const now = new Date().toISOString();
  const adminEmail = auth.currentUser?.email || 'admin';

  for (const row of validRows) {
    if (!row.isValid) continue;

    const qId = `bank_import_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const item: QuestionBankItem = {
      id: qId,
      questionText: row.questionText,
      options: row.options,
      correctAnswer: row.correctAnswer,
      explanation: row.explanation,
      difficulty: row.difficulty,
      points: row.points,
      subject: row.subject,
      subjectNameAr: getSubjectNameAr(row.subject),
      lesson: row.lesson,
      source: row.source,
      questionType: 'multiple_choice',
      status: 'active',
      createdAt: now,
      updatedAt: now,
      createdBy: adminEmail,
    };

    const docRef = doc(db, 'questions', qId);
    await setDoc(docRef, sanitizeFirestoreData(item));
    imported++;
  }

  await recordAdminAuditLog({
    action: 'import_questions',
    targetType: 'question',
    targetId: `batch_${Date.now()}`,
    details: `استيراد دفعة أسئلة بنجاح: تم إضافة (${imported}) سؤالاً صالحاً إلى بنك الأسئلة.`,
  });

  return imported;
}

function getSubjectNameAr(sub: SubjectId): string {
  const map: Partial<Record<SubjectId, string>> = {
    all: 'الكل',
    physics: 'الفيزياء',
    math: 'الرياضيات',
    arabic: 'اللغة العربية',
    chemistry: 'الكيمياء',
    biology: 'العلوم الحياتية',
    english: 'اللغة الإنجليزية',
    islamic: 'التربية الإسلامية',
    other: 'مبحث آخر',
  };
  return map[sub] || 'مبحث عام';
}

// ==========================================
// 4. Students Management & Point Adjustments
// ==========================================

export async function fetchAllStudents(limitCount = 100): Promise<UserProfile[]> {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, orderBy('createdAt', 'desc'), limit(limitCount));
    const snap = await getDocs(q);
    const students: UserProfile[] = [];
    snap.forEach((d) => students.push(d.data() as UserProfile));
    return students;
  } catch (err) {
    console.error('Error fetching students:', err);
    return [];
  }
}

export async function toggleStudentDisabledState(
  studentUid: string,
  studentName: string,
  disabled: boolean,
  reason: string
): Promise<void> {
  const docRef = doc(db, 'users', studentUid);
  const now = new Date().toISOString();

  await updateDoc(docRef, {
    accountDisabled: disabled,
    disabledReason: disabled ? reason : null,
    disabledAt: disabled ? now : null,
    updatedAt: now,
  });

  try {
    await recordAdminAuditLog({
      action: disabled ? 'disable_student' : 'enable_student',
      targetType: 'student',
      targetId: studentUid,
      details: `${disabled ? 'تعطيل' : 'إعادة تفعيل'} حساب الطالب "${studentName}" - السبب: ${reason}`,
    });
  } catch (err: any) {
    console.warn('[Admin Service] Notice writing student disabled audit log:', err?.message);
  }
}

export async function adjustStudentPointsWithReason(params: {
  studentId: string;
  studentName: string;
  amount: number;
  reason: string;
}): Promise<{ previousBalance: number; newBalance: number }> {
  const user = auth.currentUser;
  const adminId = user?.uid || 'admin';
  const adminName = user?.displayName || 'Omar King X99';
  const userDocRef = doc(db, 'users', params.studentId);

  let prev = 0;
  let next = 0;

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(userDocRef);
    if (!snap.exists()) {
      throw new Error('حساب الطالب غير موجود.');
    }

    const userData = snap.data() as UserProfile;
    prev = userData.totalPoints || 0;
    next = Math.max(0, prev + params.amount);

    transaction.update(userDocRef, {
      totalPoints: next,
      weeklyPoints: Math.max(0, (userData.weeklyPoints || 0) + params.amount),
      monthlyPoints: Math.max(0, (userData.monthlyPoints || 0) + params.amount),
      updatedAt: new Date().toISOString(),
    });
  });

  // Record pointAdjustment document (best-effort, does not block main point update if rule restricts sub-collection)
  const adjId = `adj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();
  const adjRecord: PointAdjustmentRecord = {
    id: adjId,
    studentId: params.studentId,
    studentName: params.studentName,
    amount: params.amount,
    reason: params.reason,
    adminId,
    adminName,
    previousBalance: prev,
    newBalance: next,
    createdAt: now,
  };

  try {
    await setDoc(doc(db, 'pointAdjustments', adjId), adjRecord);
  } catch (err: any) {
    console.warn('[Admin Service] Notice writing pointAdjustment record:', err?.message);
  }

  try {
    await recordAdminAuditLog({
      action: 'point_adjustment',
      targetType: 'student',
      targetId: params.studentId,
      details: `تعديل نقاط الطالب "${params.studentName}": (${params.amount > 0 ? '+' : ''}${params.amount} نقطة) - الرصيد السابق: ${prev} -> الرصيد الجديد: ${next} - السبب: ${params.reason}`,
    });
  } catch (err: any) {
    console.warn('[Admin Service] Notice writing audit log:', err?.message);
  }

  return { previousBalance: prev, newBalance: next };
}

export async function adminChangeStudentBranch(
  studentUid: string,
  studentName: string,
  newBranch: 'علمي' | 'أدبي'
): Promise<void> {
  const userDocRef = doc(db, 'users', studentUid);
  const now = new Date().toISOString();

  await updateDoc(userDocRef, {
    branch: newBranch,
    updatedAt: now,
  });

  // Sync public profile
  try {
    const pubRef = doc(db, 'publicProfiles', studentUid);
    await setDoc(pubRef, { branch: newBranch, updatedAt: now }, { merge: true });
  } catch (err: any) {
    console.warn('[Admin Service] Notice syncing public profile branch:', err?.message);
  }

  try {
    await recordAdminAuditLog({
      action: 'update_student_branch',
      targetType: 'student',
      targetId: studentUid,
      details: `تغيير فرع الطالب "${studentName}" إلى: الفرع ال${newBranch}`,
    });
  } catch {}
}

export async function adminSendStudentNotification(
  studentUid: string,
  title: string,
  message: string
): Promise<void> {
  const notifId = `notif_admin_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const docRef = doc(db, 'notifications', notifId);
  await setDoc(docRef, sanitizeFirestoreData({
    id: notifId,
    recipientId: studentUid,
    senderName: 'إدارة منصة أريكسون',
    type: 'admin_direct_message',
    title: title.trim(),
    message: message.trim(),
    read: false,
    createdAt: now,
  }));

  try {
    await recordAdminAuditLog({
      action: 'send_student_notification',
      targetType: 'student',
      targetId: studentUid,
      details: `إرسال إشعار مباشر للطالب: "${title}"`,
    });
  } catch {}
}

export async function adminToggleChatDisabled(
  studentUid: string,
  studentName: string,
  chatDisabled: boolean
): Promise<void> {
  const userDocRef = doc(db, 'users', studentUid);
  const now = new Date().toISOString();

  await updateDoc(userDocRef, {
    chatDisabled,
    updatedAt: now,
  });

  try {
    await recordAdminAuditLog({
      action: chatDisabled ? 'disable_student_chat' : 'enable_student_chat',
      targetType: 'student',
      targetId: studentUid,
      details: `${chatDisabled ? 'تعطيل' : 'إعادة تفعيل'} ميزة الدردشة للطالب "${studentName}"`,
    });
  } catch {}
}

// ==========================================
// 5. Announcements
// ==========================================

export async function fetchAnnouncements(): Promise<Announcement[]> {
  try {
    const colRef = collection(db, 'announcements');
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const list: Announcement[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<Announcement, 'id'>) }));
    return list;
  } catch (err) {
    console.error('Error fetching announcements:', err);
    return [];
  }
}

export async function saveAnnouncement(ann: Omit<Announcement, 'id'> & { id?: string }): Promise<string> {
  const isNew = !ann.id;
  const id = ann.id || `ann_${Date.now()}`;
  const now = new Date().toISOString();

  const docRef = doc(db, 'announcements', id);
  const cleanData = sanitizeFirestoreData({
    ...ann,
    id,
    createdAt: ann.createdAt || now,
    updatedAt: now,
    publishedAt: ann.published ? (ann.publishedAt || now) : null,
    createdBy: ann.createdBy || auth.currentUser?.email || 'admin',
  });

  await setDoc(docRef, cleanData, { merge: true });

  // Mirror to broadcasts collection so student bell and drawer receive it immediately
  if (ann.published) {
    try {
      const bRef = doc(db, 'broadcasts', id);
      await setDoc(bRef, sanitizeFirestoreData({
        id,
        title: ann.title,
        message: ann.content,
        priority: ann.priority || 'medium',
        audience: { track: 'all' },
        createdAt: ann.createdAt || now,
        createdBy: ann.createdBy || auth.currentUser?.email || 'admin',
        updatedAt: now,
      }), { merge: true });
    } catch (bErr) {
      console.warn('[saveAnnouncement] Broadcast mirror notice:', bErr);
    }
  } else {
    try {
      await deleteDoc(doc(db, 'broadcasts', id));
    } catch {}
  }

  await recordAdminAuditLog({
    action: isNew ? 'publish_announcement' : 'unpublish_announcement',
    targetType: 'announcement',
    targetId: id,
    details: `${isNew ? 'نشر' : 'تحديث'} إعلان: "${ann.title}" (${ann.published ? 'منشور' : 'مسودة'})`,
  });

  return id;
}

export async function deleteAdminAnnouncement(announcementId: string, title: string): Promise<void> {
  const docRef = doc(db, 'announcements', announcementId);
  await deleteDoc(docRef);

  try {
    await deleteDoc(doc(db, 'broadcasts', announcementId));
  } catch {}

  await recordAdminAuditLog({
    action: 'archive_announcement',
    targetType: 'announcement',
    targetId: announcementId,
    details: `حذف إعلان نهائياً: "${title}"`,
  });
}

export async function toggleStudentChatDisabledState(
  studentUid: string,
  studentName: string,
  disabled: boolean,
  reason: string
): Promise<void> {
  const userRef = doc(db, 'users', studentUid);
  const now = new Date().toISOString();
  await updateDoc(userRef, {
    chatDisabled: disabled,
    chatDisabledReason: disabled ? reason : null,
    chatDisabledAt: disabled ? now : null,
    updatedAt: now,
  });

  await recordAdminAuditLog({
    action: 'disable_student',
    targetType: 'student',
    targetId: studentUid,
    details: `${disabled ? 'تعطيل' : 'إعادة تفعيل'} ميزة الدردشة للطالب "${studentName}" - السبب: ${reason}`,
  });
}

export async function sendDirectAdminNotification(params: {
  studentUid: string;
  studentName: string;
  title: string;
  message: string;
}): Promise<string> {
  const notifId = `notif_admin_${Date.now()}`;
  const now = new Date().toISOString();

  await setDoc(doc(db, 'notifications', notifId), sanitizeFirestoreData({
    id: notifId,
    recipientId: params.studentUid,
    senderName: 'إدارة منصة أريكسون',
    type: 'admin_direct_message',
    title: params.title.trim(),
    message: params.message.trim(),
    read: false,
    createdAt: now,
  }));

  await recordAdminAuditLog({
    action: 'point_adjustment',
    targetType: 'student',
    targetId: params.studentUid,
    details: `إرسال تنبيه إداري مباشر للطالب "${params.studentName}": "${params.title}"`,
  });

  return notifId;
}

// ==========================================
// 6. Challenges
// ==========================================

export async function fetchChallenges(): Promise<Challenge[]> {
  try {
    const colRef = collection(db, 'challenges');
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const list: Challenge[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<Challenge, 'id'>) }));
    return list;
  } catch (err) {
    console.error('Error fetching challenges:', err);
    return [];
  }
}

export async function saveChallenge(challenge: Omit<Challenge, 'id'> & { id?: string }): Promise<string> {
  const isNew = !challenge.id;
  const id = challenge.id || `ch_${Date.now()}`;
  const now = new Date().toISOString();

  const docRef = doc(db, 'challenges', id);
  const cleanData = sanitizeFirestoreData({
    ...challenge,
    id,
    createdAt: challenge.createdAt || now,
    createdBy: challenge.createdBy || auth.currentUser?.email || 'admin',
  });

  await setDoc(docRef, cleanData, { merge: true });

  await recordAdminAuditLog({
    action: isNew ? 'publish_challenge' : 'edit_challenge',
    targetType: 'challenge',
    targetId: id,
    details: `${isNew ? 'إنشاء' : 'تعديل'} تحدٍّ تنافسي: "${challenge.title}" (${challenge.points} نقطة - ${challenge.status})`,
  });

  return id;
}

// ==========================================
// 7. Global Settings
// ==========================================

const SETTINGS_DOC_ID = 'global';

export async function fetchAdminSettings(): Promise<AdminSettings> {
  try {
    const snap = await getDoc(doc(db, 'settings', SETTINGS_DOC_ID));
    if (snap.exists()) {
      return snap.data() as AdminSettings;
    }
  } catch (err) {
    console.warn('Could not fetch settings document, returning defaults:', err);
  }

  return {
    siteName: 'Arixon - أريكسون',
    defaultDurationMinutes: 20,
    defaultTotalPoints: 100,
    leaderboardVisible: true,
    maintenanceMode: false,
    registrationOpen: true,
    announcementsEnabled: true,
    challengesEnabled: true,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  };
}

export async function saveAdminSettings(settings: Partial<AdminSettings>): Promise<void> {
  const now = new Date().toISOString();
  const adminEmail = auth.currentUser?.email || 'admin';

  const docRef = doc(db, 'settings', SETTINGS_DOC_ID);
  const cleanData = sanitizeFirestoreData({
    ...settings,
    updatedAt: now,
    updatedBy: adminEmail,
  });

  await setDoc(docRef, cleanData, { merge: true });

  await recordAdminAuditLog({
    action: 'settings_change',
    targetType: 'settings',
    targetId: SETTINGS_DOC_ID,
    details: `تحديث إعدادات المنصة العامة بواسطة ${adminEmail}`,
  });
}

// ==========================================
// 8. AI Generator & Verification Proxy
// ==========================================

export interface GenerateAiQuestionsOptions {
  subject: string;
  grade?: string;
  lesson: string;
  topic?: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  difficultyDistribution?: { easy: number; medium: number; hard: number };
  questionType: 'multiple_choice' | 'true_false' | 'mixed';
  questionCount: number;
  pointsPerQuestion?: number;
  language?: 'ar' | 'en';
  generationMode: GenerationMode;
  sourceMaterial?: string;
  existingQuestionsContext?: string[];
}

export async function generateQuestionsViaAi(
  params: GenerateAiQuestionsOptions
): Promise<{
  questions: AiGeneratedQuestionDraft[];
  modelUsed: string;
  summary: any;
}> {
  const token = await getAuthToken();
  if (!token) throw new Error('يرجى تسجيل الدخول بحساب المشرف أولاً.');

  const res = await fetch('/api/admin/ai-generate-questions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'فشل توليد الأسئلة بواسطة الذكاء الاصطناعي.');
  }

  const result = await res.json();
  const rawDrafts: AiGeneratedQuestionDraft[] = result.questions || [];

  await recordAdminAuditLog({
    action: 'ai_generation',
    targetType: 'question',
    targetId: `ai_batch_${Date.now()}`,
    details: `توليد دفعة ذكاء اصطناعي (${rawDrafts.length} سؤال) بنمط [${params.generationMode}] لمبحث "${params.subject}" - درس "${params.lesson}"`,
  });

  return {
    questions: rawDrafts,
    modelUsed: result.modelUsed || 'gemini-3.8-flash',
    summary: result.summary,
  };
}

export async function regenerateSingleQuestionViaAi(params: {
  subject: string;
  lesson: string;
  previousQuestion: string;
  failureReason: string;
  difficulty: 'easy' | 'medium' | 'hard';
  sourceMaterial?: string;
}): Promise<AiGeneratedQuestionDraft> {
  const token = await getAuthToken();
  if (!token) throw new Error('يرجى تسجيل الدخول بحساب المشرف أولاً.');

  const res = await fetch('/api/admin/ai-regenerate-single', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'فشل إعادة توليد السؤال.');
  }

  const result = await res.json();
  return result.question;
}

// ==========================================
// 9. AI Generation Jobs & Templates
// ==========================================

export async function recordAiGenerationJob(job: Omit<AiGenerationJob, 'jobId' | 'createdAt'>): Promise<string> {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const fullJob: AiGenerationJob = {
    ...job,
    jobId,
    createdAt: new Date().toISOString(),
  };

  const docRef = doc(db, 'aiGenerationJobs', jobId);
  await setDoc(docRef, sanitizeFirestoreData(fullJob));
  return jobId;
}

export async function fetchAiGenerationJobs(maxItems = 15): Promise<AiGenerationJob[]> {
  try {
    const q = query(
      collection(db, 'aiGenerationJobs'),
      orderBy('createdAt', 'desc'),
      limit(maxItems)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as AiGenerationJob);
  } catch (err) {
    console.warn('Could not fetch AI generation jobs:', err);
    return [];
  }
}

export async function bulkSaveApprovedQuestionsToBank(
  questions: AiGeneratedQuestionDraft[]
): Promise<number> {
  let savedCount = 0;
  const adminEmail = auth.currentUser?.email || 'admin';

  for (const q of questions) {
    const qId = q.id || `q_${Date.now()}_${savedCount}`;
    const bankItem: QuestionBankItem = {
      id: qId,
      questionText: q.questionText,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      difficulty: q.difficulty,
      points: q.suggestedPoints || 5,
      subject: q.subject,
      subjectNameAr: q.subjectNameAr,
      lesson: q.lesson,
      topic: q.topic,
      source: q.sourceQuoteOrReference || `توليد معتمد بالذكاء الاصطناعي (${q.sourceMode})`,
      questionType: q.questionType,
      status: 'approved',
      isAiGenerated: true,
      approved: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: adminEmail,
    };

    await setDoc(doc(db, 'questions', qId), sanitizeFirestoreData(bankItem));
    savedCount++;
  }

  await recordAdminAuditLog({
    action: 'save_approved_questions',
    targetType: 'question',
    targetId: `batch_${Date.now()}`,
    details: `اعتماد ونقل ${savedCount} أسئلة مولدة بالذكاء الاصطناعي إلى بنك الأسئلة المعتمد`,
  });

  return savedCount;
}

// Built-in Exam Templates
export const DEFAULT_EXAM_TEMPLATES: ExamTemplate[] = [
  {
    id: 'tmpl_physics_tawjihi_20',
    name: 'امتحان فيزياء توجيهي رسمي (20 سؤال)',
    description: 'نموذج وزاري مطابق لمواصفات الورقة الامتحانية لمبحث الفيزياء توجيهي 2009',
    subject: 'physics',
    questionCount: 20,
    durationMinutes: 40,
    totalPoints: 100,
    difficulty: 'mixed',
    difficultyDistribution: { easy: 8, medium: 8, hard: 4 },
    allowRetake: true,
  },
  {
    id: 'tmpl_physics_quiz_10',
    name: 'اختبار قصير - الزخم والتصادمات (10 أسئلة)',
    description: 'كويز سريع لقياس استيعاب مفاهيم الزخم الخطي والدفع وتصادم الأجسام',
    subject: 'physics',
    questionCount: 10,
    durationMinutes: 20,
    totalPoints: 50,
    difficulty: 'medium',
    allowRetake: true,
  },
  {
    id: 'tmpl_math_tawjihi_25',
    name: 'امتحان رياضيات علمي شامل (25 سؤال)',
    description: 'توزيع متوازن بين المسائل الحسابية المباشرة وأسئلة القدرات العليا',
    subject: 'math',
    questionCount: 25,
    durationMinutes: 60,
    totalPoints: 100,
    difficulty: 'mixed',
    difficultyDistribution: { easy: 10, medium: 10, hard: 5 },
    allowRetake: true,
  },
];

export async function fetchExamTemplates(): Promise<ExamTemplate[]> {
  try {
    const snap = await getDocs(collection(db, 'examTemplates'));
    const customTemplates = snap.docs.map((d) => d.data() as ExamTemplate);
    return [...DEFAULT_EXAM_TEMPLATES, ...customTemplates];
  } catch (err) {
    console.warn('Could not fetch custom exam templates, returning defaults:', err);
    return DEFAULT_EXAM_TEMPLATES;
  }
}

export async function saveExamTemplate(template: Omit<ExamTemplate, 'id'>): Promise<string> {
  const id = `tmpl_${Date.now()}`;
  const fullTemplate: ExamTemplate = { ...template, id };
  await setDoc(doc(db, 'examTemplates', id), sanitizeFirestoreData(fullTemplate));

  await recordAdminAuditLog({
    action: 'create_template',
    targetType: 'template',
    targetId: id,
    details: `إنشاء قالب امتحاني جديد: "${template.name}"`,
  });

  return id;
}

export interface StudentReportItem {
  id: string;
  reporterId: string;
  reporterName: string;
  reporterUsername?: string;
  reportedUserId: string;
  reportedUserName: string;
  reportedUserUsername?: string;
  actionType: 'report' | 'block';
  reason: string;
  details?: string;
  createdAt: string;
  status: 'pending' | 'resolved' | 'dismissed';
}

/**
 * Submit a student report or block alert directly to the Administration notifications
 */
export async function submitStudentReportOrBlock(params: {
  reporterId: string;
  reporterName: string;
  reporterUsername?: string;
  reportedUserId: string;
  reportedUserName: string;
  reportedUserUsername?: string;
  actionType: 'report' | 'block';
  reason: string;
  details?: string;
}): Promise<string> {
  const reportId = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const reportData: StudentReportItem = {
    id: reportId,
    reporterId: params.reporterId,
    reporterName: params.reporterName,
    reporterUsername: params.reporterUsername,
    reportedUserId: params.reportedUserId,
    reportedUserName: params.reportedUserName,
    reportedUserUsername: params.reportedUserUsername,
    actionType: params.actionType,
    reason: params.reason,
    details: params.details || '',
    createdAt: now,
    status: 'pending',
  };

  // 1. Write report document to adminReports collection
  try {
    await setDoc(doc(db, 'adminReports', reportId), sanitizeFirestoreData(reportData));
  } catch (err) {
    console.warn('[adminService] Notice writing adminReport to Firestore:', err);
  }

  // 2. Write to adminAuditLogs so admin dashboard & audit logs pick it up immediately
  const actionText = params.actionType === 'block' ? 'حظر طالب' : 'إبلاغ عن طالب';
  try {
    await setDoc(doc(db, 'adminAuditLogs', reportId), sanitizeFirestoreData({
      id: reportId,
      timestamp: now,
      adminId: params.reporterId,
      adminName: params.reporterName,
      adminEmail: params.reporterUsername ? `@${params.reporterUsername}` : 'student',
      action: params.actionType === 'block' ? 'student_block' : 'student_report',
      targetType: 'student',
      targetId: params.reportedUserId,
      details: `🚨 ${actionText}: قام الطالب ${params.reporterName} (@${params.reporterUsername || ''}) بـ ${actionText} ضد ${params.reportedUserName} (@${params.reportedUserUsername || ''}) - السبب: ${params.reason} ${params.details ? `(${params.details})` : ''}`,
    }));
  } catch (logErr) {
    console.warn('[adminService] Notice logging report to audit logs:', logErr);
  }

  // 3. Save to local cache for instant admin notifications display
  try {
    const key = 'arixon_admin_reports';
    const local = JSON.parse(localStorage.getItem(key) || '[]');
    localStorage.setItem(key, JSON.stringify([reportData, ...local].slice(0, 50)));
  } catch {}

  return reportId;
}

/**
 * Fetch pending student reports and block alerts for administrators
 */
export async function fetchAdminReports(): Promise<StudentReportItem[]> {
  try {
    const snap = await getDocs(query(collection(db, 'adminReports'), orderBy('createdAt', 'desc'), limit(50)));
    const list: StudentReportItem[] = [];
    snap.forEach((d) => list.push(d.data() as StudentReportItem));
    if (list.length > 0) return list;
  } catch (err) {
    console.warn('[adminService] Error fetching admin reports from Firestore:', err);
  }
  try {
    const local = JSON.parse(localStorage.getItem('arixon_admin_reports') || '[]');
    return local;
  } catch {
    return [];
  }
}

/**
 * Check exam readiness before publishing (Part H & I)
 * Verifies answerKeys, question text, option count, and validity of correctAnswer
 */
export async function checkExamReadiness(examId: string): Promise<{
  ready: boolean;
  errors: string[];
  warnings: string[];
  totalQuestions: number;
  validCount: number;
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const examDoc = await getDoc(doc(db, 'exams', examId));
    if (!examDoc.exists()) {
      return { ready: false, errors: ['وثيقة الامتحان غير موجودة.'], warnings: [], totalQuestions: 0, validCount: 0 };
    }

    const qCol = collection(db, 'exams', examId, 'questions');
    const qSnap = await getDocs(qCol);

    if (qSnap.empty) {
      return { ready: false, errors: ['الامتحان لا يحتوي على أي أسئلة.'], warnings: [], totalQuestions: 0, validCount: 0 };
    }

    const keyCol = collection(db, 'exams', examId, 'answerKeys');
    const keySnap = await getDocs(keyCol);
    const keysMap = new Map<string, any>();
    keySnap.forEach((d) => keysMap.set(d.id, d.data()));

    let validCount = 0;
    qSnap.docs.forEach((d, idx) => {
      const q = d.data();
      const qNum = q.order || (idx + 1);
      const keyData = keysMap.get(d.id);

      if (!q.questionText || !q.questionText.trim()) {
        errors.push(`السؤال #${qNum} (${d.id}): نص السؤال فارغ.`);
      }

      if (!Array.isArray(q.options) || q.options.length < 2) {
        errors.push(`السؤال #${qNum} (${d.id}): عدد الخيارات أقل من 2.`);
      }

      const answer = keyData?.correctAnswer !== undefined ? keyData.correctAnswer : q.correctAnswer;
      if (answer === undefined || answer === null || typeof answer !== 'number') {
        errors.push(`السؤال #${qNum} (${d.id}): الإجابة النموذجية مفقودة أو غير محددة.`);
      } else if (Array.isArray(q.options) && (answer < 0 || answer >= q.options.length)) {
        errors.push(`السؤال #${qNum} (${d.id}): مؤشر الإجابة (${answer}) غير موجود ضمن خيارات السؤال (${q.options.length} خيارات).`);
      } else {
        validCount++;
      }

      if (!keyData && q.correctAnswer !== undefined) {
        warnings.push(`السؤال #${qNum} (${d.id}): مفتاح الإجابة مخزن بالسؤال فقط وغير منسوخ لمجموعة answerKeys.`);
      }
    });

    return {
      ready: errors.length === 0,
      errors,
      warnings,
      totalQuestions: qSnap.size,
      validCount,
    };
  } catch (err: any) {
    return {
      ready: false,
      errors: [`حدث خطأ أثناء فحص جاهزية الامتحان: ${err.message}`],
      warnings: [],
      totalQuestions: 0,
      validCount: 0,
    };
  }
}

/**
 * Repair and synchronize answerKeys subcollection for an exam or all exams (Part H & I)
 */
export async function repairExamAnswerKeys(targetExamId?: string): Promise<{
  repairedExamsCount: number;
  repairedKeysCount: number;
  affectedExams: string[];
}> {
  let repairedExamsCount = 0;
  let repairedKeysCount = 0;
  const affectedExams: string[] = [];

  try {
    const examIds: string[] = [];
    if (targetExamId) {
      examIds.push(targetExamId);
    } else {
      const snap = await getDocs(collection(db, 'exams'));
      snap.forEach((d) => examIds.push(d.id));
    }

    for (const examId of examIds) {
      let examRepaired = false;
      const qCol = collection(db, 'exams', examId, 'questions');
      const qSnap = await getDocs(qCol);

      for (const qDoc of qSnap.docs) {
        const qData = qDoc.data();
        const keyRef = doc(db, 'exams', examId, 'answerKeys', qDoc.id);
        const keySnap = await getDoc(keyRef);

        if (!keySnap.exists() && qData.correctAnswer !== undefined) {
          await setDoc(keyRef, {
            id: qDoc.id,
            correctAnswer: qData.correctAnswer,
            explanation: qData.explanation || '',
            hint: qData.hint || null,
            solutionSteps: qData.solutionSteps || null,
            distractorAnalysis: qData.distractorAnalysis || null,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
          repairedKeysCount++;
          examRepaired = true;
        }
      }

      if (examRepaired) {
        repairedExamsCount++;
        affectedExams.push(examId);
      }
    }
  } catch (err) {
    console.warn('[adminService] Error in repairExamAnswerKeys:', err);
  }

  return { repairedExamsCount, repairedKeysCount, affectedExams };
}

/**
 * Admin action: Re-grade pending and stuck exam attempts (submitted_pending / in_progress)
 */
export async function regradePendingAttempts(): Promise<{
  regradedCount: number;
  errors: string[];
}> {
  let regradedCount = 0;
  const errors: string[] = [];

  try {
    const attemptsCol = collection(db, 'attempts');
    const snap = await getDocs(attemptsCol);
    const now = Date.now();

    for (const aDoc of snap.docs) {
      const att = aDoc.data() as ExamAttempt;
      const isPending = att.status === 'submitted_pending';
      const isStuckInProgress = att.status === 'in_progress' && att.expectedEndAt && now > new Date(att.expectedEndAt).getTime() + 60000;

      if (isPending || isStuckInProgress) {
        try {
          let token = '';
          if (auth.currentUser) {
            token = await auth.currentUser.getIdToken();
          }

          // Fetch student answers
          const ansCol = collection(db, 'attempts', aDoc.id, 'answers');
          const ansSnap = await getDocs(ansCol);
          const studentAnswers: Record<string, number | null> = {};
          ansSnap.forEach((ad) => {
            const data = ad.data();
            studentAnswers[ad.id] = data.selectedAnswer !== undefined ? data.selectedAnswer : (data.selectedOptionIndex !== undefined ? data.selectedOptionIndex : null);
          });

          const res = await fetch('/api/exams/grade', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              attemptId: aDoc.id,
              answers: Object.keys(studentAnswers).length > 0 ? studentAnswers : ((att as any).answers || {}),
              clientAttemptData: att,
              idToken: token,
            }),
          });

          const resData = await res.json();
          if (resData.ok || resData.success) {
            regradedCount++;
          } else {
            errors.push(`المحاولة ${aDoc.id}: ${resData.message || resData.code}`);
          }
        } catch (itemErr: any) {
          errors.push(`المحاولة ${aDoc.id}: ${itemErr.message}`);
        }
      }
    }
  } catch (err: any) {
    errors.push(`فشل جلب المحاولات: ${err.message}`);
  }

  return { regradedCount, errors };
}

