import { MetadataRoute } from 'next';
import { getCanonicalSiteUrl } from '@/lib/seo/site';

const BASE_URL = getCanonicalSiteUrl();

export default function sitemap(): MetadataRoute.Sitemap {
    const now = new Date();

    // Static public routes
    const staticRoutes: MetadataRoute.Sitemap = [
        {
            url: BASE_URL,
            lastModified: now,
            changeFrequency: 'weekly',
            priority: 1.0,
        },
        {
            url: `${BASE_URL}/forum`,
            lastModified: now,
            changeFrequency: 'daily',
            priority: 0.8,
        },
        {
            url: `${BASE_URL}/tailieu`,
            lastModified: now,
            changeFrequency: 'weekly',
            priority: 0.8,
        },
        {
            url: `${BASE_URL}/tu-vung`,
            lastModified: now,
            changeFrequency: 'weekly',
            priority: 0.7,
        },
        {
            url: `${BASE_URL}/lo-trinh`,
            lastModified: now,
            changeFrequency: 'monthly',
            priority: 0.7,
        },
        {
            url: `${BASE_URL}/ly-thuyet`,
            lastModified: now,
            changeFrequency: 'monthly',
            priority: 0.7,
        },
        {
            url: `${BASE_URL}/cau-truc-de`,
            lastModified: now,
            changeFrequency: 'monthly',
            priority: 0.6,
        },
        {
            url: `${BASE_URL}/de-mo-phong`,
            lastModified: now,
            changeFrequency: 'weekly',
            priority: 0.8,
        },
        {
            url: `${BASE_URL}/giai-de-chi-tiet`,
            lastModified: now,
            changeFrequency: 'monthly',
            priority: 0.6,
        },
        {
            url: `${BASE_URL}/search`,
            lastModified: now,
            changeFrequency: 'never' as const,
            priority: 0.3,
        },
    ];

    // Subject-specific routes
    const subjects = ['toan', 'hoa', 'vat-ly', 'tiengtrung-tunhien', 'tiengtrung-xahoi'];
    const subjectRoutes: MetadataRoute.Sitemap = subjects.flatMap((subject) => [
        {
            url: `${BASE_URL}/mon/${subject}`,
            lastModified: now,
            changeFrequency: 'weekly' as const,
            priority: 0.8,
        },
        {
            url: `${BASE_URL}/mon/${subject}/de-mo-phong`,
            lastModified: now,
            changeFrequency: 'weekly' as const,
            priority: 0.7,
        },
        {
            url: `${BASE_URL}/mon/${subject}/lo-trinh`,
            lastModified: now,
            changeFrequency: 'monthly' as const,
            priority: 0.6,
        },
        {
            url: `${BASE_URL}/mon/${subject}/lich-su`,
            lastModified: now,
            changeFrequency: 'weekly' as const,
            priority: 0.5,
        },
    ]);

    // Toan-specific extra routes
    const toanExtra: MetadataRoute.Sitemap = [
        {
            url: `${BASE_URL}/toan/cau-truc-de`,
            lastModified: now,
            changeFrequency: 'monthly',
            priority: 0.6,
        },
        {
            url: `${BASE_URL}/toan/ly-thuyet`,
            lastModified: now,
            changeFrequency: 'monthly',
            priority: 0.6,
        },
        {
            url: `${BASE_URL}/toan/tu-vung`,
            lastModified: now,
            changeFrequency: 'monthly',
            priority: 0.6,
        },
        {
            url: `${BASE_URL}/toan/giai-de-chi-tiet`,
            lastModified: now,
            changeFrequency: 'monthly',
            priority: 0.5,
        },
    ];

    // Blog routes
    const blogRoutes: MetadataRoute.Sitemap = [
        {
            url: `${BASE_URL}/blog`,
            lastModified: now,
            changeFrequency: 'daily' as const,
            priority: 0.9,
        },
        {
            url: `${BASE_URL}/blog/cach-luyen-thi-hsk-3-hieu-qua-trong-3-thang`,
            lastModified: new Date('2026-05-01'),
            changeFrequency: 'monthly' as const,
            priority: 0.8,
        },
        {
            url: `${BASE_URL}/blog/so-sanh-hsk-1-vs-hsk-2-nen-thi-bac-nao`,
            lastModified: new Date('2026-05-03'),
            changeFrequency: 'monthly' as const,
            priority: 0.8,
        },
        {
            url: `${BASE_URL}/blog/tu-vung-hsk-4-theo-chu-de-hoc-ngay`,
            lastModified: new Date('2026-05-05'),
            changeFrequency: 'monthly' as const,
            priority: 0.8,
        },
        {
            url: `${BASE_URL}/blog/bi-quyet-dat-200-200-diem-hskk`,
            lastModified: new Date('2026-05-07'),
            changeFrequency: 'monthly' as const,
            priority: 0.8,
        },
        {
            url: `${BASE_URL}/blog/lich-thi-hsk-2026-dang-ky-ngay`,
            lastModified: new Date('2026-05-08'),
            changeFrequency: 'weekly' as const,
            priority: 0.9,
        },
        {
            url: `${BASE_URL}/blog/csca-la-gi-chung-chi-thi-dau-vao-du-hoc-trung-quoc`,
            lastModified: new Date('2026-05-01'),
            changeFrequency: 'monthly' as const,
            priority: 0.9,
        },
        {
            url: `${BASE_URL}/blog/cau-truc-de-thi-csca-phan-toan-tong-hop-tieng-trung`,
            lastModified: new Date('2026-05-03'),
            changeFrequency: 'monthly' as const,
            priority: 0.9,
        },
        {
            url: `${BASE_URL}/blog/hoc-bong-csc-trung-quoc-2026-huong-dan-dang-ky-day-du`,
            lastModified: new Date('2026-05-05'),
            changeFrequency: 'monthly' as const,
            priority: 0.9,
        },
        {
            url: `${BASE_URL}/blog/cau-truc-de-thi-dau-vao-dai-hoc-trung-quoc-2026`,
            lastModified: new Date('2026-05-07'),
            changeFrequency: 'monthly' as const,
            priority: 0.8,
        },
        {
            url: `${BASE_URL}/blog/trung-tam-thi-csca-tai-viet-nam-dia-chi-lich-thi-2026`,
            lastModified: new Date('2026-05-08'),
            changeFrequency: 'monthly' as const,
            priority: 0.8,
        },
        {
            url: `${BASE_URL}/blog/mau-de-thi-csca-giai-chi-tiet-2026`,
            lastModified: new Date('2026-05-09'),
            changeFrequency: 'monthly' as const,
            priority: 0.9,
        },
    ];

    // FAQ
    const faqRoutes: MetadataRoute.Sitemap = [
        {
            url: `${BASE_URL}/cau-hoi-thuong-gap`,
            lastModified: now,
            changeFrequency: 'monthly' as const,
            priority: 0.7,
        },
    ];

    // Landing pages (SEO)
    const landingPages: MetadataRoute.Sitemap = [
        {
            url: `${BASE_URL}/on-thi-csca`,
            lastModified: now,
            changeFrequency: 'weekly' as const,
            priority: 0.9,
        },
        {
            url: `${BASE_URL}/de-thi-csca`,
            lastModified: now,
            changeFrequency: 'weekly' as const,
            priority: 0.9,
        },
        {
            url: `${BASE_URL}/hoc-bong-du-hoc-trung-quoc`,
            lastModified: now,
            changeFrequency: 'monthly' as const,
            priority: 0.9,
        },
        {
            url: `${BASE_URL}/tu-vung-csca`,
            lastModified: now,
            changeFrequency: 'weekly' as const,
            priority: 0.8,
        },
        {
            url: `${BASE_URL}/lo-trinh-on-thi-csca`,
            lastModified: now,
            changeFrequency: 'monthly' as const,
            priority: 0.8,
        },
    ];

    // New blog posts
    const newBlogRoutes: MetadataRoute.Sitemap = [
        {
            url: `${BASE_URL}/blog/huong-dan-hoc-tu-vung-tieng-trung-thi-csca`,
            lastModified: new Date('2026-05-10'),
            changeFrequency: 'monthly' as const,
            priority: 0.8,
        },
        {
            url: `${BASE_URL}/blog/cach-dat-diem-cao-phan-toan-csca`,
            lastModified: new Date('2026-05-11'),
            changeFrequency: 'monthly' as const,
            priority: 0.8,
        },
        {
            url: `${BASE_URL}/blog/loi-it-sai-thuong-gap-khi-thi-csca`,
            lastModified: new Date('2026-05-12'),
            changeFrequency: 'monthly' as const,
            priority: 0.8,
        },
        {
            url: `${BASE_URL}/blog/lich-su-van-hoa-dia-ly-trung-quoc-thi-csca`,
            lastModified: new Date('2026-05-12'),
            changeFrequency: 'monthly' as const,
            priority: 0.8,
        },
        {
            url: `${BASE_URL}/blog/tai-lieu-luyen-thi-csca-hieu-qua`,
            lastModified: new Date('2026-05-13'),
            changeFrequency: 'monthly' as const,
            priority: 0.8,
        },
        {
            url: `${BASE_URL}/blog/cau-hoi-thuong-gap-ve-thi-csca`,
            lastModified: new Date('2026-05-13'),
            changeFrequency: 'monthly' as const,
            priority: 0.8,
        },
        {
            url: `${BASE_URL}/blog/cach-chuan-bi-ho-so-du-hoc-trung-quoc`,
            lastModified: new Date('2026-05-14'),
            changeFrequency: 'monthly' as const,
            priority: 0.8,
        },
        {
            url: `${BASE_URL}/blog/cach-phan-bo-thoi-gian-on-thi-csca`,
            lastModified: new Date('2026-05-14'),
            changeFrequency: 'monthly' as const,
            priority: 0.8,
        },
        {
            url: `${BASE_URL}/blog/so-sanh-hsk-csca-cho-nguoi-muon-du-hoc-trung-quoc`,
            lastModified: new Date('2026-05-14'),
            changeFrequency: 'monthly' as const,
            priority: 0.8,
        },
        {
            url: `${BASE_URL}/blog/meo-luyen-nghe-tieng-trung-cho-csca`,
            lastModified: new Date('2026-05-14'),
            changeFrequency: 'monthly' as const,
            priority: 0.8,
        },
        {
            url: `${BASE_URL}/blog/kinh-nghiem-du-hoc-trung-quoc-tu-hoc-sinh-viet-nam`,
            lastModified: new Date('2026-05-14'),
            changeFrequency: 'monthly' as const,
            priority: 0.8,
        },
        {
            url: `${BASE_URL}/blog/cach-dang-ky-tai-khoan-moli-studio-on-thi-csca`,
            lastModified: new Date('2026-05-14'),
            changeFrequency: 'monthly' as const,
            priority: 0.7,
        },
    ];

    return [...staticRoutes, ...faqRoutes, ...landingPages, ...blogRoutes, ...newBlogRoutes, ...subjectRoutes, ...toanExtra];
}
