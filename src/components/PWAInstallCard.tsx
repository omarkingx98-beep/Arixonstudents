import React, { useState } from 'react';
import {
  Download,
  Check,
  Share2,
  Copy,
  Info,
  RefreshCw,
  Smartphone,
  ExternalLink,
  ShieldCheck,
  ChevronLeft,
  XCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useAdmin } from '../context/AdminContext';

interface PWAInstallCardProps {
  onBack?: () => void;
  showBackAction?: boolean;
}

export const PWAInstallCard: React.FC<PWAInstallCardProps> = ({
  onBack,
  showBackAction = false,
}) => {
  const {
    isInstallable,
    isInstalled,
    isIOS,
    isInAppBrowser,
    installStatus,
    diagnostic,
    triggerInstall,
    refreshCheck,
  } = usePWAInstall();

  const { isAdmin } = useAdmin();
  const [copied, setCopied] = useState(false);
  const [showAdminDiagnostics, setShowAdminDiagnostics] = useState(false);

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.origin + '/install');
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="space-y-4 max-w-xl mx-auto">
      {/* Header Bar if inside modal or view */}
      {showBackAction && onBack && (
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-blue-600" />
            <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
              تثبيت تطبيق Arixon على جهازك
            </h3>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
          >
            العودة
          </button>
        </div>
      )}

      {/* Hero Badge & Visual */}
      <div className="text-center space-y-2 pt-1">
        <div className="relative inline-block mx-auto">
          <img
            src="/icons/icon-192x192.png"
            alt="Arixon App Icon"
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl shadow-xl shadow-blue-500/15 border-2 border-white dark:border-slate-800 object-cover mx-auto"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/logo.png';
            }}
          />
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs shadow-md">
            <Download className="w-3.5 h-3.5" />
          </div>
        </div>

        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
            تطبيق Arixon - توجيهي 2009
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            ثبّت المنصة مباشرة على هاتفك للوصول السريع بلمسة واحدة
          </p>
        </div>
      </div>

      {/* Main Dynamic Status Container */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden bg-white dark:bg-[#0c101c] p-4 sm:p-5 shadow-xs space-y-4">
        {/* CASE 1: App is already installed (Standalone mode) */}
        {isInstalled ? (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-center space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h4 className="font-black text-sm text-emerald-900 dark:text-emerald-200">
              التطبيق مثبّت بنجاح على جهازك ✅
            </h4>
            <p className="text-xs text-emerald-800/80 dark:text-emerald-300 leading-relaxed">
              أنت تستخدم تطبيق Arixon الآن بملء الشاشة وبشكل مستقل. يمكنك الوصول إليه دائماً مباشرة من شاشتك الرئيسية.
            </p>
          </div>
        ) : isInAppBrowser ? (
          /* CASE 2: In-App Browser Warning (WhatsApp, Instagram, Facebook, TikTok) */
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 space-y-3">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-black text-xs">
              <Info className="w-4 h-4 text-amber-600 shrink-0" />
              <span>تنبيه: أنت تتصفح من داخل تطبيق تواصل</span>
            </div>
            <p className="text-xs text-amber-900/80 dark:text-amber-200/90 leading-relaxed">
              المتصفحات الداخلية لتطبيقات (واتساب، إنستغرام، تيك توك، فيسبوك) تمنع تثبيت التطبيقات وحفظ تسجيل الدخول.
            </p>
            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-amber-900/50 text-[11px] text-slate-700 dark:text-slate-300 space-y-1">
              <p className="font-bold">خطوات التثبيت الصحيحة:</p>
              <p>1. اضغط على أيقونة النقاط الثلاث (⋮) أو المشاركة أعلى أو أسفل الشاشة.</p>
              <p>2. اختر <strong>"فتح في المتصفح"</strong> (Open in Chrome / Safari).</p>
            </div>
            <button
              type="button"
              onClick={handleCopyLink}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Copy className="w-4 h-4" />
              <span>{copied ? 'تم نسخ الرابط بنجاح! افتحه في Chrome' : 'نسخ رابط المنصة لفتحه في Chrome'}</span>
            </button>
          </div>
        ) : isIOS ? (
          /* CASE 3: iOS Safari Instructions (WebKit doesn't trigger beforeinstallprompt) */
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-black text-xs">
              <Share2 className="w-4 h-4 text-blue-600" />
              <span>طريقة التثبيت على أجهزة iPhone و iPad (متصفح Safari):</span>
            </div>
            <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800">
                <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 font-black text-[11px] flex items-center justify-center shrink-0">1</span>
                <span>اضغط على زر <strong>المشاركة (Share ⎋)</strong> في أسفل شاشة متصفح Safari.</span>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800">
                <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 font-black text-[11px] flex items-center justify-center shrink-0">2</span>
                <span>مرر القائمة لأسفل واختر <strong>"إضافة إلى الشاشة الرئيسية" (Add to Home Screen ⊞)</strong>.</span>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800">
                <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 font-black text-[11px] flex items-center justify-center shrink-0">3</span>
                <span>اضغط على <strong>"إضافة" (Add)</strong> في أعلى الزاوية لتظهر أيقونة Arixon في شاشتك الرئيسية.</span>
              </div>
            </div>
          </div>
        ) : (
          /* CASE 4: Android / Chrome / Edge */
          <div className="space-y-3">
            {isInstallable ? (
              <button
                type="button"
                id="pwa-primary-install-btn"
                disabled={installStatus === 'installing'}
                onClick={async () => {
                  await triggerInstall();
                }}
                className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-black text-sm flex items-center justify-center gap-2.5 transition-all shadow-md shadow-blue-500/25 cursor-pointer disabled:opacity-50"
              >
                {installStatus === 'installing' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>جاري التثبيت...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    <span>تثبيت تطبيق Arixon الآن</span>
                  </>
                )}
              </button>
            ) : (
              /* Chrome Android fallback if beforeinstallprompt not yet captured or native menu needed */
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
                  <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>طريقة التثبيت المباشرة من المتصفح:</span>
                  </p>
                  <p>1. اضغط على قائمة المتصفح (⋮) في الزاوية العلوية لمتصفح Chrome.</p>
                  <p>2. اختر <strong>"تثبيت التطبيق"</strong> أو <strong>"إضافة إلى الشاشة الرئيسية"</strong>.</p>
                </div>

                <button
                  type="button"
                  onClick={refreshCheck}
                  className="w-full py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>إعادة الفحص والتحقق من زر التثبيت</span>
                </button>
              </div>
            )}

            {/* Install status messages */}
            {installStatus === 'accepted' && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs text-center font-bold flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>تم التثبيت بنجاح ✅ افتح التطبيق من شاشتك الرئيسية!</span>
              </div>
            )}

            {installStatus === 'dismissed' && (
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs text-center font-medium">
                يمكنك التثبيت لاحقاً في أي وقت من هذه الصفحة أو من قائمة المتصفح.
              </div>
            )}
          </div>
        )}

        {/* Honest Benefits List (User Specified) */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2 text-xs">
          <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px]">
            مميزات تثبيت تطبيق Arixon:
          </span>
          <ul className="space-y-1.5 text-slate-600 dark:text-slate-400 text-xs">
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>شاشة كاملة بدون شريط المتصفح.</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>وصول أسرع بأيقونة على شاشتك الرئيسية.</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>تجربة أقرب للتطبيق واستقرار أكبر في الأداء.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Admin Diagnostic Block (Visible for Admins Only) */}
      {isAdmin && diagnostic && (
        <div className="p-3.5 rounded-2xl bg-slate-100/80 dark:bg-[#13192a] border border-slate-200 dark:border-slate-800 text-[11px] space-y-2">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowAdminDiagnostics(!showAdminDiagnostics)}
              className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 hover:text-blue-600 cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>تشخيص التثبيت (لوحة الإدارة فقط)</span>
              <span className="text-[10px] text-slate-400">
                {showAdminDiagnostics ? '(إخفاء)' : '(عرض التفاصيل)'}
              </span>
            </button>
            <button
              type="button"
              onClick={refreshCheck}
              className="text-blue-600 hover:underline flex items-center gap-1 text-[10px]"
            >
              <RefreshCw className="w-3 h-3" />
              <span>تحديث الفحص</span>
            </button>
          </div>

          {showAdminDiagnostics && (
            <div className="grid grid-cols-2 gap-2 pt-2 text-[10px] border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-slate-900">
                <span>Manifest مربوط:</span>
                <span className={diagnostic.isManifestLinked ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold'}>
                  {diagnostic.isManifestLinked ? '✓ نعم' : '✗ لا'}
                </span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-slate-900">
                <span>Service Worker مسجّل:</span>
                <span className={diagnostic.hasSwSupport ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold'}>
                  {diagnostic.hasSwSupport ? '✓ مدعوم' : '✗ غير مدعوم'}
                </span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-slate-900">
                <span>حدث التثبيت ملتقط:</span>
                <span className={diagnostic.isPromptCaptured ? 'text-emerald-600 font-bold' : 'text-amber-500 font-bold'}>
                  {diagnostic.isPromptCaptured ? '✓ نعم (Prompt متاح)' : 'بانتظار المتصفح'}
                </span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-slate-900">
                <span>وضع التثبيت (Standalone):</span>
                <span className={diagnostic.isStandalone ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                  {diagnostic.isStandalone ? '✓ نعم' : 'متصفح عادي'}
                </span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-slate-900">
                <span>جهاز Apple (iOS):</span>
                <span>{diagnostic.isIOS ? 'نعم (Safari)' : 'لا (Android/Desktop)'}</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-slate-900">
                <span>متصفح مدمج (In-App):</span>
                <span className={diagnostic.isInAppBrowser ? 'text-amber-500 font-bold' : 'text-slate-400'}>
                  {diagnostic.isInAppBrowser ? 'نعم (مقيد)' : 'لا'}
                </span>
              </div>
              <div className="col-span-2 p-1.5 rounded-lg bg-white dark:bg-slate-900 font-mono text-[9px] truncate" title={diagnostic.userAgent}>
                UA: {diagnostic.userAgent}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
