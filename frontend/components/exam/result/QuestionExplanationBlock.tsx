import BilingualMathText from './BilingualMathText';
import type { QuestionResult } from './types';

interface QuestionExplanationBlockProps {
  question: QuestionResult;
  className?: string;
  title?: string;
}

export default function QuestionExplanationBlock({
  question,
  className = '',
  title = '💡 Giải thích:',
}: QuestionExplanationBlockProps) {
  if (!question.explanation && !question.explanation_cn && !question.explanation_image_url) return null;

  return (
    <div className={`rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/25 ${className}`}>
      <p className="mb-2 text-sm font-bold uppercase tracking-wide text-blue-900 dark:text-blue-100">{title}</p>
      {(question.explanation || question.explanation_cn) && (
        <BilingualMathText
          primary={question.explanation}
          secondary={question.explanation_cn}
          className="min-w-0 overflow-x-auto text-base leading-7 text-blue-950 dark:text-blue-50 [&_.katex-display]:overflow-x-auto [&_pre]:overflow-x-auto [&_table]:block [&_table]:overflow-x-auto"
          secondaryClassName="mt-3 border-t border-blue-200 pt-3 text-base leading-7 text-blue-800 dark:border-blue-800/70 dark:text-blue-200"
          readableBreaks
        />
      )}
      {question.explanation_image_url && (
        <img
          src={question.explanation_image_url}
          alt="Ảnh giải thích"
          className="mt-3 max-h-[520px] w-full rounded-lg border border-blue-200 bg-white object-contain dark:border-blue-900/70 dark:bg-gray-950"
        />
      )}
    </div>
  );
}
