import { createSHA256 } from 'hash-wasm';
import axios from '@/lib/utils/axios';
import type {
  ApiSuccessEnvelope,
  CreateVideoUploadInput,
  VideoHlsFinalizeDto,
  VideoUploadCompleteDto,
  VideoUploadSessionDto,
} from '@/lib/types/courses';

const HASH_CHUNK_BYTES = 4 * 1024 * 1024;
export const MAX_SINGLE_VIDEO_BYTES = 4 * 1024 * 1024 * 1024;

function unwrapData<T>(payload: unknown): T {
  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    throw new Error('INVALID_API_RESPONSE');
  }
  return (payload as ApiSuccessEnvelope<T>).data;
}

export async function hashVideoFile(
  file: File,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  const hasher = await createSHA256();
  hasher.init();
  let offset = 0;
  while (offset < file.size) {
    if (signal?.aborted) throw new DOMException('Đã hủy', 'AbortError');
    const end = Math.min(offset + HASH_CHUNK_BYTES, file.size);
    const chunk = new Uint8Array(await file.slice(offset, end).arrayBuffer());
    hasher.update(chunk);
    offset = end;
    onProgress?.(Math.round((offset / file.size) * 100));
    // Yield so the admin interface remains responsive while hashing large sources.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return hasher.digest('hex');
}

export function putVideoToSignedUrl(
  session: VideoUploadSessionDto,
  file: File,
  onProgress: (percent: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(session.method, session.uploadUrl, true);
    Object.entries(session.requiredHeaders).forEach(([name, value]) => {
      if (name.toLowerCase() !== 'content-length') xhr.setRequestHeader(name, value);
    });
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error('DIRECT_UPLOAD_FAILED'));
    };
    xhr.onerror = () => reject(new Error('DIRECT_UPLOAD_FAILED'));
    xhr.onabort = () => reject(new DOMException('Đã hủy', 'AbortError'));
    const abort = () => xhr.abort();
    signal?.addEventListener('abort', abort, { once: true });
    xhr.onloadend = () => signal?.removeEventListener('abort', abort);
    xhr.send(file);
  });
}

export const courseMediaApi = {
  async createUpload(input: CreateVideoUploadInput): Promise<VideoUploadSessionDto> {
    const response = await axios.post<ApiSuccessEnvelope<VideoUploadSessionDto>>(
      '/admin/course-media/uploads',
      input,
    );
    return unwrapData(response.data);
  },

  async completeUpload(sessionId: string): Promise<VideoUploadCompleteDto> {
    const response = await axios.post<ApiSuccessEnvelope<VideoUploadCompleteDto>>(
      `/admin/course-media/uploads/${encodeURIComponent(sessionId)}/complete`,
    );
    return unwrapData(response.data);
  },

  async finalizeHls(videoAssetId: number): Promise<VideoHlsFinalizeDto> {
    const response = await axios.post<ApiSuccessEnvelope<VideoHlsFinalizeDto>>(
      `/admin/course-media/assets/${videoAssetId}/hls/finalize`,
      { manifestVersion: 'hls-v1' },
    );
    return unwrapData(response.data);
  },
};

export function videoContentType(file: File): 'video/mp4' | 'video/quicktime' | null {
  const type = file.type.toLowerCase();
  if (type === 'video/mp4') return 'video/mp4';
  if (type === 'video/quicktime') return 'video/quicktime';
  const name = file.name.toLowerCase();
  if (name.endsWith('.mp4')) return 'video/mp4';
  if (name.endsWith('.mov')) return 'video/quicktime';
  return null;
}

export default courseMediaApi;
