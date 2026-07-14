import { BLOG_POSTS, type BlogPost } from '@/app/blog/blogData';

type ApiRecord = Record<string, unknown>;

function apiBaseUrl(): string | null {
  const raw = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL;
  if (!raw) return process.env.NODE_ENV === 'development' ? 'http://localhost:5000/api' : null;
  const clean = raw.replace(/\/+$/, '');
  return clean.endsWith('/api') ? clean : `${clean}/api`;
}

const stringValue = (value: unknown, fallback = '') =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

function normalizeApiPost(raw: unknown, requireContent = false): BlogPost | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as ApiRecord;
  const seo = item.seo && typeof item.seo === 'object' ? item.seo as ApiRecord : {};
  const slug = stringValue(item.slug);
  const title = stringValue(item.title);
  const content = stringValue(item.content ?? item.content_markdown ?? item.body);
  if (!slug || !title || (requireContent && !content)) return null;

  const tagsRaw = item.tags ?? item.keywords ?? seo.keywords;
  const tags = Array.isArray(tagsRaw)
    ? tagsRaw.filter((tag): tag is string => typeof tag === 'string')
    : typeof tagsRaw === 'string'
      ? tagsRaw.split(',').map(tag => tag.trim()).filter(Boolean)
      : [];
  const primaryKeyword = stringValue(item.primary_keyword);
  if (primaryKeyword && !tags.some(tag => tag.toLocaleLowerCase('vi') === primaryKeyword.toLocaleLowerCase('vi'))) {
    tags.unshift(primaryKeyword);
  }
  const publishedAt = stringValue(item.publishedAt ?? item.published_at, new Date().toISOString());
  const words = content.trim().split(/\s+/).length;

  return {
    slug,
    title,
    seoTitle: stringValue(item.meta_title, title),
    excerpt: stringValue(item.excerpt ?? item.metaDescription ?? item.meta_description ?? seo.description, title),
    content,
    coverImage: stringValue(item.coverImage ?? item.cover_image ?? item.featuredImage ?? item.featured_image, '/images/logo.svg'),
    author: stringValue(item.author ?? item.author_name, 'Ban biên tập Moly'),
    publishedAt,
    updatedAt: stringValue(item.updatedAt ?? item.updated_at, publishedAt),
    category: stringValue(item.category ?? item.topic, 'Kiến thức CSCA'),
    tags,
    readTime: typeof item.readTime === 'number' ? item.readTime : typeof item.read_time === 'number' ? item.read_time : Math.max(1, Math.ceil(words / 220)),
    featured: item.featured === true,
  };
}

function responseItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const root = payload as ApiRecord;
  if (Array.isArray(root.posts)) return root.posts;
  if (Array.isArray(root.items)) return root.items;
  if (Array.isArray(root.data)) return root.data;
  if (root.data && typeof root.data === 'object') {
    const data = root.data as ApiRecord;
    if (Array.isArray(data.posts)) return data.posts;
    if (Array.isArray(data.items)) return data.items;
  }
  return [];
}

function mergePosts(dynamicPosts: BlogPost[]): BlogPost[] {
  const bySlug = new Map(BLOG_POSTS.map(post => [post.slug, post]));
  // Published database content intentionally wins when a slug is also present in JSON.
  dynamicPosts.forEach(post => bySlug.set(post.slug, post));
  return [...bySlug.values()].sort((a, b) =>
    new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

export async function getPublicBlogPosts(): Promise<BlogPost[]> {
  const base = apiBaseUrl();
  if (!base) return BLOG_POSTS;
  try {
    const response = await fetch(`${base}/blog?limit=50&page=1`, { cache: 'no-store' });
    if (!response.ok) return BLOG_POSTS;
    const firstPayload = await response.json();
    const payloads: unknown[] = [firstPayload];
    const meta = firstPayload && typeof firstPayload === 'object' && (firstPayload as ApiRecord).meta;
    const totalPages = meta && typeof meta === 'object' && typeof (meta as ApiRecord).total_pages === 'number'
      ? Math.min(20, (meta as ApiRecord).total_pages as number)
      : 1;
    for (let page = 2; page <= totalPages; page += 1) {
      const next = await fetch(`${base}/blog?limit=50&page=${page}`, { cache: 'no-store' });
      if (next.ok) payloads.push(await next.json());
    }
    const dynamicPosts = payloads.flatMap(responseItems)
      .map(item => normalizeApiPost(item))
      .filter((post): post is BlogPost => post !== null);
    return mergePosts(dynamicPosts);
  } catch {
    return BLOG_POSTS;
  }
}

export async function getPublicBlogPost(slug: string): Promise<BlogPost | undefined> {
  const base = apiBaseUrl();
  if (base) {
    try {
      const response = await fetch(`${base}/blog/${encodeURIComponent(slug)}`, { cache: 'no-store' });
      if (response.ok) {
        const payload = await response.json() as unknown;
        const raw = payload && typeof payload === 'object' && 'data' in payload
          ? (payload as ApiRecord).data
          : payload;
        const post = normalizeApiPost(raw, true);
        if (post) return post;
      }
    } catch {
      // Fall through to the bundled post so a transient API outage is harmless.
    }
  }
  return BLOG_POSTS.find(post => post.slug === slug);
}

export function extractFaq(content: string): Array<{ question: string; answer: string }> {
  const section = content.match(/##\s+(?:Câu hỏi thường gặp|FAQ)\s*\n([\s\S]*?)(?=\n##\s|$)/i)?.[1];
  if (!section) return [];
  const matches = [...section.matchAll(/###\s+([^\n]+)\n([\s\S]*?)(?=\n###\s|$)/g)];
  return matches.map((match) => ({
    question: match[1].replace(/^Q:\s*/i, '').trim(),
    answer: match[2].replace(/^[\s>*-]+|\s+$/g, '').replace(/\*\*/g, '').trim(),
  })).filter(item => item.question && item.answer);
}
