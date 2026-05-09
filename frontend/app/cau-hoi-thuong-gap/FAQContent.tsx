'use client';

import { useState } from 'react';
import Header from '@/components/layout/Header';
import { FiHelpCircle, FiChevronDown, FiSearch } from 'react-icons/fi';
import { FAQ_DATA } from './faqData';

export default function FAQContent() {
  const [search, setSearch] = useState('');
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setOpenItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const filtered = FAQ_DATA
    .map(cat => ({
      ...cat,
      items: cat.items.filter(
        item =>
          !search ||
          item.q.toLowerCase().includes(search.toLowerCase()) ||
          (Array.isArray(item.a) ? item.a.join(' ').toLowerCase() : item.a.toLowerCase()).includes(search.toLowerCase()),
      ),
    }))
    .filter(cat => cat.items.length > 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        {/* Hero */}
        <div className="mb-8 flex items-center gap-4">
          <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center shrink-0">
            <FiHelpCircle className="text-amber-600" size={26} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Câu hỏi thường gặp</h1>
            <p className="text-sm text-gray-500 mt-1">Giải đáp nhanh các thắc mắc phổ biến về MOLI.STUDIO</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Tìm kiếm câu hỏi..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent shadow-sm"
          />
        </div>

        {/* FAQ Categories */}
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🔍</div>
            <p className="text-gray-500">Không tìm thấy câu hỏi phù hợp.</p>
            <p className="text-sm text-gray-400 mt-1">Thử từ khóa khác hoặc liên hệ support@moly-studio.io.vn</p>
          </div>
        ) : (
          filtered.map(cat => (
            <div key={cat.category} className="mb-8">
              <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 mb-3">
                <span>{cat.emoji}</span> {cat.category}
              </h2>
              {cat.items.map((item, idx) => {
                const key = `${cat.category}-${idx}`;
                const isOpen = openItems.has(key);
                return (
                  <div key={key} className="border border-gray-200 rounded-xl overflow-hidden mb-2 bg-white">
                    <button
                      onClick={() => toggle(key)}
                      className="w-full flex items-start justify-between gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                    >
                      <span className="font-medium text-gray-800 text-sm leading-snug">{item.q}</span>
                      <span className={`shrink-0 mt-0.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                        <FiChevronDown className="text-gray-400" size={16} />
                      </span>
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5 text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-4">
                        {Array.isArray(item.a) ? (
                          <ul className="space-y-1.5">
                            {item.a.map((line, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-amber-500 mt-0.5">•</span>
                                <span>{line}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p>{item.a}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}

        {/* Still have questions */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 rounded-xl p-6 text-center">
          <p className="text-gray-700 font-medium mb-1">Không tìm thấy câu trả lời?</p>
          <p className="text-sm text-gray-500 mb-4">Liên hệ với đội ngũ MOLI.STUDIO, chúng tôi sẵn sàng hỗ trợ bạn.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <a href="mailto:support@moly-studio.io.vn"
              className="px-5 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 transition-colors">
              Email: support@moly-studio.io.vn
            </a>
            <a href="tel:+840812352005"
              className="px-5 py-2 bg-white border border-amber-300 text-amber-700 rounded-lg text-sm font-semibold hover:bg-amber-50 transition-colors">
              📞 0812 352 005
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
