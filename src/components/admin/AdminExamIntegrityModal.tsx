import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  BookOpen,
  Database,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Wrench,
  Activity,
  GitCompare,
  Check,
} from 'lucide-react';
import { auth } from '../../lib/firebase';
import type { Exam } from '../../types';
import type {
  ExamAuditReport,
  ExamGradingTraceReport,
  SyncExamKeysResult,
  GradingTraceQuestionRow,
} from '../../../api/_lib/adminIntegrity';

interface AdminExamIntegrityModalProps {
  isOpen: boolean;
  onClose: () => void;
  exams: Exam[];
  initialExamId?: string;
}

type ModalTab = 'audit' | 'trace' | 'sync';

export const AdminExamIntegrityModal: React.FC<AdminExamIntegrityModalProps> = ({
  isOpen,
  onClose,
  exams,
  initialExamId,
}) => {
  const [selectedExamId, setSelectedExamId] = useState<string>(
    initialExamId || 'exam_1792050086667_12ri'
  );
  const [activeTab, setActiveTab] = useState<ModalTab>('audit');

  // Tab 1: Integrity Dry-Run Audit state
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [report, setReport] = useState<ExamAuditReport | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);

  // Tab 2: Grading Trace state
  const [isLoadingTrace, setIsLoadingTrace] = useState(false);
  const [traceReport, setTraceReport] = useState<ExamGradingTraceReport | null>(null);
  const [selectedAttemptId, setSelectedAttemptId] = useState<string>('');
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);
  const [traceError, setTraceError] = useState<string | null>(null);

  // Tab 3: Sync Keys from Admin Reference state
  const [isLoadingSync, setIsLoadingSync] = useState(false);
  const [syncPreview, setSyncPreview] = useState<SyncExamKeysResult | null>(null);
  const [syncOverrides, setSyncOverrides] = useState<Record<string, number>>({});
  const [syncError, setSyncError] = useState<string | null>(null);
  const [confirmSyncChecked, setConfirmSyncChecked] = useState(false);
  const [regradeAfterSync, setRegradeAfterSync] = useState(true);

  // Regrade / Migrate feedback banner
  const [isRegrading, setIsRegrading] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [actionBanner, setActionBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (initialExamId) {
      setSelectedExamId(initialExamId);
    } else if (exams.length > 0 && !selectedExamId) {
      const yusuf = exams.find((e) => e.id.includes('1792050086667') || e.title.includes('يوسف'));
      setSelectedExamId(yusuf ? yusuf.id : exams[0].id);
    }
  }, [initialExamId, exams]);

  // Clear stale reports when switching exam
  useEffect(() => {
    setReport(null);
    setTraceReport(null);
    setSelectedAttemptId('');
    setExpandedQuestionId(null);
    setSyncPreview(null);
    setSyncOverrides({});
    setConfirmSyncChecked(false);
    setAuditError(null);
    setTraceError(null);
    setSyncError(null);
    setActionBanner(null);
  }, [selectedExamId]);

  const getToken = async () => {
    const user = auth.currentUser;
    if (!user) throw new Error('يرجى تسجيل الدخول كمسؤول أولاً');
    return user.getIdToken();
  };

  const runIntegrityAudit = async (targetId = selectedExamId) => {
    if (!targetId) return;
    setIsLoadingAudit(true);
    setAuditError(null);
    setActionBanner(null);

    try {
      const token = await getToken();
      const response = await fetch(`/api/admin/exam-integrity?examId=${encodeURIComponent(targetId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'فشل فحص سلامة الامتحان');
      }
      setReport(data.report || data);
    } catch (err: any) {
      console.error('Audit failed:', err);
      setAuditError(err.message || 'حدث خطأ أثناء إجراء الفحص');
    } finally {
      setIsLoadingAudit(false);
    }
  };

  const runGradingTrace = async (targetExamId = selectedExamId, targetAttemptId = selectedAttemptId) => {
    if (!targetExamId) return;
    setIsLoadingTrace(true);
    setTraceError(null);
    try {
      const token = await getToken();
      const qs = new URLSearchParams({ examId: targetExamId });
      if (targetAttemptId) qs.set('attemptId', targetAttemptId);
      const response = await fetch(`/api/admin/grading-trace?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'فشل تتبع التصحيح');
      }
      setTraceReport(data);
      if (!targetAttemptId && data.selectedAttempt?.id) {
        setSelectedAttemptId(data.selectedAttempt.id);
      }
      if (!expandedQuestionId && data.traceRows?.length > 0) {
        setExpandedQuestionId(data.traceRows[0].questionId);
      }
    } catch (err: any) {
      setTraceError(err.message || 'حدث خطأ أثناء تتبع التصحيح');
    } finally {
      setIsLoadingTrace(false);
    }
  };

  const runSyncPreview = async (overridesMap = syncOverrides) => {
    if (!selectedExamId) return;
    setIsLoadingSync(true);
    setSyncError(null);
    setConfirmSyncChecked(false);
    try {
      const token = await getToken();
      const response = await fetch('/api/admin/sync-exam-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          examId: selectedExamId,
          confirm: false,
          overrides: overridesMap,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'فشل معاينة تعارضات المفاتيح');
      }
      setSyncPreview(data);
    } catch (err: any) {
      setSyncError(err.message || 'تعذر تحميل معاينة المفاتيح');
    } finally {
      setIsLoadingSync(false);
    }
  };

  const handleConfirmSyncBatch = async () => {
    if (!selectedExamId || !confirmSyncChecked) return;
    setIsLoadingSync(true);
    setSyncError(null);
    setActionBanner(null);
    try {
      const token = await getToken();
      const response = await fetch('/api/admin/sync-exam-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          examId: selectedExamId,
          confirm: true,
          regradeAttempts: regradeAfterSync,
          overrides: syncOverrides,
        }),
      });
      const data: SyncExamKeysResult = await response.json();
      if (!response.ok) {
        throw new Error((data as any).error || 'فشل تنفيذ كتابة المفاتيح');
      }
      if (!data.batchWriteSucceeded && data.batchWriteError) {
        throw new Error(data.batchWriteError);
      }
      setSyncPreview(data);
      setConfirmSyncChecked(false);
      setActionBanner({
        type: 'success',
        text: `تم توحيد ${data.conflictsCount} سؤال في Batch واحد وتحديث إصدار الامتحان من v${data.previousVersion} إلى v${data.newVersion}${
          data.regradeResult ? ` + إعادة تصحيح ${data.regradeResult.regradedCount} محاولة` : ''
        }.`,
      });
    } catch (err: any) {
      setSyncError(err.message || 'حدث خطأ أثناء تنفيذ الإصلاح');
    } finally {
      setIsLoadingSync(false);
    }
  };

  const handleRegradeAll = async () => {
    if (!selectedExamId) return;
    setIsRegrading(true);
    setActionBanner(null);
    try {
      const token = await getToken();
      const response = await fetch('/api/admin/regrade-exam', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ examId: selectedExamId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'فشلت عملية إعادة التصحيح');
      }
      setActionBanner({
        type: 'success',
        text: `تمت إعادة تصحيح ${data.regradedCount} من أصل ${data.totalAttemptsFound} محاولة بنجاح.`,
      });
      if (activeTab === 'trace') {
        await runGradingTrace(selectedExamId, selectedAttemptId);
      }
    } catch (err: any) {
      setActionBanner({ type: 'error', text: 'خطأ أثناء إعادة التصحيح: ' + err.message });
    } finally {
      setIsRegrading(false);
    }
  };

  const handleMigrateEmbedded = async () => {
    setIsMigrating(true);
    setActionBanner(null);
    try {
      const token = await getToken();
      const response = await fetch('/api/admin/migrate-embedded-exams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ dryRun: false }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'فشلت مزامنة الامتحانات المضمنة');
      }
      setActionBanner({
        type: 'success',
        text: `تمت مزامنة ${data.migratedExams?.length || 0} امتحانات مضمنة (${data.totalKeysMigrated || 0} مفتاح).`,
      });
    } catch (err: any) {
      setActionBanner({ type: 'error', text: 'خطأ في المزامنة: ' + err.message });
    } finally {
      setIsMigrating(false);
    }
  };

  const handleSwitchTab = (tab: ModalTab) => {
    setActiveTab(tab);
    if (tab === 'trace' && !traceReport && !isLoadingTrace) {
      runGradingTrace(selectedExamId, selectedAttemptId);
    } else if (tab === 'sync' && !syncPreview && !isLoadingSync) {
      runSyncPreview(syncOverrides);
    } else if (tab === 'audit' && !report && !isLoadingAudit) {
      runIntegrityAudit(selectedExamId);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-[#0c101c] w-full max-w-6xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-4 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/70 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                <span>مركز فحص سلامة الامتحانات وتتبع التصحيح</span>
                <span className="text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold px-2 py-0.5 rounded-full">
                  خادم آمن • قراءة ومزامنة
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                فحص Dry-Run + تتبّع التصحيح لكل محاولة (قراءة فقط) + إصلاح وتوحيد المفاتيح من شاشة الإدارة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Exam Selector + Tabs */}
        <div className="p-4 sm:px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c101c] space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0">
                الامتحان:
              </label>
              <div className="relative flex-1">
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none pl-8"
                >
                  <option value="exam_1792050086667_12ri">
                    ⭐ اختبار سورة يوسف (اشتدي أزمة تنفرجي) - [exam_1792050086667_12ri]
                  </option>
                  {exams
                    .filter((e) => e.id !== 'exam_1792050086667_12ri')
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.title} ({e.subjectNameAr || e.subject}) - [{e.id}]
                      </option>
                    ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {activeTab === 'audit' && (
                <button
                  onClick={() => runIntegrityAudit()}
                  disabled={isLoadingAudit || !selectedExamId}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  {isLoadingAudit ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>تشغيل الفحص الآن</span>
                </button>
              )}
              {activeTab === 'trace' && (
                <button
                  onClick={() => runGradingTrace(selectedExamId, selectedAttemptId)}
                  disabled={isLoadingTrace || !selectedExamId}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  {isLoadingTrace ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                  <span>تحديث التتبّع</span>
                </button>
              )}
              {activeTab === 'sync' && (
                <button
                  onClick={() => runSyncPreview(syncOverrides)}
                  disabled={isLoadingSync || !selectedExamId}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  {isLoadingSync ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCompare className="w-4 h-4" />}
                  <span>معاينة التعارضات</span>
                </button>
              )}
            </div>
          </div>

          {/* Tool Navigation Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => handleSwitchTab('audit')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'audit'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>فحص السلامة (Dry-Run)</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchTab('trace')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'trace'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>تتبّع التصحيح (قراءة فقط)</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchTab('sync')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'sync'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>إصلاح المفاتيح من شاشة الإدارة</span>
            </button>
          </div>
        </div>

        {/* Action Banner */}
        {actionBanner && (
          <div
            className={`px-6 py-3 border-b text-xs font-bold flex items-center justify-between gap-3 ${
              actionBanner.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
            }`}
          >
            <span>{actionBanner.text}</span>
            <button onClick={() => setActionBanner(null)} className="cursor-pointer opacity-70 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 p-5 sm:p-6 overflow-y-auto space-y-6">
          {/* ================= TAB 1: AUDIT DRY-RUN ================= */}
          {activeTab === 'audit' && (
            <>
              {auditError && (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <div>
                    <p className="font-bold">فشل تشغيل فحص السلامة:</p>
                    <p className="mt-0.5">{auditError}</p>
                  </div>
                </div>
              )}

              {!report && !isLoadingAudit && !auditError && (
                <div className="text-center py-14 space-y-3">
                  <div className="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40 text-blue-600 flex items-center justify-center mx-auto">
                    <ShieldCheck className="w-8 h-8" />
                  </div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    اضغط "تشغيل الفحص الآن" لاختبار الامتحان
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    يختبر الخادم كافة الأسئلة، وجود التعارضات بين questions وanswerKeys، ومحاكاة التصحيح 100% و0% و50% وخيار Index 0 بدون أي تعديل.
                  </p>
                </div>
              )}

              {isLoadingAudit && (
                <div className="text-center py-16 space-y-3">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    جارٍ فحص الامتحان ومحاكاة سيناريوهات التصحيح...
                  </p>
                </div>
              )}

              {report && !isLoadingAudit && (
                <div className="space-y-6">
                  {/* Overview Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                      <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        الأسئلة والمفاتيح
                      </div>
                      <div className="text-lg font-black text-slate-900 dark:text-white mt-1">
                        {report.questionCount} سؤال / {report.answerKeysCount} مفتاح
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        تعارضات: {report.keyConflictsCount} • إصدار: v{report.version}
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                      <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        سرية الإجابات
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        {report.secretLeakTest.passed ? (
                          <>
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">محمية</span>
                          </>
                        ) : (
                          <>
                            <ShieldAlert className="w-5 h-5 text-amber-500" />
                            <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                              موجودة في questions ({report.secretLeakTest.leakedFields.length})
                            </span>
                          </>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {report.hasServiceAccount ? 'Service Account: مفعّل' : 'وضع REST: تأكد من تطابق questions & answerKeys'}
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                      <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        الحالة العامة
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        {report.overallStatus === 'pass' ? (
                          <>
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">سليم 100%</span>
                          </>
                        ) : report.overallStatus === 'warning' ? (
                          <>
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                            <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                              ملاحظات ({report.warnings.length})
                            </span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-5 h-5 text-rose-500" />
                            <span className="text-sm font-bold text-rose-600 dark:text-rose-400">
                              أخطاء ({report.errors.length})
                            </span>
                          </>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 truncate" title={report.questionIdPattern}>
                        نمط المعرفات: {report.questionIdPattern}
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                      <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        حالة النشر والمصدر
                      </div>
                      <div className="text-sm font-black text-slate-900 dark:text-white mt-1">
                        {report.published ? '🟢 منشور للطلاب' : '⚪ غير منشور'}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        المصدر: {report.source === 'firestore' ? 'Firestore' : 'بيانات مضمنة'}
                      </div>
                    </div>
                  </div>

                  {/* Dry-Run Grading Simulation */}
                  <div className="p-5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-blue-600" />
                        <span>نتائج محاكاة التصحيح الفعلي (examGrader.ts)</span>
                      </h4>
                      <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                        {report.dryRunGrading.details}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                      <div className="p-3.5 rounded-xl bg-white dark:bg-[#0c101c] border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">جميعها صح (100%)</div>
                          <div className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 mt-1">
                            {report.dryRunGrading.perfectScore ?? '-'}%
                          </div>
                        </div>
                        {report.dryRunGrading.perfectScorePassed ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-rose-500" />
                        )}
                      </div>

                      <div className="p-3.5 rounded-xl bg-white dark:bg-[#0c101c] border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">جميعها خطأ (0%)</div>
                          <div className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 mt-1">
                            {report.dryRunGrading.zeroScore ?? '-'}%
                          </div>
                        </div>
                        {report.dryRunGrading.zeroScorePassed ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-rose-500" />
                        )}
                      </div>

                      <div className="p-3.5 rounded-xl bg-white dark:bg-[#0c101c] border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">نصف الإجابات (50%)</div>
                          <div className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 mt-1">
                            {report.dryRunGrading.halfScore ?? '-'}%
                          </div>
                        </div>
                        {report.dryRunGrading.halfScorePassed ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-rose-500" />
                        )}
                      </div>

                      <div className="p-3.5 rounded-xl bg-white dark:bg-[#0c101c] border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">السؤال 1 + فهرس 0</div>
                          <div className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-1">
                            {report.dryRunGrading.q1GradedCorrectly ? 'س1 مطابق' : 'خلل س1'}
                          </div>
                        </div>
                        {report.dryRunGrading.zeroIndexAnswerPassed && report.dryRunGrading.q1GradedCorrectly ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-rose-500" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-slate-600 dark:text-slate-300">
                      <span className="font-bold">إجراءات سريعة:</span>
                      <span className="text-[11px] text-slate-500 block">
                        استخدم تبويب "إصلاح المفاتيح" لمعاينة أي تعارض قبل تعديل المحاولات.
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => handleSwitchTab('sync')}
                        className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        <span>إصلاح المفاتيح من شاشة الإدارة ({report.keyConflictsCount})</span>
                      </button>

                      <button
                        onClick={handleRegradeAll}
                        disabled={isRegrading}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        {isRegrading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        <span>إعادة تصحيح المحاولات</span>
                      </button>

                      <button
                        onClick={handleMigrateEmbedded}
                        disabled={isMigrating}
                        className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        {isMigrating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                        <span>مزامنة المضمنة</span>
                      </button>
                    </div>
                  </div>

                  {/* Detailed Questions Table */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-blue-600" />
                      <span>جدول الأسئلة والمفاتيح ({report.questions.length} سؤال)</span>
                    </h4>
                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-100 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="p-3">#</th>
                            <th className="p-3">ID السؤال</th>
                            <th className="p-3">النص</th>
                            <th className="p-3">questions</th>
                            <th className="p-3">answerKeys</th>
                            <th className="p-3">المعتمد</th>
                            <th className="p-3">المصدر</th>
                            <th className="p-3">النص الصحيح</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                          {report.questions.map((q) => (
                            <tr
                              key={q.id}
                              className={`${
                                q.hasConflict
                                  ? 'bg-rose-50/50 dark:bg-rose-950/20'
                                  : q.order === 1
                                    ? 'bg-amber-50/30 dark:bg-amber-950/15'
                                    : ''
                              }`}
                            >
                              <td className="p-3 font-bold">{q.order}</td>
                              <td className="p-3 font-mono text-[11px]">{q.id}</td>
                              <td className="p-3 max-w-xs truncate" title={q.questionText}>{q.questionText}</td>
                              <td className="p-3 font-mono">
                                {q.qDocKey !== null ? `opt_${q.qDocKey}` : <span className="text-slate-400">-</span>}
                              </td>
                              <td className="p-3 font-mono">
                                {q.answerKeyDocKey !== null ? `opt_${q.answerKeyDocKey}` : <span className="text-rose-500">مفقود</span>}
                              </td>
                              <td className="p-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                {q.resolvedKey !== null ? `opt_${q.resolvedKey}` : 'غير صالح'}
                              </td>
                              <td className="p-3 text-[11px]">{q.keySource}</td>
                              <td className="p-3 max-w-xs truncate">{q.correctOptionText || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ================= TAB 2: GRADING TRACE ================= */}
          {activeTab === 'trace' && (
            <div className="space-y-5">
              {traceError && (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{traceError}</span>
                </div>
              )}

              {isLoadingTrace && (
                <div className="text-center py-16 space-y-3">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    جارٍ جلب تتبّع التصحيح بصلاحيات القراءة الآمنة...
                  </p>
                </div>
              )}

              {traceReport && !isLoadingTrace && (
                <>
                  {/* Server Warning if no Service Account */}
                  {traceReport.serverEnvironment.studentReadWarning && (
                    <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{traceReport.serverEnvironment.studentReadWarning}</span>
                    </div>
                  )}

                  {/* Question ID Pattern & Grader Mapping Card + Attempt Selector */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/70 dark:border-indigo-900/50 space-y-2">
                      <div className="text-xs font-black text-indigo-900 dark:text-indigo-200">
                        نمط معرفات الأسئلة ومنطق ربط المصحح
                      </div>
                      <div className="text-xs text-slate-700 dark:text-slate-300">
                        <span className="font-bold">النمط المكتشف: </span>
                        <span className="font-mono text-indigo-700 dark:text-indigo-300">
                          {traceReport.questionIdPattern.detectedPattern}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400">
                        {traceReport.questionIdPattern.mappingLogic}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 truncate">
                        عينات: {traceReport.questionIdPattern.sampleIds.join(' | ')}
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
                      <label className="block text-xs font-black text-slate-800 dark:text-slate-200">
                        اختر محاولة طالب لتتبّع إجاباتها ({traceReport.attempts.length} محاولة):
                      </label>
                      <select
                        value={selectedAttemptId}
                        onChange={(e) => {
                          const nextId = e.target.value;
                          setSelectedAttemptId(nextId);
                          runGradingTrace(selectedExamId, nextId);
                        }}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-200"
                      >
                        <option value="">-- عرض مفاتيح الامتحان فقط بدون محاولة --</option>
                        {traceReport.attempts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.userDisplayName} | الحالة: {a.status} | العلامة: {a.score ?? '-'}% | {a.id}
                          </option>
                        ))}
                      </select>
                      {traceReport.selectedAttempt && (
                        <div className="text-[11px] text-slate-500 flex items-center gap-3 flex-wrap">
                          <span>المحاولة: <strong className="font-mono">{traceReport.selectedAttempt.id}</strong></span>
                          <span>العلامة المسجلة: <strong>{traceReport.selectedAttempt.score ?? '-'}%</strong></span>
                          <span>إجابات مسجلة: <strong>{traceReport.selectedAttempt.answersCount}</strong></span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Trace Questions Table */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-900/90 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="p-3">#</th>
                          <th className="p-3">إجابة الطالب الخام ← optionId</th>
                          <th className="p-3">answerKeys</th>
                          <th className="p-3">شاشة الإدارة</th>
                          <th className="p-3">نتيجة المقارنة</th>
                          <th className="p-3">المصدر والـ Fallback</th>
                          <th className="p-3 text-center">تفاصيل الخيارات 4</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {traceReport.traceRows.map((row: GradingTraceQuestionRow) => {
                          const isExpanded = expandedQuestionId === row.questionId;
                          return (
                            <React.Fragment key={row.questionId}>
                              <tr
                                className={`hover:bg-slate-50 dark:hover:bg-slate-900/40 ${
                                  row.order === 1 ? 'bg-amber-50/40 dark:bg-amber-950/15' : ''
                                } ${row.hasConflict ? 'bg-rose-50/40 dark:bg-rose-950/15' : ''}`}
                              >
                                <td className="p-3 font-bold">
                                  <div>{row.order}</div>
                                  <div className="text-[10px] font-mono text-slate-400">{row.questionId}</div>
                                </td>
                                <td className="p-3 font-mono text-[11px]">
                                  {row.rawStudentAnswer !== null && row.rawStudentAnswer !== undefined
                                    ? `${JSON.stringify(row.rawStudentAnswer)} → ${row.convertedOptionId ?? 'غير صالح'}`
                                    : <span className="text-slate-400">بلا إجابة</span>}
                                </td>
                                <td className="p-3 font-mono text-[11px]">
                                  {row.answerKeysOptionId || <span className="text-rose-500">مفقود</span>}
                                  {row.questionsDocOptionId && row.questionsDocOptionId !== row.answerKeysOptionId && (
                                    <span className="block text-[10px] text-amber-600">
                                      questions: {row.questionsDocOptionId}
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400">
                                  {row.adminEditorOptionId || 'مفقود'}
                                </td>
                                <td className="p-3">
                                  {row.isCorrect === null ? (
                                    <span className="text-slate-400">-</span>
                                  ) : row.isCorrect ? (
                                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                                      <CheckCircle2 className="w-3.5 h-3.5" /> صح
                                    </span>
                                  ) : row.isUnanswered ? (
                                    <span className="text-slate-500 font-bold">متروك</span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
                                      <XCircle className="w-3.5 h-3.5" /> خطأ
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-[11px] max-w-xs">
                                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                    {row.graderSourceUsed}
                                  </span>
                                  <span className="block text-[10px] text-slate-500">{row.fallbackNote}</span>
                                </td>
                                <td className="p-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedQuestionId(isExpanded ? null : row.questionId)
                                    }
                                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <span>{isExpanded ? 'إخفاء' : 'فحص الخيارات'}</span>
                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                  </button>
                                </td>
                              </tr>

                              {isExpanded && (
                                <tr className="bg-slate-50/80 dark:bg-slate-900/60">
                                  <td colSpan={7} className="p-4 space-y-3">
                                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                                      س{row.order}: {row.questionText}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                      {row.optionsTrace.map((opt) => (
                                        <div
                                          key={opt.optionId}
                                          className={`p-3 rounded-xl border text-xs flex flex-col gap-1.5 ${
                                            opt.isKeyInAdminEditor
                                              ? 'border-emerald-400 dark:border-emerald-700 bg-emerald-50/70 dark:bg-emerald-950/30'
                                              : opt.isStudentPick
                                                ? 'border-blue-400 dark:border-blue-700 bg-blue-50/70 dark:bg-blue-950/30'
                                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="font-mono font-bold text-[11px] text-slate-500">
                                              {opt.optionId} (index {opt.index})
                                            </span>
                                            <div className="flex items-center gap-1 flex-wrap">
                                              {opt.isStudentPick && (
                                                <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white text-[10px] font-bold">
                                                  اختيار الطالب
                                                </span>
                                              )}
                                              {opt.isKeyInAnswerKeys && (
                                                <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold">
                                                  answerKeys
                                                </span>
                                              )}
                                              {opt.isKeyInQuestions && (
                                                <span className="px-1.5 py-0.5 rounded bg-amber-600 text-white text-[10px] font-bold">
                                                  questions
                                                </span>
                                              )}
                                              {opt.isKeyInOverride && (
                                                <span className="px-1.5 py-0.5 rounded bg-purple-600 text-white text-[10px] font-bold">
                                                  override
                                                </span>
                                              )}
                                              {opt.isKeyInGrader && (
                                                <span className="px-1.5 py-0.5 rounded bg-slate-800 dark:bg-white text-white dark:text-slate-900 text-[10px] font-bold">
                                                  المصحح
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          <div className="font-medium text-slate-800 dark:text-slate-200">
                                            {opt.text}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ================= TAB 3: SYNC EXAM KEYS ================= */}
          {activeTab === 'sync' && (
            <div className="space-y-5">
              {syncError && (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{syncError}</span>
                </div>
              )}

              {isLoadingSync && (
                <div className="text-center py-16 space-y-3">
                  <Loader2 className="w-8 h-8 text-amber-600 animate-spin mx-auto" />
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    جارٍ مطابقة مفاتيح الإدارة مع answerKeys وquestions...
                  </p>
                </div>
              )}

              {syncPreview && !isLoadingSync && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-black text-slate-900 dark:text-white">
                        {syncPreview.examTitle} — الإصدار الحالي: v{syncPreview.previousVersion}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        الأسئلة المتعارضة أو الناقصة: <strong>{syncPreview.conflictsCount}</strong> من أصل {syncPreview.totalQuestions} سؤال
                      </div>
                    </div>

                    {syncPreview.conflictsCount === 0 && (
                      <span className="px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>جميع المفاتيح متطابقة ولا توجد تعارضات</span>
                      </span>
                    )}
                  </div>

                  {syncPreview.conflicts.length > 0 && (
                    <>
                      <div className="space-y-3">
                        {syncPreview.conflicts.map((c) => (
                          <div
                            key={c.questionId}
                            className="p-4 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/10 space-y-3"
                          >
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <div>
                                <span className="text-xs font-black text-amber-800 dark:text-amber-300">
                                  س{c.order} ({c.questionId})
                                </span>
                                <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                                  {c.questionText}
                                </p>
                                <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                                  السبب: {c.reason}
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                              <div className="p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                                <div className="text-[10px] font-bold text-slate-400 mb-1">قبل الإصلاح:</div>
                                <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300">
                                  answerKeys: {c.before.answerKeysIndex !== null ? `opt_${c.before.answerKeysIndex}` : 'مفقود'} | questions: {c.before.questionsDocIndex !== null ? `opt_${c.before.questionsDocIndex}` : 'غير موجود'}
                                </div>
                                <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-1">
                                  {c.before.optionText}
                                </div>
                              </div>

                              <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800">
                                <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 mb-1">
                                  بعد الإصلاح (المرجع المعتمد للكتابة):
                                </div>
                                <select
                                  value={syncOverrides[c.questionId] ?? c.after.targetIndex}
                                  onChange={(e) => {
                                    const next = { ...syncOverrides, [c.questionId]: Number(e.target.value) };
                                    setSyncOverrides(next);
                                    runSyncPreview(next);
                                  }}
                                  className="w-full bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-emerald-900 dark:text-emerald-100"
                                >
                                  {c.options.map((optText, i) => (
                                    <option key={i} value={i}>
                                      opt_{i} — {optText}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Confirmation Bar */}
                      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                        <label className="flex items-center gap-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={confirmSyncChecked}
                            onChange={(e) => setConfirmSyncChecked(e.target.checked)}
                            className="w-4 h-4 rounded accent-amber-600"
                          />
                          <span>
                            أؤكد كتابة مفاتيح الأسئلة المتعارضة فقط في Batch واحد وزيادة رقم الإصدار (v{syncPreview.previousVersion} ← v{syncPreview.previousVersion + 1})
                          </span>
                        </label>

                        <label className="flex items-center gap-2.5 text-xs font-medium text-slate-600 dark:text-slate-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={regradeAfterSync}
                            onChange={(e) => setRegradeAfterSync(e.target.checked)}
                            className="w-4 h-4 rounded accent-emerald-600"
                          />
                          <span>إعادة تصحيح المحاولات السابقة تلقائياً فور حفظ المفاتيح</span>
                        </label>

                        <div className="flex items-center gap-2 pt-1 flex-wrap">
                          <button
                            type="button"
                            disabled={!confirmSyncChecked || isLoadingSync}
                            onClick={handleConfirmSyncBatch}
                            className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm"
                          >
                            {isLoadingSync ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            <span>تأكيد الإصلاح في Batch واحد</span>
                          </button>

                          <button
                            type="button"
                            disabled={isRegrading}
                            onClick={handleRegradeAll}
                            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
                          >
                            {isRegrading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            <span>إعادة تصحيح المحاولات فقط</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500">
            تبويب "فحص السلامة" و"تتبّع التصحيح" يعملان بوضع القراءة فقط (Dry-Run) دون المساس بدرجات الطلاب.
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
