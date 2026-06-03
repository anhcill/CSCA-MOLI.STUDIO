'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiPlus, FiEye, FiX } from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import QuestionEditor, { QuestionFormData } from '@/components/admin/QuestionEditor';
import ReadingPassageGroup, { ReadingPassageGroupData } from '@/components/admin/ReadingPassageGroup';
import FillBlankGroup, { FillBlankGroupData } from '@/components/admin/FillBlankGroup';
import PdfImportPanel from '@/components/admin/pdf-import/PdfImportPanel';
import { examAdminApi, ImportedExamItem, ImportedQuestionData, PdfImportPreview } from '@/lib/api/examAdmin';
import { useAuthStore } from '@/lib/store/authStore';
import { hasPermission } from '@/lib/utils/permissions';
import axios from '@/lib/utils/axios';

interface Subject {
    id: number;
    name: string;
    code: string;
}

type EditableQuestion = QuestionFormData & {
    _id: string;
    _order?: number;
    _savedQuestionId?: number;
};

const IMPORT_ANSWER_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

const hasImportText = (...values: Array<string | undefined | null>) =>
    values.some(value => typeof value === 'string' && value.trim().length > 0);

const getImportItemQuestionCount = (item: ImportedExamItem) => {
    if (item.itemType === 'reading_group') return item.subQuestions.length;
    if (item.itemType === 'fill_blank_group') return item.subItems.length;
    return 1;
};

const getImportPreviewItems = (preview: PdfImportPreview | null): ImportedExamItem[] => {
    if (!preview) return [];
    return preview.items?.length ? preview.items : preview.questions || [];
};

const getImportItemsQuestionCount = (items: ImportedExamItem[]) =>
    items.reduce((sum, item) => sum + getImportItemQuestionCount(item), 0);

const validateImportedSingleChoice = (item: ImportedQuestionData, label: string) => {
    if (!hasImportText(item.questionText, item.questionTextCn)) {
        return `${label} cần nội dung câu hỏi`;
    }

    const answers = item.answers || [];
    if (answers.length < 2 || answers.length > IMPORT_ANSWER_KEYS.length) {
        return `${label} cần từ 2 đến 8 đáp án`;
    }

    const emptyAnswerIndex = answers.findIndex(answer => !hasImportText(answer.text, answer.textCn));
    if (emptyAnswerIndex !== -1) {
        return `${label} thiếu nội dung đáp án ${IMPORT_ANSWER_KEYS[emptyAnswerIndex]}`;
    }

    const allowedKeys = IMPORT_ANSWER_KEYS.slice(0, answers.length);
    if (!item.correctAnswer || !allowedKeys.includes(item.correctAnswer)) {
        return `${label} cần chọn đáp án đúng`;
    }

    return '';
};

const validateImportedItems = (items: ImportedExamItem[]) => {
    if (!items.length) return 'Không có câu hỏi để import';

    for (let index = 0; index < items.length; index++) {
        const item = items[index];
        const label = `Mục ${index + 1}`;

        if (item.itemType === 'reading_group') {
            if (!hasImportText(item.passageText)) {
                return `${label} đọc hiểu cần đoạn văn`;
            }
            if (!item.subQuestions?.length) {
                return `${label} đọc hiểu cần ít nhất 1 câu con`;
            }
            for (let subIndex = 0; subIndex < item.subQuestions.length; subIndex++) {
                const error = validateImportedSingleChoice(item.subQuestions[subIndex], `${label}.${subIndex + 1}`);
                if (error) return error;
            }
            continue;
        }

        if (item.itemType === 'fill_blank_group') {
            const options = item.linkedOptions || [];
            const validOptionKeys = new Set(options.map(option => option.key));

            if (options.length < 2) {
                return `${label} điền từ cần ít nhất 2 lựa chọn`;
            }
            const emptyOptionIndex = options.findIndex(option => !hasImportText(option.text, option.textCn));
            if (emptyOptionIndex !== -1) {
                return `${label} thiếu nội dung lựa chọn ${options[emptyOptionIndex]?.key || emptyOptionIndex + 1}`;
            }
            if (item.clozeMode === 'passage' && !hasImportText(item.passageText)) {
                return `${label} điền từ dạng đoạn văn cần passageText`;
            }
            if (!item.subItems?.length) {
                return `${label} điền từ cần ít nhất 1 chỗ trống`;
            }
            for (let subIndex = 0; subIndex < item.subItems.length; subIndex++) {
                const subItem = item.subItems[subIndex];
                if (item.clozeMode !== 'passage' && !hasImportText(subItem.questionText, subItem.questionTextCn)) {
                    return `${label}.${subIndex + 1} cần nội dung câu điền từ`;
                }
                if (!subItem.correctAnswerKey || !validOptionKeys.has(subItem.correctAnswerKey)) {
                    return `${label}.${subIndex + 1} cần đáp án đúng nằm trong pool`;
                }
            }
            continue;
        }

        const error = validateImportedSingleChoice(item, label);
        if (error) return error;
    }

    return '';
};

export default function CreateExamPage() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [subjects, setSubjects] = useState<Subject[]>([]);

    // Exam metadata
    const [examData, setExamData] = useState({
        title: '',
        titleCn: '',      // P0: title tiếng Trung
        subjectId: 0,
        duration: 90,
        totalPoints: 100,
        description: '',
        is_premium: false,
        shuffle_mode: false,
        solution_video_url: '',
        solution_description: '',
        vip_tier: 'basic',
        is_simulated: false,
        difficulty_level: 'medium',
        start_time: '',
        end_time: '',
    });

    const parseDecimal = (raw: string) => {
        const normalized = raw.replace(',', '.').trim();
        if (!normalized) return 0;
        const parsed = Number.parseFloat(normalized);
        return Number.isFinite(parsed) ? parsed : 0;
    };

    // Questions with unique IDs
    const [questions, setQuestions] = useState<EditableQuestion[]>([]);
    // Reading passage groups (đoạn văn + nhiều câu con gom chung 1 card)
    const [readingPassageGroups, setReadingPassageGroups] = useState<(ReadingPassageGroupData & { _id: string; _order?: number })[]>([]);
    // Fill blank groups (điền từ + nhiều chỗ trống gom chung 1 card)
    const [fillBlankGroups, setFillBlankGroups] = useState<(FillBlankGroupData & { _id: string; _order?: number })[]>([]);
    // Số câu tiếp theo cho đoạn đọc hiểu (VD: đề đã có 72 câu → startNumber = 73)
    const [nextPassageStartNumber, setNextPassageStartNumber] = useState(1);
    // Số câu tiếp theo cho điền từ (VD: đã có 10 câu → startNumber = 11)
    const [nextFillBlankStartNumber, setNextFillBlankStartNumber] = useState(1);
    // ── Unified add-question flow (giống trang sửa đề) ──
    const [pendingQuestions, setPendingQuestions] = useState<({ _pending: true; _localId: string; _questionNumber: number; _questionType: string })[]>([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [pdfImportPreview, setPdfImportPreview] = useState<PdfImportPreview | null>(null);
    const [pdfImportSaving, setPdfImportSaving] = useState(false);

    // ── Computed: total question count (includes pending) ──
    const totalQuestionCount = questions.length
        + readingPassageGroups.reduce((acc, g) => acc + (g.subQuestions?.length || 0), 0)
        + fillBlankGroups.reduce((acc, g) => acc + (g.subItems?.length || 0), 0)
        + pendingQuestions.length;

    // ── Computed: interleave all question types in display order with question numbers ──
    type AllQuestionItem =
        | { type: 'single'; question: EditableQuestion; index: number; displayNumber: number }
        | { type: 'reading'; group: ReadingPassageGroupData & { _id: string; _order?: number }; index: number; displayNumber: number }
        | { type: 'fill'; group: FillBlankGroupData & { _id: string; _order?: number }; index: number; displayNumber: number };

    // Build ordered list preserving insertion order, assigning running question numbers
    // NOTE: reading/fill groups with N sub-questions consume N numbers in the sequence
    const buildAllQuestions = (): AllQuestionItem[] => {
        const result: AllQuestionItem[] = [];
        let runningNumber = 1;

        // Collect all items in insertion order with their index in respective arrays
        const allItems: { kind: 'single' | 'reading' | 'fill'; index: number; order: number }[] = [];
        const maxLen = Math.max(questions.length, readingPassageGroups.length, fillBlankGroups.length);
        for (let i = 0; i < maxLen; i++) {
            if (i < questions.length) allItems.push({ kind: 'single', index: i, order: questions[i]._order || i * 3 + 1 });
            if (i < readingPassageGroups.length) allItems.push({ kind: 'reading', index: i, order: readingPassageGroups[i]._order || i * 3 + 2 });
            if (i < fillBlankGroups.length) allItems.push({ kind: 'fill', index: i, order: fillBlankGroups[i]._order || i * 3 + 3 });
        }
        allItems.sort((a, b) => a.order - b.order);

        for (const item of allItems) {
            if (item.kind === 'single') {
                result.push({ type: 'single', question: questions[item.index], index: item.index, displayNumber: runningNumber++ });
            } else if (item.kind === 'reading') {
                const group = readingPassageGroups[item.index];
                result.push({ type: 'reading', group, index: item.index, displayNumber: runningNumber });
                runningNumber += group.subQuestions?.length || 1;
            } else {
                const group = fillBlankGroups[item.index];
                result.push({ type: 'fill', group, index: item.index, displayNumber: runningNumber });
                runningNumber += group.subItems?.length || 1;
            }
        }
        return result;
    };
    const allQuestions: AllQuestionItem[] = buildAllQuestions();
    const [currentExamId, setCurrentExamId] = useState<number | null>(null);
    const [examMetadataDirty, setExamMetadataDirty] = useState(false);
    const [savingMetadata, setSavingMetadata] = useState(false);
    const [metadataSaved, setMetadataSaved] = useState(false);
    const [mounted, setMounted] = useState(false);

    const isMissingExamError = (error: any) => error?.response?.status === 404;
    const handleMissingCurrentExam = () => {
        setCurrentExamId(null);
        setExamMetadataDirty(false);
        sessionStorage.removeItem('currentExamId');
        alert('De thi nay khong con ton tai hoac da bi xoa. Vui long tai lai danh sach de.');
        router.push('/admin/exams');
    };

    // Restore currentExamId from sessionStorage after mount (client-side only)
    useEffect(() => {
        setMounted(true);
        // Priority: 1) URL query param (from exam detail page), 2) sessionStorage
        const params = new URLSearchParams(window.location.search);
        const urlExamId = params.get('examId');
        if (urlExamId) {
            setCurrentExamId(parseInt(urlExamId));
            sessionStorage.setItem('currentExamId', urlExamId);
        } else {
            const saved = sessionStorage.getItem('currentExamId');
            if (saved) {
                setCurrentExamId(parseInt(saved));
            }
        }
    }, []);

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

        fetchSubjects();
    }, [isAuthenticated, user, router]);

    // Persist currentExamId to sessionStorage
    useEffect(() => {
        if (!mounted) return; // Skip on first render
        if (currentExamId) {
            sessionStorage.setItem('currentExamId', currentExamId.toString());
        } else {
            sessionStorage.removeItem('currentExamId');
        }
    }, [currentExamId, mounted]);

    const fetchSubjects = async () => {
        try {
            const response = await axios.get('/subjects');
            const payload = response?.data?.data ?? response?.data;

            if (Array.isArray(payload)) {
                setSubjects(payload);
                return;
            }

            setSubjects([]);
        } catch (error: any) {
            console.error('Error fetching subjects:', error);
            setSubjects([]);

            if (error?.response?.status === 429) {
                alert('Hệ thống đang giới hạn tần suất gọi API. Vui lòng thử lại sau ít giây.');
            }
        }
    };

    const createExam = async () => {
        if (!examData.title || !examData.subjectId) {
            alert('Vui lòng nhập tên đề thi và chọn môn học');
            return;
        }

        try {
            setLoading(true);
            const response = await examAdminApi.createExam(examData);
            setCurrentExamId(response.exam.id);
            alert('Đề thi đã được tạo! Giờ hãy thêm câu hỏi.');
        } catch (error) {
            console.error('Error creating exam:', error);
            alert('Tạo đề thi thất bại');
        } finally {
            setLoading(false);
        }
    };

    const saveMetadata = async () => {
        if (!currentExamId) return;
        try {
            setSavingMetadata(true);
            await examAdminApi.updateExam(currentExamId, examData);
            setExamMetadataDirty(false);
            setMetadataSaved(true);
            setTimeout(() => setMetadataSaved(false), 2000);
        } catch (error) {
            console.error('Error saving metadata:', error);
            if (isMissingExamError(error)) {
                handleMissingCurrentExam();
                return;
            }
            alert('Lưu metadata thất bại');
        } finally {
            setSavingMetadata(false);
        }
    };

    const handleQuickAddSave = async (data: QuestionFormData) => {
        if (!currentExamId) {
            alert('Vui lòng tạo đề thi trước');
            return;
        }
        try {
            setLoading(true);

            if (data.questionType === 'reading_passage') {
                const res = await examAdminApi.insertReadingPassageGroup(currentExamId, {
                    _localId: `rpg-${Date.now()}`,
                    passageText: data.passageText || '',
                    passageImageUrl: data.passageImageUrl || '',
                    subQuestions: [],
                });
                setReadingPassageGroups(prev => [...prev, {
                    _id: String(res.groupId),
                    _localId: `rpg-${Date.now()}`,
                    _order: Date.now(),
                    passageText: data.passageText || '',
                    passageImageUrl: data.passageImageUrl || '',
                    subQuestions: [],
                }]);
                alert('Đã thêm đoạn đọc hiểu!');
            } else if (data.questionType === 'fill_blank_pool') {
                alert('Hãy dùng nút "Thêm Điền Từ" để tạo nhóm câu rời/đoạn văn có đáp án con.');
                return;
            } else {
                const res = await examAdminApi.addQuestion(currentExamId, data as any);
                const savedQuestionId = Number(res?.questionId) || undefined;
                const newQ = {
                    _id: savedQuestionId ? `q-${savedQuestionId}` : `q-${Date.now()}`,
                    _order: Date.now(),
                    _savedQuestionId: savedQuestionId,
                    ...data,
                };
                setQuestions(prev => [...prev, newQ]);
                alert('Đã thêm câu hỏi trắc nghiệm!');
            }
            setPendingQuestions([]);
            setShowAddForm(false);
        } catch (error) {
            console.error('Error saving question:', error);
            if (isMissingExamError(error)) {
                handleMissingCurrentExam();
                return;
            }
            alert('Lưu câu hỏi thất bại: ' + (error as any)?.response?.data?.message || '');
        } finally {
            setLoading(false);
        }
    };

    const saveQuestion = async (index: number, data: QuestionFormData, displayNumber: number) => {
        if (!currentExamId) {
            alert('Vui lòng tạo đề thi trước');
            return;
        }

        try {
            setLoading(true);
            const existingQuestionId = questions[index]?._savedQuestionId;
            const res = existingQuestionId
                ? await examAdminApi.updateQuestion(existingQuestionId, data as any)
                : await examAdminApi.insertQuestion(currentExamId, data as any, undefined, displayNumber);
            const savedQuestionId = existingQuestionId || Number((res as any)?.questionId) || undefined;

            // Update local state với thông tin từ backend
            const newQuestions = [...questions];
            newQuestions[index] = {
                ...newQuestions[index],
                ...data,
                _id: newQuestions[index]?._id || (savedQuestionId ? `q-${savedQuestionId}` : `q-${Date.now()}`),
                _savedQuestionId: savedQuestionId,
            };
            setQuestions(newQuestions);

            const typeLabel: Record<string, string> = {
                single_choice: 'Trắc nghiệm',
                fill_blank_pool: 'Điền từ (Pool)',
                fill_blank_item: 'Điền từ con',
                reading_passage: 'Đọc hiểu',
                reading_item: 'Đọc hiểu con',
                true_false: 'Đúng/Sai',
            };
            alert(`${typeLabel[(res as any)?.questionType || data.questionType] || 'Câu hỏi'} ${index + 1} đã được lưu!`);
        } catch (error) {
            console.error('Error saving question:', error);
            if (isMissingExamError(error)) {
                handleMissingCurrentExam();
                return;
            }
            alert('Lưu câu hỏi thất bại: ' + (error as any)?.response?.data?.message || '');
        } finally {
            setLoading(false);
        }
    };

    const deleteQuestion = async (index: number) => {
        if (!confirm('Xóa câu hỏi này?')) return;

        const question = questions[index];
        try {
            setLoading(true);
            if (question?._savedQuestionId) {
                await examAdminApi.deleteQuestion(question._savedQuestionId);
            }
            const newQuestions = questions.filter((_, i) => i !== index);
            setQuestions(newQuestions);
        } catch (error) {
            console.error('Error deleting question:', error);
            alert('Xóa câu hỏi thất bại');
        } finally {
            setLoading(false);
        }
    };

    // ── Reading Passage Group ──────────────────────────────────────────────
    const addReadingPassageGroup = () => {
        setReadingPassageGroups([...readingPassageGroups, {
            _id: `rpg-${Date.now()}`,
            _localId: `rg-${Date.now()}`,
            _order: Date.now(),
            passageText: '',
            passageImageUrl: '',
            subQuestions: [],
        }]);
    };

    const saveReadingPassageGroup = async (index: number, data: ReadingPassageGroupData, displayNumber: number) => {
        if (!currentExamId) {
            alert('Vui lòng tạo đề thi trước');
            return;
        }

        try {
            setLoading(true);
            const isNew = String(data._id).startsWith('rpg-');
            let realId = data._id;

            if (isNew) {
                const res = await examAdminApi.insertReadingPassageGroup(currentExamId, {
                    passageText: data.passageText,
                    passageImageUrl: data.passageImageUrl,
                    subQuestions: data.subQuestions,
                    insertPosition: displayNumber,
                });
                realId = String(res.groupId || res.passageGroupId || res.id || res.data?.id || Date.now());
            } else {
                const numericGroupId = Number(String(data._id).replace(/[^0-9]/g, ''));
                await examAdminApi.updateReadingPassageGroup(currentExamId, numericGroupId, {
                    passageText: data.passageText,
                    passageImageUrl: data.passageImageUrl,
                    subQuestions: data.subQuestions,
                });
            }

            const updated = [...readingPassageGroups];
            updated[index] = { ...updated[index], ...data, _id: realId };
            setReadingPassageGroups(updated);

            if (data.subQuestions.length > 0) {
                setNextPassageStartNumber(data.subQuestions.length);
            }

            alert(`Đoạn đọc hiểu đã lưu! (${data.subQuestions.length} câu)`);
        } catch (error) {
            console.error('Error saving reading passage group:', error);
            if (isMissingExamError(error)) {
                handleMissingCurrentExam();
                return;
            }
            alert('Lưu đoạn đọc hiểu thất bại: ' + (error as any)?.response?.data?.message || '');
        } finally {
            setLoading(false);
        }
    };

    const deleteReadingPassageGroup = async (index: number) => {
        const group = readingPassageGroups[index];
        if (!confirm('Xóa đoạn đọc hiểu này?')) return;
        try {
            setLoading(true);
            const isNew = String(group._id).startsWith('rpg-');
            if (currentExamId && !isNew) {
                const numericGroupId = Number(String(group._id).replace(/[^0-9]/g, ''));
                if (numericGroupId > 0) {
                    await examAdminApi.deleteReadingPassageGroup(currentExamId, numericGroupId);
                }
            }
            const newGroups = readingPassageGroups.filter((_, i) => i !== index);
            setReadingPassageGroups(newGroups);
        } catch (error) {
            console.error('Error deleting reading passage group:', error);
            alert('Xóa thất bại');
        } finally {
            setLoading(false);
        }
    };

    // ── Fill Blank Group ──────────────────────────────────────────────────
    const addFillBlankGroup = () => {
        setFillBlankGroups([...fillBlankGroups, {
            _id: `fbg-${Date.now()}`,
            _localId: `fbg-${Date.now()}`,
            _order: Date.now(),
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
    };

    const saveFillBlankGroup = async (index: number, data: FillBlankGroupData, displayNumber: number) => {
        if (!currentExamId) {
            alert('Vui lòng tạo đề thi trước');
            return;
        }

        try {
            setLoading(true);
            const isNew = String(data._id).startsWith('fbg-');
            let realId = data._id;

            if (isNew) {
                const res = await examAdminApi.insertFillBlankGroup(currentExamId, {
                    clozeMode: data.clozeMode,
                    passageText: data.passageText,
                    passageImageUrl: data.passageImageUrl,
                    linkedOptions: data.linkedOptions,
                    subItems: data.subItems,
                    insertPosition: displayNumber,
                });
                realId = String(res.groupId || res.passageGroupId || res.id || res.data?.id || Date.now());
            } else {
                const numericGroupId = Number(String(data._id).replace(/[^0-9]/g, ''));
                await examAdminApi.updateFillBlankGroup(currentExamId, numericGroupId, {
                    clozeMode: data.clozeMode,
                    passageText: data.passageText,
                    passageImageUrl: data.passageImageUrl,
                    linkedOptions: data.linkedOptions,
                    subItems: data.subItems,
                });
            }

            const updated = [...fillBlankGroups];
            updated[index] = { ...updated[index], ...data, _id: realId };
            setFillBlankGroups(updated);

            if (data.subItems.length > 0) {
                setNextFillBlankStartNumber(data.subItems.length);
            }

            alert(`Điền từ đã lưu! (${data.subItems.length} chỗ trống)`);
        } catch (error) {
            console.error('Error saving fill blank group:', error);
            if (isMissingExamError(error)) {
                handleMissingCurrentExam();
                return;
            }
            alert('Lưu điền từ thất bại: ' + (error as any)?.response?.data?.message || '');
        } finally {
            setLoading(false);
        }
    };

    const deleteFillBlankGroup = async (index: number) => {
        const group = fillBlankGroups[index];
        if (!confirm('Xóa nhóm điền từ này?')) return;
        try {
            setLoading(true);
            const isNew = String(group._id).startsWith('fbg-');
            if (currentExamId && !isNew) {
                const numericGroupId = Number(String(group._id).replace(/[^0-9]/g, ''));
                if (numericGroupId > 0) {
                    await examAdminApi.deleteFillBlankGroup(currentExamId, numericGroupId);
                }
            }
            const newGroups = fillBlankGroups.filter((_, i) => i !== index);
            setFillBlankGroups(newGroups);
        } catch (error) {
            console.error('Error deleting fill blank group:', error);
            alert('Xóa thất bại');
        } finally {
            setLoading(false);
        }
    };

    const handlePdfImportPreviewLoaded = (preview: PdfImportPreview) => {
        setPdfImportPreview(preview);

        if (preview.exam?.title || preview.exam?.duration || preview.exam?.totalPoints) {
            setExamData(prev => ({
                ...prev,
                title: prev.title || preview.exam?.title || '',
                duration: preview.exam?.duration || prev.duration,
                totalPoints: preview.exam?.totalPoints || prev.totalPoints,
            }));
            setExamMetadataDirty(true);
        }
    };

    const savePdfImportedQuestions = async (itemsOverride?: ImportedExamItem[]) => {
        const importItems = itemsOverride?.length ? itemsOverride : getImportPreviewItems(pdfImportPreview);
        if (!currentExamId || !importItems.length) return;

        const validationError = validateImportedItems(importItems);
        if (validationError) {
            alert(validationError);
            return;
        }

        try {
            setPdfImportSaving(true);
            const response = await examAdminApi.bulkImportQuestions(currentExamId, importItems);
            const orderBase = Date.now();
            const insertedItems = Array.isArray(response?.insertedItems) ? response.insertedItems : [];
            const insertedSingles = insertedItems.filter((item: any) => item.itemType === 'single_choice');
            const localQuestions = importItems
                .filter((item): item is ImportedQuestionData => item.itemType !== 'reading_group' && item.itemType !== 'fill_blank_group')
                .map((question, index) => {
                    const inserted = insertedSingles[index];
                    const savedQuestionId = Number(inserted?.id || inserted?.questionId) || undefined;
                    return {
                        _id: savedQuestionId ? `q-${savedQuestionId}` : `import-single-${orderBase}-${index}`,
                        _order: orderBase + index,
                        _savedQuestionId: savedQuestionId,
                        questionType: 'single_choice' as const,
                        questionText: question.questionText || '',
                        questionTextCn: question.questionTextCn || '',
                        imageUrl: question.imageUrl || '',
                        passageText: '',
                        passageImageUrl: '',
                        points: question.points || 1,
                        explanation: question.explanation || '',
                        explanationCn: question.explanationCn || '',
                        answers: (question.answers || []).map(answer => ({
                            text: answer.text || '',
                            textCn: answer.textCn || '',
                            imageUrl: answer.imageUrl || '',
                        })),
                        correctAnswer: question.correctAnswer || '',
                        linkedOptions: [],
                        correctAnswerKey: '',
                        subQuestionNumber: 0,
                        difficulty: question.difficulty || 'medium',
                    };
                });
            const localReadingGroups = importItems
                .filter((item): item is Extract<ImportedExamItem, { itemType: 'reading_group' }> => item.itemType === 'reading_group')
                .map((group, index) => {
                    const inserted = insertedItems.filter((item: any) => item.itemType === 'reading_group')[index];
                    return {
                        _id: String(inserted?.groupId || `rpg-${orderBase}-${index}`),
                        _localId: `import-reading-${orderBase}-${index}`,
                        _order: orderBase + localQuestions.length + index,
                        passageText: group.passageText || '',
                        passageImageUrl: group.passageImageUrl || '',
                        subQuestions: group.subQuestions.map((subQuestion, subIndex) => ({
                            _localId: `import-reading-sub-${orderBase}-${index}-${subIndex}`,
                            questionText: subQuestion.questionText || '',
                            questionTextCn: subQuestion.questionTextCn || '',
                            imageUrl: subQuestion.imageUrl || '',
                            points: subQuestion.points || 1,
                            explanation: subQuestion.explanation || '',
                            explanationCn: subQuestion.explanationCn || '',
                            answers: (subQuestion.answers || []).map(answer => ({
                                text: answer.text || '',
                                textCn: answer.textCn || '',
                                imageUrl: answer.imageUrl || '',
                            })),
                            correctAnswer: subQuestion.correctAnswer || '',
                            difficulty: subQuestion.difficulty || 'medium',
                            subQuestionNumber: subQuestion.subQuestionNumber || subIndex + 1,
                        })),
                    };
                });
            const localFillBlankGroups = importItems
                .filter((item): item is Extract<ImportedExamItem, { itemType: 'fill_blank_group' }> => item.itemType === 'fill_blank_group')
                .map((group, index) => {
                    const inserted = insertedItems.filter((item: any) => item.itemType === 'fill_blank_group')[index];
                    return {
                        _id: String(inserted?.groupId || `fbg-${orderBase}-${index}`),
                        _localId: `import-fill-${orderBase}-${index}`,
                        _order: orderBase + localQuestions.length + localReadingGroups.length + index,
                        clozeMode: group.clozeMode || 'sentences',
                        passageText: group.passageText || '',
                        passageImageUrl: group.passageImageUrl || '',
                        linkedOptions: group.linkedOptions || [],
                        subItems: group.subItems.map((subItem, subIndex) => ({
                            _localId: `import-fill-sub-${orderBase}-${index}-${subIndex}`,
                            questionText: subItem.questionText || '',
                            questionTextCn: subItem.questionTextCn || '',
                            points: subItem.points || 1,
                            explanation: subItem.explanation || '',
                            explanationCn: subItem.explanationCn || '',
                            correctAnswerKey: subItem.correctAnswerKey || 'A',
                            difficulty: subItem.difficulty || 'medium',
                            subQuestionNumber: subItem.subQuestionNumber || subIndex + 1,
                        })),
                    };
                });
            setQuestions(prev => [...prev, ...localQuestions]);
            setReadingPassageGroups(prev => [...prev, ...localReadingGroups]);
            setFillBlankGroups(prev => [...prev, ...localFillBlankGroups]);
            setPdfImportPreview(null);
            alert(`Đã import ${response?.insertedCount || getImportItemsQuestionCount(importItems)} câu vào đề nháp`);
        } catch (error: any) {
            console.error('Error saving imported questions:', error);
            alert(error?.response?.data?.message || 'Lưu câu hỏi import thất bại');
        } finally {
            setPdfImportSaving(false);
        }
    };

    const publishExam = async () => {
        if (!currentExamId) {
            alert('Vui lòng tạo đề thi và thêm câu hỏi trước');
            return;
        }

        const totalQuestions =
            questions.length +
            readingPassageGroups.reduce((acc, g) => acc + (g.subQuestions?.length || 0), 0) +
            fillBlankGroups.reduce((acc, g) => acc + (g.subItems?.length || 0), 0);

        if (totalQuestions === 0) {
            alert('Vui lòng thêm ít nhất một câu hỏi');
            return;
        }

        try {
            setLoading(true);

            // For room exams, save schedule before publishing so a failed schedule
            // cannot accidentally publish the exam into the free-practice list.
            if (examData.start_time) {
                await examAdminApi.setSchedule(currentExamId, {
                    start_time: examData.start_time,
                    end_time: examData.end_time || null,
                });
            }

            // Publish exam with current metadata to save any unsaved changes
            await examAdminApi.updateExam(currentExamId, { ...examData, status: 'published' } as any);

            alert('Xuất bản đề thi thành công!');
            sessionStorage.removeItem('currentExamId');
            router.push('/admin/exams');
        } catch (error) {
            console.error('Error publishing exam:', error);
            if (isMissingExamError(error)) {
                handleMissingCurrentExam();
                return;
            }
            alert('Xuất bản đề thi thất bại');
        } finally {
            setLoading(false);
        }
    };

    const pdfPreviewItems = getImportPreviewItems(pdfImportPreview);

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-5xl mx-auto px-6">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Tạo Đề Thi Mới</h1>
                    <p className="text-gray-600 mt-2">Nhập thông tin đề thi và thêm câu hỏi</p>
                </div>

                {/* Exam Metadata Form */}
                <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-8">
                    {currentExamId && (
                        <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                            ✏️ Đã tạo đề — Metadata có thể chỉnh sửa
                        </div>
                    )}
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Thông Tin Đề Thi</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Tên đề thi *</label>
                            <input
                                type="text"
                                value={examData.title}
                                onChange={(e) => { setExamData({ ...examData, title: e.target.value }); setExamMetadataDirty(true); }}
                                className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Nhập tên đề thi..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Tên đề thi (Tiếng Trung)</label>
                            <input
                                type="text"
                                value={examData.titleCn}
                                onChange={(e) => { setExamData({ ...examData, titleCn: e.target.value }); setExamMetadataDirty(true); }}
                                className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="输入中文标题..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Môn học *</label>
                            <select
                                value={examData.subjectId}
                                onChange={(e) => { setExamData({ ...examData, subjectId: parseInt(e.target.value) }); setExamMetadataDirty(true); }}
                                className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value={0}>Chọn môn học...</option>
                                {Array.isArray(subjects) && subjects.map(subject => (
                                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Thời gian (phút)</label>
                            <input
                                type="number"
                                value={examData.duration}
                                onChange={(e) => { setExamData({ ...examData, duration: parseInt(e.target.value) }); setExamMetadataDirty(true); }}
                                className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Tổng điểm</label>
                            <input
                                type="number"
                                value={examData.totalPoints}
                                onChange={(e) => { setExamData({ ...examData, totalPoints: parseDecimal(e.target.value) }); setExamMetadataDirty(true); }}
                                min="0"
                                step="0.1"
                                className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Độ khó</label>
                            <select
                                value={examData.difficulty_level || 'medium'}
                                onChange={(e) => { setExamData({ ...examData, difficulty_level: e.target.value }); setExamMetadataDirty(true); }}
                                className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="easy">Dễ</option>
                                <option value="medium">Trung bình</option>
                                <option value="hard">Khó</option>
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Mô tả</label>
                            <textarea
                                value={examData.description}
                                onChange={(e) => { setExamData({ ...examData, description: e.target.value }); setExamMetadataDirty(true); }}
                                rows={3}
                                className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Nhập mô tả đề thi..."
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Video Giải Đề (URL)</label>
                            <input
                                type="url"
                                value={examData.solution_video_url || ''}
                                onChange={(e) => setExamData({ ...examData, solution_video_url: e.target.value })}
                                className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="https://www.youtube.com/watch?v=..."
                            />
                            <p className="text-xs text-gray-400 mt-1">Dán link YouTube để hiển thị video giải đề chi tiết</p>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Mô Tả Video</label>
                            <textarea
                                value={examData.solution_description || ''}
                                onChange={(e) => setExamData({ ...examData, solution_description: e.target.value })}
                                rows={2}
                                className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Mô tả ngắn về nội dung video..."
                            />
                        </div>

                        <div className="md:col-span-2 border-t pt-4 mt-2">
                            <label className="flex items-center gap-3 cursor-pointer select-none">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        checked={examData.is_premium}
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            setExamData({ ...examData, is_premium: checked, vip_tier: checked ? 'vip' : 'basic' });
                                            setExamMetadataDirty(true);
                                        }}
                                        className="sr-only"
                                    />
                                    <div className={`w-11 h-6 rounded-full transition-colors ${examData.is_premium ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gray-300'}`} />
                                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${examData.is_premium ? 'translate-x-5' : 'translate-x-0'}`} />
                                </div>
                                <div className="flex items-center gap-2">
                                    <FaCrown className="text-amber-500" />
                                    <span className="text-sm font-semibold text-gray-700">Đánh dấu là đề VIP (VIP/Pre)</span>
                                </div>
                            </label>
                            <p className="text-xs text-gray-400 mt-1 ml-14">Chỉ thành viên VIP hoặc Pre mới được làm bài thi này</p>
                        </div>

                        <div className="md:col-span-2">
                            <label className="flex items-center gap-3 cursor-pointer select-none">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        checked={examData.shuffle_mode}
                                        onChange={(e) => setExamData({ ...examData, shuffle_mode: e.target.checked })}
                                        className="sr-only"
                                    />
                                    <div className={`w-11 h-6 rounded-full transition-colors ${examData.shuffle_mode ? 'bg-gradient-to-r from-blue-500 to-indigo-600' : 'bg-gray-300'}`} />
                                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${examData.shuffle_mode ? 'translate-x-5' : 'translate-x-0'}`} />
                                </div>
                                <div className="flex items-center gap-2">
                                    <svg className={`w-4 h-4 ${examData.shuffle_mode ? 'text-indigo-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    <span className="text-sm font-semibold text-gray-700">Chế độ xáo trộn câu hỏi</span>
                                </div>
                            </label>
                            <p className="text-xs text-gray-400 mt-1 ml-14">Mỗi lần làm bài, thứ tự câu hỏi và đáp án sẽ được xáo trộn ngẫu nhiên</p>
                        </div>

                        <div className="md:col-span-2">
                            <label className="flex items-center gap-3 cursor-pointer select-none">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        checked={examData.is_simulated}
                                        onChange={(e) => { setExamData({ ...examData, is_simulated: e.target.checked }); setExamMetadataDirty(true); }}
                                        className="sr-only"
                                    />
                                    <div className={`w-11 h-6 rounded-full transition-colors ${examData.is_simulated ? 'bg-gradient-to-r from-pink-500 to-rose-600' : 'bg-gray-300'}`} />
                                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${examData.is_simulated ? 'translate-x-5' : 'translate-x-0'}`} />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-gray-700">Đánh dấu là 🎯 Đề Mô Phỏng</span>
                                </div>
                            </label>
                            <p className="text-xs text-gray-400 mt-1 ml-14">Sử dụng cho hệ thống hiển thị trong giao diện lộ trình ôn luyện.</p>
                        </div>

                        {/* ── Phòng thi: Schedule ─────────────────────────────────── */}
                        <div className="md:col-span-2">
                            <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-base">🏢</span>
                                    <h3 className="text-sm font-bold text-indigo-800">Đặt lịch Phòng thi</h3>
                                </div>
                                <p className="text-xs text-indigo-600 mb-3">Nếu có lịch thi, đề sẽ được xếp vào tab "Phòng thi". Để trống = đề Tự do / Mô phỏng.</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-semibold text-indigo-700 mb-1 block">Mở cổng thi lúc</label>
                                        <input
                                            type="datetime-local"
                                            value={examData.start_time}
                                            onChange={e => setExamData(prev => ({ ...prev, start_time: e.target.value }))}
                                            className="w-full bg-white text-gray-900 border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-indigo-700 mb-1 block">Đóng cổng thi lúc</label>
                                        <input
                                            type="datetime-local"
                                            value={examData.end_time}
                                            onChange={e => setExamData(prev => ({ ...prev, end_time: e.target.value }))}
                                            className="w-full bg-white text-gray-900 border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* VIP Tier */}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Phân loại nội dung</label>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { value: 'basic', label: 'Miễn phí', desc: 'Mọi người đều xem được', color: 'gray' },
                                    { value: 'vip', label: 'VIP', desc: 'Gói VIP & Premium', color: 'amber' },
                                ].map(tier => (
                                    <button key={tier.value}
                                        onClick={() => {
                                            setExamData({ ...examData, vip_tier: tier.value, is_premium: tier.value !== 'basic' });
                                            setExamMetadataDirty(true);
                                        }}
                                        className={`relative p-3 rounded-xl border-2 text-left transition-all ${
                                            examData.vip_tier === tier.value
                                                ? tier.color === 'amber' ? 'border-amber-500 bg-amber-50' :
                                                  'border-gray-500 bg-gray-100'
                                                : 'border-gray-200 hover:border-gray-300 bg-white'
                                        }`}>
                                        <p className={`text-sm font-bold ${examData.vip_tier === tier.value ? 'text-gray-900' : 'text-gray-700'}`}>
                                            {tier.label}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-0.5">{tier.desc}</p>
                                    {examData.vip_tier === tier.value && (
                                        <div className={`absolute top-2 right-2 w-4 h-4 rounded-full ${
                                            tier.color === 'amber' ? 'bg-amber-500' : 'bg-gray-500'
                                        }`}>
                                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-gray-400 mt-2">VIP & Premium dùng chung đề. Chỉ khác chức năng bổ sung.</p>
                        </div>
                    </div>

                    {!currentExamId && (
                        <button
                            onClick={createExam}
                            disabled={loading}
                            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loading ? 'Đang tạo...' : 'Tạo Đề Thi'}
                        </button>
                    )}

                    {currentExamId && examMetadataDirty && (
                        <button
                            onClick={saveMetadata}
                            disabled={savingMetadata}
                            className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            {savingMetadata ? 'Đang lưu...' : '💾 Lưu metadata'}
                        </button>
                    )}

                    {currentExamId && metadataSaved && !examMetadataDirty && (
                        <span className="mt-4 ml-4 inline-flex items-center gap-1 text-green-600 font-medium text-sm">
                            ✅ Đã lưu
                        </span>
                    )}
                </div>

                {/* Questions Section */}
                {currentExamId && (
                    <>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-gray-900">Câu Hỏi ({totalQuestionCount})</h2>
                            <div className="flex items-center space-x-3">
                                {!showAddForm && (
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={addFillBlankGroup}
                                            className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                                        >
                                            <span>📝 Thêm Điền Từ</span>
                                        </button>
                                        <button
                                            onClick={addReadingPassageGroup}
                                            className="flex items-center space-x-2 px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700"
                                        >
                                            <span>📖 Thêm Đọc Hiểu</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                const nextNum = totalQuestionCount + 1;
                                                setPendingQuestions(prev => [...prev, {
                                                    _pending: true as const,
                                                    _localId: `pending-${Date.now()}`,
                                                    _questionNumber: nextNum,
                                                    _questionType: 'single_choice',
                                                }]);
                                                setShowAddForm(true);
                                            }}
                                            className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                                        >
                                            <FiPlus />
                                            <span>Câu Trắc Nghiệm</span>
                                        </button>
                                    </div>
                                )}
                                {showAddForm && (
                                    <button
                                        onClick={() => {
                                            setPendingQuestions([]);
                                            setShowAddForm(false);
                                        }}
                                        className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 border border-gray-300"
                                    >
                                        <FiX />
                                        <span>Hủy thêm</span>
                                    </button>
                                )}
                                <button
                                    onClick={publishExam}
                                    disabled={loading || totalQuestionCount === 0}
                                    className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                                >
                                    <FiEye />
                                    <span>Xuất Bản</span>
                                </button>
                            </div>
                        </div>

                        <PdfImportPanel
                            canImport={Boolean(currentExamId)}
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
                        {showAddForm && pendingQuestions.map(q => (
                            <QuestionEditor
                                key={q._localId}
                                questionNumber={q._questionNumber}
                                initialQuestionType={q._questionType as any}
                                onSave={(data) => {
                                    handleQuickAddSave(data);
                                    setShowAddForm(false);
                                }}
                                onDelete={() => {
                                    setPendingQuestions([]);
                                    setShowAddForm(false);
                                }}
                                onCancel={() => {
                                    setPendingQuestions([]);
                                    setShowAddForm(false);
                                }}
                            />
                        ))}

                        {/* All questions rendered in order (single + groups interleaved) */}
                        {allQuestions.length === 0 && !showAddForm ? (
                            <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
                                <p className="text-gray-500 mb-4">Chưa có câu hỏi nào</p>
                                <div className="flex justify-center gap-3">
                                    <button
                                        onClick={addFillBlankGroup}
                                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                                    >
                                        📝 Thêm Điền Từ
                                    </button>
                                    <button
                                        onClick={addReadingPassageGroup}
                                        className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                                    >
                                        📖 Thêm Đọc Hiểu
                                    </button>
                                    <button
                                        onClick={() => {
                                            setPendingQuestions([{
                                                _pending: true as const,
                                                _localId: `pending-${Date.now()}`,
                                                _questionNumber: 1,
                                                _questionType: 'single_choice',
                                            }]);
                                            setShowAddForm(true);
                                        }}
                                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                    >
                                        🔘 Thêm Trắc Nghiệm
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {allQuestions.map((item, idx) => {
                                    if (item.type === 'single') {
                                        return (
                                            <QuestionEditor
                                                key={item.question._id}
                                                questionNumber={item.displayNumber}
                                                initialData={item.question}
                                                savedQuestionId={item.question._savedQuestionId}
                                                onSave={(data) => saveQuestion(item.index, data, item.displayNumber)}
                                                onDelete={() => deleteQuestion(item.index)}
                                            />
                                        );
                                    }
                                    if (item.type === 'reading') {
                                        return (
                                            <ReadingPassageGroup
                                                key={item.group._id}
                                                startNumber={item.displayNumber}
                                                initialData={item.group}
                                                onSave={(data) => saveReadingPassageGroup(item.index, data, item.displayNumber)}
                                                onDelete={() => deleteReadingPassageGroup(item.index)}
                                            />
                                        );
                                    }
                                    if (item.type === 'fill') {
                                        return (
                                            <FillBlankGroup
                                                key={item.group._id}
                                                startNumber={item.displayNumber}
                                                initialData={item.group}
                                                onSave={(data) => saveFillBlankGroup(item.index, data, item.displayNumber)}
                                                onDelete={() => deleteFillBlankGroup(item.index)}
                                            />
                                        );
                                    }
                                    return null;
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
