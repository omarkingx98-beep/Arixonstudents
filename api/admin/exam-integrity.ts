import { auditExamIntegrity } from '../_lib/adminIntegrity.js';

const PRIMARY_ADMIN_EMAILS = [
  'omar88x99@gmail.com',
  'omarkingx99@gmail.com',
  'omarkingx98@gmail.com',
];

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1]?.trim() : null;

    if (!token) {
      return res.status(401).json({ error: 'Missing authorization token' });
    }

    let callerEmail = '';
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      callerEmail = payload.email?.toLowerCase().trim() || '';
      const isAdmin = payload.admin || (callerEmail && PRIMARY_ADMIN_EMAILS.includes(callerEmail));

      if (!isAdmin) {
        return res.status(403).json({ error: 'Access restricted to authorized admins.' });
      }
    }

    const examId = (req.query?.examId as string) || 'exam_1792050086667_12ri';
    const report = await auditExamIntegrity(examId, token, callerEmail);
    return res.status(200).json(report);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed running exam integrity audit' });
  }
}
