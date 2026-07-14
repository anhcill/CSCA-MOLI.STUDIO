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
  const candidates = [text];
  const objectStart = text.indexOf('{'), objectEnd = text.lastIndexOf('}');
  const arrayStart = text.indexOf('['), arrayEnd = text.lastIndexOf(']');
  if (objectStart >= 0 && objectEnd > objectStart) candidates.push(text.slice(objectStart, objectEnd + 1));
  if (arrayStart >= 0 && arrayEnd > arrayStart) candidates.push(text.slice(arrayStart, arrayEnd + 1));
  for (const candidate of candidates) {
    for (const version of [candidate, candidate.replace(/,\s*([}\]])/g, '$1')]) {
      try { return JSON.parse(version); } catch {}
    }
  }
  throw Object.assign(new Error('AI returned invalid JSON'), { status: 502 });
}

const FALLBACK_IDEAS = [
  ['Luyện thi CSCA','lộ trình ôn thi CSCA cho người mới','informational',['cách học CSCA từ đầu','kế hoạch ôn CSCA']],
  ['Đề thi & chiến thuật','cách phân bổ thời gian làm bài CSCA','informational',['chiến thuật thi CSCA','quản lý thời gian thi CSCA']],
  ['Toán CSCA','từ vựng toán tiếng Trung trong đề CSCA','informational',['thuật ngữ toán CSCA','đọc đề toán tiếng Trung']],
  ['Vật lý CSCA','công thức vật lý CSCA thường gặp','informational',['ôn vật lý CSCA','dạng bài vật lý CSCA']],
  ['Hóa học CSCA','chủ đề hóa học trọng tâm kỳ thi CSCA','informational',['ôn hóa CSCA','từ vựng hóa học tiếng Trung']],
  ['Tiếng Trung CSCA','cách học từ vựng học thuật cho CSCA','informational',['từ vựng CSCA','tiếng Trung học thuật']],
  ['Học bổng CSC','điều kiện xin học bổng CSC mới nhất','informational',['hồ sơ học bổng CSC','kinh nghiệm xin CSC']],
  ['Học bổng trường','so sánh học bổng CSC và học bổng trường','commercial',['các loại học bổng Trung Quốc','chọn học bổng du học']],
  ['Hồ sơ du học','checklist hồ sơ du học Trung Quốc đầy đủ','informational',['chuẩn bị hồ sơ du học','giấy tờ du học Trung Quốc']],
  ['Visa & thủ tục','kinh nghiệm phỏng vấn visa du học Trung Quốc','informational',['xin visa X1 Trung Quốc','câu hỏi phỏng vấn visa']],
  ['Chọn trường & ngành','cách chọn trường đại học Trung Quốc phù hợp','commercial',['xếp hạng đại học Trung Quốc','chọn ngành du học Trung Quốc']],
  ['Chi phí du học','chi phí du học Trung Quốc một năm bao nhiêu','commercial',['sinh hoạt phí du học Trung Quốc','học phí đại học Trung Quốc']],
  ['Đời sống du học sinh','những điều cần biết trước khi sang Trung Quốc du học','informational',['kinh nghiệm sống tại Trung Quốc','chuẩn bị hành lý du học']],
  ['Kinh nghiệm apply','timeline apply du học Trung Quốc không trễ hạn','informational',['lịch apply học bổng Trung Quốc','các mốc nộp hồ sơ']],
  ['Công cụ & tài liệu học','tài liệu luyện thi CSCA cho học sinh Việt Nam','commercial',['sách ôn thi CSCA','website luyện đề CSCA']],
];

function fallbackIdeas(existing, focus) {
  const used = new Set(existing.map((item) => String(item).toLocaleLowerCase('vi')));
  const needle = String(focus || '').toLocaleLowerCase('vi');
  return FALLBACK_IDEAS
    .map(([category, primary_keyword, search_intent, secondary_keywords]) => ({
      topic: category,
      category,
      primary_keyword,
      secondary_keywords,
      search_intent,
      angle: `Hướng dẫn thực tế dành cho học sinh Việt Nam${needle ? `, liên hệ ${focus}` : ''}`,
    }))
    .filter((idea) => !used.has(String(idea.primary_keyword).toLocaleLowerCase('vi')))
    .sort(() => Math.random() - 0.5)
    .slice(0, 12);
}

async function persistIdeas(ideas, focus, userId) {
  const saved = [];
  for (const idea of ideas) {
    const values = [
      idea.topic || idea.category || '',
      idea.category || 'Kiến thức CSCA',
      String(idea.primary_keyword || '').trim(),
      Array.isArray(idea.secondary_keywords) ? idea.secondary_keywords : [],
      idea.search_intent || 'informational',
      idea.angle || '',
      focus || '',
      userId || null,
    ];
    if (!values[2]) continue;
    const { rows } = await db.query(
      `INSERT INTO seo_blog_ideas (
         topic, category, primary_keyword, secondary_keywords,
         search_intent, angle, focus, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (primary_keyword) DO UPDATE SET
         topic=EXCLUDED.topic,
         category=EXCLUDED.category,
         secondary_keywords=EXCLUDED.secondary_keywords,
         search_intent=EXCLUDED.search_intent,
         angle=EXCLUDED.angle
       RETURNING *`,
      values,
    );
    saved.push(rows[0]);
  }
  return saved;
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
  const searches = [...new Set([String(query||'').trim(),String(topic||'').trim(),'Chinese university students studying education'].filter(Boolean))];
  for (const search of searches) {
    if (process.env.PEXELS_API_KEY) {
      try {
        const { data } = await axios.get('https://api.pexels.com/v1/search', { headers:{Authorization:process.env.PEXELS_API_KEY}, params:{query:search,per_page:3,orientation:'landscape'}, timeout:10000 });
        const p=data.photos?.[0]; if(p) return {url:p.src.large2x || p.src.large,alt:p.alt || query,source:'Pexels',source_url:p.url,search_query:search};
      } catch (error) { console.warn('SEO image Pexels search failed, trying next source:', error.response?.status || error.message); }
    }
    if (process.env.UNSPLASH_ACCESS_KEY) {
      try {
        const { data } = await axios.get('https://api.unsplash.com/search/photos', { headers:{Authorization:`Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`}, params:{query:search,per_page:3,orientation:'landscape'}, timeout:10000 });
        const p=data.results?.[0]; if(p) return {url:p.urls.regular,alt:p.alt_description || query,source:`Unsplash / ${p.user?.name || ''}`.trim(),source_url:p.links.html,search_query:search};
      } catch (error) { console.warn('SEO image Unsplash search failed, trying next query:', error.response?.status || error.message); }
    }
  }
  // Only return explicitly curated entries. Never synthesize an image URL.
  return topicImageLibrary()[slugify(topic)] || null;
}

async function generate(input, userId) {
  const keyword=String(input.primary_keyword||'').trim(); if(!keyword) throw Object.assign(new Error('primary_keyword is required'),{status:400});
  const prompt=`Tạo bài blog SEO tiếng Việt về "${keyword}".
Định hướng: category=${input.category || 'AI tự chọn'}, search_intent=${input.search_intent || 'AI tự chọn'}, topic=${input.topic || 'AI tự chọn'}, từ khóa phụ=${JSON.stringify(input.secondary_keywords || [])}.
Trả về JSON thuần gồm title,meta_title,slug,excerpt,meta_description,content (Markdown >= 1000 từ),secondary_keywords,search_intent,topic,category,tags,cover_image_alt.
Nội dung phải có góc triển khai riêng, chính xác, hữu ích, không bịa số liệu hoặc nguồn, có H2/H3, FAQ và ít nhất một internal link phù hợp bắt đầu bằng /. Meta title dài 40-65 ký tự và meta description dài 120-160 ký tự.`;
  const model=process.env.SEO_BLOG_AI_MODEL || aiConfig.adminExam.model;
  let parsed;
  try {
    const raw=await callAdminExamAI(prompt,{model,maxTokens:Number(process.env.SEO_BLOG_AI_MAX_TOKENS||6000),temperature:0.35,feature:'seo_blog',responseFormat:{type:'json_object'}});
    parsed=parseGeneratedJson(raw);
  } catch (firstError) {
    const retryPrompt=`${prompt}\nLẦN TRƯỚC SAI ĐỊNH DẠNG. Chỉ xuất đúng một JSON object hợp lệ, không markdown, không giải thích, không trailing comma.`;
    const retryRaw=await callAdminExamAI(retryPrompt,{model,maxTokens:Number(process.env.SEO_BLOG_AI_MAX_TOKENS||6000),temperature:0.15,feature:'seo_blog_retry',responseFormat:{type:'json_object'}});
    parsed=parseGeneratedJson(retryRaw);
  }
  const image=await findImage(keyword,parsed.topic).catch(()=>null);
  return create({...parsed,primary_keyword:keyword,cover_image:image?.url,cover_image_alt:image?.alt||parsed.cover_image_alt,cover_image_source:image?.source,cover_image_source_url:image?.source_url,status:'draft',generated_provider:aiConfig.adminExam.provider,generated_model:model,generation_prompt:{prompt},generation_metadata:{image_search_query:keyword,image_found:Boolean(image),image_source:image?.source||null},created_by:userId});
}

async function suggestIdeas(input = {}, userId) {
  const { rows } = await db.query(
    `SELECT primary_keyword FROM seo_blog_posts
     WHERE status <> 'archived'
     ORDER BY created_at DESC LIMIT 200`,
  );
  const existing = rows.map((row) => row.primary_keyword).filter(Boolean);
  const focus = String(input.focus || '').trim();
  const prompt = `Bạn là chiến lược gia SEO cho MOLI.STUDIO, nền tảng ôn thi CSCA và du học Trung Quốc.
Hãy đề xuất đúng 12 ý tưởng bài viết thật đa dạng${focus ? `, ưu tiên định hướng "${focus}"` : ''}.
Phải trải đều nhiều nhóm: luyện thi CSCA, từng môn thi, tiếng Trung học thuật, học bổng, hồ sơ, visa, chọn trường/ngành, đời sống du học, chi phí, kinh nghiệm và công cụ học tập.
Không lặp hoặc gần trùng các từ khóa đã có: ${JSON.stringify(existing)}.
Trả về JSON thuần: {"ideas":[{"topic":"...","category":"...","primary_keyword":"...","secondary_keywords":["..."],"search_intent":"informational|commercial|transactional","angle":"góc triển khai khác biệt"}]}.
Từ khóa phải tự nhiên bằng tiếng Việt, có long-tail, ý định tìm kiếm rõ ràng và đủ khác nhau.`;
  const model = process.env.SEO_BLOG_AI_MODEL || aiConfig.adminExam.model;
  try {
    let raw = await callAdminExamAI(prompt, {
      model,
      maxTokens: 3000,
      temperature: 0.75,
      feature: 'seo_blog_ideas',
      responseFormat: { type: 'json_object' },
    });
    let parsed;
    try { parsed = parseGeneratedJson(raw); }
    catch {
      raw = await callAdminExamAI(`Convert the following output to valid JSON using exactly the schema {"ideas":[{"topic":"","category":"","primary_keyword":"","secondary_keywords":[],"search_intent":"informational","angle":""}]}. Return JSON only.\n\n${String(raw).slice(0,12000)}`, {model,maxTokens:3000,temperature:0.1,feature:'seo_blog_ideas_repair',responseFormat:{type:'json_object'}});
      parsed = parseGeneratedJson(raw);
    }
    const ideas = Array.isArray(parsed) ? parsed : Array.isArray(parsed.ideas) ? parsed.ideas : [];
    const valid = ideas.filter((idea) => idea?.primary_keyword);
    if (valid.length) return persistIdeas(valid.slice(0, 12), focus, userId);
  } catch (error) {
    console.warn('SEO idea AI output invalid, using curated fallback:', error.message);
  }
  return persistIdeas(fallbackIdeas(existing, focus), focus, userId);
}

async function listIdeas(status = 'unused') {
  const args = [];
  let where = 'TRUE';
  if (status && status !== 'all') { args.push(status); where = `status=$${args.length}`; }
  const { rows } = await db.query(
    `SELECT * FROM seo_blog_ideas WHERE ${where}
     ORDER BY CASE status WHEN 'unused' THEN 0 WHEN 'used' THEN 1 ELSE 2 END, created_at DESC
     LIMIT 200`,
    args,
  );
  return rows;
}

async function updateIdea(id, data = {}) {
  const status = ['unused','used','dismissed'].includes(data.status) ? data.status : 'used';
  const { rows } = await db.query(
    `UPDATE seo_blog_ideas SET status=$1, used_post_id=$2,
       used_at=CASE WHEN $1='used' THEN NOW() ELSE NULL END
     WHERE id=$3 RETURNING *`,
    [status, data.used_post_id || null, id],
  );
  return rows[0] || null;
}

async function deleteIdea(id) {
  const result = await db.query('DELETE FROM seo_blog_ideas WHERE id=$1', [id]);
  return result.rowCount > 0;
}

async function create(data) {
  const slug=slugify(data.slug||data.title); if(!slug) throw Object.assign(new Error('slug/title is required'),{status:400});
  const cols=[...FIELDS.filter(k=>k!=='slug'),'generated_provider','generated_model','generation_prompt','generation_metadata','created_by'].filter(k=>data[k]!==undefined);
  const vals=cols.map(k=>['generation_prompt','generation_metadata'].includes(k)?JSON.stringify(data[k]):data[k]);
  const {rows}=await db.query(`INSERT INTO seo_blog_posts (${cols.join(',')},slug,updated_at) VALUES (${cols.map((_,i)=>`$${i+1}`).join(',')},$${cols.length+1},NOW()) RETURNING *`,[...vals,slug]); return rows[0];
}
async function update(id,data) { const cols=FIELDS.filter(k=>data[k]!==undefined && k!=='slug'); if(data.slug!==undefined) { data.slug=slugify(data.slug); cols.push('slug'); } if(!cols.length) return get(id); const {rows}=await db.query(`UPDATE seo_blog_posts SET ${cols.map((k,i)=>`${k}=$${i+1}`).join(',')},updated_at=NOW() WHERE id=$${cols.length+1} RETURNING *`,[...cols.map(k=>data[k]),id]); return rows[0]; }
async function get(id){const {rows}=await db.query('SELECT * FROM seo_blog_posts WHERE id=$1',[id]);return rows[0];}
module.exports={validateSeo,cannibalization,findImage,generate,suggestIdeas,listIdeas,updateIdea,deleteIdea,create,update,get};
