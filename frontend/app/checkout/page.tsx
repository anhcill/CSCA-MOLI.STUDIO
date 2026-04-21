"use client";

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import axios from '@/lib/utils/axios';
import { useAuthStore } from '@/lib/store/authStore';
import { FaCrown, FaShieldAlt, FaBolt, FaGift, FaLock, FaArrowRight, FaCopy, FaCheckCircle } from 'react-icons/fa';
import { FiArrowLeft, FiCheck, FiLoader, FiRefreshCw } from 'react-icons/fi';

interface DbPackage {
  id: number;
  name: string;
  duration_days: number;
  price: number;
  description: string;
  features: string[];
}

function derivePackageUI(pkg: DbPackage) {
  const isPremium = pkg.name.toLowerCase().includes('premium');
  return {
    tier: isPremium ? 'premium' : 'vip',
    color: isPremium ? 'from-amber-500 to-orange-600' : 'from-indigo-500 to-purple-600',
  };
}

const PAYMENT_METHODS = [
  {
    id: 'bank_transfer',
    name: 'Chuyển khoản ngân hàng',
    sub: 'QR Code • Tự động kích hoạt',
    icon: (
      <div className="w-9 h-9 bg-green-600 rounded-lg flex items-center justify-center text-white text-xs font-black">QR</div>
    ),
    bg: 'bg-green-50',
    border: 'border-green-200',
    hoverBg: 'hover:border-green-400 hover:bg-green-50',
    selectedBg: 'bg-green-50 border-green-400',
    color: 'text-green-700',
    badge: 'Miễn phí phí giao dịch',
    badgeColor: 'bg-green-500 text-white',
    recommended: true,
  },
];

// ── QR Payment Screen ──────────────────────────────────────────────────────────
function BankTransferScreen({
  orderId,
  bank,
  onPaid,
}: {
  orderId: string;
  bank: { bankCode: string; accountNumber: string; accountName: string; amount: number; content: string; qrUrl: string };
  onPaid: (data: any) => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [polling, setPolling] = useState(true);
  const [dots, setDots] = useState('.');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Chạy polling mỗi 4 giây
  useEffect(() => {
    if (!polling) return;

    const check = async () => {
      try {
        const res = await axios.get(`/payments/check-status?orderId=${orderId}`);
        if (res.data.status === 'completed') {
          setPolling(false);
          if (intervalRef.current) clearInterval(intervalRef.current);
          onPaid(res.data.data);
        }
      } catch (_) {}
    };

    check();
    intervalRef.current = setInterval(check, 4000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [orderId, polling]);

  // Animate dots
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? '.' : d + '.'), 600);
    return () => clearInterval(t);
  }, []);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const InfoRow = ({ label, value, copyKey }: { label: string; value: string; copyKey: string }) => (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500 w-32 shrink-0">{label}</span>
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-bold text-gray-900 text-sm truncate">{value}</span>
        <button
          onClick={() => copy(value, copyKey)}
          className="shrink-0 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-indigo-600 transition-colors"
          title="Sao chép"
        >
          {copied === copyKey ? <FiCheck size={14} className="text-green-500" /> : <FaCopy size={12} />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-green-100 rounded-full text-green-700 text-sm font-bold mb-3">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          Đang chờ thanh toán{dots}
        </div>
        <h2 className="text-xl font-black text-gray-900">Quét QR để thanh toán</h2>
        <p className="text-gray-500 text-sm mt-1">Mở app ngân hàng → Quét QR → Xác nhận</p>
      </div>

      {/* QR Code */}
      <div className="flex justify-center">
        <div className="bg-white p-4 rounded-2xl shadow-lg border-2 border-indigo-100">
          <img
            src={bank.qrUrl}
            alt="QR Chuyển khoản"
            className="w-52 h-52 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`Bank:${bank.bankCode}|Acc:${bank.accountNumber}|Amount:${bank.amount}|Content:${bank.content}`)}`;
            }}
          />
        </div>
      </div>

      {/* Bank Info */}
      <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Thông tin chuyển khoản</h3>
        <InfoRow label="Ngân hàng" value={bank.bankCode} copyKey="bank" />
        <InfoRow label="Số tài khoản" value={bank.accountNumber} copyKey="account" />
        <InfoRow label="Chủ tài khoản" value={bank.accountName} copyKey="name" />
        <InfoRow label="Số tiền" value={`${bank.amount.toLocaleString('vi-VN')} đ`} copyKey="amount" />
        <InfoRow label="Nội dung" value={bank.content} copyKey="content" />
      </div>

      {/* Warning */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
        <p className="font-bold text-amber-800 mb-1">⚠️ Lưu ý quan trọng</p>
        <ul className="text-amber-700 space-y-1 text-xs">
          <li>• Nhập <strong>đúng nội dung</strong> chuyển khoản bên trên để hệ thống tự xác nhận</li>
          <li>• VIP được kích hoạt <strong>tự động trong vài giây</strong> sau khi tiền về</li>
          <li>• Nếu sau 5 phút chưa kích hoạt, liên hệ Admin qua Fanpage</li>
        </ul>
      </div>

      {/* Status indicator */}
      <div className="flex items-center justify-center gap-3 py-3 bg-indigo-50 rounded-xl">
        <FiRefreshCw size={16} className="text-indigo-500 animate-spin" />
        <span className="text-indigo-700 text-sm font-medium">Hệ thống đang tự động kiểm tra thanh toán{dots}</span>
      </div>
    </div>
  );
}

// ── Success Screen ─────────────────────────────────────────────────────────────
function SuccessScreen({ packageName, vipExpires }: { packageName?: string; vipExpires?: string }) {
  const router = useRouter();
  const { updateUser } = useAuthStore();

  useEffect(() => {
    // Force refresh user data
    axios.get('/auth/me').then(res => {
      if (res.data?.data?.user) {
        updateUser(res.data.data.user);
      }
    }).catch(() => {});
  }, []);

  return (
    <div className="text-center space-y-6 py-4">
      <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-green-200">
        <FaCheckCircle size={48} className="text-white" />
      </div>
      <div>
        <h2 className="text-2xl font-black text-gray-900">Thanh toán thành công! 🎉</h2>
        <p className="text-gray-500 mt-2">Tài khoản của bạn đã được nâng cấp</p>
        {packageName && (
          <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-amber-100 rounded-full text-amber-800 font-bold text-sm">
            <FaCrown className="text-yellow-500" size={14} />
            {packageName}
          </div>
        )}
        {vipExpires && (
          <p className="text-sm text-gray-400 mt-2">
            Hết hạn: {new Date(vipExpires).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => router.push('/hoi-dap')}
          className="py-3 px-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors text-sm"
        >
          Hỏi đáp cố vấn →
        </button>
        <button
          onClick={() => router.push('/exam-room')}
          className="py-3 px-4 bg-gray-100 text-gray-800 rounded-xl font-bold hover:bg-gray-200 transition-colors text-sm"
        >
          Vào phòng thi →
        </button>
      </div>
    </div>
  );
}

// ── Main Checkout ──────────────────────────────────────────────────────────────
function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();

  const [allPackages, setAllPackages] = useState<DbPackage[]>([]);
  const [selectedPkg, setSelectedPkg] = useState<DbPackage | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string>('bank_transfer');
  const [loading, setLoading] = useState(false);
  const [pkgLoading, setPkgLoading] = useState(true);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'select' | 'qr' | 'success'>('select');
  const [qrData, setQrData] = useState<any>(null);
  const [successData, setSuccessData] = useState<any>(null);

  const urlPackageId = searchParams?.get('package_id');
  const urlMethod = searchParams?.get('method');

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login?redirect=/checkout');
      return;
    }
    axios.get('/vip/packages')
      .then(res => {
        const pkgs: DbPackage[] = res.data.data || [];
        setAllPackages(pkgs);
        if (urlPackageId) {
          const found = pkgs.find(p => p.id === parseInt(urlPackageId));
          if (found) setSelectedPkg(found);
        } else if (pkgs.length > 0) {
          setSelectedPkg(pkgs[0]);
        }
      })
      .catch(() => setAllPackages([]))
      .finally(() => setPkgLoading(false));
    if (urlMethod) setSelectedMethod(urlMethod);
  }, [isAuthenticated, urlPackageId, urlMethod, router]);

  const handleProceed = async () => {
    if (!selectedPkg) { setError('Vui lòng chọn một gói.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await axios.post('/payments/create', {
        package_id: selectedPkg.id,
        payment_method: selectedMethod,
      });
      if (res.data.success) {
        if (res.data.payment_method === 'bank_transfer') {
          setQrData({ orderId: res.data.orderId, bank: res.data.bank });
          setStep('qr');
        } else if (res.data.payUrl) {
          window.location.href = res.data.payUrl;
        }
      } else {
        setError('Không tạo được thanh toán. Vui lòng thử lại.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Lỗi kết nối.');
    } finally {
      setLoading(false);
    }
  };

  const handlePaid = (data: any) => {
    setSuccessData(data);
    setStep('success');
  };

  if (!isAuthenticated || !user) return null;

  // ── SUCCESS ──
  if (step === 'success') {
    return <SuccessScreen packageName={successData?.package_name} vipExpires={successData?.vip_expires_at} />;
  }

  // ── QR SCREEN ──
  if (step === 'qr' && qrData) {
    return (
      <div>
        <button
          onClick={() => setStep('select')}
          className="flex items-center gap-1 text-gray-400 hover:text-gray-700 text-sm mb-6 transition-colors"
        >
          <FiArrowLeft size={14} /> Quay lại chọn gói
        </button>
        <BankTransferScreen
          orderId={qrData.orderId}
          bank={qrData.bank}
          onPaid={handlePaid}
        />
      </div>
    );
  }

  // ── SELECT SCREEN ──
  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-amber-100 to-orange-100 border border-amber-200 rounded-full text-amber-800 text-sm font-bold shadow-sm">
          <FaCrown size={14} className="text-amber-500" />
          Nâng cấp CSCA PRO
        </div>
        <h1 className="text-3xl font-black text-gray-900">
          Mở khóa tất cả tính năng
          <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent"> PRO</span>
        </h1>
        <p className="text-gray-500 text-sm">
          Thanh toán với tài khoản
          <span className="font-semibold text-gray-700 ml-1">{user.email}</span>
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 pt-1">
          {[
            { icon: <FaShieldAlt size={16} />, text: 'Bảo mật 100%' },
            { icon: <FaBolt size={16} />, text: 'Kích hoạt tức thì' },
            { icon: <FaGift size={16} />, text: 'Hoàn tiền 7 ngày' },
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
              <span className="text-indigo-500">{f.icon}</span>
              {f.text}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Package */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-sm font-black">1</div>
          <h2 className="text-lg font-black text-gray-900">Chọn gói phù hợp</h2>
        </div>
        {pkgLoading ? (
          <div className="flex justify-center py-10">
            <FiLoader size={28} className="animate-spin text-indigo-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allPackages.map(pkg => {
              const ui = derivePackageUI(pkg);
              const selected = selectedPkg?.id === pkg.id;
              return (
                <button
                  key={pkg.id}
                  onClick={() => setSelectedPkg(pkg)}
                  className={`w-full text-left rounded-2xl border-2 transition-all duration-300 overflow-hidden
                    ${selected ? 'border-transparent shadow-xl scale-[1.02] ring-4 ring-indigo-200' : 'border-gray-200 hover:border-gray-300 hover:shadow-lg bg-white'}`}
                >
                  <div className={`p-5 pb-4 bg-gradient-to-r ${ui.color} text-white`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-black text-xl">{pkg.name}</h3>
                        <p className="text-xs mt-0.5 text-white/70">{pkg.duration_days} ngày sử dụng</p>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${selected ? 'bg-white border-white' : 'border-white/30'}`}>
                        {selected && <FiCheck size={12} className="text-indigo-600" />}
                      </div>
                    </div>
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-4xl font-black">{pkg.price.toLocaleString('vi-VN')}</span>
                      <span className="text-sm text-white/70">đ</span>
                    </div>
                  </div>
                  <div className="p-5 bg-white">
                    <ul className="space-y-2">
                      {(pkg.features || []).slice(0, 4).map((f, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <FiCheck size={14} className="text-indigo-500 mt-0.5 shrink-0" />
                          <span className="text-sm text-gray-600">{f}</span>
                        </li>
                      ))}
                      {(pkg.features || []).length > 4 && (
                        <li className="text-xs text-gray-400">+{pkg.features.length - 4} tính năng khác...</li>
                      )}
                    </ul>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Step 2: Payment method */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-sm font-black">2</div>
          <h2 className="text-lg font-black text-gray-900">Phương thức thanh toán</h2>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {PAYMENT_METHODS.map(method => (
            <button
              key={method.id}
              onClick={() => setSelectedMethod(method.id)}
              className={`relative w-full flex items-center gap-4 p-5 rounded-2xl border-2 transition-all duration-200 text-left
                ${selectedMethod === method.id ? `${method.selectedBg} shadow-lg` : `${method.border} ${method.bg} ${method.hoverBg} hover:shadow-md`}`}
            >
              {method.recommended && (
                <div className="absolute -top-2 right-4 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider px-3 py-0.5 rounded-full">
                  Khuyên dùng
                </div>
              )}
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm bg-white">
                {method.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className={`font-black text-lg ${selectedMethod === method.id ? method.color : 'text-gray-800'}`}>{method.name}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${method.badgeColor}`}>{method.badge}</span>
                </div>
                {method.sub && <p className="text-xs text-gray-500 mt-0.5">{method.sub}</p>}
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${selectedMethod === method.id ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300 bg-white'}`}>
                {selectedMethod === method.id && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Order summary */}
      {selectedPkg && (
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 text-white space-y-4 shadow-2xl">
          <div className="flex items-center gap-2">
            <FaLock size={14} className="text-amber-400" />
            <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Xác nhận đơn hàng</h3>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${derivePackageUI(selectedPkg).color} flex items-center justify-center`}>
                <FaCrown size={20} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-base">{selectedPkg.name}</p>
                <p className="text-xs text-gray-400">{selectedPkg.duration_days} ngày sử dụng</p>
              </div>
            </div>
            <span className="text-2xl font-black">{selectedPkg.price.toLocaleString('vi-VN')}<span className="text-sm text-gray-400">đ</span></span>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-5 py-4">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <button
          onClick={handleProceed}
          disabled={!selectedPkg || loading}
          className={`w-full flex items-center justify-center gap-3 px-8 py-4 rounded-2xl text-white font-black text-lg shadow-2xl transition-all
            ${!selectedPkg || loading ? 'bg-gray-300 cursor-not-allowed shadow-none' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 hover:shadow-xl hover:shadow-indigo-200 active:scale-[0.99]'}`}
        >
          {loading ? (
            <><FiLoader size={20} className="animate-spin" /> Đang khởi tạo...</>
          ) : selectedPkg ? (
            <>{selectedPkg.price.toLocaleString('vi-VN')}đ — Tiến hành thanh toán <FaArrowRight size={18} /></>
          ) : (
            'Chọn gói để tiếp tục'
          )}
        </button>
        <button onClick={() => router.push('/vip')} className="w-full flex items-center justify-center gap-2 py-3 text-gray-500 font-medium hover:text-gray-700 transition-colors">
          <FiArrowLeft size={16} /> Quay lại bảng giá
        </button>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-indigo-50 to-purple-50 py-12 px-4 pt-28">
      <div className="w-full max-w-3xl mx-auto">
        <div className="bg-white shadow-2xl rounded-[2rem] overflow-hidden border border-gray-100">
          <div className="h-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500" />
          <div className="p-8 sm:p-10">
            <Suspense fallback={
              <div className="flex justify-center items-center py-24">
                <FiLoader size={40} className="animate-spin text-indigo-600" />
              </div>
            }>
              <CheckoutContent />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
