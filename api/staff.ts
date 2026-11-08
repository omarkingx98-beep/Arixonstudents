import { handleStaffAction, getOwnerEmails } from './_lib/staffHandler.js';
import { firebaseAppConfig } from './_lib/config.js';

export const config = {
  maxDuration: 60,
};

async function verifyToken(authHeader?: string): Promise<{ uid: string; email?: string; role?: string; admin?: boolean } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) return null;

  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      const nowSec = Math.floor(Date.now() / 1000);
      if (payload.aud === firebaseAppConfig.projectId && payload.exp > nowSec) {
        const email = payload.email?.toLowerCase().trim();
        const ownerEmails = getOwnerEmails();
        const isOwner = email && ownerEmails.includes(email);
        return {
          uid: payload.user_id || payload.sub,
          email: payload.email,
          role: payload.role || (isOwner ? 'super_admin' : undefined),
          admin: !!payload.admin || isOwner,
        };
      }
    }
  } catch (err) {
    console.warn('[Staff API] Token parse error:', err);
  }
  return null;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const caller = await verifyToken(req.headers.authorization);
  if (!caller) {
    return res.status(401).json({ error: 'غير مصرح: يلزم تسجيل الدخول.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'بيانات غير صالحة.' });
    }
  }

  const action = (req.query?.action as string) || body?.action;
  if (!action) {
    return res.status(400).json({ error: 'الإجراء (action) مطلوب.' });
  }

  const result = await handleStaffAction(action, body, caller);
  return res.status(result.status).json(result.data);
}
