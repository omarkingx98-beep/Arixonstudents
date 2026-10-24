import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useAdmin } from '../context/AdminContext';
import { 
  X, 
  Sun, 
  Moon, 
  Languages, 
  LogOut, 
  ShieldCheck, 
  Info, 
  Check, 
  ChevronLeft,
  Lock,
  Sparkles,
  Loader2,
  Shield,
  CheckSquare,
  Users,
  MessageSquare,
  GraduationCap,
} from 'lucide-react';
import { DailyGoals } from './DailyGoals';
import { getFriendsList } from '../lib/friendService';
import { updateStudentBranch } from '../lib/firebase';
import type { FriendItem } from '../types';

const WhatsAppIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4 fill-current' }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.311.045-.698.077-1.114-.055-.417-.132-.977-.321-1.688-.636-1.503-.666-2.502-2.186-2.58-2.288-.077-.101-.611-.813-.611-1.55 0-.737.387-1.1.524-1.25.137-.15.3-.188.4-.188.1 0 .201.002.288.006.094.004.22-.036.344.263.128.31.439 1.072.477 1.15.038.077.064.168.013.27-.051.101-.077.164-.153.253-.077.089-.161.198-.231.266-.077.076-.157.159-.068.312.089.153.396.654.85 1.058.584.521 1.077.682 1.23.759.153.076.242.064.332-.038.09-.102.383-.446.485-.599.102-.153.204-.127.344-.076.14.051.892.42 1.045.497.153.076.255.114.293.178.038.064.038.369-.106.774zM12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.98-1.306A9.957 9.957 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/>
  </svg>
);

const InstagramIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4 fill-current' }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

interface SettingsModalProps {
  onClose: () => void;
  onOpenTutorial?: () => void;
  onOpenAdmin?: () => void;
  onOpenChatWithUser?: (user: { uid: string; displayName: string; username: string; photoURL?: string; branch?: string }) => void;
  onSelectUser?: (userId: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  onClose, 
  onOpenTutorial,
  onOpenAdmin,
  onOpenChatWithUser,
  onSelectUser,
}) => {
  const { profile, signOut, refreshProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const { isAdmin } = useAdmin();

  const [activeSubView, setActiveSubView] = useState<'main' | 'privacy' | 'about' | 'goals' | 'friends' | 'developer'>('main');
  const [selectedLanguage, setSelectedLanguage] = useState<'ar' | 'en'>('ar');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [isSwitchingBranch, setIsSwitchingBranch] = useState(false);

  const handleBranchSwitch = async (newBranch: 'علمي' | 'أدبي') => {
    if (!profile?.uid || isSwitchingBranch || profile.branch === newBranch) return;
    try {
      setIsSwitchingBranch(true);
      await updateStudentBranch(profile.uid, newBranch);
      await refreshProfile();
    } catch (err: any) {
      console.warn('Error updating branch in settings:', err);
    } finally {
      setIsSwitchingBranch(false);
    }
  };

  const loadFriends = async () => {
    if (!profile?.uid) return;
    setIsLoadingFriends(true);
    try {
      const list = await getFriendsList(profile.uid);
      setFriends(list);
    } catch (err) {
      console.warn('Error loading friends in settings:', err);
    } finally {
      setIsLoadingFriends(false);
    }
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await signOut();
      onClose();
    } catch (err) {
      console.error(err);
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 overflow-y-auto">
      <div 
        id="settings-dialog-card"
        className="w-full max-w-lg bg-white dark:bg-[#111625] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-slate-900 dark:text-slate-100 my-8 transition-all max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800 mb-4 sticky top-0 bg-white dark:bg-[#111625] z-10">
          <div className="flex items-center gap-2">
            {activeSubView !== 'main' && (
              <button
                onClick={() => setActiveSubView('main')}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5 rotate-180" />
              </button>
            )}
            <h3 className="font-bold text-lg">
              {activeSubView === 'main' && 'الإعدادات'}
              {activeSubView === 'privacy' && 'سياسة الخصوصية'}
              {activeSubView === 'about' && 'حول منصة Arixon'}
              {activeSubView === 'goals' && 'المهام والتذكيرات الدراسية'}
              {activeSubView === 'friends' && 'قائمة أصدقائي'}
              {activeSubView === 'developer' && 'تواصل مع المطور (عمر شراب)'}
            </h3>
          </div>

          <button
            onClick={onClose}
            aria-label="إغلاق الإعدادات"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MAIN VIEW */}
        {activeSubView === 'main' && (
          <div className="space-y-5">
            {/* Appearance Section */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                المظهر (Theme)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  id="theme-light-btn"
                  onClick={() => setTheme('light')}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border text-sm font-bold transition-all cursor-pointer ${
                    theme === 'light'
                      ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                  }`}
                >
                  <Sun className="w-4 h-4 text-amber-500" />
                  <span>فاتح (Theme A)</span>
                  {theme === 'light' && <Check className="w-3.5 h-3.5" />}
                </button>

                <button
                  id="theme-dark-btn"
                  onClick={() => setTheme('dark')}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border text-sm font-bold transition-all cursor-pointer ${
                    theme === 'dark'
                      ? 'border-blue-500 bg-slate-800 text-blue-400 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                  }`}
                >
                  <Moon className="w-4 h-4 text-indigo-400" />
                  <span>داكن (Theme B)</span>
                  {theme === 'dark' && <Check className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Language Section */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                اللغة (Language)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  id="lang-ar-btn"
                  onClick={() => setSelectedLanguage('ar')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl border text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    selectedLanguage === 'ar'
                      ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <span>العربية (الأساسية)</span>
                  {selectedLanguage === 'ar' && <Check className="w-3.5 h-3.5" />}
                </button>

                <button
                  id="lang-en-btn"
                  onClick={() => setSelectedLanguage('en')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl border text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    selectedLanguage === 'en'
                      ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <span>English</span>
                  {selectedLanguage === 'en' && <Check className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                الواجهة مهيأة هيكلياً بالكامل للغتين، واللغة العربية هي المعتمدة رسمياً لمناهج التوجيهي.
              </p>
            </div>

            {/* Academic Branch Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                  الفرع الأكاديمي (توجيهي 2009)
                </label>
                {isSwitchingBranch && (
                  <span className="text-[11px] text-blue-500 font-bold flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    جارٍ الحفظ...
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  id="settings-branch-sci-btn"
                  type="button"
                  onClick={() => handleBranchSwitch('علمي')}
                  disabled={isSwitchingBranch}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl border text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    (profile?.branch || 'علمي') === 'علمي'
                      ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <GraduationCap className="w-4 h-4 text-blue-500" />
                  <span>الفرع العلمي</span>
                  {(profile?.branch || 'علمي') === 'علمي' && <Check className="w-3.5 h-3.5" />}
                </button>

                <button
                  id="settings-branch-lit-btn"
                  type="button"
                  onClick={() => handleBranchSwitch('أدبي')}
                  disabled={isSwitchingBranch}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl border text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    profile?.branch === 'أدبي'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <GraduationCap className="w-4 h-4 text-indigo-500" />
                  <span>الفرع الأدبي</span>
                  {profile?.branch === 'أدبي' && <Check className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                تحديد فرعك يخصص الامتحانات وبنك الأسئلة ولوحة الشرف تلقائياً بما يلائم مسارك الوزاري.
              </p>
            </div>

            {/* Links to Privacy & About */}
            <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-slate-800">
              {onOpenTutorial && (
                <button
                  id="open-tutorial-from-settings-btn"
                  onClick={() => {
                    onClose();
                    onOpenTutorial();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-blue-50/70 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 transition-colors text-sm font-semibold cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-4 h-4 text-blue-500" />
                    <span>دليل منصة أريكسون والجولة التفاعلية</span>
                  </div>
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}

              <button
                id="open-friends-btn"
                onClick={() => {
                  loadFriends();
                  setActiveSubView('friends');
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-sm font-semibold cursor-pointer"
              >
                <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                  <Users className="w-4 h-4 text-emerald-500" />
                  <span>قائمة أصدقائي على أريكسون</span>
                </div>
                <ChevronLeft className="w-4 h-4 text-slate-400" />
              </button>

              <button
                id="open-daily-goals-btn"
                onClick={() => setActiveSubView('goals')}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-sm font-semibold cursor-pointer"
              >
                <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                  <CheckSquare className="w-4 h-4 text-blue-500" />
                  <span>المهام والتذكيرات الدراسية</span>
                </div>
                <ChevronLeft className="w-4 h-4 text-slate-400" />
              </button>

              <button
                id="open-privacy-policy-btn"
                onClick={() => setActiveSubView('privacy')}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-sm font-semibold cursor-pointer"
              >
                <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>سياسة الخصوصية وحماية البيانات</span>
                </div>
                <ChevronLeft className="w-4 h-4 text-slate-400" />
              </button>

              <button
                id="open-developer-contact-btn"
                onClick={() => setActiveSubView('developer')}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-sm font-semibold cursor-pointer"
              >
                <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                  <div className="w-5 h-5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                    ع
                  </div>
                  <div className="text-right">
                    <span>تواصل مع المطور (عمر شراب)</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-normal">واتساب وإنستغرام مباشر</span>
                  </div>
                </div>
                <ChevronLeft className="w-4 h-4 text-slate-400" />
              </button>

              <button
                id="open-about-arixon-btn"
                onClick={() => setActiveSubView('about')}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-sm font-semibold cursor-pointer"
              >
                <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                  <Info className="w-4 h-4 text-blue-500" />
                  <span>حول منصة Arixon وتوجيهي 2009</span>
                </div>
                <ChevronLeft className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* Developer Direct Contact Card */}
            <div 
              id="developer-contact-card"
              className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-500/30 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center font-extrabold text-sm shadow-md shadow-emerald-500/20">
                    ع
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>عمر شراب</span>
                      <span className="text-[10px] font-normal text-slate-500 font-mono">(Omar Sharab)</span>
                    </h4>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                      مطور ومنشئ منصة Arixon
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  خيار المطور
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                هل لديك سؤال، اقتراح، أو واجهت مشكلة؟ اضغط للتواصل معي مباشرة:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                <a
                  id="whatsapp-chat-link"
                  href="https://wa.me/972594399472"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold text-xs transition-all shadow-sm shadow-emerald-600/20 cursor-pointer"
                >
                  <WhatsAppIcon className="w-4 h-4 fill-current" />
                  <span>محادثة واتساب (+972)</span>
                </a>

                <a
                  id="instagram-profile-link"
                  href="https://instagram.com/omarhamed.9"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 active:scale-[0.98] text-white font-bold text-xs transition-all shadow-sm shadow-pink-600/20 cursor-pointer"
                >
                  <InstagramIcon className="w-4 h-4 fill-current" />
                  <span>إنستغرام (@omarhamed.9)</span>
                </a>
              </div>
            </div>

            {/* Admin Portal Shortcut if current user is an Admin */}
            {isAdmin && onOpenAdmin && (
              <div className="pt-1">
                <button
                  id="open-admin-from-settings-btn"
                  onClick={() => {
                    onClose();
                    onOpenAdmin();
                  }}
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-sm font-bold transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-5 h-5 text-amber-500" />
                    <span>لوحة التحكم الإدارية (Super Admin)</span>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-amber-500" />
                </button>
              </div>
            )}

            {/* Logout Button */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                id="logout-btn"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-950/70 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 font-bold text-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                {isLoggingOut ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جارٍ تسجيل الخروج...</span>
                  </>
                ) : (
                  <>
                    <LogOut className="w-4 h-4" />
                    <span>تسجيل الخروج من الحساب</span>
                  </>
                )}
              </button>
              <p className="text-[11px] text-center text-slate-400 mt-2">
                بياناتك وملفك الشخصي ونقاطك ستبقى محفوظة بأمان على Firebase لتسجيل دخولك القادم.
              </p>
            </div>
          </div>
        )}

        {/* SUB-VIEW: Privacy Policy */}
        {activeSubView === 'privacy' && (
          <div className="space-y-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900/50 text-blue-800 dark:text-blue-200">
              <div className="flex items-center gap-1.5 font-bold mb-1">
                <Lock className="w-4 h-4 text-blue-600" />
                <span>التزام الخصوصية الصارم في Arixon</span>
              </div>
              <p className="text-xs">
                نحن نعتبر خصوصية الطالب وأمان بياناته أولوية قصوى منذ اليوم الأول.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-slate-900 dark:text-white">1. ما يظهر للعامة ولوحة الصدارة:</h4>
              <p>
                اسم المستخدم (Username)، الاسم المعروض، الصورة الرمزية، والنقاط المكتسبة من الامتحانات فقط.
              </p>

              <h4 className="font-bold text-slate-900 dark:text-white">2. ما يبقى سرياً ومحمياً تماماً:</h4>
              <p>
                البريد الإلكتروني، الجنس (Gender لا يظهر مطلقاً في لوحات الصدارة)، العمر، ورقم أو مجموعة الواتساب. هذه البيانات مرئية لك وحدك في صفحة ملفك الشخصي.
              </p>

              <h4 className="font-bold text-slate-900 dark:text-white">3. أمان السحابة:</h4>
              <p>
                جميع الحسابات محمية بواسطة Firebase Authentication وFirestore Security Rules لضمان عدم إمكانية تعديل بيانات أي طالب من قبل مستخدم آخر.
              </p>
            </div>

            <button
              onClick={() => setActiveSubView('main')}
              className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              العودة للإعدادات
            </button>
          </div>
        )}

        {/* SUB-VIEW: About Arixon */}
        {activeSubView === 'about' && (
          <div className="space-y-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              <h4 className="font-bold text-base text-slate-900 dark:text-white">
                منصة Arixon (أريكسون)
              </h4>
            </div>

            <p>
              Arixon هي منصة تعليمية تنافسية حديثة مصممة خصيصاً لطلبة التوجيهي (جيل 2009). تهدف المنصة إلى تحويل تجربة الدراسة من روتين تقليدي ممل إلى ساحة تحدٍ وتنافس ذكي وممتع.
            </p>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="font-bold text-xs text-slate-900 dark:text-white">
                شعار المنصة:
              </div>
              <div className="text-blue-600 dark:text-blue-400 font-['Plus_Jakarta_Sans',sans-serif] font-bold">
                Learn. Compete. Improve.
              </div>
              <div className="text-xs text-slate-400">
                تعلّم بذكاء • نافس بنزاهة • تطوّر باستمرار
              </div>
            </div>

            <div className="text-xs text-slate-400">
              الإصدار: 1.0 (Phase 1 Foundation) • 2026
            </div>

            <button
              onClick={() => setActiveSubView('main')}
              className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              العودة للإعدادات
            </button>
          </div>
        )}

        {/* SUB-VIEW: Daily Goals & Tasks */}
        {activeSubView === 'goals' && (
          <div className="space-y-4">
            <DailyGoals onNavigateToExams={onClose} />
            <button
              onClick={() => setActiveSubView('main')}
              className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              العودة للإعدادات
            </button>
          </div>
        )}

        {/* SUB-VIEW: Friends List */}
        {activeSubView === 'friends' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                إجمالي الأصدقاء: {friends.length}
              </span>
              <button
                onClick={loadFriends}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
              >
                تحديث
              </button>
            </div>

            {isLoadingFriends && (
              <div className="p-8 text-center text-xs text-slate-400">
                جاري تحميل قائمة الأصدقاء...
              </div>
            )}

            {!isLoadingFriends && friends.length === 0 && (
              <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs space-y-2">
                <Users className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="font-semibold text-slate-700 dark:text-slate-300">
                  لا يوجد أصدقاء في قائمتك حالياً
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  تواصل مع زملائك من خلال الضغط على أسمائهم في جدول الترتيب وإرسال طلبات صداقة لبدء المحادثات التنافسية.
                </p>
              </div>
            )}

            {!isLoadingFriends && friends.length > 0 && (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {friends.map((friend) => (
                  <div
                    key={friend.uid}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div 
                      className="flex items-center gap-2.5 min-w-0 cursor-pointer"
                      onClick={() => {
                        onClose();
                        if (onSelectUser) onSelectUser(friend.uid);
                      }}
                      title="عرض الملف العام"
                    >
                      <img
                        src={friend.photoURL || 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=Arixon1'}
                        alt={friend.displayName}
                        className="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                          {friend.displayName}
                        </div>
                        <div className="text-[10px] text-blue-600 dark:text-blue-400 font-mono" dir="ltr">
                          @{friend.username}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {onOpenChatWithUser && (
                        <button
                          onClick={() => {
                            onClose();
                            onOpenChatWithUser(friend);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                          title="مراسلة خاصة"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>مراسلة</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setActiveSubView('main')}
              className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              العودة للإعدادات
            </button>
          </div>
        )}

        {/* SUB-VIEW: Developer Contact (Omar Sharab) */}
        {activeSubView === 'developer' && (
          <div className="space-y-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-500/30">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center font-black text-lg shadow-md shadow-emerald-500/25">
                  ع
                </div>
                <div>
                  <h4 className="font-extrabold text-base text-slate-900 dark:text-white">
                    عمر شراب (Omar Sharab)
                  </h4>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                    مطور ومؤسس منصة Arixon التعليمية
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                مرحباً بك! تم تطوير المنصة لتوفير أفضل تجربة دراسية وامتحانات تفاعلية لطلبة التوجيهي. يسعدني دائماً استقبال استفساراتك واقتراحاتك لتطوير المنصة.
              </p>
            </div>

            {/* Direct Contact Methods */}
            <div className="space-y-2.5">
              <h5 className="font-bold text-xs text-slate-900 dark:text-white px-1">
                طرق التواصل المباشر:
              </h5>

              {/* WhatsApp Option */}
              <a
                id="developer-view-whatsapp-link"
                href="https://wa.me/972594399472"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-slate-900 dark:text-white transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <WhatsAppIcon className="w-5 h-5 fill-current" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-emerald-950 dark:text-emerald-200">
                      محادثة واتساب (WhatsApp)
                    </div>
                    <div className="text-xs text-emerald-700 dark:text-emerald-400 font-mono" dir="ltr">
                      +972 594 399 472
                    </div>
                  </div>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-emerald-600 text-white shadow-xs group-hover:scale-105 transition-transform">
                  فتح المحادثة
                </span>
              </a>

              {/* Instagram Option */}
              <a
                id="developer-view-instagram-link"
                href="https://instagram.com/omarhamed.9"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-pink-50 dark:bg-pink-950/30 hover:bg-pink-100 dark:hover:bg-pink-950/60 border border-pink-200 dark:border-pink-900/60 text-slate-900 dark:text-white transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-pink-600 to-purple-600 text-white flex items-center justify-center shadow-xs">
                    <InstagramIcon className="w-5 h-5 fill-current" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-pink-950 dark:text-pink-200">
                      حساب الإنستغرام (Instagram)
                    </div>
                    <div className="text-xs text-pink-700 dark:text-pink-400 font-mono" dir="ltr">
                      @omarhamed.9
                    </div>
                  </div>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-xs group-hover:scale-105 transition-transform">
                  زيارة الحساب
                </span>
              </a>
            </div>

            <button
              id="back-from-developer-subview-btn"
              onClick={() => setActiveSubView('main')}
              className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer mt-2"
            >
              العودة للإعدادات
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
