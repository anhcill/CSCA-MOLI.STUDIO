export type ExamLanguage = 'vi' | 'zh' | 'en';

export type ExamLanguageMode = string;

const DEFAULT_LANGUAGE_MODE: ExamLanguageMode = 'zh';

export function normalizeExamLanguageMode(value?: string | null): ExamLanguageMode {
  const mode = String(value || '').trim().toLowerCase().replace(/-/g, '_');
  const parts = mode.split('_').filter((p) => p === 'vi' || p === 'zh' || p === 'en');
  if (parts.length > 0) {
    return parts.join('_');
  }
  return DEFAULT_LANGUAGE_MODE;
}

export function getExamLanguageOrder(mode?: string | null): ExamLanguage[] {
  const normalized = normalizeExamLanguageMode(mode);
  if (normalized.includes('_')) return normalized.split('_') as ExamLanguage[];
  return [normalized as ExamLanguage];
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
