import React, { useState, useEffect, useRef } from 'react';
import {
  Image as ImageIcon,
  Plus,
  Edit3,
  Trash2,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Sliders,
  CheckCircle2,
  AlertCircle,
  X,
  Upload,
  Link as LinkIcon,
  Eye,
  EyeOff,
  Clock,
  Sparkles,
  Layers,
  Save,
} from 'lucide-react';
import {
  fetchAllPromoBanners,
  getPromoSettings,
  updatePromoSettings,
  savePromoBanner,
  deletePromoBanner,
  togglePromoBanner,
  reorderPromoBanners,
  uploadPromoImage,
  INITIAL_PROMO_BANNERS,
} from '../../lib/promoService';
import type { PromoBanner, PromoSettings, PromoBannerLinkType } from '../../types';

export const AdminPromoBannersView: React.FC = () => {
  const [banners, setBanners] = useState<PromoBanner[]>([]);
  const [settings, setSettings] = useState<PromoSettings>({ enabled: true, intervalSeconds: 5 });
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSuccessMessage, setSettingsSuccessMessage] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<PromoBanner | null>(null);

  // Form Fields
  const [imageSourceMode, setImageSourceMode] = useState<'upload' | 'preset' | 'url'>('upload');
  const [imageUrl, setImageUrl] = useState('');
  const [alt, setAlt] = useState('');
  const [linkType, setLinkType] = useState<PromoBannerLinkType>('none');
  const [linkTarget, setLinkTarget] = useState('');
  const [active, setActive] = useState(true);
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [order, setOrder] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Image Uploading
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [fetchedBanners, fetchedSettings] = await Promise.all([
        fetchAllPromoBanners(),
        getPromoSettings(),
      ]);
      setBanners(fetchedBanners);
      setSettings(fetchedSettings);
    } catch (err) {
      console.error('[AdminPromoBanners] Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setSettingsSuccessMessage(null);
    try {
      await updatePromoSettings(settings);
      setSettingsSuccessMessage('تم حفظ إعدادات السلايدر بنجاح!');
      setTimeout(() => setSettingsSuccessMessage(null), 3000);
    } catch (err: any) {
      alert(err?.message || 'تعذر حفظ الإعدادات');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const openCreateModal = () => {
    setEditingBanner(null);
    setImageSourceMode('upload');
    setImageUrl('');
    setSelectedFile(null);
    setAlt('');
    setLinkType('none');
    setLinkTarget('');
    setActive(true);
    setStartAt('');
    setEndAt('');
    setOrder(banners.length + 1);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (banner: PromoBanner) => {
    setEditingBanner(banner);
    setImageSourceMode('url');
    setImageUrl(banner.imageUrl);
    setSelectedFile(null);
    setAlt(banner.alt || '');
    setLinkType(banner.linkType || 'none');
    setLinkTarget(banner.linkTarget || '');
    setActive(banner.active);
    setStartAt(banner.startAt ? banner.startAt.slice(0, 16) : '');
    setEndAt(banner.endAt ? banner.endAt.slice(0, 16) : '');
    setOrder(banner.order || 1);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Generate preview object url
      const previewUrl = URL.createObjectURL(file);
      setImageUrl(previewUrl);
    }
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    let finalImageUrl = imageUrl.trim();

    // If uploading a file, compress and upload to Firebase Storage
    if (selectedFile && imageSourceMode === 'upload') {
      setIsUploading(true);
      try {
        finalImageUrl = await uploadPromoImage(selectedFile);
      } catch (uploadErr: any) {
        setFormError(uploadErr?.message || 'فشل رفع الصورة');
        setIsUploading(false);
        return;
      } finally {
        setIsUploading(false);
      }
    }

    if (!finalImageUrl) {
      setFormError('يرجى تحديد أو رفع صورة للبنر');
      return;
    }

    setIsSubmitting(true);
    try {
      await savePromoBanner({
        id: editingBanner?.id,
        imageUrl: finalImageUrl,
        alt: alt.trim(),
        linkType,
        linkTarget: linkTarget.trim(),
        active,
        order: Number(order) || 1,
        startAt: startAt ? new Date(startAt).toISOString() : null,
        endAt: endAt ? new Date(endAt).toISOString() : null,
      });

      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setFormError(err?.message || 'تعذر حفظ البنر');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (banner: PromoBanner) => {
    try {
      const newActive = !banner.active;
      await togglePromoBanner(banner.id, newActive, banner.alt);
      setBanners((prev) =>
        prev.map((b) => (b.id === banner.id ? { ...b, active: newActive } : b))
      );
    } catch (err: any) {
      alert(err?.message || 'تعذر تغيير حالة البنر');
    }
  };

  const handleDelete = async (banner: PromoBanner) => {
    if (!window.confirm(`هل أنت متأكد من حذف البنر الإعلاني "${banner.alt || banner.id}"؟`)) {
      return;
    }
    try {
      await deletePromoBanner(banner.id, banner.alt);
      setBanners((prev) => prev.filter((b) => b.id !== banner.id));
    } catch (err: any) {
      alert(err?.message || 'تعذر حذف البنر');
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= banners.length) return;

    const newBanners = [...banners];
    const [moved] = newBanners.splice(index, 1);
    newBanners.splice(targetIndex, 0, moved);

    // Update order property
    const reordered = newBanners.map((b, i) => ({ ...b, order: i + 1 }));
    setBanners(reordered);

    try {
      await reorderPromoBanners(reordered);
    } catch (err: any) {
      console.warn('Error saving new banner order:', err);
      loadData();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white dark:bg-[#0c101c] border border-slate-200/90 dark:border-slate-800/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <ImageIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                الإعلانات المصوّرة (Promo Carousel)
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                إدارة سلايدر الإعلانات والبنرات الترويجية في الصفحة الرئيسية للطالب
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة بنر جديد</span>
        </button>
      </div>

      {/* Global Carousel Settings Card */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#0c101c] border border-slate-200/90 dark:border-slate-800/90 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              إعدادات السلايدر التلقائي
            </h2>
          </div>
          {settingsSuccessMessage && (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-900">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{settingsSuccessMessage}</span>
            </span>
          )}
        </div>

        <form onSubmit={handleSaveSettings} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          {/* Enable Toggle */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              حالة السلايدر في الواجهة
            </label>
            <div className="flex items-center gap-3 h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                {settings.enabled ? 'مفعّل ويظهر للطلاب' : 'معطّل (مخفي)'}
              </span>
            </div>
          </div>

          {/* Interval in seconds */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              مدة التبديل التلقائي (بالثواني)
            </label>
            <div className="relative">
              <input
                type="number"
                min="2"
                max="60"
                value={settings.intervalSeconds}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    intervalSeconds: Math.max(2, parseInt(e.target.value) || 5),
                  })
                }
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
              <span className="absolute left-3 top-2.5 text-xs text-slate-400">ثواني</span>
            </div>
          </div>

          {/* Submit button */}
          <div>
            <button
              type="submit"
              disabled={isSavingSettings}
              className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSavingSettings ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Banners List */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#0c101c] border border-slate-200/90 dark:border-slate-800/90 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              قائمة البنرات الإعلانية ({banners.length})
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            يمكنك سحب وترتيب البنرات باستخدام أزرار الأسهم
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-sm">جارٍ تحميل البنرات...</div>
        ) : banners.length === 0 ? (
          <div className="p-12 text-center">
            <ImageIcon className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              لا توجد بنرات إعلانية بعد
            </p>
            <p className="text-xs text-slate-400 mt-1">
              انقر فوق "إضافة بنر جديد" لعرض إعلانات مميزة للطلاب
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {banners.map((banner, index) => {
              const isFirst = index === 0;
              const isLast = index === banners.length - 1;

              return (
                <div
                  key={banner.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border transition-all ${
                    banner.active
                      ? 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800'
                      : 'bg-slate-100/50 dark:bg-slate-950/40 border-slate-200/50 dark:border-slate-900 opacity-60'
                  }`}
                >
                  {/* Left (Order + Image Thumbnail + Info) */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Order Controls */}
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={isFirst}
                        onClick={() => handleMove(index, 'up')}
                        title="تحريك لأعلى"
                        className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-slate-200/60 dark:hover:bg-slate-800 disabled:opacity-20 cursor-pointer"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[11px] font-bold text-slate-500 font-mono">
                        {banner.order || index + 1}
                      </span>
                      <button
                        type="button"
                        disabled={isLast}
                        onClick={() => handleMove(index, 'down')}
                        title="تحريك لأسفل"
                        className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-slate-200/60 dark:hover:bg-slate-800 disabled:opacity-20 cursor-pointer"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Image Thumbnail */}
                    <div className="relative w-28 sm:w-36 aspect-video rounded-xl overflow-hidden bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700 shadow-2xs">
                      <img
                        src={banner.imageUrl}
                        alt={banner.alt || 'بنر'}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Banner Info */}
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                          {banner.alt || 'بدون نص بديل'}
                        </h3>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            banner.active
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900'
                              : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {banner.active ? 'نشط' : 'موقوف'}
                        </span>
                      </div>

                      {/* Link Info */}
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        {banner.linkType === 'internal' && (
                          <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
                            <LinkIcon className="w-3 h-3" />
                            <span>داخلي: {banner.linkTarget}</span>
                          </span>
                        )}
                        {banner.linkType === 'external' && (
                          <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 truncate max-w-[200px]">
                            <ExternalLink className="w-3 h-3" />
                            <span>خارجي: {banner.linkTarget}</span>
                          </span>
                        )}
                        {(!banner.linkType || banner.linkType === 'none') && (
                          <span className="text-slate-400">بدون رابط</span>
                        )}

                        {/* Date schedule indicator */}
                        {(banner.startAt || banner.endAt) && (
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-mono text-[10px]">
                            <Clock className="w-3 h-3" />
                            <span>مجدول زمنيًا</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions (Toggle, Edit, Delete) */}
                  <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(banner)}
                      title={banner.active ? 'إيقاف البنر' : 'تفعيل البنر'}
                      className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      {banner.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditModal(banner)}
                      title="تعديل البنر"
                      className="p-2 rounded-xl text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(banner)}
                      title="حذف البنر"
                      className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Banner Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#0c101c] border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {editingBanner ? 'تعديل البنر الإعلاني' : 'إضافة بنر إعلاني جديد'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleModalSubmit} className="space-y-4">
              {/* Image Source Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  مصدر صورة البنر (نسبة العرض للارتفاع 16:9)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setImageSourceMode('upload')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      imageSourceMode === 'upload'
                        ? 'bg-blue-50 text-blue-700 border-blue-500 dark:bg-blue-950/60 dark:text-blue-300'
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    رفع صورة جديدة
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageSourceMode('preset')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      imageSourceMode === 'preset'
                        ? 'bg-blue-50 text-blue-700 border-blue-500 dark:bg-blue-950/60 dark:text-blue-300'
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    الصور الجاهزة
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageSourceMode('url')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      imageSourceMode === 'url'
                        ? 'bg-blue-50 text-blue-700 border-blue-500 dark:bg-blue-950/60 dark:text-blue-300'
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    رابط مباشر (URL)
                  </button>
                </div>

                {/* Upload File Mode */}
                {imageSourceMode === 'upload' && (
                  <div className="space-y-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-4 text-center hover:border-blue-500 cursor-pointer bg-slate-50/50 dark:bg-slate-900/50 transition-colors"
                    >
                      <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {selectedFile ? selectedFile.name : 'انقر لاختيار صورة من جهازك'}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        سيتم ضغط الصورة تلقائيًا إلى صيغة WebP بعرض أقصى 1600px وحجم أقل من 200KB
                      </p>
                    </div>
                  </div>
                )}

                {/* Preset Banners Mode */}
                {imageSourceMode === 'preset' && (
                  <div className="grid grid-cols-3 gap-2">
                    {INITIAL_PROMO_BANNERS.map((preset, pIdx) => (
                      <div
                        key={preset.id}
                        onClick={() => {
                          setImageUrl(preset.imageUrl);
                          if (!alt) setAlt(preset.alt);
                        }}
                        className={`aspect-video rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                          imageUrl === preset.imageUrl
                            ? 'border-blue-600 ring-2 ring-blue-500/50'
                            : 'border-slate-200 dark:border-slate-800 hover:border-blue-400'
                        }`}
                      >
                        <img
                          src={preset.imageUrl}
                          alt={preset.alt}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Direct URL Mode */}
                {imageSourceMode === 'url' && (
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://example.com/banner.jpg"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                )}

                {/* Image Preview */}
                {imageUrl && (
                  <div className="relative aspect-video max-h-40 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-black mt-2">
                    <img src={imageUrl} alt="معاينة البنر" className="w-full h-full object-cover" />
                    <span className="absolute bottom-2 right-2 text-[10px] bg-black/60 text-white px-2 py-0.5 rounded-md font-mono">
                      معاينة البنر (16:9)
                    </span>
                  </div>
                )}
              </div>

              {/* Alt Text / Title */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  النص البديل / وصف البنر (مهم للإتاحة والظهور)
                </label>
                <input
                  type="text"
                  required
                  value={alt}
                  onChange={(e) => setAlt(e.target.value)}
                  placeholder="مثال: امتحان الفيزياء متاح الآن — الزخم الخطي والدفع"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Link Type & Target */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    نوع الرابط عند الضغط
                  </label>
                  <select
                    value={linkType}
                    onChange={(e) => setLinkType(e.target.value as PromoBannerLinkType)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="none">بدون رابط (صورة فقط)</option>
                    <option value="internal">داخلي في المنصة (مثل /exams)</option>
                    <option value="external">خارجي (يفتح في تبويب جديد)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    الوجهة / الرابط
                  </label>
                  <input
                    type="text"
                    disabled={linkType === 'none'}
                    value={linkTarget}
                    onChange={(e) => setLinkTarget(e.target.value)}
                    placeholder={
                      linkType === 'internal'
                        ? 'exams أو leaderboard'
                        : linkType === 'external'
                        ? 'https://example.com'
                        : 'غير مفعل'
                    }
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden disabled:opacity-40"
                  />
                </div>
              </div>

              {/* Date Schedule (Optional) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    تاريخ البدء (اختياري)
                  </label>
                  <input
                    type="datetime-local"
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    تاريخ الانتهاء (اختياري)
                  </label>
                  <input
                    type="datetime-local"
                    value={endAt}
                    onChange={(e) => setEndAt(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Order & Active Toggle */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    الترتيب:
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={order}
                    onChange={(e) => setOrder(parseInt(e.target.value) || 1)}
                    className="w-20 h-9 px-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-bold text-center"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    className="w-4 h-4 rounded-sm text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    تفعيل هذا البنر فوراً
                  </span>
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isUploading}
                  className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isUploading
                    ? 'جارٍ ضغط ورفع الصورة...'
                    : isSubmitting
                    ? 'جارٍ الحفظ...'
                    : editingBanner
                    ? 'حفظ التعديلات'
                    : 'إضافة البنر'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
