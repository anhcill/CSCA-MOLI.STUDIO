import type { ReactNode } from 'react';

interface ExamAiPanelProps {
  title?: string;
  description?: string;
  actions: ReactNode;
  sourceFilePanel?: ReactNode;
  history?: ReactNode;
  results?: ReactNode;
}

export default function ExamAiPanel({
  title = 'Chế độ sửa đề',
  description = 'Sửa câu, thêm câu, upload file gốc và chạy AI soát đề trong cùng một khu vực.',
  actions,
  sourceFilePanel,
  history,
  results,
}: ExamAiPanelProps) {
  return (
    <>
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="font-bold text-blue-900">{title}</p>
          <p className="text-sm text-blue-700">{description}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">{actions}</div>
      </div>
      {sourceFilePanel}
      {history}
      {results}
    </>
  );
}
