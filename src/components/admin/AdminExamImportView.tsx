import React, { useState } from 'react';
import {
  FileText,
  Sparkles,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Clock,
  Award,
  Layers,
  HelpCircle,
  Trash2,
  Plus,
  Send,
  Save,
  Check,
} from 'lucide-react';
import { auth } from '../../lib/firebase';
import { saveExamWithValidation } from '../../lib/adminService';
import type { SubjectId } from '../../types';

interface ParsedOption {
  id: string;
  label: string;
  text: string;
}

interface ParsedQuestion {
  number: number;
  type: 'multiple_choice';
  questionText: string;
  options: ParsedOption[];
  correctOptionId: string;
  hint: string;
  explanation: string;
  marks: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

interface ParsedExamData {
  title: string;
  subject: SubjectId;
  subjectNameAr: string;
  grade: string;
  curriculum: string;
  lesson: string;
  description: string;
  language: string;
  difficulty: 'easy' | 'medium' | 'hard';
  branch?: 'مشترك' | 'علمي' | 'أدبي';
  durationMinutes: number;
  totalQuestions: number;
  marksPerQuestion: number;
  totalMarks: number;
}

interface AdminExamImportViewProps {
  onBackToExams: () => void;
  onExamCreated?: () => void;
}

const SUBJECT_OPTIONS: Array<{ id: SubjectId; name: string }> = [
  { id: 'physics', name: 'الفيزياء' },
  { id: 'math', name: 'الرياضيات' },
  { id: 'chemistry', name: 'الكيمياء' },
  { id: 'biology', name: 'العلوم الحياتية' },
  { id: 'arabic', name: 'اللغة العربية' },
  { id: 'english', name: 'اللغة الإنجليزية' },
  { id: 'islamic', name: 'التربية الإسلامية' },
  { id: 'other', name: 'مبحث آخر' },
];

export const AdminExamImportView: React.FC<AdminExamImportViewProps> = ({
  onBackToExams,
  onExamCreated,
}) => {
  const [rawText, setRawText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Parsed Output State
  const [parsedExam, setParsedExam] = useState<ParsedExamData | null>(null);
  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

  // Saving State
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const handleClear = () => {
    if (rawText && !window.confirm('هل أنت متأكد من رغبتك في مسح النص المدخل؟')) {
      return;
    }
    setRawText('');
    setParseError(null);
    setParsedExam(null);
    setParsedQuestions([]);
    setValidationErrors([]);
    setValidationWarnings([]);
    setSaveSuccessMsg(null);
  };

  const handleParse = async () => {
    if (!rawText.trim()) {
      setParseError('يرجى لصق نص الامتحان أولاً قبل الضغط على زر التحليل.');
      return;
    }

    setParseError(null);
    setSaveSuccessMsg(null);
    setIsParsing(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('جلسة المشرف غير نشطة. يرجى التأكد من تسجيل الدخول بحساب المشرف.');
      }

      const token = await user.getIdToken(true);
      const res = await fetch('/api/admin/ai-parse-exam', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rawExamText: rawText.trim() }),
      });

      const responseText = await res.text();
      if (!responseText || !responseText.trim()) {
        throw new Error('أرجع الخادم رداً فارغاً. تحقق من ضبط متغير البيئة GEMINI_API_KEY على الخادم.');
      }

      let json: any = null;
      try {
        json = JSON.parse(responseText);
      } catch (parseErr) {
        console.error('[AdminExamImportView] Failed to parse server response:', responseText);
        throw new Error('فشل قراءة رد الخادم. الاستجابة ليست بتنسيق JSON صالح.');
      }

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || 'تعذر تحليل نص الامتحان. تأكد من وضوح الأسئلة والخيارات.');
      }

      const { exam, questions, validation } = json.data;

      // Ensure valid subject
      const validSubject: SubjectId = SUBJECT_OPTIONS.some((s) => s.id === exam.subject)
        ? (exam.subject as SubjectId)
        : 'physics';

      setParsedExam({
        ...exam,
        branch: exam.branch || 'مشترك',
        subject: validSubject,
        subjectNameAr:
          SUBJECT_OPTIONS.find((s) => s.id === validSubject)?.name || exam.subjectNameAr || 'الفيزياء',
      });
      setParsedQuestions(questions || []);
      setValidationErrors(validation?.errors || []);
      setValidationWarnings(validation?.warnings || []);
    } catch (err: any) {
      console.error('[AdminExamImportView] Parse error:', err);
      setParseError(err.message || 'حدث خطأ غير متوقع أثناء معالجة النص.');
    } finally {
      setIsParsing(false);
    }
  };

  // Editing helpers
  const handleOptionTextChange = (qIndex: number, optIndex: number, newText: string) => {
    setParsedQuestions((prev) => {
      const updated = [...prev];
      const q = { ...updated[qIndex] };
      const opts = [...q.options];
      opts[optIndex] = { ...opts[optIndex], text: newText };
      q.options = opts;
      updated[qIndex] = q;
      return updated;
    });
  };

  const handleCorrectOptionChange = (qIndex: number, newCorrectOptionId: string) => {
    setParsedQuestions((prev) => {
      const updated = [...prev];
      updated[qIndex] = { ...updated[qIndex], correctOptionId: newCorrectOptionId };
      return updated;
    });
  };

  const handleDeleteQuestion = (qIndex: number) => {
    if (!window.confirm(`هل أنت متأكد من حذف السؤال رقم (${qIndex + 1})؟`)) return;
    setParsedQuestions((prev) => {
      const filtered = prev.filter((_, idx) => idx !== qIndex);
      return filtered.map((q, idx) => ({ ...q, number: idx + 1 }));
    });
  };

  const handleSaveToDatabase = async (publishImmediately: boolean) => {
    if (!parsedExam) return;

    // Check for critical missing fields
    if (parsedQuestions.length === 0) {
      alert('لا يمكن حفظ امتحان بدون أسئلة.');
      return;
    }

    for (let i = 0; i < parsedQuestions.length; i++) {
      const q = parsedQuestions[i];
      if (!q.questionText.trim()) {
        alert(`السؤال رقم (${i + 1}) فارغ. يرجى تصحيحه.`);
        return;
      }
      if (q.options.length < 2) {
        alert(`السؤال رقم (${i + 1}) يحتوي على أقل من خيارين.`);
        return;
      }
      const correctIdx = q.options.findIndex((o) => o.id === q.correctOptionId);
      if (correctIdx === -1) {
        alert(`السؤال رقم (${i + 1}) لا يحتوي على خيار إجابة نموذجية صالح.`);
        return;
      }
    }

    setIsSaving(true);
    setParseError(null);
    try {
      const now = new Date().toISOString();
      const examPayload = {
        title: parsedExam.title.trim() || 'امتحان مستورد',
        subject: parsedExam.subject,
        subjectNameAr:
          SUBJECT_OPTIONS.find((s) => s.id === parsedExam.subject)?.name || 'الفيزياء',
        lesson: parsedExam.lesson.trim() || 'الدرس الأول',
        description: parsedExam.description.trim() || '',
        durationMinutes: Number(parsedExam.durationMinutes) || 30,
        totalPoints: parsedQuestions.reduce((sum, q) => sum + (q.marks || 5), 0),
        difficulty: parsedExam.difficulty || 'medium',
        branch: parsedExam.branch || 'مشترك',
        status: (publishImmediately ? 'available' : 'coming_soon') as any,
        published: publishImmediately,
        allowRetake: true,
        questionCount: parsedQuestions.length,
        createdAt: now,
        updatedAt: now,
        createdBy: auth.currentUser?.email || 'admin',
      };

      const questionsPayload = parsedQuestions.map((q, idx) => {
        const correctIdx = Math.max(
          0,
          q.options.findIndex((o) => o.id === q.correctOptionId)
        );
        return {
          questionText: q.questionText.trim(),
          options: q.options.map((o) => o.text.trim()),
          correctAnswer: correctIdx,
          explanation: q.explanation.trim() || 'شرح تفصيلي لطريقة الحل.',
          hint: q.hint.trim() || undefined,
          difficulty: q.difficulty || parsedExam.difficulty || 'medium',
          source: 'مستورد بالذكاء الاصطناعي - أريكسون',
          points: q.marks || 5,
          order: idx + 1,
          questionType: 'multiple_choice' as const,
        };
      });

      const examId = await saveExamWithValidation(examPayload, questionsPayload);

      setSaveSuccessMsg(
        `تم حفظ الامتحان بنجاح كـ ${publishImmediately ? 'امتحان منشور ومتاح للطلاب' : 'مسودة جديدة'}! معرف الامتحان: ${examId}`
      );
      alert(
        `تم حفظ الامتحان بنجاح!\nالعنوان: ${parsedExam.title}\nعدد الأسئلة: ${parsedQuestions.length}\nالحالة: ${
          publishImmediately ? 'منشور للطلاب' : 'مسودة غير منشورة'
        }`
      );

      if (onExamCreated) {
        onExamCreated();
      }
      onBackToExams();
    } catch (err: any) {
      console.error('[AdminExamImportView] Error saving exam:', err);
      const msg = `فشل حفظ الامتحان في قاعدة البيانات (${err?.code || 'ERROR'}): ${err?.message || 'تحقق من الصلاحيات أو اتصال Firestore'}`;
      setParseError(msg);
      alert(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header */}
      <div className="bg-white dark:bg-[#0c101c] p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              onClick={onBackToExams}
              className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
              title="العودة للامتحانات"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
            <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <span>مستورد الامتحانات بالذكاء الاصطناعي (AI Exam Importer)</span>
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            ألصق نص الامتحان كاملاً بأي صيغة (أسئلة، خيارات، إجابات نموذجية، شروحات) ليقوم الذكاء الاصطناعي بفرزها وتدقيقها بدقة حرفية.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onBackToExams}
            className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            العودة لقائمة الامتحانات
          </button>
        </div>
      </div>

      {/* Parse Error Alert */}
      {parseError && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-2xl flex items-start gap-3 text-xs text-rose-700 dark:text-rose-400 shadow-xs">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold block">تنبيه أثناء معالجة الامتحان:</span>
            <span>{parseError}</span>
          </div>
        </div>
      )}

      {/* Save Success Alert */}
      {saveSuccessMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl flex items-start gap-3 text-xs text-emerald-700 dark:text-emerald-400 shadow-xs">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold block">تم الحفظ بنجاح:</span>
            <span>{saveSuccessMsg}</span>
          </div>
        </div>
      )}

      {/* Input Section: Large Textarea + 2 Main Action Buttons (Parse Exam / Clear) */}
      <div className="bg-white dark:bg-[#0c101c] p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-600" />
            <span>نص الامتحان الكامل (Paste Exam Content)</span>
          </label>
          <span className="text-[11px] text-slate-400">
            يدعم اللغة العربية والإنجليزية وصيغ A/B/C/D أو أ/ب/ج/د
          </span>
        </div>

        <textarea
          rows={12}
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder={`ألصق نص الامتحان هنا...\n\nمثال:\nعنوان الامتحان: اختبار الزخم الخطي والتصادمات\nالمادة: فيزياء\nالصف: توجيهي 2009\nالدرس: التصادم المرن في بعد واحد\nالمدة: 30 دقيقة\n\nالسؤال 1:\nكرة كتلتها 2kg تتحرك بسرعة 3m/s... ما مقدار زخمها الخطي؟\nأ) 6 kg.m/s\nب) 3 kg.m/s\nج) 1.5 kg.m/s\nد) 12 kg.m/s\nالإجابة الصحيحة: أ\nالتلميح: استخدم قانون الزخم p = m * v\nالشرح: حاصل ضرب الكتلة (2) في السرعة (3) يساوي 6.`}
          className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#13192a] text-xs font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
        />

        {/* Action Buttons: Parse Exam & Clear */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={handleClear}
            disabled={isParsing || !rawText}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            <RotateCcw className="w-4 h-4" />
            <span>مسح النص (Clear)</span>
          </button>

          <button
            type="button"
            onClick={handleParse}
            disabled={isParsing || !rawText.trim()}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-black shadow-md shadow-purple-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 ${isParsing ? 'animate-spin' : ''}`} />
            <span>{isParsing ? 'جارٍ تحليل الامتحان بالذكاء الاصطناعي...' : 'تحليل الامتحان (Parse Exam)'}</span>
          </button>
        </div>
      </div>

      {/* Review & Preview Section after Successful Parse */}
      {parsedExam && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Validation & Consistency Badges */}
          <div className="space-y-3">
            {validationErrors.length > 0 && (
              <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-2xl text-xs space-y-1.5 text-rose-800 dark:text-rose-300">
                <span className="font-black flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  <span>تنبيهات نقص البيانات والتحقق (يرجى مراجعتها وتعديلها بالأسفل):</span>
                </span>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] pr-2">
                  {validationErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {validationWarnings.length > 0 && (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-2xl text-xs space-y-1.5 text-amber-800 dark:text-amber-300">
                <span className="font-black flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>ملاحظات تربوية تحسينية:</span>
                </span>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] pr-2">
                  {validationWarnings.map((warn, i) => (
                    <li key={i}>{warn}</li>
                  ))}
                </ul>
              </div>
            )}

            {validationErrors.length === 0 && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl text-xs flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>الامتحان متسق ومنظم بالكامل وجاهز للحفظ والنشر المباشر للطلاب.</span>
              </div>
            )}
          </div>

          {/* Exam General Parameters Card */}
          <div className="bg-white dark:bg-[#0c101c] p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4">
            <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-600" />
              <span>بيانات الامتحان المستخرجة (قابلة للتعديل المباشر)</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  عنوان الامتحان *
                </label>
                <input
                  type="text"
                  value={parsedExam.title}
                  onChange={(e) => setParsedExam({ ...parsedExam, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#13192a] text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  المبحث الدراسي *
                </label>
                <select
                  value={parsedExam.subject}
                  onChange={(e) => {
                    const subj = e.target.value as SubjectId;
                    setParsedExam({
                      ...parsedExam,
                      subject: subj,
                      subjectNameAr: SUBJECT_OPTIONS.find((s) => s.id === subj)?.name || 'الفيزياء',
                    });
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#13192a] text-xs font-bold"
                >
                  {SUBJECT_OPTIONS.map((subj) => (
                    <option key={subj.id} value={subj.id}>
                      {subj.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  الدرس / الوحدة *
                </label>
                <input
                  type="text"
                  value={parsedExam.lesson}
                  onChange={(e) => setParsedExam({ ...parsedExam, lesson: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#13192a] text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  مدة الامتحان (بالدقائق) *
                </label>
                <div className="relative">
                  <Clock className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    type="number"
                    min="5"
                    max="180"
                    value={parsedExam.durationMinutes}
                    onChange={(e) =>
                      setParsedExam({ ...parsedExam, durationMinutes: Number(e.target.value) || 30 })
                    }
                    className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#13192a] text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  مستوى الصعوبة العام
                </label>
                <select
                  value={parsedExam.difficulty}
                  onChange={(e) =>
                    setParsedExam({ ...parsedExam, difficulty: e.target.value as any })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#13192a] text-xs font-bold"
                >
                  <option value="easy">سهل ومباشر</option>
                  <option value="medium">متوسط (معايير وزارية)</option>
                  <option value="hard">صعب ومستويات تفكير عليا</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  الفرع المستهدف *
                </label>
                <select
                  value={parsedExam.branch || 'مشترك'}
                  onChange={(e) =>
                    setParsedExam({ ...parsedExam, branch: e.target.value as any })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#13192a] text-xs font-bold"
                >
                  <option value="مشترك">مشترك (الفرعين معاً)</option>
                  <option value="علمي">الفرع العلمي فقط</option>
                  <option value="أدبي">الفرع الأدبي فقط</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  إجمالي الأسئلة والعلامات
                </label>
                <div className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#13192a] text-xs font-black text-slate-700 dark:text-slate-300">
                  {parsedQuestions.length} أسئلة · مجموع العلامات:{' '}
                  {parsedQuestions.reduce((s, q) => s + (q.marks || 5), 0)} علامة
                </div>
              </div>
            </div>
          </div>

          {/* Parsed Questions List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-600" />
                <span>الأسئلة المستخرجة ({parsedQuestions.length} سؤال)</span>
              </h2>
              <span className="text-[11px] text-slate-500">
                حدد الدائرة بجانب الخيار لتعيينه كإجابة نموذجية صحيحة
              </span>
            </div>

            {parsedQuestions.map((q, qIndex) => {
              return (
                <div
                  key={qIndex}
                  className="bg-white dark:bg-[#0c101c] p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4 relative"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
                    <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                      السؤال رقم {q.number || qIndex + 1}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleDeleteQuestion(qIndex)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all cursor-pointer"
                      title="حذف هذا السؤال"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Question Text */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      نص السؤال *
                    </label>
                    <textarea
                      rows={2}
                      value={q.questionText}
                      onChange={(e) => {
                        const updated = [...parsedQuestions];
                        updated[qIndex].questionText = e.target.value;
                        setParsedQuestions(updated);
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#13192a] text-xs font-bold leading-relaxed"
                    />
                  </div>

                  {/* Options List */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-2">
                      الخيارات (اختر الإجابة الصحيحة بالضغط على الدائرة) *
                    </label>
                    <div className="space-y-2">
                      {q.options.map((opt, optIndex) => {
                        const isCorrect = q.correctOptionId === opt.id;
                        return (
                          <div
                            key={opt.id}
                            className={`flex items-center gap-3 p-2.5 rounded-2xl border transition-all ${
                              isCorrect
                                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-950 dark:text-emerald-200'
                                : 'bg-slate-50 dark:bg-[#13192a] border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleCorrectOptionChange(qIndex, opt.id)}
                              className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border transition-all cursor-pointer ${
                                isCorrect
                                  ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs shadow-emerald-500/30'
                                  : 'border-slate-300 dark:border-slate-700 hover:border-emerald-500'
                              }`}
                              title={isCorrect ? 'إجابة نموذجية صحيحة' : 'تعيين كإجابة صحيحة'}
                            >
                              {isCorrect && <Check className="w-3.5 h-3.5" />}
                            </button>

                            <span className="text-xs font-black w-6 text-center text-slate-500">
                              {opt.label}
                            </span>

                            <input
                              type="text"
                              value={opt.text}
                              onChange={(e) => handleOptionTextChange(qIndex, optIndex, e.target.value)}
                              className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-[#0c101c] text-xs font-medium focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Hint & Explanation */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                        التلميح الذكي (Hint)
                      </label>
                      <input
                        type="text"
                        value={q.hint || ''}
                        placeholder="تلميح يرشد الطالب دون كشف الإجابة..."
                        onChange={(e) => {
                          const updated = [...parsedQuestions];
                          updated[qIndex].hint = e.target.value;
                          setParsedQuestions(updated);
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#13192a] text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                        الشرح التفصيلي للحل (Explanation) *
                      </label>
                      <input
                        type="text"
                        value={q.explanation || ''}
                        placeholder="شرح خطوات الحل النموذجي..."
                        onChange={(e) => {
                          const updated = [...parsedQuestions];
                          updated[qIndex].explanation = e.target.value;
                          setParsedQuestions(updated);
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#13192a] text-xs"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Final Actions Bar */}
          <div className="bg-white dark:bg-[#0c101c] p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky bottom-4 z-20">
            <div className="text-xs text-slate-500">
              إجمالي الأسئلة المعتمدة:{' '}
              <strong className="text-slate-900 dark:text-white font-black">
                {parsedQuestions.length} سؤال
              </strong>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleSaveToDatabase(false)}
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>حفظ كمسودة (Save Draft)</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveToDatabase(true)}
                disabled={isSaving}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSaving ? 'جارٍ الحفظ في قاعدة البيانات...' : 'حفظ ونشر الامتحان للطلاب (Publish)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
