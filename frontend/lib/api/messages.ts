import axios from '../utils/axios';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ForumMessage {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface Conversation {
  partner_id: number;
  username: string;
  full_name: string;
  avatar: string | null;
  avatar_url: string | null;
  role: string;
  is_vip: boolean;
  subscription_tier: string | null;
  last_message_id: number;
  last_message_content: string;
  is_read: boolean;
  sender_id: number;
  last_message_at: string;
  unread_count: number;
}

export interface MessagePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ─── API Calls ────────────────────────────────────────────────────────────────

/**
 * Lấy danh sách cuộc trò chuyện
 * @route GET /api/messages
 */
export const getConversations = async (page = 1, limit = 20) => {
  const res = await axios.get('/messages', { params: { page, limit } });
  return res.data as {
    success: boolean;
    data: { conversations: Conversation[]; pagination: MessagePagination };
  };
};

/**
 * Lấy tin nhắn với một người cụ thể
 * @route GET /api/messages/:userId
 */
export const getMessages = async (partnerId: number, page = 1, limit = 50) => {
  const res = await axios.get(`/messages/${partnerId}`, { params: { page, limit } });
  return res.data as {
    success: boolean;
    data: { messages: ForumMessage[]; pagination: MessagePagination };
  };
};

/**
 * Gửi tin nhắn
 * @route POST /api/messages
 */
export const sendMessage = async (receiverId: number, content: string) => {
  const res = await axios.post('/messages', { receiver_id: receiverId, content });
  return res.data as { success: boolean; data: { message: ForumMessage } };
};

/**
 * Đánh dấu tin nhắn đã đọc
 * @route PUT /api/messages/:id/read
 */
export const markAsRead = async (messageId: number) => {
  const res = await axios.put(`/messages/${messageId}/read`);
  return res.data as { success: boolean; message: string };
};

/**
 * Lấy số tin nhắn chưa đọc
 * @route GET /api/messages/unread-count
 */
export const getUnreadCount = async () => {
  const res = await axios.get('/messages/unread-count');
  return res.data as { success: boolean; data: { count: number } };
};

/**
 * Report một tin nhắn
 * @route POST /api/messages/:id/report
 */
export const reportMessage = async (messageId: number, reason: string) => {
  const res = await axios.post(`/messages/${messageId}/report`, { reason });
  return res.data as { success: boolean; message: string };
};
