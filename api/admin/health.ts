import { performServiceHealthCheck } from '../_lib/adminIntegrity.js';
import { firebaseAppConfig } from '../_lib/config.js';

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

    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      const email = payload.email?.toLowerCase().trim();
      const isAdmin = payload.admin || (email && PRIMARY_ADMIN_EMAILS.includes(email));

      if (!isAdmin) {
        return res.status(403).json({ error: 'Access restricted to authorized admins.' });
      }
    }

    const report = await performServiceHealthCheck();
    return res.status(200).json(report);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed running health check' });
  }
}
