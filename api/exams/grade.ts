import { gradeAndSubmitExam } from '../_lib/examGrader.js';
import { verifyFirebaseBearerToken } from '../_lib/authVerify.js';
import { handleOfflinePackageRequest } from '../_lib/offlinePackage.js';

export const config = {
  maxDuration: 60,
};

/**
 * Vercel Serverless Function: /api/exams/grade
 * Also serves /api/exams/offline-package via rewrite (?action=offline-package)
 * to keep Vercel Hobby deployment within the 12-function limit.
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let body = req.body;
  if (typeof body === 'string' && body.trim()) {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({
        ok: false,
        code: 'VALIDATE_INPUT',
        message: 'Invalid JSON payload',
        step: 'JSON_PARSE',
      });
    }
  } else if (!body || typeof body !== 'object') {
    body = {};
  }

  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  const rawToken =
    typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : (typeof body?.idToken === 'string' ? body.idToken.trim() : undefined);

  const authUser = await verifyFirebaseBearerToken(rawToken ? `Bearer ${rawToken}` : undefined);

  // Route offline package downloads when rewritten from /api/exams/offline-package
  const action = (req.query?.action as string) || body?.action;
  if (action === 'offline-package') {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
    }
    const examId = String(body?.examId || req.query?.examId || '');
    const pkgRes = await handleOfflinePackageRequest({
      examId,
      authUser,
      idToken: rawToken,
    });
    return res.status(pkgRes.status).json(pkgRes.body);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      code: 'AUTH_FAILED',
      message: 'Method not allowed',
      step: 'REQUEST_METHOD',
    });
  }

  try {
    const {
      attemptId,
      answers,
      clientAttemptData,
      forceRegrade,
      source,
      examVersion,
      startedAt,
      endedAt,
      durationSeconds,
    } = body || {};

    const rawExamId =
      clientAttemptData?.examId ||
      (attemptId ? (String(attemptId).split('_').slice(2, -1).join('_') || 'unknown') : 'unknown');

    if (!attemptId) {
      return res.status(400).json({
        ok: false,
        code: 'VALIDATE_INPUT',
        message: 'معرف المحاولة مطلوب.',
        step: 'VALIDATE_INPUT',
      });
    }

    if (!authUser || !authUser.uid) {
      return res.status(401).json({
        ok: false,
        code: 'AUTH_FAILED',
        message: 'يرجى تسجيل الدخول لتسليم الامتحان.',
        step: 'TOKEN_VERIFICATION',
      });
    }

    const isCallerAdmin = Boolean(authUser.admin || authUser.role === 'super_admin' || authUser.role === 'admin');
    if (
      clientAttemptData?.userId &&
      clientAttemptData.userId !== authUser.uid &&
      !(isCallerAdmin && forceRegrade)
    ) {
      return res.status(403).json({
        ok: false,
        code: 'AUTH_FAILED',
        message: 'غير مصرح لك بتسليم محاولة تعود لمستخدم آخر.',
        step: 'OWNERSHIP_CHECK',
      });
    }

    const effectiveUserId =
      isCallerAdmin && forceRegrade && clientAttemptData?.userId ? clientAttemptData.userId : authUser.uid;

    const result = await gradeAndSubmitExam({
      attemptId,
      userId: effectiveUserId,
      userEmail: authUser.email,
      answers: answers || {},
      clientAttemptData,
      durationSeconds: typeof durationSeconds === 'number' ? durationSeconds : undefined,
      idToken: rawToken,
      forceRegrade: Boolean(forceRegrade),
      source: source === 'offline' ? 'offline' : 'online',
      examVersion: examVersion !== undefined ? Number(examVersion) : undefined,
      startedAt: typeof startedAt === 'string' ? startedAt : undefined,
      endedAt: typeof endedAt === 'string' ? endedAt : undefined,
    });

    if (!result.ok) {
      const finalExamId = result.attempt?.examId || rawExamId;
      const status =
        result.code === 'AUTH_FAILED'
          ? 401
          : result.code === 'ATTEMPT_NOT_FOUND'
          ? 404
          : result.code === 'ANSWER_KEYS_MISSING'
          ? 404
          : result.code === 'ANSWER_KEYS_UNAVAILABLE'
          ? 503
          : result.code === 'NO_ADMIN_CREDENTIALS' || result.code === 'FIRESTORE_ERROR' || result.code === 'WRITE_FAILED'
          ? 500
          : result.code === 'TIMEOUT'
          ? 504
          : 400;

      console.error(
        `[API /api/exams/grade ${status}] code=${result.code}, message="${result.message}", step="${result.step}", examId="${finalExamId}", attemptId="${attemptId}", uid="${effectiveUserId}"`
      );
      return res.status(status).json({
        ok: false,
        code: result.code,
        message: result.message,
        step: result.step,
        line: result.line || 'api/_lib/examGrader.ts',
      });
    }

    return res.status(200).json({
      ...result,
      success: true,
    });
  } catch (err: any) {
    console.error('[API /api/exams/grade 500]', err?.stack || err);
    return res.status(500).json({
      ok: false,
      code: 'FIRESTORE_ERROR',
      message: err?.message || 'حدث خطأ غير متوقع أثناء تصحيح الامتحان.',
      step: 'SERVER_EXCEPTION',
      line: 'api/exams/grade.ts',
      stack: process.env.NODE_ENV !== 'production' ? err?.stack : undefined,
    });
  }
}
