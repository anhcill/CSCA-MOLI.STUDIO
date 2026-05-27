import fs from 'node:fs';
import path from 'node:path';
import { formatDate } from './utils';

export { formatDate };

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage: string;
  author: string;
  publishedAt: string;
  updatedAt: string;
  category: string;
  tags: string[];
  readTime: number;
  featured?: boolean;
}

const BLOG_CONTENT_DIR = path.join(process.cwd(), 'content', 'blog');

function assertString(value: unknown, field: string, fileName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid blog post ${fileName}: "${field}" must be a non-empty string.`);
  }
  return value;
}

function assertStringArray(value: unknown, field: string, fileName: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`Invalid blog post ${fileName}: "${field}" must be an array of strings.`);
  }
  return value;
}

function assertNumber(value: unknown, field: string, fileName: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid blog post ${fileName}: "${field}" must be a number.`);
  }
  return value;
}

function normalizeBlogPost(raw: unknown, fileName: string): BlogPost {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Invalid blog post ${fileName}: root value must be an object.`);
  }

  const post = raw as Record<string, unknown>;
  return {
    slug: assertString(post.slug, 'slug', fileName),
    title: assertString(post.title, 'title', fileName),
    excerpt: assertString(post.excerpt, 'excerpt', fileName),
    content: assertString(post.content, 'content', fileName),
    coverImage: assertString(post.coverImage, 'coverImage', fileName),
    author: assertString(post.author, 'author', fileName),
    publishedAt: assertString(post.publishedAt, 'publishedAt', fileName),
    updatedAt: assertString(post.updatedAt, 'updatedAt', fileName),
    category: assertString(post.category, 'category', fileName),
    tags: assertStringArray(post.tags, 'tags', fileName),
    readTime: assertNumber(post.readTime, 'readTime', fileName),
    featured: typeof post.featured === 'boolean' ? post.featured : undefined,
  };
}

function getPostSortTime(post: BlogPost): number {
  return new Date(post.updatedAt || post.publishedAt).getTime();
}

function loadBlogPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_CONTENT_DIR)) {
    return [];
  }

  const posts = fs
    .readdirSync(BLOG_CONTENT_DIR)
    .filter((fileName) => fileName.endsWith('.json'))
    .map((fileName) => {
      const filePath = path.join(BLOG_CONTENT_DIR, fileName);
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const post = normalizeBlogPost(raw, fileName);

      if (post.slug !== fileName.replace(/\.json$/, '')) {
        throw new Error(`Invalid blog post ${fileName}: "slug" must match the file name.`);
      }

      return post;
    });

  return posts.sort((a, b) => getPostSortTime(b) - getPostSortTime(a));
}

export const BLOG_POSTS: BlogPost[] = loadBlogPosts();

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find(post => post.slug === slug);
}

export function getFeaturedPosts(): BlogPost[] {
  return BLOG_POSTS.filter(post => post.featured);
}

export function getAllSlugs(): string[] {
  return BLOG_POSTS.map(post => post.slug);
}
