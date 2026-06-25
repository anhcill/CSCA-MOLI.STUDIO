'use client';

export function MoliPetMotionStyles() {
  return (
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
      @keyframes moli-wave-paw {
        0%, 100% { transform: rotate(-12deg) translateY(0); }
        25% { transform: rotate(18deg) translateY(-2px); }
        50% { transform: rotate(-18deg) translateY(0); }
        75% { transform: rotate(16deg) translateY(-2px); }
      }
      .moli-float { animation: moli-float 3.2s ease-in-out infinite; transform-origin: center bottom; }
      .moli-walking { animation: moli-walk-bob .52s ease-in-out infinite; }
      .moli-plush-shell { animation: moli-plush-float 3s ease-in-out infinite; transform-origin: center bottom; }
      .moli-plush-walking { animation: moli-plush-walk .52s ease-in-out infinite; }
      .moli-wave-paw { animation: moli-wave-paw 1.18s ease-in-out infinite; transform-origin: 50% 100%; }
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
        .moli-float, .moli-plush-shell, .moli-shadow, .moli-blink, .moli-ear-left, .moli-ear-right, .moli-hand-left, .moli-hand-right, .moli-tail, .moli-body, .moli-foot-left, .moli-foot-right, .moli-wave-paw {
          animation: none;
        }
      }
    `}</style>
  );
}
