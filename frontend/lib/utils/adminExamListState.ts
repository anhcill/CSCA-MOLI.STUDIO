export type AdminExamFilter = 'all' | 'phong-thi' | 'tu-do' | 'mo-phong' | 'delete-requests' | 'trash';
export type AdminExamAccessFilter = 'all' | 'normal' | 'vip';

const ADMIN_EXAM_FILTERS: AdminExamFilter[] = ['all', 'tu-do', 'mo-phong', 'delete-requests', 'trash'];
const ADMIN_EXAM_ACCESS_FILTERS: AdminExamAccessFilter[] = ['all', 'normal', 'vip'];

const STORAGE_KEY = 'moly.adminExamListState';

type SearchParamReader = {
    get(name: string): string | null;
};

export function parseAdminExamFilter(value?: string | null): AdminExamFilter {
    return ADMIN_EXAM_FILTERS.includes(value as AdminExamFilter) ? (value as AdminExamFilter) : 'all';
}

export function parseAdminExamAccessFilter(value?: string | null): AdminExamAccessFilter {
    return ADMIN_EXAM_ACCESS_FILTERS.includes(value as AdminExamAccessFilter) ? (value as AdminExamAccessFilter) : 'all';
}

export function buildAdminExamListQuery(filterType?: string | null, subjectFilter?: string | null, accessFilter?: string | null) {
    const params = new URLSearchParams();
    const type = parseAdminExamFilter(filterType);
    const subject = (subjectFilter || '').trim();
    const access = parseAdminExamAccessFilter(accessFilter);

    if (type !== 'all') params.set('type', type);
    if (subject) params.set('subject', subject);
    if (access !== 'all') params.set('access', access);

    return params.toString();
}

export function withAdminExamListState(path: string, filterType?: string | null, subjectFilter?: string | null, accessFilter?: string | null) {
    const query = buildAdminExamListQuery(filterType, subjectFilter, accessFilter);
    if (!query) return path;
    return `${path}${path.includes('?') ? '&' : '?'}${query}`;
}

/** Persist current filter state to sessionStorage so it survives navigation. */
export function saveAdminExamListState(filterType?: string | null, subjectFilter?: string | null, accessFilter?: string | null) {
    try {
        const type = parseAdminExamFilter(filterType);
        const subject = (subjectFilter || '').trim();
        const access = parseAdminExamAccessFilter(accessFilter);
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ type, subject, access }));
    } catch {}
}

/** Read persisted filter state from sessionStorage. */
export function loadAdminExamListState(): { type: AdminExamFilter; subject: string; access: AdminExamAccessFilter } {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            return {
                type: parseAdminExamFilter(parsed.type),
                subject: (parsed.subject || '').trim(),
                access: parseAdminExamAccessFilter(parsed.access),
            };
        }
    } catch {}
    return { type: 'all', subject: '', access: 'all' };
}

export function getAdminExamListStateHref(path: string, searchParams: SearchParamReader) {
    return withAdminExamListState(path, searchParams.get('type'), searchParams.get('subject'), searchParams.get('access'));
}
