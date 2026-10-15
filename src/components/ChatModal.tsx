import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Send, 
  ShieldAlert, 
  Ban, 
  MoreVertical, 
  MessageSquare, 
  CheckCheck, 
  Loader2, 
  Clock,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  getOrCreateChatConversation, 
  subscribeToChatMessages, 
  sendChatMessage, 
  reportChatConversation, 
  blockUserInChat 
} from '../lib/chatService';
import type { ChatMessage, ChatConversation } from '../types';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: {
    uid: string;
    displayName: string;
    username: string;
    photoURL?: string;
    branch?: string;
  } | null;
}

export const ChatModal: React.FC<ChatModalProps> = ({
  isOpen,
  onClose,
  targetUser,
}) => {
  const { profile } = useAuth();
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize or fetch conversation
  useEffect(() => {
    if (!isOpen || !targetUser || !profile) return;
    let isMounted = true;
    setIsLoading(true);
    setErrorMsg(null);

    const initChat = async () => {
      try {
        const conv = await getOrCreateChatConversation(
          {
            uid: profile.uid,
            displayName: profile.displayName || profile.username,
            username: profile.username,
            photoURL: profile.photoURL,
            branch: profile.branch,
          },
          targetUser
        );
        if (isMounted) {
          setConversation(conv);
        }
      } catch (err: any) {
        console.error('[ChatModal] Error initializing chat:', err);
        if (isMounted) setErrorMsg(err.message || 'تعذر بدء المحادثة.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initChat();
    return () => {
      isMounted = false;
    };
  }, [isOpen, targetUser?.uid, profile?.uid]);

  // Subscribe to realtime messages
  useEffect(() => {
    if (!conversation) return;
    const unsubscribe = subscribeToChatMessages(conversation.id, (msgs) => {
      setMessages(msgs);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });

    return () => unsubscribe();
  }, [conversation?.id]);

  if (!isOpen || !targetUser) return null;

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !targetUser || !inputText.trim() || isSending) return;

    if (profile.chatDisabled) {
      alert('تم إيقاف ميزة الدردشة لحسابك من قِبل إدارة المنصة.');
      return;
    }

    const textToSend = inputText.trim();
    setInputText('');
    setIsSending(true);
    setErrorMsg(null);

    try {
      let activeConv = conversation;
      if (!activeConv) {
        activeConv = await getOrCreateChatConversation(
          {
            uid: profile.uid,
            displayName: profile.displayName || profile.username || 'طالب',
            username: profile.username || 'student',
            photoURL: profile.photoURL,
            branch: profile.branch,
          },
          targetUser
        );
        setConversation(activeConv);
      }

      // Optimistic append
      const optimisticMsg: ChatMessage = {
        id: `temp_${Date.now()}`,
        chatId: activeConv.id,
        senderId: profile.uid,
        senderName: profile.displayName || profile.username || 'طالب',
        senderPhoto: profile.photoURL,
        text: textToSend,
        createdAt: new Date().toISOString(),
        read: false,
      };
      setMessages((prev) => [...prev, optimisticMsg]);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);

      await sendChatMessage({
        chatId: activeConv.id,
        senderProfile: profile,
        receiverId: targetUser.uid,
        text: textToSend,
      });
    } catch (err: any) {
      console.error('[ChatModal] Send message error:', err);
      setErrorMsg(err.message || 'فشل إرسال الرسالة، يرجى المحاولة ثانية.');
    } finally {
      setIsSending(false);
    }
  };

  const handleReport = async () => {
    if (!conversation || !profile || !reportReason.trim()) return;
    try {
      await reportChatConversation(conversation.id, profile.uid, reportReason.trim());
      setIsReportOpen(false);
      setReportReason('');
      alert('تم إرسال البلاغ للإدارة للمراجعة والتدقيق.');
    } catch (err: any) {
      alert(err.message || 'فشل إرسال البلاغ.');
    }
  };

  const handleBlock = async () => {
    if (!conversation || !profile) return;
    if (!window.confirm(`هل أنت متأكد من رغبتك بحظر الطالب "${targetUser.displayName}" ومنع المراسلة معه؟`)) return;

    try {
      await blockUserInChat(conversation.id, profile.uid);
      setIsMenuOpen(false);
      alert('تم حظر هذا المستخدم بنجاح.');
      onClose();
    } catch (err: any) {
      alert(err.message || 'فشل حظر المستخدم.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
      <div 
        id="chat-modal-window"
        className="bg-white dark:bg-[#0c101c] w-full max-w-lg h-[85vh] max-h-[620px] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden relative"
      >
        {/* Chat Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-[#111625]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative shrink-0">
              <img
                src={targetUser.photoURL || 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=Arixon1'}
                alt={targetUser.displayName}
                className="w-10 h-10 rounded-2xl object-cover border border-slate-200 dark:border-slate-700"
              />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#111625] absolute -bottom-0.5 -right-0.5" />
            </div>

            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                {targetUser.displayName}
              </h3>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <span className="dir-ltr font-mono text-[10px]">@{targetUser.username}</span>
                {targetUser.branch && <span>• الفرع ال{targetUser.branch}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 relative">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="خيارات المحادثة"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Menu Dropdown */}
            {isMenuOpen && (
              <div className="absolute top-10 left-0 bg-white dark:bg-[#13192a] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-1.5 w-44 z-30 space-y-1 text-right animate-fadeIn">
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsReportOpen(true);
                  }}
                  className="w-full px-3 py-2 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-xl flex items-center justify-between cursor-pointer"
                >
                  <span>إبلاغ عن محادثة</span>
                  <ShieldAlert className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleBlock}
                  className="w-full px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl flex items-center justify-between cursor-pointer"
                >
                  <span>حظر المستخدم</span>
                  <Ban className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Disabled Warning if Flagged */}
        {profile?.chatDisabled && (
          <div className="bg-red-50 dark:bg-red-950/40 p-2.5 text-center text-xs text-red-600 dark:text-red-400 font-bold border-b border-red-200 dark:border-red-900/40">
            تم إيقاف ميزة الدردشة لحسابك من قِبل المشرف العام بسبب مخالفة شروط الاستخدام.
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="bg-amber-50 dark:bg-amber-950/40 p-2.5 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1.5 px-4 border-b border-amber-200">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/40 dark:bg-[#070a12]/50">
          {isLoading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              <span>جارٍ تحميل الرسائل...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-xs space-y-2">
              <MessageSquare className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
              <p className="font-semibold text-slate-600 dark:text-slate-300">
                لا توجد رسائل سابقة مع {targetUser.displayName}
              </p>
              <p className="text-[11px] text-slate-400">
                ابدأ المحادثة التعليمية الآن واستفسر عن الدروس والامتحانات!
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.senderId === profile?.uid;
              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {!isMine && (
                    <img
                      src={msg.senderPhoto || targetUser.photoURL || 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=Arixon1'}
                      alt=""
                      className="w-6 h-6 rounded-lg object-cover shrink-0 mb-1"
                    />
                  )}

                  <div
                    className={`max-w-[75%] rounded-2xl p-3 text-xs sm:text-sm leading-relaxed shadow-2xs ${
                      isMine
                        ? 'bg-blue-600 text-white rounded-br-xs'
                        : 'bg-white dark:bg-[#13192a] text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-800/80 rounded-bl-xs'
                    }`}
                  >
                    <p className="whitespace-pre-line break-words">{msg.text}</p>
                    <div
                      className={`text-[9px] mt-1 flex items-center justify-end gap-1 ${
                        isMine ? 'text-blue-100' : 'text-slate-400'
                      }`}
                    >
                      <span>
                        {new Date(msg.createdAt).toLocaleTimeString('ar-EG', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {isMine && <CheckCheck className="w-3 h-3 inline" />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleSendMessage}
          className="p-3 bg-white dark:bg-[#0c101c] border-t border-slate-200 dark:border-slate-800 flex items-center gap-2"
        >
          <input
            type="text"
            value={inputText}
            disabled={profile?.chatDisabled || isSending}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={profile?.chatDisabled ? 'الدردشة موقوفة لحسابك' : 'اكتب رسالتك هنا...'}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm bg-slate-100 dark:bg-[#13192a] border border-slate-200 dark:border-slate-700/60 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isSending || profile?.chatDisabled}
            className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs shrink-0"
            title="إرسال"
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 rtl:rotate-180" />}
          </button>
        </form>

        {/* Report Dialog Modal Overlay */}
        {isReportOpen && (
          <div className="absolute inset-0 bg-black/75 z-40 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#111625] rounded-2xl p-5 w-full max-w-xs space-y-3 border border-slate-200 dark:border-slate-800 text-right shadow-2xl">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                <span>إبلاغ عن محادثة غير لائقة</span>
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                اكتب سبب الإبلاغ ليتم مراجعة المحادثة من إدارة المنصة:
              </p>
              <textarea
                rows={3}
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="مثال: سلوك غير لائق أو رسائل مسيئة..."
                className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#182032] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={!reportReason.trim()}
                  onClick={handleReport}
                  className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs disabled:opacity-50 cursor-pointer"
                >
                  إرسال البلاغ
                </button>
                <button
                  type="button"
                  onClick={() => setIsReportOpen(false)}
                  className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
