import { getAdminFirestore, gradeAndSubmitExam } from './examGrader.js';
import { 
  FIRST_EXAM_ID, 
  FIRST_EXAM_QUESTIONS, 
  LITERARY_EXAM_ID, 
  LITERARY_EXAM_QUESTIONS, 
  ISLAMIC_EXAM_ID, 
  ISLAMIC_EXAM_QUESTIONS, 
  ISLAMIC_EXAM,
  SURAH_YUSUF_EXAM_ID,
  SURAH_YUSUF_CORRECT_KEYS,
  type QuestionWithKey 
} from './examData.js';
import { FIRST_EXAM } from './firstExamData.js';
import { LITERARY_EXAM } from './literaryExamData.js';
import { GoogleGenAI } from '@google/genai';
import { firebaseAppConfig } from './config.js';
import { getRestCollection, getRestDoc } from './firestoreRest.js';

export interface ServiceHealthReport {
  timestamp: string;
  env: {
    hasGeminiKey: boolean;
    hasFirebaseProjectId: boolean;
    hasClientEmail: boolean;
    hasPrivateKey: boolean;
    hasServiceAccountKey: boolean;
    hasOwnerEmails: boolean;
  };
  firestore: {
    status: 'connected' | 'unreachable' | 'degraded';
    latencyMs: number;
    error?: string;
  };
  gemini: {
    status: 'available' | 'disabled' | 'error';
    latencyMs: number;
    model: string;
    error?: string;
  };
}

export interface QuestionAuditResult {
  id: string;
  order: number;
  questionText: string;
  optionsCount: number;
  options: string[];
  correctAnswer: number | null | undefined;
  correctOptionText?: string;
  hasExplanation: boolean;
  hasHint: boolean;
  hasAnswerKey: boolean;
  inBounds: boolean;
  issues: string[];
}

export interface ExamAuditReport {
  id: string;
  title: string;
  subject: string;
  status: string;
  published: boolean;
  source: 'firestore' | 'embedded';
  questionCount: number;
  totalPoints: number;
  durationMinutes: number;
  overallStatus: 'pass' | 'warning' | 'error';
  secretLeakTest: {
    passed: boolean;
    leakedFields: string[];
  };
  dryRunGrading: {
    perfectScorePassed: boolean; // 100%
    zeroScorePassed: boolean;    // 0%
    halfScorePassed: boolean;    // 50%
    zeroIndexAnswerPassed: boolean; // Answer index 0 evaluated properly
    details: string;
  };
  questions: QuestionAuditResult[];
  errors: string[];
  warnings: string[];
}

/**
 * Checks system health without exposing any secret values
 */
export async function performServiceHealthCheck(): Promise<ServiceHealthReport> {
  const startTs = Date.now();
  const apiKey = process.env.GEMINI_API_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID || firebaseAppConfig.projectId;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const saKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT;
  const ownerEmails = process.env.OWNER_EMAILS;

  // 1. Firestore test
  let firestoreStatus: 'connected' | 'unreachable' | 'degraded' = 'unreachable';
  let firestoreLatency = 0;
  let firestoreError: string | undefined = undefined;

  const fStart = Date.now();
  try {
    const { db, hasServiceAccount } = getAdminFirestore();
    if (hasServiceAccount && db) {
      await db.collection('exams').limit(1).get();
      firestoreStatus = 'connected';
      firestoreLatency = Date.now() - fStart;
    } else {
      // Fallback ping via Firebase REST API
      const pingUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/exams?pageSize=1`;
      const res = await fetch(pingUrl, { signal: AbortSignal.timeout(4000) });
      firestoreLatency = Date.now() - fStart;
      if (res.status === 200 || res.status === 403 || res.status === 401) {
        firestoreStatus = 'connected';
      } else {
        firestoreStatus = 'degraded';
        firestoreError = `HTTP ${res.status}`;
      }
    }
  } catch (err: any) {
    firestoreLatency = Date.now() - fStart;
    firestoreStatus = 'unreachable';
    firestoreError = err?.message || 'Connection timeout';
  }

  // 2. Gemini API test
  let geminiStatus: 'available' | 'disabled' | 'error' = 'disabled';
  let geminiLatency = 0;
  let geminiError: string | undefined = undefined;
  const testModel = 'gemini-2.5-flash';

  if (!apiKey) {
    geminiStatus = 'disabled';
    geminiError = 'GEMINI_API_KEY_MISSING';
  } else {
    const gStart = Date.now();
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: { 'User-Agent': 'aistudio-build-health-check' },
        },
      });
      // Minimal test call using countTokens to verify credentials without consuming generation quota
      const testRes = await ai.models.countTokens({
        model: testModel,
        contents: 'test',
      });
      geminiLatency = Date.now() - gStart;
      if (testRes && typeof testRes.totalTokens === 'number') {
        geminiStatus = 'available';
      } else {
        geminiStatus = 'available';
      }
    } catch (gErr: any) {
      geminiLatency = Date.now() - gStart;
      geminiStatus = 'error';
      // Sanitize error string: never leak any part of apiKey
      const rawMsg = gErr?.message || 'API call failed';
      geminiError = rawMsg.replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_KEY]');
    }
  }

  return {
    timestamp: new Date().toISOString(),
    env: {
      hasGeminiKey: Boolean(apiKey),
      hasFirebaseProjectId: Boolean(projectId),
      hasClientEmail: Boolean(clientEmail),
      hasPrivateKey: Boolean(privateKey),
      hasServiceAccountKey: Boolean(saKey),
      hasOwnerEmails: Boolean(ownerEmails),
    },
    firestore: {
      status: firestoreStatus,
      latencyMs: firestoreLatency,
      error: firestoreError,
    },
    gemini: {
      status: geminiStatus,
      latencyMs: geminiLatency,
      model: testModel,
      error: geminiError,
    },
  };
}

/**
 * Runs server-authoritative dry-run integrity audit for an exam
 */
export async function auditExamIntegrity(
  examId: string, 
  idToken?: string,
  callerEmail?: string
): Promise<ExamAuditReport> {
  const isMinisterialPhysics = examId === FIRST_EXAM_ID || examId === 'exam_physics_tw2009_01';
  const isMinisterialArabic = examId === LITERARY_EXAM_ID || examId === 'exam_arabic_tw2009_01';
  const isMinisterialIslamic = examId === ISLAMIC_EXAM_ID || examId === 'exam_islamic_tw2009_01';

  let examDoc: any = null;
  let questions: any[] = [];
  let answerKeys: any[] = [];
  let source: 'firestore' | 'embedded' = 'firestore';

  const { db, hasServiceAccount } = getAdminFirestore();

  if (hasServiceAccount && db) {
    try {
      const eSnap = await db.collection('exams').doc(examId).get();
      if (eSnap.exists) {
        examDoc = { id: eSnap.id, ...eSnap.data() };
      }
      const qSnap = await db.collection('exams').doc(examId).collection('questions').get();
      qSnap.docs.forEach((d) => questions.push({ id: d.id, ...d.data() }));

      const kSnap = await db.collection('exams').doc(examId).collection('answerKeys').get();
      kSnap.docs.forEach((d) => answerKeys.push({ id: d.id, ...d.data() }));
    } catch (e: any) {
      console.warn(`[Audit] Notice querying Firestore Admin: ${e?.message}`);
    }
  }

  // REST fallback
  if (!examDoc && idToken) {
    try {
      examDoc = await getRestDoc(`exams/${examId}`, idToken);
      const qDocs = await getRestCollection(`exams/${examId}/questions`, idToken);
      questions = qDocs.map((qd) => ({ id: qd.id, ...qd.data }));
      const kDocs = await getRestCollection(`exams/${examId}/answerKeys`, idToken);
      answerKeys = kDocs.map((kd) => ({ id: kd.id, ...kd.data }));
    } catch (restErr: any) {
      console.warn(`[Audit] Notice REST audit query: ${restErr?.message}`);
    }
  }

  // Fallback to embedded canonical data if missing from Firestore
  if (!examDoc || questions.length === 0) {
    if (isMinisterialPhysics) {
      examDoc = FIRST_EXAM;
      questions = FIRST_EXAM_QUESTIONS;
      source = 'embedded';
    } else if (isMinisterialArabic) {
      examDoc = LITERARY_EXAM;
      questions = LITERARY_EXAM_QUESTIONS;
      source = 'embedded';
    } else if (isMinisterialIslamic) {
      examDoc = ISLAMIC_EXAM;
      questions = ISLAMIC_EXAM_QUESTIONS;
      source = 'embedded';
    }
  }

  const keysMap = new Map<string, any>();
  answerKeys.forEach((k) => keysMap.set(k.id || k.questionId, k));

  const questionsAudit: QuestionAuditResult[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const seenQuestionIds = new Set<string>();

  // Sort questions by order
  questions.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

  for (let idx = 0; idx < questions.length; idx++) {
    const q = questions[idx];
    const qId = q.id || `q_${idx + 1}`;
    const qIssues: string[] = [];

    // Duplicate check
    if (seenQuestionIds.has(qId)) {
      qIssues.push(`معرف السؤال مكرر: ${qId}`);
      errors.push(`السؤال رقم ${idx + 1} يملك معرّفاً مكرراً (${qId}).`);
    }
    seenQuestionIds.add(qId);

    const options = Array.isArray(q.options) ? q.options : [];
    if (options.length < 2) {
      qIssues.push(`عدد الخيارات (${options.length}) أقل من 2.`);
      errors.push(`السؤال رقم ${idx + 1} لا يحتوي على خيارات كافية.`);
    }

    // Resolve authoritative answer key
    const keyData = keysMap.get(qId);
    const yusufOverride = examId === SURAH_YUSUF_EXAM_ID ? SURAH_YUSUF_CORRECT_KEYS[qId] : undefined;

    let ansKey: any = undefined;
    if (keyData?.correctAnswer !== undefined && keyData?.correctAnswer !== null) {
      ansKey = keyData.correctAnswer;
    } else if (q.correctAnswer !== undefined && q.correctAnswer !== null) {
      ansKey = q.correctAnswer;
    } else if (yusufOverride !== undefined) {
      ansKey = yusufOverride.correctAnswer;
    }

    let parsedAnsIndex: number | null = null;
    if (typeof ansKey === 'number') {
      parsedAnsIndex = ansKey;
    } else if (typeof ansKey === 'string' && /^opt_\d+$/i.test(ansKey)) {
      parsedAnsIndex = parseInt(ansKey.replace(/^opt_/i, ''), 10);
    } else if (typeof ansKey === 'string') {
      const foundIdx = options.findIndex((o: string) => o.trim() === ansKey.trim());
      parsedAnsIndex = foundIdx !== -1 ? foundIdx : null;
    }

    const inBounds = parsedAnsIndex !== null && parsedAnsIndex >= 0 && parsedAnsIndex < options.length;
    if (!inBounds) {
      qIssues.push(`الإجابة الصحيحة (${ansKey}) غير مطابقة لأي خيار متاح (0-${options.length - 1}).`);
      errors.push(`السؤال رقم ${idx + 1} (${qId}): مفتاح الإجابة غير صالح.`);
    }

    const expl = keyData?.explanation || q.explanation || yusufOverride?.explanation || '';
    if (!expl.trim()) {
      warnings.push(`السؤال رقم ${idx + 1} لا يحتوي على شرح وتفسير للإجابة.`);
    }

    questionsAudit.push({
      id: qId,
      order: q.order || (idx + 1),
      questionText: q.questionText || '',
      optionsCount: options.length,
      options,
      correctAnswer: parsedAnsIndex,
      correctOptionText: inBounds && parsedAnsIndex !== null ? options[parsedAnsIndex] : undefined,
      hasExplanation: Boolean(expl.trim()),
      hasHint: Boolean(keyData?.hint || q.hint),
      hasAnswerKey: Boolean(keyData || ansKey !== undefined),
      inBounds,
      issues: qIssues,
    });
  }

  // 1. Secret Leak Test: simulate student fetching public questions payload
  const publicLeakedFields: string[] = [];
  questions.forEach((q, idx) => {
    // If student reads public questions subcollection, ensure secret fields are not exposed if security rule allows read
    if (q.correctAnswer !== undefined) publicLeakedFields.push(`Q${idx + 1}.correctAnswer`);
  });
  const secretLeakPassed = publicLeakedFields.length === 0;

  // 2. Dry-Run Grading Unit Tests against real examGrader.ts
  const simulatedAnswersAllCorrect: Record<string, number> = {};
  const simulatedAnswersAllWrong: Record<string, number> = {};
  const simulatedAnswersHalf: Record<string, number> = {};
  const simulatedAnswersZeroIndex: Record<string, number> = {};

  questionsAudit.forEach((qa, idx) => {
    const cIdx = qa.correctAnswer ?? 0;
    const wIdx = (cIdx + 1) % Math.max(1, qa.optionsCount);
    simulatedAnswersAllCorrect[qa.id] = cIdx;
    simulatedAnswersAllWrong[qa.id] = wIdx;
    simulatedAnswersZeroIndex[qa.id] = 0;
    if (idx % 2 === 0) {
      simulatedAnswersHalf[qa.id] = cIdx;
    } else {
      simulatedAnswersHalf[qa.id] = wIdx;
    }
  });

  const dummyUid = 'dry_run_audit_user';
  const dummyAttemptBase = `att_dryrun_${examId}_${Date.now()}`;

  // Test 100%
  const res100 = await gradeAndSubmitExam({
    attemptId: `${dummyAttemptBase}_100`,
    userId: dummyUid,
    userEmail: callerEmail,
    answers: simulatedAnswersAllCorrect,
    clientAttemptData: {
      examId,
      userId: dummyUid,
      status: 'in_progress',
      questionCount: questionsAudit.length,
    },
    idToken,
    forceRegrade: true,
  });

  // Test 0%
  const res0 = await gradeAndSubmitExam({
    attemptId: `${dummyAttemptBase}_0`,
    userId: dummyUid,
    userEmail: callerEmail,
    answers: simulatedAnswersAllWrong,
    clientAttemptData: {
      examId,
      userId: dummyUid,
      status: 'in_progress',
      questionCount: questionsAudit.length,
    },
    idToken,
    forceRegrade: true,
  });

  // Test 50%
  const res50 = await gradeAndSubmitExam({
    attemptId: `${dummyAttemptBase}_50`,
    userId: dummyUid,
    userEmail: callerEmail,
    answers: simulatedAnswersHalf,
    clientAttemptData: {
      examId,
      userId: dummyUid,
      status: 'in_progress',
      questionCount: questionsAudit.length,
    },
    idToken,
    forceRegrade: true,
  });

  // Test Zero Index Answer: verify option 0 is evaluated properly
  const q1Audit = questionsAudit[0];
  const q1CorrectIsZero = q1Audit?.correctAnswer === 0;
  const resZeroIndex = await gradeAndSubmitExam({
    attemptId: `${dummyAttemptBase}_zero`,
    userId: dummyUid,
    userEmail: callerEmail,
    answers: { [q1Audit?.id || 'q1']: 0 },
    clientAttemptData: {
      examId,
      userId: dummyUid,
      status: 'in_progress',
      questionCount: 1,
    },
    idToken,
    forceRegrade: true,
  });

  const q1Review = resZeroIndex.reviews?.[0];
  const zeroIndexGradedAccurately = q1Review && 
    q1Review.studentAnswer === 0 && 
    q1Review.isCorrect === q1CorrectIsZero;

  const perfectScorePassed = res100.ok && (res100.attempt?.score === 100);
  const zeroScorePassed = res0.ok && (res0.attempt?.score === 0);
  const halfScorePassed = res50.ok && Math.abs((res50.attempt?.score ?? 0) - 50) <= 5;

  let overallStatus: 'pass' | 'warning' | 'error' = 'pass';
  if (errors.length > 0 || !perfectScorePassed || !zeroIndexGradedAccurately) {
    overallStatus = 'error';
  } else if (warnings.length > 0 || !secretLeakPassed || !zeroScorePassed || !halfScorePassed) {
    overallStatus = 'warning';
  }

  return {
    id: examId,
    title: examDoc?.title || 'بدون عنوان',
    subject: examDoc?.subjectNameAr || examDoc?.subject || 'غير محدد',
    status: examDoc?.status || 'unknown',
    published: Boolean(examDoc?.published),
    source,
    questionCount: questionsAudit.length,
    totalPoints: examDoc?.totalPoints || (questionsAudit.length * 5),
    durationMinutes: examDoc?.durationMinutes || 30,
    overallStatus,
    secretLeakTest: {
      passed: secretLeakPassed,
      leakedFields: publicLeakedFields,
    },
    dryRunGrading: {
      perfectScorePassed,
      zeroScorePassed,
      halfScorePassed,
      zeroIndexAnswerPassed: Boolean(zeroIndexGradedAccurately),
      details: `100% Test: ${res100.attempt?.score}%, 0% Test: ${res0.attempt?.score}%, 50% Test: ${res50.attempt?.score}%, Q1 (idx 0) match: ${zeroIndexGradedAccurately ? 'PASS' : 'FAIL'}`,
    },
    questions: questionsAudit,
    errors,
    warnings,
  };
}

/**
 * Migrates embedded official ministerial exams into Firestore collections (dryRun or execute)
 */
export async function migrateEmbeddedExamsToFirestore(params: {
  dryRun?: boolean;
  idToken?: string;
}): Promise<{
  success: boolean;
  migratedExams: string[];
  totalQuestionsMigrated: number;
  totalKeysMigrated: number;
  details: string[];
}> {
  const { dryRun = false, idToken } = params;
  const migratedExams: string[] = [];
  let totalQuestionsMigrated = 0;
  let totalKeysMigrated = 0;
  const details: string[] = [];

  const targets = [
    { exam: FIRST_EXAM, questions: FIRST_EXAM_QUESTIONS },
    { exam: LITERARY_EXAM, questions: LITERARY_EXAM_QUESTIONS },
    { exam: ISLAMIC_EXAM, questions: ISLAMIC_EXAM_QUESTIONS },
  ];

  const { db, hasServiceAccount } = getAdminFirestore();

  for (const item of targets) {
    const examId = item.exam.id;
    details.push(`[${dryRun ? 'DRY-RUN' : 'MIGRATE'}] Examination: ${item.exam.title} (${examId})`);

    if (!dryRun) {
      if (hasServiceAccount && db) {
        try {
          await db.collection('exams').doc(examId).set({
            ...item.exam,
            id: examId,
            updatedAt: new Date().toISOString(),
          }, { merge: true });

          for (const q of item.questions) {
            await db.collection('exams').doc(examId).collection('questions').doc(q.id).set({
              id: q.id,
              examId,
              order: q.order,
              questionText: q.questionText,
              options: q.options,
              difficulty: q.difficulty,
              source: q.source,
              points: q.points,
              questionType: q.questionType,
              hint: q.hint || null,
            }, { merge: true });
            totalQuestionsMigrated++;

            await db.collection('exams').doc(examId).collection('answerKeys').doc(q.id).set({
              id: q.id,
              correctAnswer: q.correctAnswer,
              explanation: q.explanation || '',
              hint: q.hint || null,
              solutionSteps: (q as any).solutionSteps || null,
              distractorAnalysis: (q as any).distractorAnalysis || null,
              updatedAt: new Date().toISOString(),
            }, { merge: true });
            totalKeysMigrated++;
          }
          migratedExams.push(examId);
        } catch (e: any) {
          details.push(`Error writing ${examId}: ${e?.message}`);
        }
      }
    } else {
      totalQuestionsMigrated += item.questions.length;
      totalKeysMigrated += item.questions.length;
      migratedExams.push(examId);
    }
  }

  return {
    success: true,
    migratedExams,
    totalQuestionsMigrated,
    totalKeysMigrated,
    details,
  };
}

/**
 * Server-authoritative regrade for all submitted attempts of a specific exam
 */
export async function regradeExamAttemptsServer(params: {
  examId: string;
  idToken?: string;
  callerEmail?: string;
}): Promise<{
  regradedCount: number;
  totalAttemptsFound: number;
  results: Array<{
    attemptId: string;
    userId: string;
    oldScore: number | null;
    newScore: number;
    pointsDelta: number;
  }>;
  errors: string[];
}> {
  const { examId, idToken, callerEmail } = params;
  const { db, hasServiceAccount } = getAdminFirestore();
  const results: Array<any> = [];
  const errors: string[] = [];
  let regradedCount = 0;
  let totalAttemptsFound = 0;

  let attemptDocs: any[] = [];
  if (hasServiceAccount && db) {
    try {
      const snap = await db.collection('attempts').where('examId', '==', examId).get();
      attemptDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e: any) {
      errors.push(`Firestore Admin attempts fetch warning: ${e?.message}`);
    }
  }

  // Fallback to REST
  if (attemptDocs.length === 0 && idToken) {
    try {
      const restAttempts = await getRestCollection('attempts', idToken);
      attemptDocs = restAttempts
        .map((r: any) => ({ id: r.id, ...(r.data || {}) }))
        .filter((a: any) => a.examId === examId);
    } catch (rErr: any) {
      errors.push(`REST attempts fetch error: ${rErr?.message}`);
    }
  }

  totalAttemptsFound = attemptDocs.length;

  for (const att of attemptDocs) {
    try {
      const oldScore = att.score ?? null;
      const oldPoints = att.pointsEarned ?? 0;

      const gradeRes = await gradeAndSubmitExam({
        attemptId: att.id,
        userId: att.userId,
        userEmail: callerEmail,
        answers: att.answers || {},
        clientAttemptData: att,
        idToken,
        forceRegrade: true,
      });

      if (gradeRes.ok && gradeRes.attempt) {
        const newScore = gradeRes.attempt.score;
        const newPoints = gradeRes.attempt.pointsEarned;
        results.push({
          attemptId: att.id,
          userId: att.userId,
          oldScore,
          newScore,
          pointsDelta: newPoints - oldPoints,
        });
        regradedCount++;
      } else {
        errors.push(`فشل تصحيح المحاولة ${att.id}: ${gradeRes.message}`);
      }
    } catch (itemErr: any) {
      errors.push(`خطأ في المحاولة ${att.id}: ${itemErr?.message}`);
    }
  }

  return {
    regradedCount,
    totalAttemptsFound,
    results,
    errors,
  };
}
