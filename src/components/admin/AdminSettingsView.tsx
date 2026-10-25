import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  Shield,
  Clock,
  Award,
  AlertTriangle,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { fetchAdminSettings, saveAdminSettings } from '../../lib/adminService';
import {
  fetchCommunitySettings,
  saveCommunitySettings,
  validateWhatsAppCommunityUrl,
} from '../../lib/communityService';
import type { AdminSettings, CommunitySettings } from '../../types';

export const AdminSettingsView: React.FC = () => {
  const [settings, setSettings] = useState<AdminSettings>({
    siteName: 'Arixon - أريكسون',
    defaultDurationMinutes: 20,
    defaultTotalPoints: 100,
    leaderboardVisible: true,
    announcementsEnabled: true,
    challengesEnabled: true,
    maintenanceMode: false,
    registrationOpen: true,
    defaultExamDurationMinutes: 30,
    defaultPointsPerQuestion: 5,
    allowRetakesDefault: true,
    leaderboardRefreshMinutes: 5,
    systemNotice: '',
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  });

  const [community, setCommunity] = useState<CommunitySettings>({
    whatsappUrl: 'https://chat.whatsapp.com/invite/arixon-tawjihi-2009',
    enabled: true,
    label: 'Arixon | مجتمع توجيهي 2009',
  });
  const [communityUrlError, setCommunityUrlError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const [s, c] = await Promise.all([
          fetchAdminSettings(),
          fetchCommunitySettings(),
        ]);
        setSettings(s);
        setCommunity(c);
      } catch (err) {
        console.error('Error fetching admin settings:', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check community link validity if enabled
    if (community.enabled && community.whatsappUrl) {
      const validation = validateWhatsAppCommunityUrl(community.whatsappUrl);
      if (!validation.isValid) {
        setCommunityUrlError(validation.error || 'الرابط غير صالح');
        alert(validation.error);
        return;
      }
    }

    setIsSaving(true);
    setSuccessMessage(null);
    setCommunityUrlError(null);
    try {
      await Promise.all([
        saveAdminSettings(settings),
        saveCommunitySettings(community),
      ]);
      setSuccessMessage('تم حفظ إعدادات المنظومة ومجتمع الواتساب وتطبيقها بنجاح!');
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء حفظ الإعدادات.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-16 text-slate-400 text-xs">
        جارٍ تحميل إعدادات المنظومة...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#0c101c] p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            <span>إعدادات النظام والمنظومة العامة</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            التحكم في أوضاع الصيانة، التسجيل، المعايير الافتراضية للامتحانات، والرسائل العامة
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm shadow-blue-500/20 flex items-center gap-2 cursor-pointer self-start sm:self-auto disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}</span>
        </button>
      </div>

      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* System Availability Card */}
        <div className="bg-white dark:bg-[#0c101c] p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-600" />
            <span>إتاحة المنظومة والوصول</span>
          </h2>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-[#13192a]">
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  وضع الصيانة المؤقتة (Maintenance Mode)
                </span>
                <span className="text-[11px] text-slate-400">
                  عند التفعيل، تظهر شاشة تنبيه بالصيانة لجميع الطلبة ويقتصر الدخول على المشرفين فقط.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.maintenanceMode}
                  onChange={(e) =>
                    setSettings({ ...settings, maintenanceMode: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-[#13192a]">
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  قبول تسجيل طلبة جدد
                </span>
                <span className="text-[11px] text-slate-400">
                  السماح للطلبة الجدد بإنشاء حسابات توجيهي 2009 عبر المصادقة.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.registrationOpen}
                  onChange={(e) =>
                    setSettings({ ...settings, registrationOpen: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Examination Defaults */}
        <div className="bg-white dark:bg-[#0c101c] p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-600" />
            <span>المعايير الافتراضية للامتحانات والتقييم</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                المدة الافتراضية للامتحان (دقائق)
              </label>
              <input
                type="number"
                min={5}
                max={180}
                value={settings.defaultExamDurationMinutes}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    defaultExamDurationMinutes: Number(e.target.value),
                  })
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#13192a] text-xs font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                نقاط السؤال الافتراضية
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={settings.defaultPointsPerQuestion}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    defaultPointsPerQuestion: Number(e.target.value),
                  })
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#13192a] text-xs font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                السماح بإعادة المحاولة افتراضياً
              </label>
              <select
                value={settings.allowRetakesDefault ? 'true' : 'false'}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    allowRetakesDefault: e.target.value === 'true',
                  })
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#13192a] text-xs font-semibold"
              >
                <option value="true">نعم، مسموح</option>
                <option value="false">لا، محاولة واحدة فقط</option>
              </select>
            </div>
          </div>
        </div>

        {/* WhatsApp Community Card */}
        <div className="bg-white dark:bg-[#0c101c] p-6 rounded-3xl border border-emerald-500/30 dark:border-emerald-500/20 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.311.045-.698.077-1.114-.055-.417-.132-.977-.321-1.688-.636-1.503-.666-2.502-2.186-2.58-2.288-.077-.101-.611-.813-.611-1.55 0-.737.387-1.1.524-1.25.137-.15.3-.188.4-.188.1 0 .201.002.288.006.094.004.22-.036.344.263.128.31.439 1.072.477 1.15.038.077.064.168.013.27-.051.101-.077.164-.153.253-.077.089-.161.198-.231.266-.077.076-.157.159-.068.312.089.153.396.654.85 1.058.584.521 1.077.682 1.23.759.153.076.242.064.332-.038.09-.102.383-.446.485-.599.102-.153.204-.127.344-.076.14.051.892.42 1.045.497.153.076.255.114.293.178.038.064.038.369-.106.774zM12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.98-1.306A9.957 9.957 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/>
                </svg>
              </div>
              <span>مجتمع توجيهي 2009 على واتساب (settings/community)</span>
            </h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
              {community.enabled ? 'مفعّل حالياً' : 'معطّل'}
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            التحكم في إتاحة رابط مجموعة الواتساب للطلاب، وتعيين الرابط المعتمد لمجتمع أريكسون (Arixon | مجتمع توجيهي 2009).
          </p>

          <div className="space-y-4 pt-1">
            {/* Enabled Toggle */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  تفعيل ظهور بطاقة المجتمع للطلاب
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  عند التفعيل ووجود رابط صالح، تظهر بطاقة "انضم لمجتمع توجيهي 2009 على واتساب" في إعدادات الطالب.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={community.enabled}
                  onChange={(e) => setCommunity({ ...community, enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* Label Input */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                اسم المجموعة / التسمية التوضيحية
              </label>
              <input
                type="text"
                value={community.label}
                onChange={(e) => setCommunity({ ...community, label: e.target.value })}
                placeholder="Arixon | مجتمع توجيهي 2009"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#13192a] text-xs font-bold text-slate-900 dark:text-white"
              />
            </div>

            {/* URL Input with Live Validation */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  رابط مجموعة الواتساب (WhatsApp Invite Link)
                </label>
                {community.whatsappUrl.startsWith('https://chat.whatsapp.com/') ? (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>رابط معتمد يبدأ بـ https://chat.whatsapp.com/</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>يجب أن يبدأ بـ https://chat.whatsapp.com/</span>
                  </span>
                )}
              </div>
              <input
                type="url"
                dir="ltr"
                value={community.whatsappUrl}
                onChange={(e) => {
                  const val = e.target.value;
                  setCommunity({ ...community, whatsappUrl: val });
                  if (val && !val.startsWith('https://chat.whatsapp.com/')) {
                    setCommunityUrlError('يجب أن يبدأ الرابط بـ https://chat.whatsapp.com/');
                  } else {
                    setCommunityUrlError(null);
                  }
                }}
                placeholder="https://chat.whatsapp.com/..."
                className={`w-full px-3.5 py-2.5 rounded-xl border ${
                  communityUrlError
                    ? 'border-rose-400 focus:ring-rose-500'
                    : 'border-slate-200 dark:border-slate-800'
                } bg-slate-50 dark:bg-[#13192a] text-xs font-mono text-slate-900 dark:text-white`}
              />
              {communityUrlError && (
                <p className="text-[11px] text-rose-500 mt-1 font-semibold">
                  {communityUrlError}
                </p>
              )}
            </div>

            {/* Test Link Button */}
            {community.whatsappUrl && community.whatsappUrl.startsWith('https://chat.whatsapp.com/') && (
              <div className="pt-1">
                <a
                  href={community.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition-colors"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.311.045-.698.077-1.114-.055-.417-.132-.977-.321-1.688-.636-1.503-.666-2.502-2.186-2.58-2.288-.077-.101-.611-.813-.611-1.55 0-.737.387-1.1.524-1.25.137-.15.3-.188.4-.188.1 0 .201.002.288.006.094.004.22-.036.344.263.128.31.439 1.072.477 1.15.038.077.064.168.013.27-.051.101-.077.164-.153.253-.077.089-.161.198-.231.266-.077.076-.157.159-.068.312.089.153.396.654.85 1.058.584.521 1.077.682 1.23.759.153.076.242.064.332-.038.09-.102.383-.446.485-.599.102-.153.204-.127.344-.076.14.051.892.42 1.045.497.153.076.255.114.293.178.038.064.038.369-.106.774zM12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.98-1.306A9.957 9.957 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/>
                  </svg>
                  <span>اختبار فتح الرابط في تبويب جديد</span>
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Global Broadcast Notice */}
        <div className="bg-white dark:bg-[#0c101c] p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>رسالة التنبيه العلوية العامة (System Banner Notice)</span>
          </h2>
          <p className="text-xs text-slate-400">
            تظهر هذه الرسالة كشريط تنبيه علوي في أعلى الشاشة الرئيسية لجميع المستخدمين عند الرغبة.
          </p>
          <input
            type="text"
            value={settings.systemNotice || ''}
            onChange={(e) => setSettings({ ...settings, systemNotice: e.target.value })}
            placeholder="مثال: مرحباً بكم في منصة أريكسون - تم إطلاق نماذج الفيزياء الوزارية الجديدة لتوجيهي 2009"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#13192a] text-xs"
          />
        </div>
      </form>
    </div>
  );
};
