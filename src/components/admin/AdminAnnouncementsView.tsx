import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  ExternalLink,
  Link as LinkIcon,
  Image as ImageIcon,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Search,
  Filter,
  Megaphone,
  Layers,
  ChevronLeft,
  ChevronRight,
  Upload,
  RefreshCw,
  Globe,
  Sliders,
  Check,
  Smartphone,
  Monitor,
} from 'lucide-react';
import {
  subscribeToAllAnnouncements,
  saveDynamicAnnouncement,
  toggleDynamicAnnouncementVisibility,
  deleteDynamicAnnouncement,
  reorderDynamicAnnouncements,
  INITIAL_DYNAMIC_ANNOUNCEMENTS,
} from '../../lib/dynamicAnnouncementService';
import type { DynamicAnnouncement, DynamicAnnouncementType, AnnouncementPriority } from '../../types';

export const AdminAnnouncementsView: React.FC = () => {
  const [announcements, setAnnouncements] = useState<DynamicAnnouncement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active View Tab
  const [activeTab, setActiveTab] = useState<'all' | 'ticker' | 'image_ad' | 'preview'>('all');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DynamicAnnouncement | null>(null);

  // Form Fields
  const [type, setType] = useState<DynamicAnnouncementType>('ticker');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageSourceMode, setImageSourceMode] = useState<'preset' | 'url' | 'upload'>('preset');
  const [imageUrl, setImageUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [linkType, setLinkType] = useState<'none' | 'internal' | 'external'>('external');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [openInNewTab, setOpenInNewTab] = useState(true);
  const [priority, setPriority] = useState<AnnouncementPriority>('medium');
  const [active, setActive] = useState(true);
  const [order, setOrder] = useState<number>(1);
  const [targetAudience, setTargetAudience] = useState<'all' | 'scientific' | 'literary' | 'مشترك'>('all');
  const [expiresAt, setExpiresAt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Image file upload
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Live preview interactive state
  const [previewCarouselIndex, setPreviewCarouselIndex] = useState(0);

  // Preset images
  const PRESET_IMAGES = [
    { label: 'مجتمع واتساب الرسمي', url: '/banners/whatsapp_community_banner.webp' },
    { label: 'امتحان الفيزياء (الزخم)', url: '/banners/banner_1.jpg' },
    { label: 'امتحان اللغة العربية', url: '/banners/banner_2.jpg' },
    { label: 'لوحة الشرف والتنافس', url: '/banners/banner_3.jpg' },
    { label: 'منظومة أريكسون لجيل 2009', url: '/banners/banner_4.jpg' },
    { label: 'المراجعات والشروحات', url: '/banners/banner_5.jpg' },
  ];

  // Real-time subscription to dynamic announcements
  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = subscribeToAllAnnouncements((items) => {
      setAnnouncements(items);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Filtered list
  const filteredList = announcements.filter((item) => {
    // Type tab
    if (activeTab === 'ticker' && item.type !== 'ticker') return false;
    if (activeTab === 'image_ad' && item.type !== 'image_ad') return false;

    // Status filter
    if (statusFilter === 'active' && !item.active) return false;
    if (statusFilter === 'inactive' && item.active) return false;

    // Priority filter
    if (priorityFilter !== 'all' && item.priority !== priorityFilter) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = item.title?.toLowerCase().includes(q);
      const matchContent = item.content?.toLowerCase().includes(q);
      const matchLink = item.linkUrl?.toLowerCase().includes(q);
      if (!matchTitle && !matchContent && !matchLink) return false;
    }

    return true;
  });

  // Active items for preview
  const activeTickers = announcements.filter((a) => a.type === 'ticker' && a.active);
  const activeImageAds = announcements.filter((a) => a.type === 'image_ad' && a.active);

  // Stats
  const totalCount = announcements.length;
  const activeCount = announcements.filter((a) => a.active).length;
  const tickerCount = announcements.filter((a) => a.type === 'ticker').length;
  const imageAdCount = announcements.filter((a) => a.type === 'image_ad').length;

  const openCreateModal = (forcedType?: DynamicAnnouncementType) => {
    setEditingItem(null);
    setType(forcedType || (activeTab === 'image_ad' ? 'image_ad' : 'ticker'));
    setTitle('');
    setContent('');
    setImageSourceMode('preset');
    setImageUrl('/banners/whatsapp_community_banner.webp');
    setImageAlt('');
    setLinkType('external');
    setLinkUrl('https://chat.whatsapp.com/FQ39q5zXeZq8DJeeuPJNpu');
    setLinkLabel('انضم للجروب الآن');
    setOpenInNewTab(true);
    setPriority('medium');
    setActive(true);
    setOrder(announcements.length + 1);
    setTargetAudience('all');
    setExpiresAt('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: DynamicAnnouncement) => {
    setEditingItem(item);
    setType(item.type);
    setTitle(item.title);
    setContent(item.content || '');
    setImageUrl(item.imageUrl || '/banners/whatsapp_community_banner.webp');
    setImageAlt(item.imageAlt || '');
    setImageSourceMode(item.imageUrl?.startsWith('data:') ? 'upload' : item.imageUrl?.startsWith('/') ? 'preset' : 'url');
    setLinkType(item.linkType || (item.linkUrl ? 'external' : 'none'));
    setLinkUrl(item.linkUrl || '');
    setLinkLabel(item.linkLabel || '');
    setOpenInNewTab(item.openInNewTab !== undefined ? item.openInNewTab : true);
    setPriority(item.priority || 'medium');
    setActive(item.active);
    setOrder(item.order || 1);
    setTargetAudience(item.targetAudience || 'all');
    setExpiresAt(item.expiresAt ? item.expiresAt.substring(0, 16) : '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleToggleActive = async (item: DynamicAnnouncement) => {
    try {
      await toggleDynamicAnnouncementVisibility(item.id, item.active, item.title);
    } catch (err: any) {
      alert(err?.message || 'فشل تغيير حالة تفعيل الإعلان.');
    }
  };

  const handleDelete = async (item: DynamicAnnouncement) => {
    if (!window.confirm(`هل أنت متأكد من حذف ${item.type === 'ticker' ? 'إعلان الشريط' : 'الإعلان المصوّر'} "${item.title}" نهائياً من قاعدة البيانات؟`)) {
      return;
    }
    try {
      await deleteDynamicAnnouncement(item.id, item.title);
    } catch (err: any) {
      alert(err?.message || 'فشل حذف الإعلان.');
    }
  };

  const handleMoveOrder = async (item: DynamicAnnouncement, direction: 'up' | 'down') => {
    const currentIndex = announcements.findIndex((a) => a.id === item.id);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= announcements.length) return;

    const newOrderList = [...announcements];
    const temp = newOrderList[currentIndex];
    newOrderList[currentIndex] = newOrderList[targetIndex];
    newOrderList[targetIndex] = temp;

    const orderedIds = newOrderList.map((a) => a.id);
    try {
      await reorderDynamicAnnouncements(orderedIds);
    } catch (err: any) {
      alert(err?.message || 'فشل تحديث الترتيب');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFormError('يرجى اختيار ملف صورة صالح (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setFormError('حجم الصورة كبير جداً (الحد الأقصى 2 ميجابايت).');
      return;
    }

    setIsUploadingImage(true);
    const reader = new FileReader();
    reader.onload = () => {
      setImageUrl(reader.result as string);
      setImageSourceMode('upload');
      setIsUploadingImage(false);
      setFormError(null);
    };
    reader.onerror = () => {
      setFormError('فشلت قراءة الصورة.');
      setIsUploadingImage(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!title.trim()) {
      setFormError('يرجى إدخال عنوان الإعلان.');
      return;
    }

    if (type === 'image_ad' && !imageUrl.trim()) {
      setFormError('يرجى تحديد أو رفع صورة للإعلان المصوّر.');
      return;
    }

    setIsSubmitting(true);
    try {
      await saveDynamicAnnouncement({
        id: editingItem?.id,
        type,
        title: title.trim(),
        content: content.trim(),
        imageUrl: type === 'image_ad' ? imageUrl.trim() : undefined,
        imageAlt: imageAlt.trim() || title.trim(),
        linkUrl: linkType !== 'none' ? linkUrl.trim() : undefined,
        linkType,
        linkLabel: linkType !== 'none' ? (linkLabel.trim() || 'عرض التفاصيل') : undefined,
        openInNewTab,
        priority,
        active,
        order: Number(order) || 1,
        targetAudience,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      });

      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Error saving dynamic announcement:', err);
      setFormError(err?.message || 'حدث خطأ أثناء حفظ الإعلان.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-[#0c101c] p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Megaphone className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              إدارة الإعلانات والتعميمات والبنرات
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              <span>تحديثات لحظية ومباشرة (Real-time)</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
            التحكم الكامل بالشريط العلوي التفاعلي (Ticker) وسلايدر الإعلانات المصوّرة، مع ضبط الروابط وإظهار/إخفاء الإعلانات فورياً للطلبة.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => openCreateModal('ticker')}
            className="px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إعلان شريط علوي</span>
          </button>

          <button
            onClick={() => openCreateModal('image_ad')}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs shadow-blue-500/20 flex items-center gap-1.5 cursor-pointer"
          >
            <ImageIcon className="w-4 h-4" />
            <span>إعلان مصوّر جديد</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-[#0c101c] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span>إجمالي الإعلانات</span>
            <Layers className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {totalCount}
          </div>
        </div>

        <div className="bg-white dark:bg-[#0c101c] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span>الإعلانات النشطة حالياً</span>
            <Eye className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {activeCount}
          </div>
        </div>

        <div className="bg-white dark:bg-[#0c101c] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span>إعلانات الشريط العلوي</span>
            <Megaphone className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {tickerCount}
          </div>
        </div>

        <div className="bg-white dark:bg-[#0c101c] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span>الإعلانات المصوّرة</span>
            <ImageIcon className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {imageAdCount}
          </div>
        </div>
      </div>

      {/* Tabs & Controls */}
      <div className="bg-white dark:bg-[#0c101c] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              جميع الإعلانات ({totalCount})
            </button>
            <button
              onClick={() => setActiveTab('ticker')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'ticker'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Megaphone className="w-3.5 h-3.5" />
              <span>الشريط العلوي التفاعلي ({tickerCount})</span>
            </button>
            <button
              onClick={() => setActiveTab('image_ad')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'image_ad'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>الإعلانات المصوّرة ({imageAdCount})</span>
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'preview'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>معاينة حيّة مباشرة للطلبة</span>
            </button>
          </div>
        </div>

        {/* Filter & Search Bar (Only shown for list tabs) */}
        {activeTab !== 'preview' && (
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-1">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="بحث في العنوان أو النص أو الرابط..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-9 pl-4 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap justify-end">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="all">كل الحالات</option>
                <option value="active">نشط ومعروض</option>
                <option value="inactive">متوقف ومخفي</option>
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="all">كل الأولويات</option>
                <option value="high">هام وعاجل</option>
                <option value="medium">متوسط</option>
                <option value="low">عادي</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {activeTab === 'preview' ? (
        /* LIVE PREVIEW SECTION */
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#0c101c] p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <span>المعاينة الحيّة المباشرة لواجهة الطالب</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                هكذا تظهر إعلاناتك المصوّرة والشريط العلوي في شاشات هواتف وحواسيب الطلبة في هذه اللحظة بالضبط.
              </p>
            </div>

            {/* Preview 1: Top Ticker */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Megaphone className="w-4 h-4 text-amber-500" />
                  <span>معاينة الشريط العلوي التفاعلي (Ticker)</span>
                </span>
                <span className="text-[11px] text-slate-400 font-normal">
                  ({activeTickers.length} إعلان نشط في الشريط)
                </span>
              </div>

              {activeTickers.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-amber-300 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 text-xs text-amber-700 dark:text-amber-300 text-center">
                  لا يوجد أي إعلان شريط علوي نشط حالياً. قم بتفعيل أو إضافة إعلان ليظهر للطلبة.
                </div>
              ) : (
                <div className="relative rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-blue-500/10 dark:from-amber-950/40 dark:via-amber-900/30 dark:to-blue-950/30 border border-amber-300/40 dark:border-amber-800/40 text-slate-800 dark:text-slate-200 text-xs py-2.5 px-4 overflow-hidden flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-2 shrink-0 pr-1 pl-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500 text-white shadow-xs animate-pulse">
                      <Megaphone className="w-3 h-3" />
                      <span>إعلان هام</span>
                    </span>
                  </div>

                  <div className="flex-1 overflow-hidden relative">
                    <div className="inline-flex items-center whitespace-nowrap animate-marquee gap-8">
                      {[...activeTickers, ...activeTickers].map((ann, idx) => (
                        <span key={`prev_${ann.id}_${idx}`} className="inline-flex items-center gap-2">
                          <span className="font-bold text-amber-700 dark:text-amber-300">
                            {ann.title}:
                          </span>
                          <span className="text-slate-600 dark:text-slate-300">
                            {ann.content}
                          </span>
                          {ann.linkUrl && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold border border-emerald-400/30">
                              <span>{ann.linkLabel || 'فتح الرابط'}</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </span>
                          )}
                          <ChevronLeft className="w-3.5 h-3.5 text-amber-500 inline" />
                          <span className="text-amber-400/50">|</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Preview 2: Image Ads Slider */}
            <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-purple-500" />
                  <span>معاينة سلايدر الإعلانات المصوّرة في الشاشة الرئيسية للطلبة</span>
                </span>
                <span className="text-[11px] text-slate-400 font-normal">
                  ({activeImageAds.length} إعلان مصوّر نشط في السلايدر)
                </span>
              </div>

              {activeImageAds.length === 0 ? (
                <div className="p-8 rounded-2xl border border-dashed border-purple-300 dark:border-purple-900/60 bg-purple-50/50 dark:bg-purple-950/20 text-xs text-purple-700 dark:text-purple-300 text-center">
                  لا توجد إعلانات مصوّرة نشطة حالياً. قم بإضافة إعلان مصوّر لعرضه في السلايدر.
                </div>
              ) : (
                <div className="relative w-full aspect-video max-h-[360px] rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900 shadow-md">
                  {activeImageAds.map((ad, idx) => {
                    const isCur = idx === (previewCarouselIndex % activeImageAds.length);
                    return (
                      <div
                        key={`prev_slide_${ad.id}`}
                        className={`absolute inset-0 w-full h-full transition-opacity duration-700 ${
                          isCur ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                        }`}
                      >
                        <img
                          src={ad.imageUrl}
                          alt={ad.imageAlt || ad.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />
                        <div className="absolute bottom-4 right-5 left-5 flex items-end justify-between z-20 text-white">
                          <div className="space-y-1 max-w-[75%]">
                            <h4 className="text-sm sm:text-base font-bold drop-shadow-md">
                              {ad.title}
                            </h4>
                            {ad.content && (
                              <p className="text-xs text-slate-200 line-clamp-1 drop-shadow-sm">
                                {ad.content}
                              </p>
                            )}
                          </div>
                          {ad.linkUrl && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-white text-slate-900 shadow-xs">
                              <span>{ad.linkLabel || 'انقر للمشاهدة'}</span>
                              <ExternalLink className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {activeImageAds.length > 1 && (
                    <div className="absolute top-1/2 -translate-y-1/2 w-full px-3 flex items-center justify-between z-30 pointer-events-auto">
                      <button
                        onClick={() =>
                          setPreviewCarouselIndex(
                            (p) => (p - 1 + activeImageAds.length) % activeImageAds.length
                          )
                        }
                        className="w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          setPreviewCarouselIndex((p) => (p + 1) % activeImageAds.length)
                        }
                        className="w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* LIST OF ANNOUNCEMENTS / ADS */
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-20 text-slate-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
              <span>جارٍ تحميل الإعلانات اللحظية...</span>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-[#0c101c] rounded-3xl border border-slate-200/80 dark:border-slate-800/80 p-8 space-y-3">
              <Megaphone className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                لا توجد إعلانات مطابقة لمعايير البحث
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                يمكنك إنشاء إعلان جديد في الشريط العلوي أو إعلان مصوّر في السلايدر الآن.
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  onClick={() => openCreateModal('ticker')}
                  className="px-4 py-2 rounded-xl bg-amber-500 text-white text-xs font-bold"
                >
                  إضافة إعلان شريط علوي
                </button>
                <button
                  onClick={() => openCreateModal('image_ad')}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold"
                >
                  إضافة إعلان مصوّر
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredList.map((item, index) => {
                const isTicker = item.type === 'ticker';

                return (
                  <div
                    key={item.id}
                    id={`announcement-item-${item.id}`}
                    className={`bg-white dark:bg-[#0c101c] rounded-2xl border transition-all p-5 shadow-xs space-y-4 ${
                      item.active
                        ? 'border-slate-200/80 dark:border-slate-800/80'
                        : 'border-slate-200/40 dark:border-slate-800/40 opacity-75 bg-slate-50/50 dark:bg-slate-900/30'
                    }`}
                  >
                    {/* Top Row: Badges & Controls */}
                    <div className="flex items-center justify-between flex-wrap gap-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Type Badge */}
                        <span
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                            isTicker
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                              : 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                          }`}
                        >
                          {isTicker ? <Megaphone className="w-3.5 h-3.5" /> : <ImageIcon className="w-3.5 h-3.5" />}
                          <span>{isTicker ? 'شريط علوي (Ticker)' : 'إعلان مصوّر (Banner)'}</span>
                        </span>

                        {/* Priority Badge */}
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            item.priority === 'high'
                              ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 border border-red-200'
                              : item.priority === 'medium'
                              ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200'
                              : 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200'
                          }`}
                        >
                          {item.priority === 'high' ? 'عاجل وهام' : item.priority === 'medium' ? 'متوسط' : 'عادي'}
                        </span>

                        {/* Audience Badge */}
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {item.targetAudience === 'scientific'
                            ? 'الفرع العلمي'
                            : item.targetAudience === 'literary'
                            ? 'الفرع الأدبي'
                            : item.targetAudience === 'مشترك'
                            ? 'مشترك (علمي وأدبي)'
                            : 'لكل الفروع'}
                        </span>

                        {/* Order Badge */}
                        <span className="text-[11px] font-semibold text-slate-400">
                          الترتيب: #{item.order || index + 1}
                        </span>
                      </div>

                      {/* Right Actions: Visibility Switch & Controls */}
                      <div className="flex items-center gap-2">
                        {/* Instant Visibility Toggle Switch */}
                        <button
                          type="button"
                          onClick={() => handleToggleActive(item)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            item.active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                          title={item.active ? 'إلغاء التفعيل وإخفاء الإعلان' : 'تفعيل وإظهار الإعلان للطلبة'}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                              item.active ? 'translate-x-0' : '-translate-x-5'
                            }`}
                          />
                        </button>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400 min-w-[50px]">
                          {item.active ? 'معروض' : 'مخفي'}
                        </span>

                        {/* Move Up/Down Order */}
                        <div className="flex items-center border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                          <button
                            onClick={() => handleMoveOrder(item, 'up')}
                            disabled={index === 0}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer text-slate-600 dark:text-slate-300"
                            title="تحريك لأعلى"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleMoveOrder(item, 'down')}
                            disabled={index === filteredList.length - 1}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer text-slate-600 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800"
                            title="تحريك لأسفل"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Edit Button */}
                        <button
                          onClick={() => openEditModal(item)}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-blue-600 dark:text-blue-400 cursor-pointer transition-colors"
                          title="تعديل الإعلان"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDelete(item)}
                          className="p-1.5 rounded-lg border border-red-200 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 cursor-pointer transition-colors"
                          title="حذف الإعلان"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Middle Row: Content & Image */}
                    <div className="flex flex-col md:flex-row gap-4 items-start">
                      {/* Image Preview for image ads */}
                      {item.type === 'image_ad' && item.imageUrl && (
                        <div className="w-full md:w-48 aspect-video rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shrink-0 bg-slate-900 relative group">
                          <img
                            src={item.imageUrl}
                            alt={item.imageAlt || item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      )}

                      {/* Text & Link Details */}
                      <div className="flex-1 space-y-2">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
                          {item.title}
                        </h3>

                        {item.content && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                            {item.content}
                          </p>
                        )}

                        {/* Link Config Info */}
                        {item.linkUrl && (
                          <div className="pt-2 flex items-center gap-2 flex-wrap text-xs">
                            <span className="text-slate-400 font-medium">الرابط المرفق:</span>
                            <a
                              href={item.linkUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 hover:underline font-bold text-xs"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>{item.linkLabel || item.linkUrl}</span>
                            </a>
                            <span className="text-[11px] text-slate-400 font-mono">
                              ({item.linkUrl})
                            </span>
                            {item.openInNewTab && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500">
                                نافذة جديدة
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer Row: Timestamps */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400 flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <span>تاريخ الإنشاء: {new Date(item.createdAt).toLocaleDateString('ar-EG')}</span>
                        {item.expiresAt && (
                          <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>ينتهي في: {new Date(item.expiresAt).toLocaleString('ar-EG')}</span>
                          </span>
                        )}
                      </div>
                      <span>بواسطة: {item.createdBy || 'الإدارة'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn overflow-y-auto">
          <div className="bg-white dark:bg-[#0c101c] w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-5 my-8 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  {type === 'ticker' ? <Megaphone className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    {editingItem ? 'تعديل الإعلان' : 'إنشاء إعلان جديد'}
                  </h3>
                  <span className="text-xs text-slate-400">
                    {type === 'ticker'
                      ? 'إعلان نصي تفاعلي في الشريط العلوي'
                      : 'إعلان مصوّر في سلايدر الشاشة الرئيسية'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Message */}
            {formError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs flex items-center gap-2 border border-red-200 dark:border-red-800">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Type Selection */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                  نوع الإعلان:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setType('ticker')}
                    className={`p-3 rounded-2xl border text-right transition-all cursor-pointer flex items-center gap-3 ${
                      type === 'ticker'
                        ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Megaphone className="w-5 h-5 text-amber-500 shrink-0" />
                    <div>
                      <div className="font-bold">شريط علوي (Ticker)</div>
                      <div className="text-[11px] opacity-80">يتحرك أعلى كل صفحات المنصة</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setType('image_ad')}
                    className={`p-3 rounded-2xl border text-right transition-all cursor-pointer flex items-center gap-3 ${
                      type === 'image_ad'
                        ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/30 text-purple-900 dark:text-purple-200 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <ImageIcon className="w-5 h-5 text-purple-500 shrink-0" />
                    <div>
                      <div className="font-bold">إعلان مصوّر (Banner)</div>
                      <div className="text-[11px] opacity-80">في سلايدر الواجهة الرئيسية</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Title Input */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  عنوان الإعلان *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: انضم لمجتمع Arixon على واتساب"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 text-xs"
                />
              </div>

              {/* Content / Description */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  نص الإعلان أو الوصف الترويجي
                </label>
                <textarea
                  rows={3}
                  placeholder="اكتب تفاصيل الإعلان والتنبيهات الموجهة لطلبة التوجيهي..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 text-xs leading-relaxed"
                />
              </div>

              {/* Image Selection (Only if image_ad) */}
              {type === 'image_ad' && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
                  <label className="block text-slate-700 dark:text-slate-300 font-bold">
                    صورة الإعلان المصوّر *
                  </label>

                  {/* Mode Selector */}
                  <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
                    <button
                      type="button"
                      onClick={() => setImageSourceMode('preset')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                        imageSourceMode === 'preset'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      مكتبة البنرات الجاهزة
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageSourceMode('upload')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                        imageSourceMode === 'upload'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      رفع صورة من الجهاز
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageSourceMode('url')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                        imageSourceMode === 'url'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      رابط صورة خارجي (URL)
                    </button>
                  </div>

                  {/* Mode 1: Presets */}
                  {imageSourceMode === 'preset' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {PRESET_IMAGES.map((preset) => {
                        const isSelected = imageUrl === preset.url;
                        return (
                          <div
                            key={preset.url}
                            onClick={() => setImageUrl(preset.url)}
                            className={`p-1.5 rounded-xl border text-center cursor-pointer transition-all ${
                              isSelected
                                ? 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50 dark:bg-blue-950/40'
                                : 'border-slate-200 dark:border-slate-800 hover:border-slate-400'
                            }`}
                          >
                            <img
                              src={preset.url}
                              alt={preset.label}
                              className="w-full aspect-video object-cover rounded-lg mb-1"
                            />
                            <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 block truncate">
                              {preset.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Mode 2: Upload */}
                  {imageSourceMode === 'upload' && (
                    <div className="space-y-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingImage}
                        className="w-full py-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 text-slate-600 dark:text-slate-300 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
                      >
                        <Upload className="w-5 h-5 text-blue-500" />
                        <span className="font-bold text-xs">
                          {isUploadingImage ? 'جارٍ معالجة الصورة...' : 'انقر لاختيار صورة من جهازك'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          يدعم PNG, JPG, WebP بحجم حتى 2 ميجابايت
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Mode 3: Custom URL */}
                  {imageSourceMode === 'url' && (
                    <div>
                      <input
                        type="url"
                        placeholder="https://example.com/banner.jpg"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 text-xs"
                      />
                    </div>
                  )}

                  {/* Preview Box */}
                  {imageUrl && (
                    <div className="space-y-1 pt-1">
                      <span className="text-[11px] font-bold text-slate-500">معاينة الصورة المختارة:</span>
                      <div className="w-full aspect-video max-h-36 rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 bg-slate-900">
                        <img src={imageUrl} alt="معاينة" className="w-full h-full object-cover" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Link Configuration Section */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
                <label className="block text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1.5">
                  <LinkIcon className="w-4 h-4 text-emerald-500" />
                  <span>إعدادات الرابط والتوجيه (Link Configuration)</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLinkType('external');
                      if (!linkUrl) setLinkUrl('https://chat.whatsapp.com/FQ39q5zXeZq8DJeeuPJNpu');
                    }}
                    className={`p-2.5 rounded-xl border text-center cursor-pointer transition-all ${
                      linkType === 'external'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    🌐 رابط خارجي (External)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLinkType('internal');
                      if (!linkUrl || linkUrl.startsWith('http')) setLinkUrl('/exams');
                    }}
                    className={`p-2.5 rounded-xl border text-center cursor-pointer transition-all ${
                      linkType === 'internal'
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 font-bold'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    📱 صفحة داخلية (Internal)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLinkType('none');
                      setLinkUrl('');
                    }}
                    className={`p-2.5 rounded-xl border text-center cursor-pointer transition-all ${
                      linkType === 'none'
                        ? 'border-slate-500 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    🚫 بدون رابط
                  </button>
                </div>

                {linkType !== 'none' && (
                  <div className="space-y-3 pt-2">
                    {/* Fast Presets */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-slate-400">روابط سريعة:</span>
                      <button
                        type="button"
                        onClick={() => {
                          setLinkType('external');
                          setLinkUrl('https://chat.whatsapp.com/FQ39q5zXeZq8DJeeuPJNpu');
                          setLinkLabel('انضم لمجتمع واتساب');
                          setOpenInNewTab(true);
                        }}
                        className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold"
                      >
                        مجتمع واتساب الرسمي
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLinkType('internal');
                          setLinkUrl('/exams');
                          setLinkLabel('تصفح الامتحانات');
                          setOpenInNewTab(false);
                        }}
                        className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-bold"
                      >
                        صفحة الامتحانات
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLinkType('internal');
                          setLinkUrl('/leaderboard');
                          setLinkLabel('لوحة الشرف');
                          setOpenInNewTab(false);
                        }}
                        className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-[10px] font-bold"
                      >
                        لوحة الشرف
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                          عنوان الرابط (URL / مسار الصفحة) *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder={linkType === 'external' ? 'https://chat.whatsapp.com/...' : '/exams'}
                          value={linkUrl}
                          onChange={(e) => setLinkUrl(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-emerald-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                          نص زر الرابط
                        </label>
                        <input
                          type="text"
                          placeholder="مثال: انضم الآن / ابدأ الامتحان"
                          value={linkLabel}
                          onChange={(e) => setLinkLabel(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="modal-openInNewTab"
                        checked={openInNewTab}
                        onChange={(e) => setOpenInNewTab(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                      />
                      <label htmlFor="modal-openInNewTab" className="text-slate-700 dark:text-slate-300 cursor-pointer font-medium text-xs">
                        فتح الرابط في نافذة جديدة (target="_blank")
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Visibility, Priority, Audience & Expiry */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Visibility Toggle */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">حالة العرض والتفعيل</span>
                    <span className="text-[10px] text-slate-400">إظهار الإعلان للطلبة فوراً</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActive(!active)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        active ? 'translate-x-0' : '-translate-x-5'
                      }`}
                    />
                  </button>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    مستوى الأولوية
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none"
                  >
                    <option value="high">عاجل وهام (أحمر)</option>
                    <option value="medium">متوسط (برتقالي)</option>
                    <option value="low">عادي (أزرق)</option>
                  </select>
                </div>

                {/* Target Audience */}
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    الجمهور المستهدف
                  </label>
                  <select
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value as any)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none"
                  >
                    <option value="all">كافة الطلبة (علمي وأدبي)</option>
                    <option value="scientific">طلبة الفرع العلمي فقط</option>
                    <option value="literary">طلبة الفرع الأدبي فقط</option>
                    <option value="مشترك">المشترك العام</option>
                  </select>
                </div>

                {/* Expiration date */}
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    تاريخ ووقت انتهاء الإعلان (اختياري)
                  </label>
                  <input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none text-xs"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer disabled:opacity-50 transition-all shadow-md shadow-blue-500/20 flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>جارٍ الحفظ...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{editingItem ? 'حفظ التعديلات' : 'نشر الإعلان الآن'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
