import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  BookOpen,
  Clock,
  Award,
  Sparkles,
  HelpCircle,
  Layers,
  AlertTriangle,
} from 'lucide-react';
import { saveExamWithValidation, fetchQuestionBank, getAdminExamQuestions } from '../../lib/adminService';
import { auth } from '../../lib/firebase';
import type { Exam, SubjectId, QuestionBankItem, QuestionType } from '../../types';

interface AdminCreateExamModalProps {
  examToEdit?: Exam | null;
  onClose: () => void;
  onSaved: () => void;
}

interface EditableQuestion {
  id?: string;
  questionText: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  source: string;
  points: number;
  order: number;
  questionType: QuestionType;
}

export const AdminCreateExamModal: React.FC<AdminCreateExamModalProps> = ({
  examToEdit,
  onClose,
  onSaved,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'questions' | 'preview'>('overview');

  // Exam Meta Fields
  const [title, setTitle] = useState(examToEdit?.title || '');
  const [subject, setSubject] = useState<SubjectId>(examToEdit?.subject || 'physics');
  const [lesson, setLesson] = useState(examToEdit?.lesson || '');
  const [description, setDescription] = useState(examToEdit?.description || '');
  const [durationMinutes, setDurationMinutes] = useState(examToEdit?.durationMinutes || 20);
  const [totalPoints, setTotalPoints] = useState(examToEdit?.totalPoints || 100);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>(examToEdit?.difficulty || 'medium');
  const [branch, setBranch] = useState<'مشترك' | 'علمي' | 'أدبي'>((examToEdit as any)?.branch || 'مشترك');
  const [published, setPublished] = useState(examToEdit?.published || false);
  const [allowRetake, setAllowRetake] = useState(examToEdit?.allowRetake ?? false);

  // Questions List
  const [questions, setQuestions] = useState<EditableQuestion[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);

  // Validation & Saving State
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [notifyStudentsOnEdit, setNotifyStudentsOnEdit] = useState<boolean>(true);

  // Load existing questions if editing
  useEffect(() => {
    if (examToEdit?.id) {
      setIsLoadingQuestions(true);
      getAdminExamQuestions(examToEdit.id)
        .then((loaded) => {
          if (loaded && loaded.length > 0) {
            setQuestions(
              loaded.map((q, idx) => ({
                id: q.id,
                questionText: q.questionText,
                options: q.options && q.options.length >= 2 ? q.options : ['أ', 'ب', 'ج', 'د'],
                correctAnswer: typeof q.correctAnswer === 'number' ? q.correctAnswer : 0,
                explanation: q.explanation || '',
                difficulty: q.difficulty || 'medium',
                source: q.source || 'أريكسون 2009',
                points: q.points || 5,
                order: idx + 1,
                questionType: q.questionType || 'multiple_choice',
              }))
            );
          } else {
            // Provide at least one default question template
            addBlankQuestion();
          }
        })
        .catch((err) => {
          console.warn('Error loading admin exam questions:', err);
          addBlankQuestion();
        })
        .finally(() => setIsLoadingQuestions(false));
    } else {
      addBlankQuestion();
    }
  }, [examToEdit]);

  const addBlankQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        questionText: '',
        options: ['', '', '', ''],
        correctAnswer: 0,
        explanation: '',
        difficulty: 'medium',
        source: 'أريكسون 2009',
        points: 5,
        order: prev.length + 1,
        questionType: 'multiple_choice',
      },
    ]);
  };

  const updateQuestion = (index: number, updates: Partial<EditableQuestion>) => {
    setQuestions((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updates };
      return copy;
    });
  };

  const updateQuestionOption = (qIndex: number, optIndex: number, value: string) => {
    setQuestions((prev) => {
      const copy = [...prev];
      const opts = [...copy[qIndex].options];
      opts[optIndex] = value;
      copy[qIndex] = { ...copy[qIndex], options: opts };
      return copy;
    });
  };

  const removeQuestion = (index: number) => {
    if (questions.length <= 1) return;
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  // Pre-Publishing Validation
  const validateForm = (isPublishing: boolean): boolean => {
    const errors: string[] = [];

    if (!title.trim()) errors.push('عنوان الامتحان مطلوب.');
    if (!lesson.trim()) errors.push('اسم الدرس / الوحدة مطلوب.');
    if (durationMinutes <= 0) errors.push('مدة الامتحان يجب أن تكون أكبر من صفر.');
    if (totalPoints <= 0) errors.push('مجموع علامات الامتحان يجب أن يكون أكبر من صفر.');

    if (isPublishing) {
      if (questions.length === 0) {
        errors.push('يجب إضافة سؤال واحد على الأقل لنشر الامتحان.');
      }
      questions.forEach((q, idx) => {
        const num = idx + 1;
        if (!q.questionText.trim()) {
          errors.push(`السؤال (${num}) لا يحتوي على نص السؤال.`);
        }
        if (q.options.some((opt) => !opt.trim())) {
          errors.push(`السؤال (${num}) يحتوي على خيارات فارغة.`);
        }
        if (!q.explanation.trim()) {
          errors.push(`السؤال (${num}) يتطلب كتابة شرح تفصيلي لطريقة الحل.`);
        }
      });
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSubmit = async (publishIntent: boolean) => {
    setSubmitError(null);
    const isValid = validateForm(publishIntent);
    if (!isValid) return;

    if (!auth.currentUser) {
      const err = 'جلسة المشرف غير نشطة حالياً. يرجى تسجيل الدخول بحساب المشرف المعتمد.';
      setSubmitError(err);
      alert(err);
      return;
    }

    setIsSubmitting(true);
    try {
      const subjectNames: Partial<Record<SubjectId, string>> = {
        all: 'الكل',
        physics: 'الفيزياء',
        math: 'الرياضيات',
        arabic: 'اللغة العربية',
        chemistry: 'الكيمياء',
        biology: 'العلوم الحياتية',
        english: 'اللغة الإنجليزية',
        islamic: 'التربية الإسلامية',
        other: 'مبحث آخر',
      };

      const isEditingPublished = Boolean(examToEdit?.published);
      const nextVersion = isEditingPublished ? ((examToEdit?.version || 1) + 1) : (examToEdit?.version || 1);

      const savedExamId = await saveExamWithValidation(
        {
          id: examToEdit?.id,
          title: title.trim(),
          subject,
          subjectNameAr: subjectNames[subject] || 'الفيزياء',
          lesson: lesson.trim(),
          description: description.trim(),
          durationMinutes: Number(durationMinutes),
          totalPoints: Number(totalPoints),
          difficulty,
          branch: branch || 'مشترك',
          status: publishIntent ? 'published' : (examToEdit?.status || 'coming_soon'),
          published: publishIntent,
          version: nextVersion,
          allowRetake,
          questionCount: questions.length,
          createdAt: examToEdit?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: examToEdit?.createdBy || auth.currentUser?.email || 'admin',
        } as any,
        questions.map((q, i) => ({
          ...q,
          order: i + 1,
        }))
      );

      // Automated broadcast notification if substantive edit on a published exam
      if (examToEdit && isEditingPublished && notifyStudentsOnEdit) {
        try {
          const { createOrCoalesceBroadcast } = await import('../../lib/broadcastService');
          await createOrCoalesceBroadcast({
            type: 'exam_updated',
            title: `تم تحديث امتحان: ${title.trim()}`,
            message: `تم تحديث محتوى وأسئلة الامتحان (الإصدار ${nextVersion}).`,
            examId: savedExamId,
            examTitle: title.trim(),
            audience: {
              grade: '2009',
              track: (branch as any) || 'all',
            },
            adminEmail: auth.currentUser?.email || 'admin@arixon.edu',
          });
        } catch (bErr) {
          console.warn('[AdminCreateExamModal] Notice sending update broadcast:', bErr);
        }
      }

      onSaved();
      onClose();
    } catch (err: any) {
      console.error('[AdminCreateExamModal] Error saving exam:', err);
      const detail = `فشل حفظ الامتحان (${err?.code || 'ERROR'}): ${err?.message || 'تحقق من صلاحيات المشرف أو قواعد Firestore'}`;
      setSubmitError(detail);
      alert(detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 overflow-y-auto">
      <div className="bg-white dark:bg-[#0c101c] w-full max-w-4xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                {examToEdit ? 'تعديل بيانات الامتحان' : 'إنشاء امتحان جديد (توجيهي 2009)'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                إعداد المعايير التربوية، الأسئلة، مفاتيح الإجابة، وسياسات التقديم
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-[#0a0e1a] px-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            ١. البيانات الأساسية
          </button>
          <button
            onClick={() => setActiveTab('questions')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'questions'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span>٢. الأسئلة ومفاتيح الحل</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-mono">
              {questions.length}
            </span>
          </button>
          <button
            onClick={() => {
              validateForm(false);
              setActiveTab('preview');
            }}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'preview'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            ٣. الفحص والاعتماد
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Error Banner */}
          {submitError && (
            <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Published Exam Warning Banner (D1 requirement) */}
              {examToEdit?.published && (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 space-y-2">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>تحذير تعديل امتحان منشور (الإصدار الحالي: v{examToEdit.version || 1})</span>
                  </div>
                  <p className="text-[11px] text-amber-700/90 dark:text-amber-400/90 leading-relaxed">
                    هذا الامتحان متاح للطلاب حالياً. عند الحفظ، سيتم ترقية رقم الإصدار تلقائياً إلى (v{(examToEdit.version || 1) + 1})، وستبقى نتائج ومراجعات محاولات الطلاب السابقة ثابتة ومحمية بالكامل ولن تتأثر بالتعديل.
                  </p>

                  <label className="flex items-center gap-2 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyStudentsOnEdit}
                      onChange={(e) => setNotifyStudentsOnEdit(e.target.checked)}
                      className="rounded border-amber-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                      أبلغ الطلاب بهذا التعديل (إشعار عام فوري للطلاب المستهدفين)
                    </span>
                  </label>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    عنوان الامتحان *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="مثال: الاختبار الشامل في الزخم الخطي والتصادمات"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#13192a] text-xs focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    الدرس / الوحدة التعليمية *
                  </label>
                  <input
                    type="text"
                    value={lesson}
                    onChange={(e) => setLesson(e.target.value)}
                    placeholder="مثال: الوحدة الأولى - الدرس الثاني: التصادمات المرنة"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#13192a] text-xs focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    الفرع الأكاديمي المستهدف *
                  </label>
                  <select
                    value={branch}
                    onChange={(e) => {
                      const newBranch = e.target.value as 'مشترك' | 'علمي' | 'أدبي';
                      setBranch(newBranch);
                      if (newBranch === 'أدبي' && ['physics', 'chemistry', 'biology', 'geology'].includes(subject)) {
                        setSubject('arabic');
                      } else if (newBranch === 'علمي' && ['history', 'geography', 'financial_culture'].includes(subject)) {
                        setSubject('physics');
                      } else if (newBranch === 'مشترك' && !['arabic', 'english', 'islamic', 'islamic_studies'].includes(subject)) {
                        setSubject('arabic');
                      }
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#13192a] text-xs focus:outline-hidden focus:border-blue-500 font-bold"
                  >
                    <option value="مشترك">مشترك (المواد العامة المشتركة فقط: عربي، إنجليزي، دين)</option>
                    <option value="علمي">الفرع العلمي فقط (8 مواد علمية)</option>
                    <option value="أدبي">الفرع الأدبي فقط (8 مواد أدبية - ممنوع الفيزياء والعلوم)</option>
                  </select>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    المبحث الدراسي ({branch === 'أدبي' ? 'مواد الفرع الأدبي الـ 8' : branch === 'علمي' ? 'مواد الفرع العلمي الـ 8' : 'المواد المشتركة'}) *
                  </label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value as SubjectId)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#13192a] text-xs focus:outline-hidden focus:border-blue-500 font-semibold"
                  >
                    {branch === 'أدبي' ? (
                      <>
                        <option value="arabic">اللغة العربية (تخصص ومهارات)</option>
                        <option value="english">اللغة الإنجليزية</option>
                        <option value="islamic_studies">التربية الإسلامية</option>
                        <option value="math">الرياضيات (الأدبي)</option>
                        <option value="history">تاريخ الأردن والعرب</option>
                        <option value="geography">الجغرافيا والدراسات البيئية</option>
                        <option value="financial_culture">الثقافة المالية والمصرفية</option>
                        <option value="computer">الحاسوب وتكنولوجيا المعلومات</option>
                      </>
                    ) : branch === 'علمي' ? (
                      <>
                        <option value="physics">الفيزياء</option>
                        <option value="math">الرياضيات (العلمي)</option>
                        <option value="chemistry">الكيمياء</option>
                        <option value="biology">العلوم الحياتية (الأحياء)</option>
                        <option value="geology">علوم الأرض والبيئة</option>
                        <option value="arabic">اللغة العربية (مشترك)</option>
                        <option value="english">اللغة الإنجليزية</option>
                        <option value="islamic_studies">التربية الإسلامية</option>
                      </>
                    ) : (
                      <>
                        <option value="arabic">اللغة العربية (مشترك لجميع الفروع)</option>
                        <option value="english">اللغة الإنجليزية (مشترك لجميع الفروع)</option>
                        <option value="islamic_studies">التربية الإسلامية (مشترك لجميع الفروع)</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    مستوى الصعوبة
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#13192a] text-xs focus:outline-hidden focus:border-blue-500"
                  >
                    <option value="easy">سهل (تذكر ومفاهيم أساسية)</option>
                    <option value="medium">متوسط (تطبيق وتحليل)</option>
                    <option value="hard">صعب (قدرات تفكير عليا)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    مدة الامتحان (بالدقائق) *
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={180}
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#13192a] text-xs focus:outline-hidden focus:border-blue-500"
                    />
                    <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  </div>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    مجموع العلامات الكلي *
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={5}
                      max={500}
                      value={totalPoints}
                      onChange={(e) => setTotalPoints(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#13192a] text-xs focus:outline-hidden focus:border-blue-500"
                    />
                    <Award className="w-4 h-4 text-slate-400 shrink-0" />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  وصف الامتحان والإرشادات للطلبة
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="اكتب تعليمات الموجه التربوي والتوجيهات الخاصة بالامتحان..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#13192a] text-xs focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/50 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-blue-900 dark:text-blue-200">
                    سياسة المحاولات المعتمدة (Exam Policy)
                  </div>
                  <div className="text-[11px] text-blue-700/80 dark:text-blue-300/80">
                    الامتحانات مخصصة لمحاولة واحدة معتمدة لكل طالب لضمان نزاهة الترتيب والتقييم، مع إتاحة مراجعة الحل النموذجي دائماً بعد انتهاء الامتحان.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: QUESTIONS */}
          {activeTab === 'questions' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <span>قائمة الأسئلة ({questions.length})</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold">
                    مجموع النقاط: {questions.reduce((sum, q) => sum + (q.points || 0), 0)} / {totalPoints}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (questions.length === 0) return;
                      const base = Math.max(1, Math.floor(totalPoints / questions.length));
                      const rem = totalPoints - (base * questions.length);
                      setQuestions(prev => prev.map((q, i) => ({
                        ...q,
                        points: base + (i === 0 ? rem : 0)
                      })));
                    }}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                    title="توزيع مجموع درجات الامتحان بالتساوي على جميع الأسئلة"
                  >
                    توزيع النقاط بالتساوي
                  </button>
                  <button
                    type="button"
                    onClick={addBlankQuestion}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة سؤال جديد</span>
                  </button>
                </div>
              </div>

              {questions.map((q, qIndex) => (
                <div
                  key={qIndex}
                  className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111625] space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
                    <span className="text-xs font-black text-blue-600 dark:text-blue-400">
                      السؤال رقم {qIndex + 1}
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={q.points}
                        onChange={(e) => updateQuestion(qIndex, { points: Number(e.target.value) })}
                        className="w-16 px-2 py-1 text-xs text-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#1a2238]"
                        title="علامات هذا السؤال"
                      />
                      <span className="text-[11px] text-slate-400">علامات</span>
                      {questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeQuestion(qIndex)}
                          className="p-1 text-red-500 hover:text-red-700 cursor-pointer"
                          title="حذف هذا السؤال"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Question Text */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      نص السؤال *
                    </label>
                    <textarea
                      rows={2}
                      value={q.questionText}
                      onChange={(e) => updateQuestion(qIndex, { questionText: e.target.value })}
                      placeholder="اكتب نص السؤال بدقة ووضوح..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#161d30] text-xs focus:outline-hidden focus:border-blue-500"
                    />
                  </div>

                  {/* Options with Radio for Correct Answer */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      خيارات الإجابة (اختر الدائرة بجانب الخيار الصحيح نموذجياً) *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {['أ', 'ب', 'ج', 'د'].map((letter, optIdx) => (
                        <div
                          key={optIdx}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${
                            q.correctAnswer === optIdx
                              ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20'
                              : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#161d30]'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`correct_${qIndex}`}
                            checked={q.correctAnswer === optIdx}
                            onChange={() => updateQuestion(qIndex, { correctAnswer: optIdx })}
                            className="w-4 h-4 accent-emerald-600 cursor-pointer shrink-0"
                            title="تحديد هذا الخيار كإجابة صحيحة"
                          />
                          <span className="text-xs font-bold text-slate-500 shrink-0">{letter}.</span>
                          <input
                            type="text"
                            value={q.options[optIdx] || ''}
                            onChange={(e) => updateQuestionOption(qIndex, optIdx, e.target.value)}
                            placeholder={`نص الخيار (${letter})`}
                            className="w-full bg-transparent text-xs focus:outline-hidden"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Explanation / Solution */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>الشرح التفصيلي وطريقة الحل (يظهر للطلبة بعد التسليم) *</span>
                    </label>
                    <textarea
                      rows={2}
                      value={q.explanation}
                      onChange={(e) => updateQuestion(qIndex, { explanation: e.target.value })}
                      placeholder="اشرح خطوات الحل والقانون العلمي المطبق بأسلوب مبسط وواضح..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#161d30] text-xs focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: PREVIEW & VALIDATION */}
          {activeTab === 'preview' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50">
                <h3 className="text-xs font-bold text-blue-800 dark:text-blue-300 mb-1">
                  تقرير التحقق التربوي قبل النشر
                </h3>
                <p className="text-[11px] text-blue-700 dark:text-blue-400">
                  تضمن أريكسون خلو أي امتحان منشور من الأخطاء الصياغية ونقص الإجابات النموذجية.
                </p>
              </div>

              {validationErrors.length > 0 ? (
                <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 space-y-2">
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-xs font-bold">
                    <AlertCircle className="w-4 h-4" />
                    <span>تم العثور على {validationErrors.length} ملاحظات يجب تصويبها قبل النشر:</span>
                  </div>
                  <ul className="list-disc list-inside text-[11px] text-red-600/90 dark:text-red-400/90 space-y-1">
                    {validationErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span>جميع البيانات والأسئلة ومفاتيح الحل مكتملة ومطابقة لمعايير النشر التربوية!</span>
                </div>
              )}

              {/* Summary snapshot */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">عنوان الامتحان:</span>
                  <span className="font-bold">{title || 'غير محدد'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">المبحث والدرس:</span>
                  <span className="font-bold">{subject} - {lesson || 'غير محدد'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">عدد الأسئلة:</span>
                  <span className="font-bold">{questions.length} أسئلة</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">المدة الإجمالية:</span>
                  <span className="font-bold">{durationMinutes} دقيقة</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">مجموع العلامات:</span>
                  <span className="font-bold">{totalPoints} علامة</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-[#0a0e1a] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            إلغاء
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSubmit(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              حفظ كمسودة
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSubmit(true)}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm shadow-blue-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'جارٍ الحفظ...' : 'اعتماد ونشر الامتحان'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
