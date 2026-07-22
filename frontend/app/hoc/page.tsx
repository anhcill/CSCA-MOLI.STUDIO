import { MyLearningClient } from '@/components/learning/MyLearningClient';

export default function MyLearningPage() {
  return <main className="min-h-screen bg-slate-50 px-4 py-12"><div className="mx-auto max-w-6xl"><h1 className="text-4xl font-black text-slate-950">Khóa học của tôi</h1><p className="mb-8 mt-3 text-slate-600">Tiếp tục lộ trình học CSCA từ vị trí gần nhất.</p><MyLearningClient /></div></main>;
}
