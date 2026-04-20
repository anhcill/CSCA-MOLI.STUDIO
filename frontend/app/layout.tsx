import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import Providers from "@/components/layout/Providers";
import ClientShell from "@/components/layout/ClientShell";
import "./globals.css";

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
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://csca.edu.vn'),
  title: {
    default: 'CSCA | Ôn Thi Học Bổng Du Học Trung Quốc (CIS) & Bài Thi CSCA',
    template: '%s | CSCA - Nền Tảng Luyện Thi',
  },
  description: 'Nền tảng giáo dục trực tuyến CSCA cung cấp 500+ đề thi thử chuẩn hoá, lộ trình ôn thi cá nhân hoá bằng AI cho du học sinh chinh phục học bổng Đại học Trung Quốc an toàn.',
  keywords: ['ôn thi csca', 'thi csca', 'du học trung quốc', 'học bổng cis', 'du học sinh', 'tài liệu csca', 'đề thi csca', 'đề thi toán lý hóa'],
  authors: [{ name: 'CSCA Education' }],
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
    <html lang="vi" suppressHydrationWarning className={`${inter.variable} ${plusJakarta.variable}`}>
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
