import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import Providers from "@/components/layout/Providers";
import ClientShell from "@/components/layout/ClientShell";
import GlobalFeedbackBridge from "@/components/common/GlobalFeedbackBridge";
import { getCanonicalSiteUrl } from "@/lib/seo/site";
import { SAME_AS_LINKS } from "@/lib/seo/social";
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
    default: 'CSCA Moly | Ôn Thi Học Bổng Du Học Trung Quốc',
    template: '%s | CSCA Moly',
  },
  description: 'Nền tảng ôn thi CSCA, luyện đề học bổng CSC và chuẩn bị du học Trung Quốc chuyên nghiệp dành cho học sinh Việt Nam: đề thi mô phỏng chuẩn format, từ vựng tiếng Trung, lộ trình ôn tập cá nhân hóa và đáp án giải chi tiết.',
  keywords: ['CSCA', 'ôn thi CSCA', 'luyện thi CSCA', 'luyện thi CSCA online', 'đề thi CSCA', 'mock test CSCA', 'thi thử HSK online', 'luyện HSK miễn phí', 'AI phân tích bài thi', 'nền tảng ôn thi tiếng Trung', 'ôn thi học bổng', 'học bổng CSC', 'du học Trung Quốc', 'luyện đề học bổng Trung Quốc', 'tiếng Trung CSCA'],
  authors: [{ name: 'CSCA Moly' }],
  creator: 'CSCA Moly',
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    siteName: 'CSCA Moly',
    title: 'CSCA | Ôn Thi Học Bổng Du Học Trung Quốc',
    description: 'Luyện thi CSCA, ôn học bổng CSC và chuẩn bị du học Trung Quốc với đề mô phỏng, từ vựng, lộ trình cá nhân hóa.',
    images: [{
      url: '/images/du-hoc-trung-quoc-1200x799.jpg',
      width: 1200,
      height: 799,
      alt: 'CSCA Moly - Luyện thi HSK/HSKK & CSCA',
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
        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-v3-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-v3-16x16.png" />
        <meta name="theme-color" content="#1e40af" />

        {/* Apple PWA */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="CSCA Moly" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon-v3.png" />

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
              "name": "CSCA Moly",
              "url": SITE_URL,
              "description": "Nền tảng ôn thi CSCA, học bổng CSC và du học Trung Quốc cho học sinh Việt Nam",
              "publisher": {
                "@type": "Organization",
                "name": "CSCA Moly",
                "url": SITE_URL,
                "logo": {
                  "@type": "ImageObject",
                  "url": `${SITE_URL}/images/logo.svg`
                },
                "sameAs": SAME_AS_LINKS
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
              "@type": "EducationalOrganization",
              "name": "CSCA Moly",
              "url": SITE_URL,
              "logo": `${SITE_URL}/images/logo.svg`,
              "description": "Nền tảng giáo dục trực tuyến chuyên ôn thi CSCA, học bổng CSC và du học Trung Quốc",
              "knowsAbout": ["CSCA", "Ôn thi CSCA", "Học bổng CSC", "Du học Trung Quốc", "Tiếng Trung", "Thi HSK"],
              "sameAs": SAME_AS_LINKS,
              "hasOfferCatalog": {
                "@type": "OfferCatalog",
                "name": "Tài nguyên ôn thi CSCA",
                "itemListElement": [
                  {
                    "@type": "Offer",
                    "itemOffered": {
                      "@type": "Course",
                      "name": "Ôn thi CSCA online",
                      "description": "Luyện thi CSCA online với đề mô phỏng chuẩn format, tài liệu ôn tập, AI phân tích kết quả và lộ trình học thông minh.",
                      "provider": {
                        "@type": "EducationalOrganization",
                        "name": "CSCA Moly",
                        "url": SITE_URL
                      },
                      "url": `${SITE_URL}/on-thi-csca`
                    }
                  },
                  {
                    "@type": "Offer",
                    "itemOffered": {
                      "@type": "LearningResource",
                      "name": "Đề thi CSCA mô phỏng",
                      "description": "Tổng hợp các đề thi thử, đề thi mô phỏng CSCA chuẩn cấu trúc phục vụ ôn luyện thi học bổng Trung Quốc.",
                      "url": `${SITE_URL}/de-thi-csca`
                    }
                  }
                ]
              },
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
