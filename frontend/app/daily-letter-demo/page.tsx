'use client';

import React, { useState } from 'react';
import DailyLetterModal from '@/components/daily-gift/DailyLetterModal';
import { FaEnvelope, FaMusic, FaHeart } from 'react-icons/fa';

export default function DailyLetterDemoPage() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#FFF9F5] flex flex-col items-center justify-center p-6 text-center">
      {/* Demo Page Content */}
      <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-pink-100">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-500 mb-4">
          <FaEnvelope size={32} />
        </div>

        <h1 className="text-2xl font-black text-[#172033]">
          MOLY.STUDIO
        </h1>
        <p className="text-xs uppercase tracking-widest text-[#F45C7A] font-bold mt-1">
          Thư Hôm Nay Demo
        </p>

        <p className="mt-4 text-sm text-slate-600 leading-relaxed">
          Bấm nút bên dưới để trải nghiệm popup <span className="font-semibold text-rose-500">“Thư hôm nay”</span> dành cho học viên MOLY.STUDIO (Bản nhạc id 072019 – W/n).
        </p>

        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="mt-6 w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#F45C7A] via-[#A96FD4] to-[#4D8FE8] px-6 py-4 text-base font-bold text-white shadow-lg shadow-rose-200 hover:scale-[1.02] active:scale-[0.98] transition-transform"
        >
          <FaHeart />
          Mở Thư Hôm Nay
        </button>
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
