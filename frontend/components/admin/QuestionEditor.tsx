'use client';

import { useState, useRef, useEffect } from 'react';
import { FiTrash2, FiSave } from 'react-icons/fi';
import ImageUpload from './ImageUpload';

export interface QuestionFormData {
    questionText: string;
    questionTextCn: string;
    imageUrl: string;
    passageText?: string;
    passageImageUrl?: string;
    questionGroupType?: string;
    points: number;
    explanation: string;
    explanationCn: string;
    answers: {
        text: string;
        textCn: string;
        imageUrl: string;
    }[];
    correctAnswer: string;
}

interface QuestionEditorProps {
    questionNumber: number;
    initialData?: Partial<QuestionFormData>;
    onSave: (data: QuestionFormData) => void;
    onDelete?: () => void;
}

export default function QuestionEditor({ questionNumber, initialData, onSave, onDelete }: QuestionEditorProps) {
    const [formData, setFormData] = useState<QuestionFormData>(() => ({
        questionText: initialData?.questionText || '',
        questionTextCn: initialData?.questionTextCn || '',
        imageUrl: initialData?.imageUrl || '',
        passageText: initialData?.passageText || '',
        passageImageUrl: initialData?.passageImageUrl || '',
        questionGroupType: initialData?.questionGroupType || 'standard',
        points: initialData?.points || 1,
        explanation: initialData?.explanation || '',
        explanationCn: initialData?.explanationCn || '',
        answers: initialData?.answers && initialData.answers.length >= 2 ? initialData.answers : [
            { text: '', textCn: '', imageUrl: '' },
            { text: '', textCn: '', imageUrl: '' },
            { text: '', textCn: '', imageUrl: '' },
            { text: '', textCn: '', imageUrl: '' }
        ],
        correctAnswer: initialData?.correctAnswer || 'A'
    }));

    const handleSave = () => {
        // Validation
        if (!formData.questionText.trim() && !formData.questionTextCn.trim()) {
            alert('Vui lòng nhập nội dung câu hỏi (Tiếng Anh hoặc Tiếng Trung)');
            return;
        }

        const hasAllAnswers = formData.answers.every(
            (a) => a.text.trim() || a.textCn.trim()
        );
        if (!hasAllAnswers) {
            alert('Mỗi đáp án phải có nội dung (Tiếng Anh hoặc Tiếng Trung)');
            return;
        }

        onSave(formData);
    };

    const answerKeys = formData.answers.map((_, index) => String.fromCharCode(65 + index));

    const addOption = () => {
        if (formData.answers.length >= 8) return;
        setFormData({
            ...formData,
            answers: [...formData.answers, { text: '', textCn: '', imageUrl: '' }]
        });
    };

    const removeOption = (index: number) => {
        if (formData.answers.length <= 2) return;
        const newAnswers = formData.answers.filter((_, i) => i !== index);
        let newCorrect = formData.correctAnswer;
        const removedKey = String.fromCharCode(65 + index);
        if (newCorrect === removedKey) {
            newCorrect = 'A';
        } else if (newCorrect > removedKey) {
            newCorrect = String.fromCharCode(newCorrect.charCodeAt(0) - 1);
        }
        setFormData({
            ...formData,
            answers: newAnswers,
            correctAnswer: newCorrect
        });
    };

    return (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">Câu hỏi {questionNumber}</h3>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={handleSave}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        <FiSave />
                        <span>Lưu Lại</span>
                    </button>
                    {onDelete && (
                        <button
                            onClick={onDelete}
                            className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                        >
                            <FiTrash2 />
                            <span>Xóa Bỏ</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Group Passage Details (Optional) */}
            <div className="space-y-4 bg-purple-50 p-4 rounded-lg border border-purple-100">
                <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-purple-900">Tạo Nhóm / Đoạn Văn (Tùy chọn)</h4>
                    <select
                        value={formData.questionGroupType}
                        onChange={(e) => setFormData({ ...formData, questionGroupType: e.target.value })}
                        className="px-3 py-1 border border-purple-200 rounded-md text-sm bg-white text-purple-900"
                    >
                        <option value="standard">Không có (Câu hỏi đơn độc lập)</option>
                        <option value="reading_passage_start">Bắt đầu một đoạn văn Đọc Hiểu dài</option>
                        <option value="fill_in_the_blank_pool_start">Bắt đầu nhóm Điền Từ (Dùng chung đáp án)</option>
                        <option value="in_group">Nằm trong nhóm phía trên (Dùng chung văn bản)</option>
                    </select>
                </div>
                {(formData.questionGroupType === 'reading_passage_start' || formData.questionGroupType === 'fill_in_the_blank_pool_start') && (
                    <>
                        <p className="text-xs text-purple-700">Hãy nhập nội dung đoạn văn dùng chung (Đọc hiểu, điền từ) vào ô bên dưới để ghim vào các câu hỏi phía sau.</p>
                        <textarea
                            value={formData.passageText}
                            onChange={(e) => setFormData({ ...formData, passageText: e.target.value })}
                            rows={3}
                            className="w-full px-4 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                            placeholder="Nhập nội dung đoạn văn..."
                        />
                        <ImageUpload
                            label="Ảnh đính kèm cho đoạn văn (Tùy chọn)"
                            currentImage={formData.passageImageUrl || ''}
                            onImageUploaded={(url) => setFormData({ ...formData, passageImageUrl: url })}
                        />
                    </>
                )}
            </div>

            {/* Question Text */}
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nội dung câu hỏi (Tiếng Anh)</label>
                    <textarea
                        value={formData.questionText}
                        onChange={(e) => setFormData({ ...formData, questionText: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Nhập nội dung câu hỏi bằng Tiếng Anh..."
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nội dung câu hỏi (Tiếng Trung)</label>
                    <textarea
                        value={formData.questionTextCn}
                        onChange={(e) => setFormData({ ...formData, questionTextCn: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="输入中文问题..."
                    />
                </div>

                {/* Question Image */}
                <ImageUpload
                    label="Hình ảnh câu hỏi (Tùy chọn)"
                    currentImage={formData.imageUrl}
                    onImageUploaded={(url) => setFormData({ ...formData, imageUrl: url })}
                />

                {/* Points */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Điểm số</label>
                    <input
                        type="number"
                        value={formData.points}
                        onChange={(e) => {
                            const normalized = e.target.value.replace(',', '.').trim();
                            const parsed = Number.parseFloat(normalized);
                            setFormData({
                                ...formData,
                                points: Number.isFinite(parsed) && parsed > 0 ? parsed : 1,
                            });
                        }}
                        min="0.1"
                        max="99.99"
                        step="0.1"
                        className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
            </div>

            {/* Answer Options */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900">Các Lựa Chọn Đáp Án ({formData.answers.length})</h4>
                    {formData.answers.length < 8 && (
                        <button
                            onClick={addOption}
                            className="text-sm px-3 py-1.5 bg-blue-50 text-blue-600 rounded border border-blue-200 hover:bg-blue-100 font-bold"
                        >
                            + Thêm Lựa Chọn
                        </button>
                    )}
                </div>

                {answerKeys.map((key, index) => (
                    <div key={key} className="border border-gray-200 rounded-lg p-4 space-y-3 relative">
                        {formData.answers.length > 2 && (
                            <button
                                onClick={() => removeOption(index)}
                                className="absolute top-4 right-4 text-gray-400 hover:text-red-500"
                                title="Xóa bỏ tùy chọn này"
                            >
                                <FiTrash2 />
                            </button>
                        )}
                        <div className="flex items-center space-x-3 pr-8">
                            <input
                                type="radio"
                                name="correctAnswer"
                                checked={formData.correctAnswer === key}
                                onChange={() => setFormData({ ...formData, correctAnswer: key })}
                                className="w-5 h-5 text-blue-600"
                            />
                            <span className="font-semibold text-gray-900">Phương án {key}</span>
                            {formData.correctAnswer === key && (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Đáp án đúng</span>
                            )}
                        </div>

                        <div>
                            <input
                                type="text"
                                value={formData.answers[index].text}
                                onChange={(e) => {
                                    const newAnswers = [...formData.answers];
                                    newAnswers[index].text = e.target.value;
                                    setFormData({ ...formData, answers: newAnswers });
                                }}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Nhập nội dung đáp án (Tiếng Anh)..."
                            />
                        </div>

                        <div>
                            <input
                                type="text"
                                value={formData.answers[index].textCn}
                                onChange={(e) => {
                                    const newAnswers = [...formData.answers];
                                    newAnswers[index].textCn = e.target.value;
                                    setFormData({ ...formData, answers: newAnswers });
                                }}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="答案文本 (中文)..."
                            />
                        </div>

                        <ImageUpload
                            label={`Hình ảnh phương án ${key} (Tùy chọn)`}
                            currentImage={formData.answers[index].imageUrl}
                            onImageUploaded={(url) => {
                                const newAnswers = [...formData.answers];
                                newAnswers[index].imageUrl = url;
                                setFormData({ ...formData, answers: newAnswers });
                            }}
                        />
                    </div>
                ))}
            </div>

            {/* Explanation */}
            <div className="space-y-4">
                <h4 className="font-semibold text-gray-900">Giải thích đáp án (Tùy chọn)</h4>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Giải thích (Tiếng Anh)</label>
                    <textarea
                        value={formData.explanation}
                        onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                        rows={2}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Giải thích đáp án đúng bằng Tiếng Anh..."
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Giải thích (Tiếng Trung)</label>
                    <textarea
                        value={formData.explanationCn}
                        onChange={(e) => setFormData({ ...formData, explanationCn: e.target.value })}
                        rows={2}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="解释正确答案..."
                    />
                </div>
            </div>
        </div>
    );
}
