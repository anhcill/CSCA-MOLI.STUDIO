'use client';

import { GoogleOAuthProvider } from '@react-oauth/google';
import AuthSessionSync from '@/components/auth/AuthSessionSync';
import { ThemeProvider } from '@/context/ThemeContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { getGoogleOAuthClientId } from '@/lib/utils/googleOAuth';

export default function Providers({ children }: { children: React.ReactNode }) {
    const clientId = getGoogleOAuthClientId();
    return (
        <GoogleOAuthProvider clientId={clientId}>
            <ThemeProvider>
                <LanguageProvider>
                    <AuthSessionSync />
                    {children}
                </LanguageProvider>
            </ThemeProvider>
        </GoogleOAuthProvider>
    );
}
