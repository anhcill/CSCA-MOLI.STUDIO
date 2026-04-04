'use client';

import { BsCheckCircle, BsController, BsTrophy } from 'react-icons/bs';
import { FiBook, FiTarget, FiTrendingUp } from 'react-icons/fi';

export default function CauTrucDe() {
  const structures = [
    {
      id: 1,
      icon: '📋',
      title: 'Phần 1: Trắc Nghiệm',
      subtitle: 'Kiến thức cơ bản',
      questions: 40,
      points: 40,
      color: 'from-blue-500 to-cyan-500',
    },
    {
      id: 2,
      icon: '✍️',
      title: 'Phần 2: Tự Luận',
      subtitle: 'Tư duy, chứng minh',
      questions: 5,
      points: 60,
      color: 'from-purple-500 to-pink-500',
    },
    {
      id: 3,
      icon: '🎯',
      title: 'Tổng Cộng',
      subtitle: 'Toàn bộ bài thi',
      questions: 45,
      points: 100,
      color: 'from-green-500 to-emerald-500',
    },
  ];

  const tips = [
    { icon: '⏱️', text: 'Thời gian: 90 phút' },
    { icon: '📚', text: 'Không được phép mang tài liệu' },
    { icon: '✍️', text: 'Sử dụng bút mực xanh hoặc đen' },
  ];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="text-center mb-6">
        <h2 className="text-4xl font-black bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent mb-2">
          Cấu Trúc Đề Thi 📋
        </h2>
        <p className="text-gray-600">Tìm hiểu chi tiết cấu trúc đề thi Toán CSCA</p>
      </div>

      {/* Structure Cards */}
      <div className="grid grid-cols-3 gap-4">
        {structures.map((struct) => (
          <div
            key={struct.id}
            className={`genz-card overflow-hidden hover:scale-105 transition-all bg-gradient-to-br ${struct.color} p-6 text-white`}
          >
            <div className="text-4xl mb-3">{struct.icon}</div>
            <h3 className="font-black text-xl mb-1">{struct.title}</h3>
            <p className="text-white/90 text-sm mb-4">{struct.subtitle}</p>
            <div className="grid grid-cols-2 gap-3 bg-white/20 p-3 rounded-xl">
              <div className="text-center">
                <p className="text-2xl font-bold">{struct.questions}</p>
                <p className="text-xs text-white/80">Câu hỏi</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{struct.points}</p>
                <p className="text-xs text-white/80">Điểm</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tips */}
      <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl p-6 border-2 border-yellow-200">
        <h3 className="text-xl font-black text-gray-800 mb-4">💡 Lưu Ý Quan Trọng</h3>
        <div className="grid grid-cols-3 gap-4">
          {tips.map((tip, index) => (
            <div key={index} className="flex items-center space-x-3">
              <span className="text-3xl">{tip.icon}</span>
              <p className="text-gray-700 font-semibold text-sm">{tip.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
