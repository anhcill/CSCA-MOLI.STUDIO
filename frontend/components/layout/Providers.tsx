'use client';

import { GoogleOAuthProvider } from '@react-oauth/google';
import StudentOnly from '@/components/auth/StudentOnly';

export default function Providers({ children }: { children: React.ReactNode }) {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
    return (
        <GoogleOAuthProvider clientId={clientId}>
            <StudentOnly>
                {children}
            </StudentOnly>
        </GoogleOAuthProvider>
    );
}
