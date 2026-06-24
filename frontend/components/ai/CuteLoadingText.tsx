interface CuteLoadingTextProps {
  text: string;
  className?: string;
}

export default function CuteLoadingText({ text, className = '' }: CuteLoadingTextProps) {
  return (
    <span className={`inline-flex flex-wrap justify-center ${className}`} aria-label={text}>
      {Array.from(text).map((char, index) => (
        <span
          key={`${char}-${index}`}
          aria-hidden="true"
          className="inline-block animate-bounce"
          style={{
            animationDelay: `${(index % 12) * 55}ms`,
            animationDuration: '1.35s',
          }}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </span>
  );
}
