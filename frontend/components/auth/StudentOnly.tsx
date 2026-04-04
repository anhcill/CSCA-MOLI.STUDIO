'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';

interface StudentOnlyProps {
    children: React.ReactNode;
}

/**
 * Component wrapper to restrict access to students only
 * Admins will be redirected to /admin
 * This component automatically protects all routes except /admin and /login
 */
export default function StudentOnly({ children }: StudentOnlyProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, isAuthenticated } = useAuthStore();
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        // Allow access to login/register pages for everyone
        if (pathname?.startsWith('/login') || pathname?.startsWith('/register')) {
            return;
        }

        // If user is admin and NOT on admin page, redirect to admin
        if (isAuthenticated && user?.role === 'admin' && !pathname?.startsWith('/admin')) {
            router.push('/admin');
        }
    }, [isAuthenticated, user, router, pathname]);

    // Don't render content if user is admin and not on admin/auth pages
    // mounted check prevents SSR/client hydration mismatch (zustand persist reads localStorage only on client)
    if (mounted && isAuthenticated && user?.role === 'admin' && !pathname?.startsWith('/admin') && !pathname?.startsWith('/login') && !pathname?.startsWith('/register')) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Đang chuyển hướng...</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
