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
        displayName: currentUser.displayName || currentUser.username,
        username: currentUser.username,
        photoURL: currentUser.photoURL,
        branch: currentUser.branch,
      },
      [targetUser.uid]: {
        displayName: targetUser.displayName || targetUser.username,
        username: targetUser.username,
        photoURL: targetUser.photoURL,
        branch: targetUser.branch,
      },
    },
    lastMessage: 'بدء المحادثة',
    lastMessageAt: now,
    lastSenderId: currentUser.uid,
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
  if (chatSnap.exists()) {
    const chatData = chatSnap.data() as ChatConversation;
    if (chatData.blockedBy && chatData.blockedBy.includes(params.receiverId)) {
      throw new Error('لا يمكن إرسال الرسالة: تم حظرك بواسطة هذا المستخدم.');
    }
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

  // 2. Update conversation doc
  await updateDoc(chatRef, {
    lastMessage: cleanText,
    lastMessageAt: now,
    lastSenderId: params.senderProfile.uid,
    updatedAt: now,
  });

  // 3. Send realtime notification to receiver
  try {
    await sendAppNotification({
      recipientId: params.receiverId,
      senderId: params.senderProfile.uid,
      senderName: params.senderProfile.displayName || params.senderProfile.username,
      senderPhoto: params.senderProfile.photoURL,
      type: 'chat_message',
      title: `رسالة جديدة من ${params.senderProfile.displayName || params.senderProfile.username}`,
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
