import {
  getAdminFirestore,
  gradeAndSubmitExam,
  parseCorrectAnswerIndex,
  resolveQuestionAnswerKey,
  type ResolvedKeySource,
} from './examGrader.js';
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
} from './examData.js';
import { FIRST_EXAM } from './firstExamData.js';
import { LITERARY_EXAM } from './literaryExamData.js';
import { GoogleGenAI } from '@google/genai';
import { firebaseAppConfig } from './config.js';
import {
  getRestCollection,
  getRestDoc,
  queryRestByField,
  commitRestBatch,
  type RestBatchWriteItem,
} from './firestoreRest.js';

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
  qDocKey: number | null;
  answerKeyDocKey: number | null;
  overrideKey: number | null;
  resolvedKey: number | null;
  keySource: ResolvedKeySource;
  hasConflict: boolean;
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
  version: number;
  source: 'firestore' | 'embedded';
  questionCount: number;
  answerKeysCount: number;
  keyConflictsCount: number;
  hasServiceAccount: boolean;
  questionIdPattern: string;
  totalPoints: number;
  durationMinutes: number;
  overallStatus: 'pass' | 'warning' | 'error';
  secretLeakTest: {
    passed: boolean;
    leakedFields: string[];
  };
  dryRunGrading: {
    perfectScorePassed: boolean; // 100%
    perfectScore: number | null;
    zeroScorePassed: boolean;    // 0%
    zeroScore: number | null;
    halfScorePassed: boolean;    // 50%
    halfScore: number | null;
    zeroIndexAnswerPassed: boolean; // Answer index 0 evaluated properly
    q1GradedCorrectly: boolean;
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
  let keyConflictsCount = 0;

  // Sort questions deterministically by order (never let missing order sort before Q1)
  questions.sort((a, b) => {
    const oa = typeof a.order === 'number' ? a.order : 999999;
    const ob = typeof b.order === 'number' ? b.order : 999999;
    return oa - ob;
  });

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

    const keyData = keysMap.get(qId);
    const yusufOverride = examId === SURAH_YUSUF_EXAM_ID ? SURAH_YUSUF_CORRECT_KEYS[qId] : undefined;

    const qDocKey = parseCorrectAnswerIndex(q.correctAnswer, options);
    const answerKeyDocKey = keyData ? parseCorrectAnswerIndex(keyData.correctAnswer, options) : null;
    const overrideKey = yusufOverride ? parseCorrectAnswerIndex(yusufOverride.correctAnswer, options) : null;

    const resolved = resolveQuestionAnswerKey({
      examId,
      questionId: qId,
      qData: q,
      keyData,
      options,
    });
    const parsedAnsIndex = resolved.index;

    const hasConflict = Boolean(
      (answerKeyDocKey !== null && qDocKey !== null && answerKeyDocKey !== qDocKey) ||
      (answerKeyDocKey === null && qDocKey !== null) ||
      (overrideKey !== null && parsedAnsIndex !== null && overrideKey !== parsedAnsIndex)
    );
    if (hasConflict) {
      keyConflictsCount++;
      qIssues.push(
        `تعارض/نقص مفاتيح: questions=${qDocKey ?? 'غير محدد'} | answerKeys=${answerKeyDocKey ?? 'مفقود'}${overrideKey !== null ? ` | override=${overrideKey}` : ''}`
      );
      warnings.push(`السؤال #${typeof q.order === 'number' ? q.order : idx + 1} (${qId}): تعارض بين questions و answerKeys.`);
    }

    const inBounds = parsedAnsIndex !== null && parsedAnsIndex >= 0 && parsedAnsIndex < options.length;
    if (!inBounds) {
      qIssues.push(`الإجابة الصحيحة (${resolved.rawKey}) غير مطابقة لأي خيار متاح (0-${options.length - 1}).`);
      errors.push(`السؤال رقم ${idx + 1} (${qId}): مفتاح الإجابة غير صالح.`);
    }

    const expl = keyData?.explanation || q.explanation || yusufOverride?.explanation || '';
    if (!expl.trim()) {
      warnings.push(`السؤال رقم ${idx + 1} لا يحتوي على شرح وتفسير للإجابة.`);
    }

    questionsAudit.push({
      id: qId,
      order: typeof q.order === 'number' ? q.order : (idx + 1),
      questionText: q.questionText || '',
      optionsCount: options.length,
      options,
      correctAnswer: parsedAnsIndex,
      correctOptionText: inBounds && parsedAnsIndex !== null ? options[parsedAnsIndex] : undefined,
      qDocKey,
      answerKeyDocKey,
      overrideKey,
      resolvedKey: parsedAnsIndex,
      keySource: resolved.sourceUsed,
      hasConflict,
      hasExplanation: Boolean(expl.trim()),
      hasHint: Boolean(keyData?.hint || q.hint),
      hasAnswerKey: Boolean(keyData),
      inBounds,
      issues: qIssues,
    });
  }

  // 1. Secret Leak Test: simulate student fetching public questions payload
  const publicLeakedFields: string[] = [];
  questions.forEach((q, idx) => {
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
  const zeroIndexGradedAccurately = Boolean(
    q1Review &&
    q1Review.studentAnswer === 0 &&
    q1Review.isCorrect === q1CorrectIsZero
  );
  const q1From100 = res100.reviews?.[0];
  const q1GradedCorrectly = Boolean(q1From100 && q1From100.isCorrect === true);

  const perfectScorePassed = res100.ok && (res100.attempt?.score === 100);
  const zeroScorePassed = res0.ok && (res0.attempt?.score === 0);
  const halfScorePassed = res50.ok && Math.abs((res50.attempt?.score ?? 0) - 50) <= 5;

  let overallStatus: 'pass' | 'warning' | 'error' = 'pass';
  if (errors.length > 0 || !perfectScorePassed || !zeroIndexGradedAccurately || !q1GradedCorrectly) {
    overallStatus = 'error';
  } else if (warnings.length > 0 || keyConflictsCount > 0 || !secretLeakPassed || !zeroScorePassed || !halfScorePassed) {
    overallStatus = 'warning';
  }

  const sampleIds = questionsAudit.slice(0, 3).map((q) => q.id);
  const questionIdPattern = sampleIds.length > 0
    ? `${sampleIds[0]} ... (${questionsAudit.length} سؤال)`
    : 'غير محدد';

  return {
    id: examId,
    title: examDoc?.title || 'بدون عنوان',
    subject: examDoc?.subjectNameAr || examDoc?.subject || 'غير محدد',
    status: examDoc?.status || 'unknown',
    published: Boolean(examDoc?.published),
    version: Number(examDoc?.version) || 1,
    source,
    questionCount: questionsAudit.length,
    answerKeysCount: answerKeys.length,
    keyConflictsCount,
    hasServiceAccount,
    questionIdPattern,
    totalPoints: examDoc?.totalPoints || (questionsAudit.length * 5),
    durationMinutes: examDoc?.durationMinutes || 30,
    overallStatus,
    secretLeakTest: {
      passed: secretLeakPassed,
      leakedFields: publicLeakedFields,
    },
    dryRunGrading: {
      perfectScorePassed,
      perfectScore: res100.attempt?.score ?? null,
      zeroScorePassed,
      zeroScore: res0.attempt?.score ?? null,
      halfScorePassed,
      halfScore: res50.attempt?.score ?? null,
      zeroIndexAnswerPassed: Boolean(zeroIndexGradedAccurately),
      q1GradedCorrectly,
      details: `100%: ${res100.attempt?.score ?? 'err'}% | 0%: ${res0.attempt?.score ?? 'err'}% | 50%: ${res50.attempt?.score ?? 'err'}% | س1 (100%): ${q1GradedCorrectly ? 'PASS' : 'FAIL'} | Index-0: ${zeroIndexGradedAccurately ? 'PASS' : 'FAIL'}`,
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

export interface GradingTraceOptionItem {
  optionId: string;
  index: number;
  text: string;
  isStudentPick: boolean;
  isKeyInAnswerKeys: boolean;
  isKeyInQuestions: boolean;
  isKeyInOverride: boolean;
  isKeyInAdminEditor: boolean;
  isKeyInGrader: boolean;
}

export interface GradingTraceQuestionRow {
  questionId: string;
  order: number;
  questionText: string;
  rawStudentAnswer: any;
  convertedOptionId: string | null;
  convertedOptionIdx: number | null;
  answerKeysOptionId: string | null;
  answerKeysIndex: number | null;
  questionsDocOptionId: string | null;
  questionsDocIndex: number | null;
  overrideOptionId: string | null;
  overrideIndex: number | null;
  adminEditorOptionId: string | null;
  adminEditorIndex: number | null;
  graderOptionId: string | null;
  graderIndex: number | null;
  graderSourceUsed: ResolvedKeySource;
  graderFallbackUsed: boolean;
  fallbackNote: string;
  isUnanswered: boolean;
  isCorrect: boolean | null;
  storedReviewIsCorrect: boolean | null;
  hasConflict: boolean;
  optionsTrace: GradingTraceOptionItem[];
}

export interface ExamGradingTraceReport {
  exam: {
    id: string;
    title: string;
    subject: string;
    version: number;
    questionCount: number;
    answerKeysCount: number;
    published: boolean;
  };
  serverEnvironment: {
    hasServiceAccount: boolean;
    studentReadWarning: string | null;
  };
  questionIdPattern: {
    detectedPattern: string;
    sampleIds: string[];
    mappingLogic: string;
  };
  attempts: Array<{
    id: string;
    userId: string;
    userDisplayName: string;
    status: string;
    score: number | null;
    submittedAt: string | null;
    startedAt: string | null;
  }>;
  selectedAttempt: {
    id: string;
    userId: string;
    userDisplayName: string;
    status: string;
    score: number | null;
    submittedAt: string | null;
    answersCount: number;
  } | null;
  traceRows: GradingTraceQuestionRow[];
}

function detectQuestionIdPattern(ids: string[], examId: string): string {
  if (ids.length === 0) return 'لا توجد أسئلة';
  if (ids.every((id) => id.startsWith(`q_${examId}_`))) {
    return `q_${examId}_{N} (ترقيم يبدأ من 1)`;
  }
  if (ids.every((id) => /^q_?\d+$/i.test(id))) {
    return 'q{N} / q_{N}';
  }
  if (ids.every((id) => /^lit_q\d+$/i.test(id))) {
    return 'lit_q{N}';
  }
  if (ids.every((id) => /^isl_q\d+$/i.test(id))) {
    return 'isl_q{N}';
  }
  return `مخصص (${ids.slice(0, 2).join(', ')}...)`;
}

async function fetchExamDocsForAdminTool(examId: string, idToken?: string): Promise<{
  examDoc: any;
  questions: any[];
  answerKeys: any[];
  hasServiceAccount: boolean;
}> {
  const { db, hasServiceAccount } = getAdminFirestore();
  let examDoc: any = null;
  let questions: any[] = [];
  let answerKeys: any[] = [];

  if (hasServiceAccount && db) {
    try {
      const eSnap = await db.collection('exams').doc(examId).get();
      if (eSnap.exists) examDoc = { id: eSnap.id, ...eSnap.data() };
      const qSnap = await db.collection('exams').doc(examId).collection('questions').get();
      questions = qSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const kSnap = await db.collection('exams').doc(examId).collection('answerKeys').get();
      answerKeys = kSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e: any) {
      console.warn('[AdminTool] Firestore Admin read warning:', e?.message);
    }
  }

  if ((!examDoc || questions.length === 0) && idToken) {
    try {
      examDoc = await getRestDoc(`exams/${examId}`, idToken);
      const qDocs = await getRestCollection(`exams/${examId}/questions`, idToken);
      questions = qDocs.map((d) => ({ id: d.id, ...d.data }));
      const kDocs = await getRestCollection(`exams/${examId}/answerKeys`, idToken);
      answerKeys = kDocs.map((d) => ({ id: d.id, ...d.data }));
    } catch (e: any) {
      console.warn('[AdminTool] REST read warning:', e?.message);
    }
  }

  // Sort cleanly without letting missing order precede Q1
  questions.sort((a, b) => {
    const oa = typeof a.order === 'number' ? a.order : 999999;
    const ob = typeof b.order === 'number' ? b.order : 999999;
    return oa - ob;
  });

  return { examDoc, questions, answerKeys, hasServiceAccount };
}

/**
 * Read-Only Grading Trace (تتبّع التصحيح) for any exam + attempt
 */
export async function getExamGradingTrace(params: {
  examId: string;
  attemptId?: string;
  idToken?: string;
}): Promise<ExamGradingTraceReport> {
  const { examId, attemptId, idToken } = params;
  const { db, hasServiceAccount } = getAdminFirestore();
  const { examDoc, questions, answerKeys } = await fetchExamDocsForAdminTool(examId, idToken);

  const keysMap = new Map<string, any>();
  answerKeys.forEach((k) => keysMap.set(k.id || k.questionId, k));

  // Fetch attempts list for this exam
  let rawAttempts: any[] = [];
  if (hasServiceAccount && db) {
    try {
      const snap = await db.collection('attempts').where('examId', '==', examId).limit(50).get();
      rawAttempts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e: any) {
      console.warn('[GradingTrace] Admin attempts query warning:', e?.message);
    }
  }
  if (rawAttempts.length === 0 && idToken) {
    try {
      const qRes = await queryRestByField('attempts', 'examId', examId, idToken, 50);
      rawAttempts = qRes.map((r) => ({ id: r.id, ...r.data }));
    } catch (e: any) {
      console.warn('[GradingTrace] REST attempts query warning:', e?.message);
    }
  }

  rawAttempts.sort((a, b) => {
    const ta = new Date(a.submittedAt || a.startedAt || 0).getTime();
    const tb = new Date(b.submittedAt || b.startedAt || 0).getTime();
    return tb - ta;
  });

  const attemptsSummary = rawAttempts.map((a) => ({
    id: a.id,
    userId: a.userId || '',
    userDisplayName: a.userDisplayName || a.userId || 'طالب',
    status: a.status || 'unknown',
    score: a.score ?? null,
    submittedAt: a.submittedAt || null,
    startedAt: a.startedAt || null,
  }));

  // Resolve selected attempt
  const targetAttemptId = attemptId || (attemptsSummary[0]?.id ?? undefined);
  let selectedAttemptDoc: any = targetAttemptId ? rawAttempts.find((a) => a.id === targetAttemptId) || null : null;
  let attemptAnswersMap: Record<string, any> = {};
  const reviewMap = new Map<string, any>();

  if (targetAttemptId) {
    if (!selectedAttemptDoc) {
      if (hasServiceAccount && db) {
        const snap = await db.collection('attempts').doc(targetAttemptId).get().catch(() => null);
        if (snap && snap.exists) selectedAttemptDoc = { id: snap.id, ...snap.data() };
      } else if (idToken) {
        const docData = await getRestDoc(`attempts/${targetAttemptId}`, idToken);
        if (docData) selectedAttemptDoc = { id: targetAttemptId, ...docData };
      }
    }

    if (selectedAttemptDoc) {
      if (selectedAttemptDoc.answers && typeof selectedAttemptDoc.answers === 'object') {
        attemptAnswersMap = { ...selectedAttemptDoc.answers };
      }

      // Also fetch attempts/{id}/answers subcollection
      if (hasServiceAccount && db) {
        try {
          const ansSnap = await db.collection('attempts').doc(targetAttemptId).collection('answers').get();
          ansSnap.docs.forEach((ad) => {
            const d = ad.data();
            const qKey = d.questionId || ad.id;
            if (attemptAnswersMap[qKey] === undefined || attemptAnswersMap[qKey] === null) {
              attemptAnswersMap[qKey] = d.selectedAnswer !== undefined ? d.selectedAnswer : d.selectedOptionIndex;
            }
          });
        } catch {}
      } else if (idToken) {
        try {
          const ansDocs = await getRestCollection(`attempts/${targetAttemptId}/answers`, idToken);
          ansDocs.forEach((ad) => {
            const qKey = ad.data.questionId || ad.id;
            if (attemptAnswersMap[qKey] === undefined || attemptAnswersMap[qKey] === null) {
              attemptAnswersMap[qKey] = ad.data.selectedAnswer !== undefined ? ad.data.selectedAnswer : ad.data.selectedOptionIndex;
            }
          });
        } catch {}
      }

      if (Array.isArray(selectedAttemptDoc.reviews)) {
        selectedAttemptDoc.reviews.forEach((r: any) => {
          if (r?.questionId) reviewMap.set(r.questionId, r);
        });
      }
    }
  }

  const traceRows: GradingTraceQuestionRow[] = questions.map((q, idx) => {
    const qId = q.id;
    const options: string[] = Array.isArray(q.options) ? q.options : [];
    const keyData = keysMap.get(qId) || null;
    const yusufOverride = examId === SURAH_YUSUF_EXAM_ID ? SURAH_YUSUF_CORRECT_KEYS[qId] : undefined;

    const answerKeysIndex = keyData ? parseCorrectAnswerIndex(keyData.correctAnswer, options) : null;
    const questionsDocIndex = q.correctAnswer !== undefined && q.correctAnswer !== null
      ? parseCorrectAnswerIndex(q.correctAnswer, options)
      : null;
    const overrideIndex = yusufOverride ? parseCorrectAnswerIndex(yusufOverride.correctAnswer, options) : null;

    // Unified Admin Editor & Grader resolution
    const resolved = resolveQuestionAnswerKey({
      examId,
      questionId: qId,
      qData: q,
      keyData,
      options,
    });

    const adminEditorIndex = resolved.index;
    const graderIndex = resolved.index;

    // Raw student answer
    let rawStudentAnswer: any = null;
    if (selectedAttemptDoc) {
      if (attemptAnswersMap[qId] !== undefined && attemptAnswersMap[qId] !== null) {
        rawStudentAnswer = attemptAnswersMap[qId];
      } else if (attemptAnswersMap[qId.toLowerCase()] !== undefined && attemptAnswersMap[qId.toLowerCase()] !== null) {
        rawStudentAnswer = attemptAnswersMap[qId.toLowerCase()];
      } else if (reviewMap.get(qId)?.studentAnswer !== undefined && reviewMap.get(qId)?.studentAnswer !== null) {
        rawStudentAnswer = reviewMap.get(qId).studentAnswer;
      }
    }

    const convertedOptionIdx = rawStudentAnswer !== null && rawStudentAnswer !== undefined
      ? parseCorrectAnswerIndex(rawStudentAnswer, options)
      : null;
    const convertedOptionId = convertedOptionIdx !== null ? `opt_${convertedOptionIdx}` : null;
    const isUnanswered = convertedOptionId === null;
    const isCorrect = selectedAttemptDoc
      ? (!isUnanswered && resolved.optionId !== null && convertedOptionId === resolved.optionId)
      : null;

    const hasConflict = Boolean(
      (answerKeysIndex !== null && questionsDocIndex !== null && answerKeysIndex !== questionsDocIndex) ||
      (answerKeysIndex === null && questionsDocIndex !== null) ||
      (overrideIndex !== null && resolved.index !== null && overrideIndex !== resolved.index) ||
      resolved.index === null
    );

    let fallbackNote = 'مطابق مباشر من answerKeys';
    if (resolved.sourceUsed === 'questions') {
      fallbackNote = 'Fallback: تم أخذ المفتاح من حقل questions.correctAnswer لغياب answerKeys';
    } else if (resolved.sourceUsed === 'yusufOverride') {
      fallbackNote = 'Fallback: تم أخذ المفتاح من جدول سورة يوسف الاحتياطي';
    } else if (resolved.sourceUsed === 'missing') {
      fallbackNote = 'مفتاح الإجابة مفقود أو غير صالح';
    }

    if (!hasServiceAccount && answerKeysIndex !== null && questionsDocIndex !== null && answerKeysIndex !== questionsDocIndex) {
      fallbackNote += ` | تنبيه: الطالب قد يقرأ questions (${questionsDocIndex}) ما لم تتطابق مع answerKeys (${answerKeysIndex})`;
    }

    const optionsTrace: GradingTraceOptionItem[] = options.map((optText, optIdx) => ({
      optionId: `opt_${optIdx}`,
      index: optIdx,
      text: optText,
      isStudentPick: convertedOptionIdx === optIdx,
      isKeyInAnswerKeys: answerKeysIndex === optIdx,
      isKeyInQuestions: questionsDocIndex === optIdx,
      isKeyInOverride: overrideIndex === optIdx,
      isKeyInAdminEditor: adminEditorIndex === optIdx,
      isKeyInGrader: graderIndex === optIdx,
    }));

    return {
      questionId: qId,
      order: typeof q.order === 'number' ? q.order : (idx + 1),
      questionText: q.questionText || '',
      rawStudentAnswer,
      convertedOptionId,
      convertedOptionIdx,
      answerKeysOptionId: answerKeysIndex !== null ? `opt_${answerKeysIndex}` : null,
      answerKeysIndex,
      questionsDocOptionId: questionsDocIndex !== null ? `opt_${questionsDocIndex}` : null,
      questionsDocIndex,
      overrideOptionId: overrideIndex !== null ? `opt_${overrideIndex}` : null,
      overrideIndex,
      adminEditorOptionId: adminEditorIndex !== null ? `opt_${adminEditorIndex}` : null,
      adminEditorIndex,
      graderOptionId: resolved.optionId,
      graderIndex,
      graderSourceUsed: resolved.sourceUsed,
      graderFallbackUsed: resolved.fallbackUsed,
      fallbackNote,
      isUnanswered,
      isCorrect,
      storedReviewIsCorrect: reviewMap.get(qId)?.isCorrect ?? null,
      hasConflict,
      optionsTrace,
    };
  });

  const qIds = questions.map((q) => q.id);

  return {
    exam: {
      id: examId,
      title: examDoc?.title || 'بدون عنوان',
      subject: examDoc?.subjectNameAr || examDoc?.subject || 'غير محدد',
      version: Number(examDoc?.version) || 1,
      questionCount: questions.length,
      answerKeysCount: answerKeys.length,
      published: Boolean(examDoc?.published),
    },
    serverEnvironment: {
      hasServiceAccount,
      studentReadWarning: !hasServiceAccount
        ? 'الخادم يعمل حالياً بدون FIREBASE_SERVICE_ACCOUNT_KEY؛ عند تسليم الطالب تُقرأ answerKeys فقط إذا كان للخادم صلاحية أو تُستخدم questions/fallback. استخدم "إصلاح المفاتيح" لتوحيد المصدرين.'
        : null,
    },
    questionIdPattern: {
      detectedPattern: detectQuestionIdPattern(qIds, examId),
      sampleIds: qIds.slice(0, 5),
      mappingLogic: 'المصحح يطابق معرف الوثيقة مباشرة: answers[q.id] (أو q.id.toLowerCase()) مع تحويل الفهرس 0..3 أو "opt_N" إلى opt_N، دون تحويل q_${i} <-> lit_q${i}.',
    },
    attempts: attemptsSummary,
    selectedAttempt: selectedAttemptDoc
      ? {
          id: selectedAttemptDoc.id,
          userId: selectedAttemptDoc.userId || '',
          userDisplayName: selectedAttemptDoc.userDisplayName || selectedAttemptDoc.userId || 'طالب',
          status: selectedAttemptDoc.status || 'unknown',
          score: selectedAttemptDoc.score ?? null,
          submittedAt: selectedAttemptDoc.submittedAt || null,
          answersCount: Object.keys(attemptAnswersMap).length,
        }
      : null,
    traceRows,
  };
}

export interface SyncExamKeyConflict {
  questionId: string;
  order: number;
  questionText: string;
  options: string[];
  before: {
    answerKeysIndex: number | null;
    questionsDocIndex: number | null;
    overrideIndex: number | null;
    optionText: string;
  };
  after: {
    targetIndex: number;
    targetOptionId: string;
    targetOptionText: string;
  };
  reason: string;
}

export interface SyncExamKeysResult {
  examId: string;
  examTitle: string;
  previousVersion: number;
  newVersion: number;
  confirmApplied: boolean;
  totalQuestions: number;
  conflictsCount: number;
  conflicts: SyncExamKeyConflict[];
  batchWriteSucceeded: boolean;
  batchWriteError?: string;
  regradeResult?: Awaited<ReturnType<typeof regradeExamAttemptsServer>> | null;
}

/**
 * Preview conflicts and (on confirm=true) atomically write answerKeys & sync questions + increment exam version
 */
export async function syncExamKeysFromAdminReference(params: {
  examId: string;
  confirm?: boolean;
  regradeAttempts?: boolean;
  overrides?: Record<string, number>;
  idToken?: string;
  callerEmail?: string;
}): Promise<SyncExamKeysResult> {
  const { examId, confirm = false, regradeAttempts = false, overrides = {}, idToken, callerEmail } = params;
  const { db, hasServiceAccount } = getAdminFirestore();
  const { examDoc, questions, answerKeys } = await fetchExamDocsForAdminTool(examId, idToken);

  const keysMap = new Map<string, any>();
  answerKeys.forEach((k) => keysMap.set(k.id || k.questionId, k));

  const previousVersion = Number(examDoc?.version) || 1;
  const conflicts: SyncExamKeyConflict[] = [];
  const batchPayloads: Array<{
    qId: string;
    targetIndex: number;
    explanation: string;
    hint: string | null;
    solutionSteps: any;
    distractorAnalysis: any;
    hasQuestionCorrectField: boolean;
  }> = [];

  questions.forEach((q, idx) => {
    const qId = q.id;
    const options: string[] = Array.isArray(q.options) ? q.options : [];
    const keyData = keysMap.get(qId) || null;
    const yusufOverride = examId === SURAH_YUSUF_EXAM_ID ? SURAH_YUSUF_CORRECT_KEYS[qId] : undefined;

    const answerKeysIndex = keyData ? parseCorrectAnswerIndex(keyData.correctAnswer, options) : null;
    const questionsDocIndex = q.correctAnswer !== undefined && q.correctAnswer !== null
      ? parseCorrectAnswerIndex(q.correctAnswer, options)
      : null;
    const overrideIndex = yusufOverride ? parseCorrectAnswerIndex(yusufOverride.correctAnswer, options) : null;

    const resolved = resolveQuestionAnswerKey({
      examId,
      questionId: qId,
      qData: q,
      keyData,
      options,
    });

    // Reference key: explicit override from admin UI, else unified Admin Editor resolved key
    let targetIndex: number | null =
      typeof overrides[qId] === 'number' && Number.isInteger(overrides[qId]) && overrides[qId] >= 0
        ? overrides[qId]
        : resolved.index;

    if (targetIndex === null || (options.length > 0 && targetIndex >= options.length)) {
      targetIndex = 0;
    }

    const needsAnswerKeyWrite = answerKeysIndex !== targetIndex || !keyData;
    const hasQuestionCorrectField = q.correctAnswer !== undefined;
    const needsQuestionSync = hasQuestionCorrectField && questionsDocIndex !== targetIndex;

    if (needsAnswerKeyWrite || needsQuestionSync || typeof overrides[qId] === 'number') {
      const reasons: string[] = [];
      if (!keyData || answerKeysIndex === null) reasons.push('مفتاح answerKeys مفقود');
      else if (answerKeysIndex !== targetIndex) reasons.push(`answerKeys (${answerKeysIndex}) ≠ المرجع (${targetIndex})`);
      if (needsQuestionSync) reasons.push(`questions.correctAnswer (${questionsDocIndex}) ≠ المرجع (${targetIndex})`);
      if (typeof overrides[qId] === 'number' && resolved.index !== overrides[qId]) {
        reasons.push(`تعديل إداري يدوي إلى الخيار #${overrides[qId]}`);
      }

      if (reasons.length > 0) {
        const beforeIdx = answerKeysIndex ?? questionsDocIndex ?? overrideIndex;
        conflicts.push({
          questionId: qId,
          order: typeof q.order === 'number' ? q.order : (idx + 1),
          questionText: q.questionText || '',
          options,
          before: {
            answerKeysIndex,
            questionsDocIndex,
            overrideIndex,
            optionText: beforeIdx !== null && beforeIdx >= 0 && beforeIdx < options.length ? options[beforeIdx] : 'غير محدد',
          },
          after: {
            targetIndex,
            targetOptionId: `opt_${targetIndex}`,
            targetOptionText: targetIndex < options.length ? options[targetIndex] : '',
          },
          reason: reasons.join(' + '),
        });

        batchPayloads.push({
          qId,
          targetIndex,
          explanation: keyData?.explanation || q.explanation || yusufOverride?.explanation || '',
          hint: keyData?.hint || q.hint || null,
          solutionSteps: keyData?.solutionSteps || q.solutionSteps || null,
          distractorAnalysis: keyData?.distractorAnalysis || q.distractorAnalysis || null,
          hasQuestionCorrectField,
        });
      }
    }
  });

  if (!confirm || batchPayloads.length === 0) {
    return {
      examId,
      examTitle: examDoc?.title || 'بدون عنوان',
      previousVersion,
      newVersion: previousVersion,
      confirmApplied: false,
      totalQuestions: questions.length,
      conflictsCount: conflicts.length,
      conflicts,
      batchWriteSucceeded: false,
      regradeResult: null,
    };
  }

  const newVersion = previousVersion + 1;
  const nowIso = new Date().toISOString();
  let batchWriteSucceeded = false;
  let batchWriteError: string | undefined;

  if (hasServiceAccount && db) {
    try {
      const batch = db.batch();
      for (const item of batchPayloads) {
        const keyRef = db.collection('exams').doc(examId).collection('answerKeys').doc(item.qId);
        batch.set(
          keyRef,
          {
            id: item.qId,
            questionId: item.qId,
            correctAnswer: item.targetIndex,
            explanation: item.explanation,
            hint: item.hint,
            solutionSteps: item.solutionSteps,
            distractorAnalysis: item.distractorAnalysis,
            updatedAt: nowIso,
            syncedBy: callerEmail || 'admin',
          },
          { merge: true }
        );

        if (item.hasQuestionCorrectField) {
          const qRef = db.collection('exams').doc(examId).collection('questions').doc(item.qId);
          batch.update(qRef, {
            correctAnswer: item.targetIndex,
            explanation: item.explanation,
            updatedAt: nowIso,
          });
        }
      }

      const examRef = db.collection('exams').doc(examId);
      batch.set(
        examRef,
        {
          version: newVersion,
          updatedAt: nowIso,
        },
        { merge: true }
      );

      await batch.commit();
      batchWriteSucceeded = true;
    } catch (batchErr: any) {
      batchWriteError = batchErr?.message || 'Admin batch commit failed';
    }
  } else if (idToken) {
    const writes: RestBatchWriteItem[] = [];
    for (const item of batchPayloads) {
      writes.push({
        docPath: `exams/${examId}/answerKeys/${item.qId}`,
        data: {
          id: item.qId,
          questionId: item.qId,
          correctAnswer: item.targetIndex,
          explanation: item.explanation,
          hint: item.hint,
          updatedAt: nowIso,
          syncedBy: callerEmail || 'admin',
        },
        fieldPaths: ['id', 'questionId', 'correctAnswer', 'explanation', 'hint', 'updatedAt', 'syncedBy'],
      });

      if (item.hasQuestionCorrectField) {
        writes.push({
          docPath: `exams/${examId}/questions/${item.qId}`,
          data: {
            correctAnswer: item.targetIndex,
            explanation: item.explanation,
            updatedAt: nowIso,
          },
          fieldPaths: ['correctAnswer', 'explanation', 'updatedAt'],
        });
      }
    }

    writes.push({
      docPath: `exams/${examId}`,
      data: {
        version: newVersion,
        updatedAt: nowIso,
      },
      fieldPaths: ['version', 'updatedAt'],
    });

    const restBatchRes = await commitRestBatch(writes, idToken);
    batchWriteSucceeded = restBatchRes.ok;
    batchWriteError = restBatchRes.error;
  } else {
    batchWriteError = 'لا تتوفر صلاحيات كتابة كافية لتنفيذ الـ Batch.';
  }

  let regradeResult: Awaited<ReturnType<typeof regradeExamAttemptsServer>> | null = null;
  if (batchWriteSucceeded && regradeAttempts) {
    regradeResult = await regradeExamAttemptsServer({
      examId,
      idToken,
      callerEmail,
    });
  }

  return {
    examId,
    examTitle: examDoc?.title || 'بدون عنوان',
    previousVersion,
    newVersion: batchWriteSucceeded ? newVersion : previousVersion,
    confirmApplied: batchWriteSucceeded,
    totalQuestions: questions.length,
    conflictsCount: conflicts.length,
    conflicts,
    batchWriteSucceeded,
    batchWriteError,
    regradeResult,
  };
}

