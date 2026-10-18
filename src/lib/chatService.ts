import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  arrayUnion,
  limit,
} from 'firebase/firestore';
import { db, sanitizeFirestoreData } from './firebase';
import { sendAppNotification } from './notificationService';
import type { ChatConversation, ChatMessage, UserProfile } from '../types';

/**
 * Generate a deterministic Chat ID for two participants
 */
export function getChatIdForUsers(uid1: string, uid2: string): string {
  const sorted = [uid1, uid2].sort();
  return `chat_${sorted[0]}_${sorted[1]}`;
}

/**
 * Get or create a 1:1 chat conversation between two users
 */
export async function getOrCreateChatConversation(
  currentUser: { uid: string; displayName: string; username: string; photoURL?: string; branch?: string },
  targetUser: { uid: string; displayName: string; username: string; photoURL?: string; branch?: string }
): Promise<ChatConversation> {
  const chatId = getChatIdForUsers(currentUser.uid, targetUser.uid);
  const chatRef = doc(db, 'chats', chatId);
  const snap = await getDoc(chatRef);

  if (snap.exists()) {
    return { ...snap.data(), id: snap.id } as ChatConversation;
  }

  const now = new Date().toISOString();
  const newChat: ChatConversation = {
    id: chatId,
    participants: [currentUser.uid, targetUser.uid],
    participantDetails: {
      [currentUser.uid]: {
        displayName: currentUser.displayName || currentUser.username || 'طالب',
        username: currentUser.username || 'student',
        photoURL: currentUser.photoURL || '',
        branch: currentUser.branch || 'علمي',
      },
      [targetUser.uid]: {
        displayName: targetUser.displayName || targetUser.username || 'طالب',
        username: targetUser.username || 'student',
        photoURL: targetUser.photoURL || '',
        branch: targetUser.branch || 'علمي',
      },
    },
    lastMessage: 'بدء المحادثة',
    lastMessageAt: now,
    lastSenderId: currentUser.uid,
    unreadCount: {
      [currentUser.uid]: 0,
      [targetUser.uid]: 0,
    },
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(chatRef, sanitizeFirestoreData(newChat));
  return newChat;
}

/**
 * Subscribe to realtime messages in a chat conversation
 */
export function subscribeToChatMessages(
  chatId: string,
  callback: (messages: ChatMessage[]) => void
): () => void {
  const msgsRef = collection(db, 'chats', chatId, 'messages');
  const q = query(msgsRef, orderBy('createdAt', 'asc'), limit(100));

  return onSnapshot(
    q,
    (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach((d) => msgs.push({ ...d.data(), id: d.id } as ChatMessage));
      callback(msgs);
    },
    (err) => {
      console.warn('[chatService] Messages subscription warning:', err);
      callback([]);
    }
  );
}

/**
 * Mark a conversation as read by the user: zeroes their unread counter
 */
export async function markChatAsRead(chatId: string, userId: string): Promise<void> {
  if (!chatId || !userId) return;
  try {
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
      [`unreadCount.${userId}`]: 0,
      [`unreadCounts.${userId}`]: 0,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[chatService] markChatAsRead warning:', err);
  }
}

/**
 * Subscribe to all chat conversations involving the user
 */
export function subscribeToUserChats(
  userId: string,
  callback: (chats: ChatConversation[]) => void
): () => void {
  const colRef = collection(db, 'chats');
  const q = query(
    colRef,
    where('participants', 'array-contains', userId),
    orderBy('updatedAt', 'desc'),
    limit(50)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const chats: ChatConversation[] = [];
      snapshot.forEach((d) => {
        chats.push({ ...d.data(), id: d.id } as ChatConversation);
      });
      callback(chats);
    },
    (err) => {
      console.warn('[chatService] subscribeToUserChats error:', err);
      callback([]);
    }
  );
}

/**
 * Subscribe to the user's total unread messages count across all active conversations
 */
export function subscribeToUserUnreadMessageCount(
  userId: string,
  callback: (count: number) => void
): () => void {
  const colRef = collection(db, 'chats');
  const q = query(colRef, where('participants', 'array-contains', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      let totalUnread = 0;
      snapshot.forEach((d) => {
        const data = d.data() as any;
        const count = 
          (data.unreadCount && typeof data.unreadCount[userId] === 'number')
            ? data.unreadCount[userId]
            : (data.unreadCounts && typeof data.unreadCounts[userId] === 'number')
            ? data.unreadCounts[userId]
            : 0;
        totalUnread += count;
      });
      callback(totalUnread);
    },
    (err) => {
      console.warn('[chatService] subscribeToUserUnreadMessageCount warning:', err);
      callback(0);
    }
  );
}

/**
 * Send a message in a 1:1 chat
 */
export async function sendChatMessage(params: {
  chatId: string;
  senderProfile: UserProfile;
  receiverId: string;
  text: string;
}): Promise<void> {
  const cleanText = params.text.trim();
  if (!cleanText) return;

  // Check if sender has chat disabled by admin
  if (params.senderProfile.chatDisabled) {
    throw new Error('تم إيقاف ميزة الدردشة لحسابك من قِبل إدارة المنصة.');
  }

  const chatRef = doc(db, 'chats', params.chatId);
  const chatSnap = await getDoc(chatRef);
  let existingUnreadCount = 0;

  if (chatSnap.exists()) {
    const chatData = chatSnap.data() as any;
    if (chatData.blockedBy && chatData.blockedBy.includes(params.receiverId)) {
      throw new Error('لا يمكن إرسال الرسالة: تم حظرك بواسطة هذا المستخدم.');
    }
    const unreadObj = chatData.unreadCount || chatData.unreadCounts || {};
    existingUnreadCount = typeof unreadObj[params.receiverId] === 'number' ? unreadObj[params.receiverId] : 0;
  }

  const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const msgData: ChatMessage = {
    id: msgId,
    chatId: params.chatId,
    senderId: params.senderProfile.uid,
    senderName: params.senderProfile.displayName || params.senderProfile.username,
    senderPhoto: params.senderProfile.photoURL,
    text: cleanText,
    createdAt: now,
    read: false,
  };

  // 1. Write message doc
  await setDoc(doc(db, 'chats', params.chatId, 'messages', msgId), sanitizeFirestoreData(msgData));

  // 2. Update conversation doc: increments receiver's unread counter and keeps sender's at 0
  const nextReceiverCount = existingUnreadCount + 1;
  try {
    await setDoc(chatRef, {
      id: params.chatId,
      participants: [params.senderProfile.uid, params.receiverId],
      lastMessage: cleanText,
      lastMessageAt: now,
      lastSenderId: params.senderProfile.uid,
      unreadCount: {
        [params.senderProfile.uid]: 0,
        [params.receiverId]: nextReceiverCount,
      },
      unreadCounts: {
        [params.senderProfile.uid]: 0,
        [params.receiverId]: nextReceiverCount,
      },
      updatedAt: now,
    }, { merge: true });
  } catch (convErr) {
    console.warn('[chatService] Conversation summary update notice:', convErr);
  }

  // 3. Send realtime notification to receiver
  try {
    await sendAppNotification({
      recipientId: params.receiverId,
      senderId: params.senderProfile.uid,
      senderName: params.senderProfile.displayName || params.senderProfile.username || 'طالب',
      senderPhoto: params.senderProfile.photoURL,
      type: 'chat_message',
      title: `رسالة جديدة من ${params.senderProfile.displayName || params.senderProfile.username || 'طالب'}`,
      message: cleanText.length > 50 ? `${cleanText.substring(0, 50)}...` : cleanText,
      link: `chat:${params.chatId}`,
    });
  } catch (e) {
    console.warn('[chatService] Notification delivery warning:', e);
  }
}

/**
 * Report a chat to administrators
 */
export async function reportChatConversation(
  chatId: string,
  reporterId: string,
  reason: string
): Promise<void> {
  const chatRef = doc(db, 'chats', chatId);
  await updateDoc(chatRef, {
    reported: true,
    reportReason: reason.trim(),
    reportedBy: reporterId,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Block a user in a chat conversation
 */
export async function blockUserInChat(
  chatId: string,
  blockerId: string
): Promise<void> {
  const chatRef = doc(db, 'chats', chatId);
  await updateDoc(chatRef, {
    blockedBy: arrayUnion(blockerId),
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Admin: Toggle student chatDisabled status
 */
export async function toggleStudentChatDisabled(
  studentUid: string,
  disabled: boolean
): Promise<void> {
  const userRef = doc(db, 'users', studentUid);
  await updateDoc(userRef, {
    chatDisabled: disabled,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Admin: Fetch all reported chats for moderation
 */
export async function fetchReportedChats(): Promise<ChatConversation[]> {
  try {
    const colRef = collection(db, 'chats');
    const q = query(colRef, where('reported', '==', true));
    const snap = await getDocs(q);
    const list: ChatConversation[] = [];
    snap.forEach((d) => list.push({ ...d.data(), id: d.id } as ChatConversation));
    return list;
  } catch (err) {
    console.warn('[chatService] Error fetching reported chats:', err);
    return [];
  }
}
