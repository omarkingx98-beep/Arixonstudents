import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import type { StaffRole, StaffBadge, AdminTab } from '../types';

export interface RoleConfig {
  role: StaffRole;
  labelAr: string;
  icon: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  description: string;
}

export const ROLE_CONFIGS: Record<StaffRole, RoleConfig> = {
  super_admin: {
    role: 'super_admin',
    labelAr: 'المشرف الأعلى (المالك)',
    icon: '⭐',
    badgeBg: 'bg-amber-500/15 dark:bg-amber-500/20',
    badgeBorder: 'border-amber-500/40',
    badgeText: 'text-amber-700 dark:text-amber-300',
    description: 'صلاحيات كاملة وغير مقيدة وإدارة فريق العمل والإعدادات الحساسة',
  },
  admin: {
    role: 'admin',
    labelAr: 'مدير النظام',
    icon: '🛡️',
    badgeBg: 'bg-blue-500/15 dark:bg-blue-500/20',
    badgeBorder: 'border-blue-500/40',
    badgeText: 'text-blue-700 dark:text-blue-300',
    description: 'إدارة الامتحانات والطلاب والإعلانات والتقارير والنقاط',
  },
  moderator: {
    role: 'moderator',
    labelAr: 'مشرف الرقابة والمحادثات',
    icon: '✅',
    badgeBg: 'bg-emerald-500/15 dark:bg-emerald-500/20',
    badgeBorder: 'border-emerald-500/40',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    description: 'فحص البلاغات والدردشات وتطبيق الكتم والإنذارات',
  },
  content_editor: {
    role: 'content_editor',
    labelAr: 'محرر الامتحانات والأسئلة',
    icon: '✏️',
    badgeBg: 'bg-purple-500/15 dark:bg-purple-500/20',
    badgeBorder: 'border-purple-500/40',
    badgeText: 'text-purple-700 dark:text-purple-300',
    description: 'إنشاء وتعديل واستيراد مسودات الامتحانات وبنك الأسئلة',
  },
  community_manager: {
    role: 'community_manager',
    labelAr: 'مدير المجتمع والإعلانات',
    icon: '📢',
    badgeBg: 'bg-orange-500/15 dark:bg-orange-500/20',
    badgeBorder: 'border-orange-500/40',
    badgeText: 'text-orange-700 dark:text-orange-300',
    description: 'إدارة الشريط الإعلاني والبث والتحديات وروابط المجتمع',
  },
  support_agent: {
    role: 'support_agent',
    labelAr: 'دعم الطلاب',
    icon: '🎧',
    badgeBg: 'bg-teal-500/15 dark:bg-teal-500/20',
    badgeBorder: 'border-teal-500/40',
    badgeText: 'text-teal-700 dark:text-teal-300',
    description: 'الرد على الشكاوى والاقتراحات وإعادة تصحيح المحاولات العالقة',
  },
  student: {
    role: 'student',
    labelAr: 'طالب',
    icon: '🎓',
    badgeBg: 'bg-slate-500/10 dark:bg-slate-500/15',
    badgeBorder: 'border-slate-400/20',
    badgeText: 'text-slate-600 dark:text-slate-400',
    description: 'حساب طالب اعتيادي',
  },
};

// In-memory session cache for staff badges
const badgeCache = new Map<string, StaffBadge | null>();

/**
 * Fetch staff badge for a user, cached in session memory
 */
export async function getStaffBadge(uid: string): Promise<StaffBadge | null> {
  if (!uid) return null;
  if (badgeCache.has(uid)) {
    return badgeCache.get(uid) || null;
  }

  try {
    const badgeDoc = await getDoc(doc(db, 'staffBadges', uid));
    if (badgeDoc.exists()) {
      const data = badgeDoc.data();
      const badge: StaffBadge = {
        uid,
        role: data.role as StaffRole,
        label: data.label || ROLE_CONFIGS[data.role as StaffRole]?.labelAr || 'عضو فريق',
        updatedAt: data.updatedAt,
      };
      badgeCache.set(uid, badge);
      return badge;
    } else {
      badgeCache.set(uid, null);
      return null;
    }
  } catch (err) {
    console.warn(`[roleService] Could not fetch staffBadge for ${uid}:`, err);
    return null;
  }
}

/**
 * Batch fetch staff badges for multiple users
 */
export async function getStaffBadges(uids: string[]): Promise<Record<string, StaffBadge>> {
  const result: Record<string, StaffBadge> = {};
  const missingUids: string[] = [];

  for (const uid of uids) {
    if (!uid) continue;
    if (badgeCache.has(uid)) {
      const cached = badgeCache.get(uid);
      if (cached) result[uid] = cached;
    } else {
      missingUids.push(uid);
    }
  }

  if (missingUids.length === 0) return result;

  // Fetch missing individually or small chunks
  await Promise.all(
    missingUids.map(async (uid) => {
      const badge = await getStaffBadge(uid);
      if (badge) result[uid] = badge;
    })
  );

  return result;
}

/**
 * Invalidate a badge in cache
 */
export function invalidateStaffBadge(uid: string) {
  badgeCache.delete(uid);
}

/**
 * Determine if a given staff role can access an Admin tab
 */
export function canAccessTab(role: StaffRole, tab: AdminTab): boolean {
  if (role === 'super_admin') return true;
  if (role === 'admin') {
    // Admin has access to everything except team management and sensitive settings
    return tab !== 'team';
  }

  switch (role) {
    case 'moderator':
      return tab === 'moderation' || tab === 'profile' || tab === 'dashboard';

    case 'content_editor':
      return (
        tab === 'exams' ||
        tab === 'questions' ||
        tab === 'ai-builder' ||
        tab === 'ai-import' ||
        tab === 'profile' ||
        tab === 'dashboard'
      );

    case 'community_manager':
      return (
        tab === 'announcements' ||
        tab === 'banners' ||
        tab === 'challenges' ||
        tab === 'analytics' ||
        tab === 'profile' ||
        tab === 'dashboard'
      );

    case 'support_agent':
      return tab === 'moderation' || tab === 'students' || tab === 'profile' || tab === 'dashboard';

    default:
      return false;
  }
}

/**
 * Check action permissions based on role
 */
export function hasPermission(
  role: StaffRole,
  action:
    | 'manage_team'
    | 'manage_settings'
    | 'view_audit_logs'
    | 'manage_exams'
    | 'publish_exam'
    | 'delete_exam'
    | 'manage_students'
    | 'view_students_basic'
    | 'adjust_points'
    | 'manage_announcements'
    | 'manage_challenges'
    | 'moderate_reports'
    | 'moderate_chat'
    | 'handle_support'
): boolean {
  if (role === 'super_admin') return true;

  if (role === 'admin') {
    return action !== 'manage_team' && action !== 'manage_settings';
  }

  switch (action) {
    case 'manage_team':
    case 'manage_settings':
    case 'adjust_points':
      return false;

    case 'view_audit_logs':
      return false;

    case 'manage_exams':
      return role === 'content_editor';

    case 'publish_exam':
    case 'delete_exam':
      return false; // content_editor cannot publish directly or delete

    case 'manage_students':
      return false;

    case 'view_students_basic':
      return role === 'support_agent';

    case 'manage_announcements':
    case 'manage_challenges':
      return role === 'community_manager';

    case 'moderate_reports':
    case 'moderate_chat':
      return role === 'moderator';

    case 'handle_support':
      return role === 'support_agent' || role === 'moderator';

    default:
      return false;
  }
}
