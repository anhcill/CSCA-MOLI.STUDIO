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
  const scoreChars = String(displayValue).split('');
  const isLongScore = scoreChars.length >= 5;
  const scoreSizeClass =
    isLongScore
      ? 'text-[4.8rem] sm:text-[5.8rem]'
      : scoreChars.length >= 4
        ? 'text-[5.8rem] sm:text-[6.8rem]'
        : 'text-[6.6rem] sm:text-[7.6rem]';
  const scoreCharClass = (char: string) => {
    if (char === '.') {
      return isLongScore
        ? '-ml-2 mr-1 inline-block translate-y-1 sm:-ml-3 sm:mr-1.5'
        : '-ml-5 mr-1.5 inline-block translate-y-1 sm:-ml-7 sm:mr-2';
    }

    return isLongScore ? '-mx-0.5 inline-block' : '-mx-1 inline-block sm:-mx-1.5';
  };

  return (
    <div
      className={`relative mx-auto my-2 flex h-[118px] w-[270px] max-w-full items-center justify-center sm:h-[136px] sm:w-[320px] ${className}`}
      aria-label={`${displayValue} diem`}
      >
      <div
        className={`relative z-10 flex items-end justify-center whitespace-nowrap ${scoreSizeClass} font-black italic leading-none text-[#d52a1e]`}
        style={{
          fontFamily: 'var(--font-scarecrow)',
          textShadow: '1px 2px 0 rgba(161,25,19,0.24), 2px 3px 0 rgba(236,82,67,0.08)',
          transform: 'skewX(-7deg)',
        }}
        aria-hidden="true"
      >
        {scoreChars.map((char, index) => (
          <span
            key={`${char}-${index}`}
            className={scoreCharClass(char)}
          >
            {char}
          </span>
        ))}
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
