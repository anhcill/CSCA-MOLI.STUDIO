import type { MoliPetSettings, PetColor, PetMood, PetPoint, PetPosition, PetSkin, PetSkinId, PetVariant } from './types';

export const SETTINGS_KEY = 'moli_pet_settings_v1';
export const HIDDEN_UNTIL_KEY = 'moli_pet_hidden_until_v1';
export const POSITION_KEY = 'moli_pet_position_v2';
export const SETTINGS_DEFAULTS_VERSION = 6;
export const PET_FRAME_SIZE = 88;
export const PET_PANEL_MAX_WIDTH = 372;
export const PET_PANEL_MARGIN = 12;

export const COLOR_THEMES: Record<PetColor, {
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

export const PET_3D_PALETTES: Record<PetColor, { body: number; accent: number; innerEar: number; cheek: number }> = {
  ocean: { body: 0x38d5f4, accent: 0x7dd3fc, innerEar: 0xf9a8d4, cheek: 0xfb7185 },
  berry: { body: 0xf472b6, accent: 0xf9a8d4, innerEar: 0xfda4af, cheek: 0xfb7185 },
  leaf: { body: 0x34d399, accent: 0xa3e635, innerEar: 0xf9a8d4, cheek: 0xfb7185 },
  sun: { body: 0xfbbf24, accent: 0xfdba74, innerEar: 0xfca5a5, cheek: 0xfb7185 },
};

export const PET_VARIANTS: Record<PetVariant, {
  label: string;
  body: number;
  accent: number;
  innerEar: number;
  cheek: number;
  swatch: string;
  preview?: string;
}> = {
  cat: {
    label: 'Mèo xanh',
    body: 0x38d5f4,
    accent: 0x7dd3fc,
    innerEar: 0xf9a8d4,
    cheek: 0xfb7185,
    swatch: 'from-cyan-200 via-sky-300 to-cyan-500',
  },
  star: {
    label: 'Công chúa sao',
    body: 0xf8fbff,
    accent: 0x9ed8ff,
    innerEar: 0xc7e7ff,
    cheek: 0xf9a8d4,
    swatch: 'from-white via-sky-200 to-blue-400',
  },
  bunny: {
    label: 'Thỏ tim',
    body: 0xfffbff,
    accent: 0xf9b8d5,
    innerEar: 0xfbd5e6,
    cheek: 0xf9a8d4,
    swatch: 'from-white via-pink-200 to-sky-200',
  },
  'moly-purple': {
    label: 'Moly tím',
    body: 0xad79ff,
    accent: 0xc4a1ff,
    innerEar: 0xffc4dc,
    cheek: 0xff8fb8,
    swatch: 'from-violet-300 via-purple-300 to-violet-600',
  },
  'moly-chibi': {
    label: 'Moly chibi',
    body: 0xffe6ea,
    accent: 0xff9fbd,
    innerEar: 0xffc4d6,
    cheek: 0xff8ba8,
    swatch: 'from-rose-100 via-pink-200 to-rose-400',
  },
  'moly-3d': {
    label: 'Mèo 3D hiện tại',
    body: 0x8f70c4,
    accent: 0xf2a7c9,
    innerEar: 0xffc4d6,
    cheek: 0xff8ba8,
    swatch: 'from-violet-300 via-fuchsia-300 to-indigo-500',
    preview: '/models/moli-pet/previews/cat.png',
  },
  'moly-3d-hog': {
    label: 'Heo 3D',
    body: 0xb8734f,
    accent: 0xf5a07f,
    innerEar: 0xffb4a2,
    cheek: 0xff8ba8,
    swatch: 'from-orange-300 via-rose-300 to-amber-600',
    preview: '/models/moli-pet/previews/hog.png',
  },
  'moly-3d-penguin': {
    label: 'Cánh cụt 3D',
    body: 0x334155,
    accent: 0xf8fafc,
    innerEar: 0xfbbf24,
    cheek: 0xfb7185,
    swatch: 'from-slate-700 via-slate-300 to-orange-300',
    preview: '/models/moli-pet/previews/penguin.png',
  },
  'moly-3d-fox': {
    label: 'Cáo 3D',
    body: 0xf97316,
    accent: 0xfdba74,
    innerEar: 0xffedd5,
    cheek: 0xfb7185,
    swatch: 'from-orange-300 via-orange-500 to-amber-700',
    preview: '/models/moli-pet/previews/fox.png',
  },
  'moly-3d-crab': {
    label: 'Cua 3D',
    body: 0xf43f5e,
    accent: 0xfb7185,
    innerEar: 0xfda4af,
    cheek: 0xff8ba8,
    swatch: 'from-rose-300 via-red-500 to-orange-500',
    preview: '/models/moli-pet/previews/crab.png',
  },
  'moly-3d-panda': {
    label: 'Panda 3D',
    body: 0xf8fafc,
    accent: 0x1e293b,
    innerEar: 0x334155,
    cheek: 0xfb7185,
    swatch: 'from-white via-slate-300 to-slate-800',
    preview: '/models/moli-pet/previews/panda.png',
  },
};

export const MOODS: Record<PetMood, { label: string; hint: string }> = {
  friendly: { label: 'Thân thiện', hint: 'Chào hỏi nhẹ nhàng' },
  happy: { label: 'Vui vẻ', hint: 'Động viên nhiều hơn' },
  focus: { label: 'Tập trung', hint: 'Nhắc học gọn hơn' },
  sleepy: { label: 'Lười xíu', hint: 'Nói chậm, mềm hơn' },
};

export const PET_SKIN_IDS: PetSkinId[] = [
  'bubble-cute',
  'floating-pet',
  'minimal-soft',
  'chibi-pet',
  'dark-cute',
  'retro-game',
  'glassmorphism',
];

export const PET_SKINS: Record<PetSkinId, PetSkin> = {
  'bubble-cute': {
    id: 'bubble-cute',
    label: 'Bubble Pet Cute',
    badge: '1',
    subtitle: 'Hồng mềm, bong bóng tim',
    defaultColor: 'berry',
    defaultVariant: 'moly-purple',
    panelClass: 'rounded-[24px] border border-rose-100 bg-rose-50/95 shadow-[0_24px_70px_rgba(244,114,182,0.28)] backdrop-blur-xl',
    headerClass: 'border-b border-rose-100 bg-gradient-to-r from-rose-50 via-white to-pink-50 text-slate-800',
    settingsClass: 'border-rose-100 bg-rose-50/85',
    assistantBubbleClass: 'bg-white text-slate-700 shadow-[0_10px_22px_rgba(244,114,182,0.13)] ring-1 ring-rose-100',
    userBubbleClass: 'bg-gradient-to-r from-rose-400 to-pink-500 text-white shadow-[0_10px_22px_rgba(244,114,182,0.24)]',
    inputClass: 'border-rose-100 bg-white text-slate-800 placeholder:text-rose-300 focus:border-rose-300',
    sendButtonClass: 'bg-gradient-to-br from-rose-400 to-pink-500 text-white shadow-[0_10px_22px_rgba(244,114,182,0.34)] hover:from-rose-500 hover:to-pink-600',
    triggerBadgeClass: 'bg-gradient-to-br from-rose-400 to-pink-500 text-white',
    triggerGlowClass: 'drop-shadow-[0_18px_28px_rgba(244,114,182,0.36)]',
    previewClass: 'bg-gradient-to-br from-rose-100 via-white to-pink-100 text-rose-600 ring-rose-100',
    actionClass: 'border-rose-100 bg-white text-rose-500 hover:bg-rose-50',
  },
  'floating-pet': {
    id: 'floating-pet',
    label: 'Floating Pet',
    badge: '2',
    subtitle: 'Tím nổi, pet ngoài khung',
    defaultColor: 'berry',
    defaultVariant: 'moly-purple',
    panelClass: 'rounded-[28px] border border-violet-100 bg-white/94 shadow-[0_28px_80px_rgba(139,92,246,0.3)] backdrop-blur-xl',
    headerClass: 'border-b border-violet-100 bg-gradient-to-r from-violet-50 via-white to-fuchsia-50 text-slate-800',
    settingsClass: 'border-violet-100 bg-violet-50/85',
    assistantBubbleClass: 'bg-white text-slate-700 shadow-[0_10px_24px_rgba(139,92,246,0.16)] ring-1 ring-violet-100',
    userBubbleClass: 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-[0_10px_24px_rgba(139,92,246,0.28)]',
    inputClass: 'border-violet-100 bg-white text-slate-800 placeholder:text-violet-300 focus:border-violet-300',
    sendButtonClass: 'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_12px_24px_rgba(139,92,246,0.36)] hover:from-violet-600 hover:to-fuchsia-600',
    triggerBadgeClass: 'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white',
    triggerGlowClass: 'drop-shadow-[0_18px_32px_rgba(139,92,246,0.4)]',
    previewClass: 'bg-gradient-to-br from-violet-100 via-white to-fuchsia-100 text-violet-600 ring-violet-100',
    actionClass: 'border-violet-100 bg-white text-violet-500 hover:bg-violet-50',
  },
  'minimal-soft': {
    id: 'minimal-soft',
    label: 'Minimal Soft',
    badge: '3',
    subtitle: 'Trắng xanh gọn',
    defaultColor: 'ocean',
    defaultVariant: 'bunny',
    panelClass: 'rounded-[22px] border border-blue-100 bg-white/96 shadow-[0_18px_58px_rgba(37,99,235,0.18)] backdrop-blur-xl',
    headerClass: 'border-b border-blue-100 bg-gradient-to-r from-blue-50 via-white to-sky-50 text-slate-800',
    settingsClass: 'border-blue-100 bg-blue-50/80',
    assistantBubbleClass: 'bg-slate-50 text-slate-700 ring-1 ring-blue-100',
    userBubbleClass: 'bg-blue-500 text-white shadow-[0_10px_22px_rgba(37,99,235,0.24)]',
    inputClass: 'border-blue-100 bg-white text-slate-800 placeholder:text-blue-300 focus:border-blue-300',
    sendButtonClass: 'bg-blue-500 text-white shadow-[0_10px_22px_rgba(37,99,235,0.28)] hover:bg-blue-600',
    triggerBadgeClass: 'bg-blue-500 text-white',
    triggerGlowClass: 'drop-shadow-[0_16px_26px_rgba(37,99,235,0.26)]',
    previewClass: 'bg-gradient-to-br from-blue-50 via-white to-sky-100 text-blue-600 ring-blue-100',
    actionClass: 'border-blue-100 bg-white text-blue-500 hover:bg-blue-50',
  },
  'chibi-pet': {
    id: 'chibi-pet',
    label: 'Chibi Pet Style',
    badge: '4',
    subtitle: 'Sticker chibi, viền kẹo',
    defaultColor: 'berry',
    defaultVariant: 'moly-chibi',
    panelClass: 'rounded-[26px] border-2 border-pink-100 bg-pink-50/95 shadow-[0_22px_64px_rgba(236,72,153,0.24)] backdrop-blur-xl',
    headerClass: 'border-b border-pink-100 bg-gradient-to-r from-pink-50 via-white to-rose-50 text-slate-800',
    settingsClass: 'border-pink-100 bg-pink-50/85',
    assistantBubbleClass: 'bg-white text-slate-700 shadow-[0_10px_20px_rgba(236,72,153,0.14)] ring-1 ring-pink-100',
    userBubbleClass: 'bg-gradient-to-r from-pink-400 to-rose-400 text-white shadow-[0_10px_24px_rgba(236,72,153,0.28)]',
    inputClass: 'border-pink-100 bg-white text-slate-800 placeholder:text-pink-300 focus:border-pink-300',
    sendButtonClass: 'bg-gradient-to-br from-pink-400 to-rose-400 text-white shadow-[0_12px_24px_rgba(236,72,153,0.34)] hover:from-pink-500 hover:to-rose-500',
    triggerBadgeClass: 'bg-gradient-to-br from-pink-400 to-rose-400 text-white',
    triggerGlowClass: 'drop-shadow-[0_18px_28px_rgba(236,72,153,0.34)]',
    previewClass: 'bg-gradient-to-br from-pink-100 via-white to-rose-100 text-pink-600 ring-pink-100',
    actionClass: 'border-pink-100 bg-white text-pink-500 hover:bg-pink-50',
  },
  'dark-cute': {
    id: 'dark-cute',
    label: 'Dark Mode Cute',
    badge: '5',
    subtitle: 'Nền đêm, neon tím',
    defaultColor: 'berry',
    defaultVariant: 'cat',
    panelClass: 'rounded-[22px] border border-slate-700 bg-slate-950/96 text-slate-100 shadow-[0_24px_80px_rgba(15,23,42,0.58)] backdrop-blur-xl',
    headerClass: 'border-b border-slate-700 bg-gradient-to-r from-slate-950 via-slate-900 to-violet-950 text-slate-100',
    settingsClass: 'border-slate-700 bg-slate-900/92',
    assistantBubbleClass: 'bg-slate-800 text-slate-100 ring-1 ring-slate-700',
    userBubbleClass: 'bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white shadow-[0_10px_24px_rgba(168,85,247,0.34)]',
    inputClass: 'border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:border-fuchsia-400',
    sendButtonClass: 'bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white shadow-[0_12px_26px_rgba(168,85,247,0.42)] hover:from-fuchsia-400 hover:to-violet-500',
    triggerBadgeClass: 'bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white',
    triggerGlowClass: 'drop-shadow-[0_18px_30px_rgba(168,85,247,0.45)]',
    previewClass: 'bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 text-fuchsia-200 ring-slate-700',
    actionClass: 'border-slate-700 bg-slate-900 text-fuchsia-200 hover:bg-slate-800',
  },
  'retro-game': {
    id: 'retro-game',
    label: 'Retro Game Style',
    badge: '6',
    subtitle: 'MOLY.EXE pixel xanh',
    defaultColor: 'leaf',
    defaultVariant: 'cat',
    panelClass: 'rounded-[10px] border-2 border-emerald-700 bg-lime-50 text-emerald-950 shadow-[8px_8px_0_rgba(22,101,52,0.35)]',
    headerClass: 'border-b-2 border-emerald-700 bg-lime-100 text-emerald-950',
    settingsClass: 'border-emerald-700 bg-lime-100',
    assistantBubbleClass: 'rounded-[6px] border border-emerald-700 bg-lime-50 text-emerald-950 shadow-none',
    userBubbleClass: 'rounded-[6px] border border-emerald-800 bg-emerald-200 text-emerald-950 shadow-none',
    inputClass: 'rounded-[6px] border-2 border-emerald-700 bg-lime-50 text-emerald-950 placeholder:text-emerald-700 focus:border-emerald-900',
    sendButtonClass: 'rounded-[6px] border-2 border-emerald-800 bg-emerald-200 text-emerald-950 shadow-[3px_3px_0_rgba(22,101,52,0.32)] hover:bg-emerald-300',
    triggerBadgeClass: 'border-2 border-emerald-800 bg-emerald-200 text-emerald-950',
    triggerGlowClass: 'drop-shadow-[8px_8px_0_rgba(22,101,52,0.24)]',
    previewClass: 'bg-lime-100 text-emerald-950 ring-emerald-700',
    actionClass: 'rounded-[6px] border-2 border-emerald-700 bg-lime-50 text-emerald-900 hover:bg-lime-100',
    chromeLabel: 'MOLY.EXE',
    retro: true,
  },
  glassmorphism: {
    id: 'glassmorphism',
    label: 'Glassmorphism',
    badge: '7',
    subtitle: 'Kính mờ xanh tím',
    defaultColor: 'ocean',
    defaultVariant: 'bunny',
    panelClass: 'rounded-[28px] border border-white/55 bg-white/32 shadow-[0_28px_90px_rgba(96,165,250,0.38)] backdrop-blur-2xl',
    headerClass: 'border-b border-white/45 bg-white/36 text-slate-800 backdrop-blur-xl',
    settingsClass: 'border-white/45 bg-white/34 backdrop-blur-xl',
    assistantBubbleClass: 'bg-white/56 text-slate-700 shadow-[0_12px_28px_rgba(96,165,250,0.18)] ring-1 ring-white/50 backdrop-blur-xl',
    userBubbleClass: 'bg-gradient-to-r from-sky-400/80 to-violet-500/80 text-white shadow-[0_12px_28px_rgba(96,165,250,0.3)] backdrop-blur-xl',
    inputClass: 'border-white/55 bg-white/46 text-slate-800 placeholder:text-sky-300 focus:border-sky-300 backdrop-blur-xl',
    sendButtonClass: 'bg-gradient-to-br from-sky-400 to-violet-500 text-white shadow-[0_12px_28px_rgba(96,165,250,0.36)] hover:from-sky-500 hover:to-violet-600',
    triggerBadgeClass: 'bg-gradient-to-br from-sky-400 to-violet-500 text-white',
    triggerGlowClass: 'drop-shadow-[0_18px_34px_rgba(96,165,250,0.42)]',
    previewClass: 'bg-gradient-to-br from-white/80 via-sky-100/80 to-violet-100/80 text-sky-600 ring-white/70',
    actionClass: 'border-white/60 bg-white/48 text-sky-600 hover:bg-white/70 backdrop-blur-xl',
  },
};

export const SUGGESTED_ACTIONS = [
  'Moly nhắc học nhẹ nhàng',
  'Moly vẫy tay',
  'Moly ôm tim',
  'Moly giúp giải bài',
];

export const getDefaultSettings = (position: PetPosition): MoliPetSettings => ({
  name: 'MolyPet',
  color: 'berry',
  mood: 'friendly',
  position,
  showBubble: false,
  motion: false,
  variant: 'moly-3d-panda',
  skin: 'chibi-pet',
});

export const readSettings = (position: PetPosition) => {
  if (typeof window === 'undefined') return getDefaultSettings(position);
  try {
    const saved = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || '{}');
    const defaults = getDefaultSettings(position);
    const savedName = typeof saved.name === 'string' ? saved.name.trim().slice(0, 24) : '';
    const hasCurrentDefaults = saved.defaultsVersion === SETTINGS_DEFAULTS_VERSION;
    return {
      ...defaults,
      ...saved,
      name: savedName && savedName.toLowerCase() !== 'moli' ? savedName : defaults.name,
      color: hasCurrentDefaults && COLOR_THEMES[saved.color as PetColor] ? saved.color : defaults.color,
      mood: MOODS[saved.mood as PetMood] ? saved.mood : defaults.mood,
      position: hasCurrentDefaults && (saved.position === 'right' || saved.position === 'left') ? saved.position : defaults.position,
      showBubble: typeof saved.showBubble === 'boolean' ? saved.showBubble : defaults.showBubble,
      motion: hasCurrentDefaults && typeof saved.motion === 'boolean' ? saved.motion : defaults.motion,
      variant: hasCurrentDefaults && PET_VARIANTS[saved.variant as PetVariant] ? saved.variant : defaults.variant,
      skin: hasCurrentDefaults && PET_SKINS[saved.skin as PetSkinId] ? saved.skin : defaults.skin,
    } as MoliPetSettings;
  } catch {
    return getDefaultSettings(position);
  }
};

export const clampPetPoint = (point: PetPoint): PetPoint => {
  if (typeof window === 'undefined') return point;
  const padding = 12;
  const maxX = Math.max(padding, window.innerWidth - PET_FRAME_SIZE - padding);
  const maxY = Math.max(84, window.innerHeight - PET_FRAME_SIZE - padding);
  return {
    x: Math.min(Math.max(padding, point.x), maxX),
    y: Math.min(Math.max(84, point.y), maxY),
  };
};

export const getInitialPetPoint = (position: PetPosition): PetPoint => {
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

export const savePetPoint = (point: PetPoint) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(POSITION_KEY, JSON.stringify(clampPetPoint(point)));
};

export const getFirstName = (name?: string) => {
  const trimmed = name?.trim();
  if (!trimmed) return 'bạn';
  const parts = trimmed.split(/\s+/);
  return parts[parts.length - 1] || trimmed;
};

export const getRouteHint = (pathname: string | null) => {
  if (!pathname) return 'Mình ở đây để hỏi thăm và nhắc bạn học nhẹ nhàng.';
  if (pathname.includes('tu-vung')) return 'Hôm nay mình học vài từ mới cùng bạn nhé.';
  if (pathname.includes('lo-trinh')) return 'Mình có thể nhắc bạn nhìn lại lộ trình học.';
  if (pathname.includes('lich-su')) return 'Mình có thể giúp bạn xem lại điểm và lỗi sai.';
  if (pathname.includes('de-mo-phong') || pathname.includes('/exam-room')) return 'Trước khi làm đề, nhớ đọc kỹ câu hỏi nha.';
  if (pathname.includes('profile')) return 'Mình có thể nhắc bạn cập nhật mục tiêu học.';
  return 'Mình ở đây để hỏi thăm và đồng hành khi bạn học.';
};

export const getStudyContext = (pathname: string | null) => {
  const path = pathname || '/';
  const normalized = path.toLowerCase();
  const subject = normalized.includes('vat-ly') || normalized.includes('physics')
    ? 'vat ly'
    : normalized.includes('hoa')
      ? 'hoa hoc'
      : normalized.includes('tieng-trung') || normalized.includes('tu-vung') || normalized.includes('hsk')
        ? 'tieng Trung'
        : normalized.includes('toan') || normalized.includes('math')
          ? 'toan'
          : normalized.includes('tong-hop')
            ? 'tong hop'
            : '';
  const pageType = normalized.includes('tu-vung')
    ? 'tu vung'
    : normalized.includes('lo-trinh')
      ? 'lo trinh'
      : normalized.includes('lich-su')
        ? 'lich su lam bai'
        : normalized.includes('de-mo-phong') || normalized.includes('exam')
          ? 'de thi'
          : normalized.includes('profile')
            ? 'ho so hoc tap'
            : 'hoc tap chung';

  return { subject, pageType };
};
