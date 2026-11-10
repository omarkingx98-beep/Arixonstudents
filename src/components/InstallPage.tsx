import React from 'react';
import { PWAInstallCard } from './PWAInstallCard';
import { ArrowRight, BookOpen, Sparkles } from 'lucide-react';

interface InstallPageProps {
  onBackToApp: () => void;
}

export const InstallPage: React.FC<InstallPageProps> = ({ onBackToApp }) => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070a12] text-slate-900 dark:text-white flex flex-col justify-between p-4 sm:p-6 transition-colors duration-200">
      {/* Top Navigation Bar */}
      <header className="max-w-xl w-full mx-auto flex items-center justify-between pb-6">
        <div className="flex items-center gap-2.5">
          <img
            src="/icons/icon-192x192.png"
            alt="Arixon Logo"
            className="w-9 h-9 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/logo.png';
            }}
          />
          <div>
            <span className="font-black text-sm tracking-wide text-slate-900 dark:text-white block">
              ARIXON
            </span>
            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold block -mt-0.5">
              منصة توجيهي 2009
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onBackToApp}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors shadow-2xs cursor-pointer"
        >
          <span>دخول المنصة</span>
          <ArrowRight className="w-3.5 h-3.5 rotate-180" />
        </button>
      </header>

      {/* Main Content Card */}
      <main className="flex-1 flex items-center justify-center py-4">
        <div className="w-full max-w-xl">
          <PWAInstallCard showBackAction={false} />
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-xl w-full mx-auto text-center pt-6 text-[11px] text-slate-400 dark:text-slate-500">
        <p>Arixon © 2026 — منصة الامتحانات التنافسية لطلبة التوجيهي</p>
      </footer>
    </div>
  );
};
