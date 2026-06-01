'use client';

import { useState } from 'react';
import { FiUpload } from 'react-icons/fi';
import { examAdminApi, ImportedExamItem, PdfImportPreview } from '@/lib/api/examAdmin';
import { PDF_IMPORT_PRESETS, PdfImportPreset } from '@/lib/pdf-import/presets';
import PdfImportReview from './PdfImportReview';

interface PdfImportPanelProps {
  canImport: boolean;
  preview: PdfImportPreview | null;
  items: ImportedExamItem[];
  saving: boolean;
  onPreviewLoaded: (preview: PdfImportPreview) => void;
  onPreviewCleared: () => void;
  onChangeItems: (items: ImportedExamItem[]) => void;
  onSave: () => void;
}

export default function PdfImportPanel({
  canImport,
  preview,
  items,
  saving,
  onPreviewLoaded,
  onPreviewCleared,
  onChangeItems,
  onSave,
}: PdfImportPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preset, setPreset] = useState<PdfImportPreset>('auto');
  const [loading, setLoading] = useState(false);

  const handlePreview = async () => {
    if (!canImport) {
      alert('Vui lòng tạo đề thi trước khi import PDF');
      return;
    }

    if (!file) {
      alert('Vui lòng chọn file PDF');
      return;
    }

    try {
      setLoading(true);
      const nextPreview = await examAdminApi.previewPdfImport(file, preset);
      onPreviewLoaded(nextPreview);
    } catch (error: any) {
      console.error('Error previewing PDF import:', error);
      alert(error?.response?.data?.message || 'Phân tích PDF thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-5 mb-6">
      <div className="flex flex-col gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <FiUpload className="text-blue-600" />
            <h3 className="text-lg font-bold text-gray-900">Import OCR/PDF đa môn</h3>
          </div>
          <p className="text-sm text-gray-500">
            Upload PDF dạng text hoặc đã OCR để AI tách câu hỏi, đáp án và giải thích. PDF scan ảnh thuần vẫn cần OCR ảnh ở bước sau.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-3 xl:grid-cols-6">
          {PDF_IMPORT_PRESETS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setPreset(option.key)}
              className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                preset === option.key
                  ? 'border-blue-500 bg-blue-50 text-blue-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="block text-sm font-semibold">{option.label}</span>
              <span className="mt-1 block text-xs leading-snug text-gray-500">{option.description}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex-1">
            <input
              type="file"
              accept="application/pdf"
              onChange={(event) => {
                setFile(event.target.files?.[0] || null);
                onPreviewCleared();
              }}
              className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          <button
            type="button"
            onClick={handlePreview}
            disabled={loading || !file}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <FiUpload />
            <span>{loading ? 'Đang phân tích...' : 'Phân tích PDF'}</span>
          </button>
        </div>
      </div>

      {preview && (
        <PdfImportReview
          preview={preview}
          items={items}
          saving={saving}
          onSave={onSave}
          onChangeItems={(nextItems) => {
            onChangeItems(nextItems);
          }}
        />
      )}
    </div>
  );
}
