'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiPlus, FiSave, FiEye } from 'react-icons/fi';
import QuestionEditor, { QuestionFormData } from '@/components/admin/QuestionEditor';
import { examAdminApi } from '@/lib/api/examAdmin';

interface Subject {
    id: number;
    name: string;
    code: string;
}

export default function CreateExamPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [subjects, setSubjects] = useState<Subject[]>([]);

    // Exam metadata
    const [examData, setExamData] = useState({
        title: '',
        subjectId: 0,
        duration: 90,
        totalPoints: 100,
        description: ''
    });

    const parseDecimal = (raw: string) => {
        const normalized = raw.replace(',', '.').trim();
        if (!normalized) return 0;
        const parsed = Number.parseFloat(normalized);
        return Number.isFinite(parsed) ? parsed : 0;
    };

    // Questions with unique IDs
    const [questions, setQuestions] = useState<(QuestionFormData & { _id: string })[]>([]);
    const [currentExamId, setCurrentExamId] = useState<number | null>(null);
    const [mounted, setMounted] = useState(false);

    // Restore currentExamId from sessionStorage after mount (client-side only)
    useEffect(() => {
        setMounted(true);
        const saved = sessionStorage.getItem('currentExamId');
        if (saved) {
            setCurrentExamId(parseInt(saved));
        }
    }, []);

    useEffect(() => {
        fetchSubjects();
    }, []);

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
            const response = await fetch('http://localhost:5000/api/subjects');
            const data = await response.json();
            setSubjects(data);
        } catch (error) {
            console.error('Error fetching subjects:', error);
        }
    };

    const createExam = async () => {
        if (!examData.title || !examData.subjectId) {
            alert('Please enter exam title and select subject');
            return;
        }

        try {
            setLoading(true);
            const response = await examAdminApi.createExam(examData);
            setCurrentExamId(response.exam.id);
            alert('Exam created! Now add questions.');
        } catch (error) {
            console.error('Error creating exam:', error);
            alert('Failed to create exam');
        } finally {
            setLoading(false);
        }
    };

    const addQuestion = () => {
        setQuestions([...questions, {
            _id: `q-${Date.now()}-${Math.random()}`, // Unique stable ID
            questionText: '',
            questionTextCn: '',
            imageUrl: '',
            points: 1,
            explanation: '',
            explanationCn: '',
            answers: [
                { text: '', textCn: '', imageUrl: '' },
                { text: '', textCn: '', imageUrl: '' },
                { text: '', textCn: '', imageUrl: '' },
                { text: '', textCn: '', imageUrl: '' }
            ],
            correctAnswer: 'A'
        }]);
    };

    const saveQuestion = async (index: number, data: QuestionFormData) => {
        if (!currentExamId) {
            alert('Please create exam first');
            return;
        }

        try {
            setLoading(true);
            await examAdminApi.addQuestion(currentExamId, data);
            alert(`Question ${index + 1} saved!`);

            // Update local state
            const newQuestions = [...questions];
            newQuestions[index] = data;
            setQuestions(newQuestions);
        } catch (error) {
            console.error('Error saving question:', error);
            alert('Failed to save question');
        } finally {
            setLoading(false);
        }
    };

    const deleteQuestion = (index: number) => {
        if (confirm('Delete this question?')) {
            const newQuestions = questions.filter((_, i) => i !== index);
            setQuestions(newQuestions);
        }
    };

    const publishExam = async () => {
        if (!currentExamId) {
            alert('Please create exam and add questions first');
            return;
        }

        if (questions.length === 0) {
            alert('Please add at least one question');
            return;
        }

        try {
            setLoading(true);
            await examAdminApi.updateExam(currentExamId, { status: 'published' } as any);
            alert('Exam published successfully!');
            router.push('/admin/exams');
        } catch (error) {
            console.error('Error publishing exam:', error);
            alert('Failed to publish exam');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-5xl mx-auto px-6">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Create New Exam</h1>
                    <p className="text-gray-600 mt-2">Fill in exam details and add questions</p>
                </div>

                {/* Exam Metadata Form */}
                <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-8">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Exam Information</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Exam Title *</label>
                            <input
                                type="text"
                                value={examData.title}
                                onChange={(e) => setExamData({ ...examData, title: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Enter exam title..."
                                disabled={!!currentExamId}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Subject *</label>
                            <select
                                value={examData.subjectId}
                                onChange={(e) => setExamData({ ...examData, subjectId: parseInt(e.target.value) })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                disabled={!!currentExamId}
                            >
                                <option value={0}>Select subject...</option>
                                {subjects.map(subject => (
                                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Duration (minutes)</label>
                            <input
                                type="number"
                                value={examData.duration}
                                onChange={(e) => setExamData({ ...examData, duration: parseInt(e.target.value) })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                disabled={!!currentExamId}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Total Points</label>
                            <input
                                type="number"
                                value={examData.totalPoints}
                                onChange={(e) => setExamData({ ...examData, totalPoints: parseDecimal(e.target.value) })}
                                min="0"
                                step="0.1"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                disabled={!!currentExamId}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                            <textarea
                                value={examData.description}
                                onChange={(e) => setExamData({ ...examData, description: e.target.value })}
                                rows={3}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Enter exam description..."
                                disabled={!!currentExamId}
                            />
                        </div>
                    </div>

                    {!currentExamId && (
                        <button
                            onClick={createExam}
                            disabled={loading}
                            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loading ? 'Creating...' : 'Create Exam'}
                        </button>
                    )}
                </div>

                {/* Questions Section */}
                {currentExamId && (
                    <>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-gray-900">Questions ({questions.length})</h2>
                            <div className="flex items-center space-x-3">
                                <button
                                    onClick={addQuestion}
                                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                                >
                                    <FiPlus />
                                    <span>Add Question</span>
                                </button>
                                <button
                                    onClick={publishExam}
                                    disabled={loading || questions.length === 0}
                                    className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                                >
                                    <FiEye />
                                    <span>Publish Exam</span>
                                </button>
                            </div>
                        </div>

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
