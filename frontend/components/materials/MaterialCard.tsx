'use client';

import { useState } from 'react';
import { FiBookmark, FiChevronDown, FiChevronUp, FiDownload, FiExternalLink, FiLock } from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import { ProUpgradeModal } from '@/components/common/ProModal';
import { deleteBookmark, saveBookmark } from '@/lib/api/insights';
import { useAuthStore } from '@/lib/store/authStore';
import { isVipActive } from '@/lib/utils/permissions';
import MaterialContentViewer from '@/components/materials/MaterialContentViewer';
import {
  canUsePdfProxy,
  getMaterialSubject,
  getMaterialType,
  hasWebContent,
  type Material,
} from './materialLibraryTypes';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export function MaterialCard({ material }: { material: Material }) {
  const user = useAuthStore((state) => state.user);
  const isVip = isVipActive(user);
  const [expanded, setExpanded] = useState(false);
  const [showVipModal, setShowVipModal] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const hasFile = Boolean(material.file_url);
  const hasPdfProxy = canUsePdfProxy(material.file_url);
  const hasContent = hasWebContent(material);
  const pdfUrl = hasPdfProxy ? `${API_URL}/materials/pdf/${material.id}` : material.file_url;
  const downloadUrl = hasPdfProxy ? `${API_URL}/materials/pdf/${material.id}/download` : material.file_url;
  const typeData = getMaterialType(material.category);
  const subjectData = getMaterialSubject(material.subject);
  const locked = material.is_premium && !isVip;

  const openProtectedPdf = async (url: string, download = false) => {
    const token = sessionStorage.getItem('token');
    if (!token) {
      window.location.href = '/auth';
      return;
    }

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('PDF request failed');

    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    if (download) {
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `${material.title || 'tailieu'}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
      return;
    }
    window.open(objectUrl, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  };

  const handlePdfClick = async (event: React.MouseEvent) => {
    if (locked) {
      event.preventDefault();
      setShowVipModal(true);
      return;
    }
    if (hasPdfProxy && pdfUrl) {
      event.preventDefault();
      await openProtectedPdf(pdfUrl);
    }
  };

  const handleDownloadClick = async (event: React.MouseEvent) => {
    if (locked) {
      event.preventDefault();
      setShowVipModal(true);
      return;
    }
    if (hasPdfProxy && downloadUrl) {
      event.preventDefault();
      await openProtectedPdf(downloadUrl, true);
    }
  };

  const toggleBookmark = async () => {
    const next = !bookmarked;
    setBookmarked(next);
    try {
      if (next) {
        await saveBookmark({
          entity_type: 'material',
          entity_id: material.id,
          title: material.title,
          metadata: { category: material.category, subject: material.subject, file_type: material.file_type },
        });
      } else {
        await deleteBookmark('material', material.id);
      }
    } catch {
      setBookmarked(!next);
    }
  };

  return (
    <article className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${locked ? 'border-amber-200/80 hover:shadow-amber-500/10' : 'border-slate-200 hover:shadow-violet-100/70'}`}>
      <div className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${typeData.color} text-2xl text-white shadow-sm`}>
            <span>{typeData.icon}</span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="min-w-0 text-base font-black leading-snug text-slate-950 sm:text-lg">{material.title}</h3>
              {material.is_premium && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-amber-200 to-orange-400 px-2 py-0.5 text-[11px] font-black text-orange-950">
                  <FaCrown /> PRO
                </span>
              )}
            </div>
            {material.description && (
              <p className="mt-1 line-clamp-2 text-sm font-medium leading-6 text-slate-600">{material.description}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold ${typeData.softClass}`}>
                {typeData.icon} {typeData.label}
              </span>
              {subjectData && (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
                  {subjectData.emoji} {subjectData.label}
                </span>
              )}
              <span className="text-xs font-semibold text-slate-400">
                {new Date(material.created_at).toLocaleDateString('vi-VN')}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:justify-end">
            <button
              onClick={toggleBookmark}
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${bookmarked ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              title="Lưu tài liệu"
            >
              <FiBookmark size={16} />
            </button>
            {locked ? (
              <button
                onClick={() => setShowVipModal(true)}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-amber-100 px-4 text-sm font-black text-amber-700 transition hover:bg-amber-200"
              >
                <FiLock size={14} />
                PRO
              </button>
            ) : hasContent ? (
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 px-4 text-sm font-black text-white shadow-sm transition hover:shadow-md"
              >
                <FiExternalLink size={14} />
                Xem nội dung
              </button>
            ) : hasFile ? (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
                onClick={handlePdfClick}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 px-4 text-sm font-black text-white shadow-sm transition hover:shadow-md"
              >
                <FiExternalLink size={14} />
                Xem PDF
              </a>
            ) : (
              <span className="inline-flex h-10 items-center rounded-xl bg-slate-100 px-4 text-sm font-bold text-slate-400">Chưa có file</span>
            )}
            {!locked && hasFile && (
              <a
                href={downloadUrl}
                onClick={handleDownloadClick}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 transition hover:bg-emerald-200"
                title="Tải xuống"
              >
                <FiDownload size={16} />
              </a>
            )}
            <button
              onClick={() => setExpanded((value) => !value)}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition hover:bg-slate-200"
              title={expanded ? 'Thu gọn' : 'Xem trước'}
            >
              {expanded ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
            </button>
          </div>
        </div>
      </div>

      {expanded && !locked && hasContent && (
        <MaterialContentViewer
          contentHtml={material.content_html}
          contentText={material.content_text}
          className="border-t border-slate-200"
        />
      )}
      {expanded && !locked && !hasContent && hasFile && !hasPdfProxy && (
        <div className="border-t border-slate-200 bg-slate-50 p-4">
          <iframe
            src={pdfUrl}
            className="h-[600px] w-full rounded-xl border border-slate-200"
            title={material.title}
            loading="lazy"
          />
        </div>
      )}
      {expanded && !locked && !hasContent && hasFile && hasPdfProxy && (
        <div className="border-t border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
          <button
            type="button"
            onClick={handlePdfClick}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 font-bold text-white hover:bg-violet-700"
          >
            <FiExternalLink size={14} />
            Mở PDF an toàn
          </button>
        </div>
      )}
      {expanded && !locked && !hasContent && !hasFile && (
        <div className="border-t border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
          Tài liệu này chưa có file hoặc nội dung web.
        </div>
      )}
      {expanded && locked && (
        <div className="border-t border-amber-100 bg-amber-50 p-6 text-center">
          <FaCrown className="mx-auto mb-2 text-amber-500" size={32} />
          <p className="mb-1 font-black text-amber-800">Tài liệu dành cho VIP</p>
          <p className="mb-3 text-sm font-medium text-amber-600">Nâng cấp PRO để xem nội dung.</p>
          <button
            onClick={() => setShowVipModal(true)}
            className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-2 text-sm font-black text-white shadow-sm transition hover:shadow-md"
          >
            Nâng cấp ngay
          </button>
        </div>
      )}

      {showVipModal && (
        <ProUpgradeModal
          isOpen
          onClose={() => setShowVipModal(false)}
          title={`"${material.title}" chỉ dành cho VIP`}
        />
      )}
    </article>
  );
}
