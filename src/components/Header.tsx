import React from 'react';
import { Logo } from './Logo';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useAdmin } from '../context/AdminContext';
import { Sun, Moon, Settings, Home, BookOpen, Trophy, User, ShieldCheck, Sparkles, Bell, Search } from 'lucide-react';
import type { NavigationTab } from '../types';

interface HeaderProps {
  currentTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  onOpenSettings: () => void;
  onOpenTutorial?: () => void;
  onOpenAdmin?: () => void;
  onOpenNotifications?: () => void;
  onOpenUserSearch?: () => void;
  unreadNotificationsCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  onOpenSettings,
  onOpenTutorial,
  onOpenAdmin,
  onOpenNotifications,
  onOpenUserSearch,
  unreadNotificationsCount = 0,
}) => {
  const { theme, toggleTheme } = useTheme();
  const { profile } = useAuth();
  const { isAdmin } = useAdmin();

  const navItems = [
    { id: 'home' as const, label: 'الرئيسية', icon: Home },
    { id: 'exams' as const, label: 'الامتحانات', icon: BookOpen },
    { id: 'leaderboard' as const, label: 'الترتيب', icon: Trophy },
    { id: 'profile' as const, label: 'ملفي', icon: User },
  ];

  return (
    <header className="sticky top-0 z-30 w-full bg-white dark:bg-[#090d16] border-b border-slate-200 dark:border-slate-800 transition-colors shadow-xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div 
          onClick={() => onTabChange('home')} 
          className="cursor-pointer"
        >
          <Logo size="md" />
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                id={`desktop-nav-tab-${item.id}`}
                onClick={() => onTabChange(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Action Icons: Theme Toggle & Settings */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Tutorial / Platform Guide Button - hidden on small mobile to avoid crowd */}
          {onOpenTutorial && (
            <button
              id="tutorial-header-btn"
              onClick={onOpenTutorial}
              aria-label="دليل المنصة"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-xs font-bold transition-all cursor-pointer shadow-xs"
              title="جولة في منصة أريكسون"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              <span>دليل أريكسون</span>
            </button>
          )}

          {/* Admin Portal Shortcut Button for Authorized Admins */}
          {isAdmin && onOpenAdmin && (
            <button
              id="admin-portal-header-btn"
              onClick={onOpenAdmin}
              aria-label="لوحة الإدارة"
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 text-xs font-bold transition-all cursor-pointer shadow-xs shrink-0"
              title="لوحة تحكم المشرف العام"
            >
              <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-xs">الإدارة</span>
            </button>
          )}

          {/* Quick Theme Toggle */}
          <button
            id="theme-toggle-header-btn"
            onClick={toggleTheme}
            aria-label="تبديل المظهر"
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-colors cursor-pointer shrink-0"
            title="تبديل المظهر"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>

          {/* Search Students by Username */}
          {onOpenUserSearch && (
            <button
              id="user-search-header-btn"
              onClick={onOpenUserSearch}
              aria-label="البحث عن الطلاب"
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-colors cursor-pointer shrink-0"
              title="البحث عن طالب باليوزر"
            >
              <Search className="w-4 h-4 text-blue-500" />
            </button>
          )}

          {/* Notifications Trigger */}
          {onOpenNotifications && (
            <button
              id="notifications-header-btn"
              onClick={onOpenNotifications}
              aria-label="الإشعارات"
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-colors cursor-pointer shrink-0 relative"
              title="الإشعارات والتنبيهات"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-red-600 text-white ring-2 ring-white dark:ring-[#090d16] animate-pulse">
                  {unreadNotificationsCount > 9 ? '+9' : unreadNotificationsCount}
                </span>
              )}
            </button>
          )}

          {/* Settings Trigger */}
          <button
            id="settings-header-btn"
            onClick={onOpenSettings}
            aria-label="الإعدادات"
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-colors cursor-pointer shrink-0"
            title="الإعدادات"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* User Avatar Mini Pill */}
          {profile && (
            <button
              id="header-user-avatar-btn"
              onClick={() => onTabChange('profile')}
              className="flex items-center gap-1.5 pl-1.5 pr-1 py-1 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer shrink-0"
              title="الملف الشخصي"
            >
              <img
                src={profile.photoURL || 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=Arixon1'}
                alt={profile.username}
                className="w-7 h-7 rounded-full object-cover"
              />
              <span className="hidden lg:inline text-xs font-bold text-slate-800 dark:text-slate-200 max-w-[90px] truncate">
                {profile.username}
              </span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
