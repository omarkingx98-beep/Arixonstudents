import React, { useState, useEffect } from 'react';
import { 
  User, 
  X, 
  UserPlus, 
  MessageSquare, 
  Trophy, 
  BookOpen, 
  Calendar, 
  Check, 
  Clock, 
  Loader2, 
  ShieldAlert, 
  AlertTriangle,
  Lock,
  Flag
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAdmin } from '../context/AdminContext';
import { fetchPublicUserProfile } from '../lib/firebase';
import { sendFriendRequest, getFriendshipStatus, acceptFriendRequest } from '../lib/friendService';
import { submitStudentReport } from '../lib/reportService';
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
  const { isAdmin } = useAdmin();
  const [userProfile, setUserProfile] = useState<PublicUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [friendStatus, setFriendStatus] = useState<'none' | 'friends' | 'pending_sent' | 'pending_received' | 'self'>('none');
  const [isSendingRequest, setIsSendingRequest] = useState(false);

  // Report Dialog State
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState('مضايقة أو إساءة');
  const [reportNote, setReportNote] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportStatusMessage, setReportStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  const isSelf = myProfile?.uid === targetUserId || friendStatus === 'self';
  const canMessage = friendStatus === 'friends' || isAdmin;

  const handleSendFriendRequest = async () => {
    if (!myProfile || !userProfile || isSelf) return;
    setIsSendingRequest(true);
    try {
      await sendFriendRequest(myProfile, {
        uid: userProfile.uid,
        displayName: userProfile.displayName,
        username: userProfile.username,
      });
      setFriendStatus('pending_sent');
    } catch (err: any) {
      alert(err.message || 'فشل إرسال طلب الصداقة.');
    } finally {
      setIsSendingRequest(false);
    }
  };

  const handleStartChat = () => {
    if (!userProfile || !canMessage) return;
    onClose();
    onOpenChat({
      uid: userProfile.uid,
      displayName: userProfile.displayName,
      username: userProfile.username,
      photoURL: userProfile.photoURL || userProfile.avatar,
      branch: userProfile.branch || userProfile.track,
    });
  };

  const handleSubmitReportForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myProfile || !userProfile || isSelf) return;

    setIsSubmittingReport(true);
    setReportStatusMessage(null);
    try {
      const res = await submitStudentReport({
        reporterId: myProfile.uid,
        reporterName: myProfile.displayName || myProfile.username,
        reporterUsername: myProfile.username,
        reportedId: userProfile.uid,
        reportedName: userProfile.displayName || userProfile.username,
        reportedUsername: userProfile.username,
        reason: reportReason,
        note: reportNote.trim(),
      });

      setReportStatusMessage({ type: 'success', text: res.message });
      setTimeout(() => {
        setShowReportDialog(false);
        setReportStatusMessage(null);
        setReportNote('');
      }, 2500);
    } catch (err: any) {
      setReportStatusMessage({ type: 'error', text: err.message || 'فشل إرسال البلاغ.' });
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
            {/* Avatar & Identifiers strictly from publicProfiles safe fields */}
            <div className="flex flex-col items-center pt-2">
              <div className="relative">
                <img
                  src={userProfile.avatar || userProfile.photoURL || '/favicon-192x192.png'}
                  alt={userProfile.displayName}
                  className="w-20 h-20 rounded-3xl object-cover border-4 border-blue-500/20 shadow-md"
                  onError={(e) => {
                    e.currentTarget.src = '/favicon-192x192.png';
                  }}
                />
                <span className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white shadow-xs">
                  {userProfile.track || userProfile.branch || 'علمي'}
                </span>
              </div>

              <h3 className="text-lg font-black text-slate-900 dark:text-white mt-3">
                {userProfile.displayName}
              </h3>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-mono dir-ltr font-semibold">
                @{userProfile.username}
              </span>
            </div>

            {/* Badges / Stats Cards (public safe data only) */}
            <div className="grid grid-cols-2 gap-3 py-1">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#13192a] border border-slate-200/80 dark:border-slate-800/80 flex flex-col items-center">
                <div className="flex items-center gap-1.5 text-amber-500 text-xs font-bold mb-1">
                  <Trophy className="w-4 h-4" />
                  <span>النقاط الكلية</span>
                </div>
                <span className="text-lg font-black text-slate-900 dark:text-white">
                  {((userProfile.points ?? userProfile.totalPoints) ?? 0).toLocaleString('ar-EG')}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#13192a] border border-slate-200/80 dark:border-slate-800/80 flex flex-col items-center">
                <div className="flex items-center gap-1.5 text-blue-500 text-xs font-bold mb-1">
                  <BookOpen className="w-4 h-4" />
                  <span>الفرع الدراسي</span>
                </div>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {userProfile.track || userProfile.branch || 'علمي'}
                </span>
              </div>
            </div>

            {/* Actions (E4): Add Friend, Message, and Report */}
            {!isSelf && (
              <div className="space-y-2.5 pt-2">
                <div className="grid grid-cols-2 gap-2.5">
                  {/* 1. Add Friend Button with 3 states: إضافة / تم الإرسال / أصدقاء */}
                  {friendStatus === 'friends' ? (
                    <div className="py-2.5 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60 font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs">
                      <Check className="w-4 h-4" />
                      <span>أصدقاء</span>
                    </div>
                  ) : friendStatus === 'pending_sent' ? (
                    <div className="py-2.5 px-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60 font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs">
                      <Clock className="w-4 h-4" />
                      <span>تم الإرسال</span>
                    </div>
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
                      id="profile-add-friend-btn"
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

                  {/* 2. Message Button: Visible ONLY if friends or admin */}
                  {canMessage ? (
                    <button
                      type="button"
                      id="profile-start-chat-btn"
                      onClick={handleStartChat}
                      className="py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/20 transition-colors cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>مراسلة</span>
                      {isAdmin && friendStatus !== 'friends' && (
                        <span className="text-[9px] bg-white/20 px-1 rounded">أدمن</span>
                      )}
                    </button>
                  ) : (
                    <div 
                      className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-slate-400 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-200/60 dark:border-slate-800"
                      title="المراسلة متاحة للأصدقاء فقط"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>مراسلة (للأصدقاء)</span>
                    </div>
                  )}
                </div>

                {/* 3. Report Button */}
                <button
                  type="button"
                  id="profile-open-report-btn"
                  onClick={() => setShowReportDialog(!showReportDialog)}
                  className="w-full py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-red-50 dark:hover:bg-red-950/30 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 border border-slate-200 dark:border-slate-800 transition-colors text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Flag className="w-3.5 h-3.5 text-red-500" />
                  <span>إبلاغ عن الطالب</span>
                </button>
              </div>
            )}

            {/* Report Form Dialog (E4) */}
            {showReportDialog && !isSelf && (
              <form 
                onSubmit={handleSubmitReportForm}
                className="mt-3 p-4 rounded-2xl bg-red-50/70 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-right space-y-3 animate-fadeIn"
              >
                <div className="flex items-center gap-2 text-red-700 dark:text-red-300 font-bold text-xs">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-red-500" />
                  <span>تقديم بلاغ رسمي إلى إدارة المنصة</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  يُسمح ببلاغ واحد لكل شخص يومياً. سيتم حفظ البلاغ في لوحة الإدارة للمراجعة.
                </p>

                {reportStatusMessage && (
                  <div className={`p-2.5 rounded-xl text-xs font-semibold ${
                    reportStatusMessage.type === 'success'
                      ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                      : 'bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-300'
                  }`}>
                    {reportStatusMessage.text}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    سبب الإبلاغ:
                  </label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full text-xs p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111625] text-slate-800 dark:text-slate-200"
                  >
                    <option value="مضايقة أو إساءة">مضايقة أو إساءة في الرسائل</option>
                    <option value="اسم مستخدم غير لائق">اسم مستخدم غير لائق أو مسيء</option>
                    <option value="انتحال شخصية">انتحال شخصية طالب أو معلم</option>
                    <option value="محاولة غش أو سلوك غير أكاديمي">محاولة غش أو سلوك غير أكاديمي</option>
                    <option value="رسائل مزعجة أو ترويج">رسائل مزعجة (Spam) أو ترويج</option>
                    <option value="أخرى">سبب آخر</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    ملاحظة اختيارية:
                  </label>
                  <textarea
                    value={reportNote}
                    onChange={(e) => setReportNote(e.target.value)}
                    placeholder="اكتب تفاصيل إضافية لتوضيح المخالفة للإدارة..."
                    rows={2}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111625] text-slate-800 dark:text-slate-200 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowReportDialog(false)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    id="submit-student-report-btn"
                    disabled={isSubmittingReport}
                    className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSubmittingReport && <Loader2 className="w-3 h-3 animate-spin" />}
                    <span>إرسال البلاغ</span>
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
};
