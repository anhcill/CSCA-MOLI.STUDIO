const pool = require('../config/database');
const { invalidateAuthorizationCache } = require('../services/rbacService');

const ADMIN_ROLE_CODES = [
    'super_admin',
    'user_admin',
    'forum_admin',
    'roadmap_admin',
    'exam_admin',
    'content_admin',
];

const ROLE_PRIORITY = [
    'super_admin',
    'user_admin',
    'exam_admin',
    'content_admin',
    'forum_admin',
    'roadmap_admin',
];

const getPrimaryAdminRole = (roles = []) => {
    if (!Array.isArray(roles) || roles.length === 0) return null;
    return ROLE_PRIORITY.find((code) => roles.includes(code)) || roles[0] || null;
};

const AdminController = {
    // Get dashboard statistics
    async getDashboardStats(req, res) {
        try {
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
            const parsedPage = Number.parseInt(req.query.page, 10);
            const parsedLimit = Number.parseInt(req.query.limit, 10);
            const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
            const limit = Number.isInteger(parsedLimit)
                ? Math.min(Math.max(parsedLimit, 1), 100)
                : 20;
            const offset = (page - 1) * limit;

                        const usersQuery = `
                SELECT
                    u.id,
                    u.email,
                    u.full_name,
                    u.role,
                    u.created_at,
                    (SELECT COUNT(*) FROM exam_attempts WHERE user_id = u.id) AS total_attempts,
                    COALESCE(
                        ARRAY_REMOVE(
                            ARRAY_AGG(DISTINCT CASE WHEN r.code = ANY($3::text[]) THEN r.code END),
                            NULL
                        ),
                        '{}'::text[]
                    ) AS admin_roles
                FROM users u
                LEFT JOIN user_roles ur ON ur.user_id = u.id
                LEFT JOIN roles r ON r.id = ur.role_id
                GROUP BY u.id, u.email, u.full_name, u.role, u.created_at
                ORDER BY u.created_at DESC
                LIMIT $1 OFFSET $2
            `;

            const countQuery = 'SELECT COUNT(*) as count FROM users';

            const [usersResult, countResult] = await Promise.all([
                pool.query(usersQuery, [limit, offset, ADMIN_ROLE_CODES]),
                pool.query(countQuery)
            ]);

            const totalUsers = parseInt(countResult.rows[0].count);
            const totalPages = Math.ceil(totalUsers / limit);

            const users = usersResult.rows.map((user) => {
                const adminRoles = Array.isArray(user.admin_roles)
                    ? user.admin_roles.filter((roleCode) => ADMIN_ROLE_CODES.includes(roleCode))
                    : [];

                return {
                    ...user,
                    admin_roles: adminRoles,
                    primary_admin_role: getPrimaryAdminRole(adminRoles),
                };
            });

            res.json({
                users,
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
            const { userId } = req.params;
            const { role } = req.body;
            const normalizedUserId = Number.parseInt(userId, 10);

            if (!['student', 'admin'].includes(role)) {
                return res.status(400).json({ message: 'Invalid role' });
            }

            // Prevent changing your own role
            if (normalizedUserId === req.user.id) {
                return res.status(400).json({ message: 'Cannot change your own role' });
            }

            const client = await pool.pool.connect();

            try {
                await client.query('BEGIN');

                const beforeResult = await client.query(
                    'SELECT role FROM users WHERE id = $1 FOR UPDATE',
                    [normalizedUserId]
                );

                if (beforeResult.rowCount === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ message: 'User not found' });
                }

                const previousRole = beforeResult.rows[0].role;

                await client.query('UPDATE users SET role = $1 WHERE id = $2', [role, normalizedUserId]);

                if (role === 'student') {
                    await client.query(
                        `DELETE FROM user_roles
                         WHERE user_id = $1
                           AND role_id IN (
                             SELECT id FROM roles WHERE code = ANY($2::text[])
                           )`,
                        [normalizedUserId, ADMIN_ROLE_CODES]
                    );

                    await client.query(
                        `INSERT INTO user_roles (user_id, role_id, assigned_by)
                         SELECT $1, id, $2 FROM roles WHERE code = 'student'
                         ON CONFLICT (user_id, role_id) DO NOTHING`,
                        [normalizedUserId, req.user.id]
                    );
                } else {
                    await client.query(
                        `DELETE FROM user_roles
                         WHERE user_id = $1
                           AND role_id IN (SELECT id FROM roles WHERE code = 'student')`,
                        [normalizedUserId]
                    );

                    const currentAdminRolesResult = await client.query(
                        `SELECT r.code
                         FROM user_roles ur
                         JOIN roles r ON r.id = ur.role_id
                         WHERE ur.user_id = $1
                           AND r.code = ANY($2::text[])`,
                        [normalizedUserId, ADMIN_ROLE_CODES]
                    );

                    const currentAdminRoles = currentAdminRolesResult.rows.map((row) => row.code);
                    const hasModuleRole = currentAdminRoles.some((code) => code !== 'super_admin');

                    if (previousRole !== 'admin' || !hasModuleRole) {
                        await client.query(
                            `DELETE FROM user_roles
                             WHERE user_id = $1
                               AND role_id IN (SELECT id FROM roles WHERE code = 'super_admin')`,
                            [normalizedUserId]
                        );

                        await client.query(
                            `INSERT INTO user_roles (user_id, role_id, assigned_by)
                             SELECT $1, id, $2 FROM roles WHERE code = 'user_admin'
                             ON CONFLICT (user_id, role_id) DO NOTHING`,
                            [normalizedUserId, req.user.id]
                        );
                    }
                }

                await client.query('COMMIT');
            } catch (txError) {
                await client.query('ROLLBACK');
                throw txError;
            } finally {
                client.release();
            }

            invalidateAuthorizationCache(normalizedUserId);

            res.json({ message: 'User role updated successfully' });
        } catch (error) {
            console.error('Error updating user role:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },

    async getAdminRoleOptions(req, res) {
        try {
            const roleResult = await pool.query(
                `SELECT
                   r.code,
                   r.name,
                   r.description,
                   COALESCE(
                     ARRAY_REMOVE(ARRAY_AGG(DISTINCT p.code), NULL),
                     '{}'::text[]
                   ) AS permissions
                 FROM roles r
                 LEFT JOIN role_permissions rp ON rp.role_id = r.id
                 LEFT JOIN permissions p ON p.id = rp.permission_id
                 WHERE r.code = ANY($1::text[])
                 GROUP BY r.id, r.code, r.name, r.description`,
                [ADMIN_ROLE_CODES]
            );

            const roleMap = new Map(roleResult.rows.map((row) => [row.code, row]));
            const roles = ROLE_PRIORITY
                .map((code) => roleMap.get(code))
                .filter(Boolean);

            res.json({ roles });
        } catch (error) {
            console.error('Error getting admin role options:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },

    async updateUserAdminRoles(req, res) {
        try {
            const { userId } = req.params;
            const { roleCodes } = req.body;
            const normalizedUserId = Number.parseInt(userId, 10);

            if (normalizedUserId === req.user.id) {
                return res.status(400).json({ message: 'Cannot change your own admin scope' });
            }

            if (!Array.isArray(roleCodes)) {
                return res.status(400).json({ message: 'roleCodes must be an array' });
            }

            const uniqueRoleCodes = [...new Set(roleCodes)]
                .map((code) => String(code))
                .filter((code) => ADMIN_ROLE_CODES.includes(code));

            if (uniqueRoleCodes.length !== roleCodes.length) {
                return res.status(400).json({ message: 'One or more admin roles are invalid' });
            }

            const client = await pool.pool.connect();

            try {
                await client.query('BEGIN');

                const userExists = await client.query(
                    'SELECT id FROM users WHERE id = $1 FOR UPDATE',
                    [normalizedUserId]
                );

                if (userExists.rowCount === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ message: 'User not found' });
                }

                if (uniqueRoleCodes.length === 0) {
                    await client.query('UPDATE users SET role = $1 WHERE id = $2', ['student', normalizedUserId]);

                    await client.query(
                        `DELETE FROM user_roles
                         WHERE user_id = $1
                           AND role_id IN (
                             SELECT id FROM roles WHERE code = ANY($2::text[])
                           )`,
                        [normalizedUserId, ADMIN_ROLE_CODES]
                    );

                    await client.query(
                        `INSERT INTO user_roles (user_id, role_id, assigned_by)
                         SELECT $1, id, $2 FROM roles WHERE code = 'student'
                         ON CONFLICT (user_id, role_id) DO NOTHING`,
                        [normalizedUserId, req.user.id]
                    );
                } else {
                    await client.query('UPDATE users SET role = $1 WHERE id = $2', ['admin', normalizedUserId]);

                    await client.query(
                        `DELETE FROM user_roles
                         WHERE user_id = $1
                           AND role_id IN (
                             SELECT id FROM roles WHERE code = ANY($2::text[])
                           )`,
                        [normalizedUserId, [...ADMIN_ROLE_CODES, 'student']]
                    );

                    await client.query(
                        `INSERT INTO user_roles (user_id, role_id, assigned_by)
                         SELECT $1, r.id, $2
                         FROM roles r
                         WHERE r.code = ANY($3::text[])
                         ON CONFLICT (user_id, role_id) DO NOTHING`,
                        [normalizedUserId, req.user.id, uniqueRoleCodes]
                    );
                }

                await client.query('COMMIT');
            } catch (txError) {
                await client.query('ROLLBACK');
                throw txError;
            } finally {
                client.release();
            }

            invalidateAuthorizationCache(normalizedUserId);

            return res.json({
                message: 'Admin task roles updated successfully',
                roleCodes: uniqueRoleCodes,
            });

        } catch (error) {
            console.error('Error updating user admin roles:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },

    // Admin chỉnh sửa thông tin user: tên, email, subscription tier, VIP
    async updateUserProfile(req, res) {
        try {
            const { userId } = req.params;
            const normalizedUserId = Number.parseInt(userId, 10);
            const { full_name, email, subscription_tier, vip_days } = req.body;

            if (isNaN(normalizedUserId)) return res.status(400).json({ message: 'Invalid user ID' });

            const VALID_TIERS = ['basic', 'vip', 'premium'];
            if (subscription_tier && !VALID_TIERS.includes(subscription_tier)) {
                return res.status(400).json({ message: 'subscription_tier không hợp lệ (basic/vip/premium)' });
            }

            // Check email unique nếu đổi
            if (email) {
                const existing = await pool.query(
                    'SELECT id FROM users WHERE email = $1 AND id != $2',
                    [email, normalizedUserId]
                );
                if (existing.rowCount > 0) return res.status(409).json({ message: 'Email đã được sử dụng bởi user khác' });
            }

            // Tính VIP expires
            let vipFields = '';
            let vipParams = [];
            if (subscription_tier === 'vip' || subscription_tier === 'premium') {
                const days = parseInt(vip_days) || 30;
                const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
                vipFields = ', is_vip = TRUE, vip_expires_at = $__VIP__';
                vipParams = [expiresAt];
            } else if (subscription_tier === 'basic') {
                vipFields = ', is_vip = FALSE, vip_expires_at = NULL';
            }

            const setClauses = [];
            const params = [];

            if (full_name) { params.push(full_name); setClauses.push(`full_name = $${params.length}`); }
            if (email) { params.push(email); setClauses.push(`email = $${params.length}`); }
            if (subscription_tier) { params.push(subscription_tier); setClauses.push(`subscription_tier = $${params.length}`); }
            if (vipParams.length > 0) {
                params.push(vipParams[0]);
                setClauses.push(`is_vip = ${subscription_tier !== 'basic'}`, `vip_expires_at = $${params.length}`);
            }
            if (subscription_tier === 'basic') {
                setClauses.push(`is_vip = FALSE`, `vip_expires_at = NULL`);
            }

            if (setClauses.length === 0) return res.status(400).json({ message: 'Không có thông tin cần cập nhật' });

            params.push(normalizedUserId);
            const result = await pool.query(
                `UPDATE users SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING id, full_name, email, subscription_tier, is_vip, vip_expires_at`,
                params
            );

            if (result.rowCount === 0) return res.status(404).json({ message: 'User không tồn tại' });

            invalidateAuthorizationCache(normalizedUserId);
            res.json({ success: true, message: 'Cập nhật user thành công', data: result.rows[0] });
        } catch (error) {
            console.error('Error updating user profile:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
};

module.exports = AdminController;
