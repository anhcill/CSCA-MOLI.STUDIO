import type { ImportedExamItem, ImportedQuestionData, PdfImportPreview } from '@/lib/api/examAdmin';
import { inferImportedCorrectAnswer, normalizeImportedText } from './importMathCleanup';

const EXPLANATION_MARKER_RE =
    /(?:^|\s)(?:\u7b54\u6848\u89e3\u6790|\u89e3\u6790|\u89e3\u7b54|\u8bf4\u660e|\u89e3|analysis|explanation|lời giải|loi giai|giải thích|giai thich)\s*[:：]\s*/i;

const normalizeImportText = (value?: string) =>
    normalizeImportedText(value);

const tidyExplanationBreaks = (value: string) =>
    value
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

const applyExplanationBreakRules = (value: string) =>
    value
        .replace(/\s*((?:前\s*n\s*[项項]和公式|通[项項]公式|代入(?:数据|數據)?解不等式|验证|驗證|检验|檢驗|结论|結論)\s*[:：])/g, '\n$1')
        .replace(/\s*((?:Công thức|Thay|Kiểm tra|Kết luận|Chọn|Vậy)\s*[:：])/gi, '\n$1')
        .replace(/\s*((?:步骤|步驟|Bước)\s*\d+\s*[:：])/gi, '\n$1')
        .replace(/\s*(⇔|=>|⇒|\\Rightarrow)\s*/g, '\n$1 ')
        .replace(/([。.;；])\s*(?=(?:由|当|代入|验证|驗證|因此|所以|故|选|答案|解析|得|Suy ra|Vậy|n\s*=))/g, '$1\n')
        .replace(/([，,])\s*(?=(?:n|x|m|k)\s*=\s*-?\d+\s*(?:时|時))/g, '$1\n')
        .replace(/[，,]\s*(?=(?:值域|定义域|反函数|因此|所以|故|选|答案|得))/g, '，\n')
        .replace(/([:：])\s*(?=(?:[A-Za-z0-9\\(√]|\\log|\\frac|\\sqrt))/g, '$1\n')
        .replace(/\s*(选\s*[A-H][.。]?)/gi, '\n$1')
        .replace(/\n\s*\n(?=(?:⇔|=>|⇒|\\Rightarrow))/g, '\n');

const normalizeExplanationText = (value?: string) => {
    const normalized = normalizeImportText(value)
        ?.replace(/\\n/g, '\n')
        .replace(/\r\n?/g, '\n');
    if (!normalized) return normalized;

    return tidyExplanationBreaks(applyExplanationBreakRules(normalized));
};

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
            explanation: normalizeExplanationText(question.explanation || vi.explanation),
            explanationCn: normalizeExplanationText(question.explanationCn || cn.explanation),
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
                    explanation: normalizeExplanationText(subItem.explanation),
                    explanationCn: normalizeExplanationText(subItem.explanationCn),
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
