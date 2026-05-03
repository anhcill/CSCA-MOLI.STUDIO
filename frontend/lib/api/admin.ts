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

export const adminApi = {
    // Get dashboard statistics
    async getDashboardStats() {
        const response = await axios.get('/admin/stats');
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
};

