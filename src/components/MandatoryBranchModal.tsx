import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateStudentBranch } from '../lib/firebase';
import { BookOpen, Atom, Scroll, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export const MandatoryBranchModal: React.FC = () => {
  const { profile, refreshProfile } = useAuth();
  const [selectedBranch, setSelectedBranch] = useState<'علمي' | 'أدبي' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // If student already has branch, don't show
  if (!profile || (profile.branch && profile.branch.trim() !== '')) {
    return null;
  }

  const handleConfirm = async () => {
    if (!selectedBranch) {
      setErrorMsg('يرجى تحديد فرعك الدراسي (العلمي أو الأدبي) للمتابعة.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await updateStudentBranch(profile.uid, selectedBranch);
      await refreshProfile();
    } catch (err: any) {
      console.error('[MandatoryBranchModal] Error updating branch:', err);
      setErrorMsg(err.message || 'فشل حفظ الفرع الدراسي، يرجى المحاولة مجدداً.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div 
        id="mandatory-branch-modal"
        className="bg-white dark:bg-[#0c101c] w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6 text-center"
      >
        <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-xs">
          <BookOpen className="w-7 h-7" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            حدد فرعك الدراسي
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            مرحباً بك في منصة أريكسون! يرجى تحديد فرعك لمرة واحدة فقط لتخصيص بنك الامتحانات وجداول الترتيب لمسارك الأكاديمي.
          </p>
          <div className="inline-block mt-1 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/40">
            ⚠️ لا يمكن تغيير الفرع لاحقاً إلا بالتواصل مع الإدارة
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 text-red-600 text-xs flex items-center gap-2 text-right">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Branch Selection Cards */}
        <div className="grid grid-cols-2 gap-3.5">
          {/* Scientific Branch */}
          <button
            type="button"
            onClick={() => {
              setSelectedBranch('علمي');
              setErrorMsg(null);
            }}
            className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all cursor-pointer text-center relative ${
              selectedBranch === 'علمي'
                ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shadow-md scale-[1.02]'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            {selectedBranch === 'علمي' && (
              <CheckCircle2 className="w-4 h-4 text-blue-600 absolute top-2.5 left-2.5" />
            )}
            <div className={`p-3 rounded-xl ${selectedBranch === 'علمي' ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
              <Atom className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold text-sm sm:text-base">الفرع العلمي</div>
              <div className="text-[11px] text-slate-400 mt-0.5">فيزياء، كيمياء، أحياء، رياضيات علمي</div>
            </div>
          </button>

          {/* Literary Branch */}
          <button
            type="button"
            onClick={() => {
              setSelectedBranch('أدبي');
              setErrorMsg(null);
            }}
            className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all cursor-pointer text-center relative ${
              selectedBranch === 'أدبي'
                ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 shadow-md scale-[1.02]'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            {selectedBranch === 'أدبي' && (
              <CheckCircle2 className="w-4 h-4 text-indigo-600 absolute top-2.5 left-2.5" />
            )}
            <div className={`p-3 rounded-xl ${selectedBranch === 'أدبي' ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
              <Scroll className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold text-sm sm:text-base">الفرع الأدبي</div>
              <div className="text-[11px] text-slate-400 mt-0.5">تاريخ، جغرافيا، لغة عربية، ثقافة علمية</div>
            </div>
          </button>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!selectedBranch || isSubmitting}
          className="w-full py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>جارٍ الحفظ وتجهيز بيئتك الدراسية...</span>
            </>
          ) : (
            <span>تأكيد الاختيار والمتابعة</span>
          )}
        </button>
      </div>
    </div>
  );
};
