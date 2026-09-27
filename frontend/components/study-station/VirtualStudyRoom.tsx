'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  FiVideo,
  FiVideoOff,
  FiPlus,
  FiUsers,
  FiCopy,
  FiLogOut,
  FiShare2,
  FiX,
  FiCheck,
  FiLock,
  FiGlobe,
  FiMessageSquare,
  FiMaximize2,
  FiRefreshCw,
  FiSend,
} from 'react-icons/fi';
import { FaFire, FaCrown } from 'react-icons/fa';
import { useAuthStore } from '@/lib/store/authStore';
import {
  getRoomMessages,
  sendRoomMessage,
  getStudyRooms,
  createStudyRoomApi,
} from '@/lib/api/studyStation';

export interface StudyRoom {
  id: string;
  name: string;
  hostName: string;
  hostAvatar?: string;
  subject: string;
  memberCount: number;
  maxMembers: number;
  isPrivate: boolean;
  code: string;
  createdAt: number;
  goal?: string;
}

interface RoomMember {
  id: string;
  name: string;
  isHost: boolean;
  cameraOn: boolean;
  handRaised: boolean;
  statusText: string;
  avatar?: string;
  stream?: MediaStream | null;
}

// Sample active rooms to make the platform lively immediately
const INITIAL_PUBLIC_ROOMS: StudyRoom[] = [
  {
    id: 'room-csca-math-01',
    name: '🔥 Ôn Đề Toán CSCA Mục Tiêu 90+',
    hostName: 'Minh Hoàng (Học bổng CSC)',
    subject: 'Toán học CSCA',
    memberCount: 3,
    maxMembers: 6,
    isPrivate: false,
    code: 'TOAN-90',
    createdAt: Date.now() - 3600000,
    goal: 'Giải xong 2 đề mô phỏng phần Tích phân và Đại số',
  },
  {
    id: 'room-silent-study-02',
    name: '🌙 Phòng Tự Học Im Lặng 25/5 (Bật Cam)',
    hostName: 'Thanh Thảo',
    subject: 'Tự học kỷ luật',
    memberCount: 4,
    maxMembers: 8,
    isPrivate: false,
    code: 'SILENT-25',
    createdAt: Date.now() - 7200000,
    goal: 'Tuyệt đối không dùng điện thoại trong 2 tiếng',
  },
  {
    id: 'room-chinese-prep-03',
    name: '🇨🇳 Luyện 500 Từ Vựng Tiếng Trung Tự Nhiên',
    hostName: 'Tuấn Anh',
    subject: 'Tiếng Trung',
    memberCount: 2,
    maxMembers: 4,
    isPrivate: false,
    code: 'HSK-CHINESE',
    createdAt: Date.now() - 1800000,
    goal: 'Học 30 từ vựng và luyện dịch câu',
  },
];

const ROOM_QUICK_REACTIONS = [
  '🔥 Cố lên cả nhà!',
  '☕ Uống ngụm nước',
  '🎯 Tập trung nào',
  '✋ Chào mọi người',
  '💪 Quyết tâm đạt mục tiêu!',
];

export default function VirtualStudyRoom() {
  const { user } = useAuthStore();
  const [rooms, setRooms] = useState<StudyRoom[]>(INITIAL_PUBLIC_ROOMS);
  const [activeRoom, setActiveRoom] = useState<StudyRoom | null>(null);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showJoinModal, setShowJoinModal] = useState<boolean>(false);
  const [inputRoomCode, setInputRoomCode] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New room form
  const [newRoomName, setNewRoomName] = useState<string>('');
  const [newRoomSubject, setNewRoomSubject] = useState<string>('Toán học CSCA');
  const [newRoomMax, setNewRoomMax] = useState<number>(6);
  const [newRoomGoal, setNewRoomGoal] = useState<string>('');
  const [newRoomIsPrivate, setNewRoomIsPrivate] = useState<boolean>(false);

  // In-room camera states
  const [myCameraOn, setMyCameraOn] = useState<boolean>(true);
  const [myHandRaised, setMyHandRaised] = useState<boolean>(false);
  const [myStatus, setMyStatus] = useState<string>('Đang tập trung giải đề');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  // Room members
  const [members, setMembers] = useState<RoomMember[]>([]);

  // Room quick chat messages (connected to SQL database)
  const [chatMessages, setChatMessages] = useState<Array<{ sender: string; text: string; time: string; isMe?: boolean }>>([]);
  const [isLoadingRoomChats, setIsLoadingRoomChats] = useState<boolean>(false);
  const [chatInput, setChatInput] = useState<string>('');
  const chatMessagesEndRef = useRef<HTMLDivElement | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Load study rooms from SQL database on mount
  useEffect(() => {
    let isMounted = true;
    getStudyRooms().then((backendRooms) => {
      if (!isMounted) return;
      if (backendRooms.length > 0) {
        setRooms((prev) => {
          const mappedBackend: StudyRoom[] = backendRooms.map((r) => ({
            id: r.id,
            code: r.code,
            name: r.name,
            hostName: r.hostName,
            hostAvatar: r.hostAvatar,
            subject: r.subject,
            goal: r.goal || 'Học tập trung',
            memberCount: r.memberCount,
            maxMembers: r.maxMembers,
            isPrivate: r.isPrivate,
            createdAt: r.createdAt,
          }));
          const existingCodes = new Set(mappedBackend.map((r) => r.code));
          const filteredPrev = prev.filter((r) => !existingCodes.has(r.code));
          return [...mappedBackend, ...filteredPrev];
        });
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, []);

  // Load room messages from SQL database when activeRoom changes
  useEffect(() => {
    if (!activeRoom?.code) return;
    let isMounted = true;

    const loadRoomMsgs = async () => {
      try {
        const msgs = await getRoomMessages(activeRoom.code);
        if (!isMounted) return;
        setChatMessages(
          msgs.map((m) => ({
            sender: m.sender,
            text: m.text,
            time: m.time,
            isMe: user?.id && m.userId === user.id ? true : false,
          }))
        );
      } catch (err) {
        console.error('loadRoomMsgs error:', err);
      } finally {
        if (isMounted) setIsLoadingRoomChats(false);
      }
    };

    setIsLoadingRoomChats(true);
    loadRoomMsgs();
    const interval = setInterval(loadRoomMsgs, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeRoom?.code, user?.id]);

  // Check URL query param for direct join link: ?room=XYZ
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      if (roomParam) {
        const found = rooms.find((r) => r.code.toUpperCase() === roomParam.toUpperCase() || r.id === roomParam);
        if (found) {
          handleJoinRoom(found);
        } else {
          // Create instant joined room
          const directRoom: StudyRoom = {
            id: `room-${roomParam}`,
            name: `Phòng Học ${roomParam}`,
            hostName: 'Bạn bè chia sẻ',
            subject: 'Ôn thi CSCA',
            memberCount: 1,
            maxMembers: 8,
            isPrivate: false,
            code: roomParam.toUpperCase(),
            createdAt: Date.now(),
            goal: 'Cùng nhau học tập',
          };
          setRooms((prev) => [directRoom, ...prev]);
          handleJoinRoom(directRoom);
        }
      }
    }
  }, []);

  // Start local camera stream
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 360, facingMode: 'user' },
        audio: false, // Default mute for silent study
      });
      setLocalStream(stream);
      setMyCameraOn(true);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch {
      showToast('⚠️ Không thể bật camera. Bạn vẫn có thể tham gia phòng học!');
      setMyCameraOn(false);
      return null;
    }
  };

  const stopCamera = () => {
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
    }
    setMyCameraOn(false);
  };

  const toggleMyCamera = async () => {
    if (myCameraOn) {
      stopCamera();
      showToast('Đã tắt camera');
    } else {
      await startCamera();
      showToast('Đã bật camera học tập');
    }
  };

  // Join Room logic
  const handleJoinRoom = async (room: StudyRoom) => {
    setActiveRoom(room);
    await startCamera();

    const userName = user?.full_name || 'Học viên Moly';
    const myMember: RoomMember = {
      id: 'me',
      name: `${userName} (Bạn)`,
      isHost: room.hostName.includes(userName),
      cameraOn: true,
      handRaised: false,
      statusText: myStatus,
      avatar: user?.avatar,
    };

    // Simulated study peers based on room subject to make study session inspiring
    const peers: RoomMember[] = [
      {
        id: 'peer-1',
        name: room.hostName,
        isHost: true,
        cameraOn: true,
        handRaised: false,
        statusText: '🎯 ' + (room.goal || 'Đang giải đề chi tiết'),
        avatar: undefined,
      },
    ];

    if (room.memberCount >= 2) {
      peers.push({
        id: 'peer-2',
        name: 'Hoàng Yến (Hà Nội)',
        isHost: false,
        cameraOn: true,
        handRaised: false,
        statusText: '📖 Ôn từ vựng tiếng Trung',
      });
    }

    if (room.memberCount >= 3) {
      peers.push({
        id: 'peer-3',
        name: 'Quốc Bảo (Đà Nẵng)',
        isHost: false,
        cameraOn: true,
        handRaised: false,
        statusText: '✍️ Làm bài tập Vật Lý',
      });
    }

    setMembers([myMember, ...peers]);
    showToast(`🎉 Đã tham gia: ${room.name}`);
  };

  // Leave Room logic
  const handleLeaveRoom = () => {
    stopCamera();
    setActiveRoom(null);
    setMembers([]);
    showToast('Đã rời phòng học');
  };

  // Create Room logic (persists to SQL database)
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) {
      showToast('Vui lòng nhập tên phòng!');
      return;
    }

    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const code = `CSCA-${randomNum}`;
    const userName = user?.full_name || 'Tôi';

    let newRoom: StudyRoom = {
      id: `room-${Date.now()}`,
      name: newRoomName.trim(),
      hostName: userName,
      subject: newRoomSubject,
      memberCount: 1,
      maxMembers: newRoomMax,
      isPrivate: newRoomIsPrivate,
      code,
      createdAt: Date.now(),
      goal: newRoomGoal.trim() || 'Học tập trung không xao nhãng',
    };

    try {
      const saved = await createStudyRoomApi({
        name: newRoomName.trim(),
        subject: newRoomSubject,
        goal: newRoomGoal.trim() || 'Học tập trung không xao nhãng',
        maxMembers: newRoomMax,
        isPrivate: newRoomIsPrivate,
        code,
      });
      if (saved) {
        newRoom = {
          id: saved.id,
          code: saved.code,
          name: saved.name,
          hostName: saved.hostName,
          hostAvatar: saved.hostAvatar,
          subject: saved.subject,
          goal: saved.goal || newRoom.goal,
          memberCount: saved.memberCount,
          maxMembers: saved.maxMembers,
          isPrivate: saved.isPrivate,
          createdAt: typeof saved.createdAt === 'number' ? saved.createdAt : Date.now(),
        };
      }
    } catch (err) {
      console.error('Lưu phòng vào SQL lỗi:', err);
    }

    setRooms((prev) => [newRoom, ...prev]);
    setShowCreateModal(false);
    setNewRoomName('');
    setNewRoomGoal('');
    await handleJoinRoom(newRoom);
    showToast(`✨ Tạo phòng thành công! Mã phòng: ${newRoom.code}`);
  };

  // Join by code
  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    const code = inputRoomCode.trim().toUpperCase();
    if (!code) return;

    const found = rooms.find((r) => r.code.toUpperCase() === code);
    if (found) {
      setShowJoinModal(false);
      setInputRoomCode('');
      handleJoinRoom(found);
    } else {
      // Allow instant creation if not found
      const customJoinRoom: StudyRoom = {
        id: `room-custom-${code}`,
        name: `Phòng Học Nhóm ${code}`,
        hostName: 'Bạn bè',
        subject: 'Tự học chung',
        memberCount: 1,
        maxMembers: 6,
        isPrivate: false,
        code,
        createdAt: Date.now(),
        goal: 'Học tập trung',
      };
      setRooms((prev) => [customJoinRoom, ...prev]);
      setShowJoinModal(false);
      setInputRoomCode('');
      handleJoinRoom(customJoinRoom);
    }
  };

  // Copy room link
  const handleCopyRoomLink = () => {
    if (!activeRoom) return;
    const url = `${window.location.origin}/tram-dong-luc?room=${activeRoom.code}`;
    navigator.clipboard.writeText(url).then(() => {
      showToast('🔗 Đã copy link phòng! Hãy gửi cho bạn bè để vào học cùng!');
    });
  };

  // Send message in room (persists to SQL database)
  const handleSendMessage = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToSend = (customText || chatInput).trim();
    if (!textToSend || !activeRoom) return;

    if (!customText) setChatInput('');
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const myName = user?.full_name || 'Tôi (Bạn)';

    // Optimistic local add
    setChatMessages((prev) => [...prev, { sender: myName, text: textToSend, time: timeStr, isMe: true }]);
    setTimeout(() => {
      chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);

    try {
      await sendRoomMessage(activeRoom.code, {
        text: textToSend,
        senderName: myName,
        messageType: 'text',
      });
    } catch (err) {
      console.error('Lưu tin nhắn phòng vào SQL lỗi:', err);
    }
  };

  // Ensure local video element gets stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, activeRoom]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: IN-ROOM VIEW (ĐANG TRONG PHÒNG HỌC)
  // ─────────────────────────────────────────────────────────────────────────────
  if (activeRoom) {
    return (
      <div className="rounded-3xl border border-violet-500/30 bg-slate-900/95 p-4 sm:p-5 shadow-2xl backdrop-blur-xl">
        {/* Room Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                Đang trong phòng học trực tuyến
              </span>
              <span className="rounded bg-violet-600/30 px-2 py-0.5 text-[10px] font-bold text-violet-300">
                {activeRoom.subject}
              </span>
            </div>
            <h2 className="mt-1 text-lg sm:text-xl font-black text-white">{activeRoom.name}</h2>
            {activeRoom.goal && (
              <p className="mt-0.5 text-xs text-slate-300">🎯 Mục tiêu: {activeRoom.goal}</p>
            )}
          </div>

          {/* Action buttons on top */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyRoomLink}
              className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-white/10"
              title="Sao chép link mời bạn bè"
            >
              <FiShare2 className="text-violet-400" />
              <span>Mã: <strong className="text-violet-300">{activeRoom.code}</strong></span>
            </button>

            <button
              type="button"
              onClick={handleLeaveRoom}
              className="flex items-center gap-1.5 rounded-xl bg-rose-600/20 px-3.5 py-1.5 text-xs font-bold text-rose-400 hover:bg-rose-600 hover:text-white transition-all"
            >
              <FiLogOut />
              <span>Rời phòng</span>
            </button>
          </div>
        </div>

        {/* ─── MAIN CONTENT: USER CAMS ON LEFT, CHAT ON RIGHT ───────────────── */}
        <div className="my-4 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          
          {/* LEFT: User video grid + Controls (lg:col-span-8) */}
          <div className="lg:col-span-8 flex flex-col justify-between space-y-4">
            {/* LƯỚI WEBCAM (2 CỘT CÂN ĐỐI) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {members.map((member) => {
                const isMe = member.id === 'me';
                return (
                  <div
                    key={member.id}
                    className="group relative aspect-video overflow-hidden rounded-2xl border border-white/15 bg-slate-950 shadow-lg ring-1 ring-white/5 transition-all"
                  >
                    {/* VIDEO DISPLAY */}
                    {isMe ? (
                      myCameraOn && localStream ? (
                        <video
                          ref={localVideoRef}
                          autoPlay
                          playsInline
                          muted
                          className="h-full w-full object-cover scale-x-[-1]"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center bg-slate-900 text-slate-500">
                          <FiVideoOff className="text-3xl mb-1 text-slate-600" />
                          <span className="text-xs">Camera của bạn đang tắt</span>
                          <button
                            type="button"
                            onClick={startCamera}
                            className="mt-2 rounded-lg bg-violet-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-violet-500"
                          >
                            Bật Cam Lên
                          </button>
                        </div>
                      )
                    ) : (
                      // Peer mock video/avatar with realistic study aesthetic
                      <div className="relative flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-950">
                        <div className="relative mb-1 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-lg font-black text-white shadow-md ring-2 ring-white/20">
                          {member.name.charAt(0)}
                          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
                        </div>
                        <span className="text-xs font-bold text-slate-200">{member.name}</span>
                        <span className="mt-0.5 text-[10px] text-violet-300 font-medium">
                          {member.statusText}
                        </span>

                        {/* Active study indicator */}
                        <div className="absolute top-2 right-2 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400 backdrop-blur-sm">
                          ● Đang học
                        </div>
                      </div>
                    )}

                    {/* BOTTOM LABEL OVERLAY */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-extrabold text-white truncate">{member.name}</span>
                        {member.isHost && (
                          <span className="rounded bg-amber-500/20 px-1.5 py-0.2 text-[9px] font-black text-amber-300">
                            Chủ phòng
                          </span>
                        )}
                      </div>
                      {isMe && (
                        <button
                          type="button"
                          onClick={toggleMyCamera}
                          className="rounded-lg bg-white/10 p-1 text-slate-200 hover:bg-white/20"
                          title={myCameraOn ? 'Tắt cam' : 'Bật cam'}
                        >
                          {myCameraOn ? <FiVideo className="text-emerald-400" /> : <FiVideoOff className="text-rose-400" />}
                        </button>
                      )}
                    </div>

                    {/* Hand raised indicator */}
                    {member.handRaised && (
                      <div className="absolute top-2 left-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-slate-950 shadow animate-bounce">
                        ✋ Đang giơ tay
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* CONTROLS TOOLBAR */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-3 backdrop-blur-md">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={toggleMyCamera}
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-black transition-all ${
                    myCameraOn
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                      : 'bg-rose-600/20 text-rose-400 border border-rose-500/30 hover:bg-rose-600 hover:text-white'
                  }`}
                >
                  {myCameraOn ? <FiVideo /> : <FiVideoOff />}
                  <span>{myCameraOn ? 'Tắt Cam' : 'Bật Cam'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMyHandRaised((prev) => !prev);
                    showToast(!myHandRaised ? '✋ Đã giơ tay phát biểu / chào hỏi!' : 'Đã hạ tay');
                  }}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                    myHandRaised
                      ? 'border-amber-400 bg-amber-400/20 text-amber-300'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <span>✋</span>
                  <span>{myHandRaised ? 'Hạ tay' : 'Giơ tay'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyRoomLink}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/10 hover:text-white"
                >
                  <FiShare2 className="text-violet-400" />
                  <span>Mời bạn học</span>
                </button>
              </div>

              {/* Status info indicator */}
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
                <span><strong className="text-white">{members.length}</strong> bạn đang học tập trung</span>
              </div>
            </div>
          </div>

          {/* RIGHT: ROOM CHAT SIDEBAR (lg:col-span-4) - vừa phải, gọn gàng */}
          <div className="lg:col-span-4 flex flex-col justify-between rounded-2xl border border-white/10 bg-slate-950/80 p-3.5 shadow-xl backdrop-blur-md min-h-[460px]">
            <div>
              {/* Chat header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <div className="flex items-center gap-2">
                  <FiMessageSquare className="text-violet-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Thảo Luận Phòng
                  </h3>
                </div>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                  ● Trực tiếp
                </span>
              </div>

              {/* Quick study cheer chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto py-2.5 scrollbar-none">
                {ROOM_QUICK_REACTIONS.map((reaction, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSendMessage(undefined, reaction)}
                    className="whitespace-nowrap rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-medium text-slate-300 transition-all hover:border-violet-500/40 hover:bg-violet-600/20 hover:text-white active:scale-95"
                  >
                    {reaction}
                  </button>
                ))}
              </div>

              {/* Scrollable message stream */}
              <div className="overflow-y-auto space-y-2.5 pr-1 text-xs max-h-[340px] min-h-[220px] scrollbar-thin scrollbar-thumb-white/10">
                {isLoadingRoomChats ? (
                  <div className="flex h-full min-h-[160px] flex-col items-center justify-center text-slate-500 py-6">
                    <FiRefreshCw className="animate-spin text-lg mb-1 text-violet-400" />
                    <span className="text-[11px]">Đang kết nối tin nhắn phòng...</span>
                  </div>
                ) : chatMessages.length === 0 ? (
                  <div className="flex h-full min-h-[160px] flex-col items-center justify-center text-slate-400 py-6 px-3 text-center">
                    <span className="text-2xl mb-1">👋</span>
                    <p className="text-xs font-bold text-slate-200">Chưa có tin nhắn trong phòng</p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
                      Hãy gửi lời chào hoặc bấm lời cổ vũ bên trên để bắt đầu buổi học! 🔥
                    </p>
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => {
                    if (msg.sender === 'Hệ thống') {
                      return (
                        <div
                          key={idx}
                          className="rounded-xl border border-violet-500/20 bg-violet-950/40 px-2.5 py-1.5 text-center text-[11px] text-violet-300"
                        >
                          📢 {msg.text}
                        </div>
                      );
                    }

                    return (
                      <div
                        key={idx}
                        className={`flex flex-col ${msg.isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-1 mb-0.5 text-[10px] text-slate-400">
                          <span className={msg.isMe ? 'font-bold text-emerald-400' : 'font-bold text-violet-300'}>
                            {msg.sender}
                          </span>
                          <span>•</span>
                          <span>{msg.time}</span>
                        </div>
                        <div
                          className={`max-w-[88%] rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-sm ${
                            msg.isMe
                              ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-tr-none'
                              : 'bg-slate-800/90 text-slate-200 border border-white/10 rounded-tl-none'
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatMessagesEndRef} />
              </div>
            </div>

            {/* Chat Input form */}
            <form onSubmit={(e) => handleSendMessage(e)} className="mt-3 flex items-center gap-2 border-t border-white/10 pt-2.5">
              <input
                type="text"
                placeholder="Nhắn tin trong phòng..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
              <button
                type="submit"
                className="flex items-center justify-center rounded-xl bg-violet-600 p-2.5 text-white hover:bg-violet-500 active:scale-95 transition-all shadow-md shadow-violet-600/20"
                title="Gửi tin nhắn"
              >
                <FiSend className="text-xs" />
              </button>
            </form>
          </div>

        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: LOBBY VIEW (SẢNH CHỌN / TẠO PHÒNG HỌC)
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900/90 to-slate-950/90 p-5 shadow-2xl backdrop-blur-md">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 transform rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3 text-xs font-bold text-white shadow-2xl shadow-violet-500/40 backdrop-blur-md animate-bounce">
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <FiVideo className="text-violet-400 text-lg" />
            <h3 className="text-base font-black text-white">Phòng Tự Học Bật Cam (Study Together)</h3>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            Cùng bật camera nhìn nhau học tập nghiêm túc, tạo kỷ luật và áp lực tích cực.
          </p>
        </div>

        {/* Buttons: Create & Join by code */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowJoinModal(true)}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/10 hover:text-white"
          >
            Nhập mã phòng
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
          <span>{rooms.length} phòng trực tuyến</span>
        </div>

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
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    {room.memberCount}/{room.maxMembers} bạn
                  </span>
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
                  onClick={() => handleJoinRoom(room)}
                  className="rounded-xl bg-violet-600 px-4 py-1.5 text-xs font-bold text-white shadow-md shadow-violet-600/20 hover:bg-violet-500 transition-all active:scale-95"
                >
                  Vào học chung ➔
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── MODAL TẠO PHÒNG HỌC ────────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl border border-white/15 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-extrabold text-white">Tạo Phòng Tự Học Bật Cam Mới</h3>
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
                <label className="block text-xs font-bold text-slate-300">Môn học / Chủ đề:</label>
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
                <label className="block text-xs font-bold text-slate-300">Mục tiêu của phòng:</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Cùng ngồi giải xong 1 đề mô phỏng"
                  value={newRoomGoal}
                  onChange={(e) => setNewRoomGoal(e.target.value)}
                  className="mt-1.5 w-full rounded-2xl border border-white/15 bg-slate-950 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300">Sức chứa tối đa:</label>
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
                  className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-600/30 hover:brightness-110"
                >
                  Tạo phòng & Bật camera
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
                  Nhập mã phòng (ví dụ: TOAN-90 hoặc CSCA-1234):
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
