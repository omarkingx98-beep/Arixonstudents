import React, { useState, useEffect } from 'react';
import { useAdmin } from '../../context/AdminContext';
import { useAuth } from '../../context/AuthContext';
import type { StudentReportItem, ReportCategory, ReportStatus } from '../../types';

export const AdminModerationView: React.FC = () => {
  const { isSuperAdmin, adminRole } = useAdmin();
  const { user } = useAuth();

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activeStatus, setActiveStatus] = useState<string>('open');
  const [reports, setReports] = useState<StudentReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Evidence modal state
  const [viewingEvidenceReport, setViewingEvidenceReport] = useState<StudentReportItem | null>(null);
  const [evidenceMessages, setEvidenceMessages] = useState<any[]>([]);
  const [loadingEvidence, setLoadingEvidence] = useState(false);

  // Moderation action modal
  const [actionTargetReport, setActionTargetReport] = useState<StudentReportItem | null>(null);
  const [actionType, setActionType] = useState<string>('warning');
  const [actionReason, setActionReason] = useState<string>('');
  const [applyingAction, setApplyingAction] = useState(false);

  // Resolution / Reply modal
  const [replyTargetReport, setReplyTargetReport] = useState<StudentReportItem | null>(null);
  const [resolutionStatus, setResolutionStatus] = useState<ReportStatus>('resolved');
  const [officialReply, setOfficialReply] = useState<string>('');
  const [internalNotes, setInternalNotes] = useState<string>('');
  const [savingResolution, setSavingResolution] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await user?.getIdToken();
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'listReports',
          category: activeCategory,
          status: activeStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل جلب البلاغات والطلبات');
      setReports(data.reports || []);
    } catch (err: any) {
      setError(err.message || 'تعذر تحميل البلاغات.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [activeCategory, activeStatus]);

  const handleOpenEvidence = async (rep: StudentReportItem) => {
    setViewingEvidenceReport(rep);
    setLoadingEvidence(true);
    setEvidenceMessages([]);
    try {
      const token = await user?.getIdToken();
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'getReportEvidence',
          reportId: rep.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل جلب أدلة المحادثة');
      setEvidenceMessages(data.messages || []);
    } catch (err: any) {
      setError(err.message || 'فشل جلب أدلة المحادثة.');
    } finally {
      setLoadingEvidence(false);
    }
  };

  const handleApplyModeration = async () => {
    if (!actionTargetReport || !actionTargetReport.targetId) {
      setError('لا يوجد مستخدم مستهدف محدد لهذا البلاغ.');
      return;
    }

    setApplyingAction(true);
    setError(null);
    try {
      const token = await user?.getIdToken();
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'takeModerationAction',
          targetUid: actionTargetReport.targetId,
          actionType,
          reason: actionReason.trim() || 'مخالفة معايير المجتمع وسياسات الاستخدام',
          reportId: actionTargetReport.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل تطبيق الإجراء.');

      setSuccessMsg('تم تطبيق الإجراء الرقابي بنجاح وإرسال إشعار للمستخدم.');
      setActionTargetReport(null);
      setActionReason('');
      fetchReports();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تطبيق الإجراء.');
    } finally {
      setApplyingAction(false);
    }
  };

  const handleSaveResolution = async () => {
    if (!replyTargetReport) return;

    setSavingResolution(true);
    setError(null);
    try {
      const token = await user?.getIdToken();
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'updateReportStatus',
          reportId: replyTargetReport.id,
          status: resolutionStatus,
          officialReply: officialReply.trim() || undefined,
          internalNotes: internalNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل حفظ الرد وتحديث الحالة.');

      setSuccessMsg('تم تحديث حالة البلاغ وإرسال الرد الرسمي للطالب.');
      setReplyTargetReport(null);
      setOfficialReply('');
      setInternalNotes('');
      fetchReports();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تحديث البلاغ.');
    } finally {
      setSavingResolution(false);
    }
  };

  const categories = [
    { id: 'all', label: 'الكل', icon: '📋' },
    { id: 'violation', label: 'بلاغات المخالفات', icon: '🚨' },
    { id: 'complaint', label: 'الشكاوى', icon: '⚠️' },
    { id: 'support', label: 'طلبات الدعم', icon: '🎧' },
    { id: 'suggestion', label: 'الاقتراحات', icon: '💡' },
  ];

  const statuses = [
    { id: 'all', label: 'كافة الحالات' },
    { id: 'open', label: 'قيد الانتظار (مفتوح)' },
    { id: 'under_review', label: 'قيد المراجعة' },
    { id: 'resolved', label: 'تم الحل' },
    { id: 'dismissed', label: 'مرفوض / محفوظ' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-50 flex items-center gap-2">
              <span>🛡️</span>
              <span>مركز البلاغات، الشكاوى والدعم الفني</span>
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              متابعة شكاوى الطلاب، التحقق من أدلة المحادثات المؤرشفة، وتطبيق تدابير الرقابة والكتم
            </p>
          </div>

          <button
            onClick={fetchReports}
            className="px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors flex items-center gap-1.5"
          >
            <span>🔄</span>
            <span>تحديث</span>
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 flex items-center gap-1.5 ${
                activeCategory === c.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <span>{c.icon}</span>
              <span>{c.label}</span>
            </button>
          ))}
        </div>

        {/* Status Filters */}
        <div className="flex flex-wrap gap-2 mt-3 items-center">
          <span className="text-xs font-bold text-slate-400">الحالة:</span>
          {statuses.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveStatus(s.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                activeStatus === s.id
                  ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 font-bold'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages / Alerts */}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700 text-xs font-bold">
            إغلاق
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>✅</span>
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700 text-xs font-bold">
            إغلاق
          </button>
        </div>
      )}

      {/* Reports List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="inline-block animate-spin text-2xl mb-2">⌛</div>
            <p className="text-sm">جارٍ تحميل البلاغات والطلبات...</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <span className="text-3xl block mb-2">🎉</span>
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
              لا توجد بلاغات أو طلبات في هذا القسم حاليًا.
            </p>
            <p className="text-xs text-slate-400 mt-1">كل شيء هادئ ومنتظم في المنصة.</p>
          </div>
        ) : (
          reports.map((rep) => {
            const isHighPriority = rep.priority === 'high' || rep.priority === 'urgent';
            return (
              <div
                key={rep.id}
                className={`p-5 bg-white dark:bg-slate-900 rounded-2xl border transition-all ${
                  isHighPriority
                    ? 'border-amber-400 dark:border-amber-600 shadow-amber-500/5 shadow-md'
                    : 'border-slate-200 dark:border-slate-800 shadow-xs'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                      #{rep.id.substring(0, 8)}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        rep.status === 'open'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          : rep.status === 'resolved'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20'
                      }`}
                    >
                      {rep.status === 'open'
                        ? 'قيد الانتظار'
                        : rep.status === 'under_review'
                        ? 'قيد المراجعة'
                        : rep.status === 'resolved'
                        ? 'تم الحل'
                        : 'محفوظ'}
                    </span>
                    {isHighPriority && (
                      <span className="px-2 py-0.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[11px] font-bold rounded-full border border-rose-500/20 animate-pulse">
                        🔥 أولوية مرتفعة
                      </span>
                    )}
                    <span className="text-xs text-slate-400">
                      {new Date(rep.createdAt).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </div>

                  <span className="text-xs text-slate-400 font-mono">المرسل: {rep.reporterEmail || rep.reporterId}</span>
                </div>

                {/* Content */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">النوع / التصنيف:</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                      {rep.type}
                    </span>
                    {rep.targetId && (
                      <>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs text-slate-500">المستهدف:</span>
                        <span className="text-xs font-mono text-slate-700 dark:text-slate-300">
                          {rep.targetName || rep.targetId}
                        </span>
                      </>
                    )}
                  </div>

                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-relaxed">
                    السبب: {rep.reason}
                  </p>

                  {rep.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800 whitespace-pre-wrap">
                      {rep.description}
                    </p>
                  )}

                  {rep.officialReply && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl text-xs space-y-1">
                      <span className="font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1">
                        <span>💬</span>
                        <span>الرد الرسمي المرسل للطالب:</span>
                      </span>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{rep.officialReply}</p>
                    </div>
                  )}
                </div>

                {/* Actions Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    {rep.evidenceCount && rep.evidenceCount > 0 ? (
                      <button
                        onClick={() => handleOpenEvidence(rep)}
                        className="px-3 py-1.5 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-bold rounded-xl hover:bg-purple-100 transition-colors flex items-center gap-1.5"
                      >
                        <span>📑</span>
                        <span>سجل المحادثة الموثق ({rep.evidenceCount} رسالة)</span>
                      </button>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2">
                    {rep.targetId && rep.targetType === 'user' && (
                      <button
                        onClick={() => {
                          setActionTargetReport(rep);
                          setActionReason(`بناءً على البلاغ #${rep.id.substring(0, 8)}`);
                        }}
                        className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold rounded-xl hover:bg-rose-100 transition-colors flex items-center gap-1"
                      >
                        <span>⚖️</span>
                        <span>إجراء رقابي على المخالف</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setReplyTargetReport(rep);
                        setResolutionStatus(rep.status === 'open' ? 'resolved' : rep.status);
                        setOfficialReply(rep.officialReply || '');
                      }}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs flex items-center gap-1"
                    >
                      <span>✍️</span>
                      <span>الرد وتحديث الحالة</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Evidence Viewer Modal */}
      {viewingEvidenceReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>📑</span>
                  <span>الأدلة الموثقة للدردشة (سجل محفوظ بالسيرفر)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  نسخة موثقة غير قابلة للتعديل تم أخذها تلقائيًا لحظة تقديم البلاغ
                </p>
              </div>
              <button
                onClick={() => setViewingEvidenceReport(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
              {loadingEvidence ? (
                <div className="p-8 text-center text-slate-400">
                  <div className="inline-block animate-spin text-xl mb-1">⌛</div>
                  <p className="text-xs">جارٍ استرجاع سجل الأدلة...</p>
                </div>
              ) : evidenceMessages.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">لا توجد رسائل مسجلة كأدلة.</div>
              ) : (
                evidenceMessages.map((msg, i) => (
                  <div
                    key={msg.id || i}
                    className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-slate-400 text-[10px]">
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {msg.senderName || msg.senderId}
                      </span>
                      <span>{msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('ar-EG') : ''}</span>
                    </div>
                    <p className="text-slate-800 dark:text-slate-200 font-medium whitespace-pre-wrap">{msg.text}</p>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setViewingEvidenceReport(null)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Moderation Action Modal */}
      {actionTargetReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>⚖️</span>
                <span>تطبيق إجراء رقابي على المستخدم</span>
              </h3>
              <button
                onClick={() => setActionTargetReport(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl text-xs space-y-1">
              <div className="text-slate-500">المستخدم المستهدف:</div>
              <div className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                {actionTargetReport.targetName || actionTargetReport.targetId}
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                اختر نوع الإجراء الرقابي:
              </label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { id: 'warning', label: 'تنبيه إداري رسمي', desc: 'إشعار تحذيري محترم للمستخدم دون تقييد وظائف' },
                  { id: 'mute_24h', label: 'كتم وإسكات في المحادثات لمدة 24 ساعة', desc: 'منع إرسال الرسائل ليوم كامل' },
                  { id: 'mute_7d', label: 'كتم وإسكات في المحادثات لمدة 7 أيام', desc: 'منع إرسال الرسائل لأسبوع كامل' },
                  { id: 'chat_disable', label: 'تعطيل الدردشة بشكل كامل', desc: 'إيقاف ميزة الدردشة حتى إشعار آخر' },
                  { id: 'unmute', label: 'رفع القيد عن الحساب', desc: 'إلغاء الكتم وإعادة تفعيل الدردشة للمستخدم' },
                ].map((act) => (
                  <label
                    key={act.id}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      actionType === act.id
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="modAction"
                      value={act.id}
                      checked={actionType === act.id}
                      onChange={(e) => setActionType(e.target.value)}
                      className="mt-0.5 text-blue-600"
                    />
                    <div className="text-xs">
                      <div className="font-bold text-slate-800 dark:text-slate-200">{act.label}</div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">{act.desc}</div>
                    </div>
                  </label>
                ))}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  سبب الإجراء (يظهر في الإشعار وفي سجل التدقيق):
                </label>
                <input
                  type="text"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="مثال: سلوك غير لائق في المحادثات العامة"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setActionTargetReport(null)}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleApplyModeration}
                disabled={applyingAction}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
              >
                {applyingAction ? 'جارٍ تطبيق الإجراء...' : 'تأكيد الإجراء'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resolution & Reply Modal */}
      {replyTargetReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>✍️</span>
                <span>الرد وتحديث حالة البلاغ</span>
              </h3>
              <button
                onClick={() => setReplyTargetReport(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  تحديث الحالة:
                </label>
                <select
                  value={resolutionStatus}
                  onChange={(e) => setResolutionStatus(e.target.value as ReportStatus)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  <option value="open">قيد الانتظار (مفتوح)</option>
                  <option value="under_review">قيد المراجعة</option>
                  <option value="resolved">تم الحل بنجاح</option>
                  <option value="dismissed">مرفوض / محفوظ</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  الرد الرسمي للطالب (يصل كإشعار فوري):
                </label>
                <textarea
                  rows={4}
                  value={officialReply}
                  onChange={(e) => setOfficialReply(e.target.value)}
                  placeholder="مثال: شكرًا لتواصلك معنا. تم التحقق من البلاغ واتخاذ الإجراء اللازم لحماية بيئة التعلم..."
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ملاحظات داخلية لفريق المشرفين (سرية لا تظهر للطالب):
                </label>
                <input
                  type="text"
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder="ملاحظات توثيقية خاصة بالفريق..."
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setReplyTargetReport(null)}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveResolution}
                disabled={savingResolution}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
              >
                {savingResolution ? 'جارٍ الحفظ...' : 'حفظ وإرسال الرد'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminModerationView;
