'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  FiVideo,
  FiVideoOff,
  FiMic,
  FiMicOff,
  FiUsers,
  FiPlus,
  FiLogIn,
  FiLogOut,
  FiCopy,
  FiCheck,
  FiMessageSquare,
  FiSend,
  FiMaximize2,
  FiMinimize2,
  FiShield,
  FiAward,
  FiClock,
  FiSmile,
  FiX,
  FiRefreshCw,
  FiTrash2,
  FiEdit3,
  FiShare2,
} from 'react-icons/fi';
import { FaFire, FaCrown } from 'react-icons/fa';
import { useAuthStore } from '@/lib/store/authStore';
import {
  getStudyRooms,
  getStudyRoomByCodeApi,
  createStudyRoomApi,
  syncRoomPresenceApi,
  leaveStudyRoomApi,
  deleteStudyRoomApi,
  getRoomMessages,
  sendRoomMessage,
} from '@/lib/api/studyStation';

// ─── TYPES ───────────────────────────────────────────────────────────────────
export interface StudyRoom {
  id: string;
  code: string;
  name: string;
  hostId?: number | null;
  hostName: string;
  hostAvatar?: string | null;
  subject: string;
  memberCount: number;
  maxMembers: number;
  isPrivate: boolean;
  createdAt: number;
  goal?: string;
}

export interface RoomParticipant {
  id: string;
  userId?: number | null;
  name: string;
  avatar?: string | null;
  isMe: boolean;
  isHost?: boolean;
  isCameraOn: boolean;
  isMicOn: boolean;
  studyDurationMinutes: number;
  statusText: string;
}

export interface RoomChatMessage {
  id: string;
  sender: string;
  text: string;
  time: string;
  isSystem?: boolean;
}

const STATUS_PRESETS = [
  '🎯 Đang bấm giờ giải đề CSCA',
  '📚 Ôn 50 từ vựng Tiếng Trung',
  '🤫 Tự học im lặng 25/5 (Deep Work)',
  '🔥 Quyết tâm đạt 90+ điểm!',
];

export default function VirtualStudyRoom() {
  const { user } = useAuthStore();

  // Stable unique peerId for this browser tab session
  const [myPeerId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const existing = sessionStorage.getItem('moly:study_peer_id');
      if (existing) return existing;
      const generated = `peer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem('moly:study_peer_id', generated);
      return generated;
    }
    return `peer-${Date.now()}`;
  });

  const myDisplayName =
    user?.full_name || user?.username || user?.email?.split('@')[0] || 'Bạn (Sĩ tử CSCA)';
  const isAdmin = Boolean(user && (user.role === 'admin' || user.role === 'super_admin'));

  // Room list state (100% real data from SQL database — no mock rooms!)
  const [rooms, setRooms] = useState<StudyRoom[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState<boolean>(true);
  const [isRefreshingRooms, setIsRefreshingRooms] = useState<boolean>(false);
  const [activeRoom, setActiveRoom] = useState<StudyRoom | null>(null);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showJoinModal, setShowJoinModal] = useState<boolean>(false);
  const [isSubmittingRoom, setIsSubmittingRoom] = useState<boolean>(false);

  // Create Room Form
  const [newRoomName, setNewRoomName] = useState<string>('');
  const [newRoomSubject, setNewRoomSubject] = useState<string>('Toán học CSCA');
  const [newRoomGoal, setNewRoomGoal] = useState<string>('');
  const [newRoomMax, setNewRoomMax] = useState<number>(6);
  const [newRoomPrivate, setNewRoomPrivate] = useState<boolean>(false);

  // Join by Code Form
  const [inputRoomCode, setInputRoomCode] = useState<string>('');

  // Camera & Mic state (Real WebRTC Local MediaStream)
  const [isCameraOn, setIsCameraOn] = useState<boolean>(false);
  const [isMicOn, setIsMicOn] = useState<boolean>(false);
  const [isMirrored, setIsMirrored] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [myStatusText, setMyStatusText] = useState<string>('🎯 Đang bấm giờ giải đề CSCA');
  const [isEditingStatus, setIsEditingStatus] = useState<boolean>(false);
  const [myStudyMinutes, setMyStudyMinutes] = useState<number>(0);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Real Participants in the active room (from backend heartbeat)
  const [peers, setPeers] = useState<RoomParticipant[]>([]);

  // Chat state in room
  const [messages, setMessages] = useState<RoomChatMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [showChatPanel, setShowChatPanel] = useState<boolean>(true);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Copy feedback
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [roomToast, setRoomToast] = useState<string | null>(null);
  const [fullscreenTile, setFullscreenTile] = useState<string | null>(null);

  const showNotice = useCallback((msg: string) => {
    setRoomToast(msg);
    setTimeout(() => setRoomToast(null), 3200);
  }, []);

  // Purge any legacy localStorage mock rooms on mount
  useEffect(() => {
    try {
      localStorage.removeItem('moly:study_rooms');
    } catch {}
  }, []);

  // Load real rooms from SQL database
  const fetchRooms = useCallback(async (silent = false) => {
    if (!silent) setIsRefreshingRooms(true);
    try {
      const dbRooms = await getStudyRooms();
      const mapped: StudyRoom[] = dbRooms.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        hostId: r.hostId,
        hostName: r.hostName,
        hostAvatar: r.hostAvatar,
        subject: r.subject,
        goal: r.goal || '',
        memberCount: r.memberCount,
        maxMembers: r.maxMembers,
        isPrivate: r.isPrivate,
        createdAt: r.createdAt,
      }));
      setRooms(mapped);
    } catch (err) {
      console.error('Lỗi tải danh sách phòng học:', err);
    } finally {
      setIsLoadingRooms(false);
      setIsRefreshingRooms(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms(true);
    const interval = setInterval(() => fetchRooms(true), 8000);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  // Ensure video stream attaches reliably whenever <video> mounts or camera state changes
  useEffect(() => {
    if (localVideoRef.current && mediaStreamRef.current) {
      if (localVideoRef.current.srcObject !== mediaStreamRef.current) {
        localVideoRef.current.srcObject = mediaStreamRef.current;
      }
      if (isCameraOn) {
        localVideoRef.current.play().catch(() => {});
      }
    }
  }, [activeRoom, isCameraOn, fullscreenTile]);

  // Study duration counter while inside a room
  useEffect(() => {
    if (!activeRoom) {
      setMyStudyMinutes(0);
      return;
    }
    const timer = setInterval(() => {
      setMyStudyMinutes((prev) => prev + 1);
    }, 60000);
    return () => clearInterval(timer);
  }, [activeRoom]);

  // ─── WEBRTC CAMERA & MICROPHONE HANDLERS ────────────────────────────────────
  const startCamera = async (withAudio = false) => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Trình duyệt của bạn không hỗ trợ truy cập Camera.');
        return;
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: withAudio,
      });

      mediaStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        await localVideoRef.current.play().catch(() => {});
      }

      setIsCameraOn(true);
      setIsMicOn(withAudio);
    } catch (err: unknown) {
      console.warn('Camera access error:', err);
      setIsCameraOn(false);
      setCameraError(
        'Chưa cấp quyền Camera hoặc thiết bị không có sẵn. Bạn vẫn có thể học chung ở chế độ Avatar!'
      );
    }
  };

  const stopCamera = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    setIsCameraOn(false);
    setIsMicOn(false);
  }, []);

  const toggleCamera = async () => {
    if (isCameraOn) {
      if (mediaStreamRef.current) {
        const videoTracks = mediaStreamRef.current.getVideoTracks();
        videoTracks.forEach((track) => {
          track.stop();
        });
      }
      setIsCameraOn(false);
    } else {
      await startCamera(isMicOn);
    }
  };

  const toggleMic = async () => {
    if (!mediaStreamRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: isCameraOn,
          audio: true,
        });
        mediaStreamRef.current = stream;
        if (localVideoRef.current && isCameraOn) {
          localVideoRef.current.srcObject = stream;
        }
        setIsMicOn(true);
      } catch {
        setCameraError('Không thể truy cập Microphone. Vui lòng cấp quyền trên trình duyệt.');
      }
      return;
    }

    const audioTracks = mediaStreamRef.current.getAudioTracks();
    if (audioTracks.length > 0) {
      const nextState = !isMicOn;
      audioTracks.forEach((track) => {
        track.enabled = nextState;
      });
      setIsMicOn(nextState);
    } else {
      await startCamera(true);
    }
  };

  // Cleanup camera & room presence on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // ─── ROOM LIFECYCLE HANDLERS ────────────────────────────────────────────────
  const enterRoom = useCallback(
    async (room: StudyRoom, autoStartCam = true) => {
      setActiveRoom(room);
      setPeers([]);
      setMessages([
        {
          id: `sys-${Date.now()}`,
          sender: 'Hệ thống',
          text: `Chào mừng bạn vào phòng "${room.name}" (Mã: ${room.code}). Hãy giữ kỷ luật học tập nhé!`,
          time: 'Vừa xong',
          isSystem: true,
        },
      ]);
      if (autoStartCam) {
        startCamera(false);
      }
    },
    []
  );

  // Check URL query parameter `?room=CODE` on mount to auto-join shared room links
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const sharedRoomCode = params.get('room')?.trim().toUpperCase();
    if (!sharedRoomCode) return;

    let cancelled = false;
    (async () => {
      const found = await getStudyRoomByCodeApi(sharedRoomCode);
      if (!cancelled && found) {
        enterRoom(
          {
            id: found.id,
            code: found.code,
            name: found.name,
            hostId: found.hostId,
            hostName: found.hostName,
            hostAvatar: found.hostAvatar,
            subject: found.subject,
            goal: found.goal || '',
            memberCount: found.memberCount,
            maxMembers: found.maxMembers,
            isPrivate: found.isPrivate,
            createdAt: found.createdAt,
          },
          false
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enterRoom]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim() || isSubmittingRoom) return;

    setIsSubmittingRoom(true);
    try {
      const code = 'CSCA-' + Math.floor(1000 + Math.random() * 9000);
      const created = await createStudyRoomApi({
        name: newRoomName.trim(),
        subject: newRoomSubject,
        goal: newRoomGoal.trim() || 'Tập trung 100% hoàn thành mục tiêu',
        maxMembers: newRoomMax,
        isPrivate: newRoomPrivate,
        code,
        hostName: myDisplayName,
      });

      if (!created) {
        showNotice('⚠️ Không thể tạo phòng học lúc này, vui lòng thử lại.');
        return;
      }

      const newRoom: StudyRoom = {
        id: created.id,
        code: created.code,
        name: created.name,
        hostId: created.hostId ?? user?.id ?? null,
        hostName: created.hostName || myDisplayName,
        hostAvatar: created.hostAvatar || user?.avatar,
        subject: created.subject,
        memberCount: 1,
        maxMembers: created.maxMembers,
        isPrivate: created.isPrivate,
        createdAt: created.createdAt,
        goal: created.goal || '',
      };

      setRooms((prev) => [newRoom, ...prev.filter((r) => r.code !== newRoom.code)]);
      setShowCreateModal(false);
      setNewRoomName('');
      setNewRoomGoal('');

      await enterRoom(newRoom, true);
      showNotice(`🎉 Đã tạo phòng học "${newRoom.name}" (Mã: ${newRoom.code})`);
    } catch (err) {
      console.error('Lỗi tạo phòng học:', err);
      showNotice('⚠️ Không thể tạo phòng học, vui lòng thử lại.');
    } finally {
      setIsSubmittingRoom(false);
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = inputRoomCode.trim().toUpperCase();
    if (!cleaned) return;

    // 1. Check loaded rooms list first
    const localMatch = rooms.find((r) => r.code.toUpperCase() === cleaned);
    if (localMatch) {
      setShowJoinModal(false);
      setInputRoomCode('');
      enterRoom(localMatch, true);
      return;
    }

    // 2. Query SQL database by room code
    const remoteRoom = await getStudyRoomByCodeApi(cleaned);
    if (remoteRoom) {
      setShowJoinModal(false);
      setInputRoomCode('');
      enterRoom(
        {
          id: remoteRoom.id,
          code: remoteRoom.code,
          name: remoteRoom.name,
          hostId: remoteRoom.hostId,
          hostName: remoteRoom.hostName,
          hostAvatar: remoteRoom.hostAvatar,
          subject: remoteRoom.subject,
          goal: remoteRoom.goal || '',
          memberCount: remoteRoom.memberCount,
          maxMembers: remoteRoom.maxMembers,
          isPrivate: remoteRoom.isPrivate,
          createdAt: remoteRoom.createdAt,
        },
        true
      );
      return;
    }

    showNotice(`⚠️ Không tìm thấy phòng học nào có mã "${cleaned}".`);
  };

  const handleLeaveRoom = async () => {
    const codeToLeave = activeRoom?.code;
    stopCamera();
    setActiveRoom(null);
    setPeers([]);
    setFullscreenTile(null);
    if (codeToLeave) {
      await leaveStudyRoomApi(codeToLeave, myPeerId);
      fetchRooms(true);
    }
  };

  const handleDeleteRoom = async (room: StudyRoom, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const ok = await deleteStudyRoomApi(room.code);
      if (ok) {
        setRooms((prev) => prev.filter((r) => r.code !== room.code));
        if (activeRoom?.code === room.code) {
          stopCamera();
          setActiveRoom(null);
          setPeers([]);
        }
        showNotice(`🗑️ Đã đóng và xóa phòng "${room.name}"`);
      }
    } catch {
      showNotice('⚠️ Bạn không có quyền xóa phòng này hoặc đã xảy ra lỗi.');
    }
  };

  // ─── REAL-TIME PRESENCE HEARTBEAT & ROOM MESSAGES POLLING ───────────────────
  useEffect(() => {
    if (!activeRoom?.code) return;
    let isMounted = true;
    const roomCode = activeRoom.code;
    const isHostUser =
      (user?.id && activeRoom.hostId && Number(user.id) === Number(activeRoom.hostId)) ||
      activeRoom.hostName === myDisplayName;

    const syncPresenceAndMessages = async () => {
      try {
        const [presenceRes, roomMsgs] = await Promise.all([
          syncRoomPresenceApi(roomCode, {
            peerId: myPeerId,
            name: myDisplayName,
            avatar: user?.avatar || null,
            isCameraOn,
            isMicOn,
            statusText: myStatusText,
            isHost: Boolean(isHostUser),
          }),
          getRoomMessages(roomCode),
        ]);

        if (!isMounted) return;

        if (presenceRes?.participants) {
          const otherPeers: RoomParticipant[] = presenceRes.participants
            .filter((p) => p.peerId !== myPeerId)
            .map((p) => ({
              id: p.peerId,
              userId: p.userId,
              name: p.name,
              avatar: p.avatar,
              isMe: false,
              isHost: p.isHost,
              isCameraOn: p.isCameraOn,
              isMicOn: p.isMicOn,
              studyDurationMinutes: 1,
              statusText: p.statusText || 'Đang tập trung học',
            }));
          setPeers(otherPeers);
          setActiveRoom((prev) =>
            prev ? { ...prev, memberCount: Math.max(1, presenceRes.memberCount) } : prev
          );
        }

        if (roomMsgs.length > 0) {
          setMessages(
            roomMsgs.map((m) => ({
              id: m.id,
              sender:
                user?.id && m.userId === user.id ? `${m.sender} (Bạn)` : m.sender,
              text: m.text,
              time: m.time,
              isSystem: m.messageType === 'system',
            }))
          );
        }
      } catch (err) {
        console.error('Lỗi đồng bộ phòng học:', err);
      }
    };

    syncPresenceAndMessages();
    const interval = setInterval(syncPresenceAndMessages, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [
    activeRoom?.code,
    activeRoom?.hostId,
    activeRoom?.hostName,
    myPeerId,
    myDisplayName,
    user?.id,
    user?.avatar,
    isCameraOn,
    isMicOn,
    myStatusText,
  ]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const textToSend = chatInput.trim();
    if (!textToSend || !activeRoom?.code) return;

    setChatInput('');
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;

    const tempId = `msg-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        sender: `${myDisplayName} (Bạn)`,
        text: textToSend,
        time: timeStr,
      },
    ]);

    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);

    try {
      await sendRoomMessage(activeRoom.code, {
        text: textToSend,
        messageType: 'text',
        senderName: myDisplayName,
      });
    } catch (err) {
      console.error('Lỗi lưu tin nhắn phòng học:', err);
    }
  };

  const sendQuickCheer = async (emojiText: string) => {
    if (!activeRoom?.code) return;
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;

    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}`,
        sender: `${myDisplayName} (Bạn)`,
        text: emojiText,
        time: timeStr,
      },
    ]);

    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);

    try {
      await sendRoomMessage(activeRoom.code, {
        text: emojiText,
        messageType: 'cheer',
        senderName: myDisplayName,
      });
    } catch {}
  };

  const handleCopyRoomCode = () => {
    if (!activeRoom) return;
    navigator.clipboard.writeText(activeRoom.code).then(() => {
      setCopiedCode(true);
      showNotice(`📋 Đã sao chép mã phòng: ${activeRoom.code}`);
      setTimeout(() => setCopiedCode(false), 2000);
    });
  };

  const handleCopyInviteLink = () => {
    if (!activeRoom) return;
    const url = `${window.location.origin}/tram-dong-luc?room=${activeRoom.code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      showNotice('🔗 Đã sao chép link mời bạn bè vào phòng học!');
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const canManageRoom = (room: StudyRoom) => {
    if (isAdmin) return true;
    if (user?.id && room.hostId && Number(user.id) === Number(room.hostId)) return true;
    if (room.hostName === myDisplayName) return true;
    return false;
  };

  // ─── RENDER: INSIDE AN ACTIVE STUDY ROOM ────────────────────────────────────
  if (activeRoom) {
    const totalMembers = 1 + peers.length;

    return (
      <div className="rounded-3xl border border-violet-500/30 bg-slate-950/95 p-4 sm:p-6 shadow-[0_20px_70px_-15px_rgba(124,58,237,0.3)] backdrop-blur-xl">
        {/* Toast notification */}
        {roomToast && (
          <div className="fixed bottom-6 left-1/2 z-[180] -translate-x-1/2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-2xl">
            {roomToast}
          </div>
        )}

        {/* Room Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-600/30">
              <FiVideo className="text-xl" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-400 ring-1 ring-emerald-500/40">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE • {totalMembers}/{activeRoom.maxMembers} thành viên
                </span>
                <span className="rounded-full bg-violet-500/20 px-2.5 py-0.5 text-[10px] font-bold text-violet-300">
                  {activeRoom.subject}
                </span>
              </div>
              <h3 className="mt-1 text-base sm:text-lg font-extrabold text-white">
                {activeRoom.name}
              </h3>
              {activeRoom.goal && (
                <p className="text-xs text-slate-400">🎯 Mục tiêu: {activeRoom.goal}</p>
              )}
            </div>
          </div>

          {/* Room Code & Invite Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs">
              <span className="text-slate-400">Mã phòng:</span>
              <span className="font-mono font-black text-violet-300 tracking-wider">
                {activeRoom.code}
              </span>
              <button
                type="button"
                onClick={handleCopyRoomCode}
                className="ml-1 rounded-lg bg-white/10 p-1 text-slate-200 hover:bg-violet-600 hover:text-white transition-colors"
                title="Sao chép mã phòng"
              >
                {copiedCode ? (
                  <FiCheck className="text-emerald-400" />
                ) : (
                  <FiCopy className="text-xs" />
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopyInviteLink}
              className="flex items-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-600/20 px-3 py-2 text-xs font-bold text-violet-200 hover:bg-violet-600 hover:text-white transition-all"
            >
              {copiedLink ? <FiCheck className="text-emerald-300" /> : <FiShare2 />}
              <span>{copiedLink ? 'Đã chép link mời!' : 'Mời bạn học'}</span>
            </button>

            {canManageRoom(activeRoom) && (
              <button
                type="button"
                onClick={() => handleDeleteRoom(activeRoom)}
                className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-300 hover:bg-rose-600 hover:text-white transition-all"
                title="Đóng và xóa phòng học này"
              >
                <FiTrash2 />
                <span className="hidden sm:inline">Đóng phòng</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleLeaveRoom}
              className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-bold text-slate-200 hover:bg-rose-600 hover:text-white transition-all"
            >
              <FiLogOut />
              <span>Rời phòng</span>
            </button>
          </div>
        </div>

        {/* Status Bar: Edit current user study status */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-slate-400">Trạng thái của bạn:</span>
            {isEditingStatus ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={myStatusText}
                  onChange={(e) => setMyStatusText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setIsEditingStatus(false);
                  }}
                  maxLength={80}
                  className="rounded-xl border border-violet-500/50 bg-slate-900 px-2.5 py-1 text-xs text-white focus:outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setIsEditingStatus(false)}
                  className="rounded-lg bg-violet-600 px-2.5 py-1 text-[11px] font-bold text-white"
                >
                  Lưu
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingStatus(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-violet-500/15 px-2.5 py-1 text-xs font-bold text-violet-300 hover:bg-violet-500/25 transition-colors"
              >
                <span>{myStatusText}</span>
                <FiEdit3 className="text-[11px]" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {STATUS_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setMyStatusText(preset);
                  setIsEditingStatus(false);
                }}
                className={`rounded-lg px-2 py-0.5 text-[10px] font-semibold transition-all ${
                  myStatusText === preset
                    ? 'bg-violet-600 text-white'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Camera Error Notice */}
        {cameraError && (
          <div className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200 flex items-center justify-between">
            <span>💡 {cameraError}</span>
            <button
              type="button"
              onClick={() => setCameraError(null)}
              className="text-amber-300 hover:text-white ml-2"
            >
              <FiX />
            </button>
          </div>
        )}

        {/* Main Room Workspace: Camera Grid + Chat Sidebar */}
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* LEFT/CENTER: Video Grid */}
          <div className={`${showChatPanel ? 'lg:col-span-8' : 'lg:col-span-12'} space-y-4`}>
            <div
              className={`grid gap-4 ${
                fullscreenTile
                  ? 'grid-cols-1'
                  : peers.length === 0
                  ? 'grid-cols-1 sm:grid-cols-2'
                  : 'grid-cols-1 sm:grid-cols-2'
              }`}
            >
              {/* 1. LOCAL USER VIDEO CARD (YOU) */}
              {(!fullscreenTile || fullscreenTile === 'me') && (
                <div
                  className={`relative overflow-hidden rounded-2xl border-2 ${
                    isCameraOn ? 'border-emerald-500/60' : 'border-violet-500/40'
                  } bg-slate-900 aspect-video shadow-xl group`}
                >
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${
                      isMirrored ? 'scale-x-[-1]' : ''
                    } ${isCameraOn ? 'block' : 'hidden'}`}
                  />

                  {/* Fallback Avatar when Camera is Off */}
                  {!isCameraOn && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-violet-950/40 to-slate-900 p-4 text-center">
                      <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-2xl font-black text-white shadow-xl shadow-violet-600/30 ring-4 ring-white/10 overflow-hidden">
                        {user?.avatar ? (
                          <img
                            src={user.avatar}
                            alt={myDisplayName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          myDisplayName.charAt(0).toUpperCase()
                        )}
                        <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
                      </div>
                      <p className="mt-3 text-sm font-bold text-white">{myDisplayName} (Bạn)</p>
                      <p className="mt-0.5 text-xs text-violet-300">{myStatusText}</p>
                      <button
                        type="button"
                        onClick={toggleCamera}
                        className="mt-3 flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition-all"
                      >
                        <FiVideo /> Bật Camera học cùng mọi người
                      </button>
                    </div>
                  )}

                  {/* Top Overlay Badges */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-md">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      {myDisplayName} (Bạn)
                    </span>

                    <div className="flex items-center gap-1.5 pointer-events-auto">
                      {isCameraOn && (
                        <button
                          type="button"
                          onClick={() => setIsMirrored((prev) => !prev)}
                          className="rounded-lg bg-black/60 px-2 py-1 text-[10px] font-bold text-slate-200 hover:bg-black/80 backdrop-blur-md"
                          title="Lật gương camera"
                        >
                          Lật gương
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setFullscreenTile(fullscreenTile === 'me' ? null : 'me')
                        }
                        className="rounded-lg bg-black/60 p-1.5 text-white hover:bg-black/80 backdrop-blur-md"
                        title="Phóng to / Thu nhỏ"
                      >
                        {fullscreenTile === 'me' ? (
                          <FiMinimize2 className="text-xs" />
                        ) : (
                          <FiMaximize2 className="text-xs" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Bottom Overlay Info */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                    <span className="rounded-lg bg-black/60 px-2.5 py-1 text-[11px] text-emerald-300 font-medium backdrop-blur-md truncate max-w-[75%]">
                      {myStatusText} • {myStudyMinutes} phút
                    </span>
                    <span
                      className={`rounded-full p-1.5 backdrop-blur-md ${
                        isMicOn ? 'bg-emerald-600/80 text-white' : 'bg-rose-600/80 text-white'
                      }`}
                    >
                      {isMicOn ? (
                        <FiMic className="text-xs" />
                      ) : (
                        <FiMicOff className="text-xs" />
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* 2. REAL PEER CARDS (OR INVITE CARD WHEN ALONE) */}
              {peers.length === 0 && !fullscreenTile ? (
                <div className="relative overflow-hidden rounded-2xl border border-dashed border-violet-500/30 bg-gradient-to-br from-slate-900/90 via-violet-950/20 to-slate-900/90 aspect-video flex flex-col items-center justify-center p-5 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/15 border border-violet-500/30 text-violet-300 mb-3">
                    <FiUsers className="text-2xl" />
                  </div>
                  <h4 className="text-sm font-extrabold text-white">
                    Đang chờ bạn học tham gia cùng bạn
                  </h4>
                  <p className="mt-1 text-xs text-slate-400 max-w-xs leading-relaxed">
                    Chia sẻ mã phòng{' '}
                    <strong className="font-mono text-violet-300">{activeRoom.code}</strong> hoặc
                    gửi link mời để bạn bè cùng vào bật cam học chung!
                  </p>
                  <div className="mt-3.5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyRoomCode}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-white/10 transition-all"
                    >
                      <FiCopy /> Chép mã {activeRoom.code}
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyInviteLink}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-lg shadow-violet-600/30 hover:bg-violet-500 transition-all"
                    >
                      <FiShare2 /> Sao chép link mời
                    </button>
                  </div>
                </div>
              ) : (
                peers.map((peer) => {
                  if (fullscreenTile && fullscreenTile !== peer.id) return null;
                  return (
                    <div
                      key={peer.id}
                      className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900 aspect-video shadow-xl"
                    >
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950/50 to-slate-950 p-4 text-center">
                        <div className="relative">
                          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-xl font-black text-white shadow-lg overflow-hidden ring-2 ring-white/15">
                            {peer.avatar ? (
                              <img
                                src={peer.avatar}
                                alt={peer.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              peer.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-slate-900" />
                        </div>

                        <p className="mt-2.5 text-sm font-extrabold text-white flex items-center gap-1.5">
                          <span>{peer.name}</span>
                          {peer.isHost && (
                            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-black text-amber-300 border border-amber-500/30">
                              Chủ phòng
                            </span>
                          )}
                        </p>
                        <p className="mt-1 text-xs text-violet-300 font-medium">
                          {peer.statusText}
                        </p>
                      </div>

                      {/* Top Overlay */}
                      <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-md">
                          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                          {peer.name}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            setFullscreenTile(fullscreenTile === peer.id ? null : peer.id)
                          }
                          className="rounded-lg bg-black/60 p-1.5 text-white hover:bg-black/80 backdrop-blur-md"
                        >
                          {fullscreenTile === peer.id ? (
                            <FiMinimize2 className="text-xs" />
                          ) : (
                            <FiMaximize2 className="text-xs" />
                          )}
                        </button>
                      </div>

                      {/* Bottom Overlay */}
                      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                        <span className="rounded-lg bg-black/60 px-2.5 py-1 text-[11px] text-amber-300 font-medium backdrop-blur-md">
                          {peer.isCameraOn ? '📹 Đang bật Camera' : '🎧 Chế độ Tập trung'}
                        </span>
                        <span
                          className={`rounded-full p-1.5 backdrop-blur-md ${
                            peer.isMicOn
                              ? 'bg-emerald-600/80 text-white'
                              : 'bg-rose-600/80 text-white'
                          }`}
                        >
                          {peer.isMicOn ? (
                            <FiMic className="text-xs" />
                          ) : (
                            <FiMicOff className="text-xs" />
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Media Control Dock */}
            <div className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-white/10 bg-slate-900/90 p-3 shadow-inner">
              <button
                type="button"
                onClick={toggleCamera}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition-all active:scale-95 ${
                  isCameraOn
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500'
                    : 'bg-white/10 text-slate-200 hover:bg-white/15'
                }`}
              >
                {isCameraOn ? (
                  <FiVideo className="text-base" />
                ) : (
                  <FiVideoOff className="text-base text-rose-400" />
                )}
                <span>{isCameraOn ? 'Đang Bật Cam' : 'Bật Camera'}</span>
              </button>

              <button
                type="button"
                onClick={toggleMic}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition-all active:scale-95 ${
                  isMicOn
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500'
                    : 'bg-white/10 text-slate-200 hover:bg-white/15'
                }`}
              >
                {isMicOn ? (
                  <FiMic className="text-base" />
                ) : (
                  <FiMicOff className="text-base text-rose-400" />
                )}
                <span>{isMicOn ? 'Đang Bật Mic' : 'Tắt Mic (Im lặng)'}</span>
              </button>

              <button
                type="button"
                onClick={() => sendQuickCheer('🔥 Cố lên nhé mọi người ơi! Quyết tâm đỗ CSCA!')}
                className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/15 px-3.5 py-2.5 text-xs font-bold text-amber-300 hover:bg-amber-500/25 transition-all active:scale-95"
              >
                <FaFire className="text-orange-400" />
                <span>Cổ vũ phòng học</span>
              </button>

              <button
                type="button"
                onClick={() => setShowChatPanel((prev) => !prev)}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all ${
                  showChatPanel
                    ? 'bg-violet-600 text-white'
                    : 'bg-white/10 text-slate-300 hover:bg-white/15'
                }`}
              >
                <FiMessageSquare />
                <span>Chat ({messages.length})</span>
              </button>
            </div>
          </div>

          {/* RIGHT: Room Live Chat & Cheer Panel */}
          {showChatPanel && (
            <div className="lg:col-span-4 flex flex-col rounded-2xl border border-white/10 bg-slate-900/90 h-[440px] overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-2">
                  <FiMessageSquare className="text-violet-400" />
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-white">
                    Trò chuyện phòng học
                  </h4>
                </div>
                <span className="text-[11px] text-emerald-400 font-semibold">
                  {totalMembers} online
                </span>
              </div>

              {/* Messages List */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 text-xs">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-xl p-2.5 ${
                      msg.isSystem
                        ? 'bg-violet-950/40 border border-violet-500/20 text-violet-200 text-center italic'
                        : msg.sender.includes('(Bạn)')
                        ? 'bg-violet-600/20 border border-violet-500/30 text-white ml-4'
                        : 'bg-white/5 border border-white/5 text-slate-200 mr-4'
                    }`}
                  >
                    {!msg.isSystem && (
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                        <span className="font-bold text-violet-300">{msg.sender}</span>
                        <span>{msg.time}</span>
                      </div>
                    )}
                    <p className="leading-relaxed break-words">{msg.text}</p>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Quick Emoji Reactions */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 border-t border-white/5 bg-slate-950/50 overflow-x-auto">
                {['🔥 Cố lên!', '💪 Tập trung 100%', '☕ Nghỉ 5p nhé', '🎯 Giải xong 1 đề!'].map(
                  (quick) => (
                    <button
                      key={quick}
                      type="button"
                      onClick={() => sendQuickCheer(quick)}
                      className="shrink-0 rounded-lg bg-white/5 px-2 py-1 text-[10px] font-semibold text-slate-300 hover:bg-violet-600/30 hover:text-white transition-colors"
                    >
                      {quick}
                    </button>
                  )
                )}
              </div>

              {/* Input Form */}
              <form
                onSubmit={handleSendMessage}
                className="flex items-center gap-2 border-t border-white/10 p-2.5 bg-slate-950"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Nhắn tin khích lệ bạn cùng phòng..."
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-violet-600 p-2 text-white hover:bg-violet-500 transition-colors"
                >
                  <FiSend className="text-sm" />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── RENDER: LOBBY (LIST OF REAL ACTIVE ROOMS + CREATE / JOIN BUTTONS) ──────
  return (
    <div className="rounded-3xl border border-white/15 bg-gradient-to-b from-slate-900/90 to-slate-950/90 p-5 shadow-2xl backdrop-blur-md">
      {/* Toast notification */}
      {roomToast && (
        <div className="fixed bottom-6 left-1/2 z-[180] -translate-x-1/2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-2xl">
          {roomToast}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/30">
            <FiUsers className="text-lg" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-white">
                Phòng Tự Học Bật Cam (Study Together)
              </h3>
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black text-emerald-400 ring-1 ring-emerald-500/40">
                TRỰC TUYẾN
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Tạo phòng riêng, bật camera học cùng bạn bè hoặc tham gia các phòng đang mở
            </p>
          </div>
        </div>

        {/* Action Buttons: Refresh, Join by Code & Create Room */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchRooms(false)}
            disabled={isRefreshingRooms}
            className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/10 hover:text-white transition-all"
            title="Làm mới danh sách phòng học"
          >
            <FiRefreshCw className={`text-sm ${isRefreshingRooms ? 'animate-spin text-violet-400' : ''}`} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>

          <button
            type="button"
            onClick={() => setShowJoinModal(true)}
            className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-bold text-slate-200 hover:bg-white/10 transition-all"
          >
            <FiLogIn className="text-violet-400" />
            <span>Nhập Mã Phòng</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-xs font-black text-white shadow-lg shadow-violet-600/30 hover:brightness-110 active:scale-95"
          >
            <FiPlus className="text-base" />
            <span>Tạo Phòng Học Mới</span>
          </button>
        </div>
      </div>

      {/* Rooms List */}
      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400 font-bold px-1">
          <span>Các phòng học đang mở:</span>
          <span className="text-emerald-400">{rooms.length} phòng trực tuyến</span>
        </div>

        {isLoadingRooms ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2].map((skeleton) => (
              <div
                key={skeleton}
                className="h-36 rounded-2xl border border-white/10 bg-white/[0.02] p-4 animate-pulse flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="h-4 w-28 rounded bg-white/10" />
                  <div className="h-5 w-3/4 rounded bg-white/10" />
                  <div className="h-3 w-1/2 rounded bg-white/5" />
                </div>
                <div className="h-8 w-full rounded bg-white/5" />
              </div>
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-10 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/15 border border-violet-500/30 text-violet-300">
              <FiVideo className="text-2xl" />
            </div>
            <h4 className="text-sm sm:text-base font-extrabold text-white">
              Chưa có phòng học nào đang mở
            </h4>
            <p className="mx-auto mt-1 max-w-md text-xs text-slate-400 leading-relaxed">
              Tất cả dữ liệu phòng mẫu ảo đã được dọn sạch. Hãy là người đầu tiên tạo phòng học thật để rủ bạn bè cùng bật cam ôn thi CSCA nhé!
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-xs font-black text-white shadow-lg shadow-violet-600/30 hover:brightness-110 active:scale-95"
              >
                <FiPlus className="text-sm" />
                <span>Tạo phòng học đầu tiên</span>
              </button>
              <button
                type="button"
                onClick={() => setShowJoinModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-white/10 transition-all"
              >
                <FiLogIn className="text-violet-400" />
                <span>Tham gia bằng mã</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-all hover:border-violet-500/40 hover:bg-white/[0.06] group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-violet-600/20 px-2.5 py-0.5 text-[10px] font-black text-violet-300 ring-1 ring-violet-500/30">
                      {room.subject}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                        {room.memberCount}/{room.maxMembers} bạn
                      </span>
                      {canManageRoom(room) && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteRoom(room, e)}
                          className="rounded-lg p-1 text-slate-500 hover:bg-rose-500/20 hover:text-rose-400 transition-colors"
                          title="Xóa phòng học này"
                        >
                          <FiTrash2 className="text-xs" />
                        </button>
                      )}
                    </div>
                  </div>

                  <h4 className="mt-2 text-sm font-extrabold text-white group-hover:text-violet-300 transition-colors">
                    {room.name}
                  </h4>

                  <p className="mt-1 text-xs text-slate-400 line-clamp-1">
                    Chủ phòng: <strong className="text-slate-300">{room.hostName}</strong>
                  </p>

                  {room.goal && (
                    <p className="mt-1 text-[11px] text-slate-400 line-clamp-1">
                      🎯 {room.goal}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
                  <span className="text-[11px] font-mono text-slate-400">
                    Mã: <span className="font-bold text-slate-300">{room.code}</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => enterRoom(room, true)}
                    className="rounded-xl bg-violet-600 px-4 py-1.5 text-xs font-bold text-white shadow-md shadow-violet-600/20 hover:bg-violet-500 transition-all active:scale-95"
                  >
                    Vào học chung ➔
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── MODAL TẠO PHÒNG HỌC ────────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl border border-white/15 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-extrabold text-white">
                Tạo Phòng Tự Học Bật Cam Mới
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <FiX className="text-lg" />
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300">Tên phòng học:</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Ôn Thi CSCA Toán - Mục Tiêu Đỗ 90+"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="mt-1.5 w-full rounded-2xl border border-white/15 bg-slate-950 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300">
                  Môn học / Chủ đề:
                </label>
                <select
                  value={newRoomSubject}
                  onChange={(e) => setNewRoomSubject(e.target.value)}
                  className="mt-1.5 w-full rounded-2xl border border-white/15 bg-slate-950 px-4 py-2.5 text-xs text-white focus:border-violet-500 focus:outline-none"
                >
                  <option value="Toán học CSCA">Toán học CSCA</option>
                  <option value="Vật lý CSCA">Vật lý CSCA</option>
                  <option value="Hóa học CSCA">Hóa học CSCA</option>
                  <option value="Tiếng Trung Xã Hội">Tiếng Trung Xã Hội</option>
                  <option value="Tiếng Trung Tự Nhiên">Tiếng Trung Tự Nhiên</option>
                  <option value="Tự học im lặng 25/5">Tự học im lặng 25/5</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300">
                  Mục tiêu của phòng:
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Cùng ngồi giải xong 1 đề mô phỏng"
                  value={newRoomGoal}
                  onChange={(e) => setNewRoomGoal(e.target.value)}
                  className="mt-1.5 w-full rounded-2xl border border-white/15 bg-slate-950 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300">
                  Sức chứa tối đa:
                </label>
                <div className="mt-1.5 flex gap-2">
                  {[4, 6, 8, 12].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setNewRoomMax(num)}
                      className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${
                        newRoomMax === num
                          ? 'bg-violet-600 text-white shadow-sm'
                          : 'bg-white/5 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {num} bạn
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-slate-400 hover:bg-white/5"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRoom}
                  className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-600/30 hover:brightness-110 disabled:opacity-50"
                >
                  {isSubmittingRoom ? 'Đang tạo phòng...' : 'Tạo phòng & Bật camera'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL NHẬP MÃ PHÒNG ────────────────────────────────────────────── */}
      {showJoinModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-extrabold text-white">Tham Gia Bằng Mã Phòng</h3>
              <button
                type="button"
                onClick={() => setShowJoinModal(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <FiX className="text-lg" />
              </button>
            </div>

            <form onSubmit={handleJoinByCode} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300">
                  Nhập mã phòng (ví dụ: CSCA-1234):
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nhập mã phòng tại đây..."
                  value={inputRoomCode}
                  onChange={(e) => setInputRoomCode(e.target.value)}
                  className="mt-1.5 w-full uppercase font-mono font-bold tracking-wider rounded-2xl border border-white/15 bg-slate-950 px-4 py-2.5 text-sm text-violet-300 placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-slate-400 hover:bg-white/5"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-600/30 hover:bg-violet-500"
                >
                  Vào học ngay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
