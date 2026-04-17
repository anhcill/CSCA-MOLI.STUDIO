const db = require("./src/config/database");
const { authorizePermission } = require("./src/middleware/authMiddleware");
const { invalidateAuthorizationCache } = require("./src/services/rbacService");
const adminExamController = require("./src/controllers/adminExamController");

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

async function getOrCreateExam() {
  const existing = await db.query(
    "SELECT id, start_time, end_time, max_participants FROM exams ORDER BY id ASC LIMIT 1",
  );

  if (existing.rowCount > 0) {
    return { exam: existing.rows[0], created: false };
  }

  const subject = await db.query("SELECT id FROM subjects ORDER BY id ASC LIMIT 1");
  if (subject.rowCount === 0) {
    throw new Error("Khong tim thay subject de tao exam test");
  }

  const created = await db.query(
    `INSERT INTO exams (
      subject_id, code, title, duration, total_questions, total_points, status, publish_date
     ) VALUES ($1, $2, $3, $4, 0, 100, 'draft', NOW())
     RETURNING id, start_time, end_time, max_participants`,
    [
      subject.rows[0].id,
      `SCHEDULE-TEST-${Date.now()}`,
      "Exam schedule test",
      90,
    ],
  );

  return { exam: created.rows[0], created: true };
}

async function main() {
  let targetUser = null;
  let originalAssignments = [];
  let examInfo = null;
  const testTag = `schedule-test-${Date.now()}`;
  const setReason = `${testTag}-set`;
  const clearReason = `${testTag}-clear`;

  try {
    const usersResult = await db.query(
      "SELECT id, email, full_name FROM users ORDER BY id ASC LIMIT 1",
    );

    if (usersResult.rowCount === 0) {
      throw new Error("Khong tim thay user de test exam schedule logs");
    }

    targetUser = usersResult.rows[0];

    const originalResult = await db.query(
      `SELECT ur.user_id, ur.role_id
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1
         AND r.code = ANY($2::text[])`,
      [targetUser.id, ADMIN_ROLE_CODES],
    );
    originalAssignments = originalResult.rows;

    await db.query(
      `DELETE FROM user_roles
       WHERE user_id = $1
         AND role_id IN (SELECT id FROM roles WHERE code = ANY($2::text[]))`,
      [targetUser.id, ADMIN_ROLE_CODES],
    );

    await db.query(
      `INSERT INTO user_roles (user_id, role_id, assigned_by)
       SELECT $1, id, NULL FROM roles WHERE code = 'exam_admin'
       ON CONFLICT (user_id, role_id) DO NOTHING`,
      [targetUser.id],
    );

    invalidateAuthorizationCache(targetUser.id);

    const permissionResult = await runPermissionCheck(targetUser.id, "exams.manage");
    if (!permissionResult.allowed) {
      throw new Error("exam_admin khong co quyen exams.manage");
    }

    const { exam, created } = await getOrCreateExam();
    examInfo = { ...exam, created };

    const startAt = new Date(Date.now() + 60 * 60 * 1000);
    const endAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

    const setResult = await runController(adminExamController.setSchedule, {
      params: { examId: String(exam.id) },
      body: {
        startTime: startAt.toISOString(),
        endTime: endAt.toISOString(),
        maxParticipants: 123,
        reason: setReason,
      },
      user: {
        id: targetUser.id,
        full_name: targetUser.full_name,
        role: "admin",
      },
      ip: "127.0.0.1",
      headers: { "user-agent": "test-exam-schedule" },
    });

    if (setResult.statusCode !== 200) {
      throw new Error(`setSchedule failed: ${JSON.stringify(setResult.payload)}`);
    }

    const scheduleLogSet = await db.query(
      `SELECT exam_id, changed_by, reason, new_start_time, new_end_time
       FROM exam_schedule_logs
       WHERE exam_id = $1 AND reason = $2
       ORDER BY changed_at DESC LIMIT 1`,
      [exam.id, setReason],
    );

    if (scheduleLogSet.rowCount === 0) {
      throw new Error("Khong ghi exam_schedule_logs khi set schedule");
    }

    const auditSet = await db.query(
      `SELECT action, actor_id, target_type, target_id, metadata
       FROM audit_logs
       WHERE action = 'exam_schedule_set'
         AND actor_id = $1
         AND target_id = $2
         AND metadata->>'reason' = $3
       ORDER BY created_at DESC LIMIT 1`,
      [targetUser.id, exam.id, setReason],
    );

    if (auditSet.rowCount === 0) {
      throw new Error("Khong ghi audit_logs khi set schedule");
    }

    const clearResult = await runController(adminExamController.clearSchedule, {
      params: { examId: String(exam.id) },
      body: { reason: clearReason },
      user: {
        id: targetUser.id,
        full_name: targetUser.full_name,
        role: "admin",
      },
      ip: "127.0.0.1",
      headers: { "user-agent": "test-exam-schedule" },
    });

    if (clearResult.statusCode !== 200) {
      throw new Error(`clearSchedule failed: ${JSON.stringify(clearResult.payload)}`);
    }

    const scheduleLogClear = await db.query(
      `SELECT exam_id, changed_by, reason, new_start_time, new_end_time
       FROM exam_schedule_logs
       WHERE exam_id = $1 AND reason = $2
       ORDER BY changed_at DESC LIMIT 1`,
      [exam.id, clearReason],
    );

    if (scheduleLogClear.rowCount === 0) {
      throw new Error("Khong ghi exam_schedule_logs khi clear schedule");
    }

    const auditClear = await db.query(
      `SELECT action, actor_id, target_type, target_id, metadata
       FROM audit_logs
       WHERE action = 'exam_schedule_clear'
         AND actor_id = $1
         AND target_id = $2
         AND metadata->>'reason' = $3
       ORDER BY created_at DESC LIMIT 1`,
      [targetUser.id, exam.id, clearReason],
    );

    if (auditClear.rowCount === 0) {
      throw new Error("Khong ghi audit_logs khi clear schedule");
    }

    console.log("PASS: exam_admin thay doi lich -> logs ghi dung");
  } catch (error) {
    console.error("FAIL:", error.message);
    process.exitCode = 1;
  } finally {
    if (examInfo) {
      await db.query(
        "UPDATE exams SET start_time = $1, end_time = $2, max_participants = $3, updated_at = NOW() WHERE id = $4",
        [examInfo.start_time || null, examInfo.end_time || null, examInfo.max_participants || 0, examInfo.id],
      );

      await db.query(
        `DELETE FROM exam_schedule_logs WHERE exam_id = $1 AND reason IN ($2, $3)`,
        [examInfo.id, setReason, clearReason],
      );

      await db.query(
        `DELETE FROM audit_logs
         WHERE actor_id = $1
           AND target_id = $2
           AND action IN ('exam_schedule_set', 'exam_schedule_clear')
           AND metadata->>'reason' IN ($3, $4)`,
        [targetUser ? targetUser.id : null, examInfo.id, setReason, clearReason],
      );

      if (examInfo.created) {
        await db.query("DELETE FROM exams WHERE id = $1", [examInfo.id]);
      }
    }

    if (targetUser) {
      await db.query(
        `DELETE FROM user_roles
         WHERE user_id = $1
           AND role_id IN (SELECT id FROM roles WHERE code = ANY($2::text[]))`,
        [targetUser.id, ADMIN_ROLE_CODES],
      );

      for (const assignment of originalAssignments) {
        await db.query(
          `INSERT INTO user_roles (user_id, role_id, assigned_by)
           VALUES ($1, $2, NULL)
           ON CONFLICT (user_id, role_id) DO NOTHING`,
          [assignment.user_id, assignment.role_id],
        );
      }

      invalidateAuthorizationCache(targetUser.id);
    }

    await db.pool.end();
  }
}

main();
