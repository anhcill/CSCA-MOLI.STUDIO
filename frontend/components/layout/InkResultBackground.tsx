import type { ReactNode } from 'react';

export const INK_RESULT_BACKGROUND_SRC = '/images/exam-result-ink-bg-20260705c.png';

export const inkResultPanel =
  'border border-[#e8d5b8]/85 bg-[#fffaf2]/88 shadow-[0_22px_70px_rgba(129,77,33,0.16)] backdrop-blur-md';

export const inkResultSoftPanel =
  'border border-[#ead9bd]/80 bg-[#fffaf2]/76 shadow-[0_14px_45px_rgba(129,77,33,0.12)] backdrop-blur-md';

export const inkResultButtonPanel =
  'border border-[#ead9bd]/75 bg-[#fffaf2]/68 shadow-[0_10px_30px_rgba(129,77,33,0.10)] backdrop-blur-md';

export const inkResultTitle = 'text-[#4f3521]';
export const inkResultMuted = 'text-[#8b7866]';
export const inkResultScore = 'text-[#d52a1e]';

type InkScoreMarkProps = {
  value: string | number;
  className?: string;
};

export function InkScoreMark({ value, className = '' }: InkScoreMarkProps) {
  const displayValue = typeof value === 'number' ? value.toFixed(1) : value;
  const scoreText = String(displayValue);
  const [wholeScore, decimalScore = ''] = scoreText.split('.');
  const hasDecimal = scoreText.includes('.');
  const isLongScore = scoreText.length >= 5;
  const isMediumScore = scoreText.length >= 4;
  const scoreSizeClass =
    isLongScore
      ? 'text-[4.25rem] sm:text-[5.1rem]'
      : isMediumScore
        ? 'text-[5rem] sm:text-[6rem]'
        : 'text-[6.15rem] sm:text-[7.25rem]';
  const digitSpacingClass = isLongScore
    ? 'tracking-[0.015em]'
    : isMediumScore
      ? 'tracking-[-0.015em]'
      : 'tracking-[-0.035em]';
  const dotClass = isLongScore
    ? 'mx-1.5 mb-[0.22em] h-2.5 w-2.5 sm:h-3 sm:w-3'
    : isMediumScore
      ? 'mx-1.5 mb-[0.2em] h-3 w-3 sm:mx-2 sm:h-3.5 sm:w-3.5'
      : 'mx-1 mb-[0.18em] h-3.5 w-3.5 sm:mx-1.5 sm:h-4 sm:w-4';

  return (
    <div
      className={`relative mx-auto my-2 flex h-[118px] w-[270px] max-w-full items-center justify-center sm:h-[136px] sm:w-[320px] ${className}`}
      aria-label={`${displayValue} diem`}
    >
      <div
        className={`relative z-10 flex items-end justify-center whitespace-nowrap ${scoreSizeClass} ${digitSpacingClass} font-black italic leading-none text-[#d52a1e]`}
        style={{
          fontFamily: 'var(--font-scarecrow)',
          textShadow: '1px 2px 0 rgba(161,25,19,0.24), 2px 3px 0 rgba(236,82,67,0.08)',
          transform: 'skewX(-7deg)',
        }}
        aria-hidden="true"
      >
        <span>{wholeScore}</span>
        {hasDecimal && (
          <span
            className={`inline-block flex-none rounded-[45%] bg-[#d52a1e] shadow-[1px_2px_0_rgba(161,25,19,0.24),2px_3px_0_rgba(236,82,67,0.08)] ${dotClass}`}
          />
        )}
        {decimalScore && <span>{decimalScore}</span>}
      </div>

      <div
        className="absolute right-6 bottom-7 z-20 flex h-9 w-7 items-center justify-center rounded-sm bg-[#c91e16] text-[10px] font-black leading-[0.95] text-white shadow-[0_3px_0_rgba(151,30,23,0.16)] sm:right-7 sm:bottom-8"
        aria-hidden="true"
      >
        <span className="[writing-mode:vertical-rl]">&#x8003;&#x8BD5;</span>
      </div>
    </div>
  );
}

type InkResultBackgroundProps = {
  children: ReactNode;
  className?: string;
};

export default function InkResultBackground({ children, className = '' }: InkResultBackgroundProps) {
  return (
    <div className={`relative min-h-screen overflow-x-hidden bg-[#fbf3e8] text-slate-900 ${className}`}>
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${INK_RESULT_BACKGROUND_SRC})` }}
      />
      <div className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-white/40 via-[#fff7ee]/12 to-[#fff7ee]/66" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
