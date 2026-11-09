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
  Search,
  BookOpen,
  ArrowRight,
  Database,
  Lock,
  Layers,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { auth } from '../../lib/firebase';
import type { Exam } from '../../types';

interface AdminExamIntegrityModalProps {
  isOpen: boolean;
  onClose: () => void;
  exams: Exam[];
  initialExamId?: string;
}

interface IntegrityReport {
  examId: string;
  examTitle: string;
  published: boolean;
  questionCount: number;
  answerKeysCount: number;
  isCompliant: boolean;
  anomalies: string[];
  secretLeakTest: {
    passed: boolean;
    details: string;
  };
  simulationTests: {
    test100Percent: { passed: boolean; score: number; maxScore: number; details: string };
    test0Percent: { passed: boolean; score: number; maxScore: number; details: string };
    test50Percent: { passed: boolean; score: number; maxScore: number; details: string };
    testOptionZeroIndex: { passed: boolean; score: number; maxScore: number; details: string };
  };
  questionDetails: Array<{
    id: string;
    order: number;
    text: string;
    optionsCount: number;
    options: string[];
    qDocKey: number | null;
    answerKeyDocKey: number | null;
    resolvedKey: number | null;
    isValid: boolean;
    issue?: string;
  }>;
}

export const AdminExamIntegrityModal: React.FC<AdminExamIntegrityModalProps> = ({
  isOpen,
  onClose,
  exams,
  initialExamId,
}) => {
  const [selectedExamId, setSelectedExamId] = useState<string>(
    initialExamId || 'exam_1792050086667_12ri'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<IntegrityReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Action states
  const [isRegrading, setIsRegrading] = useState(false);
  const [regradeResult, setRegradeResult] = useState<any | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<any | null>(null);

  useEffect(() => {
    if (initialExamId) {
      setSelectedExamId(initialExamId);
    } else if (exams.length > 0 && !selectedExamId) {
      // Find surah yusuf or first exam
      const yusuf = exams.find((e) => e.id.includes('1792050086667') || e.title.includes('يوسف'));
      setSelectedExamId(yusuf ? yusuf.id : exams[0].id);
    }
  }, [initialExamId, exams]);

  const runIntegrityAudit = async (targetId = selectedExamId) => {
    if (!targetId) return;
    setIsLoading(true);
    setError(null);
    setRegradeResult(null);
    setMigrationResult(null);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('يرجى تسجيل الدخول كمسؤول أولاً');
      const token = await user.getIdToken();

      const response = await fetch(`/api/admin/exam-integrity?examId=${encodeURIComponent(targetId)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'فشل فحص سلامة الامتحان');
      }

      setReport(data.report);
    } catch (err: any) {
      console.error('Audit failed:', err);
      setError(err.message || 'حدث خطأ أثناء إجراء الفحص');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegradeAll = async () => {
    if (!selectedExamId) return;
    if (
      !window.confirm(
        'هل أنت متأكد من إعادة تصحيح جميع محاولات الطلاب لهذا الامتحان؟\nسيتم تحديث العلامات والنقاط تلقائيًا وتعديل الترتيب.'
      )
    ) {
      return;
    }

    setIsRegrading(true);
    setRegradeResult(null);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('يرجى تسجيل الدخول أولاً');
      const token = await user.getIdToken();

      const response = await fetch('/api/admin/regrade-exam', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          examId: selectedExamId,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'فشلت عملية إعادة التصحيح');
      }

      setRegradeResult(data);
      alert(
        `تمت إعادة تصحيح المحاولات بنجاح!\n• عدد المحاولات المصححة: ${data.regradedCount}\n• المحاولات المتأثرة بتعديل الدرجات: ${data.affectedAttemptsCount}`
      );
    } catch (err: any) {
      alert('خطأ أثناء إعادة التصحيح: ' + err.message);
    } finally {
      setIsRegrading(false);
    }
  };

  const handleMigrateEmbedded = async (dryRun = true) => {
    setIsMigrating(true);
    setMigrationResult(null);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('يرجى تسجيل الدخول أولاً');
      const token = await user.getIdToken();

      const response = await fetch('/api/admin/migrate-embedded-exams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          dryRun,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'فشلت عملية الهجرة');
      }

      setMigrationResult(data);
    } catch (err: any) {
      alert('خطأ في الهجرة: ' + err.message);
    } finally {
      setIsMigrating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-[#0c101c] w-full max-w-5xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-8 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>فحص سلامة الامتحانات والتصحيح (Dry-Run)</span>
                <span className="text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold px-2 py-0.5 rounded-full">
                  خادم آمن • قراءة فقط
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                فحص تطابق مفاتيح الإجابات، كشف تسريب الإجابات، ومحاكاة التصحيح الحسابي بنسب (100%، 50%، 0%، وخيار 0)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Controls Bar */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c101c] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0">
              اختر الامتحان للفحص:
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

          <div className="flex items-center gap-2">
            <button
              onClick={() => runIntegrityAudit()}
              disabled={isLoading || !selectedExamId}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer shadow-sm shadow-blue-500/20"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              <span>تشغيل الفحص الآن</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-bold">فشل تشغيل فحص السلامة:</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {!report && !isLoading && !error && (
            <div className="text-center py-16 space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40 text-blue-600 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                اختر امتحانًا واضغط "تشغيل الفحص الآن"
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                سيقوم الخادم باختبار سلامة كافة أسئلة الامتحان وخياراتها ومفاتيح الإجابات في subcollection answerKeys ومحاكاة التصحيح الآلي بدون إحداث أي تغييرات.
              </p>
            </div>
          )}

          {isLoading && (
            <div className="text-center py-20 space-y-4">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                جاري فحص الامتحان ومحاكاة سيناريوهات التصحيح الأربعة...
              </p>
            </div>
          )}

          {report && !isLoading && (
            <div className="space-y-6">
              {/* Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    عدد الأسئلة والمفاتيح
                  </div>
                  <div className="text-lg font-black text-slate-900 dark:text-white mt-1">
                    {report.questionCount} أسئلة / {report.answerKeysCount} مفاتيح
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {report.answerKeysCount === report.questionCount
                      ? '✓ كافة الأسئلة تملك مفاتيح إجابة'
                      : '⚠️ يوجد نقص في مفاتيح الإجابة'}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    أمان وسرية الإجابات
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    {report.secretLeakTest.passed ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          محمية بالكامل
                        </span>
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-5 h-5 text-rose-500" />
                        <span className="text-sm font-bold text-rose-600 dark:text-rose-400">
                          تسريب محتمل
                        </span>
                      </>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {report.secretLeakTest.details}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    مطابقة الخوارزمية (Compliance)
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    {report.isCompliant ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          سليم وجاهز 100%
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                          بحاجة لمعالجة ({report.anomalies.length})
                        </span>
                      </>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {report.anomalies.length === 0
                      ? 'لا توجد أي تناقضات أو أخطاء'
                      : report.anomalies[0]}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    حالة النشر الحالية
                  </div>
                  <div className="text-sm font-black text-slate-900 dark:text-white mt-1">
                    {report.published ? '🟢 منشور للطلاب' : '⚪ مسودة / غير منشور'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    معرف: {report.examId}
                  </div>
                </div>
              </div>

              {/* Simulation Tests Grid */}
              <div className="p-5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span>نتائج محاكاة سيناريوهات التصحيح الأربعة (Simulated Grading Tests)</span>
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                  {/* Test 100% */}
                  <div className="p-3.5 rounded-xl bg-white dark:bg-[#0c101c] border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                        اختبار العلامة الكاملة (100%)
                      </span>
                      {report.simulationTests.test100Percent.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-500" />
                      )}
                    </div>
                    <div className="text-xs font-bold text-blue-600 dark:text-blue-400">
                      النتيجة: {report.simulationTests.test100Percent.score} /{' '}
                      {report.simulationTests.test100Percent.maxScore}
                    </div>
                    <p className="text-[10px] text-slate-500">
                      {report.simulationTests.test100Percent.details}
                    </p>
                  </div>

                  {/* Test 0% */}
                  <div className="p-3.5 rounded-xl bg-white dark:bg-[#0c101c] border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                        اختبار الإجابات الخاطئة (0%)
                      </span>
                      {report.simulationTests.test0Percent.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-500" />
                      )}
                    </div>
                    <div className="text-xs font-bold text-blue-600 dark:text-blue-400">
                      النتيجة: {report.simulationTests.test0Percent.score} /{' '}
                      {report.simulationTests.test0Percent.maxScore}
                    </div>
                    <p className="text-[10px] text-slate-500">
                      {report.simulationTests.test0Percent.details}
                    </p>
                  </div>

                  {/* Test 50% */}
                  <div className="p-3.5 rounded-xl bg-white dark:bg-[#0c101c] border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                        اختبار نصف الإجابات (50%)
                      </span>
                      {report.simulationTests.test50Percent.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-500" />
                      )}
                    </div>
                    <div className="text-xs font-bold text-blue-600 dark:text-blue-400">
                      النتيجة: {report.simulationTests.test50Percent.score} /{' '}
                      {report.simulationTests.test50Percent.maxScore}
                    </div>
                    <p className="text-[10px] text-slate-500">
                      {report.simulationTests.test50Percent.details}
                    </p>
                  </div>

                  {/* Test Option Zero */}
                  <div className="p-3.5 rounded-xl bg-white dark:bg-[#0c101c] border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                        اختبار الخيار الأول (Option Index 0)
                      </span>
                      {report.simulationTests.testOptionZeroIndex.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-500" />
                      )}
                    </div>
                    <div className="text-xs font-bold text-blue-600 dark:text-blue-400">
                      النتيجة: {report.simulationTests.testOptionZeroIndex.score} /{' '}
                      {report.simulationTests.testOptionZeroIndex.maxScore}
                    </div>
                    <p className="text-[10px] text-slate-500">
                      {report.simulationTests.testOptionZeroIndex.details}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-bold">الإجراءات المتاحة لهذا الامتحان:</span>
                  <span className="text-[11px] text-slate-500 block">
                    يمكنك إعادة تصحيح جميع محاولات الطلاب لتعديل درجاتهم إذا كان هناك سؤال مصحح خطأً.
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleRegradeAll}
                    disabled={isRegrading}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
                  >
                    {isRegrading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    <span>إعادة تصحيح كافة محاولات هذا الامتحان</span>
                  </button>

                  <button
                    onClick={() => handleMigrateEmbedded(false)}
                    disabled={isMigrating}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
                  >
                    {isMigrating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Database className="w-4 h-4" />
                    )}
                    <span>مزامنة الامتحانات المضمّنة إلى Firestore</span>
                  </button>
                </div>
              </div>

              {/* Question-by-Question Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                    <span>تشخيص الأسئلة ومفاتيح الإجابات تفصيليًا ({report.questionDetails.length} سؤال)</span>
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    السؤال 1 في سورة يوسف يخضع لفحص دقيق للتأكد من استخدام المفتاح الصحيح
                  </span>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3">#</th>
                        <th className="p-3">نص السؤال</th>
                        <th className="p-3">عدد الخيارات</th>
                        <th className="p-3">المفتاح في السؤال</th>
                        <th className="p-3">المفتاح في answerKeys</th>
                        <th className="p-3">المفتاح المعتمد للتصحيح</th>
                        <th className="p-3">الخيار الصحيح المعتمد</th>
                        <th className="p-3 text-center">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                      {report.questionDetails.map((q) => {
                        const resolvedIdx = q.resolvedKey ?? -1;
                        const optionText =
                          resolvedIdx >= 0 && resolvedIdx < q.options.length
                            ? q.options[resolvedIdx]
                            : 'غير محدد أو خارج النطاق';

                        return (
                          <tr
                            key={q.id}
                            className={`hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors ${
                              q.order === 1 ? 'bg-amber-50/30 dark:bg-amber-950/20' : ''
                            }`}
                          >
                            <td className="p-3 font-bold text-slate-900 dark:text-white">
                              {q.order}
                              {q.order === 1 && (
                                <span className="mr-1 text-[9px] bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 rounded font-black">
                                  س1
                                </span>
                              )}
                            </td>
                            <td className="p-3 max-w-xs truncate" title={q.text}>
                              {q.text}
                            </td>
                            <td className="p-3">{q.optionsCount}</td>
                            <td className="p-3">
                              {q.qDocKey !== null ? (
                                <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                  {q.qDocKey}
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="p-3">
                              {q.answerKeyDocKey !== null ? (
                                <span className="font-mono bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded">
                                  {q.answerKeyDocKey}
                                </span>
                              ) : (
                                <span className="text-slate-400">غير موجود</span>
                              )}
                            </td>
                            <td className="p-3">
                              <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                                {q.resolvedKey !== null ? q.resolvedKey : 'مفقود'}
                              </span>
                            </td>
                            <td className="p-3 max-w-xs truncate font-medium text-slate-900 dark:text-white" title={optionText}>
                              {optionText}
                            </td>
                            <td className="p-3 text-center">
                              {q.isValid ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>سليم</span>
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400"
                                  title={q.issue}
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>{q.issue || 'خطأ'}</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            أداة فحص السلامة تعمل بنمط Dry-Run دون التعديل على محاولات الطلاب أو حساباتهم إلا عند الضغط الصريح على "إعادة تصحيح".
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
