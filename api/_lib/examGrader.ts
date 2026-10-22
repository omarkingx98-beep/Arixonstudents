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
import { getRestDoc, getRestCollection, patchRestDoc } from './firestoreRest.js';

export type ExamErrorCode =
  | 'SUCCESS'
  | 'AUTH_FAILED'
  | 'VALIDATE_INPUT'
  | 'NO_ADMIN_CREDENTIALS'
  | 'ATTEMPT_NOT_FOUND'
  | 'ALREADY_SUBMITTED'
  | 'ANSWER_KEYS_MISSING'
  | 'ANSWER_KEYS_UNAVAILABLE'
  | 'FIRESTORE_ERROR'
  | 'WRITE_FAILED'
  | 'TIMEOUT';

export interface GradeResult {
  ok: boolean;
  code: ExamErrorCode;
  message: string;
  step: string;
  line?: string;
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

  try {
    console.log(`[ExamGrader] Step 1 [${currentStep}]: Starting grading for attempt: ${attemptId}, user: ${userId}, answers count: ${Object.keys(answers).length}`);

    if (!attemptId || !userId) {
      console.error(`[ExamGrader 400 ERROR] code=AUTH_FAILED, message="معرف المحاولة أو معرف المستخدم مفقود", step="${currentStep}", examId="${params.clientAttemptData?.examId || 'unknown'}", attemptId="${attemptId || 'missing'}", uid="${userId || 'missing'}", line="api/_lib/examGrader.ts:145"`);
      return {
        ok: false,
        code: 'AUTH_FAILED',
        message: 'معرف المحاولة أو معرف المستخدم مفقود.',
        step: currentStep,
        line: 'api/_lib/examGrader.ts:145',
      };
    }

    const { db, hasServiceAccount } = getAdminFirestore();

    const isAdminUser = Boolean(
      params.userEmail && [
        'omar88x99@gmail.com',
        'omarkingx99@gmail.com',
        'omarkingx98@gmail.com'
      ].includes(params.userEmail.toLowerCase().trim())
    );

    const credentialSource: 'service_account' | 'user_token' | 'none' = 
      hasServiceAccount ? 'service_account' : (isAdminUser && params.idToken ? 'user_token' : 'none');

    console.log(`[ExamGrader] credentialSource: ${credentialSource}, attempt: ${attemptId}, uid: ${userId}`);

    // 1. Retrieve Attempt Document (via Admin SDK, REST API, or Client Payload)
    currentStep = 'FETCH_ATTEMPT';
    let attemptData: any = params.clientAttemptData || null;

    if (!attemptData && hasServiceAccount && db) {
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

    // REST API fallback for attempt retrieval if Admin SDK is unconfigured
    if (!attemptData && params.idToken) {
      try {
        const restDoc = await getRestDoc(`attempts/${attemptId}`, params.idToken);
        if (restDoc) {
          attemptData = restDoc;
        }
      } catch (restErr: any) {
        console.warn(`[ExamGrader] Notice REST fetch for attempt ${attemptId}:`, restErr?.message);
      }
    }

    // Auto-infer examId and attempt metadata from attemptId string format: att_{uid}_{examId}_{timestamp}
    if (!attemptData && attemptId.startsWith('att_')) {
      const parts = attemptId.split('_');
      // format: att, [uid_prefix], [exam], [id_parts...], [timestamp]
      if (parts.length >= 4) {
        const inferredExamId = parts.slice(2, -1).join('_');
        console.log(`[ExamGrader] Auto-inferred attempt metadata from ID: examId=${inferredExamId}, user=${userId}`);
        attemptData = {
          id: attemptId,
          examId: inferredExamId,
          userId,
          status: 'in_progress',
          startedAt: new Date(Date.now() - 600000).toISOString(),
          expectedEndAt: new Date(Date.now() + 600000).toISOString(),
        };
      }
    }

    // If attemptData was supplied but is missing examId or userId, auto-fill from attemptId/params
    if (attemptData && !attemptData.examId && attemptId.startsWith('att_')) {
      const parts = attemptId.split('_');
      if (parts.length >= 4) {
        attemptData.examId = parts.slice(2, -1).join('_');
        console.log(`[ExamGrader] Auto-filled missing attemptData.examId from attemptId: ${attemptData.examId}`);
      }
    }
    if (attemptData && !attemptData.userId) {
      attemptData.userId = userId;
    }

    if (!attemptData) {
      console.error(`[ExamGrader 404 ERROR] code=ATTEMPT_NOT_FOUND, message="تعذر العثور على وثيقة المحاولة في قاعدة البيانات", step="${currentStep}", examId="unknown", attemptId="${attemptId}", uid="${userId}", line="api/_lib/examGrader.ts:215"`);
      return {
        ok: false,
        code: 'ATTEMPT_NOT_FOUND',
        message: 'تعذر العثور على وثيقة المحاولة في قاعدة البيانات.',
        step: currentStep,
        line: 'api/_lib/examGrader.ts:215',
      };
    }

    // 2. Ownership Check
    currentStep = 'OWNERSHIP_CHECK';
    if (attemptData.userId && attemptData.userId !== userId) {
      console.error(`[ExamGrader 401 ERROR] code=AUTH_FAILED, message="غير مصرح لك بتسليم هذه المحاولة", step="${currentStep}", examId="${attemptData.examId || 'unknown'}", attemptId="${attemptId}", uid="${userId}", line="api/_lib/examGrader.ts:228"`);
      return {
        ok: false,
        code: 'AUTH_FAILED',
        message: 'غير مصرح لك بتسليم هذه المحاولة.',
        step: currentStep,
        line: 'api/_lib/examGrader.ts:228',
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
  let questionsWithKeys: QuestionWithKey[] = [];

  // 4a. Fetch from Admin Firestore SDK
  if (hasServiceAccount && db && examId) {
    try {
      const qSnap = await withTimeout(
        db.collection('exams').doc(examId).collection('questions').get(),
        4000,
        'FETCH_QUESTIONS'
      );

      if (!qSnap.empty) {
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

        const sortedDocs = [...qSnap.docs].sort((a, b) => (a.data().order || 0) - (b.data().order || 0));
        let anyKeyMissing = false;

        for (let idx = 0; idx < sortedDocs.length; idx++) {
          const qDoc = sortedDocs[idx];
          const qData = qDoc.data();
          const keyData = keysMap.get(qDoc.id);

          const ansKey = keyData?.correctAnswer !== undefined 
            ? keyData.correctAnswer 
            : (qData.correctAnswer !== undefined ? qData.correctAnswer : undefined);

          if (ansKey === undefined) {
            console.error(`[ExamGrader] Missing answer key for question: ${qDoc.id} in exam: ${examId}`);
            anyKeyMissing = true;
            break;
          }

          questionsWithKeys.push({
            id: qDoc.id,
            examId,
            order: qData.order || (idx + 1),
            questionText: qData.questionText || '',
            options: qData.options || [],
            difficulty: qData.difficulty || 'medium',
            source: qData.source || 'أريكسون',
            points: qData.points || 5,
            questionType: qData.questionType || 'multiple_choice',
            correctAnswer: ansKey,
            explanation: keyData?.explanation || qData.explanation || '',
            hint: keyData?.hint || qData.hint || '',
            solutionSteps: keyData?.solutionSteps || qData.solutionSteps || null,
            distractorAnalysis: keyData?.distractorAnalysis || qData.distractorAnalysis || null,
          });
        }

        if (anyKeyMissing) {
          questionsWithKeys = [];
        }
      }
    } catch (err: any) {
      console.warn(`[ExamGrader] Notice reading Firestore questions at step ${currentStep}:`, err?.message);
    }
  }

  // 4b. REST API fallback ONLY if Admin token is available (never with regular student token for answerKeys)
  if (questionsWithKeys.length === 0 && examId && credentialSource === 'user_token') {
    try {
      const restDocs = await getRestCollection(`exams/${examId}/questions`, params.idToken);
      if (restDocs.length > 0) {
        const restKeysMap = new Map<string, any>();
        try {
          const restKeyDocs = await getRestCollection(`exams/${examId}/answerKeys`, params.idToken);
          restKeyDocs.forEach((kd) => restKeysMap.set(kd.id, kd.data));
        } catch (_) {}

        restDocs.sort((a, b) => (a.data.order || 0) - (b.data.order || 0));
        let anyKeyMissing = false;

        for (let idx = 0; idx < restDocs.length; idx++) {
          const qItem = restDocs[idx];
          const qData = qItem.data;
          const keyData = restKeysMap.get(qItem.id);
          const ansKey = keyData?.correctAnswer !== undefined 
            ? keyData.correctAnswer 
            : (qData.correctAnswer !== undefined ? qData.correctAnswer : undefined);

          if (ansKey === undefined) {
            anyKeyMissing = true;
            break;
          }

          questionsWithKeys.push({
            id: qItem.id,
            examId,
            order: qData.order || (idx + 1),
            questionText: qData.questionText || '',
            options: qData.options || [],
            difficulty: qData.difficulty || 'medium',
            source: qData.source || 'أريكسون',
            points: qData.points || 5,
            questionType: qData.questionType || 'multiple_choice',
            correctAnswer: ansKey,
            explanation: keyData?.explanation || qData.explanation || '',
            hint: keyData?.hint || qData.hint || '',
            solutionSteps: keyData?.solutionSteps || qData.solutionSteps || null,
            distractorAnalysis: keyData?.distractorAnalysis || qData.distractorAnalysis || null,
          });
        }

        if (anyKeyMissing) {
          questionsWithKeys = [];
        }
      }
    } catch (restQErr: any) {
      console.warn(`[ExamGrader] Notice REST fetch for questions of exam ${examId}:`, restQErr?.message);
    }
  }

  // 4c. Built-in verified ministerial banks ONLY for official ministerial exams (strict ID match)
  const isMinisterialPhysics = examId === FIRST_EXAM_ID || examId === 'exam_physics_tw2009_01';
  const isMinisterialArabic = examId === LITERARY_EXAM_ID || examId === 'exam_arabic_tw2009_01';

  if (questionsWithKeys.length === 0 && (isMinisterialPhysics || isMinisterialArabic)) {
    if (isMinisterialPhysics) {
      questionsWithKeys = FIRST_EXAM_QUESTIONS;
    } else if (isMinisterialArabic) {
      questionsWithKeys = LITERARY_EXAM_QUESTIONS;
    }
  }

  // If questionsWithKeys is still empty -> return ANSWER_KEYS_UNAVAILABLE
  if (questionsWithKeys.length === 0) {
    const errCode: ExamErrorCode = 'ANSWER_KEYS_UNAVAILABLE';
    const errMsg = 'مفاتيح إجابة هذا الامتحان غير متوفرة أو تعذّر الوصول إليها بصلاحيات الخادم.';
    console.error(`[ExamGrader 500 ERROR] code=${errCode}, message="${errMsg}", step="${currentStep}", examId="${examId}", attemptId="${attemptId}", uid="${userId}", credentialSource="${credentialSource}", line="api/_lib/examGrader.ts:380"`);

    // Safety net: mark attempt as submitted_pending with 0 points
    if (attemptId && (hasServiceAccount || params.idToken)) {
      try {
        await patchRestDoc(`attempts/${attemptId}`, {
          status: 'submitted_pending',
          pendingReason: 'ANSWER_KEYS_UNAVAILABLE',
          submittedAt: new Date().toISOString(),
          score: null,
          pointsEarned: 0,
        }, params.idToken);
      } catch (_) {}
    }

    return {
      ok: false,
      code: errCode,
      message: errMsg,
      step: currentStep,
      line: 'api/_lib/examGrader.ts:380',
    };
  }

  // 5. Grade with Option-ID Invariant Matching
  currentStep = 'GRADE_QUESTIONS';
  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;
  let pointsCalculated = 0;
  const reviews: any[] = [];

  for (let idx = 0; idx < questionsWithKeys.length; idx++) {
    const q = questionsWithKeys[idx];
    const qOrder = q.order || (idx + 1);
    const options = q.options || [];

    // Resolve canonical correct option
    let correctIdx = 0;
    const rawCorrect = (q as any).correctAnswer;
    if (typeof rawCorrect === 'number') {
      correctIdx = rawCorrect;
    } else if (typeof rawCorrect === 'string' && /^opt_\d+$/i.test(rawCorrect)) {
      correctIdx = parseInt(rawCorrect.replace(/^opt_/i, ''), 10);
    } else if (typeof rawCorrect === 'string') {
      const found = options.findIndex((o) => o.trim() === rawCorrect.trim());
      correctIdx = found !== -1 ? found : 0;
    }
    const correctOptionId = `opt_${correctIdx}`;
    const correctAnswerText = (correctIdx >= 0 && correctIdx < options.length) ? options[correctIdx] : '';

    // Student answer matching
    let studentAns: any = null;
    if (answers[q.id] !== undefined && answers[q.id] !== null) {
      studentAns = answers[q.id];
    } else if (answers[q.id.toLowerCase()] !== undefined && answers[q.id.toLowerCase()] !== null) {
      studentAns = answers[q.id.toLowerCase()];
    }

    let studentOptionId: string | null = null;
    let studentOptionIdx: number | null = null;
    let studentAnswerText: string | null = null;

    if (studentAns !== null && studentAns !== undefined) {
      if (typeof studentAns === 'string') {
        if (/^opt_\d+$/i.test(studentAns)) {
          studentOptionIdx = parseInt(studentAns.replace(/^opt_/i, ''), 10);
          studentOptionId = `opt_${studentOptionIdx}`;
          studentAnswerText = options[studentOptionIdx] || null;
        } else {
          const textIdx = options.findIndex((o) => o.trim() === studentAns.trim());
          if (textIdx !== -1) {
            studentOptionIdx = textIdx;
            studentOptionId = `opt_${textIdx}`;
            studentAnswerText = options[textIdx];
          } else {
            const num = parseInt(studentAns, 10);
            if (!isNaN(num) && num >= 0 && num < options.length) {
              studentOptionIdx = num;
              studentOptionId = `opt_${num}`;
              studentAnswerText = options[num];
            }
          }
        }
      } else if (typeof studentAns === 'number' && studentAns >= 0 && studentAns < options.length) {
        studentOptionIdx = studentAns;
        studentOptionId = `opt_${studentAns}`;
        studentAnswerText = options[studentAns];
      }
    }

    const isUnanswered = studentOptionId === null;
    const isCorrect = !isUnanswered && studentOptionId === correctOptionId;

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
      studentAnswer: studentOptionIdx,
      studentOptionId,
      studentAnswerText,
      correctAnswer: correctIdx,
      correctOptionId,
      correctAnswerText,
      isCorrect,
      isUnanswered,
      explanation: q.explanation || '',
      hint: q.hint || '',
      solutionSteps: q.solutionSteps || null,
      formulaUsed: q.formulaUsed || null,
      distractorAnalysis: q.distractorAnalysis || null,
      points: q.points || 5,
      pointsEarned: isCorrect ? (q.points || 5) : 0,
      source: q.source || 'أريكسون',
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
  if (durationUsed === 0) {
    if (params.clientAttemptData?.durationUsed) durationUsed = Number(params.clientAttemptData.durationUsed);
    else if (params.clientAttemptData?.durationSeconds) durationUsed = Number(params.clientAttemptData.durationSeconds);
    else if (attemptData.durationSeconds) durationUsed = Number(attemptData.durationSeconds);
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
    correctAnswers: correctCount,
    wrongCount,
    wrongAnswers: wrongCount,
    unansweredCount,
    unanswered: unansweredCount,
    durationUsed,
    durationSeconds: durationUsed,
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

            // Sync publicProfiles directly from the server
            const pubRef = db.collection('publicProfiles').doc(userId);
            transaction.set(pubRef, {
              uid: userId,
              totalPoints: currentTotal + pointsAwarded,
              points: currentTotal + pointsAwarded,
              examsCompleted: currentExams + (isFirstCompletion ? 1 : 0),
              correctAnswers: currentCorrect + correctCount,
              wrongAnswers: currentWrong + wrongCount,
              updatedAt: nowIso,
            }, { merge: true });
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

  // REST fallback to update attempt if Admin SDK is unavailable
  if (!writeSucceeded && params.idToken) {
    try {
      const patchOk = await patchRestDoc(`attempts/${attemptId}`, {
        status: 'submitted',
        submittedAt: nowIso,
        score: scorePercent,
        correctCount,
        correctAnswers: correctCount,
        wrongCount,
        wrongAnswers: wrongCount,
        unansweredCount,
        unanswered: unansweredCount,
        durationUsed,
        durationSeconds: durationUsed,
        pointsEarned: pointsAwarded,
        answers,
        reviews,
      }, params.idToken);
      if (patchOk) {
        writeSucceeded = true;
        console.log(`[ExamGrader] Attempt ${attemptId} successfully updated via authenticated REST API.`);
      }
    } catch (restPatchErr: any) {
      console.warn('[ExamGrader] REST patch error for attempt:', restPatchErr?.message);
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
  } catch (unexpectedErr: any) {
    console.error(`[ExamGrader 500 ERROR] code=FIRESTORE_ERROR, message="${unexpectedErr?.message || 'Internal Grader Error'}", step="${currentStep}", examId="${params.clientAttemptData?.examId || 'unknown'}", attemptId="${attemptId}", uid="${userId}", line="api/_lib/examGrader.ts:575"`, unexpectedErr?.stack || unexpectedErr);
    return {
      ok: false,
      code: 'FIRESTORE_ERROR',
      message: unexpectedErr?.message || 'حدث خطأ داخلي في نظام التصحيح.',
      step: currentStep,
      line: 'api/_lib/examGrader.ts:575',
    };
  }
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
