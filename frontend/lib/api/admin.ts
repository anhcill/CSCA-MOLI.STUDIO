import axios from '../utils/axios';

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
    }
};
