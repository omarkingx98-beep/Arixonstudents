import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Filter,
  ShieldAlert,
  ShieldCheck,
  Trophy,
  Award,
  Phone,
  Mail,
  MapPin,
  Clock,
  BookOpen,
  PlusCircle,
  MinusCircle,
  RotateCcw,
  X,
  AlertCircle,
  CheckCircle2,
  Bell,
  MessageSquare,
  Send,
  Radio,
  BookOpenCheck,
} from 'lucide-react';
import {
  fetchAllStudents,
  toggleStudentDisabledState,
  adjustStudentPointsWithReason,
  adminChangeStudentBranch,
  adminSendStudentNotification,
  adminToggleChatDisabled,
} from '../../lib/adminService';
import { broadcastAdminNotification } from '../../lib/notificationService';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import type { UserProfile, ExamAttempt } from '../../types';

export const AdminStudentsView: React.FC = () => {
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedCity, setSelectedCity] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Selected Student Modal & Actions
  const [selectedStudent, setSelectedStudent] = useState<UserProfile | null>(null);
  const [studentAttempts, setStudentAttempts] = useState<ExamAttempt[]>([]);
  const [isLoadingAttempts, setIsLoadingAttempts] = useState(false);

  // Adjust Points Dialog State
  type AdjustMode = 'add' | 'deduct' | 'reset';
  const [isAdjustPointsOpen, setIsAdjustPointsOpen] = useState(false);
  const [adjustMode, setAdjustMode] = useState<AdjustMode>('add');
  const [adjustInputValue, setAdjustInputValue] = useState<number>(50);
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [isAdjusting, setIsAdjusting] = useState(false);

  // Disable Student Dialog State
  const [isDisableOpen, setIsDisableOpen] = useState(false);
  const [disableReason, setDisableReason] = useState<string>('');
  const [isTogglingDisable, setIsTogglingDisable] = useState(false);

  // Direct Student Notification Modal State
  const [isSendNotifOpen, setIsSendNotifOpen] = useState(false);
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [isSendingNotif, setIsSendingNotif] = useState(false);

  // Broadcast Notification Modal State
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // Branch & Chat Action States
  const [isChangingBranch, setIsChangingBranch] = useState(false);
  const [isTogglingChat, setIsTogglingChat] = useState(false);

  const loadStudents = async () => {
    setIsLoading(true);
    try {
      const list = await fetchAllStudents();
      setStudents(list);
    } catch (err) {
      console.error('Error fetching students:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const openStudentDetails = async (student: UserProfile) => {
    setSelectedStudent(student);
    setIsLoadingAttempts(true);
    try {
      const q = query(
        collection(db, 'attempts'),
        where('userId', '==', student.uid),
        orderBy('startedAt', 'desc')
      );
      const snap = await getDocs(q);
      const list: ExamAttempt[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<ExamAttempt, 'id'>) }));
      setStudentAttempts(list);
    } catch (err) {
      console.warn('Could not load student attempts:', err);
      setStudentAttempts([]);
    } finally {
      setIsLoadingAttempts(false);
    }
  };

  const getEffectiveDelta = (): number => {
    if (!selectedStudent) return 0;
    const currentPoints = selectedStudent.totalPoints || 0;
    if (adjustMode === 'reset') {
      return -currentPoints;
    }
    const val = Math.max(0, Number(adjustInputValue) || 0);
    return adjustMode === 'deduct' ? -val : val;
  };

  const handleAdjustPointsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjustError(null);
    if (!selectedStudent) return;

    if (!auth.currentUser) {
      const msg = 'جلسة المشرف غير نشطة حالياً. يرجى تسجيل الدخول بحساب معتمد.';
      setAdjustError(msg);
      alert(msg);
      return;
    }

    const delta = getEffectiveDelta();
    if (delta === 0 && adjustMode !== 'reset') {
      const msg = 'يرجى تحديد مقدار النقاط (قيمة أكبر من صفر).';
      setAdjustError(msg);
      alert(msg);
      return;
    }
    if (!adjustReason.trim()) {
      const msg = 'يرجى كتابة سبب تعديل النقاط بدقة للتوثيق والرقابة الإدارية.';
      setAdjustError(msg);
      alert(msg);
      return;
    }

    setIsAdjusting(true);
    try {
      const res = await adjustStudentPointsWithReason({
        studentId: selectedStudent.uid,
        studentName: selectedStudent.displayName || selectedStudent.username,
        amount: delta,
        reason: adjustReason.trim(),
      });

      // Update local state immediately
      setSelectedStudent({
        ...selectedStudent,
        totalPoints: res.newBalance,
      });
      await loadStudents();
      setIsAdjustPointsOpen(false);
      setAdjustReason('');
      setAdjustError(null);
      alert(`تم تطبيق التعديل بنجاح!\nالرصيد السابق: ${res.previousBalance} نقطة\nالعملية: ${delta > 0 ? '+' : ''}${delta} نقطة\nالرصيد الجديد: ${res.newBalance} نقطة.`);
    } catch (err: any) {
      console.error('[AdminStudentsView AdjustPoints Error]:', err);
      const detail = `فشلت العملية (${err?.code || 'ERROR'}): ${err?.message || 'تحقق من الصلاحيات أو قواعد Firestore'}`;
      setAdjustError(detail);
      alert(detail);
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleToggleDisable = async () => {
    if (!selectedStudent) return;

    if (!auth.currentUser) {
      alert('جلسة المشرف غير نشطة حالياً. يرجى تسجيل الدخول بحساب معتمد.');
      return;
    }

    const isCurrentlyDisabled = (selectedStudent as any).accountDisabled;
    const willDisable = !isCurrentlyDisabled;

    if (willDisable && !disableReason.trim()) {
      alert('يرجى تحديد سبب تجميد أو تعطيل الحساب للرقابة الإدارية.');
      return;
    }

    setIsTogglingDisable(true);
    try {
      await toggleStudentDisabledState(
        selectedStudent.uid,
        selectedStudent.displayName || selectedStudent.username,
        willDisable,
        disableReason.trim() || 'إعادة تفعيل الحساب'
      );

      setSelectedStudent({
        ...selectedStudent,
        accountDisabled: willDisable,
      } as any);

      await loadStudents();
      setIsDisableOpen(false);
      setDisableReason('');
      alert(`تم ${willDisable ? 'تجميد' : 'إعادة تفعيل'} الحساب بنجاح.`);
    } catch (err: any) {
      console.error('[AdminStudentsView ToggleDisable Error]:', err);
      alert(`فشل تغيير حالة الحساب (${err?.code || 'ERROR'}): ${err?.message || 'تحقق من الصلاحيات'}`);
    } finally {
      setIsTogglingDisable(false);
    }
  };

  const handleSwitchBranch = async (newBranch: 'علمي' | 'أدبي') => {
    if (!selectedStudent) return;
    if (selectedStudent.branch === newBranch) return;

    if (!window.confirm(`هل أنت متأكد من تغيير فرع الطالب "${selectedStudent.displayName || selectedStudent.username}" إلى الفرع ال${newBranch}؟`)) {
      return;
    }

    setIsChangingBranch(true);
    try {
      await adminChangeStudentBranch(
        selectedStudent.uid,
        selectedStudent.displayName || selectedStudent.username,
        newBranch
      );

      setSelectedStudent({
        ...selectedStudent,
        branch: newBranch,
      });

      await loadStudents();
      alert(`تم تغيير فرع الطالب بنجاح إلى: الفرع ال${newBranch}`);
    } catch (err: any) {
      alert(err.message || 'فشل تغيير فرع الطالب.');
    } finally {
      setIsChangingBranch(false);
    }
  };

  const handleSendDirectNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !notifTitle.trim() || !notifMessage.trim()) {
      alert('يرجى ملء عنوان ونص الإشعار.');
      return;
    }

    setIsSendingNotif(true);
    try {
      await adminSendStudentNotification(
        selectedStudent.uid,
        notifTitle.trim(),
        notifMessage.trim()
      );
      setIsSendNotifOpen(false);
      setNotifTitle('');
      setNotifMessage('');
      alert(`تم إرسال الإشعار المباشر إلى "${selectedStudent.displayName || selectedStudent.username}" بنجاح!`);
    } catch (err: any) {
      alert(err.message || 'فشل إرسال الإشعار.');
    } finally {
      setIsSendingNotif(false);
    }
  };

  const handleToggleChatDisabled = async () => {
    if (!selectedStudent) return;
    const currentDisabled = (selectedStudent as any).chatDisabled || false;
    const willDisable = !currentDisabled;

    if (!window.confirm(`هل أنت متأكد من ${willDisable ? 'إيقاف' : 'إعادة تفعيل'} ميزة الدردشة الخاصة لهذا الطالب؟`)) {
      return;
    }

    setIsTogglingChat(true);
    try {
      await adminToggleChatDisabled(
        selectedStudent.uid,
        selectedStudent.displayName || selectedStudent.username,
        willDisable
      );

      setSelectedStudent({
        ...selectedStudent,
        chatDisabled: willDisable,
      } as any);

      await loadStudents();
      alert(`تم ${willDisable ? 'إيقاف' : 'إعادة تفعيل'} الدردشة للطالب بنجاح.`);
    } catch (err: any) {
      alert(err.message || 'فشل تغيير حالة الدردشة.');
    } finally {
      setIsTogglingChat(false);
    }
  };

  const handleBroadcastSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      alert('يرجى كتابة عنوان وتفاصيل الإشعار العام.');
      return;
    }

    if (students.length === 0) {
      alert('لا يوجد طلاب مسجلون لإرسال البث.');
      return;
    }

    if (!window.confirm(`هل أنت متأكد من بث هذا الإشعار لجميع الطلاب (${students.length} طالب)؟`)) {
      return;
    }

    setIsBroadcasting(true);
    try {
      const studentIds = students.map((s) => s.uid);
      await broadcastAdminNotification({
        title: broadcastTitle.trim(),
        message: broadcastMessage.trim(),
        studentIds,
      });

      setIsBroadcastOpen(false);
      setBroadcastTitle('');
      setBroadcastMessage('');
      alert(`تم بث الإشعار بنجاح لجميع الطلبة (${students.length} طالب)!`);
    } catch (err: any) {
      alert(err.message || 'فشل بث الإشعار.');
    } finally {
      setIsBroadcasting(false);
    }
  };

  // Filter logic
  const filteredStudents = students.filter((s) => {
    if (selectedBranch !== 'all' && s.branch !== selectedBranch) return false;
    if (selectedCity !== 'all' && s.city !== selectedCity) return false;
    const isDisabled = (s as any).accountDisabled;
    if (selectedStatus === 'active' && isDisabled) return false;
    if (selectedStatus === 'disabled' && !isDisabled) return false;

    if (searchQuery.trim()) {
      const term = searchQuery.toLowerCase().trim();
      const matchName = s.displayName?.toLowerCase().includes(term);
      const matchUser = s.username?.toLowerCase().includes(term);
      const matchEmail = s.email?.toLowerCase().includes(term);
      const matchPhone = s.phone?.includes(term);
      const matchCity = s.city?.toLowerCase().includes(term);
      if (!matchName && !matchUser && !matchEmail && !matchPhone && !matchCity) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#0c101c] p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            <span>إدارة حسابات وبيانات الطلاب</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            متابعة نشاط الطلاب، أداء الامتحانات، الأرصدة والنقاط، والتحكم بالحسابات
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsBroadcastOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm shadow-blue-500/20 transition-all"
            title="إرسال إشعار عام يصل لجميع الطلاب في التطبيق"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>بث إشعار لجميع الطلاب</span>
          </button>

          <div className="text-xs font-bold px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            إجمالي الطلاب: {students.length}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-[#0c101c] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم، المعرف، الهاتف أو البريد..."
            className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#13192a] text-xs focus:outline-hidden focus:border-emerald-500"
          />
        </div>

        <select
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#13192a] text-xs"
        >
          <option value="all">جميع الفروع الأكاديمية</option>
          <option value="scientific">الفرع العلمي</option>
          <option value="literary">الفرع الأدبي</option>
          <option value="industrial">الفرع الصناعي</option>
          <option value="entrepreneurship">فرع الريادة والأعمال</option>
        </select>

        <select
          value={selectedCity}
          onChange={(e) => setSelectedCity(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#13192a] text-xs"
        >
          <option value="all">جميع المحافظات الفلسطينية</option>
          <option value="غزة">غزة</option>
          <option value="خان يونس">خان يونس</option>
          <option value="رفح">رفح</option>
          <option value="شمال غزة">شمال غزة</option>
          <option value="دير البلح">دير البلح</option>
          <option value="القدس">القدس الشريف</option>
          <option value="رام الله والبيرة">رام الله والبيرة</option>
          <option value="نابلس">نابلس</option>
          <option value="الخليل">الخليل</option>
          <option value="جنين">جنين</option>
          <option value="طولكرم">طولكرم</option>
          <option value="قلقيلية">قلقيلية</option>
          <option value="بيت لحم">بيت لحم</option>
          <option value="أريحا">أريحا</option>
          <option value="سلفيت">سلفيت</option>
          <option value="طوباس">طوباس</option>
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#13192a] text-xs"
        >
          <option value="all">جميع الحالات</option>
          <option value="active">الحسابات النشطة</option>
          <option value="disabled">الحسابات المجمدة</option>
        </select>
      </div>

      {/* Students Table */}
      {isLoading ? (
        <div className="text-center py-16 text-slate-400 text-xs">
          جارٍ تحميل سجلات الطلاب من قاعدة البيانات...
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-[#0c101c] rounded-3xl border border-slate-200/80 dark:border-slate-800/80 p-8 space-y-2">
          <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
            لم يتم العثور على أي طلاب مطابقين
          </h3>
          <p className="text-xs text-slate-400">
            جرب تعديل مصطلح البحث أو إزالة الفلاتر المطبقة.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#0c101c] rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-[#111625] text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-4">الطالب</th>
                  <th className="p-4">المحافظة والفرع</th>
                  <th className="p-4">الامتحانات المنجزة</th>
                  <th className="p-4">إجمالي النقاط</th>
                  <th className="p-4">حالة الحساب</th>
                  <th className="p-4 text-left">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredStudents.map((s) => {
                  const isDisabled = (s as any).accountDisabled;
                  return (
                    <tr
                      key={s.uid}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                            {s.displayName ? s.displayName.charAt(0) : 'S'}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-white truncate">
                              {s.displayName || s.username}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {s.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="text-slate-700 dark:text-slate-300">
                          {s.city || 'فلسطين'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {s.branch || 'توجيهي'}
                        </div>
                      </td>

                      <td className="p-4 font-bold text-slate-800 dark:text-slate-200">
                        {s.examsCompleted || 0}
                      </td>

                      <td className="p-4">
                        <span className="font-black text-amber-600 dark:text-amber-400">
                          {s.totalPoints || 0}
                        </span>{' '}
                        <span className="text-[10px] text-slate-400">نقطة</span>
                      </td>

                      <td className="p-4">
                        {isDisabled ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900">
                            مجمد
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900">
                            نشط
                          </span>
                        )}
                      </td>

                      <td className="p-4 text-left">
                        <button
                          onClick={() => openStudentDetails(s)}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-blue-600 dark:text-blue-400 cursor-pointer"
                        >
                          عرض الملف
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Student Details Inspection Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 overflow-y-auto">
          <div className="bg-white dark:bg-[#0c101c] w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white font-bold flex items-center justify-center text-base">
                  {selectedStudent.displayName ? selectedStudent.displayName.charAt(0) : 'S'}
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">
                    {selectedStudent.displayName || selectedStudent.username}
                  </h2>
                  <p className="text-xs text-slate-400">UID: {selectedStudent.uid}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Profile details grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#13192a] border border-slate-200/60 dark:border-slate-800/60">
                  <div className="text-[10px] text-slate-400">رصيد النقاط</div>
                  <div className="text-base font-black text-amber-600 dark:text-amber-400 mt-0.5">
                    {selectedStudent.totalPoints || 0}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#13192a] border border-slate-200/60 dark:border-slate-800/60">
                  <div className="text-[10px] text-slate-400">الامتحانات</div>
                  <div className="text-base font-black text-slate-800 dark:text-slate-200 mt-0.5">
                    {selectedStudent.examsCompleted || 0}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#13192a] border border-slate-200/60 dark:border-slate-800/60">
                  <div className="text-[10px] text-slate-400">المحافظة</div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {selectedStudent.city || 'غير محدد'}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#13192a] border border-slate-200/60 dark:border-slate-800/60">
                  <div className="text-[10px] text-slate-400">الفرع الأكاديمي</div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 flex items-center justify-between">
                    <span>{selectedStudent.branch || 'علمي'}</span>
                    <button
                      type="button"
                      disabled={isChangingBranch}
                      onClick={() => handleSwitchBranch(selectedStudent.branch === 'أدبي' ? 'علمي' : 'أدبي')}
                      className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer disabled:opacity-50"
                      title="تغيير الفرع الدراسي للطالب"
                    >
                      {isChangingBranch ? '...' : `تحويل لـ ${selectedStudent.branch === 'أدبي' ? 'علمي' : 'أدبي'}`}
                    </button>
                  </div>
                </div>
              </div>

              {/* Administrative Action Bar */}
              <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-blue-900 dark:text-blue-300">
                  إجراءات المشرف على حساب الطالب:
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setIsAdjustPointsOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Trophy className="w-3.5 h-3.5" />
                    <span>تعديل النقاط يدويًا</span>
                  </button>

                  <button
                    onClick={() => {
                      setNotifTitle('');
                      setNotifMessage('');
                      setIsSendNotifOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="إرسال إشعار / رسالة خاصة تظهر للطالب في حسابه"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>إرسال إشعار</span>
                  </button>

                  <button
                    onClick={handleToggleChatDisabled}
                    disabled={isTogglingChat}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs ${
                      (selectedStudent as any).chatDisabled
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        : 'bg-slate-700 hover:bg-slate-800 text-white'
                    }`}
                    title="التحكم بصلاحية إرسال الرسائل الخاصة للطلبة الآخرين"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>
                      {(selectedStudent as any).chatDisabled ? 'تفعيل الدردشة' : 'إيقاف الدردشة'}
                    </span>
                  </button>

                  <button
                    onClick={() => setIsDisableOpen(true)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs ${
                      (selectedStudent as any).accountDisabled
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>
                      {(selectedStudent as any).accountDisabled ? 'إعادة التفعيل' : 'تجميد الحساب'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Student Exam History */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  <span>سجل محاولات الامتحانات للطالب</span>
                </h3>

                {isLoadingAttempts ? (
                  <div className="text-center py-6 text-slate-400 text-xs">
                    جارٍ تحميل سجل محاولات الطالب...
                  </div>
                ) : studentAttempts.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                    لا توجد محاولات امتحانية مسجلة لهذا الطالب حتى الآن.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                    {studentAttempts.map((att) => (
                      <div key={att.id} className="p-3 text-xs flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-800 dark:text-slate-200">
                            {att.examTitle}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {att.submittedAt ? new Date(att.submittedAt).toLocaleString('ar-EG') : 'قيد التقدم'}
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="font-black text-slate-900 dark:text-white">
                            {att.score || 0} / {att.totalPoints || 100}
                          </span>
                          <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            {att.percentage || 0}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Points Dialog */}
      {isAdjustPointsOpen && selectedStudent && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0c101c] w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xl">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  <span>تعديل رصيد النقاط</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  الطالب: <strong className="text-slate-800 dark:text-slate-200">{selectedStudent.displayName || selectedStudent.username}</strong>
                </p>
              </div>
              <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-3 py-1 rounded-xl text-xs font-black text-center">
                <span className="block text-[10px] text-slate-400">الرصيد الحالي</span>
                {selectedStudent.totalPoints || 0} نقطة
              </div>
            </div>

            {adjustError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl flex items-start gap-2.5 text-xs text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{adjustError}</span>
              </div>
            )}

            <form onSubmit={handleAdjustPointsSubmit} className="space-y-4">
              {/* Operation Mode Tabs */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1.5">
                  نوع العملية
                </label>
                <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 dark:bg-[#13192a] rounded-2xl border border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustMode('add');
                      if (adjustInputValue === 0) setAdjustInputValue(50);
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-black transition-all ${
                      adjustMode === 'add'
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>إضافة (+)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAdjustMode('deduct');
                      if (adjustInputValue === 0) setAdjustInputValue(50);
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-black transition-all ${
                      adjustMode === 'deduct'
                        ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <MinusCircle className="w-3.5 h-3.5" />
                    <span>خصم (-)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjustMode('reset')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-black transition-all ${
                      adjustMode === 'reset'
                        ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>تصفير (0)</span>
                  </button>
                </div>
              </div>

              {/* Amount input & presets if not reset */}
              {adjustMode !== 'reset' ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      {adjustMode === 'add' ? 'مقدار النقاط للإضافة' : 'مقدار النقاط المخصومة (يُحسب بالسالب تلقائياً)'}
                    </label>
                    <span className="text-[10px] text-slate-400">أدخل قيمة موجبة عادية</span>
                  </div>

                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-black text-slate-400">
                      نقطة
                    </span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={adjustInputValue}
                      onChange={(e) => setAdjustInputValue(Math.max(1, Number(e.target.value) || 0))}
                      className="w-full pl-12 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#13192a] text-sm font-black focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  {/* Quick Presets */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-bold text-slate-500 ml-1">قيم سريعة:</span>
                    {[10, 25, 50, 100, 250, 500].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAdjustInputValue(preset)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                          adjustInputValue === preset
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent'
                            : 'bg-slate-100 dark:bg-[#13192a] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                        }`}
                      >
                        {adjustMode === 'add' ? `+${preset}` : `-${preset}`}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl text-xs space-y-1">
                  <p className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
                    <span>تأكيد تصفير الرصيد بالكامل</span>
                  </p>
                  <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                    سيتم خصم كامل نقاط الطالب ({selectedStudent.totalPoints || 0} نقطة) ليعود رصيده إلى 0 نقطة تماماً.
                  </p>
                </div>
              )}

              {/* Real-time Calculation Preview Card */}
              <div className="p-3 bg-slate-50 dark:bg-[#13192a] rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="block text-[10px] text-slate-500 font-bold">الرصيد الحالي</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">{selectedStudent.totalPoints || 0}</span>
                </div>
                <div className="text-center font-black">
                  <span className="block text-[10px] text-slate-500">التغيير</span>
                  <span className={getEffectiveDelta() > 0 ? 'text-emerald-500' : getEffectiveDelta() < 0 ? 'text-rose-500' : 'text-slate-400'}>
                    {getEffectiveDelta() > 0 ? `+${getEffectiveDelta()}` : getEffectiveDelta()}
                  </span>
                </div>
                <div className="text-left font-black">
                  <span className="block text-[10px] text-slate-500 font-bold">الرصيد المتوقع</span>
                  <span className="text-sm font-black text-slate-900 dark:text-white">
                    {Math.max(0, (selectedStudent.totalPoints || 0) + getEffectiveDelta())} نقطة
                  </span>
                </div>
              </div>

              {/* Reason textarea */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  سبب التعديل (إلزامي للرقابة والتدقيق الإداري) *
                </label>
                <textarea
                  rows={2}
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder={
                    adjustMode === 'add'
                      ? 'مثال: مكافأة التفوق في امتحان الفيزياء الشهرية...'
                      : adjustMode === 'deduct'
                      ? 'مثال: تصحيح خطأ في احتساب محاولة مكررة...'
                      : 'مثال: إعادة تعيين الرصيد مع انطلاق الفصل الدراسي الجديد...'
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#13192a] text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdjustPointsOpen(false);
                    setAdjustError(null);
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isAdjusting}
                  className={`px-5 py-2 rounded-xl text-white text-xs font-black shadow-lg transition-all flex items-center gap-1.5 ${
                    adjustMode === 'add'
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                      : adjustMode === 'deduct'
                      ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
                      : 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20'
                  }`}
                >
                  {isAdjusting ? (
                    'جارٍ الحفظ...'
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        {adjustMode === 'add'
                          ? 'تأكيد إضافة النقاط'
                          : adjustMode === 'deduct'
                          ? 'تأكيد خصم النقاط'
                          : 'تأكيد تصفير الرصيد'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Disable / Freeze Account Dialog */}
      {isDisableOpen && selectedStudent && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-white dark:bg-[#0c101c] w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-black text-red-600 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" />
              <span>
                {(selectedStudent as any).accountDisabled ? 'إعادة تفعيل الحساب' : 'تأكيد تجميد حساب الطالب'}
              </span>
            </h3>

            <p className="text-xs text-slate-500">
              {(selectedStudent as any).accountDisabled
                ? 'سيتمكن الطالب من الدخول مجدداً وتقديم الامتحانات.'
                : 'عند تجميد الحساب، لن يتمكن الطالب من تقديم الامتحانات أو استخدام ميزات المنصة.'}
            </p>

            {!(selectedStudent as any).accountDisabled && (
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  سبب التجميد الإداري *
                </label>
                <textarea
                  rows={2}
                  required
                  value={disableReason}
                  onChange={(e) => setDisableReason(e.target.value)}
                  placeholder="اكتب سبب التجميد للتوثيق..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#13192a] text-xs"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDisableOpen(false)}
                className="px-3 py-1.5 text-xs font-bold text-slate-500"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isTogglingDisable}
                onClick={handleToggleDisable}
                className={`px-4 py-1.5 rounded-xl text-white text-xs font-bold ${
                  (selectedStudent as any).accountDisabled ? 'bg-emerald-600' : 'bg-red-600'
                }`}
              >
                {isTogglingDisable ? 'جارٍ التنفيذ...' : 'تأكيد الإجراء'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Direct Student Notification Dialog */}
      {isSendNotifOpen && selectedStudent && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-[#0c101c] w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  إرسال إشعار مباشر للطالب
                </h3>
              </div>
              <button
                onClick={() => setIsSendNotifOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              سيصل هذا الإشعار فوراً إلى جرس التنبيهات الخاص بالطالب ({selectedStudent.displayName || selectedStudent.username}).
            </p>

            <form onSubmit={handleSendDirectNotification} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  عنوان الإشعار *
                </label>
                <input
                  type="text"
                  required
                  value={notifTitle}
                  onChange={(e) => setNotifTitle(e.target.value)}
                  placeholder="مثال: تنبيه بخصوص موعد الامتحان التجريبي"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#13192a] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  نص الرسالة / الإشعار *
                </label>
                <textarea
                  rows={3}
                  required
                  value={notifMessage}
                  onChange={(e) => setNotifMessage(e.target.value)}
                  placeholder="اكتب تفاصيل الرسالة الموجهة للطالب..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#13192a] text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSendNotifOpen(false)}
                  className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSendingNotif}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingNotif ? 'جارٍ الإرسال...' : 'إرسال الإشعار'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Broadcast Notification Dialog */}
      {isBroadcastOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-[#0c101c] w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-blue-600 animate-pulse" />
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  بث إشعار عام لجميع الطلاب
                </h3>
              </div>
              <button
                onClick={() => setIsBroadcastOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 text-xs">
              سيتم إرسال هذا الإشعار تلقائياً إلى صناديق إشعارات جميع الطلاب المسجلين ({students.length} طالب) مع تنبيه جرس أحمر فورياً.
            </div>

            <form onSubmit={handleBroadcastSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  عنوان الإشعار العام *
                </label>
                <input
                  type="text"
                  required
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  placeholder="مثال: إطلاق بنك امتحانات توجيهي 2009 الجديد"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#13192a] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  نص الإشعار والتفاصيل *
                </label>
                <textarea
                  rows={3}
                  required
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="اكتب نص الإشعار بالتفصيل..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#13192a] text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBroadcastOpen(false)}
                  className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isBroadcasting}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isBroadcasting ? 'جارٍ البث للجميع...' : 'تأكيد البث للجميع'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
