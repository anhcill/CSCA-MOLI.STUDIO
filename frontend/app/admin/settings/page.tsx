'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { FiActivity, FiAlertCircle, FiCalendar, FiCheckCircle, FiCpu, FiSave, FiSettings } from 'react-icons/fi';
import axiosInstance from '@/lib/utils/axios';

type Provider = '9router' | 'deepseek';

interface SettingsData {
    exam_date: string;
    public_ai_provider: '9router';
    premium_ai_provider: Provider;
    premium_ai_deepseek_model: string;
    public_ai_9router_model: string;
    public_ai_free_9router_model: string;
    public_ai_fallback_provider: Provider;
    admin_question_review_model: string;
    admin_question_review_fallback_model: string;
}

type TestResult = {
    status: 'testing' | 'success' | 'error';
    latencyMs?: number;
    token?: string;
    message?: string;
};

const DEFAULT_SETTINGS: SettingsData = {
    exam_date: '',
    public_ai_provider: '9router',
    premium_ai_provider: '9router',
    premium_ai_deepseek_model: 'deepseek-v4-pro',
    public_ai_9router_model: 'ag/gemini-4-argon-low',
    public_ai_free_9router_model: 'ag/gemini-3.8-flash-low',
    public_ai_fallback_provider: 'deepseek',
    admin_question_review_model: 'ag/gemini-4-argon-low',
    admin_question_review_fallback_model: 'ag/gemini-3.8-flash-low',
};

const NINE_ROUTER_MODELS = [
    { value: 'ag/gemini-4-argon-low', label: 'Gemini 4 Argon Low', note: 'Chất lượng cao, khoảng 4 giây' },
    { value: 'ag/gemini-3.8-flash-low', label: 'Gemini 3.8 Flash Low', note: 'Cân bằng tốc độ và chất lượng' },
    { value: 'ag/gemini-3-flash', label: 'Gemini 3 Flash', note: 'Nhanh, phù hợp hội thoại nhẹ' },
    { value: 'ag/gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite', note: 'Rất nhanh' },
    { value: 'ag/gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite', note: 'Rất nhanh' },
    { value: 'ag/gemini-2.5-flash', label: 'Gemini 2.5 Flash', note: 'Ổn định' },
    { value: 'ag/gemini-2.5-flash-thinking', label: 'Gemini 2.5 Flash Thinking', note: 'Có suy luận' },
];

const DEEPSEEK_MODELS = [
    { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
    { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
    { value: 'deepseek-chat', label: 'DeepSeek Chat' },
    { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
];

const signature = (provider: Provider, model: string) => `${provider}:${model}`;

function toDateTimeLocal(value?: string) {
    if (!value) return '';
    const dateObj = new Date(value);
    if (Number.isNaN(dateObj.getTime())) return '';
    const tzOffset = dateObj.getTimezoneOffset() * 60000;
    return new Date(dateObj.getTime() - tzOffset).toISOString().slice(0, 16);
}

function ModelSelect({ provider, value, onChange }: {
    provider: Provider;
    value: string;
    onChange: (value: string) => void;
}) {
    const options = provider === '9router' ? NINE_ROUTER_MODELS : DEEPSEEK_MODELS;
    return (
        <select
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium dark:border-slate-700 dark:bg-slate-800"
        >
            {options.map((option) => (
                <option key={option.value} value={option.value}>{option.label} — {option.value}</option>
            ))}
        </select>
    );
}

export default function AdminSettingsPage() {
    const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS);
    const [savedSettings, setSavedSettings] = useState<SettingsData>(DEFAULT_SETTINGS);
    const [tests, setTests] = useState<Record<string, TestResult>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => { void loadSettings(); }, []);

    const patchSettings = (patch: Partial<SettingsData>) => {
        setSettings((current) => ({ ...current, ...patch }));
        setSuccessMessage('');
    };

    const loadSettings = async () => {
        try {
            setLoading(true);
            const res = await axiosInstance.get('/settings');
            const loaded = {
                ...DEFAULT_SETTINGS,
                ...(res.data?.data || {}),
                exam_date: toDateTimeLocal(res.data?.data?.exam_date),
                public_ai_provider: '9router' as const,
            };
            setSettings(loaded);
            setSavedSettings(loaded);
            setTests({});
        } catch (error) {
            console.error('Error loading settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const premiumModel = settings.premium_ai_provider === '9router'
        ? settings.public_ai_9router_model
        : settings.premium_ai_deepseek_model;

    const requiredTestSignatures = useMemo(() => {
        const required = new Set<string>();
        if (settings.public_ai_free_9router_model !== savedSettings.public_ai_free_9router_model) {
            required.add(signature('9router', settings.public_ai_free_9router_model));
        }
        if (settings.public_ai_9router_model !== savedSettings.public_ai_9router_model) {
            required.add(signature('9router', settings.public_ai_9router_model));
        }
        if (settings.premium_ai_deepseek_model !== savedSettings.premium_ai_deepseek_model) {
            required.add(signature('deepseek', settings.premium_ai_deepseek_model));
        }
        if (settings.premium_ai_provider !== savedSettings.premium_ai_provider) {
            required.add(signature(settings.premium_ai_provider, premiumModel));
        }
        if (settings.admin_question_review_model !== savedSettings.admin_question_review_model) {
            required.add(signature('9router', settings.admin_question_review_model));
        }
        if (settings.admin_question_review_fallback_model !== savedSettings.admin_question_review_fallback_model) {
            required.add(signature('9router', settings.admin_question_review_fallback_model));
        }
        return [...required];
    }, [premiumModel, savedSettings, settings]);

    const missingTests = requiredTestSignatures.filter((key) => tests[key]?.status !== 'success');

    const testModel = async (provider: Provider, model: string) => {
        const key = signature(provider, model);
        setTests((current) => ({ ...current, [key]: { status: 'testing' } }));
        try {
            const res = await axiosInstance.post('/settings/test-ai-model', { provider, model });
            const data = res.data?.data || {};
            setTests((current) => ({
                ...current,
                [key]: { status: 'success', latencyMs: data.latencyMs, token: data.testToken },
            }));
        } catch (error: any) {
            setTests((current) => ({
                ...current,
                [key]: {
                    status: 'error',
                    latencyMs: error.response?.data?.latencyMs,
                    message: error.response?.data?.message || 'Test model thất bại.',
                },
            }));
        }
    };

    const handleSave = async () => {
        if (!settings.exam_date) return alert('Vui lòng chọn ngày thi.');
        if (missingTests.length) return alert('Hãy test thành công tất cả model đã thay đổi trước khi lưu.');

        try {
            setSaving(true);
            setSuccessMessage('');
            const testTokens = requiredTestSignatures
                .map((key) => tests[key]?.token)
                .filter((token): token is string => Boolean(token));
            const payload = {
                ...settings,
                public_ai_provider: '9router' as const,
                public_ai_fallback_provider: settings.premium_ai_provider === '9router' ? 'deepseek' : '9router',
                exam_date: new Date(settings.exam_date).toISOString(),
                ai_model_test_tokens: testTokens,
            };
            const res = await axiosInstance.put('/settings', payload);
            if (res.data?.success) {
                const saved = {
                    ...settings,
                    ...(res.data.data || {}),
                    exam_date: toDateTimeLocal(res.data.data?.exam_date || settings.exam_date),
                    public_ai_provider: '9router' as const,
                };
                setSettings(saved);
                setSavedSettings(saved);
                setTests({});
                setSuccessMessage('Đã lưu cấu hình AI đã kiểm thử.');
            }
        } catch (error: any) {
            console.error('Error saving settings:', error);
            alert(error.response?.data?.message || 'Có lỗi xảy ra khi lưu cài đặt.');
        } finally {
            setSaving(false);
        }
    };

    const renderTest = (provider: Provider, model: string) => {
        const result = tests[signature(provider, model)];
        return (
            <div className="flex flex-wrap items-center gap-3">
                <button
                    type="button"
                    onClick={() => void testModel(provider, model)}
                    disabled={result?.status === 'testing'}
                    className="inline-flex items-center gap-2 rounded-lg border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-700 transition hover:bg-sky-100 disabled:opacity-60 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
                >
                    <FiActivity />
                    {result?.status === 'testing' ? 'Đang test...' : 'Test model'}
                </button>
                {result?.status === 'success' && (
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-600">
                        <FiCheckCircle /> Hoạt động tốt · {result.latencyMs} ms
                    </span>
                )}
                {result?.status === 'error' && (
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-rose-600">
                        <FiAlertCircle /> {result.message}
                    </span>
                )}
            </div>
        );
    };

    const routeCard = (title: string, description: string, provider: Provider, model: string, controls: ReactNode) => (
        <section className="space-y-4 rounded-xl border border-gray-200 bg-gray-50/70 p-5 dark:border-slate-700 dark:bg-slate-950/40">
            <div>
                <h3 className="font-bold text-gray-900 dark:text-white">{title}</h3>
                <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-slate-400">{description}</p>
            </div>
            {controls}
            <div className="rounded-lg bg-white px-3 py-2 text-xs text-gray-500 ring-1 ring-gray-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-700">
                Route hiện tại: <strong>{provider}</strong> / <span className="font-mono">{model}</span>
            </div>
            {renderTest(provider, model)}
        </section>
    );

    return (
        <AdminLayout title="Cấu hình hệ thống" description="Quản lý lịch thi và định tuyến model AI">
            <div className="max-w-5xl space-y-6">
                {successMessage && (
                    <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">
                        <FiCheckCircle size={20} /><span className="text-sm font-medium">{successMessage}</span>
                    </div>
                )}

                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center gap-3 border-b border-gray-200 px-6 py-4 dark:border-slate-800">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"><FiSettings /></div>
                        <div><h2 className="font-bold text-gray-900 dark:text-white">Cài đặt chung</h2><p className="text-xs text-gray-500">Mốc thời gian hiển thị trên website</p></div>
                    </div>
                    <div className="p-6">
                        <label className="block max-w-sm space-y-2">
                            <span className="flex items-center gap-2 text-sm font-semibold"><FiCalendar /> Ngày đếm ngược kỳ thi</span>
                            <input type="datetime-local" value={settings.exam_date} onChange={(event) => patchSettings({ exam_date: event.target.value })} className="w-full rounded-lg bg-gray-50 px-4 py-3 text-sm outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-amber-500 dark:bg-slate-800 dark:ring-slate-700" />
                        </label>
                    </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center gap-3 border-b border-gray-200 px-6 py-4 dark:border-slate-800">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300"><FiCpu /></div>
                        <div><h2 className="font-bold text-gray-900 dark:text-white">Định tuyến AI người dùng</h2><p className="text-xs text-gray-500">Chỉ dùng 9Router và DeepSeek. Model mới phải test thành công trước khi lưu.</p></div>
                    </div>
                    <div className="grid gap-5 p-6 lg:grid-cols-2">
                        {routeCard('User thường', 'Chat, giảng lại lý thuyết và phân tích tổng hợp 50 Xu.', '9router', settings.public_ai_free_9router_model,
                            <ModelSelect provider="9router" value={settings.public_ai_free_9router_model} onChange={(value) => patchSettings({ public_ai_free_9router_model: value })} />)}

                        {routeCard('VIP / Premium', 'Chat, lý thuyết, phân tích bài thi, câu sai, tiến bộ và chấm tự luận.', settings.premium_ai_provider, premiumModel,
                            <div className="space-y-3">
                                <select value={settings.premium_ai_provider} onChange={(event) => patchSettings({ premium_ai_provider: event.target.value as Provider })} className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium dark:border-slate-700 dark:bg-slate-800">
                                    <option value="9router">9Router production</option>
                                    <option value="deepseek">DeepSeek</option>
                                </select>
                                <ModelSelect provider={settings.premium_ai_provider} value={premiumModel} onChange={(value) => patchSettings(settings.premium_ai_provider === '9router' ? { public_ai_9router_model: value } : { premium_ai_deepseek_model: value })} />
                            </div>)}

                        {routeCard('Admin soát câu — model chính', 'Model 9Router dùng cho thao tác AI soát và sửa câu hỏi.', '9router', settings.admin_question_review_model,
                            <ModelSelect provider="9router" value={settings.admin_question_review_model} onChange={(value) => patchSettings({ admin_question_review_model: value })} />)}

                        {routeCard('Admin soát câu — dự phòng', 'Model dự phòng khi model chính không đáp ứng.', '9router', settings.admin_question_review_fallback_model,
                            <ModelSelect provider="9router" value={settings.admin_question_review_fallback_model} onChange={(value) => patchSettings({ admin_question_review_fallback_model: value })} />)}

                        <section className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-5 dark:border-emerald-900 dark:bg-emerald-950/20 lg:col-span-2">
                            <h3 className="font-bold text-emerald-900 dark:text-emerald-200">MoliPet — cố định</h3>
                            <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">Mọi tài khoản đăng nhập dùng <strong>9Router</strong> / <span className="font-mono">ag/gemini-3-flash</span>. Route này không đổi từ màn admin để tránh lệch cấu hình pet.</p>
                        </section>
                    </div>
                </div>

                {missingTests.length > 0 && (
                    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
                        <FiAlertCircle className="mt-0.5 shrink-0" />
                        <span className="text-sm">Còn {missingTests.length} model đã thay đổi chưa test thành công. Nút lưu sẽ mở sau khi test đủ.</span>
                    </div>
                )}

                <div className="flex justify-end">
                    <button onClick={() => void handleSave()} disabled={loading || saving || missingTests.length > 0} className="flex items-center gap-2 rounded-lg bg-slate-900 px-6 py-3 font-bold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400">
                        {saving ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <FiSave />}
                        {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
                    </button>
                </div>
            </div>
        </AdminLayout>
    );
}
