import { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://csca.edu.vn';

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

    return [...staticRoutes, ...subjectRoutes, ...toanExtra];
}
