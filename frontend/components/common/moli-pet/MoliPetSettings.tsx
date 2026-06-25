'use client';

import { FiCheck, FiEyeOff } from 'react-icons/fi';
import { COLOR_THEMES, MOODS, PET_SKINS, PET_SKIN_IDS, PET_VARIANTS } from './constants';
import type { MoliPetController, PetColor, PetMood, PetSkinId, PetVariant } from './types';

export function MoliPetSettings({ controller }: { controller: MoliPetController }) {
  const { settings, updateSettings, movePetToSide, hideForDay } = controller;
  const activeSkin = PET_SKINS[settings.skin];

  const selectSkin = (skinId: PetSkinId) => {
    const skin = PET_SKINS[skinId];
    updateSettings({
      skin: skinId,
      color: skin.defaultColor,
      variant: skin.defaultVariant,
    });
  };

  return (
    <div
      className={`min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 ${activeSkin.settingsClass}`}
    >
      <label className="block text-xs font-bold text-slate-500 dark:text-slate-300">
        Tên pet
        <input
          value={settings.name}
          maxLength={24}
          onChange={(event) => updateSettings({ name: event.target.value })}
          className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-0 text-sm font-semibold leading-5 text-slate-800 outline-none placeholder:leading-5 focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
      </label>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {PET_SKIN_IDS.map((skinId) => {
          const skin = PET_SKINS[skinId];
          const selected = settings.skin === skinId;
          return (
            <button
              key={skinId}
              type="button"
              onClick={() => selectSkin(skinId)}
              className={`min-h-[56px] rounded-xl border px-2 py-2 text-left text-[11px] font-black leading-tight transition ${
                selected
                  ? 'border-slate-900 bg-white text-slate-900 ring-2 ring-slate-900/10 dark:border-white dark:bg-slate-800 dark:text-white'
                  : 'border-white/70 bg-white/70 text-slate-600 hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
              } ${skin.retro ? 'font-mono' : ''}`}
              title={skin.label}
            >
              <span className={`mb-1 flex h-6 items-center justify-between rounded-lg px-2 text-[10px] ring-1 ${skin.previewClass}`}>
                <span>{skin.badge}</span>
                {selected && <FiCheck size={12} />}
              </span>
              <span className="block truncate">{skin.label}</span>
            </button>
          );
        })}
      </div>

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

      <div className="mt-3 grid grid-cols-3 gap-2">
        {(Object.keys(PET_VARIANTS) as PetVariant[]).map((variant) => (
          <button
            key={variant}
            type="button"
            title={PET_VARIANTS[variant].label}
            onClick={() => updateSettings({ variant })}
            className={`rounded-xl border px-2 py-2 text-xs font-bold transition ${
              settings.variant === variant
                ? 'border-slate-900 bg-white text-slate-900 ring-2 ring-slate-900/10 dark:border-white dark:bg-slate-800 dark:text-white'
                : 'border-white/70 bg-white/70 text-slate-600 hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
            }`}
          >
            <span className={`mb-1 block h-5 rounded-lg bg-gradient-to-br ${PET_VARIANTS[variant].swatch}`} />
            {PET_VARIANTS[variant].label}
          </button>
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
                ? 'border-slate-900 bg-white text-slate-900 ring-2 ring-slate-900/10 dark:border-white dark:bg-slate-800 dark:text-white'
                : 'border-white/70 bg-white/70 text-slate-600 hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
            }`}
          >
            {MOODS[mood].label}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => movePetToSide(settings.position === 'left' ? 'right' : 'left')}
          className="rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
        >
          Góc {settings.position === 'left' ? 'trái' : 'phải'}
        </button>
        <button
          type="button"
          onClick={() => updateSettings({ motion: !settings.motion })}
          className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
            settings.motion
              ? 'border-slate-900 bg-white text-slate-900 ring-2 ring-slate-900/10 dark:border-white dark:bg-slate-800 dark:text-white'
              : 'border-white/70 bg-white/80 text-slate-600 hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
          }`}
        >
          Đi dạo {settings.motion ? 'bật' : 'tắt'}
        </button>
        <button
          type="button"
          onClick={hideForDay}
          className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-rose-100 bg-white/85 px-3 py-2 text-xs font-bold text-rose-500 hover:bg-rose-50 dark:border-slate-700 dark:bg-slate-900 dark:text-rose-300"
        >
          <FiEyeOff size={14} />
          Ẩn pet hôm nay
        </button>
      </div>
    </div>
  );
}
