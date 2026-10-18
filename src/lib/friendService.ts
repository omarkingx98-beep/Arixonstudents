import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  getDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db, sanitizeFirestoreData } from './firebase';
import { sendAppNotification } from './notificationService';
import type { FriendRequest, FriendItem, UserProfile } from '../types';

/**
 * Check friendship status between current user and target user
 */
export async function getFriendshipStatus(
  currentUserId: string,
  targetUserId: string
): Promise<'none' | 'friends' | 'pending_sent' | 'pending_received' | 'self'> {
  if (currentUserId === targetUserId) return 'self';

  try {
    const colRef = collection(db, 'friendRequests');
    // Check if user sent a request to target
    const q1 = query(
      colRef,
      where('senderId', '==', currentUserId),
      where('receiverId', '==', targetUserId)
    );
    const snap1 = await getDocs(q1);

    if (!snap1.empty) {
      const data = snap1.docs[0].data() as FriendRequest;
      if (data.status === 'accepted') return 'friends';
      if (data.status === 'pending') return 'pending_sent';
    }

    // Check if target sent a request to user
    const q2 = query(
      colRef,
      where('senderId', '==', targetUserId),
      where('receiverId', '==', currentUserId)
    );
    const snap2 = await getDocs(q2);

    if (!snap2.empty) {
      const data = snap2.docs[0].data() as FriendRequest;
      if (data.status === 'accepted') return 'friends';
      if (data.status === 'pending') return 'pending_received';
    }

    return 'none';
  } catch (err) {
    console.warn('[friendService] Error checking status:', err);
    return 'none';
  }
}

/**
 * Send a friend request
 */
export async function sendFriendRequest(
  senderProfile: UserProfile,
  targetUser: { uid: string; displayName: string; username: string }
): Promise<string> {
  const reqId = `freq_${[senderProfile.uid, targetUser.uid].sort().join('_')}`;
  const now = new Date().toISOString();

  const reqData: FriendRequest = {
    id: reqId,
    senderId: senderProfile.uid,
    senderName: senderProfile.displayName || senderProfile.username,
    senderUsername: senderProfile.username,
    senderPhoto: senderProfile.photoURL,
    senderBranch: senderProfile.branch,
    receiverId: targetUser.uid,
    receiverName: targetUser.displayName || targetUser.username,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(db, 'friendRequests', reqId), sanitizeFirestoreData(reqData));

  // Send automatic notification to receiver
  try {
    await sendAppNotification({
      recipientId: targetUser.uid,
      senderId: senderProfile.uid,
      senderName: senderProfile.displayName || senderProfile.username,
      senderPhoto: senderProfile.photoURL,
      type: 'friend_request',
      title: 'طلب صداقة جديد 👋',
      message: `أرسل لك ${senderProfile.displayName || senderProfile.username} طلب صداقة على أريكسون.`,
      metadata: { requestId: reqId },
    });
  } catch (e) {
    console.warn('[friendService] Notification error:', e);
  }

  return reqId;
}

/**
 * Accept a friend request
 */
export async function acceptFriendRequest(
  requestId: string,
  senderId: string,
  receiverProfile: UserProfile
): Promise<void> {
  const reqRef = doc(db, 'friendRequests', requestId);
  const now = new Date().toISOString();

  await updateDoc(reqRef, {
    status: 'accepted',
    updatedAt: now,
  });

  // Notify the original sender that the request was accepted
  try {
    await sendAppNotification({
      recipientId: senderId,
      senderId: receiverProfile.uid,
      senderName: receiverProfile.displayName || receiverProfile.username,
      senderPhoto: receiverProfile.photoURL,
      type: 'friend_accept',
      title: 'تم قبول طلب الصداقة ✨',
      message: `وافق ${receiverProfile.displayName || receiverProfile.username} على طلب الصداقة. يمكنك الآن مراسلته!`,
      metadata: { requestId },
    });
  } catch (e) {
    console.warn('[friendService] Notification error:', e);
  }
}

/**
 * Reject or cancel a friend request
 */
export async function rejectFriendRequest(requestId: string): Promise<void> {
  const reqRef = doc(db, 'friendRequests', requestId);
  await deleteDoc(reqRef);
}

/**
 * Get all friends for a user (accepted friend requests)
 */
export async function getFriendsList(userId: string): Promise<FriendItem[]> {
  try {
    const colRef = collection(db, 'friendRequests');
    const q1 = query(colRef, where('senderId', '==', userId), where('status', '==', 'accepted'));
    const q2 = query(colRef, where('receiverId', '==', userId), where('status', '==', 'accepted'));

    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    const friendUids: { uid: string; friendSince: string }[] = [];

    snap1.forEach((d) => {
      const data = d.data() as FriendRequest;
      friendUids.push({ uid: data.receiverId, friendSince: data.updatedAt || data.createdAt });
    });

    snap2.forEach((d) => {
      const data = d.data() as FriendRequest;
      friendUids.push({ uid: data.senderId, friendSince: data.updatedAt || data.createdAt });
    });

    const friends: FriendItem[] = [];
    for (const item of friendUids) {
      try {
        const uDoc = await getDoc(doc(db, 'users', item.uid));
        if (uDoc.exists()) {
          const u = uDoc.data() as UserProfile;
          friends.push({
            uid: item.uid,
            displayName: u.displayName || u.username,
            username: u.username,
            photoURL: u.photoURL,
            branch: u.branch,
            totalPoints: u.totalPoints || 0,
            friendSince: item.friendSince,
          });
        }
      } catch {}
    }

    return friends;
  } catch (err) {
    console.warn('[friendService] Error fetching friends list:', err);
    return [];
  }
}

/**
 * Get pending friend requests received by a user
 */
export async function getPendingReceivedFriendRequests(userId: string): Promise<FriendRequest[]> {
  try {
    const colRef = collection(db, 'friendRequests');
    const q = query(colRef, where('receiverId', '==', userId), where('status', '==', 'pending'));
    const snap = await getDocs(q);
    const list: FriendRequest[] = [];
    snap.forEach((d) => list.push({ ...d.data(), id: d.id } as FriendRequest));
    return list;
  } catch (err) {
    console.warn('[friendService] Error fetching pending requests:', err);
    return [];
  }
}

/**
 * Subscribe to the user's pending received friend requests count in real time
 */
export function subscribeToPendingFriendRequests(
  userId: string,
  callback: (count: number) => void
): () => void {
  const colRef = collection(db, 'friendRequests');
  const q = query(colRef, where('receiverId', '==', userId), where('status', '==', 'pending'));
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.size);
    },
    (err) => {
      console.warn('[friendService] subscribeToPendingFriendRequests error:', err);
      callback(0);
    }
  );
}
