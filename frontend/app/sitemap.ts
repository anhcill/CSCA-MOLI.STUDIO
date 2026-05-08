import { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://moly-studio.io.vn';

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

    return [...staticRoutes, ...faqRoutes, ...blogRoutes, ...subjectRoutes, ...toanExtra];
}
