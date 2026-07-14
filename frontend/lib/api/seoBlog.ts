import axios from '../utils/axios';

export type SeoPostStatus = 'draft' | 'scheduled' | 'published' | 'archived';
export interface SeoIssue { type?: 'error' | 'warning' | 'success'; ok?: boolean; message: string }
export interface SeoPost {
  id: number | string; title: string; slug: string; excerpt: string; content: string;
  meta_title: string; meta_description: string; primary_keyword: string;
  secondary_keywords: string[]; category: string; search_intent: string; topic?: string;
  status: SeoPostStatus; cover_image?: string; cover_image_source?: string; cover_image_source_url?: string;
  cover_image_alt?: string; seo_score?: number; seo_issues?: SeoIssue[];
  cannibalization?: Array<{ id: number | string; title: string; slug?: string; similarity?: number }>;
  scheduled_at?: string | null; published_at?: string | null; updated_at?: string;
  reused_existing?: boolean;
}
export type SeoPostInput = Omit<SeoPost, 'id' | 'updated_at' | 'published_at'>;
export interface GenerateDraftInput { primary_keyword: string; secondary_keywords: string[]; category: string; search_intent: string; topic?: string }
export interface SeoIdea { id: number | string; topic: string; category: string; primary_keyword: string; secondary_keywords: string[]; search_intent: string; angle?: string; status: 'unused'|'used'|'dismissed'; created_at?: string; used_at?: string|null; used_post_id?: number|string|null }
export interface SeoImage { url:string; thumbnail?:string; alt:string; source:string; source_url:string; search_query?:string }
const unwrap = <T>(payload: any): T => (payload?.data ?? payload) as T;
export const seoBlogApi = {
  async list(params?: { search?: string; status?: string; category?: string; page?: number }) { const r = await axios.get('/admin/seo-blog', { params: { ...params, q: params?.search, search: undefined } }); return { posts: (r.data?.data ?? []) as SeoPost[], pagination: r.data?.meta }; },
  async generateDraft(input: GenerateDraftInput) { const r = await axios.post('/admin/seo-blog/generate', input); return { ...r.data.data, seo_score: r.data.seo?.score, seo_issues: r.data.seo?.checks, cannibalization: r.data.cannibalization?.posts } as SeoPost; },
  async suggestIdeas(focus?: string) { const r = await axios.post('/admin/seo-blog/suggest-ideas', { focus }); return (r.data?.data ?? []) as SeoIdea[]; },
  async listIdeas(status: 'unused'|'used'|'dismissed'|'all' = 'unused') { const r=await axios.get('/admin/seo-blog/ideas',{params:{status}}); return (r.data?.data??[]) as SeoIdea[]; },
  async updateIdea(id: SeoIdea['id'], input: {status:'unused'|'used'|'dismissed';used_post_id?:SeoPost['id']}) { const r=await axios.patch(`/admin/seo-blog/ideas/${id}`,input); return unwrap<SeoIdea>(r.data); },
  async deleteIdea(id: SeoIdea['id']) { await axios.delete(`/admin/seo-blog/ideas/${id}`); },
  async create(input: Partial<SeoPostInput>) { const r = await axios.post('/admin/seo-blog', input); return { ...r.data.data, seo_score:r.data.seo?.score, seo_issues:r.data.seo?.checks } as SeoPost; },
  async update(id: SeoPost['id'], input: Partial<SeoPostInput>) { const r = await axios.put(`/admin/seo-blog/${id}`, input); const d=r.data.data; return { ...d, seo_score:d.seo?.score ?? d.seo_score, seo_issues:d.seo?.checks ?? d.seo_issues } as SeoPost; },
  async validate(id: SeoPost['id']) { const r=await axios.post(`/admin/seo-blog/${id}/validate`); const d=r.data.data; return { seo:{...d.seo,issues:d.seo?.checks||[]},cannibalization:d.cannibalization?.posts||[] } as { seo: { score:number; issues:SeoIssue[] }; cannibalization: SeoPost['cannibalization'] }; },
  async searchImages(query: string, topic?: string, page = 1) { const r=await axios.get('/admin/seo-blog/image-search',{params:{q:query,topic,limit:8,page}}); return (r.data.data ?? []) as SeoImage[]; },
  async publish(id: SeoPost['id']) { const r = await axios.post(`/admin/seo-blog/${id}/publish`); return unwrap<SeoPost>(r.data); },
  async schedule(id: SeoPost['id'], scheduled_at: string) { const r = await axios.post(`/admin/seo-blog/${id}/schedule`, { scheduled_at, timezone: 'Asia/Ho_Chi_Minh' }); return unwrap<SeoPost>(r.data); },
  async archive(id: SeoPost['id']) { const r=await axios.patch(`/admin/seo-blog/${id}`,{status:'archived'}); return unwrap<SeoPost>(r.data); },
  async remove(id: SeoPost['id']) { await axios.delete(`/admin/seo-blog/${id}`); },
};
