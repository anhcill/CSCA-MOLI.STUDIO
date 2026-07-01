import { FiAlertCircle, FiRefreshCw } from 'react-icons/fi';

export type ExamAiQualityMode = 'fast' | 'deep';
export type ExamAiFastModel = 'cx/gpt-5.5' | 'ag/claude-opus-4-6-thinking';

interface ExamAiActionsProps {
  qualityMode: ExamAiQualityMode;
  fastModel: ExamAiFastModel;
  disabled?: boolean;
  reviewingExam: boolean;
  applyingDisplayFormatFixes: boolean;
  generatingMissingExplanations: boolean;
  polishingExplanations: boolean;
  normalizingFormulas: boolean;
  onQualityModeChange: (mode: ExamAiQualityMode) => void;
  onFastModelChange: (model: ExamAiFastModel) => void;
  onReview: () => void;
  onApplyDisplayFormatFixes: () => void;
  onGenerateMissingExplanations: () => void;
  onPolishExplanations: () => void;
  onNormalize: () => void;
}

export default function ExamAiActions({
  qualityMode,
  fastModel,
  disabled = false,
  reviewingExam,
  applyingDisplayFormatFixes,
  generatingMissingExplanations,
  polishingExplanations,
  normalizingFormulas,
  onQualityModeChange,
  onFastModelChange,
  onReview,
  onApplyDisplayFormatFixes,
  onGenerateMissingExplanations,
  onPolishExplanations,
  onNormalize,
}: ExamAiActionsProps) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border border-blue-200 bg-white p-1 text-xs font-bold shadow-sm">
          <button
            type="button"
            onClick={() => onQualityModeChange('fast')}
            disabled={disabled}
            className={`rounded-md px-3 py-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              qualityMode === 'fast' ? 'bg-blue-600 text-white' : 'text-blue-700 hover:bg-blue-50'
            }`}
          >
            Nhanh
          </button>
          <button
            type="button"
            onClick={() => onQualityModeChange('deep')}
            disabled={disabled}
            className={`rounded-md px-3 py-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              qualityMode === 'deep' ? 'bg-violet-600 text-white' : 'text-violet-700 hover:bg-violet-50'
            }`}
            title="Chạy kỹ hơn, lâu hơn nhưng chắc hơn."
          >
            Kỹ
          </button>
        </div>
        <select
          value={fastModel}
          onChange={event => onFastModelChange(event.target.value as ExamAiFastModel)}
          disabled={disabled || qualityMode !== 'fast'}
          title="Model dùng cho chế độ Nhanh"
          className="h-8 rounded-lg border border-blue-200 bg-white px-2 text-xs font-bold text-blue-800 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="cx/gpt-5.5">5.5</option>
          <option value="ag/claude-opus-4-6-thinking">Opus 4.6</option>
        </select>
      </div>
      <button
        onClick={onReview}
        disabled={reviewingExam || disabled}
        className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
      >
        <FiAlertCircle size={15} />
        {reviewingExam ? 'AI đang soát...' : 'AI soát đề với file gốc'}
      </button>
      <button
        onClick={onApplyDisplayFormatFixes}
        disabled={applyingDisplayFormatFixes || disabled}
        className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
      >
        <FiRefreshCw size={15} className={applyingDisplayFormatFixes ? 'animate-spin' : ''} />
        {applyingDisplayFormatFixes ? 'AI đang sửa format...' : 'AI sửa format hiển thị'}
      </button>
      <button
        onClick={onGenerateMissingExplanations}
        disabled={generatingMissingExplanations || disabled}
        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
      >
        <FiRefreshCw size={15} className={generatingMissingExplanations ? 'animate-spin' : ''} />
        {generatingMissingExplanations ? 'AI đang thêm...' : 'AI thêm giải thích thiếu'}
      </button>
      <button
        onClick={onPolishExplanations}
        disabled={polishingExplanations || disabled}
        className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
      >
        <FiRefreshCw size={15} className={polishingExplanations ? 'animate-spin' : ''} />
        {polishingExplanations ? 'AI đang chuẩn hóa...' : 'AI chuẩn hóa lời giải'}
      </button>
      <button
        onClick={onNormalize}
        disabled={normalizingFormulas || disabled}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
      >
        <FiRefreshCw size={15} className={normalizingFormulas ? 'animate-spin' : ''} />
        {normalizingFormulas ? 'Đang chuẩn hóa...' : 'Chuẩn hóa công thức đề này'}
      </button>
    </>
  );
}
