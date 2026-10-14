import axios from '@/lib/utils/axios';
export type BunnyAsset = { videoAssetId: number; provider: 'r2' | 'bunny'; status: string; assetExternalKey: string; durationSeconds: number; providerVideoId?: string | null };
export type BunnyUpload = BunnyAsset & { upload: { endpoint: string; headers: Record<string, string>; expiresAt: string } };
const base = '/admin/bunny-media';
export const bunnyMediaApi = {
  async create(courseId: number, lessonId: number): Promise<BunnyUpload> { return (await axios.post(`${base}/uploads`, { courseId, lessonId })).data.data; },
  async status(id: number): Promise<BunnyAsset> { return (await axios.get(`${base}/assets/${id}`)).data.data; },
  async sync(id: number): Promise<BunnyAsset> { return (await axios.post(`${base}/assets/${id}/sync`)).data.data; },
  async authorization(id: number): Promise<BunnyUpload> { return (await axios.post(`${base}/assets/${id}/authorization`)).data.data; },
  async recover(id: number, videoId: string): Promise<BunnyAsset> { return (await axios.post(`${base}/assets/${id}/recover`, { videoId })).data.data; },
};
