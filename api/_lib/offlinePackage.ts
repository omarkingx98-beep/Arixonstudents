import { getAdminFirestore, parseCorrectAnswerIndex } from './examGrader.js';
import { getRestDoc, getRestCollection, patchRestDoc } from './firestoreRest.js';
import {
  CHEMISTRY_EXAM_ID,
  CHEMISTRY_EXAM,
  CHEMISTRY_EXAM_QUESTIONS,
  SURAH_YUSUF_EXAM_ID,
  SURAH_YUSUF_CORRECT_KEYS,
} from './examData.js';
import type { VerifiedAuthUser } from './authVerify.js';

const MAX_DAILY_OFFLINE_DOWNLOADS = 20;

// In-memory rate limit fallback when Firestore write/transaction is unavailable in dev/serverless without SA
const memoryDailyDownloadCounters = new Map<string, number>();

function getUtcDateKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

async function checkAndIncrementDailyLimit(uid: string, idToken?: string): Promise<{ allowed: boolean; count: number }> {
  const dateKey = getUtcDateKey();
  const memKey = `${uid}::${dateKey}`;
  const { db, hasServiceAccount } = getAdminFirestore();

  if (hasServiceAccount && db) {
    try {
      const limitRef = db.collection('users').doc(uid).collection('offlineDownloadLimits').doc(dateKey);
      const txRes = await db.runTransaction(async (tx) => {
        const snap = await tx.get(limitRef);
        const currentCount = snap.exists ? Number(snap.data()?.count || 0) : 0;
        if (currentCount >= MAX_DAILY_OFFLINE_DOWNLOADS) {
          return { allowed: false, count: currentCount };
        }
        const nextCount = currentCount + 1;
        tx.set(
          limitRef,
          {
            date: dateKey,
            count: nextCount,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
        return { allowed: true, count: nextCount };
      });
      memoryDailyDownloadCounters.set(memKey, txRes.count);
      return txRes;
    } catch (err: any) {
      console.warn('[OfflinePackage] SA transaction daily limit check failed, falling back:', err?.message);
    }
  }

  // REST fallback under users/{uid}/dailyGoals/_sys_offline_dl_{YYYY-MM-DD} (owner-writable per firestore.rules)
  if (idToken) {
    try {
      const docPath = `users/${uid}/dailyGoals/_sys_offline_dl_${dateKey}`;
      const existing = await getRestDoc(docPath, idToken);
      const currentCount = existing ? Number(existing.count || 0) : (memoryDailyDownloadCounters.get(memKey) || 0);
      if (currentCount >= MAX_DAILY_OFFLINE_DOWNLOADS) {
        return { allowed: false, count: currentCount };
      }
      const nextCount = currentCount + 1;
      await patchRestDoc(
        docPath,
        {
          id: `_sys_offline_dl_${dateKey}`,
          userId: uid,
          text: 'Offline download counter',
          completed: false,
          date: dateKey,
          count: nextCount,
          updatedAt: new Date().toISOString(),
        },
        idToken
      );
      memoryDailyDownloadCounters.set(memKey, nextCount);
      return { allowed: true, count: nextCount };
    } catch (err: any) {
      console.warn('[OfflinePackage] REST daily limit fallback error:', err?.message);
    }
  }

  const currentMem = memoryDailyDownloadCounters.get(memKey) || 0;
  if (currentMem >= MAX_DAILY_OFFLINE_DOWNLOADS) {
    return { allowed: false, count: currentMem };
  }
  const nextMem = currentMem + 1;
  memoryDailyDownloadCounters.set(memKey, nextMem);
  return { allowed: true, count: nextMem };
}

export interface OfflinePackageAnswerKeyEntry {
  correctAnswer: number;
  correctOptionId: string;
  explanation: string;
  hint?: string;
  solutionSteps?: string[] | null;
  formulaUsed?: string | null;
  distractorAnalysis?: Record<string, string> | null;
}

export interface OfflinePackageResponse {
  status: number;
  body: Record<string, any>;
}

export async function handleOfflinePackageRequest(params: {
  examId: string;
  authUser: VerifiedAuthUser | null;
  idToken?: string;
}): Promise<OfflinePackageResponse> {
  const { examId, authUser, idToken } = params;

  if (!authUser || !authUser.uid) {
    return {
      status: 401,
      body: {
        ok: false,
        code: 'AUTH_FAILED',
        message: 'يرجى تسجيل الدخول لتنزيل حزمة الامتحان.',
      },
    };
  }

  if (!examId || typeof examId !== 'string') {
    return {
      status: 400,
      body: {
        ok: false,
        code: 'VALIDATE_INPUT',
        message: 'معرّف الامتحان مطلوب.',
      },
    };
  }

  const { db, hasServiceAccount } = getAdminFirestore();
  let examDocData: Record<string, any> | null = null;

  // 1. Load Exam Metadata
  if (hasServiceAccount && db) {
    try {
      const snap = await db.collection('exams').doc(examId).get();
      if (snap.exists) {
        examDocData = { id: snap.id, ...snap.data() };
      }
    } catch (err: any) {
      console.warn('[OfflinePackage] Error reading exam from Admin SDK:', err?.message);
    }
  }

  if (!examDocData && idToken) {
    try {
      const restExam = await getRestDoc(`exams/${examId}`, idToken);
      if (restExam) {
        examDocData = { id: examId, ...restExam };
      }
    } catch (err: any) {
      console.warn('[OfflinePackage] Error reading exam from REST:', err?.message);
    }
  }

  if (!examDocData && examId === CHEMISTRY_EXAM_ID) {
    examDocData = { ...CHEMISTRY_EXAM };
  }

  if (!examDocData) {
    return {
      status: 404,
      body: {
        ok: false,
        code: 'EXAM_NOT_FOUND',
        message: 'الامتحان غير موجود.',
      },
    };
  }

  const isPublished =
    examDocData.published === true ||
    examDocData.status === 'published' ||
    examDocData.status === 'available';

  if (!isPublished || examDocData.isArchived === true) {
    return {
      status: 403,
      body: {
        ok: false,
        code: 'EXAM_NOT_PUBLISHED',
        message: 'هذا الامتحان غير منشور حالياً.',
      },
    };
  }

  if (examDocData.allowOffline !== true) {
    return {
      status: 403,
      body: {
        ok: false,
        code: 'OFFLINE_NOT_ALLOWED',
        message: 'هذا الامتحان غير متاح للتنزيل بدون إنترنت.',
      },
    };
  }

  // 2. Enforce 20 downloads/day rate limit per uid
  const limitCheck = await checkAndIncrementDailyLimit(authUser.uid, idToken);
  if (!limitCheck.allowed) {
    return {
      status: 429,
      body: {
        ok: false,
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'تجاوزت الحد اليومي المسموح به لتنزيل الامتحانات (20 تنزيلاً يومياً). حاول غداً.',
        dailyLimit: MAX_DAILY_OFFLINE_DOWNLOADS,
        count: limitCheck.count,
      },
    };
  }

  // 3. Load Questions & Answer Keys
  const questionsOut: Array<Record<string, any>> = [];
  const answerKeys: Record<string, OfflinePackageAnswerKeyEntry> = {};

  if (hasServiceAccount && db) {
    try {
      const [qSnap, kSnap] = await Promise.all([
        db.collection('exams').doc(examId).collection('questions').get(),
        db.collection('exams').doc(examId).collection('answerKeys').get().catch(() => null),
      ]);

      if (!qSnap.empty) {
        const keyMap = new Map<string, Record<string, any>>();
        if (kSnap) {
          kSnap.docs.forEach((kd) => keyMap.set(kd.id, kd.data()));
        }

        const sortedDocs = [...qSnap.docs].sort((a, b) => {
          const oa = typeof a.data().order === 'number' ? a.data().order : 999999;
          const ob = typeof b.data().order === 'number' ? b.data().order : 999999;
          return oa - ob;
        });

        for (let idx = 0; idx < sortedDocs.length; idx++) {
          const qDoc = sortedDocs[idx];
          const qData = qDoc.data();
          const keyData = keyMap.get(qDoc.id);
          const options: string[] = Array.isArray(qData.options) ? qData.options : [];
          const yusufOverride = examId === SURAH_YUSUF_EXAM_ID ? SURAH_YUSUF_CORRECT_KEYS[qDoc.id] : undefined;

          const parsedCorrect =
            parseCorrectAnswerIndex(keyData?.correctAnswer, options) ??
            parseCorrectAnswerIndex(qData.correctAnswer, options) ??
            (yusufOverride ? parseCorrectAnswerIndex(yusufOverride.correctAnswer, options) : null);

          if (parsedCorrect === null) continue;

          questionsOut.push({
            id: qDoc.id,
            examId,
            order: typeof qData.order === 'number' ? qData.order : idx + 1,
            questionText: qData.questionText || '',
            options,
            optionIds: options.map((_, oi) => `opt_${oi}`),
            difficulty: qData.difficulty || 'medium',
            source: qData.source || 'أريكسون',
            points: typeof qData.points === 'number' ? qData.points : 10,
            questionType: qData.questionType || 'multiple_choice',
            media: qData.media || undefined,
          });

          answerKeys[qDoc.id] = {
            correctAnswer: parsedCorrect,
            correctOptionId: `opt_${parsedCorrect}`,
            explanation: keyData?.explanation || qData.explanation || yusufOverride?.explanation || '',
            hint: keyData?.hint || qData.hint || undefined,
            solutionSteps: keyData?.solutionSteps || qData.solutionSteps || null,
            formulaUsed: keyData?.formulaUsed || qData.formulaUsed || null,
            distractorAnalysis: keyData?.distractorAnalysis || qData.distractorAnalysis || null,
          };
        }
      }
    } catch (err: any) {
      console.warn('[OfflinePackage] SA question fetch failed:', err?.message);
    }
  }

  // Fallback to REST or embedded Chemistry exam
  if (questionsOut.length === 0 && idToken) {
    try {
      const restQ = await getRestCollection(`exams/${examId}/questions`, idToken);
      if (restQ.length > 0) {
        let restKeyMap = new Map<string, Record<string, any>>();
        if (authUser.admin) {
          try {
            const kDocs = await getRestCollection(`exams/${examId}/answerKeys`, idToken);
            kDocs.forEach((d) => restKeyMap.set(d.id, d.data));
          } catch {}
        }

        restQ.sort((a, b) => {
          const oa = typeof a.data.order === 'number' ? a.data.order : 999999;
          const ob = typeof b.data.order === 'number' ? b.data.order : 999999;
          return oa - ob;
        });

        for (let idx = 0; idx < restQ.length; idx++) {
          const item = restQ[idx];
          const qData = item.data;
          const keyData = restKeyMap.get(item.id);
          const options: string[] = Array.isArray(qData.options) ? qData.options : [];
          const yusufOverride = examId === SURAH_YUSUF_EXAM_ID ? SURAH_YUSUF_CORRECT_KEYS[item.id] : undefined;
          const chemFallback =
            examId === CHEMISTRY_EXAM_ID ? CHEMISTRY_EXAM_QUESTIONS.find((cq) => cq.id === item.id) : undefined;

          const parsedCorrect =
            parseCorrectAnswerIndex(keyData?.correctAnswer, options) ??
            parseCorrectAnswerIndex(qData.correctAnswer, options) ??
            (yusufOverride ? parseCorrectAnswerIndex(yusufOverride.correctAnswer, options) : null) ??
            (chemFallback ? chemFallback.correctAnswer : null);

          if (parsedCorrect === null) continue;

          questionsOut.push({
            id: item.id,
            examId,
            order: typeof qData.order === 'number' ? qData.order : idx + 1,
            questionText: qData.questionText || '',
            options,
            optionIds: options.map((_, oi) => `opt_${oi}`),
            difficulty: qData.difficulty || 'medium',
            source: qData.source || 'أريكسون',
            points: typeof qData.points === 'number' ? qData.points : 10,
            questionType: qData.questionType || 'multiple_choice',
            media: qData.media || undefined,
          });

          answerKeys[item.id] = {
            correctAnswer: parsedCorrect,
            correctOptionId: `opt_${parsedCorrect}`,
            explanation: keyData?.explanation || qData.explanation || yusufOverride?.explanation || chemFallback?.explanation || '',
            hint: keyData?.hint || qData.hint || chemFallback?.hint || undefined,
            solutionSteps: keyData?.solutionSteps || qData.solutionSteps || null,
            formulaUsed: keyData?.formulaUsed || qData.formulaUsed || null,
            distractorAnalysis: keyData?.distractorAnalysis || qData.distractorAnalysis || null,
          };
        }
      }
    } catch (err: any) {
      console.warn('[OfflinePackage] REST question fetch failed:', err?.message);
    }
  }

  if (questionsOut.length === 0 && examId === CHEMISTRY_EXAM_ID) {
    for (const q of CHEMISTRY_EXAM_QUESTIONS) {
      questionsOut.push({
        id: q.id,
        examId: q.examId,
        order: q.order,
        questionText: q.questionText,
        options: q.options,
        optionIds: q.options.map((_, oi) => `opt_${oi}`),
        difficulty: q.difficulty,
        source: q.source,
        points: q.points,
        questionType: q.questionType,
      });
      answerKeys[q.id] = {
        correctAnswer: q.correctAnswer,
        correctOptionId: `opt_${q.correctAnswer}`,
        explanation: q.explanation,
        hint: q.hint,
        solutionSteps: q.solutionSteps || null,
        formulaUsed: q.formulaUsed || null,
        distractorAnalysis: q.distractorAnalysis || null,
      };
    }
  }

  if (questionsOut.length === 0 || Object.keys(answerKeys).length === 0) {
    return {
      status: 503,
      body: {
        ok: false,
        code: 'ANSWER_KEYS_UNAVAILABLE',
        message: 'تعذّر تجهيز مفاتيح الإجابة لهذا الامتحان حالياً.',
      },
    };
  }

  const version = Number(examDocData.version || 1);
  const downloadedAt = new Date().toISOString();

  return {
    status: 200,
    body: {
      ok: true,
      exam: {
        id: examId,
        title: examDocData.title || '',
        subject: examDocData.subject || 'other',
        subjectNameAr: examDocData.subjectNameAr || '',
        lesson: examDocData.lesson || '',
        description: examDocData.description || '',
        questionCount: questionsOut.length,
        durationMinutes: Number(examDocData.durationMinutes || 15),
        totalPoints: Number(examDocData.totalPoints || questionsOut.reduce((s, q) => s + Number(q.points || 0), 0)),
        difficulty: examDocData.difficulty || 'medium',
        status: examDocData.status || 'available',
        published: true,
        allowRetake: Boolean(examDocData.allowRetake),
        allowOffline: true,
        branch: examDocData.branch || 'مشترك',
        grade: examDocData.grade || 'الثاني عشر',
        version,
      },
      version,
      downloadedAt,
      questions: questionsOut,
      answerKeys,
      dailyDownloadsUsed: limitCheck.count,
      dailyDownloadsMax: MAX_DAILY_OFFLINE_DOWNLOADS,
    },
  };
}
