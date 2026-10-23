import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Archive,
  Edit3,
  Copy,
  Users,
  Eye,
  Clock,
  Award,
  MoreVertical,
  Layers,
  Sparkles,
  AlertTriangle,
  Play,
  Pause,
  X,
  Loader2,
  HelpCircle,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Wrench,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { 
  fetchAllAdminExams, 
  setExamPublishStatus, 
  archiveExam, 
  saveExamWithValidation,
  checkExamReadiness,
  repairExamAnswerKeys,
  regradePendingAttempts,
  getAdminExamQuestions,
} from '../../lib/adminService';
import { useAdmin } from '../../context/AdminContext';
import { AdminCreateExamModal } from './AdminCreateExamModal';
import { AdminExamResultsModal } from './AdminExamResultsModal';
import type { Exam, Question, SubjectId } from '../../types';

interface AdminExamsViewProps {
  onOpenAiBuilder?: () => void;
  onOpenAiImporter?: () => void;
}

export const AdminExamsView: React.FC<AdminExamsViewProps> = ({
  onOpenAiBuilder,
  onOpenAiImporter,
}) => {
  const { adminProfile } = useAdmin();
  const [exams, setExams] = useState<Exam[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');

  // Active ⋮ Dropdown Menu
  const [activeMenuExamId, setActiveMenuExamId] = useState<string | null>(null);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [examToEdit, setExamToEdit] = useState<Exam | null>(null);
  const [resultsExam, setResultsExam] = useState<Exam | null>(null);

  // Confirmation Modals (D1 requirement)
  const [examToUnpublish, setExamToUnpublish] = useState<Exam | null>(null);
  const [examToArchive, setExamToArchive] = useState<Exam | null>(null);
  const [examToPreview, setExamToPreview] = useState<Exam | null>(null);
  const [previewQuestions, setPreviewQuestions] = useState<Question[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Readiness & Repair states (Part H & I)
  const [readinessExam, setReadinessExam] = useState<Exam | null>(null);
  const [readinessReport, setReadinessReport] = useState<any | null>(null);
  const [isValidatingReadiness, setIsValidatingReadiness] = useState(false);
  const [isRepairingKeys, setIsRepairingKeys] = useState(false);
  const [isRegrading, setIsRegrading] = useState(false);

  const loadExams = async () => {
    setIsLoading(true);
    try {
      const data = await fetchAllAdminExams();
      setExams(data);
    } catch (err) {
      console.error('Error loading admin exams:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadExams();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.exam-menu-container')) {
        setActiveMenuExamId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Helper to determine status key
  const getComputedStatus = (exam: Exam): 'published' | 'unpublished' | 'draft' | 'archived' => {
    if (exam.isArchived || exam.status === 'archived') return 'archived';
    if (exam.published && (exam.status === 'published' || exam.status === 'available')) return 'published';
    if (!exam.published && (exam.status === 'unpublished' || exam.status === 'closed')) return 'unpublished';
    return 'draft';
  };

  // Run Exam Readiness Check
  const handleCheckReadiness = async (exam: Exam) => {
    setActiveMenuExamId(null);
    setReadinessExam(exam);
    setIsValidatingReadiness(true);
    setReadinessReport(null);
    try {
      const report = await checkExamReadiness(exam.id);
      setReadinessReport(report);
    } catch (err: any) {
      alert('فشل فحص جاهزية الامتحان: ' + err.message);
    } finally {
      setIsValidatingReadiness(false);
    }
  };

  // Publish with strict readiness verification (Part H & I)
  const handlePublish = async (exam: Exam) => {
    try {
      const check = await checkExamReadiness(exam.id);
      if (!check.ready) {
        alert(`لا يمكن نشر الامتحان (${exam.title}) لأن جاهزيته غير مكتملة:\n\n` + check.errors.map(e => '• ' + e).join('\n'));
        return;
      }
      await setExamPublishStatus(exam.id, true, exam.title, exam.branch);
      await loadExams();
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء نشر الامتحان.');
    } finally {
      setActiveMenuExamId(null);
    }
  };

  // Repair answer keys
  const handleRepairAnswerKeys = async (targetExamId?: string) => {
    setIsRepairingKeys(true);
    try {
      const res = await repairExamAnswerKeys(targetExamId);
      alert(`اكتمل فحص وتصليح مفاتيح الإجابة!\n\n• عدد الامتحانات المحدثة: ${res.repairedExamsCount}\n• عدد مفاتيح الإجابة المنشأة: ${res.repairedKeysCount}\n${res.affectedExams.length > 0 ? '• الامتحانات المتأثرة:\n  ' + res.affectedExams.join(', ') : '• جميع الامتحانات كانت مكتملة.'}`);
      if (readinessExam) {
        handleCheckReadiness(readinessExam);
      }
    } catch (err: any) {
      alert('حدث خطأ أثناء تصليح المفاتيح: ' + err.message);
    } finally {
      setIsRepairingKeys(false);
    }
  };

  // Regrade pending attempts
  const handleRegradePendingAttempts = async () => {
    setIsRegrading(true);
    try {
      const res = await regradePendingAttempts();
      alert(`اكتملت عملية تصحيح المحاولات العالقة!\n\n• عدد المحاولات التي تم تصحيحها بنجاح: ${res.regradedCount}\n${res.errors.length > 0 ? '• الأخطاء:\n  ' + res.errors.join('\n  ') : ''}`);
    } catch (err: any) {
      alert('حدث خطأ أثناء إعادة التصحيح: ' + err.message);
    } finally {
      setIsRegrading(false);
    }
  };

  // Confirm and Execute Unpublish
  const executeUnpublish = async () => {
    if (!examToUnpublish) return;
    try {
      await setExamPublishStatus(examToUnpublish.id, false, examToUnpublish.title, examToUnpublish.branch);
      await loadExams();
      setExamToUnpublish(null);
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء إيقاف نشر الامتحان.');
    }
  };

  // Confirm and Execute Archive
  const executeArchive = async () => {
    if (!examToArchive) return;
    try {
      await archiveExam(examToArchive.id, examToArchive.title);
      await loadExams();
      setExamToArchive(null);
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء أرشفة الامتحان.');
    }
  };

  // Preview Exam
  const handleOpenPreview = async (exam: Exam) => {
    setActiveMenuExamId(null);
    setExamToPreview(exam);
    setIsLoadingPreview(true);
    try {
      const qs = await getAdminExamQuestions(exam.id);
      setPreviewQuestions(qs);
    } catch (err) {
      console.warn('Error fetching questions for preview:', err);
      setPreviewQuestions([]);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Duplicate Exam
  const handleDuplicate = async (exam: Exam) => {
    setActiveMenuExamId(null);
    if (!window.confirm(`هل تريد استنساخ وتكرار امتحان "${exam.title}" كمسودة جديدة؟`)) return;

    try {
      const existingQs = await getAdminExamQuestions(exam.id);
      const newTitle = `نسخة - ${exam.title}`;

      await saveExamWithValidation(
        {
          title: newTitle,
          subject: exam.subject,
          subjectNameAr: exam.subjectNameAr,
          lesson: exam.lesson,
          description: exam.description || '',
          durationMinutes: exam.durationMinutes,
          totalPoints: exam.totalPoints,
          difficulty: exam.difficulty,
          branch: exam.branch || 'مشترك',
          status: 'coming_soon',
          published: false,
          version: 1,
          allowRetake: exam.allowRetake,
          questionCount: existingQs.length,
          createdBy: adminProfile?.email || exam.createdBy || 'super_admin',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        existingQs.map((q, idx) => ({
          questionText: q.questionText,
          options: q.options,
          correctAnswer: q.correctAnswer ?? 0,
          explanation: q.explanation || '',
          difficulty: q.difficulty || 'medium',
          source: q.source || 'أريكسون',
          points: q.points || 5,
          order: idx + 1,
          questionType: q.questionType || 'multiple_choice',
          hint: q.hint,
        }))
      );

      await loadExams();
      alert('تم استنساخ الامتحان بنجاح كمسودة جديدة.');
    } catch (err: any) {
      alert(err.message || 'فشل استنساخ الامتحان.');
    }
  };

  // Filtered exams list
  const filteredExams = exams.filter((exam) => {
    const computed = getComputedStatus(exam);

    if (selectedSubject !== 'all' && exam.subject !== selectedSubject) return false;
    if (selectedDifficulty !== 'all' && exam.difficulty !== selectedDifficulty) return false;
    if (selectedStatus !== 'all' && computed !== selectedStatus) return false;

    if (searchQuery.trim()) {
      const term = searchQuery.toLowerCase().trim();
      const matchTitle = exam.title.toLowerCase().includes(term);
      const matchLesson = exam.lesson?.toLowerCase().includes(term);
      const matchDesc = exam.description?.toLowerCase().includes(term);
      if (!matchTitle && !matchLesson && !matchDesc) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#0c101c] p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <span>إدارة ونشر الامتحانات</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            إجمالي الامتحانات: {exams.length} (المنشورة: {exams.filter((e) => e.published).length} • المسودات والموقوفة: {exams.filter((e) => !e.published).length})
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {onOpenAiImporter && (
            <button
              onClick={onOpenAiImporter}
              className="px-3.5 py-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-xs font-bold hover:bg-purple-100 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>استيراد امتحان (AI)</span>
            </button>
          )}

          {onOpenAiBuilder && (
            <button
              onClick={onOpenAiBuilder}
              className="px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span>توليد أسئلة</span>
            </button>
          )}

          <button
            disabled={isRepairingKeys}
            onClick={() => handleRepairAnswerKeys()}
            className="px-3.5 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs font-bold hover:bg-amber-100 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isRepairingKeys ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4 text-amber-600" />}
            <span>إصلاح مفاتيح الإجابة</span>
          </button>

          <button
            disabled={isRegrading}
            onClick={handleRegradePendingAttempts}
            className="px-3.5 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-100 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isRegrading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 text-emerald-600" />}
            <span>إعادة تصحيح المعلّق</span>
          </button>

          <button
            onClick={() => {
              setExamToEdit(null);
              setIsCreateModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm shadow-blue-500/20 flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إنشاء امتحان يدوي</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-[#0c101c] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث باسم الامتحان أو الدرس..."
              className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#13192a] text-xs focus:outline-hidden focus:border-blue-500"
            />
          </div>

          {/* Subject Filter */}
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#13192a] text-xs focus:outline-hidden focus:border-blue-500 font-medium"
          >
            <option value="all">جميع المباحث الدراسية</option>
            <option value="physics">الفيزياء</option>
            <option value="math">الرياضيات</option>
            <option value="arabic">اللغة العربية</option>
            <option value="chemistry">الكيمياء</option>
            <option value="biology">العلوم الحياتية</option>
            <option value="english">اللغة الإنجليزية</option>
            <option value="islamic">التربية الإسلامية</option>
          </select>

          {/* Status Filter (Draft, Published, Unpublished, Archived - D1 requirement) */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#13192a] text-xs focus:outline-hidden focus:border-blue-500 font-bold"
          >
            <option value="all">جميع الحالات (الكل)</option>
            <option value="published">منشور متاح للطلاب (Published)</option>
            <option value="unpublished">موقوف مؤقتاً (Unpublished)</option>
            <option value="draft">مسودة خاصة (Draft)</option>
            <option value="archived">المؤرشفة (Archived)</option>
          </select>

          {/* Difficulty Filter */}
          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#13192a] text-xs focus:outline-hidden focus:border-blue-500 font-medium"
          >
            <option value="all">جميع المستويات</option>
            <option value="easy">سهل</option>
            <option value="medium">متوسط</option>
            <option value="hard">صعب</option>
          </select>
        </div>
      </div>

      {/* Exams Grid */}
      {isLoading ? (
        <div className="text-center py-16 text-slate-400 text-xs flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
          <span>جارٍ تحميل قائمة الامتحانات من Firestore...</span>
        </div>
      ) : filteredExams.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-[#0c101c] rounded-3xl border border-slate-200/80 dark:border-slate-800/80 p-8 space-y-3">
          <BookOpen className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
            لم يتم العثور على أي امتحانات تطابق خيارات البحث
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            يمكنك إنشاء امتحان جديد يدوياً أو استخدام منشئ ومستورد الامتحانات الذكي.
          </p>
          <button
            onClick={() => {
              setExamToEdit(null);
              setIsCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إنشاء أول امتحان الآن</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredExams.map((exam) => {
            const statusKey = getComputedStatus(exam);
            const isMenuOpen = activeMenuExamId === exam.id;

            return (
              <div
                key={exam.id}
                className="bg-white dark:bg-[#0c101c] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-blue-300 dark:hover:border-blue-700 transition-all relative"
              >
                <div className="space-y-3">
                  {/* Top Bar: Status Badge + Version + ⋮ Menu (D1 requirement) */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {statusKey === 'published' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>منشور للطلبة</span>
                        </span>
                      )}

                      {statusKey === 'unpublished' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                          <Pause className="w-3 h-3" />
                          <span>موقوف مؤقتاً</span>
                        </span>
                      )}

                      {statusKey === 'draft' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          <Clock className="w-3 h-3" />
                          <span>مسودة خاصة</span>
                        </span>
                      )}

                      {statusKey === 'archived' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          <Archive className="w-3 h-3" />
                          <span>مؤرشف</span>
                        </span>
                      )}

                      {exam.version && exam.version > 1 && (
                        <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-mono">
                          v{exam.version}
                        </span>
                      )}
                    </div>

                    {/* Three-dots menu button */}
                    <div className="relative exam-menu-container">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuExamId(isMenuOpen ? null : exam.id);
                        }}
                        className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                        title="خيارات الامتحان"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {/* Dropdown Menu (D1 requirement) */}
                      {isMenuOpen && (
                        <div className="absolute left-0 top-full mt-1 w-48 rounded-2xl bg-white dark:bg-[#13192a] border border-slate-200 dark:border-slate-800 shadow-xl py-1.5 z-30 animate-fadeIn text-right">
                          {/* 1. Edit */}
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuExamId(null);
                              setExamToEdit(exam);
                              setIsCreateModalOpen(true);
                            }}
                            className="w-full px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center gap-2 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-blue-500" />
                            <span>تعديل الامتحان</span>
                          </button>

                          {/* Readiness Check (Part H & I) */}
                          <button
                            type="button"
                            onClick={() => handleCheckReadiness(exam)}
                            className="w-full px-3.5 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center gap-2 cursor-pointer"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                            <span>فحص جاهزية الامتحان</span>
                          </button>

                          {/* 2. Publish / Unpublish Toggle */}
                          {statusKey === 'published' ? (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuExamId(null);
                                setExamToUnpublish(exam);
                              }}
                              className="w-full px-3.5 py-2 text-xs font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 flex items-center gap-2 cursor-pointer"
                            >
                              <Pause className="w-3.5 h-3.5" />
                              <span>إيقاف النشر مؤقتاً</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handlePublish(exam)}
                              className="w-full px-3.5 py-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center gap-2 cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>{statusKey === 'unpublished' ? 'إعادة النشر للطلاب' : 'نشر الامتحان الآن'}</span>
                            </button>
                          )}

                          {/* 3. Preview Exam */}
                          <button
                            type="button"
                            onClick={() => handleOpenPreview(exam)}
                            className="w-full px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center gap-2 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-indigo-500" />
                            <span>معاينة نموذج الامتحان</span>
                          </button>

                          {/* 4. Results */}
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuExamId(null);
                              setResultsExam(exam);
                            }}
                            className="w-full px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center gap-2 cursor-pointer"
                          >
                            <Users className="w-3.5 h-3.5 text-purple-500" />
                            <span>كشف نتائج الطلاب</span>
                          </button>

                          {/* 5. Duplicate */}
                          <button
                            type="button"
                            onClick={() => handleDuplicate(exam)}
                            className="w-full px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center gap-2 cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                            <span>تكرار ونسخ الامتحان</span>
                          </button>

                          <div className="border-t border-slate-100 dark:border-slate-800 my-1"></div>

                          {/* 6. Archive (without permanent deletion) */}
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuExamId(null);
                              setExamToArchive(exam);
                            }}
                            className="w-full px-3.5 py-2 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-2 cursor-pointer"
                          >
                            <Archive className="w-3.5 h-3.5" />
                            <span>أرشفة الامتحان</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Title & Lesson */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2">
                      {exam.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                        {exam.subjectNameAr || exam.subject}
                      </span>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                        {exam.lesson}
                      </span>
                    </div>
                  </div>

                  {/* Meta details */}
                  <div className="grid grid-cols-4 gap-1.5 py-2 border-y border-slate-100 dark:border-slate-800/60 text-center">
                    <div>
                      <div className="text-[10px] text-slate-400">الفرع</div>
                      <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                        {exam.branch || 'مشترك'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">الأسئلة</div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {exam.questionCount || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">المدة</div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {exam.durationMinutes} د
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">العلامة</div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {exam.totalPoints}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setExamToEdit(exam);
                        setIsCreateModalOpen(true);
                      }}
                      className="flex-1 py-1.5 px-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-blue-500" />
                      <span>تعديل</span>
                    </button>

                    <button
                      onClick={() => handleOpenPreview(exam)}
                      className="py-1.5 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 cursor-pointer"
                      title="معاينة"
                    >
                      <Eye className="w-3.5 h-3.5 text-indigo-500" />
                      <span>معاينة</span>
                    </button>

                    <button
                      onClick={() => setResultsExam(exam)}
                      className="py-1.5 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1 cursor-pointer"
                      title="النتائج"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>النتائج</span>
                    </button>
                  </div>

                  {statusKey === 'published' ? (
                    <button
                      onClick={() => setExamToUnpublish(exam)}
                      className="w-full py-1.5 rounded-xl text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-amber-200 dark:border-amber-900/50"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      <span>إيقاف النشر مؤقتاً</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handlePublish(exam)}
                      className="w-full py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>{statusKey === 'unpublished' ? 'إعادة النشر للطلاب' : 'نشر الامتحان للطلاب'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CONFIRM UNPUBLISH MODAL (D1 requirement) */}
      {examToUnpublish && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-[#0c101c] w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-5 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center mx-auto">
              <Pause className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                تأكيد إيقاف نشر الامتحان
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                هل أنت متأكد من رغبتك بإيقاف نشر امتحان <span className="font-bold text-slate-800 dark:text-slate-200">"{examToUnpublish.title}"</span>؟
              </p>
              <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-[11px] text-right space-y-1">
                <p>• سيختفي الامتحان فوراً من قائمة الامتحانات لدى جميع الطلاب.</p>
                <p>• لن يتمكن أي طالب من بدء محاولة جديدة في الامتحان.</p>
                <p>• من بدأ محاولة قبل الإيقاف، يستطيع إكمالها وتسليمها بشكل طبيعي وتبقى جميع النتائج السابقة محفوظة بدقة.</p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setExamToUnpublish(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={executeUnpublish}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                تأكيد إيقاف النشر
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM ARCHIVE MODAL (D1 requirement) */}
      {examToArchive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-[#0c101c] w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-5 text-center">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 flex items-center justify-center mx-auto">
              <Archive className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                تأكيد أرشفة الامتحان
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                هل أنت متأكد من أرشفة امتحان <span className="font-bold text-slate-800 dark:text-slate-200">"{examToArchive.title}"</span>؟
              </p>
              <p className="text-[11px] text-purple-700 dark:text-purple-300">
                سيتم نقل الامتحان إلى تبويب المؤرشفة (بدون حذف نهائي). يمكنك استعادته في أي وقت.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setExamToArchive(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={executeArchive}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                تأكيد الأرشفة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW EXAM MODAL (D1 requirement) */}
      {examToPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn overflow-y-auto">
          <div className="bg-white dark:bg-[#0c101c] w-full max-w-3xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                  معاينة نموذج الامتحان
                </span>
                <h3 className="text-base font-black text-slate-900 dark:text-white mt-1">
                  {examToPreview.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setExamToPreview(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {isLoadingPreview ? (
                <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                  <span>جارٍ جلب الأسئلة ومفاتيح الحل...</span>
                </div>
              ) : previewQuestions.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  لا توجد أسئلة مسجلة في هذا الامتحان بعد.
                </div>
              ) : (
                previewQuestions.map((q, idx) => (
                  <div
                    key={q.id || idx}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#13192a] space-y-3"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-blue-600">السؤال {idx + 1} ({q.points || 5} علامات)</span>
                      <span className="text-slate-400 font-mono">{q.difficulty}</span>
                    </div>

                    <p className="text-sm font-bold text-slate-900 dark:text-white leading-relaxed">
                      {q.questionText}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {q.options?.map((opt, optIdx) => {
                        const isCorrect = q.correctAnswer === optIdx;
                        return (
                          <div
                            key={optIdx}
                            className={`p-2.5 rounded-xl text-xs flex items-center gap-2 border ${
                              isCorrect
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 font-bold'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] shrink-0">
                              {['أ', 'ب', 'ج', 'د'][optIdx] || optIdx + 1}
                            </span>
                            <span>{opt}</span>
                            {isCorrect && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mr-auto shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {q.explanation && (
                      <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 text-[11px] text-blue-900 dark:text-blue-300 space-y-1">
                        <div className="font-bold flex items-center gap-1 text-blue-700 dark:text-blue-400">
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>الشرح والحل النموذجي:</span>
                        </div>
                        <p>{q.explanation}</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setExamToPreview(null)}
                className="px-5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
              >
                إغلاق المعاينة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {isCreateModalOpen && (
        <AdminCreateExamModal
          examToEdit={examToEdit}
          onClose={() => {
            setIsCreateModalOpen(false);
            setExamToEdit(null);
          }}
          onSaved={() => {
            loadExams();
          }}
        />
      )}

      {/* RESULTS MODAL */}
      {resultsExam && (
        <AdminExamResultsModal
          exam={resultsExam}
          onClose={() => setResultsExam(null)}
        />
      )}

      {/* EXAM READINESS MODAL (Part H & I) */}
      {readinessExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-lg bg-white dark:bg-[#0c101c] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 min-w-0">
                <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                  فحص جاهزية الامتحان: {readinessExam.title}
                </h3>
              </div>
              <button 
                onClick={() => setReadinessExam(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isValidatingReadiness ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500 text-xs">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span>جارٍ فحص مفاتيح الإجابة وتدقيق الأسئلة...</span>
              </div>
            ) : readinessReport ? (
              <div className="space-y-3.5">
                {readinessReport.ready ? (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-3 text-emerald-800 dark:text-emerald-300 text-xs">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-bold">الامتحان جاهز ومكتمل 100% للنشر!</p>
                      <p className="text-[11px] opacity-90 mt-0.5">
                        تم فحص {readinessReport.totalQuestions} سؤال ومطابقة مفاتيح الحل بدقة بدون أي أخطاء.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 flex items-start gap-3 text-red-800 dark:text-red-300 text-xs">
                    <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold">تنبيه: الامتحان غير جاهز للنشر لوجود ملاحظات حرجة:</p>
                      <ul className="list-disc list-inside text-[11px] space-y-0.5 mt-1">
                        {readinessReport.errors.map((err: string, i: number) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {readinessReport.warnings.length > 0 && (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300 text-[11px] space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>تحذيرات قابلة للإصلاح التلقائي:</span>
                    </p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {readinessReport.warnings.map((w: string, i: number) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <button
                    disabled={isRepairingKeys}
                    onClick={() => handleRepairAnswerKeys(readinessExam.id)}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isRepairingKeys ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
                    <span>إصلاح وتوليد مفاتيح الحل التلقائية</span>
                  </button>

                  <button
                    onClick={() => setReadinessExam(null)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
