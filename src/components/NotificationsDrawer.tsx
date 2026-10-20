import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  X, 
  CheckCheck, 
  MessageSquare, 
  UserPlus, 
  Users,
  Check, 
  Clock, 
  Trash2,
  Sparkles,
  Loader2,
  BookOpen,
  AlertCircle,
  Megaphone,
  Radio,
  ArrowLeft
} from 'lucide-react';
import { 
  markNotificationAsRead, 
  markAllNotificationsAsRead, 
  deleteNotification 
} from '../lib/notificationService';
import { acceptFriendRequest, rejectFriendRequest, getFriendsList } from '../lib/friendService';
import { subscribeToUserChats } from '../lib/chatService';
import { useAuth } from '../context/AuthContext';
import type { AppNotification, BroadcastNotification, FriendItem, ChatConversation } from '../types';

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  broadcasts?: BroadcastNotification[];
  lastReadBroadcastAt?: string | null;
  onOpenChatWithUser?: (
    userId: string, 
    targetDetails: { displayName: string; username: string; photoURL?: string; branch?: string }
  ) => void;
  onOpenExam?: (examId: string) => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  isOpen,
  onClose,
  notifications = [],
  broadcasts = [],
  lastReadBroadcastAt,
  onOpenChatWithUser,
  onOpenExam,
}) => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'notifications' | 'messages' | 'friends'>('notifications');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Messages Tab state
  const [chats, setChats] = useState<ChatConversation[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);

  // Friends Tab state
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);

  // Subscribe to user chats for "الرسائل" tab
  useEffect(() => {
    if (!isOpen || !profile?.uid) return;
    setLoadingChats(true);
    const unsub = subscribeToUserChats(profile.uid, (chatList) => {
      setChats(chatList);
      setLoadingChats(false);
    });
    return () => unsub();
  }, [isOpen, profile?.uid]);

  // Load friends list for "الأصدقاء" tab
  useEffect(() => {
    if (!isOpen || !profile?.uid) return;
    let isMounted = true;
    setLoadingFriends(true);

    getFriendsList(profile.uid).then((list) => {
      if (isMounted) {
        setFriends(list);
        setLoadingFriends(false);
      }
    }).catch(() => {
      if (isMounted) setLoadingFriends(false);
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen, profile?.uid, activeTab]);

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
      onOpenChatWithUser(notif.senderId, {
        displayName: notif.senderName || 'الطالب',
        username: notif.senderName || 'student',
        photoURL: notif.senderPhoto,
      });
    }
  };

  const handleAcceptFriend = async (notif: AppNotification) => {
    if (!profile || !notif.metadata?.requestId || !notif.senderId) return;
    setProcessingId(notif.id);
    try {
      await acceptFriendRequest(notif.metadata.requestId, notif.senderId, profile);
      await markNotificationAsRead(notif.id);
      const updatedFriends = await getFriendsList(profile.uid);
      setFriends(updatedFriends);
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

  const unreadDirectCount = notifications.filter((n) => !n.read).length;
  const unreadBroadcastsCount = broadcasts.filter((b) => {
    if (!lastReadBroadcastAt) return true;
    return new Date(b.createdAt).getTime() > new Date(lastReadBroadcastAt).getTime();
  }).length;
  const totalNotifsBadge = unreadDirectCount + unreadBroadcastsCount;

  const unreadMessagesCount = chats.reduce((sum, c) => {
    if (!profile?.uid) return sum;
    const count = 
      (c.unreadCount && typeof c.unreadCount[profile.uid] === 'number')
        ? c.unreadCount[profile.uid]
        : (c.unreadCounts && typeof (c as any).unreadCounts[profile.uid] === 'number')
        ? (c as any).unreadCounts[profile.uid]
        : 0;
    return sum + count;
  }, 0);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none" role="dialog" aria-modal="true">
      {/* Backdrop Overlay */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
      />

      {/* Fixed Drawer Panel (Right side in RTL) */}
      <aside 
        id="notifications-drawer-panel"
        className="fixed inset-y-0 right-0 max-w-full sm:max-w-md w-full bg-white dark:bg-[#0c101c] text-slate-900 dark:text-slate-100 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col z-50 overflow-hidden"
      >
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between shrink-0 bg-white dark:bg-[#0c101c]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                مركز التنبيهات والتواصل
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                التعميمات الإدارية، الإشعارات، والرسائل الفورية
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="إغلاق اللوحة"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Tabs: الإشعارات | الرسائل | الأصدقاء */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#111625]/60 shrink-0">
          <div className="grid grid-cols-3 p-1 rounded-2xl bg-slate-200/60 dark:bg-slate-800/80 text-xs font-bold">
            <button
              id="notif-tab-notifications"
              onClick={() => setActiveTab('notifications')}
              className={`py-2 px-1 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'notifications'
                  ? 'bg-white dark:bg-[#0c101c] text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>الإشعارات</span>
              {totalNotifsBadge > 0 && (
                <span className="w-4 h-4 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center font-black">
                  {totalNotifsBadge > 9 ? '+9' : totalNotifsBadge}
                </span>
              )}
            </button>

            <button
              id="notif-tab-messages"
              onClick={() => setActiveTab('messages')}
              className={`py-2 px-1 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'messages'
                  ? 'bg-white dark:bg-[#0c101c] text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>الرسائل</span>
              {unreadMessagesCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center font-black">
                  {unreadMessagesCount > 9 ? '+9' : unreadMessagesCount}
                </span>
              )}
            </button>

            <button
              id="notif-tab-friends"
              onClick={() => setActiveTab('friends')}
              className={`py-2 px-1 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'friends'
                  ? 'bg-white dark:bg-[#0c101c] text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>الأصدقاء</span>
              {friends.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px]">
                  {friends.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* TAB 1: الإشعارات */}
          {activeTab === 'notifications' && (
            <div className="space-y-4">
              {/* Mark all as read button */}
              {(unreadDirectCount > 0 || unreadBroadcastsCount > 0) && (
                <div className="flex justify-end pb-1">
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>تحديد الكل كمقروء</span>
                  </button>
                </div>
              )}

              {/* SECTION A: Official Announcements & Broadcasts */}
              {broadcasts.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 px-1">
                    <Megaphone className="w-3.5 h-3.5" />
                    <span>التعميمات والإعلانات الإدارية</span>
                  </div>

                  {broadcasts.map((b) => {
                    const isUnread = !lastReadBroadcastAt || new Date(b.createdAt).getTime() > new Date(lastReadBroadcastAt).getTime();
                    return (
                      <div
                        key={b.id}
                        className={`p-3.5 rounded-2xl border transition-all text-right ${
                          isUnread
                            ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-900/60 shadow-xs'
                            : 'bg-white dark:bg-[#111625] border-slate-200/80 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 shrink-0 mt-0.5">
                            <Radio className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <span>{b.title}</span>
                                {isUnread && (
                                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                                )}
                              </h4>
                              {b.priority === 'urgent' && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                                  عاجل
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed whitespace-pre-line">
                              {b.message}
                            </p>
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[10px] text-slate-400">
                              <span>
                                {new Date(b.createdAt).toLocaleDateString('ar-EG', {
                                  day: 'numeric',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              {b.examId && onOpenExam && (
                                <button
                                  onClick={() => {
                                    onClose();
                                    onOpenExam(b.examId!);
                                  }}
                                  className="text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  <span>فتح الامتحان</span>
                                  <ArrowLeft className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* SECTION B: Direct Notifications */}
              {notifications.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 px-1">
                    <Bell className="w-3.5 h-3.5" />
                    <span>التنبيهات المباشرة</span>
                  </div>

                  {notifications.map((notif) => {
                    const isFriendReq = notif.type === 'friend_request';
                    const isProcessing = processingId === notif.id;

                    return (
                      <div
                        key={notif.id}
                        id={`notification-card-${notif.id}`}
                        onClick={() => handleNotificationClick(notif)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative text-right ${
                          !notif.read
                            ? 'bg-blue-50/60 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/60 shadow-xs'
                            : 'bg-white dark:bg-[#111625] border-slate-100 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            {notif.senderPhoto ? (
                              <img
                                src={notif.senderPhoto}
                                alt={notif.senderName}
                                className="w-10 h-10 rounded-xl object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center shrink-0">
                                {isFriendReq ? <UserPlus className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                              </div>
                            )}

                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <span>{notif.title}</span>
                                {!notif.read && (
                                  <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                                )}
                              </h4>
                              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                                {notif.message}
                              </p>
                              <span className="text-[10px] text-slate-400 mt-1.5 block">
                                {new Date(notif.createdAt).toLocaleTimeString('ar-EG', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={(e) => handleDelete(e, notif.id)}
                            className="text-slate-300 hover:text-red-500 p-1 rounded-lg transition-colors cursor-pointer"
                            title="حذف الإشعار"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Friend Request Accept / Reject */}
                        {isFriendReq && notif.metadata?.requestId && (
                          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAcceptFriend(notif);
                              }}
                              disabled={isProcessing}
                              className="flex-1 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                            >
                              {isProcessing ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              <span>قبول الصداقة</span>
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRejectFriend(notif);
                              }}
                              disabled={isProcessing}
                              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-600 hover:text-red-600 dark:text-slate-300 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <span>رفض</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Empty state when NO broadcasts and NO notifications */}
              {notifications.length === 0 && broadcasts.length === 0 && (
                <div className="py-24 text-center text-slate-400 text-xs space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-3xl bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center text-slate-400">
                    <Bell className="w-7 h-7" />
                  </div>
                  <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                    لا توجد إشعارات حالياً
                  </p>
                  <p className="text-slate-400 text-xs max-w-xs mx-auto">
                    ستظهر هنا كافة التعميمات الرسمية ونتائج الامتحانات وطلبات الصداقة الجديدة.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: الرسائل */}
          {activeTab === 'messages' && (
            <div className="space-y-2">
              {loadingChats ? (
                <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                  <span>جارٍ تحميل المحادثات...</span>
                </div>
              ) : chats.length === 0 ? (
                <div className="py-20 text-center text-slate-400 text-xs space-y-2">
                  <MessageSquare className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
                  <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">لا توجد محادثات نشطة بعد</p>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    أضف أصدقاءك من شاشة البحث أو قائمة الترتيب لبدء محادثات فورية.
                  </p>
                </div>
              ) : (
                chats.map((chat) => {
                  const otherUid = chat.participants.find((u) => u !== profile?.uid) || '';
                  const other = chat.participantDetails?.[otherUid] || {
                    displayName: 'طالب',
                    username: 'student',
                    photoURL: '',
                    branch: 'علمي',
                  };

                  const unread = 
                    (chat.unreadCount && typeof chat.unreadCount[profile?.uid || ''] === 'number')
                      ? chat.unreadCount[profile?.uid || '']
                      : (chat.unreadCounts && typeof (chat as any).unreadCounts[profile?.uid || ''] === 'number')
                      ? (chat as any).unreadCounts[profile?.uid || '']
                      : 0;

                  return (
                    <div
                      key={chat.id}
                      onClick={() => {
                        onClose();
                        if (onOpenChatWithUser) {
                          onOpenChatWithUser(otherUid, other);
                        }
                      }}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 text-right ${
                        unread > 0
                          ? 'bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900/60 shadow-xs'
                          : 'bg-white dark:bg-[#111625] border-slate-100 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <img
                          src={other.photoURL || '/favicon-192x192.png'}
                          alt={other.displayName}
                          className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                          onError={(e) => {
                            e.currentTarget.src = '/favicon-192x192.png';
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                              {other.displayName}
                            </h4>
                            <span className="text-[10px] text-slate-400 shrink-0">
                              {new Date(chat.lastMessageAt).toLocaleTimeString('ar-EG', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {chat.lastMessage || 'محادثة جديدة'}
                          </p>
                        </div>
                      </div>

                      {unread > 0 && (
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                          {unread}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 3: الأصدقاء */}
          {activeTab === 'friends' && (
            <div className="space-y-2">
              {loadingFriends ? (
                <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                  <span>جارٍ تحميل قائمة الأصدقاء...</span>
                </div>
              ) : friends.length === 0 ? (
                <div className="py-20 text-center text-slate-400 text-xs space-y-2">
                  <Users className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
                  <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">قائمة الأصدقاء فارغة</p>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    ابحث عن زملاء دفعة 2009 عبر أيقونة البحث في الأعلى لإضافتهم.
                  </p>
                </div>
              ) : (
                friends.map((friend) => (
                  <div
                    key={friend.uid}
                    className="p-3 rounded-2xl bg-white dark:bg-[#111625] border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 text-right"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={friend.photoURL || '/favicon-192x192.png'}
                        alt={friend.displayName}
                        className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                        onError={(e) => {
                          e.currentTarget.src = '/favicon-192x192.png';
                        }}
                      />
                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                          {friend.displayName}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                          <span>@{friend.username}</span>
                          {friend.branch && (
                            <>
                              <span>•</span>
                              <span className="text-blue-500 font-semibold">{friend.branch}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        onClose();
                        if (onOpenChatWithUser) {
                          onOpenChatWithUser(friend.uid, {
                            displayName: friend.displayName,
                            username: friend.username,
                            photoURL: friend.photoURL,
                            branch: friend.branch,
                          });
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>مراسلة</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};
