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

const SUBJECT_LABELS: Record<string, string> = {
  'toan': 'Toán học',
  'vat-ly': 'Vật Lý',
  'hoa-hoc': 'Hóa Học',
  'tieng-trung-xh': 'Tiếng Trung Xã Hội',
  'tieng-trung-tn': 'Tiếng Trung Tự Nhiên',
};

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-3" />
          <p className="text-gray-500">Đang chuẩn bị PDF...</p>
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

  const subjectLabel = SUBJECT_LABELS[subject] || subject || 'Tất cả môn';
  const title = topic ? `Từ Vựng: ${topic}` : `Từ Vựng ${subjectLabel}`;

  return (
    <>
      {/* Print-only styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 11pt; }
          table { page-break-inside: avoid; }
          tr { page-break-inside: avoid; }
          h2 { page-break-before: auto; }
        }
        @page {
          size: A4;
          margin: 15mm 12mm;
        }
        body { font-family: 'Arial', sans-serif; }
      `}</style>

      {/* Screen controls - hidden when printing */}
      <div className="no-print bg-blue-600 text-white px-6 py-3 flex items-center justify-between">
        <span className="font-semibold">Xem trước PDF — {words.length} từ vựng</span>
        <div className="flex gap-3">
          <button
            onClick={() => window.history.back()}
            className="px-4 py-1.5 bg-white/20 rounded-lg text-sm hover:bg-white/30 transition"
          >
            ← Quay lại
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-1.5 bg-white rounded-lg text-blue-700 font-bold text-sm hover:bg-blue-50 transition"
          >
            🖨️ In / Lưu PDF
          </button>
        </div>
      </div>

      {/* Document content */}
      <div className="max-w-4xl mx-auto p-8">
        {/* Header */}
        <div className="text-center mb-6 border-b-2 border-gray-800 pb-4">
          <h1 className="text-2xl font-black text-gray-900">{title}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {subjectLabel} · {words.length} từ vựng · CSCA — Ôn thi học bổng Trung Quốc
          </p>
        </div>

        {topic ? (
          /* Single topic — table layout */
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-2 text-left w-8">#</th>
                <th className="border border-gray-300 px-3 py-2 text-left w-20">Chữ Hán</th>
                <th className="border border-gray-300 px-3 py-2 text-left w-24">Pinyin</th>
                <th className="border border-gray-300 px-3 py-2 text-left">Tiếng Việt</th>
                <th className="border border-gray-300 px-3 py-2 text-left">Ví dụ</th>
              </tr>
            </thead>
            <tbody>
              {words.map((w, i) => (
                <tr key={w.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="border border-gray-300 px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                  <td className="border border-gray-300 px-3 py-2 font-bold text-xl text-gray-900">{w.word_cn}</td>
                  <td className="border border-gray-300 px-3 py-2 text-blue-700 italic">{w.pinyin}</td>
                  <td className="border border-gray-300 px-3 py-2 font-medium">
                    {w.word_vn}
                    {w.word_en && <span className="text-gray-400 text-xs ml-2">/ {w.word_en}</span>}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-xs">
                    {w.example_cn && <div className="text-red-700">{w.example_cn}</div>}
                    {w.example_vn && <div className="text-gray-500 italic">{w.example_vn}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          /* All topics — grouped tables */
          Object.entries(grouped).map(([topicName, topicWords]) => (
            <div key={topicName} className="mb-8">
              <h2 className="text-base font-bold text-gray-800 bg-gray-100 px-3 py-2 rounded mb-2 border-l-4 border-blue-500">
                {topicName} <span className="text-gray-400 font-normal text-xs">({topicWords.length} từ)</span>
              </h2>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-blue-50">
                    <th className="border border-gray-300 px-2 py-1.5 text-left w-8 text-xs">#</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-left w-16 text-xs">Chữ Hán</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-left w-20 text-xs">Pinyin</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-left text-xs">Tiếng Việt</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-left text-xs">Ví dụ</th>
                  </tr>
                </thead>
                <tbody>
                  {topicWords.map((w, i) => (
                    <tr key={w.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border border-gray-300 px-2 py-1.5 text-gray-400 text-xs">{i + 1}</td>
                      <td className="border border-gray-300 px-2 py-1.5 font-bold text-lg text-gray-900">{w.word_cn}</td>
                      <td className="border border-gray-300 px-2 py-1.5 text-blue-700 italic text-xs">{w.pinyin}</td>
                      <td className="border border-gray-300 px-2 py-1.5 font-medium text-xs">
                        {w.word_vn}
                        {w.word_en && <span className="text-gray-400 ml-1">/ {w.word_en}</span>}
                      </td>
                      <td className="border border-gray-300 px-2 py-1.5 text-xs">
                        {w.example_cn && <div className="text-red-700">{w.example_cn}</div>}
                        {w.example_vn && <div className="text-gray-500 italic">{w.example_vn}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}

        <div className="mt-6 text-center text-xs text-gray-400 border-t pt-3 no-print">
          CSCA · csca.vn · Tài liệu nội bộ — Không phân phối
        </div>
      </div>
    </>
  );
}

export default function VocabularyPrintPage() {
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
