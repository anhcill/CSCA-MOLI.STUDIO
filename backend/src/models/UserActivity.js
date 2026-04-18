const db = require("../config/database");

/**
 * UserActivity Model
 * Ghi lại log hành vi của user: đăng nhập, đăng xuất, thi, đổi thông tin...
 */

class UserActivity {
    /**
     * Ghi một log hành vi
     */
    static async log(userId, action, metadata = {}) {
        try {
            await db.query(
                `INSERT INTO user_activities (user_id, action, metadata, ip_address, user_agent)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    userId,
                    action,
                    JSON.stringify(metadata),
                    metadata.ip || null,
                    metadata.userAgent || null,
                ]
            );
        } catch (error) {
            // Log lỗi nhưng không throw — tránh ảnh hưởng flow chính
            console.error(`[UserActivity] Failed to log ${action} for user ${userId}:`, error.message);
        }
    }

    /**
     * Lấy log của một user (phân trang)
     */
    static async getByUserId(userId, limit = 50, offset = 0) {
        const result = await db.query(
            `SELECT id, action, metadata, ip_address, created_at
             FROM user_activities
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );
        return result.rows.map((row) => ({
            ...row,
            metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata,
        }));
    }

    /**
     * Lấy tất cả log (admin, phân trang)
     */
    static async getAll(limit = 50, offset = 0, filters = {}) {
        const conditions = [];
        const params = [];
        let paramIdx = 1;

        if (filters.userId) {
            conditions.push(`ua.user_id = $${paramIdx++}`);
            params.push(filters.userId);
        }
        if (filters.action) {
            conditions.push(`ua.action = $${paramIdx++}`);
            params.push(filters.action);
        }
        if (filters.startDate) {
            conditions.push(`ua.created_at >= $${paramIdx++}`);
            params.push(filters.startDate);
        }
        if (filters.endDate) {
            conditions.push(`ua.created_at <= $${paramIdx++}`);
            params.push(filters.endDate);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        const query = `
            SELECT
                ua.id,
                ua.user_id,
                ua.action,
                ua.metadata,
                ua.ip_address,
                ua.created_at,
                u.full_name AS user_name,
                u.email AS user_email
            FROM user_activities ua
            JOIN users u ON u.id = ua.user_id
            ${whereClause}
            ORDER BY ua.created_at DESC
            LIMIT $${paramIdx++} OFFSET $${paramIdx++}
        `;

        const countQuery = `
            SELECT COUNT(*) as count
            FROM user_activities ua
            ${whereClause}
        `;

        params.push(limit, offset);

        const [rowsResult, countResult] = await Promise.all([
            db.query(query, params),
            db.query(countQuery, params.slice(0, -2)),
        ]);

        return {
            activities: rowsResult.rows.map((row) => ({
                ...row,
                metadata:
                    typeof row.metadata === "string"
                        ? JSON.parse(row.metadata)
                        : row.metadata,
            })),
            total: parseInt(countResult.rows[0].count),
        };
    }

    /**
     * Đếm số lần thực hiện action của user
     */
    static async countByAction(userId, action, since) {
        const result = await db.query(
            `SELECT COUNT(*) as count
             FROM user_activities
             WHERE user_id = $1 AND action = $2 AND created_at >= $3`,
            [userId, action, since]
        );
        return parseInt(result.rows[0].count);
    }

    /**
     * Xóa log cũ (giữ lại N ngày gần nhất)
     */
    static async cleanup(daysToKeep = 90) {
        await db.query(
            `DELETE FROM user_activities WHERE created_at < NOW() - INTERVAL '1 day' * $1`,
            [daysToKeep]
        );
    }
}

module.exports = UserActivity;
