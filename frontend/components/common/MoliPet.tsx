'use client';

import { type CSSProperties, type FormEvent, type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import Lottie from 'lottie-react';
import {
  FiChevronDown,
  FiChevronUp,
  FiEyeOff,
  FiMessageCircle,
  FiRefreshCw,
  FiSend,
  FiSettings,
  FiX,
} from 'react-icons/fi';
import { usePathname } from 'next/navigation';
import axios from '@/lib/utils/axios';
import { useAuthStore } from '@/lib/store/authStore';

type PetColor = 'ocean' | 'berry' | 'leaf' | 'sun';
type PetMood = 'friendly' | 'happy' | 'focus' | 'sleepy';
type PetPosition = 'left' | 'right';

interface MoliPetSettings {
  name: string;
  color: PetColor;
  mood: PetMood;
  position: PetPosition;
  showBubble: boolean;
}

interface MoliPetProps {
  defaultPosition?: PetPosition;
}

interface PetMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SETTINGS_KEY = 'moli_pet_settings_v1';
const HIDDEN_UNTIL_KEY = 'moli_pet_hidden_until_v1';
const POSITION_KEY = 'moli_pet_position_v1';
const PET_FRAME_SIZE = 104;

interface PetPoint {
  x: number;
  y: number;
}

const COLOR_THEMES: Record<PetColor, {
  label: string;
  body: string;
  accent: string;
  button: string;
  soft: string;
  ring: string;
}> = {
  ocean: {
    label: 'Biển xanh',
    body: 'from-sky-300 via-cyan-300 to-blue-500',
    accent: 'bg-cyan-200',
    button: 'bg-cyan-600 hover:bg-cyan-700',
    soft: 'bg-cyan-50 border-cyan-100 text-cyan-800',
    ring: 'ring-cyan-200/70',
  },
  berry: {
    label: 'Dâu hồng',
    body: 'from-rose-300 via-pink-300 to-fuchsia-500',
    accent: 'bg-rose-200',
    button: 'bg-rose-600 hover:bg-rose-700',
    soft: 'bg-rose-50 border-rose-100 text-rose-800',
    ring: 'ring-rose-200/70',
  },
  leaf: {
    label: 'Lá non',
    body: 'from-lime-300 via-emerald-300 to-teal-500',
    accent: 'bg-lime-200',
    button: 'bg-emerald-600 hover:bg-emerald-700',
    soft: 'bg-emerald-50 border-emerald-100 text-emerald-800',
    ring: 'ring-emerald-200/70',
  },
  sun: {
    label: 'Nắng cam',
    body: 'from-amber-200 via-orange-300 to-yellow-500',
    accent: 'bg-yellow-100',
    button: 'bg-amber-600 hover:bg-amber-700',
    soft: 'bg-amber-50 border-amber-100 text-amber-800',
    ring: 'ring-amber-200/70',
  },
};

const MOODS: Record<PetMood, { label: string; hint: string }> = {
  friendly: { label: 'Thân thiện', hint: 'Chào hỏi nhẹ nhàng' },
  happy: { label: 'Vui vẻ', hint: 'Động viên nhiều hơn' },
  focus: { label: 'Tập trung', hint: 'Nhắc học gọn hơn' },
  sleepy: { label: 'Lười xíu', hint: 'Nói chậm, mềm hơn' },
};

const sparkleAnimation = {
  v: '5.7.4',
  fr: 30,
  ip: 0,
  op: 90,
  w: 220,
  h: 220,
  nm: 'moli-sparkles',
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: 'sparkle-a',
      sr: 1,
      ks: {
        o: { k: 75 },
        r: { k: 0 },
        p: { k: [60, 54, 0] },
        a: { k: [0, 0, 0] },
        s: { k: [100, 100, 100] },
      },
      shapes: [
        {
          ty: 'gr',
          it: [
            { ty: 'el', p: { k: [0, 0] }, s: { k: [15, 15] }, nm: 'dot' },
            { ty: 'fl', c: { k: [1, 0.78, 0.2, 1] }, o: { k: 100 }, nm: 'fill' },
            { ty: 'tr', p: { k: [0, 0] }, a: { k: [0, 0] }, s: { k: [100, 100] }, r: { k: 0 }, o: { k: 100 } },
          ],
          nm: 'dot-group',
        },
      ],
      ip: 0,
      op: 90,
      st: 0,
      bm: 0,
    },
    {
      ddd: 0,
      ind: 2,
      ty: 4,
      nm: 'sparkle-b',
      sr: 1,
      ks: {
        o: { k: 65 },
        r: { k: 0 },
        p: { k: [168, 72, 0] },
        a: { k: [0, 0, 0] },
        s: { k: [80, 80, 100] },
      },
      shapes: [
        {
          ty: 'gr',
          it: [
            { ty: 'el', p: { k: [0, 0] }, s: { k: [12, 12] }, nm: 'dot' },
            { ty: 'fl', c: { k: [0.55, 0.84, 1, 1] }, o: { k: 100 }, nm: 'fill' },
            { ty: 'tr', p: { k: [0, 0] }, a: { k: [0, 0] }, s: { k: [100, 100] }, r: { k: 0 }, o: { k: 100 } },
          ],
          nm: 'dot-group',
        },
      ],
      ip: 0,
      op: 90,
      st: 0,
      bm: 0,
    },
  ],
};

const getDefaultSettings = (position: PetPosition): MoliPetSettings => ({
  name: 'Moli',
  color: 'ocean',
  mood: 'friendly',
  position,
  showBubble: true,
});

const readSettings = (position: PetPosition) => {
  if (typeof window === 'undefined') return getDefaultSettings(position);
  try {
    const saved = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || '{}');
    const defaults = getDefaultSettings(position);
    return {
      ...defaults,
      ...saved,
      name: typeof saved.name === 'string' && saved.name.trim() ? saved.name.trim().slice(0, 24) : defaults.name,
      color: COLOR_THEMES[saved.color as PetColor] ? saved.color : defaults.color,
      mood: MOODS[saved.mood as PetMood] ? saved.mood : defaults.mood,
      position: saved.position === 'right' || saved.position === 'left' ? saved.position : defaults.position,
      showBubble: typeof saved.showBubble === 'boolean' ? saved.showBubble : defaults.showBubble,
    } as MoliPetSettings;
  } catch {
    return getDefaultSettings(position);
  }
};

const clampPetPoint = (point: PetPoint): PetPoint => {
  if (typeof window === 'undefined') return point;
  const padding = 12;
  const maxX = Math.max(padding, window.innerWidth - PET_FRAME_SIZE - padding);
  const maxY = Math.max(84, window.innerHeight - PET_FRAME_SIZE - padding);
  return {
    x: Math.min(Math.max(padding, point.x), maxX),
    y: Math.min(Math.max(84, point.y), maxY),
  };
};

const getInitialPetPoint = (position: PetPosition): PetPoint => {
  if (typeof window === 'undefined') return { x: 20, y: 520 };
  const fallback = clampPetPoint({
    x: position === 'right' ? window.innerWidth - PET_FRAME_SIZE - 20 : 20,
    y: window.innerHeight - PET_FRAME_SIZE - 28,
  });

  try {
    const saved = JSON.parse(window.localStorage.getItem(POSITION_KEY) || '{}');
    if (Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
      return clampPetPoint({ x: saved.x, y: saved.y });
    }
  } catch {}

  return fallback;
};

const savePetPoint = (point: PetPoint) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(POSITION_KEY, JSON.stringify(clampPetPoint(point)));
};

const getFirstName = (name?: string) => {
  const trimmed = name?.trim();
  if (!trimmed) return 'bạn';
  const parts = trimmed.split(/\s+/);
  return parts[parts.length - 1] || trimmed;
};

const getRouteHint = (pathname: string | null) => {
  if (!pathname) return 'Mình ở đây để hỏi thăm và nhắc bạn học nhẹ nhàng.';
  if (pathname.includes('tu-vung')) return 'Hôm nay mình học vài từ mới cùng bạn nhé.';
  if (pathname.includes('lo-trinh')) return 'Mình có thể nhắc bạn nhìn lại lộ trình học.';
  if (pathname.includes('lich-su')) return 'Mình có thể giúp bạn xem lại điểm và lỗi sai.';
  if (pathname.includes('de-mo-phong') || pathname.includes('/exam-room')) return 'Trước khi làm đề, nhớ đọc kỹ câu hỏi nha.';
  if (pathname.includes('profile')) return 'Mình có thể nhắc bạn cập nhật mục tiêu học.';
  return 'Mình ở đây để hỏi thăm và đồng hành khi bạn học.';
};

function PetFace({ color, mood }: { color: PetColor; mood: PetMood }) {
  const theme = COLOR_THEMES[color];
  const sleepy = mood === 'sleepy';
  const focus = mood === 'focus';
  const happy = mood === 'happy';

  return (
    <div className="moli-float relative h-24 w-24">
      <div className="pointer-events-none absolute inset-[-20px] opacity-70">
        <Lottie animationData={sparkleAnimation} loop autoplay />
      </div>
      <div className="moli-shadow absolute bottom-0 left-1/2 h-4 w-16 -translate-x-1/2 rounded-full bg-slate-900/18 blur-sm" />
      <div className={`moli-ear-left absolute left-4 top-1 h-9 w-8 -rotate-[28deg] rounded-[70%_70%_50%_50%] bg-gradient-to-br ${theme.body} shadow-md ring-2 ring-white/70`} />
      <div className={`moli-ear-right absolute right-4 top-1 h-9 w-8 rotate-[28deg] rounded-[70%_70%_50%_50%] bg-gradient-to-br ${theme.body} shadow-md ring-2 ring-white/70`} />
      <div className={`absolute left-1/2 top-4 h-[74px] w-[82px] -translate-x-1/2 rounded-[34px] bg-gradient-to-br ${theme.body} shadow-[0_16px_36px_rgba(15,23,42,0.25)] ring-4 ${theme.ring}`}>
        <div className="absolute inset-x-3 top-2 h-8 rounded-full bg-white/24 blur-[1px]" />
        <div className={`absolute left-4 top-4 h-5 w-5 rounded-full ${theme.accent} opacity-80 shadow-inner`} />
        <div className="absolute right-4 top-4 h-2.5 w-5 rotate-[-18deg] rounded-full bg-white/60" />
        <div className="absolute left-[18px] top-9 flex gap-6">
          <span
            className={[
              'moli-blink block bg-slate-950 shadow-[0_1px_0_rgba(255,255,255,0.45)]',
              sleepy ? 'h-1.5 w-5 rounded-full' : happy ? 'h-3 w-4 rounded-b-full border-b-4 border-slate-950 bg-transparent' : 'h-4 w-3 rounded-full',
            ].join(' ')}
          />
          <span
            className={[
              'moli-blink block bg-slate-950 shadow-[0_1px_0_rgba(255,255,255,0.45)]',
              sleepy ? 'h-1.5 w-5 rounded-full' : happy ? 'h-3 w-4 rounded-b-full border-b-4 border-slate-950 bg-transparent' : 'h-4 w-3 rounded-full',
            ].join(' ')}
          />
        </div>
        <div className="absolute left-1/2 top-[54px] -translate-x-1/2">
          {focus ? (
            <div className="h-1.5 w-7 rounded-full bg-slate-900" />
          ) : sleepy ? (
            <div className="h-2 w-5 rounded-b-full border-b-2 border-slate-900" />
          ) : happy ? (
            <div className="h-4 w-8 rounded-b-full border-b-[5px] border-slate-950" />
          ) : (
            <div className="h-3 w-6 rounded-b-full border-b-4 border-slate-950" />
          )}
        </div>
        <div className="absolute left-3 top-[53px] h-3 w-4 rounded-full bg-rose-300/70 blur-[1px]" />
        <div className="absolute right-3 top-[53px] h-3 w-4 rounded-full bg-rose-300/70 blur-[1px]" />
      </div>
      <div className={`moli-hand-left absolute left-1 top-12 h-5 w-4 -rotate-12 rounded-full bg-gradient-to-br ${theme.body} shadow-md`} />
      <div className={`moli-hand-right absolute right-1 top-12 h-5 w-4 rotate-12 rounded-full bg-gradient-to-br ${theme.body} shadow-md`} />
      <div className={`moli-foot-left absolute bottom-3 left-7 h-4 w-5 rounded-full bg-gradient-to-br ${theme.body} shadow-md`} />
      <div className={`moli-foot-right absolute bottom-3 right-7 h-4 w-5 rounded-full bg-gradient-to-br ${theme.body} shadow-md`} />
    </div>
  );
}

export default function MoliPet({ defaultPosition = 'left' }: MoliPetProps) {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<MoliPetSettings>(() => getDefaultSettings(defaultPosition));
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<PetMessage[]>([]);
  const [petPoint, setPetPoint] = useState<PetPoint | null>(null);
  const [dragging, setDragging] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef({
    pointerId: null as number | null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    moved: false,
  });

  const theme = COLOR_THEMES[settings.color];
  const userName = getFirstName(user?.display_name || user?.full_name || user?.username);
  const routeHint = useMemo(() => getRouteHint(pathname), [pathname]);

  useEffect(() => {
    const nextSettings = readSettings(defaultPosition);
    const hiddenUntil = Number(window.localStorage.getItem(HIDDEN_UNTIL_KEY) || 0);
    setSettings(nextSettings);
    setPetPoint(getInitialPetPoint(nextSettings.position));
    setHidden(hiddenUntil > Date.now());
    setMessages([
      {
        role: 'assistant',
        content: isAuthenticated
          ? `Chào ${userName}, mình là ${nextSettings.name}. ${getRouteHint(pathname)}`
          : `Chào bạn, mình là ${nextSettings.name}. Đăng nhập rồi mình trò chuyện thông minh hơn nha.`,
      },
    ]);
    setMounted(true);
  }, [defaultPosition]);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [mounted, settings]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, open]);

  useEffect(() => {
    if (!mounted) return;
    const handleResize = () => {
      setPetPoint((current) => {
        if (!current) return current;
        const next = clampPetPoint(current);
        savePetPoint(next);
        return next;
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [mounted]);

  if (!mounted) return null;

  const restorePet = () => {
    window.localStorage.removeItem(HIDDEN_UNTIL_KEY);
    setHidden(false);
    setPetPoint((current) => current || getInitialPetPoint(settings.position));
    setOpen(true);
    setMinimized(false);
  };

  if (hidden) {
    return (
      <button
        type="button"
        onClick={restorePet}
        aria-label="Hien MoliPet"
        className="fixed bottom-5 left-4 z-[65] rounded-2xl border border-cyan-100 bg-white/95 px-4 py-3 text-sm font-black text-cyan-700 shadow-xl backdrop-blur hover:bg-cyan-50 dark:border-slate-700 dark:bg-slate-900 dark:text-cyan-200"
        title="Bật lại MoliPet"
      >
        Hiện MoliPet
      </button>
    );
  }

  if (!petPoint) return null;

  const dockedRight = petPoint.x > window.innerWidth / 2;
  const panelSideClass = dockedRight ? 'right-0' : 'left-0';
  const bubbleSideClass = dockedRight ? 'right-24' : 'left-24';
  const panelVerticalClass = petPoint.y < 360 ? 'top-24' : 'bottom-28';
  const containerStyle: CSSProperties = { left: petPoint.x, top: petPoint.y };

  const updateSettings = (patch: Partial<MoliPetSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
  };

  const movePetToSide = (position: PetPosition) => {
    const nextPoint = clampPetPoint({
      x: position === 'right' ? window.innerWidth - PET_FRAME_SIZE - 20 : 20,
      y: petPoint.y,
    });
    updateSettings({ position });
    setPetPoint(nextPoint);
    savePetPoint(nextPoint);
  };

  const handlePetPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: petPoint.x,
      originY: petPoint.y,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const handlePetPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      drag.moved = true;
    }
    setPetPoint(clampPetPoint({ x: drag.originX + deltaX, y: drag.originY + deltaY }));
  };

  const handlePetPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (drag.pointerId !== event.pointerId) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture can already be gone after a browser cancel.
    }
    const nextPoint = clampPetPoint({
      x: drag.originX + event.clientX - drag.startX,
      y: drag.originY + event.clientY - drag.startY,
    });
    setPetPoint(nextPoint);
    savePetPoint(nextPoint);
    updateSettings({ position: nextPoint.x > window.innerWidth / 2 ? 'right' : 'left' });
    dragRef.current.pointerId = null;
    setDragging(false);
  };

  const hideForDay = () => {
    window.localStorage.setItem(HIDDEN_UNTIL_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
    setHidden(true);
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const nextMessages: PetMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');

    if (!isAuthenticated) {
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: 'Bạn đăng nhập xong Moli mới dùng AI để trò chuyện được nha.' },
      ]);
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post('/ai/moli-pet', {
        message: text,
        page: pathname,
        petName: settings.name,
        mood: settings.mood,
        conversationHistory: nextMessages.slice(-6).map((item) => ({
          role: item.role,
          content: item.content,
        })),
      });

      setMessages((current) => [
        ...current,
        { role: 'assistant', content: response.data?.answer || 'Moli nghe rồi nè.' },
      ]);
    } catch (error: any) {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: error?.response?.data?.answer || error?.response?.data?.message || 'Moli bị nghẽn xíu. Bạn thử lại sau nha.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed z-[65] h-[104px] w-[104px] select-none" style={containerStyle}>
      <style>{`
        @keyframes moli-float {
          0%, 100% { transform: translateY(0) rotate(-1deg); }
          50% { transform: translateY(-8px) rotate(1deg); }
        }
        @keyframes moli-shadow {
          0%, 100% { transform: translateX(-50%) scale(1); opacity: .22; }
          50% { transform: translateX(-50%) scale(.82); opacity: .12; }
        }
        @keyframes moli-blink {
          0%, 91%, 100% { transform: scaleY(1); }
          94%, 96% { transform: scaleY(.12); }
        }
        @keyframes moli-ear-left {
          0%, 100% { transform: rotate(-28deg); }
          50% { transform: rotate(-18deg) translateY(-1px); }
        }
        @keyframes moli-ear-right {
          0%, 100% { transform: rotate(28deg); }
          50% { transform: rotate(18deg) translateY(-1px); }
        }
        @keyframes moli-hand-left {
          0%, 100% { transform: rotate(-14deg) translateY(0); }
          50% { transform: rotate(-34deg) translateY(-3px); }
        }
        @keyframes moli-hand-right {
          0%, 100% { transform: rotate(14deg) translateY(0); }
          50% { transform: rotate(34deg) translateY(-3px); }
        }
        .moli-float { animation: moli-float 3.2s ease-in-out infinite; transform-origin: center bottom; }
        .moli-shadow { animation: moli-shadow 3.2s ease-in-out infinite; }
        .moli-blink { animation: moli-blink 5.2s ease-in-out infinite; transform-origin: center; }
        .moli-ear-left { animation: moli-ear-left 4s ease-in-out infinite; transform-origin: bottom center; }
        .moli-ear-right { animation: moli-ear-right 4s ease-in-out infinite; transform-origin: bottom center; }
        .moli-hand-left { animation: moli-hand-left 3.4s ease-in-out infinite; transform-origin: right center; }
        .moli-hand-right { animation: moli-hand-right 3.4s ease-in-out infinite; transform-origin: left center; }
        @media (prefers-reduced-motion: reduce) {
          .moli-float, .moli-shadow, .moli-blink, .moli-ear-left, .moli-ear-right, .moli-hand-left, .moli-hand-right {
            animation: none;
          }
        }
      `}</style>
      {open && !minimized && (
        <section
          className={`absolute ${panelVerticalClass} ${panelSideClass} w-[min(372px,calc(100vw-24px))] overflow-hidden rounded-[24px] border border-white/70 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.25)] backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/95`}
          aria-label="MoliPet"
        >
          <div className={`flex items-center justify-between border-b px-4 py-3 ${theme.soft} dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100`}>
            <div className="flex min-w-0 items-center gap-3">
              <PetFace color={settings.color} mood={settings.mood} />
              <div className="min-w-0">
                <p className="truncate text-sm font-black">{settings.name}</p>
                <p className="text-xs font-medium opacity-75">{MOODS[settings.mood].hint}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" title="Tùy chỉnh" onClick={() => setSettingsOpen((value) => !value)} className="rounded-lg p-2 hover:bg-white/70 dark:hover:bg-slate-700">
                <FiSettings />
              </button>
              <button type="button" title="Thu gọn" onClick={() => setMinimized(true)} className="rounded-lg p-2 hover:bg-white/70 dark:hover:bg-slate-700">
                <FiChevronDown />
              </button>
              <button type="button" title="Đóng" onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-white/70 dark:hover:bg-slate-700">
                <FiX />
              </button>
            </div>
          </div>

          {settingsOpen && (
            <div className="border-b border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-300">
                Tên pet
                <input
                  value={settings.name}
                  maxLength={24}
                  onChange={(event) => updateSettings({ name: event.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </label>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {(Object.keys(COLOR_THEMES) as PetColor[]).map((color) => (
                  <button
                    key={color}
                    type="button"
                    title={COLOR_THEMES[color].label}
                    onClick={() => updateSettings({ color })}
                    className={`h-9 rounded-xl bg-gradient-to-br ${COLOR_THEMES[color].body} ring-offset-2 ${settings.color === color ? 'ring-2 ring-slate-900 dark:ring-white' : ''}`}
                  />
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(Object.keys(MOODS) as PetMood[]).map((mood) => (
                  <button
                    key={mood}
                    type="button"
                    onClick={() => updateSettings({ mood })}
                    className={`rounded-xl border px-3 py-2 text-left text-xs font-bold transition ${
                      settings.mood === mood
                        ? `${theme.soft} dark:border-slate-500 dark:bg-slate-700 dark:text-white`
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                    }`}
                  >
                    {MOODS[mood].label}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => movePetToSide(settings.position === 'left' ? 'right' : 'left')}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  Góc {settings.position === 'left' ? 'trái' : 'phải'}
                </button>
                <button
                  type="button"
                  onClick={() => updateSettings({ showBubble: !settings.showBubble })}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  Bong bóng {settings.showBubble ? 'bật' : 'tắt'}
                </button>
              </div>
            </div>
          )}

          <div className="max-h-[260px] space-y-2 overflow-y-auto px-4 py-3">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    message.role === 'user'
                      ? `${theme.button} text-white`
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  {settings.name} đang nghĩ...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} className="flex items-center gap-2 border-t border-slate-100 p-3 dark:border-slate-700">
            <input
              value={input}
              maxLength={600}
              onChange={(event) => setInput(event.target.value)}
              placeholder={isAuthenticated ? `Nhắn ${settings.name}...` : 'Đăng nhập để chat AI'}
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${theme.button}`}
              title="Gửi"
            >
              {loading ? <FiRefreshCw className="animate-spin" /> : <FiSend />}
            </button>
          </form>
        </section>
      )}

      {settings.showBubble && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`absolute bottom-5 ${bubbleSideClass} hidden max-w-[240px] rounded-2xl border bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 shadow-xl hover:bg-slate-50 sm:block dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100`}
        >
          {routeHint}
        </button>
      )}

      <div className="flex h-full w-full items-end justify-center gap-1">
        {minimized && open && (
          <button
            type="button"
            onClick={() => setMinimized(false)}
            className="mb-2 rounded-full border border-slate-200 bg-white p-2 text-slate-500 shadow-lg hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            title="Mở lại"
          >
            <FiChevronUp />
          </button>
        )}
        <button
          type="button"
          onPointerDown={handlePetPointerDown}
          onPointerMove={handlePetPointerMove}
          onPointerUp={handlePetPointerUp}
          onPointerCancel={handlePetPointerUp}
          onClick={() => {
            if (dragRef.current.moved) {
              dragRef.current.moved = false;
              return;
            }
            setOpen((value) => !value);
            setMinimized(false);
          }}
          className={`relative flex h-24 w-24 touch-none items-center justify-center rounded-[34px] bg-white/90 shadow-[0_20px_52px_rgba(15,23,42,0.24)] ring-4 ${theme.ring} backdrop-blur transition hover:-translate-y-1 dark:bg-slate-900/90 ${dragging ? 'cursor-grabbing scale-105' : 'cursor-grab'}`}
          title="Keo de di chuyen, bam de mo"
          aria-label={open ? 'Đóng MoliPet' : 'Mở MoliPet'}
        >
          <PetFace color={settings.color} mood={settings.mood} />
          <span className={`absolute -right-1 top-1 flex h-9 w-9 items-center justify-center rounded-2xl text-white shadow-lg ${theme.button}`}>
            <FiMessageCircle size={16} />
          </span>
        </button>
        <button
          type="button"
          onClick={hideForDay}
          className="mb-2 rounded-full border border-slate-200 bg-white p-2 text-slate-400 shadow-lg hover:bg-slate-50 hover:text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
          title="Tắt MoliPet hôm nay"
        >
          <FiEyeOff />
        </button>
      </div>
    </div>
  );
}
