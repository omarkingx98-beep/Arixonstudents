import { syncExamKeysFromAdminReference } from '../_lib/adminIntegrity.js';
import { firebaseAppConfig } from '../_lib/config.js';

const PRIMARY_ADMIN_EMAILS = [
  'omar88x99@gmail.com',
  'omarkingx99@gmail.com',
  'omarkingx98@gmail.com',
];

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1]?.trim() : null;

    if (!token) {
      return res.status(401).json({ error: 'Missing authorization token' });
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      return res.status(401).json({ error: 'Invalid token format' });
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.aud !== firebaseAppConfig.projectId || !payload.exp || payload.exp <= nowSec) {
      return res.status(401).json({ error: 'Token expired or invalid audience' });
    }

    const callerEmail = payload.email?.toLowerCase().trim() || '';
    const role = typeof payload.role === 'string' ? payload.role : '';
    const isAdmin = Boolean(
      payload.admin ||
      role === 'super_admin' ||
      role === 'admin' ||
      role === 'content_editor' ||
      (callerEmail && PRIMARY_ADMIN_EMAILS.includes(callerEmail))
    );

    if (!isAdmin) {
      return res.status(403).json({ error: 'Access restricted to authorized admins.' });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) {}
    }

    const { examId, confirm = false, regradeAttempts = false, overrides = {} } = body || {};
    if (!examId) {
      return res.status(400).json({ error: 'examId is required' });
    }

    const result = await syncExamKeysFromAdminReference({
      examId,
      confirm: Boolean(confirm),
      regradeAttempts: Boolean(regradeAttempts),
      overrides,
      idToken: token,
      callerEmail,
    });

    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed syncing exam keys' });
  }
}
