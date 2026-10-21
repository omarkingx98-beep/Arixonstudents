import { gradeAndSubmitExam, type ExamErrorCode } from '../_lib/examGrader.js';
import { firebaseAppConfig } from '../_lib/config.js';

export const config = {
  maxDuration: 60,
};

async function verifyToken(authHeader?: string): Promise<{ uid: string; email?: string } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) return null;

  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      const nowSec = Math.floor(Date.now() / 1000);
      if (payload.aud === firebaseAppConfig.projectId && payload.exp > nowSec) {
        return {
          uid: payload.user_id || payload.sub,
          email: payload.email,
        };
      }
    }
  } catch (err) {
    console.warn('[Vercel Auth] Token parse error:', err);
  }
  return null;
}

/**
 * Vercel Serverless Function: /api/exams/grade
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (pErr) {
        console.error(`[API /api/exams/grade 400] code=VALIDATE_INPUT, message="Invalid JSON payload", examId="unknown", attemptId="unknown", uid="unknown", step="JSON_PARSE"`);
        return res.status(400).json({
          ok: false,
          code: 'VALIDATE_INPUT',
          message: 'Invalid JSON payload',
          step: 'JSON_PARSE',
        });
      }
    }

    const { attemptId, answers, clientAttemptData } = body || {};
    const rawExamId = clientAttemptData?.examId || (attemptId ? (attemptId.split('_').slice(2, -1).join('_') || 'unknown') : 'unknown');

    if (!attemptId) {
      console.error(`[API /api/exams/grade 400] code=VALIDATE_INPUT, message="معرف المحاولة مطلوب", step="VALIDATE_INPUT", examId="${rawExamId}", attemptId="missing", uid="unknown", line="api/exams/grade.ts:74"`);
      return res.status(400).json({
        ok: false,
        code: 'VALIDATE_INPUT',
        message: 'معرف المحاولة مطلوب.',
        step: 'VALIDATE_INPUT',
        line: 'api/exams/grade.ts:74',
      });
    }

    // Authenticate user via Firebase ID Token
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const rawToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1]?.trim() : (body?.idToken || undefined);
    const authUser = await verifyToken(authHeader);

    // If ID token was provided and valid, use its verified UID
    // Otherwise fallback to clientAttemptData.userId if present
    const effectiveUserId = authUser?.uid || clientAttemptData?.userId;

    if (!effectiveUserId) {
      console.error(`[API /api/exams/grade 401] code=AUTH_FAILED, message="يرجى تسجيل الدخول لتسليم الامتحان", step="TOKEN_VERIFICATION", examId="${rawExamId}", attemptId="${attemptId}", uid="unauthenticated", line="api/exams/grade.ts:93"`);
      return res.status(401).json({
        ok: false,
        code: 'AUTH_FAILED',
        message: 'يرجى تسجيل الدخول لتسليم الامتحان.',
        step: 'TOKEN_VERIFICATION',
        line: 'api/exams/grade.ts:93',
      });
    }

    console.log(`[API /api/exams/grade] Grading attempt: ${attemptId}, user: ${effectiveUserId}, examId: ${rawExamId}, answers count: ${Object.keys(answers || {}).length}`);

    const result = await gradeAndSubmitExam({
      attemptId,
      userId: effectiveUserId,
      answers: answers || {},
      clientAttemptData,
      idToken: rawToken,
    });

    if (!result.ok) {
      const finalExamId = result.attempt?.examId || rawExamId;
      const status = result.code === 'AUTH_FAILED' ? 401 
        : result.code === 'ATTEMPT_NOT_FOUND' ? 404 
        : result.code === 'ANSWER_KEYS_MISSING' ? 404
        : (result.code === 'NO_ADMIN_CREDENTIALS' || result.code === 'FIRESTORE_ERROR' || result.code === 'WRITE_FAILED') ? 500
        : result.code === 'TIMEOUT' ? 504
        : 400;

      console.error(`[API /api/exams/grade ${status}] code=${result.code}, message="${result.message}", step="${result.step}", examId="${finalExamId}", attemptId="${attemptId}", uid="${effectiveUserId}", line="${result.line || 'api/_lib/examGrader.ts'}"`);
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
    console.error(`[API /api/exams/grade 500] code=FIRESTORE_ERROR, message="${err?.message || 'Server Exception'}", step="SERVER_EXCEPTION", examId="unknown", attemptId="unknown", uid="unknown", line="api/exams/grade.ts"`, err?.stack || err);
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
