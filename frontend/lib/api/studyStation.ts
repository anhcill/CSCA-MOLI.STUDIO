import axios from '../utils/axios';

export interface StationVideoDTO {
  id: string;
  title: string;
  creator: string;
  creatorHandle: string;
  category: 'discipline' | 'exam' | 'tips' | 'scholarship' | string;
  tags: string[];
  likes: number;
  message: string;
  originalUrl?: string;
  createdBy?: number | null;
  isCustom?: boolean;
}

export interface StudyLeaderboardEntry {
  userId?: number | null;
  userName: string;
  userAvatar?: string | null;
  totalMinutes: number;
  sessionsCount: number;
  dreamUniversity?: string;
}

export interface StudyLeaderboardData {
  topToday: StudyLeaderboardEntry[];
  topWeek: StudyLeaderboardEntry[];
  myStats: {
    todayMinutes: number;
    todaySessions: number;
    weekMinutes: number;
  };
}

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

export interface RoomParticipantDTO {
  peerId: string;
  userId?: number | null;
  name: string;
  avatar?: string | null;
  isCameraOn: boolean;
  isMicOn: boolean;
  statusText: string;
  isHost?: boolean;
  cameraFrame?: string | null;
  lastSeen: number;
}

export interface BackendStudyRoom {
  id: string;
  code: string;
  name: string;
  hostId?: number | null;
  hostName: string;
  hostAvatar?: string;
  subject: string;
  goal?: string;
  memberCount: number;
  maxMembers: number;
  isPrivate: boolean;
  createdAt: number;
  participants?: RoomParticipantDTO[];
}

/**
 * Lấy danh sách video TikTok truyền động lực từ SQL database
 */
export async function getStationVideos(): Promise<StationVideoDTO[]> {
  try {
    const res = await axios.get('/study-station/videos');
    if (res.data?.success && Array.isArray(res.data?.data)) {
      return res.data.data;
    }
    return [];
  } catch (err) {
    console.error('getStationVideos error:', err);
    return [];
  }
}

/**
 * Thêm / chia sẻ video TikTok mới lên Trạm Động Lực (lưu vào SQL database)
 */
export async function createStationVideoApi(payload: {
  id: string;
  title: string;
  creator?: string;
  creatorHandle?: string;
  category?: string;
  tags?: string[];
  message?: string;
  originalUrl?: string;
}): Promise<StationVideoDTO | null> {
  try {
    const res = await axios.post('/study-station/videos', payload);
    if (res.data?.success && res.data?.data) {
      return res.data.data;
    }
    return null;
  } catch (err) {
    console.error('createStationVideoApi error:', err);
    return null;
  }
}

/**
 * Thả tim hoặc bỏ tim cho video động lực
 */
export async function likeStationVideoApi(
  videoId: string,
  delta: 1 | -1 = 1
): Promise<number | null> {
  try {
    const res = await axios.post(`/study-station/videos/${encodeURIComponent(videoId)}/like`, {
      delta,
    });
    if (res.data?.success && typeof res.data?.data?.likes === 'number') {
      return res.data.data.likes;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Xóa video động lực (dành cho người đăng hoặc Admin)
 */
export async function deleteStationVideoApi(videoId: string): Promise<boolean> {
  try {
    const res = await axios.delete(`/study-station/videos/${encodeURIComponent(videoId)}`);
    return Boolean(res.data?.success);
  } catch {
    return false;
  }
}

/**
 * Ghi nhận 1 phiên học Pomodoro hoàn thành và trả về thống kê cá nhân
 */
export async function recordStudySessionApi(payload: {
  durationMinutes: number;
  subject?: string;
  dreamUniversity?: string;
  userName?: string;
}): Promise<{ todayMinutes: number; todaySessions: number; weekMinutes: number } | null> {
  try {
    const res = await axios.post('/study-station/sessions', payload);
    if (res.data?.success && res.data?.data) {
      return res.data.data;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Lấy bảng xếp hạng học viên chăm chỉ (24h qua và 7 ngày qua)
 */
export async function getStudyLeaderboardApi(): Promise<StudyLeaderboardData | null> {
  try {
    const res = await axios.get('/study-station/leaderboard');
    if (res.data?.success && res.data?.data) {
      return res.data.data;
    }
    return null;
  } catch {
    return null;
  }
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
  hostName?: string;
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
 * Tìm phòng học theo mã phòng từ SQL database
 */
export async function getStudyRoomByCodeApi(roomCode: string): Promise<BackendStudyRoom | null> {
  try {
    const res = await axios.get(`/study-station/rooms/${encodeURIComponent(roomCode)}`);
    if (res.data?.success && res.data?.data) {
      return res.data.data;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Đồng bộ trạng thái thành viên thật trong phòng (heartbeat + live camera frame)
 */
export async function syncRoomPresenceApi(
  roomCode: string,
  payload: {
    peerId: string;
    name: string;
    avatar?: string | null;
    isCameraOn: boolean;
    isMicOn: boolean;
    statusText: string;
    isHost?: boolean;
    cameraFrame?: string | null;
  }
): Promise<{ memberCount: number; participants: RoomParticipantDTO[] } | null> {
  try {
    const res = await axios.post(
      `/study-station/rooms/${encodeURIComponent(roomCode)}/presence`,
      payload
    );
    if (res.data?.success && res.data?.data) {
      return res.data.data;
    }
    return null;
  } catch (err) {
    console.error('syncRoomPresenceApi error:', err);
    return null;
  }
}

/**
 * Rời phòng học
 */
export async function leaveStudyRoomApi(roomCode: string, peerId: string): Promise<void> {
  try {
    await axios.post(`/study-station/rooms/${encodeURIComponent(roomCode)}/leave`, { peerId });
  } catch {}
}

/**
 * Đóng / xóa phòng học (dành cho chủ phòng hoặc Admin)
 */
export async function deleteStudyRoomApi(roomCode: string): Promise<boolean> {
  try {
    const res = await axios.delete(`/study-station/rooms/${encodeURIComponent(roomCode)}`);
    return Boolean(res.data?.success);
  } catch (err) {
    console.error('deleteStudyRoomApi error:', err);
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
