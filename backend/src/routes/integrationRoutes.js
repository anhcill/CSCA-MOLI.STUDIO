const express = require("express");
const db = require("../config/database");
const { listPublished } = require("../repositories/courseRepository");
const { requireIntegrationKey } = require("../middleware/integrationKey");

const router = express.Router();
router.use(requireIntegrationKey);

function pagination(query, defaultLimit = 50) {
  const pageValue = Number.parseInt(query.page, 10);
  const limitValue = Number.parseInt(query.limit, 10);
  const page = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const limit = Number.isInteger(limitValue)
    ? Math.min(Math.max(limitValue, 1), 100)
    : defaultLimit;
  return { page, limit, offset: (page - 1) * limit };
}

function pageResponse(data, page, limit, total) {
  return {
    data,
    pagination: {
      currentPage: page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      total,
      limit,
    },
  };
}

function mapPaymentStatus(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "completed" || normalized === "paid" || normalized === "success") return "Paid";
  if (normalized === "refunded" || normalized === "refund") return "Refunded";
  if (normalized === "failed" || normalized === "cancelled" || normalized === "canceled") return "Failed";
  return "Pending";
}

router.get("/courses", async (req, res, next) => {
  try {
    const { page, limit } = pagination(req.query);
    const rows = await listPublished({ page, limit, userId: null });
    const total = Number(rows[0]?.total_count || 0);
    const data = rows.map((row) => ({
      id: String(row.id),
      title: row.title || "",
      slug: row.slug || null,
      description: row.description || row.short_description || null,
      thumbnailUrl: row.thumbnail_url || null,
      price: Number(row.price_vnd || 0),
      status: "Published",
      version: 1,
      updatedAt: row.content_updated_at || row.updated_at || row.created_at,
      modules: [],
    }));
    return res.json(pageResponse(data, page, limit, total));
  } catch (error) {
    return next(error);
  }
});

router.get("/questions", async (req, res, next) => {
  try {
    const { page, limit, offset } = pagination(req.query);
    const [rowsResult, countResult] = await Promise.all([
      db.query(
        `SELECT
           q.id::text AS id,
           e.title AS bank_name,
           s.name AS subject_name,
           q.question_text,
           q.explanation,
           q.difficulty,
           COALESCE(
             jsonb_agg(
               jsonb_build_object(
                 'label', a.answer_key,
                 'contentHtml', COALESCE(a.answer_text_cn, a.answer_text, ''),
                 'isCorrect', a.is_correct,
                 'orderIndex', a.id
               ) ORDER BY a.id
             ) FILTER (WHERE a.id IS NOT NULL),
             '[]'::jsonb
           ) AS choices
         FROM questions q
         JOIN exams e ON e.id = q.exam_id
         LEFT JOIN subjects s ON s.id = e.subject_id
         LEFT JOIN answers a ON a.question_id = q.id
         WHERE q.deleted_at IS NULL
           AND e.deleted_at IS NULL
         GROUP BY q.id, e.title, s.name, q.question_text, q.explanation, q.difficulty
         ORDER BY q.id
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      ),
      db.query(
        `SELECT COUNT(*)::int AS total
         FROM questions q
         JOIN exams e ON e.id = q.exam_id
         WHERE q.deleted_at IS NULL AND e.deleted_at IS NULL`,
      ),
    ]);

    const data = rowsResult.rows.map((row) => ({
      id: row.id,
      bankName: row.bank_name || "CSCA Questions",
      subject: row.subject_name || null,
      topic: null,
      difficultyLevel: row.difficulty || "Medium",
      contentHtml: row.question_text || "",
      explanationHtml: row.explanation || null,
      choices: Array.isArray(row.choices) ? row.choices : [],
      tags: ["CSCA"],
    }));
    return res.json(pageResponse(data, page, limit, Number(countResult.rows[0]?.total || 0)));
  } catch (error) {
    return next(error);
  }
});

router.get("/customers", async (req, res, next) => {
  try {
    const { page, limit, offset } = pagination(req.query);
    const [rowsResult, countResult] = await Promise.all([
      db.query(
        `SELECT id::text AS id, full_name, email, phone, created_at, updated_at
         FROM users
         ORDER BY created_at DESC, id DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      ),
      db.query(`SELECT COUNT(*)::int AS total FROM users`),
    ]);

    const data = rowsResult.rows.map((row) => ({
      id: row.id,
      fullName: row.full_name || "",
      email: row.email || "",
      phoneNumber: row.phone || null,
      updatedAt: row.updated_at || row.created_at,
    }));
    return res.json(pageResponse(data, page, limit, Number(countResult.rows[0]?.total || 0)));
  } catch (error) {
    return next(error);
  }
});

router.get("/subscriptions", async (req, res, next) => {
  try {
    const { page, limit, offset } = pagination(req.query);
    const [rowsResult, countResult] = await Promise.all([
      db.query(
        `SELECT id::text AS id, full_name, subscription_tier, is_vip,
                vip_expires_at, created_at
         FROM users
         WHERE (COALESCE(subscription_tier, 'basic') <> 'basic' OR COALESCE(is_vip, FALSE) = TRUE)
         ORDER BY created_at DESC, id DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      ),
      db.query(
        `SELECT COUNT(*)::int AS total
         FROM users
         WHERE (COALESCE(subscription_tier, 'basic') <> 'basic' OR COALESCE(is_vip, FALSE) = TRUE)`,
      ),
    ]);

    const data = rowsResult.rows.map((row) => {
      const startsAt = row.created_at || new Date().toISOString();
      const expiresAt = row.vip_expires_at || new Date(new Date(startsAt).getTime() + 365 * 86400000).toISOString();
      return {
        id: `user:${row.id}:subscription`,
        customerId: row.id,
        packageName: row.subscription_tier || (row.is_vip ? "vip" : "basic"),
        startsAt,
        expiresAt,
        status: new Date(expiresAt) > new Date() ? "Active" : "Expired",
      };
    });
    return res.json(pageResponse(data, page, limit, Number(countResult.rows[0]?.total || 0)));
  } catch (error) {
    return next(error);
  }
});

router.get("/payments", async (req, res, next) => {
  try {
    const { page, limit, offset } = pagination(req.query);
    const [rowsResult, countResult] = await Promise.all([
      db.query(
        `SELECT id::text AS id, user_id::text AS customer_id, amount, status,
                payment_method, transaction_code, trans_id, paid_at, created_at
         FROM transactions
         ORDER BY COALESCE(paid_at, created_at) DESC, id DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      ),
      db.query(`SELECT COUNT(*)::int AS total FROM transactions`),
    ]);

    const data = rowsResult.rows.map((row) => ({
      id: row.id,
      customerId: row.customer_id,
      amount: Number(row.amount || 0),
      currency: "VND",
      status: mapPaymentStatus(row.status),
      paidAt: row.paid_at || row.created_at,
      paymentMethod: row.payment_method || null,
      transactionReference: row.transaction_code || row.trans_id || null,
    }));
    return res.json(pageResponse(data, page, limit, Number(countResult.rows[0]?.total || 0)));
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
