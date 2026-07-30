import axios from '../utils/axios';

export interface AdminRoleOption {
    code: string;
    name?: string;
    label?: string;
    description?: string;
    permissions?: string[];
    color?: string;
}

export interface AdminUser {
    id: number;
    email: string;
    full_name: string;
    role: string;
    is_active: boolean;
    created_at: string;
    admin_roles: string[];
    permissions: string[];
    mfa_enabled?: boolean;
    primary_admin_role: string | null;
    last_active_at: string | null;
    total_actions: number;
}

export interface AdminActivity {
    id: number;
    user_id: number;
    action: string;
    metadata: Record<string, unknown>;
    ip_address: string | null;
    created_at: string;
    user_name: string;
    user_email: string;
    admin_roles: string[];
}

export interface AdminActivityFilters {
    adminId?: number;
    action?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
}

export interface AIUsageStats {
    overview: {
        total_requests: number | string;
        total_prompt_tokens: number | string;
        total_cache_hit_tokens: number | string;
        total_cache_miss_tokens: number | string;
        total_completion_tokens: number | string;
        total_tokens: number | string;
        total_cost_usd: number | string;
        unique_users: number | string;
    };
    perUser: Array<{
        user_id: number | null;
        full_name: string | null;
        email: string | null;
        role: string | null;
        requests: number | string;
        prompt_tokens: number | string;
        cache_hit_tokens: number | string;
        cache_miss_tokens: number | string;
        completion_tokens: number | string;
        total_tokens: number | string;
        cost_usd: number | string;
        last_used_at: string | null;
        models?: Array<{
            provider: string;
            model: string;
            requests: number | string;
            prompt_tokens: number | string;
            cache_hit_tokens: number | string;
            cache_miss_tokens: number | string;
            completion_tokens: number | string;
            total_tokens: number | string;
            cost_usd: number | string;
            pricing?: { input: number; inputCached: number; output: number };
        }>;
    }>;
    perModel: Array<{
        provider: string;
        model: string;
        requests: number | string;
        prompt_tokens: number | string;
        cache_hit_tokens: number | string;
        cache_miss_tokens: number | string;
        completion_tokens: number | string;
        total_tokens: number | string;
        cost_usd: number | string;
    }>;
    perFeature: Array<{
        feature: string;
        requests: number | string;
        prompt_tokens: number | string;
        completion_tokens: number | string;
        total_tokens: number | string;
        cost_usd: number | string;
    }>;
    daily: Array<{
        date: string;
        requests: number | string;
        total_tokens: number | string;
        cost_usd: number | string;
        unique_users: number | string;
    }>;
    pricing: Record<string, { input: number; inputCached: number; output: number }>;
}

export interface DatabaseBackupFile {
    fileName: string;
    size: number;
    createdAt: string;
}

export interface DatabaseBackupStatus {
    directory: string;
    directoryWritable: boolean;
    database: string;
    host: string;
    inProgress: boolean;
    pgDumpAvailable: boolean;
    pgDumpVersion: string | null;
    isRailway: boolean;
    backups: DatabaseBackupFile[];
}

export const adminApi = {
    // Get dashboard statistics
    async getDashboardStats(query = '') {
        const url = `/admin/stats${query ? query : ''}`;
        const response = await axios.get(url);
        return response.data;
    },

    // Get all users with pagination
    async getUsers(pageOrOptions: number | { page?: number; limit?: number; search?: string } = 1, limit = 20) {
        let page = typeof pageOrOptions === 'object' ? (pageOrOptions.page ?? 1) : pageOrOptions;
        let actualLimit = typeof pageOrOptions === 'object' ? (pageOrOptions.limit ?? 20) : limit;
        let params: Record<string, unknown> = { page, limit: actualLimit };
        if (typeof pageOrOptions === 'object' && pageOrOptions.search) {
            params.search = pageOrOptions.search;
        }
        const response = await axios.get('/admin/users', { params });
        return response.data;
    },

    // Delete user
    async deleteUser(userId: number) {
        const response = await axios.delete(`/admin/users/${userId}`);
        return response.data;
    },

    // Update user role
    async updateUserRole(userId: number, role: 'student' | 'admin') {
        const response = await axios.put(`/admin/users/${userId}/role`, { role });
        return response.data;
    },

    // Get available admin task roles
    async getAdminRoleOptions(): Promise<{ roles: AdminRoleOption[] }> {
        const response = await axios.get('/admin/roles');
        return response.data;
    },

    // Assign admin task roles to a user
    async updateUserAdminRoles(userId: number, roleCodes: string[]) {
        const response = await axios.put(`/admin/users/${userId}/admin-roles`, { roleCodes });
        return response.data;
    },

    // Block / Unblock user
    async updateUserStatus(userId: number, status: 'active' | 'blocked') {
        const response = await axios.put(`/admin/users/${userId}/status`, { status });
        return response.data;
    },

    // Get user activity logs
    async getUserActivities(userId: number, page = 1, limit = 50) {
        const response = await axios.get(`/admin/users/${userId}/activities`, {
            params: { page, limit }
        });
        return response.data;
    },

    // Get online users count
    async getOnlineUsers() {
        const response = await axios.get('/admin/online-users');
        return response.data as { online: number; users: { id: number; email: string; role: string }[] };
    },

    async getAIUsageStats(params?: { from?: string; to?: string; userId?: number; limit?: number }) {
        const response = await axios.get('/admin/ai-usage', { params });
        return response.data as { success: boolean; data: AIUsageStats };
    },

    async getDatabaseBackups() {
        const response = await axios.get('/admin/backups');
        return response.data as { success: boolean; data: DatabaseBackupStatus };
    },

    async createDatabaseBackup() {
        const response = await axios.post('/admin/backups', {}, { timeout: 15 * 60 * 1000 });
        return response.data as { success: boolean; message: string; data: DatabaseBackupFile };
    },

    async downloadDatabaseBackup(fileName: string) {
        const response = await axios.get(`/admin/backups/${encodeURIComponent(fileName)}/download`, {
            responseType: 'blob',
            timeout: 15 * 60 * 1000,
        });
        return response.data as Blob;
    },

    async deleteDatabaseBackup(fileName: string) {
        const response = await axios.delete(`/admin/backups/${encodeURIComponent(fileName)}`);
        return response.data as {
            success: boolean;
            message: string;
            data: { fileName: string; size: number };
        };
    },

    async getEmailAudienceStats() {
        const response = await axios.get('/admin/email-campaign/audience');
        return response.data as {
            success: boolean;
            data: {
                active_users: number;
                transactional_users: number;
                active_accounts: number;
            };
        };
    },

    async sendEmailCampaign(payload: {
        mode: 'all' | 'single';
        deliveryType: 'transactional' | 'marketing';
        userId?: number;
        subject: string;
        content: string;
        discountCode?: string;
        actionLabel?: string;
        actionUrl?: string;
    }) {
        const response = await axios.post('/admin/email-campaign/send', payload, { timeout: 120000 });
        return response.data as {
            success: boolean;
            message: string;
            data: { sent: number };
        };
    },

    async sendUserNotification(payload: {
        mode: 'all' | 'single';
        userId?: number;
        title: string;
        content: string;
        discountCode?: string;
        link?: string;
    }) {
        const response = await axios.post('/admin/notification-campaign/send', payload);
        return response.data as {
            success: boolean;
            message: string;
            data: {
                sent: number;
                campaignId?: number | null;
                deliveryType: 'transactional' | 'marketing';
            };
        };
    }
};

// ── Super Admin Control API ───────────────────────────────────────────────────
export const adminControlApi = {
    // Lấy danh sách tất cả admin
    async getAdmins(params?: { page?: number; limit?: number; search?: string; role?: string }) {
        const response = await axios.get('/admin/admins', { params });
        return response.data as { admins: AdminUser[]; pagination: { currentPage: number; totalPages: number; totalAdmins: number; limit: number } };
    },

    // Lấy thống kê admin
    async getAdminStats() {
        const response = await axios.get('/admin/admins/stats');
        return response.data;
    },

    // Lấy toàn bộ audit log admin (có thể filter)
    async getAllAdminActivities(filters?: AdminActivityFilters) {
        const response = await axios.get('/admin/admins/activities', { params: filters });
        return response.data as { activities: AdminActivity[]; pagination: { currentPage: number; totalPages: number; totalActivities: number; limit: number } };
    },

    // Lấy audit log của một admin cụ thể
    async getAdminActivities(adminId: number, page = 1, limit = 30) {
        const response = await axios.get(`/admin/admins/${adminId}/activities`, { params: { page, limit } });
        return response.data as { activities: AdminActivity[]; pagination: { currentPage: number; totalPages: number; totalActivities: number; limit: number } };
    },

    async resetAdminMfa(adminId: number) {
        const response = await axios.post(`/admin/admins/${adminId}/mfa/reset`);
        return response.data as { success: boolean; message: string };
    },
};
