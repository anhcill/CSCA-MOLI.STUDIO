'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
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

  return (
    <div className="relative h-20 w-20">
      <div className="absolute inset-[-18px] animate-pulse opacity-80">
        <Lottie animationData={sparkleAnimation} loop autoplay />
      </div>
      <div className={`absolute left-2 top-1 h-7 w-7 rotate-[-22deg] rounded-full bg-gradient-to-br ${theme.body} shadow-sm`} />
      <div className={`absolute right-2 top-1 h-7 w-7 rotate-[22deg] rounded-full bg-gradient-to-br ${theme.body} shadow-sm`} />
      <div className={`absolute inset-x-2 top-4 h-16 rounded-[28px] bg-gradient-to-br ${theme.body} shadow-lg ring-4 ${theme.ring}`}>
        <div className={`absolute left-4 top-2 h-4 w-4 rounded-full ${theme.accent} opacity-80`} />
        <div className="absolute left-5 top-7 flex gap-5">
          <span className={`${sleepy ? 'h-1 w-4 rounded-full' : 'h-3 w-3 rounded-full'} block bg-slate-900`} />
          <span className={`${sleepy ? 'h-1 w-4 rounded-full' : 'h-3 w-3 rounded-full'} block bg-slate-900`} />
        </div>
        <div className="absolute left-1/2 top-11 -translate-x-1/2">
          {focus ? (
            <div className="h-1.5 w-7 rounded-full bg-slate-900" />
          ) : sleepy ? (
            <div className="h-2 w-5 rounded-b-full border-b-2 border-slate-900" />
          ) : (
            <div className="h-4 w-8 rounded-b-full border-b-4 border-slate-900" />
          )}
        </div>
        <div className="absolute bottom-2 left-4 h-2 w-2 rounded-full bg-white/70" />
        <div className="absolute bottom-2 right-4 h-2 w-2 rounded-full bg-white/70" />
      </div>
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
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const theme = COLOR_THEMES[settings.color];
  const userName = getFirstName(user?.display_name || user?.full_name || user?.username);
  const routeHint = useMemo(() => getRouteHint(pathname), [pathname]);

  useEffect(() => {
    const nextSettings = readSettings(defaultPosition);
    const hiddenUntil = Number(window.localStorage.getItem(HIDDEN_UNTIL_KEY) || 0);
    setSettings(nextSettings);
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

  if (!mounted || hidden) return null;

  const sideClass = settings.position === 'right' ? 'right-3 sm:right-5' : 'left-3 sm:left-5';
  const panelSideClass = settings.position === 'right' ? 'right-0' : 'left-0';
  const bubbleSideClass = settings.position === 'right' ? 'right-20' : 'left-20';

  const updateSettings = (patch: Partial<MoliPetSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
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
    <div className={`fixed bottom-5 z-[65] ${sideClass}`}>
      {open && !minimized && (
        <section
          className={`absolute bottom-24 ${panelSideClass} w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900`}
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
                  onClick={() => updateSettings({ position: settings.position === 'left' ? 'right' : 'left' })}
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

      <div className="flex items-end gap-2">
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
          onClick={() => {
            setOpen((value) => !value);
            setMinimized(false);
          }}
          className={`relative flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-2xl ring-4 ${theme.ring} transition hover:-translate-y-1 dark:bg-slate-900`}
          aria-label={open ? 'Đóng MoliPet' : 'Mở MoliPet'}
        >
          <PetFace color={settings.color} mood={settings.mood} />
          <span className={`absolute -right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full text-white shadow-lg ${theme.button}`}>
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
