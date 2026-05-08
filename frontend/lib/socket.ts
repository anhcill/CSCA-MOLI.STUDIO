import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';

let socket: Socket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

type MessageHandler = (message: unknown) => void;
type DeleteMessageHandler = (data: { messageId: number; senderId: number }) => void;
type UnreadCountHandler = (count: number) => void;
type NotificationHandler = (notification: unknown) => void;
type TypingHandler = (data: { userId: number; partnerId: number }) => void;

const messageHandlers = new Set<MessageHandler>();
const deleteMessageHandlers = new Set<DeleteMessageHandler>();
const unreadCountHandlers = new Set<UnreadCountHandler>();
const notificationHandlers = new Set<NotificationHandler>();
const typingHandlers = new Set<TypingHandler>();
const stoppedTypingHandlers = new Set<TypingHandler>();

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('token');
}

export function initSocket(): Socket {
  const token = getToken();
  if (!token) {
    console.warn('[Socket] No token found, skipping socket init');
    return null as unknown as Socket;
  }

  if (socket?.connected) {
    return socket;
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    timeout: 20000,
    autoConnect: true,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket?.id);
    reconnectAttempts = 0;
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
    if (reason === 'io server disconnect') {
      socket?.connect();
    }
  });

  socket.on('connect_error', (err) => {
    reconnectAttempts++;
    console.warn(`[Socket] Connection error (attempt ${reconnectAttempts}):`, err.message);
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('[Socket] Max reconnect attempts reached, giving up');
      socket?.disconnect();
    }
  });

  // ─── Message events ─────────────────────────────────────────────────────────
  socket.on('new_message', (message) => {
    messageHandlers.forEach(handler => handler(message));
  });

  socket.on('message_notification', (data) => {
    messageHandlers.forEach(handler => handler(data.message));
  });

  socket.on('message_deleted', (data: { messageId: number; senderId: number }) => {
    deleteMessageHandlers.forEach(handler => handler(data));
  });

  // ─── Unread count events ──────────────────────────────────────────────────
  socket.on('unread_count_update', (data: { count: number }) => {
    unreadCountHandlers.forEach(handler => handler(data.count));
  });

  // ─── Notification events ──────────────────────────────────────────────────
  socket.on('notification', (notification) => {
    notificationHandlers.forEach(handler => handler(notification));
  });

  // ─── Typing indicator events ───────────────────────────────────────────────
  socket.on('user_typing', (data: { userId: number; partnerId: number }) => {
    typingHandlers.forEach(handler => handler(data));
  });

  socket.on('user_stopped_typing', (data: { userId: number; partnerId: number }) => {
    stoppedTypingHandlers.forEach(handler => handler(data));
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}

export function isConnected(): boolean {
  return socket?.connected ?? false;
}

// ─── Room management ──────────────────────────────────────────────────────────

export function joinConversation(partnerId: number) {
  if (socket?.connected) {
    socket.emit('join_conversation', partnerId);
  }
}

export function leaveConversation(partnerId: number) {
  if (socket?.connected) {
    socket.emit('leave_conversation', partnerId);
  }
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

export function startTyping(partnerId: number) {
  if (socket?.connected) {
    socket.emit('typing_start', partnerId);
  }
}

export function stopTyping(partnerId: number) {
  if (socket?.connected) {
    socket.emit('typing_stop', partnerId);
  }
}

// ─── Subscribe / Unsubscribe ─────────────────────────────────────────────────

export function onNewMessage(handler: MessageHandler) {
  messageHandlers.add(handler);
  return () => messageHandlers.delete(handler);
}

export function onMessageDeleted(handler: DeleteMessageHandler) {
  deleteMessageHandlers.add(handler);
  return () => deleteMessageHandlers.delete(handler);
}

export function onUnreadCountUpdate(handler: UnreadCountHandler) {
  unreadCountHandlers.add(handler);
  return () => unreadCountHandlers.delete(handler);
}

export function onNotification(handler: NotificationHandler) {
  notificationHandlers.add(handler);
  return () => notificationHandlers.delete(handler);
}

export function onTyping(handler: TypingHandler) {
  typingHandlers.add(handler);
  return () => typingHandlers.delete(handler);
}

export function onStoppedTyping(handler: TypingHandler) {
  stoppedTypingHandlers.add(handler);
  return () => stoppedTypingHandlers.delete(handler);
}

// ─── Re-export types ──────────────────────────────────────────────────────────
export type { Socket };
