import axios from '../utils/axios';

export interface StationChatMessage {
  id: string;
  userId?: number | null;
  sender: string;
  avatar?: string | null;
  badge: string;
  badgeColor: string;
  text: string;
  videoId?: string | null;
  createdAt: string;
}

export interface RoomChatMessage {
  id: string;
  roomCode: string;
  userId?: number | null;
  sender: string;
  avatar?: string | null;
  text: string;
  messageType: 'text' | 'cheer' | 'system';
  time: string;
  createdAt: string;
}

export interface BackendStudyRoom {
  id: string;
  code: string;
  name: string;
  hostName: string;
  hostAvatar?: string;
  subject: string;
  goal?: string;
  memberCount: number;
  maxMembers: number;
  isPrivate: boolean;
  createdAt: number;
}

/**
 * Lấy tin nhắn cộng đồng Trạm Động Lực từ SQL database
 */
export async function getStationChats(videoId?: string, limit = 50): Promise<StationChatMessage[]> {
  try {
    const params = new URLSearchParams();
    if (videoId) params.append('videoId', videoId);
    if (limit) params.append('limit', String(limit));

    const res = await axios.get(`/study-station/chats?${params.toString()}`);
    if (res.data?.success && Array.isArray(res.data?.data)) {
      return res.data.data;
    }
    return [];
  } catch (err) {
    console.error('getStationChats error:', err);
    return [];
  }
}

/**
 * Gửi tin nhắn mới lên Trạm Động Lực (lưu vào SQL)
 */
export async function sendStationChat(payload: {
  text: string;
  videoId?: string;
  senderName?: string;
  customBadge?: string;
}): Promise<StationChatMessage | null> {
  try {
    const res = await axios.post('/study-station/chats', payload);
    if (res.data?.success && res.data?.data) {
      return res.data.data;
    }
    return null;
  } catch (err) {
    console.error('sendStationChat error:', err);
    throw err;
  }
}

/**
 * Lấy danh sách phòng học từ SQL database
 */
export async function getStudyRooms(): Promise<BackendStudyRoom[]> {
  try {
    const res = await axios.get('/study-station/rooms');
    if (res.data?.success && Array.isArray(res.data?.data)) {
      return res.data.data;
    }
    return [];
  } catch (err) {
    console.error('getStudyRooms error:', err);
    return [];
  }
}

/**
 * Tạo phòng học mới lưu vào SQL database
 */
export async function createStudyRoomApi(payload: {
  name: string;
  subject: string;
  goal?: string;
  maxMembers?: number;
  isPrivate?: boolean;
  code?: string;
}): Promise<BackendStudyRoom | null> {
  try {
    const res = await axios.post('/study-station/rooms', payload);
    if (res.data?.success && res.data?.data) {
      return res.data.data;
    }
    return null;
  } catch (err) {
    console.error('createStudyRoomApi error:', err);
    throw err;
  }
}

/**
 * Lấy lịch sử chat phòng từ SQL database
 */
export async function getRoomMessages(roomCode: string): Promise<RoomChatMessage[]> {
  try {
    const res = await axios.get(`/study-station/rooms/${encodeURIComponent(roomCode)}/messages`);
    if (res.data?.success && Array.isArray(res.data?.data)) {
      return res.data.data;
    }
    return [];
  } catch (err) {
    console.error('getRoomMessages error:', err);
    return [];
  }
}

/**
 * Gửi tin nhắn vào phòng học (lưu vào SQL)
 */
export async function sendRoomMessage(
  roomCode: string,
  payload: { text: string; messageType?: string; senderName?: string }
): Promise<RoomChatMessage | null> {
  try {
    const res = await axios.post(
      `/study-station/rooms/${encodeURIComponent(roomCode)}/messages`,
      payload
    );
    if (res.data?.success && res.data?.data) {
      return res.data.data;
    }
    return null;
  } catch (err) {
    console.error('sendRoomMessage error:', err);
    throw err;
  }
}
