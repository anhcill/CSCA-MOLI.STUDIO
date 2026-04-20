'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { FiSave, FiSettings, FiCalendar, FiCheckCircle } from 'react-icons/fi';
import axiosInstance from '@/lib/utils/axios';

export default function AdminSettingsPage() {
    const [examDate, setExamDate] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const res = await axiosInstance.get('/settings/public');
            if (res.data?.success && res.data?.data?.exam_date) {
                // Parse date to datetime-local format format for input: YYYY-MM-DDTHH:mm
                const dateObj = new Date(res.data.data.exam_date);
                if (!isNaN(dateObj.getTime())) {
                    // Adjust to local timezone string
                    const tzOffset = dateObj.getTimezoneOffset() * 60000;
                    const localISOTime = (new Date(dateObj.getTime() - tzOffset)).toISOString().slice(0, 16);
                    setExamDate(localISOTime);
                }
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!examDate) {
            alert('Vui lòng chọn ngày!');
            return;
        }
        
        try {
            setSaving(true);
            setSuccessMessage('');
            
            // Convert back to UTC string format matching original backend expectations
            const dateObj = new Date(examDate);
            const isoString = dateObj.toISOString();

            const res = await axiosInstance.put('/settings', { exam_date: isoString });
            if (res.data?.success) {
                setSuccessMessage('Cập nhật cài đặt thành công!');
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
            description="Quản lý các cài đặt chung cho toàn hệ thống"
        >
            <div className="max-w-3xl space-y-6">
                {successMessage && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                        <FiCheckCircle size={20} />
                        <span className="font-medium text-sm">{successMessage}</span>
                    </div>
                )}
                
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 dark:text-violet-400">
                                <FiSettings size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Cài đặt chung</h2>
                                <p className="text-xs text-gray-500 dark:text-slate-400">Thiết lập các mốc thời gian quan trọng</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-6">
                        {loading ? (
                            <div className="animate-pulse space-y-4">
                                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/4"></div>
                                <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded w-full max-w-sm"></div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Exam Date Setting */}
                                <div className="flex flex-col sm:flex-row gap-6 items-start">
                                    <div className="flex-1 max-w-sm">
                                        <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 gap-2 items-center flex mb-2">
                                            <FiCalendar className="text-violet-500" />
                                            Ngày đếm ngược kỳ thi
                                        </label>
                                        <p className="text-xs text-gray-500 dark:text-slate-500 mb-3">
                                            Mốc thời gian này sẽ được hiển thị trên đồng hồ đếm ngược ở trang web (ví dụ: ngày thi Gaokao/HSK).
                                        </p>
                                        <input
                                            type="datetime-local"
                                            value={examDate}
                                            onChange={(e) => setExamDate(e.target.value)}
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-violet-500 outline-none transition-shadow"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                        
                    </div>
                    <div className="px-6 py-4 bg-gray-50 dark:bg-slate-800/50 border-t border-gray-200 dark:border-slate-800 flex justify-end">
                        <button
                            onClick={handleSave}
                            disabled={loading || saving}
                            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold rounded-xl shadow-lg hover:shadow-violet-500/25 transition-all disabled:opacity-50"
                        >
                            {saving ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <FiSave size={18} />
                            )}
                            {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
                        </button>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
