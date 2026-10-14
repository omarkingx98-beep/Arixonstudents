import React, { useState, useEffect } from 'react';
import { 
  User, 
  X, 
  UserPlus, 
  MessageSquare, 
  Trophy, 
  Award, 
  BookOpen, 
  Calendar, 
  Check, 
  Clock, 
  Loader2 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchPublicUserProfile } from '../lib/firebase';
import { sendFriendRequest, getFriendshipStatus } from '../lib/friendService';
import type { PublicUserProfile } from '../types';

interface PublicProfileModalProps {
  targetUserId: string | null;
  onClose: () => void;
  onOpenChat: (targetUser: { uid: string; displayName: string; username: string; photoURL?: string; branch?: string }) => void;
}

export const PublicProfileModal: React.FC<PublicProfileModalProps> = ({
  targetUserId,
  onClose,
  onOpenChat,
}) => {
  const { profile: myProfile } = useAuth();
  const [userProfile, setUserProfile] = useState<PublicUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [friendStatus, setFriendStatus] = useState<'none' | 'friends' | 'pending_sent' | 'pending_received' | 'self'>('none');
  const [isSendingRequest, setIsSendingRequest] = useState(false);

  useEffect(() => {
    if (!targetUserId) return;
    let isMounted = true;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const [profileData, status] = await Promise.all([
          fetchPublicUserProfile(targetUserId),
          myProfile ? getFriendshipStatus(myProfile.uid, targetUserId) : Promise.resolve('none' as const),
        ]);

        if (isMounted) {
          setUserProfile(profileData);
          setFriendStatus(status);
        }
      } catch (err) {
        console.warn('Error loading public profile:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [targetUserId, myProfile?.uid]);

  if (!targetUserId) return null;

  const handleSendFriendRequest = async () => {
    if (!myProfile || !userProfile) return;
    setIsSendingRequest(true);
    try {
      await sendFriendRequest(myProfile, {
        uid: userProfile.uid,
        displayName: userProfile.displayName,
        username: userProfile.username,
      });
      setFriendStatus('pending_sent');
      alert(`تم إرسال طلب الصداقة إلى ${userProfile.displayName} بنجاح.`);
    } catch (err: any) {
      alert(err.message || 'فشل إرسال طلب الصداقة.');
    } finally {
      setIsSendingRequest(false);
    }
  };

  const handleStartChat = () => {
    if (!userProfile) return;
    onClose();
    onOpenChat({
      uid: userProfile.uid,
      displayName: userProfile.displayName,
      username: userProfile.username,
      photoURL: userProfile.photoURL,
      branch: userProfile.branch,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
      <div 
        id="public-profile-modal"
        className="bg-white dark:bg-[#0c101c] w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-6 relative overflow-hidden text-center"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 absolute top-4 left-4 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400 text-xs">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span>جارٍ تحميل الملف التعريفي...</span>
          </div>
        ) : !userProfile ? (
          <div className="py-16 text-center text-slate-400 text-xs space-y-2">
            <User className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
            <p>تعذر العثور على الملف الشخصي لهذا الطالب.</p>
          </div>
        ) : (
          <>
            {/* Avatar & Identifiers */}
            <div className="flex flex-col items-center pt-2">
              <div className="relative">
                <img
                  src={userProfile.photoURL || 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=Arixon1'}
                  alt={userProfile.displayName}
                  className="w-20 h-20 rounded-3xl object-cover border-4 border-blue-500/20 shadow-md"
                />
                <span className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white shadow-xs">
                  {userProfile.branch || 'علمي'}
                </span>
              </div>

              <h3 className="text-lg font-black text-slate-900 dark:text-white mt-3">
                {userProfile.displayName}
              </h3>
              <span className="text-xs text-slate-400 font-mono dir-ltr">
                @{userProfile.username}
              </span>
            </div>

            {/* Badges / Stats Cards */}
            <div className="grid grid-cols-2 gap-3 py-1">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#13192a] border border-slate-200/80 dark:border-slate-800/80 flex flex-col items-center">
                <div className="flex items-center gap-1.5 text-amber-500 text-xs font-bold mb-1">
                  <Trophy className="w-4 h-4" />
                  <span>النقاط الكلية</span>
                </div>
                <span className="text-lg font-black text-slate-900 dark:text-white">
                  {userProfile.totalPoints.toLocaleString('ar-EG')}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#13192a] border border-slate-200/80 dark:border-slate-800/80 flex flex-col items-center">
                <div className="flex items-center gap-1.5 text-blue-500 text-xs font-bold mb-1">
                  <BookOpen className="w-4 h-4" />
                  <span>الفرع الدراسي</span>
                </div>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {userProfile.branch ? `الفرع ال${userProfile.branch}` : 'الفرع العلمي'}
                </span>
              </div>
            </div>

            {/* Extra safe details */}
            <div className="text-[11px] text-slate-400 flex items-center justify-center gap-4 border-t border-b border-slate-100 dark:border-slate-800/80 py-2.5">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>انضم عام {new Date(userProfile.createdAt || Date.now()).getFullYear()}</span>
              </span>
              {userProfile.age && (
                <span>• العمر: {userProfile.age} سنة</span>
              )}
            </div>

            {/* Actions: Add Friend & Message */}
            {friendStatus !== 'self' && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                {/* Friend Status / Add Button */}
                {friendStatus === 'friends' ? (
                  <button
                    disabled
                    className="py-2.5 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60 font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <Check className="w-4 h-4" />
                    <span>أصدقاء ✓</span>
                  </button>
                ) : friendStatus === 'pending_sent' ? (
                  <button
                    disabled
                    className="py-2.5 px-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60 font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <Clock className="w-4 h-4" />
                    <span>الطلب معلّق</span>
                  </button>
                ) : friendStatus === 'pending_received' ? (
                  <button
                    disabled
                    className="py-2.5 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60 font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>أرسل لك طلباً</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendFriendRequest}
                    disabled={isSendingRequest}
                    className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSendingRequest ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <UserPlus className="w-3.5 h-3.5" />
                    )}
                    <span>إضافة صديق</span>
                  </button>
                )}

                {/* Message Button */}
                <button
                  type="button"
                  onClick={handleStartChat}
                  className="py-2.5 px-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/50 font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>مراسلة</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
