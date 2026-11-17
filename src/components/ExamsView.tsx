import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useOffline } from '../context/OfflineContext';
import { 
  getExamsList, 
  startOrResumeAttempt,
  getAttemptById
} from '../lib/examService';
import {
  downloadOfflineExamPackage,
  removeDownloadedExamPackage,
  startOrResumeOfflineAttempt,
} from '../lib/offlineExamService';
import {
  formatBytesAr,
  getDownloadedPackagesForUser,
  type OfflineExamPackage,
} from '../lib/offlineDb';
import { ExamDetailsModal } from './ExamDetailsModal';
import { ExamActiveView } from './ExamActiveView';
import { ExamResultsView } from './ExamResultsView';
import { ExamReviewView } from './ExamReviewView';
import type { Exam, SubjectId, ExamAttempt, Question } from '../types';
import { 
  BookOpen, 
  Clock, 
  HelpCircle, 
  Award, 
  Filter, 
  Play, 
  CheckCircle2, 
  RotateCcw,
  Loader2,
  Download,
  Trash2,
  RefreshCw,
  WifiOff,
  AlertCircle
} from 'lucide-react';

import { getBranchSubjects } from '../data/curriculumSubjects';

interface ExamsViewProps {
  initialAttempt?: ExamAttempt | null;
  initialViewMode?: 'list' | 'results' | 'review';
  onResetView?: () => void;
  resetSignal?: number;
}

function formatCardRemaining(expectedEndAt: string, nowMs: number): string {
  const diffSec = Math.max(0, Math.floor((new Date(expectedEndAt).getTime() - nowMs) / 1000));
  const hrs = Math.floor(diffSec / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export const ExamsView: React.FC<ExamsViewProps> = ({
  initialAttempt = null,
  initialViewMode = 'list',
  onResetView,
  resetSignal = 0,
}) => {
  const { profile, refreshProfile } = useAuth();
  const { isOnline, refreshPendingQueue } = useOffline();
  const [selectedSubject, setSelectedSubject] = useState<SubjectId>('all');
  const [branchFilter, setBranchFilter] = useState<'my_branch' | 'all' | 'علمي' | 'أدبي'>('my_branch');
  const [exams, setExams] = useState<Exam[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [resumingExamId, setResumingExamId] = useState<string | null>(null);
  const [downloadedPackages, setDownloadedPackages] = useState<Record<string, OfflineExamPackage>>({});
  const [downloadingExamId, setDownloadingExamId] = useState<string | null>(null);
  const [offlineActionMessage, setOfflineActionMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Workflow State Machine: 'list' | 'active' | 'results' | 'review'
  const [viewMode, setViewMode] = useState<'list' | 'active' | 'results' | 'review'>(initialViewMode);
  const [selectedExamForModal, setSelectedExamForModal] = useState<Exam | null>(null);
  const [isStartingAttempt, setIsStartingAttempt] = useState<boolean>(false);

  // Active or Viewed Attempt details
  const [currentAttempt, setCurrentAttempt] = useState<ExamAttempt | null>(initialAttempt);
  const [currentExam, setCurrentExam] = useState<Exam | null>(null);
  const [currentQuestions, setCurrentQuestions] = useState<Question[]>([]);

  // Determine effective branch to query
  const effectiveBranch = branchFilter === 'my_branch' 
    ? (profile?.branch || 'علمي') 
    : branchFilter === 'all' 
      ? 'all' 
      : branchFilter;

  // Dynamic subject filters based on active branch (8 subjects for Scientific, 8 subjects for Literary)
  const subjectFilters = getBranchSubjects(effectiveBranch);

  // Auto-reset selected subject when changing branch if current subject is not in that branch
  useEffect(() => {
    if (selectedSubject !== 'all' && !subjectFilters.some(f => f.id === selectedSubject)) {
      setSelectedSubject('all');
    }
  }, [effectiveBranch]);

  // Load downloaded packages for current user
  const reloadDownloadedPackages = React.useCallback(async () => {
    if (!profile?.uid) {
      setDownloadedPackages({});
      return;
    }
    const list = await getDownloadedPackagesForUser(profile.uid);
    const map: Record<string, OfflineExamPackage> = {};
    list.forEach((p) => {
      map[p.examId] = p;
    });
    setDownloadedPackages(map);
  }, [profile?.uid]);

  useEffect(() => {
    void reloadDownloadedPackages();
  }, [reloadDownloadedPackages]);

  // Load exams on filter change or view mode change back to 'list'
  useEffect(() => {
    let isMounted = true;
    async function loadExams() {
      if (viewMode !== 'list') return;
      setIsLoading(true);
      try {
        const fetched = await getExamsList(selectedSubject, profile?.uid, effectiveBranch);
        if (isMounted) {
          setExams(fetched);
        }
      } catch (err) {
        console.error('Error fetching exams from Firestore:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    loadExams();
    void reloadDownloadedPackages();
    return () => {
      isMounted = false;
    };
  }, [selectedSubject, profile?.uid, effectiveBranch, viewMode, isOnline, reloadDownloadedPackages]);

  // Refresh list immediately when offline background sync finishes
  useEffect(() => {
    const onSyncComplete = async () => {
      if (viewMode !== 'list') return;
      const fetched = await getExamsList(selectedSubject, profile?.uid, effectiveBranch).catch(() => null);
      if (fetched) setExams(fetched);
    };
    window.addEventListener('arixon:offline-sync-complete', onSyncComplete);
    return () => window.removeEventListener('arixon:offline-sync-complete', onSyncComplete);
  }, [viewMode, selectedSubject, profile?.uid, effectiveBranch]);

  // Sync initialAttempt prop changes
  useEffect(() => {
    if (initialAttempt) {
      setCurrentAttempt(initialAttempt);
      setViewMode(initialViewMode);
    }
  }, [initialAttempt, initialViewMode]);

  // External reset signal (e.g. clicking Exams tab after Confirm Save & Exit)
  useEffect(() => {
    if (resetSignal > 0) {
      setViewMode('list');
      setCurrentAttempt(null);
      setCurrentExam(null);
    }
  }, [resetSignal]);

  // Live countdown ticker on exam cards when any exam is in_progress
  useEffect(() => {
    if (viewMode !== 'list') return;
    const hasActiveInProgress = exams.some(
      (ex) => ex.userAttemptStatus === 'in_progress' && Boolean(ex.userAttemptExpectedEndAt)
    );
    if (!hasActiveInProgress) return;
    setNowMs(Date.now());
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [viewMode, exams]);

  // Handle clicking "Start Exam", "Resume", or "View Completed"
  // Handle clicking "Start Exam", "Resume", or "View Completed"
  const handleExamCardClick = (exam: Exam) => {
    const isCompleted = (exam.userAttemptStatus === 'completed' || exam.userAttemptStatus === 'submitted_pending') && Boolean(exam.userLastAttemptId);
    if (isCompleted && exam.userLastAttemptId) {
      // View existing submitted attempt result directly without re-taking
      openSubmittedAttempt(exam.userLastAttemptId, exam);
      return;
    }

    // Open details preview modal
    setSelectedExamForModal(exam);
  };

  // Open existing submitted attempt
  const openSubmittedAttempt = async (attemptId: string, exam?: Exam) => {
    if (!profile) return;
    try {
      setIsLoading(true);
      const att = await getAttemptById(attemptId, profile.uid);
      if (att) {
        setCurrentAttempt(att);
        if (exam) setCurrentExam(exam);
        setViewMode('results');
      } else {
        // Attempt does not exist for this student (e.g. stale cross-user cache or bad id)
        // Reset stale markers on this exam and open the exam details modal so student can take it
        if (exam) {
          exam.userAttemptStatus = 'not_started';
          exam.userLastAttemptId = undefined;
          exam.userScore = undefined;
          try {
            localStorage.removeItem(`arixon_completed_${profile.uid}_${exam.id}`);
            localStorage.removeItem(`arixon_completed_exam_${exam.id}`);
          } catch {}
          setSelectedExamForModal(exam);
        }
      }
    } catch (err) {
      console.error('Error loading submitted attempt:', err);
      if (exam) {
        setSelectedExamForModal(exam);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Download or update exam package for offline usage
  const handleDownloadOfflineExam = async (exam: Exam) => {
    if (!profile?.uid || downloadingExamId) return;
    setOfflineActionMessage(null);
    setDownloadingExamId(exam.id);
    try {
      const pkg = await downloadOfflineExamPackage(exam.id, profile.uid);
      setDownloadedPackages((prev) => ({ ...prev, [exam.id]: pkg }));
      setOfflineActionMessage({
        type: 'success',
        text: `تم تنزيل "${exam.title}" بنجاح (${formatBytesAr(pkg.sizeBytes)}).`,
      });
    } catch (err: any) {
      setOfflineActionMessage({
        type: 'error',
        text: err?.message || 'تعذر تنزيل الامتحان للاستخدام بدون إنترنت.',
      });
    } finally {
      setDownloadingExamId(null);
    }
  };

  const handleRemoveOfflineExam = async (examId: string) => {
    if (!profile?.uid) return;
    setOfflineActionMessage(null);
    await removeDownloadedExamPackage(profile.uid, examId);
    setDownloadedPackages((prev) => {
      const copy = { ...prev };
      delete copy[examId];
      return copy;
    });
  };

  // Start or resume attempt from modal (automatically switches to offline flow when offline & downloaded)
  const handleStartExamFromModal = async (exam: Exam) => {
    if (!profile) return;
    setIsStartingAttempt(true);
    try {
      const hasOfflinePkg = Boolean(downloadedPackages[exam.id]);
      const useOfflineFlow = !isOnline && hasOfflinePkg;

      const { attempt, questions } = useOfflineFlow
        ? await startOrResumeOfflineAttempt(exam.id, profile.uid, profile.displayName)
        : await startOrResumeAttempt(exam.id, profile.uid, profile.displayName);

      setCurrentExam(exam);
      setCurrentAttempt(attempt);
      setCurrentQuestions(questions);
      setSelectedExamForModal(null);

      if (attempt.status === 'submitted' || attempt.status === 'submitted_pending') {
        setViewMode('results');
      } else {
        setViewMode('active');
      }
    } catch (err: any) {
      console.error('Failed to start exam:', err);
      throw err;
    } finally {
      setIsStartingAttempt(false);
    }
  };

  // Called when student finishes/submits active exam
  const handleFinishExam = async (submittedAttempt: ExamAttempt) => {
    setCurrentAttempt(submittedAttempt);

    const isPendingSync = submittedAttempt.status === 'submitted_pending';
    const targetExamId = submittedAttempt.examId || (currentExam ? currentExam.id : '');
    if (targetExamId) {
      setExams((prev) =>
        prev.map((ex) => {
          if (ex.id === targetExamId) {
            return {
              ...ex,
              userAttemptStatus: isPendingSync ? 'submitted_pending' : 'completed',
              status: isPendingSync ? ex.status : 'completed',
              userScore: submittedAttempt.score ?? ex.userScore ?? 0,
              userLastAttemptId: submittedAttempt.id,
            };
          }
          return ex;
        })
      );
    }

    await refreshPendingQueue();
    setViewMode('results');
    if (isOnline && refreshProfile) {
      try {
        await refreshProfile();
      } catch (err) {
        console.warn('Profile refresh after exam submit:', err);
      }
    }
  };

  // Resume in-progress exam directly with fallback to details modal on error
  const handleDirectResumeExam = async (exam: Exam) => {
    if (!profile || resumingExamId) return;
    setResumingExamId(exam.id);
    try {
      await handleStartExamFromModal(exam);
    } catch {
      setSelectedExamForModal(exam);
    } finally {
      setResumingExamId(null);
    }
  };

  // Return to exams list
  const handleBackToList = () => {
    setViewMode('list');
    setCurrentAttempt(null);
    setCurrentExam(null);
    if (onResetView) onResetView();
  };

  // 1. ACTIVE EXAM VIEW (Focused, full distraction-free screen)
  if (viewMode === 'active' && currentExam && currentAttempt && profile) {
    return (
      <ExamActiveView
        exam={currentExam}
        attempt={currentAttempt}
        questions={currentQuestions}
        userId={profile.uid}
        onFinishExam={handleFinishExam}
        onExitToList={handleBackToList}
      />
    );
  }

  // 2. EXAM RESULTS VIEW
  if (viewMode === 'results' && currentAttempt && profile) {
    return (
      <ExamResultsView
        attempt={currentAttempt}
        userId={profile.uid}
        onReviewAnswers={() => setViewMode('review')}
        onBackToExams={handleBackToList}
      />
    );
  }

  // 3. EXAM REVIEW VIEW
  if (viewMode === 'review' && currentAttempt && profile) {
    return (
      <ExamReviewView
        attempt={currentAttempt}
        userId={profile.uid}
        onBack={() => setViewMode('results')}
      />
    );
  }

  // 4. MAIN EXAMS LIST VIEW
  return (
    <div className="space-y-6 pb-24 md:pb-8 animate-fadeIn">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            الامتحانات التنافسية
          </h1>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
            توجيهي 2009
          </span>
          {profile?.branch && (
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              فرع: {profile.branch}
            </span>
          )}
        </div>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          امتحانات إلكترونية مخصصة لفرعك ومطابقة لأحدث مناهج التوجيهي، تصحيح فوري ونقاط مباشرة لرفع ترتيبك.
        </p>
      </div>

      {/* Branch Stream Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-slate-100 dark:border-slate-800/80 pt-1">
        <span className="text-xs text-slate-400 font-bold whitespace-nowrap pl-1">مسار الفرع:</span>
        <button
          type="button"
          id="branch-filter-my-branch"
          onClick={() => setBranchFilter('my_branch')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            branchFilter === 'my_branch'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          {profile?.branch ? `فرعي (${profile.branch})` : 'فرعي'}
        </button>
        <button
          type="button"
          id="branch-filter-sci"
          onClick={() => setBranchFilter('علمي')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            branchFilter === 'علمي'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          الفرع العلمي
        </button>
        <button
          type="button"
          id="branch-filter-lit"
          onClick={() => setBranchFilter('أدبي')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            branchFilter === 'أدبي'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          الفرع الأدبي
        </button>
        <button
          type="button"
          id="branch-filter-all"
          onClick={() => setBranchFilter('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            branchFilter === 'all'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          كافة الفروع
        </button>
      </div>

      {/* Subject Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 pl-1">
          <Filter className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">المادة:</span>
        </div>
        {subjectFilters.map((filter) => {
          const isSelected = selectedSubject === filter.id;
          return (
            <button
              key={filter.id}
              id={`filter-subject-${filter.id}`}
              onClick={() => setSelectedSubject(filter.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex-shrink-0 cursor-pointer ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : 'bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {offlineActionMessage && (
        <div
          className={`px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-between gap-3 border ${
            offlineActionMessage.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
              : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
          }`}
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{offlineActionMessage.text}</span>
          </span>
          <button
            type="button"
            onClick={() => setOfflineActionMessage(null)}
            className="underline text-[11px] cursor-pointer"
          >
            إخفاء
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111625] animate-pulse space-y-4"
            >
              <div className="flex justify-between">
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/4" />
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/5" />
              </div>
              <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
              <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/2" />
              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded" />
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded" />
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Strict Client-side Branch Filtration */}
      {(() => {
        const visibleExams = exams.filter((exam) => {
          if (effectiveBranch === 'أدبي') {
            if (['physics', 'chemistry', 'biology', 'geology'].includes(exam.subject)) return false;
            if (exam.branch === 'علمي') return false;
            if (exam.title?.includes('فيزياء') || exam.title?.includes('كيمياء') || exam.title?.includes('أحياء') || exam.title?.includes('جيولوجيا') || exam.title?.includes('الزخم')) return false;
            if (exam.lesson?.includes('فيزياء') || exam.lesson?.includes('كيمياء') || exam.lesson?.includes('أحياء') || exam.lesson?.includes('الزخم')) return false;
          }
          if (effectiveBranch === 'علمي') {
            if (['history', 'geography', 'financial_culture'].includes(exam.subject)) return false;
            if (exam.branch === 'أدبي') return false;
            if (exam.title?.includes('تاريخ') || exam.title?.includes('جغرافيا') || exam.title?.includes('مالية') || exam.title?.includes('قضايا')) return false;
            if (exam.lesson?.includes('تاريخ') || exam.lesson?.includes('جغرافيا') || exam.lesson?.includes('مالية')) return false;
          }
          return true;
        });

        if (!isLoading && visibleExams.length > 0) {
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visibleExams.map((exam) => {
                const isCompleted = (exam.userAttemptStatus === 'completed' || exam.userAttemptStatus === 'submitted_pending') && Boolean(exam.userLastAttemptId);
                const isInProgress = !isCompleted && exam.userAttemptStatus === 'in_progress';

                const difficultyText = 
                  exam.difficulty === 'easy' ? 'سهل' :
                  exam.difficulty === 'hard' ? 'متقدم' : 'متوسط';

                const difficultyBadgeColor = 
                  exam.difficulty === 'easy' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' :
                  exam.difficulty === 'hard' ? 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300' :
                  'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300';

                const earnedMarks = Math.round(((exam.userScore ?? 0) / 100) * (exam.totalPoints || 100));
                const totalMarks = exam.totalPoints || 100;
                const downloadedPkg = downloadedPackages[exam.id];
                const hasVersionUpdate = Boolean(
                  downloadedPkg &&
                  Number(exam.version || 1) > Number(downloadedPkg.version || 1)
                );
                const isPendingSync = exam.userAttemptStatus === 'submitted_pending';
                const canStartNow = isOnline || Boolean(downloadedPkg) || isCompleted;

                return (
                  <div
                    key={exam.id}
                    id={`exam-card-${exam.id}`}
                    className="p-6 rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111625] shadow-xs hover:border-blue-300 dark:hover:border-blue-700 transition-all flex flex-col justify-between space-y-4"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-lg">
                          {exam.subjectNameAr || exam.subject}
                        </span>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${difficultyBadgeColor}`}>
                            {difficultyText}
                          </span>

                          {isPendingSync ? (
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 flex items-center gap-1 border border-amber-300 dark:border-amber-800">
                              <Clock className="w-3 h-3" />
                              <span>بانتظار المزامنة ({exam.userScore ?? 0}%)</span>
                            </span>
                          ) : isCompleted ? (
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 flex items-center gap-1 border border-emerald-300 dark:border-emerald-800">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>تم الإنجاز ({exam.userScore ?? 0}%)</span>
                            </span>
                          ) : null}

                          {isInProgress && (() => {
                            const hasEnd = Boolean(exam.userAttemptExpectedEndAt);
                            const remainingStr = hasEnd
                              ? formatCardRemaining(exam.userAttemptExpectedEndAt!, nowMs)
                              : null;
                            const isExpiredNow = hasEnd && new Date(exam.userAttemptExpectedEndAt!).getTime() <= nowMs;
                            return (
                              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 flex items-center gap-1">
                                <Clock className="w-3 h-3 animate-pulse" />
                                <span>
                                  {isExpiredNow
                                    ? 'انتهى الوقت'
                                    : remainingStr
                                    ? `قيد الحل · متبقي ${remainingStr}`
                                    : 'قيد الحل'}
                                </span>
                              </span>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Title & Lesson */}
                      <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-1 leading-snug">
                        {exam.title}
                      </h3>
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-2">
                        {exam.lesson}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-4">
                        {exam.description}
                      </p>

                      {/* Offline Download Package Controls */}
                      {(exam.allowOffline || downloadedPkg) && (
                        <div className="mb-3 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 flex flex-col gap-2">
                          {downloadedPkg ? (
                            <>
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <span className="font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                                  <span>منزّل ✅</span>
                                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                    ({formatBytesAr(downloadedPkg.sizeBytes)})
                                  </span>
                                </span>
                                <button
                                  type="button"
                                  id={`remove-offline-pkg-${exam.id}`}
                                  onClick={() => handleRemoveOfflineExam(exam.id)}
                                  className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>حذف النسخة</span>
                                </button>
                              </div>
                              {hasVersionUpdate && (
                                <div className="flex items-center justify-between gap-2 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800/60">
                                  <span className="font-bold">يوجد تحديث للنسخة المنزّلة</span>
                                  {isOnline && (
                                    <button
                                      type="button"
                                      onClick={() => handleDownloadOfflineExam(exam)}
                                      disabled={downloadingExamId === exam.id}
                                      className="font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                                    >
                                      <RefreshCw className={`w-3 h-3 ${downloadingExamId === exam.id ? 'animate-spin' : ''}`} />
                                      <span>تحديث</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </>
                          ) : exam.allowOffline ? (
                            <button
                              type="button"
                              id={`download-offline-pkg-${exam.id}`}
                              onClick={() => handleDownloadOfflineExam(exam)}
                              disabled={!isOnline || downloadingExamId === exam.id}
                              className="w-full py-1.5 px-3 rounded-xl text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50/80 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-950/70 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              {downloadingExamId === exam.id ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>جارٍ التنزيل...</span>
                                </>
                              ) : (
                                <>
                                  <Download className="w-3.5 h-3.5" />
                                  <span>تنزيل للاستخدام بدون إنترنت</span>
                                </>
                              )}
                            </button>
                          ) : null}
                        </div>
                      )}

                      {/* Metrics Bar */}
                      <div className="grid grid-cols-3 gap-2 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3">
                        <div className="flex items-center gap-1.5">
                          <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                          <span>{exam.questionCount} سؤال</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{exam.durationMinutes} دقيقة</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5 text-amber-500" />
                          <span>{exam.totalPoints} نقطة</span>
                        </div>
                      </div>
                    </div>

                    {/* Card Action Button */}
                    <div>
                      {isCompleted ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs px-1">
                            <span className="text-slate-500 font-medium">
                              {isPendingSync ? 'النتيجة المبدئية:' : 'النتيجة:'}
                            </span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              {exam.userScore !== undefined ? `${exam.userScore}% (${earnedMarks} / ${totalMarks})` : 'تم الإنجاز'}
                            </span>
                          </div>
                          <button
                            id={`view-result-btn-${exam.id}`}
                            onClick={() => {
                              if (exam.userLastAttemptId) {
                                openSubmittedAttempt(exam.userLastAttemptId, exam);
                              } else {
                                handleExamCardClick(exam);
                              }
                            }}
                            className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-blue-500/20"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>عرض النتيجة ومراجعة الحل</span>
                          </button>
                        </div>
                      ) : isInProgress ? (() => {
                        const hasEnd = Boolean(exam.userAttemptExpectedEndAt);
                        const remainingStr = hasEnd
                          ? formatCardRemaining(exam.userAttemptExpectedEndAt!, nowMs)
                          : null;
                        const isExpiredNow = hasEnd && new Date(exam.userAttemptExpectedEndAt!).getTime() <= nowMs;
                        const isResumingThis = resumingExamId === exam.id;
                        return (
                          <button
                            id={`resume-exam-btn-${exam.id}`}
                            onClick={() => handleDirectResumeExam(exam)}
                            disabled={isResumingThis || (!isOnline && !downloadedPkg)}
                            className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-70"
                          >
                            {isResumingThis ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>جارٍ استكمال الامتحان...</span>
                              </>
                            ) : (
                              <>
                                <RotateCcw className="w-4 h-4" />
                                <span>
                                  {isExpiredNow
                                    ? 'استكمال / احتساب النتيجة'
                                    : remainingStr
                                    ? `استكمال (متبقي ${remainingStr})`
                                    : 'استكمال'}
                                </span>
                              </>
                            )}
                          </button>
                        );
                      })() : (
                        <button
                          id={`start-exam-btn-${exam.id}`}
                          onClick={() => handleExamCardClick(exam)}
                          disabled={!canStartNow}
                          className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 transition-all cursor-pointer disabled:cursor-not-allowed"
                        >
                          {!canStartNow ? (
                            <>
                              <WifiOff className="w-3.5 h-3.5" />
                              <span>يتطلب اتصالًا بالإنترنت</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>{!isOnline && downloadedPkg ? 'ابدأ بدون إنترنت' : 'ابدأ'}</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        }
        return null;
      })()}

      {/* Professional Empty State */}
      {!isLoading && exams.length === 0 && (
        <div
          id="exams-empty-state"
          className="rounded-3xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#111625] p-8 sm:p-12 text-center shadow-xs max-w-xl mx-auto my-4"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <BookOpen className="w-8 h-8" />
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-2">
            لا توجد امتحانات متاحة حاليًا لهذا التصنيف
          </h2>

          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
            اختر تصنيفاً آخر أو مادة أخرى من القائمة العلوية للاطلاع على بنك الامتحانات النشطة لجيل 2009.
          </p>

          <button
            onClick={() => setSelectedSubject('all')}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            عرض جميع الامتحانات
          </button>
        </div>
      )}

      {/* Exam Details Preview Modal */}
      {selectedExamForModal && (
        <ExamDetailsModal
          exam={selectedExamForModal}
          isOpen={!!selectedExamForModal}
          onClose={() => setSelectedExamForModal(null)}
          onStartExam={handleStartExamFromModal}
          onViewResult={(attemptId) => openSubmittedAttempt(attemptId, selectedExamForModal)}
          isLoading={isStartingAttempt}
        />
      )}
    </div>
  );
};
