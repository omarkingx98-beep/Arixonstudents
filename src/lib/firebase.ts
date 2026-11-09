import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  reauthenticateWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
  applyActionCode,
  checkActionCode,
  ActionCodeInfo,
  signOut,
  setPersistence,
  browserLocalPersistence,
  User,
  Auth,
  EmailAuthProvider,
  linkWithCredential,
  updatePassword,
  fetchSignInMethodsForEmail
} from 'firebase/auth';
import { 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  serverTimestamp,
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs,
  where,
  getDocFromServer,
  Firestore
} from 'firebase/firestore';
import {
  getStorage,
  ref,
  uploadBytes,
  uploadString,
  getDownloadURL,
  deleteObject,
  FirebaseStorage
} from 'firebase/storage';
import { getAnalytics, isSupported } from 'firebase/analytics';
import type { UserProfile, LeaderboardEntry, Exam, SubjectId } from '../types';
import configJson from '../../firebase-applet-config.json';

// Initialize Firebase with the active project configuration
const firebaseConfig = {
  projectId: configJson.projectId,
  appId: configJson.appId,
  apiKey: configJson.apiKey,
  authDomain: configJson.authDomain,
  storageBucket: configJson.storageBucket,
  messagingSenderId: configJson.messagingSenderId,
  measurementId: configJson.measurementId || undefined,
};

const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

const dbId = configJson.firestoreDatabaseId && configJson.firestoreDatabaseId !== '(default)'
  ? configJson.firestoreDatabaseId 
  : undefined;

// Enable persistent multi-tab offline caching so the app works seamlessly offline and syncs automatically
let firestoreDb: Firestore;
try {
  firestoreDb = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  }, dbId);
} catch {
  // If already initialized in hot reload
  firestoreDb = getFirestore(app, dbId);
}

export const db: Firestore = firestoreDb;

export const auth: Auth = getAuth(app);

// Initialize Firebase Storage connected to arixonstudents-d902a.firebasestorage.app
export const storage: FirebaseStorage = getStorage(app);

// Initialize Firebase Analytics if supported in the current environment
export let analytics: any = null;
if (typeof window !== 'undefined' && configJson.measurementId) {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch(() => {
    // Non-fatal analytics notice
  });
}

// Enforce browserLocalPersistence for rock-solid session persistence across tabs and browser restarts
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn('[Firebase Auth] Persistence initialization notice:', err);
});

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

/**
 * Validates active connection to Firestore
 */
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, '_connection_test', 'ping'));
    return true;
  } catch (error: any) {
    if (error?.message?.includes('the client is offline')) {
      console.warn('[Firebase] Firestore client currently operating in offline mode.');
      return false;
    }
    // Document not found or permission error still means server responded
    return true;
  }
}

/**
 * Storage Helpers
 * Note: Firebase Storage is NOT enabled due to billing requirements on the free tier.
 * These helpers provide automatic safe fallbacks (e.g. data URLs) so the application
 * runs 100% smoothly without crashes or requiring paid billing.
 */

export const IS_STORAGE_ENABLED = false;

/**
 * Upload a file/blob to Firebase Storage with safe graceful fallback
 */
export async function uploadFileToStorage(
  storagePath: string, 
  file: Blob | Uint8Array | ArrayBuffer, 
  metadata?: { contentType?: string; customMetadata?: Record<string, string> }
): Promise<string> {
  try {
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file, metadata);
    return await getDownloadURL(storageRef);
  } catch (err: any) {
    console.info('[Firebase Storage] Storage operation bypassed (free tier without billing):', err?.message);
    // If the file is a Blob, convert to Data URL for in-memory / local usage safely
    if (file instanceof Blob && file.size < 500000) {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      });
    }
    return '';
  }
}

/**
 * Upload a data URL / base64 string to Firebase Storage with safe inline fallback
 */
export async function uploadDataUrlToStorage(
  storagePath: string,
  dataUrl: string
): Promise<string> {
  try {
    const storageRef = ref(storage, storagePath);
    await uploadString(storageRef, dataUrl, 'data_url');
    return await getDownloadURL(storageRef);
  } catch (err: any) {
    console.info('[Firebase Storage] Using inline data URL fallback (free tier without billing):', err?.message);
    return dataUrl;
  }
}

/**
 * Retrieve download URL for a file in Firebase Storage with graceful fallback
 */
export async function getStorageFileUrl(storagePath: string): Promise<string> {
  try {
    const storageRef = ref(storage, storagePath);
    return await getDownloadURL(storageRef);
  } catch (err: any) {
    console.info('[Firebase Storage] Could not fetch storage URL:', err?.message);
    return '';
  }
}

/**
 * Delete a file in Firebase Storage with safe error handling
 */
export async function deleteFileFromStorage(storagePath: string): Promise<void> {
  try {
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
  } catch (err: any) {
    console.info('[Firebase Storage] Delete bypassed or object not found:', err?.message);
  }
}

/**
 * Clean data helper to recursively remove any undefined fields before sending to Firestore
 */
export function sanitizeFirestoreData<T extends Record<string, any>>(data: T): Partial<T> {
  const clean: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        clean[key] = sanitizeFirestoreData(value);
      } else {
        clean[key] = value;
      }
    }
  }
  return clean;
}

/**
 * Sign in with Google Popup with redirect fallback for mobile webviews / blocked popups
 */
export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err: any) {
    console.error('[FirebaseAuthError] signInWithPopup error code:', err?.code, err);
    // If popup is blocked by mobile in-app browser or pop-up blocker, fallback to redirect
    if (err?.code === 'auth/popup-blocked' || err?.code === 'auth/cancelled-popup-request') {
      console.info('[FirebaseAuth] Falling back to signInWithRedirect...');
      await signInWithRedirect(auth, googleProvider);
      return new Promise(() => {}); // Wait for browser redirect
    }
    throw err;
  }
}

/**
 * Check if the user returned from a signInWithRedirect flow
 */
export async function checkRedirectSignInResult(): Promise<User | null> {
  try {
    const result = await getRedirectResult(auth);
    return result ? result.user : null;
  } catch (err: any) {
    console.error('[FirebaseAuthError] getRedirectResult code:', err?.code, err);
    return null;
  }
}

/**
 * Sign in with Email and Password
 */
export async function signInWithEmail(email: string, password: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password.trim());
  return result.user;
}

/**
 * Sign up with Email and Password
 */
export async function signUpWithEmail(email: string, password: string): Promise<User> {
  const result = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password.trim());
  return result.user;
}

/**
 * Send Password Reset Email with continue URL to Arixon domain
 */
export async function resetPassword(email: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  await sendPasswordResetEmail(auth, cleanEmail, {
    url: 'https://arixonstudents.vercel.app/',
    handleCodeInApp: false,
  });
}

/**
 * Verify a password reset oobCode and return the associated email address
 */
export async function verifyResetCode(oobCode: string): Promise<string> {
  return await verifyPasswordResetCode(auth, oobCode);
}

/**
 * Confirm password reset with new password
 */
export async function confirmNewPassword(oobCode: string, newPass: string): Promise<void> {
  await confirmPasswordReset(auth, oobCode, newPass);
}

/**
 * Apply email verification action code
 */
export async function applyEmailVerification(oobCode: string): Promise<void> {
  await applyActionCode(auth, oobCode);
}

/**
 * Check and recover email action code
 */
export async function recoverUserEmail(oobCode: string): Promise<{ restoredEmail?: string }> {
  const info = await checkActionCode(auth, oobCode);
  await applyActionCode(auth, oobCode);
  return {
    restoredEmail: info.data?.email || undefined,
  };
}

/**
 * Mask email address for privacy (e.g. omar88x99@gmail.com -> om***9@gmail.com)
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local.charAt(0)}***@${domain}`;
  }
  const prefix = local.substring(0, 2);
  const suffix = local.slice(-1);
  return `${prefix}***${suffix}@${domain}`;
}

/**
 * Helper to map Action Code Firebase errors into clean 1-line Arabic explanations
 */
export function getActionErrorMessage(err: any): string {
  if (!err) return 'حدث خطأ غير متوقع أثناء معالجة الرابط.';
  const code = typeof err === 'object' && err.code ? err.code : '';
  console.error('[FirebaseActionCodeError] Code:', code, err);

  switch (code) {
    case 'auth/expired-action-code':
      return 'الرابط منتهي الصلاحية. يرجى طلب رابط جديد للمتابعة.';
    case 'auth/invalid-action-code':
      return 'الرابط غير صالح أو تم استخدامه مسبقًا.';
    case 'auth/user-disabled':
      return 'تم تعطيل هذا الحساب من قِبل إدارة المنصة.';
    case 'auth/user-not-found':
      return 'لم يتم العثور على حساب مرتبط بهذا الرابط.';
    case 'auth/weak-password':
      return 'كلمة المرور ضعيفة جدًا (يجب أن تتكون من 8 أحرف على الأقل).';
    case 'auth/network-request-failed':
      return 'تعذر الاتصال بالخادم، يرجى التحقق من اتصالك بالإنترنت.';
    default:
      return err.message && typeof err.message === 'string' && !err.message.includes('Firebase')
        ? err.message
        : 'الرابط منتهي أو مستخدم أو غير صالح، يرجى طلب رابط جديد.';
  }
}

/**
 * Link an Email & Password credential to an existing user (e.g. Google user)
 * Re-authenticates with Google first if Firebase requires recent login.
 */
export async function linkPasswordToAccount(user: User, password: string): Promise<void> {
  if (!user.email) {
    throw new Error('لا يوجد بريد إلكتروني مرتبط بحسابك.');
  }
  const cleanPassword = password.trim();
  if (cleanPassword.length < 6) {
    throw new Error('يجب أن تتكون كلمة المرور من 6 أحرف أو أرقام على الأقل.');
  }

  const credential = EmailAuthProvider.credential(user.email, cleanPassword);
  try {
    await linkWithCredential(user, credential);
  } catch (err: any) {
    console.error('[FirebaseAuthError] linkWithCredential code:', err?.code, err);
    if (err.code === 'auth/provider-already-linked') {
      await updatePassword(user, cleanPassword);
    } else if (err.code === 'auth/requires-recent-login') {
      try {
        await reauthenticateWithPopup(user, googleProvider);
        await linkWithCredential(user, credential);
      } catch (reauthErr: any) {
        console.error('[FirebaseAuthError] reauth code:', reauthErr?.code, reauthErr);
        throw new Error('يرجى إعادة تسجيل الدخول أولاً لتأكيد هويتك قبل تعيين كلمة المرور.');
      }
    } else if (err.code === 'auth/credential-already-in-use') {
      throw new Error('بيانات الاعتماد هذه مستخدمة بالفعل في حساب آخر.');
    } else {
      throw err;
    }
  }
}

/**
 * Check if the user has a password provider linked to their account
 */
export function userHasPasswordProvider(user: User | null): boolean {
  if (!user) return false;
  return user.providerData.some((p) => p.providerId === 'password');
}

/**
 * Check sign in methods registered for an email (e.g. ['google.com'] or ['password'])
 */
export async function checkEmailSignInMethods(email: string): Promise<string[]> {
  try {
    return await fetchSignInMethodsForEmail(auth, email.trim().toLowerCase());
  } catch {
    return [];
  }
}

/**
 * Helper to map Firebase Auth error codes into 1 small line in Arabic
 * Detailed technical codes are logged to console.error only
 */
export function getAuthErrorMessage(err: any): string {
  if (!err) return 'حدث خطأ غير متوقع أثناء تسجيل الدخول.';
  const code = typeof err === 'object' && err.code ? err.code : '';
  console.error('[FirebaseAuthError] Code:', code, err);

  switch (code) {
    case 'auth/invalid-email':
      return 'صيغة البريد الإلكتروني غير صالحة';
    case 'auth/user-not-found':
      return 'لا يوجد حساب بهذا البريد. إذا سجّلت بجوجل استخدم زر Google';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'البريد أو كلمة المرور غير صحيحة. إذا سجّلت بجوجل استخدم زر Google أو اضغط نسيت كلمة المرور';
    case 'auth/email-already-in-use':
      return 'هذا البريد مسجل بالفعل. سجّل دخولك بزر Google أو بكلمة المرور';
    case 'auth/account-exists-with-different-credential':
      return 'هذا البريد مسجل بالفعل عبر Google. يرجى الدخول بزر Google';
    case 'auth/weak-password':
      return 'كلمة المرور ضعيفة (يجب أن تتكون من 6 أحرف على الأقل)';
    case 'auth/operation-not-allowed':
      return 'طريقة تسجيل الدخول هذه غير مفعّلة حالياً';
    case 'auth/network-request-failed':
      return 'تعذر الاتصال بالخادم، يرجى التحقق من اتصالك بالإنترنت';
    case 'auth/too-many-requests':
      return 'تم حظر المحاولات مؤقتاً لتكرار الخطأ. انتظر دقيقة أو ادخل بـ Google';
    case 'auth/unauthorized-domain':
      return 'نطاق الموقع غير مصرح به في إعدادات Firebase';
    case 'auth/popup-closed-by-user':
      return 'تم إغلاق نافذة تسجيل الدخول بجوجل';
    case 'auth/popup-blocked':
      return 'المتصفح حظر النافذة المنبثقة، افتح الرابط في Chrome أو Safari';
    default:
      return err.message || 'حدث خطأ أثناء المصادقة، يرجى المحاولة لاحقاً';
  }
}

/**
 * Part N: Save user avatar in Firestore without Firebase Storage
 * - avatars/{uid}: { full: data URL, updatedAt } (< 60KB)
 * - publicProfiles/{uid}: avatar: thumbnail or preset (< 8KB)
 * - users/{uid}: photoURL: thumbnail or preset
 */
export async function saveUserAvatar(
  uid: string,
  fullDataUrl: string,
  thumbnailOrPreset: string
): Promise<void> {
  const now = new Date().toISOString();

  // 1. If it's a base64 data URL, store full image in avatars/{uid}
  if (fullDataUrl.startsWith('data:image/')) {
    const avatarRef = doc(db, 'avatars', uid);
    await setDoc(avatarRef, {
      full: fullDataUrl,
      updatedAt: serverTimestamp(),
    });
  } else if (thumbnailOrPreset.startsWith('preset:')) {
    try {
      await deleteDoc(doc(db, 'avatars', uid));
    } catch {}
  }

  // 2. Update publicProfiles/{uid}
  const pubRef = doc(db, 'publicProfiles', uid);
  await updateDoc(pubRef, {
    avatar: thumbnailOrPreset,
    photoURL: thumbnailOrPreset,
    updatedAt: now,
  }).catch(async () => {
    await setDoc(pubRef, {
      avatar: thumbnailOrPreset,
      photoURL: thumbnailOrPreset,
      updatedAt: now,
    }, { merge: true });
  });

  // 3. Update users/{uid}
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    photoURL: thumbnailOrPreset,
    updatedAt: now,
  }).catch(() => {});

  // Cache in sessionStorage
  if (typeof window !== 'undefined') {
    try {
      if (fullDataUrl) sessionStorage.setItem(`arixon_avatar_full_${uid}`, fullDataUrl);
      if (thumbnailOrPreset) sessionStorage.setItem(`arixon_avatar_thumb_${uid}`, thumbnailOrPreset);
    } catch {}
  }
}

/**
 * Part N: Fetch full avatar from avatars/{uid} (read only when opening profile)
 */
export async function fetchFullAvatar(uid: string): Promise<string | null> {
  if (typeof window !== 'undefined') {
    try {
      const cached = sessionStorage.getItem(`arixon_avatar_full_${uid}`);
      if (cached) return cached;
    } catch {}
  }

  try {
    const snap = await getDoc(doc(db, 'avatars', uid));
    if (snap.exists()) {
      const full = snap.data().full as string;
      if (typeof window !== 'undefined' && full) {
        try {
          sessionStorage.setItem(`arixon_avatar_full_${uid}`, full);
        } catch {}
      }
      return full || null;
    }
    return null;
  } catch (err) {
    console.warn('[AvatarService] fetchFullAvatar warning:', err);
    return null;
  }
}

/**
 * Part N: Remove user avatar (reset to initial letter / default)
 */
export async function removeUserAvatar(uid: string): Promise<void> {
  const now = new Date().toISOString();
  try {
    await deleteDoc(doc(db, 'avatars', uid));
  } catch {}

  const pubRef = doc(db, 'publicProfiles', uid);
  await updateDoc(pubRef, {
    avatar: '',
    photoURL: '',
    updatedAt: now,
  }).catch(() => {});

  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    photoURL: '',
    updatedAt: now,
  }).catch(() => {});

  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem(`arixon_avatar_full_${uid}`);
      sessionStorage.removeItem(`arixon_avatar_thumb_${uid}`);
    } catch {}
  }
}

/**
 * Sign out
 */
export async function logOut(): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (
          k.startsWith('arixon_completed_') || 
          k.startsWith('arixon_attempt_') || 
          k.startsWith('arixon_cached_profile_') ||
          k.startsWith('arixon_notif_state_') ||
          k.startsWith('arixon_has_seen_tutorial_') ||
          k.startsWith('arixon_daily_goals_') ||
          k.startsWith('arixon_admin_') ||
          k === 'arixon_demo_session'
        )) {
          keysToRemove.push(k);
        }
      }
      for (const k of keysToRemove) {
        localStorage.removeItem(k);
      }
    } catch {}
  }
  await signOut(auth);
}

/**
 * Check and get user profile from Firestore using Firebase Auth UID as primary key
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const userDocRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      const profile = userDoc.data() as UserProfile;
      // Cache locally for offline/refresh resilience
      try {
        localStorage.setItem(`arixon_cached_profile_${uid}`, JSON.stringify(profile));
      } catch {}
      // Ensure public profile exists
      syncPublicProfile(profile).catch(() => {});
      return profile;
    }
  } catch (err) {
    console.warn('[firebase] Error getting user profile from Firestore, checking cache:', err);
  }

  // Fallback to local cache if Firestore is temporarily unreachable on page refresh
  try {
    const raw = localStorage.getItem(`arixon_cached_profile_${uid}`);
    if (raw) {
      return JSON.parse(raw) as UserProfile;
    }
  } catch {}

  return null;
}

/**
 * Check if a username is already taken by another user
 * Queries publicProfiles which is readable by authenticated users
 */
export async function isUsernameTaken(username: string, excludeUid?: string): Promise<boolean> {
  try {
    const q = query(
      collection(db, 'publicProfiles'), 
      where('username', '==', username.trim().toLowerCase())
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return false;
    if (excludeUid) {
      return snapshot.docs.some(d => d.id !== excludeUid);
    }
    return true;
  } catch (error) {
    console.warn('Notice checking username in publicProfiles:', error);
    return false;
  }
}

/**
 * Create a new user profile on first onboarding.
 * CRITICAL: Checks if profile already exists in Firestore first to never overwrite existing points, rank, or history.
 */
export async function createUserProfile(
  user: User, 
  details: {
    username: string;
    displayName: string;
    age?: number;
    city?: string;
    branch?: string;
    gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
    whatsappGroup?: string;
    photoURL?: string;
  }
): Promise<UserProfile> {
  const userDocRef = doc(db, 'users', user.uid);

  // Safety check: if user already has a profile in Firestore, preserve it completely
  const existingDoc = await getDoc(userDocRef);
  if (existingDoc.exists()) {
    const exData = existingDoc.data() as UserProfile;
    // Ensure public profile exists as well
    try {
      await syncPublicProfile(exData);
    } catch {}
    return exData;
  }

  const now = new Date().toISOString();
  
  const rawProfile: any = {
    uid: user.uid,
    username: details.username.trim().toLowerCase(),
    displayName: details.displayName.trim() || user.displayName || 'طالب أريكسون',
    email: user.email || '',
    branch: details.branch?.trim() || 'علمي',
    totalPoints: 0,
    weeklyPoints: 0,
    monthlyPoints: 0,
    examsCompleted: 0,
    correctAnswers: 0,
    wrongAnswers: 0,
    createdAt: now,
    updatedAt: now,
    lastActiveAt: now,
    hasSeenTutorial: false,
    role: 'student',
  };

  if (details.photoURL || user.photoURL) {
    rawProfile.photoURL = details.photoURL || user.photoURL;
  }
  if (details.age !== undefined && !isNaN(Number(details.age))) {
    rawProfile.age = Number(details.age);
  }
  if (details.city && details.city.trim()) {
    rawProfile.city = details.city.trim();
  }
  if (details.gender) {
    rawProfile.gender = details.gender;
  }
  if (details.whatsappGroup && details.whatsappGroup.trim()) {
    rawProfile.whatsappGroup = details.whatsappGroup.trim();
  }

  // Sanitize data so no undefined field is ever sent to Firestore
  const profile = sanitizeFirestoreData(rawProfile) as UserProfile;
  await setDoc(userDocRef, profile);

  // Sync public profile
  try {
    await syncPublicProfile(profile);
  } catch (syncErr) {
    console.warn('[firebase] Sync public profile warning:', syncErr);
  }

  return profile;
}

/**
 * Update existing user profile
 */
export async function updateUserProfile(
  uid: string,
  updates: Partial<Pick<UserProfile, 'displayName' | 'username' | 'age' | 'city' | 'gender' | 'whatsappGroup' | 'photoURL' | 'branch'>>
): Promise<void> {
  const rawUpdates: any = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  // Ensure age is clean number or omit
  if (rawUpdates.age !== undefined && isNaN(Number(rawUpdates.age))) {
    delete rawUpdates.age;
  }
  // Ensure strings are trimmed
  if (rawUpdates.whatsappGroup !== undefined && !rawUpdates.whatsappGroup?.trim()) {
    delete rawUpdates.whatsappGroup;
  }

  const cleanUpdates = sanitizeFirestoreData(rawUpdates);

  try {
    const userDocRef = doc(db, 'users', uid);
    await setDoc(userDocRef, cleanUpdates, { merge: true });

    // Also sync public profile fields
    const pubRef = doc(db, 'publicProfiles', uid);
    const pubUpdates: any = {};
    if (cleanUpdates.displayName) pubUpdates.displayName = cleanUpdates.displayName;
    if (cleanUpdates.username) pubUpdates.username = cleanUpdates.username;
    if (cleanUpdates.photoURL) pubUpdates.photoURL = cleanUpdates.photoURL;
    if (cleanUpdates.branch) pubUpdates.branch = cleanUpdates.branch;
    pubUpdates.updatedAt = new Date().toISOString();
    if (Object.keys(pubUpdates).length > 0) {
      await setDoc(pubRef, pubUpdates, { merge: true });
    }
  } catch (err) {
    console.warn('Firestore user update notice (cached locally):', err);
  }

  // Update local cache
  try {
    const cachedStr = localStorage.getItem(`arixon_cached_profile_${uid}`);
    if (cachedStr) {
      const cached = JSON.parse(cachedStr);
      localStorage.setItem(`arixon_cached_profile_${uid}`, JSON.stringify({ ...cached, ...cleanUpdates }));
    }
  } catch (e) {
    console.warn('LocalStorage update failed:', e);
  }
}

/**
 * Update student branch (safe setDoc merge for instant persistence)
 */
export async function updateStudentBranch(uid: string, branch: 'علمي' | 'أدبي'): Promise<void> {
  const userDocRef = doc(db, 'users', uid);
  const now = new Date().toISOString();
  await setDoc(userDocRef, {
    branch,
    updatedAt: now,
  }, { merge: true });

  // Also sync public profile
  try {
    const pubRef = doc(db, 'publicProfiles', uid);
    await setDoc(pubRef, { branch, updatedAt: now }, { merge: true });
  } catch (err) {
    console.warn('Public profile branch sync notice:', err);
  }

  // Update local storage cache
  try {
    const cachedStr = localStorage.getItem(`arixon_cached_profile_${uid}`);
    if (cachedStr) {
      const cached = JSON.parse(cachedStr);
      cached.branch = branch;
      localStorage.setItem(`arixon_cached_profile_${uid}`, JSON.stringify(cached));
    }
  } catch {}
}

/**
 * Synchronize safe public profile without sensitive fields
 */
export async function syncPublicProfile(profile: UserProfile): Promise<void> {
  if (!profile.uid) return;
  const pubRef = doc(db, 'publicProfiles', profile.uid);
  const rawUsername = profile.username || 'student';
  const pubData: any = {
    uid: profile.uid,
    displayName: profile.displayName || rawUsername,
    username: rawUsername,
    usernameLower: rawUsername.toLowerCase().trim(),
    avatar: profile.photoURL || '',
    photoURL: profile.photoURL || '',
    track: profile.branch || 'علمي',
    branch: profile.branch || 'علمي',
    points: profile.totalPoints || 0,
    totalPoints: profile.totalPoints || 0,
    weeklyPoints: profile.weeklyPoints || 0,
    monthlyPoints: profile.monthlyPoints || 0,
    createdAt: profile.createdAt || new Date().toISOString(),
    examsCompleted: profile.examsCompleted || 0,
    correctAnswers: profile.correctAnswers || 0,
    wrongAnswers: profile.wrongAnswers || 0,
    updatedAt: new Date().toISOString(),
  };

  // Only expose age if explicitly enabled or allowed
  if (profile.showAgeInPublicProfile !== false && profile.age) {
    pubData.age = profile.age;
  }

  await setDoc(pubRef, sanitizeFirestoreData(pubData), { merge: true });
}

/**
 * Admin: One-time backfill tool to synchronize all existing users in 'users' collection 
 * into 'publicProfiles' with usernameLower, avatar, track, and points.
 */
export async function backfillAllPublicProfiles(): Promise<{ total: number; success: number }> {
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    let successCount = 0;
    for (const userDoc of usersSnap.docs) {
      try {
        const u = userDoc.data() as UserProfile;
        const uid = u.uid || userDoc.id;
        const rawUsername = u.username || 'student';
        const pubRef = doc(db, 'publicProfiles', uid);
        const pubData = {
          uid: uid,
          displayName: u.displayName || rawUsername,
          username: rawUsername,
          usernameLower: rawUsername.toLowerCase().trim(),
          avatar: u.photoURL || '',
          photoURL: u.photoURL || '',
          track: u.branch || 'علمي',
          branch: u.branch || 'علمي',
          points: u.totalPoints || 0,
          totalPoints: u.totalPoints || 0,
          weeklyPoints: u.weeklyPoints || 0,
          monthlyPoints: u.monthlyPoints || 0,
          examsCompleted: u.examsCompleted || 0,
          correctAnswers: u.correctAnswers || 0,
          wrongAnswers: u.wrongAnswers || 0,
          createdAt: u.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await setDoc(pubRef, sanitizeFirestoreData(pubData), { merge: true });
        successCount++;
      } catch (docErr) {
        console.warn('[firebase] Backfill item error:', userDoc.id, docErr);
      }
    }
    return { total: usersSnap.size, success: successCount };
  } catch (err) {
    console.error('[firebase] Backfill batch failed:', err);
    throw err;
  }
}


/**
 * Fetch public user profile safely without triggering permission-denied errors
 */
export async function fetchPublicUserProfile(uid: string): Promise<any | null> {
  try {
    const pubRef = doc(db, 'publicProfiles', uid);
    const snap = await getDoc(pubRef);
    if (snap.exists()) {
      return snap.data();
    }
    
    // Only if current user is inspecting their own profile, fallback to reading users doc
    if (auth.currentUser && auth.currentUser.uid === uid) {
      const uDoc = await getDoc(doc(db, 'users', uid));
      if (uDoc.exists()) {
        const u = uDoc.data() as UserProfile;
        const publicSafe = {
          uid: u.uid,
          displayName: u.displayName || u.username,
          username: u.username,
          photoURL: u.photoURL,
          branch: u.branch || 'علمي',
          totalPoints: u.totalPoints || 0,
          createdAt: u.createdAt,
          examsCompleted: u.examsCompleted || 0,
          age: u.showAgeInPublicProfile !== false ? u.age : undefined,
        };
        // Auto-heal missing public profile
        syncPublicProfile(u).catch(() => {});
        return publicSafe;
      }
    }
    return null;
  } catch (err) {
    console.warn('[firebase] Error fetching public profile:', err);
    return null;
  }
}

/**
 * Mark tutorial as seen in Firestore and local cache
 */
export async function markTutorialAsSeen(uid: string): Promise<void> {
  try {
    const userDocRef = doc(db, 'users', uid);
    await updateDoc(userDocRef, {
      hasSeenTutorial: true,
      updatedAt: new Date().toISOString(),
    });
    const cacheKey = `arixon_cached_profile_${uid}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        parsed.hasSeenTutorial = true;
        localStorage.setItem(cacheKey, JSON.stringify(parsed));
      } catch {}
    }
  } catch (err) {
    console.warn('Could not sync tutorial status to Firestore:', err);
  }
}

/**
 * Update last active timestamp
 */
export async function touchUserActivity(uid: string): Promise<void> {
  try {
    const userDocRef = doc(db, 'users', uid);
    await updateDoc(userDocRef, {
      lastActiveAt: new Date().toISOString(),
    });
  } catch {
    // Non-blocking
  }
}

/**
 * Query real leaderboard from publicProfiles collection (strictly readable by all authenticated students)
 * Supports time periods ('all' | 'weekly' | 'monthly') and branch filtration ('all' | 'علمي' | 'أدبي')
 */
export async function fetchLeaderboard(
  period: 'all' | 'weekly' | 'monthly' = 'all',
  branchFilter: 'all' | 'علمي' | 'أدبي' = 'all'
): Promise<LeaderboardEntry[]> {
  try {
    const pointsField = period === 'weekly' ? 'weeklyPoints' : period === 'monthly' ? 'monthlyPoints' : 'totalPoints';
    const pubCol = collection(db, 'publicProfiles');
    
    let q;
    if (branchFilter && branchFilter !== 'all') {
      q = query(
        pubCol,
        where('branch', '==', branchFilter),
        orderBy(pointsField, 'desc'),
        limit(50)
      );
    } else {
      q = query(
        pubCol,
        orderBy(pointsField, 'desc'),
        limit(50)
      );
    }

    const snapshot = await getDocs(q);
    let currentRank = 1;
    const entries: LeaderboardEntry[] = [];
    
    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data() as any;
      const points = data[pointsField] ?? data.totalPoints ?? 0;
      
      // Include users with rank, points and branch info
      entries.push({
        uid: data.uid || docSnapshot.id,
        username: data.username || 'طالب',
        displayName: data.displayName || data.username || 'طالب أريكسون',
        photoURL: data.photoURL,
        points: Number(points) || 0,
        rank: currentRank++,
        branch: data.branch || 'علمي',
      } as LeaderboardEntry & { branch?: string });
    });

    return entries;
  } catch (error) {
    console.error('Error fetching leaderboard from publicProfiles:', error);
    return [];
  }
}

/**
 * Fetch available exams from Firestore (Phase 1 structure, ready for real exams in Firestore)
 */
export async function fetchExams(subjectFilter?: SubjectId): Promise<Exam[]> {
  try {
    const examsRef = collection(db, 'exams');
    let q;
    if (subjectFilter && subjectFilter !== 'all') {
      q = query(examsRef, where('subject', '==', subjectFilter));
    } else {
      q = query(examsRef);
    }
    const snapshot = await getDocs(q);
    const exams: Exam[] = [];
    snapshot.forEach((docSnapshot) => {
      exams.push({ id: docSnapshot.id, ...(docSnapshot.data() as Omit<Exam, 'id'>) });
    });
    return exams;
  } catch (error) {
    console.warn('Exams collection empty or query failed:', error);
    return [];
  }
}

export * from './examService';
