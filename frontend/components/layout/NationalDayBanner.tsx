'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FiArrowRight, FiAward, FiBookOpen, FiFileText, FiUsers } from 'react-icons/fi';
import Banner from './Banner';
import { NATIONAL_DAY_THEME_END } from '@/lib/nationalDayTheme';

const NATIONAL_DAY_ARTWORK = 'https://res.cloudinary.com/dvrgrmais/image/upload/v1787950686/moly-studio/campaigns/2026-national-day/home-hero.png';

function MolyInfoBar() {
  const stats = [
    { icon: FiUsers, value: '10k+', label: 'Học viên' },
    { icon: FiFileText, value: '500+', label: 'Đề thi' },
    { icon: FiAward, value: '95%', label: 'Tỷ lệ đậu' },
  ];

  return (
    <aside className="border-y border-[#d8a63d]/35 bg-[#071326] text-white" aria-label="Thông tin nền tảng Moly">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-500 text-xl font-black text-white shadow-lg">m</div>
          <div>
            <p className="font-extrabold tracking-tight text-white">Moly — Nền tảng luyện thi CSCA</p>
            <p className="mt-0.5 text-sm text-slate-300">Luyện thi học bổng Trung Quốc theo lộ trình rõ ràng.</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {stats.map(({ icon: Icon, value, label }) => (
            <div key={label} className="min-w-[84px] rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-center">
              <Icon className="mx-auto mb-1 text-[#f5c65a]" size={16} />
              <p className="text-base font-black leading-none text-[#ffe3a3]">{value}</p>
              <p className="mt-1 text-[11px] text-slate-400">{label}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/lo-trinh" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-extrabold text-slate-900 transition hover:bg-[#ffedbd]">
            Lộ trình học <FiArrowRight />
          </Link>
          <Link href="/register" className="inline-flex items-center gap-2 rounded-xl border border-[#e9bc53]/80 px-4 py-2.5 text-sm font-extrabold text-[#ffe6a6] transition hover:bg-[#e9bc53]/10">
            <FiBookOpen /> Đăng ký miễn phí
          </Link>
        </div>
      </div>
    </aside>
  );
}

export default function NationalDayBanner({ initiallyEnabled }: { initiallyEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initiallyEnabled);

  useEffect(() => {
    if (!enabled) return;
    const remaining = NATIONAL_DAY_THEME_END.getTime() - Date.now();
    if (remaining <= 0) {
      setEnabled(false);
      return;
    }
    const timer = window.setTimeout(() => setEnabled(false), remaining);
    return () => window.clearTimeout(timer);
  }, [enabled]);

  if (!enabled) return <Banner />;

  return (
    <section className="bg-[#030914]" aria-label="Chào mừng Quốc Khánh 2 tháng 9">
      <div className="mx-auto w-full bg-[#030914]">
        <Image
          src={NATIONAL_DAY_ARTWORK}
          alt="Mừng Đại lễ Quốc Khánh 2 tháng 9 — cờ Việt Nam, Lăng Chủ tịch Hồ Chí Minh và Cột cờ Hà Nội"
          width={1672}
          height={941}
          priority
          quality={92}
          sizes="100vw"
          className="block h-auto w-full object-contain"
        />
      </div>
      <MolyInfoBar />
    </section>
  );
}
