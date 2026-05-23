'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import { officialExamApi } from '@/lib/api/officialExams';
import { FiAward, FiCheckCircle, FiCopy, FiSearch, FiShield, FiXCircle } from 'react-icons/fi';

function formatDate(value?: string) {
  if (!value) return 'Chưa có';
  return new Date(value).toLocaleString('vi-VN');
}

export default function VerifyCertificatePage() {
  const searchParams = useSearchParams();
  const initialCode = searchParams.get('code') || '';
  const [code, setCode] = useState(initialCode);
  const [certificate, setCertificate] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const verifyUrl = useMemo(() => {
    if (typeof window === 'undefined' || !code.trim()) return '';
    return `${window.location.origin}/certificates/verify?code=${encodeURIComponent(code.trim())}`;
  }, [code]);
  const qrUrl = verifyUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(verifyUrl)}`
    : '';

  const verify = async (targetCode = code) => {
    const cleanCode = targetCode.trim();
    if (!cleanCode) return;
    try {
      setLoading(true);
      setError('');
      setCertificate(null);
      const data = await officialExamApi.verifyCertificate(cleanCode);
      setCertificate(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Không tìm thấy chứng nhận hợp lệ.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialCode) verify(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  const copyLink = async () => {
    if (!verifyUrl) return;
    await navigator.clipboard.writeText(verifyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6">
          <p className="text-xs font-black uppercase tracking-widest text-emerald-600">Xác thực công khai</p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">Tra cứu chứng nhận CSCA</h1>
          <p className="mt-2 text-sm text-slate-500">Nhập mã chứng nhận hoặc quét QR để kiểm tra trạng thái cấp chứng nhận.</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') verify();
              }}
              placeholder="VD: CSCA-2026-XXXXXXXXXX"
              className="min-h-12 flex-1 rounded-2xl border border-slate-200 px-4 font-mono text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
            <button
              onClick={() => verify()}
              disabled={loading || !code.trim()}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <FiSearch size={16} /> {loading ? 'Đang tra cứu...' : 'Tra cứu'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-6 text-red-800">
            <div className="flex items-center gap-3">
              <FiXCircle size={24} />
              <div>
                <h2 className="font-black">Chứng nhận không hợp lệ</h2>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          </div>
        )}

        {certificate && (
          <div className="mt-6 overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-sm">
            <div className="bg-emerald-50 p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-black text-emerald-700">
                    <FiCheckCircle size={14} /> Chứng nhận hợp lệ
                  </p>
                  <h2 className="mt-4 text-2xl font-black text-slate-950">{certificate.exam_title}</h2>
                  <p className="mt-1 font-mono text-sm font-bold text-emerald-700">{certificate.certificate_code}</p>
                </div>
                <FiShield className="text-emerald-500" size={48} />
              </div>
            </div>

            <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto]">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase text-slate-400">Học viên</p>
                  <p className="mt-1 text-lg font-black text-slate-900">{certificate.full_name}</p>
                  <p className="text-sm text-slate-500">{certificate.email}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase text-slate-400">Ngày cấp</p>
                  <p className="mt-1 text-lg font-black text-slate-900">{formatDate(certificate.issued_at)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase text-slate-400">Điểm</p>
                  <p className="mt-1 text-lg font-black text-slate-900">{Number(certificate.total_score).toFixed(1)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase text-slate-400">Điểm đạt</p>
                  <p className="mt-1 text-lg font-black text-slate-900">{Number(certificate.pass_score).toFixed(1)}</p>
                </div>
              </div>

              {qrUrl && (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-4">
                  <img src={qrUrl} alt="QR xác thực chứng nhận" className="h-44 w-44" />
                  <button
                    onClick={copyLink}
                    className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                  >
                    <FiCopy size={14} /> {copied ? 'Đã copy' : 'Copy link'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
