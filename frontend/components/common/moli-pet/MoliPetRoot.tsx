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
        className={`fixed bottom-3 left-2 z-[65] w-12 overflow-hidden whitespace-nowrap rounded-lg border px-2 py-1.5 text-center text-[10px] font-black leading-none shadow-md backdrop-blur sm:bottom-4 sm:left-3 sm:w-14 sm:px-2.5 sm:py-2 sm:text-[11px] ${skin.actionClass}`}
        title="Bật lại MolyPet"
      >
        Moly
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
