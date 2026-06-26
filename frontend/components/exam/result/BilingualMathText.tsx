import RichMathText from '@/components/common/RichMathText';
import { hasAltText } from './utils';

interface BilingualMathTextProps {
  primary?: string | null;
  secondary?: string | null;
  className?: string;
  secondaryClassName?: string;
  readableBreaks?: boolean;
}

export default function BilingualMathText({
  primary,
  secondary,
  className = '',
  secondaryClassName = 'mt-1 text-sm text-gray-500 dark:text-gray-400',
  readableBreaks = false,
}: BilingualMathTextProps) {
  const main = (primary || secondary || '').trim();
  if (!main) return null;

  return (
    <div className="min-w-0">
      <RichMathText value={main} className={className} readableBreaks={readableBreaks} />
      {hasAltText(main, secondary) && (
        <RichMathText value={secondary || ''} className={secondaryClassName} readableBreaks={readableBreaks} />
      )}
    </div>
  );
}
