const crypto = require("crypto");
const { pool } = require("../config/database");
const { cache } = require("../config/cache");
const UserActivity = require("../models/UserActivity");
const ExamAttempt = require("../models/ExamAttempt");
const AuditLog = require("../utils/auditLog");

const ADMIN_VIOLATION_LABELS = {
  tab_switch: "Chuyển tab / rời trang thi",
  window_blur: "Mất focus cửa sổ thi",
  right_click: "Click chuột phải",
  copy: "Copy nội dung",
  copy_attempt: "Cố gắng copy nội dung",
  print: "In đề thi",
  print_attempt: "Cố gắng in đề thi",
  print_shortcut: "Dùng phím tắt in / lưu",
  screenshot_suspected: "Nghi vấn chụp màn hình",
  screenshot_key: "Bấm phím chụp màn hình",
  fullscreen_exit: "Thoát toàn màn hình",
  multi_tab_conflict: "Mở lượt thi ở tab khác",
  devtools: "Mở công cụ lập trình",
  resize_suspicious: "Thay đổi kích thước cửa sổ bất thường",
  multi_touch: "Cử chỉ nhiều ngón bất thường",
};

function parsePositiveInt(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function sanitizeText(value, maxLength = 1000) {
  if (typeof value !== "string") return null;
  return value.replace(/<[^>]*>/g, "").trim().slice(0, maxLength);
}

function emitExamMonitor(req, examId, event, payload) {
  try {
    req.app.locals.io?.to(`exam-monitor:${examId}`).emit(event, payload);
  } catch (_) {
    // Socket notifications are best-effort only.
  }
}

function certificateCode() {
  return `CSCA-${new Date().getFullYear()}-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
}

function clearLobbyCache() {
  cache.del("exams:lobby");
}

async function findFirstAvailableSeat(client, roomId, capacity, registrationId = null) {
  const result = await client.query(
    `SELECT seats.seat_number
     FROM generate_series(1, $2::int) AS seats(seat_number)
     WHERE NOT EXISTS (
       SELECT 1
       FROM exam_room_students ers
       WHERE ers.room_id = $1
         AND ers.seat_number = seats.seat_number
         AND ers.registration_id <> COALESCE($3::bigint, -1)
     )
     ORDER BY seat_number
     LIMIT 1`,
    [roomId, capacity, registrationId],
  );

  return result.rows[0]?.seat_number || null;
}

async function getRegistrationForUser(client, examId, userId) {
  const result = await client.query(
    `SELECT er.*, e.title AS exam_title, e.start_time, e.end_time,
            room.id AS room_id, room.room_name, room.location, ers.seat_number
     FROM exam_registrations er
     JOIN exams e ON e.id = er.exam_id
     LEFT JOIN exam_room_students ers ON ers.registration_id = er.id
     LEFT JOIN exam_rooms room ON room.id = ers.room_id
     WHERE er.exam_id = $1 AND er.user_id = $2
     LIMIT 1`,
    [examId, userId],
  );
  return result.rows[0] || null;
}

const officialExamController = {
  async register(req, res) {
    const client = await pool.connect();
    try {
      const examId = parsePositiveInt(req.params.examId);
      if (!examId) {
        return res.status(400).json({ success: false, message: "ID ky thi khong hop le" });
      }

      await client.query("BEGIN");

      const examResult = await client.query(
        `SELECT id, title, status, start_time, end_time, max_participants
         FROM exams
         WHERE id = $1
         FOR UPDATE`,
        [examId],
      );
      const exam = examResult.rows[0];
      if (!exam) {
        await client.query("ROLLBACK");
        return res.status(404).json({ success: false, message: "Khong tim thay ky thi" });
      }
      if (exam.status !== "published" || !exam.start_time) {
        await client.query("ROLLBACK");
        return res.status(400).json({ success: false, message: "Ky thi chua mo dang ky" });
      }
      if (exam.start_time && new Date(exam.start_time) <= new Date()) {
        await client.query("ROLLBACK");
        return res.status(400).json({ success: false, message: "Ky thi da bat dau, khong the dang ky" });
      }

      const readinessResult = await client.query(
        `SELECT EXISTS (
                  SELECT 1 FROM admin_exam_source_files sf
                  WHERE sf.exam_id = $1 AND sf.is_exam_paper = TRUE
                    AND sf.file_type = 'pdf' AND sf.file_data IS NOT NULL
                ) AS has_paper,
                COUNT(q.id)::int AS question_count,
                COUNT(q.id) FILTER (
                  WHERE EXISTS (
                    SELECT 1 FROM answers a
                    WHERE a.question_id = q.id AND a.is_correct = TRUE
                  )
                )::int AS answered_count
         FROM questions q
         WHERE q.exam_id = $1
           AND q.question_number > 0
           AND q.deleted_at IS NULL
           AND q.question_type <> ALL($2::varchar[])`,
        [examId, ['reading_passage', 'fill_blank_pool']],
      );
      const readiness = readinessResult.rows[0] || {};
      if (!exam.end_time
        || !readiness.has_paper
        || Number(readiness.question_count) < 1
        || Number(readiness.answered_count) !== Number(readiness.question_count)) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message: 'Kỳ thi chưa hoàn tất PDF, đáp án hoặc lịch thi.',
          code: 'ROOM_EXAM_NOT_READY',
        });
      }

      const existing = await getRegistrationForUser(client, examId, req.user.id);
      if (existing && existing.status !== "cancelled") {
        await client.query("COMMIT");
        return res.json({ success: true, data: existing, message: "Ban da dang ky ky thi nay" });
      }

      if (Number(exam.max_participants) > 0) {
        const countResult = await client.query(
          `SELECT COUNT(*)::int AS count
           FROM exam_registrations
           WHERE exam_id = $1 AND status IN ('registered', 'approved', 'checked_in')`,
          [examId],
        );
        if (countResult.rows[0].count >= Number(exam.max_participants)) {
          await client.query("ROLLBACK");
          return res.status(400).json({ success: false, message: "Ky thi da du so luong thi sinh" });
        }
      }

      let registration;
      if (existing) {
        const updated = await client.query(
          `UPDATE exam_registrations
           SET status = 'approved',
               approved_by = NULL,
               approved_at = NOW(),
               cancelled_at = NULL,
               registered_at = NOW(),
               updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [existing.id],
        );
        registration = updated.rows[0];
      } else {
        const created = await client.query(
          `INSERT INTO exam_registrations (exam_id, user_id, status, approved_at)
           VALUES ($1, $2, 'approved', NOW())
           RETURNING *`,
          [examId, req.user.id],
        );
        registration = created.rows[0];
      }

      await client.query("COMMIT");
      clearLobbyCache();

      UserActivity.log(req.user.id, "exam_register", {
        examId,
        registrationId: registration.id,
        autoApproved: true,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      emitExamMonitor(req, examId, "exam_registration_changed", { examId, registration });

      return res.status(201).json({
        success: true,
        data: registration,
        message: "Dang ky thanh cong va da duoc tu dong duyet",
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("Register official exam error:", error);
      return res.status(500).json({ success: false, message: "Loi dang ky ky thi" });
    } finally {
      client.release();
    }
  },

  async cancelRegistration(req, res) {
    const client = await pool.connect();
    try {
      const examId = parsePositiveInt(req.params.examId);
      if (!examId) return res.status(400).json({ success: false, message: "ID ky thi khong hop le" });

      await client.query("BEGIN");

      const existing = await client.query(
        `SELECT er.*, e.start_time
         FROM exam_registrations er
         JOIN exams e ON e.id = er.exam_id
         WHERE er.exam_id = $1
           AND er.user_id = $2
           AND er.status IN ('registered', 'approved')
         FOR UPDATE OF er`,
        [examId, req.user.id],
      );

      if (!existing.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(404).json({ success: false, message: "Khong tim thay dang ky co the huy" });
      }

      if (existing.rows[0].start_time && new Date(existing.rows[0].start_time) <= new Date()) {
        await client.query("ROLLBACK");
        return res.status(400).json({ success: false, message: "Ky thi da bat dau, khong the huy dang ky" });
      }

      const result = await client.query(
        `UPDATE exam_registrations
         SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [existing.rows[0].id],
      );

      await client.query("DELETE FROM exam_room_students WHERE registration_id = $1", [existing.rows[0].id]);
      await client.query("COMMIT");
      clearLobbyCache();

      UserActivity.log(req.user.id, "exam_cancel_registration", {
        examId,
        registrationId: result.rows[0].id,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      emitExamMonitor(req, examId, "exam_registration_changed", { examId, registration: result.rows[0] });

      return res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("Cancel registration error:", error);
      return res.status(500).json({ success: false, message: "Loi huy dang ky" });
    } finally {
      client.release();
    }
  },

  async getMyRegistration(req, res) {
    const client = await pool.connect();
    try {
      const examId = parsePositiveInt(req.params.examId);
      if (!examId) return res.status(400).json({ success: false, message: "ID ky thi khong hop le" });

      const registration = await getRegistrationForUser(client, examId, req.user.id);
      return res.json({ success: true, data: registration });
    } catch (error) {
      console.error("Get my registration error:", error);
      return res.status(500).json({ success: false, message: "Loi lay dang ky" });
    } finally {
      client.release();
    }
  },

  async getMyAdmissionTicket(req, res) {
    const client = await pool.connect();
    try {
      const examId = parsePositiveInt(req.params.examId);
      if (!examId) return res.status(400).json({ success: false, message: "ID ky thi khong hop le" });

      const result = await client.query(
        `SELECT er.id AS registration_id, er.status, er.registered_at, er.approved_at,
                e.id AS exam_id, e.code AS exam_code, e.title AS exam_title,
                e.title_cn AS exam_title_cn, e.start_time, e.end_time, e.duration,
                s.name AS subject_name, s.code AS subject_code,
                room.id AS room_id, room.room_name, room.location, ers.seat_number,
                u.id AS user_id, u.full_name, u.email, u.username, u.avatar_url, u.avatar
         FROM exam_registrations er
         JOIN exams e ON e.id = er.exam_id
         JOIN subjects s ON s.id = e.subject_id
         JOIN users u ON u.id = er.user_id
         LEFT JOIN exam_room_students ers ON ers.registration_id = er.id
         LEFT JOIN exam_rooms room ON room.id = ers.room_id
         WHERE er.exam_id = $1 AND er.user_id = $2
         LIMIT 1`,
        [examId, req.user.id],
      );

      const ticket = result.rows[0];
      if (!ticket) {
        return res.status(404).json({ success: false, message: "Ban chua dang ky ky thi nay" });
      }

      if (!["approved", "checked_in", "completed"].includes(ticket.status)) {
        return res.status(403).json({
          success: false,
          message: "Dang ky chua duoc duyet nen chua co ve du thi",
          code: "REGISTRATION_NOT_APPROVED",
        });
      }
      const checkInCode = `CSCA-CHECKIN:${ticket.exam_id}:${ticket.registration_id}:${ticket.user_id}`;
      return res.json({
        success: true,
        data: {
          ...ticket,
          check_in_code: checkInCode,
        },
      });
    } catch (error) {
      console.error("Get admission ticket error:", error);
      return res.status(500).json({ success: false, message: "Loi lay ve du thi" });
    } finally {
      client.release();
    }
  },

  async listRegistrations(req, res) {
    try {
      const examId = parsePositiveInt(req.params.examId);
      if (!examId) return res.status(400).json({ success: false, message: "ID ky thi khong hop le" });

      const status = sanitizeText(req.query.status || "", 30);
      const params = [examId];
      let whereStatus = "";
      if (status) {
        params.push(status);
        whereStatus = `AND er.status = $${params.length}`;
      }

      const result = await pool.query(
        `SELECT er.*, u.email, u.username, u.full_name, u.avatar, u.avatar_url,
                room.id AS room_id, room.room_name, room.location, ers.seat_number
         FROM exam_registrations er
         JOIN users u ON u.id = er.user_id
         LEFT JOIN exam_room_students ers ON ers.registration_id = er.id
         LEFT JOIN exam_rooms room ON room.id = ers.room_id
         WHERE er.exam_id = $1 ${whereStatus}
         ORDER BY er.registered_at DESC`,
        params,
      );

      return res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error("List registrations error:", error);
      return res.status(500).json({ success: false, message: "Loi lay danh sach dang ky" });
    }
  },

  async updateRegistrationStatus(req, res) {
    const client = await pool.connect();
    try {
      const examId = parsePositiveInt(req.params.examId);
      const registrationId = parsePositiveInt(req.params.registrationId);
      const status = sanitizeText(req.body.status, 30);
      const note = sanitizeText(req.body.note, 1000);
      const allowed = new Set(["registered", "approved", "checked_in", "completed", "no_show", "cancelled"]);

      if (!examId || !registrationId || !allowed.has(status)) {
        return res.status(400).json({ success: false, message: "Du lieu trang thai khong hop le" });
      }

      await client.query("BEGIN");

      const registrationCheck = await client.query(
        `SELECT er.id
         FROM exam_registrations er
         WHERE er.id = $1 AND er.exam_id = $2
         FOR UPDATE OF er`,
        [registrationId, examId],
      );

      if (!registrationCheck.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(404).json({ success: false, message: "Khong tim thay dang ky" });
      }

      const result = await client.query(
        `UPDATE exam_registrations
         SET status = $1::varchar,
             note = COALESCE($2, note),
             approved_by = CASE WHEN $1::varchar IN ('approved', 'checked_in') THEN COALESCE(approved_by, $3) ELSE approved_by END,
             approved_at = CASE WHEN $1::varchar IN ('approved', 'checked_in') THEN COALESCE(approved_at, NOW()) ELSE approved_at END,
             cancelled_at = CASE WHEN $1::varchar = 'cancelled' THEN NOW() ELSE cancelled_at END,
             updated_at = NOW()
         WHERE id = $4 AND exam_id = $5
         RETURNING *`,
        [status, note, req.user.id, registrationId, examId],
      );

      if (status === "cancelled") {
        await client.query("DELETE FROM exam_room_students WHERE registration_id = $1", [registrationId]);
      }

      await client.query("COMMIT");
      clearLobbyCache();

      UserActivity.log(req.user.id, "admin.update_exam_registration", {
        examId,
        registrationId,
        status,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      emitExamMonitor(req, examId, "exam_registration_changed", { examId, registration: result.rows[0] });

      return res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("Update registration status error:", error);
      return res.status(500).json({ success: false, message: "Loi cap nhat dang ky" });
    } finally {
      client.release();
    }
  },

  async listRooms(req, res) {
    try {
      const examId = parsePositiveInt(req.params.examId);
      if (!examId) return res.status(400).json({ success: false, message: "ID ky thi khong hop le" });

      const rooms = await pool.query(
        `SELECT room.*,
                COUNT(DISTINCT ers.id)::int AS assigned_count,
                COALESCE(
                  json_agg(DISTINCT jsonb_build_object(
                    'id', epa.id,
                    'proctor_id', epa.proctor_id,
                    'role', epa.role,
                    'full_name', u.full_name,
                    'email', u.email
                  )) FILTER (WHERE epa.id IS NOT NULL),
                  '[]'
                ) AS proctors
         FROM exam_rooms room
         LEFT JOIN exam_room_students ers ON ers.room_id = room.id
         LEFT JOIN exam_proctor_assignments epa ON epa.room_id = room.id
         LEFT JOIN users u ON u.id = epa.proctor_id
         WHERE room.exam_id = $1
         GROUP BY room.id
         ORDER BY room.room_name ASC`,
        [examId],
      );

      return res.json({ success: true, data: rooms.rows });
    } catch (error) {
      console.error("List rooms error:", error);
      return res.status(500).json({ success: false, message: "Loi lay phong thi" });
    }
  },

  async createRoom(req, res) {
    try {
      const examId = parsePositiveInt(req.params.examId);
      const roomName = sanitizeText(req.body.room_name || req.body.roomName, 120);
      const location = sanitizeText(req.body.location, 255);
      const capacity = parsePositiveInt(req.body.capacity) || 30;

      if (!examId || !roomName) {
        return res.status(400).json({ success: false, message: "Thieu ten phong thi" });
      }

      const result = await pool.query(
        `INSERT INTO exam_rooms (exam_id, room_name, location, capacity, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [examId, roomName, location, capacity, req.user.id],
      );

      UserActivity.log(req.user.id, "admin.create_exam_room", {
        examId,
        roomId: result.rows[0].id,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      emitExamMonitor(req, examId, "exam_room_changed", { examId, room: result.rows[0] });

      return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({ success: false, message: "Ten phong da ton tai trong ky thi" });
      }
      console.error("Create room error:", error);
      return res.status(500).json({ success: false, message: "Loi tao phong thi" });
    }
  },

  async updateRoom(req, res) {
    try {
      const examId = parsePositiveInt(req.params.examId);
      const roomId = parsePositiveInt(req.params.roomId);
      const roomName = sanitizeText(req.body.room_name || req.body.roomName, 120);
      const location = sanitizeText(req.body.location, 255);
      const capacity = parsePositiveInt(req.body.capacity);
      const status = sanitizeText(req.body.status, 30);

      if (!examId || !roomId) {
        return res.status(400).json({ success: false, message: "Du lieu phong khong hop le" });
      }

      const result = await pool.query(
        `UPDATE exam_rooms
         SET room_name = COALESCE($1, room_name),
             location = COALESCE($2, location),
             capacity = COALESCE($3, capacity),
             status = COALESCE($4, status),
             updated_at = NOW()
         WHERE id = $5 AND exam_id = $6
         RETURNING *`,
        [roomName, location, capacity, status, roomId, examId],
      );

      if (!result.rows[0]) {
        return res.status(404).json({ success: false, message: "Khong tim thay phong thi" });
      }

      emitExamMonitor(req, examId, "exam_room_changed", { examId, room: result.rows[0] });
      return res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error("Update room error:", error);
      return res.status(500).json({ success: false, message: "Loi cap nhat phong thi" });
    }
  },

  async deleteRoom(req, res) {
    try {
      const examId = parsePositiveInt(req.params.examId);
      const roomId = parsePositiveInt(req.params.roomId);
      if (!examId || !roomId) return res.status(400).json({ success: false, message: "Du lieu phong khong hop le" });

      const result = await pool.query(
        `DELETE FROM exam_rooms WHERE id = $1 AND exam_id = $2 RETURNING id`,
        [roomId, examId],
      );
      if (!result.rows[0]) return res.status(404).json({ success: false, message: "Khong tim thay phong thi" });

      emitExamMonitor(req, examId, "exam_room_changed", { examId, deletedRoomId: roomId });
      return res.json({ success: true });
    } catch (error) {
      console.error("Delete room error:", error);
      return res.status(500).json({ success: false, message: "Loi xoa phong thi" });
    }
  },

  async assignStudentToRoom(req, res) {
    const client = await pool.connect();
    try {
      const examId = parsePositiveInt(req.params.examId);
      const roomId = parsePositiveInt(req.params.roomId);
      const registrationId = parsePositiveInt(req.body.registration_id || req.body.registrationId);
      const requestedSeat = parsePositiveInt(req.body.seat_number || req.body.seatNumber);
      if (!examId || !roomId || !registrationId) {
        return res.status(400).json({ success: false, message: "Du lieu phan phong khong hop le" });
      }

      await client.query("BEGIN");
      const roomResult = await client.query(
        `SELECT id, capacity FROM exam_rooms WHERE id = $1 AND exam_id = $2 FOR UPDATE`,
        [roomId, examId],
      );
      const room = roomResult.rows[0];
      if (!room) {
        await client.query("ROLLBACK");
        return res.status(404).json({ success: false, message: "Khong tim thay phong thi" });
      }

      const regResult = await client.query(
        `SELECT id FROM exam_registrations
         WHERE id = $1 AND exam_id = $2 AND status IN ('registered', 'approved', 'checked_in')`,
        [registrationId, examId],
      );
      if (!regResult.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(404).json({ success: false, message: "Dang ky khong hop le" });
      }

      const existingAssignment = await client.query(
        `SELECT room_id, seat_number
         FROM exam_room_students
         WHERE registration_id = $1
         FOR UPDATE`,
        [registrationId],
      );
      const currentAssignment = existingAssignment.rows[0] || null;

      const countResult = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM exam_room_students
         WHERE room_id = $1 AND registration_id <> $2`,
        [roomId, registrationId],
      );
      if (countResult.rows[0].count >= room.capacity) {
        await client.query("ROLLBACK");
        return res.status(400).json({ success: false, message: "Phong thi da day" });
      }

      let seatNumber = requestedSeat;
      if (seatNumber && seatNumber > room.capacity) {
        await client.query("ROLLBACK");
        return res.status(400).json({ success: false, message: "So ghe vuot qua suc chua phong" });
      }
      if (!seatNumber && Number(currentAssignment?.room_id) === Number(roomId) && currentAssignment.seat_number) {
        seatNumber = currentAssignment.seat_number;
      }
      if (!seatNumber) {
        seatNumber = await findFirstAvailableSeat(client, roomId, room.capacity, registrationId);
      }
      if (!seatNumber) {
        await client.query("ROLLBACK");
        return res.status(400).json({ success: false, message: "Phong thi khong con ghe trong" });
      }

      const assigned = await client.query(
        `INSERT INTO exam_room_students (room_id, registration_id, seat_number, assigned_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (registration_id)
         DO UPDATE SET room_id = EXCLUDED.room_id,
                       seat_number = EXCLUDED.seat_number,
                       assigned_by = EXCLUDED.assigned_by,
                       assigned_at = NOW()
         RETURNING *`,
        [roomId, registrationId, seatNumber, req.user.id],
      );

      await client.query("COMMIT");
      emitExamMonitor(req, examId, "exam_room_assignment_changed", { examId, assignment: assigned.rows[0] });
      return res.json({ success: true, data: assigned.rows[0] });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      if (error.code === "23505") {
        return res.status(409).json({ success: false, message: "Ghe hoac thi sinh da duoc phan phong" });
      }
      console.error("Assign student room error:", error);
      return res.status(500).json({ success: false, message: "Loi phan phong thi" });
    } finally {
      client.release();
    }
  },

  async removeStudentFromRoom(req, res) {
    try {
      const examId = parsePositiveInt(req.params.examId);
      const roomId = parsePositiveInt(req.params.roomId);
      const registrationId = parsePositiveInt(req.params.registrationId);
      if (!examId || !roomId || !registrationId) {
        return res.status(400).json({ success: false, message: "Du lieu phan phong khong hop le" });
      }

      const result = await pool.query(
        `DELETE FROM exam_room_students ers
         USING exam_rooms room
         WHERE ers.room_id = room.id
           AND room.exam_id = $1
           AND ers.room_id = $2
           AND ers.registration_id = $3
         RETURNING ers.*`,
        [examId, roomId, registrationId],
      );

      if (!result.rows[0]) {
        return res.status(404).json({ success: false, message: "Khong tim thay phan phong" });
      }
      emitExamMonitor(req, examId, "exam_room_assignment_changed", { examId, removed: result.rows[0] });
      return res.json({ success: true });
    } catch (error) {
      console.error("Remove student room error:", error);
      return res.status(500).json({ success: false, message: "Loi go thi sinh khoi phong" });
    }
  },

  async autoAssignRooms(req, res) {
    const client = await pool.connect();
    try {
      const examId = parsePositiveInt(req.params.examId);
      if (!examId) return res.status(400).json({ success: false, message: "ID ky thi khong hop le" });

      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [examId]);

      const roomsResult = await client.query(
        `SELECT room.id, room.capacity, COUNT(ers.id)::int AS assigned_count
         FROM exam_rooms room
         LEFT JOIN exam_room_students ers ON ers.room_id = room.id
         WHERE room.exam_id = $1 AND room.status = 'active'
         GROUP BY room.id
         ORDER BY room.room_name ASC`,
        [examId],
      );
      const rooms = roomsResult.rows;
      if (rooms.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ success: false, message: "Chua co phong thi de phan bo" });
      }

      const regsResult = await client.query(
        `SELECT er.id
         FROM exam_registrations er
         LEFT JOIN exam_room_students ers ON ers.registration_id = er.id
         WHERE er.exam_id = $1
           AND er.status IN ('registered', 'approved')
           AND ers.id IS NULL
         ORDER BY er.registered_at ASC`,
        [examId],
      );

      let assignedCount = 0;
      let roomIndex = 0;
      for (const reg of regsResult.rows) {
        while (roomIndex < rooms.length && rooms[roomIndex].assigned_count >= rooms[roomIndex].capacity) {
          roomIndex++;
        }
        if (roomIndex >= rooms.length) break;

        const room = rooms[roomIndex];
        const seatNumber = await findFirstAvailableSeat(client, room.id, room.capacity, reg.id);
        if (!seatNumber) {
          room.assigned_count = room.capacity;
          roomIndex++;
          continue;
        }
        await client.query(
          `INSERT INTO exam_room_students (room_id, registration_id, seat_number, assigned_by)
           VALUES ($1, $2, $3, $4)`,
          [room.id, reg.id, seatNumber, req.user.id],
        );
        room.assigned_count += 1;
        assignedCount += 1;
      }

      await client.query("COMMIT");
      UserActivity.log(req.user.id, "admin.auto_assign_exam_rooms", {
        examId,
        assignedCount,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      emitExamMonitor(req, examId, "exam_room_assignment_changed", { examId, autoAssigned: assignedCount });
      return res.json({ success: true, data: { assignedCount, remaining: regsResult.rows.length - assignedCount } });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("Auto assign rooms error:", error);
      return res.status(500).json({ success: false, message: "Loi phan phong tu dong" });
    } finally {
      client.release();
    }
  },

  async assignProctor(req, res) {
    try {
      const examId = parsePositiveInt(req.params.examId);
      const roomId = parsePositiveInt(req.params.roomId);
      const proctorId = parsePositiveInt(req.body.proctor_id || req.body.proctorId);
      const role = sanitizeText(req.body.role, 30) || "proctor";
      if (!examId || !roomId || !proctorId) {
        return res.status(400).json({ success: false, message: "Du lieu giam thi khong hop le" });
      }

      const roomCheck = await pool.query("SELECT id FROM exam_rooms WHERE id = $1 AND exam_id = $2", [roomId, examId]);
      if (!roomCheck.rows[0]) return res.status(404).json({ success: false, message: "Khong tim thay phong thi" });

      const result = await pool.query(
        `INSERT INTO exam_proctor_assignments (room_id, proctor_id, role, assigned_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (room_id, proctor_id)
         DO UPDATE SET role = EXCLUDED.role,
                       assigned_by = EXCLUDED.assigned_by,
                       assigned_at = NOW()
         RETURNING *`,
        [roomId, proctorId, role, req.user.id],
      );

      emitExamMonitor(req, examId, "exam_proctor_assignment_changed", { examId, assignment: result.rows[0] });
      return res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error("Assign proctor error:", error);
      return res.status(500).json({ success: false, message: "Loi gan giam thi" });
    }
  },

  async removeProctor(req, res) {
    try {
      const examId = parsePositiveInt(req.params.examId);
      const roomId = parsePositiveInt(req.params.roomId);
      const assignmentId = parsePositiveInt(req.params.assignmentId);
      if (!examId || !roomId || !assignmentId) {
        return res.status(400).json({ success: false, message: "Du lieu giam thi khong hop le" });
      }

      const result = await pool.query(
        `DELETE FROM exam_proctor_assignments epa
         USING exam_rooms room
         WHERE epa.room_id = room.id
           AND room.exam_id = $1
           AND epa.room_id = $2
           AND epa.id = $3
         RETURNING epa.*`,
        [examId, roomId, assignmentId],
      );
      if (!result.rows[0]) return res.status(404).json({ success: false, message: "Khong tim thay phan cong" });

      emitExamMonitor(req, examId, "exam_proctor_assignment_changed", { examId, removed: result.rows[0] });
      return res.json({ success: true });
    } catch (error) {
      console.error("Remove proctor error:", error);
      return res.status(500).json({ success: false, message: "Loi go giam thi" });
    }
  },

  async logViolation(req, res) {
    try {
      const attemptId = parsePositiveInt(req.params.attemptId || req.body.attempt_id || req.body.attemptId);
      const type = sanitizeText(req.body.type || req.body.violation_type, 80);
      const count = parsePositiveInt(req.body.count || req.body.violation_count) || 1;
      const severity = sanitizeText(req.body.severity, 20) || "warning";
      const notes = sanitizeText(req.body.notes, 1000);

      if (!attemptId || !type) {
        return res.status(400).json({ success: false, message: "Du lieu vi pham khong hop le" });
      }

      const attemptResult = await pool.query(
        `SELECT ea.id, ea.exam_id, ea.user_id, ea.status, er.id AS registration_id,
                room.id AS room_id, u.full_name AS user_name, u.email AS user_email,
                e.title AS exam_title, e.start_time,
                EXISTS (
                  SELECT 1 FROM admin_exam_source_files sf
                  WHERE sf.exam_id = ea.exam_id
                    AND sf.is_exam_paper = TRUE
                    AND sf.file_type = 'pdf'
                    AND sf.file_data IS NOT NULL
                ) AS has_exam_pdf
         FROM exam_attempts ea
         LEFT JOIN users u ON u.id = ea.user_id
         LEFT JOIN exams e ON e.id = ea.exam_id
         LEFT JOIN exam_registrations er ON er.exam_id = ea.exam_id AND er.user_id = ea.user_id
         LEFT JOIN exam_room_students ers ON ers.registration_id = er.id
         LEFT JOIN exam_rooms room ON room.id = ers.room_id
         WHERE ea.id = $1 AND ea.user_id = $2
         LIMIT 1`,
        [attemptId, req.user.id],
      );

      const attempt = attemptResult.rows[0];
      if (!attempt) {
        return res.status(404).json({ success: false, message: "Khong tim thay luot thi" });
      }

      const result = await pool.query(
        `INSERT INTO exam_violations (
           attempt_id, exam_id, user_id, registration_id, room_id,
           violation_type, violation_count, severity, notes,
           metadata, ip_address, user_agent
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12)
         RETURNING *`,
        [
          attempt.id,
          attempt.exam_id,
          attempt.user_id,
          attempt.registration_id,
          attempt.room_id,
          type,
          count,
          severity,
          notes,
          JSON.stringify(req.body.metadata && typeof req.body.metadata === "object" ? req.body.metadata : {}),
          req.ip,
          req.headers["user-agent"] || null,
        ],
      );

      UserActivity.log(req.user.id, "exam_violation", {
        examId: attempt.exam_id,
        attemptId,
        type,
        count,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      emitExamMonitor(req, attempt.exam_id, "exam_violation_logged", { examId: attempt.exam_id, violation: result.rows[0] });

      const violationTotalResult = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM exam_violations
         WHERE attempt_id = $1`,
        [attempt.id],
      );
      const serverViolationCount = Number(violationTotalResult.rows[0]?.total) || 0;
      const isProtectedPdfRoomAttempt = Boolean(attempt.start_time && attempt.has_exam_pdf);
      let autoSubmitted = false;
      let submission = null;

      if (isProtectedPdfRoomAttempt && attempt.status === "in_progress" && serverViolationCount >= 3) {
        submission = await ExamAttempt.submit(attempt.id, attempt.user_id);
        autoSubmitted = true;
        UserActivity.log(req.user.id, "exam_auto_submit_violation", {
          examId: attempt.exam_id,
          attemptId: attempt.id,
          violationCount: serverViolationCount,
          triggerType: type,
          ip: req.ip,
          userAgent: req.headers["user-agent"],
        });
        emitExamMonitor(req, attempt.exam_id, "exam_attempt_auto_submitted", {
          examId: attempt.exam_id,
          attemptId: attempt.id,
          userId: attempt.user_id,
          violationCount: serverViolationCount,
        });
      }

      // Keep the admin informed in real time, but collapse repeated events of
      // the same type for one attempt into a five-minute notification window.
      const recentNotification = await pool.query(
        `SELECT id
         FROM admin_notifications
         WHERE type = 'exam_violation'
           AND metadata->>'attemptId' = $1
           AND metadata->>'violationType' = $2
           AND created_at >= NOW() - INTERVAL '5 minutes'
         LIMIT 1`,
        [String(attempt.id), type]
      ).catch(() => ({ rows: [] }));

      if (!recentNotification.rows[0]) {
        const userLabel = attempt.user_name || attempt.user_email || `User #${attempt.user_id}`;
        const adminSeverity = ['critical', 'high'].includes(severity) ? severity : 'medium';
        await AuditLog.notify({
          type: 'exam_violation',
          severity: adminSeverity,
          title: `Phát hiện gian lận: ${userLabel}`,
          message: `${attempt.exam_title || `Đề #${attempt.exam_id}`} · ${ADMIN_VIOLATION_LABELS[type] || type} (x${count}) · lượt thi #${attempt.id}`,
          entityType: 'exam_attempt',
          entityId: attempt.id,
          userId: attempt.user_id,
          metadata: {
            attemptId: attempt.id,
            examId: attempt.exam_id,
            examTitle: attempt.exam_title || null,
            violationId: result.rows[0].id,
            violationType: type,
            violationCount: count,
            userEmail: attempt.user_email || null,
          },
        });
      }

      return res.status(201).json({
        success: true,
        data: {
          ...result.rows[0],
          server_violation_count: serverViolationCount,
          auto_submitted: autoSubmitted,
          submission,
        },
      });
    } catch (error) {
      console.error("Log exam violation error:", error);
      return res.status(500).json({ success: false, message: "Loi ghi nhan vi pham" });
    }
  },

  async listViolations(req, res) {
    try {
      const examId = parsePositiveInt(req.params.examId);
      if (!examId) return res.status(400).json({ success: false, message: "ID ky thi khong hop le" });

      const result = await pool.query(
        `SELECT ev.*, u.email, u.full_name, room.room_name
         FROM exam_violations ev
         JOIN users u ON u.id = ev.user_id
         LEFT JOIN exam_rooms room ON room.id = ev.room_id
         WHERE ev.exam_id = $1
         ORDER BY ev.created_at DESC
         LIMIT 300`,
        [examId],
      );
      return res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error("List violations error:", error);
      return res.status(500).json({ success: false, message: "Loi lay bien ban vi pham" });
    }
  },

  async getMonitor(req, res) {
    try {
      const examId = parsePositiveInt(req.params.examId);
      if (!examId) return res.status(400).json({ success: false, message: "ID ky thi khong hop le" });

      const [overview, participants, rooms, recentViolations] = await Promise.all([
        pool.query(
          `SELECT
             COUNT(DISTINCT CASE WHEN ea.status <> 'practice' THEN ea.user_id END)::int AS participants,
             COUNT(DISTINCT CASE WHEN ea.status = 'in_progress' THEN ea.user_id END)::int AS in_progress,
             COUNT(DISTINCT CASE WHEN ea.status = 'completed' THEN ea.user_id END)::int AS completed,
             COUNT(DISTINCT ev.id)::int AS violations
           FROM exams e
           LEFT JOIN exam_attempts ea ON ea.exam_id = e.id
           LEFT JOIN exam_violations ev ON ev.exam_id = e.id
           WHERE e.id = $1`,
          [examId],
        ),
        pool.query(
          `WITH latest_attempts AS (
             SELECT DISTINCT ON (user_id) *
             FROM exam_attempts
             WHERE exam_id = $1 AND status <> 'practice'
             ORDER BY user_id, start_time DESC, id DESC
           )
           SELECT ea.id AS attempt_id, ea.user_id, ea.status,
                  ea.start_time, ea.submit_time, ea.duration_seconds,
                  ea.total_correct, ea.total_incorrect, ea.total_unanswered,
                  CASE WHEN ea.status = 'completed' THEN
                    LEAST(100, GREATEST(0, ROUND((
                      CASE
                        WHEN ea.score_percentage IS NOT NULL THEN ea.score_percentage::numeric
                        WHEN qp.possible_points > 0 THEN ea.total_score::numeric / qp.possible_points * 100
                        WHEN e.total_questions > 0 THEN ea.total_correct::numeric / e.total_questions * 100
                        WHEN ea.total_score <= 10 THEN ea.total_score::numeric * 10
                        ELSE ea.total_score::numeric
                      END
                    ), 1)))::float
                  ELSE NULL END AS score_100,
                  u.email, u.username,
                  COALESCE(NULLIF(u.full_name, ''), u.username, u.email, 'User #' || u.id) AS full_name,
                  COALESCE(u.avatar_url, u.avatar) AS avatar_url
           FROM latest_attempts ea
           JOIN exams e ON e.id = ea.exam_id
           JOIN users u ON u.id = ea.user_id
           LEFT JOIN LATERAL (
             SELECT COALESCE(SUM(q.points), 0)::numeric AS possible_points
             FROM questions q
             WHERE q.exam_id = e.id AND q.deleted_at IS NULL
           ) qp ON true
           ORDER BY ea.start_time DESC, ea.id DESC`,
          [examId],
        ),
        pool.query(
          `SELECT room.id, room.room_name, room.location, room.capacity,
                  COUNT(DISTINCT ers.id)::int AS assigned_count,
                  COUNT(DISTINCT CASE WHEN er.status = 'checked_in' THEN er.id END)::int AS checked_in,
                  COUNT(DISTINCT ev.id)::int AS violations
           FROM exam_rooms room
           LEFT JOIN exam_room_students ers ON ers.room_id = room.id
           LEFT JOIN exam_registrations er ON er.id = ers.registration_id
           LEFT JOIN exam_violations ev ON ev.room_id = room.id
           WHERE room.exam_id = $1
           GROUP BY room.id
           ORDER BY room.room_name ASC`,
          [examId],
        ),
        pool.query(
          `SELECT ev.id, ev.violation_type, ev.severity, ev.created_at,
                  u.full_name, u.email, room.room_name
           FROM exam_violations ev
           JOIN users u ON u.id = ev.user_id
           LEFT JOIN exam_rooms room ON room.id = ev.room_id
           WHERE ev.exam_id = $1
           ORDER BY ev.created_at DESC
           LIMIT 20`,
          [examId],
        ),
      ]);

      return res.json({
        success: true,
        data: {
          overview: overview.rows[0],
          participants: participants.rows,
          rooms: rooms.rows,
          recentViolations: recentViolations.rows,
        },
      });
    } catch (error) {
      console.error("Get monitor error:", error);
      return res.status(500).json({ success: false, message: "Loi lay du lieu giam sat" });
    }
  },

  async getLeaderboard(req, res) {
    try {
      const examId = parsePositiveInt(req.params.examId);
      const roomId = parsePositiveInt(req.query.room_id || req.query.roomId);
      const limit = Math.min(parsePositiveInt(req.query.limit) || 50, 100);
      if (!examId) return res.status(400).json({ success: false, message: "ID ky thi khong hop le" });

      const examResult = await pool.query(
        `SELECT e.id, e.title, e.start_time, e.end_time,
                (e.start_time IS NOT NULL AND (e.end_time IS NULL OR e.end_time >= CURRENT_TIMESTAMP)) AS leaderboard_locked,
                s.name AS subject_name, s.code AS subject_code
         FROM exams e
         LEFT JOIN subjects s ON s.id = e.subject_id
         WHERE e.id = $1 AND e.deleted_at IS NULL
         LIMIT 1`,
        [examId],
      );

      const exam = examResult.rows[0];
      if (!exam) {
        return res.status(404).json({ success: false, message: "Khong tim thay ky thi" });
      }
      if (exam.leaderboard_locked) {
        return res.status(423).json({
          success: false,
          code: "LEADERBOARD_NOT_AVAILABLE",
          message: "Bang xep hang chi mo sau khi ky thi ket thuc",
        });
      }

      const params = [examId];
      let roomFilter = "";
      if (roomId) {
        params.push(roomId);
        roomFilter = `AND room.id = $${params.length}`;
      }
      params.push(limit);

      const result = await pool.query(
        `WITH completed_attempts AS (
           SELECT ea.*,
                  LEAST(100, GREATEST(0, ROUND((
                    CASE
                      WHEN qp.possible_points > 0 THEN ea.total_score::numeric / qp.possible_points * 100
                      WHEN e.total_questions > 0 THEN ea.total_correct::numeric / e.total_questions * 100
                      WHEN ea.total_score <= 10 THEN ea.total_score::numeric * 10
                      ELSE ea.total_score::numeric
                    END
                  ), 1))) AS score_100,
                  COALESCE(NULLIF(ea.duration_seconds, 0), 999999999)::int AS rank_time_seconds
           FROM exam_attempts ea
           JOIN exams e ON e.id = ea.exam_id
           LEFT JOIN LATERAL (
             SELECT COALESCE(SUM(q.points), 0)::numeric AS possible_points
             FROM questions q
             WHERE q.exam_id = e.id
               AND q.deleted_at IS NULL
           ) qp ON true
           WHERE ea.exam_id = $1
             AND ea.status = 'completed'
             AND ea.total_score IS NOT NULL
         ),
         ranked_attempts AS (
           SELECT ca.*,
                  ROW_NUMBER() OVER (
                    PARTITION BY ca.user_id
                    ORDER BY ca.score_100 DESC, ca.rank_time_seconds ASC, ca.submit_time ASC NULLS LAST
                  ) AS best_rank
           FROM completed_attempts ca
         ),
         user_exam_stats AS (
           SELECT user_id,
                  COUNT(id)::int AS total_attempts,
                  ROUND(AVG(score_100)::numeric, 1)::float AS avg_score
           FROM completed_attempts
           GROUP BY user_id
         )
         SELECT
           u.id AS user_id,
           COALESCE(NULLIF(u.full_name, ''), u.username, u.email, 'User #' || u.id) AS full_name,
           COALESCE(u.avatar_url, u.avatar) AS avatar_url,
           room.id AS room_id,
           room.room_name,
           room.location,
           ers.seat_number,
           ues.total_attempts,
           ues.avg_score,
           ROUND(ra.score_100::numeric, 1)::float AS total_score,
           ra.total_correct,
           ra.total_incorrect,
           NULLIF(ra.rank_time_seconds, 999999999)::int AS duration_seconds,
           ra.submit_time
         FROM ranked_attempts ra
         JOIN users u ON u.id = ra.user_id
         JOIN user_exam_stats ues ON ues.user_id = ra.user_id
         LEFT JOIN exam_registrations er ON er.exam_id = ra.exam_id AND er.user_id = ra.user_id
         LEFT JOIN exam_room_students ers ON ers.registration_id = er.id
         LEFT JOIN exam_rooms room ON room.id = ers.room_id
         WHERE ra.best_rank = 1
           AND u.role = 'student'
           AND ra.score_100 >= 50
           ${roomFilter}
         ORDER BY ra.score_100 DESC, ra.rank_time_seconds ASC, ra.submit_time ASC NULLS LAST, u.id ASC
         LIMIT $${params.length}`,
        params,
      );

      const leaderboard = result.rows.map((row, index) => ({
        rank: index + 1,
        ...row,
      }));

      return res.json({
        success: true,
        data: {
          exam,
          scope: roomId ? "room" : "exam",
          room_id: roomId || null,
          leaderboard,
        },
      });
    } catch (error) {
      console.error("Official exam leaderboard error:", error);
      return res.status(500).json({ success: false, message: "Loi lay bang xep hang phong thi" });
    }
  },

  async generateCertificates(req, res) {
    const client = await pool.connect();
    try {
      const examId = parsePositiveInt(req.params.examId);
      const passScore = Number.isFinite(Number(req.body.pass_score || req.body.passScore))
        ? Number(req.body.pass_score || req.body.passScore)
        : 60;
      const attemptIds = Array.isArray(req.body.attempt_ids || req.body.attemptIds)
        ? (req.body.attempt_ids || req.body.attemptIds).map(parsePositiveInt).filter(Boolean)
        : null;

      if (!examId) return res.status(400).json({ success: false, message: "ID ky thi khong hop le" });

      await client.query("BEGIN");
      const params = [examId, passScore];
      let attemptFilter = "";
      if (attemptIds && attemptIds.length > 0) {
        params.push(attemptIds);
        attemptFilter = `AND ea.id = ANY($${params.length}::int[])`;
      }

      const attempts = await client.query(
        `SELECT ea.id, ea.exam_id, ea.user_id, ea.total_score
         FROM exam_attempts ea
         LEFT JOIN exam_certificates ec ON ec.attempt_id = ea.id
         WHERE ea.exam_id = $1
           AND ea.status = 'completed'
           AND COALESCE(ea.total_score, 0) >= $2
           AND ec.id IS NULL
           ${attemptFilter}
         ORDER BY ea.submit_time ASC`,
        params,
      );

      const certificates = [];
      for (const attempt of attempts.rows) {
        let code = certificateCode();
        for (let retries = 0; retries < 5; retries++) {
          try {
            const inserted = await client.query(
              `INSERT INTO exam_certificates (
                 exam_id, attempt_id, user_id, certificate_code,
                 total_score, pass_score, issued_by, metadata
               )
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
               RETURNING *`,
              [
                attempt.exam_id,
                attempt.id,
                attempt.user_id,
                code,
                attempt.total_score || 0,
                passScore,
                req.user.id,
                JSON.stringify({ generatedBy: "admin", generatedAt: new Date().toISOString() }),
              ],
            );
            certificates.push(inserted.rows[0]);
            break;
          } catch (error) {
            if (error.code !== "23505" || retries === 4) throw error;
            code = certificateCode();
          }
        }
      }

      await client.query("COMMIT");
      UserActivity.log(req.user.id, "admin.generate_certificates", {
        examId,
        count: certificates.length,
        passScore,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      return res.status(201).json({ success: true, data: certificates });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("Generate certificates error:", error);
      return res.status(500).json({ success: false, message: "Loi cap chung nhan" });
    } finally {
      client.release();
    }
  },

  async listCertificates(req, res) {
    try {
      const examId = parsePositiveInt(req.params.examId);
      if (!examId) return res.status(400).json({ success: false, message: "ID ky thi khong hop le" });

      const result = await pool.query(
        `SELECT ec.*, u.email, u.full_name, e.title AS exam_title
         FROM exam_certificates ec
         JOIN users u ON u.id = ec.user_id
         JOIN exams e ON e.id = ec.exam_id
         WHERE ec.exam_id = $1
         ORDER BY ec.issued_at DESC`,
        [examId],
      );
      return res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error("List certificates error:", error);
      return res.status(500).json({ success: false, message: "Loi lay chung nhan" });
    }
  },

  async getMyCertificates(req, res) {
    try {
      const result = await pool.query(
        `SELECT ec.*, e.title AS exam_title, e.title_cn AS exam_title_cn
         FROM exam_certificates ec
         JOIN exams e ON e.id = ec.exam_id
         WHERE ec.user_id = $1 AND ec.status = 'issued'
         ORDER BY ec.issued_at DESC`,
        [req.user.id],
      );
      return res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error("Get my certificates error:", error);
      return res.status(500).json({ success: false, message: "Loi lay chung nhan" });
    }
  },

  async verifyCertificate(req, res) {
    try {
      const code = sanitizeText(req.params.code, 64);
      if (!code) return res.status(400).json({ success: false, message: "Ma chung nhan khong hop le" });

      const result = await pool.query(
        `SELECT ec.certificate_code, ec.total_score, ec.pass_score, ec.status,
                ec.issued_at, ec.revoked_at,
                e.title AS exam_title, e.title_cn AS exam_title_cn,
                u.full_name, u.email
         FROM exam_certificates ec
         JOIN exams e ON e.id = ec.exam_id
         JOIN users u ON u.id = ec.user_id
         WHERE ec.certificate_code = $1
         LIMIT 1`,
        [code],
      );

      const certificate = result.rows[0];
      if (!certificate || certificate.status !== "issued") {
        return res.status(404).json({ success: false, message: "Chung nhan khong hop le hoac da bi thu hoi" });
      }

      return res.json({ success: true, data: certificate });
    } catch (error) {
      console.error("Verify certificate error:", error);
      return res.status(500).json({ success: false, message: "Loi xac thuc chung nhan" });
    }
  },
};

module.exports = officialExamController;
