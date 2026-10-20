import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
} from 'firebase/firestore';
import { db, auth, storage, sanitizeFirestoreData } from './firebase';
import { recordAdminAuditLog } from './adminService';
import type { PromoBanner, PromoSettings } from '../types';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export const PROMO_SETTINGS_DOC = 'settings/promo';
export const PROMO_CACHE_KEY = 'arixon_promo_banners_cache_v1';
export const PROMO_SETTINGS_CACHE_KEY = 'arixon_promo_settings_cache_v1';

// Initial default banners from the user's provided images in public/banners/
export const INITIAL_PROMO_BANNERS: PromoBanner[] = [
  {
    id: 'initial_banner_1',
    imageUrl: '/banners/banner_1.jpg',
    alt: 'امتحان الفيزياء متاح الآن — الزخم الخطي والدفع لجيل 2009',
    linkType: 'internal',
    linkTarget: 'exams',
    order: 1,
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'initial_banner_2',
    imageUrl: '/banners/banner_2.jpg',
    alt: 'امتحان اللغة العربية التوجيهي — أسئلة وزارية وتصحيح ذكي',
    linkType: 'internal',
    linkTarget: 'exams',
    order: 2,
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'initial_banner_3',
    imageUrl: '/banners/banner_3.jpg',
    alt: 'لوحة الشرف التنافسية — نافس أصدقاءك واجمع النقاط',
    linkType: 'internal',
    linkTarget: 'leaderboard',
    order: 3,
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'initial_banner_4',
    imageUrl: '/banners/banner_4.jpg',
    alt: 'منظومة أريكسون Arixon — دليلك الأقوى لجيل 2009',
    linkType: 'none',
    linkTarget: '',
    order: 4,
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'initial_banner_5',
    imageUrl: '/banners/banner_5.jpg',
    alt: 'شروحات وحلول نموذجية ومراجعات دقيقة بعد كل امتحان',
    linkType: 'internal',
    linkTarget: 'exams',
    order: 5,
    active: true,
    createdAt: new Date().toISOString(),
  },
];

export const DEFAULT_PROMO_SETTINGS: PromoSettings = {
  enabled: true,
  intervalSeconds: 5,
};

/**
 * Fetch Promo Settings from Firestore doc `settings/promo`
 */
export async function getPromoSettings(): Promise<PromoSettings> {
  // Check session cache first
  try {
    const cached = sessionStorage.getItem(PROMO_SETTINGS_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {}

  try {
    const snap = await getDoc(doc(db, 'settings', 'promo'));
    if (snap.exists()) {
      const data = snap.data() as Partial<PromoSettings>;
      const settings: PromoSettings = {
        enabled: data.enabled !== undefined ? data.enabled : true,
        intervalSeconds: data.intervalSeconds && data.intervalSeconds >= 2 ? data.intervalSeconds : 5,
      };
      try {
        sessionStorage.setItem(PROMO_SETTINGS_CACHE_KEY, JSON.stringify(settings));
      } catch {}
      return settings;
    }
  } catch (err) {
    console.warn('[PromoService] Could not fetch settings from Firestore, using default:', err);
  }

  return DEFAULT_PROMO_SETTINGS;
}

/**
 * Fetch Active Promo Banners for Student Carousel
 * Uses getDocs once (no onSnapshot) and caches in sessionStorage to minimize Firestore reads.
 */
export async function getActivePromoBanners(): Promise<PromoBanner[]> {
  // 1. Check session storage cache
  try {
    const cached = sessionStorage.getItem(PROMO_CACHE_KEY);
    if (cached) {
      const parsed: PromoBanner[] = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return filterActiveByDate(parsed);
      }
    }
  } catch {}

  // 2. Fetch once from Firestore
  try {
    const colRef = collection(db, 'promoBanners');
    const q = query(colRef, where('active', '==', true), orderBy('order', 'asc'));
    const snap = await getDocs(q);

    if (!snap.empty) {
      const banners: PromoBanner[] = [];
      snap.forEach((d) => {
        banners.push({ ...(d.data() as PromoBanner), id: d.id });
      });

      const validBanners = filterActiveByDate(banners);
      try {
        sessionStorage.setItem(PROMO_CACHE_KEY, JSON.stringify(validBanners));
      } catch {}
      return validBanners;
    }
  } catch (err) {
    console.warn('[PromoService] Could not fetch promo banners from Firestore, falling back to initial banners:', err);
  }

  // 3. Fallback to initial local banners if Firestore has no banners yet
  return filterActiveByDate(INITIAL_PROMO_BANNERS);
}

/**
 * Filter banners that meet startAt and endAt constraints
 */
function filterActiveByDate(banners: PromoBanner[]): PromoBanner[] {
  const now = new Date().getTime();
  return banners.filter((b) => {
    if (!b.active) return false;
    if (b.startAt) {
      const start = new Date(b.startAt).getTime();
      if (!isNaN(start) && now < start) return false;
    }
    if (b.endAt) {
      const end = new Date(b.endAt).getTime();
      if (!isNaN(end) && now > end) return false;
    }
    return true;
  });
}

/**
 * Invalidate session cache (called after admin edits)
 */
export function clearPromoCache(): void {
  try {
    sessionStorage.removeItem(PROMO_CACHE_KEY);
    sessionStorage.removeItem(PROMO_SETTINGS_CACHE_KEY);
  } catch {}
}

/**
 * Admin: Fetch all banners (active and inactive) ordered by order
 */
export async function fetchAllPromoBanners(): Promise<PromoBanner[]> {
  try {
    const colRef = collection(db, 'promoBanners');
    const q = query(colRef, orderBy('order', 'asc'));
    const snap = await getDocs(q);

    if (!snap.empty) {
      const banners: PromoBanner[] = [];
      snap.forEach((d) => {
        banners.push({ ...(d.data() as PromoBanner), id: d.id });
      });
      return banners;
    }
  } catch (err) {
    console.warn('[PromoService] Could not fetch all promo banners from Firestore:', err);
  }

  // Fallback to initial
  return INITIAL_PROMO_BANNERS;
}

/**
 * Admin: Save (Create or Update) Banner
 */
export async function savePromoBanner(
  banner: Omit<PromoBanner, 'id' | 'createdAt'> & { id?: string; createdAt?: string }
): Promise<string> {
  const isNew = !banner.id || banner.id.startsWith('initial_');
  const bannerId = isNew
    ? `banner_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    : banner.id!;

  const now = new Date().toISOString();
  const user = auth.currentUser;

  const data: PromoBanner = {
    ...banner,
    id: bannerId,
    order: banner.order || 1,
    active: banner.active ?? true,
    createdAt: banner.createdAt || now,
    createdBy: banner.createdBy || user?.displayName || user?.email || 'admin',
    updatedAt: now,
  };

  const clean = sanitizeFirestoreData(data);
  const docRef = doc(db, 'promoBanners', bannerId);
  await setDoc(docRef, clean, { merge: true });

  clearPromoCache();

  // Audit log
  await recordAdminAuditLog({
    action: isNew ? 'create_banner' : 'edit_banner',
    targetType: 'banner',
    targetId: bannerId,
    details: `${isNew ? 'إضافة' : 'تعديل'} بنر إعلاني: "${banner.alt || 'بدون نص بديل'}" (الترتيب: ${banner.order})`,
    metadata: { bannerId, active: banner.active, order: banner.order },
  });

  return bannerId;
}

/**
 * Admin: Delete Banner
 */
export async function deletePromoBanner(bannerId: string, bannerAlt?: string): Promise<void> {
  const docRef = doc(db, 'promoBanners', bannerId);
  await deleteDoc(docRef);

  clearPromoCache();

  // Audit log
  await recordAdminAuditLog({
    action: 'delete_banner',
    targetType: 'banner',
    targetId: bannerId,
    details: `حذف البنر الإعلاني "${bannerAlt || bannerId}"`,
    metadata: { bannerId },
  });
}

/**
 * Admin: Toggle Active/Inactive
 */
export async function togglePromoBanner(bannerId: string, active: boolean, bannerAlt?: string): Promise<void> {
  const docRef = doc(db, 'promoBanners', bannerId);
  await updateDoc(docRef, {
    active,
    updatedAt: new Date().toISOString(),
  });

  clearPromoCache();

  // Audit log
  await recordAdminAuditLog({
    action: 'toggle_banner',
    targetType: 'banner',
    targetId: bannerId,
    details: `${active ? 'تفعيل' : 'إيقاف'} البنر الإعلاني "${bannerAlt || bannerId}"`,
    metadata: { bannerId, active },
  });
}

/**
 * Admin: Reorder Banners (Move up/down)
 */
export async function reorderPromoBanners(banners: PromoBanner[]): Promise<void> {
  for (let i = 0; i < banners.length; i++) {
    const b = banners[i];
    const newOrder = i + 1;
    if (b.order !== newOrder) {
      const docRef = doc(db, 'promoBanners', b.id);
      await updateDoc(docRef, {
        order: newOrder,
        updatedAt: new Date().toISOString(),
      }).catch(async () => {
        // In case it was an initial banner not yet saved as doc
        await setDoc(docRef, sanitizeFirestoreData({ ...b, order: newOrder }), { merge: true });
      });
    }
  }

  clearPromoCache();

  // Audit log
  await recordAdminAuditLog({
    action: 'reorder_banners',
    targetType: 'banner',
    targetId: 'all',
    details: `إعادة ترتيب ${banners.length} بنرات إعلانية`,
    metadata: { total: banners.length },
  });
}

/**
 * Admin: Update Promo Carousel Settings
 */
export async function updatePromoSettings(settings: PromoSettings): Promise<void> {
  const docRef = doc(db, 'settings', 'promo');
  const clean = sanitizeFirestoreData(settings);
  await setDoc(docRef, clean, { merge: true });

  try {
    sessionStorage.setItem(PROMO_SETTINGS_CACHE_KEY, JSON.stringify(settings));
    sessionStorage.removeItem(PROMO_CACHE_KEY);
  } catch {}

  // Audit log
  await recordAdminAuditLog({
    action: 'update_promo_settings',
    targetType: 'settings',
    targetId: 'promo',
    details: `تحديث إعدادات السلايدر: ${settings.enabled ? 'مفعّل' : 'معطّل'}، مدة التبديل ${settings.intervalSeconds} ثوانٍ`,
    metadata: settings,
  });
}

/**
 * Client-Side Image Compression:
 * Resizes image to max width 1600px and compresses to WebP under 200KB.
 */
export async function compressImageToWebp(file: File, maxWidth = 1600, targetMaxBytes = 200 * 1024): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Try WebP compression with adaptive quality
        let quality = 0.85;

        function attemptCompression(q: number) {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Image compression failed'));
                return;
              }
              if (blob.size <= targetMaxBytes || q <= 0.4) {
                resolve(blob);
              } else {
                attemptCompression(q - 0.15);
              }
            },
            'image/webp',
            q
          );
        }

        attemptCompression(quality);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Upload compressed banner to Firebase Storage if available
 */
export async function uploadPromoImage(file: File): Promise<string> {
  const compressedBlob = await compressImageToWebp(file);
  const fileName = `banners/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.webp`;

  try {
    const storageRef = ref(storage, fileName);
    await uploadBytes(storageRef, compressedBlob, {
      contentType: 'image/webp',
      cacheControl: 'public,max-age=31536000',
    });
    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
  } catch (err: any) {
    console.warn('[PromoService] Storage upload failed or not enabled:', err?.message);
    throw new Error('تعذر رفع الصورة إلى Firebase Storage. يمكنك استخدام رابط صورة مباشر.');
  }
}
