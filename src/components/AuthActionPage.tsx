import React, { useState, useEffect } from 'react';
import { Logo } from './Logo';
import { useTheme } from '../context/ThemeContext';
import { 
  verifyResetCode, 
  confirmNewPassword, 
  applyEmailVerification, 
  recoverUserEmail, 
  maskEmail, 
  getActionErrorMessage 
} from '../lib/firebase';
import { 
  Sun, 
  Moon, 
  Lock, 
  Eye, 
  EyeOff, 
  KeyRound, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowRight, 
  MailCheck, 
  ShieldCheck, 
  RefreshCw 
} from 'lucide-react';

interface AuthActionPageProps {
  onNavigateHome: () => void;
  onOpenForgotPassword?: () => void;
}

export const AuthActionPage: React.FC<AuthActionPageProps> = ({
  onNavigateHome,
  onOpenForgotPassword,
}) => {
  const { theme, toggleTheme } = useTheme();

  // Parse URL search params
  const [mode, setMode] = useState<string>('');
  const [oobCode, setOobCode] = useState<string>('');

  // Status: 'verifying' | 'ready' | 'submitting' | 'success' | 'error'
  const [status, setStatus] = useState<'verifying' | 'ready' | 'submitting' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  // Reset Password State
  const [accountEmail, setAccountEmail] = useState<string>('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Recover Email State
  const [restoredEmail, setRestoredEmail] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const parsedMode = params.get('mode') || '';
    const parsedCode = params.get('oobCode') || '';

    setMode(parsedMode);
    setOobCode(parsedCode);

    if (!parsedMode || !parsedCode) {
      setStatus('error');
      setErrorMessage('رابط المصادقة غير مكتمل، يرجى التأكد من الضغط على الرابط كاملاً من بريدك.');
      return;
    }

    // Handle according to mode
    if (parsedMode === 'resetPassword') {
      verifyResetCode(parsedCode)
        .then((email) => {
          setAccountEmail(email);
          setStatus('ready');
        })
        .catch((err) => {
          console.error('[AuthActionPage] verifyResetCode error:', err);
          setStatus('error');
          setErrorCode(err?.code || '');
          setErrorMessage(getActionErrorMessage(err));
        });
    } else if (parsedMode === 'verifyEmail') {
      applyEmailVerification(parsedCode)
        .then(() => {
          setStatus('success');
        })
        .catch((err) => {
          console.error('[AuthActionPage] applyEmailVerification error:', err);
          setStatus('error');
          setErrorCode(err?.code || '');
          setErrorMessage(getActionErrorMessage(err));
        });
    } else if (parsedMode === 'recoverEmail') {
      recoverUserEmail(parsedCode)
        .then((res) => {
          setRestoredEmail(res.restoredEmail || null);
          setStatus('success');
        })
        .catch((err) => {
          console.error('[AuthActionPage] recoverUserEmail error:', err);
          setStatus('error');
          setErrorCode(err?.code || '');
          setErrorMessage(getActionErrorMessage(err));
        });
    } else {
      setStatus('error');
      setErrorMessage('نوع الإجراء المطلوب غير مدعوم في هذا الرابط.');
    }
  }, []);

  // Submit new password
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanPass = newPassword.trim();
    if (cleanPass.length < 8) {
      setErrorMessage('يجب أن تتكون كلمة المرور من 8 خانات أو أحرف على الأقل.');
      return;
    }

    if (cleanPass !== confirmPassword.trim()) {
      setErrorMessage('كلمتا المرور غير متطابقتين.');
      return;
    }

    try {
      setStatus('submitting');
      await confirmNewPassword(oobCode, cleanPass);
      setStatus('success');
    } catch (err: any) {
      console.error('[AuthActionPage] confirmNewPassword error:', err);
      setStatus('error');
      setErrorCode(err?.code || '');
      setErrorMessage(getActionErrorMessage(err));
    }
  };

  const isExpiredOrInvalid = errorCode === 'auth/expired-action-code' || errorCode === 'auth/invalid-action-code';

  return (
    <div className="min-h-screen flex flex-col justify-between bg-white dark:bg-[#090d16] text-slate-900 dark:text-slate-100 transition-colors duration-200 selection:bg-blue-600 selection:text-white" dir="rtl">
      {/* Top Bar with Brand & Theme Toggle */}
      <header className="w-full max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
        <Logo size="md" />
        
        <button
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'التحويل للوضع الفاتح' : 'التحويل للوضع الداكن'}
          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#182032] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md mx-auto">
          <div 
            id="auth-action-card"
            className="rounded-3xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#111625] shadow-xl shadow-slate-200/50 dark:shadow-black/60 p-6 sm:p-8 text-center animate-fadeIn"
          >
            {/* Wordmark & Tagline */}
            <h1 className="text-2xl sm:text-3xl font-black font-['Plus_Jakarta_Sans',sans-serif] tracking-tight text-slate-900 dark:text-white mb-0.5">
              ARIXON
            </h1>
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 tracking-wider mb-4">
              منصة الاختبارات والمسابقات التنافسية
            </p>

            {/* Loading / Verifying State */}
            {status === 'verifying' && (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  جارٍ التحقق من صحة وصلاحية الرابط...
                </p>
              </div>
            )}

            {/* Error Message Alert (One clear line) */}
            {errorMessage && (
              <div className="mb-4 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2 text-right">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="flex-1 leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {/* Error State with Action Button */}
            {status === 'error' && (
              <div className="space-y-4 pt-2">
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {isExpiredOrInvalid
                    ? 'يبدو أن هذا الرابط قد انتهت صلاحيته أو تم استخدامه مسبقًا لإعادة تعيين كلمة المرور.'
                    : 'يمكنك طلب رابط جديد أو العودة لتسجيل الدخول.'}
                </p>

                <div className="flex flex-col gap-2 pt-2">
                  {onOpenForgotPassword && (
                    <button
                      type="button"
                      onClick={onOpenForgotPassword}
                      className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>اطلب رابطًا جديدًا</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={onNavigateHome}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    العودة لصفحة الدخول
                  </button>
                </div>
              </div>
            )}

            {/* MODE 1: Reset Password Form */}
            {mode === 'resetPassword' && (status === 'ready' || status === 'submitting') && (
              <form onSubmit={handleResetSubmit} className="space-y-4 text-right">
                <div className="text-center pb-2">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    إعادة تعيين كلمة المرور
                  </h2>
                  {accountEmail && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      للحساب المرتبط بالبريد:{' '}
                      <span className="font-mono font-semibold text-blue-600 dark:text-blue-400 dir-ltr inline-block">
                        {maskEmail(accountEmail)}
                      </span>
                    </p>
                  )}
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    كلمة المرور الجديدة
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      dir="ltr"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full py-2.5 px-3.5 pl-10 pr-10 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-[#182032] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    يجب أن لا تقل كلمة المرور عن 8 خانات أو أحرف.
                  </span>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    تأكيد كلمة المرور الجديدة
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      dir="ltr"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full py-2.5 px-3.5 pl-10 pr-10 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-[#182032] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                    <KeyRound className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={status === 'submitting'}
                  className="w-full py-3 px-5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {status === 'submitting' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جارٍ الحفظ والتحديث...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>حفظ كلمة المرور الجديدة</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* MODE 1 SUCCESS: Password Reset Done */}
            {mode === 'resetPassword' && status === 'success' && (
              <div className="space-y-4 py-4 animate-fadeIn">
                <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    تم تغيير كلمة المرور بنجاح!
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    تم تحديث كلمة المرور لحسابك في Arixon. يمكنك الآن تسجيل الدخول والمتابعة.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onNavigateHome}
                  className="w-full py-3 px-5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>تسجيل الدخول</span>
                  <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                </button>
              </div>
            )}

            {/* MODE 2 SUCCESS: Verify Email Done */}
            {mode === 'verifyEmail' && status === 'success' && (
              <div className="space-y-4 py-4 animate-fadeIn">
                <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
                  <MailCheck className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    تم تأكيد البريد الإلكتروني بنجاح!
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    أصبح بريدك الإلكتروني موثقًا في Arixon. يمكنك الآن الاستمتاع بكافة مزايا الامتحانات والمنافسات.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onNavigateHome}
                  className="w-full py-3 px-5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>متابعة إلى Arixon</span>
                  <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                </button>
              </div>
            )}

            {/* MODE 3 SUCCESS: Recover Email Done */}
            {mode === 'recoverEmail' && status === 'success' && (
              <div className="space-y-4 py-4 animate-fadeIn">
                <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    تمت استعادة بريدك الإلكتروني بنجاح!
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    تم تأمين حسابك واستعادة عنوان البريد الإلكتروني السابق بنجاح.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onNavigateHome}
                  className="w-full py-3 px-5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>تسجيل الدخول</span>
                  <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full text-center py-4 text-xs text-slate-400 dark:text-slate-600 border-t border-slate-200/50 dark:border-slate-900">
        منصة Arixon التعليمية التنافسية © 2026 — مصممة لطلبة التوجيهي
      </footer>
    </div>
  );
};
