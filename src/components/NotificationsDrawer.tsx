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
  Pause,
  AlertCircle,
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
  notifications,
  broadcasts = [],
  lastReadBroadcastAt,
  onOpenChatWithUser,
  onOpenExam,
}) => {
  const { profile } = useAuth();
  // E5: 3 Tabs: الإشعارات | الرسائل | الأصدقاء
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
      // Refresh friends list
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
    <div className="fixed inset-0 z-50 flex justify-start bg-black/60 backdrop-blur-xs animate-fadeIn">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="absolute inset-0"
      />

      {/* Drawer Panel */}
      <div 
        id="notifications-drawer-panel"
        className="relative w-full max-w-md bg-white dark:bg-[#0c101c] h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col z-10 overflow-hidden"
      >
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                مركز التنبيهات والتواصل
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                الإشعارات، الرسائل الفورية، وقائمة الأصدقاء
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* E5 Tabs: الإشعارات | الرسائل | الأصدقاء */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-[#111625]/40">
          <div className="grid grid-cols-3 p-1 rounded-2xl bg-slate-200/60 dark:bg-slate-800/80 text-xs font-bold">
            <button
              id="notif-tab-notifications"
              onClick={() => setActiveTab('notifications')}
              className={`py-2 px-1 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'notifications'
                  ? 'bg-white dark:bg-[#0c101c] text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>الإشعارات</span>
              {unreadDirectCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center font-black">
                  {unreadDirectCount > 9 ? '+9' : unreadDirectCount}
                </span>
              )}
            </button>

            <button
              id="notif-tab-messages"
              onClick={() => setActiveTab('messages')}
              className={`py-2 px-1 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'messages'
                  ? 'bg-white dark:bg-[#0c101c] text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
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
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
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

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* TAB 1: الإشعارات */}
          {activeTab === 'notifications' && (
            <>
              {unreadDirectCount > 0 && (
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

              {notifications.length === 0 && broadcasts.length === 0 ? (
                <div className="py-20 text-center text-slate-400 text-xs space-y-2">
                  <Bell className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
                  <p>لا توجد إشعارات جديدة حالياً.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
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

                        {/* Friend Request Accept / Reject Actions (E5) */}
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
            </>
          )}

          {/* TAB 2: الرسائل (Conversations with unread counter) */}
          {activeTab === 'messages' && (
            <div className="space-y-2">
              {loadingChats ? (
                <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                  <span>جارٍ تحميل المحادثات...</span>
                </div>
              ) : chats.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs space-y-2">
                  <MessageSquare className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
                  <p>لا توجد محادثات نشطة بعد.</p>
                  <p className="text-[11px] text-slate-500">
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
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 text-right ${
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
                            {chat.lastMessage || 'بدء المحادثة'}
                          </p>
                        </div>
                      </div>

                      {unread > 0 && (
                        <span className="w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center shrink-0 animate-pulse">
                          {unread > 9 ? '+9' : unread}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 3: الأصدقاء (Friends list with instant chat click) */}
          {activeTab === 'friends' && (
            <div className="space-y-2">
              {loadingFriends ? (
                <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                  <span>جارٍ تحميل قائمة الأصدقاء...</span>
                </div>
              ) : friends.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs space-y-2">
                  <Users className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
                  <p>قائمة الأصدقاء فارغة حالياً.</p>
                  <p className="text-[11px] text-slate-500">
                    عند قبول طلبات الصداقة، سيظهر أصدقاؤك هنا ويمكنك مراسلتهم فوراً.
                  </p>
                </div>
              ) : (
                friends.map((friend) => (
                  <div
                    key={friend.uid}
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
                    className="p-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#111625] hover:bg-slate-50 dark:hover:bg-[#141b2d] transition-all cursor-pointer flex items-center justify-between gap-3 text-right"
                    title="اضغط لفتح المحادثة فوراً"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <img
                        src={friend.photoURL || '/favicon-192x192.png'}
                        alt={friend.displayName}
                        className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                        onError={(e) => {
                          e.currentTarget.src = '/favicon-192x192.png';
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                            {friend.displayName}
                          </h4>
                          <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {friend.branch || 'علمي'}
                          </span>
                        </div>
                        <p className="text-[11px] text-blue-600 dark:text-blue-400 font-mono dir-ltr truncate text-right">
                          @{friend.username}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
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
      </div>
    </div>
  );
};
