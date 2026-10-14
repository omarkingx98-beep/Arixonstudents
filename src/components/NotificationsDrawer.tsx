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
  Loader2
} from 'lucide-react';
import { 
  markNotificationAsRead, 
  markAllNotificationsAsRead, 
  deleteNotification 
} from '../lib/notificationService';
import { acceptFriendRequest, rejectFriendRequest } from '../lib/friendService';
import { useAuth } from '../context/AuthContext';
import type { AppNotification } from '../types';

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onOpenChatWithUser?: (userId: string, userName: string) => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onOpenChatWithUser,
}) => {
  const { profile } = useAuth();
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

  const getIconForType = (type: string) => {
    switch (type) {
      case 'chat_message':
        return <MessageSquare className="w-4 h-4 text-blue-500" />;
      case 'friend_request':
        return <UserPlus className="w-4 h-4 text-emerald-500" />;
      case 'friend_accept':
        return <Sparkles className="w-4 h-4 text-amber-500" />;
      case 'admin_direct_message':
      case 'admin_announcement':
        return <ShieldAlert className="w-4 h-4 text-purple-500" />;
      default:
        return <Bell className="w-4 h-4 text-blue-500" />;
    }
  };

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
                {notifications.filter((n) => !n.read).length} غير مقروء
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {notifications.some((n) => !n.read) && (
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
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {notifications.length === 0 ? (
            <div className="text-center py-20 text-slate-400 space-y-3">
              <Bell className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-xs">لا توجد إشعارات جديدة حالياً</p>
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
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0 flex items-center justify-center overflow-hidden">
                      {notif.senderPhoto ? (
                        <img src={notif.senderPhoto} alt="" className="w-full h-full object-cover" />
                      ) : (
                        getIconForType(notif.type)
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {notif.title}
                        </h4>
                        <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{new Date(notif.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
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
      </div>
    </div>
  );
};
