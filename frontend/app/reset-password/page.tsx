'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from '@/lib/utils/axios';
import { FiLock, FiEye, FiEyeOff, FiCheckCircle, FiAlertTriangle } from 'react-icons/fi';

function ResetPasswordForm() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const token = searchParams.get('token') || '';
    const userId = searchParams.get('id') || '';

    const [newPassword, setNewPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    const isInvalid = !token || !userId;

    // Password strength check
    const strength = (() => {
        if (newPassword.length === 0) return null;
        let score = 0;
        if (newPassword.length >= 8) score++;
        if (/[a-zA-Z]/.test(newPassword)) score++;
        if (/[0-9]/.test(newPassword)) score++;
        if (/[^a-zA-Z0-9]/.test(newPassword)) score++;
        if (score <= 1) return { label: 'Yếu', color: 'bg-red-400', width: '25%' };
        if (score === 2) return { label: 'Trung bình', color: 'bg-yellow-400', width: '50%' };
        if (score === 3) return { label: 'Mạnh', color: 'bg-emerald-400', width: '75%' };
        return { label: 'Rất mạnh', color: 'bg-emerald-600', width: '100%' };
    })();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (newPassword !== confirm) { setError('Mật khẩu xác nhận không khớp'); return; }
        if (newPassword.length < 8) { setError('Mật khẩu phải có ít nhất 8 ký tự'); return; }
        if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
            setError('Mật khẩu phải có ít nhất 1 chữ cái và 1 số');
            return;
        }

        setLoading(true);
        try {
            await axios.post('/auth/reset-password', { token, userId, newPassword });
            setSuccess(true);
            setTimeout(() => router.push('/login'), 3000);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <Link href="/" className="text-2xl font-bold text-gray-900">🎯 CSCA</Link>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
                    {/* Invalid link */}
                    {isInvalid ? (
                        <div className="text-center">
                            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FiAlertTriangle className="text-red-400" size={26} />
                            </div>
                            <h1 className="text-xl font-bold text-gray-900 mb-2">Liên kết không hợp lệ</h1>
                            <p className="text-sm text-gray-500 mb-6">
                                Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.
                            </p>
                            <Link
                                href="/forgot-password"
                                className="inline-block px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors"
                            >
                                Yêu cầu liên kết mới
                            </Link>
                        </div>
                    ) : success ? (
                        /* Success */
                        <div className="text-center">
                            <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FiCheckCircle className="text-emerald-500" size={28} />
                            </div>
                            <h1 className="text-xl font-bold text-gray-900 mb-2">Đặt lại thành công!</h1>
                            <p className="text-sm text-gray-500 mb-2">
                                Mật khẩu của bạn đã được cập nhật.
                            </p>
                            <p className="text-xs text-gray-400">Đang chuyển đến trang đăng nhập...</p>
                        </div>
                    ) : (
                        /* Form */
                        <>
                            <div className="mb-6">
                                <h1 className="text-2xl font-bold text-gray-900 mb-1">Tạo mật khẩu mới</h1>
                                <p className="text-sm text-gray-500">Nhập mật khẩu mạnh để bảo vệ tài khoản của bạn.</p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {error && (
                                    <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">
                                        <FiAlertTriangle size={14} className="shrink-0" />{error}
                                    </div>
                                )}

                                {/* New password */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Mật khẩu mới</label>
                                    <div className="relative">
                                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"><FiLock size={15} /></div>
                                        <input
                                            type={showPw ? 'text' : 'password'}
                                            value={newPassword}
                                            onChange={e => setNewPassword(e.target.value)}
                                            placeholder="Ít nhất 8 ký tự"
                                            autoFocus
                                            className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                        />
                                        <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                            {showPw ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                                        </button>
                                    </div>

                                    {/* Strength bar */}
                                    {strength && (
                                        <div className="mt-2">
                                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full transition-all duration-300 ${strength.color}`} style={{ width: strength.width }} />
                                            </div>
                                            <p className="text-xs text-gray-400 mt-1">Độ mạnh: <span className="font-medium text-gray-600">{strength.label}</span></p>
                                        </div>
                                    )}
                                </div>

                                {/* Confirm password */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Xác nhận mật khẩu</label>
                                    <div className="relative">
                                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"><FiLock size={15} /></div>
                                        <input
                                            type={showConfirm ? 'text' : 'password'}
                                            value={confirm}
                                            onChange={e => setConfirm(e.target.value)}
                                            placeholder="Nhập lại mật khẩu"
                                            className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                        />
                                        <button type="button" onClick={() => setShowConfirm(p => !p)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                            {showConfirm ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                                        </button>
                                    </div>
                                    {confirm && newPassword !== confirm && (
                                        <p className="text-xs text-red-500 mt-1">Mật khẩu không khớp</p>
                                    )}
                                    {confirm && newPassword === confirm && confirm.length > 0 && (
                                        <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1"><FiCheckCircle size={11} />Mật khẩu khớp</p>
                                    )}
                                </div>

                                {/* Hints */}
                                <ul className="text-xs text-gray-400 space-y-0.5 pl-1">
                                    <li className={newPassword.length >= 8 ? 'text-emerald-500' : ''}>• Ít nhất 8 ký tự</li>
                                    <li className={/[a-zA-Z]/.test(newPassword) && /[0-9]/.test(newPassword) ? 'text-emerald-500' : ''}>• Bao gồm chữ cái và số</li>
                                </ul>

                                <button
                                    type="submit"
                                    disabled={loading || !newPassword || !confirm}
                                    className="w-full py-3 bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                                >
                                    {loading ? 'Đang lưu...' : 'Đặt lại mật khẩu'}
                                </button>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-400 text-sm">Đang tải...</p></div>}>
            <ResetPasswordForm />
        </Suspense>
    );
}
