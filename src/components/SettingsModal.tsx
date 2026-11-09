import React, { useState, useEffect } from 'react';
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
  Code,
  KeyRound,
  Eye,
  EyeOff,
  Smartphone,
  Download,
  Share2,
  ExternalLink,
  Copy
} from 'lucide-react';
import { DailyGoals } from './DailyGoals';
import { getFriendsList } from '../lib/friendService';
import { updateStudentBranch } from '../lib/firebase';
import { fetchCommunitySettings } from '../lib/communityService';
import { usePWAInstall } from '../hooks/usePWAInstall';
import type { FriendItem, CommunitySettings } from '../types';

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
  initialSubView?: 'main' | 'privacy' | 'about' | 'goals' | 'friends' | 'developer' | 'security' | 'support';
  onClose: () => void;
  onOpenTutorial?: () => void;
  onOpenAdmin?: () => void;
  onOpenChatWithUser?: (user: { uid: string; displayName: string; username: string; photoURL?: string; branch?: string }) => void;
  onSelectUser?: (userId: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  initialSubView,
  onClose, 
  onOpenTutorial,
  onOpenAdmin,
  onOpenChatWithUser,
  onSelectUser,
}) => {
  const { user, profile, signOut, refreshProfile, hasPasswordProvider, isGoogleUser, linkPassword, sendPasswordReset } = useAuth();
  const { theme, setTheme } = useTheme();
  const { isAdmin } = useAdmin();

  const [activeSubView, setActiveSubView] = useState<'main' | 'privacy' | 'about' | 'goals' | 'friends' | 'developer' | 'security' | 'support' | 'install'>(initialSubView || 'main');
  const [selectedLanguage, setSelectedLanguage] = useState<'ar' | 'en'>('ar');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [isSwitchingBranch, setIsSwitchingBranch] = useState(false);
  const [communitySettings, setCommunitySettings] = useState<CommunitySettings | null>(null);

  // PWA Install hook and helpers
  const { isInstallable, isInstalled, isIOS, isInAppBrowser, triggerInstall } = usePWAInstall();
  const [pwaInstallSuccess, setPwaInstallSuccess] = useState<string | null>(null);
  const [pwaCopied, setPwaCopied] = useState<boolean>(false);

  // Security & Password states
  const [securityPassword, setSecurityPassword] = useState('');
  const [securityConfirmPassword, setSecurityConfirmPassword] = useState('');
  const [showSecurityPassword, setShowSecurityPassword] = useState(false);
  const [isSavingSecurityPassword, setIsSavingSecurityPassword] = useState(false);
  const [securitySuccess, setSecuritySuccess] = useState<string | null>(null);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [isSendingResetEmail, setIsSendingResetEmail] = useState(false);

  // Support & Complaint states
  const [supportCategory, setSupportCategory] = useState<'complaint' | 'support' | 'suggestion'>('support');
  const [supportReason, setSupportReason] = useState('');
  const [supportDescription, setSupportDescription] = useState('');
  const [isSubmittingSupport, setIsSubmittingSupport] = useState(false);
  const [supportSuccess, setSupportSuccess] = useState<string | null>(null);
  const [supportError, setSupportError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetchCommunitySettings().then((res) => {
      if (isMounted) setCommunitySettings(res);
    });
    return () => {
      isMounted = false;
    };
  }, []);

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
              {activeSubView === 'security' && 'أمان الحساب وكلمة المرور'}
              {activeSubView === 'privacy' && 'سياسة الخصوصية'}
              {activeSubView === 'about' && 'حول منصة Arixon'}
              {activeSubView === 'goals' && 'المهام والتذكيرات الدراسية'}
              {activeSubView === 'friends' && 'قائمة أصدقائي'}
              {activeSubView === 'developer' && 'خيارات المطور'}
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

              {/* PWA App Install Button */}
              <button
                id="open-pwa-install-btn"
                type="button"
                onClick={() => {
                  if (isInstallable) {
                    triggerInstall();
                  } else {
                    setActiveSubView('install');
                  }
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-sm font-semibold cursor-pointer"
              >
                <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                  <Smartphone className="w-4 h-4 text-purple-500" />
                  <span>تثبيت تطبيق Arixon على جهازك</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {isInstalled ? (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-400 px-2.5 py-0.5 rounded-full font-bold">
                      مثبّت ✅
                    </span>
                  ) : (
                    <span className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-400 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <Download className="w-3 h-3" />
                      تثبيت
                    </span>
                  )}
                  <ChevronLeft className="w-4 h-4 text-slate-400" />
                </div>
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
                id="open-security-settings-btn"
                onClick={() => {
                  setSecurityError(null);
                  setSecuritySuccess(null);
                  setActiveSubView('security');
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-sm font-semibold cursor-pointer"
              >
                <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                  <KeyRound className="w-4 h-4 text-amber-500" />
                  <span>أمان الحساب وكلمة المرور</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {!hasPasswordProvider && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-400 px-2 py-0.5 rounded-full font-bold">
                      عيّن كلمة سر
                    </span>
                  )}
                  <ChevronLeft className="w-4 h-4 text-slate-400" />
                </div>
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
                id="open-support-complaint-btn"
                onClick={() => {
                  setSupportError(null);
                  setSupportSuccess(null);
                  setActiveSubView('support');
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-sm font-semibold cursor-pointer"
              >
                <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                  <MessageSquare className="w-4 h-4 text-teal-500" />
                  <span>الشكاوى، الدعم الفني والاقتراحات</span>
                </div>
                <ChevronLeft className="w-4 h-4 text-slate-400" />
              </button>

              <button
                id="open-developer-options-btn"
                onClick={() => setActiveSubView('developer')}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-sm font-semibold cursor-pointer"
              >
                <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                  <Code className="w-4 h-4 text-emerald-500" />
                  <span>خيارات المطور</span>
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

            {/* Student WhatsApp Community Card */}
            {communitySettings?.enabled && communitySettings?.whatsappUrl && (
              <div 
                id="whatsapp-community-card"
                className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/15 border border-emerald-500/30 flex items-center justify-between gap-3 shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                    <WhatsAppIcon className="w-5 h-5 fill-current" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                      انضم لمجتمع توجيهي 2009 على واتساب
                    </h4>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                      {communitySettings.label || 'Arixon | مجتمع توجيهي 2009'}
                    </p>
                  </div>
                </div>
                <a
                  id="join-whatsapp-community-btn"
                  href={communitySettings.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-black shrink-0 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <WhatsAppIcon className="w-3.5 h-3.5 fill-current" />
                  <span>انضمام</span>
                </a>
              </div>
            )}

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

        {/* SUB-VIEW: Security & Password */}
        {activeSubView === 'security' && (
          <div className="space-y-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {/* Account Info Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">البريد الإلكتروني المرتبط:</span>
                <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200" dir="ltr">
                  {user?.email || profile?.email || 'غير متوفر'}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">طرق تسجيل الدخول:</span>
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40">
                    <svg className="w-3 h-3 bg-white rounded-full p-0.5 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    Google
                  </span>

                  {hasPasswordProvider ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40">
                      <Check className="w-3 h-3" />
                      كلمة مرور مفعّلة
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40">
                      جوجل فقط
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Success alert */}
            {securitySuccess && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-xs flex items-start gap-2 animate-fadeIn">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-semibold">{securitySuccess}</span>
              </div>
            )}

            {/* Error alert */}
            {securityError && (
              <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs flex items-start gap-2 animate-shake">
                <Shield className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-semibold">{securityError}</span>
              </div>
            )}

            {/* Password Set / Update Form */}
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-blue-500" />
                  <span>{hasPasswordProvider ? 'تغيير كلمة المرور' : 'تعيين كلمة سر لحسابك'}</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {hasPasswordProvider 
                    ? 'يمكنك تحديث كلمة المرور الخاصة بحسابك في أي وقت.' 
                    : 'يتيح لك تعيين كلمة المرور إمكانية الدخول بالبريد الإلكتروني مباشرة دون الحاجة للضغط على زر Google لاحقاً.'}
                </p>
              </div>

              <div className="space-y-2.5 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    كلمة المرور الجديدة (6 خانات أو أكثر)
                  </label>
                  <div className="relative">
                    <input
                      id="security-new-password-input"
                      type={showSecurityPassword ? 'text' : 'password'}
                      dir="ltr"
                      placeholder="••••••••"
                      value={securityPassword}
                      onChange={(e) => {
                        setSecurityPassword(e.target.value);
                        setSecurityError(null);
                      }}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#182032] text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecurityPassword(!showSecurityPassword)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showSecurityPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    تأكيد كلمة المرور الجديدة
                  </label>
                  <input
                    id="security-confirm-password-input"
                    type={showSecurityPassword ? 'text' : 'password'}
                    dir="ltr"
                    placeholder="••••••••"
                    value={securityConfirmPassword}
                    onChange={(e) => {
                      setSecurityConfirmPassword(e.target.value);
                      setSecurityError(null);
                    }}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#182032] text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  id="save-security-password-btn"
                  type="button"
                  disabled={isSavingSecurityPassword || !securityPassword.trim()}
                  onClick={async () => {
                    const clean = securityPassword.trim();
                    if (!clean || clean.length < 6) {
                      setSecurityError('يجب أن تتكون كلمة المرور من 6 خانات أو أحرف على الأقل.');
                      return;
                    }
                    if (clean !== securityConfirmPassword.trim()) {
                      setSecurityError('كلمتا المرور غير متطابقتين.');
                      return;
                    }
                    try {
                      setIsSavingSecurityPassword(true);
                      setSecurityError(null);
                      setSecuritySuccess(null);
                      await linkPassword(clean);
                      setSecuritySuccess('تم حفظ كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول إما عبر Google أو بالبريد وكلمة المرور في أي وقت.');
                      setSecurityPassword('');
                      setSecurityConfirmPassword('');
                    } catch (err: any) {
                      setSecurityError(err.message || 'تعذر حفظ كلمة المرور، يرجى المحاولة لاحقاً.');
                    } finally {
                      setIsSavingSecurityPassword(false);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSavingSecurityPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جارٍ الحفظ والربط...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{hasPasswordProvider ? 'تحديث كلمة المرور' : 'حفظ كلمة المرور للحساب'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Send Reset Email Option */}
            {user?.email && (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">إعادة تعيين كلمة المرور عبر الإيميل</span>
                  <span className="text-slate-400 text-[11px]">سنرسل لك رابطاً مباشراً لبريدك لإعادة تعيين كلمة المرور</span>
                </div>
                <button
                  type="button"
                  disabled={isSendingResetEmail}
                  onClick={async () => {
                    try {
                      setIsSendingResetEmail(true);
                      await sendPasswordReset(user.email!);
                      setSecuritySuccess(`تم إرسال رابط تعيين كلمة المرور إلى: ${user.email}`);
                    } catch (err) {
                      setSecurityError('تعذر إرسال الرابط، يرجى المحاولة لاحقاً.');
                    } finally {
                      setIsSendingResetEmail(false);
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all shrink-0 cursor-pointer disabled:opacity-50"
                >
                  {isSendingResetEmail ? 'جارٍ الإرسال...' : 'إرسال الرابط'}
                </button>
              </div>
            )}

            <button
              onClick={() => setActiveSubView('main')}
              className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer mt-2"
            >
              العودة للإعدادات
            </button>
          </div>
        )}

        {/* Support, Complaints & Suggestions SubView */}
        {activeSubView === 'support' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setActiveSubView('main')}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              >
                <ChevronLeft className="w-5 h-5 rotate-180" />
              </button>
              <h3 className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-teal-500" />
                <span>الشكاوى، الدعم الفني والاقتراحات</span>
              </h3>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              يسعدنا سماع صوتك. سيصل طلبك مباشرة إلى فريق الإشراف والدعم، وسيتم الرد عليك رسميًا عبر الإشعارات.
            </p>

            {supportError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                {supportError}
              </div>
            )}

            {supportSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300">
                {supportSuccess}
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!supportReason.trim()) {
                  setSupportError('يرجى كتابة عنوان أو سبب للطلب.');
                  return;
                }
                setIsSubmittingSupport(true);
                setSupportError(null);
                setSupportSuccess(null);
                try {
                  const token = await user?.getIdToken();
                  const res = await fetch('/api/reports', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                      action: 'createReport',
                      category: supportCategory,
                      type: supportCategory,
                      targetType: 'system',
                      reason: supportReason.trim(),
                      description: supportDescription.trim() || undefined,
                    }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || 'فشل إرسال الطلب.');
                  setSupportSuccess(
                    `تم إرسال طلبك بنجاح برقم مرجعي (#${data.reportId?.substring(0, 8)}). سيقوم فريق الإشراف بمراجعته وإشعارك بالرد فورًا.`
                  );
                  setSupportReason('');
                  setSupportDescription('');
                } catch (err: any) {
                  setSupportError(err.message || 'فشل إرسال الطلب.');
                } finally {
                  setIsSubmittingSupport(false);
                }
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  نوع الطلب:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'support', label: 'دعم فني', icon: '🎧' },
                    { id: 'complaint', label: 'شكوى / خطأ', icon: '⚠️' },
                    { id: 'suggestion', label: 'اقتراح تطوير', icon: '💡' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSupportCategory(cat.id as any)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                        supportCategory === cat.id
                          ? 'border-teal-500 bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <span className="text-base">{cat.icon}</span>
                      <span>{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  عنوان الطلب أو المشكلة:
                </label>
                <input
                  type="text"
                  required
                  value={supportReason}
                  onChange={(e) => setSupportReason(e.target.value)}
                  placeholder="مثال: صعوبة في فتح امتحان اللغة العربية أو استفسار"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  التفاصيل والشرح (اختياري):
                </label>
                <textarea
                  rows={4}
                  value={supportDescription}
                  onChange={(e) => setSupportDescription(e.target.value)}
                  placeholder="اكتب أي تفاصيل توضيحية تساعد فريق الدعم والمشرفين..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingSupport}
                className="w-full py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmittingSupport ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جارٍ الإرسال...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>إرسال الطلب للمشرفين</span>
                  </>
                )}
              </button>
            </form>

            <button
              type="button"
              onClick={() => setActiveSubView('main')}
              className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer mt-1"
            >
              العودة للإعدادات
            </button>
          </div>
        )}

        {/* SUB-VIEW: PWA Install Guide & Trigger */}
        {activeSubView === 'install' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setActiveSubView('main')}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5 rotate-180" />
              </button>
              <h3 className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-purple-500" />
                <span>تثبيت تطبيق Arixon على جهازك</span>
              </h3>
            </div>

            {/* If Already Installed */}
            {isInstalled ? (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2 text-center">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 flex items-center justify-center mx-auto">
                  <Check className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-emerald-900 dark:text-emerald-200">
                  التطبيق مثبّت بنجاح على جهازك ✅
                </h4>
                <p className="text-xs text-emerald-800/80 dark:text-emerald-300 leading-relaxed">
                  أنت تستخدم المنصة كتطبيق مثبت (PWA). يمكنك تشغيله في أي وقت مباشرة من شاشتك الرئيسية للحصول على أقصى سرعة وأداء مستقر.
                </p>
              </div>
            ) : isInAppBrowser ? (
              /* In-App Browser Warning */
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-3">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs">
                  <Info className="w-4 h-4 text-amber-600" />
                  <span>تنبيه: متصفح داخلي (تطبيق وسائط)</span>
                </div>
                <p className="text-xs text-amber-900/80 dark:text-amber-200/90 leading-relaxed">
                  أنت تتصفح أريكسون حالياً من داخل متصفح تطبيق مثل (Instagram أو TikTok أو WhatsApp). هذه المتصفحات تمنع تثبيت التطبيقات وحفظ الجلسات تلقائياً.
                </p>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900 text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                  <p className="font-bold">الحل السريع:</p>
                  <p>1. اضغط على أيقونة النقاط الثلاث (⋮) أو (···) أعلى أو أسفل الشاشة.</p>
                  <p>2. اختر "فتح في Chrome" أو "فتح في Safari".</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(window.location.origin);
                      setPwaCopied(true);
                      setTimeout(() => setPwaCopied(false), 2500);
                    }
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{pwaCopied ? 'تم نسخ الرابط بنجاح!' : 'نسخ رابط المنصة'}</span>
                </button>
              </div>
            ) : isIOS ? (
              /* iOS Safari Guide */
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-xs">
                  <Share2 className="w-4 h-4 text-blue-500" />
                  <span>طريقة التثبيت على أجهزة iPhone و iPad (Safari):</span>
                </div>
                <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-100 dark:border-slate-800">
                    <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 font-bold text-[11px] flex items-center justify-center shrink-0">1</span>
                    <span>اضغط على زر <strong>المشاركة (Share ⎋)</strong> في أسفل شاشة متصفح Safari.</span>
                  </div>
                  <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-100 dark:border-slate-800">
                    <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 font-bold text-[11px] flex items-center justify-center shrink-0">2</span>
                    <span>مرر القائمة لأسفل واختر <strong>"إضافة إلى الشاشة الرئيسية" (Add to Home Screen ⊞)</strong>.</span>
                  </div>
                  <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-100 dark:border-slate-800">
                    <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 font-bold text-[11px] flex items-center justify-center shrink-0">3</span>
                    <span>اضغط <strong>"إضافة" (Add)</strong> في أعلى الزاوية ليظهر تطبيق Arixon مباشرة بجانب تطبيقاتك.</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Android / Desktop Install */
              <div className="p-4 rounded-2xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-900/50 space-y-3">
                <div className="text-center space-y-1">
                  <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 flex items-center justify-center mx-auto mb-2">
                    <Download className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    تثبيت تطبيق Arixon الآن
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    احصل على تجربة سريعة وخفيفة بحجم أقل من 1 ميجابايت مع شاشة كاملة وتنبيهات دراسية.
                  </p>
                </div>

                {isInstallable ? (
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await triggerInstall();
                      if (res === 'accepted') {
                        setPwaInstallSuccess('تم بدء تثبيت التطبيق بنجاح!');
                      }
                    }}
                    className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-purple-500/20 cursor-pointer active:scale-[0.98]"
                  >
                    <Download className="w-4 h-4" />
                    <span>تثبيت التطبيق على هاتفك</span>
                  </button>
                ) : (
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-1 text-center">
                    <p className="font-semibold">إذا لم يظهر زر التثبيت المباشر:</p>
                    <p className="text-[11px] text-slate-400">
                      اضغط على قائمة المتصفح (⋮) في أعلى زاوية الشاشة، ثم اختر <strong>"تثبيت التطبيق"</strong> أو <strong>"إضافة إلى الشاشة الرئيسية"</strong>.
                    </p>
                  </div>
                )}

                {pwaInstallSuccess && (
                  <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800 text-xs text-center font-bold">
                    {pwaInstallSuccess}
                  </div>
                )}
              </div>
            )}

            {/* Features of App */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs">
              <span className="font-bold text-slate-800 dark:text-slate-200 block">مميزات تثبيت تطبيق أريكسون:</span>
              <ul className="space-y-1.5 text-slate-600 dark:text-slate-400 text-[11px]">
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>شاشة كاملة مريحة للعين بدون أشرطة المتصفح المزدحمة.</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>سرعة استجابة أعلى وتخزين مؤقت ذكي لواجهة الامتحانات.</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>تنبيهات فورية بجديد الامتحانات الوزارية والتحديات التنافسية.</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => setActiveSubView('main')}
              className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer mt-1"
            >
              العودة للإعدادات
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
