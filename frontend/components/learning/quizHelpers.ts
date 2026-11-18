import type {
  ExternalQuizEssayAnswerDto,
  ExternalQuizItemDto,
  ExternalQuizOptionDto,
  ExternalQuizQuestionDto,
} from '@/lib/types/courses';

export function optionLabel(opt: ExternalQuizOptionDto, index: number): string {
  return String(opt.key || opt.label || String.fromCharCode(65 + index));
}

export function localizedQuestionText(q: ExternalQuizQuestionDto, showChinese: boolean): string {
  if (showChinese) {
    return q.questionTextCn || q.questionText || q.prompt || '';
  }
  return q.questionText || q.prompt || q.questionTextCn || '';
}

export function localizedPassageText(
  src: Pick<ExternalQuizQuestionDto, 'passageText' | 'passageTextCn'> | Pick<ExternalQuizItemDto, 'passageText' | 'passageTextCn'>,
  showChinese: boolean,
): string {
  if (showChinese) {
    return src.passageTextCn || src.passageText || '';
  }
  return src.passageText || src.passageTextCn || '';
}

export function localizedOptionText(opt: ExternalQuizOptionDto, showChinese: boolean): string {
  if (showChinese) {
    return opt.textCn || opt.text || '';
  }
  return opt.text || opt.textCn || '';
}

export function localizedExplanationText(q: ExternalQuizQuestionDto, showChinese: boolean): string {
  if (showChinese) {
    return q.explanationCn || q.explanation || '';
  }
  return q.explanation || q.explanationCn || '';
}

export function isEssayQuestionType(questionType: string | null | undefined): boolean {
  const t = String(questionType || '').toLowerCase();
  return t === 'essay' || t === 'translation';
}

export function isChoiceQuestionType(questionType: string | null | undefined): boolean {
  const t = String(questionType || '').toLowerCase();
  return t === 'single_choice' || t === 'multiple_choice' || t === 'true_false' || t === 'reading_item';
}

export function isShortInputQuestionType(questionType: string | null | undefined): boolean {
  const t = String(questionType || '').toLowerCase();
  return t === 'fill_blank' || t === 'short_answer';
}

export function normalizeMultipleChoiceValue(val: unknown): string[] {
  if (Array.isArray(val)) return val.map((v) => String(v).trim()).filter(Boolean);
  if (typeof val === 'string' && val.trim()) {
    return val.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export function normalizeEssayValue(val: unknown): ExternalQuizEssayAnswerDto {
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    const obj = val as Record<string, unknown>;
    return {
      text: typeof obj.text === 'string' ? obj.text : '',
      notes: typeof obj.notes === 'string' ? obj.notes : '',
      attachments: Array.isArray(obj.attachments)
        ? (obj.attachments as ExternalQuizEssayAnswerDto['attachments'])
        : [],
    };
  }
  if (typeof val === 'string') {
    return { text: val, notes: '', attachments: [] };
  }
  return { text: '', notes: '', attachments: [] };
}

export function isQuestionAnswered(question: ExternalQuizQuestionDto, val: unknown): boolean {
  if (isEssayQuestionType(question.questionType)) {
    const essay = normalizeEssayValue(val);
    return Boolean(essay.text?.trim() || essay.notes?.trim() || (essay.attachments && essay.attachments.length > 0));
  }
  if (String(question.questionType || '').toLowerCase() === 'multiple_choice') {
    return normalizeMultipleChoiceValue(val).length > 0;
  }
  if (Array.isArray(val)) return val.length > 0;
  return val !== undefined && val !== null && String(val).trim() !== '';
}

export function questionHasChinese(q: ExternalQuizQuestionDto): boolean {
  return Boolean(
    q.questionTextCn
    || q.passageTextCn
    || q.explanationCn
    || (q.options || []).some((o) => Boolean(o?.textCn))
    || (q.linkedOptions || []).some((o) => Boolean(o?.textCn)),
  );
}

export function itemsHaveChinese(items: ExternalQuizItemDto[], flatQuestions: ExternalQuizQuestionDto[]): boolean {
  if (flatQuestions.some(questionHasChinese)) return true;
  return items.some((item) => Boolean(
    item.passageTextCn
    || (item.linkedOptions || []).some((o) => Boolean(o?.textCn))
    || item.questions.some(questionHasChinese),
  ));
}

export function formatDisplayAnswer(
  rawVal: unknown,
  question?: ExternalQuizQuestionDto,
  showChinese = true,
  linkedPool?: ExternalQuizOptionDto[],
): string {
  if (rawVal === undefined || rawVal === null || rawVal === '') return '—';
  if (question && isEssayQuestionType(question.questionType)) {
    const essay = normalizeEssayValue(rawVal);
    const parts: string[] = [];
    if (essay.text?.trim()) parts.push(essay.text.trim());
    if (essay.attachments?.length) parts.push(`${essay.attachments.length} tệp đính kèm`);
    return parts.length > 0 ? parts.join(' · ') : '—';
  }
  const pool = question?.options?.length
    ? question.options
    : (question?.linkedOptions?.length ? question.linkedOptions : (linkedPool ?? []));
  const lookup = (val: unknown) => {
    const raw = String(val ?? '').trim();
    if (!raw || !pool.length) return raw;
    const foundIndex = pool.findIndex((opt, idx) => optionLabel(opt, idx) === raw || String(opt.id || '') === raw);
    if (foundIndex < 0) return raw;
    const found = pool[foundIndex];
    const txt = localizedOptionText(found, showChinese);
    return txt ? `${optionLabel(found, foundIndex)}. ${txt}` : optionLabel(found, foundIndex);
  };
  if (Array.isArray(rawVal)) {
    return rawVal.length ? rawVal.map(lookup).join(', ') : '—';
  }
  if (typeof rawVal === 'object') return JSON.stringify(rawVal);
  return lookup(rawVal);
}

export function formatTimerClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function mergeItemGroupsWithReview(
  baseItems: ExternalQuizItemDto[],
  reviewItems: ExternalQuizItemDto[],
  flatReview: ExternalQuizQuestionDto[],
): ExternalQuizItemDto[] {
  const sourceItems = baseItems.length > 0 ? baseItems : reviewItems;
  if (sourceItems.length === 0) return [];
  const revById = new Map(flatReview.map((q) => [String(q.questionId || q.id), q]));

  return sourceItems.map((item) => {
    const mergedQuestions = item.questions.map((q, idx) => {
      const rev = revById.get(String(q.questionId || q.id));
      if (!rev) return q;
      const baseOpts = q.options?.length ? q.options : (q.linkedOptions ?? []);
      const revOpts = rev.options?.length ? rev.options : (rev.linkedOptions ?? []);
      const mergedLinked = rev.linkedOptions?.length ? rev.linkedOptions : (q.linkedOptions ?? []);
      return {
        ...q,
        ...rev,
        id: String(q.id || rev.id || idx + 1),
        prompt: q.prompt || q.questionText || rev.prompt || rev.questionText || '',
        questionText: q.questionText || rev.questionText || q.prompt || '',
        questionTextCn: q.questionTextCn || rev.questionTextCn || null,
        questionTextEn: q.questionTextEn || rev.questionTextEn || null,
        explanation: q.explanation ?? rev.explanation ?? null,
        explanationCn: q.explanationCn || rev.explanationCn || null,
        passageText: q.passageText ?? rev.passageText ?? null,
        passageTextCn: q.passageTextCn || rev.passageTextCn || null,
        passageImageUrl: q.passageImageUrl ?? rev.passageImageUrl ?? null,
        linkedOptions: mergedLinked.length > 0 ? mergedLinked : undefined,
        options: revOpts.length > 0 ? revOpts : baseOpts,
        userAnswer: q.userAnswer ?? q.studentAnswer ?? rev.userAnswer ?? rev.studentAnswer,
      };
    });
    const first = mergedQuestions[0];
    return {
      ...item,
      passageText: item.passageText ?? first?.passageText ?? null,
      passageTextCn: item.passageTextCn || first?.passageTextCn || null,
      passageImageUrl: item.passageImageUrl ?? first?.passageImageUrl ?? null,
      linkedOptions: (item.linkedOptions && item.linkedOptions.length > 0)
        ? item.linkedOptions
        : (first?.linkedOptions ?? []),
      question: item.kind === 'question' ? mergedQuestions[0] : item.question,
      questions: mergedQuestions,
    };
  });
}
