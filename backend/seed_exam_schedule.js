const { pool } = require('./src/config/database');

async function run() {
  try {
    // Cập nhật 2 đề thi đầu thành LIVE (đang diễn ra ngay bây giờ)
    await pool.query(`
      UPDATE exams 
      SET 
        start_time = NOW() - INTERVAL '30 minutes',
        end_time = NOW() + INTERVAL '2 hours',
        max_participants = 5000,
        status = 'published'
      WHERE id IN (SELECT id FROM exams ORDER BY id ASC LIMIT 2)
    `);
    console.log("✅ Updated 2 exams → LIVE");

    // Cập nhật 3 đề thi tiếp theo thành UPCOMING (sắp diễn ra)
    await pool.query(`
      UPDATE exams 
      SET 
        start_time = NOW() + INTERVAL '2 hours',
        end_time = NOW() + INTERVAL '4 hours',
        max_participants = 2000,
        status = 'published'
      WHERE id IN (SELECT id FROM exams ORDER BY id ASC OFFSET 2 LIMIT 3)
    `);
    console.log("✅ Updated 3 exams → UPCOMING");

    // Kiểm tra kết quả
    const res = await pool.query(`
      SELECT id, title, status, start_time, end_time 
      FROM exams 
      ORDER BY id ASC LIMIT 5
    `);
    console.log("\nKết quả:");
    res.rows.forEach(r => {
      const now = new Date();
      const start = r.start_time ? new Date(r.start_time) : null;
      const end = r.end_time ? new Date(r.end_time) : null;
      let type = 'public';
      if (start && end) {
        if (now >= start && now <= end) type = '🔴 LIVE';
        else if (now < start) type = '🟡 UPCOMING';
        else type = '⚫ ENDED';
      }
      console.log(`[${type}] #${r.id} ${r.title?.slice(0, 40)}`);
    });
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
