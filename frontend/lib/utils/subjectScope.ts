export interface SubjectMeta {
  label: string;
  icon: string;
  color: string;
  examCode: string;
}

export const SUBJECT_META: Record<string, SubjectMeta> = {
  toan: { label: 'Toán học', icon: '📐', color: 'from-blue-500 to-indigo-600', examCode: 'MATH' },
  'vat-ly': { label: 'Vật Lý', icon: '⚡', color: 'from-yellow-500 to-orange-600', examCode: 'PHYSICS' },
  'hoa-hoc': { label: 'Hóa Học', icon: '🧪', color: 'from-green-500 to-teal-600', examCode: 'CHEMISTRY' },
  'tieng-trung-xh': { label: 'Tiếng Trung XH', icon: '📖', color: 'from-red-500 to-rose-600', examCode: 'CHINESE_SOC' },
  'tieng-trung-tn': { label: 'Tiếng Trung TN', icon: '🔬', color: 'from-violet-500 to-purple-600', examCode: 'CHINESE_SCI' },
};

export const SUBJECT_OPTIONS = [
  { value: '', label: 'Tất cả', emoji: '📋' },
  { value: 'toan', label: 'Toán', emoji: '📐' },
  { value: 'vat-ly', label: 'Vật Lý', emoji: '⚡' },
  { value: 'hoa-hoc', label: 'Hóa Học', emoji: '🧪' },
  { value: 'tieng-trung-xh', label: 'Tiếng Trung XH', emoji: '📖' },
  { value: 'tieng-trung-tn', label: 'Tiếng Trung TN', emoji: '🔬' },
];

const SUBJECT_ALIASES: Record<string, string> = {
  math: 'toan',
  toan: 'toan',
  physics: 'vat-ly',
  'vat-ly': 'vat-ly',
  vatly: 'vat-ly',
  chemistry: 'hoa-hoc',
  hoa: 'hoa-hoc',
  'hoa-hoc': 'hoa-hoc',
  hoahoc: 'hoa-hoc',
  chinese: 'tieng-trung-xh',
  chinese_soc: 'tieng-trung-xh',
  chinesesoc: 'tieng-trung-xh',
  'tiengtrung-xahoi': 'tieng-trung-xh',
  'tieng-trung-xh': 'tieng-trung-xh',
  'tieng-trung-xahoi': 'tieng-trung-xh',
  chinese_sci: 'tieng-trung-tn',
  chinesesci: 'tieng-trung-tn',
  'tiengtrung-tunhien': 'tieng-trung-tn',
  'tieng-trung-tn': 'tieng-trung-tn',
  'tieng-trung-tunhien': 'tieng-trung-tn',
};

export const normalizeContentSubject = (value?: string | null) => {
  const key = (value || '').trim().toLowerCase();
  if (!key) return '';
  return SUBJECT_ALIASES[key] || key;
};

export const getSubjectMeta = (value?: string | null) => {
  const subject = normalizeContentSubject(value);
  return SUBJECT_META[subject] || null;
};

export const getExamSubjectCode = (value?: string | null) => {
  const subject = normalizeContentSubject(value);
  return SUBJECT_META[subject]?.examCode || (value || '').trim().toUpperCase();
};

export const getExamSubjectSlug = (value?: string | null) => {
  const subject = normalizeContentSubject(value);
  const examSlugs: Record<string, string> = {
    toan: 'toan',
    'vat-ly': 'vat-ly',
    'hoa-hoc': 'hoa',
    'tieng-trung-xh': 'tiengtrung-xahoi',
    'tieng-trung-tn': 'tiengtrung-tunhien',
  };
  return examSlugs[subject] || subject;
};

export const subjectMatches = (actual?: string | null, selected?: string | null) => {
  const normalizedSelected = normalizeContentSubject(selected);
  if (!normalizedSelected) return true;
  return normalizeContentSubject(actual) === normalizedSelected;
};

export const buildSubjectScopedHref = (href: string, subjectSlug?: string) => {
  const subject = normalizeContentSubject(subjectSlug);
  if (!subject) return href;
  return `${href}?subject=${encodeURIComponent(subject)}`;
};
