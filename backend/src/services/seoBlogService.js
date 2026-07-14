const axios = require('axios');
const db = require('../config/database');
const aiConfig = require('../config/aiConfig');
const { callAdminExamAI } = require('./aiService');

const FIELDS = ['primary_keyword','secondary_keywords','search_intent','topic','title','meta_title','slug','excerpt','meta_description','content','cover_image','cover_image_alt','cover_image_source','cover_image_source_url','category','tags','author','read_time','featured','status','scheduled_at','published_at'];
function topicImageLibrary() {
  try {
    const library = JSON.parse(process.env.SEO_BLOG_TOPIC_IMAGE_LIBRARY || '{}');
    return library && typeof library === 'object' ? library : {};
  } catch { return {}; }
}
const slugify = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/đ/g,'d').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,180);
const words = value => String(value || '').trim().split(/\s+/).filter(Boolean).length;

function parseGeneratedJson(raw) {
  const text = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try { return JSON.parse(text); } catch {}
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }
  throw Object.assign(new Error('AI returned invalid JSON'), { status: 502 });
}

function validateSeo(post) {
  const checks = [];
  const add = (key, ok, weight, message) => checks.push({ key, ok, weight, message });
  const keyword = String(post.primary_keyword || '').toLowerCase();
  const title = String(post.meta_title || post.title || ''); const content = String(post.content || '');
  add('title_length', title.length >= 40 && title.length <= 65, 15, 'SEO title nên dài 40-65 ký tự');
  add('keyword_in_title', title.toLowerCase().includes(keyword), 15, 'SEO title cần chứa từ khóa chính');
  add('meta_length', String(post.meta_description || '').length >= 120 && String(post.meta_description || '').length <= 160, 15, 'Meta description nên dài 120-160 ký tự');
  add('keyword_in_slug', slugify(post.slug).includes(slugify(keyword)), 10, 'Slug cần chứa từ khóa chính');
  add('content_length', words(content) >= 800, 15, 'Nội dung nên có ít nhất 800 từ');
  add('headings', /^##?\s/m.test(content), 10, 'Bài cần có heading H2/H3');
  add('cover_alt', Boolean(post.cover_image_alt), 10, 'Ảnh đại diện cần alt text');
  add('excerpt', String(post.excerpt || '').length >= 80, 5, 'Excerpt nên có ít nhất 80 ký tự');
  add('internal_link', /\]\(\//.test(content), 5, 'Nên có liên kết nội bộ');
  return { score: checks.reduce((n,c) => n + (c.ok ? c.weight : 0), 0), checks };
}

async function cannibalization(primaryKeyword, excludeId) {
  const { rows } = await db.query(`SELECT id,title,slug,status,primary_keyword FROM seo_blog_posts WHERE lower(primary_keyword)=lower($1) AND ($2::bigint IS NULL OR id<>$2) ORDER BY created_at DESC`, [primaryKeyword, excludeId || null]);
  return { conflict: rows.length > 0, posts: rows };
}

async function findImage(query, topic) {
  if (process.env.PEXELS_API_KEY) {
    const { data } = await axios.get('https://api.pexels.com/v1/search', { headers:{Authorization:process.env.PEXELS_API_KEY}, params:{query,per_page:1}, timeout:10000 });
    const p=data.photos?.[0]; if(p) return {url:p.src.large2x || p.src.large,alt:p.alt || query,source:'Pexels',source_url:p.url};
  }
  if (process.env.UNSPLASH_ACCESS_KEY) {
    const { data } = await axios.get('https://api.unsplash.com/search/photos', { headers:{Authorization:`Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`}, params:{query,per_page:1}, timeout:10000 });
    const p=data.results?.[0]; if(p) return {url:p.urls.regular,alt:p.alt_description || query,source:`Unsplash / ${p.user?.name || ''}`.trim(),source_url:p.links.html};
  }
  // Only return explicitly curated entries. Never synthesize an image URL.
  return topicImageLibrary()[slugify(topic)] || null;
}

async function generate(input, userId) {
  const keyword=String(input.primary_keyword||'').trim(); if(!keyword) throw Object.assign(new Error('primary_keyword is required'),{status:400});
  const prompt=`Tạo bài blog SEO tiếng Việt về "${keyword}". Trả về JSON thuần gồm title,meta_title,slug,excerpt,meta_description,content (Markdown >= 1000 từ),secondary_keywords,search_intent,topic,category,tags,cover_image_alt. Nội dung phải chính xác, hữu ích, không bịa số liệu hoặc nguồn, có H2/H3, FAQ và ít nhất một internal link phù hợp bắt đầu bằng /. Meta title dài 40-65 ký tự và meta description dài 120-160 ký tự.`;
  const model=process.env.SEO_BLOG_AI_MODEL || aiConfig.adminExam.model;
  const raw=await callAdminExamAI(prompt,{model,maxTokens:Number(process.env.SEO_BLOG_AI_MAX_TOKENS||6000),temperature:0.35,feature:'seo_blog'});
  const parsed=parseGeneratedJson(raw);
  const image=await findImage(keyword,parsed.topic).catch(()=>null);
  return create({...parsed,primary_keyword:keyword,cover_image:image?.url,cover_image_alt:image?.alt||parsed.cover_image_alt,cover_image_source:image?.source,cover_image_source_url:image?.source_url,status:'draft',generated_provider:aiConfig.adminExam.provider,generated_model:model,generation_prompt:{prompt},created_by:userId});
}

async function create(data) {
  const slug=slugify(data.slug||data.title); if(!slug) throw Object.assign(new Error('slug/title is required'),{status:400});
  const cols=[...FIELDS.filter(k=>k!=='slug'),'generated_provider','generated_model','generation_prompt','generation_metadata','created_by'].filter(k=>data[k]!==undefined);
  const vals=cols.map(k=>['generation_prompt','generation_metadata'].includes(k)?JSON.stringify(data[k]):data[k]);
  const {rows}=await db.query(`INSERT INTO seo_blog_posts (${cols.join(',')},slug,updated_at) VALUES (${cols.map((_,i)=>`$${i+1}`).join(',')},$${cols.length+1},NOW()) RETURNING *`,[...vals,slug]); return rows[0];
}
async function update(id,data) { const cols=FIELDS.filter(k=>data[k]!==undefined && k!=='slug'); if(data.slug!==undefined) { data.slug=slugify(data.slug); cols.push('slug'); } if(!cols.length) return get(id); const {rows}=await db.query(`UPDATE seo_blog_posts SET ${cols.map((k,i)=>`${k}=$${i+1}`).join(',')},updated_at=NOW() WHERE id=$${cols.length+1} RETURNING *`,[...cols.map(k=>data[k]),id]); return rows[0]; }
async function get(id){const {rows}=await db.query('SELECT * FROM seo_blog_posts WHERE id=$1',[id]);return rows[0];}
module.exports={validateSeo,cannibalization,findImage,generate,create,update,get};
