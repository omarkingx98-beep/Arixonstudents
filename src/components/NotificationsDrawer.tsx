import React, { useState } from 'react';
import { 
  Bell, 
  X, 
  CheckCheck, 
  MessageSquare, 
  UserPlus, 
  Check, 
  ShieldAlert, 
  Clock, 
  Trash2,
  Sparkles,
  Loader2,
  BookOpen,
  Pause,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { 
  markNotificationAsRead, 
  markAllNotificationsAsRead, 
  deleteNotification 
} from '../lib/notificationService';
import { acceptFriendRequest, rejectFriendRequest } from '../lib/friendService';
import { useAuth } from '../context/AuthContext';
import type { AppNotification, BroadcastNotification } from '../types';

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  broadcasts?: BroadcastNotification[];
  lastReadBroadcastAt?: string | null;
  onOpenChatWithUser?: (userId: string, userName: string) => void;
  onOpenExam?: (examId: string) => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  broadcasts = [],
  lastReadBroadcastAt,
  onOpenChatWithUser,
  onOpenExam,
}) => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'broadcasts' | 'direct'>('broadcasts');
  const [processingId, setProcessingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleMarkAllRead = async () => {
    if (!profile) return;
    try {
      await markAllNotificationsAsRead(profile.uid);
    } catch (err) {
      console.warn('Error marking all as read:', err);
    }
  };

  const handleNotificationClick = async (notif: AppNotification) => {
    if (!notif.read) {
      markNotificationAsRead(notif.id).catch(() => {});
    }

    if (notif.type === 'chat_message' && notif.senderId && onOpenChatWithUser) {
      onClose();
      onOpenChatWithUser(notif.senderId, notif.senderName || 'الطالب');
    }
  };

  const handleBroadcastClick = (b: BroadcastNotification) => {
    if (b.examId && onOpenExam) {
      onOpenExam(b.examId);
    }
  };

  const handleAcceptFriend = async (notif: AppNotification) => {
    if (!profile || !notif.metadata?.requestId || !notif.senderId) return;
    setProcessingId(notif.id);
    try {
      await acceptFriendRequest(notif.metadata.requestId, notif.senderId, profile);
      await markNotificationAsRead(notif.id);
      alert('تم قبول طلب الصداقة بنجاح! يمكنك الآن مراسلته.');
    } catch (err: any) {
      alert(err.message || 'فشل قبول طلب الصداقة.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectFriend = async (notif: AppNotification) => {
    if (!notif.metadata?.requestId) return;
    setProcessingId(notif.id);
    try {
      await rejectFriendRequest(notif.metadata.requestId);
      await deleteNotification(notif.id);
    } catch (err: any) {
      alert(err.message || 'فشل رفض الطلب.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (e: React.MouseEvent, notifId: string) => {
    e.stopPropagation();
    try {
      await deleteNotification(notifId);
    } catch {}
  };

  const getBroadcastIcon = (type: string) => {
    switch (type) {
      case 'exam_published':
      case 'exam_republished':
        return <BookOpen className="w-4 h-4 text-emerald-500" />;
      case 'exam_unpublished':
        return <Pause className="w-4 h-4 text-amber-500" />;
      case 'exam_updated':
        return <Sparkles className="w-4 h-4 text-blue-500" />;
      default:
        return <Bell className="w-4 h-4 text-purple-500" />;
    }
  };

  const unreadDirectCount = notifications.filter((n) => !n.read).length;
  const unreadBroadcastsCount = broadcasts.filter((b) => {
    if (!lastReadBroadcastAt) return true;
    return new Date(b.createdAt).getTime() > new Date(lastReadBroadcastAt).getTime();
  }).length;

  return (
    <div className="fixed inset-0 z-50 flex justify-start bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div 
        onClick={onClose}
        className="absolute inset-0"
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-sm sm:max-w-md bg-white dark:bg-[#0c101c] h-full shadow-2xl flex flex-col z-10 border-l border-slate-200 dark:border-slate-800 animate-slideInRight">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                الإشعارات والتنبيهات
              </h2>
              <span className="text-[11px] text-slate-400">
                منصة أريكسون للثانوية العامة 2009
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {activeTab === 'direct' && unreadDirectCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="p-1.5 rounded-xl text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                title="تحديد الكل كمقروء"
              >
                <CheckCheck className="w-4 h-4" />
                <span className="hidden sm:inline text-[11px]">قراءة الكل</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs (Broadcasts vs Direct) */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#090d16] p-1.5 gap-1.5 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('broadcasts')}
            className={`flex-1 py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'broadcasts'
                ? 'bg-white dark:bg-[#13192a] text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>إعلانات الامتحانات</span>
            {unreadBroadcastsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-red-600 text-white font-mono">
                {unreadBroadcastsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('direct')}
            className={`flex-1 py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'direct'
                ? 'bg-white dark:bg-[#13192a] text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>الرسائل والطلبات</span>
            {unreadDirectCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-600 text-white font-mono">
                {unreadDirectCount}
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: Broadcasts (D2 economical notifications) */}
        {activeTab === 'broadcasts' && (
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {broadcasts.length === 0 ? (
              <div className="text-center py-20 text-slate-400 space-y-2">
                <BookOpen className="w-9 h-9 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="text-xs">لا توجد إعلانات أو امتحانات منشورة حديثاً</p>
                <span className="text-[10px] text-slate-400">ستصلك إشعارات فورية عند نشر أو تحديث أي امتحان</span>
              </div>
            ) : (
              broadcasts.map((b) => {
                const isNew = !lastReadBroadcastAt || new Date(b.createdAt).getTime() > new Date(lastReadBroadcastAt).getTime();
                return (
                  <div
                    key={b.id}
                    onClick={() => handleBroadcastClick(b)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative ${
                      isNew
                        ? 'bg-blue-50/60 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/60 shadow-xs'
                        : 'bg-white dark:bg-[#111625] border-slate-200/80 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-900/50'
                    }`}
                  >
                    {isNew && (
                      <span className="w-2 h-2 rounded-full bg-blue-600 absolute top-3.5 left-3.5" />
                    )}

                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0 mt-0.5">
                        {getBroadcastIcon(b.type)}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                            {b.title}
                          </h4>
                          <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                            {new Date(b.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {b.message && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                            {b.message}
                          </p>
                        )}

                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                            مسار: {b.audience?.track === 'all' || b.audience?.track === 'مشترك' ? 'مشترك (علمي وأدبي)' : b.audience?.track}
                          </span>
                          {b.examId && (
                            <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                              <span>اضغط لفتح الامتحان</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab 2: Direct Notifications (Chat & Friends) */}
        {activeTab === 'direct' && (
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {notifications.length === 0 ? (
              <div className="text-center py-20 text-slate-400 space-y-3">
                <Bell className="w-9 h-9 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="text-xs">لا توجد رسائل أو طلبات جديدة حالياً</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const isProcessing = processingId === notif.id;
                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative ${
                      !notif.read
                        ? 'bg-blue-50/60 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/60 shadow-xs'
                        : 'bg-white dark:bg-[#111625] border-slate-200/80 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-900/50'
                    }`}
                  >
                    {!notif.read && (
                      <span className="w-2 h-2 rounded-full bg-blue-600 absolute top-3.5 left-3.5" />
                    )}

                    <div className="flex items-start gap-3">
                      <div className="relative shrink-0">
                        {notif.senderPhoto ? (
                          <img
                            src={notif.senderPhoto}
                            alt=""
                            className="w-9 h-9 rounded-xl object-cover bg-slate-100 dark:bg-slate-800"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            <Bell className="w-4 h-4 text-blue-500" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {notif.title}
                          </h4>
                          <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                            {new Date(notif.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                          {notif.message}
                        </p>

                        {/* Interactive Actions for Friend Request */}
                        {notif.type === 'friend_request' && notif.metadata?.requestId && (
                          <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-800/60" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => handleAcceptFriend(notif)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                              <span>قبول الصداقة</span>
                            </button>
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => handleRejectFriend(notif)}
                              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 text-[11px] font-semibold transition-colors cursor-pointer"
                            >
                              <span>تجاهل</span>
                            </button>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, notif.id)}
                        className="text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 p-1 transition-colors"
                        title="حذف الإشعار"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};
