import React from 'react';
import { 
  X, 
  Sparkles, 
  Search, 
  Home, 
  BookOpen, 
  Trophy, 
  User, 
  Settings, 
  Sun, 
  Moon, 
  ShieldCheck, 
  ArrowLeft,
  GraduationCap,
  MessageCircle
} from 'lucide-react';
import { Logo } from './Logo';
import { useAuth } from '../context/AuthContext';
import { useAdmin } from '../context/AdminContext';
import { useTheme } from '../context/ThemeContext';
import type { NavigationTab } from '../types';

interface SideMenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: NavigationTab) => void;
  onOpenTutorial: () => void;
  onOpenUserSearch: () => void;
  onOpenSettings: () => void;
  onOpenAdmin?: () => void;
}

export const SideMenuDrawer: React.FC<SideMenuDrawerProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenTutorial,
  onOpenUserSearch,
  onOpenSettings,
  onOpenAdmin,
}) => {
  const { profile } = useAuth();
  const { isAdmin } = useAdmin();
  const { theme, toggleTheme } = useTheme();

  if (!isOpen) return null;

  const handleTabClick = (tab: NavigationTab) => {
    onClose();
    onNavigate(tab);
  };

  const handleTutorialClick = () => {
    onClose();
    onOpenTutorial();
  };

  const handleSearchClick = () => {
    onClose();
    onOpenUserSearch();
  };

  const handleSettingsClick = () => {
    onClose();
    onOpenSettings();
  };

  const handleAdminClick = () => {
    onClose();
    if (onOpenAdmin) onOpenAdmin();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-start bg-black/60 backdrop-blur-xs animate-fadeIn">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="absolute inset-0"
      />

      {/* Slide Drawer Panel */}
      <div 
        id="side-menu-drawer"
        className="relative w-full max-w-sm bg-white dark:bg-[#0c101c] h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col z-10 overflow-hidden"
      >
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <Logo size="md" />
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="إغلاق القائمة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Mini Card */}
        {profile && (
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#111625]/60 flex items-center gap-3">
            <img
              src={profile.photoURL || '/favicon-192x192.png'}
              alt={profile.username}
              className="w-11 h-11 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-xs"
            />
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {profile.displayName || profile.username}
              </h4>
              <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold truncate">
                @{profile.username} · {profile.branch || 'توجيهي'}
              </p>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* Section: Main Moved Features (E1) */}
          <div className="space-y-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
              الخدمات والميزات السريعة
            </span>

            {/* Feature 1: User Search Button */}
            <button
              id="menu-user-search-btn"
              onClick={handleSearchClick}
              className="w-full p-3.5 rounded-2xl border border-indigo-200/90 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-50/90 via-purple-50/40 to-blue-50/90 dark:from-indigo-950/40 dark:via-purple-950/20 dark:to-blue-950/30 hover:border-indigo-400 flex items-center justify-between gap-3 transition-all cursor-pointer shadow-xs group text-right"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                  <Search className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>البحث عن مستخدم باليوزر</span>
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    ابحث بالمعرف (@username)، أرسل طلبات صداقة ومراسلة
                  </p>
                </div>
              </div>
              <ArrowLeft className="w-4 h-4 text-indigo-500 shrink-0 group-hover:-translate-x-0.5 transition-transform" />
            </button>

            {/* Feature 2: Interactive Platform Guide / Presentation */}
            <button
              id="menu-tutorial-presentation-btn"
              onClick={handleTutorialClick}
              className="w-full p-3.5 rounded-2xl border border-blue-200/90 dark:border-blue-900/60 bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-blue-50/90 dark:from-blue-950/40 dark:via-slate-900/40 dark:to-blue-950/40 hover:border-blue-400 flex items-center justify-between gap-3 transition-all cursor-pointer shadow-xs group text-right"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>العرض التقديمي ودليل المنصة</span>
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    جولة تفاعلية تشرح نظام النقاط، الامتحانات، وفخاخ التغليط
                  </p>
                </div>
              </div>
              <ArrowLeft className="w-4 h-4 text-blue-500 shrink-0 group-hover:-translate-x-0.5 transition-transform" />
            </button>

            {/* Feature 3: Official WhatsApp Community Group */}
            <a
              id="menu-whatsapp-community-btn"
              href="https://chat.whatsapp.com/FQ39q5zXeZq8DJeeuPJNpu"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full p-3.5 rounded-2xl border border-emerald-300/90 dark:border-emerald-800/80 bg-gradient-to-r from-emerald-50/90 via-teal-50/50 to-emerald-50/90 dark:from-emerald-950/40 dark:via-teal-950/20 dark:to-emerald-950/30 hover:border-emerald-500 flex items-center justify-between gap-3 transition-all cursor-pointer shadow-xs group text-right"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>مجتمع واتساب الرسمي</span>
                    <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-full font-bold">
                      انضم الآن
                    </span>
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    تحديات ونماذج وأخبار توجيهي 2009 أولاً بأول
                  </p>
                </div>
              </div>
              <ArrowLeft className="w-4 h-4 text-emerald-600 shrink-0 group-hover:-translate-x-0.5 transition-transform" />
            </a>
          </div>

          {/* Section: Platform Navigation */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
              صفحات المنصة
            </span>

            {[
              { id: 'home' as const, label: 'الرئيسية', icon: Home },
              { id: 'exams' as const, label: 'الامتحانات التفاعلية', icon: BookOpen },
              { id: 'leaderboard' as const, label: 'لوحة الشرف والترتيب', icon: Trophy },
              { id: 'profile' as const, label: 'الملف الشخصي والإحصائيات', icon: User },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-sm transition-colors cursor-pointer text-right"
                >
                  <Icon className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Section: Admin Shortcuts */}
          {isAdmin && onOpenAdmin && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={handleAdminClick}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 font-bold text-xs transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span>لوحة تحكم المشرف العام</span>
                </div>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Section: Utility Settings */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between px-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                المظهر: {theme === 'dark' ? 'الوضع الليلي' : 'الوضع الفاتح'}
              </span>
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                title="تبديل المظهر"
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-700" />
                )}
              </button>
            </div>

            <button
              onClick={handleSettingsClick}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Settings className="w-4 h-4" />
              <span>إعدادات الحساب والخصوصية</span>
            </button>
          </div>
        </div>

        {/* Footer Brand note */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
            Arixon Platform 2009 · جميع الحقوق محفوظة
          </p>
        </div>
      </div>
    </div>
  );
};
