import type { MetadataRoute } from 'next';
import { getCanonicalSiteUrl } from '@/lib/seo/site';

const BASE_URL = getCanonicalSiteUrl();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/profile/',
          '/(auth)/',
          '/reset-password/',
          '/verify-email/',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
