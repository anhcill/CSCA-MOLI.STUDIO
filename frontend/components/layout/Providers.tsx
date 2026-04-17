'use client';

import { GoogleOAuthProvider } from '@react-oauth/google';
import AuthSessionSync from '@/components/auth/AuthSessionSync';

export default function Providers({ children }: { children: React.ReactNode }) {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
    return (
        <GoogleOAuthProvider clientId={clientId}>
            <AuthSessionSync />
            {children}
        </GoogleOAuthProvider>
    );
}
