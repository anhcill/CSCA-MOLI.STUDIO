'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiPlus, FiSave, FiEye } from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import QuestionEditor, { QuestionFormData } from '@/components/admin/QuestionEditor';
import ReadingPassageGroup, { ReadingPassageGroupData } from '@/components/admin/ReadingPassageGroup';
import FillBlankGroup, { FillBlankGroupData } from '@/components/admin/FillBlankGroup';
import { examAdminApi } from '@/lib/api/examAdmin';
import { useAuthStore } from '@/lib/store/authStore';
import { hasPermission } from '@/lib/utils/permissions';
import axios from '@/lib/utils/axios';

interface Subject {
    id: number;
    name: string;
    code: string;
}

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
    const [questions, setQuestions] = useState<(QuestionFormData & { _id: string })[]>([]);
    // Reading passage groups (đoạn văn + nhiều câu con gom chung 1 card)
    const [readingPassageGroups, setReadingPassageGroups] = useState<(ReadingPassageGroupData & { _id: string })[]>([]);
    // Fill blank groups (điền từ + nhiều chỗ trống gom chung 1 card)
    const [fillBlankGroups, setFillBlankGroups] = useState<(FillBlankGroupData & { _id: string })[]>([]);
    // Số câu tiếp theo cho đoạn đọc hiểu (VD: đề đã có 72 câu → startNumber = 73)
    const [nextPassageStartNumber, setNextPassageStartNumber] = useState(1);
    // Số câu tiếp theo cho điền từ (VD: đã có 10 câu → startNumber = 11)
    const [nextFillBlankStartNumber, setNextFillBlankStartNumber] = useState(1);
    const [currentExamId, setCurrentExamId] = useState<number | null>(null);
    const [examMetadataDirty, setExamMetadataDirty] = useState(false);
    const [savingMetadata, setSavingMetadata] = useState(false);
    const [metadataSaved, setMetadataSaved] = useState(false);
    const [mounted, setMounted] = useState(false);

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
            alert('Lưu metadata thất bại');
        } finally {
            setSavingMetadata(false);
        }
    };

    const addQuestion = () => {
        setQuestions([...questions, {
            _id: `q-${Date.now()}-${Math.random()}`,
            questionType: 'single_choice' as const,
            questionText: '',
            questionTextCn: '',
            imageUrl: '',
            passageText: '',
            passageImageUrl: '',
            points: 1,
            explanation: '',
            explanationCn: '',
            answers: [
                { text: '', textCn: '', imageUrl: '' },
                { text: '', textCn: '', imageUrl: '' },
                { text: '', textCn: '', imageUrl: '' },
                { text: '', textCn: '', imageUrl: '' }
            ],
            correctAnswer: 'A',
            linkedOptions: [
                { key: 'A', text: '', textCn: '' },
                { key: 'B', text: '', textCn: '' },
                { key: 'C', text: '', textCn: '' },
                { key: 'D', text: '', textCn: '' },
                { key: 'E', text: '', textCn: '' },
                { key: 'F', text: '', textCn: '' },
            ],
            correctAnswerKey: 'A',
            subQuestionNumber: 0,
            difficulty: 'medium',
        }]);
    };

    const saveQuestion = async (index: number, data: QuestionFormData) => {
        if (!currentExamId) {
            alert('Vui lòng tạo đề thi trước');
            return;
        }

        try {
            setLoading(true);
            const res = await examAdminApi.addQuestion(currentExamId, data as any);

            // Update local state với thông tin từ backend
            const newQuestions = [...questions];
            const dataWithId = data as QuestionFormData & { _id?: string };
            newQuestions[index] = {
                ...newQuestions[index],
                ...data,
                _id: dataWithId._id || `q-${res.questionId}`,
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
            alert(`${typeLabel[res.questionType] || 'Câu hỏi'} ${index + 1} đã được lưu!`);
        } catch (error) {
            console.error('Error saving question:', error);
            alert('Lưu câu hỏi thất bại: ' + (error as any)?.response?.data?.message || '');
        } finally {
            setLoading(false);
        }
    };

    const deleteQuestion = (index: number) => {
        if (confirm('Xóa câu hỏi này?')) {
            const newQuestions = questions.filter((_, i) => i !== index);
            setQuestions(newQuestions);
        }
    };

    // ── Reading Passage Group ──────────────────────────────────────────────
    const addReadingPassageGroup = () => {
        setReadingPassageGroups([...readingPassageGroups, {
            _id: `rpg-${Date.now()}`,
            _localId: `rg-${Date.now()}`,
            passageText: '',
            passageImageUrl: '',
            subQuestions: [],
        }]);
    };

    const saveReadingPassageGroup = async (index: number, data: ReadingPassageGroupData) => {
        if (!currentExamId) {
            alert('Vui lòng tạo đề thi trước');
            return;
        }

        try {
            setLoading(true);
            // 1. Lưu đoạn văn (reading_passage)
            const passageRes = await examAdminApi.addQuestion(currentExamId, {
                questionType: 'reading_passage',
                questionText: '',
                questionTextCn: '',
                passageText: data.passageText,
                passageImageUrl: data.passageImageUrl,
                points: 0,
                difficulty: 'medium',
            });

            const passageGroupId = passageRes.passageGroupId || passageRes.questionId;

            // 2. Lưu từng câu con (reading_item)
            const savedSubIds: number[] = [];
            for (const sq of data.subQuestions) {
                const itemRes = await examAdminApi.addQuestion(currentExamId, {
                    questionType: 'reading_item',
                    questionText: sq.questionText,
                    questionTextCn: sq.questionTextCn,
                    imageUrl: sq.imageUrl,
                    passageText: '', // đã nằm ở passage cha
                    points: sq.points,
                    explanation: sq.explanation,
                    explanationCn: sq.explanationCn,
                    answers: sq.answers,
                    correctAnswer: sq.correctAnswer,
                    difficulty: sq.difficulty,
                    subQuestionNumber: sq.subQuestionNumber,
                });
                savedSubIds.push(itemRes.questionId);
            }

            // 3. Cập nhật local state
            const updated = [...readingPassageGroups];
            updated[index] = {
                ...data,
                _id: updated[index]._id,
            };
            setReadingPassageGroups(updated);

            // 4. Cập nhật số câu tiếp theo
            const lastSub = data.subQuestions[data.subQuestions.length - 1];
            if (lastSub) {
                setNextPassageStartNumber(lastSub.subQuestionNumber + 1);
            }

            alert(`Đoạn đọc hiểu đã lưu! (${data.subQuestions.length} câu)`);
        } catch (error) {
            console.error('Error saving reading passage group:', error);
            alert('Lưu đoạn đọc hiểu thất bại: ' + (error as any)?.response?.data?.message || '');
        } finally {
            setLoading(false);
        }
    };

    const deleteReadingPassageGroup = (index: number) => {
        if (confirm('Xóa đoạn đọc hiểu này?')) {
            const newGroups = readingPassageGroups.filter((_, i) => i !== index);
            setReadingPassageGroups(newGroups);
        }
    };

    // ── Fill Blank Group ──────────────────────────────────────────────────
    const addFillBlankGroup = () => {
        setFillBlankGroups([...fillBlankGroups, {
            _id: `fbg-${Date.now()}`,
            _localId: `fbg-${Date.now()}`,
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

    const saveFillBlankGroup = async (index: number, data: FillBlankGroupData) => {
        if (!currentExamId) {
            alert('Vui lòng tạo đề thi trước');
            return;
        }

        try {
            setLoading(true);
            // 1. Lưu pool (fill_blank_pool)
            const poolRes = await examAdminApi.addQuestion(currentExamId, {
                questionType: 'fill_blank_pool',
                questionText: '',
                questionTextCn: '',
                passageText: data.passageText,
                passageImageUrl: data.passageImageUrl,
                linkedOptions: data.linkedOptions,
                points: 0,
                difficulty: 'medium',
            });

            // 2. Lưu từng chỗ trống (fill_blank_item)
            for (const item of data.subItems) {
                await examAdminApi.addQuestion(currentExamId, {
                    questionType: 'fill_blank_item',
                    questionText: item.questionText,
                    questionTextCn: item.questionTextCn,
                    points: item.points,
                    explanation: item.explanation,
                    explanationCn: item.explanationCn,
                    correctAnswerKey: item.correctAnswerKey,
                    difficulty: item.difficulty,
                    subQuestionNumber: item.subQuestionNumber,
                });
            }

            // 3. Cập nhật local state
            const updated = [...fillBlankGroups];
            updated[index] = { ...data, _id: updated[index]._id };
            setFillBlankGroups(updated);

            // 4. Cập nhật số câu tiếp theo
            const lastItem = data.subItems[data.subItems.length - 1];
            if (lastItem) {
                setNextFillBlankStartNumber(lastItem.subQuestionNumber + 1);
            }

            alert(`Điền từ đã lưu! (${data.subItems.length} chỗ trống)`);
        } catch (error) {
            console.error('Error saving fill blank group:', error);
            alert('Lưu điền từ thất bại: ' + (error as any)?.response?.data?.message || '');
        } finally {
            setLoading(false);
        }
    };

    const deleteFillBlankGroup = (index: number) => {
        if (confirm('Xóa nhóm điền từ này?')) {
            const newGroups = fillBlankGroups.filter((_, i) => i !== index);
            setFillBlankGroups(newGroups);
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

            // Publish exam with current metadata to save any unsaved changes
            await examAdminApi.updateExam(currentExamId, { ...examData, status: 'published' } as any);

            // Set schedule if start_time is provided
            if (examData.start_time) {
                try {
                    await examAdminApi.setSchedule(currentExamId, {
                        start_time: examData.start_time,
                        end_time: examData.end_time || null,
                    });
                } catch (scheduleErr) {
                    console.warn('Could not set schedule:', scheduleErr);
                }
            }

            alert('Xuất bản đề thi thành công!');
            sessionStorage.removeItem('currentExamId');
            router.push('/admin/exams');
        } catch (error) {
            console.error('Error publishing exam:', error);
            alert('Xuất bản đề thi thất bại');
        } finally {
            setLoading(false);
        }
    };

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
                                        onChange={(e) => { setExamData({ ...examData, is_premium: e.target.checked }); setExamMetadataDirty(true); }}
                                        className="sr-only"
                                    />
                                    <div className={`w-11 h-6 rounded-full transition-colors ${examData.is_premium ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gray-300'}`} />
                                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${examData.is_premium ? 'translate-x-5' : 'translate-x-0'}`} />
                                </div>
                                <div className="flex items-center gap-2">
                                    <FaCrown className="text-amber-500" />
                                    <span className="text-sm font-semibold text-gray-700">Đánh dấu là đề thi VIP / PRO</span>
                                </div>
                            </label>
                            <p className="text-xs text-gray-400 mt-1 ml-14">Chỉ thành viên PRO mới được làm bài thi này</p>
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
                                        onClick={() => setExamData({ ...examData, vip_tier: tier.value })}
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
                            <h2 className="text-2xl font-bold text-gray-900">Câu Hỏi ({questions.length + readingPassageGroups.reduce((acc, g) => acc + (g.subQuestions?.length || 0), 0) + fillBlankGroups.reduce((acc, g) => acc + (g.subItems?.length || 0), 0)})</h2>
                            <div className="flex items-center space-x-3">
                                <button
                                    onClick={addFillBlankGroup}
                                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                                >
                                    <FiPlus />
                                    <span>📝 Điền Từ</span>
                                </button>
                                <button
                                    onClick={addReadingPassageGroup}
                                    className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                                >
                                    <FiPlus />
                                    <span>📖 Đọc Hiểu</span>
                                </button>
                                <button
                                    onClick={addQuestion}
                                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    <FiPlus />
                                    <span>Trắc Nghiệm</span>
                                </button>
                                <button
                                    onClick={publishExam}
                                    disabled={loading || (questions.length === 0 && fillBlankGroups.length === 0 && readingPassageGroups.length === 0)}
                                    className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                                >
                                    <FiEye />
                                    <span>Xuất Bản</span>
                                </button>
                            </div>
                        </div>

                        {/* Fill Blank Groups */}
                        {fillBlankGroups.map((group, index) => (
                            <FillBlankGroup
                                key={group._id}
                                startNumber={nextFillBlankStartNumber > 1
                                    ? nextFillBlankStartNumber
                                    : questions.length + readingPassageGroups.reduce((acc, g) => acc + (g.subQuestions?.length || 0), 0) + index * 3 + 1}
                                initialData={group}
                                onSave={(data) => saveFillBlankGroup(index, data)}
                                onDelete={() => deleteFillBlankGroup(index)}
                            />
                        ))}

                        {/* Reading Passage Groups */}
                        {readingPassageGroups.map((group, index) => (
                            <ReadingPassageGroup
                                key={group._id}
                                startNumber={nextPassageStartNumber > 1
                                    ? nextPassageStartNumber
                                    : questions.length + index * 3 + 1}
                                initialData={group}
                                onSave={(data) => saveReadingPassageGroup(index, data)}
                                onDelete={() => deleteReadingPassageGroup(index)}
                            />
                        ))}

                        {/* Single Questions */}
                        <div className="space-y-6">
                            {questions.map((question, index) => (
                                <QuestionEditor
                                    key={question._id}
                                    questionNumber={index + 1}
                                    initialData={question}
                                    onSave={(data) => saveQuestion(index, data)}
                                    onDelete={() => deleteQuestion(index)}
                                />
                            ))}

                            {questions.length === 0 && (
                                <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
                                    <p className="text-gray-500 mb-4">No questions yet</p>
                                    <button
                                        onClick={addQuestion}
                                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                    >
                                        Add First Question
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
