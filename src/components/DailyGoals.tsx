import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Plus, 
  Trash2, 
  Sparkles, 
  Calendar, 
  Clock, 
  Filter, 
  CheckCheck,
  AlertTriangle,
  Flame,
  Target,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  getDailyGoals, 
  addDailyGoal, 
  toggleDailyGoal, 
  deleteDailyGoal, 
  clearCompletedGoals 
} from '../lib/dailyGoalsService';
import type { DailyGoal, SubjectId } from '../types';

interface DailyGoalsProps {
  onNavigateToExams?: () => void;
}

const SUBJECT_OPTIONS: { id: SubjectId; label: string; icon: string; color: string }[] = [
  { id: 'physics', label: 'فيزياء', icon: '⚛️', color: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-900/60' },
  { id: 'math', label: 'رياضيات', icon: '📐', color: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900/60' },
  { id: 'chemistry', label: 'كيمياء', icon: '🧪', color: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-900/60' },
  { id: 'biology', label: 'أحياء', icon: '🧬', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60' },
  { id: 'arabic', label: 'لغة عربية', icon: '📖', color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-900/60' },
  { id: 'english', label: 'لغة إنجليزية', icon: '🇬🇧', color: 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-900/60' },
  { id: 'islamic', label: 'تربية إسلامية', icon: '🌙', color: 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-900/60' },
  { id: 'other', label: 'عام / مهارات', icon: '📝', color: 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700' },
];

const PRESET_IDEAS = [
  'حل امتحان تجريبي على منصة أريكسون',
  'مراجعة أسئلة الزخم الخطي والدفع (فيزياء)',
  'حل 15 مسألة في التفاضل والتكامل (رياضيات)',
  'حفظ 20 كلمة إنجليزية جديدة مع جملها',
  'مراجعة وحفظ مفاهيم درس الكيمياء العضوية',
];

export const DailyGoals: React.FC<DailyGoalsProps> = ({ onNavigateToExams }) => {
  const { profile, user } = useAuth();
  const currentUserId = user?.uid || profile?.uid || 'guest-student';

  const [goals, setGoals] = useState<DailyGoal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  
  // Add Goal Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [goalText, setGoalText] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<SubjectId>('physics');
  const [priority, setPriority] = useState<'normal' | 'important' | 'urgent'>('normal');
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(30);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Today formatted
  const todayFormatted = useMemo(() => {
    const today = new Date();
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    try {
      return today.toLocaleDateString('ar-EG', options);
    } catch {
      return today.toLocaleDateString();
    }
  }, []);

  // Fetch goals on mount
  useEffect(() => {
    let isMounted = true;
    const fetchGoals = async () => {
      try {
        setIsLoading(true);
        const data = await getDailyGoals(currentUserId);
        if (isMounted) {
          setGoals(data);
        }
      } catch (err) {
        console.error('[DailyGoals] Error loading goals:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchGoals();
    return () => {
      isMounted = false;
    };
  }, [currentUserId]);

  // Calculations
  const totalCount = goals.length;
  const completedCount = goals.filter((g) => g.completed).length;
  const pendingCount = totalCount - completedCount;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Filtered goals
  const displayedGoals = useMemo(() => {
    if (filter === 'pending') return goals.filter((g) => !g.completed);
    if (filter === 'completed') return goals.filter((g) => g.completed);
    return goals;
  }, [goals, filter]);

  // Motivational message
  const motivationalMessage = useMemo(() => {
    if (totalCount === 0) return 'حدّد أهداف دراستك اليومية لتبدأ يومك بتركيز عالٍ وإنتاجية مضاعفة!';
    if (progressPercent === 100) return 'بطل توجيهي 2009! 🎯 أنجزت جميع مهامك اليوم بنسبة 100%. استمر بهذا الإصرار نحو القمة!';
    if (progressPercent >= 50) return 'رائع جداً! أنجزت أكثر من نصف مهامك، بقيت خطوات بسيطة لإتمام يومك بنجاح.';
    if (completedCount > 0) return 'بداية موفقة وممتازة! تابع إنجاز باقي المهام واحدة تلو الأخرى.';
    return 'لديك مهام تنتظرك، ركّز وخذ كل خطوة بعزيمة!';
  }, [totalCount, progressPercent, completedCount]);

  // Handlers
  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalText.trim()) return;

    try {
      setIsSubmitting(true);
      const created = await addDailyGoal(currentUserId, {
        text: goalText,
        subject: selectedSubject,
        priority,
        estimatedMinutes,
      });
      setGoals((prev) => [created, ...prev]);
      setGoalText('');
      setIsFormOpen(false);
    } catch (err) {
      console.error('[DailyGoals] Error adding goal:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async (goal: DailyGoal) => {
    const nextStatus = !goal.completed;
    // Optimistic UI update
    setGoals((prev) =>
      prev.map((g) =>
        g.id === goal.id ? { ...g, completed: nextStatus, completedAt: nextStatus ? new Date().toISOString() : null } : g
      )
    );
    try {
      await toggleDailyGoal(currentUserId, goal.id, goal.completed);
    } catch (err) {
      console.error('[DailyGoals] Error toggling goal:', err);
    }
  };

  const handleDelete = async (goalId: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== goalId));
    try {
      await deleteDailyGoal(currentUserId, goalId);
    } catch (err) {
      console.error('[DailyGoals] Error deleting goal:', err);
    }
  };

  const handleClearCompleted = async () => {
    setGoals((prev) => prev.filter((g) => !g.completed));
    try {
      await clearCompletedGoals(currentUserId);
    } catch (err) {
      console.error('[DailyGoals] Error clearing completed:', err);
    }
  };

  const handleSelectPreset = (text: string) => {
    setGoalText(text);
    setIsFormOpen(true);
  };

  return (
    <div 
      id="daily-goals-container"
      className="rounded-3xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#111625] p-5 sm:p-6 shadow-xs space-y-5"
    >
      {/* Header & Date */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                مهامك وأهدافك الدراسية اليومية
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60">
                اليومية
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{todayFormatted}</span>
            </p>
          </div>
        </div>

        {/* Action Button: Add Goal */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {completedCount > 0 && (
            <button
              type="button"
              onClick={handleClearCompleted}
              className="text-xs text-slate-400 hover:text-red-500 dark:hover:text-red-400 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-red-200 transition-colors cursor-pointer"
              title="تنظيف المهام المكتملة"
            >
              مسح المكتمل
            </button>
          )}

          <button
            id="toggle-add-goal-btn"
            type="button"
            onClick={() => setIsFormOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            {isFormOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{isFormOpen ? 'إلغاء' : 'إضافة هدف دراسي'}</span>
          </button>
        </div>
      </div>

      {/* Progress Bar Card */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
            <Flame className="w-4 h-4 text-amber-500" />
            <span>معدل إنجاز اليوم:</span>
            <span className="text-blue-600 dark:text-blue-400 font-['Plus_Jakarta_Sans',sans-serif]">
              {completedCount} من {totalCount} مهام ({progressPercent}%)
            </span>
          </div>

          <span className="text-[11px] text-slate-400">
            {pendingCount === 0 && totalCount > 0 ? 'مكتمل بالكامل 🎉' : `${pendingCount} متبقية`}
          </span>
        </div>

        {/* Progress track */}
        <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-500 ease-out rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {motivationalMessage}
        </p>
      </div>

      {/* Collapsible Add Goal Form */}
      {isFormOpen && (
        <form 
          id="add-daily-goal-form"
          onSubmit={handleAddGoal}
          className="p-4 sm:p-5 rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 space-y-4 animate-fadeIn"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>تسجيل مهمة دراسية جديدة</span>
            </h3>
            <span className="text-[11px] text-slate-400">توجيهي 2009</span>
          </div>

          {/* Goal Text Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              عنوان أو تفاصيل المهمة:
            </label>
            <input
              id="daily-goal-input-text"
              type="text"
              value={goalText}
              onChange={(e) => setGoalText(e.target.value)}
              placeholder="مثال: مراجعة وحل 10 مسائل على قانون نيوتن الثاني..."
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#182032] text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Subject & Priority & Time Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Subject Select */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                المبحث / المادة:
              </label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value as SubjectId)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#182032] text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SUBJECT_OPTIONS.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.icon} {sub.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                درجة الأهمية:
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'normal' | 'important' | 'urgent')}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#182032] text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="normal">عادية 📌</option>
                <option value="important">مهمة 🎯</option>
                <option value="urgent">عاجلة ⚡</option>
              </select>
            </div>

            {/* Estimated Minutes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                الوقت المتوقع (بالدقائق):
              </label>
              <div className="flex items-center gap-1.5">
                {[15, 30, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setEstimatedMinutes(mins)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      estimatedMinutes === mins
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-[#182032] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                    }`}
                  >
                    {mins}د
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quick presets suggestions */}
          <div>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block">
              أفكار سريعة مقترحة لطلبة التوجيهي:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_IDEAS.map((idea, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setGoalText(idea)}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-400 transition-colors cursor-pointer"
                >
                  + {idea}
                </button>
              ))}
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-blue-100 dark:border-blue-900/40">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !goalText.trim()}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>حفظ المهمة في جدولك</span>
            </button>
          </div>
        </form>
      )}

      {/* Filter Tabs */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              الكل ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('pending')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                filter === 'pending'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              المتبقية ({pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('completed')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                filter === 'completed'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              المنجزة ({completedCount})
            </button>
          </div>

          <span className="text-[11px] text-slate-400">
            اضغط على الدائرة لتحديد الإنجاز ✓
          </span>
        </div>
      )}

      {/* Goals List */}
      <div className="space-y-2.5">
        {isLoading ? (
          <div className="py-8 text-center text-xs text-slate-400">
            جارٍ تحميل مهامك الدراسية...
          </div>
        ) : displayedGoals.length === 0 ? (
          <div className="py-8 px-4 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
            <Target className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <h4 className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
              {filter === 'completed'
                ? 'لم تنجز أي مهام بعد، ابدأ بإنجاز أول مهمة!'
                : filter === 'pending'
                ? 'رائع! لا توجد مهام متبقية حالياً'
                : 'جدول مهامك فارغ لليوم'}
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              أضف أهدافك الدراسية اليومية مثل حل امتحانات تجريبية أو مراجعة الدروس لتنظيم وقتك بفاعلية.
            </p>
            {totalCount === 0 && (
              <button
                type="button"
                onClick={() => setIsFormOpen(true)}
                className="mt-3.5 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة أول مهمة الآن</span>
              </button>
            )}
          </div>
        ) : (
          displayedGoals.map((goal) => {
            const subjectInfo = SUBJECT_OPTIONS.find((s) => s.id === goal.subject) || SUBJECT_OPTIONS[7];
            const isCompleted = goal.completed;

            return (
              <div
                key={goal.id}
                className={`group flex items-start justify-between gap-3 p-3 sm:p-3.5 rounded-2xl border transition-all duration-200 ${
                  isCompleted
                    ? 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200/70 dark:border-slate-800/60 opacity-80'
                    : 'bg-white dark:bg-[#182032] border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-900/60 shadow-xs'
                }`}
              >
                {/* Left: Checkbox & Text */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => handleToggle(goal)}
                    aria-label={isCompleted ? 'إلغاء التحديد' : 'تحديد كمنجز'}
                    className={`mt-0.5 flex-shrink-0 transition-transform active:scale-90 cursor-pointer ${
                      isCompleted ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600 hover:text-blue-500'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 fill-emerald-100 dark:fill-emerald-950" />
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-xs sm:text-sm font-semibold leading-relaxed transition-all ${
                        isCompleted
                          ? 'line-through text-slate-400 dark:text-slate-500'
                          : 'text-slate-800 dark:text-slate-100'
                      }`}
                    >
                      {goal.text}
                    </p>

                    {/* Meta Tags: Subject, Priority, Time */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {/* Subject Badge */}
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border ${subjectInfo.color}`}>
                        <span>{subjectInfo.icon}</span>
                        <span>{subjectInfo.label}</span>
                      </span>

                      {/* Priority Badge */}
                      {goal.priority === 'urgent' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-900/60">
                          عاجلة ⚡
                        </span>
                      )}
                      {goal.priority === 'important' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60">
                          مهمة 🎯
                        </span>
                      )}

                      {/* Time */}
                      {goal.estimatedMinutes && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 font-medium">
                          <Clock className="w-3 h-3" />
                          <span>{goal.estimatedMinutes} دقيقة</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Actions: Delete */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDelete(goal.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors opacity-80 group-hover:opacity-100 cursor-pointer"
                    title="حذف المهمة"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer prompt if user needs to study an exam */}
      {onNavigateToExams && (
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>هل خطتك لليوم تتضمن اختباراً؟ جرّب امتحانات أريكسون المعتمدة لمنهاج 2009.</span>
          <button
            type="button"
            onClick={onNavigateToExams}
            className="text-blue-600 dark:text-blue-400 font-bold hover:underline self-end sm:self-auto cursor-pointer"
          >
            تصفح الامتحانات المتاحة ←
          </button>
        </div>
      )}
    </div>
  );
};
