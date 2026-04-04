'use client';

import { useState } from 'react';
import Link from 'next/link';
import axios from '@/lib/utils/axios';
import { FiMail, FiArrowLeft, FiCheckCircle } from 'react-icons/fi';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!email || !/\S+@\S+\.\S+/.test(email)) {
            setError('Vui lòng nhập địa chỉ email hợp lệ');
            return;
        }

        setLoading(true);
        try {
            await axios.post('/auth/forgot-password', { email });
            setSubmitted(true);
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
                    {submitted ? (
                        /* Success state */
                        <div className="text-center">
                            <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FiCheckCircle className="text-emerald-500" size={28} />
                            </div>
                            <h1 className="text-xl font-bold text-gray-900 mb-2">Kiểm tra email của bạn</h1>
                            <p className="text-sm text-gray-500 mb-6">
                                Nếu địa chỉ <span className="font-medium text-gray-700">{email}</span> tồn tại trong hệ thống,
                                chúng tôi đã gửi hướng dẫn đặt lại mật khẩu. Vui lòng kiểm tra hòm thư (và thư mục spam).
                            </p>
                            <p className="text-xs text-gray-400 mb-6">Liên kết có hiệu lực trong 15 phút.</p>
                            <Link
                                href="/login"
                                className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                            >
                                <FiArrowLeft size={14} />
                                Quay lại đăng nhập
                            </Link>
                        </div>
                    ) : (
                        /* Form state */
                        <>
                            <div className="mb-6">
                                <h1 className="text-2xl font-bold text-gray-900 mb-1">Quên mật khẩu?</h1>
                                <p className="text-sm text-gray-500">
                                    Nhập email của bạn và chúng tôi sẽ gửi liên kết để đặt lại mật khẩu.
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {error && (
                                    <div className="text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">
                                        {error}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Địa chỉ email
                                    </label>
                                    <div className="relative">
                                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                                            <FiMail size={16} />
                                        </div>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            placeholder="example@email.com"
                                            autoFocus
                                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900 placeholder-gray-400"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-3 bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                                >
                                    {loading ? 'Đang gửi...' : 'Gửi liên kết đặt lại mật khẩu'}
                                </button>
                            </form>

                            <div className="mt-6 text-center">
                                <Link
                                    href="/login"
                                    className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                                >
                                    <FiArrowLeft size={13} />
                                    Quay lại đăng nhập
                                </Link>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
