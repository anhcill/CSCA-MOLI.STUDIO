'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import FlipClock from '@/components/study-station/FlipClock';
import VirtualStudyRoom from '@/components/study-station/VirtualStudyRoom';
import {
  FiArrowLeft,
  FiVolume2,
  FiShare2,
  FiBookmark,
  FiPlus,
  FiChevronUp,
  FiChevronDown,
  FiMessageSquare,
  FiExternalLink,
  FiCheck,
  FiRefreshCw,
  FiZap,
  FiX,
  FiVideo,
  FiFilm,
  FiSend,
  FiTrash2,
  FiMusic,
  FiEdit3,
  FiClock,
} from 'react-icons/fi';
import {
  FaHeart,
  FaBookmark,
  FaFire,
  FaTrophy,
  FaGraduationCap,
  FaCrown,
  FaMedal,
} from 'react-icons/fa';
import { useAuthStore } from '@/lib/store/authStore';
import {
  getStationChats,
  sendStationChat,
  getStationVideos,
  createStationVideoApi,
  likeStationVideoApi,
  deleteStationVideoApi,
  recordStudySessionApi,
  getStudyLeaderboardApi,
  type StationVideoDTO,
  type StudyLeaderboardData,
} from '@/lib/api/studyStation';

// ─── TYPES ───────────────────────────────────────────────────────────────────
interface MotivationVideo {
  id: string; // TikTok Video ID
  title: string;
  creator: string;
  creatorHandle: string;
  category: 'discipline' | 'exam' | 'scholarship' | 'tips' | 'custom';
  tags: string[];
  likes: number;
  message: string;
  originalUrl?: string;
  isCustom?: boolean;
  createdBy?: number | null;
}

interface StudyTaskItem {
  id: string;
  text: string;
  done: boolean;
}

interface DreamGoalConfig {
  dreamUni: string;
  targetScore: string;
  examDate: string;
}

// ─── CURATED INITIAL MOTIVATION VIDEOS ────────────────────────────────────────
const INITIAL_VIDEOS: MotivationVideo[] = [
  {
    id: '7289808453412588806',
    title: 'Kỷ luật bản thân: Thức dậy khi người khác còn đang ngủ',
    creator: 'Chiến Binh Kỷ Luật',
    creatorHandle: '@chienthankykl',
    category: 'discipline',
    tags: ['#kykl', '#dongluc', '#onthi', '#thanhcong'],
    likes: 12480,
    message: 'Nỗi đau của kỷ luật bao giờ cũng nhẹ hơn nỗi đau của sự hối hận. Cố lên bạn ơi!',
  },
  {
    id: '7189104033379208474',
    title: 'Những đêm 2h sáng ôn thi: Cái giá của sự đỗ đạt',
    creator: 'Cú Đêm Ôn Thi',
    creatorHandle: '@cudem_study',
    category: 'exam',
    tags: ['#studywithme', '#thuckhuya', '#2ham', '#onthicsca'],
    likes: 15300,
    message: 'Khi bạn thấy mệt mỏi muốn gục ngã, hãy nhớ về lý do vì sao ngày đầu tiên bạn bắt đầu!',
  },
  {
    id: '7301031948817452293',
    title: 'Phương pháp Pomodoro & Deep Work: Học 4 tiếng không mỏi',
    creator: 'Góc Học Thông Minh',
    creatorHandle: '@gochocthongminh',
    category: 'tips',
    tags: ['#pomodoro', '#phuongphaphoc', '#focus', '#tips'],
    likes: 8210,
    message: 'Học thông minh quan trọng hơn học vất vả. Tập trung 100% trong 25 phút mang lại hiệu quả gấp 3 lần.',
  },
  {
    id: '7207435168051940613',
    title: 'Gửi bạn đang tự ti về xuất phát điểm của mình',
    creator: 'Động Lực Mỗi Ngày',
    creatorHandle: '@dongluc_moingay',
    category: 'discipline',
    tags: ['#dongluc', '#niemtin', '#butpha', '#csca'],
    likes: 21900,
    message: 'Xuất phát điểm của bạn ở đâu không quyết định vạch đích của bạn. Chỉ có sự bền bỉ mới tạo nên kỳ tích.',
  },
  {
    id: '7268800977259203846',
    title: 'Ngày cầm giấy báo trúng tuyển trường mơ ước',
    creator: 'Thanh Xuân Du Học',
    creatorHandle: '@thanhxuan_duhoc',
    category: 'scholarship',
    tags: ['#trungtuyen', '#hocbong', '#trungquoc', '#hanhphuc'],
    likes: 18400,
    message: 'Cảm giác cầm tờ giấy báo trúng tuyển trên tay sẽ xóa tan mọi giọt mồ hôi và nước mắt hôm nay.',
  },
];

// ─── MOTIVATION QUOTES ───────────────────────────────────────────────────────
const MOTIVATION_QUOTES = [
  { text: 'Con đường đi đến thành công không bao giờ trải hoa hồng cho kẻ lười biếng.', author: 'Lỗ Tấn' },
  { text: 'Người ta có thể nghi ngờ những gì bạn nói, nhưng họ sẽ tin những gì bạn làm được.', author: 'Vô danh' },
  { text: 'Mỗi giờ bạn tập trung hôm nay là một bước tiến gần hơn đến bức thư mời nhập học mơ ước.', author: 'Moly Study' },
  { text: 'Đừng đợi có cảm hứng mới bắt tay vào học; hành động sẽ tạo ra cảm hứng.', author: 'Kỷ luật bản thân' },
  { text: 'Chiến thắng vinh quang nhất là chiến thắng chính sự lười nhác của bản thân mình.', author: 'Khổng Tử' },
];

// ─── CATEGORY LABELS ─────────────────────────────────────────────────────────
const CATEGORIES = [
  { key: 'all', label: '🔥 Tất cả' },
  { key: 'discipline', label: '🎯 Ý chí & Kỷ luật' },
  { key: 'exam', label: '🌙 Thức khuya ôn thi' },
  { key: 'scholarship', label: '🎓 Săn học bổng' },
  { key: 'tips', label: '💡 Tips học thông minh' },
  { key: 'saved', label: '⭐ Đã lưu' },
];

// ─── QUICK CHEERS ────────────────────────────────────────────────────────────
const QUICK_CHEERS = [
  { label: '🔥 Cố lên!', text: '🔥 Cố lên mọi người ơi! Quyết tâm không nản chí!' },
  { label: '💪 Quyết tâm!', text: '💪 Quyết tâm hôm nay phải hoàn thành toàn bộ mục tiêu đề ra!' },
  { label: '☕ Uống nước nào', text: '☕ Nghỉ giải lao 5 phút uống ngụm nước rồi tiếp tục nhé!' },
  { label: '🎯 Mode tập trung', text: '🎯 Bật chế độ Deep Work, cất điện thoại và học thôi!' },
  { label: '🎓 Đỗ CSCA!', text: '🎓 Hẹn gặp tất cả các bạn tại cánh cổng trường đại học mơ ước!' },
];

// ─── 4-MODE AMBIENT & LOFI SOUND MIXER ───────────────────────────────────────
const AMBIENT_SOUNDS: Array<{
  key: 'rain' | 'ocean' | 'cafe' | 'lofi';
  label: string;
  emoji: string;
}> = [
  { key: 'rain', label: 'Mưa rơi', emoji: '🌧️' },
  { key: 'ocean', label: 'Sóng biển', emoji: '🌊' },
  { key: 'cafe', label: 'Quán Cafe', emoji: '☕' },
  { key: 'lofi', label: 'Giai điệu Lofi', emoji: '🎵' },
];

// ─── PRESET STUDY TASKS & DREAM UNIVERSITIES ─────────────────────────────────
const DEFAULT_STUDY_TASKS: StudyTaskItem[] = [
  { id: 'task-init-1', text: 'Giải 1 đề mô phỏng Toán CSCA', done: false },
  { id: 'task-init-2', text: 'Ôn 30 từ vựng Tiếng Trung', done: false },
  { id: 'task-init-3', text: 'Hoàn thành 2 chu kỳ Pomodoro', done: false },
];

const PRESET_TASK_CHIPS = [
  'Giải 1 đề mô phỏng Toán CSCA',
  'Ôn 30 từ vựng Tiếng Trung',
  'Xem lại các câu làm sai',
  'Hoàn thành 2 chu kỳ Pomodoro',
];

const PRESET_UNIVERSITIES = [
  'Đại học Thanh Hoa (Tsinghua)',
  'Đại học Bắc Kinh (Peking)',
  'Đại học Chiết Giang (Zhejiang)',
  'Đại học Giao thông Thượng Hải',
  'Đại học Phục Đán (Fudan)',
  'Đại học Nam Kinh (Nanjing)',
];

const DEFAULT_DREAM_GOAL: DreamGoalConfig = {
  dreamUni: 'Đại học Thanh Hoa (Tsinghua)',
  targetScore: '90+ / 100',
  examDate: '2026-12-20',
};

export default function TramDongLucPage() {
  const { user } = useAuthStore();

  // Main View Mode: 'room' (Study together room & clock focus) | 'reels' (TikTok Motivation Reels focus)
  const [viewMode, setViewMode] = useState<'room' | 'reels'>('room');

  // Video lists & state
  const [videos, setVideos] = useState<MotivationVideo[]>(INITIAL_VIDEOS);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [slideDirection, setSlideDirection] = useState<'up' | 'down'>('up');
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});
  const [likeCountMap, setLikeCountMap] = useState<Record<string, number>>({});
  const [heartBurst, setHeartBurst] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showNoteDrawer, setShowNoteDrawer] = useState<boolean>(false);
  const [showSoundMenu, setShowSoundMenu] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Study Checklist & Note State
  const [studyNote, setStudyNote] = useState<string>('');
  const [studyTasks, setStudyTasks] = useState<StudyTaskItem[]>(DEFAULT_STUDY_TASKS);
  const [newTaskInput, setNewTaskInput] = useState<string>('');

  // Dream University & Countdown State
  const [dreamGoal, setDreamGoal] = useState<DreamGoalConfig>(DEFAULT_DREAM_GOAL);
  const [showDreamModal, setShowDreamModal] = useState<boolean>(false);
  const [editDreamUni, setEditDreamUni] = useState<string>(DEFAULT_DREAM_GOAL.dreamUni);
  const [editTargetScore, setEditTargetScore] = useState<string>(DEFAULT_DREAM_GOAL.targetScore);
  const [editExamDate, setEditExamDate] = useState<string>(DEFAULT_DREAM_GOAL.examDate);

  // Leaderboard State
  const [leaderboardData, setLeaderboardData] = useState<StudyLeaderboardData | null>(null);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<'today' | 'week'>('today');
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState<boolean>(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState<boolean>(false);

  // Gesture & wheel cooldown refs for buttery-smooth TikTok scrolling
  const lastScrollTimeRef = useRef<number>(0);
  const touchStartYRef = useRef<number | null>(null);

  // Live Study Chat & Mobile Reels Tab
  const [chatInput, setChatInput] = useState<string>('');
  const [mobileReelsTab, setMobileReelsTab] = useState<'chat' | 'playlist'>('chat');
  const [chatMessages, setChatMessages] = useState<
    Array<{
      id: string;
      sender: string;
      badge: string;
      badgeColor: string;
      text: string;
      time: string;
      isMe?: boolean;
    }>
  >([]);
  const [isLoadingChats, setIsLoadingChats] = useState<boolean>(true);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  }, []);

  // Format relative time helper
  const formatTimeAgo = (dateStr: string) => {
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 30) return 'Vừa xong';
      if (diffSec < 60) return `${diffSec}s trước`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m trước`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}h trước`;
      return `${new Date(dateStr).getDate()}/${new Date(dateStr).getMonth() + 1}`;
    } catch {
      return 'Vừa xong';
    }
  };

  // ─── LOAD SHARED VIDEOS FROM POSTGRESQL + MERGE LOCAL ──────────────────────
  const mapDtoToMotivationVideo = useCallback((v: StationVideoDTO): MotivationVideo => {
    const validCat = ['discipline', 'exam', 'scholarship', 'tips', 'custom'].includes(v.category)
      ? (v.category as MotivationVideo['category'])
      : 'discipline';
    return {
      id: String(v.id),
      title: v.title || 'Video Động Lực Học Tập',
      creator: v.creator || 'Chiến Binh CSCA',
      creatorHandle: v.creatorHandle || '@chienthancsca',
      category: validCat,
      tags: Array.isArray(v.tags) && v.tags.length > 0 ? v.tags : ['#dongluc', '#csca'],
      likes: typeof v.likes === 'number' ? v.likes : 1,
      message: v.message || 'Hãy tập trung 100% vào mục tiêu của bạn hôm nay!',
      originalUrl: v.originalUrl || undefined,
      isCustom: Boolean(v.isCustom),
      createdBy: v.createdBy ?? null,
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadSharedVideos = async () => {
      try {
        const dbVideos = await getStationVideos();
        if (!isMounted) return;

        let localCustom: MotivationVideo[] = [];
        try {
          const rawCustom = localStorage.getItem('moly:dongluc_custom_videos');
          if (rawCustom) {
            const parsed = JSON.parse(rawCustom);
            if (Array.isArray(parsed)) {
              localCustom = parsed.map((v) => ({ ...v, isCustom: true }));
            }
          }
        } catch {}

        const mappedFromDb = Array.isArray(dbVideos)
          ? dbVideos.map(mapDtoToMotivationVideo)
          : [];

        const combined = [...mappedFromDb, ...localCustom, ...INITIAL_VIDEOS];
        const seen = new Set<string>();
        const deduped: MotivationVideo[] = [];
        const dbLikeCounts: Record<string, number> = {};

        for (const vid of combined) {
          if (!vid || !vid.id || seen.has(vid.id)) continue;
          seen.add(vid.id);
          deduped.push(vid);
          dbLikeCounts[vid.id] = vid.likes;
        }

        if (deduped.length > 0) {
          setVideos(deduped);
          setLikeCountMap((prev) => ({ ...dbLikeCounts, ...prev }));
        }
      } catch (err) {
        console.error('loadSharedVideos error:', err);
      }
    };

    loadSharedVideos();
    return () => {
      isMounted = false;
    };
  }, [mapDtoToMotivationVideo]);

  // ─── LOAD LEADERBOARD FROM POSTGRESQL ──────────────────────────────────────
  const loadLeaderboard = useCallback(async () => {
    setIsLoadingLeaderboard(true);
    try {
      const data = await getStudyLeaderboardApi();
      if (data) {
        setLeaderboardData(data);
      }
    } catch (err) {
      console.error('loadLeaderboard error:', err);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  }, []);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  // Fetch real chats from SQL database
  useEffect(() => {
    let isMounted = true;
    const loadStationChats = async () => {
      try {
        const msgs = await getStationChats();
        if (!isMounted) return;
        setChatMessages(
          msgs.map((m) => ({
            id: m.id,
            sender: m.sender,
            badge: m.badge,
            badgeColor: m.badgeColor,
            text: m.text,
            time: formatTimeAgo(m.createdAt),
            isMe: user?.id ? m.userId === user.id : false,
          }))
        );
      } catch (err) {
        console.error('loadStationChats error:', err);
      } finally {
        if (isMounted) setIsLoadingChats(false);
      }
    };

    loadStationChats();
    const interval = setInterval(loadStationChats, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [user?.id]);

  // ─── INITIAL STORAGE LOAD (LIKES, SAVED, TASKS, NOTE, DREAM GOAL) ──────────
  useEffect(() => {
    try {
      const storedLikes = localStorage.getItem('moly:dongluc_likes');
      if (storedLikes) setLikedMap(JSON.parse(storedLikes));

      const storedSaved = localStorage.getItem('moly:dongluc_saved');
      if (storedSaved) setSavedMap(JSON.parse(storedSaved));

      const savedNote = localStorage.getItem('moly:dongluc_study_note');
      if (savedNote) setStudyNote(savedNote);

      const savedTasks = localStorage.getItem('moly:dongluc_study_tasks');
      if (savedTasks) {
        const parsedTasks = JSON.parse(savedTasks) as StudyTaskItem[];
        if (Array.isArray(parsedTasks)) {
          setStudyTasks(parsedTasks);
        }
      }

      const savedDream = localStorage.getItem('moly:csca_dream_goal');
      if (savedDream) {
        const parsedDream = JSON.parse(savedDream) as Partial<DreamGoalConfig>;
        const merged: DreamGoalConfig = {
          dreamUni: parsedDream.dreamUni || DEFAULT_DREAM_GOAL.dreamUni,
          targetScore: parsedDream.targetScore || DEFAULT_DREAM_GOAL.targetScore,
          examDate: parsedDream.examDate || DEFAULT_DREAM_GOAL.examDate,
        };
        setDreamGoal(merged);
        setEditDreamUni(merged.dreamUni);
        setEditTargetScore(merged.targetScore);
        setEditExamDate(merged.examDate);
      }

      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'reels') {
        setViewMode('reels');
      } else if (tab === 'room' || params.get('room')) {
        setViewMode('room');
      }
    } catch {}
  }, []);

  // ─── STUDY CHECKLIST HANDLERS ──────────────────────────────────────────────
  const persistStudyTasks = useCallback((nextTasks: StudyTaskItem[]) => {
    setStudyTasks(nextTasks);
    try {
      localStorage.setItem('moly:dongluc_study_tasks', JSON.stringify(nextTasks));
    } catch {}
  }, []);

  const handleToggleTask = useCallback(
    (taskId: string) => {
      setStudyTasks((prev) => {
        const next = prev.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t));
        try {
          localStorage.setItem('moly:dongluc_study_tasks', JSON.stringify(next));
        } catch {}
        const target = next.find((t) => t.id === taskId);
        if (target?.done) {
          const allDone = next.length > 0 && next.every((t) => t.done);
          if (allDone) {
            showToast('🏆 Tuyệt vời! Bạn đã hoàn thành 100% checklist mục tiêu hôm nay!');
          } else {
            showToast('✅ Đã hoàn thành 1 nhiệm vụ! Tiếp tục giữ vững phong độ nhé!');
          }
        }
        return next;
      });
    },
    [showToast]
  );

  const handleAddStudyTask = useCallback(
    (textToAdd?: string) => {
      const clean = (textToAdd ?? newTaskInput).trim();
      if (!clean) return;
      if (studyTasks.some((t) => t.text.toLowerCase() === clean.toLowerCase())) {
        showToast('ℹ️ Nhiệm vụ này đã có trong checklist của bạn!');
        return;
      }
      const newTask: StudyTaskItem = {
        id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        text: clean,
        done: false,
      };
      const next = [...studyTasks, newTask];
      persistStudyTasks(next);
      if (!textToAdd) setNewTaskInput('');
      showToast('📌 Đã thêm nhiệm vụ vào Checklist hôm nay!');
    },
    [newTaskInput, studyTasks, persistStudyTasks, showToast]
  );

  const handleDeleteStudyTask = useCallback(
    (taskId: string) => {
      const next = studyTasks.filter((t) => t.id !== taskId);
      persistStudyTasks(next);
    },
    [studyTasks, persistStudyTasks]
  );

  const completedTasksCount = useMemo(
    () => studyTasks.filter((t) => t.done).length,
    [studyTasks]
  );
  const totalTasksCount = studyTasks.length;
  const taskProgressPercent =
    totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  // ─── DREAM GOAL & COUNTDOWN HANDLERS ───────────────────────────────────────
  const daysUntilExam = useMemo(() => {
    try {
      const targetMs = new Date(dreamGoal.examDate).getTime();
      if (isNaN(targetMs)) return 50;
      const diffDays = Math.ceil((targetMs - Date.now()) / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    } catch {
      return 50;
    }
  }, [dreamGoal.examDate]);

  const handleSaveDreamGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: DreamGoalConfig = {
      dreamUni: editDreamUni.trim() || DEFAULT_DREAM_GOAL.dreamUni,
      targetScore: editTargetScore.trim() || DEFAULT_DREAM_GOAL.targetScore,
      examDate: editExamDate || DEFAULT_DREAM_GOAL.examDate,
    };
    setDreamGoal(updated);
    try {
      localStorage.setItem('moly:csca_dream_goal', JSON.stringify(updated));
    } catch {}
    setShowDreamModal(false);
    showToast(`🎓 Đã lưu mục tiêu: ${updated.dreamUni} (${updated.targetScore})!`);
  };

  // ─── POMODORO COMPLETION -> RECORD TO SQL & REFRESH LEADERBOARD ────────────
  const handlePomodoroSessionComplete = useCallback(
    async (mode: 'work' | 'break', mins?: number) => {
      if (mode !== 'work') return;
      const durationMinutes = mins || 25;
      showToast(
        `🎉 Chúc mừng bạn vừa hoàn thành ${durationMinutes} phút tập trung! Đã cộng vào Bảng Xếp Hạng!`
      );
      try {
        await recordStudySessionApi({
          durationMinutes,
          subject: 'Tự học CSCA',
          dreamUniversity: dreamGoal.dreamUni,
          userName: user?.full_name || user?.username || 'Chiến binh CSCA',
        });
        await loadLeaderboard();
      } catch (err) {
        console.error('recordStudySessionApi error:', err);
      }
    },
    [dreamGoal.dreamUni, user?.full_name, user?.username, showToast, loadLeaderboard]
  );

  // Manual quick check-in from Leaderboard modal
  const handleQuickCheckInSession = async (mins = 25) => {
    showToast(
      `🎉 Chúc mừng bạn vừa hoàn thành ${mins} phút tập trung! Đã cộng vào Bảng Xếp Hạng!`
    );
    try {
      await recordStudySessionApi({
        durationMinutes: mins,
        subject: 'Tự học CSCA',
        dreamUniversity: dreamGoal.dreamUni,
        userName: user?.full_name || user?.username || 'Chiến binh CSCA',
      });
      await loadLeaderboard();
    } catch (err) {
      console.error('handleQuickCheckInSession error:', err);
    }
  };

  const handleSendChatMessage = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToSend = (customText || chatInput).trim();
    if (!textToSend) return;

    if (!customText) setChatInput('');

    // Optimistic temporary display
    const tempId = `temp-${Date.now()}`;
    const mySenderName =
      user?.full_name || user?.username || user?.email?.split('@')[0] || 'Bạn (Sĩ tử CSCA)';
    const optimisticMsg = {
      id: tempId,
      sender: mySenderName,
      badge: user?.is_vip ? 'Chiến binh VIP' : 'Chiến binh CSCA',
      badgeColor: user?.is_vip
        ? 'text-violet-300 bg-violet-500/10 border-violet-500/20'
        : 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
      text: textToSend,
      time: 'Vừa xong',
      isMe: true,
    };

    setChatMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);

    try {
      const currentVid = filteredVideos[currentIndex];
      const saved = await sendStationChat({
        text: textToSend,
        senderName: mySenderName,
        videoId: currentVid?.id,
      });

      if (saved) {
        setChatMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  id: saved.id,
                  sender: saved.sender,
                  badge: saved.badge,
                  badgeColor: saved.badgeColor,
                  text: saved.text,
                  time: 'Vừa xong',
                  isMe: true,
                }
              : m
          )
        );
      }
    } catch (err) {
      console.error('Lỗi lưu tin nhắn vào database:', err);
      showToast('⚠️ Không thể lưu tin nhắn vào CSDL, vui lòng thử lại');
    }
  };

  // New Video Form State
  const [inputUrl, setInputUrl] = useState<string>('');
  const [inputTitle, setInputTitle] = useState<string>('');
  const [inputMessage, setInputMessage] = useState<string>('');
  const [inputCategory, setInputCategory] = useState<MotivationVideo['category']>('discipline');

  // Ambient Sound Generator (Web Audio API - 0 data transfer!)
  const [activeSound, setActiveSound] = useState<'none' | 'rain' | 'ocean' | 'cafe' | 'lofi'>(
    'none'
  );
  const [soundVolume, setSoundVolume] = useState<number>(0.5);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const soundNodesRef = useRef<{ gain?: GainNode; source?: AudioNode; stop?: () => void } | null>(
    null
  );

  // Quote State
  const [quoteIndex, setQuoteIndex] = useState<number>(0);

  // Iframe loading indicator with fast fallback so it never blocks the user
  const [iframeLoading, setIframeLoading] = useState<boolean>(true);

  // Filtered videos based on category & strictly deduplicated by ID
  const filteredVideos = useMemo(() => {
    let list = videos;
    if (selectedCategory === 'saved') {
      list = videos.filter((v) => Boolean(savedMap[v.id]));
    } else if (selectedCategory !== 'all') {
      list = videos.filter((v) => v.category === selectedCategory);
    }
    const seen = new Set<string>();
    return list.filter((v) => {
      if (!v || !v.id || seen.has(v.id)) return false;
      seen.add(v.id);
      return true;
    });
  }, [videos, selectedCategory, savedMap]);

  // Keep index within bounds
  useEffect(() => {
    if (currentIndex >= filteredVideos.length) {
      setCurrentIndex(0);
    }
  }, [selectedCategory, filteredVideos.length, currentIndex]);

  const currentVideo = filteredVideos[currentIndex] || filteredVideos[0];
  const nextVideo =
    filteredVideos.length > 1
      ? filteredVideos[(currentIndex + 1) % filteredVideos.length]
      : null;

  // Fast-reveal skeleton: automatically dismiss overlay after 600ms even if TikTok iframe is still initializing scripts
  useEffect(() => {
    setIframeLoading(true);
    const timer = setTimeout(() => {
      setIframeLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [currentVideo?.id]);

  // ─── VIDEO NAVIGATION (ULTRA-SMOOTH VERTICAL REELS) ────────────────────────
  const handlePrevVideo = useCallback(() => {
    if (filteredVideos.length <= 1) return;
    setSlideDirection('down');
    setIframeLoading(true);
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : filteredVideos.length - 1));
  }, [filteredVideos.length]);

  const handleNextVideo = useCallback(() => {
    if (filteredVideos.length <= 1) return;
    setSlideDirection('up');
    setIframeLoading(true);
    setCurrentIndex((prev) => (prev < filteredVideos.length - 1 ? prev + 1 : 0));
  }, [filteredVideos.length]);

  const selectVideoByIndex = (idx: number) => {
    if (idx === currentIndex) return;
    setSlideDirection(idx > currentIndex ? 'up' : 'down');
    setIframeLoading(true);
    setCurrentIndex(idx);
  };

  // Mouse wheel / Trackpad two-finger vertical scroll handler with debounce
  const handleReelsWheel = useCallback(
    (e: React.WheelEvent) => {
      if (filteredVideos.length <= 1) return;
      if (Math.abs(e.deltaY) < 22) return;
      const now = Date.now();
      if (now - lastScrollTimeRef.current < 420) return;
      lastScrollTimeRef.current = now;

      if (e.deltaY > 0) {
        handleNextVideo();
      } else {
        handlePrevVideo();
      }
    },
    [filteredVideos.length, handleNextVideo, handlePrevVideo]
  );

  // Touch swipe up / down handlers for mobile & tablets
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0]?.clientY ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartYRef.current === null) return;
    const endY = e.changedTouches[0]?.clientY ?? touchStartYRef.current;
    const diffY = touchStartYRef.current - endY;
    touchStartYRef.current = null;

    if (Math.abs(diffY) < 40) return;
    if (diffY > 0) {
      handleNextVideo();
    } else {
      handlePrevVideo();
    }
  };

  // ─── LIKE, BOOKMARK, SHARE & DELETE (WITH REAL POSTGRESQL SYNC) ────────────
  const toggleLike = useCallback(
    async (videoId: string) => {
      const isLiked = !!likedMap[videoId];
      const newLiked = !isLiked;
      const updated = { ...likedMap, [videoId]: newLiked };
      setLikedMap(updated);
      try {
        localStorage.setItem('moly:dongluc_likes', JSON.stringify(updated));
      } catch {}

      const delta: 1 | -1 = newLiked ? 1 : -1;
      setLikeCountMap((prev) => ({
        ...prev,
        [videoId]: Math.max(0, (prev[videoId] ?? currentVideo?.likes ?? 1000) + delta),
      }));

      if (newLiked) {
        setHeartBurst(true);
        setTimeout(() => setHeartBurst(false), 750);
        showToast('❤️ Đã thả tim tiếp lửa! Cố gắng học tập nhé bạn!');
      }

      try {
        const updatedServerLikes = await likeStationVideoApi(videoId, delta);
        if (typeof updatedServerLikes === 'number') {
          setLikeCountMap((prev) => ({
            ...prev,
            [videoId]: updatedServerLikes,
          }));
        }
      } catch {}
    },
    [likedMap, currentVideo?.likes, showToast]
  );

  // Keyboard navigation (`ArrowUp`, `ArrowDown`, `L` to like)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewMode !== 'reels') return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'ArrowDown' || e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        handleNextVideo();
      } else if (e.key === 'ArrowUp' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        handlePrevVideo();
      } else if (e.key === 'l' || e.key === 'L') {
        if (currentVideo) toggleLike(currentVideo.id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, handleNextVideo, handlePrevVideo, currentVideo, toggleLike]);

  const toggleBookmark = (videoId: string) => {
    const isSaved = !!savedMap[videoId];
    const newSaved = !isSaved;
    const updated = { ...savedMap, [videoId]: newSaved };
    setSavedMap(updated);
    try {
      localStorage.setItem('moly:dongluc_saved', JSON.stringify(updated));
    } catch {}

    showToast(newSaved ? '⭐ Đã lưu vào mục Video Đã Lưu!' : 'Đã bỏ lưu video');
  };

  const handleCopyLink = () => {
    if (!currentVideo) return;
    const url = currentVideo.originalUrl || `https://www.tiktok.com/@moly/video/${currentVideo.id}`;
    navigator.clipboard.writeText(url).then(() => {
      showToast('🔗 Đã sao chép liên kết video TikTok!');
    });
  };

  const handleDeleteCustomVideo = async (videoId: string) => {
    setVideos((prev) => prev.filter((v) => v.id !== videoId));
    try {
      const stored = localStorage.getItem('moly:dongluc_custom_videos');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          localStorage.setItem(
            'moly:dongluc_custom_videos',
            JSON.stringify(parsed.filter((v: { id?: string }) => v?.id !== videoId))
          );
        }
      }
    } catch {}

    try {
      await deleteStationVideoApi(videoId);
    } catch {}

    showToast('🗑️ Đã xóa video khỏi danh sách Trạm Động Lực');
  };

  // ─── EXTRACT TIKTOK VIDEO ID & SAVE TO POSTGRESQL ─────────────────────────
  const extractTikTokId = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (/^\d{10,25}$/.test(trimmed)) return trimmed;
    const match = trimmed.match(/\/video\/(\d{10,25})/);
    if (match?.[1]) return match[1];
    const numMatch = trimmed.match(/(\d{15,25})/);
    if (numMatch?.[1]) return numMatch[1];
    return null;
  };

  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    const videoId = extractTikTokId(inputUrl);
    if (!videoId) {
      showToast('⚠️ Vui lòng nhập link video TikTok hợp lệ!');
      return;
    }

    const existingIndex = videos.findIndex((v) => v.id === videoId);
    if (existingIndex !== -1) {
      setSelectedCategory('all');
      setCurrentIndex(existingIndex);
      setShowAddModal(false);
      showToast('✨ Video này đã có trong danh sách! Đã chuyển đến video.');
      return;
    }

    const creatorName = user?.full_name || user?.username || 'Bạn chia sẻ';
    const creatorHandle = user?.username ? `@${user.username}` : '@ban_chia_se';

    const newVid: MotivationVideo = {
      id: videoId,
      title: inputTitle.trim() || 'Video Động Lực Học Tập',
      creator: creatorName,
      creatorHandle,
      category: inputCategory,
      tags: ['#dongluc', '#custom', '#csca'],
      likes: 1,
      message: inputMessage.trim() || 'Hãy tập trung 100% vào mục tiêu của bạn hôm nay!',
      originalUrl: inputUrl.trim(),
      isCustom: true,
      createdBy: user?.id ?? null,
    };

    const updatedVideos = [newVid, ...videos.filter((v) => v.id !== videoId)];
    setVideos(updatedVideos);

    try {
      const stored = localStorage.getItem('moly:dongluc_custom_videos');
      const parsed = stored ? JSON.parse(stored) : [];
      const filteredParsed = Array.isArray(parsed)
        ? parsed.filter((v: { id?: string }) => v?.id !== videoId)
        : [];
      localStorage.setItem(
        'moly:dongluc_custom_videos',
        JSON.stringify([newVid, ...filteredParsed])
      );
    } catch {}

    setInputUrl('');
    setInputTitle('');
    setInputMessage('');
    setShowAddModal(false);
    setSelectedCategory('all');
    setCurrentIndex(0);
    showToast('🎉 Đã chia sẻ video TikTok lên Trạm Động Lực cộng đồng!');

    try {
      const savedDto = await createStationVideoApi({
        id: newVid.id,
        title: newVid.title,
        creator: newVid.creator,
        creatorHandle: newVid.creatorHandle,
        category: newVid.category,
        tags: newVid.tags,
        message: newVid.message,
        originalUrl: newVid.originalUrl,
      });
      if (savedDto) {
        const mapped = mapDtoToMotivationVideo(savedDto);
        setVideos((prev) => prev.map((v) => (v.id === mapped.id ? { ...mapped, isCustom: true } : v)));
      }
    } catch (err) {
      console.error('createStationVideoApi error:', err);
    }
  };

  // ─── SYNTHESIS WEB AUDIO AMBIENT + LOFI SOUND (0 BANDWIDTH) ────────────────
  const initAudio = () => {
    if (!audioCtxRef.current) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new AudioCtx();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  const stopActiveSound = useCallback(() => {
    if (soundNodesRef.current?.stop) {
      soundNodesRef.current.stop();
    }
    soundNodesRef.current = null;
    setActiveSound('none');
  }, []);

  const playAmbientSound = (type: 'rain' | 'ocean' | 'cafe' | 'lofi') => {
    if (activeSound === type) {
      stopActiveSound();
      return;
    }
    stopActiveSound();

    try {
      const ctx = initAudio();
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(soundVolume * 0.35, ctx.currentTime);

      if (type === 'lofi') {
        // Warm synthesized Lofi ambient chord progression pad (Fmaj7 -> Em7 -> Dm7 -> Cmaj7)
        const chords = [
          [174.61, 220.0, 261.63, 329.63], // Fmaj7
          [164.81, 196.0, 246.94, 293.66], // Em7
          [146.83, 174.61, 220.0, 261.63], // Dm7
          [130.81, 164.81, 196.0, 246.94], // Cmaj7
        ];

        const masterFilter = ctx.createBiquadFilter();
        masterFilter.type = 'lowpass';
        masterFilter.frequency.setValueAtTime(520, ctx.currentTime);
        masterFilter.Q.setValueAtTime(1.2, ctx.currentTime);

        // Slow LFO modulating filter frequency for dreamy lofi warmth
        const filterLfo = ctx.createOscillator();
        const filterLfoGain = ctx.createGain();
        filterLfo.type = 'sine';
        filterLfo.frequency.setValueAtTime(0.18, ctx.currentTime);
        filterLfoGain.gain.setValueAtTime(160, ctx.currentTime);
        filterLfo.connect(filterLfoGain);
        filterLfoGain.connect(masterFilter.frequency);
        filterLfo.start();

        const oscillators: OscillatorNode[] = [];
        const voiceGains: GainNode[] = [];

        chords[0].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const vGain = ctx.createGain();
          osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
          osc.frequency.setValueAtTime(freq, ctx.currentTime);
          osc.detune.setValueAtTime((idx - 1.5) * 4, ctx.currentTime);
          vGain.gain.setValueAtTime(0.18, ctx.currentTime);
          osc.connect(vGain);
          vGain.connect(masterFilter);
          osc.start();
          oscillators.push(osc);
          voiceGains.push(vGain);
        });

        let chordIdx = 0;
        const chordInterval = window.setInterval(() => {
          if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') return;
          chordIdx = (chordIdx + 1) % chords.length;
          const nextChord = chords[chordIdx];
          const now = audioCtxRef.current.currentTime;
          oscillators.forEach((osc, i) => {
            try {
              osc.frequency.exponentialRampToValueAtTime(nextChord[i], now + 1.2);
            } catch {}
          });
        }, 4200);

        masterFilter.connect(gainNode);
        gainNode.connect(ctx.destination);

        soundNodesRef.current = {
          gain: gainNode,
          stop: () => {
            window.clearInterval(chordInterval);
            try {
              filterLfo.stop();
              filterLfo.disconnect();
            } catch {}
            oscillators.forEach((osc) => {
              try {
                osc.stop();
                osc.disconnect();
              } catch {}
            });
            voiceGains.forEach((g) => {
              try {
                g.disconnect();
              } catch {}
            });
          },
        };
      } else {
        const bufferSize = 2 * ctx.sampleRate;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);

        let b0 = 0,
          b1 = 0,
          b2 = 0,
          b3 = 0,
          b4 = 0,
          b5 = 0,
          b6 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.969 * b2 + white * 0.153852;
          b3 = 0.8665 * b3 + white * 0.3104856;
          b4 = 0.55 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.016898;
          output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
          b6 = white * 0.115926;
        }

        const whiteNoise = ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        const filter = ctx.createBiquadFilter();

        if (type === 'rain') {
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(800, ctx.currentTime);
        } else if (type === 'ocean') {
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(450, ctx.currentTime);
          filter.Q.setValueAtTime(1.5, ctx.currentTime);
          const lfo = ctx.createOscillator();
          const lfoGain = ctx.createGain();
          lfo.frequency.setValueAtTime(0.12, ctx.currentTime);
          lfoGain.gain.setValueAtTime(0.18, ctx.currentTime);
          lfo.connect(lfoGain.gain);
          lfo.start();
        } else {
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(500, ctx.currentTime);
        }

        whiteNoise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(ctx.destination);
        whiteNoise.start();

        soundNodesRef.current = {
          gain: gainNode,
          source: whiteNoise,
          stop: () => {
            try {
              whiteNoise.stop();
              whiteNoise.disconnect();
            } catch {}
          },
        };
      }

      setActiveSound(type);
      const label = AMBIENT_SOUNDS.find((s) => s.key === type)?.label || '';
      showToast(`🎧 Đang phát âm thanh nền: ${label}`);
    } catch (err) {
      console.warn('Web Audio error:', err);
    }
  };

  useEffect(() => {
    if (soundNodesRef.current?.gain && audioCtxRef.current) {
      soundNodesRef.current.gain.gain.setValueAtTime(
        soundVolume * 0.35,
        audioCtxRef.current.currentTime
      );
    }
  }, [soundVolume]);

  useEffect(() => {
    return () => {
      stopActiveSound();
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, [stopActiveSound]);

  const isCurrentLiked = currentVideo ? Boolean(likedMap[currentVideo.id]) : false;
  const isCurrentSaved = currentVideo ? Boolean(savedMap[currentVideo.id]) : false;
  const currentLikesCount = currentVideo
    ? likeCountMap[currentVideo.id] ?? currentVideo.likes
    : 0;
  const canDeleteCurrentVideo = Boolean(
    currentVideo &&
      (currentVideo.isCustom ||
        user?.role === 'admin' ||
        (user?.id && currentVideo.createdBy === user.id))
  );

  const activeLeaderboardRows = useMemo(() => {
    if (!leaderboardData) return [];
    return leaderboardPeriod === 'today'
      ? leaderboardData.topToday || []
      : leaderboardData.topWeek || [];
  }, [leaderboardData, leaderboardPeriod]);

  const myStats = leaderboardData?.myStats || {
    todayMinutes: 0,
    todaySessions: 0,
    weekMinutes: 0,
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-violet-500 selection:text-white">
      {/* Preconnect & Prefetch for fast TikTok CDN connections */}
      <link rel="preconnect" href="https://www.tiktok.com" crossOrigin="anonymous" />
      <link rel="dns-prefetch" href="https://www.tiktok.com" />
      <link
        rel="preconnect"
        href="https://sf16-website-login.neutral.ttwstatic.com"
        crossOrigin="anonymous"
      />
      <link rel="dns-prefetch" href="https://sf16-website-login.neutral.ttwstatic.com" />
      {nextVideo && (
        <link
          rel="prefetch"
          href={`https://www.tiktok.com/embed/v2/${nextVideo.id}`}
          as="document"
        />
      )}

      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 z-[180] -translate-x-1/2 transform rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3 text-xs font-bold text-white shadow-2xl shadow-violet-500/40 backdrop-blur-md transition-all">
          {toastMessage}
        </div>
      )}

      {/* Main Container */}
      <main className="mx-auto max-w-[1600px] px-3 py-4 sm:px-6 sm:py-5">
        {/* Top Navigation & View Mode Switcher */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4 pt-1">
          {/* Brand & Back Button */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="group inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 backdrop-blur-md transition-all hover:bg-white/10 hover:text-white hover:border-violet-500/30 active:scale-95 shadow-sm"
              title="Quay về trang chủ Moly"
            >
              <FiArrowLeft className="text-xs text-violet-400 transition-transform group-hover:-translate-x-0.5" />
              <span>Về trang chủ</span>
            </Link>

            <div className="hidden h-5 w-px bg-white/15 sm:block" />

            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-[10px] sm:text-[11px] font-black text-white shadow-sm shadow-violet-500/25">
                  m
                </span>
                <h1 className="text-base sm:text-lg font-black tracking-tight leading-tight">
                  <span className="bg-gradient-to-r from-violet-400 via-pink-400 to-amber-300 bg-clip-text text-transparent">
                    Trạm Động Lực
                  </span>
                </h1>
              </div>

              <div className="flex items-center gap-2 mt-1">
                <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wide text-violet-300 ring-1 ring-violet-500/30">
                  {viewMode === 'room' ? 'Phòng Học & Cam' : 'TikTok Reels'}
                </span>

                <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-medium text-amber-300/90">
                  <FaFire className="text-orange-500 text-[10px] sm:text-xs" /> Đồng hành đỗ CSCA
                </span>
              </div>
            </div>
          </div>

          {/* View Mode Switcher: 2 SEPARATE DISTINCT MODES */}
          <div className="flex items-center rounded-2xl border border-white/15 bg-white/5 p-1 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setViewMode('room')}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-black transition-all ${
                viewMode === 'room'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <FiVideo className="text-sm" />
              <span>Phòng Tự Học Bật Cam</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('reels')}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-black transition-all ${
                viewMode === 'reels'
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <FiFilm className="text-sm" />
              <span>Lướt TikTok Động Lực</span>
            </button>
          </div>

          {/* Quick Action Buttons + Leaderboard + Ambient Sound Mixer */}
          <div className="relative flex flex-wrap items-center gap-2">
            {/* 🏆 BXH Tự Học Button */}
            <button
              type="button"
              onClick={() => {
                loadLeaderboard();
                setShowLeaderboardModal(true);
              }}
              className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-300 transition-all hover:bg-amber-500/25 hover:text-amber-200 shadow-sm"
              title="Bảng xếp hạng Chiến Thần Tự Học"
            >
              <FaTrophy className="text-xs sm:text-sm text-amber-400" />
              <span>🏆 BXH Tự Học</span>
            </button>

            {/* Ambient Sound Mixer Toggle (4 Modes: Rain, Ocean, Cafe, Lofi) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSoundMenu((prev) => !prev)}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                  activeSound !== 'none'
                    ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300 shadow-sm shadow-emerald-500/20'
                    : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
                title="Bộ trộn âm thanh tập trung (Mưa, Sóng biển, Cafe, Giai điệu Lofi)"
              >
                {activeSound !== 'none' ? (
                  <FiVolume2 className="text-sm text-emerald-400 animate-pulse" />
                ) : (
                  <FiMusic className="text-sm text-violet-400" />
                )}
                <span className="hidden sm:inline">
                  {activeSound === 'none'
                    ? 'Âm thanh nền'
                    : AMBIENT_SOUNDS.find((s) => s.key === activeSound)?.label}
                </span>
              </button>

              {showSoundMenu && (
                <div className="absolute right-0 top-full mt-2 z-[140] w-72 rounded-2xl border border-white/15 bg-slate-900/95 p-3.5 shadow-2xl backdrop-blur-xl">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-xs font-extrabold text-white">
                      🎧 Bộ Trộn Âm Thanh Tập Trung
                    </span>
                    {activeSound !== 'none' && (
                      <button
                        type="button"
                        onClick={stopActiveSound}
                        className="text-[10px] font-bold text-rose-400 hover:underline"
                      >
                        Tắt âm
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {AMBIENT_SOUNDS.map((snd) => {
                      const isPlaying = activeSound === snd.key;
                      return (
                        <button
                          key={snd.key}
                          type="button"
                          onClick={() => playAmbientSound(snd.key)}
                          className={`flex items-center gap-2 rounded-xl p-2 text-[11px] font-bold transition-all ${
                            isPlaying
                              ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30 ring-1 ring-violet-400'
                              : 'bg-white/5 text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          <span className="text-base">{snd.emoji}</span>
                          <span className="truncate">{snd.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-white/10">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span>Âm lượng</span>
                      <span>{Math.round(soundVolume * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.05"
                      max="1"
                      step="0.05"
                      value={soundVolume}
                      onChange={(e) => setSoundVolume(parseFloat(e.target.value))}
                      className="w-full accent-violet-500 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>

            {viewMode === 'reels' ? (
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-600/20 px-3.5 py-2 text-xs font-bold text-violet-200 backdrop-blur-sm transition-all hover:bg-violet-600 hover:text-white shadow-sm"
              >
                <FiPlus className="text-base" />
                <span>Dán link TikTok</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowNoteDrawer(true)}
                className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-600/20 px-3.5 py-2 text-xs font-bold text-emerald-200 backdrop-blur-sm transition-all hover:bg-emerald-600 hover:text-white shadow-sm"
              >
                <FiZap className="text-base" />
                <span>
                  Checklist ({completedTasksCount}/{totalTasksCount})
                </span>
              </button>
            )}
          </div>
        </div>

        {/* ─── 🎯 WIDGET: ĐẾM NGƯỢC NGÀY THI CSCA & TRƯỜNG ĐẠI HỌC MƠ ƯỚC ───── */}
        <div className="mb-6 rounded-2xl border border-violet-500/25 bg-gradient-to-r from-violet-950/60 via-slate-900/90 to-indigo-950/60 px-4 py-3 shadow-lg backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 sm:gap-5">
              {/* Dream University & Target Score */}
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-300">
                  <FaGraduationCap className="text-lg" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm font-black text-white">
                    <span>🎓 Mục tiêu: {dreamGoal.dreamUni}</span>
                    <span className="text-slate-500">•</span>
                    <span className="rounded-lg bg-amber-500/15 px-2 py-0.5 text-[11px] font-extrabold text-amber-300 border border-amber-500/30">
                      Điểm: {dreamGoal.targetScore}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Mỗi chu kỳ Pomodoro hôm nay đưa bạn tiến gần hơn tới cánh cổng trường mơ ước!
                  </p>
                </div>
              </div>

              <div className="hidden md:block h-7 w-px bg-white/10" />

              {/* Exam Countdown Pill */}
              <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5">
                <span className="text-xs font-extrabold text-rose-300">
                  ⏳ Còn <strong className="text-sm text-white">{daysUntilExam}</strong> ngày tới kỳ thi CSCA
                </span>
                <span className="text-[10px] text-rose-200/70 hidden sm:inline">
                  ({dreamGoal.examDate})
                </span>
              </div>
            </div>

            {/* Right Actions: Today Focus Stats + Edit Dream Goal Button */}
            <div className="flex items-center gap-2.5">
              <div className="hidden sm:flex items-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-bold text-emerald-300">
                <FiClock className="text-xs" />
                <span>Hôm nay: {myStats.todayMinutes} phút tập trung</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditDreamUni(dreamGoal.dreamUni);
                  setEditTargetScore(dreamGoal.targetScore);
                  setEditExamDate(dreamGoal.examDate);
                  setShowDreamModal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-violet-400/30 bg-violet-500/15 px-3 py-1.5 text-xs font-bold text-violet-200 transition-all hover:bg-violet-600 hover:text-white active:scale-95"
              >
                <FiEdit3 className="text-xs" />
                <span>Chỉnh sửa mục tiêu</span>
              </button>
            </div>
          </div>
        </div>

        {/* ─── VIEW MODE: PHÒNG TỰ HỌC BẬT CAM ───────────────────────────────── */}
        {viewMode === 'room' && (
          <div className="space-y-6">
            {/* 1. ĐỒNG HỒ LẬT POMODORO TRUNG TÂM */}
            <div className="mx-auto w-full max-w-3xl flex flex-col items-center">
              <FlipClock
                isCompact={false}
                studyGoal={
                  studyNote ||
                  (studyTasks.length > 0
                    ? `Hoàn thành ${completedTasksCount}/${totalTasksCount} nhiệm vụ (${taskProgressPercent}%)`
                    : '')
                }
                onEditGoal={() => setShowNoteDrawer(true)}
                quote={MOTIVATION_QUOTES[quoteIndex]}
                onNextQuote={() =>
                  setQuoteIndex((prev) => (prev + 1) % MOTIVATION_QUOTES.length)
                }
                onSessionComplete={handlePomodoroSessionComplete}
                className="w-full"
              />
            </div>

            {/* 1.5. CHECKLIST MỤC TIÊU CA HỌC & BẢNG XẾP HẠNG CHIẾN THẦN TỰ HỌC */}
            <div className="mx-auto w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left 7 Cols: Interactive Study To-Do List with Progress Bar */}
              <div className="lg:col-span-7 rounded-3xl border border-white/15 bg-slate-900/80 p-5 shadow-xl backdrop-blur-md flex flex-col justify-between">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
                        <FiCheck className="text-base" />
                      </span>
                      <div>
                        <h3 className="text-sm font-black text-white">
                          Checklist Mục Tiêu Ca Học Hôm Nay
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Tích chọn từng nhiệm vụ ngay khi hoàn thành để duy trì hưng phấn
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-extrabold text-emerald-300">
                        {completedTasksCount}/{totalTasksCount} nhiệm vụ • {taskProgressPercent}%
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowNoteDrawer(true)}
                        className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-bold text-violet-300 hover:bg-white/10 hover:text-white"
                      >
                        Lời hứa ↗
                      </button>
                    </div>
                  </div>

                  {/* Sleek Progress Bar */}
                  <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-violet-500 transition-all duration-500"
                      style={{ width: `${taskProgressPercent}%` }}
                    />
                  </div>

                  {/* Quick-Add Preset Chips */}
                  <div className="mb-3 flex flex-wrap items-center gap-1.5">
                    {PRESET_TASK_CHIPS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleAddStudyTask(preset)}
                        className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold text-slate-300 transition-all hover:border-emerald-500/40 hover:bg-emerald-500/15 hover:text-emerald-200 active:scale-95"
                      >
                        + {preset}
                      </button>
                    ))}
                  </div>

                  {/* Task Items List */}
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1 hide-scrollbar">
                    {studyTasks.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/15 py-6 text-center text-xs text-slate-400">
                        Chưa có nhiệm vụ nào. Hãy bấm chip gợi ý phía trên hoặc nhập mục tiêu mới!
                      </div>
                    ) : (
                      studyTasks.map((task) => (
                        <div
                          key={task.id}
                          className={`group flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5 transition-all ${
                            task.done
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-slate-400'
                              : 'border-white/10 bg-white/[0.03] text-white hover:border-white/20'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleToggleTask(task.id)}
                            className="flex flex-1 items-center gap-3 text-left"
                          >
                            <span
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border transition-all ${
                                task.done
                                  ? 'border-emerald-500 bg-emerald-500 text-slate-950'
                                  : 'border-white/25 bg-slate-900 hover:border-violet-400'
                              }`}
                            >
                              {task.done && <FiCheck className="text-xs stroke-[3]" />}
                            </span>
                            <span
                              className={`text-xs font-semibold ${
                                task.done ? 'line-through text-slate-400' : 'text-slate-100'
                              }`}
                            >
                              {task.text}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteStudyTask(task.id)}
                            className="opacity-60 group-hover:opacity-100 rounded-lg p-1 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400 transition-all"
                            title="Xóa nhiệm vụ"
                          >
                            <FiTrash2 className="text-xs" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Add Custom Task Input */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAddStudyTask();
                  }}
                  className="mt-3.5 flex items-center gap-2 pt-3 border-t border-white/10"
                >
                  <input
                    type="text"
                    value={newTaskInput}
                    onChange={(e) => setNewTaskInput(e.target.value)}
                    placeholder="Nhập thêm mục tiêu buổi học (VD: Làm 20 câu Đọc hiểu)..."
                    className="flex-1 rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!newTaskInput.trim()}
                    className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-emerald-500 disabled:opacity-40"
                  >
                    <FiPlus className="text-sm" />
                    <span>Thêm</span>
                  </button>
                </form>
              </div>

              {/* Right 5 Cols: Bảng Xếp Hạng Chiến Thần Tự Học Card */}
              <div className="lg:col-span-5 rounded-3xl border border-white/15 bg-slate-900/80 p-5 shadow-xl backdrop-blur-md flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400">
                        <FaTrophy className="text-sm" />
                      </span>
                      <div>
                        <h3 className="text-sm font-black text-white">
                          BXH Chiến Thần Tự Học
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Tự động cộng điểm khi hoàn thành Pomodoro
                        </p>
                      </div>
                    </div>

                    {/* Period Toggle */}
                    <div className="flex rounded-xl border border-white/10 bg-slate-950 p-0.5 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => setLeaderboardPeriod('today')}
                        className={`rounded-lg px-2.5 py-1 transition-all ${
                          leaderboardPeriod === 'today'
                            ? 'bg-amber-500 text-slate-950 font-black'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Hôm nay
                      </button>
                      <button
                        type="button"
                        onClick={() => setLeaderboardPeriod('week')}
                        className={`rounded-lg px-2.5 py-1 transition-all ${
                          leaderboardPeriod === 'week'
                            ? 'bg-amber-500 text-slate-950 font-black'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        7 ngày qua
                      </button>
                    </div>
                  </div>

                  {/* Top 4 Leaderboard List */}
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1 hide-scrollbar">
                    {isLoadingLeaderboard && activeLeaderboardRows.length === 0 ? (
                      <div className="flex items-center justify-center py-8 text-xs text-slate-400 gap-2">
                        <FiRefreshCw className="animate-spin text-amber-400" />
                        <span>Đang tải bảng vàng chăm chỉ...</span>
                      </div>
                    ) : activeLeaderboardRows.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/15 py-6 px-4 text-center text-xs text-slate-400">
                        Chưa có phiên học nào được ghi nhận. Hoàn thành 1 chu kỳ Pomodoro để giành Top 1 ngay hôm nay!
                      </div>
                    ) : (
                      activeLeaderboardRows.slice(0, 4).map((item, idx) => (
                        <div
                          key={`${item.userName}-${idx}`}
                          className="flex items-center justify-between gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-black ${
                                idx === 0
                                  ? 'bg-amber-400 text-slate-950'
                                  : idx === 1
                                  ? 'bg-slate-300 text-slate-950'
                                  : idx === 2
                                  ? 'bg-amber-700 text-white'
                                  : 'bg-white/10 text-slate-300'
                              }`}
                            >
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">
                                {item.userName}
                              </p>
                              <p className="text-[10px] text-violet-300 truncate">
                                🎓 {item.dreamUniversity || 'ĐH Mơ Ước CSCA'}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-xs font-black text-amber-300">
                              {item.totalMinutes} phút
                            </span>
                            <p className="text-[10px] text-slate-400">
                              {item.sessionsCount} ca học
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* My Stats Footer & Open Full Leaderboard Modal */}
                <div className="mt-3.5 flex items-center justify-between border-t border-white/10 pt-3 text-xs">
                  <div className="text-[11px] text-slate-300">
                    Của bạn:{' '}
                    <strong className="text-emerald-400">{myStats.todayMinutes}p</strong> hôm nay •{' '}
                    <strong className="text-violet-300">{myStats.weekMinutes}p</strong> tuần này
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLeaderboardModal(true)}
                    className="text-[11px] font-bold text-amber-300 hover:text-amber-200 underline underline-offset-2"
                  >
                    Xem đầy đủ ↗
                  </button>
                </div>
              </div>
            </div>

            {/* 2. PHÒNG TỰ HỌC BẬT CAM (STUDY TOGETHER) */}
            <VirtualStudyRoom />
          </div>
        )}

        {/* ─── VIEW MODE: TIKTOK REELS (LƯỚT MƯỢT CHUẨN TIKTOK) ──────────────── */}
        {viewMode === 'reels' && (
          <div className="py-1">
            {/* DESKTOP & TABLET 3-COLUMN GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* ─── CỘT 1 (BÊN TRÁI): KHO VIDEO TIẾP LỬA (PLAYLIST) ─── */}
              <div className="hidden lg:flex lg:col-span-3 flex-col rounded-3xl border border-white/10 bg-slate-900/70 p-4 shadow-xl backdrop-blur-md h-[78vh] max-h-[820px]">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-violet-600/30 text-violet-300 border border-violet-500/30 text-xs">
                      <FiFilm />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-white uppercase tracking-wider">
                        Kho Video Tiếp Lửa
                      </h3>
                      <p className="text-[10px] text-slate-400">Chạm hoặc lăn chuột để lướt</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold text-violet-300 border border-violet-500/20">
                    {filteredVideos.length} video
                  </span>
                </div>

                {/* Playlist Video Items */}
                <div className="flex-1 overflow-y-auto space-y-2 py-3 pr-1 hide-scrollbar">
                  {filteredVideos.map((vid, idx) => {
                    const isCurrent = idx === currentIndex;
                    const vidLikes = likeCountMap[vid.id] ?? vid.likes;
                    return (
                      <button
                        key={`playlist-desktop-${vid.id}-${idx}`}
                        type="button"
                        onClick={() => selectVideoByIndex(idx)}
                        className={`w-full text-left rounded-2xl p-2.5 transition-all flex items-start gap-2.5 border ${
                          isCurrent
                            ? 'border-violet-500/80 bg-violet-600/20 shadow-md shadow-violet-500/15 ring-1 ring-violet-400/30'
                            : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/15'
                        }`}
                      >
                        {/* Status Icon or Equalizer */}
                        <div
                          className={`shrink-0 flex h-9 w-9 items-center justify-center rounded-xl font-black text-xs transition-all ${
                            isCurrent
                              ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/30'
                              : 'bg-white/5 text-slate-400'
                          }`}
                        >
                          {isCurrent ? (
                            <span className="flex items-end gap-0.5 h-3.5">
                              <span className="w-0.5 h-full bg-white animate-pulse" />
                              <span className="w-0.5 h-2/3 bg-white animate-pulse delay-75" />
                              <span className="w-0.5 h-full bg-white animate-pulse delay-150" />
                            </span>
                          ) : (
                            <span>{idx + 1}</span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="rounded px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider bg-violet-500/20 text-violet-300 border border-violet-500/20">
                              {vid.category === 'scholarship'
                                ? 'Học Bổng'
                                : vid.category === 'exam'
                                ? 'Ôn Thi'
                                : vid.category === 'tips'
                                ? 'Tips'
                                : 'Kỷ Luật'}
                            </span>
                            <span className="text-[10px] text-slate-400 truncate">
                              {vid.creatorHandle}
                            </span>
                          </div>
                          <h4
                            className={`text-xs font-bold leading-snug line-clamp-2 ${
                              isCurrent ? 'text-white' : 'text-slate-300'
                            }`}
                          >
                            {vid.title}
                          </h4>
                          <div className="mt-1 flex items-center justify-between text-[10px]">
                            <span className="flex items-center gap-1 text-rose-400 font-semibold">
                              <FaHeart className="text-[9px]" />{' '}
                              {vidLikes >= 1000 ? `${(vidLikes / 1000).toFixed(1)}k` : vidLikes}
                            </span>
                            {isCurrent && (
                              <span className="text-violet-300 font-extrabold text-[10px]">
                                Đang phát 🎵
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Motivational Quote at bottom of playlist */}
                <div className="mt-auto rounded-2xl border border-white/5 bg-white/[0.02] p-3 text-[10px] text-slate-400">
                  <div className="flex items-center gap-1 font-bold text-amber-300 mb-0.5">
                    <FaFire className="text-xs text-orange-400" /> Bí quyết đỗ CSCA
                  </div>
                  <p className="line-clamp-2 italic text-slate-300">
                    &ldquo;Xem 1 video lấy cảm hứng, sau đó bấm sang Phòng Tự Học để biến động lực thành kết quả!&rdquo;
                  </p>
                </div>
              </div>

              {/* ─── CỘT 2 (Ở GIỮA): TIKTOK VERTICAL STAGE + FLOATING ACTION RAIL ─── */}
              <div
                className="lg:col-span-5 flex flex-col items-center w-full mx-auto select-none"
                onWheel={handleReelsWheel}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                {filteredVideos.length === 0 ? (
                  <div className="flex min-h-[480px] w-full max-w-[390px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/20 p-8 text-center bg-white/5">
                    <FiBookmark className="mb-3 text-4xl text-slate-500" />
                    <h3 className="text-base font-bold">Chưa có video nào ở mục này</h3>
                    <p className="mt-1 text-xs text-slate-400">
                      Hãy bấm ngôi sao ⭐ lưu video yêu thích hoặc dán link TikTok mới vào nhé!
                    </p>
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('all')}
                      className="mt-4 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-violet-600/30"
                    >
                      Xem tất cả video
                    </button>
                  </div>
                ) : (
                  <div className="relative flex flex-col items-center w-full">
                    {/* MAIN REELS STAGE: PHONE FRAME + TIKTOK RIGHT DOCK */}
                    <div className="relative flex items-center justify-center gap-3 sm:gap-4">
                      {/* PHONE FRAME (325x585) WITH DIRECTIONAL SLIDE ANIMATION */}
                      <div
                        key={`reel-stage-${currentVideo?.id}-${currentIndex}`}
                        className={`relative w-[325px] h-[585px] overflow-hidden rounded-[28px] border border-white/15 bg-black shadow-[0_20px_65px_-15px_rgba(124,58,237,0.45)] ring-1 ring-white/10 ${
                          slideDirection === 'up'
                            ? 'animate-reel-slide-up'
                            : 'animate-reel-slide-down'
                        }`}
                      >
                        {/* Top sleek shimmer line while iframe initializes */}
                        {iframeLoading && (
                          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-violet-500 via-pink-500 to-amber-400 animate-pulse z-30" />
                        )}

                        {/* Floating Heart Burst Animation on Like */}
                        {heartBurst && (
                          <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
                            <FaHeart className="text-7xl text-rose-500 drop-shadow-[0_0_30px_rgba(244,63,94,0.9)] animate-ping" />
                          </div>
                        )}

                        {/* Fast Non-Blocking Glassmorphic Preview Overlay (fades out within 600ms) */}
                        <div
                          className={`pointer-events-none absolute inset-0 z-20 flex flex-col justify-between bg-gradient-to-b from-slate-950/90 via-slate-950/60 to-slate-950/95 p-5 transition-opacity duration-300 ${
                            iframeLoading ? 'opacity-100' : 'opacity-0'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="rounded-full bg-violet-500/20 px-2.5 py-0.5 text-[10px] font-black text-violet-300 border border-violet-500/30">
                              {currentVideo?.creatorHandle}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">
                              #{currentIndex + 1}/{filteredVideos.length}
                            </span>
                          </div>

                          <div className="my-auto flex flex-col items-center text-center px-2">
                            <div className="h-9 w-9 animate-spin rounded-full border-2 border-violet-500 border-t-transparent mb-3" />
                            <p className="text-sm font-extrabold text-white line-clamp-2">
                              {currentVideo?.title}
                            </p>
                            <p className="mt-2 text-xs italic text-violet-200/90 line-clamp-3">
                              &ldquo;{currentVideo?.message}&rdquo;
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-1 justify-center">
                            {currentVideo?.tags.map((t) => (
                              <span
                                key={t}
                                className="text-[10px] font-bold text-violet-300/80"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* TikTok Embed Player - exact 325px width */}
                        {currentVideo && (
                          <iframe
                            key={currentVideo.id}
                            src={`https://www.tiktok.com/embed/v2/${currentVideo.id}?autoplay=1`}
                            title={currentVideo.title}
                            onLoad={() => setIframeLoading(false)}
                            className="w-[325px] h-full border-none block"
                            scrolling="no"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                          />
                        )}
                      </div>

                      {/* ─── FLOATING TIKTOK ACTION RAIL (RIGHT SIDE DOCK) ─── */}
                      {currentVideo && (
                        <div className="flex flex-col items-center gap-3 py-2">
                          {/* Up (Prev Video) Button */}
                          <button
                            type="button"
                            onClick={handlePrevVideo}
                            className="group flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-slate-900/90 text-slate-200 shadow-lg backdrop-blur-md transition-all hover:border-violet-500/50 hover:bg-violet-600 hover:text-white active:scale-90"
                            title="Video trước (Phím ↑ hoặc lăn chuột lên)"
                          >
                            <FiChevronUp className="text-xl transition-transform group-hover:-translate-y-0.5" />
                          </button>

                          {/* Index Badge */}
                          <div className="rounded-xl border border-white/10 bg-slate-900/80 px-2.5 py-1 text-[10px] font-black text-slate-300">
                            <span className="text-violet-400">{currentIndex + 1}</span>/
                            {filteredVideos.length}
                          </div>

                          {/* Down (Next Video) Button */}
                          <button
                            type="button"
                            onClick={handleNextVideo}
                            className="group flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/35 transition-all hover:brightness-110 active:scale-90"
                            title="Video tiếp theo (Phím ↓ hoặc lăn chuột xuống)"
                          >
                            <FiChevronDown className="text-xl transition-transform group-hover:translate-y-0.5" />
                          </button>

                          <div className="my-0.5 h-px w-6 bg-white/10" />

                          {/* Like / Heart Button */}
                          <div className="flex flex-col items-center">
                            <button
                              type="button"
                              onClick={() => toggleLike(currentVideo.id)}
                              className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition-all active:scale-75 ${
                                isCurrentLiked
                                  ? 'border-rose-500/50 bg-rose-500/20 text-rose-500 shadow-lg shadow-rose-500/25'
                                  : 'border-white/15 bg-slate-900/90 text-slate-300 hover:bg-white/10 hover:text-rose-400'
                              }`}
                              title="Thả tim tiếp lửa (Phím L)"
                            >
                              <FaHeart className="text-lg" />
                            </button>
                            <span className="mt-1 text-[10px] font-bold text-slate-300">
                              {currentLikesCount >= 1000
                                ? `${(currentLikesCount / 1000).toFixed(1)}k`
                                : currentLikesCount}
                            </span>
                          </div>

                          {/* Bookmark / Save Button */}
                          <div className="flex flex-col items-center">
                            <button
                              type="button"
                              onClick={() => toggleBookmark(currentVideo.id)}
                              className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition-all active:scale-75 ${
                                isCurrentSaved
                                  ? 'border-amber-500/50 bg-amber-500/20 text-amber-400 shadow-lg shadow-amber-500/25'
                                  : 'border-white/15 bg-slate-900/90 text-slate-300 hover:bg-white/10 hover:text-amber-300'
                              }`}
                              title="Lưu vào kho video yêu thích"
                            >
                              <FaBookmark className="text-base" />
                            </button>
                            <span className="mt-1 text-[10px] font-bold text-slate-400">
                              {isCurrentSaved ? 'Đã lưu' : 'Lưu'}
                            </span>
                          </div>

                          {/* Copy / Share Link Button */}
                          <div className="flex flex-col items-center">
                            <button
                              type="button"
                              onClick={handleCopyLink}
                              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-slate-900/90 text-slate-300 transition-all hover:bg-white/10 hover:text-white active:scale-90"
                              title="Sao chép link video"
                            >
                              <FiShare2 className="text-base" />
                            </button>
                            <span className="mt-1 text-[10px] font-bold text-slate-400">
                              Chia sẻ
                            </span>
                          </div>

                          {/* Open on TikTok */}
                          <a
                            href={
                              currentVideo.originalUrl ||
                              `https://www.tiktok.com/@moly/video/${currentVideo.id}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-all"
                            title="Mở trực tiếp trên TikTok"
                          >
                            <FiExternalLink className="text-xs" />
                          </a>

                          {/* Delete button if custom video or Admin */}
                          {canDeleteCurrentVideo && (
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomVideo(currentVideo.id)}
                              className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-600 hover:text-white transition-all"
                              title="Xóa video khỏi Trạm Động Lực"
                            >
                              <FiTrash2 className="text-xs" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* MOTIVATIONAL CAPTION & MESSAGE CARD BELOW PLAYER */}
                    {currentVideo && (
                      <div className="mt-3 w-full max-w-[380px] rounded-2xl border border-white/10 bg-slate-900/80 p-3 backdrop-blur-md">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-extrabold text-white truncate">
                            {currentVideo.title}
                          </span>
                          <span className="shrink-0 text-[10px] font-bold text-violet-400">
                            {currentVideo.creatorHandle}
                          </span>
                        </div>
                        <p className="text-[11px] italic text-slate-300 leading-relaxed">
                          &ldquo;{currentVideo.message}&rdquo;
                        </p>
                      </div>
                    )}

                    {/* CATEGORY FILTER PILLS */}
                    <div className="w-full max-w-[385px] flex items-center justify-start sm:justify-center gap-1.5 overflow-x-auto py-2.5 my-0.5 hide-scrollbar [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {CATEGORIES.map((cat) => {
                        const active = selectedCategory === cat.key;
                        return (
                          <button
                            key={cat.key}
                            type="button"
                            onClick={() => setSelectedCategory(cat.key)}
                            className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold transition-all ${
                              active
                                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/25 ring-1 ring-violet-400/40'
                                : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            {cat.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Hints & Add Video Link */}
                    <div className="mt-0.5 flex items-center justify-between text-xs text-slate-400 w-full max-w-[380px] px-1">
                      <span className="flex items-center gap-1 text-[10px] text-slate-400">
                        💡 Lăn chuột, vuốt dọc hoặc bấm{' '}
                        <kbd className="rounded bg-white/10 px-1 py-0.5 text-slate-300 font-mono text-[9px]">
                          ↑
                        </kbd>{' '}
                        <kbd className="rounded bg-white/10 px-1 py-0.5 text-slate-300 font-mono text-[9px]">
                          ↓
                        </kbd>{' '}
                        để lướt
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowAddModal(true)}
                        className="text-violet-400 hover:text-violet-300 font-semibold flex items-center gap-1 text-[10px] underline underline-offset-2"
                      >
                        + Dán link TikTok ↗
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ─── CỘT 3 (BÊN PHẢI): GÓC CHAT TIẾP SỨC SĨ TỬ (LIVE CHAT ĐỘNG VIÊN) ─── */}
              <div className="hidden lg:flex lg:col-span-4 flex-col rounded-3xl border border-white/10 bg-slate-900/70 p-4 shadow-xl backdrop-blur-md h-[78vh] max-h-[820px]">
                {/* Chat Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-pink-600/30 text-pink-300 border border-pink-500/30 text-xs">
                      <FiMessageSquare />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-white uppercase tracking-wider">
                        Góc Tiếp Sức Sĩ Tử
                      </h3>
                      <p className="text-[10px] text-slate-400">
                        Động viên & chia sẻ cùng cộng đồng CSCA
                      </p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Trực tuyến 24/7
                  </span>
                </div>

                {/* Quick Cheer Reaction Pills */}
                <div className="py-2.5 flex items-center gap-1.5 overflow-x-auto hide-scrollbar border-b border-white/5">
                  <span className="text-[10px] font-bold text-slate-400 shrink-0">
                    Bấm tiếp lửa:
                  </span>
                  {QUICK_CHEERS.map((cheer, cIdx) => (
                    <button
                      key={cIdx}
                      type="button"
                      onClick={() => handleSendChatMessage(undefined, cheer.text)}
                      className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-bold text-slate-300 hover:border-violet-500/40 hover:bg-violet-600/20 hover:text-white transition-all active:scale-95"
                      title="Gửi nhanh vào khung chat"
                    >
                      {cheer.label}
                    </button>
                  ))}
                </div>

                {/* Message Stream */}
                <div className="flex-1 overflow-y-auto space-y-2.5 py-3 pr-1 hide-scrollbar">
                  {isLoadingChats ? (
                    <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-slate-500 py-10">
                      <FiRefreshCw className="animate-spin text-xl mb-2 text-violet-400" />
                      <span className="text-xs">Đang kết nối tin nhắn...</span>
                    </div>
                  ) : chatMessages.length === 0 ? (
                    <div className="flex h-full min-h-[220px] flex-col items-center justify-center text-slate-400 py-8 px-4 text-center">
                      <span className="text-3xl mb-2">💬</span>
                      <p className="text-xs font-bold text-slate-200">
                        Chưa có lời cổ vũ nào hôm nay
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1 max-w-[220px]">
                        Hãy là người đầu tiên gửi lời chúc hoặc bấm nút tiếp lửa bên trên để cùng nhau bứt phá! 🔥
                      </p>
                    </div>
                  ) : (
                    chatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex flex-col gap-1 rounded-2xl p-2.5 transition-all text-xs ${
                          msg.isMe
                            ? 'bg-violet-600/20 border border-violet-500/30 ml-4'
                            : 'bg-white/[0.03] border border-white/5 mr-4'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <div
                              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-white ${
                                msg.isMe ? 'bg-violet-600' : 'bg-slate-700'
                              }`}
                            >
                              {msg.sender.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-bold text-slate-200 text-[11px] truncate max-w-[110px]">
                              {msg.sender}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.2 text-[8px] font-bold uppercase tracking-wider border ${msg.badgeColor}`}
                            >
                              {msg.badge}
                            </span>
                          </div>
                          <span className="text-[9px] text-slate-500 shrink-0">
                            {msg.time}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-snug pl-6 font-medium break-words">
                          {msg.text}
                        </p>
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Chat Input */}
                <form
                  onSubmit={(e) => handleSendChatMessage(e)}
                  className="mt-2 flex items-center gap-1.5 pt-2 border-t border-white/10"
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Gửi lời chúc, động viên đến mọi người..."
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim()}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-white transition-all hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-violet-600/30"
                    title="Gửi tin nhắn"
                  >
                    <FiSend className="text-xs" />
                  </button>
                </form>
              </div>
            </div>

            {/* ─── MOBILE ONLY TABS (GÓC CHAT & PLAYLIST DƯỚI VIDEO TRÊN ĐIỆN THOẠI) ─── */}
            <div className="lg:hidden w-full max-w-[420px] mx-auto mt-6">
              <div className="flex rounded-2xl border border-white/10 bg-white/5 p-1 mb-3">
                <button
                  type="button"
                  onClick={() => setMobileReelsTab('chat')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    mobileReelsTab === 'chat'
                      ? 'bg-violet-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FiMessageSquare className="text-xs" />
                  <span>Góc Tiếp Sức ({chatMessages.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMobileReelsTab('playlist')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    mobileReelsTab === 'playlist'
                      ? 'bg-violet-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FiFilm className="text-xs" />
                  <span>Kho Video ({filteredVideos.length})</span>
                </button>
              </div>

              {mobileReelsTab === 'chat' ? (
                <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-4 shadow-xl backdrop-blur-md">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
                    <span className="text-xs font-bold text-white">Góc Tiếp Sức Sĩ Tử</span>
                    <span className="text-[10px] text-emerald-400 font-bold">
                      🟢 Trực tuyến 24/7
                    </span>
                  </div>

                  {/* Quick cheers on mobile */}
                  <div className="py-1.5 flex items-center gap-1.5 overflow-x-auto hide-scrollbar mb-2">
                    {QUICK_CHEERS.map((cheer, cIdx) => (
                      <button
                        key={cIdx}
                        type="button"
                        onClick={() => handleSendChatMessage(undefined, cheer.text)}
                        className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-bold text-slate-300"
                      >
                        {cheer.label}
                      </button>
                    ))}
                  </div>

                  <div className="max-h-[260px] overflow-y-auto space-y-2 pr-1 hide-scrollbar mb-2">
                    {isLoadingChats ? (
                      <div className="flex flex-col items-center justify-center py-6 text-slate-500 text-xs">
                        <FiRefreshCw className="animate-spin mb-1 text-violet-400" />
                        <span>Đang tải tin nhắn...</span>
                      </div>
                    ) : chatMessages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-6 px-3 text-center text-slate-400">
                        <span className="text-2xl mb-1">💬</span>
                        <p className="text-xs font-bold text-slate-200">
                          Chưa có tin nhắn nào
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Hãy gửi lời chúc hoặc bấm nút tiếp lửa bên trên! 🔥
                        </p>
                      </div>
                    ) : (
                      chatMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`rounded-xl p-2 text-xs border ${
                            msg.isMe
                              ? 'bg-violet-600/20 border-violet-500/30'
                              : 'bg-white/5 border-white/5'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                            <span className="font-bold text-slate-200">{msg.sender}</span>
                            <span>{msg.time}</span>
                          </div>
                          <p className="text-[11px] text-slate-300">{msg.text}</p>
                        </div>
                      ))
                    )}
                  </div>

                  <form
                    onSubmit={(e) => handleSendChatMessage(e)}
                    className="flex items-center gap-1.5 pt-2 border-t border-white/10"
                  >
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Gửi lời động viên..."
                      className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim()}
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 text-white disabled:opacity-40"
                    >
                      <FiSend className="text-xs" />
                    </button>
                  </form>
                </div>
              ) : (
                <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-4 shadow-xl backdrop-blur-md max-h-[360px] overflow-y-auto space-y-2 hide-scrollbar">
                  {filteredVideos.map((vid, idx) => {
                    const isCurrent = idx === currentIndex;
                    return (
                      <button
                        key={`playlist-mobile-${vid.id}-${idx}`}
                        type="button"
                        onClick={() => selectVideoByIndex(idx)}
                        className={`w-full text-left rounded-xl p-2 transition-all flex items-center gap-2 border ${
                          isCurrent
                            ? 'border-violet-500 bg-violet-600/20 shadow-sm'
                            : 'border-white/5 bg-white/5'
                        }`}
                      >
                        <div
                          className={`h-7 w-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                            isCurrent
                              ? 'bg-violet-600 text-white'
                              : 'bg-white/10 text-slate-400'
                          }`}
                        >
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-xs font-bold truncate ${
                              isCurrent ? 'text-white' : 'text-slate-300'
                            }`}
                          >
                            {vid.title}
                          </p>
                          <span className="text-[10px] text-slate-400">
                            {vid.creatorHandle}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ─── MODAL: DÁN LINK TIKTOK (CHIA SẺ CỘNG ĐỒNG SQL) ────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl border border-white/15 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-white">
                  Chia Sẻ Video TikTok Truyền Động Lực
                </h3>
                <p className="text-[11px] text-slate-400">
                  Video sẽ được lưu vào Trạm Động Lực để truyền lửa cho toàn bộ học viên
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <FiX className="text-lg" />
              </button>
            </div>

            <form onSubmit={handleAddVideo} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300">
                  Link video TikTok hoặc ID video:
                </label>
                <input
                  type="text"
                  required
                  placeholder="https://www.tiktok.com/@user/video/739..."
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  className="mt-1.5 w-full rounded-2xl border border-white/15 bg-slate-950 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Hỗ trợ link web TikTok hoặc chuỗi số ID video.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300">
                  Tiêu đề video:
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Động lực thức khuya giải đề CSCA"
                  value={inputTitle}
                  onChange={(e) => setInputTitle(e.target.value)}
                  className="mt-1.5 w-full rounded-2xl border border-white/15 bg-slate-950 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300">Chủ đề:</label>
                <select
                  value={inputCategory}
                  onChange={(e) =>
                    setInputCategory(e.target.value as MotivationVideo['category'])
                  }
                  className="mt-1.5 w-full rounded-2xl border border-white/15 bg-slate-950 px-4 py-2.5 text-xs text-white focus:border-violet-500 focus:outline-none"
                >
                  <option value="discipline">Ý chí & Kỷ luật</option>
                  <option value="exam">Thức khuya ôn thi</option>
                  <option value="scholarship">Học bổng & Du học</option>
                  <option value="tips">Tips học thông minh</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300">
                  Lời nhắn gửi cho cộng đồng & bản thân:
                </label>
                <textarea
                  rows={2}
                  placeholder="Mục tiêu thi đạt bao nhiêu điểm? Nhắn nhủ cùng cố gắng..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  className="mt-1.5 w-full rounded-2xl border border-white/15 bg-slate-950 px-4 py-2 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-slate-400 hover:bg-white/5"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-violet-600/30 hover:brightness-110"
                >
                  Chia sẻ lên Trạm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: LỜI HỨA KỶ LUẬT & CHECKLIST MỤC TIÊU HÔM NAY ────────────── */}
      {showNoteDrawer && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-3xl border border-white/15 bg-slate-900 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <FiZap className="text-amber-400" />
                <h3 className="text-base font-extrabold text-white">
                  Checklist & Lời Hứa Kỷ Luật Hôm Nay
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNoteDrawer(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <FiX className="text-lg" />
              </button>
            </div>

            {/* Progress indicator */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-bold text-slate-300">Tiến độ hoàn thành hôm nay:</span>
                <span className="font-extrabold text-emerald-400">
                  {completedTasksCount}/{totalTasksCount} nhiệm vụ • {taskProgressPercent}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-violet-500 transition-all duration-300"
                  style={{ width: `${taskProgressPercent}%` }}
                />
              </div>
            </div>

            {/* Preset quick-add chips */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {PRESET_TASK_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleAddStudyTask(chip)}
                  className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold text-slate-300 hover:border-emerald-500/40 hover:bg-emerald-500/15 hover:text-emerald-200"
                >
                  + {chip}
                </button>
              ))}
            </div>

            {/* Task list inside modal */}
            <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
              {studyTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-950 px-3 py-2"
                >
                  <button
                    type="button"
                    onClick={() => handleToggleTask(task.id)}
                    className="flex flex-1 items-center gap-2.5 text-left"
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        task.done
                          ? 'border-emerald-500 bg-emerald-500 text-slate-950'
                          : 'border-white/25'
                      }`}
                    >
                      {task.done && <FiCheck className="text-[10px] stroke-[3]" />}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        task.done ? 'line-through text-slate-500' : 'text-slate-200'
                      }`}
                    >
                      {task.text}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteStudyTask(task.id)}
                    className="text-slate-500 hover:text-rose-400 p-1"
                  >
                    <FiTrash2 className="text-xs" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add task input */}
            <div className="mt-2.5 flex gap-2">
              <input
                type="text"
                value={newTaskInput}
                onChange={(e) => setNewTaskInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddStudyTask();
                  }
                }}
                placeholder="Thêm nhiệm vụ mới..."
                className="flex-1 rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleAddStudyTask()}
                className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-500"
              >
                + Thêm
              </button>
            </div>

            {/* Commitment Note */}
            <div className="mt-4 pt-3 border-t border-white/10">
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Lời hứa cam kết kỷ luật của bạn:
              </label>
              <textarea
                rows={3}
                placeholder="Ví dụ: Tối nay từ 20h - 22h, mình cam kết hoàn thành 1 đề mô phỏng Toán CSCA và tuyệt đối không lướt mạng xã hội!"
                value={studyNote}
                onChange={(e) => {
                  setStudyNote(e.target.value);
                  try {
                    localStorage.setItem('moly:dongluc_study_note', e.target.value);
                  } catch {}
                }}
                className="w-full rounded-2xl border border-white/15 bg-slate-950 p-3.5 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
              />
            </div>

            <div className="mt-4 flex items-center justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowNoteDrawer(false);
                  showToast('✅ Đã lưu Checklist & Lời hứa! Chúc bạn có buổi học bứt phá!');
                }}
                className="rounded-xl bg-violet-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-violet-600/30 hover:bg-violet-500"
              >
                Lưu mục tiêu & Bắt đầu học
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: CHỈNH SỬA MỤC TIÊU ĐẠI HỌC MƠ ƯỚC & NGÀY THI CSCA ───────── */}
      {showDreamModal && (
        <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl border border-white/15 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <FaGraduationCap className="text-xl text-amber-400" />
                <h3 className="text-base font-extrabold text-white">
                  Mục Tiêu Đại Học & Kỳ Thi CSCA
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDreamModal(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <FiX className="text-lg" />
              </button>
            </div>

            <form onSubmit={handleSaveDreamGoal} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Chọn nhanh trường đại học mơ ước:
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {PRESET_UNIVERSITIES.map((uni) => (
                    <button
                      key={uni}
                      type="button"
                      onClick={() => setEditDreamUni(uni)}
                      className={`rounded-xl px-2.5 py-1 text-[10px] font-bold transition-all border ${
                        editDreamUni === uni
                          ? 'border-violet-400 bg-violet-600 text-white'
                          : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {uni}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  required
                  value={editDreamUni}
                  onChange={(e) => setEditDreamUni(e.target.value)}
                  placeholder="Nhập tên trường đại học mơ ước của bạn..."
                  className="w-full rounded-2xl border border-white/15 bg-slate-950 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Điểm CSCA mục tiêu:
                  </label>
                  <input
                    type="text"
                    value={editTargetScore}
                    onChange={(e) => setEditTargetScore(e.target.value)}
                    placeholder="VD: 92+ / 100"
                    className="w-full rounded-2xl border border-white/15 bg-slate-950 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Ngày thi dự kiến:
                  </label>
                  <input
                    type="date"
                    value={editExamDate}
                    onChange={(e) => setEditExamDate(e.target.value)}
                    className="w-full rounded-2xl border border-white/15 bg-slate-950 px-3.5 py-2.5 text-xs text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDreamModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-slate-400 hover:bg-white/5"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-violet-600/30 hover:brightness-110"
                >
                  Lưu mục tiêu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: 🏆 BẢNG XẾP HẠNG CHIẾN THẦN TỰ HỌC ─────────────────────── */}
      {showLeaderboardModal && (
        <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-3xl border border-white/15 bg-slate-900 p-6 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400">
                  <FaTrophy className="text-lg" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    Bảng Xếp Hạng Chiến Thần Tự Học
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Vinh danh các sĩ tử CSCA tập trung bền bỉ nhất
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLeaderboardModal(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <FiX className="text-lg" />
              </button>
            </div>

            {/* My Personal Study Summary Banner */}
            <div className="mt-4 rounded-2xl border border-violet-500/30 bg-gradient-to-r from-violet-950/60 to-indigo-950/60 p-3.5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold text-violet-300">
                  Thành tích tự học của bạn ({dreamGoal.dreamUni})
                </p>
                <div className="mt-1 flex items-center gap-4 text-xs">
                  <span>
                    Hôm nay: <strong className="text-emerald-400">{myStats.todayMinutes} phút</strong> ({myStats.todaySessions} ca)
                  </span>
                  <span>
                    7 ngày qua: <strong className="text-amber-300">{myStats.weekMinutes} phút</strong>
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleQuickCheckInSession(25)}
                className="rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-500 transition-all shadow-sm"
                title="Ghi nhận nhanh 1 ca tự học 25 phút"
              >
                + Check-in 25p học
              </button>
            </div>

            {/* Period Switcher */}
            <div className="mt-4 flex rounded-2xl border border-white/10 bg-slate-950 p-1">
              <button
                type="button"
                onClick={() => setLeaderboardPeriod('today')}
                className={`flex-1 rounded-xl py-2 text-xs font-extrabold transition-all ${
                  leaderboardPeriod === 'today'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🔥 Top Hôm Nay (24h)
              </button>
              <button
                type="button"
                onClick={() => setLeaderboardPeriod('week')}
                className={`flex-1 rounded-xl py-2 text-xs font-extrabold transition-all ${
                  leaderboardPeriod === 'week'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🏆 Top 7 Ngày Qua
              </button>
            </div>

            {/* Leaderboard Entries */}
            <div className="mt-3 flex-1 overflow-y-auto space-y-2 pr-1 hide-scrollbar">
              {isLoadingLeaderboard && activeLeaderboardRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-xs">
                  <FiRefreshCw className="animate-spin text-xl text-amber-400 mb-2" />
                  <span>Đang tải bảng xếp hạng...</span>
                </div>
              ) : activeLeaderboardRows.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/15 py-10 px-4 text-center text-xs text-slate-400">
                  Chưa có học viên nào ghi nhận giờ học trong khoảng thời gian này. Hãy bấm &ldquo;+ Check-in 25p học&rdquo; hoặc hoàn thành Pomodoro để dẫn đầu bảng vàng!
                </div>
              ) : (
                activeLeaderboardRows.map((entry, idx) => (
                  <div
                    key={`lb-modal-${entry.userName}-${idx}`}
                    className={`flex items-center justify-between gap-3 rounded-2xl border p-3 transition-all ${
                      idx === 0
                        ? 'border-amber-500/40 bg-amber-500/10'
                        : idx === 1
                        ? 'border-slate-400/30 bg-white/[0.05]'
                        : idx === 2
                        ? 'border-orange-500/30 bg-orange-500/10'
                        : 'border-white/10 bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black ${
                          idx === 0
                            ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-500/30'
                            : idx === 1
                            ? 'bg-slate-300 text-slate-950'
                            : idx === 2
                            ? 'bg-amber-700 text-white'
                            : 'bg-white/10 text-slate-300'
                        }`}
                      >
                        {idx === 0 ? <FaCrown className="text-sm" /> : idx < 3 ? <FaMedal className="text-sm" /> : idx + 1}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-white truncate">
                            {entry.userName}
                          </span>
                          {idx === 0 && (
                            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-black text-amber-300 border border-amber-500/30">
                              Quán Quân
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-violet-300 truncate mt-0.5">
                          🎓 Mục tiêu: {entry.dreamUniversity || 'Đỗ học bổng CSCA'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-black text-amber-300">
                        {entry.totalMinutes} phút
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {entry.sessionsCount} chu kỳ Pomodoro
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                💡 Mỗi chu kỳ Pomodoro hoàn thành sẽ tự động cộng giờ học cho bạn
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowLeaderboardModal(false);
                  setViewMode('room');
                }}
                className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-500"
              >
                Bắt đầu Pomodoro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Smooth vertical slide animations for TikTok Reels */}
      <style jsx global>{`
        @keyframes reelSlideUp {
          0% {
            opacity: 0.45;
            transform: translateY(34px) scale(0.985);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes reelSlideDown {
          0% {
            opacity: 0.45;
            transform: translateY(-34px) scale(0.985);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-reel-slide-up {
          animation: reelSlideUp 0.28s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .animate-reel-slide-down {
          animation: reelSlideDown 0.28s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
      `}</style>
    </div>
  );
}
