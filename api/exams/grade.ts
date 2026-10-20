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
        return res.status(400).json({
          ok: false,
          code: 'VALIDATE_INPUT',
          message: 'Invalid JSON payload',
          step: 'JSON_PARSE',
        });
      }
    }

    const { attemptId, answers, clientAttemptData } = body || {};

    if (!attemptId) {
      return res.status(400).json({
        ok: false,
        code: 'VALIDATE_INPUT',
        message: 'معرف المحاولة مطلوب.',
        step: 'VALIDATE_INPUT',
      });
    }

    // Authenticate user via Firebase ID Token
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const authUser = await verifyToken(authHeader);

    // If ID token was provided and valid, use its verified UID
    // Otherwise fallback to clientAttemptData.userId if present
    const effectiveUserId = authUser?.uid || clientAttemptData?.userId;

    if (!effectiveUserId) {
      return res.status(401).json({
        ok: false,
        code: 'AUTH_FAILED',
        message: 'يرجى تسجيل الدخول لتسليم الامتحان.',
        step: 'TOKEN_VERIFICATION',
      });
    }

    console.log(`[API /api/exams/grade] Grading attempt: ${attemptId}, user: ${effectiveUserId}, answers count: ${Object.keys(answers || {}).length}`);

    const result = await gradeAndSubmitExam({
      attemptId,
      userId: effectiveUserId,
      answers: answers || {},
      clientAttemptData,
    });

    return res.status(result.ok ? 200 : 400).json({
      ...result,
      success: result.ok,
    });
  } catch (err: any) {
    console.error('[API /api/exams/grade] Unhandled error during exam grading:', err);
    return res.status(500).json({
      ok: false,
      code: 'WRITE_FAILED',
      message: err?.message || 'حدث خطأ غير متوقع أثناء تصحيح الامتحان.',
      step: 'SERVER_EXCEPTION',
    });
  }
}
