import { auth } from './firebase';
import type { Exam, ExamAttempt, Question, QuestionReview } from '../types';
import {
  deleteActiveOfflineAttempt,
  deleteOfflinePackage,
  estimateJsonByteSize,
  getActiveOfflineAttemptById,
  getActiveOfflineAttemptForExam,
  getOfflinePackage,
  getPendingSubmissionForExam,
  saveActiveOfflineAttempt,
  saveOfflinePackage,
  upsertPendingSubmission,
  type OfflineActiveAttempt,
  type OfflineExamPackage,
  type PendingSubmissionRecord,
} from './offlineDb';

export async function downloadOfflineExamPackage(
  examId: string,
  uid: string
): Promise<OfflineExamPackage> {
  if (!uid) {
    throw new Error('يرجى تسجيل الدخول لتنزيل الامتحان.');
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('يتطلب تنزيل الامتحان اتصالاً بالإنترنت.');
  }

  let idToken = '';
  if (auth.currentUser) {
    idToken = await auth.currentUser.getIdToken();
  }
  if (!idToken) {
    throw new Error('تعذر التحقق من الجلسة الحالية، يرجى إعادة تسجيل الدخول.');
  }

  const res = await fetch('/api/exams/offline-package', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ examId }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.message || 'تعذر تنزيل حزمة الامتحان للاستخدام بدون إنترنت.');
  }

  const payloadWithoutSize = {
    key: `${uid}::${examId}`,
    uid,
    examId,
    exam: data.exam as Exam,
    version: Number(data.version || data.exam?.version || 1),
    downloadedAt: data.downloadedAt || new Date().toISOString(),
    questions: data.questions || [],
    answerKeys: data.answerKeys || {},
  };

  const sizeBytes = estimateJsonByteSize(payloadWithoutSize);
  const fullPackage: OfflineExamPackage = {
    ...payloadWithoutSize,
    sizeBytes,
  };

  await saveOfflinePackage(fullPackage);
  return fullPackage;
}

export async function removeDownloadedExamPackage(uid: string, examId: string): Promise<void> {
  await deleteOfflinePackage(uid, examId);
}

/**
 * Compute remaining seconds safely across reloads without allowing clock rewind cheats.
 */
export function computeOfflineRemainingSeconds(active: OfflineActiveAttempt): number {
  const nowWall = Date.now();
  const deltaWall = Math.max(0, nowWall - (active.lastWallCheckpointAt || nowWall));
  const totalElapsedMs = (active.accumulatedActiveMs || 0) + deltaWall;
  const totalAllowedMs = (active.durationSecondsTotal || 900) * 1000;
  return Math.max(0, Math.floor((totalAllowedMs - totalElapsedMs) / 1000));
}

export function extractOfflineAnswersRecord(active: OfflineActiveAttempt): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  if (!active?.answers) return out;
  for (const [qId, entry] of Object.entries(active.answers)) {
    if (entry && typeof entry.optionIndex === 'number') {
      out[qId] = entry.optionIndex;
    }
  }
  return out;
}

export async function startOrResumeOfflineAttempt(
  examId: string,
  uid: string,
  userDisplayName?: string
): Promise<{ attempt: ExamAttempt; questions: Question[]; isResumed: boolean }> {
  const pkg = await getOfflinePackage(uid, examId);
  if (!pkg) {
    throw new Error('هذا الامتحان غير منزّل على جهازك. يرجى الاتصال بالإنترنت وتنزيله أولاً.');
  }

  // Enforce max 1 pending submission per (uid, examId) until synced with server
  const pendingExisting = await getPendingSubmissionForExam(uid, examId);
  if (pendingExisting) {
    return {
      attempt: pendingExisting.provisionalAttempt,
      questions: pkg.questions,
      isResumed: true,
    };
  }

  // Check active attempt
  const existingActive = await getActiveOfflineAttemptForExam(uid, examId);
  if (existingActive) {
    const remaining = computeOfflineRemainingSeconds(existingActive);
    if (remaining > 0) {
      const refreshedMeta: ExamAttempt = {
        ...existingActive.attemptMeta,
        lastQuestionIndex: existingActive.lastQuestionIndex || 0,
        source: 'offline',
      };
      return {
        attempt: refreshedMeta,
        questions: pkg.questions,
        isResumed: true,
      };
    }

    // Time expired offline -> finalize provisional result automatically
    const provisional = await submitOfflineAttemptProvisional(
      existingActive.id,
      uid,
      extractOfflineAnswersRecord(existingActive),
      existingActive.durationSecondsTotal
    );
    return {
      attempt: provisional,
      questions: pkg.questions,
      isResumed: true,
    };
  }

  const startedDate = new Date();
  const durationSecondsTotal = Math.max(60, (pkg.exam.durationMinutes || 15) * 60);
  const expectedEndDate = new Date(startedDate.getTime() + durationSecondsTotal * 1000);
  const attemptId = `offline_${uid.slice(0, 8)}_${examId}_${Date.now()}`;

  const attemptMeta: ExamAttempt = {
    id: attemptId,
    userId: uid,
    examId,
    examVersion: pkg.version,
    examTitle: pkg.exam.title,
    examSubject: pkg.exam.subjectNameAr || pkg.exam.subject,
    lesson: pkg.exam.lesson,
    totalPoints: pkg.exam.totalPoints,
    questionCount: pkg.questions.length,
    startedAt: startedDate.toISOString(),
    expectedEndAt: expectedEndDate.toISOString(),
    submittedAt: null,
    status: 'in_progress',
    score: null,
    pointsEarned: 0,
    correctAnswers: 0,
    wrongAnswers: 0,
    unanswered: 0,
    durationSeconds: 0,
    lastSavedAt: startedDate.toISOString(),
    lastQuestionIndex: 0,
    userDisplayName: userDisplayName || undefined,
    source: 'offline',
  };

  const activeRecord: OfflineActiveAttempt = {
    id: attemptId,
    uid,
    examId,
    examVersion: pkg.version,
    startedAt: startedDate.toISOString(),
    expectedEndAt: expectedEndDate.toISOString(),
    durationSecondsTotal,
    accumulatedActiveMs: 0,
    lastWallCheckpointAt: startedDate.getTime(),
    lastQuestionIndex: 0,
    answers: {},
    updatedAt: startedDate.toISOString(),
    attemptMeta,
  };

  await saveActiveOfflineAttempt(activeRecord);

  return {
    attempt: attemptMeta,
    questions: pkg.questions,
    isResumed: false,
  };
}

export async function saveOfflineAnswer(
  uid: string,
  attemptId: string,
  questionId: string,
  selectedAnswer: number | null,
  elapsedActiveMs?: number
): Promise<void> {
  const active = await getActiveOfflineAttemptById(uid, attemptId);
  if (!active) return;

  const nextAnswers = { ...active.answers };
  if (selectedAnswer === null || selectedAnswer === undefined) {
    delete nextAnswers[questionId];
  } else {
    nextAnswers[questionId] = {
      optionIndex: selectedAnswer,
      optionId: `opt_${selectedAnswer}`,
    };
  }

  const now = Date.now();
  await saveActiveOfflineAttempt({
    ...active,
    answers: nextAnswers,
    accumulatedActiveMs:
      typeof elapsedActiveMs === 'number'
        ? Math.max(active.accumulatedActiveMs, elapsedActiveMs)
        : active.accumulatedActiveMs,
    lastWallCheckpointAt: now,
    updatedAt: new Date(now).toISOString(),
  });
}

export async function updateOfflineLastQuestionIndex(
  uid: string,
  attemptId: string,
  questionIndex: number
): Promise<void> {
  const active = await getActiveOfflineAttemptById(uid, attemptId);
  if (!active) return;
  const now = Date.now();
  await saveActiveOfflineAttempt({
    ...active,
    lastQuestionIndex: questionIndex,
    lastWallCheckpointAt: now,
    updatedAt: new Date(now).toISOString(),
    attemptMeta: {
      ...active.attemptMeta,
      lastQuestionIndex: questionIndex,
    },
  });
}

export async function flushOfflineAttemptState(
  uid: string,
  attemptId: string,
  answers: Record<string, number | null>,
  lastQuestionIndex?: number,
  elapsedActiveMs?: number
): Promise<void> {
  const active = await getActiveOfflineAttemptById(uid, attemptId);
  if (!active) return;

  const mapped: Record<string, { optionIndex: number; optionId: string }> = {};
  for (const [qId, val] of Object.entries(answers)) {
    if (val !== null && val !== undefined) {
      mapped[qId] = { optionIndex: val, optionId: `opt_${val}` };
    }
  }

  const now = Date.now();
  await saveActiveOfflineAttempt({
    ...active,
    answers: mapped,
    lastQuestionIndex:
      typeof lastQuestionIndex === 'number' ? lastQuestionIndex : active.lastQuestionIndex,
    accumulatedActiveMs:
      typeof elapsedActiveMs === 'number'
        ? Math.max(active.accumulatedActiveMs, elapsedActiveMs)
        : active.accumulatedActiveMs,
    lastWallCheckpointAt: now,
    updatedAt: new Date(now).toISOString(),
  });
}

/**
 * Grade locally using the downloaded package keys ONLY as a provisional preview.
 * Official score, points, leaderboard, and stats are computed strictly on the server upon sync.
 */
export async function submitOfflineAttemptProvisional(
  attemptId: string,
  uid: string,
  answersOverride?: Record<string, number | null>,
  elapsedSecondsOverride?: number
): Promise<ExamAttempt & { reviews: QuestionReview[] }> {
  const active = await getActiveOfflineAttemptById(uid, attemptId);
  if (!active) {
    throw new Error('لم يتم العثور على المحاولة المحلية.');
  }

  const pkg = await getOfflinePackage(uid, active.examId);
  if (!pkg) {
    throw new Error('تعذر العثور على حزمة الامتحان المنزّلة.');
  }

  const finalNumAnswers = answersOverride ?? extractOfflineAnswersRecord(active);
  const answersMap: Record<string, string> = {};
  for (const [qId, optIdx] of Object.entries(finalNumAnswers)) {
    if (optIdx !== null && optIdx !== undefined) {
      answersMap[qId] = `opt_${optIdx}`;
    }
  }

  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;
  const reviews: QuestionReview[] = [];

  pkg.questions.forEach((q, idx) => {
    const keyEntry = pkg.answerKeys[q.id];
    const correctIdx = keyEntry ? keyEntry.correctAnswer : -1;
    const studentIdx =
      finalNumAnswers[q.id] !== undefined && finalNumAnswers[q.id] !== null
        ? Number(finalNumAnswers[q.id])
        : null;
    const isUnanswered = studentIdx === null || isNaN(studentIdx);
    const isCorrect = !isUnanswered && correctIdx >= 0 && studentIdx === correctIdx;

    if (isCorrect) correctCount++;
    else if (isUnanswered) unansweredCount++;
    else wrongCount++;

    reviews.push({
      questionId: q.id,
      questionNumber: q.order || idx + 1,
      questionText: q.questionText,
      options: q.options,
      studentAnswer: studentIdx,
      studentOptionId: studentIdx !== null ? `opt_${studentIdx}` : null,
      studentAnswerText: studentIdx !== null ? q.options[studentIdx] || null : null,
      correctAnswer: correctIdx,
      correctOptionId: correctIdx >= 0 ? `opt_${correctIdx}` : undefined,
      correctAnswerText: correctIdx >= 0 ? q.options[correctIdx] || '' : '',
      isCorrect,
      isUnanswered,
      explanation: keyEntry?.explanation || '',
      hint: keyEntry?.hint,
      solutionSteps: keyEntry?.solutionSteps || undefined,
      formulaUsed: keyEntry?.formulaUsed || undefined,
      distractorAnalysis: keyEntry?.distractorAnalysis || undefined,
      points: q.points || 10,
      pointsEarned: 0, // Provisional only — points are awarded strictly on server
      source: q.source || 'أريكسون',
    });
  });

  const totalQ = pkg.questions.length;
  const provisionalPercent = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0;
  const nowIso = new Date().toISOString();

  const measuredDuration =
    typeof elapsedSecondsOverride === 'number' && elapsedSecondsOverride > 0
      ? Math.round(elapsedSecondsOverride)
      : Math.max(
          1,
          Math.round(
            ((active.accumulatedActiveMs || 0) +
              Math.max(0, Date.now() - (active.lastWallCheckpointAt || Date.now()))) /
              1000
          )
        );

  const provisionalAttempt: ExamAttempt & { reviews: QuestionReview[] } = {
    ...active.attemptMeta,
    id: attemptId,
    userId: uid,
    examId: pkg.examId,
    examVersion: pkg.version,
    status: 'submitted_pending',
    submittedAt: nowIso,
    score: provisionalPercent,
    pointsEarned: 0, // Never award points offline
    correctAnswers: correctCount,
    correctCount,
    wrongAnswers: wrongCount,
    wrongCount,
    unanswered: unansweredCount,
    unansweredCount,
    answeredCount: totalQ - unansweredCount,
    durationSeconds: measuredDuration,
    durationUsed: measuredDuration,
    source: 'offline',
    isProvisional: true,
    pendingReason: 'بانتظار المزامنة مع الخادم لتثبيت النتيجة والنقاط',
    reviews,
  };

  const pendingRecord: PendingSubmissionRecord = {
    id: attemptId,
    uid,
    examId: pkg.examId,
    examTitle: pkg.exam.title,
    examVersion: pkg.version,
    startedAt: active.startedAt,
    endedAt: nowIso,
    durationSeconds: measuredDuration,
    answersMap,
    clientAttemptData: {
      id: attemptId,
      examId: pkg.examId,
      userId: uid,
      examTitle: pkg.exam.title,
      examSubject: pkg.exam.subjectNameAr || pkg.exam.subject,
      lesson: pkg.exam.lesson,
      totalPoints: pkg.exam.totalPoints,
      questionCount: pkg.questions.length,
      startedAt: active.startedAt,
      expectedEndAt: active.expectedEndAt,
      submittedAt: nowIso,
      examVersion: pkg.version,
      durationSeconds: measuredDuration,
      durationUsed: measuredDuration,
      source: 'offline',
    },
    provisionalAttempt,
    retryCount: 0,
    nextRetryAt: 0,
    createdAt: nowIso,
  };

  await upsertPendingSubmission(pendingRecord);
  await deleteActiveOfflineAttempt(attemptId);

  try {
    localStorage.setItem(`arixon_attempt_${attemptId}`, JSON.stringify(provisionalAttempt));
  } catch {}

  // Request Background Sync if browser supports it
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((reg: any) => {
        if (reg && 'sync' in reg) {
          return reg.sync.register('arixon-offline-sync');
        }
      })
      .catch(() => {});
  }

  return provisionalAttempt;
}
