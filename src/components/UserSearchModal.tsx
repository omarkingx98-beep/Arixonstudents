import React, { useState, useEffect } from 'react';
import {
  Search,
  X,
  UserPlus,
  MessageSquare,
  User,
  Check,
  Clock,
  Loader2,
  Trophy,
  BookOpen,
  AlertCircle,
  Lock
} from 'lucide-react';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useAdmin } from '../context/AdminContext';
import { sendFriendRequest, getFriendshipStatus } from '../lib/friendService';
import type { PublicUserProfile } from '../types';

interface UserSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenProfile: (uid: string) => void;
  onOpenChat: (targetUser: {
    uid: string;
    displayName: string;
    username: string;
    photoURL?: string;
    branch?: string;
  }) => void;
}

export const UserSearchModal: React.FC<UserSearchModalProps> = ({
  isOpen,
  onClose,
  onOpenProfile,
  onOpenChat,
}) => {
  const { profile: myProfile } = useAuth();
  const { isAdmin } = useAdmin();
  const [searchQuery, setSearchQuery] = useState('');
  const [profiles, setProfiles] = useState<PublicUserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [diagnosticError, setDiagnosticError] = useState<{
    code?: string;
    reason: string;
    indexLink?: string;
  } | null>(null);
  const [friendStatuses, setFriendStatuses] = useState<Record<string, string>>({});
  const [pendingAddIds, setPendingAddIds] = useState<Set<string>>(new Set());

  // Search exclusively in 'publicProfiles' using prefix query on usernameLower with limit 20 (E3)
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setIsLoading(true);
    setDiagnosticError(null);

    const clean = searchQuery.trim().toLowerCase().replace(/^@/, '');

    const runSearch = async () => {
      try {
        let q;
        if (clean) {
          const prefixEnd = clean + '\uf8ff';
          console.info(`[UserSearch Diagnoser] Querying collection 'publicProfiles' where usernameLower >= "${clean}" AND usernameLower <= "${prefixEnd}" with limit(20)`);
          q = query(
            collection(db, 'publicProfiles'),
            where('usernameLower', '>=', clean),
            where('usernameLower', '<=', prefixEnd),
            limit(20)
          );
        } else {
          console.info(`[UserSearch Diagnoser] Querying collection 'publicProfiles' suggested default list with limit(20)`);
          q = query(collection(db, 'publicProfiles'), limit(20));
        }

        const snap = await getDocs(q);
        const list: PublicUserProfile[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          list.push({
            uid: d.id || data.uid,
            displayName: data.displayName || data.username || 'طالب',
            username: data.username || 'student',
            photoURL: data.avatar || data.photoURL || '',
            branch: data.track || data.branch || 'علمي',
            totalPoints: data.points ?? data.totalPoints ?? 0,
            examsCompleted: data.examsCompleted ?? 0,
            createdAt: data.createdAt,
          });
        });

        // Exclude current user (E3 requirement)
        const filtered = list.filter((p) => p.uid !== myProfile?.uid);

        if (isMounted) {
          setProfiles(filtered);

          // Batch check friendship statuses for returned users
          if (myProfile?.uid && filtered.length > 0) {
            filtered.forEach(async (p) => {
              const status = await getFriendshipStatus(myProfile.uid, p.uid);
              if (isMounted) {
                setFriendStatuses((prev) => ({ ...prev, [p.uid]: status }));
              }
            });
          }
        }
      } catch (err: any) {
        console.error('[UserSearch Diagnoser] Firebase Query Error Details:', {
          code: err?.code,
          message: err?.message,
          stack: err?.stack,
        });

        let reason = 'حدث خطأ أثناء الاستعلام من Firestore.';
        let indexLink: string | undefined;

        if (err?.code === 'permission-denied') {
          reason = 'تم رفض الصلاحية (permission-denied): تأكد من أن قواعد Firestore تسمح للمستخدم بقراءة مجموعة publicProfiles.';
        } else if (err?.code === 'failed-precondition') {
          reason = 'الفهرس غير موجود (failed-precondition): يتطلب الاستعلام إنشاء فهرس مركب.';
          const match = err?.message?.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
          if (match) {
            indexLink = match[0];
          }
        } else if (err?.message) {
          reason = err.message;
        }

        if (isMounted) {
          setDiagnosticError({
            code: err?.code,
            reason,
            indexLink,
          });
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    const timer = setTimeout(runSearch, clean ? 250 : 0);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isOpen, searchQuery, myProfile?.uid]);

  if (!isOpen) return null;

  const handleAddFriend = async (targetUser: PublicUserProfile) => {
    if (!myProfile) return;
    setPendingAddIds((prev) => new Set(prev).add(targetUser.uid));
    try {
      await sendFriendRequest(myProfile, {
        uid: targetUser.uid,
        displayName: targetUser.displayName,
        username: targetUser.username,
      });
      setFriendStatuses((prev) => ({ ...prev, [targetUser.uid]: 'pending_sent' }));
      alert(`تم إرسال طلب الصداقة إلى @${targetUser.username} بنجاح.`);
    } catch (err: any) {
      alert(err.message || 'فشل إرسال طلب الصداقة.');
    } finally {
      setPendingAddIds((prev) => {
        const next = new Set(prev);
        next.delete(targetUser.uid);
        return next;
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
      <div 
        id="user-search-modal"
        className="bg-white dark:bg-[#0c101c] w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                البحث عن الطلاب باليوزر
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ابحث عبر معرف الطالب (@username) — يدعم الأحرف الكبيرة والصغيرة
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

        {/* Search Input */}
        <div className="pt-4 pb-2">
          <div className="relative">
            <input
              type="text"
              id="student-username-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="اكتب المعرف، مثلاً: omar أو @student..."
              className="w-full pl-10 pr-10 py-3 rounded-2xl bg-slate-50 dark:bg-[#111625] border border-slate-200 dark:border-slate-800 focus:border-blue-500 text-sm text-slate-900 dark:text-white focus:outline-none transition-all placeholder:text-slate-400"
              autoFocus
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3.5 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Diagnostic Error Banner if Firebase error occurred */}
        {diagnosticError && (
          <div className="my-2 p-3 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs text-right space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>تشخيص الاستعلام: {diagnosticError.code || 'خطأ'}</span>
            </div>
            <p className="text-[11px] leading-relaxed">{diagnosticError.reason}</p>
            {diagnosticError.indexLink && (
              <a
                href={diagnosticError.indexLink}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-[11px] font-bold text-blue-600 dark:text-blue-400 underline mt-1"
              >
                رابط إنشاء الفهرس المطلوب في كونسول Firebase ↗
              </a>
            )}
          </div>
        )}

        {/* Results List */}
        <div className="flex-1 overflow-y-auto space-y-2 py-2 pr-1">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span>جارٍ البحث في الملفات العامة...</span>
            </div>
          ) : profiles.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs space-y-2">
              <User className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
              <p>لم يتم العثور على أي طالب يبدأ بالمعرف "{searchQuery}".</p>
              <p className="text-[11px] text-slate-500">
                ملاحظة: تأكد من كتابة بداية اليوزر بشكل صحيح أو اضغط زر تحديث الملفات (Backfill) في لوحة الإدارة.
              </p>
            </div>
          ) : (
            profiles.map((user) => {
              const fStatus = friendStatuses[user.uid] || 'none';
              const isPending = pendingAddIds.has(user.uid);
              const canMessage = fStatus === 'friends' || isAdmin;

              return (
                <div
                  key={user.uid}
                  id={`user-search-result-${user.uid}`}
                  className="p-3 sm:p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#111625]/40 hover:bg-slate-100/70 dark:hover:bg-[#111625] transition-colors flex items-center justify-between gap-3"
                >
                  {/* User Info */}
                  <div 
                    onClick={() => onOpenProfile(user.uid)}
                    className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                    title="عرض الملف العام"
                  >
                    <img
                      src={user.photoURL || '/favicon-192x192.png'}
                      alt={user.displayName}
                      className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                      onError={(e) => {
                        e.currentTarget.src = '/favicon-192x192.png';
                      }}
                    />
                    <div className="min-w-0 flex-1 text-right">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                          {user.displayName}
                        </span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shrink-0">
                          {user.branch || 'علمي'}
                        </span>
                      </div>
                      <p className="text-[11px] text-blue-600 dark:text-blue-400 font-mono dir-ltr truncate text-right">
                        @{user.username}
                      </p>
                    </div>
                  </div>

                  {/* Actions: Add Friend & Chat */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Add Friend */}
                    {fStatus === 'friends' ? (
                      <span className="px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>أصدقاء</span>
                      </span>
                    ) : fStatus === 'pending_sent' ? (
                      <span className="px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 text-[11px] font-bold flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>معلّق</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAddFriend(user)}
                        disabled={isPending}
                        className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50 shadow-xs"
                      >
                        {isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <UserPlus className="w-3.5 h-3.5" />
                        )}
                        <span>إضافة</span>
                      </button>
                    )}

                    {/* Chat Button: enabled if friends or admin */}
                    {canMessage ? (
                      <button
                        onClick={() => {
                          onClose();
                          onOpenChat({
                            uid: user.uid,
                            displayName: user.displayName,
                            username: user.username,
                            photoURL: user.photoURL,
                            branch: user.branch,
                          });
                        }}
                        className="p-1.5 sm:px-2 sm:py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        title="بدء محادثة فورية"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">مراسلة</span>
                      </button>
                    ) : (
                      <div 
                        className="p-1.5 sm:px-2 sm:py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 text-[11px] font-bold flex items-center gap-1 cursor-not-allowed"
                        title="المراسلة متاحة بعد قبول طلب الصداقة"
                      >
                        <Lock className="w-3 h-3" />
                      </div>
                    )}
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
