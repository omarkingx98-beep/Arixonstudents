import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import configJson from '../firebase-applet-config.json' with { type: 'json' };
import { FIRST_EXAM_ID, FIRST_EXAM_QUESTIONS, type QuestionWithKey } from '../src/data/firstExamData';
import { LITERARY_EXAM_ID, LITERARY_EXAM_QUESTIONS } from '../src/data/literaryExamData';

// Initialize Firebase Admin with service account if available, or project fallback
let adminDb: FirebaseFirestore.Firestore | null = null;
let adminHasServiceAccount = false;

export function getAdminFirestore(): FirebaseFirestore.Firestore | null {
  if (!adminDb) {
    if (!getApps().length) {
      const saEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT;
      if (saEnv) {
        try {
          const sa = JSON.parse(saEnv);
          initializeApp({
            credential: cert(sa),
            projectId: sa.project_id || configJson.projectId,
          });
          adminHasServiceAccount = true;
          console.log('[ExamGrader] Firebase Admin initialized with service account.');
        } catch (e) {
          console.warn('[ExamGrader] Failed to parse service account JSON, falling back:', e);
          initializeApp({ projectId: configJson.projectId });
        }
      } else if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
        try {
          initializeApp({
            credential: cert({
              projectId: process.env.FIREBASE_PROJECT_ID || configJson.projectId,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            }),
          });
          adminHasServiceAccount = true;
          console.log('[ExamGrader] Firebase Admin initialized with individual credentials.');
        } catch (e) {
          console.warn('[ExamGrader] Failed to initialize with individual credentials:', e);
          initializeApp({ projectId: configJson.projectId });
        }
      } else {
        initializeApp({ projectId: configJson.projectId });
        console.log('[ExamGrader] Firebase Admin initialized with project ID:', configJson.projectId);
      }
    }
    try {
      adminDb = getFirestore();
    } catch (err) {
      console.warn('[ExamGrader] getFirestore warning:', err);
    }
  }
  return adminDb;
}

export interface SubmissionParams {
  attemptId: string;
  userId: string;
  answers: Record<string, number | null>;
  durationSeconds?: number;
  userEmail?: string;
  idToken?: string;
}

export interface GradingResult {
  success: boolean;
  attempt: any;
  reviews: any[];
  isFirstCompletion: boolean;
  pointsAwarded: number;
  requiresClientSync?: boolean;
}

/**
 * Server-side exam grading and submission.
 * - Server-authoritative: Reads question keys and computes real score.
 * - Idempotent: First completion awards points; retakes do not re-award points.
 * - Robust question matching: Matches by exact question ID, order, and indexes.
 */
export async function gradeAndSubmitExam(params: SubmissionParams): Promise<GradingResult> {
  const db = getAdminFirestore();
  const attemptId = params.attemptId;
  const userId = params.userId;
  const answersMap: Record<string, number | null> = { ...(params.answers || {}) };

  console.log(`[ExamGrader] Starting server-side grading for attempt: ${attemptId}, user: ${userId}, answers received: ${Object.keys(answersMap).length}`);

  let attemptData: any = null;
  let questionsWithKeys: QuestionWithKey[] = [];
  let dbUsable = false;

  // 1. Try to fetch attempt from Admin Firestore if credentials exist
  if (db) {
    try {
      const attemptSnap = await db.collection('attempts').doc(attemptId).get();
      if (attemptSnap.exists) {
        attemptData = attemptSnap.data();
        dbUsable = true;
      }
    } catch (err: any) {
      console.warn('[ExamGrader] Admin Firestore attempt get notice (will use REST/direct fallback if needed):', err?.message);
    }
  }

  // 2. Fallback attempt lookup if admin Firestore is uncredentialed
  if (!attemptData) {
    // Attempt doc might be passed or inferable from ID: att_userId_examId_timestamp
    const parts = attemptId.split('_');
    const examIdFromAttempt = parts.length >= 3 ? parts.slice(2, -1).join('_') : 'exam_arabic_tw2009_01';
    attemptData = {
      id: attemptId,
      userId,
      examId: examIdFromAttempt,
      status: 'in_progress',
      startedAt: new Date(Date.now() - (params.durationSeconds || 60) * 1000).toISOString(),
      expectedEndAt: new Date(Date.now() + 600000).toISOString(),
    };
  }

  // 3. Ownership validation
  if (attemptData.userId && attemptData.userId !== userId) {
    throw new Error('غير مصرح لك بتسليم هذه المحاولة.');
  }

  // 4. Idempotency check: if already submitted, return the existing result
  if (attemptData.status === 'submitted') {
    console.log(`[ExamGrader] Attempt ${attemptId} is already submitted. Returning existing result.`);
    return {
      success: true,
      attempt: { ...attemptData, id: attemptId },
      reviews: attemptData.reviews || [],
      isFirstCompletion: !attemptData.isRetake,
      pointsAwarded: attemptData.pointsEarned || 0,
    };
  }

  const examId = attemptData.examId;
  const examSubject = attemptData.examSubject || '';

  // 5. Retrieve Questions and Answer Keys from Firestore
  if (dbUsable && db) {
    try {
      const qSnap = await db.collection('exams').doc(examId).collection('questions').orderBy('order', 'asc').get();
      if (!qSnap.empty) {
        for (const qDoc of qSnap.docs) {
          const qData = qDoc.data();
          let correctAnswer = qData.correctAnswer ?? 0;
          let explanation = qData.explanation ?? '';
          let hint = qData.hint ?? '';
          let solutionSteps = qData.solutionSteps ?? null;
          let distractorAnalysis = qData.distractorAnalysis ?? null;

          // Try reading protected answerKey
          try {
            const keyDoc = await db.collection('exams').doc(examId).collection('answerKeys').doc(qDoc.id).get();
            if (keyDoc.exists) {
              const keyData = keyDoc.data() || {};
              if (keyData.correctAnswer !== undefined) correctAnswer = keyData.correctAnswer;
              if (keyData.explanation) explanation = keyData.explanation;
              if (keyData.hint) hint = keyData.hint;
              if (keyData.solutionSteps) solutionSteps = keyData.solutionSteps;
              if (keyData.distractorAnalysis) distractorAnalysis = keyData.distractorAnalysis;
            }
          } catch {
            // If answerKeys subcollection has no separate doc, use question's own key
          }

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
            correctAnswer,
            explanation,
            hint,
            solutionSteps,
            distractorAnalysis,
          });
        }
      }
    } catch (err: any) {
      console.warn('[ExamGrader] Could not fetch questions from Firestore subcollection:', err?.message);
    }
  }

  // Fallback to static question banks if Firestore questions were not found or uncredentialed
  if (questionsWithKeys.length === 0) {
    const isArabic = examId === LITERARY_EXAM_ID || examId.includes('arabic') || examSubject.includes('عرب');
    const isPhysics = examId === FIRST_EXAM_ID || examId.includes('physics') || examSubject.includes('فيزياء');

    if (isArabic) {
      questionsWithKeys = LITERARY_EXAM_QUESTIONS;
    } else if (isPhysics) {
      questionsWithKeys = FIRST_EXAM_QUESTIONS;
    } else {
      // Default to Arabic ministerial questions if not matched
      questionsWithKeys = LITERARY_EXAM_QUESTIONS;
    }
  }

  if (questionsWithKeys.length === 0) {
    throw new Error('تعذر العثور على أسئلة ومفاتيح إجابة هذا الامتحان.');
  }

  // 6. Grade the questions with robust multi-key matching
  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;
  let pointsCalculated = 0;
  const reviews: any[] = [];

  for (let idx = 0; idx < questionsWithKeys.length; idx++) {
    const q = questionsWithKeys[idx];
    const qOrder = q.order || (idx + 1);

    // Multi-key matching ensures no answer is lost regardless of how client indexed question IDs:
    let studentAns: number | null = null;
    if (answersMap[q.id] !== undefined && answersMap[q.id] !== null) {
      studentAns = answersMap[q.id];
    } else if (answersMap[q.id.toLowerCase()] !== undefined && answersMap[q.id.toLowerCase()] !== null) {
      studentAns = answersMap[q.id.toLowerCase()];
    } else if (answersMap[`q_${qOrder}`] !== undefined && answersMap[`q_${qOrder}`] !== null) {
      studentAns = answersMap[`q_${qOrder}`];
    } else if (answersMap[`lit_q${qOrder}`] !== undefined && answersMap[`lit_q${qOrder}`] !== null) {
      studentAns = answersMap[`lit_q${qOrder}`];
    } else if (answersMap[`q${qOrder}`] !== undefined && answersMap[`q${qOrder}`] !== null) {
      studentAns = answersMap[`q${qOrder}`];
    } else if (answersMap[String(qOrder)] !== undefined && answersMap[String(qOrder)] !== null) {
      studentAns = answersMap[String(qOrder)];
    } else if (answersMap[String(idx)] !== undefined && answersMap[String(idx)] !== null) {
      studentAns = answersMap[String(idx)];
    } else if (answersMap[`q_${idx}`] !== undefined && answersMap[`q_${idx}`] !== null) {
      studentAns = answersMap[`q_${idx}`];
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
      studentAnswer: isUnanswered ? null : Number(studentAns),
      correctAnswer: Number(q.correctAnswer),
      isCorrect,
      isUnanswered,
      explanation: q.explanation || '',
      hint: q.hint || '',
      solutionSteps: q.solutionSteps || null,
      points: q.points || 5,
      pointsEarned: isCorrect ? (q.points || 5) : 0,
      source: q.source || 'أريكسون',
    });
  }

  const now = new Date();
  const startTime = new Date(attemptData.startedAt || now).getTime();
  const durationSeconds = params.durationSeconds || Math.max(0, Math.floor((now.getTime() - startTime) / 1000));
  const totalQuestions = questionsWithKeys.length;
  const finalScore = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  // 7. Check if this is the user's FIRST completed attempt for this exam (Idempotent Points Rule)
  let isFirstCompletion = true;
  if (dbUsable && db) {
    try {
      const priorAttemptsSnap = await db.collection('attempts')
        .where('userId', '==', userId)
        .where('examId', '==', examId)
        .where('status', '==', 'submitted')
        .limit(2)
        .get();

      const otherSubmitted = priorAttemptsSnap.docs.filter((d) => d.id !== attemptId);
      if (otherSubmitted.length > 0) {
        isFirstCompletion = false;
      }
    } catch (err: any) {
      console.warn('[ExamGrader] Prior attempts check notice:', err?.message);
    }
  }

  const pointsAwarded = isFirstCompletion ? pointsCalculated : 0;
  const submittedAt = now.toISOString();

  const updatedAttemptData = {
    ...attemptData,
    id: attemptId,
    status: 'submitted',
    submittedAt,
    score: finalScore,
    correctCount,
    correctAnswers: correctCount,
    wrongCount,
    wrongAnswers: wrongCount,
    unansweredCount,
    unanswered: unansweredCount,
    pointsEarned: pointsAwarded,
    rawPoints: pointsCalculated,
    durationSeconds,
    durationUsed: durationSeconds,
    lastSavedAt: submittedAt,
    isRetake: !isFirstCompletion,
    reviews,
  };

  // 8. Persist to Firestore if Admin SDK is authenticated
  let wroteToFirestore = false;
  if (dbUsable && db) {
    try {
      const attemptRef = db.collection('attempts').doc(attemptId);
      await attemptRef.set(updatedAttemptData, { merge: true });

      // Save answers in attempts/{id}/answers subcollection
      const batch = db.batch();
      for (const [qId, ans] of Object.entries(answersMap)) {
        if (ans !== null && ans !== undefined) {
          const aRef = attemptRef.collection('answers').doc(qId);
          batch.set(aRef, {
            questionId: qId,
            selectedAnswer: Number(ans),
            answeredAt: submittedAt,
            updatedAt: submittedAt,
          }, { merge: true });
        }
      }
      await batch.commit();

      // Atomic Profile Points Update (Only on first completion)
      if (isFirstCompletion && pointsAwarded > 0) {
        const userRef = db.collection('users').doc(userId);
        const pubRef = db.collection('publicProfiles').doc(userId);

        await db.runTransaction(async (transaction) => {
          const userDoc = await transaction.get(userRef);
          if (userDoc.exists) {
            const uData = userDoc.data() || {};
            const currentTotal = Number(uData.totalPoints) || 0;
            const currentWeekly = Number(uData.weeklyPoints) || 0;
            const currentMonthly = Number(uData.monthlyPoints) || 0;
            const currentExams = Number(uData.examsCompleted) || 0;
            const currentCorrect = Number(uData.correctAnswers) || 0;
            const currentWrong = Number(uData.wrongAnswers) || 0;

            transaction.update(userRef, {
              totalPoints: currentTotal + pointsAwarded,
              weeklyPoints: currentWeekly + pointsAwarded,
              monthlyPoints: currentMonthly + pointsAwarded,
              examsCompleted: currentExams + 1,
              correctAnswers: currentCorrect + correctCount,
              wrongAnswers: currentWrong + wrongCount,
              lastActiveAt: submittedAt,
              updatedAt: submittedAt,
            });

            transaction.set(pubRef, {
              uid: userId,
              totalPoints: currentTotal + pointsAwarded,
              points: currentTotal + pointsAwarded,
              weeklyPoints: currentWeekly + pointsAwarded,
              monthlyPoints: currentMonthly + pointsAwarded,
              examsCompleted: currentExams + 1,
              updatedAt: submittedAt,
            }, { merge: true });
          }
        });
        console.log(`[ExamGrader] Awarded ${pointsAwarded} points to user ${userId} on first exam completion.`);
      }
      wroteToFirestore = true;
    } catch (saveErr: any) {
      console.warn('[ExamGrader] Notice saving to Admin Firestore:', saveErr?.message);
    }
  }

  console.log(`[ExamGrader] Graded attempt ${attemptId}: Score=${finalScore}%, Correct=${correctCount}, Wrong=${wrongCount}, Unanswered=${unansweredCount}, Points=${pointsAwarded}, Status=submitted`);

  return {
    success: true,
    attempt: updatedAttemptData,
    reviews,
    isFirstCompletion,
    pointsAwarded,
    requiresClientSync: !wroteToFirestore,
  };
}

/**
 * Auto-close any in_progress attempts that exceeded expectedEndAt
 */
export async function autoCloseExpiredAttempts(userId: string): Promise<number> {
  const db = getAdminFirestore();
  if (!db) return 0;

  try {
    const snap = await db.collection('attempts')
      .where('userId', '==', userId)
      .where('status', '==', 'in_progress')
      .get();

    let closedCount = 0;
    const now = Date.now();

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const endTime = new Date(data.expectedEndAt || 0).getTime();
      if (endTime < now) {
        // Expired! Fetch any answers and auto grade
        console.log(`[ExamGrader] Auto-closing expired attempt: ${docSnap.id}`);
        try {
          const answersSnap = await docSnap.ref.collection('answers').get();
          const answers: Record<string, number | null> = {};
          answersSnap.forEach(aDoc => {
            answers[aDoc.id] = aDoc.data().selectedAnswer;
          });

          await gradeAndSubmitExam({
            attemptId: docSnap.id,
            userId,
            answers,
          });
          closedCount++;
        } catch (err: any) {
          console.warn(`[ExamGrader] Error auto-closing attempt ${docSnap.id}:`, err?.message);
        }
      }
    }
    return closedCount;
  } catch (err: any) {
    console.warn('[ExamGrader] autoCloseExpiredAttempts error:', err?.message);
    return 0;
  }
}
