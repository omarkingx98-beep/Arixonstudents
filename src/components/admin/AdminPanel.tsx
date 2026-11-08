import React, { useState } from 'react';
import { AdminLayout } from './AdminLayout';
import { AdminDashboard } from './AdminDashboard';
import { AdminExamsView } from './AdminExamsView';
import { AdminQuestionBankView } from './AdminQuestionBankView';
import { AdminStudentsView } from './AdminStudentsView';
import { AdminLeaderboardView } from './AdminLeaderboardView';
import { AdminAnnouncementsView } from './AdminAnnouncementsView';
import { AdminPromoBannersView } from './AdminPromoBannersView';
import { AdminChallengesView } from './AdminChallengesView';
import { AdminAnalyticsView } from './AdminAnalyticsView';
import { AdminAiBuilderView } from './AdminAiBuilderView';
import { AdminExamImportView } from './AdminExamImportView';
import { AdminAuditLogsView } from './AdminAuditLogsView';
import { AdminSettingsView } from './AdminSettingsView';
import { AdminProfileView } from './AdminProfileView';
import { AdminTeamView } from './AdminTeamView';
import { AdminModerationView } from './AdminModerationView';
import { useAdmin } from '../../context/AdminContext';
import { canAccessTab, ROLE_CONFIGS } from '../../lib/roleService';
import type { AdminTab } from '../../types';

interface AdminPanelProps {
  onExitAdmin: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onExitAdmin }) => {
  const [currentTab, setCurrentTab] = useState<AdminTab>('dashboard');
  const { adminRole } = useAdmin();

  const userCanAccess = canAccessTab(adminRole || 'student', currentTab);

  return (
    <AdminLayout
      currentTab={currentTab}
      onTabChange={setCurrentTab}
      onExitAdmin={onExitAdmin}
    >
      {!userCanAccess ? (
        <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs max-w-lg mx-auto my-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center text-3xl">
            🚫
          </div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
            غير مصرح بالوصول لهذا القسم
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
            رتبتك الحالية ({ROLE_CONFIGS[adminRole || 'student']?.labelAr}) لا تملك الصلاحيات الكافية للوصول إلى هذا التبويب.
          </p>
          <button
            onClick={() => setCurrentTab('dashboard')}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-colors shadow-xs"
          >
            العودة للوحة القيادة
          </button>
        </div>
      ) : (
        <>
          {currentTab === 'dashboard' && (
            <AdminDashboard
              onNavigate={(tab) => setCurrentTab(tab)}
            />
          )}

          {currentTab === 'exams' && (
            <AdminExamsView
              onOpenAiBuilder={() => setCurrentTab('ai-builder')}
              onOpenAiImporter={() => setCurrentTab('ai-import')}
            />
          )}

          {currentTab === 'ai-import' && (
            <AdminExamImportView
              onBackToExams={() => setCurrentTab('exams')}
              onExamCreated={() => setCurrentTab('exams')}
            />
          )}

          {currentTab === 'questions' && (
            <AdminQuestionBankView
              onOpenAiBuilder={() => setCurrentTab('ai-builder')}
            />
          )}

          {currentTab === 'students' && <AdminStudentsView />}

          {currentTab === 'team' && <AdminTeamView />}

          {currentTab === 'moderation' && <AdminModerationView />}

          {currentTab === 'leaderboard' && <AdminLeaderboardView />}

          {currentTab === 'announcements' && <AdminAnnouncementsView />}

          {currentTab === 'banners' && <AdminPromoBannersView />}

          {currentTab === 'challenges' && <AdminChallengesView />}

          {currentTab === 'analytics' && <AdminAnalyticsView />}

          {currentTab === 'ai-builder' && (
            <AdminAiBuilderView
              onExamCreated={() => setCurrentTab('exams')}
              onQuestionSaved={() => setCurrentTab('questions')}
            />
          )}

          {currentTab === 'audit-logs' && <AdminAuditLogsView />}

          {currentTab === 'settings' && <AdminSettingsView />}

          {currentTab === 'profile' && (
            <AdminProfileView onBackToStudentApp={onExitAdmin} />
          )}
        </>
      )}
    </AdminLayout>
  );
};

