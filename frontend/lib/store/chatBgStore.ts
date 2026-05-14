'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Preset backgrounds for the chat. Keep them soft enough for message readability.
export const CHAT_BG_PRESETS = [
  {
    id: 'messenger',
    label: 'Messenger',
    bg: 'radial-gradient(circle at 12% 10%, rgba(59, 130, 246, 0.28) 0 18%, transparent 38%), radial-gradient(circle at 88% 12%, rgba(168, 85, 247, 0.26) 0 18%, transparent 36%), linear-gradient(145deg, #f8fbff 0%, #eaf2ff 45%, #f5ecff 100%)',
  },
  {
    id: 'aurora',
    label: 'Cực quang',
    bg: 'radial-gradient(circle at 20% 20%, rgba(45, 212, 191, 0.28), transparent 32%), radial-gradient(circle at 80% 18%, rgba(129, 140, 248, 0.30), transparent 34%), radial-gradient(circle at 50% 92%, rgba(244, 114, 182, 0.20), transparent 38%), linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)',
  },
  {
    id: 'skyline',
    label: 'Bầu trời',
    bg: 'linear-gradient(180deg, #eff6ff 0%, #dbeafe 38%, #f5f3ff 74%, #ffffff 100%)',
  },
  {
    id: 'love',
    label: 'Hồng tím',
    bg: 'radial-gradient(circle at 18% 20%, rgba(251, 113, 133, 0.26), transparent 30%), radial-gradient(circle at 82% 18%, rgba(192, 132, 252, 0.30), transparent 34%), linear-gradient(160deg, #fff7fb 0%, #fdf2f8 42%, #f3e8ff 100%)',
  },
  {
    id: 'ocean',
    label: 'Đại dương',
    bg: 'linear-gradient(160deg, #ecfeff 0%, #dbeafe 38%, #ccfbf1 72%, #f8fafc 100%)',
  },
  {
    id: 'sunset',
    label: 'Hoàng hôn',
    bg: 'radial-gradient(circle at 20% 20%, rgba(251, 146, 60, 0.28), transparent 34%), radial-gradient(circle at 82% 18%, rgba(244, 114, 182, 0.24), transparent 34%), linear-gradient(180deg, #fff7ed 0%, #ffedd5 46%, #fce7f3 100%)',
  },
  {
    id: 'paper',
    label: 'Giấy sáng',
    bg: 'linear-gradient(135deg, rgba(148, 163, 184, 0.10) 25%, transparent 25%), linear-gradient(225deg, rgba(148, 163, 184, 0.10) 25%, transparent 25%), linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
  },
  {
    id: 'mint',
    label: 'Bạc hà',
    bg: 'linear-gradient(180deg, #ecfdf5 0%, #d1fae5 38%, #ccfbf1 72%, #f8fafc 100%)',
  },
  {
    id: 'lavender',
    label: 'Oải hương',
    bg: 'linear-gradient(180deg, #faf5ff 0%, #ede9fe 42%, #e0e7ff 100%)',
  },
  {
    id: 'graphite',
    label: 'Tối dịu',
    bg: 'radial-gradient(circle at 15% 10%, rgba(99, 102, 241, 0.30), transparent 30%), radial-gradient(circle at 88% 12%, rgba(14, 165, 233, 0.18), transparent 32%), linear-gradient(180deg, #111827 0%, #1f2937 52%, #334155 100%)',
  },
  {
    id: 'midnight',
    label: 'Đêm xanh',
    bg: 'radial-gradient(circle at 20% 20%, rgba(56, 189, 248, 0.18), transparent 34%), radial-gradient(circle at 78% 14%, rgba(168, 85, 247, 0.22), transparent 32%), linear-gradient(180deg, #0f172a 0%, #1e1b4b 56%, #312e81 100%)',
  },
  {
    id: 'classic',
    label: 'Cổ điển',
    bg: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 42%, #e2e8f0 100%)',
  },
] as const;

export type ChatBgPreset = typeof CHAT_BG_PRESETS[number]['id'] | 'custom';

interface ChatBgState {
  bgType: 'preset' | 'custom';
  bgPresetId: ChatBgPreset;
  bgValue: string;
  bgImageUrl: string;

  setBgPreset: (presetId: ChatBgPreset) => void;
  setBgCustom: (imageUrl: string) => void;
  resetBg: () => void;
}

const DEFAULT_BG = CHAT_BG_PRESETS[0];

export const useChatBgStore = create<ChatBgState>()(
  persist<ChatBgState, [], [], Omit<ChatBgState, 'setBgPreset' | 'setBgCustom' | 'resetBg'>>(
    (set) => ({
      bgType: 'preset',
      bgPresetId: DEFAULT_BG.id,
      bgValue: DEFAULT_BG.bg,
      bgImageUrl: '',

      setBgPreset: (presetId) => {
        const preset = CHAT_BG_PRESETS.find(p => p.id === presetId);
        if (!preset) return;
        set({
          bgType: 'preset',
          bgPresetId: presetId,
          bgValue: preset.bg,
          bgImageUrl: '',
        });
      },

      setBgCustom: (imageUrl) => {
        set({
          bgType: 'custom',
          bgPresetId: 'custom',
          bgValue: `url(${imageUrl})`,
          bgImageUrl: imageUrl,
        });
      },

      resetBg: () => {
        set({
          bgType: 'preset',
          bgPresetId: DEFAULT_BG.id,
          bgValue: DEFAULT_BG.bg,
          bgImageUrl: '',
        });
      },
    }),
    {
      name: 'chat-bg-storage',
    }
  )
);
