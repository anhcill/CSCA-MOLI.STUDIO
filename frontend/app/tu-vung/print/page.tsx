'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import axios from '@/lib/utils/axios';

interface VocabItem {
  id: number;
  word_cn: string;
  pinyin: string;
  word_vn: string;
  word_en: string;
  subject: string;
  topic: string;
  example_cn: string;
  example_vn: string;
}

function PrintContent() {
  const searchParams = useSearchParams();
  const subject = searchParams.get('subject') || '';
  const topic = searchParams.get('topic') || '';

  const [words, setWords] = useState<VocabItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params: Record<string, string> = { limit: '500' };
    if (subject) params.subject = subject;
    if (topic) params.topic = topic;

    axios.get('/vocabulary', { params })
      .then(r => { setWords(r.data.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [subject, topic]);

  useEffect(() => {
    if (!loading && words.length > 0) {
      setTimeout(() => window.print(), 500);
    }
  }, [loading, words]);

  const SUBJECT_LABELS: Record<string, string> = {
    'toan': 'Toán',
    'vat-ly': 'Vật Lý',
    'hoa-hoc': 'Hóa Học',
    'tieng-trung-xh': 'Tiếng Trung XH',
    'tieng-trung-tn': 'Tiếng Trung TN',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-3" />
          <p className="text-gray-500">Đang chuẩn bị...</p>
        </div>
      </div>
    );
  }

  const grouped = words.reduce((acc, w) => {
    const key = w.topic || 'Khác';
    if (!acc[key]) acc[key] = [];
    acc[key].push(w);
    return acc;
  }, {} as Record<string, VocabItem[]>);

  const subjectLabel = SUBJECT_LABELS[subject] || 'Tất cả môn';
  const title = topic ? `Từ Vựng: ${topic}` : `Từ Vựng ${subjectLabel}`;

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 11pt; }
          table { page-break-inside: avoid; }
          tr { page-break-inside: avoid; }
          h2 { page-break-before: auto; }
        }
        @page { size: A4; margin: 15mm 12mm; }
        body { font-family: 'Arial', sans-serif; }
      `}</style>

      <div className="no-print bg-blue-600 text-white px-6 py-3 flex items-center justify-between">
        <span className="font-semibold">Xem trước — {words.length} từ</span>
        <div className="flex gap-3">
          <button onClick={() => window.history.back()} className="px-4 py-1.5 bg-white/20 rounded-lg text-sm hover:bg-white/30 transition">
            ← Quay lại
          </button>
          <button onClick={() => window.print()} className="px-4 py-1.5 bg-white rounded-lg text-blue-700 font-bold text-sm hover:bg-blue-50 transition">
            🖨️ In
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-8">
        <div className="text-center mb-6 border-b-2 border-gray-800 pb-4">
          <h1 className="text-2xl font-black text-gray-900">{title}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {subjectLabel} · {words.length} từ · CSCA — Ôn thi học bổng Trung Quốc
          </p>
        </div>

        {topic ? (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-cyan-600">
                <th className="border border-gray-300 px-4 py-3 text-white font-black text-center w-16">#</th>
                <th className="border border-gray-300 px-4 py-3 text-white font-black text-center">Tiếng Trung</th>
                <th className="border border-gray-300 px-4 py-3 text-white font-black text-center">Pinyin</th>
                <th className="border border-gray-300 px-4 py-3 text-white font-black text-center">Tiếng Anh</th>
                <th className="border border-gray-300 px-4 py-3 text-white font-black text-center">Tiếng Việt</th>
              </tr>
            </thead>
            <tbody>
              {words.map((w, i) => (
                <tr key={w.id} className={i % 2 === 0 ? 'bg-white' : 'bg-cyan-50/30'}>
                  <td className="border border-gray-300 px-3 py-2.5 text-center text-gray-400 text-xs">{i + 1}</td>
                  <td className="border border-gray-300 px-4 py-2.5 text-center font-black text-2xl text-gray-900">{w.word_cn}</td>
                  <td className="border border-gray-300 px-4 py-2.5 text-center text-cyan-700 italic font-semibold">{w.pinyin}</td>
                  <td className="border border-gray-300 px-4 py-2.5 text-center text-gray-600 text-sm">{w.word_en || '—'}</td>
                  <td className="border border-gray-300 px-4 py-2.5 text-center font-medium text-gray-800">{w.word_vn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          Object.entries(grouped).map(([topicName, topicWords]) => (
            <div key={topicName} className="mb-8">
              <h2 className="text-base font-bold text-gray-800 bg-gray-100 px-3 py-2 rounded mb-2 border-l-4 border-blue-500">
                {topicName} <span className="text-gray-400 font-normal text-xs">({topicWords.length} từ)</span>
              </h2>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-cyan-600">
                    <th className="border border-gray-300 px-3 py-2 text-white font-black text-xs text-center w-8">#</th>
                    <th className="border border-gray-300 px-3 py-2 text-white font-black text-xs text-center">Tiếng Trung</th>
                    <th className="border border-gray-300 px-3 py-2 text-white font-black text-xs text-center">Pinyin</th>
                    <th className="border border-gray-300 px-3 py-2 text-white font-black text-xs text-center">Tiếng Anh</th>
                    <th className="border border-gray-300 px-3 py-2 text-white font-black text-xs text-center">Tiếng Việt</th>
                  </tr>
                </thead>
                <tbody>
                  {topicWords.map((w, i) => (
                    <tr key={w.id} className={i % 2 === 0 ? 'bg-white' : 'bg-cyan-50/30'}>
                      <td className="border border-gray-300 px-2 py-1.5 text-center text-gray-400 text-xs">{i + 1}</td>
                      <td className="border border-gray-300 px-3 py-1.5 text-center font-black text-xl text-gray-900">{w.word_cn}</td>
                      <td className="border border-gray-300 px-3 py-1.5 text-center text-cyan-700 italic text-xs">{w.pinyin}</td>
                      <td className="border border-gray-300 px-3 py-1.5 text-center text-gray-500 text-xs">{w.word_en || '—'}</td>
                      <td className="border border-gray-300 px-3 py-1.5 text-center font-medium text-gray-800 text-xs">{w.word_vn}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}

        <div className="mt-6 text-center text-xs text-gray-400 border-t pt-3 no-print">
          Tài liệu nội bộ — CSCA
        </div>
      </div>
    </>
  );
}

export default function vocabularyPrintPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
      </div>
    }>
      <PrintContent />
    </Suspense>
  );
}
