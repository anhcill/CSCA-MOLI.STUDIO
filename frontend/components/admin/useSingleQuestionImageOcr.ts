'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { examAdminApi } from '@/lib/api/examAdmin';

const IMAGE_OCR_MAX_SIZE = 5 * 1024 * 1024;

interface ClipboardImageEvent {
  clipboardData?: DataTransfer | null;
}

interface UseSingleQuestionImageOcrOptions {
  onTextExtracted: (text: string) => void;
}

export function getClipboardImage(event: ClipboardImageEvent): File | null {
  const items = Array.from(event.clipboardData?.items || []);
  const imageItem = items.find(item => item.type.startsWith('image/'));
  return imageItem?.getAsFile() || null;
}

export function useSingleQuestionImageOcr({ onTextExtracted }: UseSingleQuestionImageOcrOptions) {
  const activeRunRef = useRef(0);
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [fileName, setFileName] = useState('');

  useEffect(() => () => {
    activeRunRef.current += 1;
  }, []);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const clearImageOcr = useCallback(() => {
    activeRunRef.current += 1;
    setLoading(false);
    setFileName('');
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return '';
    });
  }, []);

  const runImageOcr = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn ảnh hợp lệ.');
      return;
    }

    if (file.size > IMAGE_OCR_MAX_SIZE) {
      alert('Ảnh tối đa 5MB.');
      return;
    }

    const runId = activeRunRef.current + 1;
    activeRunRef.current = runId;

    try {
      setLoading(true);
      setFileName(file.name || 'Ảnh từ clipboard');
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(file);
      });

      const result = await examAdminApi.ocrSingleQuestionImage(file);
      if (activeRunRef.current === runId) {
        onTextExtracted(result.text || '');
      }
    } catch (error: any) {
      console.error('OCR ảnh thất bại:', error);
      if (activeRunRef.current === runId) {
        alert(error?.response?.data?.message || 'OCR ảnh thất bại.');
      }
    } finally {
      if (activeRunRef.current === runId) {
        setLoading(false);
      }
    }
  }, [onTextExtracted]);

  return {
    clearImageOcr,
    fileName,
    loading,
    previewUrl,
    runImageOcr,
  };
}
