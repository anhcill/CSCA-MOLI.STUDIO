'use client';

import React, { useState } from 'react';
import DailyLetterModal from '@/components/daily-gift/DailyLetterModal';
import { FaEnvelope, FaHeart, FaFire, FaSun, FaMoon } from 'react-icons/fa';
import ThemeToggle from '@/components/layout/ThemeToggle';

export default function DailyLetterDemoPage() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-center transition-colors">
      {/* Top Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <ThemeToggle />
      </div>

      {/* Demo Page Content */}
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-rose-100 dark:border-slate-800 transition-colors">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-500/25 mb-4">
          <FaEnvelope size={28} />
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
          MOLY.STUDIO
        </h1>
        <p className="text-xs uppercase tracking-widest text-rose-600 dark:text-rose-400 font-extrabold mt-1 flex items-center justify-center gap-1">
          <FaFire className="text-orange-500" />
          Thư Thứ Hai Đầu Tuần
        </p>

        <p className="mt-4 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
          Trải nghiệm giao diện bức thư động lực gửi cho học viên vào <span className="font-bold text-rose-600 dark:text-rose-400">Thứ Hai đầu tuần</span>: thông điệp nỗ lực, châm ngôn <em>“Hành trình vạn dặm khởi đầu từ một bước chân”</em>, <em>“Chân cứng đá mềm”</em>, hỗ trợ chế độ Sáng / Tối sắc nét, độ tương phản cao!
        </p>

        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="mt-6 w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 via-pink-600 to-indigo-600 px-6 py-4 text-sm sm:text-base font-extrabold text-white shadow-lg shadow-rose-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <FaHeart />
          <span>Mở Thư Thứ Hai Đầu Tuần</span>
        </button>

        <p className="mt-4 text-[11px] text-slate-500 dark:text-slate-400">
          💡 Thư thật sẽ tự động gửi và hiển thị đến học viên vào mỗi Thứ Hai hàng tuần.
        </p>
      </div>

      {/* Daily Letter Modal */}
      <DailyLetterModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        userName="Đức Anh"
        audioSrc="https://res.cloudinary.com/dvrgrmais/video/upload/v1785448506/moly-studio/audio/thu-hom-nay.mp3"
        coverSrc="https://res.cloudinary.com/dvrgrmais/image/upload/v1785448822/moly-studio/images/thu-hom-nay-cover.jpg"
        songTitle="id 072019"
        artistName="W/n"
      />
    </div>
  );
}
