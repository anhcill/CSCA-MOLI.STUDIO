import { MetadataRoute } from 'next';
import { getCanonicalSiteUrl } from '@/lib/seo/site';
import { BLOG_POSTS } from './blog/blogData';

const BASE_URL = getCanonicalSiteUrl();

const route = (
  path: string,
  lastModified: Date,
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'],
  priority: number,
): MetadataRoute.Sitemap[number] => ({
  url: path === '/' ? BASE_URL : `${BASE_URL}${path}`,
  lastModified,
  changeFrequency,
  priority,
});

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    route('/', now, 'weekly', 1.0),
    route('/forum', now, 'daily', 0.8),
    route('/tailieu', now, 'weekly', 0.8),
    route('/tu-vung', now, 'weekly', 0.7),
    route('/lo-trinh', now, 'monthly', 0.7),
    route('/ly-thuyet', now, 'monthly', 0.7),
    route('/cau-truc-de', now, 'monthly', 0.6),
    route('/de-mo-phong', now, 'weekly', 0.8),
    route('/giai-de-chi-tiet', now, 'monthly', 0.6),
    route('/cau-hoi-thuong-gap', now, 'monthly', 0.7),
  ];

  const landingPages: MetadataRoute.Sitemap = [
    route('/on-thi-csca', now, 'weekly', 0.9),
    route('/de-thi-csca', now, 'weekly', 0.9),
    route('/hoc-bong-du-hoc-trung-quoc', now, 'monthly', 0.9),
    route('/tu-vung-csca', now, 'weekly', 0.8),
    route('/lo-trinh-on-thi-csca', now, 'monthly', 0.8),
    route('/luyen-thi-csca', now, 'weekly', 0.9),
    route('/thi-csca', now, 'weekly', 0.9),
    route('/du-hoc-trung-quoc', now, 'monthly', 0.9),
    route('/cac-mon-thi-csca', now, 'weekly', 0.9),
    route('/on-thi-toan-csca', now, 'weekly', 0.85),
    route('/on-thi-vat-ly-csca', now, 'weekly', 0.85),
    route('/on-thi-hoa-csca', now, 'weekly', 0.85),
    route('/on-thi-tieng-trung-csca', now, 'weekly', 0.85),
    route('/on-thi-tong-hop-csca', now, 'weekly', 0.85),
  ];

  const subjectRoutes: MetadataRoute.Sitemap = [
    route('/toan/de-mo-phong', now, 'weekly', 0.7),
    route('/toan/lo-trinh', now, 'monthly', 0.6),
    route('/toan/lich-su', now, 'weekly', 0.5),
    route('/toan/cau-truc-de', now, 'monthly', 0.6),
    route('/toan/ly-thuyet', now, 'monthly', 0.6),
    route('/toan/tu-vung', now, 'monthly', 0.6),
    route('/hoa/de-mo-phong', now, 'weekly', 0.7),
    route('/vat-ly/de-mo-phong', now, 'weekly', 0.7),
    route('/tiengtrung-tunhien/de-mo-phong', now, 'weekly', 0.7),
    route('/tiengtrung-xahoi/de-mo-phong', now, 'weekly', 0.7),
  ];

  const blogRoutes: MetadataRoute.Sitemap = [
    route('/blog', now, 'daily', 0.9),
    ...BLOG_POSTS.map((post) =>
      route(
        `/blog/${post.slug}`,
        new Date(post.updatedAt || post.publishedAt),
        'monthly',
        post.featured ? 0.9 : 0.8,
      ),
    ),
  ];

  return [...staticRoutes, ...landingPages, ...subjectRoutes, ...blogRoutes];
}
