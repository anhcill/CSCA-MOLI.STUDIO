import RichMathText from '@/components/common/RichMathText';
import { hasAltText } from './utils';
import { getExamLanguageText } from '@/lib/exam/languageMode';

interface BilingualMathTextProps {
  primary?: string | null;
  secondary?: string | null;
  tertiary?: string | null;
  languageMode?: string | null;
  className?: string;
  secondaryClassName?: string;
  readableBreaks?: boolean;
}

export default function BilingualMathText({
  primary,
  secondary,
  tertiary,
  languageMode,
  className = '',
  secondaryClassName = 'mt-1 text-sm text-gray-500 dark:text-gray-400',
  readableBreaks = false,
}: BilingualMathTextProps) {
  const selected = getExamLanguageText({ vi: primary, zh: secondary, en: tertiary }, languageMode);
  const main = selected.primary;
  if (!main) return null;

  return (
    <div className="min-w-0">
      <RichMathText value={main} className={className} readableBreaks={readableBreaks} />
      {hasAltText(main, selected.secondary) && (
        <RichMathText value={selected.secondary} className={secondaryClassName} readableBreaks={readableBreaks} />
      )}
    </div>
  );
}
