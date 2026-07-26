import type { CSSProperties, FormEvent, ClipboardEvent as ReactClipboardEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react';
import type { PastedChatImage } from '@/lib/utils/chatImagePaste';

export type PetColor = 'ocean' | 'berry' | 'leaf' | 'sun';
export type PetMood = 'friendly' | 'happy' | 'focus' | 'sleepy';
export type PetPosition = 'left' | 'right';
export type PetVariant =
  | 'cat'
  | 'star'
  | 'bunny'
  | 'moly-purple'
  | 'moly-chibi'
  | 'moly-3d'
  | 'moly-3d-hog'
  | 'moly-3d-penguin'
  | 'moly-3d-fox'
  | 'moly-3d-crab'
  | 'moly-3d-panda';
export type PetSkinId =
  | 'bubble-cute'
  | 'floating-pet'
  | 'minimal-soft'
  | 'chibi-pet'
  | 'dark-cute'
  | 'retro-game'
  | 'glassmorphism';

export interface MoliPetSettings {
  name: string;
  color: PetColor;
  mood: PetMood;
  position: PetPosition;
  showBubble: boolean;
  motion: boolean;
  variant: PetVariant;
  skin: PetSkinId;
}

export interface MoliPetProps {
  defaultPosition?: PetPosition;
}

export interface PetMessage {
  role: 'user' | 'assistant';
  content: string;
  imageDataUrl?: string;
}

export interface PetPoint {
  x: number;
  y: number;
}

export interface PetSkin {
  id: PetSkinId;
  label: string;
  badge: string;
  subtitle: string;
  defaultColor: PetColor;
  defaultVariant: PetVariant;
  panelClass: string;
  headerClass: string;
  settingsClass: string;
  assistantBubbleClass: string;
  userBubbleClass: string;
  inputClass: string;
  sendButtonClass: string;
  triggerBadgeClass: string;
  triggerGlowClass: string;
  previewClass: string;
  actionClass: string;
  chromeLabel?: string;
  retro?: boolean;
}

export interface MoliPetController {
  mounted: boolean;
  hidden: boolean;
  open: boolean;
  minimized: boolean;
  settingsOpen: boolean;
  settings: MoliPetSettings;
  input: string;
  pastedImage: PastedChatImage | null;
  processingImage: boolean;
  loading: boolean;
  messages: PetMessage[];
  petPoint: PetPoint | null;
  dragging: boolean;
  walking: boolean;
  facing: PetPosition;
  petMood: PetMood;
  routeHint: string;
  cooldownSeconds: number;
  showHintBubble: boolean;
  panelStyle: CSSProperties;
  containerStyle: CSSProperties;
  bubbleSideClass: string;
  messagesScrollRef: RefObject<HTMLDivElement | null>;
  isAuthenticated: boolean;
  isVocabularyRoute: boolean;
  updateSettings: (patch: Partial<MoliPetSettings>) => void;
  movePetToSide: (position: PetPosition) => void;
  restorePet: () => void;
  hideForDay: () => void;
  setOpen: (value: boolean | ((value: boolean) => boolean)) => void;
  setMinimized: (value: boolean | ((value: boolean) => boolean)) => void;
  setSettingsOpen: (value: boolean | ((value: boolean) => boolean)) => void;
  setInput: (value: string) => void;
  clearPastedImage: () => void;
  keepMobileViewportStable: () => void;
  handlePasteImage: (event: ReactClipboardEvent<HTMLInputElement>) => Promise<void>;
  sendMessage: (event: FormEvent) => Promise<void>;
  handlePetPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  handlePetPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  handlePetPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  toggleFromPetClick: () => void;
}
