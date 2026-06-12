'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { examAdminApi, ApplyExamReviewFixesResult, GenerateMissingExplanationsResult, ImportedExamItem, ImportedQuestionData, NormalizeFormulaResult, PdfImportPreview, StoredExamReviewResult } from '@/lib/api/examAdmin';
import { hasPermission } from '@/lib/utils/permissions';
import axios from '@/lib/utils/axios';
import { FiAlertCircle, FiChevronLeft, FiEdit2, FiTrash2, FiPlus, FiSave, FiX, FiCheckCircle, FiMonitor, FiRefreshCw } from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import QuestionEditor, { QuestionFormData } from '@/components/admin/QuestionEditor';
import ReadingPassageGroup, { ReadingPassageGroupData } from '@/components/admin/ReadingPassageGroup';
import FillBlankGroup, { FillBlankGroupData } from '@/components/admin/FillBlankGroup';
import RichMathText from '@/components/common/RichMathText';
import PdfImportPanel from '@/components/admin/pdf-import/PdfImportPanel';
import {
    getImportItemsQuestionCount,
    getImportPreviewItems,
    validateImportedItems,
} from '@/components/admin/pdf-import/pdfImportUtils';

interface Answer {
    id: number;
    answer_key: string;
    answer_text: string;
    answer_text_cn: string;
    image_url?: string;
    is_correct: boolean;
}

interface SavedQuestion {
    id: number;
    question_number: number;
    question_type: string;
    question_text: string;
    question_text_cn?: string;
    image_url?: string;
    passage_text?: string;
    passage_image_url?: string;
    points: number;
    explanation?: string;
    explanation_cn?: string;
    explanation_image_url?: string;
    difficulty?: string;
    linked_options?: any;
    cloze_mode?: 'sentences' | 'passage';
    sub_question_number?: number;
    passage_group_id?: number;
    passage_group_localId?: number;
    answers?: Answer[];
    effective_linked_options?: any;
    effective_passage_text?: string;
    effective_cloze_mode?: 'sentences' | 'passage';
}

interface SavedQuestionGroup {
    _group: true;
    id: number;
    question_number: number;
    question_type: 'reading_passage' | 'fill_blank_pool';
    passage_text?: string;
    passage_image_url?: string;
    linked_options?: any;
    cloze_mode?: 'sentences' | 'passage';
    children: SavedQuestion[];
}

type PendingQuestion = { _pending: true; _localId: string; _questionNumber: number; _questionType: string };
type QuestionListItem = SavedQuestion | SavedQuestionGroup | PendingQuestion;

interface AiRepeatConfirmState {
    action: ExamAiRun['action'];
    run: ExamAiRun;
    resolve: (value: boolean) => void;
}

interface Exam {
    id: number;
    title: string;
    title_cn?: string;
    subject_id?: number;
    subject_name?: string;
    subject_code?: string;
    duration: number;
    total_points: number;
    total_questions: number;
    status: string;
    description?: string;
    allow_download: boolean;
    is_premium?: boolean;
    is_simulated?: boolean;
    solution_video_url?: string;
    solution_description?: string;
    shuffle_mode?: boolean;
    vip_tier?: string;
}

interface ExamAiRun {
    action: 'review_quality' | 'apply_fixes' | 'display_format_fixes' | 'missing_explanations' | 'polish_explanations' | 'normalize_formulas' | string;
    status: string;
    summary?: Record<string, any>;
    run_by?: number | null;
    run_by_name?: string | null;
    created_at: string;
}

interface Subject {
    id: number;
    name: string;
    code: string;
}

type EditMode = 'view' | 'edit';
type AiBlockingTask = 'review' | 'fix' | 'format' | 'normalize' | 'explain' | 'polish' | null;

const EDIT_QUESTION_BATCH_SIZE = 20;

function isSavedGroup(item: QuestionListItem): item is SavedQuestionGroup {
    return '_group' in item;
}

function isPendingQuestion(item: QuestionListItem): item is PendingQuestion {
    return '_pending' in item;
}

function findQuestionItemIndex(items: QuestionListItem[], questionId: number) {
    return items.findIndex(item => {
        if (isPendingQuestion(item)) return false;
        if (isSavedGroup(item)) {
            return item.id === questionId || item.children.some(child => child.id === questionId);
        }
        return item.id === questionId;
    });
}

function getAiReviewLabel(status?: string) {
    if (status === 'ok') return 'AI thấy ổn';
    if (status === 'formula_issue') return 'Nghi lỗi công thức';
    if (status === 'answer_issue') return 'Nghi sai đáp án';
    if (status === 'explanation_issue') return 'Nghi lỗi lời giải';
    return 'Cần kiểm tra';
}

function getAiReviewTone(status?: string) {
    if (status === 'ok') return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/70 dark:bg-emerald-950/70 dark:text-emerald-100';
    if (status === 'failed') return 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-400/70 dark:bg-rose-950/70 dark:text-rose-100';
    if (status === 'requesting') return 'border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-400/70 dark:bg-indigo-950/70 dark:text-indigo-100';
    return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-300/80 dark:bg-amber-950/75 dark:text-amber-50';
}

function getExamReviewIssues(result: StoredExamReviewResult | null) {
    return (result?.reviews || []).filter(review => review.status !== 'ok');
}

function getExamAiRunLabel(action: string) {
    if (action === 'review_quality') return 'AI soát đề';
    if (action === 'apply_fixes') return 'AI sửa log';
    if (action === 'display_format_fixes') return 'AI sửa format hiển thị';
    if (action === 'missing_explanations') return 'AI thêm giải thích';
    if (action === 'polish_explanations') return 'AI chuẩn hóa lời giải';
    if (action === 'normalize_formulas') return 'Chuẩn hóa công thức';
    return action;
}

function formatAiRunTime(value?: string) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

function getExamAiRunDetail(run: ExamAiRun) {
    const summary = run.summary || {};
    if (summary.questionChangedCount) return `${summary.questionChangedCount} câu đã sửa`;
    if (summary.changedCount) return `${summary.changedCount} chỗ đã sửa`;
    if (summary.formulaChangedCount) return `${summary.formulaChangedCount} công thức đã sửa`;
    if (summary.generatedCount) return `${summary.generatedCount} giải thích đã thêm`;
    if (summary.polishedCount) return `${summary.polishedCount} lời giải đã chuẩn hóa`;
    if (summary.issues) return `${summary.issues} lỗi đã phát hiện`;
    if (summary.total) return `${summary.total} câu đã quét`;
    return 'Đã xử lý bằng AI';
}

function ExamAiBlockingOverlay({ task, startedAt }: { task: AiBlockingTask; startedAt: number | null }) {
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        if (!task) return;
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [task]);

    if (!task) return null;

    const elapsedSeconds = Math.max(0, Math.floor((now - (startedAt || now)) / 1000));
    const progress = Math.min(92, 12 + elapsedSeconds * (task === 'fix' ? 1.1 : 1.4));
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    const elapsedText = minutes ? `${minutes}p ${seconds}s` : `${seconds}s`;

    const config = {
        review: {
            title: 'AI đang soát đề',
            subtitle: 'Đang kiểm tra câu hỏi, đáp án, công thức và lời giải.',
            steps: ['Gửi dữ liệu đề', 'AI đọc từng nhóm câu', 'Đối chiếu đáp án và lời giải', 'Tổng hợp log lỗi'],
        },
        fix: {
            title: 'AI đang sửa toàn bộ log',
            subtitle: 'Đang áp dụng lỗi chắc chắn, chuẩn hóa công thức và lưu lại đề.',
            steps: ['Gửi log lỗi', 'AI tạo bản sửa', 'Kiểm tra đáp án và LaTeX', 'Lưu thay đổi vào đề'],
        },
        format: {
            title: 'AI đang sửa format hiển thị',
            subtitle: 'Đang sửa LaTeX/OCR thô trong câu hỏi, đáp án, lời giải nhưng không đổi đáp án đúng.',
            steps: ['Tìm lỗi format', 'AI sửa LaTeX/OCR', 'Giữ nguyên đáp án', 'Lưu vào đề'],
        },
        normalize: {
            title: 'Đang chuẩn hóa công thức',
            subtitle: 'Đang sửa các lỗi LaTeX chắc chắn bằng rule an toàn.',
            steps: ['Đọc câu hỏi', 'Sửa công thức chắc chắn', 'Đánh dấu chỗ nghi lỗi', 'Lưu kết quả'],
        },
        explain: {
            title: 'AI đang thêm giải thích',
            subtitle: 'Đang tìm câu chưa có lời giải, tạo giải thích ngắn vừa đủ và lưu vào DB.',
            steps: ['Đọc câu thiếu giải thích', 'AI tạo lời giải', 'Chuẩn hóa công thức', 'Lưu vào đề'],
        },
        polish: {
            title: 'AI đang chuẩn hóa lời giải',
            subtitle: 'Đang sửa lời giải cũ không dấu, xuống dòng lại cho dễ đọc và lưu vào DB.',
            steps: ['Tìm lời giải không dấu', 'AI thêm dấu tiếng Việt', 'Giữ nguyên công thức', 'Lưu vào đề'],
        },
    }[task];

    const activeIndex = Math.min(config.steps.length - 1, Math.floor(progress / 25));

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm" role="alert" aria-live="assertive" aria-busy="true">
            <div className="w-full max-w-lg rounded-2xl border border-white/20 bg-white p-5 shadow-2xl">
                <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-700">
                        <FiRefreshCw className="animate-spin" size={24} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-lg font-black text-slate-950">{config.title}</p>
                        <p className="mt-1 text-sm font-medium text-slate-600">{config.subtitle}</p>
                        <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Đã chạy {elapsedText}</p>
                    </div>
                </div>

                <div className="mt-5">
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <div className="mt-2 flex justify-between text-xs font-semibold text-slate-500">
                        <span>{Math.round(progress)}%</span>
                        <span>Không thao tác khi đang chạy</span>
                    </div>
                </div>

                <div className="mt-5 space-y-2">
                    {config.steps.map((step, index) => {
                        const done = index < activeIndex;
                        const active = index === activeIndex;
                        return (
                            <div key={step} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${active ? 'bg-indigo-50 text-indigo-900' : done ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-50 text-slate-500'}`}>
                                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${active ? 'bg-indigo-600 text-white' : done ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                    {done ? '✓' : index + 1}
                                </span>
                                <span className="font-semibold">{step}</span>
                            </div>
                        );
                    })}
                </div>

                <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                    Đừng tắt tab. Xong sẽ tự tải lại đề và hiện kết quả.
                </p>
            </div>
        </div>
    );
}

function buildQuestionList(rawQuestions: SavedQuestion[]): QuestionListItem[] {
    const parentTypes = new Set(['reading_passage', 'fill_blank_pool']);
    const childTypes = new Set(['reading_item', 'fill_blank_item']);
    const parents = new Map<number, SavedQuestionGroup>();
    const childIds = new Set<number>();

    for (const q of rawQuestions) {
        if (!parentTypes.has(q.question_type)) continue;
        parents.set(q.id, {
            _group: true,
            id: q.id,
            question_number: q.question_number,
            question_type: q.question_type as SavedQuestionGroup['question_type'],
            passage_text: q.passage_text,
            passage_image_url: q.passage_image_url,
            linked_options: q.linked_options,
            cloze_mode: q.cloze_mode,
            children: [],
        });
    }

    for (const q of rawQuestions) {
        if (!childTypes.has(q.question_type) || !q.passage_group_id) continue;
        const parent = parents.get(q.passage_group_id);
        if (!parent) continue;
        parent.children.push(q);
        childIds.add(q.id);
    }

    const list: QuestionListItem[] = [];
    for (const q of rawQuestions) {
        if (parentTypes.has(q.question_type)) {
            const group = parents.get(q.id);
            if (!group) continue;
            group.children.sort((a, b) => a.question_number - b.question_number || a.id - b.id);
            group.question_number = group.children[0]?.question_number || q.question_number;
            list.push(group);
            continue;
        }

        if (childIds.has(q.id)) continue;
        list.push(q);
    }

    return list.sort((a, b) => {
        const aNum = isPendingQuestion(a) ? a._questionNumber : a.question_number;
        const bNum = isPendingQuestion(b) ? b._questionNumber : b.question_number;
        return aNum - bNum;
    });
}

function groupToReadingData(group: SavedQuestionGroup): ReadingPassageGroupData {
    return {
        _id: String(group.id),
        _localId: `saved-reading-${group.id}`,
        insertPosition: group.question_number,
        passageText: group.passage_text || '',
        passageImageUrl: group.passage_image_url || '',
        subQuestions: group.children.map((q, index) => {
            const answers = (q.answers || []).map(a => ({
                text: a.answer_text || '',
                textCn: a.answer_text_cn || '',
                imageUrl: a.image_url || '',
            }));
            return {
                _localId: `saved-reading-${q.id}`,
                questionText: q.question_text || '',
                questionTextCn: q.question_text_cn || '',
                imageUrl: q.image_url || '',
                points: q.points || 1,
                explanation: q.explanation || '',
                explanationCn: q.explanation_cn || '',
                explanationImageUrl: q.explanation_image_url || '',
                answers: answers.length ? answers : [
                    { text: '', textCn: '', imageUrl: '' },
                    { text: '', textCn: '', imageUrl: '' },
                    { text: '', textCn: '', imageUrl: '' },
                    { text: '', textCn: '', imageUrl: '' },
                ],
                correctAnswer: (q.answers || []).find(a => a.is_correct)?.answer_key || 'A',
                difficulty: q.difficulty || 'medium',
                subQuestionNumber: q.sub_question_number || q.question_number || group.question_number + index,
            };
        }),
    };
}

function groupToFillBlankData(group: SavedQuestionGroup): FillBlankGroupData {
    const linkedOptions = (group.linked_options || group.children[0]?.effective_linked_options || []).map((o: any) => ({
        key: o.key || 'A',
        text: o.text || '',
        textCn: o.textCn || '',
    }));

    return {
        _id: String(group.id),
        _localId: `saved-fill-${group.id}`,
        insertPosition: group.question_number,
        clozeMode: group.cloze_mode || group.children[0]?.effective_cloze_mode || 'sentences',
        passageText: group.passage_text || '',
        passageImageUrl: group.passage_image_url || '',
        linkedOptions,
        subItems: group.children.map((q, index) => ({
            _localId: `saved-fill-item-${q.id}`,
            questionText: q.question_text || '',
            questionTextCn: q.question_text_cn || '',
            points: q.points || 1,
            explanation: q.explanation || '',
            explanationCn: q.explanation_cn || '',
            explanationImageUrl: q.explanation_image_url || '',
            correctAnswerKey: (q.answers || []).find(a => a.is_correct)?.answer_key || 'A',
            difficulty: q.difficulty || 'medium',
            subQuestionNumber: q.sub_question_number || q.question_number || group.question_number + index,
        })),
    };
}

function SavedExamAiReviewPanel({
    result,
    error,
    reviewing,
    normalizingFormulas,
    applyingReviewFixes,
    applyResult,
    onApplySafeFix,
    onApplyAiFixes,
    onOpenQuestion,
}: {
    result: StoredExamReviewResult | null;
    error: string;
    reviewing: boolean;
    normalizingFormulas: boolean;
    applyingReviewFixes: boolean;
    applyResult: ApplyExamReviewFixesResult | null;
    onApplySafeFix: () => void;
    onApplyAiFixes: () => void;
    onOpenQuestion: (review: StoredExamReviewResult['reviews'][number]) => void;
}) {
    if (!result && !error && !reviewing && !applyResult && !applyingReviewFixes) return null;

    const summary = result?.summary;
    const issueRows = getExamReviewIssues(result);
    const safeFix = result?.safeFixPreview;

    return (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                    <p className="font-black text-slate-950 dark:text-white">AI soát đề đã lưu</p>
                    {reviewing ? (
                        <p className="mt-1 flex items-center gap-2 text-indigo-700">
                            <FiRefreshCw className="animate-spin" size={15} />
                            Đang soát câu hỏi, đáp án và lời giải...
                        </p>
                    ) : summary ? (
                        <p className="mt-1 text-slate-600 dark:text-slate-300">
                            {summary.reviewedCount ?? summary.total}/{summary.questionTotal ?? summary.total} câu có review: {summary.ok} ổn, {summary.issues} cần xem.
                            {summary.model ? ` Model: ${summary.model}.` : ''}
                        </p>
                    ) : null}
                    {safeFix && (
                        <p className="mt-1 text-slate-600 dark:text-slate-300">
                            Sửa công thức chắc chắn: {safeFix.changedCount || 0} chỗ. Nghi lỗi cần xem tay: {safeFix.warningCount || 0} chỗ.
                        </p>
                    )}
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                    {issueRows.length > 0 && (
                        <button
                            type="button"
                            onClick={onApplyAiFixes}
                            disabled={applyingReviewFixes}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <FiRefreshCw size={15} className={applyingReviewFixes ? 'animate-spin' : ''} />
                            {applyingReviewFixes ? 'AI đang sửa...' : `AI sửa toàn bộ log (${issueRows.length})`}
                        </button>
                    )}
                    {safeFix && (safeFix.changedCount > 0 || safeFix.warningCount > 0) && (
                        <button
                            type="button"
                            onClick={onApplySafeFix}
                            disabled={normalizingFormulas}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <FiRefreshCw size={15} className={normalizingFormulas ? 'animate-spin' : ''} />
                            {normalizingFormulas ? 'Đang sửa...' : 'Sửa công thức chắc chắn'}
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
                    {error}
                </div>
            )}

            {applyResult && (
                <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
                    {applyResult.message || `AI đã sửa ${applyResult.changedCount || 0} chỗ.`}
                    {!!applyResult.skippedCount && <span> Còn {applyResult.skippedCount} chỗ cần xem tay.</span>}
                </div>
            )}

            {!!result?.diagnostics?.length && (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {result.diagnostics.slice(0, 4).map((log) => (
                        <div key={`${log.batch}-${log.status}-${log.range || ''}`} className={`rounded-lg border px-3 py-2 text-xs ${getAiReviewTone(log.status)}`}>
                            <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
                                <span>Batch {log.batch}: {log.range || 'không rõ câu'}</span>
                                <span>{log.status === 'ok' ? 'Đã gọi AI' : log.status === 'invalid_response' ? 'JSON lỗi' : log.status === 'no_questions' ? 'Không có câu' : 'Lỗi'}</span>
                            </div>
                            <p className="mt-1">Model: {log.model || summary?.model || 'chưa rõ'}{log.durationMs ? ` - ${Math.round(log.durationMs / 1000)}s` : ''}</p>
                            {log.message && <p className="mt-1 whitespace-pre-wrap">{log.message}</p>}
                        </div>
                    ))}
                </div>
            )}

            {issueRows.length > 0 ? (
                <div className="mt-4 space-y-2">
                    {issueRows.map((review) => (
                        <div key={`${review.path}-${review.questionId || ''}`} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950 dark:border-amber-300/80 dark:bg-amber-950/75 dark:text-amber-50">
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2 font-black">
                                        <FiAlertCircle className="shrink-0" size={15} />
                                        <span>{review.label || `Câu ${review.questionNumber || '?'}`}</span>
                                        <span>-</span>
                                        <span>{getAiReviewLabel(review.status)}</span>
                                        {Number.isFinite(review.confidence) && <span>{Math.round((review.confidence || 0) * 100)}%</span>}
                                    </div>
                                    {review.suggestedCorrectAnswer && <p className="mt-1">Gợi ý đáp án: {review.suggestedCorrectAnswer}</p>}
                                    {review.note && <p className="mt-1 whitespace-pre-wrap">{review.note}</p>}
                                    {(review.formulaIssues || []).map((issue, index) => (
                                        <p key={`formula-${index}`} className="mt-1">Công thức: {issue}</p>
                                    ))}
                                    {(review.explanationIssues || []).map((issue, index) => (
                                        <p key={`explanation-${index}`} className="mt-1">Lời giải: {issue}</p>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onOpenQuestion(review)}
                                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 dark:border-amber-300/70 dark:bg-slate-950 dark:text-amber-100 dark:hover:bg-amber-950"
                                >
                                    <FiEdit2 size={13} /> Sửa câu
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : summary && !reviewing ? (
                <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 font-semibold text-emerald-700">
                    AI chưa đánh dấu câu lỗi.
                </p>
            ) : null}
        </div>
    );
}

// Convert saved DB question → QuestionFormData
function dbToFormData(q: SavedQuestion): QuestionFormData {
    const answers = (q.answers || []).map(a => ({
        text: a.answer_text || '',
        textCn: a.answer_text_cn || '',
        imageUrl: a.image_url || '',
    }));

    // Find correct answer key
    const correctAnswer = (q.answers || []).find(a => a.is_correct)?.answer_key || 'A';

    return {
        questionType: (q.question_type as any) || 'single_choice',
        questionText: q.question_text || '',
        questionTextCn: q.question_text_cn || '',
        imageUrl: q.image_url || '',
        passageText: q.effective_passage_text || q.passage_text || '',
        passageImageUrl: q.passage_image_url || '',
        points: q.points || 1,
        explanation: q.explanation || '',
        explanationCn: q.explanation_cn || '',
        explanationImageUrl: q.explanation_image_url || '',
        answers,
        correctAnswer,
        linkedOptions: (q.effective_linked_options || q.linked_options || []).map((o: any) => ({
            key: o.key || 'A',
            text: o.text || '',
            textCn: o.textCn || '',
        })),
        correctAnswerKey: correctAnswer,
        subQuestionNumber: q.sub_question_number || q.question_number || 0,
        difficulty: q.difficulty || 'medium',
    };
}

export default function AdminExamDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const { user, isAuthenticated } = useAuthStore();
    const authPermissionKey = [
        user?.id || '',
        user?.role || '',
        (user?.roles || []).join(','),
        (user?.permissions || []).join(','),
    ].join('|');

    const [exam, setExam] = useState<Exam | null>(null);
    const [aiHistory, setAiHistory] = useState<ExamAiRun[]>([]);
    const [aiRepeatConfirm, setAiRepeatConfirm] = useState<AiRepeatConfirmState | null>(null);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [savedQuestions, setSavedQuestions] = useState<QuestionListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState<EditMode>('view');
    const [editSessionNotice, setEditSessionNotice] = useState('');
    const [savingEditSession, setSavingEditSession] = useState(false);
    const [showEditStartSummary, setShowEditStartSummary] = useState(false);

    // Editing state (local question list while in edit mode)
    const [localQuestions, setLocalQuestions] = useState<QuestionListItem[]>([]);
    const [editVisibleCount, setEditVisibleCount] = useState(EDIT_QUESTION_BATCH_SIZE);
    const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
    const [addingAfterId, setAddingAfterId] = useState<number | null>(null);
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [showAddFillBlank, setShowAddFillBlank] = useState(false);
    const [showAddReadingPassage, setShowAddReadingPassage] = useState(false);
    const [pendingFillBlankGroups, setPendingFillBlankGroups] = useState<FillBlankGroupData[]>([]);
    const [pendingReadingGroups, setPendingReadingGroups] = useState<ReadingPassageGroupData[]>([]);

    // Metadata editing
    const [editingMeta, setEditingMeta] = useState(false);
    const [metaForm, setMetaForm] = useState({
        title: '', titleCn: '', duration: 90,
        subjectId: 0,
        totalPoints: 100, description: '', allow_download: true,
        is_premium: false, shuffle_mode: false, solution_video_url: '',
        solution_description: '', vip_tier: 'basic', is_simulated: false,
    });
    const [metaDirty, setMetaDirty] = useState(false);
    const [savingMeta, setSavingMeta] = useState(false);

    // Video URL
    const [videoUrl, setVideoUrl] = useState('');
    const [solutionDesc, setSolutionDesc] = useState('');

    // Saving states
    const [savingQuestionId, setSavingQuestionId] = useState<number | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [pendingDeleteItem, setPendingDeleteItem] = useState<
        | { type: 'question'; questionId: number }
        | { type: 'group'; group: SavedQuestionGroup }
        | null
    >(null);
    const [deleteItemError, setDeleteItemError] = useState('');
    const [showDeleteExamConfirm, setShowDeleteExamConfirm] = useState(false);
    const [deletingExam, setDeletingExam] = useState(false);
    const [deleteExamError, setDeleteExamError] = useState('');
    const [reordering, setReordering] = useState(false);

    // New question form state (quick add)
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const [quickAddPosition, setQuickAddPosition] = useState<number | null>(null);
    const [pdfImportPreview, setPdfImportPreview] = useState<PdfImportPreview | null>(null);
    const [pdfImportSaving, setPdfImportSaving] = useState(false);
    const [normalizingFormulas, setNormalizingFormulas] = useState(false);
    const [normalizeResult, setNormalizeResult] = useState<NormalizeFormulaResult | null>(null);
    const [reviewingExam, setReviewingExam] = useState(false);
    const [examReviewResult, setExamReviewResult] = useState<StoredExamReviewResult | null>(null);
    const [examReviewError, setExamReviewError] = useState('');
    const [applyingExamReviewFixes, setApplyingExamReviewFixes] = useState(false);
    const [examReviewApplyResult, setExamReviewApplyResult] = useState<ApplyExamReviewFixesResult | null>(null);
    const [applyingDisplayFormatFixes, setApplyingDisplayFormatFixes] = useState(false);
    const [displayFormatApplyResult, setDisplayFormatApplyResult] = useState<ApplyExamReviewFixesResult | null>(null);
    const [generatingMissingExplanations, setGeneratingMissingExplanations] = useState(false);
    const [missingExplanationResult, setMissingExplanationResult] = useState<GenerateMissingExplanationsResult | null>(null);
    const [polishingExplanations, setPolishingExplanations] = useState(false);
    const [polishExplanationResult, setPolishExplanationResult] = useState<GenerateMissingExplanationsResult | null>(null);
    const [aiBlockingTask, setAiBlockingTask] = useState<AiBlockingTask>(null);
    const [aiBlockingStartedAt, setAiBlockingStartedAt] = useState<number | null>(null);

    const isMissingExamError = (error: any) => error?.response?.status === 404;
    const handleMissingExam = () => {
        alert('De thi nay khong con ton tai hoac da bi xoa. Vui long tai lai danh sach de.');
        router.push('/admin/exams');
    };

    useEffect(() => {
        const _token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
        if (!_token) {
            router.push('/');
            return;
        }
        if (isAuthenticated && !hasPermission(user, 'exams.manage')) {
            router.push('/admin');
            return;
        }
        loadExam();
        loadSubjects();
    }, [id, isAuthenticated, authPermissionKey]);

    useEffect(() => {
        if (!aiBlockingTask) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [aiBlockingTask]);

    useEffect(() => {
        if (editMode !== 'edit') return;
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [editMode]);

    const loadSubjects = async () => {
        try {
            const response = await axios.get('/subjects');
            const payload = response?.data?.data ?? response?.data;
            setSubjects(Array.isArray(payload) ? payload : []);
        } catch (error) {
            console.error('Error fetching subjects:', error);
            setSubjects([]);
        }
    };

    const loadExam = async (options: { silent?: boolean } = {}) => {
        try {
            if (!options.silent) setLoading(true);
            const data = await examAdminApi.getExamForEdit(Number(id));
            const visibleQuestions = buildQuestionList(data.questions || []);
            setExam(data.exam);
            setAiHistory(Array.isArray(data.aiHistory) ? data.aiHistory : []);
            setSavedQuestions(visibleQuestions);
            setLocalQuestions(visibleQuestions);
            if (data.exam) {
                setVideoUrl(data.exam.solution_video_url || '');
                setSolutionDesc(data.exam.solution_description || '');
                setMetaForm({
                    title: data.exam.title || '',
                    titleCn: data.exam.title_cn || '',
                    subjectId: data.exam.subject_id || 0,
                    duration: data.exam.duration || 90,
                    totalPoints: data.exam.total_points || 100,
                    description: data.exam.description || '',
                    allow_download: data.exam.allow_download !== false,
                    is_premium: data.exam.is_premium || false,
                    shuffle_mode: data.exam.shuffle_mode || false,
                    solution_video_url: data.exam.solution_video_url || '',
                    solution_description: data.exam.solution_description || '',
                    vip_tier: data.exam.vip_tier || 'basic',
                    is_simulated: data.exam.is_simulated || false,
                });
            }
        } catch (error: any) {
            if (isMissingExamError(error)) {
                handleMissingExam();
                return;
            }
            alert('Không thể tải đề thi: ' + (error.response?.data?.message || error.message));
            router.push('/admin/exams');
        } finally {
            if (!options.silent) setLoading(false);
        }
    };

    const getLatestAiRun = (action: ExamAiRun['action']) =>
        aiHistory.find(run => run.action === action);

    const confirmRepeatAiAction = async (action: ExamAiRun['action']) => {
        const run = getLatestAiRun(action);
        if (!run) return true;
        return new Promise<boolean>((resolve) => {
            setAiRepeatConfirm({ action, run, resolve });
        });
    };

    const closeAiRepeatConfirm = (value: boolean) => {
        aiRepeatConfirm?.resolve(value);
        setAiRepeatConfirm(null);
    };

    // ── Metadata editing ──────────────────────────────────────────────────────
    const handleMetaChange = (key: string, value: any) => {
        setMetaForm(prev => ({ ...prev, [key]: value }));
        setMetaDirty(true);
    };

    const isDownloadAllowedForTier = (vipTier?: string, isPremium?: boolean) =>
        (vipTier || 'basic') === 'basic' && isPremium !== true;

    const handleSaveMeta = async () => {
        if (!exam) return;
        if (!metaForm.subjectId) {
            alert('Vui lòng chọn môn học');
            return;
        }
        try {
            setSavingMeta(true);
            await examAdminApi.updateExam(exam.id, {
                title: metaForm.title,
                titleCn: metaForm.titleCn,
                subjectId: metaForm.subjectId,
                duration: metaForm.duration,
                totalPoints: metaForm.totalPoints,
                description: metaForm.description,
                allow_download: isDownloadAllowedForTier(metaForm.vip_tier, metaForm.is_premium),
                is_premium: metaForm.is_premium,
                shuffle_mode: metaForm.shuffle_mode,
                solution_video_url: metaForm.solution_video_url,
                solution_description: metaForm.solution_description,
                vip_tier: metaForm.vip_tier,
                is_simulated: metaForm.is_simulated,
            });
            const selectedSubject = subjects.find(subject => subject.id === metaForm.subjectId);
            const nextAllowDownload = isDownloadAllowedForTier(metaForm.vip_tier, metaForm.is_premium);
            setExam({ ...exam, title: metaForm.title, duration: metaForm.duration,
                subject_id: metaForm.subjectId, subject_name: selectedSubject?.name || exam.subject_name,
                subject_code: selectedSubject?.code || exam.subject_code, total_points: metaForm.totalPoints, allow_download: nextAllowDownload,
                is_premium: metaForm.is_premium, shuffle_mode: metaForm.shuffle_mode,
                solution_video_url: metaForm.solution_video_url, solution_description: metaForm.solution_description,
                vip_tier: metaForm.vip_tier, is_simulated: metaForm.is_simulated });
            setMetaDirty(false);
            setEditingMeta(false);
            markEditSessionSavedWork('Đã cập nhật thông tin đề và ghi vào hệ thống. Bấm Lưu thay đổi để chốt phiên sửa.');
        } catch (error: any) {
            if (isMissingExamError(error)) {
                handleMissingExam();
                return;
            }
            alert('Lỗi lưu metadata: ' + (error.response?.data?.message || ''));
        } finally {
            setSavingMeta(false);
        }
    };

    // ── Question update ───────────────────────────────────────────────────────
    const handleUpdateQuestion = async (savedQuestionId: number, data: QuestionFormData) => {
        try {
            setSavingQuestionId(savedQuestionId);
            await examAdminApi.updateQuestion(savedQuestionId, {
                questionType: data.questionType,
                questionText: data.questionText,
                questionTextCn: data.questionTextCn,
                imageUrl: data.imageUrl,
                points: data.points,
                explanation: data.explanation,
                explanationCn: data.explanationCn,
                explanationImageUrl: data.explanationImageUrl,
                answers: data.answers,
                correctAnswer: data.correctAnswer,
                passageText: data.passageText,
                passageImageUrl: data.passageImageUrl,
                linkedOptions: data.linkedOptions,
                correctAnswerKey: data.correctAnswerKey,
                subQuestionNumber: data.subQuestionNumber,
                difficulty: data.difficulty,
            });

            // Update local state
            const updated = savedQuestions.map(q =>
                !isPendingQuestion(q) && !isSavedGroup(q) && q.id === savedQuestionId
                    ? {
                        ...q,
                        question_text: data.questionText,
                        question_text_cn: data.questionTextCn,
                        question_type: data.questionType,
                        image_url: data.imageUrl,
                        passage_text: data.passageText,
                        passage_image_url: data.passageImageUrl,
                        points: data.points,
                        explanation: data.explanation,
                        explanation_cn: data.explanationCn,
                        explanation_image_url: data.explanationImageUrl,
                        difficulty: data.difficulty,
                        answers: (data.answers || []).map((a, i) => ({
                            id: q.answers?.[i]?.id || 0,
                            answer_key: String.fromCharCode(65 + i),
                            answer_text: a.text,
                            answer_text_cn: a.textCn,
                            image_url: a.imageUrl,
                            is_correct: String.fromCharCode(65 + i) === data.correctAnswer,
                        })),
                    }
                    : q
            );
            setSavedQuestions(updated);
            setLocalQuestions(updated);
            setEditingQuestionId(null);
            markEditSessionSavedWork('Đã cập nhật câu hỏi và ghi vào hệ thống. Bấm Lưu thay đổi để chốt phiên sửa.');
            alert('Đã cập nhật câu hỏi!');
        } catch (error: any) {
            if (isMissingExamError(error)) {
                handleMissingExam();
                return;
            }
            alert('Lỗi cập nhật: ' + (error.response?.data?.message || ''));
        } finally {
            setSavingQuestionId(null);
        }
    };

    // ── Add question (insert at position) ─────────────────────────────────────
    const handleInsertQuestion = async (data: QuestionFormData, afterQuestionId?: number, atPosition?: number) => {
        if (!exam) return;
        try {
            setSavingQuestionId(-1); // -1 = adding
            const res = await examAdminApi.insertQuestion(exam.id, data as any, afterQuestionId, atPosition);
            await loadExam();
            setShowQuickAdd(false);
            setQuickAddPosition(null);
            setAddingAfterId(null);
            setShowAddMenu(false);
            markEditSessionSavedWork('Đã thêm câu hỏi và ghi vào hệ thống. Bấm Lưu thay đổi để chốt phiên sửa.');
            alert('Đã thêm câu hỏi!');
        } catch (error: any) {
            if (isMissingExamError(error)) {
                handleMissingExam();
                return;
            }
            alert('Lỗi thêm câu hỏi: ' + (error.response?.data?.message || ''));
        } finally {
            setSavingQuestionId(null);
        }
    };

    // ── Quick add new question ────────────────────────────────────────────────
    const handleQuickAddSave = async (data: QuestionFormData) => {
        if (!exam) return;
        try {
            setSavingQuestionId(-1);

            if (data.questionType === 'reading_passage') {
                // Reading passage: save via the group API (appends at end)
                const passageRes = await examAdminApi.addQuestion(exam.id, {
                    questionType: 'reading_passage',
                    questionText: '',
                    questionTextCn: '',
                    passageText: data.passageText,
                    passageImageUrl: data.passageImageUrl,
                    points: 0,
                    difficulty: 'medium',
                });
                const passageGroupId = passageRes.passageGroupId || passageRes.questionId;
                // Load exam to get the group ID, then save sub-questions
                await loadExam();
                alert('Đã thêm đoạn đọc hiểu!');
            } else if (data.questionType === 'fill_blank_pool') {
                alert('Hãy dùng nút "Điền từ" để tạo nhóm câu rời/đoạn văn có đáp án con.');
                return;
            } else {
                // Single choice / trắc nghiệm: insert at correct position
                const afterId = addingAfterId;
                const atPos = quickAddPosition;
                await handleInsertQuestion(data, afterId ?? undefined, atPos ?? undefined);
                // handleInsertQuestion calls loadExam internally
            }

            setLocalQuestions(prev => prev.filter(q => !('_pending' in q)));
            setAddingAfterId(null);
            setQuickAddPosition(null);
        } catch (error: any) {
            if (isMissingExamError(error)) {
                handleMissingExam();
                return;
            }
            alert('Lỗi: ' + (error.response?.data?.message || error.message));
        } finally {
            setSavingQuestionId(null);
        }
    };

    // ── Add fill blank group ──────────────────────────────────────────────────
    const handlePdfImportPreviewLoaded = (preview: PdfImportPreview) => {
        setPdfImportPreview(preview);
    };

    const savePdfImportedQuestions = async (itemsOverride?: ImportedExamItem[]) => {
        const importItems = itemsOverride?.length ? itemsOverride : getImportPreviewItems(pdfImportPreview);
        if (!exam?.id || !importItems.length) return;

        const validationError = validateImportedItems(importItems);
        if (validationError) {
            alert(validationError);
            return;
        }

        try {
            setPdfImportSaving(true);
            const response = await examAdminApi.bulkImportQuestions(exam.id, importItems);
            await loadExam({ silent: true });
            setPdfImportPreview(null);
            setShowQuickAdd(false);
            setAddingAfterId(null);
            setQuickAddPosition(null);
            markEditSessionSavedWork('Đã import câu hỏi và ghi vào hệ thống. Bấm Lưu thay đổi để chốt phiên sửa.');
            alert(`Da import ${response?.insertedCount || getImportItemsQuestionCount(importItems)} cau vao de`);
        } catch (error: any) {
            if (isMissingExamError(error)) {
                handleMissingExam();
                return;
            }
            alert(error?.response?.data?.message || 'Luu cau hoi import that bai');
        } finally {
            setPdfImportSaving(false);
        }
    };

    const handleNormalizeCurrentExam = async () => {
        if (!exam?.id || normalizingFormulas) return;
        if (!(await confirmRepeatAiAction('normalize_formulas'))) return;
        try {
            setNormalizingFormulas(true);
            setAiBlockingTask('normalize');
            setAiBlockingStartedAt(Date.now());
            setNormalizeResult(null);
            const result = await examAdminApi.normalizeExamFormulas(exam.id);
            setNormalizeResult(result);
            await loadExam({ silent: true });
            markEditSessionSavedWork('Đã chuẩn hóa công thức và ghi vào hệ thống. Bấm Lưu thay đổi để chốt phiên sửa.');
        } catch (error: any) {
            alert(error?.response?.data?.message || 'Chuẩn hóa công thức thất bại');
        } finally {
            setNormalizingFormulas(false);
            setAiBlockingTask(null);
            setAiBlockingStartedAt(null);
        }
    };

    const handleReviewCurrentExam = async () => {
        if (!exam?.id || reviewingExam) return;
        if (!(await confirmRepeatAiAction('review_quality'))) return;
        try {
            setReviewingExam(true);
            setAiBlockingTask('review');
            setAiBlockingStartedAt(Date.now());
            setExamReviewError('');
            setExamReviewResult(null);
            setExamReviewApplyResult(null);
            const result = await examAdminApi.reviewExamQuality(exam.id);
            setExamReviewResult(result);
            await loadExam({ silent: true });
        } catch (error: any) {
            const retryText = error?.response?.data?.retryAfter
                ? ` Thử lại sau ${error.response.data.retryAfter}s.`
                : '';
            setExamReviewError((error?.response?.data?.message || 'AI soát đề thất bại.') + retryText);
        } finally {
            setReviewingExam(false);
            setAiBlockingTask(null);
            setAiBlockingStartedAt(null);
        }
    };

    const handleApplyExamReviewFixes = async () => {
        if (!exam?.id || applyingExamReviewFixes) return;
        if (!examReviewResult) {
            setExamReviewError('Bạn cần bấm AI soát đề trước, rồi mới dùng AI sửa toàn bộ log.');
            return;
        }
        const reviews = getExamReviewIssues(examReviewResult);
        if (!reviews.length) {
            setExamReviewError('AI soát đề chưa tìm thấy lỗi cần sửa.');
            return;
        }
        if (!(await confirmRepeatAiAction('apply_fixes'))) return;
        if (!confirm('Cho AI sửa toàn bộ log lỗi của đề này? Hệ thống sẽ ghi trực tiếp vào đề, bạn nên xem lại sau khi sửa.')) return;

        try {
            setApplyingExamReviewFixes(true);
            setAiBlockingTask('fix');
            setAiBlockingStartedAt(Date.now());
            setExamReviewError('');
            setExamReviewApplyResult(null);
            const result = await examAdminApi.applyExamReviewFixes(exam.id, {
                reviews,
                applySafeFormulas: true,
                applySuggestedAnswers: true,
            });
            setExamReviewApplyResult(result);
            setExamReviewResult(null);
            await loadExam({ silent: true });
            markEditSessionSavedWork('AI đã sửa log lỗi và ghi vào hệ thống. Bấm Lưu thay đổi để chốt phiên sửa.');
        } catch (error: any) {
            const retryText = error?.response?.data?.retryAfter
                ? ` Thử lại sau ${error.response.data.retryAfter}s.`
                : '';
            setExamReviewError((error?.response?.data?.message || 'AI sửa lỗi đề thất bại.') + retryText);
        } finally {
            setApplyingExamReviewFixes(false);
            setAiBlockingTask(null);
            setAiBlockingStartedAt(null);
        }
    };

    const handleApplyDisplayFormatFixes = async () => {
        if (!exam?.id || applyingDisplayFormatFixes) return;
        if (!(await confirmRepeatAiAction('display_format_fixes'))) return;
        if (!confirm('Cho AI sửa lỗi format hiển thị? Hệ thống chỉ sửa text/LaTeX/OCR, không đổi đáp án đúng và lưu trực tiếp vào DB.')) return;

        try {
            setApplyingDisplayFormatFixes(true);
            setAiBlockingTask('format');
            setAiBlockingStartedAt(Date.now());
            setExamReviewError('');
            setDisplayFormatApplyResult(null);
            const result = await examAdminApi.applyDisplayFormatFixes(exam.id);
            setDisplayFormatApplyResult(result);
            await loadExam({ silent: true });
            markEditSessionSavedWork('AI đã sửa format hiển thị và ghi vào hệ thống. Bấm Lưu thay đổi để chốt phiên sửa.');
        } catch (error: any) {
            const retryText = error?.response?.data?.retryAfter
                ? ` Thử lại sau ${error.response.data.retryAfter}s.`
                : '';
            setExamReviewError((error?.response?.data?.message || 'AI sửa format hiển thị thất bại.') + retryText);
        } finally {
            setApplyingDisplayFormatFixes(false);
            setAiBlockingTask(null);
            setAiBlockingStartedAt(null);
        }
    };

    const handleGenerateMissingExplanations = async () => {
        if (!exam?.id || generatingMissingExplanations) return;
        if (!(await confirmRepeatAiAction('missing_explanations'))) return;
        if (!confirm('Cho AI thêm giải thích cho các câu đang trống? Hệ thống chỉ điền ô chưa có giải thích và lưu trực tiếp vào DB.')) return;

        try {
            setGeneratingMissingExplanations(true);
            setAiBlockingTask('explain');
            setAiBlockingStartedAt(Date.now());
            setMissingExplanationResult(null);
            const result = await examAdminApi.generateMissingExplanations(exam.id);
            setMissingExplanationResult(result);
            await loadExam();
            markEditSessionSavedWork('AI đã thêm giải thích và ghi vào hệ thống. Bấm Lưu thay đổi để chốt phiên sửa.');
        } catch (error: any) {
            const retryText = error?.response?.data?.retryAfter
                ? ` Thử lại sau ${error.response.data.retryAfter}s.`
                : '';
            alert((error?.response?.data?.message || 'AI thêm giải thích thất bại.') + retryText);
        } finally {
            setGeneratingMissingExplanations(false);
            setAiBlockingTask(null);
            setAiBlockingStartedAt(null);
        }
    };

    const handlePolishExplanations = async () => {
        if (!exam?.id || polishingExplanations) return;
        if (!(await confirmRepeatAiAction('polish_explanations'))) return;
        if (!confirm('Cho AI chuẩn hóa các lời giải cũ không dấu? Hệ thống chỉ sửa ô giải thích và lưu trực tiếp vào DB.')) return;

        try {
            setPolishingExplanations(true);
            setAiBlockingTask('polish');
            setAiBlockingStartedAt(Date.now());
            setPolishExplanationResult(null);
            const result = await examAdminApi.polishExplanations(exam.id);
            setPolishExplanationResult(result);
            await loadExam({ silent: true });
            markEditSessionSavedWork('AI đã chuẩn hóa lời giải và ghi vào hệ thống. Bấm Lưu thay đổi để chốt phiên sửa.');
        } catch (error: any) {
            const retryText = error?.response?.data?.retryAfter
                ? ` Thử lại sau ${error.response.data.retryAfter}s.`
                : '';
            alert((error?.response?.data?.message || 'AI chuẩn hóa lời giải thất bại.') + retryText);
        } finally {
            setPolishingExplanations(false);
            setAiBlockingTask(null);
            setAiBlockingStartedAt(null);
        }
    };

    const handleOpenReviewQuestion = (review: StoredExamReviewResult['reviews'][number]) => {
        const targetQuestionId = review.parentQuestionId || review.questionId;
        if (!targetQuestionId) return;

        if (editMode !== 'edit') {
            setEditMode('edit');
            setLocalQuestions([...savedQuestions]);
            setEditVisibleCount(EDIT_QUESTION_BATCH_SIZE);
        }
        if (!review.parentQuestionId && review.questionId) {
            setEditingQuestionId(review.questionId);
        }
        const targetIndex = findQuestionItemIndex(savedQuestions, targetQuestionId);
        if (targetIndex >= 0) {
            setEditVisibleCount(prev => Math.max(prev, targetIndex + 1));
        }

        window.setTimeout(() => {
            document.getElementById(`question-${targetQuestionId}`)?.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
        }, 80);
    };

    const handleAddFillBlankGroup = async (data: FillBlankGroupData) => {
        if (!exam) return;
        try {
            setSavingQuestionId(-1);
            await examAdminApi.insertFillBlankGroup(exam.id, {
                ...data,
                insertPosition: data.insertPosition || quickAddPosition || undefined,
            } as any);
            await loadExam();
            setPendingFillBlankGroups(prev => prev.filter(g => g._localId !== data._localId));
            if (pendingFillBlankGroups.length === 1) setShowAddFillBlank(false);
            markEditSessionSavedWork('Đã thêm nhóm điền từ và ghi vào hệ thống. Bấm Lưu thay đổi để chốt phiên sửa.');
            alert('Đã thêm nhóm điền từ!');
        } catch (error: any) {
            if (isMissingExamError(error)) {
                handleMissingExam();
                return;
            }
            alert('Lỗi thêm nhóm điền từ: ' + (error.response?.data?.message || error.message));
        } finally {
            setSavingQuestionId(null);
        }
    };

    // ── Add reading passage group ──────────────────────────────────────────────
    const handleAddReadingPassageGroup = async (data: ReadingPassageGroupData) => {
        if (!exam) return;
        try {
            setSavingQuestionId(-1);
            await examAdminApi.insertReadingPassageGroup(exam.id, {
                ...data,
                insertPosition: data.insertPosition || quickAddPosition || undefined,
            } as any);
            await loadExam();
            setPendingReadingGroups(prev => prev.filter(g => g._localId !== data._localId));
            if (pendingReadingGroups.length === 1) setShowAddReadingPassage(false);
            markEditSessionSavedWork('Đã thêm nhóm đọc hiểu và ghi vào hệ thống. Bấm Lưu thay đổi để chốt phiên sửa.');
            alert('Đã thêm nhóm đọc hiểu!');
        } catch (error: any) {
            if (isMissingExamError(error)) {
                handleMissingExam();
                return;
            }
            alert('Lỗi thêm nhóm đọc hiểu: ' + (error.response?.data?.message || error.message));
        } finally {
            setSavingQuestionId(null);
        }
    };

    // ── Delete question ────────────────────────────────────────────────────────
    const handleUpdateFillBlankGroup = async (groupId: number, data: FillBlankGroupData) => {
        if (!exam) return;
        try {
            setSavingQuestionId(groupId);
            await examAdminApi.updateFillBlankGroup(exam.id, groupId, data as any);
            await loadExam();
            markEditSessionSavedWork('Đã cập nhật nhóm điền từ và ghi vào hệ thống. Bấm Lưu thay đổi để chốt phiên sửa.');
            alert('Đã cập nhật nhóm điền từ!');
        } catch (error: any) {
            if (isMissingExamError(error)) {
                handleMissingExam();
                return;
            }
            alert('Lỗi cập nhật nhóm điền từ: ' + (error.response?.data?.message || error.message));
        } finally {
            setSavingQuestionId(null);
        }
    };

    const handleUpdateReadingPassageGroup = async (groupId: number, data: ReadingPassageGroupData) => {
        if (!exam) return;
        try {
            setSavingQuestionId(groupId);
            await examAdminApi.updateReadingPassageGroup(exam.id, groupId, data as any);
            await loadExam();
            markEditSessionSavedWork('Đã cập nhật nhóm đọc hiểu và ghi vào hệ thống. Bấm Lưu thay đổi để chốt phiên sửa.');
            alert('Đã cập nhật nhóm đọc hiểu!');
        } catch (error: any) {
            if (isMissingExamError(error)) {
                handleMissingExam();
                return;
            }
            alert('Lỗi cập nhật nhóm đọc hiểu: ' + (error.response?.data?.message || error.message));
        } finally {
            setSavingQuestionId(null);
        }
    };

    const handleDeleteGroup = (group: SavedQuestionGroup) => {
        setDeleteItemError('');
        setPendingDeleteItem({ type: 'group', group });
    };

    const handleDeleteQuestion = (questionId: number) => {
        setDeleteItemError('');
        setPendingDeleteItem({ type: 'question', questionId });
    };

    const confirmDeleteItem = async () => {
        if (!pendingDeleteItem || deletingId !== null) return;

        try {
            setDeleteItemError('');

            if (pendingDeleteItem.type === 'group') {
                if (!exam) return;

                const group = pendingDeleteItem.group;
                setDeletingId(group.id);
                if (group.question_type === 'fill_blank_pool') {
                    await examAdminApi.deleteFillBlankGroup(exam.id, group.id);
                } else {
                    await examAdminApi.deleteReadingPassageGroup(exam.id, group.id);
                }
                await loadExam();
            } else {
                const questionId = pendingDeleteItem.questionId;
                setDeletingId(questionId);
                await examAdminApi.deleteQuestion(questionId);
                await loadExam();
            }

            setPendingDeleteItem(null);
            markEditSessionSavedWork('Đã xóa mục khỏi đề và ghi vào hệ thống. Bấm Lưu thay đổi để chốt phiên sửa.');
        } catch (error: any) {
            setDeleteItemError(error.response?.data?.message || error.message || 'Xóa thất bại.');
        } finally {
            setDeletingId(null);
        }
    };

    const [showConfirmExit, setShowConfirmExit] = useState(false);
    const [navigateAfterExit, setNavigateAfterExit] = useState(false);

    // ── Toggle edit mode ──────────────────────────────────────────────────────
    const enterEditMode = () => {
        setEditMode('edit');
        setEditSessionNotice('');
        setLocalQuestions([...savedQuestions]);
        setEditVisibleCount(EDIT_QUESTION_BATCH_SIZE);
    };

    const handleOpenEditMode = () => {
        if (aiHistory.length > 0) {
            setShowEditStartSummary(true);
            return;
        }
        enterEditMode();
    };

    const handleContinueToEditMode = () => {
        setShowEditStartSummary(false);
        enterEditMode();
    };

    const markEditSessionSavedWork = (message: string) => {
        setEditSessionNotice(message);
    };

    const handleSaveEditSession = async () => {
        try {
            setSavingEditSession(true);
            setEditMode('view');
            setEditingQuestionId(null);
            setShowQuickAdd(false);
            setShowAddMenu(false);
            setAddingAfterId(null);
            setQuickAddPosition(null);
            setEditSessionNotice('');
            await loadExam({ silent: true });
        } finally {
            setSavingEditSession(false);
        }
    };

    const exitEditMode = () => {
        setNavigateAfterExit(false);
        setShowConfirmExit(true);
    };

    const handleConfirmExit = async () => {
        const shouldNavigate = navigateAfterExit;
        try {
            setSavingEditSession(true);
            setEditMode('view');
            setLocalQuestions([...savedQuestions]);
            setEditVisibleCount(EDIT_QUESTION_BATCH_SIZE);
            setEditingQuestionId(null);
            setEditingMeta(false);
            setMetaDirty(false);
            setShowQuickAdd(false);
            setShowAddMenu(false);
            setAddingAfterId(null);
            setQuickAddPosition(null);
            setPendingFillBlankGroups([]);
            setPendingReadingGroups([]);
            setEditSessionNotice('');
            setShowConfirmExit(false);
            setNavigateAfterExit(false);
            await loadExam({ silent: true });
            if (shouldNavigate) {
                router.push('/admin/exams');
            }
        } finally {
            setSavingEditSession(false);
        }
    };

    const closeConfirmExit = () => {
        setShowConfirmExit(false);
        setNavigateAfterExit(false);
    };

    const handleBackToExams = () => {
        if (editMode === 'edit') {
            setNavigateAfterExit(true);
            setShowConfirmExit(true);
            return;
        }

        router.push('/admin/exams');
    };

    // ── Toggle exam settings ──────────────────────────────────────────────────
    const handleStatusChange = async (status: 'draft' | 'published' | 'archived') => {
        try {
            await examAdminApi.updateExamStatus(Number(id), status);
            if (exam) setExam({ ...exam, status });
        } catch {
            alert('Lỗi đổi trạng thái');
        }
    };

    const openDeleteExamConfirm = () => {
        setDeleteExamError('');
        setShowDeleteExamConfirm(true);
    };

    const confirmDeleteExam = async () => {
        if (deletingExam) return;

        try {
            setDeletingExam(true);
            setDeleteExamError('');
            await examAdminApi.deleteExam(Number(id));
            setShowDeleteExamConfirm(false);
            router.push('/admin/exams');
        } catch (error: any) {
            setDeleteExamError(error.response?.data?.message || 'Xóa đề thi thất bại.');
        } finally {
            setDeletingExam(false);
        }
    };

    const handleToggleDownload = async () => {
        if (!exam) return;
        try {
            const newVal = isDownloadAllowedForTier(exam.vip_tier, exam.is_premium);
            await examAdminApi.updateExam(Number(id), { allow_download: newVal });
            setExam({ ...exam, allow_download: newVal });
        } catch {
            alert('Lỗi cập nhật quyền tải');
        }
    };

    const handleSaveVideo = async () => {
        if (!exam) return;
        try {
            await examAdminApi.updateExam(Number(id), {
                solution_video_url: videoUrl, solution_description: solutionDesc,
            });
            setExam({ ...exam, solution_video_url: videoUrl, solution_description: solutionDesc });
        } catch {
            alert('Lỗi lưu video');
        }
    };

    const handleToggleShuffle = async () => {
        if (!exam) return;
        try {
            const newVal = !exam.shuffle_mode;
            await examAdminApi.updateExam(Number(id), { shuffle_mode: newVal });
            setExam({ ...exam, shuffle_mode: newVal });
        } catch {
            alert('Lỗi cập nhật shuffle');
        }
    };

    const handleToggleSimulated = async () => {
        if (!exam) return;
        try {
            const newVal = !exam.is_simulated;
            await examAdminApi.updateExam(Number(id), { is_simulated: newVal });
            setExam({ ...exam, is_simulated: newVal });
        } catch {
            alert('Lỗi cập nhật đề mô phỏng');
        }
    };

    const handleTogglePremium = async () => {
        if (!exam) return;
        try {
            const newVal = !exam.is_premium;
            const nextTier = newVal ? 'vip' : 'basic';
            await examAdminApi.updateExam(Number(id), { is_premium: newVal, vip_tier: nextTier });
            setExam({ ...exam, is_premium: newVal, vip_tier: nextTier, allow_download: isDownloadAllowedForTier(nextTier, newVal) });
        } catch {
            alert('Lỗi cập nhật trạng thái VIP');
        }
    };

    const handleSetVipTier = async (tier: string) => {
        if (!exam) return;
        try {
            const nextPremium = tier !== 'basic';
            await examAdminApi.updateExam(Number(id), { vip_tier: tier, is_premium: nextPremium });
            setExam({ ...exam, vip_tier: tier, is_premium: nextPremium, allow_download: isDownloadAllowedForTier(tier, nextPremium) });
        } catch {
            alert('Lỗi cập nhật phân loại VIP');
        }
    };

    const handleSetVipTierMeta = (tier: string) => {
        const nextPremium = tier !== 'basic';
        setMetaForm(prev => ({ ...prev, vip_tier: tier, is_premium: nextPremium, allow_download: isDownloadAllowedForTier(tier, nextPremium) }));
        setMetaDirty(true);
    };

    useEffect(() => {
        if (exam) {
            setVideoUrl(exam.solution_video_url || '');
            setSolutionDesc(exam.solution_description || '');
        }
    }, [exam]);

    // ── Render ─────────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
            </div>
        );
    }

    if (!exam) return null;

    const statusColor = exam.status === 'published'
        ? 'bg-green-100 text-green-800 border-green-200'
        : exam.status === 'draft'
            ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
            : 'bg-gray-100 text-gray-700 border-gray-200';

    const isEditingExam = editMode === 'edit';
    const questions = isEditingExam ? localQuestions : savedQuestions;
    const visibleQuestions = isEditingExam ? questions.slice(0, editVisibleCount) : questions;
    const hiddenQuestionCount = isEditingExam ? Math.max(questions.length - visibleQuestions.length, 0) : 0;
    const pdfPreviewItems = getImportPreviewItems(pdfImportPreview);

    // Compute the next question number by finding the max in localQuestions
    // (savedQuestions have real numbers from DB, pending groups track their own)
    const getNextQuestionNum = (): number => {
        let max = 0;
        for (const q of localQuestions) {
            if ('_pending' in q) {
                if (q._questionType === 'reading_passage' || q._questionType === 'fill_blank_pool') {
                    max = Math.max(max, q._questionNumber);
                } else {
                    max = Math.max(max, q._questionNumber);
                }
            } else if (isSavedGroup(q)) {
                max = Math.max(max, q.children[q.children.length - 1]?.question_number || q.question_number);
            } else {
                max = Math.max(max, q.question_number);
            }
        }
        return max + 1;
    };

    // Estimate how many question slots a pending reading/fill group takes (display only)
    const getPendingGroupSlots = (q: { _pending: true; _questionType: string }): number => {
        return (q._questionType === 'reading_passage' || q._questionType === 'fill_blank_pool') ? 10 : 1;
    };

    const repeatSummary = aiRepeatConfirm?.run.summary || {};
    const repeatDetail = repeatSummary.questionChangedCount
        ? `${repeatSummary.questionChangedCount} câu đã bị ảnh hưởng`
        : repeatSummary.changedCount
            ? `${repeatSummary.changedCount} chỗ đã được sửa`
            : repeatSummary.issues
                ? `${repeatSummary.issues} lỗi đã được phát hiện`
                : repeatSummary.total
                    ? `${repeatSummary.total} câu đã được quét`
                    : 'Đề này đã được xử lý bằng AI trước đó';

    return (
        <div className="min-h-screen bg-gray-50">
            <ExamAiBlockingOverlay task={aiBlockingTask} startedAt={aiBlockingStartedAt} />
            {aiRepeatConfirm && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/65 px-4 backdrop-blur-sm" role="dialog" aria-modal="true">
                    <div className="w-full max-w-md rounded-2xl border border-white/20 bg-white p-5 shadow-2xl">
                        <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                                <FiAlertCircle size={24} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-lg font-black text-slate-950">{getExamAiRunLabel(aiRepeatConfirm.action)} đã chạy</p>
                                <p className="mt-1 text-sm font-medium leading-6 text-slate-600">
                                    Lúc {formatAiRunTime(aiRepeatConfirm.run.created_at)}
                                    {aiRepeatConfirm.run.run_by_name ? ` bởi ${aiRepeatConfirm.run.run_by_name}` : ''}.
                                    {' '}{repeatDetail}.
                                </p>
                                {repeatSummary.model && (
                                    <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                                        Model: {repeatSummary.model}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
                            Chạy lại có thể tốn thêm token. Chỉ chạy lại khi bạn muốn AI kiểm tra/sửa lại từ đầu.
                        </div>
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => closeAiRepeatConfirm(false)}
                                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={() => closeAiRepeatConfirm(true)}
                                className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-violet-700"
                            >
                                Vẫn chạy lại
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showEditStartSummary && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/65 px-4 backdrop-blur-sm" role="dialog" aria-modal="true">
                    <div className="w-full max-w-2xl rounded-2xl border border-white/20 bg-white p-5 shadow-2xl">
                        <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                                <FiAlertCircle size={24} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-lg font-black text-slate-950">Đề này đã có AI xử lý trước đó</p>
                                <p className="mt-1 text-sm font-medium leading-6 text-slate-600">
                                    Xem nhanh AI đã soát/sửa gì trước khi vào sửa đề, tránh sửa lại trùng hoặc chạy lại tốn token.
                                </p>
                            </div>
                        </div>

                        <div className="mt-5 max-h-[52vh] space-y-3 overflow-auto pr-1">
                            {aiHistory.slice(0, 8).map((run) => {
                                const summary = run.summary || {};
                                return (
                                    <div key={`edit-start-${run.action}-${run.created_at}`} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <span className="font-black text-slate-900">{getExamAiRunLabel(run.action)}</span>
                                            <span className="text-xs font-bold text-slate-500">{formatAiRunTime(run.created_at)}</span>
                                        </div>
                                        <p className="mt-1 text-sm font-semibold text-slate-700">
                                            {getExamAiRunDetail(run)}
                                            {run.run_by_name ? ` · ${run.run_by_name}` : ''}
                                            {summary.model ? ` · ${summary.model}` : ''}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                            Bấm “Vào sửa đề” để mở editor. Bảng này chỉ là lịch sử, không tự chạy AI mới.
                        </div>

                        <div className="mt-5 flex flex-wrap justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setShowEditStartSummary(false)}
                                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                            >
                                Để lát nữa
                            </button>
                            <button
                                type="button"
                                onClick={handleContinueToEditMode}
                                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
                            >
                                Vào sửa đề
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                <div className="w-full px-4 py-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleBackToExams}
                                className="text-gray-500 hover:text-gray-800 transition-colors"
                            >
                                <FiChevronLeft size={22} />
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">{exam.title}</h1>
                                <p className="text-sm text-gray-500">
                                    {exam.subject_name} • {exam.duration} phút • {exam.total_questions} câu
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {isEditingExam ? (
                                <>
                                    <button
                                        onClick={exitEditMode}
                                        disabled={savingEditSession || !!aiBlockingTask}
                                        className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        Không muốn sửa nữa
                                    </button>
                                    <button
                                        onClick={handleSaveEditSession}
                                        disabled={savingEditSession || !!aiBlockingTask}
                                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        <FiSave size={16} /> {savingEditSession ? 'Đang lưu...' : 'Lưu thay đổi'}
                                    </button>
                                    <button
                                        onClick={exitEditMode}
                                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                                    >
                                        <FiX size={16} /> Thoát sửa
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={() => router.push(`/admin/exams/${exam.id}/official`)}
                                        className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors text-sm font-medium"
                                    >
                                        <FiMonitor size={16} /> Thi chính thức
                                    </button>
                                    <button
                                        onClick={handleOpenEditMode}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                                    >
                                        <FiEdit2 size={16} /> Sửa đề
                                    </button>
                                    <select
                                        value={exam.status}
                                        onChange={e => handleStatusChange(e.target.value as any)}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-semibold border cursor-pointer outline-none ${statusColor}`}
                                    >
                                        <option value="draft">🔒 Đang ẩn (Nháp)</option>
                                        <option value="published">👁️ Đang hiển thị</option>
                                        <option value="archived">📦 Lưu trữ</option>
                                    </select>
                                    <button
                                        onClick={openDeleteExamConfirm}
                                        disabled={deletingExam}
                                        className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        <FiTrash2 size={16} /> Xóa đề
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <main className="w-full px-4 py-6 sm:px-6 lg:px-8">

                {isEditingExam && editSessionNotice && (
                    <div className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 shadow-sm md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="font-black">Có thay đổi trong phiên sửa đề</p>
                            <p className="mt-1">{editSessionNotice}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={exitEditMode}
                                disabled={savingEditSession || !!aiBlockingTask}
                                className="rounded-lg border border-amber-300 bg-white px-4 py-2 font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Không muốn sửa nữa
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveEditSession}
                                disabled={savingEditSession || !!aiBlockingTask}
                                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <FiSave size={15} /> {savingEditSession ? 'Đang lưu...' : 'Lưu thay đổi'}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── EDIT MODE: Metadata Form ── */}
                {isEditingExam && (
                    <div className="bg-white rounded-xl border border-blue-200 p-6 mb-6 shadow-md">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-gray-900">Chỉnh sửa thông tin đề thi</h2>
                            {!editingMeta && (
                                <button
                                    onClick={() => setEditingMeta(true)}
                                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                >
                                    ✏️ Chỉnh sửa
                                </button>
                            )}
                        </div>

                        {editingMeta ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Tên đề thi</label>
                                        <input type="text" value={metaForm.title}
                                            onChange={e => handleMetaChange('title', e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Tên đề (Tiếng Trung)</label>
                                        <input type="text" value={metaForm.titleCn}
                                            onChange={e => handleMetaChange('titleCn', e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Môn học</label>
                                        <select
                                            value={metaForm.subjectId}
                                            onChange={e => handleMetaChange('subjectId', parseInt(e.target.value))}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                                        >
                                            <option value={0}>Chọn môn học...</option>
                                            {subjects.map(subject => (
                                                <option key={subject.id} value={subject.id}>{subject.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Thời gian (phút)</label>
                                        <input type="number" value={metaForm.duration}
                                            onChange={e => handleMetaChange('duration', parseInt(e.target.value))}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Tổng điểm</label>
                                        <input type="number" value={metaForm.totalPoints}
                                            onChange={e => handleMetaChange('totalPoints', parseFloat(e.target.value))}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm" />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                                        <textarea value={metaForm.description}
                                            onChange={e => handleMetaChange('description', e.target.value)}
                                            rows={2}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm" />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Video Giải Đề</label>
                                        <input type="url" value={metaForm.solution_video_url}
                                            onChange={e => handleMetaChange('solution_video_url', e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
                                            placeholder="https://youtube.com/..." />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Mô Tả Video</label>
                                        <input type="text" value={metaForm.solution_description}
                                            onChange={e => handleMetaChange('solution_description', e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm" />
                                    </div>

                                    {/* VIP Tier */}
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Phân loại nội dung</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {[
                                                { value: 'basic', label: 'Miễn phí', desc: 'Mọi người đều xem được', color: 'gray' },
                                                { value: 'vip', label: 'VIP', desc: 'Gói VIP & Premium', color: 'blue' },
                                            ].map(tier => (
                                                <button key={tier.value}
                                                    onClick={() => handleSetVipTierMeta(tier.value)}
                                                    className={`relative p-2.5 rounded-xl border-2 text-center transition-all ${
                                                        metaForm.vip_tier === tier.value
                                                            ? tier.color === 'blue' ? 'border-blue-500 bg-blue-50' : 'border-gray-500 bg-gray-100'
                                                            : 'border-gray-200 hover:border-gray-300 bg-white'
                                                    }`}>
                                                    <p className={`text-xs font-bold ${metaForm.vip_tier === tier.value ? 'text-gray-900' : 'text-gray-600'}`}>
                                                        {tier.label}
                                                    </p>
                                                    {metaForm.vip_tier === tier.value && (
                                                        <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ${
                                                            tier.color === 'blue' ? 'bg-blue-500' : 'bg-gray-500'
                                                        }`}>
                                                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Toggles */}
                                    <div className="md:col-span-2 flex flex-wrap gap-6">
                                        <label className="flex items-center gap-2 cursor-not-allowed opacity-80">
                                            <input type="checkbox" checked={isDownloadAllowedForTier(metaForm.vip_tier, metaForm.is_premium)}
                                                readOnly
                                                disabled
                                                className="w-4 h-4" />
                                            <span className="text-sm font-medium text-gray-700">Tải PDF: đề miễn phí bật, VIP tắt</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={metaForm.shuffle_mode}
                                                onChange={e => handleMetaChange('shuffle_mode', e.target.checked)}
                                                className="w-4 h-4" />
                                            <span className="text-sm font-medium text-gray-700">Chế độ xáo trộn</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={metaForm.is_premium}
                                                onChange={e => {
                                                    const checked = e.target.checked;
                                                    const nextTier = checked ? 'vip' : 'basic';
                                                    setMetaForm(prev => ({
                                                        ...prev,
                                                        is_premium: checked,
                                                        vip_tier: nextTier,
                                                        allow_download: isDownloadAllowedForTier(nextTier, checked),
                                                    }));
                                                    setMetaDirty(true);
                                                }}
                                                className="w-4 h-4" />
                                            <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                                                <FaCrown size={12} className="text-amber-500" /> Đề VIP (VIP/Pre)
                                            </span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={metaForm.is_simulated}
                                                onChange={e => handleMetaChange('is_simulated', e.target.checked)}
                                                className="w-4 h-4" />
                                            <span className="text-sm font-medium text-gray-700">🎯 Đề mô phỏng</span>
                                        </label>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <button onClick={handleSaveMeta} disabled={savingMeta || !metaDirty}
                                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium">
                                        <FiSave size={15} />
                                        {savingMeta ? 'Đang lưu...' : '💾 Lưu thông tin'}
                                    </button>
                                    <button onClick={() => { setEditingMeta(false); setMetaDirty(false); }}
                                        className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
                                        Hủy
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div><span className="font-semibold text-gray-500">Tên:</span> {exam.title}</div>
                                <div><span className="font-semibold text-gray-500">TG:</span> {exam.duration} phút</div>
                                <div><span className="font-semibold text-gray-500">Điểm:</span> {exam.total_points}</div>
                                <div><span className="font-semibold text-gray-500">VIP:</span> {exam.vip_tier || 'basic'}</div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── VIEW MODE: Exam Info ── */}
                {!isEditingExam && (
                    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                            <div>
                                <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Môn học</p>
                                <p className="font-bold text-gray-900">{exam.subject_name || '—'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Thời gian</p>
                                <p className="font-bold text-gray-900">{exam.duration} phút</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Tổng điểm</p>
                                <p className="font-bold text-gray-900">{exam.total_points} điểm</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Số câu</p>
                                <p className="font-bold text-gray-900">{exam.total_questions} câu</p>
                            </div>
                        </div>
                        {exam.description && (
                            <p className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-600">{exam.description}</p>
                        )}

                        {/* Download toggle */}
                        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-semibold text-gray-700">Quyền tải PDF</p>
                                <p className="text-xs text-gray-400">Đề miễn phí luôn cho tải. Đề VIP/Pre luôn tắt tải.</p>
                            </div>
                            <button
                                onClick={handleToggleDownload}
                                disabled
                                className={`relative w-12 h-6 cursor-not-allowed rounded-full transition-colors ${
                                    exam.allow_download ? 'bg-green-500' : 'bg-gray-300'
                                }`}
                            >
                                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                                    exam.allow_download ? 'translate-x-7' : 'translate-x-1'
                                }`} />
                            </button>
                        </div>

                        {/* VIP Tier */}
                        <div className="mt-4 pt-4 border-t border-gray-100">
                            <label className="block text-sm font-semibold text-gray-700 mb-3">Phân loại nội dung</label>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { value: 'basic', label: 'Miễn phí', desc: 'Mọi người đều xem được', color: 'gray' },
                                    { value: 'vip', label: 'VIP', desc: 'Gói VIP & Premium', color: 'blue' },
                                ].map(tier => (
                                    <button key={tier.value}
                                        onClick={() => handleSetVipTier(tier.value)}
                                        className={`relative p-2.5 rounded-xl border-2 text-center transition-all ${
                                            exam.vip_tier === tier.value
                                                ? tier.color === 'blue' ? 'border-blue-500 bg-blue-50' : 'border-gray-500 bg-gray-100'
                                                : 'border-gray-200 hover:border-gray-300 bg-white'
                                        }`}>
                                        <p className={`text-xs font-bold ${exam.vip_tier === tier.value ? 'text-gray-900' : 'text-gray-600'}`}>
                                            {tier.label}
                                        </p>
                                        {exam.vip_tier === tier.value && (
                                            <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ${
                                                tier.color === 'blue' ? 'bg-blue-500' : 'bg-gray-500'
                                            }`}>
                                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-gray-400 mt-2">VIP & Premium dùng chung đề. Chỉ khác chức năng bổ sung.</p>
                        </div>

                        {/* Premium toggle */}
                        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-semibold flex items-center gap-2 text-gray-700">
                                    <FaCrown size={14} className="text-amber-500" /> Đề VIP (VIP/Pre)
                                </p>
                                <p className="text-xs text-gray-400">Chỉ thành viên VIP hoặc Pre mới được truy cập đề thi này</p>
                            </div>
                            <button
                                onClick={handleTogglePremium}
                                className={`relative w-12 h-6 rounded-full transition-colors ${
                                    exam.is_premium ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gray-300'
                                }`}
                            >
                                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                                    exam.is_premium ? 'translate-x-7' : 'translate-x-1'
                                }`} />
                            </button>
                        </div>

                        {/* Video URL */}
                        <div className="mt-4 pt-4 border-t border-gray-100">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Video Giải Đề (URL)</label>
                            <input
                                type="url" value={videoUrl}
                                onChange={(e) => setVideoUrl(e.target.value)}
                                onBlur={handleSaveVideo}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder="https://www.youtube.com/watch?v=..."
                            />
                        </div>

                        <div className="mt-3">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Mô Tả Video</label>
                            <textarea
                                value={solutionDesc}
                                onChange={(e) => setSolutionDesc(e.target.value)}
                                onBlur={handleSaveVideo}
                                rows={2}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder="Mô tả ngắn về nội dung video..."
                            />
                        </div>

                        {/* Shuffle toggle */}
                        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-semibold text-gray-700">Chế độ xáo trộn</p>
                                <p className="text-xs text-gray-400">Xáo trộn câu hỏi và đáp án mỗi lần làm bài</p>
                            </div>
                            <button
                                onClick={handleToggleShuffle}
                                className={`relative w-12 h-6 rounded-full transition-colors ${
                                    exam.shuffle_mode ? 'bg-gradient-to-r from-blue-500 to-indigo-600' : 'bg-gray-300'
                                }`}
                            >
                                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                                    exam.shuffle_mode ? 'translate-x-7' : 'translate-x-1'
                                }`} />
                            </button>
                        </div>

                        {/* Simulated toggle */}
                        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-semibold flex items-center gap-2 text-gray-700">🎯 Đề mô phỏng</p>
                                <p className="text-xs text-gray-400">Được phân loại vào kho đề thi mô phỏng</p>
                            </div>
                            <button
                                onClick={handleToggleSimulated}
                                className={`relative w-12 h-6 rounded-full transition-colors ${
                                    exam.is_simulated ? 'bg-gradient-to-r from-pink-500 to-rose-600' : 'bg-gray-300'
                                }`}
                            >
                                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                                    exam.is_simulated ? 'translate-x-7' : 'translate-x-1'
                                }`} />
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Questions Section ── */}
                {isEditingExam && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-center justify-between flex-wrap gap-3">
                        <div>
                            <p className="font-bold text-blue-900">Chế độ sửa đề</p>
                            <p className="text-sm text-blue-700">Nhấn <strong>✏️ Sửa</strong> ở câu để chỉnh sửa nội dung. <strong>+ Thêm</strong> để chèn câu mới (đánh số lại tự động).</p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                onClick={handleReviewCurrentExam}
                                disabled={reviewingExam || !!aiBlockingTask}
                                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <FiAlertCircle size={15} />
                                {reviewingExam ? 'AI đang soát...' : 'AI soát đề này'}
                            </button>
                            <button
                                onClick={handleApplyDisplayFormatFixes}
                                disabled={applyingDisplayFormatFixes || !!aiBlockingTask}
                                className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <FiRefreshCw size={15} className={applyingDisplayFormatFixes ? 'animate-spin' : ''} />
                                {applyingDisplayFormatFixes ? 'AI đang sửa format...' : 'AI sửa format hiển thị'}
                            </button>
                            <button
                                onClick={handleGenerateMissingExplanations}
                                disabled={generatingMissingExplanations || !!aiBlockingTask}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <FiRefreshCw size={15} className={generatingMissingExplanations ? 'animate-spin' : ''} />
                                {generatingMissingExplanations ? 'AI đang thêm...' : 'AI thêm giải thích thiếu'}
                            </button>
                            <button
                                onClick={handlePolishExplanations}
                                disabled={polishingExplanations || !!aiBlockingTask}
                                className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <FiRefreshCw size={15} className={polishingExplanations ? 'animate-spin' : ''} />
                                {polishingExplanations ? 'AI đang chuẩn hóa...' : 'AI chuẩn hóa lời giải'}
                            </button>
                            <button
                                onClick={handleNormalizeCurrentExam}
                                disabled={normalizingFormulas || !!aiBlockingTask}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <FiRefreshCw size={15} className={normalizingFormulas ? 'animate-spin' : ''} />
                                {normalizingFormulas ? 'Đang chuẩn hóa...' : 'Chuẩn hóa công thức đề này'}
                            </button>
                            <button
                                onClick={() => {
                                    const nextNum = getNextQuestionNum();
                                    setLocalQuestions(prev => [...prev, {
                                        _pending: true as const,
                                        _localId: `pending-fbg-${Date.now()}`,
                                        _questionNumber: nextNum,
                                        _questionType: 'fill_blank_pool',
                                    }]);
                                    setEditVisibleCount(prev => Math.max(prev, localQuestions.length + 1));
                                    setAddingAfterId(null);
                                    setQuickAddPosition(nextNum);
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                            >
                                <FiPlus size={15} /> 📝 Điền Từ
                            </button>
                            <button
                                onClick={() => {
                                    const nextNum = getNextQuestionNum();
                                    setLocalQuestions(prev => [...prev, {
                                        _pending: true as const,
                                        _localId: `pending-rpg-${Date.now()}`,
                                        _questionNumber: nextNum,
                                        _questionType: 'reading_passage',
                                    }]);
                                    setEditVisibleCount(prev => Math.max(prev, localQuestions.length + 1));
                                    setAddingAfterId(null);
                                    setQuickAddPosition(nextNum);
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
                            >
                                <FiPlus size={15} /> 📖 Đọc Hiểu
                            </button>
                            <button
                                onClick={() => {
                                    const nextNum = getNextQuestionNum();
                                    setLocalQuestions(prev => [...prev, {
                                        _pending: true as const,
                                        _localId: `pending-${Date.now()}`,
                                        _questionNumber: nextNum,
                                        _questionType: 'single_choice',
                                    }]);
                                    setEditVisibleCount(prev => Math.max(prev, localQuestions.length + 1));
                                    setAddingAfterId(null);
                                    setQuickAddPosition(nextNum);
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                            >
                                <FiPlus size={15} /> Trắc Nghiệm
                            </button>
                        </div>
                    </div>
                )}

                {isEditingExam && aiHistory.length > 0 && (
                    <div className="mb-6 rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-950">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                                <p className="font-black">Lịch sử AI của đề này</p>
                                <p className="mt-1 text-cyan-800">Đề đã được AI xử lý. Bấm lại vẫn được, nhưng hệ thống sẽ hỏi xác nhận để tránh tốn tiền.</p>
                            </div>
                        </div>
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                            {aiHistory.slice(0, 6).map((run) => {
                                const summary = run.summary || {};
                                return (
                                    <div key={`${run.action}-${run.created_at}`} className="rounded-lg border border-cyan-200 bg-white/70 px-3 py-2">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <span className="font-bold">{getExamAiRunLabel(run.action)}</span>
                                            <span className="text-xs font-semibold text-cyan-700">{formatAiRunTime(run.created_at)}</span>
                                        </div>
                                        <p className="mt-1 text-xs text-cyan-800">
                                            {run.run_by_name ? `Bởi ${run.run_by_name}` : 'Không rõ admin'}
                                            {` · ${getExamAiRunDetail(run)}`}
                                            {summary.model ? ` · ${summary.model}` : ''}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {isEditingExam && normalizeResult && (
                    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                        <p className="font-bold">{normalizeResult.message}</p>
                        <p className="mt-1">
                            Đã sửa {normalizeResult.changedCount || 0} chỗ, còn {normalizeResult.warningCount || 0} chỗ nghi lỗi cần xem tay.
                        </p>
                        {!!normalizeResult.warnings?.length && (
                            <div className="mt-2 max-h-40 overflow-auto rounded-lg bg-white/70 p-2 text-xs">
                                {normalizeResult.warnings.slice(0, 8).map((warning, index) => (
                                    <p key={index}>
                                        Câu {warning.questionNumber || '?'} {warning.answerKey ? `đáp án ${warning.answerKey}` : ''} - {warning.field}: {warning.message}
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {isEditingExam && displayFormatApplyResult && (
                    <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
                        <p className="font-bold">{displayFormatApplyResult.message || `AI đã sửa ${displayFormatApplyResult.changedCount || 0} chỗ format.`}</p>
                        <p className="mt-1">
                            Sửa format: {displayFormatApplyResult.changedCount || 0} chỗ. Rule công thức: {displayFormatApplyResult.formulaChangedCount || 0} chỗ. Bỏ qua {displayFormatApplyResult.skippedCount || 0} câu.
                            {displayFormatApplyResult.summary?.model ? ` Model: ${displayFormatApplyResult.summary.model}.` : ''}
                        </p>
                        {!!displayFormatApplyResult.skipped?.length && (
                            <div className="mt-2 max-h-40 overflow-auto rounded-lg bg-white/70 p-2 text-xs">
                                {displayFormatApplyResult.skipped.slice(0, 8).map((item, index) => (
                                    <p key={`${item.questionId || item.path || index}-${index}`}>
                                        Câu {item.questionNumber || '?'} - {item.reason}
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {isEditingExam && missingExplanationResult && (
                    <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                        <p className="font-bold">{missingExplanationResult.message}</p>
                        <p className="mt-1">
                            Đã lưu {missingExplanationResult.questionChangedCount || 0} câu, {missingExplanationResult.changedCount || 0} ô giải thích. Bỏ qua {missingExplanationResult.skippedCount || 0} câu.
                            {missingExplanationResult.summary?.model ? ` Model: ${missingExplanationResult.summary.model}.` : ''}
                        </p>
                        {!!missingExplanationResult.skipped?.length && (
                            <div className="mt-2 max-h-40 overflow-auto rounded-lg bg-white/70 p-2 text-xs">
                                {missingExplanationResult.skipped.slice(0, 8).map((item, index) => (
                                    <p key={`${item.questionId || item.path || index}-${index}`}>
                                        Câu {item.questionNumber || '?'} - {item.reason}
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {isEditingExam && polishExplanationResult && (
                    <div className="mb-6 rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-900">
                        <p className="font-bold">{polishExplanationResult.message}</p>
                        <p className="mt-1">
                            Đã chuẩn hóa {polishExplanationResult.questionChangedCount || 0} câu. Bỏ qua {polishExplanationResult.skippedCount || 0} câu.
                            {polishExplanationResult.summary?.model ? ` Model: ${polishExplanationResult.summary.model}.` : ''}
                        </p>
                        {!!polishExplanationResult.skipped?.length && (
                            <div className="mt-2 max-h-40 overflow-auto rounded-lg bg-white/70 p-2 text-xs">
                                {polishExplanationResult.skipped.slice(0, 8).map((item, index) => (
                                    <p key={`${item.questionId || item.path || index}-${index}`}>
                                        Câu {item.questionNumber || '?'} - {item.reason}
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {isEditingExam && (
                    <SavedExamAiReviewPanel
                        result={examReviewResult}
                        error={examReviewError}
                        reviewing={reviewingExam}
                        normalizingFormulas={normalizingFormulas}
                        applyingReviewFixes={applyingExamReviewFixes}
                        applyResult={examReviewApplyResult}
                        onApplySafeFix={handleNormalizeCurrentExam}
                        onApplyAiFixes={handleApplyExamReviewFixes}
                        onOpenQuestion={handleOpenReviewQuestion}
                    />
                )}

                {isEditingExam && (
                    <PdfImportPanel
                        canImport={Boolean(exam.id)}
                        preview={pdfImportPreview}
                        items={pdfPreviewItems}
                        saving={pdfImportSaving}
                        onPreviewLoaded={handlePdfImportPreviewLoaded}
                        onPreviewCleared={() => setPdfImportPreview(null)}
                        onSave={savePdfImportedQuestions}
                        onChangeItems={(nextItems) => {
                            setPdfImportPreview(prev => prev ? {
                                ...prev,
                                items: nextItems,
                                questions: nextItems.filter((item): item is ImportedQuestionData => item.itemType !== 'reading_group' && item.itemType !== 'fill_blank_group'),
                            } : prev);
                        }}
                    />
                )}

                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-bold text-gray-900">
                        {isEditingExam ? 'Danh sách câu hỏi (chế độ sửa)' : `Danh sách câu hỏi (${questions.length})`}
                    </h2>
                    {isEditingExam && hiddenQuestionCount > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                                Đang hiện {visibleQuestions.length}/{questions.length}
                            </span>
                            <button
                                type="button"
                                onClick={() => setEditVisibleCount(prev => Math.min(prev + EDIT_QUESTION_BATCH_SIZE, questions.length))}
                                className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                            >
                                Tải thêm
                            </button>
                            <button
                                type="button"
                                onClick={() => setEditVisibleCount(questions.length)}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                Hiện hết
                            </button>
                        </div>
                    )}
                </div>

                {questions.length === 0 && pendingFillBlankGroups.length === 0 && pendingReadingGroups.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
                        <p className="text-lg mb-4">Chưa có câu hỏi nào</p>
                        {isEditingExam && (
                            <div className="flex items-center justify-center gap-3 flex-wrap">
                                <button
                                    onClick={() => {
                                        setShowAddFillBlank(true);
                                        setPendingFillBlankGroups(prev => [...prev, {
                                            _id: `fbg-${Date.now()}`,
                                            _localId: `fbg-${Date.now()}`,
                                            insertPosition: 1,
                                            clozeMode: 'sentences',
                                            passageText: '',
                                            passageImageUrl: '',
                                            linkedOptions: [
                                                { key: 'A', text: '', textCn: '' },
                                                { key: 'B', text: '', textCn: '' },
                                                { key: 'C', text: '', textCn: '' },
                                                { key: 'D', text: '', textCn: '' },
                                                { key: 'E', text: '', textCn: '' },
                                                { key: 'F', text: '', textCn: '' },
                                            ],
                                            subItems: [],
                                        }]);
                                    }}
                                    className="mt-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                                >
                                    📝 Điền Từ
                                </button>
                                <button
                                    onClick={() => {
                                        setShowAddReadingPassage(true);
                                        setPendingReadingGroups(prev => [...prev, {
                                            _id: `rpg-${Date.now()}`,
                                            _localId: `rpg-${Date.now()}`,
                                            insertPosition: 1,
                                            passageText: '',
                                            passageImageUrl: '',
                                            subQuestions: [],
                                        }]);
                                    }}
                                    className="mt-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                                >
                                    📖 Đọc Hiểu
                                </button>
                                <button
                                    onClick={() => { setShowQuickAdd(true); setAddingAfterId(null); setQuickAddPosition(1); }}
                                    className="mt-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    🔘 Trắc Nghiệm
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Pending Fill Blank Groups */}
                        {pendingFillBlankGroups.map((group, index) => (
                            <FillBlankGroup
                                key={group._localId}
                                startNumber={1}
                                initialData={group}
                                onSave={(data) => handleAddFillBlankGroup(data)}
                                onDelete={() => {
                                    setPendingFillBlankGroups(prev => prev.filter((_, i) => i !== index));
                                    if (pendingFillBlankGroups.length === 1) setShowAddFillBlank(false);
                                }}
                            />
                        ))}

                        {/* Pending Reading Passage Groups */}
                        {pendingReadingGroups.map((group, index) => (
                            <ReadingPassageGroup
                                key={group._localId}
                                startNumber={1}
                                initialData={group}
                                onSave={(data) => handleAddReadingPassageGroup(data)}
                                onDelete={() => {
                                    setPendingReadingGroups(prev => prev.filter((_, i) => i !== index));
                                    if (pendingReadingGroups.length === 1) setShowAddReadingPassage(false);
                                }}
                            />
                        ))}

                        {visibleQuestions.map((q, idx) => {
                            if ('_pending' in q) {
                                const isReading = q._questionType === 'reading_passage';
                                const isFillBlank = q._questionType === 'fill_blank_pool';
                                const borderColor = isReading ? 'border-purple-300' : isFillBlank ? 'border-green-300' : 'border-blue-300';
                                const bgColor = isReading ? 'bg-purple-50' : isFillBlank ? 'bg-green-50' : 'bg-blue-50';
                                const label = isReading ? '📖 Đọc Hiểu mới' : isFillBlank ? '📝 Điền Từ mới' : 'Câu mới';
                                const typeLabel = isReading ? 'Đọc Hiểu' : isFillBlank ? 'Điền Từ' : 'Trắc Nghiệm';

                                return (
                                    <div key={q._localId} className={`border-2 border-dashed ${borderColor} rounded-xl p-4`}>
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className={`px-2 py-1 ${bgColor} text-blue-700 rounded text-xs font-bold`}>
                                                {label} #{q._questionNumber}
                                            </span>
                                            <span className="text-xs text-gray-500">Chưa lưu — điền thông tin và nhấn Lưu</span>
                                        </div>

                                        {(isReading || isFillBlank) ? (
                                            isReading ? (
                                                <ReadingPassageGroup
                                                    key={q._localId}
                                                    startNumber={q._questionNumber}
                                                    initialData={{
                                                        _id: q._localId,
                                                        _localId: q._localId,
                                                        insertPosition: q._questionNumber,
                                                        passageText: '',
                                                        passageImageUrl: '',
                                                        subQuestions: [],
                                                    }}
                                                    onSave={(data) => handleAddReadingPassageGroup(data)}
                                                    onDelete={() => {
                                                        setLocalQuestions(prev => prev.filter((_, i) => i !== idx));
                                                    }}
                                                />
                                            ) : (
                                                <FillBlankGroup
                                                    key={q._localId}
                                                    startNumber={q._questionNumber}
                                                    initialData={{
                                                        _id: q._localId,
                                                        _localId: q._localId,
                                                        insertPosition: q._questionNumber,
                                                        clozeMode: 'sentences',
                                                        passageText: '',
                                                        passageImageUrl: '',
                                                        linkedOptions: [
                                                            { key: 'A', text: '', textCn: '' },
                                                            { key: 'B', text: '', textCn: '' },
                                                            { key: 'C', text: '', textCn: '' },
                                                            { key: 'D', text: '', textCn: '' },
                                                            { key: 'E', text: '', textCn: '' },
                                                            { key: 'F', text: '', textCn: '' },
                                                        ],
                                                        subItems: [],
                                                    }}
                                                    onSave={(data) => handleAddFillBlankGroup(data)}
                                                    onDelete={() => {
                                                        setLocalQuestions(prev => prev.filter((_, i) => i !== idx));
                                                    }}
                                                />
                                            )
                                        ) : (
                                            <QuestionEditor
                                                questionNumber={q._questionNumber}
                                                initialQuestionType={'single_choice'}
                                                onSave={handleQuickAddSave}
                                                onDelete={() => {
                                                    setLocalQuestions(prev => prev.filter((_, i) => i !== idx));
                                                }}
                                                onCancel={() => {
                                                    setLocalQuestions(prev => prev.filter((_, i) => i !== idx));
                                                    setAddingAfterId(null);
                                                    setQuickAddPosition(null);
                                                }}
                                            />
                                        )}
                                    </div>
                                );
                            }

                            if (isSavedGroup(q)) {
                                const startNumber = q.children[0]?.question_number || q.question_number;
                                if (editMode !== 'edit') {
                                    const endNumber = q.children[q.children.length - 1]?.question_number || startNumber;
                                    const isReadingGroup = q.question_type === 'reading_passage';
                                    return (
                                        <div id={`question-${q.id}`} key={`group-view-${q.id}`} className={`bg-white rounded-xl border ${isReadingGroup ? 'border-purple-200' : 'border-green-200'} p-6`}>
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="flex items-start gap-3">
                                                    <span className={`flex-shrink-0 px-3 py-1 rounded-full text-sm font-bold ${isReadingGroup ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                                                        {startNumber}{endNumber !== startNumber ? `-${endNumber}` : ''}
                                                    </span>
                                                    <div>
                                                        <p className="font-bold text-gray-900">
                                                            {isReadingGroup ? 'Nhóm đọc hiểu' : 'Nhóm điền từ'}
                                                        </p>
                                                        <p className="text-sm text-gray-500">{q.children.length} câu hỏi</p>
                                                    </div>
                                                </div>
                                                <span className="text-xs text-gray-400">{q.question_type}</span>
                                            </div>
                                            {q.passage_text && (
                                                <RichMathText value={q.passage_text} className="text-gray-700 line-clamp-4" />
                                            )}
                                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                                                {q.children.map(child => (
                                                    <div key={child.id} className="px-3 py-2 rounded-lg border border-gray-100 bg-gray-50 text-sm text-gray-700">
                                                        <span className="font-semibold">Câu {child.question_number}:</span>
                                                        <RichMathText
                                                            value={child.question_text_cn || child.question_text}
                                                            className="mt-1 text-gray-700"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                }

                                if (q.question_type === 'reading_passage') {
                                    const initialData = groupToReadingData(q);
                                    return (
                                        <div id={`question-${q.id}`} key={`reading-group-${q.id}`} className="bg-white rounded-xl border border-purple-200 p-6">
                                            <ReadingPassageGroup
                                                startNumber={startNumber}
                                                initialData={initialData}
                                                onSave={(data) => handleUpdateReadingPassageGroup(q.id, data)}
                                                onDelete={isEditingExam ? () => handleDeleteGroup(q) : undefined}
                                            />
                                        </div>
                                    );
                                }

                                const initialData = groupToFillBlankData(q);
                                return (
                                    <div id={`question-${q.id}`} key={`fill-group-${q.id}`} className="bg-white rounded-xl border border-green-200 p-6">
                                        <FillBlankGroup
                                            startNumber={startNumber}
                                            initialData={initialData}
                                            onSave={(data) => handleUpdateFillBlankGroup(q.id, data)}
                                            onDelete={isEditingExam ? () => handleDeleteGroup(q) : undefined}
                                        />
                                    </div>
                                );
                            }

                            const isEditing = editingQuestionId === q.id;
                            const formData = dbToFormData(q);

                            return (
                                <div id={`question-${q.id}`} key={q.id} className={`bg-white rounded-xl border ${isEditing ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200'} p-6`}>
                                    {isEditing ? (
                                        <QuestionEditor
                                            questionNumber={q.question_number}
                                            initialData={formData}
                                            savedQuestionId={q.id}
                                            onSave={(data) => handleUpdateQuestion(q.id, data)}
                                            onDelete={() => handleDeleteQuestion(q.id)}
                                            onCancel={() => setEditingQuestionId(null)}
                                        />
                                    ) : (
                                        <>
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="flex items-start gap-3 flex-1">
                                                    <span className="flex-shrink-0 w-8 h-8 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-sm font-bold">
                                                        {q.question_number}
                                                    </span>
                                                    <div className="flex-1">
                                                        <RichMathText value={q.question_text} className="font-medium text-gray-900" />
                                                        {q.question_text_cn && q.question_text_cn !== q.question_text && (
                                                            <RichMathText value={q.question_text_cn} className="mt-1 text-gray-500" />
                                                        )}
                                                        {q.image_url && (
                                                            <img src={q.image_url} alt="question" className="mt-2 max-h-32 rounded-lg border border-gray-200" />
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 ml-4">
                                                    <span className="text-xs text-gray-400">{q.points} điểm</span>
                                                    {isEditingExam && (
                                                        <>
                                                            <button
                                                                onClick={() => setEditingQuestionId(q.id)}
                                                                className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors text-sm font-medium"
                                                                title="Sửa câu hỏi"
                                                            >
                                                                <FiEdit2 size={13} /> Sửa
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteQuestion(q.id)}
                                                                disabled={deletingId === q.id}
                                                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                                                title="Xóa câu hỏi"
                                                            >
                                                                {deletingId === q.id
                                                                    ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-500 border-t-transparent" />
                                                                    : <FiTrash2 size={15} />
                                                                }
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                {q.answers?.map(a => (
                                                    <div
                                                        key={a.id}
                                                        className={`flex items-start gap-2 px-3 py-2 rounded-lg border ${a.is_correct
                                                                ? 'border-green-300 bg-green-50'
                                                                : 'border-gray-200 bg-gray-50'
                                                            }`}
                                                    >
                                                        <span className={`font-bold text-base leading-7 flex-shrink-0 ${a.is_correct ? 'text-green-700' : 'text-gray-500'}`}>
                                                            {a.answer_key}.
                                                        </span>
                                                        <div className="flex-1 text-base leading-7">
                                                            <RichMathText
                                                                value={a.answer_text}
                                                                className={a.is_correct ? 'text-base font-medium leading-7 text-green-800' : 'text-base leading-7 text-gray-700'}
                                                            />
                                                            {a.answer_text_cn && a.answer_text_cn !== a.answer_text && (
                                                                <RichMathText value={a.answer_text_cn} className="mt-0.5 text-base leading-7 text-gray-500" />
                                                            )}
                                                            {a.image_url && (
                                                                <img src={a.image_url} alt={a.answer_key} className="mt-1 max-h-16 rounded border border-gray-200" />
                                                            )}
                                                        </div>
                                                        {a.is_correct && <FiCheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={15} />}
                                                    </div>
                                                ))}
                                            </div>

                                            {(q.explanation || q.explanation_cn || q.explanation_image_url) && (
                                                <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
                                                    <p className="mb-2 text-sm font-bold uppercase tracking-wide text-blue-900">Giải thích:</p>
                                                    {(q.explanation || q.explanation_cn) && (
                                                        <RichMathText value={q.explanation || q.explanation_cn || ''} readableBreaks className="text-base leading-7 text-blue-950" />
                                                    )}
                                                    {q.explanation && q.explanation_cn && q.explanation_cn !== q.explanation && (
                                                        <RichMathText value={q.explanation_cn} readableBreaks className="mt-3 border-t border-blue-200 pt-3 text-base leading-7 text-blue-800" />
                                                    )}
                                                    {q.explanation_image_url && (
                                                        <img
                                                            src={q.explanation_image_url}
                                                            alt="Ảnh giải thích"
                                                            className="mt-3 max-h-[520px] w-full rounded-lg border border-blue-200 bg-white object-contain"
                                                        />
                                                    )}
                                                </div>
                                            )}

                                            {isEditingExam && (
                                                <div className="mt-3 pt-3 border-t border-gray-100">
                                                    <div className="flex items-center justify-center gap-2 flex-wrap">
                                                        <button
                                                            onClick={() => {
                                                                const nextNum = q.question_number + 1;
                                                                setAddingAfterId('_pending' in q ? null : q.id);
                                                                setQuickAddPosition(nextNum);
                                                                const newQ = {
                                                                    _pending: true as const,
                                                                    _localId: `pending-${Date.now()}`,
                                                                    _questionNumber: nextNum,
                                                                    _questionType: 'single_choice',
                                                                };
                                                                setLocalQuestions(prev => {
                                                                    const arr = [...prev];
                                                                    arr.splice(idx + 1, 0, newQ);
                                                                    return arr;
                                                                });
                                                                setEditVisibleCount(prev => Math.max(prev, idx + 2));
                                                                setShowQuickAdd(true);
                                                            }}
                                                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors text-xs font-medium"
                                                        >
                                                            <FiPlus size={12} /> Trắc Nghiệm
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                const nextNum = q.question_number + 1;
                                                                const newQ = {
                                                                    _pending: true as const,
                                                                    _localId: `pending-rpg-${Date.now()}`,
                                                                    _questionNumber: nextNum,
                                                                    _questionType: 'reading_passage',
                                                                };
                                                                setLocalQuestions(prev => {
                                                                    const arr = [...prev];
                                                                    arr.splice(idx + 1, 0, newQ);
                                                                    return arr;
                                                                });
                                                                setEditVisibleCount(prev => Math.max(prev, idx + 2));
                                                                setAddingAfterId(q.id);
                                                                setQuickAddPosition(nextNum);
                                                            }}
                                                            className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-600 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors text-xs font-medium"
                                                        >
                                                            <FiPlus size={12} /> 📖 Đọc Hiểu
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                const nextNum = q.question_number + 1;
                                                                const newQ = {
                                                                    _pending: true as const,
                                                                    _localId: `pending-fbg-${Date.now()}`,
                                                                    _questionNumber: nextNum,
                                                                    _questionType: 'fill_blank_pool',
                                                                };
                                                                setLocalQuestions(prev => {
                                                                    const arr = [...prev];
                                                                    arr.splice(idx + 1, 0, newQ);
                                                                    return arr;
                                                                });
                                                                setEditVisibleCount(prev => Math.max(prev, idx + 2));
                                                                setAddingAfterId(q.id);
                                                                setQuickAddPosition(nextNum);
                                                            }}
                                                            className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-600 hover:bg-green-100 border border-green-200 rounded-lg transition-colors text-xs font-medium"
                                                        >
                                                            <FiPlus size={12} /> 📝 Điền Từ
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            );
                        })}

                        {isEditingExam && hiddenQuestionCount > 0 && (
                            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-blue-200 bg-blue-50/60 px-4 py-5 text-center">
                                <p className="text-sm font-semibold text-blue-900">
                                    Còn {hiddenQuestionCount} mục chưa render để trang sửa đề mở nhanh hơn.
                                </p>
                                <div className="flex flex-wrap items-center justify-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setEditVisibleCount(prev => Math.min(prev + EDIT_QUESTION_BATCH_SIZE, questions.length))}
                                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
                                    >
                                        Tải thêm {Math.min(EDIT_QUESTION_BATCH_SIZE, hiddenQuestionCount)} mục
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEditVisibleCount(questions.length)}
                                        className="rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50"
                                    >
                                        Hiện hết
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Append buttons at bottom */}
                        {isEditingExam && (
                            <div className="text-center py-4">
                                <div className="flex items-center justify-center gap-3 flex-wrap">
                                    <button
                                        onClick={() => {
                                            const nextNum = getNextQuestionNum();
                                            setLocalQuestions(prev => [...prev, {
                                                _pending: true as const,
                                                _localId: `pending-fbg-${Date.now()}`,
                                                _questionNumber: nextNum,
                                                _questionType: 'fill_blank_pool',
                                            }]);
                                            setEditVisibleCount(prev => Math.max(prev, localQuestions.length + 1));
                                            setAddingAfterId(null);
                                            setQuickAddPosition(nextNum);
                                        }}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 text-sm font-medium"
                                    >
                                        <FiPlus size={15} /> 📝 Điền Từ (cuối)
                                    </button>
                                    <button
                                        onClick={() => {
                                            const nextNum = getNextQuestionNum();
                                            setLocalQuestions(prev => [...prev, {
                                                _pending: true as const,
                                                _localId: `pending-rpg-${Date.now()}`,
                                                _questionNumber: nextNum,
                                                _questionType: 'reading_passage',
                                            }]);
                                            setEditVisibleCount(prev => Math.max(prev, localQuestions.length + 1));
                                            setAddingAfterId(null);
                                            setQuickAddPosition(nextNum);
                                        }}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 text-sm font-medium"
                                    >
                                        <FiPlus size={15} /> 📖 Đọc Hiểu (cuối)
                                    </button>
                                    <button
                                        onClick={() => {
                                            const nextNum = getNextQuestionNum();
                                            setLocalQuestions(prev => [...prev, {
                                                _pending: true as const,
                                                _localId: `pending-${Date.now()}`,
                                                _questionNumber: nextNum,
                                                _questionType: 'single_choice',
                                            }]);
                                            setEditVisibleCount(prev => Math.max(prev, localQuestions.length + 1));
                                            setAddingAfterId(null);
                                            setQuickAddPosition(nextNum);
                                        }}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-medium"
                                    >
                                        <FiPlus size={15} /> 🔘 Trắc Nghiệm (cuối)
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Delete question/group modal */}
            {pendingDeleteItem && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
                    onClick={(event) => {
                        if (deletingId === null && event.target === event.currentTarget) {
                            setPendingDeleteItem(null);
                        }
                    }}
                >
                    <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={event => event.stopPropagation()}>
                        <h3 className="mb-2 text-lg font-bold text-gray-900">
                            {pendingDeleteItem.type === 'group' ? 'Xóa nhóm câu hỏi?' : 'Xóa câu hỏi?'}
                        </h3>
                        <p className="mb-4 text-sm leading-6 text-gray-600">
                            {pendingDeleteItem.type === 'group'
                                ? 'Toàn bộ câu con trong nhóm này sẽ bị xóa khỏi đề.'
                                : 'Câu hỏi này sẽ bị xóa khỏi đề.'}
                        </p>
                        {deleteItemError && (
                            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                {deleteItemError}
                            </div>
                        )}
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setPendingDeleteItem(null)}
                                disabled={deletingId !== null}
                                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={confirmDeleteItem}
                                disabled={deletingId !== null}
                                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {deletingId !== null ? 'Đang xóa...' : 'Xóa'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete exam modal */}
            {showDeleteExamConfirm && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
                    onClick={(event) => {
                        if (!deletingExam && event.target === event.currentTarget) {
                            setShowDeleteExamConfirm(false);
                        }
                    }}
                >
                    <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={event => event.stopPropagation()}>
                        <h3 className="mb-2 text-lg font-bold text-gray-900">Xóa tạm đề thi?</h3>
                        <p className="mb-4 text-sm leading-6 text-gray-600">
                            Đề <span className="font-semibold text-gray-900">{exam?.title}</span> sẽ được đưa vào danh sách xóa tạm. Nếu đề đã public hoặc đã có lượt thi, hệ thống có thể chuyển thành yêu cầu xóa để admin tổng duyệt.
                        </p>
                        {deleteExamError && (
                            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                {deleteExamError}
                            </div>
                        )}
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setShowDeleteExamConfirm(false)}
                                disabled={deletingExam}
                                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={confirmDeleteExam}
                                disabled={deletingExam}
                                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {deletingExam ? 'Đang xóa...' : 'Xóa tạm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm exit modal */}
            {showConfirmExit && (
                <div
                    className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]"
                    onClick={(e) => { if (e.target === e.currentTarget) closeConfirmExit(); }}
                >
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Không muốn sửa nữa?</h3>
                        <p className="text-sm leading-6 text-gray-500 mb-6">
                            Phần đang nhập dở sẽ bị bỏ và đề được tải lại. Các thay đổi đã bấm lưu hoặc AI đã ghi vào hệ thống vẫn được giữ.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                type="button"
                                onClick={closeConfirmExit}
                                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmExit}
                                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
                            >
                                Không sửa nữa
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
