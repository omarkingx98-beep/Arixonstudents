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
} from 'lucide-react';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [allProfiles, setAllProfiles] = useState<PublicUserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [friendStatuses, setFriendStatuses] = useState<Record<string, string>>({});
  const [pendingAddIds, setPendingAddIds] = useState<Set<string>>(new Set());

  // Load public profiles
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setIsLoading(true);

    const loadProfiles = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'publicProfiles'), limit(100)));
        const list: PublicUserProfile[] = [];
        snap.forEach((d) => {
          list.push(d.data() as PublicUserProfile);
        });

        if (isMounted) {
          setAllProfiles(list);
        }
      } catch (err) {
        console.warn('Error fetching public profiles for search:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadProfiles();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const cleanQuery = searchQuery.trim().toLowerCase().replace(/^@/, '');

  // Filter profiles based on username or displayName
  const filteredProfiles = allProfiles.filter((p) => {
    if (p.uid === myProfile?.uid) return false; // Don't show myself in search
    if (!cleanQuery) return true; // Show initial list if empty
    const matchUsername = (p.username || '').toLowerCase().includes(cleanQuery);
    const matchName = (p.displayName || '').toLowerCase().includes(cleanQuery);
    return matchUsername || matchName;
  });

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
      alert(`تم إرسال طلب الصداقة إلى ${targetUser.displayName} (@${targetUser.username}) بنجاح.`);
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
                ابحث عن أي طالب بالاسم أو المعرف (@username) لإضافته أو محادثته
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

        {/* Search Input Box */}
        <div className="py-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
            <input
              type="text"
              id="search-student-by-username-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="اكتب المعرف (مثال: @omar أو ahmed) أو الاسم..."
              className="w-full pr-10 pl-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-[#13192a] border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 text-xs"
              >
                مسح
              </button>
            )}
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span>جارٍ البحث في قاعدة الطلاب...</span>
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs space-y-2">
              <User className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
              <p>لم يتم العثور على طلاب مطابقين لـ "@{cleanQuery}".</p>
              <p className="text-[11px] text-slate-500">تأكد من كتابة اليوزر بشكل صحيح أو ابحث باسم الطالب.</p>
            </div>
          ) : (
            filteredProfiles.map((user) => {
              const status = friendStatuses[user.uid] || 'none';
              const isAdding = pendingAddIds.has(user.uid);

              return (
                <div
                  key={user.uid}
                  id={`search-result-user-${user.uid}`}
                  className="p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#13192a]/50 hover:bg-slate-100/60 dark:hover:bg-[#13192a] transition-all flex items-center justify-between gap-3"
                >
                  {/* Left: User Info */}
                  <div 
                    onClick={() => {
                      onOpenProfile(user.uid);
                    }}
                    className="flex items-center gap-3 min-w-0 cursor-pointer"
                  >
                    <img
                      src={user.photoURL || 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=Arixon1'}
                      alt={user.displayName}
                      className="w-10 h-10 rounded-2xl object-cover border border-blue-500/20 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                          {user.displayName}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                          {user.branch || 'علمي'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                        <span>@{user.username}</span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5 text-amber-500 font-sans font-bold">
                          <Trophy className="w-3 h-3" />
                          <span>{(user.totalPoints || 0).toLocaleString('ar-EG')} نقطة</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions (Message & Add Friend) */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Add Friend Button */}
                    {status === 'pending_sent' ? (
                      <span className="px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60 text-xs font-bold flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">معلّق</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAddFriend(user)}
                        disabled={isAdding}
                        className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                        title="إرسال طلب صداقة"
                      >
                        {isAdding ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <UserPlus className="w-3.5 h-3.5" />
                        )}
                        <span className="hidden sm:inline">إضافة</span>
                      </button>
                    )}

                    {/* Chat Button */}
                    <button
                      type="button"
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
                      className="px-2.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/50 text-xs font-bold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                      title="مراسلة الطالب"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">مراسلة</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-center text-[11px] text-slate-400">
          عدد الطلاب المسجلين بالبحث: {filteredProfiles.length}
        </div>
      </div>
    </div>
  );
};
