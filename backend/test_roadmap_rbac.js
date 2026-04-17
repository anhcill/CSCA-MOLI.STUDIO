const db = require("./src/config/database");
const { authorizePermission } = require("./src/middleware/authMiddleware");
const { invalidateAuthorizationCache } = require("./src/services/rbacService");
const roadmapAdminController = require("./src/controllers/roadmapAdminController");

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
    const req = { user: { id: userId, role: "admin" } };
    const result = { allowed: false, statusCode: 200, payload: null, error: null };

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

function runController(handler, req) {
  return new Promise((resolve) => {
    const result = { statusCode: 200, payload: null, error: null };

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

    Promise.resolve(handler(req, res)).catch((error) => {
      result.error = error.message;
      resolve(result);
    });
  });
}

async function main() {
  let targetUsers = [];
  let originalAssignments = [];
  let createdMilestoneId = null;

  try {
    const usersResult = await db.query(
      "SELECT id, email FROM users ORDER BY id ASC LIMIT 2",
    );

    if (usersResult.rowCount < 2) {
      throw new Error("Can it nhat 2 users de test roadmap RBAC");
    }

    const roadmapAdminUser = usersResult.rows[0];
    const userAdminUser = usersResult.rows[1];
    targetUsers = [roadmapAdminUser, userAdminUser];

    console.log("Testing users:", {
      roadmapAdminUser: roadmapAdminUser.email,
      userAdminUser: userAdminUser.email,
    });

    const originalResult = await db.query(
      `SELECT ur.user_id, ur.role_id
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = ANY($1::int[])
         AND r.code = ANY($2::text[])`,
      [[roadmapAdminUser.id, userAdminUser.id], ADMIN_ROLE_CODES],
    );
    originalAssignments = originalResult.rows;

    await db.query(
      `DELETE FROM user_roles
       WHERE user_id = ANY($1::int[])
         AND role_id IN (
           SELECT id FROM roles WHERE code = ANY($2::text[])
         )`,
      [[roadmapAdminUser.id, userAdminUser.id], ADMIN_ROLE_CODES],
    );

    await db.query(
      `INSERT INTO user_roles (user_id, role_id, assigned_by)
       SELECT $1, id, NULL FROM roles WHERE code = 'roadmap_admin'
       ON CONFLICT (user_id, role_id) DO NOTHING`,
      [roadmapAdminUser.id],
    );

    await db.query(
      `INSERT INTO user_roles (user_id, role_id, assigned_by)
       SELECT $1, id, NULL FROM roles WHERE code = 'user_admin'
       ON CONFLICT (user_id, role_id) DO NOTHING`,
      [userAdminUser.id],
    );

    invalidateAuthorizationCache(roadmapAdminUser.id);
    invalidateAuthorizationCache(userAdminUser.id);

    const roadmapAllow = await runPermissionCheck(
      roadmapAdminUser.id,
      "roadmap.manage",
    );
    const userAdminDeny = await runPermissionCheck(
      userAdminUser.id,
      "roadmap.manage",
    );

    console.log("roadmap_admin permission:", roadmapAllow);
    console.log("user_admin permission:", userAdminDeny);

    if (!(roadmapAllow.allowed && !userAdminDeny.allowed && userAdminDeny.statusCode === 403)) {
      throw new Error("Permission test failed for roadmap.manage");
    }

    const maxSortResult = await db.query(
      "SELECT COALESCE(MAX(sort_order), 0)::int AS max_order FROM roadmap_milestones",
    );
    const nextSortOrder = maxSortResult.rows[0].max_order + 1;

    const createResult = await runController(roadmapAdminController.createMilestone, {
      user: { id: roadmapAdminUser.id, role: "admin" },
      body: {
        title: "Milestone test roadmap_admin",
        description: "Created by automated roadmap RBAC test",
        min_attempts: 1,
        min_avg_score: 5,
        icon: "FiTarget",
        color: "bg-green-500",
        sort_order: nextSortOrder,
        is_active: true,
      },
    });

    if (createResult.statusCode !== 201 || !createResult.payload?.data?.id) {
      throw new Error("Create milestone failed in roadmap admin test");
    }

    createdMilestoneId = createResult.payload.data.id;

    const listResult = await runController(roadmapAdminController.getMilestones, {
      user: { id: roadmapAdminUser.id, role: "admin" },
      query: { includeInactive: "true" },
    });

    if (listResult.statusCode !== 200 || !Array.isArray(listResult.payload?.data)) {
      throw new Error("List milestones failed in roadmap admin test");
    }

    const found = listResult.payload.data.some((m) => m.id === createdMilestoneId);
    if (!found) {
      throw new Error("Created milestone not found in list");
    }

    const updateResult = await runController(roadmapAdminController.updateMilestone, {
      user: { id: roadmapAdminUser.id, role: "admin" },
      params: { id: String(createdMilestoneId) },
      body: {
        title: "Milestone test roadmap_admin updated",
        min_avg_score: 7,
      },
    });

    if (updateResult.statusCode !== 200) {
      throw new Error("Update milestone failed in roadmap admin test");
    }

    const deleteResult = await runController(roadmapAdminController.deleteMilestone, {
      user: { id: roadmapAdminUser.id, role: "admin" },
      params: { id: String(createdMilestoneId) },
    });

    if (deleteResult.statusCode !== 200) {
      throw new Error("Delete milestone failed in roadmap admin test");
    }

    const verifyDeleted = await db.query(
      "SELECT is_active FROM roadmap_milestones WHERE id = $1",
      [createdMilestoneId],
    );

    if (!verifyDeleted.rows[0] || verifyDeleted.rows[0].is_active !== false) {
      throw new Error("Milestone was not soft-deleted as expected");
    }

    console.log("PASS: roadmap_admin CRUD milestones thanh cong");
  } catch (error) {
    console.error("FAIL:", error.message);
    process.exitCode = 1;
  } finally {
    if (createdMilestoneId) {
      await db.query("DELETE FROM roadmap_milestones WHERE id = $1", [createdMilestoneId]);
    }

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
