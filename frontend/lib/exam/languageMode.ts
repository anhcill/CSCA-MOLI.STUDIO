export type ExamLanguage = 'vi' | 'zh' | 'en';

export type ExamLanguageMode =
  | ExamLanguage
  | 'vi_zh'
  | 'vi_en'
  | 'zh_vi'
  | 'zh_en'
  | 'en_vi'
  | 'en_zh';

const DEFAULT_LANGUAGE_MODE: ExamLanguageMode = 'zh';

export function normalizeExamLanguageMode(value?: string | null): ExamLanguageMode {
  const mode = String(value || '').trim().toLowerCase().replace('-', '_');
  if (
    mode === 'vi' ||
    mode === 'zh' ||
    mode === 'en' ||
    mode === 'vi_zh' ||
    mode === 'vi_en' ||
    mode === 'zh_vi' ||
    mode === 'zh_en' ||
    mode === 'en_vi' ||
    mode === 'en_zh'
  ) {
    return mode;
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

  const fallback = (['zh', 'vi', 'en'] as ExamLanguage[])
    .map((lang) => ({ lang, text: (values[lang] || '').trim() }))
    .find((item) => item.text);

  const primary = selected[0] || fallback || { lang: order[0] || 'zh', text: '' };
  const secondary = selected.find((item) => item.text !== primary.text);

  return {
    primary: primary.text,
    secondary: secondary?.text || '',
    primaryLanguage: primary.lang,
    secondaryLanguage: secondary?.lang || null,
  };
}
