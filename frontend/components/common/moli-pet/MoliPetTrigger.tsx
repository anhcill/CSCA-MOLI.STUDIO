'use client';

import { FiChevronUp, FiEyeOff, FiMessageCircle } from 'react-icons/fi';
import { PET_SKINS } from './constants';
import { PetFace } from './PetFace';
import type { MoliPetController } from './types';

export function MoliPetTrigger({ controller }: { controller: MoliPetController }) {
  const {
    open,
    minimized,
    dragging,
    walking,
    facing,
    settings,
    petMood,
    isVocabularyRoute,
    showHintBubble,
    bubbleSideClass,
    routeHint,
    setOpen,
    setMinimized,
    hideForDay,
    handlePetPointerDown,
    handlePetPointerMove,
    handlePetPointerUp,
    toggleFromPetClick,
  } = controller;
  const skin = PET_SKINS[settings.skin];

  return (
    <>
      {showHintBubble && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`absolute bottom-5 ${bubbleSideClass} hidden max-w-[240px] rounded-2xl border px-4 py-3 text-left text-sm font-semibold shadow-xl sm:block ${skin.assistantBubbleClass}`}
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
          onClick={toggleFromPetClick}
          className={`relative flex h-20 w-20 touch-none items-center justify-center overflow-visible bg-transparent p-0 transition hover:-translate-y-1 focus-visible:outline-none ${skin.triggerGlowClass} ${dragging ? 'cursor-grabbing scale-105' : 'cursor-grab'}`}
          title="Kéo để di chuyển, bấm để mở"
          aria-label={open ? 'Đóng MolyPet' : 'Mở MolyPet'}
        >
          <PetFace color={settings.color} variant={settings.variant} mood={petMood} walking={walking} facing={facing} waving={isVocabularyRoute && !open} />
          <span className={`absolute -right-1 top-1 flex h-8 w-8 items-center justify-center rounded-2xl shadow-lg ${skin.triggerBadgeClass}`}>
            <FiMessageCircle size={16} />
          </span>
        </button>
        <button
          type="button"
          onClick={hideForDay}
          className="hidden"
          title="Tắt MolyPet hôm nay"
        >
          <FiEyeOff />
        </button>
      </div>
    </>
  );
}
