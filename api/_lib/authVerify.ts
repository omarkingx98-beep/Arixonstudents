import crypto from 'crypto';
import { getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { firebaseAppConfig } from './config.js';
import { getAdminFirestore } from './examGrader.js';

export interface VerifiedAuthUser {
  uid: string;
  email?: string;
  admin: boolean;
  role?: string;
}

const PRIMARY_ADMIN_EMAILS = new Set(
  [
    ...(process.env.OWNER_EMAILS ? process.env.OWNER_EMAILS.split(',').map((e) => e.trim().toLowerCase()) : []),
    (process.env.ADMIN_PRIMARY_EMAIL || '').toLowerCase().trim(),
    'omar88x99@gmail.com',
    'omarkingx99@gmail.com',
    'omarkingx98@gmail.com',
  ].filter(Boolean)
);

export function isPrimaryAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return PRIMARY_ADMIN_EMAILS.has(email.toLowerCase().trim());
}

let cachedGoogleCerts: Record<string, string> = {};
let certsCacheExpiry = 0;

async function getGooglePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (certsCacheExpiry > now && Object.keys(cachedGoogleCerts).length > 0) {
    return cachedGoogleCerts;
  }
  try {
    const res = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
    if (res.ok) {
      cachedGoogleCerts = (await res.json()) as Record<string, string>;
      certsCacheExpiry = now + 6 * 3600 * 1000;
    }
  } catch (err) {
    console.warn('[AuthVerify] Failed to fetch Google public certs:', err);
  }
  return cachedGoogleCerts;
}

/**
 * Cryptographically verifies Firebase ID token via Admin SDK (if initialized with credentials)
 * or via Google X.509 RSA-SHA256 public certificate verification.
 */
export async function verifyFirebaseBearerToken(authHeaderOrToken?: string | null): Promise<VerifiedAuthUser | null> {
  if (!authHeaderOrToken) return null;
  const rawToken = authHeaderOrToken.startsWith('Bearer ')
    ? authHeaderOrToken.slice(7).trim()
    : authHeaderOrToken.trim();
  if (!rawToken) return null;

  // Ensure Admin SDK init attempted
  const { hasServiceAccount } = getAdminFirestore();

  // 1. Try Firebase Admin SDK verification when apps exist & service account is configured
  if (hasServiceAccount && getApps().length > 0) {
    try {
      const decoded = await getAuth().verifyIdToken(rawToken, false);
      const email = decoded.email?.toLowerCase().trim();
      const isPrimary = isPrimaryAdminEmail(email);
      const role = typeof decoded.role === 'string' ? decoded.role : isPrimary ? 'super_admin' : undefined;
      return {
        uid: decoded.uid,
        email: decoded.email,
        admin: Boolean(decoded.admin) || isPrimary || role === 'super_admin' || role === 'admin',
        role,
      };
    } catch (err: any) {
      console.warn('[AuthVerify] Admin verifyIdToken fallback check:', err?.message);
    }
  }

  // 2. Cryptographic RS256 verification against Google securetoken public certs
  try {
    const parts = rawToken.split('.');
    if (parts.length === 3) {
      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));

      const projectId = process.env.FIREBASE_PROJECT_ID || firebaseAppConfig.projectId;
      const nowSec = Math.floor(Date.now() / 1000);
      const validAudience = payload.aud === projectId;
      const validIssuer = payload.iss === `https://securetoken.google.com/${projectId}`;
      const notExpired = typeof payload.exp === 'number' && payload.exp > nowSec;
      const uid = payload.user_id || payload.sub;

      if (validAudience && validIssuer && notExpired && typeof uid === 'string' && uid.length > 0) {
        const certs = await getGooglePublicCerts();
        const cert = header.kid ? certs[header.kid] : null;
        if (cert) {
          const verifier = crypto.createVerify('RSA-SHA256');
          verifier.update(`${parts[0]}.${parts[1]}`);
          const sigOk = verifier.verify(cert, parts[2], 'base64url');
          if (sigOk) {
            const email = payload.email?.toLowerCase().trim();
            const isPrimary = isPrimaryAdminEmail(email);
            const role = typeof payload.role === 'string' ? payload.role : isPrimary ? 'super_admin' : undefined;
            return {
              uid,
              email: payload.email,
              admin: Boolean(payload.admin) || isPrimary || role === 'super_admin' || role === 'admin',
              role,
            };
          }
          return null;
        }
      }
    }
  } catch (err) {
    console.warn('[AuthVerify] JWT RS256 verification error:', err);
  }

  // 3. Last-resort Google tokeninfo validation
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(rawToken)}`);
    if (res.ok) {
      const info = (await res.json()) as { sub?: string; user_id?: string; email?: string; aud?: string };
      const uid = info.user_id || info.sub;
      if (uid) {
        const email = info.email?.toLowerCase().trim();
        const isPrimary = isPrimaryAdminEmail(email);
        return {
          uid,
          email: info.email,
          admin: isPrimary,
          role: isPrimary ? 'super_admin' : undefined,
        };
      }
    }
  } catch {
    // ignore
  }

  return null;
}
