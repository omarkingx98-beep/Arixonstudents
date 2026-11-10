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
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db, auth, sanitizeFirestoreData, uploadDataUrlToStorage } from './firebase';
import { recordAdminAuditLog } from './adminService';
import type { DynamicAnnouncement, DynamicAnnouncementType } from '../types';

export const APP_ANNOUNCEMENTS_COLLECTION = 'appAnnouncements';

// Default initial data for automatic seeding on first run
export const INITIAL_DYNAMIC_ANNOUNCEMENTS: DynamicAnnouncement[] = [
  {
    id: 'ann_ticker_whatsapp_community',
    type: 'ticker',
    title: 'مجتمع توجيهي 2009 الرسمي',
    content: 'انضم لمجتمع Arixon على واتساب لمتابعة التحديات، النماذج الوزارية، وأخبار الثانوية العامة أولاً بأول.',
    linkUrl: 'https://chat.whatsapp.com/FQ39q5zXeZq8DJeeuPJNpu',
    linkType: 'external',
    linkLabel: 'انضم للجروب الآن',
    openInNewTab: true,
    priority: 'high',
    active: true,
    order: 1,
    targetAudience: 'مشترك',
    createdAt: '2026-10-25T12:00:00.000Z',
    updatedAt: new Date().toISOString(),
    createdBy: 'admin',
  },
  {
    id: 'ann_ticker_exams_welcome',
    type: 'ticker',
    title: 'امتحانات وزارية جديدة',
    content: 'تم إطلاق امتحانات الفيزياء واللغة العربية والتربية الإسلامية وفق أحدث معايير المنهاج الفلسطيني 2009.',
    linkUrl: '/exams',
    linkType: 'internal',
    linkLabel: 'تصفح الامتحانات',
    openInNewTab: false,
    priority: 'medium',
    active: true,
    order: 2,
    targetAudience: 'all',
    createdAt: '2026-10-26T10:00:00.000Z',
    updatedAt: new Date().toISOString(),
    createdBy: 'admin',
  },
  {
    id: 'ad_banner_pwa_install',
    type: 'image_ad',
    title: 'حمّل تطبيق Arixon',
    content: 'ادخل بضغطة واحدة من شاشة جوالك — تجربة تطبيق متكاملة وتصفح سريع.',
    imageUrl: '/banners/pwa_install_banner.webp',
    imageAlt: 'حمّل تطبيق Arixon',
    linkUrl: '/install',
    linkType: 'internal',
    linkLabel: 'اضغط للتثبيت',
    openInNewTab: false,
    priority: 'high',
    active: true,
    order: 1,
    targetAudience: 'مشترك',
    createdAt: '2026-10-25T11:00:00.000Z',
    updatedAt: new Date().toISOString(),
    createdBy: 'admin',
  },
  {
    id: 'ad_banner_whatsapp_community',
    type: 'image_ad',
    title: 'انضم لمجتمع Arixon على واتساب',
    content: 'مجتمع توجيهي 2009 — بنك أسئلة، مراجعات، ومسابقات دورية بجوائز ونقاط تفوق.',
    imageUrl: '/banners/whatsapp_community_banner.webp',
    imageAlt: 'انضم لمجتمع Arixon على واتساب - توجيهي 2009',
    linkUrl: 'https://chat.whatsapp.com/FQ39q5zXeZq8DJeeuPJNpu',
    linkType: 'external',
    linkLabel: 'انضم الآن',
    openInNewTab: true,
    priority: 'high',
    active: true,
    order: 2,
    targetAudience: 'مشترك',
    createdAt: '2026-10-25T12:00:00.000Z',
    updatedAt: new Date().toISOString(),
    createdBy: 'admin',
  },
  {
    id: 'ad_banner_physics_exam',
    type: 'image_ad',
    title: 'امتحان الفيزياء الوزاري الشامل — الزخم الخطي والدفع',
    content: 'اختبر مستواك الآن في 20 سؤالاً وزارياً شاملاً مع تصحيح ذكي وشروحات نموذجية مفصلة.',
    imageUrl: '/banners/banner_1.jpg',
    imageAlt: 'امتحان الفيزياء الوزاري الشامل لجيل 2009',
    linkUrl: '/exams',
    linkType: 'internal',
    linkLabel: 'ابدأ الامتحان',
    openInNewTab: false,
    priority: 'medium',
    active: true,
    order: 2,
    targetAudience: 'scientific',
    createdAt: '2026-10-26T12:00:00.000Z',
    updatedAt: new Date().toISOString(),
    createdBy: 'admin',
  },
  {
    id: 'ad_banner_arabic_exam',
    type: 'image_ad',
    title: 'امتحان اللغة العربية الوزاري — مهارات الاتصال',
    content: 'قواعد، نصوص، وبلاغة وفق معايير امتحان التوجيهي الوزاري 2009.',
    imageUrl: '/banners/banner_2.jpg',
    imageAlt: 'امتحان اللغة العربية الوزاري الشامل',
    linkUrl: '/exams',
    linkType: 'internal',
    linkLabel: 'خوض التحدي',
    openInNewTab: false,
    priority: 'medium',
    active: true,
    order: 3,
    targetAudience: 'مشترك',
    createdAt: '2026-10-26T13:00:00.000Z',
    updatedAt: new Date().toISOString(),
    createdBy: 'admin',
  },
  {
    id: 'ad_banner_leaderboard',
    type: 'image_ad',
    title: 'لوحة الشرف التنافسية',
    content: 'نافس زملاءك في التوجيهي واجمع النقاط لتتصدر الترتيب العام على مستوى فلسطين!',
    imageUrl: '/banners/banner_3.jpg',
    imageAlt: 'لوحة الشرف والتصنيف الأسبوعي والشهري',
    linkUrl: '/leaderboard',
    linkType: 'internal',
    linkLabel: 'شاهد الترتيب',
    openInNewTab: false,
    priority: 'low',
    active: true,
    order: 4,
    targetAudience: 'all',
    createdAt: '2026-10-26T14:00:00.000Z',
    updatedAt: new Date().toISOString(),
    createdBy: 'admin',
  },
];

// Seed initial items to new collection if empty
let isSeedingPromise: Promise<void> | null = null;
export async function seedInitialDynamicAnnouncements(): Promise<void> {
  if (isSeedingPromise) return isSeedingPromise;

  isSeedingPromise = (async () => {
    try {
      const colRef = collection(db, APP_ANNOUNCEMENTS_COLLECTION);
      const snap = await getDocs(query(colRef));
      if (snap.empty) {
        console.log('[DynamicAnnouncements] Seeding initial ticker announcements and image ads into Firestore...');
        for (const item of INITIAL_DYNAMIC_ANNOUNCEMENTS) {
          const docRef = doc(db, APP_ANNOUNCEMENTS_COLLECTION, item.id);
          await setDoc(docRef, sanitizeFirestoreData(item), { merge: true });
        }
      }
    } catch (err: any) {
      console.warn('[DynamicAnnouncements] Seeding notice (using local initial fallback):', err?.message);
    }
  })();

  return isSeedingPromise;
}

/**
 * Filter out expired announcements
 */
function filterUnexpired(items: DynamicAnnouncement[]): DynamicAnnouncement[] {
  const now = Date.now();
  return items.filter((item) => {
    if (item.expiresAt) {
      const exp = new Date(item.expiresAt).getTime();
      if (!isNaN(exp) && exp <= now) return false;
    }
    if (item.startAt) {
      const start = new Date(item.startAt).getTime();
      if (!isNaN(start) && start > now) return false;
    }
    return true;
  });
}

/**
 * Real-time subscription to ALL dynamic announcements (used by Admin Panel)
 */
export function subscribeToAllAnnouncements(
  callback: (items: DynamicAnnouncement[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  // Trigger seeding check in background
  seedInitialDynamicAnnouncements().catch(() => {});

  const colRef = collection(db, APP_ANNOUNCEMENTS_COLLECTION);
  const q = query(colRef);

  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        // Fallback to initial if collection is newly created
        callback(INITIAL_DYNAMIC_ANNOUNCEMENTS);
        return;
      }
      const items: DynamicAnnouncement[] = [];
      snapshot.forEach((d) => {
        items.push({ ...(d.data() as DynamicAnnouncement), id: d.id });
      });
      // Sort by order asc, then updatedAt desc
      items.sort((a, b) => {
        if ((a.order ?? 99) !== (b.order ?? 99)) {
          return (a.order ?? 99) - (b.order ?? 99);
        }
        return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
      });
      callback(items);
    },
    (err) => {
      console.warn('[DynamicAnnouncements] onSnapshot error on appAnnouncements:', err);
      // Fallback to local defaults
      callback(INITIAL_DYNAMIC_ANNOUNCEMENTS);
      if (onError) onError(err);
    }
  );
}

/**
 * Real-time subscription to active Ticker announcements (used by Top Ticker Bar app-wide)
 */
export function subscribeToActiveTickers(
  callback: (items: DynamicAnnouncement[]) => void
): Unsubscribe {
  const colRef = collection(db, APP_ANNOUNCEMENTS_COLLECTION);
  const q = query(
    colRef,
    where('type', '==', 'ticker'),
    where('active', '==', true)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        // Fallback to default unexpired ticker items
        const defaults = INITIAL_DYNAMIC_ANNOUNCEMENTS.filter((i) => i.type === 'ticker' && i.active);
        callback(defaults);
        return;
      }
      const list: DynamicAnnouncement[] = [];
      snapshot.forEach((d) => {
        list.push({ ...(d.data() as DynamicAnnouncement), id: d.id });
      });
      list.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
      callback(filterUnexpired(list));
    },
    (err) => {
      console.warn('[DynamicAnnouncements] Ticker subscription warning:', err);
      const defaults = INITIAL_DYNAMIC_ANNOUNCEMENTS.filter((i) => i.type === 'ticker' && i.active);
      callback(defaults);
    }
  );
}

/**
 * Real-time subscription to active Image Ads / Banners (used by Dashboard Carousel app-wide)
 */
export function subscribeToActiveImageAds(
  callback: (items: DynamicAnnouncement[]) => void
): Unsubscribe {
  const colRef = collection(db, APP_ANNOUNCEMENTS_COLLECTION);
  const q = query(
    colRef,
    where('type', '==', 'image_ad'),
    where('active', '==', true)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        const defaults = INITIAL_DYNAMIC_ANNOUNCEMENTS.filter((i) => i.type === 'image_ad' && i.active);
        callback(defaults);
        return;
      }
      const list: DynamicAnnouncement[] = [];
      snapshot.forEach((d) => {
        list.push({ ...(d.data() as DynamicAnnouncement), id: d.id });
      });

      const hasPwaBanner = list.some(
        (i) => i.id === 'ad_banner_pwa_install' || (i.linkUrl && i.linkUrl.includes('install')) || (i.imageAlt && i.imageAlt.includes('تطبيق Arixon'))
      );
      if (!hasPwaBanner) {
        const pwaBanner = INITIAL_DYNAMIC_ANNOUNCEMENTS.find((i) => i.id === 'ad_banner_pwa_install');
        if (pwaBanner) {
          list.unshift(pwaBanner);
        }
      }

      list.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
      callback(filterUnexpired(list));
    },
    (err) => {
      console.warn('[DynamicAnnouncements] Image ads subscription warning:', err);
      const defaults = INITIAL_DYNAMIC_ANNOUNCEMENTS.filter((i) => i.type === 'image_ad' && i.active);
      callback(defaults);
    }
  );
}

/**
 * Save or Update a dynamic announcement (Ticker or Image Ad)
 */
export async function saveDynamicAnnouncement(
  data: Partial<DynamicAnnouncement> & { type: DynamicAnnouncementType; title: string }
): Promise<string> {
  const id = data.id || `ann_${data.type}_${Date.now()}`;
  const now = new Date().toISOString();

  // Enforce correct official WhatsApp community link if link includes WhatsApp
  let cleanLinkUrl = data.linkUrl?.trim() || '';
  if (cleanLinkUrl && (cleanLinkUrl.includes('whatsapp') || cleanLinkUrl.includes('arixon-tawjihi-2009'))) {
    cleanLinkUrl = 'https://chat.whatsapp.com/FQ39q5zXeZq8DJeeuPJNpu';
  }

  const payload: DynamicAnnouncement = {
    id,
    type: data.type,
    title: data.title.trim(),
    content: data.content?.trim() || '',
    imageUrl: data.imageUrl || (data.type === 'image_ad' ? '/banners/whatsapp_community_banner.webp' : undefined),
    imageAlt: data.imageAlt?.trim() || data.title.trim(),
    linkUrl: cleanLinkUrl || undefined,
    linkType: data.linkType || (cleanLinkUrl ? (cleanLinkUrl.startsWith('http') ? 'external' : 'internal') : 'none'),
    linkLabel: data.linkLabel?.trim() || (cleanLinkUrl ? 'عرض التفاصيل' : undefined),
    openInNewTab: data.openInNewTab !== undefined ? data.openInNewTab : cleanLinkUrl.startsWith('http'),
    priority: data.priority || 'medium',
    active: data.active !== undefined ? data.active : true,
    order: typeof data.order === 'number' ? data.order : 1,
    targetAudience: data.targetAudience || 'all',
    startAt: data.startAt || null,
    expiresAt: data.expiresAt || null,
    createdAt: data.createdAt || now,
    updatedAt: now,
    createdBy: data.createdBy || auth.currentUser?.email || 'admin',
  };

  const docRef = doc(db, APP_ANNOUNCEMENTS_COLLECTION, id);
  await setDoc(docRef, sanitizeFirestoreData(payload), { merge: true });

  // Record Admin Audit Log
  const isEdit = Boolean(data.id);
  await recordAdminAuditLog({
    action: isEdit ? 'edit_announcement' : 'create_announcement',
    targetType: 'announcement',
    targetId: id,
    details: `${isEdit ? 'تعديل' : 'إنشاء'} إعلان ${payload.type === 'ticker' ? 'شريط علوي' : 'إعلان مصوّر'}: "${payload.title}"`,
    metadata: {
      type: payload.type,
      active: payload.active,
      linkUrl: payload.linkUrl,
    },
  }).catch(() => {});

  // Dual-sync for backwards compatibility with legacy collections
  try {
    if (payload.type === 'ticker') {
      const legRef = doc(db, 'announcements', id);
      await setDoc(legRef, {
        id,
        title: payload.title,
        content: payload.content,
        linkUrl: payload.linkUrl || null,
        linkLabel: payload.linkLabel || null,
        priority: payload.priority || 'medium',
        published: payload.active,
        expiresAt: payload.expiresAt || null,
        createdAt: payload.createdAt,
        updatedAt: payload.updatedAt,
        publishedAt: payload.active ? now : null,
        createdBy: payload.createdBy,
      }, { merge: true });
    } else if (payload.type === 'image_ad') {
      const promoRef = doc(db, 'promoBanners', id);
      await setDoc(promoRef, {
        id,
        imageUrl: payload.imageUrl,
        alt: payload.imageAlt || payload.title,
        linkType: payload.linkType === 'external' ? 'external' : payload.linkType === 'internal' ? 'internal' : 'none',
        linkTarget: payload.linkUrl || '',
        order: payload.order,
        active: payload.active,
        startAt: payload.startAt || null,
        endAt: payload.expiresAt || null,
        createdAt: payload.createdAt,
        updatedAt: payload.updatedAt,
      }, { merge: true });
    }
  } catch (syncErr) {
    console.warn('[DynamicAnnouncements] Legacy collections sync note:', syncErr);
  }

  return id;
}

/**
 * One-click visibility toggle for any announcement or ad
 */
export async function toggleDynamicAnnouncementVisibility(
  id: string,
  currentActive: boolean,
  announcementTitle?: string
): Promise<boolean> {
  const newActive = !currentActive;
  const docRef = doc(db, APP_ANNOUNCEMENTS_COLLECTION, id);
  await updateDoc(docRef, {
    active: newActive,
    updatedAt: new Date().toISOString(),
  });

  // Also sync legacy collections
  try {
    const legAnnRef = doc(db, 'announcements', id);
    await updateDoc(legAnnRef, { published: newActive, updatedAt: new Date().toISOString() }).catch(() => {});
    const legPromoRef = doc(db, 'promoBanners', id);
    await updateDoc(legPromoRef, { active: newActive, updatedAt: new Date().toISOString() }).catch(() => {});
  } catch {}

  await recordAdminAuditLog({
    action: 'toggle_announcement',
    targetType: 'announcement',
    targetId: id,
    details: `${newActive ? 'تفعيل وإظهار' : 'إيقاف وإخفاء'} الإعلان: "${announcementTitle || id}"`,
    metadata: { newActive },
  }).catch(() => {});

  return newActive;
}

/**
 * Delete a dynamic announcement
 */
export async function deleteDynamicAnnouncement(id: string, title?: string): Promise<void> {
  const docRef = doc(db, APP_ANNOUNCEMENTS_COLLECTION, id);
  await deleteDoc(docRef);

  // Also delete from legacy collections
  try {
    await deleteDoc(doc(db, 'announcements', id)).catch(() => {});
    await deleteDoc(doc(db, 'promoBanners', id)).catch(() => {});
  } catch {}

  await recordAdminAuditLog({
    action: 'delete_announcement',
    targetType: 'announcement',
    targetId: id,
    details: `حذف إعلان نهائياً: "${title || id}"`,
  }).catch(() => {});
}

/**
 * Reorder dynamic announcements
 */
export async function reorderDynamicAnnouncements(orderedIds: string[]): Promise<void> {
  const now = new Date().toISOString();
  for (let i = 0; i < orderedIds.length; i++) {
    const id = orderedIds[i];
    const docRef = doc(db, APP_ANNOUNCEMENTS_COLLECTION, id);
    await updateDoc(docRef, {
      order: i + 1,
      updatedAt: now,
    }).catch(() => {});
  }

  await recordAdminAuditLog({
    action: 'reorder_announcements',
    targetType: 'announcement',
    targetId: 'all',
    details: `إعادة ترتيب ${orderedIds.length} إعلان في المنظومة`,
  }).catch(() => {});
}
