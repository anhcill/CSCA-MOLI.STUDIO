'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import axios from '@/lib/utils/axios';
import { FiDownload, FiExternalLink, FiSearch, FiChevronDown, FiChevronUp } from 'react-icons/fi';

interface Material {
  id: number;
  title: string;
  description: string;
  file_url: string;
  file_type: string;
  category: string;
  subject: string;
  created_at: string;
}

const CATEGORIES = [
  { value: 'all', label: 'Tất Cả', icon: '📚', color: 'bg-purple-500' },
  { value: 'ly-thuyet', label: 'Lý Thuyết', icon: '📖', color: 'bg-blue-500' },
  { value: 'cau-truc-de', label: 'Cấu Trúc Đề', icon: '📋', color: 'bg-green-500' },
  { value: 'de-mo-phong', label: 'Đề Mô Phỏng', icon: '📝', color: 'bg-orange-500' },
  { value: 'tu-vung', label: 'Từ Vựng', icon: '✏️', color: 'bg-pink-500' },
];

const SUBJECTS = [
  { value: '', label: 'Tất cả môn', emoji: '🎯' },
  { value: 'toan', label: 'Toán', emoji: '🔢' },
  { value: 'vat-ly', label: 'Vật Lý', emoji: '⚛️' },
  { value: 'hoa-hoc', label: 'Hóa Học', emoji: '🧪' },
  { value: 'tieng-trung-xh', label: 'Tiếng Trung XH', emoji: '🇨🇳' },
  { value: 'tieng-trung-tn', label: 'Tiếng Trung TN', emoji: '🌿' },
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

function PDFCard({ m }: { m: Material }) {
  const [expanded, setExpanded] = useState(false);
  const pdfUrl = `${API_URL}/materials/pdf/${m.id}`; // proxy qua backend để bypass 401
  const categoryData = CATEGORIES.find(c => c.value === m.category);
  const subjectData = SUBJECTS.find(s => s.value === m.subject);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300">
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={`w-12 h-12 ${categoryData?.color || 'bg-gray-500'} rounded-xl flex items-center justify-center shrink-0 shadow-md`}>
            <span className="text-2xl">{categoryData?.icon || '📄'}</span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-base leading-snug mb-1">{m.title}</h3>
            {m.description && (
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">{m.description}</p>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              {categoryData && (
                <span className={`inline-flex items-center gap-1 px-3 py-1 ${categoryData.color} text-white text-xs rounded-full font-medium`}>
                  {categoryData.icon} {categoryData.label}
                </span>
              )}
              {subjectData && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                  {subjectData.emoji} {subjectData.label}
                </span>
              )}
              <span className="text-xs text-gray-400 ml-auto">
                {new Date(m.created_at).toLocaleDateString('vi-VN')}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 shrink-0">
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-medium rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all shadow-md hover:shadow-lg"
            >
              <FiExternalLink size={14} />
              Xem PDF
            </a>
            <a
              href={pdfUrl}
              download={m.title + '.pdf'}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center w-10 h-10 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              title="Tải xuống"
            >
              <FiDownload size={16} />
            </a>
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center justify-center w-10 h-10 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              title={expanded ? "Thu gọn" : "Xem trước"}
            >
              {expanded ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* Preview */}
      {expanded && (
        <div className="border-t border-gray-200 bg-gray-50 p-4">
          <iframe
            src={pdfUrl}
            className="w-full h-[600px] rounded-lg border border-gray-200"
            title={m.title}
            loading="lazy"
          />
        </div>
      )}
    </div>
  );
}

export default function TaiLieuPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [subject, setSubject] = useState('');

  useEffect(() => {
    axios.get('/materials')
      .then(r => setMaterials(r.data.data || []))
      .catch(() => setMaterials([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = materials.filter(m => {
    const matchSearch = m.title.toLowerCase().includes(search.toLowerCase()) ||
      (m.description || '').toLowerCase().includes(search.toLowerCase());
    const matchCategory = category === 'all' || m.category === category;
    const matchSubject = !subject || m.subject === subject;
    return matchSearch && matchCategory && matchSubject;
  });

  // Group by category for display
  const groupedByCategory = CATEGORIES.reduce((acc, cat) => {
    if (cat.value === 'all') return acc;
    acc[cat.value] = filtered.filter(m => m.category === cat.value);
    return acc;
  }, {} as Record<string, Material[]>);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Header />

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">
        {/* Page Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl mb-4">
            <span className="text-3xl">📚</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Tài Liệu Học Tập</h1>
          <p className="text-gray-600">Kho tài liệu đầy đủ cho kỳ thi CSCA - Chia theo chủ đề và môn học</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
          {/* Category Tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${category === cat.value
                  ? `${cat.color} text-white shadow-md scale-105`
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Search and Subject Filter */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Tìm kiếm tài liệu..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <select
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
            >
              {SUBJECTS.map(s => (
                <option key={s.value} value={s.value}>
                  {s.emoji} {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Results Count */}
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-gray-600">
              Tìm thấy <strong className="text-purple-600">{filtered.length}</strong> tài liệu
            </span>
            {(search || category !== 'all' || subject) && (
              <button
                onClick={() => { setSearch(''); setCategory('all'); setSubject(''); }}
                className="text-purple-600 hover:text-purple-700 font-medium"
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
        </div>

        {/* Materials List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-32 bg-white rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-gray-500">
              {search || category !== 'all' || subject ? 'Không tìm thấy tài liệu phù hợp' : 'Chưa có tài liệu nào'}
            </p>
          </div>
        ) : category === 'all' ? (
          // Display all materials in list view
          <div className="space-y-4">
            {filtered.map(m => <PDFCard key={m.id} m={m} />)}
          </div>
        ) : (
          // Display grouped by category
          <div className="space-y-4">
            {filtered.map(m => <PDFCard key={m.id} m={m} />)}
          </div>
        )}
      </main>
    </div>
  );
}
