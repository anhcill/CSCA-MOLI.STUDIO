'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import { AdmissionTicket, officialExamApi } from '@/lib/api/officialExams';
import { FiArrowLeft, FiCalendar, FiClock, FiHash, FiMapPin, FiPrinter, FiShield, FiUser } from 'react-icons/fi';

function formatDateTime(value?: string | null) {
  if (!value) return 'Chưa có';
  return new Date(value).toLocaleString('vi-VN');
}

export default function AdmissionTicketPage() {
  const params = useParams();
  const router = useRouter();
  const examId = Number.parseInt(params.id as string, 10);
  const [ticket, setTicket] = useState<AdmissionTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const checkInPayload = useMemo(() => {
    if (!ticket) return '';
    if (typeof window === 'undefined') return ticket.check_in_code;
    return JSON.stringify({
      type: 'CSCA_CHECKIN',
      code: ticket.check_in_code,
      examId: ticket.exam_id,
      registrationId: ticket.registration_id,
      issuedAt: new Date().toISOString(),
      origin: window.location.origin,
    });
  }, [ticket]);
  const qrUrl = checkInPayload
    ? `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(checkInPayload)}`
    : '';

  useEffect(() => {
    if (!Number.isFinite(examId) || examId <= 0) {
      setError('ID kỳ thi không hợp lệ.');
      setLoading(false);
      return;
    }

    officialExamApi.getAdmissionTicket(examId)
      .then(setTicket)
      .catch((err) => {
        setError(err?.response?.data?.message || 'Không thể tải vé dự thi.');
      })
      .finally(() => setLoading(false));
  }, [examId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="mx-auto max-w-2xl px-4 py-10">
          <button
            onClick={() => router.back()}
            className="mb-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100"
          >
            <FiArrowLeft /> Quay lại
          </button>
          <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-red-800">
            <h1 className="text-xl font-black">Chưa thể xem vé dự thi</h1>
            <p className="mt-2 text-sm">{error || 'Không có dữ liệu vé dự thi.'}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          @page { size: A4; margin: 1.2cm; }
        }
      `}</style>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="no-print mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100"
          >
            <FiArrowLeft /> Quay lại
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white hover:bg-indigo-700"
          >
            <FiPrinter /> In / Xuất PDF
          </button>
        </div>

        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-950 p-6 text-white sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-indigo-200">CSCA Admission Ticket</p>
                <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">Vé dự thi</h1>
                <p className="mt-2 text-slate-300">{ticket.exam_title}</p>
              </div>
              <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-right">
                <p className="text-xs font-bold uppercase text-slate-300">Mã đăng ký</p>
                <p className="font-mono text-xl font-black">#{ticket.registration_id}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_300px]">
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <InfoCard icon={FiUser} label="Thí sinh" value={ticket.full_name || ticket.username || 'Học viên'} sub={ticket.email || undefined} />
                <InfoCard icon={FiShield} label="Trạng thái" value={ticket.status === 'checked_in' ? 'Đã check-in' : 'Đã duyệt'} />
                <InfoCard icon={FiCalendar} label="Giờ bắt đầu" value={formatDateTime(ticket.start_time)} />
                <InfoCard icon={FiClock} label="Giờ kết thúc" value={formatDateTime(ticket.end_time)} />
                <InfoCard icon={FiMapPin} label="Phòng thi" value={ticket.room_name || 'Chưa phân phòng'} sub={ticket.location || undefined} />
                <InfoCard icon={FiHash} label="Số ghế" value={ticket.seat_number ? String(ticket.seat_number) : 'Chưa phân ghế'} />
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Thông tin kỳ thi</p>
                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <p className="text-slate-400">Môn</p>
                    <p className="font-black text-slate-900">{ticket.subject_name || ticket.subject_code || 'CSCA'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Mã đề/kỳ thi</p>
                    <p className="font-mono font-black text-slate-900">{ticket.exam_code || `EXAM-${ticket.exam_id}`}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Thời lượng</p>
                    <p className="font-black text-slate-900">{ticket.duration || 0} phút</p>
                  </div>
                </div>
              </div>
            </div>

            <aside className="rounded-3xl border border-slate-200 bg-white p-5 text-center">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">QR check-in</p>
              {qrUrl && (
                <img src={qrUrl} alt="QR check-in vé dự thi" className="mx-auto mt-4 h-56 w-56 rounded-2xl border border-slate-200 p-2" />
              )}
              <p className="mt-4 break-all font-mono text-xs font-bold text-slate-500">{ticket.check_in_code}</p>
              <p className="mt-3 text-xs leading-5 text-slate-400">
                Xuất trình QR này khi vào phòng thi để giám thị check-in.
              </p>
            </aside>
          </div>
        </section>
      </main>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
        <Icon size={18} />
      </div>
      <p className="text-xs font-bold uppercase text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
      {sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}
    </div>
  );
}
