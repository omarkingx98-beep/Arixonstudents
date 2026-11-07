import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateUserProfile, saveUserAvatar, removeUserAvatar } from '../lib/firebase';
import { PRESET_AVATARS, validateAvatarFile } from '../lib/avatarService';
import { UserAvatar } from './UserAvatar';
import { AvatarCropModal } from './AvatarCropModal';
import { 
  X, 
  Check, 
  Loader2, 
  User, 
  MapPin, 
  Calendar, 
  MessageCircle, 
  AlertCircle, 
  Upload, 
  Sparkles, 
  Trash2, 
  Globe 
} from 'lucide-react';

const CITIES = [
  // 🇵🇸 فلسطين الحبيبة
  '🇵🇸 فلسطين - القدس الشريف (العاصمة)',
  '🇵🇸 فلسطين - غزة العزة',
  '🇵🇸 فلسطين - خانيونس',
  '🇵🇸 فلسطين - رفح',
  '🇵🇸 فلسطين - دير البلح',
  '🇵🇸 فلسطين - شمال غزة (جباليا / بيت لاهيا)',
  '🇵🇸 فلسطين - رام الله والبيرة',
  '🇵🇸 فلسطين - نابلس (جبل النار)',
  '🇵🇸 فلسطين - الخليل',
  '🇵🇸 فلسطين - جنين',
  '🇵🇸 فلسطين - طولكرم',
  '🇵🇸 فلسطين - قلقيلية',
  '🇵🇸 فلسطين - بيت لحم',
  '🇵🇸 فلسطين - أريحا',
  '🇵🇸 فلسطين - سلفيت',
  '🇵🇸 فلسطين - طوباس',
  // 🇯🇴 الأردن الشقيق
  '🇯🇴 الأردن - عَمّان (العاصمة)',
  '🇯🇴 الأردن - إربد (عروس الشمال)',
  '🇯🇴 الأردن - الزرقاء',
  '🇯🇴 الأردن - البلقاء (السلط)',
  '🇯🇴 الأردن - مادبا',
  '🇯🇴 الأردن - العقبة',
  '🇯🇴 الأردن - الكرك',
  '🇯🇴 الأردن - معان',
  '🇯🇴 الأردن - الطفيلة',
  '🇯🇴 الأردن - جرش',
  '🇯🇴 الأردن - عجلون',
  '🇯🇴 الأردن - المفرق',
  // أخرى
  '🌍 دولة أخرى / مغترب'
];

interface EditProfileModalProps {
  onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ onClose }) => {
  const { user, profile, refreshProfile } = useAuth();

  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [branch, setBranch] = useState<'علمي' | 'أدبي'>(profile?.branch === 'أدبي' ? 'أدبي' : 'علمي');
  const [city, setCity] = useState(profile?.city || '🇵🇸 فلسطين - القدس الشريف (العاصمة)');
  const [age, setAge] = useState(profile?.age ? String(profile.age) : '17');
  const [whatsappGroup, setWhatsappGroup] = useState(profile?.whatsappGroup || '');
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || '');

  // Avatar UI states
  const [showPresets, setShowPresets] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File chosen from camera / gallery
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateAvatarFile(file);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'الملف المختار غير صالح.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setErrorMessage(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      if (src) {
        setCropImageSrc(src);
      }
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // On Crop & Compress Complete
  const handleCropComplete = async (result: {
    fullDataUrl: string;
    thumbDataUrl: string;
    fullSizeKb: number;
    thumbSizeKb: number;
  }) => {
    if (!profile) return;
    try {
      setIsUploadingAvatar(true);
      await saveUserAvatar(profile.uid, result.fullDataUrl, result.thumbDataUrl);
      setPhotoURL(result.thumbDataUrl);
      await refreshProfile();
    } catch (err: any) {
      console.error('[EditProfileModal] Save avatar error:', err);
      setErrorMessage(err.message || 'فشل حفظ الصورة، يرجى المحاولة ثانية.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Choose preset avatar
  const handleSelectPreset = async (presetId: string) => {
    if (!profile) return;
    const avatarKey = presetId.startsWith('preset:') ? presetId : `preset:${presetId}`;
    try {
      setIsUploadingAvatar(true);
      await saveUserAvatar(profile.uid, avatarKey, avatarKey);
      setPhotoURL(avatarKey);
      await refreshProfile();
      setShowPresets(false);
    } catch (err: any) {
      console.error('[EditProfileModal] Select preset error:', err);
      setErrorMessage(err.message || 'فشل حفظ الأفاتار.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Use Google Photo
  const handleUseGooglePhoto = async () => {
    if (!profile || !user?.photoURL) return;
    try {
      setIsUploadingAvatar(true);
      await saveUserAvatar(profile.uid, user.photoURL, user.photoURL);
      setPhotoURL(user.photoURL);
      await refreshProfile();
    } catch (err: any) {
      console.error('[EditProfileModal] Set Google photo error:', err);
      setErrorMessage(err.message || 'تعذر استخدام صورة Google.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Remove photo (revert to initial letter)
  const handleRemovePhoto = async () => {
    if (!profile) return;
    try {
      setIsUploadingAvatar(true);
      await removeUserAvatar(profile.uid);
      setPhotoURL('');
      await refreshProfile();
    } catch (err: any) {
      console.error('[EditProfileModal] Remove photo error:', err);
      setErrorMessage(err.message || 'فشل حذف الصورة.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!displayName.trim()) {
      setErrorMessage('يرجى إدخال اسم العرض.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const parsedAge = age ? parseInt(age, 10) : undefined;

      await updateUserProfile(profile.uid, {
        displayName: displayName.trim(),
        branch,
        city: city || undefined,
        age: isNaN(Number(parsedAge)) ? undefined : parsedAge,
        whatsappGroup: whatsappGroup.trim() || undefined,
        photoURL,
      });

      await refreshProfile();
      onClose();
    } catch (err: unknown) {
      console.error('Error updating profile:', err);
      const msg = err instanceof Error ? err.message : 'فشل تحديث البيانات. يرجى المحاولة مجدداً.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 overflow-y-auto animate-fadeIn">
        <div 
          id="edit-profile-dialog"
          className="w-full max-w-lg bg-white dark:bg-[#111625] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-slate-900 dark:text-slate-100 my-8 transition-colors max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
            <h3 className="font-bold text-lg">تعديل الملف الشخصي</h3>
            <button
              onClick={onClose}
              aria-label="إغلاق النافذة"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Avatar Management Card */}
          <div className="mb-6 p-4 rounded-2xl bg-slate-50 dark:bg-[#141b2d] border border-slate-200/80 dark:border-slate-800/80 space-y-3">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <UserAvatar
                  avatar={photoURL}
                  name={displayName || profile?.displayName}
                  size="lg"
                />
                {isUploadingAvatar && (
                  <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">صورة الحساب الرمزية</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  صورة مجانية ومضغوطة تلقائيًا داخل المنصة دون أي رسوم أو روابط خارجية.
                </p>
              </div>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Avatar Action Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
                className="py-2 px-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>رفع صورة</span>
              </button>

              <button
                type="button"
                onClick={() => setShowPresets(!showPresets)}
                disabled={isUploadingAvatar}
                className="py-2 px-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>أفاتار جاهز</span>
              </button>

              {user?.photoURL && (
                <button
                  type="button"
                  onClick={handleUseGooglePhoto}
                  disabled={isUploadingAvatar}
                  className="py-2 px-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Globe className="w-3.5 h-3.5 text-blue-500" />
                  <span>صورة Google</span>
                </button>
              )}

              {photoURL && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  disabled={isUploadingAvatar}
                  className="py-2 px-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/40 hover:bg-rose-200 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>إزالة الصورة</span>
                </button>
              )}
            </div>

            {/* 16 SVG Presets Grid */}
            {showPresets && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 animate-fadeIn space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>اختر من بين 16 شخصية رمزية جاهزة:</span>
                  <button
                    type="button"
                    onClick={() => setShowPresets(false)}
                    className="text-blue-600 hover:underline cursor-pointer"
                  >
                    إغلاق
                  </button>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 max-h-40 overflow-y-auto p-1">
                  {PRESET_AVATARS.map((p) => {
                    const isSelected = photoURL === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectPreset(p.id)}
                        className={`p-1 rounded-xl border-2 transition-all cursor-pointer flex flex-col items-center gap-1 ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 scale-105 shadow-xs'
                            : 'border-slate-200 dark:border-slate-800 hover:border-blue-400'
                        }`}
                        title={p.name}
                      >
                        <UserAvatar avatar={p.id} size="sm" border={false} />
                        <span className="text-[9px] truncate max-w-full text-slate-600 dark:text-slate-400">
                          {p.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username (Read-only identifier) */}
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-400">
                اسم المستخدم (ثابت)
              </label>
              <div className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-slate-500 font-mono text-sm" dir="ltr">
                @{profile?.username}
              </div>
            </div>

            {/* Display Name */}
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                الاسم الظاهر
              </label>
              <div className="relative">
                <input
                  id="edit-display-name-input"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full pl-3 pr-9 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <User className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
              </div>
            </div>

            {/* Academic Branch Selection */}
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                الفرع الدراسي (توجيهي 2009)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBranch('علمي')}
                  className={`py-2 px-3 rounded-xl border-2 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    branch === 'علمي'
                      ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <span>الفرع العلمي</span>
                  {branch === 'علمي' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </button>
                <button
                  type="button"
                  onClick={() => setBranch('أدبي')}
                  className={`py-2 px-3 rounded-xl border-2 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    branch === 'أدبي'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <span>الفرع الأدبي</span>
                  {branch === 'أدبي' && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                </button>
              </div>
            </div>

            {/* City */}
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                المحافظة
              </label>
              <div className="relative">
                <select
                  id="edit-city-select"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full pl-3 pr-9 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {CITIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <MapPin className="w-4 h-4 absolute right-3 top-2.5 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Age */}
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                العمر
              </label>
              <div className="relative">
                <input
                  id="edit-age-input"
                  type="number"
                  min={14}
                  max={25}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full pl-3 pr-9 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Calendar className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
              </div>
            </div>

            {/* WhatsApp Group */}
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                اسم أو رمز مجموعة واتساب
              </label>
              <div className="relative">
                <input
                  id="edit-whatsapp-input"
                  type="text"
                  value={whatsappGroup}
                  onChange={(e) => setWhatsappGroup(e.target.value)}
                  placeholder="مجموعة توجيهي 2009"
                  className="w-full pl-3 pr-9 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <MessageCircle className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
              </div>
            </div>

            {/* Buttons */}
            <div className="pt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                id="save-profile-btn"
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-75"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>جارٍ الحفظ...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>حفظ التعديلات</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Avatar Crop & Compress Modal */}
      {cropImageSrc && (
        <AvatarCropModal
          imageSrc={cropImageSrc}
          onClose={() => setCropImageSrc(null)}
          onCropComplete={handleCropComplete}
        />
      )}
    </>
  );
};
