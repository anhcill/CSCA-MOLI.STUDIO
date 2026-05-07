'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Preset gradient backgrounds for the chat
export const CHAT_BG_PRESETS = [
  { id: 'violet', label: 'Tím ngày', bg: 'linear-gradient(180deg, #f5f3ff 0%, #ede9fe 30%, #ddd6fe 60%, #c4b5fd 100%)' },
  { id: 'blue', label: 'Xanh dương', bg: 'linear-gradient(180deg, #eff6ff 0%, #dbeafe 30%, #bfdbfe 60%, #93c5fd 100%)' },
  { id: 'pink', label: 'Hồng nhạt', bg: 'linear-gradient(180deg, #fdf2f8 0%, #fce7f3 30%, #fbcfe8 60%, #f9a8d4 100%)' },
  { id: 'mint', label: 'Bạc hà', bg: 'linear-gradient(180deg, #ecfdf5 0%, #d1fae5 30%, #a7f3d0 60%, #6ee7b7 100%)' },
  { id: 'amber', label: 'Cam nhạt', bg: 'linear-gradient(180deg, #fffbeb 0%, #fef3c7 30%, #fde68a 60%, #fcd34d 100%)' },
  { id: 'slate', label: 'Xám lạnh', bg: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 30%, #e2e8f0 60%, #cbd5e1 100%)' },
  { id: 'teal', label: 'Xanh teal', bg: 'linear-gradient(180deg, #f0fdfa 0%, #ccfbf1 30%, #99f6e4 60%, #5eead4 100%)' },
  { id: 'rose', label: 'Hồng đậm', bg: 'linear-gradient(180deg, #fff1f2 0%, #ffe4e6 30%, #fecdd3 60%, #fda4af 100%)' },
  { id: 'indigo', label: 'Chàm', bg: 'linear-gradient(180deg, #eef2ff 0%, #e0e7ff 30%, #c7d2fe 60%, #a5b4fc 100%)' },
  { id: 'green', label: 'Xanh lá', bg: 'linear-gradient(180deg, #f0fdf4 0%, #dcfce7 30%, #bbf7d0 60%, #86efac 100%)' },
  { id: 'dark', label: 'Đêm tím', bg: 'linear-gradient(180deg, #1e1b4b 0%, #312e81 30%, #4338ca 60%, #6366f1 100%)' },
  { id: 'warm', label: 'Ấm áp', bg: 'linear-gradient(180deg, #fefce8 0%, #fef9c3 30%, #fef08a 60%, #fde047 100%)' },
] as const;

export type ChatBgPreset = typeof CHAT_BG_PRESETS[number]['id'] | 'custom';

interface ChatBgState {
  bgType: 'preset' | 'custom';
  bgPresetId: ChatBgPreset;
  bgValue: string; // the actual CSS value: gradient or image URL
  bgImageUrl: string; // custom image URL if bgType is 'custom'

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
