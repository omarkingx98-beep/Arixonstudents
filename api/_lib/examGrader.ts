import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { firebaseAppConfig } from './config.js';
import { 
  FIRST_EXAM_ID, 
  FIRST_EXAM_QUESTIONS, 
  LITERARY_EXAM_ID, 
  LITERARY_EXAM_QUESTIONS, 
  ISLAMIC_EXAM_ID,
  ISLAMIC_EXAM_QUESTIONS,
  CHEMISTRY_EXAM_ID,
  CHEMISTRY_EXAM,
  CHEMISTRY_EXAM_QUESTIONS,
  SURAH_YUSUF_EXAM_ID,
  SURAH_YUSUF_CORRECT_KEYS,
  type QuestionWithKey 
} from './examData.js';
import { getRestDoc, getRestCollection, patchRestDoc, queryRestByField } from './firestoreRest.js';

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
    const gacPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
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
    } else if (gacPath && getApps().length > 0) {
      try {
        adminDb = getFirestore();
        adminHasValidServiceAccount = true;
        console.log('[ExamGrader] Firebase Admin Firestore initialized via GOOGLE_APPLICATION_CREDENTIALS.');
      } catch (appErr: any) {
        console.warn('[ExamGrader] GOOGLE_APPLICATION_CREDENTIALS Firestore init failed:', appErr?.message);
        adminHasValidServiceAccount = false;
        adminDb = null;
      }
    } else {
      console.warn('[ExamGrader] Notice: No Firebase service account credentials found in environment; using REST fallback.');
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
 * Safely parse any stored correctAnswer format (number, "opt_N", numeric string "0".."3", or option text).
 * Never silently falls back to 0 when unparseable.
 */
export function parseCorrectAnswerIndex(rawCorrect: any, options: string[] = []): number | null {
  if (rawCorrect === null || rawCorrect === undefined) return null;

  if (typeof rawCorrect === 'number') {
    if (!Number.isFinite(rawCorrect) || !Number.isInteger(rawCorrect) || rawCorrect < 0) return null;
    if (options.length > 0 && rawCorrect >= options.length) return null;
    return rawCorrect;
  }

  if (typeof rawCorrect === 'string') {
    const trimmed = rawCorrect.trim();
    if (!trimmed) return null;

    if (/^opt_\d+$/i.test(trimmed)) {
      const idx = parseInt(trimmed.replace(/^opt_/i, ''), 10);
      if (idx >= 0 && (options.length === 0 || idx < options.length)) return idx;
      return null;
    }

    if (/^\d+$/.test(trimmed)) {
      const idx = parseInt(trimmed, 10);
      if (idx >= 0 && (options.length === 0 || idx < options.length)) return idx;
      return null;
    }

    if (options.length > 0) {
      const found = options.findIndex((o) => String(o).trim() === trimmed);
      if (found !== -1) return found;
    }
  }

  return null;
}

export type ResolvedKeySource = 'answerKeys' | 'questions' | 'yusufOverride' | 'missing';

export function resolveQuestionAnswerKey(params: {
  examId: string;
  questionId: string;
  qData: Record<string, any>;
  keyData?: Record<string, any> | null;
  options?: string[];
}): {
  rawKey: any;
  index: number | null;
  optionId: string | null;
  sourceUsed: ResolvedKeySource;
  fallbackUsed: boolean;
} {
  const { examId, questionId, qData, keyData } = params;
  const options = params.options ?? (Array.isArray(qData?.options) ? qData.options : []);
  const yusufOverride = examId === SURAH_YUSUF_EXAM_ID ? SURAH_YUSUF_CORRECT_KEYS[questionId] : undefined;

  if (keyData && keyData.correctAnswer !== undefined && keyData.correctAnswer !== null) {
    const idx = parseCorrectAnswerIndex(keyData.correctAnswer, options);
    if (idx !== null) {
      return {
        rawKey: keyData.correctAnswer,
        index: idx,
        optionId: `opt_${idx}`,
        sourceUsed: 'answerKeys',
        fallbackUsed: false,
      };
    }
  }

  if (qData && qData.correctAnswer !== undefined && qData.correctAnswer !== null) {
    const idx = parseCorrectAnswerIndex(qData.correctAnswer, options);
    if (idx !== null) {
      return {
        rawKey: qData.correctAnswer,
        index: idx,
        optionId: `opt_${idx}`,
        sourceUsed: 'questions',
        fallbackUsed: true,
      };
    }
  }

  if (yusufOverride !== undefined) {
    const idx = parseCorrectAnswerIndex(yusufOverride.correctAnswer, options);
    if (idx !== null) {
      return {
        rawKey: yusufOverride.correctAnswer,
        index: idx,
        optionId: `opt_${idx}`,
        sourceUsed: 'yusufOverride',
        fallbackUsed: true,
      };
    }
  }

  return {
    rawKey: undefined,
    index: null,
    optionId: null,
    sourceUsed: 'missing',
    fallbackUsed: true,
  };
}

function parseJwtIsAdmin(idToken?: string): boolean {
  if (!idToken) return false;
  try {
    const parts = idToken.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      const role = typeof payload.role === 'string' ? payload.role : '';
      return Boolean(payload.admin === true || role === 'super_admin' || role === 'admin' || role === 'content_editor');
    }
  } catch {}
  return false;
}

/**
 * Grade and Submit Exam
 * Fast, atomic, idempotent, step-by-step diagnostic logging.
 */
export async function gradeAndSubmitExam(params: {
  attemptId: string;
  userId: string;
  answers: Record<string, number | string | null>;
  clientAttemptData?: any;
  durationSeconds?: number;
  userEmail?: string;
  idToken?: string;
  forceRegrade?: boolean;
  source?: 'online' | 'offline';
  examVersion?: number;
  startedAt?: string;
  endedAt?: string;
}): Promise<GradeResult> {
  const startTime = Date.now();
  const { attemptId, userId, answers = {}, durationSeconds, forceRegrade = false } = params;
  let currentStep = 'VALIDATE_INPUT';

  try {
    console.log(`[ExamGrader] Step 1 [${currentStep}]: Starting grading for attempt: ${attemptId}, user: ${userId}, answers count: ${Object.keys(answers).length}, forceRegrade=${forceRegrade}`);

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
    ) || parseJwtIsAdmin(params.idToken);

    const credentialSource: 'service_account' | 'user_token' | 'none' = 
      hasServiceAccount ? 'service_account' : (isAdminUser && params.idToken ? 'user_token' : 'none');

    console.log(`[ExamGrader] credentialSource: ${credentialSource}, attempt: ${attemptId}, uid: ${userId}`);

    // 1. Retrieve Attempt Document (ALWAYS check persisted Firestore doc FIRST before trusting clientAttemptData)
    currentStep = 'FETCH_ATTEMPT';
    let attemptData: any = null;
    let attemptExistsInDb = false;

    if (hasServiceAccount && db) {
      try {
        const attemptDoc = await withTimeout(
          db.collection('attempts').doc(attemptId).get(),
          4000,
          'FETCH_ATTEMPT'
        );
        if (attemptDoc.exists) {
          attemptData = attemptDoc.data();
          attemptExistsInDb = true;
        }
      } catch (err: any) {
        console.warn(`[ExamGrader] Notice reading attempt from Firestore at step ${currentStep}:`, err?.message);
      }
    }

    // REST API fallback for attempt retrieval if Admin SDK is unconfigured or doc not loaded
    if (!attemptData && params.idToken) {
      try {
        const restDoc = await getRestDoc(`attempts/${attemptId}`, params.idToken);
        if (restDoc) {
          attemptData = restDoc;
          attemptExistsInDb = true;
        }
      } catch (restErr: any) {
        console.warn(`[ExamGrader] Notice REST fetch for attempt ${attemptId}:`, restErr?.message);
      }
    }

    // Sanitize clientAttemptData: NEVER allow client to spoof score, points, counts, reviews, or status: 'submitted'
    const sanitizedClientMeta = params.clientAttemptData ? {
      examId: params.clientAttemptData.examId,
      examTitle: params.clientAttemptData.examTitle,
      examSubject: params.clientAttemptData.examSubject,
      lesson: params.clientAttemptData.lesson,
      totalPoints: params.clientAttemptData.totalPoints,
      questionCount: params.clientAttemptData.questionCount,
      userDisplayName: params.clientAttemptData.userDisplayName,
      startedAt: params.startedAt || params.clientAttemptData.startedAt,
      expectedEndAt: params.clientAttemptData.expectedEndAt,
      submittedAt: params.endedAt || params.clientAttemptData.submittedAt,
      durationSeconds: params.durationSeconds ?? params.clientAttemptData.durationSeconds ?? params.clientAttemptData.durationUsed,
      examVersion: params.examVersion ?? params.clientAttemptData.examVersion,
      isRetake: Boolean(params.clientAttemptData.isRetake),
      source: params.source || (attemptId.startsWith('offline_') ? 'offline' : 'online'),
      // Preserve userId only for authorized admin forceRegrade flow
      userId: forceRegrade ? (params.clientAttemptData.userId || userId) : userId,
    } : null;

    const isOfflineSubmission = params.source === 'offline' || attemptId.startsWith('offline_');

    if (!attemptData) {
      if (sanitizedClientMeta && sanitizedClientMeta.examId) {
        attemptData = {
          id: attemptId,
          ...sanitizedClientMeta,
          status: 'in_progress',
        };
      } else if (isOfflineSubmission) {
        // Offline attempt ID pattern: offline_{uid}_{examId}_{ts} or offline_{examId}_{ts}
        const rawExamFromClient = sanitizedClientMeta?.examId;
        if (rawExamFromClient) {
          attemptData = {
            id: attemptId,
            examId: rawExamFromClient,
            userId,
            status: 'in_progress',
            startedAt: params.startedAt || new Date().toISOString(),
            submittedAt: params.endedAt || new Date().toISOString(),
            durationSeconds: durationSeconds || 60,
            examVersion: params.examVersion || 1,
            source: 'offline',
          };
        }
      } else if (attemptId.startsWith('att_')) {
        const parts = attemptId.split('_');
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
    }

    // If attemptData was supplied but is missing examId or userId, auto-fill from attemptId/params
    if (attemptData && !attemptData.examId && attemptId.startsWith('att_')) {
      const parts = attemptId.split('_');
      if (parts.length >= 4) {
        attemptData.examId = parts.slice(2, -1).join('_');
      }
    }
    if (attemptData && !attemptData.userId) {
      attemptData.userId = userId;
    }

    if (!attemptData) {
      console.error(`[ExamGrader 404 ERROR] code=ATTEMPT_NOT_FOUND, message="تعذر العثور على وثيقة المحاولة في قاعدة البيانات", step="${currentStep}", examId="unknown", attemptId="${attemptId}", uid="${userId}", line="api/_lib/examGrader.ts:370"`);
      return {
        ok: false,
        code: 'ATTEMPT_NOT_FOUND',
        message: 'تعذر العثور على وثيقة المحاولة في قاعدة البيانات.',
        step: currentStep,
        line: 'api/_lib/examGrader.ts:370',
      };
    }

    // If offline/unpersisted attempt didn't exist yet, note we'll create it cleanly upon grading
    void attemptExistsInDb;

    // 2. Ownership Check
    currentStep = 'OWNERSHIP_CHECK';
    if (attemptData.userId && attemptData.userId !== userId && !forceRegrade) {
      console.error(`[ExamGrader 401 ERROR] code=AUTH_FAILED, message="غير مصرح لك بتسليم هذه المحاولة", step="${currentStep}", examId="${attemptData.examId || 'unknown'}", attemptId="${attemptId}", uid="${userId}", line="api/_lib/examGrader.ts:228"`);
      return {
        ok: false,
        code: 'AUTH_FAILED',
        message: 'غير مصرح لك بتسليم هذه المحاولة.',
        step: currentStep,
        line: 'api/_lib/examGrader.ts:228',
      };
    }

    // 3. Idempotency Check: if already submitted and not forcing regrade, return existing result without duplicate points
    currentStep = 'IDEMPOTENCY_CHECK';
    if (attemptData.status === 'submitted' && !forceRegrade) {
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

    // 4. Retrieve Exam Metadata & Questions & Answer Keys
    currentStep = 'FETCH_QUESTIONS_AND_KEYS';
    const examId = attemptData.examId || '';
    let examMeta: Record<string, any> | null = null;
    let questionsWithKeys: QuestionWithKey[] = [];

    if (hasServiceAccount && db && examId) {
      try {
        const exSnap = await withTimeout(db.collection('exams').doc(examId).get(), 3000, 'FETCH_EXAM_META');
        if (exSnap.exists) examMeta = exSnap.data() || null;
      } catch {}
    } else if (params.idToken && examId) {
      try {
        examMeta = await getRestDoc(`exams/${examId}`, params.idToken);
      } catch {}
    }
    if (!examMeta && examId === CHEMISTRY_EXAM_ID) {
      examMeta = { ...CHEMISTRY_EXAM };
    }

    // 4a. Fetch from Admin Firestore SDK
    if (hasServiceAccount && db && examId) {
      try {
        const qSnap = await withTimeout(
          db.collection('exams').doc(examId).collection('questions').get(),
          4000,
          'FETCH_QUESTIONS'
        );

        if (!qSnap.empty) {
          const keySnap = await withTimeout(
            db.collection('exams').doc(examId).collection('answerKeys').get(),
            4000,
            'FETCH_KEYS'
          ).catch(() => null);
          const keysMap = new Map<string, any>();
          if (keySnap) {
            keySnap.docs.forEach((kd) => keysMap.set(kd.id, kd.data()));
          }

          const sortedDocs = [...qSnap.docs].sort((a, b) => {
            const oa = typeof a.data().order === 'number' ? a.data().order : 999999;
            const ob = typeof b.data().order === 'number' ? b.data().order : 999999;
            return oa - ob;
          });
          let anyKeyMissing = false;

          for (let idx = 0; idx < sortedDocs.length; idx++) {
            const qDoc = sortedDocs[idx];
            const qData = qDoc.data();
            const keyData = keysMap.get(qDoc.id);

            const yusufOverride = examId === SURAH_YUSUF_EXAM_ID ? SURAH_YUSUF_CORRECT_KEYS[qDoc.id] : undefined;
            const resolved = resolveQuestionAnswerKey({
              examId,
              questionId: qDoc.id,
              qData,
              keyData,
            });

            const expl = keyData?.explanation || qData.explanation || yusufOverride?.explanation || '';

            if (resolved.index === null) {
              console.error(`[ExamGrader] Missing/invalid answer key for question: ${qDoc.id} in exam: ${examId}`);
              anyKeyMissing = true;
              break;
            }

            questionsWithKeys.push({
              id: qDoc.id,
              examId,
              order: typeof qData.order === 'number' ? qData.order : (idx + 1),
              questionText: qData.questionText || '',
              options: qData.options || [],
              difficulty: qData.difficulty || 'medium',
              source: qData.source || 'أريكسون',
              points: qData.points || 5,
              questionType: qData.questionType || 'multiple_choice',
              correctAnswer: resolved.index,
              explanation: expl,
              hint: keyData?.hint || qData.hint || '',
              solutionSteps: keyData?.solutionSteps || qData.solutionSteps || null,
              distractorAnalysis: keyData?.distractorAnalysis || qData.distractorAnalysis || null,
              keySource: resolved.sourceUsed,
            } as QuestionWithKey & { keySource?: ResolvedKeySource });
          }

          if (anyKeyMissing) {
            questionsWithKeys = [];
          }
        }
      } catch (err: any) {
        console.warn(`[ExamGrader] Notice reading Firestore questions at step ${currentStep}:`, err?.message);
      }
    }

    // 4b. REST API fallback for questions (and answerKeys if admin)
    if (questionsWithKeys.length === 0 && examId && params.idToken) {
      try {
        const restDocs = await getRestCollection(`exams/${examId}/questions`, params.idToken);
        if (restDocs.length > 0) {
          const restKeysMap = new Map<string, any>();
          if (credentialSource === 'user_token') {
            try {
              const restKeyDocs = await getRestCollection(`exams/${examId}/answerKeys`, params.idToken);
              restKeyDocs.forEach((kd) => restKeysMap.set(kd.id, kd.data));
            } catch (_) {}
          }

          restDocs.sort((a, b) => {
            const oa = typeof a.data.order === 'number' ? a.data.order : 999999;
            const ob = typeof b.data.order === 'number' ? b.data.order : 999999;
            return oa - ob;
          });
          let anyKeyMissing = false;

          for (let idx = 0; idx < restDocs.length; idx++) {
            const qItem = restDocs[idx];
            const qData = qItem.data;
            const keyData = restKeysMap.get(qItem.id);

            const yusufOverride = examId === SURAH_YUSUF_EXAM_ID ? SURAH_YUSUF_CORRECT_KEYS[qItem.id] : undefined;
            const resolved = resolveQuestionAnswerKey({
              examId,
              questionId: qItem.id,
              qData,
              keyData,
            });

            const expl = keyData?.explanation || qData.explanation || yusufOverride?.explanation || '';

            if (resolved.index === null) {
              anyKeyMissing = true;
              break;
            }

            questionsWithKeys.push({
              id: qItem.id,
              examId,
              order: typeof qData.order === 'number' ? qData.order : (idx + 1),
              questionText: qData.questionText || '',
              options: qData.options || [],
              difficulty: qData.difficulty || 'medium',
              source: qData.source || 'أريكسون',
              points: qData.points || 5,
              questionType: qData.questionType || 'multiple_choice',
              correctAnswer: resolved.index,
              explanation: expl,
              hint: keyData?.hint || qData.hint || '',
              solutionSteps: keyData?.solutionSteps || qData.solutionSteps || null,
              distractorAnalysis: keyData?.distractorAnalysis || qData.distractorAnalysis || null,
              keySource: resolved.sourceUsed,
            } as QuestionWithKey & { keySource?: ResolvedKeySource });
          }

          if (anyKeyMissing) {
            questionsWithKeys = [];
          }
        }
      } catch (restQErr: any) {
        console.warn(`[ExamGrader] Notice REST fetch for questions of exam ${examId}:`, restQErr?.message);
      }
    }

  // 4c. Built-in verified banks ONLY for official embedded exams (strict ID match)
  const isMinisterialPhysics = examId === FIRST_EXAM_ID || examId === 'exam_physics_tw2009_01';
  const isMinisterialArabic = examId === LITERARY_EXAM_ID || examId === 'exam_arabic_tw2009_01';
  const isMinisterialIslamic = examId === ISLAMIC_EXAM_ID || examId === 'exam_islamic_tw2009_01';
  const isBuiltInChemistry = examId === CHEMISTRY_EXAM_ID;

  if (questionsWithKeys.length === 0 && (isMinisterialPhysics || isMinisterialArabic || isMinisterialIslamic || isBuiltInChemistry)) {
    if (isMinisterialPhysics) {
      questionsWithKeys = FIRST_EXAM_QUESTIONS;
    } else if (isMinisterialArabic) {
      questionsWithKeys = LITERARY_EXAM_QUESTIONS;
    } else if (isMinisterialIslamic) {
      questionsWithKeys = ISLAMIC_EXAM_QUESTIONS;
    } else if (isBuiltInChemistry) {
      questionsWithKeys = CHEMISTRY_EXAM_QUESTIONS;
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
  const declaredQuestionCount = 
    Number(params.clientAttemptData?.questionCount) || 
    Number(attemptData?.questionCount) || 
    0;

  if (declaredQuestionCount > 0 && questionsWithKeys.length > declaredQuestionCount) {
    console.log(`[ExamGrader] Slicing questionsWithKeys from ${questionsWithKeys.length} to declaredQuestionCount: ${declaredQuestionCount}`);
    questionsWithKeys = questionsWithKeys.slice(0, declaredQuestionCount);
  }

  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;
  let pointsCalculated = 0;
  const reviews: any[] = [];

  for (let idx = 0; idx < questionsWithKeys.length; idx++) {
    const q = questionsWithKeys[idx] as QuestionWithKey & { keySource?: ResolvedKeySource };
    const qOrder = typeof q.order === 'number' ? q.order : (idx + 1);
    const options = q.options || [];

    // Resolve canonical correct option without silent 0 default
    const parsedCorrect = parseCorrectAnswerIndex((q as any).correctAnswer, options);
    const correctIdx = parsedCorrect !== null ? parsedCorrect : -1;
    const correctOptionId = correctIdx >= 0 ? `opt_${correctIdx}` : 'opt_invalid';
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
    let isCorrect = !isUnanswered && studentOptionId === correctOptionId;

    // Special tolerance for Arabic RTL ratio ambiguity on q13 in physics (1:3 vs 3:1)
    if (!isCorrect && !isUnanswered && (q.id === 'q13' || q.questionText?.includes('K1 = 9K2') || q.questionText?.includes('تسعة أمثال'))) {
      if ((studentOptionId === 'opt_2' || studentOptionId === 'opt_3') &&
          (correctOptionId === 'opt_2' || correctOptionId === 'opt_3')) {
        isCorrect = true;
      }
    }

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

  // Compute duration used (from explicit timestamps if provided, otherwise fallback safely)
  let durationUsed = 0;
  const startedAtVal = params.startedAt || attemptData.startedAt;
  const endedAtVal = params.endedAt || attemptData.submittedAt || (isOfflineSubmission ? nowIso : undefined);
  if (startedAtVal && endedAtVal) {
    const sMs = new Date(startedAtVal).getTime();
    const eMs = new Date(endedAtVal).getTime();
    if (!isNaN(sMs) && !isNaN(eMs) && eMs >= sMs) {
      durationUsed = Math.max(1, Math.round((eMs - sMs) / 1000));
    }
  }
  if (durationUsed === 0 && startedAtVal) {
    const startedMs = new Date(startedAtVal).getTime();
    if (!isNaN(startedMs)) {
      durationUsed = Math.max(1, Math.round((Date.now() - startedMs) / 1000));
    }
  }
  if (durationUsed === 0) {
    if (typeof durationSeconds === 'number' && durationSeconds > 0) durationUsed = Math.round(durationSeconds);
    else if (params.clientAttemptData?.durationUsed) durationUsed = Number(params.clientAttemptData.durationUsed);
    else if (params.clientAttemptData?.durationSeconds) durationUsed = Number(params.clientAttemptData.durationSeconds);
    else if (attemptData.durationSeconds) durationUsed = Number(attemptData.durationSeconds);
  }
  if (typeof durationSeconds === 'number' && durationSeconds > 0 && isOfflineSubmission) {
    // Prefer client-measured active seconds when positive and less absurd than wall-clock sync lag
    durationUsed = Math.round(durationSeconds);
  }

  // Plausibility & Exam Version Verification (Part S Security)
  const answeredCount = totalQuestions - unansweredCount;
  const minPlausibleSeconds = totalQuestions > 0 ? Math.max(5, Math.floor(totalQuestions * 1.2)) : 0;
  const flagged = Boolean(totalQuestions > 0 && answeredCount > 0 && durationUsed > 0 && durationUsed < minPlausibleSeconds);
  const flagReason = flagged ? 'IMPLAUSIBLY_FAST' : (attemptData.flagReason || null);

  const examDurationMin = Number(examMeta?.durationMinutes || 0);
  const overtimeExceeded = Boolean(examDurationMin > 0 && durationUsed > (examDurationMin * 60 + 180));

  const serverExamVersion = Number(examMeta?.version || 1);
  const rawClientVersion = params.examVersion ?? params.clientAttemptData?.examVersion ?? attemptData.examVersion;
  const clientExamVersion = rawClientVersion !== undefined && rawClientVersion !== null ? Number(rawClientVersion) : serverExamVersion;
  const versionMismatch = Boolean(clientExamVersion > 0 && serverExamVersion > 0 && clientExamVersion !== serverExamVersion);

  const effectiveSource: 'online' | 'offline' =
    params.source === 'offline' || isOfflineSubmission || attemptData.source === 'offline' ? 'offline' : 'online';

  // Idempotent points check: award points only on the FIRST completion of an exam
  const isRetake = Boolean(attemptData.isRetake);
  const previousPointsEarned = Number(attemptData.pointsEarned) || 0;
  let isFirstCompletion = !isRetake && !forceRegrade;

  // Non-transaction pre-check via Admin SDK or REST query for prior submitted attempts on (userId, examId)
  if (isFirstCompletion && !hasServiceAccount && params.idToken && examId) {
    try {
      const priorDocs = await queryRestByField('attempts', 'userId', userId, params.idToken, 50);
      const hasPriorSubmitted = priorDocs.some(
        (d) => d.id !== attemptId && d.data?.examId === examId && d.data?.status === 'submitted'
      );
      if (hasPriorSubmitted) {
        isFirstCompletion = false;
      }
    } catch {}
  }

  let pointsAwarded = isFirstCompletion ? pointsCalculated : (forceRegrade ? pointsCalculated : 0);
  let deltaPoints = forceRegrade ? (pointsCalculated - previousPointsEarned) : pointsAwarded;

  // 6. Write to Firestore Atomic Batch/Transaction
  currentStep = 'WRITE_RESULTS_AND_POINTS';
  const updatedAttempt: Record<string, any> = {
    ...attemptData,
    id: attemptId,
    userId,
    examId,
    examTitle: attemptData.examTitle || examMeta?.title || '',
    examSubject: attemptData.examSubject || examMeta?.subjectNameAr || examMeta?.subject || '',
    lesson: attemptData.lesson || examMeta?.lesson || '',
    totalPoints: attemptData.totalPoints || examMeta?.totalPoints || pointsCalculated || totalQuestions * 10,
    source: effectiveSource,
    status: 'submitted',
    startedAt: startedAtVal || nowIso,
    submittedAt: params.endedAt || attemptData.submittedAt || nowIso,
    regradedAt: forceRegrade ? nowIso : (attemptData.regradedAt || null),
    score: scorePercent,
    questionCount: totalQuestions,
    correctCount,
    correctAnswers: correctCount,
    wrongCount,
    wrongAnswers: wrongCount,
    unansweredCount,
    unanswered: unansweredCount,
    answeredCount,
    durationUsed,
    durationSeconds: durationUsed,
    pointsEarned: forceRegrade ? pointsCalculated : pointsAwarded,
    flagged,
    ...(flagReason ? { flagReason } : {}),
    overtimeExceeded,
    versionMismatch,
    clientExamVersion,
    serverExamVersion,
    examVersion: serverExamVersion,
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

          // Also query any existing submitted attempt for this user & examId to enforce strictly 1st completion points
          const priorSnap = await db
            .collection('attempts')
            .where('userId', '==', userId)
            .where('examId', '==', examId)
            .where('status', '==', 'submitted')
            .limit(5)
            .get();
          const hasPriorSubmittedDoc = priorSnap.docs.some((d) => d.id !== attemptId);

          // Check if user already completed this exam before
          const userDoc = await transaction.get(userRef);
          if (userDoc.exists) {
            const uData = userDoc.data() || {};
            const alreadyInCompletedList =
              uData.completedExamIds && Array.isArray(uData.completedExamIds) && uData.completedExamIds.includes(examId);

            // If already completed in past (either via completedExamIds or prior submitted attempt) and not regrading, 0 points
            if (!forceRegrade && (alreadyInCompletedList || hasPriorSubmittedDoc)) {
              isFirstCompletion = false;
              pointsAwarded = 0;
              deltaPoints = 0;
              updatedAttempt.pointsEarned = 0;
              updatedAttempt.isRetake = true;
            }

            const currentTotal = uData.totalPoints || 0;
            const currentExams = uData.examsCompleted || 0;
            const currentCorrect = uData.correctAnswers || 0;
            const currentWrong = uData.wrongAnswers || 0;

            const prevCorrect = Number(attemptData.correctCount) || Number(attemptData.correctAnswers) || 0;
            const prevWrong = Number(attemptData.wrongCount) || Number(attemptData.wrongAnswers) || 0;
            const deltaCorrect = forceRegrade ? (correctCount - prevCorrect) : correctCount;
            const deltaWrong = forceRegrade ? (wrongCount - prevWrong) : wrongCount;

            transaction.update(userRef, {
              totalPoints: Math.max(0, currentTotal + deltaPoints),
              weeklyPoints: Math.max(0, (uData.weeklyPoints || 0) + deltaPoints),
              monthlyPoints: Math.max(0, (uData.monthlyPoints || 0) + deltaPoints),
              examsCompleted: currentExams + (isFirstCompletion ? 1 : 0),
              correctAnswers: Math.max(0, currentCorrect + deltaCorrect),
              wrongAnswers: Math.max(0, currentWrong + deltaWrong),
              completedExamIds: FieldValue.arrayUnion(examId),
              updatedAt: nowIso,
              lastActiveAt: nowIso,
            });

            // Sync publicProfiles directly from the server
            const pubRef = db.collection('publicProfiles').doc(userId);
            transaction.set(pubRef, {
              uid: userId,
              totalPoints: Math.max(0, currentTotal + deltaPoints),
              points: Math.max(0, currentTotal + deltaPoints),
              examsCompleted: currentExams + (isFirstCompletion ? 1 : 0),
              correctAnswers: Math.max(0, currentCorrect + deltaCorrect),
              wrongAnswers: Math.max(0, currentWrong + deltaWrong),
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
        userId,
        examId,
        source: effectiveSource,
        status: 'submitted',
        submittedAt: updatedAttempt.submittedAt,
        score: scorePercent,
        correctCount,
        correctAnswers: correctCount,
        wrongCount,
        wrongAnswers: wrongCount,
        unansweredCount,
        unanswered: unansweredCount,
        answeredCount,
        durationUsed,
        durationSeconds: durationUsed,
        pointsEarned: pointsAwarded,
        flagged,
        overtimeExceeded,
        versionMismatch,
        clientExamVersion,
        serverExamVersion,
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
