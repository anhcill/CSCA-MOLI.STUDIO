const pool = require('../config/database');

const AdminController = {
    // Get dashboard statistics
    async getDashboardStats(req, res) {
        try {
            // Check if user is admin
            if (req.user.role !== 'admin') {
                return res.status(403).json({ message: 'Access denied. Admin only.' });
            }

            // Get total users
            const usersResult = await pool.query('SELECT COUNT(*) as count FROM users');
            const totalUsers = parseInt(usersResult.rows[0].count);

            // Get total exams
            const examsResult = await pool.query('SELECT COUNT(*) as count FROM exams');
            const totalExams = parseInt(examsResult.rows[0].count);

            // Get total exam attempts
            const attemptsResult = await pool.query('SELECT COUNT(*) as count FROM exam_attempts');
            const totalAttempts = parseInt(attemptsResult.rows[0].count);

            // Get total forum posts
            const postsResult = await pool.query('SELECT COUNT(*) as count FROM posts');
            const totalPosts = parseInt(postsResult.rows[0].count);

            // Get recent activities (last 10 exam attempts)
            const recentActivitiesQuery = `
        SELECT 
          ea.id,
          ea.created_at,
          u.full_name as user_name,
          e.title as exam_title,
          ea.total_score,
          ea.status
        FROM exam_attempts ea
        JOIN users u ON ea.user_id = u.id
        JOIN exams e ON ea.exam_id = e.id
        ORDER BY ea.created_at DESC
        LIMIT 10
      `;
            const activitiesResult = await pool.query(recentActivitiesQuery);

            res.json({
                totalUsers,
                totalExams,
                totalAttempts,
                totalPosts,
                recentActivities: activitiesResult.rows
            });
        } catch (error) {
            console.error('Error getting dashboard stats:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },

    // Get all users (with pagination)
    async getUsers(req, res) {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({ message: 'Access denied. Admin only.' });
            }

            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const offset = (page - 1) * limit;

            const usersQuery = `
        SELECT 
          id, 
          email, 
          full_name, 
          role, 
          created_at,
          (SELECT COUNT(*) FROM exam_attempts WHERE user_id = users.id) as total_attempts
        FROM users
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
      `;

            const countQuery = 'SELECT COUNT(*) as count FROM users';

            const [usersResult, countResult] = await Promise.all([
                pool.query(usersQuery, [limit, offset]),
                pool.query(countQuery)
            ]);

            const totalUsers = parseInt(countResult.rows[0].count);
            const totalPages = Math.ceil(totalUsers / limit);

            res.json({
                users: usersResult.rows,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalUsers,
                    limit
                }
            });
        } catch (error) {
            console.error('Error getting users:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },

    // Delete user
    async deleteUser(req, res) {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({ message: 'Access denied. Admin only.' });
            }

            const { userId } = req.params;

            // Prevent deleting yourself
            if (parseInt(userId) === req.user.id) {
                return res.status(400).json({ message: 'Cannot delete your own account' });
            }

            await pool.query('DELETE FROM users WHERE id = $1', [userId]);

            res.json({ message: 'User deleted successfully' });
        } catch (error) {
            console.error('Error deleting user:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },

    // Update user role
    async updateUserRole(req, res) {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({ message: 'Access denied. Admin only.' });
            }

            const { userId } = req.params;
            const { role } = req.body;

            if (!['student', 'admin'].includes(role)) {
                return res.status(400).json({ message: 'Invalid role' });
            }

            // Prevent changing your own role
            if (parseInt(userId) === req.user.id) {
                return res.status(400).json({ message: 'Cannot change your own role' });
            }

            await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, userId]);

            res.json({ message: 'User role updated successfully' });
        } catch (error) {
            console.error('Error updating user role:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
};

module.exports = AdminController;
