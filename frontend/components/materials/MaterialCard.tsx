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
  getMaterialCoverImage,
  getMaterialImages,
  getMaterialSubject,
  getMaterialType,
  hasWebContent,
  type Material,
} from './materialLibraryTypes';

export function MaterialCard({ material }: { material: Material }) {
  const user = useAuthStore((state) => state.user);
  const isVip = isVipActive(user);
  const [expanded, setExpanded] = useState(false);
  const [showVipModal, setShowVipModal] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const hasFile = Boolean(material.file_url);
  const hasContent = hasWebContent(material);
  const materialImages = getMaterialImages(material);
  const coverImage = getMaterialCoverImage(material);
  const hasImages = materialImages.length > 0;
  const hasPdfProxy = !hasImages && canUsePdfProxy(material.file_url);
  const pdfUrl = hasPdfProxy
    ? `/tailieu/pdf/${material.id}?title=${encodeURIComponent(material.title || 'Tài liệu')}`
    : material.file_url;
  const downloadUrl = hasPdfProxy ? `/api/materials/pdf/${material.id}/download` : material.file_url;
  const typeData = getMaterialType(material.category);
  const subjectData = getMaterialSubject(material.subject);
  const locked = material.is_premium && !isVip;

  const openMaterial = () => {
    if (locked) {
      setShowVipModal(true);
      return;
    }
    if (hasContent || hasImages || (hasFile && !hasPdfProxy)) {
      setExpanded((value) => !value);
      return;
    }
    if (hasFile) {
      window.open(pdfUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const getAuthToken = () => {
    const sessionToken = sessionStorage.getItem('token');
    if (sessionToken) return sessionToken;
    try {
      const stored = JSON.parse(localStorage.getItem('auth-storage') || '{}');
      return stored?.state?.token || null;
    } catch {
      return null;
    }
  };

  const openProtectedPdf = async (url: string, download = false) => {
    try {
      const token = getAuthToken();
      if (!token) {
        window.location.href = '/login';
        return;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error('PDF request failed');
      }

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
    } catch (error) {
      throw error;
    }
  };

  const handlePdfClick = async (event: React.MouseEvent) => {
    if (locked) {
      event.preventDefault();
      setShowVipModal(true);
      return;
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
      try {
        await openProtectedPdf(downloadUrl, true);
      } catch {
        alert('Không tải được PDF. Bạn thử đăng nhập lại nhé.');
      }
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
    <article className={`group overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${locked ? 'border-amber-200/80 hover:shadow-amber-500/10' : 'border-slate-200 hover:shadow-violet-100/70'}`}>
      <div className="p-3">
        <div className="flex flex-col gap-3">
          <div
            role="button"
            tabIndex={0}
            onClick={openMaterial}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openMaterial();
              }
            }}
            className="relative aspect-[3/4] w-full cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-slate-950 shadow-sm outline-none"
          >
            {coverImage?.url ? (
              <img
                src={coverImage.url}
                alt={coverImage.caption || material.title}
                className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full flex-col justify-between bg-gradient-to-br from-slate-950 via-teal-900 to-fuchsia-900 p-4 text-white">
                <div className="flex items-center justify-between text-xs font-black uppercase tracking-wide text-white/70">
                  <span>CSCA</span>
                  <span>{typeData.icon}</span>
                </div>
                <div className="space-y-3 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/30 bg-white/15 text-3xl shadow-inner">
                    {typeData.icon}
                  </div>
                  <p className="line-clamp-4 text-base font-black leading-tight">{material.title}</p>
                </div>
                <div className="h-1.5 rounded-full bg-white/35" />
              </div>
            )}
            <div className="absolute left-2 top-2 flex flex-wrap gap-1">
              {material.is_premium && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-300 px-2 py-0.5 text-[10px] font-black text-amber-950 shadow-sm">
                  <FaCrown /> PRO
                </span>
              )}
              <span className={`rounded-full border bg-white/90 px-2 py-0.5 text-[10px] font-black ${typeData.softClass}`}>
                {typeData.label}
              </span>
            </div>
          </div>

          <div className="min-w-0 text-center">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-black leading-5 text-slate-950 transition group-hover:text-violet-700">{material.title}</h3>
              {material.is_premium && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-amber-200 to-orange-400 px-2 py-0.5 text-[11px] font-black text-orange-950">
                  <FaCrown /> PRO
                </span>
              )}
            </div>
            {material.description && (
              <p className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-slate-500">{material.description}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
              <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold ${typeData.softClass}`}>
                {typeData.icon} {typeData.label}
              </span>
              {subjectData && (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
                  {subjectData.emoji} {subjectData.label}
                </span>
              )}
              <span className="text-[11px] font-semibold text-slate-400">
                {new Date(material.created_at).toLocaleDateString('vi-VN')}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-center gap-2">
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
            ) : hasContent || hasImages ? (
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 px-4 text-sm font-black text-white shadow-sm transition hover:shadow-md"
              >
                <FiExternalLink size={14} />
                {hasImages ? 'Xem ảnh' : 'Xem nội dung'}
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
            {!locked && hasFile && !hasImages && (
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
      {expanded && !locked && !hasContent && hasImages && (
        <div className="border-t border-slate-200 bg-slate-50 p-4 sm:p-6">
          <div className="mx-auto max-w-4xl space-y-4">
            {materialImages.map((image, index) => (
              <figure key={image.url} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <a href={image.url} target="_blank" rel="noreferrer">
                  <img
                    src={image.url}
                    alt={image.caption || `${material.title} - ảnh ${index + 1}`}
                    className="w-full bg-white object-contain"
                    loading="lazy"
                  />
                </a>
                {image.caption && (
                  <figcaption className="border-t border-slate-100 px-4 py-3 text-sm font-medium text-slate-600">
                    {image.caption}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        </div>
      )}
      {expanded && !locked && !hasContent && !hasImages && hasFile && !hasPdfProxy && (
        <div className="border-t border-slate-200 bg-slate-50 p-4">
          <iframe
            src={pdfUrl}
            className="h-[600px] w-full rounded-xl border border-slate-200"
            title={material.title}
            loading="lazy"
          />
        </div>
      )}
      {expanded && !locked && !hasContent && !hasImages && hasFile && hasPdfProxy && (
        <div className="border-t border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
          <button
            type="button"
            onClick={() => window.open(pdfUrl, '_blank', 'noopener,noreferrer')}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 font-bold text-white hover:bg-violet-700"
          >
            <FiExternalLink size={14} />
            Mở PDF an toàn
          </button>
        </div>
      )}
      {expanded && !locked && !hasContent && !hasImages && !hasFile && (
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
