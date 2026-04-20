'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

function VerifyEmailContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('');

    useEffect(() => {
        const token = searchParams.get('token');
        const id = searchParams.get('id');

        if (!token || !id) {
            setStatus('error');
            setMessage('Liên kết không hợp lệ.');
            return;
        }

        const verify = async () => {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/verify-email`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, userId: id }),
                });
                const data = await res.json();

                if (data.success) {
                    setStatus('success');
                    setMessage(data.message || 'Xác minh email thành công!');
                    setTimeout(() => router.push('/login'), 3000);
                } else {
                    setStatus('error');
                    setMessage(data.message || 'Xác minh email thất bại. Liên kết có thể đã hết hạn.');
                }
            } catch {
                setStatus('error');
                setMessage('Lỗi kết nối. Vui lòng kiểm tra mạng.');
            }
        };

        verify();
    }, [searchParams, router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-10 text-center">
                {status === 'loading' && (
                    <>
                        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
                        <h1 className="text-xl font-bold text-gray-800">Đang xác nhận email...</h1>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div className="text-6xl mb-4">✅</div>
                        <h1 className="text-2xl font-black text-gray-900 mb-2">Xác minh email thành công!</h1>
                        <p className="text-gray-500 mb-6">{message}</p>
                        <p className="text-sm text-gray-400">Đang chuyển đến trang đăng nhập...</p>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div className="text-6xl mb-4">❌</div>
                        <h1 className="text-2xl font-black text-gray-900 mb-2">Xác minh email thất bại</h1>
                        <p className="text-gray-500 mb-6">{message}</p>
                        <Link href="/login" className="inline-block px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition">
                            Về trang đăng nhập
                        </Link>
                    </>
                )}
            </div>
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <VerifyEmailContent />
        </Suspense>
    );
}
