import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, 
  Send, 
  ShieldAlert, 
  Ban, 
  MoreVertical, 
  MessageSquare, 
  CheckCheck, 
  Loader2, 
  ArrowRight,
  ChevronDown,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  getOrCreateChatConversation, 
  subscribeToChatMessages, 
  sendChatMessage, 
  reportChatConversation, 
  blockUserInChat,
  setTypingPresence,
  subscribeToChatPresence,
  fetchOlderChatMessages,
  markChatAsRead
} from '../lib/chatService';
import { UserAvatar } from './UserAvatar';
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
    role?: string;
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
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Visual Viewport tracking for mobile virtual keyboards
  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => {
      if (window.visualViewport) {
        const offset = window.innerHeight - window.visualViewport.height;
        setKeyboardOffset(Math.max(0, offset));
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      window.visualViewport.addEventListener('scroll', handleResize);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
        window.visualViewport.removeEventListener('scroll', handleResize);
      }
      setKeyboardOffset(0);
    };
  }, [isOpen]);

  // Initialize or fetch conversation
  useEffect(() => {
    if (!isOpen || !targetUser || !profile) return;
    let isMounted = true;
    setIsLoading(true);
    setErrorMsg(null);
    setHasMoreOlder(true);

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
          markChatAsRead(conv.id, profile.uid);
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

  // Subscribe to realtime messages & typing status
  useEffect(() => {
    if (!conversation || !targetUser) return;

    // Messages subscription (latest 30)
    const unsubMessages = subscribeToChatMessages(conversation.id, (msgs) => {
      setMessages(msgs);
      if (msgs.length < 30) {
        setHasMoreOlder(false);
      }
      // If user is near bottom, auto scroll
      const container = scrollContainerRef.current;
      if (!container || (container.scrollHeight - container.scrollTop - container.clientHeight < 120)) {
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 80);
      } else {
        setShowScrollBottom(true);
      }
    }, 30);

    // Typing presence subscription for target user
    const unsubPresence = subscribeToChatPresence(conversation.id, targetUser.uid, (typing) => {
      setIsOtherTyping(typing);
      if (typing) {
        const container = scrollContainerRef.current;
        if (!container || (container.scrollHeight - container.scrollTop - container.clientHeight < 150)) {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });

    return () => {
      unsubMessages();
      unsubPresence();
    };
  }, [conversation?.id, targetUser?.uid]);

  // Clear typing presence when unmounting or modal closes
  useEffect(() => {
    return () => {
      if (conversation?.id && profile?.uid) {
        setTypingPresence(conversation.id, profile.uid, false);
      }
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [conversation?.id, profile?.uid]);

  // Scroll detection to toggle "رسالة جديدة ↓"
  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const isUp = container.scrollHeight - container.scrollTop - container.clientHeight > 140;
    setShowScrollBottom(isUp);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollBottom(false);
  };

  // Load older messages (pagination)
  const handleLoadOlder = async () => {
    if (!conversation || messages.length === 0 || isLoadingOlder) return;
    setIsLoadingOlder(true);
    try {
      const oldestMsg = messages[0];
      const older = await fetchOlderChatMessages(conversation.id, oldestMsg.createdAt, 30);
      if (older.length < 30) {
        setHasMoreOlder(false);
      }
      if (older.length > 0) {
        const prevScrollHeight = scrollContainerRef.current?.scrollHeight || 0;
        setMessages((prev) => [...older, ...prev]);
        // Maintain scroll position
        requestAnimationFrame(() => {
          if (scrollContainerRef.current) {
            const newScrollHeight = scrollContainerRef.current.scrollHeight;
            scrollContainerRef.current.scrollTop += (newScrollHeight - prevScrollHeight);
          }
        });
      }
    } catch (err) {
      console.error('[ChatModal] Failed to load older messages:', err);
    } finally {
      setIsLoadingOlder(false);
    }
  };

  // Handle Textarea Change + Typing Presence with 4s auto-clear
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);

    // Auto-grow textarea up to 4 lines
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }

    if (!conversation || !profile) return;

    if (val.trim()) {
      setTypingPresence(conversation.id, profile.uid, true);
      // Reset 4s inactivity timer
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        if (conversation && profile) {
          setTypingPresence(conversation.id, profile.uid, false);
        }
      }, 4000);
    } else {
      setTypingPresence(conversation.id, profile.uid, false);
    }
  };

  const handleInputBlur = () => {
    if (conversation && profile) {
      setTypingPresence(conversation.id, profile.uid, false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!profile || !targetUser || !inputText.trim() || isSending) return;

    if (profile.chatDisabled) {
      alert('تم إيقاف ميزة الدردشة لحسابك من قِبل إدارة المنصة.');
      return;
    }

    const textToSend = inputText.trim();
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsSending(true);
    setErrorMsg(null);

    // Stop typing timer and clear presence
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (conversation) {
      setTypingPresence(conversation.id, profile.uid, false);
    }

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

      await sendChatMessage({
        chatId: activeConv.id,
        senderProfile: profile,
        receiverId: targetUser.uid,
        text: textToSend,
      });

      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    } catch (err: any) {
      console.error('[ChatModal] Send message error:', err);
      setErrorMsg(err.message || 'فشل إرسال الرسالة، يرجى المحاولة ثانية.');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
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

  if (!isOpen || !targetUser) return null;

  // Format date dividers (اليوم، أمس، التاريخ)
  const getDayDivider = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'اليوم';
    if (d.toDateString() === yesterday.toDateString()) return 'أمس';
    return d.toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
      <div 
        id="chat-modal-window"
        style={{
          paddingBottom: keyboardOffset > 0 ? `${keyboardOffset}px` : undefined,
        }}
        className="bg-white dark:bg-[#0c101c] w-full sm:max-w-lg h-[100dvh] sm:h-[88vh] sm:max-h-[660px] sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden relative transition-[padding] duration-150"
      >
        {/* Fixed Header */}
        <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/95 dark:bg-[#111625]/95 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onClose}
              className="p-2 -mr-1 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors sm:hidden cursor-pointer"
              aria-label="الرجوع"
            >
              <ArrowRight className="w-5 h-5 rtl:rotate-0" />
            </button>

            <div className="relative shrink-0">
              <UserAvatar
                avatar={targetUser.photoURL}
                name={targetUser.displayName}
                size="md"
              />
              <span className={`w-3 h-3 rounded-full ring-2 ring-white dark:ring-[#111625] absolute -bottom-0.5 -right-0.5 ${
                isOtherTyping ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'
              }`} />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {targetUser.displayName}
                </h3>
                {targetUser.branch && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 shrink-0">
                    {targetUser.branch}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                {isOtherTyping ? (
                  <span className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1 animate-pulse">
                    <span>يكتب الآن</span>
                    <span className="inline-flex gap-0.5">
                      <span className="w-1 h-1 rounded-full bg-blue-600 dark:bg-blue-400 animate-bounce"></span>
                      <span className="w-1 h-1 rounded-full bg-blue-600 dark:bg-blue-400 animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-1 h-1 rounded-full bg-blue-600 dark:bg-blue-400 animate-bounce [animation-delay:0.4s]"></span>
                    </span>
                  </span>
                ) : (
                  <span className="dir-ltr font-mono text-[11px] text-slate-400">
                    @{targetUser.username}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 relative">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="خيارات المحادثة"
              aria-label="المزيد"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="hidden sm:inline-flex p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Menu Dropdown */}
            {isMenuOpen && (
              <div className="absolute top-11 left-0 bg-white dark:bg-[#13192a] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-1.5 w-44 z-30 space-y-1 text-right animate-fadeIn">
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
          <div className="bg-red-50 dark:bg-red-950/40 p-2.5 text-center text-xs text-red-600 dark:text-red-400 font-bold border-b border-red-200 dark:border-red-900/40 shrink-0">
            تم إيقاف ميزة الدردشة لحسابك من قِبل المشرف العام بسبب مخالفة شروط الاستخدام.
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="bg-amber-50 dark:bg-amber-950/40 p-2.5 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1.5 px-4 border-b border-amber-200 shrink-0">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Messages Body */}
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3 bg-slate-50/60 dark:bg-[#070a12]/50 relative"
        >
          {/* Load older messages button */}
          {hasMoreOlder && messages.length >= 30 && (
            <div className="text-center py-1">
              <button
                type="button"
                onClick={handleLoadOlder}
                disabled={isLoadingOlder}
                className="px-4 py-1.5 rounded-full text-xs font-medium bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isLoadingOlder ? (
                  <span className="flex items-center gap-1.5 justify-center">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>جارٍ تحميل الرسائل الأقدم...</span>
                  </span>
                ) : (
                  'تحميل الرسائل السابقة (30)'
                )}
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span>جارٍ تحميل الرسائل...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-xs space-y-2">
              <MessageSquare className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
              <p className="font-bold text-sm text-slate-700 dark:text-slate-200">
                لا توجد رسائل سابقة مع {targetUser.displayName}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                ابدأ المحادثة التعليمية الآن واستفسر عن الدروس والامتحانات وشارك الفائدة!
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isMine = msg.senderId === profile?.uid;
              const prevMsg = idx > 0 ? messages[idx - 1] : null;
              const nextMsg = idx < messages.length - 1 ? messages[idx + 1] : null;
              
              // Date divider
              const showDivider = !prevMsg || new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();
              
              // Consecutive grouping
              const isFirstInGroup = !prevMsg || prevMsg.senderId !== msg.senderId;
              const isLastInGroup = !nextMsg || nextMsg.senderId !== msg.senderId;

              return (
                <React.Fragment key={msg.id}>
                  {showDivider && (
                    <div className="flex items-center justify-center my-3">
                      <span className="px-3 py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-white dark:bg-[#13192a] border border-slate-200 dark:border-slate-800 rounded-full shadow-2xs">
                        {getDayDivider(msg.createdAt)}
                      </span>
                    </div>
                  )}

                  <div
                    className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'} ${
                      isFirstInGroup ? 'mt-2.5' : 'mt-1'
                    }`}
                  >
                    {!isMine && (
                      <div className="w-7 h-7 shrink-0 mb-0.5">
                        {isLastInGroup ? (
                          <UserAvatar
                            avatar={msg.senderPhoto || targetUser.photoURL}
                            name={targetUser.displayName}
                            size="sm"
                          />
                        ) : (
                          <div className="w-7 h-7" />
                        )}
                      </div>
                    )}

                    <div
                      className={`max-w-[80%] sm:max-w-[75%] rounded-2xl p-3 text-xs sm:text-sm leading-relaxed shadow-2xs transition-all ${
                        isMine
                          ? 'bg-blue-600 text-white rounded-br-xs'
                          : 'bg-white dark:bg-[#13192a] text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-800/80 rounded-bl-xs'
                      }`}
                    >
                      <p className="whitespace-pre-line break-words">{msg.text}</p>
                      <div
                        className={`text-[10px] mt-1 flex items-center justify-end gap-1 font-mono ${
                          isMine ? 'text-blue-100' : 'text-slate-400'
                        }`}
                      >
                        <span>
                          {new Date(msg.createdAt).toLocaleTimeString('ar-EG', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {isMine && <CheckCheck className="w-3.5 h-3.5 inline" />}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}

          {/* 3-Dot Animated Typing Bubble */}
          {isOtherTyping && (
            <div className="flex items-end gap-2 flex-row animate-fadeIn">
              <div className="w-7 h-7 shrink-0 mb-0.5">
                <UserAvatar
                  avatar={targetUser.photoURL}
                  name={targetUser.displayName}
                  size="sm"
                />
              </div>
              <div className="bg-white dark:bg-[#13192a] border border-slate-200 dark:border-slate-800 rounded-2xl rounded-bl-xs px-3.5 py-2.5 shadow-2xs">
                <div className="flex items-center gap-1.5 h-3.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce"></span>
                  <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce [animation-delay:0.4s]"></span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Floating "رسالة جديدة ↓" badge */}
        {showScrollBottom && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-lg flex items-center gap-1.5 cursor-pointer z-20 animate-bounce"
          >
            <span>رسالة جديدة</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Fixed Bottom Input Bar */}
        <div 
          className="p-2.5 sm:p-3 bg-white dark:bg-[#0c101c] border-t border-slate-200 dark:border-slate-800 shrink-0"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <form
            onSubmit={handleSendMessage}
            className="flex items-end gap-2"
          >
            <div className="flex-1 min-h-[44px] rounded-2xl bg-slate-100 dark:bg-[#13192a] border border-slate-200 dark:border-slate-700/60 focus-within:ring-2 focus-within:ring-blue-500 flex items-center px-3 py-1.5 transition-all">
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputText}
                disabled={profile?.chatDisabled || isSending}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                onKeyDown={handleKeyDown}
                placeholder={profile?.chatDisabled ? 'الدردشة موقوفة لحسابك' : 'اكتب رسالتك هنا...'}
                className="w-full text-xs sm:text-sm bg-transparent border-0 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none resize-none max-h-28 overflow-y-auto leading-relaxed py-1"
              />
            </div>

            <button
              type="submit"
              disabled={!inputText.trim() || isSending || profile?.chatDisabled}
              className="min-w-[44px] min-h-[44px] rounded-2xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center cursor-pointer shadow-sm shrink-0"
              title="إرسال"
              aria-label="إرسال الرسالة"
            >
              {isSending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5 rtl:rotate-180" />
              )}
            </button>
          </form>
        </div>

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
