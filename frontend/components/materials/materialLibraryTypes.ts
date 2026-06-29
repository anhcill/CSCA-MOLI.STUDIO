'use client';

export interface Material {
  id: number;
  title: string;
  description: string;
  file_url: string;
  file_type: string;
  category: string;
  subject: string;
  created_at: string;
  is_premium?: boolean;
  content_html?: string;
  content_text?: string;
  content_source?: string;
  content_meta?: {
    importMode?: string;
    cover_image?: MaterialImageMeta | string | null;
    coverImage?: MaterialImageMeta | string | null;
    images?: Array<{
      url: string;
      caption?: string;
      order?: number;
      width?: number | null;
      height?: number | null;
    }>;
    [key: string]: any;
  };
}

export type MaterialImageMeta = {
  url: string;
  publicId?: string;
  caption?: string;
  order?: number;
  width?: number | null;
  height?: number | null;
};

export interface MaterialTypeOption {
  value: string;
  label: string;
  icon: string;
  color: string;
  softClass: string;
}

export interface MaterialSubjectOption {
  value: string;
  label: string;
  emoji: string;
  desc: string;
  accent: string;
}

export const FORMULA_CATEGORY = 'cong-thuc-on-thi';

export const MATERIAL_TYPES: MaterialTypeOption[] = [
  { value: 'all', label: 'Tất cả', icon: '📚', color: 'bg-violet-600', softClass: 'bg-violet-50 text-violet-700 border-violet-100' },
  { value: 'ly-thuyet', label: 'Lý thuyết', icon: '📖', color: 'bg-blue-600', softClass: 'bg-blue-50 text-blue-700 border-blue-100' },
  { value: 'cau-truc-de', label: 'Cấu trúc đề', icon: '📋', color: 'bg-emerald-600', softClass: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  { value: 'de-mo-phong', label: 'Đề mô phỏng', icon: '📝', color: 'bg-orange-600', softClass: 'bg-orange-50 text-orange-700 border-orange-100' },
  { value: 'tu-vung', label: 'Từ vựng', icon: '✏️', color: 'bg-pink-600', softClass: 'bg-pink-50 text-pink-700 border-pink-100' },
];

export const MATERIAL_SUBJECTS: MaterialSubjectOption[] = [
  { value: 'all', label: 'Tất cả môn', emoji: '🎯', desc: 'Xem theo từng cụm môn riêng', accent: 'from-violet-500 to-fuchsia-500' },
  { value: 'toan', label: 'Toán', emoji: '🔢', desc: 'Công thức, dạng bài, đề luyện', accent: 'from-blue-500 to-cyan-500' },
  { value: 'vat-ly', label: 'Vật lý', emoji: '⚛️', desc: 'Lý thuyết và bài tập trọng tâm', accent: 'from-sky-500 to-indigo-500' },
  { value: 'hoa-hoc', label: 'Hóa học', emoji: '🧪', desc: 'Phản ứng, công thức, đề luyện', accent: 'from-emerald-500 to-teal-500' },
  { value: 'tieng-trung-xh', label: 'Tiếng Trung XH', emoji: '🇨🇳', desc: 'Đọc hiểu, xã hội, từ vựng', accent: 'from-rose-500 to-orange-500' },
  { value: 'tieng-trung-tn', label: 'Tiếng Trung TN', emoji: '🌿', desc: 'Tự nhiên, thuật ngữ, luyện đọc', accent: 'from-lime-500 to-green-500' },
];

export function hasWebContent(material: Material) {
  return Boolean(material.content_html || material.content_text);
}

export function getMaterialImages(material: Material) {
  const images = Array.isArray(material.content_meta?.images) ? material.content_meta.images : [];
  return images
    .filter((image) => image?.url)
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

function normalizeMaterialImage(image?: MaterialImageMeta | string | null) {
  if (!image) return null;
  if (typeof image === 'string') {
    return image.trim() ? { url: image.trim() } : null;
  }
  return image.url ? image : null;
}

export function getMaterialCoverImage(material: Material) {
  const coverImage = normalizeMaterialImage(material.content_meta?.cover_image || material.content_meta?.coverImage);
  if (coverImage) return coverImage;
  return getMaterialImages(material)[0] || null;
}

export function canUsePdfProxy(fileUrl?: string) {
  return Boolean(fileUrl && (/\/upload\/v\d+\//.test(fileUrl) || /\/api\/materials\/blob\/[a-f0-9]{32,96}/i.test(fileUrl)));
}

export function getMaterialType(category: string) {
  return MATERIAL_TYPES.find((item) => item.value === category) || MATERIAL_TYPES[0];
}

export function getMaterialSubject(subject: string) {
  return MATERIAL_SUBJECTS.find((item) => item.value === subject);
}
