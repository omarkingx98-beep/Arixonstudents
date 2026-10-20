import { gradeAndSubmitExam } from '../../server/examGrader';
import configJson from '../../firebase-applet-config.json' with { type: 'json' };

export const config = {
  maxDuration: 60,
};

// Cache for Google public certs
let cachedGoogleCerts: { [kid: string]: string } = {};
let certsCacheExpiry = 0;

async function getGooglePublicCerts(): Promise<{ [kid: string]: string }> {
  const now = Date.now();
  if (certsCacheExpiry > now && Object.keys(cachedGoogleCerts).length > 0) {
    return cachedGoogleCerts;
  }
  try {
    const res = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
    if (res.ok) {
      cachedGoogleCerts = await res.json() as { [kid: string]: string };
      certsCacheExpiry = now + 6 * 3600 * 1000;
    }
  } catch (err) {
    console.warn('[Vercel Auth] Failed to fetch Google public certificates:', err);
  }
  return cachedGoogleCerts;
}

async function verifyToken(authHeader?: string): Promise<{ uid: string; email?: string } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) return null;

  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      const nowSec = Math.floor(Date.now() / 1000);
      if (payload.aud === configJson.projectId && payload.exp > nowSec) {
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
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {}
    }

    const { attemptId, answers, durationSeconds, examId } = body || {};
    if (!attemptId) {
      return res.status(400).json({ success: false, error: 'معرّف المحاولة (attemptId) مطلوب.' });
    }

    const authHeader = req.headers.authorization;
    const authUser = await verifyToken(authHeader);
    if (!authUser || !authUser.uid) {
      return res.status(401).json({ success: false, error: 'غير مصرح بالوصول: يلزم تسجيل الدخول.' });
    }

    const gradingResult = await gradeAndSubmitExam({
      attemptId,
      userId: authUser.uid,
      answers: answers || {},
      durationSeconds: durationSeconds ? Number(durationSeconds) : undefined,
      userEmail: authUser.email,
      idToken: authHeader?.split('Bearer ')[1]?.trim(),
    });

    return res.status(200).json(gradingResult);
  } catch (err: any) {
    console.error('[Vercel Grade API] Error:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'تعذر تصحيح الامتحان على الخادم.',
    });
  }
}
