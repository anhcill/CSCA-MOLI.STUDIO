'use client';

import { FiCpu, FiStar } from 'react-icons/fi';

interface AICoinUnlockProps {
  coins: number;
  cost?: number;
  loading?: boolean;
  onUseCoins: () => void;
  title?: string;
  description?: string;
}

const DEFAULT_COST = 50;

export default function AICoinUnlock({
  coins,
  cost = DEFAULT_COST,
  loading = false,
  onUseCoins,
  title = 'Phân tích AI',
  description = 'Dùng Xu để mở một lượt phân tích AI, hoặc nâng cấp VIP/Premium để dùng ổn định theo gói.',
}: AICoinUnlockProps) {
  const safeCoins = Math.max(0, Number(coins || 0));
  const canSpend = safeCoins >= cost;
  const missing = Math.max(0, cost - safeCoins);

  return (
    <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-5 text-center shadow-sm">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500 text-white shadow-md">
        <FiCpu size={22} />
      </div>
      <h3 className="mb-2 text-base font-bold text-amber-950">{title}</h3>
      <p className="mx-auto mb-3 max-w-md text-sm text-amber-800">{description}</p>
      <p className={`mb-4 text-sm font-semibold ${canSpend ? 'text-amber-700' : 'text-red-600'}`}>
        {canSpend
          ? `Bạn đang có ${safeCoins.toLocaleString('vi-VN')} Xu, đủ để dùng 1 lượt.`
          : `Bạn đang có ${safeCoins.toLocaleString('vi-VN')} Xu, cần thêm ${missing.toLocaleString('vi-VN')} Xu.`}
      </p>
      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onUseCoins}
          disabled={!canSpend || loading}
          className={`inline-flex items-center justify-center gap-2 rounded-xl border-2 px-5 py-2.5 text-sm font-bold transition-all ${
            canSpend
              ? 'border-amber-400 bg-white text-amber-700 hover:bg-amber-50'
              : 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'
          }`}
        >
          <FiStar size={16} />
          {loading ? 'Đang phân tích...' : canSpend ? `Dùng ${cost} Xu` : `Thiếu ${missing.toLocaleString('vi-VN')} Xu`}
        </button>
        <a
          href="/vip"
          className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-2.5 text-sm font-bold text-white transition-all hover:shadow-md"
        >
          Xem gói VIP
        </a>
      </div>
    </div>
  );
}
