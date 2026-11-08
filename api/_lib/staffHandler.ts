import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { firebaseAppConfig } from './config.js';
import { getRestDoc, patchRestDoc, getRestCollection } from './firestoreRest.js';

// Owner emails list
export function getOwnerEmails(): string[] {
  const envEmails = process.env.OWNER_EMAILS
    ? process.env.OWNER_EMAILS.split(',').map((e) => e.trim().toLowerCase())
    : [];
  const primaryAdmin = process.env.ADMIN_PRIMARY_EMAIL
    ? [process.env.ADMIN_PRIMARY_EMAIL.trim().toLowerCase()]
    : [];
  const hardcoded = ['omar88x99@gmail.com', 'omarkingx99@gmail.com', 'omarkingx98@gmail.com'];
  return Array.from(new Set([...envEmails, ...primaryAdmin, ...hardcoded].filter(Boolean)));
}

export function isOwnerEmail(email?: string | null): boolean {
  if (!email) return false;
  return getOwnerEmails().includes(email.trim().toLowerCase());
}

// Role display labels
export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'المشرف الأعلى (المالك)',
  admin: 'مدير النظام',
  moderator: 'مشرف المجتمع والرقابة',
  content_editor: 'محرر الامتحانات والأسئلة',
  community_manager: 'مدير المجتمع والإعلانات',
  support_agent: 'دعم الطلاب',
  student: 'طالب',
};

// Ensure Firebase Admin is initialized
function ensureAdminApp() {
  if (!getApps().length) {
    try {
      initializeApp({
        projectId: firebaseAppConfig.projectId,
      });
    } catch (e) {
      console.warn('[StaffHandler] Admin app init warning:', e);
    }
  }
}

// Get Firestore instance safely
function getAdminDb() {
  ensureAdminApp();
  try {
    return getFirestore();
  } catch {
    return null;
  }
}

/**
 * Handle /api/staff requests
 */
export async function handleStaffAction(
  action: string,
  body: any,
  caller: { uid: string; email?: string; role?: string; admin?: boolean }
) {
  ensureAdminApp();
  const callerEmail = caller.email?.toLowerCase().trim();
  const callerIsOwner = isOwnerEmail(callerEmail);
  const callerIsSuperAdmin = caller.role === 'super_admin' || callerIsOwner;
  const adminDb = getAdminDb();

  switch (action) {
    case 'bootstrap': {
      // Verifies caller is in OWNER_EMAILS and assigns super_admin claim
      if (!callerIsOwner) {
        return {
          status: 403,
          data: { error: 'غير مصرح: هذا البريد الإلكتروني ليس ضمن قائمة ملّاك النظام.' },
        };
      }

      try {
        const auth = getAuth();
        const userRecord = await auth.getUser(caller.uid);
        
        // Update custom claims
        await auth.setCustomUserClaims(caller.uid, {
          role: 'super_admin',
          admin: true,
          staff: true,
          updatedAt: Date.now(),
        });

        const now = new Date().toISOString();
        const staffData = {
          uid: caller.uid,
          email: callerEmail || userRecord.email || '',
          displayName: userRecord.displayName || 'Owner',
          role: 'super_admin',
          assignedBy: 'system_bootstrap',
          assignedByName: 'النظام التلقائي',
          assignedAt: now,
          active: true,
          updatedAt: now,
        };

        const badgeData = {
          uid: caller.uid,
          role: 'super_admin',
          label: ROLE_LABELS.super_admin,
          updatedAt: now,
        };

        if (adminDb) {
          await adminDb.collection('staff').doc(caller.uid).set(staffData, { merge: true });
          await adminDb.collection('staffBadges').doc(caller.uid).set(badgeData, { merge: true });
          await adminDb.collection('adminAuditLogs').add({
            adminId: caller.uid,
            adminName: userRecord.displayName || callerEmail || 'Owner',
            adminEmail: callerEmail || '',
            action: 'admin_bootstrap',
            targetType: 'staff',
            targetId: caller.uid,
            details: `تهيئة المشرف الأعلى بنجاح للمالك (${callerEmail})`,
            timestamp: now,
          });
        } else {
          await patchRestDoc(`staff/${caller.uid}`, staffData);
          await patchRestDoc(`staffBadges/${caller.uid}`, badgeData);
        }

        return {
          status: 200,
          data: {
            success: true,
            message: 'تم ترقية حسابك إلى المشرف الأعلى (super_admin) بنجاح.',
            role: 'super_admin',
          },
        };
      } catch (err: any) {
        console.error('[StaffHandler] Bootstrap error:', err);
        return { status: 500, data: { error: err?.message || 'فشل تهيئة حساب المالك.' } };
      }
    }

    case 'setRole': {
      // Only super_admin can assign or change team roles
      if (!callerIsSuperAdmin) {
        return {
          status: 403,
          data: { error: 'غير مصرح: المشرف الأعلى فقط يمكنه إدارة وتعيين صلاحيات فريق العمل.' },
        };
      }

      const { targetUid, role } = body || {};
      const allowedRoles = ['super_admin', 'admin', 'moderator', 'content_editor', 'community_manager', 'support_agent'];
      if (!targetUid || !role || !allowedRoles.includes(role)) {
        return {
          status: 400,
          data: { error: 'بيانات غير صالحة. يرجى تحديد المستخدم والدور المطلوب بدقة.' },
        };
      }

      // Prevent self-demotion
      if (targetUid === caller.uid && role !== 'super_admin') {
        return {
          status: 400,
          data: { error: 'لا يمكنك تخفيض رتبتك بنفسك حفاظًا على سلامة النظام.' },
        };
      }

      try {
        const auth = getAuth();
        const targetUser = await auth.getUser(targetUid);
        if (!targetUser) {
          return { status: 404, data: { error: 'المستخدم المطلوب غير موجود في سجلات النظام.' } };
        }

        // Email verified check (Requirement: target must have email verified)
        if (!targetUser.emailVerified && !isOwnerEmail(targetUser.email)) {
          return {
            status: 400,
            data: {
              error: 'يجب أن يكون البريد الإلكتروني للمستخدم مؤكدًا ومفعلًا قبل تعيينه في فريق العمل.',
            },
          };
        }

        // Set custom claims
        await auth.setCustomUserClaims(targetUid, {
          role,
          admin: role === 'admin' || role === 'super_admin',
          staff: true,
          updatedAt: Date.now(),
        });

        const now = new Date().toISOString();
        const staffDocData = {
          uid: targetUid,
          email: targetUser.email || '',
          displayName: targetUser.displayName || targetUser.email || 'عضو فريق',
          role,
          assignedBy: caller.uid,
          assignedByName: callerEmail || 'المشرف الأعلى',
          assignedAt: now,
          active: true,
          updatedAt: now,
        };

        const badgeData = {
          uid: targetUid,
          role,
          label: ROLE_LABELS[role] || 'عضو فريق',
          updatedAt: now,
        };

        if (adminDb) {
          await adminDb.collection('staff').doc(targetUid).set(staffDocData, { merge: true });
          await adminDb.collection('staffBadges').doc(targetUid).set(badgeData, { merge: true });
          await adminDb.collection('adminAuditLogs').add({
            adminId: caller.uid,
            adminName: callerEmail || 'Super Admin',
            adminEmail: callerEmail || '',
            action: 'assign_staff_role',
            targetType: 'staff',
            targetId: targetUid,
            details: `تعيين دور (${ROLE_LABELS[role]}) للمستخدم ${targetUser.email || targetUid}`,
            timestamp: now,
          });
        } else {
          await patchRestDoc(`staff/${targetUid}`, staffDocData);
          await patchRestDoc(`staffBadges/${targetUid}`, badgeData);
        }

        return {
          status: 200,
          data: {
            success: true,
            message: `تم تعيين الدور (${ROLE_LABELS[role]}) بنجاح.`,
            staffMember: staffDocData,
          },
        };
      } catch (err: any) {
        console.error('[StaffHandler] setRole error:', err);
        return { status: 500, data: { error: err?.message || 'فشل تعيين الدور للمستخدم.' } };
      }
    }

    case 'removeRole': {
      if (!callerIsSuperAdmin) {
        return {
          status: 403,
          data: { error: 'غير مصرح: المشرف الأعلى فقط يمكنه إزالة أعضاء الفريق.' },
        };
      }

      const { targetUid } = body || {};
      if (!targetUid) {
        return { status: 400, data: { error: 'معرّف المستخدم مطلوب.' } };
      }

      if (targetUid === caller.uid) {
        return { status: 400, data: { error: 'لا يمكنك إزالة نفسك من فريق العمل.' } };
      }

      try {
        const auth = getAuth();
        const targetUser = await auth.getUser(targetUid);

        // Reset custom claims
        await auth.setCustomUserClaims(targetUid, {
          role: 'student',
          admin: false,
          staff: false,
          updatedAt: Date.now(),
        });

        // Revoke refresh tokens so old privileges immediately expire
        await auth.revokeRefreshTokens(targetUid);

        const now = new Date().toISOString();
        if (adminDb) {
          await adminDb.collection('staff').doc(targetUid).set(
            {
              active: false,
              role: 'student',
              removedAt: now,
              removedBy: caller.uid,
              updatedAt: now,
            },
            { merge: true }
          );
          await adminDb.collection('staffBadges').doc(targetUid).delete();
          await adminDb.collection('adminAuditLogs').add({
            adminId: caller.uid,
            adminName: callerEmail || 'Super Admin',
            adminEmail: callerEmail || '',
            action: 'remove_staff_role',
            targetType: 'staff',
            targetId: targetUid,
            details: `إلغاء صلاحيات فريق العمل للمستخدم ${targetUser.email || targetUid}`,
            timestamp: now,
          });
        } else {
          await patchRestDoc(`staff/${targetUid}`, { active: false, role: 'student', removedAt: now });
        }

        return {
          status: 200,
          data: {
            success: true,
            message: 'تم إزالة العضو من فريق العمل وإلغاء صلاحياته بنجاح.',
          },
        };
      } catch (err: any) {
        console.error('[StaffHandler] removeRole error:', err);
        return { status: 500, data: { error: err?.message || 'فشل إزالة العضو من الفريق.' } };
      }
    }

    case 'listStaff': {
      // Any staff member can view the team roster
      if (!caller.admin && !callerIsSuperAdmin && !caller.role) {
        return { status: 403, data: { error: 'غير مصرح: يلزم أن تكون عضوًا في فريق العمل.' } };
      }

      try {
        if (adminDb) {
          const snapshot = await adminDb.collection('staff').where('active', '==', true).get();
          const members = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
          return { status: 200, data: { success: true, members } };
        } else {
          const collection = await getRestCollection('staff');
          const members = collection
            .map((c) => ({ id: c.id, ...c.data }))
            .filter((m: any) => m.active !== false);
          return { status: 200, data: { success: true, members } };
        }
      } catch (err: any) {
        console.error('[StaffHandler] listStaff error:', err);
        return { status: 500, data: { error: err?.message || 'تعذر جلب قائمة أعضاء الفريق.' } };
      }
    }

    case 'searchUser': {
      if (!callerIsSuperAdmin) {
        return { status: 403, data: { error: 'غير مصرح.' } };
      }
      const query = (body?.query || '').trim().toLowerCase();
      if (!query || query.length < 3) {
        return { status: 400, data: { error: 'يرجى إدخال 3 أحرف على الأقل للبحث.' } };
      }

      try {
        const auth = getAuth();
        let user: any = null;
        if (query.includes('@')) {
          try {
            user = await auth.getUserByEmail(query);
          } catch {
            user = null;
          }
        } else {
          try {
            user = await auth.getUser(query);
          } catch {
            user = null;
          }
        }

        if (!user) {
          return { status: 200, data: { success: true, users: [] } };
        }

        return {
          status: 200,
          data: {
            success: true,
            users: [
              {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || user.email,
                emailVerified: user.emailVerified,
                photoURL: user.photoURL,
                customClaims: user.customClaims || {},
              },
            ],
          },
        };
      } catch (err: any) {
        return { status: 500, data: { error: err?.message || 'فشل البحث عن المستخدم.' } };
      }
    }

    default:
      return { status: 400, data: { error: `إجراء غير معروف: ${action}` } };
  }
}

/**
 * Handle /api/reports requests
 */
export async function handleReportsAction(
  action: string,
  body: any,
  caller: { uid: string; email?: string; role?: string; admin?: boolean }
) {
  ensureAdminApp();
  const callerEmail = caller.email?.toLowerCase().trim();
  const callerIsOwner = isOwnerEmail(callerEmail);
  const callerIsSuperAdmin = caller.role === 'super_admin' || callerIsOwner;
  const isModeratorOrAbove =
    callerIsSuperAdmin || caller.admin || caller.role === 'moderator' || caller.role === 'support_agent';
  const adminDb = getAdminDb();

  switch (action) {
    case 'createReport': {
      // Any authenticated student can file a report/ticket
      const { targetType, targetId, targetName, chatId, type, category, subject, reason, description } =
        body || {};

      if (!type || !reason) {
        return { status: 400, data: { error: 'نوع البلاغ وسبب البلاغ مطلوبان.' } };
      }

      const now = new Date();
      const nowIso = now.toISOString();

      try {
        // Enforce Rate Limit: max 5 reports per day per student
        if (adminDb) {
          const oneDayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
          const userReportsSnap = await adminDb
            .collection('reports')
            .where('reporterId', '==', caller.uid)
            .where('createdAt', '>=', oneDayAgo)
            .get();

          if (userReportsSnap.size >= 5) {
            return {
              status: 429,
              data: {
                error: 'لقد بلغت الحد الأقصى للبلاغات اليومية (5 بلاغات خلال 24 ساعة). يرجى الانتظار لاحقًا.',
              },
            };
          }

          // Check if user already has an OPEN report on the same target
          if (targetId) {
            const openReportsSnap = await adminDb
              .collection('reports')
              .where('reporterId', '==', caller.uid)
              .where('targetId', '==', targetId)
              .where('status', 'in', ['open', 'under_review'])
              .get();

            if (!openReportsSnap.empty) {
              return {
                status: 400,
                data: {
                  error: 'لديك بالفعل بلاغ مفتوح قيد المراجعة حول هذا المستخدم أو العنصر.',
                },
              };
            }
          }
        }

        // Determine Priority: if target user has accumulated multiple blocks/reports in last 7 days, elevate priority
        let priority = 'normal';
        if (targetId && adminDb) {
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
          const targetReportsSnap = await adminDb
            .collection('reports')
            .where('targetId', '==', targetId)
            .where('createdAt', '>=', sevenDaysAgo)
            .get();

          if (targetReportsSnap.size >= 2) {
            priority = 'high';
          }
        }

        const reportRef = adminDb ? adminDb.collection('reports').doc() : null;
        const reportId = reportRef ? reportRef.id : `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        let evidenceCount = 0;
        // If chatId is provided, copy last 30 messages server-side to reports/{id}/evidence subcollection
        if (chatId && adminDb) {
          try {
            const chatMessagesSnap = await adminDb
              .collection('chats')
              .doc(chatId)
              .collection('messages')
              .orderBy('createdAt', 'desc')
              .limit(30)
              .get();

            if (!chatMessagesSnap.empty) {
              const evidenceCollection = adminDb.collection('reports').doc(reportId).collection('evidence');
              const batch = adminDb.batch();
              chatMessagesSnap.docs.forEach((docSnap) => {
                const msgData = docSnap.data();
                batch.set(evidenceCollection.doc(docSnap.id), {
                  messageId: docSnap.id,
                  senderId: msgData.senderId,
                  senderName: msgData.senderName,
                  text: msgData.text,
                  createdAt: msgData.createdAt,
                  archivedAt: nowIso,
                });
              });
              await batch.commit();
              evidenceCount = chatMessagesSnap.size;
            }
          } catch (chatErr) {
            console.warn('[StaffHandler] Failed to capture chat evidence:', chatErr);
          }
        }

        const reportData = {
          id: reportId,
          reporterId: caller.uid,
          reporterEmail: callerEmail || '',
          targetType: targetType || 'user',
          targetId: targetId || null,
          targetName: targetName || null,
          chatId: chatId || null,
          type,
          category: category || (type === 'support' ? 'support' : type === 'suggestion' ? 'suggestion' : type === 'complaint' ? 'complaint' : 'violation'),
          subject: subject || null,
          reason,
          description: description || null,
          evidenceCount,
          status: 'open',
          priority,
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        if (adminDb && reportRef) {
          await reportRef.set(reportData);

          // Confirmation notification for the reporter
          await adminDb.collection('notifications').add({
            recipientId: caller.uid,
            type: 'admin_direct_message',
            title: 'تم استلام بلاغك / طلبك',
            message: `شكرًا لتواصلك. تم استلام طلبك برقم مرجعي (${reportId.substring(0, 8)}) وسيقوم فريق الدعم والمشرفين بمراجعته في أقرب وقت.`,
            read: false,
            createdAt: nowIso,
          });
        } else {
          await patchRestDoc(`reports/${reportId}`, reportData);
        }

        return {
          status: 200,
          data: {
            success: true,
            reportId,
            message: 'تم تسجيل البلاغ / الطلب بنجاح وسيتم التعامل معه باهتمام.',
          },
        };
      } catch (err: any) {
        console.error('[StaffHandler] createReport error:', err);
        return { status: 500, data: { error: err?.message || 'فشل إرسال البلاغ.' } };
      }
    }

    case 'listReports': {
      if (!isModeratorOrAbove) {
        return { status: 403, data: { error: 'غير مصرح: يلزم صلاحية مشرف أو فريق الدعم.' } };
      }

      try {
        const { category, status, priority } = body || {};
        if (adminDb) {
          let queryRef: any = adminDb.collection('reports');
          if (category && category !== 'all') {
            queryRef = queryRef.where('category', '==', category);
          }
          if (status && status !== 'all') {
            queryRef = queryRef.where('status', '==', status);
          }
          if (priority && priority !== 'all') {
            queryRef = queryRef.where('priority', '==', priority);
          }

          const snapshot = await queryRef.orderBy('createdAt', 'desc').limit(100).get();
          const reports = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
          return { status: 200, data: { success: true, reports } };
        } else {
          const list = await getRestCollection('reports');
          const reports = list.map((c) => ({ id: c.id, ...c.data }));
          return { status: 200, data: { success: true, reports } };
        }
      } catch (err: any) {
        console.error('[StaffHandler] listReports error:', err);
        return { status: 500, data: { error: err?.message || 'فشل جلب قائمة البلاغات.' } };
      }
    }

    case 'getReportEvidence': {
      if (!isModeratorOrAbove) {
        return { status: 403, data: { error: 'غير مصرح.' } };
      }
      const { reportId } = body || {};
      if (!reportId || !adminDb) {
        return { status: 400, data: { error: 'معرف البلاغ مطلوب.' } };
      }

      try {
        const evidenceSnap = await adminDb
          .collection('reports')
          .doc(reportId)
          .collection('evidence')
          .orderBy('createdAt', 'asc')
          .get();

        const messages = evidenceSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        return { status: 200, data: { success: true, messages } };
      } catch (err: any) {
        return { status: 500, data: { error: err?.message || 'فشل جلب سجل المحادثة.' } };
      }
    }

    case 'updateReportStatus': {
      if (!isModeratorOrAbove) {
        return { status: 403, data: { error: 'غير مصرح.' } };
      }

      const { reportId, status, resolution, officialReply, internalNotes, assignedTo } = body || {};
      if (!reportId || !status) {
        return { status: 400, data: { error: 'معرف البلاغ والحالة مطلوبان.' } };
      }

      try {
        const nowIso = new Date().toISOString();
        const updateData: Record<string, any> = {
          status,
          updatedAt: nowIso,
        };
        if (resolution !== undefined) updateData.resolution = resolution;
        if (officialReply !== undefined) updateData.officialReply = officialReply;
        if (internalNotes !== undefined) updateData.internalNotes = internalNotes;
        if (assignedTo !== undefined) updateData.assignedTo = assignedTo;

        if (status === 'resolved' || status === 'dismissed') {
          updateData.resolvedAt = nowIso;
          updateData.resolvedBy = caller.uid;
        }

        if (adminDb) {
          const reportRef = adminDb.collection('reports').doc(reportId);
          const docSnap = await reportRef.get();
          if (!docSnap.exists) {
            return { status: 404, data: { error: 'البلاغ غير موجود.' } };
          }
          const prevData = docSnap.data();
          await reportRef.update(updateData);

          // If official reply is provided, send notification to the student reporter
          if (officialReply && prevData?.reporterId) {
            await adminDb.collection('notifications').add({
              recipientId: prevData.reporterId,
              type: 'admin_direct_message',
              title: 'رد رسمي بخصوص طلبك / بلاغك',
              message: officialReply,
              read: false,
              createdAt: nowIso,
            });
          }

          // Audit log
          await adminDb.collection('adminAuditLogs').add({
            adminId: caller.uid,
            adminName: callerEmail || 'Staff',
            adminEmail: callerEmail || '',
            action: 'resolve_report',
            targetType: 'report',
            targetId: reportId,
            details: `تحديث حالة البلاغ (${reportId}) إلى ${status}`,
            timestamp: nowIso,
          });
        } else {
          await patchRestDoc(`reports/${reportId}`, updateData);
        }

        return { status: 200, data: { success: true, message: 'تم تحديث حالة البلاغ بنجاح.' } };
      } catch (err: any) {
        console.error('[StaffHandler] updateReportStatus error:', err);
        return { status: 500, data: { error: err?.message || 'فشل تحديث البلاغ.' } };
      }
    }

    case 'takeModerationAction': {
      // Permissions: moderator, admin, super_admin
      if (!callerIsSuperAdmin && !caller.admin && caller.role !== 'moderator') {
        return {
          status: 403,
          data: { error: 'غير مصرح: المشرفون والمدراء فقط يملكون صلاحيات الإشراف والضبط.' },
        };
      }

      const { targetUid, actionType, reason, reportId } = body || {};
      const validActions = ['warning', 'mute_24h', 'mute_7d', 'chat_disable', 'unmute', 'account_disable', 'account_enable'];

      if (!targetUid || !actionType || !validActions.includes(actionType)) {
        return { status: 400, data: { error: 'إجراء غير صالح أو معرف المستخدم مفقود.' } };
      }

      try {
        const now = Date.now();
        const nowIso = new Date().toISOString();
        let expiresAt: string | null = null;
        const userUpdates: Record<string, any> = { updatedAt: nowIso };
        let notificationMsg = '';

        if (actionType === 'warning') {
          notificationMsg = `تنبيه إداري: تم رصد مخالفة لقواعد المجتمع واستخدام المنصة. السبب: "${reason || 'سلوك غير لائق'}". يرجى الالتزام بالمعايير الأخلاقية والتعليمية.`;
        } else if (actionType === 'mute_24h') {
          const expTime = new Date(now + 24 * 3600 * 1000).toISOString();
          expiresAt = expTime;
          userUpdates.mutedUntil = expTime;
          notificationMsg = `تم تقييد وإسكات حسابك عن إرسال الرسائل في المحادثات لمدة 24 ساعة. السبب: "${reason || 'مخالفة'}". ينتهي القيد بتاريخ: ${new Date(expTime).toLocaleString('ar-EG')}.`;
        } else if (actionType === 'mute_7d') {
          const expTime = new Date(now + 7 * 24 * 3600 * 1000).toISOString();
          expiresAt = expTime;
          userUpdates.mutedUntil = expTime;
          notificationMsg = `تم تقييد وإسكات حسابك عن إرسال الرسائل في المحادثات لمدة 7 أيام. السبب: "${reason || 'مخالفة متكررة'}". ينتهي القيد بتاريخ: ${new Date(expTime).toLocaleString('ar-EG')}.`;
        } else if (actionType === 'chat_disable') {
          userUpdates.chatDisabled = true;
          notificationMsg = `تم إيقاف ميزة الدردشة والمحادثات على حسابك بشكل كامل. السبب: "${reason || 'مخالفة شروط الاستخدام'}".`;
        } else if (actionType === 'unmute') {
          userUpdates.mutedUntil = null;
          userUpdates.chatDisabled = false;
          notificationMsg = 'تم رفع القيود والإسكات عن حسابك في الدردشة. نتمنى لك تجربة مفيدة وممتعة في مجتمع Arixon.';
        } else if (actionType === 'account_disable') {
          // Only admin or super_admin can disable whole account
          if (!callerIsSuperAdmin && !caller.admin) {
            return { status: 403, data: { error: 'تعطيل الحساب بالكامل يتطلب صلاحية مدير النظام أو المشرف الأعلى.' } };
          }
          userUpdates.accountDisabled = true;
          userUpdates.disabledReason = reason || 'مخالفة شروط الاستخدام';
          userUpdates.disabledAt = nowIso;
        } else if (actionType === 'account_enable') {
          if (!callerIsSuperAdmin && !caller.admin) {
            return { status: 403, data: { error: 'إعادة تفعيل الحساب يتطلب صلاحية مدير النظام أو المشرف الأعلى.' } };
          }
          userUpdates.accountDisabled = false;
          userUpdates.disabledReason = null;
          userUpdates.disabledAt = null;
        }

        if (adminDb) {
          await adminDb.collection('users').doc(targetUid).update(userUpdates);

          // Record in moderationActions
          await adminDb.collection('moderationActions').add({
            targetUid,
            moderatorId: caller.uid,
            moderatorName: callerEmail || 'مشرف',
            action: actionType,
            reason: reason || 'إجراء رقابي',
            reportId: reportId || null,
            timestamp: nowIso,
            expiresAt,
          });

          // Audit log
          await adminDb.collection('adminAuditLogs').add({
            adminId: caller.uid,
            adminName: callerEmail || 'Moderator',
            adminEmail: callerEmail || '',
            action: 'moderation_action',
            targetType: 'moderation',
            targetId: targetUid,
            details: `تطبيق إجراء (${actionType}) على المستخدم ${targetUid}: ${reason || ''}`,
            timestamp: nowIso,
          });

          // Send respectful, neutral notification to the user
          if (notificationMsg) {
            await adminDb.collection('notifications').add({
              recipientId: targetUid,
              type: 'admin_direct_message',
              title: actionType === 'warning' ? 'تنبيه إداري' : actionType === 'unmute' ? 'رفع القيد عن الحساب' : 'إجراء إداري رقابي',
              message: notificationMsg,
              read: false,
              createdAt: nowIso,
            });
          }
        } else {
          await patchRestDoc(`users/${targetUid}`, userUpdates);
        }

        return {
          status: 200,
          data: {
            success: true,
            message: 'تم تطبيق الإجراء الرقابي بنجاح وإشعار المستخدم.',
          },
        };
      } catch (err: any) {
        console.error('[StaffHandler] takeModerationAction error:', err);
        return { status: 500, data: { error: err?.message || 'فشل تطبيق الإجراء.' } };
      }
    }

    default:
      return { status: 400, data: { error: `إجراء غير معروف: ${action}` } };
  }
}
