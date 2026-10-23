export type ExamLanguage = 'vi' | 'zh' | 'en';

export type ExamLanguageMode = string;

const DEFAULT_LANGUAGE_MODE: ExamLanguageMode = 'zh';
const DEFAULT_EXPLANATION_LANGUAGE_MODE: ExamLanguageMode = 'vi';

export const LANGUAGE_MODE_LABELS: Record<string, string> = {
  zh: 'Chỉ tiếng Trung',
  vi: 'Chỉ tiếng Việt',
  en: 'Chỉ tiếng Anh',
  vi_zh: 'Việt + Trung',
  zh_vi: 'Trung + Việt',
  vi_en: 'Việt + Anh',
  en_vi: 'Anh + Việt',
  zh_en: 'Trung + Anh',
  en_zh: 'Anh + Trung',
  vi_en_zh: 'Full 3 thứ tiếng (Việt + Trung + Anh)',
};

export function normalizeExamLanguageMode(
  value?: string | null,
  defaultMode: ExamLanguageMode = DEFAULT_LANGUAGE_MODE,
): ExamLanguageMode {
  const mode = String(value || '').trim().toLowerCase().replace(/-/g, '_');
  const parts = mode.split('_').filter((p) => p === 'vi' || p === 'zh' || p === 'en');
  if (parts.length > 0) {
    return parts.join('_');
  }
  return defaultMode;
}

export function normalizeExplanationLanguageMode(value?: string | null): ExamLanguageMode {
  return normalizeExamLanguageMode(value, DEFAULT_EXPLANATION_LANGUAGE_MODE);
}

export function getExamLanguageOrder(
  mode?: string | null,
  defaultMode: ExamLanguageMode = DEFAULT_LANGUAGE_MODE,
): ExamLanguage[] {
  const normalized = normalizeExamLanguageMode(mode, defaultMode);
  if (normalized.includes('_')) return normalized.split('_') as ExamLanguage[];
  return [normalized as ExamLanguage];
}

export function getAllowedBaseLanguages(
  mode?: string | null,
  defaultMode: ExamLanguageMode = DEFAULT_LANGUAGE_MODE,
): ExamLanguage[] {
  const order = getExamLanguageOrder(mode, defaultMode);
  return Array.from(new Set(order));
}

export function isLanguageSelectionAllowed(
  selectedMode?: string | null,
  configuredMode?: string | null,
  defaultMode: ExamLanguageMode = DEFAULT_LANGUAGE_MODE,
): boolean {
  const raw = String(selectedMode || '').trim().toLowerCase().replace(/-/g, '_');
  if (!raw) return false;
  const selectedParts = raw
    .split('_')
    .filter((p): p is ExamLanguage => p === 'vi' || p === 'zh' || p === 'en');
  if (selectedParts.length === 0) return false;
  const allowedSet = new Set(getAllowedBaseLanguages(configuredMode, defaultMode));
  return selectedParts.every((lang) => allowedSet.has(lang));
}

export function formatLanguageModeLabel(
  mode?: string | null,
  defaultMode: ExamLanguageMode = DEFAULT_LANGUAGE_MODE,
): string {
  const normalized = normalizeExamLanguageMode(mode, defaultMode);
  if (LANGUAGE_MODE_LABELS[normalized]) return LANGUAGE_MODE_LABELS[normalized];
  const parts = getAllowedBaseLanguages(normalized, defaultMode);
  if (parts.length === 3) return LANGUAGE_MODE_LABELS.vi_en_zh;
  return LANGUAGE_MODE_LABELS[defaultMode] || normalized;
}

export function getExamLanguageText(
  values: { vi?: string | null; zh?: string | null; en?: string | null },
  mode?: string | null,
  options?: { fallback?: boolean },
) {
  const order = getExamLanguageOrder(mode);
  const seen = new Set<ExamLanguage>();
  const selected = order
    .filter((lang) => {
      if (seen.has(lang)) return false;
      seen.add(lang);
      return true;
    })
    .map((lang) => ({ lang, text: (values[lang] || '').trim() }))
    .filter((item) => item.text);

  const fallback = options?.fallback
    ? (['zh', 'vi', 'en'] as ExamLanguage[])
      .map((lang) => ({ lang, text: (values[lang] || '').trim() }))
      .find((item) => item.text)
    : null;

  const primary = selected[0] || fallback || { lang: order[0] || 'zh', text: '' };
  const secondary = selected.find((item) => item.text !== primary.text);
  const tertiary = selected.find((item) => item.text !== primary.text && (!secondary || item.text !== secondary.text));

  return {
    primary: primary.text,
    secondary: secondary?.text || '',
    tertiary: tertiary?.text || '',
    primaryLanguage: primary.lang,
    secondaryLanguage: secondary?.lang || null,
    tertiaryLanguage: tertiary?.lang || null,
  };
}
