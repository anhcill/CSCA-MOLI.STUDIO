'use client';

import { PET_SKINS } from './constants';
import { MoliPetMotionStyles } from './MoliPetMotionStyles';
import { MoliPetPanel } from './MoliPetPanel';
import { MoliPetTrigger } from './MoliPetTrigger';
import { useMoliPetController } from './useMoliPetController';
import type { MoliPetProps } from './types';

export default function MoliPetRoot({ defaultPosition = 'left' }: MoliPetProps) {
  const controller = useMoliPetController({ defaultPosition });

  if (!controller.mounted) return null;

  const skin = PET_SKINS[controller.settings.skin];

  if (controller.hidden) {
    return (
      <button
        type="button"
        onClick={controller.restorePet}
        aria-label="Hiện MolyPet"
        className={`fixed bottom-4 left-3 z-[65] rounded-xl border px-3 py-2 text-xs font-black shadow-lg backdrop-blur sm:bottom-5 sm:left-4 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm ${skin.actionClass}`}
        title="Bật lại MolyPet"
      >
        Hiện MolyPet
      </button>
    );
  }

  if (!controller.petPoint) return null;

  return (
    <div className={`fixed h-[88px] w-[88px] select-none ${controller.open ? 'z-[100]' : 'z-[65]'}`} style={controller.containerStyle}>
      <MoliPetMotionStyles />
      {controller.open && !controller.minimized && <MoliPetPanel controller={controller} />}
      <MoliPetTrigger controller={controller} />
    </div>
  );
}
