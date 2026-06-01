import type { ImportedExamItem, ImportedQuestionData, PdfImportPreview } from '@/lib/api/examAdmin';
import { inferImportedCorrectAnswer, normalizeImportedText } from './importMathCleanup';

const EXPLANATION_MARKER_RE =
    /(?:^|\s)(?:\u7b54\u6848\u89e3\u6790|\u89e3\u6790|\u89e3\u7b54|\u8bf4\u660e|\u89e3|analysis|explanation|lời giải|loi giai|giải thích|giai thich)\s*[:：]\s*/i;

const normalizeImportText = (value?: string) =>
    normalizeImportedText(value);

const splitExplanationMarker = (value?: string) => {
    const text = value || '';
    const match = text.match(EXPLANATION_MARKER_RE);
    if (!match || match.index === undefined) {
        return { text, explanation: '' };
    }

    return {
        text: text.slice(0, match.index).trim(),
        explanation: text.slice(match.index + match[0].length).trim(),
    };
};

const normalizeImportedQuestionMath = (question: ImportedQuestionData): ImportedQuestionData => {
    const normalizedQuestion = {
        ...question,
        ...(() => {
        const vi = splitExplanationMarker(question.questionText);
        const cn = splitExplanationMarker(question.questionTextCn);

        return {
            questionText: normalizeImportText(vi.explanation ? vi.text : question.questionText) || '',
            questionTextCn: normalizeImportText(cn.explanation ? cn.text : question.questionTextCn),
            explanation: normalizeImportText(question.explanation || vi.explanation),
            explanationCn: normalizeImportText(question.explanationCn || cn.explanation),
            answers: question.answers?.map(answer => ({
                ...answer,
                text: normalizeImportText(answer.text) || '',
                textCn: normalizeImportText(answer.textCn),
            })),
        };
        })(),
    };

    return {
        ...normalizedQuestion,
        correctAnswer: inferImportedCorrectAnswer(normalizedQuestion),
    };
};

export const normalizeImportedItemsMath = (items: ImportedExamItem[] = []): ImportedExamItem[] =>
    items.map(item => {
        if (item.itemType === 'reading_group') {
            return {
                ...item,
                passageText: normalizeImportText(item.passageText) || '',
                subQuestions: item.subQuestions.map(normalizeImportedQuestionMath),
            };
        }

        if (item.itemType === 'fill_blank_group') {
            return {
                ...item,
                passageText: normalizeImportText(item.passageText) || '',
                linkedOptions: item.linkedOptions.map(option => ({
                    ...option,
                    text: normalizeImportText(option.text) || '',
                    textCn: normalizeImportText(option.textCn) || '',
                })),
                subItems: item.subItems.map(subItem => ({
                    ...subItem,
                    questionText: normalizeImportText(subItem.questionText) || '',
                    questionTextCn: normalizeImportText(subItem.questionTextCn),
                    explanation: normalizeImportText(subItem.explanation),
                    explanationCn: normalizeImportText(subItem.explanationCn),
                })),
            };
        }

        return normalizeImportedQuestionMath(item);
    });

export const normalizePdfImportPreviewMath = (preview: PdfImportPreview): PdfImportPreview => {
    const items = normalizeImportedItemsMath(preview.items || []);
    const questions = normalizeImportedItemsMath(preview.questions || [])
        .filter((item): item is ImportedQuestionData => item.itemType !== 'reading_group' && item.itemType !== 'fill_blank_group');

    return {
        ...preview,
        items,
        questions,
    };
};
