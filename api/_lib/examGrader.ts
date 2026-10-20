import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { firebaseAppConfig } from './config.js';
import { 
  FIRST_EXAM_ID, 
  FIRST_EXAM_QUESTIONS, 
  LITERARY_EXAM_ID, 
  LITERARY_EXAM_QUESTIONS, 
  type QuestionWithKey 
} from './examData.js';

export type ExamErrorCode =
  | 'SUCCESS'
  | 'AUTH_FAILED'
  | 'NO_ADMIN_CREDENTIALS'
  | 'ATTEMPT_NOT_FOUND'
  | 'ALREADY_SUBMITTED'
  | 'ANSWER_KEYS_MISSING'
  | 'WRITE_FAILED'
  | 'TIMEOUT';

export interface GradeResult {
  ok: boolean;
  code: ExamErrorCode;
  message: string;
  step: string;
  attempt?: any;
  reviews?: any[];
  pointsAwarded?: number;
  isFirstCompletion?: boolean;
  requiresClientSync?: boolean;
}

// Timeout helper to ensure NO operation ever hangs
function withTimeout<T>(promise: Promise<T>, ms: number, stepName: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`TIMEOUT: Operation timed out after ${ms}ms at step: ${stepName}`));
    }, ms);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// Global cached Firestore instance
let adminDb: FirebaseFirestore.Firestore | null = null;
let adminHasValidServiceAccount = false;
let adminInitAttempted = false;

export function getAdminFirestore(): { db: FirebaseFirestore.Firestore | null; hasServiceAccount: boolean } {
  if (adminInitAttempted) {
    return { db: adminDb, hasServiceAccount: adminHasValidServiceAccount };
  }
  adminInitAttempted = true;

  try {
    const saEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const projectId = process.env.FIREBASE_PROJECT_ID || firebaseAppConfig.projectId;

    if (saEnv) {
      try {
        const sa = JSON.parse(saEnv);
        if (!getApps().length) {
          initializeApp({
            credential: cert(sa),
            projectId: sa.project_id || projectId,
          });
        }
        adminDb = getFirestore();
        adminHasValidServiceAccount = true;
        console.log('[ExamGrader] Firebase Admin initialized with full service account JSON.');
      } catch (err: any) {
        console.warn('[ExamGrader] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON:', err?.message);
      }
    } else if (clientEmail && privateKey) {
      try {
        const cleanPrivateKey = privateKey.replace(/\\n/g, '\n');
        if (!getApps().length) {
          initializeApp({
            credential: cert({
              projectId,
              clientEmail,
              privateKey: cleanPrivateKey,
            }),
          });
        }
        adminDb = getFirestore();
        adminHasValidServiceAccount = true;
        console.log('[ExamGrader] Firebase Admin initialized with clientEmail and privateKey.');
      } catch (err: any) {
        console.warn('[ExamGrader] Failed to initialize with individual credentials:', err?.message);
      }
    } else {
      // CRITICAL VERCEL FIX:
      // Do NOT call initializeApp without credentials on Vercel/Lambda!
      // Doing so triggers a 60-second metadata server hang (169.254.169.254).
      console.warn('[ExamGrader] Notice: No Firebase service account credentials found in environment (FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY). Client-authoritative sync will be utilized.');
      adminHasValidServiceAccount = false;
      adminDb = null;
    }
  } catch (initErr: any) {
    console.warn('[ExamGrader] Firebase Admin initialization error:', initErr?.message);
    adminHasValidServiceAccount = false;
    adminDb = null;
  }

  return { db: adminDb, hasServiceAccount: adminHasValidServiceAccount };
}

/**
 * Grade and Submit Exam
 * Fast, atomic, idempotent, step-by-step diagnostic logging.
 */
export async function gradeAndSubmitExam(params: {
  attemptId: string;
  userId: string;
  answers: Record<string, number | null>;
  clientAttemptData?: any;
  durationSeconds?: number;
  userEmail?: string;
  idToken?: string;
}): Promise<GradeResult> {
  const startTime = Date.now();
  const { attemptId, userId, answers = {}, durationSeconds } = params;
  let currentStep = 'VALIDATE_INPUT';

  console.log(`[ExamGrader] Step 1 [${currentStep}]: Starting grading for attempt: ${attemptId}, user: ${userId}, answers count: ${Object.keys(answers).length}`);

  if (!attemptId || !userId) {
    return {
      ok: false,
      code: 'AUTH_FAILED',
      message: 'معرف المحاولة أو معرف المستخدم مفقود.',
      step: currentStep,
    };
  }

  const { db, hasServiceAccount } = getAdminFirestore();

  // 1. Retrieve Attempt Document
  currentStep = 'FETCH_ATTEMPT';
  let attemptData: any = params.clientAttemptData || null;

  if (hasServiceAccount && db) {
    try {
      const attemptDoc = await withTimeout(
        db.collection('attempts').doc(attemptId).get(),
        4000,
        'FETCH_ATTEMPT'
      );
      if (attemptDoc.exists) {
        attemptData = attemptDoc.data();
      }
    } catch (err: any) {
      console.warn(`[ExamGrader] Notice reading attempt from Firestore at step ${currentStep}:`, err?.message);
    }
  }

  if (!attemptData) {
    // If not in Firestore and no clientAttemptData passed, we cannot proceed
    return {
      ok: false,
      code: 'ATTEMPT_NOT_FOUND',
      message: 'تعذر العثور على وثيقة المحاولة في قاعدة البيانات.',
      step: currentStep,
    };
  }

  // 2. Ownership Check
  currentStep = 'OWNERSHIP_CHECK';
  if (attemptData.userId && attemptData.userId !== userId) {
    console.error(`[ExamGrader] Ownership mismatch: attempt user ${attemptData.userId} vs request user ${userId}`);
    return {
      ok: false,
      code: 'AUTH_FAILED',
      message: 'غير مصرح لك بتسليم هذه المحاولة.',
      step: currentStep,
    };
  }

  // 3. Idempotency Check: if already submitted, return existing result without duplicate points
  currentStep = 'IDEMPOTENCY_CHECK';
  if (attemptData.status === 'submitted') {
    console.log(`[ExamGrader] Attempt ${attemptId} is already submitted. Returning existing result (idempotent).`);
    return {
      ok: true,
      code: 'ALREADY_SUBMITTED',
      message: 'تم تسليم هذا الامتحان مسبقاً.',
      step: currentStep,
      attempt: { ...attemptData, id: attemptId },
      reviews: attemptData.reviews || [],
      isFirstCompletion: false,
      pointsAwarded: 0,
    };
  }

  // 4. Retrieve Questions & Answer Keys
  currentStep = 'FETCH_QUESTIONS_AND_KEYS';
  const examId = attemptData.examId || '';
  const examSubject = attemptData.examSubject || '';
  let questionsWithKeys: QuestionWithKey[] = [];

  if (hasServiceAccount && db) {
    try {
      const qSnap = await withTimeout(
        db.collection('exams').doc(examId).collection('questions').orderBy('order', 'asc').get(),
        4000,
        'FETCH_QUESTIONS'
      );

      if (!qSnap.empty) {
        // Read answerKeys in parallel with a single Promise.all
        const keyPromises = qSnap.docs.map((doc) =>
          db.collection('exams').doc(examId).collection('answerKeys').doc(doc.id).get().catch(() => null)
        );
        const keyDocs = await withTimeout(Promise.all(keyPromises), 4000, 'FETCH_KEYS');
        const keysMap = new Map<string, any>();
        keyDocs.forEach((kd) => {
          if (kd && kd.exists) {
            keysMap.set(kd.id, kd.data());
          }
        });

        qSnap.docs.forEach((qDoc) => {
          const qData = qDoc.data();
          const keyData = keysMap.get(qDoc.id) || {};
          questionsWithKeys.push({
            id: qDoc.id,
            examId,
            order: qData.order || (questionsWithKeys.length + 1),
            questionText: qData.questionText || '',
            options: qData.options || [],
            difficulty: qData.difficulty || 'medium',
            source: qData.source || 'أريكسون',
            points: qData.points || 5,
            questionType: qData.questionType || 'multiple_choice',
            correctAnswer: keyData.correctAnswer !== undefined ? keyData.correctAnswer : (qData.correctAnswer ?? 0),
            explanation: keyData.explanation || qData.explanation || '',
            hint: keyData.hint || qData.hint || '',
            solutionSteps: keyData.solutionSteps || qData.solutionSteps || null,
            distractorAnalysis: keyData.distractorAnalysis || qData.distractorAnalysis || null,
          });
        });
      }
    } catch (err: any) {
      console.warn(`[ExamGrader] Notice reading Firestore questions at step ${currentStep}:`, err?.message);
    }
  }

  // Fallback to verified ministerial banks
  if (questionsWithKeys.length === 0) {
    const isArabic = examId === LITERARY_EXAM_ID || examId.includes('arabic') || examSubject.includes('عرب');
    const isPhysics = examId === FIRST_EXAM_ID || examId.includes('physics') || examSubject.includes('فيزياء');

    if (isPhysics) {
      questionsWithKeys = FIRST_EXAM_QUESTIONS;
    } else if (isArabic) {
      questionsWithKeys = LITERARY_EXAM_QUESTIONS;
    } else {
      questionsWithKeys = LITERARY_EXAM_QUESTIONS;
    }
  }

  if (questionsWithKeys.length === 0) {
    return {
      ok: false,
      code: 'ANSWER_KEYS_MISSING',
      message: 'تعذر العثور على أسئلة ومفاتيح إجابة هذا الامتحان.',
      step: currentStep,
    };
  }

  // 5. Grade with Multi-Key Matching
  currentStep = 'GRADE_QUESTIONS';
  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;
  let pointsCalculated = 0;
  const reviews: any[] = [];

  for (let idx = 0; idx < questionsWithKeys.length; idx++) {
    const q = questionsWithKeys[idx];
    const qOrder = q.order || (idx + 1);

    // Multi-key matching ensures no answer is lost regardless of index notation
    let studentAns: number | null = null;
    if (answers[q.id] !== undefined && answers[q.id] !== null) {
      studentAns = answers[q.id];
    } else if (answers[q.id.toLowerCase()] !== undefined && answers[q.id.toLowerCase()] !== null) {
      studentAns = answers[q.id.toLowerCase()];
    } else if (answers[`q_${qOrder}`] !== undefined && answers[`q_${qOrder}`] !== null) {
      studentAns = answers[`q_${qOrder}`];
    } else if (answers[`lit_q${qOrder}`] !== undefined && answers[`lit_q${qOrder}`] !== null) {
      studentAns = answers[`lit_q${qOrder}`];
    } else if (answers[`q${qOrder}`] !== undefined && answers[`q${qOrder}`] !== null) {
      studentAns = answers[`q${qOrder}`];
    } else if (answers[String(qOrder)] !== undefined && answers[String(qOrder)] !== null) {
      studentAns = answers[String(qOrder)];
    } else if (answers[String(idx)] !== undefined && answers[String(idx)] !== null) {
      studentAns = answers[String(idx)];
    } else if (answers[`q_${idx}`] !== undefined && answers[`q_${idx}`] !== null) {
      studentAns = answers[`q_${idx}`];
    }

    const isUnanswered = studentAns === null || studentAns === undefined;
    const isCorrect = !isUnanswered && Number(studentAns) === Number(q.correctAnswer);

    if (isCorrect) {
      correctCount++;
      pointsCalculated += (q.points || 5);
    } else if (isUnanswered) {
      unansweredCount++;
    } else {
      wrongCount++;
    }

    reviews.push({
      questionId: q.id,
      questionNumber: qOrder,
      questionText: q.questionText,
      options: q.options,
      studentAnswer: studentAns,
      correctAnswer: q.correctAnswer,
      isCorrect,
      isUnanswered,
      explanation: q.explanation || '',
      hint: q.hint || '',
      solutionSteps: q.solutionSteps || null,
      formulaUsed: q.formulaUsed || null,
      distractorAnalysis: q.distractorAnalysis || null,
      points: q.points || 5,
    });
  }

  const totalQuestions = questionsWithKeys.length;
  const scorePercent = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const nowIso = new Date().toISOString();

  // Compute duration used
  let durationUsed = 0;
  if (attemptData.startedAt) {
    const startedMs = new Date(attemptData.startedAt).getTime();
    if (!isNaN(startedMs)) {
      durationUsed = Math.max(1, Math.round((Date.now() - startedMs) / 1000));
    }
  }

  // Idempotent points check: award points only on the FIRST completion of an exam
  const isRetake = Boolean(attemptData.isRetake);
  let isFirstCompletion = !isRetake;
  let pointsAwarded = isFirstCompletion ? pointsCalculated : 0;

  // 6. Write to Firestore Atomic Batch/Transaction
  currentStep = 'WRITE_RESULTS_AND_POINTS';
  const updatedAttempt = {
    ...attemptData,
    id: attemptId,
    status: 'submitted',
    submittedAt: nowIso,
    score: scorePercent,
    correctCount,
    wrongCount,
    unansweredCount,
    durationUsed,
    pointsEarned: pointsAwarded,
    answers,
    reviews,
  };

  let writeSucceeded = false;
  if (hasServiceAccount && db) {
    try {
      await withTimeout(
        db.runTransaction(async (transaction) => {
          const attemptRef = db.collection('attempts').doc(attemptId);
          const userRef = db.collection('users').doc(userId);

          // Check if user already completed this exam before
          const userDoc = await transaction.get(userRef);
          if (userDoc.exists) {
            const uData = userDoc.data() || {};
            // If already completed in past, don't award duplicate points
            if (uData.completedExamIds && Array.isArray(uData.completedExamIds) && uData.completedExamIds.includes(examId)) {
              isFirstCompletion = false;
              pointsAwarded = 0;
              updatedAttempt.pointsEarned = 0;
            }

            const currentTotal = uData.totalPoints || 0;
            const currentExams = uData.examsCompleted || 0;
            const currentCorrect = uData.correctAnswers || 0;
            const currentWrong = uData.wrongAnswers || 0;

            transaction.update(userRef, {
              totalPoints: currentTotal + pointsAwarded,
              weeklyPoints: (uData.weeklyPoints || 0) + pointsAwarded,
              monthlyPoints: (uData.monthlyPoints || 0) + pointsAwarded,
              examsCompleted: currentExams + (isFirstCompletion ? 1 : 0),
              correctAnswers: currentCorrect + correctCount,
              wrongAnswers: currentWrong + wrongCount,
              completedExamIds: FieldValue.arrayUnion(examId),
              updatedAt: nowIso,
              lastActiveAt: nowIso,
            });
          }

          transaction.set(attemptRef, updatedAttempt, { merge: true });
        }),
        6000,
        'WRITE_TRANSACTION'
      );
      writeSucceeded = true;
    } catch (writeErr: any) {
      console.warn(`[ExamGrader] Firestore transaction warning at ${currentStep}:`, writeErr?.message);
    }
  }

  const elapsed = Date.now() - startTime;
  console.log(`[ExamGrader] Grading completed in ${elapsed}ms: score=${scorePercent}%, correct=${correctCount}, wrong=${wrongCount}, unanswered=${unansweredCount}, points=${pointsAwarded}, serverWrite=${writeSucceeded}`);

  return {
    ok: true,
    code: 'SUCCESS',
    message: 'تم تصحيح وتسليم الامتحان بنجاح.',
    step: currentStep,
    attempt: updatedAttempt,
    reviews,
    pointsAwarded,
    isFirstCompletion,
    requiresClientSync: !writeSucceeded,
  };
}

/**
 * Auto-close expired attempts past their allowed duration
 */
export async function autoCloseExpiredAttempts(userId?: string): Promise<{ closedCount: number }> {
  const { db, hasServiceAccount } = getAdminFirestore();
  if (!hasServiceAccount || !db) return { closedCount: 0 };

  let closedCount = 0;
  try {
    let queryRef: FirebaseFirestore.Query = db.collection('attempts').where('status', '==', 'in_progress');
    if (userId) {
      queryRef = queryRef.where('userId', '==', userId);
    }

    const snap = await withTimeout(queryRef.limit(20).get(), 5000, 'FETCH_EXPIRED');
    const now = Date.now();

    for (const doc of snap.docs) {
      const data = doc.data();
      const expectedEndAt = data.expectedEndAt ? new Date(data.expectedEndAt).getTime() : 0;
      if (expectedEndAt && now > expectedEndAt + 60000) {
        console.log(`[ExamGrader] Auto-closing expired attempt: ${doc.id}`);
        await gradeAndSubmitExam({
          attemptId: doc.id,
          userId: data.userId,
          answers: data.answers || {},
          clientAttemptData: data,
        });
        closedCount++;
      }
    }
  } catch (err: any) {
    console.warn('[ExamGrader] Notice auto-closing expired attempts:', err?.message);
  }

  return { closedCount };
}
