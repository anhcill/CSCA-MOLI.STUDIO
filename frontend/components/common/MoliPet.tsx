'use client';

import { type CSSProperties, type FormEvent, type PointerEvent as ReactPointerEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import Lottie from 'lottie-react';
import * as THREE from 'three';
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
type PetVariant = 'cat' | 'star' | 'bunny';

interface MoliPetSettings {
  name: string;
  color: PetColor;
  mood: PetMood;
  position: PetPosition;
  showBubble: boolean;
  motion: boolean;
  variant: PetVariant;
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
const PET_FRAME_SIZE = 88;

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

const PET_3D_PALETTES: Record<PetColor, { body: number; accent: number; innerEar: number; cheek: number }> = {
  ocean: { body: 0x38d5f4, accent: 0x7dd3fc, innerEar: 0xf9a8d4, cheek: 0xfb7185 },
  berry: { body: 0xf472b6, accent: 0xf9a8d4, innerEar: 0xfda4af, cheek: 0xfb7185 },
  leaf: { body: 0x34d399, accent: 0xa3e635, innerEar: 0xf9a8d4, cheek: 0xfb7185 },
  sun: { body: 0xfbbf24, accent: 0xfdba74, innerEar: 0xfca5a5, cheek: 0xfb7185 },
};

const PET_VARIANTS: Record<PetVariant, { label: string; body: number; accent: number; innerEar: number; cheek: number; swatch: string }> = {
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
  name: 'Moly',
  color: 'ocean',
  mood: 'friendly',
  position,
  showBubble: true,
  motion: true,
  variant: 'cat',
});

const readSettings = (position: PetPosition) => {
  if (typeof window === 'undefined') return getDefaultSettings(position);
  try {
    const saved = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || '{}');
    const defaults = getDefaultSettings(position);
    const savedName = typeof saved.name === 'string' ? saved.name.trim().slice(0, 24) : '';
    return {
      ...defaults,
      ...saved,
      name: savedName && savedName.toLowerCase() !== 'moli' ? savedName : defaults.name,
      color: COLOR_THEMES[saved.color as PetColor] ? saved.color : defaults.color,
      mood: MOODS[saved.mood as PetMood] ? saved.mood : defaults.mood,
      position: saved.position === 'right' || saved.position === 'left' ? saved.position : defaults.position,
      showBubble: typeof saved.showBubble === 'boolean' ? saved.showBubble : defaults.showBubble,
      motion: typeof saved.motion === 'boolean' ? saved.motion : defaults.motion,
      variant: PET_VARIANTS[saved.variant as PetVariant] ? saved.variant : defaults.variant,
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

const getStudyContext = (pathname: string | null) => {
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

function MolyThreeCat({
  color,
  variant,
  mood,
  walking,
  facing,
}: {
  color: PetColor;
  variant: PetVariant;
  mood: PetMood;
  walking: boolean;
  facing: PetPosition;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglOk, setWebglOk] = useState(true);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const palette = variant === 'cat' ? PET_3D_PALETTES[color] : PET_VARIANTS[variant];
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1.85, 1.85, 1.85, -1.85, 0.1, 20);
    camera.position.set(0, 0.15, 6);
    camera.lookAt(0, 0.15, 0);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch {
      setWebglOk(false);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(80, 80, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = 'h-full w-full';
    mount.appendChild(renderer.domElement);
    setWebglOk(true);

    const root = new THREE.Group();
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: palette.body, roughness: 0.46, metalness: 0.04 });
    const accentMaterial = new THREE.MeshStandardMaterial({ color: palette.accent, roughness: 0.5 });
    const innerEarMaterial = new THREE.MeshStandardMaterial({ color: palette.innerEar, roughness: 0.6 });
    const cheekMaterial = new THREE.MeshStandardMaterial({ color: palette.cheek, roughness: 0.55 });
    const blackMaterial = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.42 });
    const whiteMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const blueEyeMaterial = new THREE.MeshStandardMaterial({ color: 0x2477c7, roughness: 0.36, metalness: 0.08 });
    const mouthMaterial = new THREE.MeshStandardMaterial({ color: 0x6b1725, roughness: 0.48 });
    const goldMaterial = new THREE.MeshStandardMaterial({ color: 0xf5cf58, roughness: 0.36, metalness: 0.12 });
    const lineMaterial = new THREE.MeshStandardMaterial({ color: 0x243b62, roughness: 0.46 });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.7, 32, 24), bodyMaterial);
    body.scale.set(variant === 'cat' ? 0.96 : 0.74, variant === 'cat' ? 0.76 : 0.92, 0.86);
    body.position.set(0, variant === 'cat' ? -0.52 : -0.6, 0);
    root.add(body);

    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 16), whiteMaterial);
    belly.scale.set(variant === 'cat' ? 1.18 : 0.9, variant === 'cat' ? 0.78 : 0.98, 0.2);
    belly.position.set(0, variant === 'cat' ? -0.48 : -0.58, 0.64);
    root.add(belly);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.96, 36, 28), bodyMaterial);
    head.scale.set(variant === 'star' ? 1.08 : 1.06, variant === 'bunny' ? 1.04 : 0.98, 0.9);
    head.position.set(0, variant === 'cat' ? 0.38 : 0.34, 0.08);
    root.add(head);

    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), whiteMaterial);
    muzzle.scale.set(1.42, 0.68, 0.2);
    muzzle.position.set(0, 0.08, 0.86);
    root.add(muzzle);

    const makeCatEar = (x: number, rotationZ: number) => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.7, 5), bodyMaterial);
      ear.position.set(x, 1.12, 0.02);
      ear.rotation.set(0, 0, rotationZ);
      root.add(ear);

      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.38, 5), innerEarMaterial);
      inner.position.set(x * 0.99, 1.05, 0.17);
      inner.rotation.set(0, 0, rotationZ);
      inner.scale.set(0.86, 0.86, 0.2);
      root.add(inner);
    };

    if (variant === 'cat') {
      makeCatEar(-0.6, 0.3);
      makeCatEar(0.6, -0.3);
    } else if (variant === 'star') {
      [-0.52, 0.52].forEach((x) => {
        const sideHair = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 16), accentMaterial);
        sideHair.scale.set(0.75, 1.85, 0.54);
        sideHair.position.set(x, 0.2, 0.08);
        sideHair.rotation.z = x < 0 ? -0.2 : 0.2;
        root.add(sideHair);
      });
      const bang = new THREE.Mesh(new THREE.SphereGeometry(0.46, 24, 16), accentMaterial);
      bang.scale.set(1.35, 0.72, 0.34);
      bang.position.set(-0.08, 0.98, 0.36);
      bang.rotation.z = -0.28;
      root.add(bang);
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 16), accentMaterial);
      bun.scale.set(0.96, 0.84, 0.72);
      bun.position.set(0.76, 0.78, 0.02);
      root.add(bun);
      const starGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), whiteMaterial);
      starGem.position.set(-0.36, 0.72, 0.9);
      starGem.rotation.z = 0.3;
      root.add(starGem);
    } else {
      [-0.35, 0.35].forEach((x) => {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 16), whiteMaterial);
        ear.scale.set(0.72, 2.05, 0.45);
        ear.position.set(x, 1.18, 0.02);
        ear.rotation.z = x < 0 ? -0.28 : 0.28;
        root.add(ear);
        const inner = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), innerEarMaterial);
        inner.scale.set(0.62, 1.64, 0.24);
        inner.position.set(x, 1.17, 0.18);
        inner.rotation.z = ear.rotation.z;
        root.add(inner);
      });
      const heart = new THREE.Group();
      const lobeLeft = new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 12), innerEarMaterial);
      const lobeRight = new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 12), innerEarMaterial);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.24, 3), innerEarMaterial);
      lobeLeft.position.set(-0.06, 0.03, 0);
      lobeRight.position.set(0.06, 0.03, 0);
      tip.position.set(0, -0.08, 0);
      tip.rotation.z = Math.PI;
      heart.add(lobeLeft, lobeRight, tip);
      heart.position.set(0.12, 1.1, 0.64);
      heart.rotation.z = -0.1;
      root.add(heart);
    }

    const tail = new THREE.Group();
    if (variant === 'cat') {
      const tailCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.68, -0.3, -0.16),
        new THREE.Vector3(1.12, -0.04, -0.08),
        new THREE.Vector3(0.95, 0.46, 0.02),
        new THREE.Vector3(0.7, 0.22, 0.1),
      ]);
      tail.add(new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 28, 0.07, 8), bodyMaterial));
    } else if (variant === 'star') {
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 16), accentMaterial);
      orb.scale.set(1.05, 0.96, 0.76);
      orb.position.set(0.86, 0.36, 0.02);
      tail.add(orb);
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), whiteMaterial);
      star.position.set(0.92, 0.42, 0.25);
      tail.add(star);
    } else {
      const ringCurve = new THREE.EllipseCurve(0, 0, 0.98, 1.18, 0.18, Math.PI * 1.55);
      const points = ringCurve.getPoints(42).map((point) => new THREE.Vector3(point.x, point.y, -0.24));
      const ring = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 42, 0.011, 6), whiteMaterial);
      ring.position.set(0.03, 0.33, 0);
      ring.rotation.x = 0.1;
      tail.add(ring);
    }
    root.add(tail);

    const eyeScaleY = mood === 'sleepy' ? 0.18 : mood === 'happy' ? 0.72 : 1;
    const makeEye = (x: number) => {
      const eyeSize = variant === 'bunny' ? 0.19 : 0.14;
      const eye = new THREE.Mesh(new THREE.SphereGeometry(eyeSize, 24, 18), variant === 'bunny' ? blueEyeMaterial : blackMaterial);
      eye.scale.set(variant === 'bunny' ? 1.05 : 0.9, eyeScaleY, 0.42);
      eye.position.set(x, variant === 'bunny' ? 0.44 : 0.48, 0.9);
      root.add(eye);
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), whiteMaterial);
      shine.position.set(x - 0.035, variant === 'bunny' ? 0.53 : 0.54, 0.98);
      root.add(shine);
      if (variant === 'bunny') {
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), blackMaterial);
        pupil.scale.set(0.9, 1, 0.24);
        pupil.position.set(x, 0.42, 1.02);
        root.add(pupil);
      }
    };
    if (variant === 'star') {
      makeEye(-0.34);
      const wink = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.24, 8), lineMaterial);
      wink.position.set(0.34, 0.48, 0.94);
      wink.rotation.z = Math.PI / 2 - 0.18;
      root.add(wink);
    } else {
      makeEye(-0.34);
      makeEye(0.34);
    }

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.1, 3), blackMaterial);
    nose.position.set(0, 0.2, 1.02);
    nose.rotation.z = Math.PI;
    nose.scale.set(1, 0.8, 0.5);
    root.add(nose);

    const makeLine = (x: number, y: number, z: number, length: number, angle: number, material = blackMaterial) => {
      const line = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, length, 8), material);
      line.position.set(x, y, z);
      line.rotation.z = Math.PI / 2 + angle;
      root.add(line);
      return line;
    };

    if (variant === 'cat') {
      [-0.12, 0.12].forEach((x) => makeLine(x, 0.11, 1.02, 0.14, x < 0 ? -0.7 : 0.7));
      [-0.52, 0.52].forEach((side) => {
        makeLine(side, 0.11, 0.96, 0.36, side < 0 ? 0.12 : -0.12);
        makeLine(side, -0.02, 0.98, 0.38, side < 0 ? -0.08 : 0.08);
      });
    } else {
      const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 10), mouthMaterial);
      mouth.scale.set(1, 0.55, 0.2);
      mouth.position.set(0.02, 0.03, 1.02);
      root.add(mouth);
      makeLine(-0.18, 0.72, 0.9, 0.16, -0.18, lineMaterial);
    }

    [-0.45, 0.45].forEach((x) => {
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), cheekMaterial);
      cheek.scale.set(1.28, 0.58, 0.14);
      cheek.position.set(x, 0.08, 0.9);
      root.add(cheek);
    });

    const paws: THREE.Mesh[] = [];
    [-0.34, 0.34].forEach((x) => {
      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.21, 18, 14), accentMaterial);
      paw.scale.set(1.05, 0.58, 0.68);
      paw.position.set(x, -0.86, 0.48);
      root.add(paw);
      paws.push(paw);
    });

    if (variant === 'star') {
      const dress = new THREE.Mesh(new THREE.ConeGeometry(0.52, 0.62, 5), accentMaterial);
      dress.position.set(0, -0.82, 0.44);
      dress.rotation.z = Math.PI;
      dress.scale.set(1, 0.86, 0.32);
      root.add(dress);
      const badge = new THREE.Mesh(new THREE.OctahedronGeometry(0.13), goldMaterial);
      badge.position.set(0, -0.44, 0.88);
      badge.rotation.z = 0.3;
      root.add(badge);
      [-0.66, 0.66].forEach((x) => {
        const arm = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), bodyMaterial);
        arm.scale.set(1.15, 0.48, 0.52);
        arm.position.set(x, -0.35, 0.54);
        arm.rotation.z = x < 0 ? 0.32 : -0.32;
        root.add(arm);
      });
    } else if (variant === 'bunny') {
      const dress = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), whiteMaterial);
      dress.scale.set(1, 0.42, 0.18);
      dress.position.set(0, -0.85, 0.62);
      root.add(dress);
      const trim = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.018, 8, 48), accentMaterial);
      trim.scale.set(1, 0.28, 0.2);
      trim.position.set(0, -0.82, 0.68);
      root.add(trim);
      const wand = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.72, 8), whiteMaterial);
      wand.position.set(-0.62, -0.38, 0.72);
      wand.rotation.z = -0.72;
      root.add(wand);
      const wandStar = new THREE.Mesh(new THREE.OctahedronGeometry(0.08), accentMaterial);
      wandStar.position.set(-0.82, -0.1, 0.82);
      root.add(wandStar);
    } else {
      const forehead = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 10), accentMaterial);
      forehead.scale.set(0.8, 0.28, 0.16);
      forehead.position.set(0, 0.82, 0.86);
      root.add(forehead);
    }

    root.position.y = 0.0;
    scene.add(root);
    scene.add(new THREE.AmbientLight(0xffffff, 1.7));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.7);
    keyLight.position.set(2.4, 3.2, 5);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x9beafe, 1.6);
    rimLight.position.set(-2, 1.2, 2);
    scene.add(rimLight);

    let frameId = 0;
    const start = performance.now();
    const animate = () => {
      const t = (performance.now() - start) / 1000;
      const pace = walking ? 9.2 : 2.8;
      const bounce = Math.sin(t * pace);
      root.scale.x = facing === 'left' ? -1 : 1;
      root.position.y = 0.04 + (walking ? Math.abs(bounce) * 0.12 : Math.sin(t * 2.6) * 0.045);
      root.rotation.z = (walking ? bounce * 0.055 : Math.sin(t * 2.1) * 0.028) * (facing === 'left' ? -1 : 1);
      tail.rotation.z = Math.sin(t * (walking ? 8 : 3.3)) * 0.18;
      paws[0].position.y = -0.86 + (walking ? Math.max(0, bounce) * 0.12 : 0);
      paws[1].position.y = -0.86 + (walking ? Math.max(0, -bounce) * 0.12 : 0);
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(frameId);
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const material = object.material;
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else material.dispose();
      });
      renderer.dispose();
    };
  }, [color, facing, mood, variant, walking]);

  if (!webglOk) {
    return (
      <div className="flex h-20 w-20 items-center justify-center text-lg font-black text-cyan-700 drop-shadow-[0_10px_18px_rgba(15,23,42,0.22)]">
        =^.^=
      </div>
    );
  }

  return <div ref={mountRef} className="h-20 w-20" aria-hidden="true" />;
}

function PetFace({
  color,
  variant,
  mood,
  walking = false,
  facing = 'right',
}: {
  color: PetColor;
  variant: PetVariant;
  mood: PetMood;
  walking?: boolean;
  facing?: PetPosition;
}) {
  if (variant !== 'cat') {
    return (
      <div className="relative h-20 w-20">
        <div className="pointer-events-none absolute inset-[-14px] opacity-45">
          <Lottie animationData={sparkleAnimation} loop autoplay />
        </div>
        <MolyPlushPet variant={variant} walking={walking} facing={facing} />
      </div>
    );
  }

  return (
    <div className="relative h-20 w-20">
      <div className="pointer-events-none absolute inset-[-14px] opacity-50">
        <Lottie animationData={sparkleAnimation} loop autoplay />
      </div>
      <MolyThreeCat color={color} variant={variant} mood={mood} walking={walking} facing={facing} />
    </div>
  );
}

function MolyPlushPet({
  variant,
  walking,
  facing,
}: {
  variant: Exclude<PetVariant, 'cat'>;
  walking: boolean;
  facing: PetPosition;
}) {
  const isStar = variant === 'star';
  const id = useId().replace(/:/g, '');
  const headGradient = `moly-head-${variant}-${id}`;
  const accentGradient = `moly-accent-${variant}-${id}`;
  const eyeGradient = `moly-eye-${variant}-${id}`;
  const softShadow = `moly-shadow-${variant}-${id}`;

  return (
    <div
      className={`moli-plush-shell relative h-20 w-20 ${walking ? 'moli-plush-walking' : ''}`}
      style={{ '--moli-dir': facing === 'left' ? '-1' : '1' } as CSSProperties}
    >
      <svg className="h-full w-full overflow-visible" viewBox="0 0 80 80" role="img" aria-label={isStar ? 'Moly công chúa sao' : 'Moly thỏ tim'}>
        <defs>
          <radialGradient id={headGradient} cx="34%" cy="24%" r="75%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="58%" stopColor={isStar ? '#eef8ff' : '#fff1f8'} />
            <stop offset="100%" stopColor={isStar ? '#bddfff' : '#ffd7e9'} />
          </radialGradient>
          <linearGradient id={accentGradient} x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor={isStar ? '#ffffff' : '#ffd4e9'} />
            <stop offset="52%" stopColor={isStar ? '#bfe6ff' : '#f7a6cd'} />
            <stop offset="100%" stopColor={isStar ? '#69aee9' : '#c9efff'} />
          </linearGradient>
          <radialGradient id={eyeGradient} cx="34%" cy="28%" r="72%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="32%" stopColor={isStar ? '#8bd9ff' : '#6fc7ff'} />
            <stop offset="72%" stopColor={isStar ? '#3f4bbd' : '#0d5598'} />
            <stop offset="100%" stopColor={isStar ? '#36135e' : '#082b5f'} />
          </radialGradient>
          <filter id={softShadow} x="-30%" y="-30%" width="160%" height="170%">
            <feDropShadow dx="0" dy="8" stdDeviation="4" floodColor={isStar ? '#2563eb' : '#ec4899'} floodOpacity="0.2" />
          </filter>
        </defs>

        <ellipse cx="40" cy="73" rx="22" ry="5" fill="#0f172a" opacity="0.12" />

        {isStar ? (
          <>
            <path d="M16 35c-8 8-8 24 0 31 9 8 21 1 20-11-.8-11-10-25-20-20Z" fill={`url(#${accentGradient})`} filter={`url(#${softShadow})`} />
            <path d="M63 17c8 3 12 11 9 18-3 8-13 10-20 5-7-5-6-17 1-21 3-2 6-3 10-2Z" fill={`url(#${accentGradient})`} filter={`url(#${softShadow})`} />
            <ellipse cx="40" cy="39" rx="29" ry="27" fill={`url(#${headGradient})`} filter={`url(#${softShadow})`} />
            <path d="M18 29c8-16 34-22 44-3-11-5-34-1-44 3Z" fill={`url(#${accentGradient})`} opacity="0.95" />
            <path d="M25 12c12-7 28-2 34 10-12-5-29 0-42 11 1-9 3-17 8-21Z" fill={`url(#${accentGradient})`} />
            <path d="M22 30c8-3 18-2 28 1-9 3-19 4-31 1l3-2Z" fill="#ffffff" opacity="0.45" />
            <path d="M20 22l3 5 5 2-5 3-3 5-3-5-5-3 5-2 3-5Z" fill="#ffffff" stroke="#7ec9ff" strokeWidth="1.5" />
            <circle cx="28" cy="39" r="9" fill={`url(#${eyeGradient})`} />
            <circle cx="25" cy="36" r="3.2" fill="#ffffff" />
            <circle cx="31" cy="42" r="1.2" fill="#ffffff" opacity="0.9" />
            <path d="M49 39c3 4 8 4 11 0" fill="none" stroke="#23346f" strokeLinecap="round" strokeWidth="3" />
            <ellipse cx="22" cy="50" rx="5" ry="3" fill="#f9a8d4" opacity="0.72" />
            <ellipse cx="58" cy="50" rx="5" ry="3" fill="#f9a8d4" opacity="0.68" />
            <path d="M36 50c3 5 9 5 12 0" fill="none" stroke="#7f1d1d" strokeLinecap="round" strokeWidth="3" />
            <path d="M38 57l-10 17h24L42 57h-4Z" fill={`url(#${accentGradient})`} filter={`url(#${softShadow})`} />
            <path d="M33 60h14" stroke="#ffffff" strokeLinecap="round" strokeWidth="2" opacity="0.8" />
            <path d="M40 62l2 4 4 1-4 2-2 4-2-4-4-2 4-1 2-4Z" fill="#fff5b8" stroke="#d8b640" strokeWidth="1" />
          </>
        ) : (
          <>
            <path d="M24 8c-7 1-8 25-2 36 2 4 8 3 9-1 3-12 1-34-7-35Z" fill="#ffffff" filter={`url(#${softShadow})`} />
            <path d="M56 8c7 1 8 25 2 36-2 4-8 3-9-1-3-12-1-34 7-35Z" fill="#ffffff" filter={`url(#${softShadow})`} />
            <path d="M25 15c-3 4-3 16 0 25" stroke="#ffd4e8" strokeLinecap="round" strokeWidth="5" opacity="0.9" />
            <path d="M55 15c3 4 3 16 0 25" stroke="#ffd4e8" strokeLinecap="round" strokeWidth="5" opacity="0.9" />
            <ellipse cx="40" cy="41" rx="29" ry="28" fill={`url(#${headGradient})`} filter={`url(#${softShadow})`} />
            <path d="M34 13c3-7 12-7 15 0 7-1 11 6 7 12-5 7-20 6-27 0-5-5-1-12 5-12Z" fill="#f9b8d5" filter={`url(#${softShadow})`} />
            <circle cx="29" cy="41" r="9" fill={`url(#${eyeGradient})`} />
            <circle cx="51" cy="41" r="9" fill={`url(#${eyeGradient})`} />
            <circle cx="26" cy="37" r="3.2" fill="#ffffff" />
            <circle cx="48" cy="37" r="3.2" fill="#ffffff" />
            <circle cx="33" cy="45" r="1.2" fill="#ffffff" opacity="0.9" />
            <circle cx="55" cy="45" r="1.2" fill="#ffffff" opacity="0.9" />
            <path d="M21 35c2-3 5-4 8-4" stroke="#1f3b78" strokeLinecap="round" strokeWidth="2" />
            <path d="M59 35c-2-3-5-4-8-4" stroke="#1f3b78" strokeLinecap="round" strokeWidth="2" />
            <ellipse cx="24" cy="52" rx="5" ry="3" fill="#f9a8d4" opacity="0.78" />
            <ellipse cx="56" cy="52" rx="5" ry="3" fill="#f9a8d4" opacity="0.72" />
            <path d="M37 51c3 4 8 4 11 0" fill="none" stroke="#7f1d1d" strokeLinecap="round" strokeWidth="3" />
            <path d="M30 61c7 6 18 6 25 0l4 13H26l4-13Z" fill="#ffffff" filter={`url(#${softShadow})`} />
            <path d="M30 68c8 3 18 3 26 0" stroke="#9ee8ff" strokeLinecap="round" strokeWidth="2" />
            <path d="M14 24c18 0 27 13 26 35" fill="none" stroke="#ffffff" strokeLinecap="round" strokeWidth="2" opacity="0.7" />
          </>
        )}
      </svg>
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
  const [walking, setWalking] = useState(false);
  const [facing, setFacing] = useState<PetPosition>(defaultPosition);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const walkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const studyContext = useMemo(() => getStudyContext(pathname), [pathname]);

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

  useEffect(() => {
    if (!mounted || hidden || open || dragging || !settings.motion) {
      if (walkTimeoutRef.current) {
        clearTimeout(walkTimeoutRef.current);
        walkTimeoutRef.current = null;
      }
      setWalking(false);
      return;
    }

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const walk = () => {
      setPetPoint((current) => {
        if (!current) return current;

        const edgeDirection =
          current.x > window.innerWidth * 0.72
            ? -1
            : current.x < window.innerWidth * 0.18
              ? 1
              : Math.random() > 0.5
                ? 1
                : -1;
        const distance = 72 + Math.random() * 128;
        const next = clampPetPoint({
          x: current.x + edgeDirection * distance,
          y: current.y + (Math.random() - 0.5) * 42,
        });

        setFacing(next.x >= current.x ? 'right' : 'left');
        setWalking(true);
        savePetPoint(next);

        if (walkTimeoutRef.current) clearTimeout(walkTimeoutRef.current);
        walkTimeoutRef.current = setTimeout(() => {
          setWalking(false);
          walkTimeoutRef.current = null;
        }, 950);

        return next;
      });
    };

    const startTimer = setTimeout(walk, 1500);
    const interval = setInterval(walk, 5800);

    return () => {
      clearTimeout(startTimer);
      clearInterval(interval);
      if (walkTimeoutRef.current) {
        clearTimeout(walkTimeoutRef.current);
        walkTimeoutRef.current = null;
      }
    };
  }, [mounted, hidden, open, dragging, settings.motion]);

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
        aria-label="Hiện MolyPet"
        className="fixed bottom-4 left-3 z-[65] rounded-xl border border-cyan-100 bg-white/95 px-3 py-2 text-xs font-black text-cyan-700 shadow-lg backdrop-blur hover:bg-cyan-50 sm:bottom-5 sm:left-4 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-cyan-200"
        title="Bật lại MolyPet"
      >
        Hiện MolyPet
      </button>
    );
  }

  if (!petPoint) return null;

  const dockedRight = petPoint.x > window.innerWidth / 2;
  const panelSideClass = dockedRight ? 'sm:right-0 sm:left-auto' : 'sm:left-0 sm:right-auto';
  const bubbleSideClass = dockedRight ? 'right-20' : 'left-20';
  const panelVerticalClass = petPoint.y < 360 ? 'sm:top-20 sm:bottom-auto' : 'sm:bottom-24 sm:top-auto';
  const containerStyle: CSSProperties = {
    left: petPoint.x,
    top: petPoint.y,
    transition: dragging ? 'none' : 'left 950ms cubic-bezier(.34,1.56,.64,1), top 950ms ease',
  };

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
      if (deltaX !== 0) setFacing(deltaX > 0 ? 'right' : 'left');
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
    if (event.clientX !== drag.startX) setFacing(event.clientX > drag.startX ? 'right' : 'left');
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
        { role: 'assistant', content: 'Bạn đăng nhập xong Moly mới dùng AI để trò chuyện được nha.' },
      ]);
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post('/ai/moli-pet', {
        message: text,
        page: pathname,
        pageType: studyContext.pageType,
        subject: studyContext.subject,
        routeHint,
        localTime: new Date().toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', weekday: 'long' }),
        petName: settings.name,
        mood: settings.mood,
        conversationHistory: nextMessages.slice(-6).map((item) => ({
          role: item.role,
          content: item.content,
        })),
      });

      setMessages((current) => [
        ...current,
        { role: 'assistant', content: response.data?.answer || 'Moly nghe rồi nè.' },
      ]);
    } catch (error: any) {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: error?.response?.data?.answer || error?.response?.data?.message || 'Moly bị nghẽn xíu. Bạn thử lại sau nha.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed z-[65] h-[88px] w-[88px] select-none" style={containerStyle}>
      <style>{`
        @keyframes moli-float {
          0%, 100% { transform: scaleX(var(--moli-dir, 1)) translateY(0) rotate(-1deg); }
          50% { transform: scaleX(var(--moli-dir, 1)) translateY(-8px) rotate(1deg); }
        }
        @keyframes moli-walk-bob {
          0%, 100% { transform: scaleX(var(--moli-dir, 1)) translateY(0) rotate(-2deg); }
          25% { transform: scaleX(var(--moli-dir, 1)) translateY(-7px) rotate(2deg); }
          50% { transform: scaleX(var(--moli-dir, 1)) translateY(-2px) rotate(-1deg); }
          75% { transform: scaleX(var(--moli-dir, 1)) translateY(-8px) rotate(2deg); }
        }
        @keyframes moli-shadow {
          0%, 100% { transform: translateX(-50%) scale(1); opacity: .22; }
          50% { transform: translateX(-50%) scale(.82); opacity: .12; }
        }
        @keyframes moli-body-squish {
          0%, 100% { transform: translateX(-50%) scale(1); }
          50% { transform: translateX(-50%) scale(1.04, .96); }
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
        @keyframes moli-tail {
          0%, 100% { transform: rotate(16deg) translateX(0); }
          50% { transform: rotate(38deg) translateX(2px); }
        }
        @keyframes moli-foot-left {
          0%, 100% { transform: translateX(0) translateY(0) rotate(-4deg); }
          50% { transform: translateX(-4px) translateY(-2px) rotate(12deg); }
        }
        @keyframes moli-foot-right {
          0%, 100% { transform: translateX(0) translateY(0) rotate(4deg); }
          50% { transform: translateX(4px) translateY(2px) rotate(-12deg); }
        }
        @keyframes moli-plush-float {
          0%, 100% { transform: scaleX(var(--moli-dir, 1)) translateY(0) rotate(-1deg); }
          50% { transform: scaleX(var(--moli-dir, 1)) translateY(-6px) rotate(1deg); }
        }
        @keyframes moli-plush-walk {
          0%, 100% { transform: scaleX(var(--moli-dir, 1)) translateY(0) rotate(-2deg); }
          25% { transform: scaleX(var(--moli-dir, 1)) translateY(-5px) rotate(2deg); }
          50% { transform: scaleX(var(--moli-dir, 1)) translateY(-1px) rotate(-1deg); }
          75% { transform: scaleX(var(--moli-dir, 1)) translateY(-6px) rotate(2deg); }
        }
        .moli-float { animation: moli-float 3.2s ease-in-out infinite; transform-origin: center bottom; }
        .moli-walking { animation: moli-walk-bob .52s ease-in-out infinite; }
        .moli-plush-shell { animation: moli-plush-float 3s ease-in-out infinite; transform-origin: center bottom; }
        .moli-plush-walking { animation: moli-plush-walk .52s ease-in-out infinite; }
        .moli-shadow { animation: moli-shadow 3.2s ease-in-out infinite; }
        .moli-blink { animation: moli-blink 5.2s ease-in-out infinite; transform-origin: center; }
        .moli-ear-left { animation: moli-ear-left 4s ease-in-out infinite; transform-origin: bottom center; }
        .moli-ear-right { animation: moli-ear-right 4s ease-in-out infinite; transform-origin: bottom center; }
        .moli-hand-left { animation: moli-hand-left 3.4s ease-in-out infinite; transform-origin: right center; }
        .moli-hand-right { animation: moli-hand-right 3.4s ease-in-out infinite; transform-origin: left center; }
        .moli-tail { animation: moli-tail 1.15s ease-in-out infinite; transform-origin: left center; }
        .moli-walking .moli-body { animation: moli-body-squish .52s ease-in-out infinite; transform-origin: center bottom; }
        .moli-walking .moli-foot-left { animation: moli-foot-left .52s ease-in-out infinite; transform-origin: center; }
        .moli-walking .moli-foot-right { animation: moli-foot-right .52s ease-in-out infinite reverse; transform-origin: center; }
        .moli-walking .moli-hand-left { animation-duration: .52s; }
        .moli-walking .moli-hand-right { animation-duration: .52s; animation-direction: reverse; }
        @media (prefers-reduced-motion: reduce) {
          .moli-float, .moli-plush-shell, .moli-shadow, .moli-blink, .moli-ear-left, .moli-ear-right, .moli-hand-left, .moli-hand-right, .moli-tail, .moli-body, .moli-foot-left, .moli-foot-right {
            animation: none;
          }
        }
      `}</style>
      {open && !minimized && (
        <section
          className={`fixed bottom-[104px] left-3 right-3 flex max-h-[calc(100dvh-116px)] w-auto flex-col overflow-hidden rounded-[24px] border border-white/70 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.25)] backdrop-blur-xl sm:absolute sm:left-auto sm:right-auto sm:w-[min(372px,calc(100vw-24px))] ${panelVerticalClass} ${panelSideClass} dark:border-slate-700 dark:bg-slate-900/95`}
          aria-label="MolyPet"
        >
          <div className={`sticky top-0 z-10 flex shrink-0 items-center justify-between border-b px-4 py-3 ${theme.soft} dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100`}>
            <div className="flex min-w-0 items-center gap-3">
              <PetFace color={settings.color} variant={settings.variant} mood={settings.mood} />
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
            <div className="shrink-0 border-b border-slate-100 bg-slate-50 p-3 sm:p-4 dark:border-slate-700 dark:bg-slate-800">
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
              <div className="mt-3 grid grid-cols-3 gap-2">
                {(Object.keys(PET_VARIANTS) as PetVariant[]).map((variant) => (
                  <button
                    key={variant}
                    type="button"
                    title={PET_VARIANTS[variant].label}
                    onClick={() => updateSettings({ variant })}
                    className={`rounded-xl border px-2 py-2 text-xs font-bold transition ${
                      settings.variant === variant
                        ? `${theme.soft} dark:border-slate-500 dark:bg-slate-700 dark:text-white`
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
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
                        ? `${theme.soft} dark:border-slate-500 dark:bg-slate-700 dark:text-white`
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                    }`}
                  >
                    {MOODS[mood].label}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => movePetToSide(settings.position === 'left' ? 'right' : 'left')}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  Góc {settings.position === 'left' ? 'trái' : 'phải'}
                </button>
                <button
                  type="button"
                  onClick={() => updateSettings({ showBubble: !settings.showBubble })}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  Bong bóng {settings.showBubble ? 'bật' : 'tắt'}
                </button>
                <button
                  type="button"
                  onClick={() => updateSettings({ motion: !settings.motion })}
                  className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
                    settings.motion
                      ? `${theme.soft} dark:border-slate-500 dark:bg-slate-700 dark:text-white`
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                  }`}
                >
                  Đi dạo {settings.motion ? 'bật' : 'tắt'}
                </button>
                <button
                  type="button"
                  onClick={hideForDay}
                  className="col-span-3 flex items-center justify-center gap-2 rounded-xl border border-rose-100 bg-white px-3 py-2 text-xs font-bold text-rose-500 hover:bg-rose-50 dark:border-slate-700 dark:bg-slate-900 dark:text-rose-300"
                >
                  <FiEyeOff size={14} />
                  Ẩn pet hôm nay
                </button>
              </div>
            </div>
          )}

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
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

          <form onSubmit={sendMessage} className="flex shrink-0 items-center gap-2 border-t border-slate-100 p-3 dark:border-slate-700">
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
          className={`relative flex h-20 w-20 touch-none items-center justify-center overflow-visible bg-transparent p-0 drop-shadow-[0_16px_26px_rgba(15,23,42,0.28)] transition hover:-translate-y-1 focus-visible:outline-none ${dragging ? 'cursor-grabbing scale-105' : 'cursor-grab'}`}
          title="Keo de di chuyen, bam de mo"
          aria-label={open ? 'Đóng MolyPet' : 'Mở MolyPet'}
        >
          <PetFace color={settings.color} variant={settings.variant} mood={settings.mood} walking={walking} facing={facing} />
          <span className={`absolute -right-1 top-1 flex h-8 w-8 items-center justify-center rounded-2xl text-white shadow-lg ${theme.button}`}>
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
    </div>
  );
}
