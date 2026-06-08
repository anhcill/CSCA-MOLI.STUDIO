'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { examAdminApi } from '@/lib/api/examAdmin';

const IMAGE_OCR_MAX_SIZE = 8 * 1024 * 1024;
const IMAGE_OCR_HARD_MAX_SIZE = 20 * 1024 * 1024;
const IMAGE_OCR_MAX_EDGE = 2200;
const IMAGE_OCR_JPEG_QUALITY = 0.9;

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

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('IMAGE_LOAD_FAILED'));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise(resolve => {
    canvas.toBlob(resolve, 'image/jpeg', IMAGE_OCR_JPEG_QUALITY);
  });
}

async function prepareImageForOcr(file: File): Promise<File> {
  if (!/^image\/(?:png|jpe?g|webp)$/i.test(file.type)) return file;

  const image = await loadImage(file);
  const scale = Math.min(1, IMAGE_OCR_MAX_EDGE / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  if (scale === 1 && file.size <= IMAGE_OCR_MAX_SIZE * 0.55 && file.type === 'image/jpeg') {
    return file;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return file;

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const blob = await canvasToBlob(canvas);
  if (!blob || blob.size >= file.size) return file;

  const baseName = file.name?.replace(/\.[^.]+$/, '') || 'clipboard-image';
  return new File([blob], `${baseName}-ocr.jpg`, { type: 'image/jpeg' });
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

    if (file.size > IMAGE_OCR_HARD_MAX_SIZE) {
      alert('Ảnh tối đa 20MB trước khi tối ưu.');
      return;
    }

    const runId = activeRunRef.current + 1;
    activeRunRef.current = runId;

    try {
      setLoading(true);
      const ocrFile = await prepareImageForOcr(file);
      if (activeRunRef.current !== runId) return;

      if (ocrFile.size > IMAGE_OCR_MAX_SIZE) {
        alert('Ảnh sau khi tối ưu vẫn quá 8MB. Vui lòng cắt sát 1 câu hỏi rồi thử lại.');
        return;
      }

      const originalName = file.name || 'Ảnh từ clipboard';
      setFileName(ocrFile === file ? originalName : `${originalName} (đã tối ưu)`);
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(file);
      });

      const result = await examAdminApi.ocrSingleQuestionImage(ocrFile);
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
