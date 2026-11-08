import React, { useState, useEffect } from 'react';
import { useAdmin } from '../../context/AdminContext';
import { useAuth } from '../../context/AuthContext';
import { RoleBadge } from '../RoleBadge';
import { ROLE_CONFIGS } from '../../lib/roleService';
import type { StaffMember, StaffRole } from '../../types';

export const AdminTeamView: React.FC = () => {
  const { isSuperAdmin, adminRole } = useAdmin();
  const { user } = useAuth();

  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search & Add Staff Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<any | null>(null);
  const [selectedRole, setSelectedRole] = useState<StaffRole>('moderator');
  const [assigning, setAssigning] = useState(false);

  // Confirm Remove Modal
  const [removingMember, setRemovingMember] = useState<StaffMember | null>(null);
  const [removing, setRemoving] = useState(false);

  const fetchTeam = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await user?.getIdToken();
      const res = await fetch('/api/staff?action=listStaff', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل جلب قائمة الفريق');
      setStaffList(data.members || []);
    } catch (err: any) {
      setError(err.message || 'تعذر تحميل أعضاء الفريق.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, []);

  const handleSearchUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || searchQuery.trim().length < 3) {
      setError('يرجى إدخال 3 أحرف على الأقل للبحث (بريد إلكتروني أو معرّف UID).');
      return;
    }
    setSearching(true);
    setError(null);
    setFoundUser(null);
    try {
      const token = await user?.getIdToken();
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'searchUser',
          query: searchQuery.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل البحث عن المستخدم.');
      if (data.users && data.users.length > 0) {
        setFoundUser(data.users[0]);
      } else {
        setError('لم يتم العثور على أي حساب بهذا البريد الإلكتروني أو المعرف.');
      }
    } catch (err: any) {
      setError(err.message || 'فشل البحث عن المستخدم.');
    } finally {
      setSearching(false);
    }
  };

  const handleAssignRole = async () => {
    if (!foundUser) return;
    if (!foundUser.emailVerified && selectedRole !== 'super_admin') {
      setError('تنبيه: يجب أن يكون البريد الإلكتروني للمستخدم مؤكدًا ومفعلًا قبل إضافته للفريق.');
      return;
    }

    setAssigning(true);
    setError(null);
    try {
      const token = await user?.getIdToken();
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'setRole',
          targetUid: foundUser.uid,
          role: selectedRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل تعيين الدور.');

      setSuccessMsg(`تم تعيين المستخدم "${foundUser.email}" في دور (${ROLE_CONFIGS[selectedRole]?.labelAr}) بنجاح.`);
      setShowAddModal(false);
      setFoundUser(null);
      setSearchQuery('');
      fetchTeam();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تعيين الدور.');
    } finally {
      setAssigning(false);
    }
  };

  const handleRemoveRole = async () => {
    if (!removingMember) return;
    setRemoving(true);
    setError(null);
    try {
      const token = await user?.getIdToken();
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'removeRole',
          targetUid: removingMember.uid,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل إزالة العضو.');

      setSuccessMsg(`تم إزالة العضو "${removingMember.email}" من فريق العمل وإلغاء صلاحياته.`);
      setRemovingMember(null);
      fetchTeam();
    } catch (err: any) {
      setError(err.message || 'فشل إزالة العضو من الفريق.');
    } finally {
      setRemoving(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs max-w-xl mx-auto my-12">
        <div className="w-16 h-16 mx-auto mb-4 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center text-3xl">
          🔒
        </div>
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
          قسم مخصص للمشرف الأعلى (المالك) فقط
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          إدارة فريق العمل وتعيين الرتب والصلاحيات الحساسة متاحة فقط للمشرف الأعلى لضمان أمان النظام.
        </p>
      </div>
    );
  }

  const roleOptions: StaffRole[] = [
    'admin',
    'moderator',
    'content_editor',
    'community_manager',
    'support_agent',
    'super_admin',
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-50">
              فريق العمل والصلاحيات
            </h2>
            <RoleBadge role={adminRole} />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            إدارة أعضاء الإدارة والمشرفين والمحررين والدعم الفني عبر Custom Claims المشفرة
          </p>
        </div>

        <button
          onClick={() => {
            setShowAddModal(true);
            setFoundUser(null);
            setError(null);
          }}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all duration-200 flex items-center gap-2 shadow-xs"
        >
          <span>➕</span>
          <span>إضافة عضو جديد للفريق</span>
        </button>
      </div>

      {/* Notifications / Alerts */}
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

      {/* Roles Legend Card */}
      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800/80 text-xs space-y-2">
        <h4 className="font-bold text-slate-700 dark:text-slate-300">نظام الرتب والصلاحيات الصارمة في المنصة:</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {roleOptions.map((r) => {
            const conf = ROLE_CONFIGS[r];
            return (
              <div key={r} className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 dark:text-slate-200">{conf.icon} {conf.labelAr}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{r}</span>
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">{conf.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
            الأعضاء الحاليون ({staffList.length})
          </h3>
          <button
            onClick={fetchTeam}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold"
          >
            <span>🔄</span>
            <span>تحديث القائمة</span>
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="inline-block animate-spin text-2xl mb-2">⌛</div>
            <p className="text-sm">جارٍ تحميل بيانات الفريق...</p>
          </div>
        ) : staffList.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <p className="text-sm">لا يوجد أعضاء في فريق العمل حاليًا باستثناء المشرف الأعلى.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950/40 text-slate-600 dark:text-slate-400 text-xs font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">العضو</th>
                  <th className="px-5 py-3.5">الرتبة</th>
                  <th className="px-5 py-3.5">عُيّن بواسطة</th>
                  <th className="px-5 py-3.5">تاريخ التعيين</th>
                  <th className="px-5 py-3.5 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                {staffList.map((member) => {
                  const isCurrent = member.uid === user?.uid;
                  return (
                    <tr key={member.uid} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {member.displayName || member.email}
                            {isCurrent && (
                              <span className="mr-2 text-[10px] bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full">
                                حسابك
                              </span>
                            )}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">{member.email}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{member.uid}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <RoleBadge role={member.role} />
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-slate-400">
                        {member.assignedByName || member.assignedBy || 'المالك'}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-slate-400">
                        {member.assignedAt ? new Date(member.assignedAt).toLocaleDateString('ar-EG', { dateStyle: 'medium' }) : '-'}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {isCurrent ? (
                          <span className="text-xs text-slate-400 select-none">-</span>
                        ) : (
                          <button
                            onClick={() => setRemovingMember(member)}
                            className="px-2.5 py-1 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors font-bold"
                          >
                            إلغاء الصلاحيات
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Assign Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                إضافة عضو جديد إلى فريق العمل
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            {/* Step 1: Search */}
            <form onSubmit={handleSearchUser} className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                ابحث عن المستخدم بالبريد الإلكتروني أو معرّف UID:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="مثال: student@gmail.com أو معرّف المستخدم"
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={searching}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-colors"
                >
                  {searching ? 'جارٍ البحث...' : 'بحث'}
                </button>
              </div>
            </form>

            {/* Step 2: Display found user & select role */}
            {foundUser && (
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      {foundUser.displayName || foundUser.email}
                    </h4>
                    <p className="text-xs text-slate-500 font-mono">{foundUser.email}</p>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">{foundUser.uid}</p>
                  </div>
                  {foundUser.emailVerified ? (
                    <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold rounded-full border border-emerald-500/20">
                      ✓ البريد مؤكد
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[11px] font-bold rounded-full border border-rose-500/20">
                      ✕ البريد غير مؤكد
                    </span>
                  )}
                </div>

                {!foundUser.emailVerified && (
                  <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-700 dark:text-amber-300">
                    ⚠️ تنبيه: لا يمكن إضافة العضو للفريق حتى يقوم بتأكيد بريده الإلكتروني أولاً عبر الرابط المرسل لحسابه.
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    اختر الدور المطلوب منحه:
                  </label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as StaffRole)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  >
                    {roleOptions.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_CONFIGS[r].icon} {ROLE_CONFIGS[r].labelAr}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    {ROLE_CONFIGS[selectedRole]?.description}
                  </p>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setFoundUser(null)}
                    className="px-3 py-2 text-slate-600 dark:text-slate-400 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={handleAssignRole}
                    disabled={assigning || (!foundUser.emailVerified && selectedRole !== 'super_admin')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                  >
                    {assigning ? 'جارٍ التعيين...' : 'تأكيد ومنح الصلاحية'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Remove Confirmation Modal */}
      {removingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 mx-auto bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center text-2xl">
              ⚠️
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                تأكيد إلغاء صلاحيات العضو
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                هل أنت متأكد من رغبتك في إزالة العضو{' '}
                <strong className="text-slate-800 dark:text-slate-200">{removingMember.email}</strong> من دوره الحالي (
                {ROLE_CONFIGS[removingMember.role]?.labelAr})؟
                سيتم إلغاء Custom Claims فورًا وإلغاء جلساته النشطة وإعادته لحساب طالب عادي.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRemovingMember(null)}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={handleRemoveRole}
                disabled={removing}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-colors"
              >
                {removing ? 'جارٍ الإلغاء...' : 'نعم، إلغاء الصلاحيات'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTeamView;
