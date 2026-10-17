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
  Loader2,
  ShieldAlert,
  Ban,
  Flag,
  AlertTriangle,
  Send
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchPublicUserProfile } from '../lib/firebase';
import { sendFriendRequest, getFriendshipStatus, acceptFriendRequest } from '../lib/friendService';
import { submitStudentReportOrBlock } from '../lib/adminService';
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

  // Report & Block State
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportActionType, setReportActionType] = useState<'report' | 'block'>('report');
  const [reportReason, setReportReason] = useState('إساءة أو مضايقة');
  const [reportDetails, setReportDetails] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportSuccessMessage, setReportSuccessMessage] = useState<string | null>(null);

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

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myProfile || !userProfile) return;

    setIsSubmittingReport(true);
    try {
      await submitStudentReportOrBlock({
        reporterId: myProfile.uid,
        reporterName: myProfile.displayName || myProfile.username,
        reporterUsername: myProfile.username,
        reportedUserId: userProfile.uid,
        reportedUserName: userProfile.displayName || userProfile.username,
        reportedUserUsername: userProfile.username,
        actionType: reportActionType,
        reason: reportReason,
        details: reportDetails.trim(),
      });

      setReportSuccessMessage(
        reportActionType === 'block'
          ? `تم تسجيل حظر الطالب ${userProfile.displayName} وتم إرسال إشعار فوري إلى إدارة المنصة.`
          : `تم إرسال بلاغك حول الطالب ${userProfile.displayName} إلى إشعارات الإدارة للمراجعة العاجلة.`
      );
      setTimeout(() => {
        setShowReportDialog(false);
        setReportSuccessMessage(null);
      }, 2500);
    } catch (err: any) {
      alert('حدث خطأ أثناء إرسال البلاغ. يرجى المحاولة لاحقاً.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
      <div 
        id="public-profile-modal"
        className="bg-white dark:bg-[#0c101c] w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-5 relative overflow-hidden text-center max-h-[90vh] overflow-y-auto"
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
          <div className="py-16 text-center text-slate-400 text-xs space-y-3">
            <User className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
            <p>تعذر العثور على الملف الشخصي لهذا الطالب حالياً.</p>
            <button
              onClick={() => {
                if (targetUserId) {
                  setIsLoading(true);
                  fetchPublicUserProfile(targetUserId).then(p => {
                    setUserProfile(p);
                    setIsLoading(false);
                  }).catch(() => setIsLoading(false));
                }
              }}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              إعادة المحاولة
            </button>
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
                  {(userProfile.totalPoints ?? 0).toLocaleString('ar-EG')}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#13192a] border border-slate-200/80 dark:border-slate-800/80 flex flex-col items-center">
                <div className="flex items-center gap-1.5 text-blue-500 text-xs font-bold mb-1">
                  <BookOpen className="w-4 h-4" />
                  <span>الفرع الدراسي</span>
                </div>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {userProfile.branch ? `فرع ${userProfile.branch}` : 'الفرع العلمي'}
                </span>
              </div>
            </div>

            {/* Extra safe details */}
            <div className="text-[11px] text-slate-400 flex items-center justify-center gap-4 border-t border-b border-slate-100 dark:border-slate-800/80 py-2.5">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>انضم عام {userProfile.createdAt ? (new Date(userProfile.createdAt).getFullYear() || 2025) : 2025}</span>
              </span>
              {userProfile.age && (
                <span>• العمر: {userProfile.age} سنة</span>
              )}
            </div>

            {/* Actions: Add Friend, Message, and Report/Block */}
            {friendStatus !== 'self' && (
              <div className="space-y-2.5 pt-1">
                <div className="grid grid-cols-2 gap-2.5">
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
                      type="button"
                      onClick={async () => {
                        if (!myProfile) return;
                        try {
                          await acceptFriendRequest(
                            `freq_${[myProfile.uid, userProfile.uid].sort().join('_')}`,
                            userProfile.uid,
                            myProfile
                          );
                          setFriendStatus('friends');
                          alert(`تم قبول طلب الصداقة مع ${userProfile.displayName}!`);
                        } catch (err: any) {
                          alert(err.message || 'فشل قبول الطلب');
                        }
                      }}
                      className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>قبول الصداقة</span>
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

                {/* Report or Block Toggle Button */}
                <button
                  type="button"
                  onClick={() => setShowReportDialog(!showReportDialog)}
                  className="w-full py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-red-50 dark:hover:bg-red-950/30 text-slate-600 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 border border-slate-200 dark:border-slate-800 transition-colors text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                  <span>إبلاغ أو حظر الطالب</span>
                </button>
              </div>
            )}

            {/* In-Modal Report / Block Dialog */}
            {showReportDialog && (
              <form onSubmit={handleSubmitReport} className="mt-3 p-4 rounded-2xl bg-red-50/60 dark:bg-red-950/20 border border-red-200/80 dark:border-red-900/40 text-right space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-red-700 dark:text-red-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    <span>إرسال إشعار للإدارة (إبلاغ / حظر)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowReportDialog(false)}
                    className="text-slate-400 hover:text-slate-600 text-xs"
                  >
                    إلغاء
                  </button>
                </div>

                {reportSuccessMessage ? (
                  <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{reportSuccessMessage}</span>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        نوع الإجراء:
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setReportActionType('report')}
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            reportActionType === 'report'
                              ? 'bg-red-600 text-white shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          إبلاغ عن مخالفة
                        </button>
                        <button
                          type="button"
                          onClick={() => setReportActionType('block')}
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            reportActionType === 'block'
                              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          حظر الطالب
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        سبب البلاغ أو الحظر:
                      </label>
                      <select
                        value={reportReason}
                        onChange={(e) => setReportReason(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-hidden"
                      >
                        <option value="إساءة أو مضايقة">إساءة أو مضايقة في الدردشة</option>
                        <option value="لغة غير لائقة">لغة غير لائقة أو ألفاظ مسيئة</option>
                        <option value="انتحال شخصية أو حساب وهمي">انتحال شخصية أو حساب وهمي</option>
                        <option value="غش أو تلاعب بالنقاط">غش أو تلاعب في الامتحانات والنقاط</option>
                        <option value="أخرى">سبب آخر</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        تفاصيل إضافية للإدارة (اختياري):
                      </label>
                      <textarea
                        rows={2}
                        value={reportDetails}
                        onChange={(e) => setReportDetails(e.target.value)}
                        placeholder="اكتب توضيحاً مختصراً لمساعدة المشرفين..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-hidden"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmittingReport}
                      className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isSubmittingReport ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>إرسال البلاغ فورياً للإدارة</span>
                    </button>
                  </>
                )}
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
};
