/**
 * Script: Gửi email reset password cho admin
 * Chạy: node scripts/send-admin-reset.js
 *
 * Yêu cầu biến môi trường ( Railway variables hoặc local .env ):
 *   DATABASE_URL / DATABASE_PUBLIC_URL
 *   BREVO_API_KEY
 *   FRONTEND_URL
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const crypto = require('crypto');
const axios = require('axios');
const { getPrimaryFrontendUrl } = require('../src/utils/frontendUrl');

const pool = new (require('pg').Pool)({
  connectionString: process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL,
  ssl: { rejectUnauthorized: false },
});

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SENDER_EMAIL = process.env.EMAIL_SENDER || 'cloudlystudio05@gmail.com';
const SENDER_NAME  = process.env.EMAIL_SENDER_NAME || 'CSCA Platform';
const FRONTEND_URL = getPrimaryFrontendUrl();

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function findAdmin(email) {
  const result = await pool.query(
    `SELECT id, email, full_name, is_active
     FROM users
     WHERE email = $1 AND role = 'admin' AND is_active = true`,
    [email.toLowerCase()]
  );
  return result.rows[0] || null;
}

async function findAdminByUsername(username) {
  const result = await pool.query(
    `SELECT id, email, full_name, is_active
     FROM users
     WHERE username = $1 AND role = 'admin' AND is_active = true`,
    [username.toLowerCase()]
  );
  return result.rows[0] || null;
}

async function upsertResetToken(userId) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 phút

  await pool.query(
    `UPDATE users
     SET password_reset_token = $1, password_reset_expires = $2
     WHERE id = $3`,
    [tokenHash, expiresAt, userId]
  );

  return rawToken;
}

function buildEmailHtml({ name, resetUrl }) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif">
  <div style="max-width:600px;margin:30px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:32px 40px;text-align:center">
      <div style="display:inline-block;width:56px;height:56px;background:rgba(255,255,255,.2);border-radius:14px;line-height:56px;font-size:28px;margin-bottom:12px">&#128272;</div>
      <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0;letter-spacing:-.3px">CSCA Platform</h1>
      <p style="color:rgba(255,255,255,.75);font-size:13px;margin:6px 0 0">&#128273; &#272;at lai mat khau</p>
    </div>
    <div style="padding:36px 40px;font-size:15px;line-height:1.7;color:#333">
      <h2 style="margin:0 0 20px;font-size:20px">Dat lai mat khau</h2>
      <p style="margin:0 0 16px">Chung toi nhan duoc yeu cau dat lai mat khau cho tai khoan admin lien ket voi email nay.</p>
      <p style="margin:0 0 24px">Nhan vao nut ben duoi de tao mat khau moi. Lien ket nay chi co hieu luc trong <strong style="color:#ef4444">15 phut</strong>.</p>
      <div style="text-align:center;margin:0 0 24px">
        <a href="${resetUrl}" style="display:inline-block;padding:16px 36px;background:#111827;color:#fff;font-weight:700;border-radius:10px;text-decoration:none;font-size:15px">&#128273; Dat lai mat khau &#8594;</a>
      </div>
      <p style="margin:0 0 16px;font-size:14px;color:#666">Neu nut khong hoat dong, sao chep duong dan sau vao trinh duyet:</p>
      <p style="margin:0 0 24px;word-break:break-all;background:#f4f4f8;padding:12px 16px;border-radius:8px;font-size:12px;color:#666">${resetUrl}</p>
      <p style="background:#fef9c3;border-left:4px solid #eab308;border-radius:0 8px 8px 0;padding:14px 18px;margin:0;font-size:14px;color:#713f12">&#9201; Lien ket dat lai se het han sau 15 phut. Neu ban khong yeu cau dat lai mat khau, hay bo qua email nay.</p>
    </div>
    <div style="padding:24px 40px;background:#f9f9f9;border-top:1px solid #eee;text-align:center">
      <p style="margin:0 0 4px;color:#999;font-size:12px">Email nay duoc gui tu CSCA Platform.</p>
      <p style="margin:0;color:#999;font-size:12px">&#169; 2026 CSCA Platform. Moi quyen duoc bao luu.</p>
    </div>
  </div>
</body>
</html>`;
}

async function sendEmailViaBrevo({ to, subject, html }) {
  if (!BREVO_API_KEY) {
    console.warn('  [WARN] BREVO_API_KEY not set — email will be skipped');
    return;
  }
  await axios.post(
    'https://api.brevo.com/v3/smtp/email',
    {
      sender: { email: SENDER_EMAIL, name: SENDER_NAME },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: subject,
    },
    {
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
      timeout: 15000,
    }
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
  Usage:
    node scripts/send-admin-reset.js <email>
    node scripts/send-admin-reset.js --username <username>
    node scripts/send-admin-reset.js --list           # list all admins
    node scripts/send-admin-reset.js --help

  Examples:
    node scripts/send-admin-reset.js admin@example.com
    node scripts/send-admin-reset.js --username ducan
`);
    process.exit(0);
  }

  // ── List all admins ──────────────────────────────────────────────────────────
  if (args[0] === '--list') {
    const result = await pool.query(
      `SELECT id, username, email, full_name, is_active, created_at
       FROM users
       WHERE role = 'admin'
       ORDER BY created_at DESC`
    );
    if (result.rows.length === 0) {
      console.log('  Khong co tai khoan admin nao.');
    } else {
      console.log(`\n  Danh sach admin (${result.rows.length}):\n`);
      for (const u of result.rows) {
        console.log(`  ID: ${u.id}  |  ${u.username}  |  ${u.email}  |  ${u.full_name}  |  active: ${u.is_active}`);
      }
      console.log();
    }
    await pool.end();
    return;
  }

  // ── Find user ───────────────────────────────────────────────────────────────
  let user;

  if (args[0] === '--username' && args[1]) {
    user = await findAdminByUsername(args[1]);
  } else {
    user = await findAdmin(args[0]);
  }

  if (!user) {
    console.error('  [ERROR] Khong tim thay tai khoan admin voi thong tin nay.');
    await pool.end();
    process.exit(1);
  }

  console.log(`  Tim thay admin: ${user.full_name} <${user.email}> (ID: ${user.id})`);

  // ── Generate reset token ───────────────────────────────────────────────────
  const rawToken = await upsertResetToken(user.id);
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${rawToken}&id=${user.id}`;

  console.log(`  Token da duoc luu vao DB (hieu luc 15 phut).`);
  console.log(`  Reset URL: ${resetUrl}\n`);

  // ── Send email ──────────────────────────────────────────────────────────────
  console.log('  Dang gui email...');
  try {
    await sendEmailViaBrevo({
      to: user.email,
      subject: '\uD83D\uDD11 Dat lai mat khau CSCA Platform',
      html: buildEmailHtml({ name: user.full_name, resetUrl }),
    });
    console.log('  [OK] Email da gui thanh cong!');
  } catch (err) {
    const msg = err?.response?.data?.message || err.message;
    console.error(`  [ERROR] Gui email that bai: ${msg}`);
    console.error('  [INFO] Ban van co the copy reset URL o tren de gui thu cong.');
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error('  [ERROR]', err.message);
  try { await pool.end(); } catch (_) {}
  process.exit(1);
});
