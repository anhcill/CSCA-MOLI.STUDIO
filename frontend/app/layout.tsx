import type { Metadata } from "next";
import "@fontsource/inter/100.css";
import "@fontsource/inter/200.css";
import "@fontsource/inter/300.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/800.css";
import "@fontsource/inter/900.css";
import "@fontsource/plus-jakarta-sans/300.css";
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/plus-jakarta-sans/800.css";
import Providers from "@/components/layout/Providers";
import ClientShell from "@/components/layout/ClientShell";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://csca.edu.vn'),
  title: {
    default: 'CSCA - Ôn thi học bổng Trung Quốc',
    template: '%s | CSCA',
  },
  description: 'Nền tảng ôn thi học bổng CSCA với 500+ đề thi, AI phân tích lộ trình và 10,000+ học viên.',
  keywords: ['học bổng Trung Quốc', 'CSCA', 'ôn thi', 'toán', 'vật lý', 'hóa học', 'tiếng Trung', 'đề thi'],
  authors: [{ name: 'CSCA' }],
  creator: 'CSCA',
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    siteName: 'CSCA',
    title: 'CSCA - Ôn thi học bổng Trung Quốc',
    description: 'Nền tảng ôn thi học bổng CSCA với 500+ đề thi, AI phân tích lộ trình và 10,000+ học viên.',
    url: '/',
    images: [{
      url: '/images/du-hoc-trung-quoc-1200x799.jpg',
      width: 1200,
      height: 799,
      alt: 'CSCA - Ôn thi học bổng Trung Quốc',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CSCA - Ôn thi học bổng Trung Quốc',
    description: 'Nền tảng ôn thi học bổng CSCA với 500+ đề thi, AI phân tích lộ trình và 10,000+ học viên.',
    images: ['/images/du-hoc-trung-quoc-1200x799.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>
          <ClientShell>
            {children}
          </ClientShell>
        </Providers>
      </body>
    </html>
  );
}
