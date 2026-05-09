const pool = require('../config/database');
const UserActivity = require('../models/UserActivity');
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
            const { from, to } = req.query;

            // Build date filter clause
            let dateFilter = '';
            const params = [];
            if (from) {
                params.push(from);
                dateFilter += ` AND created_at >= $${params.length}`;
            }
            if (to) {
                params.push(to + 'T23:59:59.999Z');
                dateFilter += ` AND created_at <= $${params.length}`;
            }

            // Get users
            const usersResult = await pool.query(
                `SELECT COUNT(*) as count FROM users${dateFilter ? ` WHERE ${dateFilter.replace(/AND /, '')}` : ''}`,
                params
            );
            const totalUsers = parseInt(usersResult.rows[0].count);

            // Get exams
            const examsResult = await pool.query(
                `SELECT COUNT(*) as count FROM exams${dateFilter ? ` WHERE ${dateFilter.replace(/AND /, '')}` : ''}`,
                params
            );
            const totalExams = parseInt(examsResult.rows[0].count);

            // Get exam attempts
            const attemptsResult = await pool.query(
                `SELECT COUNT(*) as count FROM exam_attempts WHERE 1=1${dateFilter}`,
                params
            );
            const totalAttempts = parseInt(attemptsResult.rows[0].count);

            // Get forum posts
            const postsResult = await pool.query(
                `SELECT COUNT(*) as count FROM posts WHERE 1=1${dateFilter}`,
                params
            );
            const totalPosts = parseInt(postsResult.rows[0].count);

            // Get recent activities (last 10)
            const activitiesResult = await pool.query(`
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
            `);

            // Revenue from completed transactions in date range
            let revenue = 0;
            if (dateFilter) {
                const revenueParams = [];
                if (from) revenueParams.push(from);
                if (to) revenueParams.push(to + 'T23:59:59.999Z');
                const revenueResult = await pool.query(
                    `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE status = 'completed'${dateFilter}`,
                    revenueParams
                );
                revenue = parseInt(revenueResult.rows[0].total);
            }

            res.json({
                totalUsers,
                totalExams,
                totalAttempts,
                totalPosts,
                revenue,
                recentActivities: activitiesResult.rows,
                dateRange: { from: from || null, to: to || null },
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
                    u.is_active,
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
                GROUP BY u.id, u.email, u.full_name, u.role, u.is_active, u.created_at
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

            // Log trước khi xóa (user_id sẽ mất sau khi DELETE)
            await UserActivity.log(req.user.id, 'admin.delete_user', {
                deletedUserId: userId,
                performedBy: req.user.full_name,
            });

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

            const setClauses = [];
            const params = [];

            if (full_name) { params.push(full_name); setClauses.push(`full_name = $${params.length}`); }
            if (email) { params.push(email); setClauses.push(`email = $${params.length}`); }

            // ── subscription_tier logic ──────────────────────────────────────────
            if (subscription_tier) {
                params.push(subscription_tier);
                setClauses.push(`subscription_tier = $${params.length}`);

                if (subscription_tier === 'vip' || subscription_tier === 'premium') {
                    // Cộng dồn ngày — CÙNG LOGIC với grantVip:
                    // nếu user còn hạn → cộng tiếp; chưa có → tính từ now
                    const days = parseInt(vip_days) || 30;
                    params.push(days);
                    setClauses.push(
                        `is_vip = TRUE`,
                        `vip_expires_at = GREATEST(COALESCE(vip_expires_at, NOW()), NOW()) + INTERVAL '1 day' * $${params.length}`
                    );
                } else if (subscription_tier === 'basic') {
                    // Revoke → clear VIP + logout all sessions
                    setClauses.push(`is_vip = FALSE`, `vip_expires_at = NULL`);
                    // Revoke all user sessions immediately
                    const DeviceSessionService = require('../services/deviceSessionService');
                    DeviceSessionService.removeAllUserSessions(normalizedUserId).catch(err =>
                        console.error('[updateUserProfile] Session revoke error:', err.message)
                    );
                }
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
    },

    // Block / Unblock user
    async updateUserStatus(req, res) {
        try {
            const { userId } = req.params;
            const { status } = req.body; // 'active' | 'blocked'
            const normalizedUserId = Number.parseInt(userId, 10);

            if (normalizedUserId === req.user.id) {
                return res.status(400).json({ message: 'Không thể khóa/mở khóa chính mình' });
            }

            if (!['active', 'blocked'].includes(status)) {
                return res.status(400).json({ message: 'status phải là "active" hoặc "blocked"' });
            }

            const isActive = status === 'active';

            const result = await pool.query(
                `UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING id, full_name, is_active`,
                [isActive, normalizedUserId]
            );

            if (result.rowCount === 0) {
                return res.status(404).json({ message: 'User không tồn tại' });
            }

            // Log hành vi
            await UserActivity.log(req.user.id, 'admin.change_user_status', {
                targetUserId: normalizedUserId,
                newStatus: status,
                performedBy: req.user.full_name,
            });

            invalidateAuthorizationCache(normalizedUserId);

            res.json({
                success: true,
                message: isActive ? 'Đã mở khóa user' : 'Đã khóa user',
                data: result.rows[0],
            });
        } catch (error) {
            console.error('Error updating user status:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },

    // Lấy danh sách tất cả admin (chỉ super_admin)
    async getAdmins(req, res) {
        try {
            const parsedPage = Number.parseInt(req.query.page, 10);
            const parsedLimit = Number.parseInt(req.query.limit, 10);
            const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
            const limit = Number.isInteger(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 20;
            const offset = (page - 1) * limit;
            const { search, role } = req.query;

            const conditions = [`u.role = 'admin'`];
            const params = [];
            let idx = 1;

            if (search) {
                conditions.push(`(u.full_name ILIKE $${idx} OR u.email ILIKE $${idx})`);
                params.push(`%${search}%`);
                idx++;
            }
            if (role && ADMIN_ROLE_CODES.includes(role)) {
                conditions.push(`$${idx} = ANY(ARRAY_AGG(DISTINCT r2.code))`);
                params.push(role);
                idx++;
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            const adminsQuery = `
                SELECT
                    u.id,
                    u.email,
                    u.full_name,
                    u.role,
                    u.is_active,
                    u.created_at,
                    COALESCE(
                        ARRAY_REMOVE(ARRAY_AGG(DISTINCT CASE WHEN r2.code = ANY($${idx}::text[]) THEN r2.code END), NULL),
                        '{}'::text[]
                    ) AS admin_roles,
                    COALESCE(
                        ARRAY_REMOVE(ARRAY_AGG(DISTINCT p.code), NULL),
                        '{}'::text[]
                    ) AS permissions,
                    MAX(ua.created_at) AS last_active_at,
                    COUNT(DISTINCT ua.id) AS total_actions
                FROM users u
                LEFT JOIN user_roles ur ON ur.user_id = u.id
                LEFT JOIN roles r2 ON r2.id = ur.role_id
                LEFT JOIN role_permissions rp ON rp.role_id = r2.id
                LEFT JOIN permissions p ON p.id = rp.permission_id
                LEFT JOIN user_activities ua ON ua.user_id = u.id AND ua.created_at >= NOW() - INTERVAL '30 days'
                ${whereClause}
                GROUP BY u.id, u.email, u.full_name, u.role, u.is_active, u.created_at
                ORDER BY u.created_at DESC
                LIMIT $${idx + 1} OFFSET $${idx + 2}
            `;

            params.push(ADMIN_ROLE_CODES, limit, offset);

            const countQuery = `SELECT COUNT(DISTINCT u.id) as count FROM users u ${whereClause}`;
            const countParams = params.slice(0, -3); // exclude ADMIN_ROLE_CODES, limit, offset

            const [adminsResult, countResult] = await Promise.all([
                pool.query(adminsQuery, params),
                pool.query(countQuery, countParams)
            ]);

            const totalAdmins = parseInt(countResult.rows[0].count);
            const admins = adminsResult.rows.map(admin => ({
                ...admin,
                admin_roles: Array.isArray(admin.admin_roles) ? admin.admin_roles.filter(c => ADMIN_ROLE_CODES.includes(c)) : [],
                permissions: Array.isArray(admin.permissions) ? admin.permissions : [],
                primary_admin_role: getPrimaryAdminRole(
                    Array.isArray(admin.admin_roles) ? admin.admin_roles.filter(c => ADMIN_ROLE_CODES.includes(c)) : []
                ),
                total_actions: parseInt(admin.total_actions || 0),
            }));

            res.json({
                admins,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(totalAdmins / limit),
                    totalAdmins,
                    limit
                }
            });
        } catch (error) {
            console.error('Error getting admins:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },

    // Thống kê hoạt động admin (chỉ super_admin)
    async getAdminStats(req, res) {
        try {
            // Tổng số admin
            const totalAdminsResult = await pool.query(`SELECT COUNT(*) as count FROM users WHERE role = 'admin'`);

            // Admin hoạt động trong 24h gần nhất
            const activeAdminsResult = await pool.query(`
                SELECT COUNT(DISTINCT ua.user_id) as count
                FROM user_activities ua
                JOIN users u ON u.id = ua.user_id
                WHERE u.role = 'admin' AND ua.created_at >= NOW() - INTERVAL '24 hours'
            `);

            // Tổng thao tác admin trong 30 ngày
            const totalActionsResult = await pool.query(`
                SELECT COUNT(*) as count
                FROM user_activities ua
                JOIN users u ON u.id = ua.user_id
                WHERE u.role = 'admin' AND ua.created_at >= NOW() - INTERVAL '30 days'
            `);

            // Top 5 admin hoạt động nhiều nhất (30 ngày)
            const topAdminsResult = await pool.query(`
                SELECT
                    u.id,
                    u.full_name,
                    u.email,
                    COUNT(ua.id) as action_count,
                    MAX(ua.created_at) as last_active_at,
                    COALESCE(
                        ARRAY_REMOVE(ARRAY_AGG(DISTINCT CASE WHEN r.code = ANY($1::text[]) THEN r.code END), NULL),
                        '{}'::text[]
                    ) AS admin_roles
                FROM users u
                LEFT JOIN user_activities ua ON ua.user_id = u.id AND ua.created_at >= NOW() - INTERVAL '30 days'
                LEFT JOIN user_roles ur ON ur.user_id = u.id
                LEFT JOIN roles r ON r.id = ur.role_id
                WHERE u.role = 'admin'
                GROUP BY u.id, u.full_name, u.email
                ORDER BY action_count DESC
                LIMIT 5
            `, [ADMIN_ROLE_CODES]);

            // Phân bố vai trò
            const roleDistributionResult = await pool.query(`
                SELECT
                    r.code,
                    r.name,
                    COUNT(DISTINCT ur.user_id) as count
                FROM roles r
                LEFT JOIN user_roles ur ON ur.role_id = r.id
                LEFT JOIN users u ON u.id = ur.user_id AND u.role = 'admin'
                WHERE r.code = ANY($1::text[])
                GROUP BY r.id, r.code, r.name
                ORDER BY count DESC
            `, [ADMIN_ROLE_CODES]);

            // Thống kê action theo ngày (7 ngày gần nhất)
            const activityByDayResult = await pool.query(`
                SELECT
                    DATE(ua.created_at) as date,
                    COUNT(*) as count
                FROM user_activities ua
                JOIN users u ON u.id = ua.user_id
                WHERE u.role = 'admin' AND ua.created_at >= NOW() - INTERVAL '7 days'
                GROUP BY DATE(ua.created_at)
                ORDER BY date ASC
            `);

            res.json({
                overview: {
                    totalAdmins: parseInt(totalAdminsResult.rows[0].count),
                    activeAdminsToday: parseInt(activeAdminsResult.rows[0].count),
                    totalActionsThisMonth: parseInt(totalActionsResult.rows[0].count),
                },
                topAdmins: topAdminsResult.rows.map(row => ({
                    ...row,
                    action_count: parseInt(row.action_count),
                    admin_roles: Array.isArray(row.admin_roles) ? row.admin_roles : [],
                })),
                roleDistribution: roleDistributionResult.rows.map(row => ({
                    ...row,
                    count: parseInt(row.count),
                })),
                activityByDay: activityByDayResult.rows.map(row => ({
                    date: row.date,
                    count: parseInt(row.count),
                })),
            });
        } catch (error) {
            console.error('Error getting admin stats:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },

    // Lấy audit log thao tác của admin (chỉ super_admin)
    async getAdminActivities(req, res) {
        try {
            const { adminId } = req.params;
            const parsedPage = Number.parseInt(req.query.page, 10);
            const parsedLimit = Number.parseInt(req.query.limit, 10);
            const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
            const limit = Number.isInteger(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 50;
            const offset = (page - 1) * limit;

            const result = await UserActivity.getAll(limit, offset, { userId: Number(adminId) });

            res.json({
                activities: result.activities,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(result.total / limit),
                    totalActivities: result.total,
                    limit,
                },
            });
        } catch (error) {
            console.error('Error getting admin activities:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },

    // Lấy toàn bộ audit log admin (không filter theo adminId)
    async getAllAdminActivities(req, res) {
        try {
            const parsedPage = Number.parseInt(req.query.page, 10);
            const parsedLimit = Number.parseInt(req.query.limit, 10);
            const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
            const limit = Number.isInteger(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 30;
            const offset = (page - 1) * limit;
            const { action, startDate, endDate } = req.query;

            const conditions = [`u.role = 'admin'`];
            const params = [];
            let idx = 1;

            if (action) {
                conditions.push(`ua.action = $${idx++}`);
                params.push(action);
            }
            if (startDate) {
                conditions.push(`ua.created_at >= $${idx++}`);
                params.push(startDate);
            }
            if (endDate) {
                conditions.push(`ua.created_at <= $${idx++}`);
                params.push(endDate);
            }
            const adminIdFilter = req.query.adminId ? Number.parseInt(req.query.adminId, 10) : null;
            if (adminIdFilter) {
                conditions.push(`ua.user_id = $${idx++}`);
                params.push(adminIdFilter);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT
                    ua.id,
                    ua.user_id,
                    ua.action,
                    ua.metadata,
                    ua.ip_address,
                    ua.created_at,
                    u.full_name AS user_name,
                    u.email AS user_email,
                    COALESCE(
                        ARRAY_REMOVE(ARRAY_AGG(DISTINCT CASE WHEN r.code = ANY($${idx}::text[]) THEN r.code END), NULL),
                        '{}'::text[]
                    ) AS admin_roles
                FROM user_activities ua
                JOIN users u ON u.id = ua.user_id
                LEFT JOIN user_roles ur ON ur.user_id = u.id
                LEFT JOIN roles r ON r.id = ur.role_id
                ${whereClause}
                GROUP BY ua.id, ua.user_id, ua.action, ua.metadata, ua.ip_address, ua.created_at, u.full_name, u.email
                ORDER BY ua.created_at DESC
                LIMIT $${idx + 1} OFFSET $${idx + 2}
            `;
            params.push(ADMIN_ROLE_CODES, limit, offset);

            const countQuery = `
                SELECT COUNT(DISTINCT ua.id) as count
                FROM user_activities ua
                JOIN users u ON u.id = ua.user_id
                ${whereClause}
            `;
            const countParams = params.slice(0, -3);

            const [rowsResult, countResult] = await Promise.all([
                pool.query(query, params),
                pool.query(countQuery, countParams)
            ]);

            const total = parseInt(countResult.rows[0].count);

            res.json({
                activities: rowsResult.rows.map(row => ({
                    ...row,
                    metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
                    admin_roles: Array.isArray(row.admin_roles) ? row.admin_roles : [],
                })),
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                    totalActivities: total,
                    limit,
                },
            });
        } catch (error) {
            console.error('Error getting all admin activities:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },

    // Lấy log hành vi của một user
    async getUserActivities(req, res) {
        try {
            const { userId } = req.params;
            const parsedPage = Number.parseInt(req.query.page, 10);
            const parsedLimit = Number.parseInt(req.query.limit, 10);
            const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
            const limit = Number.isInteger(parsedLimit)
                ? Math.min(Math.max(parsedLimit, 1), 100)
                : 50;
            const offset = (page - 1) * limit;

            const result = await UserActivity.getAll(limit, offset, { userId: Number(userId) });

            res.json({
                activities: result.activities,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(result.total / limit),
                    totalActivities: result.total,
                    limit,
                },
            });
        } catch (error) {
            console.error('Error getting user activities:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },

    // Get online users count via Socket.io
    async getOnlineUsers(req, res) {
        try {
            const { getIO } = require('../socket/singleton');
            const io = getIO();
            if (!io) {
                return res.json({ online: 0, users: [] });
            }
            const sockets = Array.from(io.sockets.sockets.values());
            const users = sockets
                .filter(s => s.user?.id)
                .map(s => ({ id: s.user.id, email: s.user.email, role: s.user.role }))
                .filter((u, i, arr) => arr.findIndex(x => x.id === u.id) === i);
            res.json({ online: users.length, users });
        } catch (error) {
            console.error('Error getting online users:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
};

module.exports = AdminController;
