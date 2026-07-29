'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { FiCalendar, FiCheckCircle, FiCpu, FiSave, FiSettings } from 'react-icons/fi';
import axiosInstance from '@/lib/utils/axios';

type Provider = '9router' | 'beeknoee';

interface SettingsData {
    exam_date?: string;
    public_ai_provider?: Provider;
    public_ai_9router_model?: string;
    public_ai_free_9router_model?: string;
    public_ai_beeknoee_model?: string;
    public_ai_fallback_provider?: Provider;
    admin_question_review_model?: string;
    admin_question_review_fallback_model?: string;
}

const DEFAULT_SETTINGS: Required<SettingsData> = {
    exam_date: '',
    public_ai_provider: '9router',
    public_ai_9router_model: 'ag/claude-sonnet-4-6',
    public_ai_free_9router_model: 'ag/gemini-3-flash-agent',
    public_ai_beeknoee_model: 'gpt-5.4-mini',
    public_ai_fallback_provider: 'beeknoee',
    admin_question_review_model: 'cx/gpt-5.5',
    admin_question_review_fallback_model: 'ag/claude-opus-4-6-thinking',
};

const QUESTION_REVIEW_MODEL_OPTIONS = [
    { value: 'cx/gpt-5.5', label: 'cx/gpt-5.5' },
    { value: 'ag/claude-opus-4-6-thinking', label: 'ag/claude-opus-4-6-thinking' },
];

const renderQuestionReviewModelOptions = (currentValue: string) => (
    <>
        {currentValue && !QUESTION_REVIEW_MODEL_OPTIONS.some(option => option.value === currentValue) && (
            <option value={currentValue}>{currentValue}</option>
        )}
        {QUESTION_REVIEW_MODEL_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
        ))}
    </>
);

export default function AdminSettingsPage() {
    const [settings, setSettings] = useState<Required<SettingsData>>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        loadSettings();
    }, []);

    const patchSettings = (patch: Partial<SettingsData>) => {
        setSettings((current) => ({ ...current, ...patch }));
    };

    const toDateTimeLocal = (value?: string) => {
        if (!value) return '';
        const dateObj = new Date(value);
        if (Number.isNaN(dateObj.getTime())) return '';
        const tzOffset = dateObj.getTimezoneOffset() * 60000;
        return new Date(dateObj.getTime() - tzOffset).toISOString().slice(0, 16);
    };

    const loadSettings = async () => {
        try {
            setLoading(true);
            const res = await axiosInstance.get('/settings');
            const data = res.data?.data || {};
            setSettings({
                ...DEFAULT_SETTINGS,
                ...data,
                exam_date: toDateTimeLocal(data.exam_date),
            });
        } catch (error) {
            console.error('Error loading settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!settings.exam_date) {
            alert('Vui lòng chọn ngày!');
            return;
        }

        try {
            setSaving(true);
            setSuccessMessage('');
            const res = await axiosInstance.put('/settings', {
                ...settings,
                exam_date: new Date(settings.exam_date).toISOString(),
            });
            if (res.data?.success) {
                setSuccessMessage('Cập nhật cài đặt thành công!');
                const data = res.data.data || {};
                setSettings((current) => ({
                    ...current,
                    ...data,
                    exam_date: toDateTimeLocal(data.exam_date || current.exam_date),
                }));
                setTimeout(() => setSuccessMessage(''), 3000);
            }
        } catch (error: any) {
            console.error('Error saving settings:', error);
            alert(error.response?.data?.message || 'Có lỗi xảy ra khi lưu cài đặt');
        } finally {
            setSaving(false);
        }
    };

    return (
        <AdminLayout
            title="Cấu hình hệ thống"
            description="Quản lý cài đặt chung và AI public"
        >
            <div className="max-w-4xl space-y-6">
                {successMessage && (
                    <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">
                        <FiCheckCircle size={20} />
                        <span className="text-sm font-medium">{successMessage}</span>
                    </div>
                )}

                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center gap-3 border-b border-gray-200 px-6 py-4 dark:border-slate-800">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                            <FiSettings size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Cài đặt chung</h2>
                            <p className="text-xs text-gray-500 dark:text-slate-400">Mốc thời gian hiển thị trên website</p>
                        </div>
                    </div>

                    <div className="p-6">
                        {loading ? (
                            <div className="space-y-4">
                                <div className="h-4 w-1/4 rounded bg-slate-200 dark:bg-slate-800" />
                                <div className="h-12 w-full max-w-sm rounded bg-slate-200 dark:bg-slate-800" />
                            </div>
                        ) : (
                            <div className="max-w-sm">
                                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-slate-300">
                                    <FiCalendar className="text-violet-500" />
                                    Ngày đếm ngược kỳ thi
                                </label>
                                <input
                                    type="datetime-local"
                                    value={settings.exam_date}
                                    onChange={(event) => patchSettings({ exam_date: event.target.value })}
                                    className="w-full rounded-lg bg-gray-50 px-4 py-3 text-sm font-medium outline-none ring-1 ring-transparent transition focus:ring-2 focus:ring-violet-500 dark:bg-slate-800"
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center gap-3 border-b border-gray-200 px-6 py-4 dark:border-slate-800">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400">
                            <FiCpu size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">AI người dùng</h2>
                            <p className="text-xs text-gray-500 dark:text-slate-400">Đổi nhanh giữa 9Router và Beeknoee khi cần chữa cháy</p>
                        </div>
                    </div>

                    <div className="grid gap-5 p-6 md:grid-cols-2">
                        <label className="space-y-2">
                            <span className="text-sm font-semibold text-gray-700 dark:text-slate-300">Provider đang dùng</span>
                            <select
                                value={settings.public_ai_provider}
                                onChange={(event) => patchSettings({ public_ai_provider: event.target.value as Provider })}
                                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                            >
                                <option value="9router">9Router production</option>
                                <option value="beeknoee">Beeknoee fallback</option>
                            </select>
                        </label>

                        <label className="space-y-2">
                            <span className="text-sm font-semibold text-gray-700 dark:text-slate-300">Fallback provider</span>
                            <select
                                value={settings.public_ai_fallback_provider}
                                onChange={(event) => patchSettings({ public_ai_fallback_provider: event.target.value as Provider })}
                                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                            >
                                <option value="beeknoee">Beeknoee</option>
                                <option value="9router">9Router</option>
                            </select>
                        </label>

                        <label className="space-y-2">
                            <span className="text-sm font-semibold text-gray-700 dark:text-slate-300">9Router model VIP/Pre & lượt Xu</span>
                            <select
                                value={settings.public_ai_9router_model}
                                onChange={(event) => patchSettings({ public_ai_9router_model: event.target.value })}
                                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                            >
                                <option value="ag/claude-sonnet-4-6">ag/claude-sonnet-4-6</option>
                                <option value="cx/gpt-5.4-mini">cx/gpt-5.4-mini</option>
                            </select>
                        </label>

                        <label className="space-y-2">
                            <span className="text-sm font-semibold text-gray-700 dark:text-slate-300">9Router model Free</span>
                            <select
                                value={settings.public_ai_free_9router_model}
                                onChange={(event) => patchSettings({ public_ai_free_9router_model: event.target.value })}
                                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                            >
                                <option value="ag/gemini-3-flash-agent">ag/gemini-3-flash-agent</option>
                            </select>
                        </label>

                        <label className="space-y-2">
                            <span className="text-sm font-semibold text-gray-700 dark:text-slate-300">Beeknoee model</span>
                            <select
                                value={settings.public_ai_beeknoee_model}
                                onChange={(event) => patchSettings({ public_ai_beeknoee_model: event.target.value })}
                                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                            >
                                <option value="gpt-5.4-mini">gpt-5.4-mini</option>
                                <option value="google/gemini-3.1-pro-preview">google/gemini-3.1-pro-preview</option>
                                <option value="google/gemini-3.1-flash-lite">google/gemini-3.1-flash-lite</option>
                            </select>
                        </label>
                    </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center gap-3 border-b border-gray-200 px-6 py-4 dark:border-slate-800">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                            <FiCpu size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">AI soát riêng câu</h2>
                            <p className="text-xs text-gray-500 dark:text-slate-400">Model cho nút AI riêng trong từng câu hỏi</p>
                        </div>
                    </div>

                    <div className="grid gap-5 p-6 md:grid-cols-2">
                        <label className="space-y-2">
                            <span className="text-sm font-semibold text-gray-700 dark:text-slate-300">Model chính</span>
                            <select
                                value={settings.admin_question_review_model}
                                onChange={(event) => patchSettings({ admin_question_review_model: event.target.value })}
                                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                            >
                                {renderQuestionReviewModelOptions(settings.admin_question_review_model)}
                            </select>
                        </label>

                        <label className="space-y-2">
                            <span className="text-sm font-semibold text-gray-700 dark:text-slate-300">Model dự phòng</span>
                            <select
                                value={settings.admin_question_review_fallback_model}
                                onChange={(event) => patchSettings({ admin_question_review_fallback_model: event.target.value })}
                                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                            >
                                {renderQuestionReviewModelOptions(settings.admin_question_review_fallback_model)}
                            </select>
                        </label>
                    </div>
                </div>

                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={loading || saving}
                        className="flex items-center gap-2 rounded-lg bg-violet-600 px-6 py-2.5 font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-50"
                    >
                        {saving ? (
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        ) : (
                            <FiSave size={18} />
                        )}
                        {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
                    </button>
                </div>
            </div>
        </AdminLayout>
    );
}
