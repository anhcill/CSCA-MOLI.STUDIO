import axios from '../utils/axios';

export interface AdminRoleOption {
    code: string;
    name: string;
    description: string;
    permissions: string[];
}

export const adminApi = {
    // Get dashboard statistics
    async getDashboardStats() {
        const response = await axios.get('/admin/stats');
        return response.data;
    },

    // Get all users with pagination
    async getUsers(page = 1, limit = 20) {
        const response = await axios.get('/admin/users', {
            params: { page, limit }
        });
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
    }
};
