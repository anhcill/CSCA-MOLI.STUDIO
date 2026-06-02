'use client';

import { useEffect, useState } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import AuthSessionSync from '@/components/auth/AuthSessionSync';
import { ThemeProvider } from '@/context/ThemeContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { getGoogleOAuthClientId, isGoogleOAuthConfigured } from '@/lib/utils/googleOAuth';

export default function Providers({ children }: { children: React.ReactNode }) {
    const [clientId, setClientId] = useState(getGoogleOAuthClientId());

    useEffect(() => {
        if (isGoogleOAuthConfigured(clientId)) return;

        let mounted = true;
        fetch('/api/auth/oauth-config', { cache: 'no-store' })
            .then((response) => (response.ok ? response.json() : null))
            .then((body) => {
                const nextClientId = body?.data?.googleClientId?.trim?.() || '';
                if (mounted && isGoogleOAuthConfigured(nextClientId)) {
                    setClientId(nextClientId);
                }
            })
            .catch(() => {});

        return () => {
            mounted = false;
        };
    }, [clientId]);

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
