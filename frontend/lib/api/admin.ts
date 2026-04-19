import axios from '../utils/axios';

export interface AdminRoleOption {
    code: string;
    name?: string;
    label?: string;
    description?: string;
    permissions?: string[];
    color?: string;
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
