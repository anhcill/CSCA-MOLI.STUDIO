const db = require("./src/config/database");
const { authorizePermission } = require("./src/middleware/authMiddleware");
const { invalidateAuthorizationCache } = require("./src/services/rbacService");

const ADMIN_ROLE_CODES = [
  "super_admin",
  "user_admin",
  "forum_admin",
  "roadmap_admin",
  "exam_admin",
  "content_admin",
];

function runPermissionCheck(userId, permissionCode) {
  return new Promise((resolve) => {
    const req = {
      user: {
        id: userId,
        role: "admin",
      },
    };

    const result = {
      allowed: false,
      statusCode: 200,
      payload: null,
      error: null,
    };

    const res = {
      status(code) {
        result.statusCode = code;
        return this;
      },
      json(payload) {
        result.payload = payload;
        resolve(result);
        return this;
      },
    };

    const next = () => {
      result.allowed = true;
      resolve(result);
    };

    authorizePermission(permissionCode)(req, res, next).catch((error) => {
      result.error = error.message;
      resolve(result);
    });
  });
}

async function main() {
  let targetUsers = [];
  let originalAssignments = [];

  try {
    const usersResult = await db.query(
      "SELECT id, email FROM users ORDER BY id ASC LIMIT 2",
    );

    if (usersResult.rowCount < 2) {
      throw new Error("Can it nhat 2 users de chay test forum RBAC");
    }

    targetUsers = usersResult.rows;

    const forumAdminUser = targetUsers[0];
    const userAdminUser = targetUsers[1];

    console.log("Testing users:", {
      forumAdminUser: forumAdminUser.email,
      userAdminUser: userAdminUser.email,
    });

    const originalResult = await db.query(
      `SELECT ur.user_id, ur.role_id
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = ANY($1::int[])
         AND r.code = ANY($2::text[])`,
      [
        [forumAdminUser.id, userAdminUser.id],
        ADMIN_ROLE_CODES,
      ],
    );

    originalAssignments = originalResult.rows;

    await db.query(
      `DELETE FROM user_roles
       WHERE user_id = ANY($1::int[])
         AND role_id IN (
           SELECT id FROM roles WHERE code = ANY($2::text[])
         )`,
      [
        [forumAdminUser.id, userAdminUser.id],
        ADMIN_ROLE_CODES,
      ],
    );

    await db.query(
      `INSERT INTO user_roles (user_id, role_id, assigned_by)
       SELECT $1, id, NULL FROM roles WHERE code = 'forum_admin'
       ON CONFLICT (user_id, role_id) DO NOTHING`,
      [forumAdminUser.id],
    );

    await db.query(
      `INSERT INTO user_roles (user_id, role_id, assigned_by)
       SELECT $1, id, NULL FROM roles WHERE code = 'user_admin'
       ON CONFLICT (user_id, role_id) DO NOTHING`,
      [userAdminUser.id],
    );

    invalidateAuthorizationCache(forumAdminUser.id);
    invalidateAuthorizationCache(userAdminUser.id);

    const forumAdminResult = await runPermissionCheck(
      forumAdminUser.id,
      "forum.manage",
    );
    const userAdminResult = await runPermissionCheck(
      userAdminUser.id,
      "forum.manage",
    );

    console.log("forum_admin check:", forumAdminResult);
    console.log("user_admin check:", userAdminResult);

    const passed =
      forumAdminResult.allowed === true &&
      userAdminResult.allowed === false &&
      userAdminResult.statusCode === 403;

    if (!passed) {
      throw new Error(
        "Forum RBAC test failed: expected forum_admin allow, user_admin deny",
      );
    }

    console.log("PASS: forum_admin duoc moderation, user_admin bi chan");
  } catch (error) {
    console.error("FAIL:", error.message);
    process.exitCode = 1;
  } finally {
    if (targetUsers.length > 0) {
      const ids = targetUsers.map((u) => u.id);

      await db.query(
        `DELETE FROM user_roles
         WHERE user_id = ANY($1::int[])
           AND role_id IN (
             SELECT id FROM roles WHERE code = ANY($2::text[])
           )`,
        [ids, ADMIN_ROLE_CODES],
      );

      for (const assignment of originalAssignments) {
        await db.query(
          `INSERT INTO user_roles (user_id, role_id, assigned_by)
           VALUES ($1, $2, NULL)
           ON CONFLICT (user_id, role_id) DO NOTHING`,
          [assignment.user_id, assignment.role_id],
        );
      }

      for (const id of ids) {
        invalidateAuthorizationCache(id);
      }
    }

    await db.pool.end();
  }
}

main();
