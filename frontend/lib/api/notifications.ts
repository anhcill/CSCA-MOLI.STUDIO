import axios from '../utils/axios';

export interface Notification {
  id: number;
  type: 'like_post' | 'comment_post' | 'reply_comment';
  post_id: number;
  comment_id: number | null;
  is_read: boolean;
  created_at: string;
  actor_id: number;
  actor_name: string;
  actor_avatar: string;
  post_preview: string;
}

export const getNotifications = async (limit = 30, offset = 0) => {
  const res = await axios.get(`/notifications?limit=${limit}&offset=${offset}`);
  return res.data as { success: boolean; data: Notification[]; unread_count: number };
};

export const getUnreadCount = async () => {
  const res = await axios.get('/notifications/unread-count');
  return res.data as { success: boolean; unread_count: number };
};

export const markRead = async (id: number) => {
  await axios.patch(`/notifications/${id}/read`);
};

export const markAllRead = async () => {
  await axios.patch('/notifications/read-all');
};
