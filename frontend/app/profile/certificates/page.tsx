'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import { ExamCertificate, officialExamApi } from '@/lib/api/officialExams';
import { FiAward, FiCheckCircle, FiCopy, FiExternalLink, FiRefreshCw } from 'react-icons/fi';

function formatDate(value?: string) {
  if (!value) return 'Chưa có';
  return new Date(value).toLocaleString('vi-VN');
}

export default function MyCertificatesPage() {
  const [certificates, setCertificates] = useState<ExamCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState('');

  const origin = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return window.location.origin;
  }, []);

  const loadCertificates = async () => {
    try {
      setLoading(true);
      const data = await officialExamApi.getMyCertificates();
      setCertificates(data);
    } catch (error) {
      console.error('Load certificates error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCertificates();
  }, []);

  const copyVerifyLink = async (code: string) => {
    const link = `${origin}/certificates/verify?code=${encodeURIComponent(code)}`;
    await navigator.clipboard.writeText(link);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 1800);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-emerald-600">Hồ sơ học viên</p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">Chứng nhận của tôi</h1>
            <p className="mt-2 text-sm text-slate-500">
              Xem chứng nhận đã được cấp và chia sẻ link xác thực công khai.
            </p>
          </div>
          <button
            onClick={loadCertificates}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} /> Làm mới
          </button>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1].map((item) => (
              <div key={item} className="h-56 animate-pulse rounded-3xl border border-slate-200 bg-white" />
            ))}
          </div>
        ) : certificates.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center">
            <FiAward className="mx-auto mb-4 text-slate-300" size={56} />
            <h2 className="text-xl font-black text-slate-900">Chưa có chứng nhận</h2>
            <p className="mt-2 text-sm text-slate-500">
              Khi bạn hoàn tất kỳ thi chính thức và được cấp chứng nhận, chứng nhận sẽ xuất hiện tại đây.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {certificates.map((cert) => {
              const verifyPath = `/certificates/verify?code=${encodeURIComponent(cert.certificate_code)}`;
              const verifyUrl = `${origin}${verifyPath}`;
              const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(verifyUrl)}`;

              return (
                <div key={cert.id} className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm">
                  <div className="border-b border-emerald-100 bg-emerald-50 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-emerald-700">CSCA Certificate</p>
                        <h2 className="mt-2 text-xl font-black text-slate-950">{cert.exam_title || `Kỳ thi #${cert.exam_id}`}</h2>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-black text-emerald-700">
                        <FiCheckCircle size={13} /> Đã cấp
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto]">
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-bold uppercase text-slate-400">Mã chứng nhận</p>
                        <p className="font-mono text-lg font-black text-emerald-700">{cert.certificate_code}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-2xl bg-slate-50 p-3">
                          <p className="text-xs font-bold uppercase text-slate-400">Điểm</p>
                          <p className="text-lg font-black text-slate-900">{Number(cert.total_score).toFixed(1)}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-3">
                          <p className="text-xs font-bold uppercase text-slate-400">Điểm đạt</p>
                          <p className="text-lg font-black text-slate-900">{Number(cert.pass_score).toFixed(1)}</p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500">Ngày cấp: {formatDate(cert.issued_at)}</p>
                    </div>

                    <img src={qrUrl} alt="QR xác thực chứng nhận" className="h-32 w-32 rounded-2xl border border-slate-200 bg-white p-2" />
                  </div>

                  <div className="flex flex-col gap-2 border-t border-slate-100 p-5 sm:flex-row">
                    <Link
                      href={verifyPath}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700"
                    >
                      <FiExternalLink size={16} /> Xem trang xác thực
                    </Link>
                    <button
                      onClick={() => copyVerifyLink(cert.certificate_code)}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
                    >
                      <FiCopy size={16} /> {copiedCode === cert.certificate_code ? 'Đã copy' : 'Copy link'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
