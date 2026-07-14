UPDATE seo_blog_posts
SET content = REPLACE(content, '**', ''),
    updated_at = NOW()
WHERE content LIKE '%**%';
