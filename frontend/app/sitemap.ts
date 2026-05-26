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
  const siteUpdated = new Date('2026-05-18');

  const staticRoutes: MetadataRoute.Sitemap = [
    route('/', siteUpdated, 'weekly', 1.0),
    route('/forum', siteUpdated, 'daily', 0.8),
    route('/tailieu', siteUpdated, 'weekly', 0.8),
    route('/tu-vung', siteUpdated, 'weekly', 0.7),
    route('/lo-trinh', siteUpdated, 'monthly', 0.7),
    route('/ly-thuyet', siteUpdated, 'monthly', 0.7),
    route('/cau-truc-de', siteUpdated, 'monthly', 0.6),
    route('/giai-de-chi-tiet', siteUpdated, 'monthly', 0.6),
    route('/cau-hoi-thuong-gap', siteUpdated, 'monthly', 0.7),
  ];

  const landingPages: MetadataRoute.Sitemap = [
    route('/on-thi-csca', siteUpdated, 'weekly', 0.9),
    route('/csca-la-gi', siteUpdated, 'weekly', 0.95),
    route('/de-thi-thu-csca', siteUpdated, 'weekly', 0.95),
    route('/on-thi-csca-online', siteUpdated, 'weekly', 0.95),
    route('/de-thi-csca', siteUpdated, 'weekly', 0.9),
    route('/hoc-bong-du-hoc-trung-quoc', siteUpdated, 'monthly', 0.9),
    route('/tu-vung-csca', siteUpdated, 'weekly', 0.8),
    route('/lo-trinh-on-thi-csca', siteUpdated, 'monthly', 0.8),
    route('/luyen-thi-csca', siteUpdated, 'weekly', 0.9),
    route('/thi-csca', siteUpdated, 'weekly', 0.9),
    route('/du-hoc-trung-quoc', siteUpdated, 'monthly', 0.9),
    route('/cac-mon-thi-csca', siteUpdated, 'weekly', 0.9),
    route('/on-thi-toan-csca', siteUpdated, 'weekly', 0.85),
    route('/on-thi-vat-ly-csca', siteUpdated, 'weekly', 0.85),
    route('/on-thi-hoa-csca', siteUpdated, 'weekly', 0.85),
    route('/on-thi-tieng-trung-csca', siteUpdated, 'weekly', 0.85),
    route('/on-thi-tong-hop-csca', siteUpdated, 'weekly', 0.85),
  ];

  const subjectRoutes: MetadataRoute.Sitemap = [
    route('/toan/de-mo-phong', siteUpdated, 'weekly', 0.7),
    route('/hoa/de-mo-phong', siteUpdated, 'weekly', 0.7),
    route('/vat-ly/de-mo-phong', siteUpdated, 'weekly', 0.7),
    route('/tiengtrung-tunhien/de-mo-phong', siteUpdated, 'weekly', 0.7),
    route('/tiengtrung-xahoi/de-mo-phong', siteUpdated, 'weekly', 0.7),
  ];

  const blogRoutes: MetadataRoute.Sitemap = [
    route('/blog', siteUpdated, 'daily', 0.9),
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
