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
  return (
    <html lang="vi" suppressHydrationWarning className={`${inter.variable} ${plusJakarta.variable}`}>
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
