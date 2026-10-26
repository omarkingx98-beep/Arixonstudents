import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, auth, sanitizeFirestoreData } from './firebase';
import { recordAdminAuditLog } from './adminService';
import type { CommunitySettings } from '../types';

export const COMMUNITY_SETTINGS_DOC = 'settings/community';
export const COMMUNITY_CACHE_KEY = 'arixon_community_settings_cache_v2';

export const REAL_WHATSAPP_COMMUNITY_URL = 'https://chat.whatsapp.com/FQ39q5zXeZq8DJeeuPJNpu';

export const DEFAULT_COMMUNITY_SETTINGS: CommunitySettings = {
  whatsappUrl: REAL_WHATSAPP_COMMUNITY_URL,
  enabled: true,
  label: 'Arixon | مجتمع توجيهي 2009',
};

/**
 * Validate that WhatsApp link starts with https://chat.whatsapp.com/
 */
export function validateWhatsAppCommunityUrl(url: string): { isValid: boolean; error?: string } {
  const trimmed = (url || '').trim();
  if (!trimmed) {
    return { isValid: false, error: 'يرجى إدخال رابط مجموعة الواتساب.' };
  }
  if (!trimmed.startsWith('https://chat.whatsapp.com/')) {
    return {
      isValid: false,
      error: 'يجب أن يبدأ رابط مجموعة الواتساب بـ https://chat.whatsapp.com/',
    };
  }
  return { isValid: true };
}

/**
 * Fetch Community Settings from Firestore `settings/community`
 */
export async function fetchCommunitySettings(): Promise<CommunitySettings> {
  // Check local storage cache for instant UI rendering
  try {
    const cached = localStorage.getItem(COMMUNITY_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed === 'object') {
        if (!parsed.whatsappUrl || parsed.whatsappUrl.includes('arixon-tawjihi-2009')) {
          parsed.whatsappUrl = REAL_WHATSAPP_COMMUNITY_URL;
        }
        return parsed;
      }
    }
  } catch {}

  try {
    const snap = await getDoc(doc(db, 'settings', 'community'));
    if (snap.exists()) {
      const data = snap.data() as Partial<CommunitySettings>;
      let finalUrl = data.whatsappUrl || REAL_WHATSAPP_COMMUNITY_URL;
      if (finalUrl.includes('arixon-tawjihi-2009')) {
        finalUrl = REAL_WHATSAPP_COMMUNITY_URL;
      }
      const settings: CommunitySettings = {
        whatsappUrl: finalUrl,
        enabled: data.enabled !== undefined ? Boolean(data.enabled) : true,
        label: data.label || DEFAULT_COMMUNITY_SETTINGS.label,
        updatedAt: data.updatedAt,
        updatedBy: data.updatedBy,
      };
      try {
        localStorage.setItem(COMMUNITY_CACHE_KEY, JSON.stringify(settings));
      } catch {}
      return settings;
    }
  } catch (err) {
    console.warn('[CommunityService] Notice fetching community settings from Firestore:', err);
  }

  // Fallback to cache or defaults
  try {
    const cached = localStorage.getItem(COMMUNITY_CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch {}

  return DEFAULT_COMMUNITY_SETTINGS;
}

/**
 * Save Community Settings into Firestore `settings/community` (Admin only)
 */
export async function saveCommunitySettings(settings: Partial<CommunitySettings>): Promise<CommunitySettings> {
  const current = await fetchCommunitySettings();
  const nextSettings: CommunitySettings = {
    whatsappUrl: settings.whatsappUrl !== undefined ? settings.whatsappUrl.trim() : current.whatsappUrl,
    enabled: settings.enabled !== undefined ? Boolean(settings.enabled) : current.enabled,
    label: settings.label !== undefined ? settings.label.trim() : current.label,
    updatedAt: new Date().toISOString(),
    updatedBy: auth.currentUser?.email || 'admin',
  };

  // Validate URL if enabled or non-empty
  if (nextSettings.whatsappUrl) {
    const validation = validateWhatsAppCommunityUrl(nextSettings.whatsappUrl);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }
  } else if (nextSettings.enabled) {
    throw new Error('يرجى تحديد رابط مجموعة الواتساب عند تفعيل الميزة للطلاب.');
  }

  const clean = sanitizeFirestoreData(nextSettings);
  const docRef = doc(db, 'settings', 'community');
  await setDoc(docRef, clean, { merge: true });

  try {
    localStorage.setItem(COMMUNITY_CACHE_KEY, JSON.stringify(nextSettings));
  } catch {}

  // Record Admin Audit Log
  const adminEmail = auth.currentUser?.email || 'admin';
  await recordAdminAuditLog({
    action: 'settings_change',
    targetType: 'settings',
    targetId: 'community',
    details: `تحديث إعدادات مجتمع الواتساب (${nextSettings.label}): ${nextSettings.enabled ? 'مفعّل' : 'معطّل'} - الرابط: ${nextSettings.whatsappUrl || 'غير محدد'} بواسطة ${adminEmail}`,
    metadata: {
      enabled: nextSettings.enabled,
      whatsappUrl: nextSettings.whatsappUrl,
      label: nextSettings.label,
    },
  });

  return nextSettings;
}

/**
 * Realtime listener for community settings
 */
export function subscribeToCommunitySettings(
  callback: (settings: CommunitySettings) => void
): () => void {
  try {
    return onSnapshot(
      doc(db, 'settings', 'community'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<CommunitySettings>;
          const settings: CommunitySettings = {
            whatsappUrl: data.whatsappUrl || DEFAULT_COMMUNITY_SETTINGS.whatsappUrl,
            enabled: data.enabled !== undefined ? Boolean(data.enabled) : true,
            label: data.label || DEFAULT_COMMUNITY_SETTINGS.label,
            updatedAt: data.updatedAt,
            updatedBy: data.updatedBy,
          };
          try {
            localStorage.setItem(COMMUNITY_CACHE_KEY, JSON.stringify(settings));
          } catch {}
          callback(settings);
        } else {
          callback(DEFAULT_COMMUNITY_SETTINGS);
        }
      },
      (err) => {
        console.warn('[CommunityService] Subscription notice:', err?.message);
        callback(DEFAULT_COMMUNITY_SETTINGS);
      }
    );
  } catch {
    return () => {};
  }
}
