import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import Providers from "@/components/layout/Providers";
import ClientShell from "@/components/layout/ClientShell";
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

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://moly-studio.io.vn'),
  title: {
    default: 'CSCA MOLI.STUDIO | Luyện Thi HSK/HSKK Online & Ôn Thi CSCA',
    template: '%s | CSCA MOLI.STUDIO',
  },
  description: 'Nền tảng giáo dục trực tuyến CSCA MOLI.STUDIO cung cấp 500+ đề thi thử chuẩn hoá HSK/HSKK, lộ trình ôn thi cá nhân hoá bằng AI cho du học sinh chinh phục học bổng Đại học Trung Quốc.',
  keywords: ['ôn thi HSK', 'thi HSK online', 'luyện thi HSKK', 'CSCA MOLI.STUDIO', 'ôn thi CSCA', 'du học trung quốc', 'tiếng trung', 'đề thi mô phỏng HSK', 'luyện thi tiếng trung'],
  authors: [{ name: 'CSCA MOLI.STUDIO' }],
  creator: 'CSCA MOLI.STUDIO',
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    siteName: 'CSCA MOLI.STUDIO',
    title: 'CSCA MOLI.STUDIO | Luyện Thi HSK/HSKK & CSCA',
    description: 'Nền tảng ôn thi HSK/HSKK/CSCA với 500+ đề thi mô phỏng, AI phân tích lộ trình và 10,000+ học viên.',
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
    title: 'CSCA MOLI.STUDIO | Luyện Thi HSK/HSKK & CSCA',
    description: 'Nền tảng ôn thi HSK/HSKK/CSCA với 500+ đề thi mô phỏng, AI phân tích lộ trình.',
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
              "url": "https://moly-studio.io.vn",
              "description": "Nền tảng luyện thi HSK/HSKK online với 500+ đề thi mô phỏng",
              "potentialAction": {
                "@type": "SearchAction",
                "target": "https://moly-studio.io.vn/search?q={search_term_string}",
                "query-input": "required name=search_term_string"
              },
              "publisher": {
                "@type": "Organization",
                "name": "CSCA MOLI.STUDIO",
                "url": "https://moly-studio.io.vn",
                "logo": {
                  "@type": "ImageObject",
                  "url": "https://moly-studio.io.vn/images/logo.png"
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
              "url": "https://moly-studio.io.vn",
              "description": "Nền tảng giáo dục trực tuyến chuyên luyện thi HSK/HSKK, hỗ trợ du học sinh chinh phục học bổng Đại học Trung Quốc",
              "knowsAbout": ["Thi HSK", "Thi HSKK", "Tiếng Trung", "Du học Trung Quốc", "Học bổng"],
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
            </ClientShell>
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}
