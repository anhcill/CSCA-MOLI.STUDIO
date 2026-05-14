import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import Providers from "@/components/layout/Providers";
import ClientShell from "@/components/layout/ClientShell";
import GlobalFeedbackBridge from "@/components/common/GlobalFeedbackBridge";
import { getCanonicalSiteUrl } from "@/lib/seo/site";
import "katex/dist/katex.min.css";
import "./globals.css";
import "@/components/admin/MathInput.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

const SITE_URL = getCanonicalSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'CSCA | Ôn Thi Học Bổng Du Học Trung Quốc - MOLI.STUDIO',
    template: '%s | CSCA MOLI.STUDIO',
  },
  description: 'Nền tảng ôn thi CSCA, luyện đề học bổng CSC và du học Trung Quốc cho học sinh Việt Nam: đề mô phỏng, từ vựng, lộ trình học và lời giải chi tiết.',
  keywords: ['CSCA', 'ôn thi CSCA', 'luyện thi CSCA', 'ôn thi học bổng', 'học bổng CSC', 'du học Trung Quốc', 'đề thi CSCA', 'luyện đề học bổng Trung Quốc', 'tiếng Trung CSCA'],
  authors: [{ name: 'CSCA MOLI.STUDIO' }],
  creator: 'CSCA MOLI.STUDIO',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    siteName: 'CSCA MOLI.STUDIO',
    title: 'CSCA | Ôn Thi Học Bổng Du Học Trung Quốc',
    description: 'Luyện thi CSCA, ôn học bổng CSC và chuẩn bị du học Trung Quốc với đề mô phỏng, từ vựng, lộ trình cá nhân hóa.',
    url: '/',
    images: [{
      url: '/images/du-hoc-trung-quoc-1200x799.jpg',
      width: 1200,
      height: 799,
      alt: 'CSCA MOLI.STUDIO - Luyện thi HSK/HSKK & CSCA',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CSCA | Ôn Thi Học Bổng Du Học Trung Quốc',
    description: 'Luyện thi CSCA, ôn học bổng CSC và chuẩn bị du học Trung Quốc.',
    images: ['/images/du-hoc-trung-quoc-1200x799.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  other: {
    'X-Frame-Options': 'SAMEORIGIN',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  return (
    <html lang="vi" suppressHydrationWarning className={`${inter.variable} ${plusJakarta.variable}`}>
      <head>
        {/* Google Analytics */}
        {gaId && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} />
            <script dangerouslySetInnerHTML={{
              __html: `window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${gaId}', { page_path: window.location.pathname });`
            }} />
          </>
        )}

        {/* Schema.org - Website */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "CSCA MOLI.STUDIO",
              "url": SITE_URL,
              "description": "Nền tảng ôn thi CSCA, học bổng CSC và du học Trung Quốc cho học sinh Việt Nam",
              "potentialAction": {
                "@type": "SearchAction",
                "target": `${SITE_URL}/search?q={search_term_string}`,
                "query-input": "required name=search_term_string"
              },
              "publisher": {
                "@type": "Organization",
                "name": "CSCA MOLI.STUDIO",
                "url": SITE_URL,
                "logo": {
                  "@type": "ImageObject",
                  "url": `${SITE_URL}/images/logo.png`
                },
                "sameAs": [
                  "https://www.facebook.com/molistudio",
                  "https://www.youtube.com/@moli-studio"
                ]
              }
            })
          }}
        />

        {/* Schema.org - Organization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "CSCA MOLI.STUDIO",
              "url": SITE_URL,
              "description": "Nền tảng giáo dục trực tuyến chuyên ôn thi CSCA, học bổng CSC và du học Trung Quốc",
              "knowsAbout": ["CSCA", "Ôn thi CSCA", "Học bổng CSC", "Du học Trung Quốc", "Tiếng Trung", "Thi HSK"],
              "areaServed": {
                "@type": "Country",
                "name": "Vietnam"
              },
              "contactPoint": {
                "@type": "ContactPoint",
                "contactType": "customer service",
                "availableLanguage": ["Vietnamese", "Chinese"]
              }
            })
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <Providers>
          <Suspense fallback={<div className="min-h-screen" />}>
            <ClientShell>
              {children}
              <GlobalFeedbackBridge />
            </ClientShell>
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}
