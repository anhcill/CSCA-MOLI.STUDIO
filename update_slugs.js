const {pool} = require('./backend/src/config/database');
async function run() {
  await pool.query("UPDATE subjects SET slug = 'toan' WHERE code = 'MATH'");
  await pool.query("UPDATE subjects SET slug = 'vat-ly' WHERE code = 'PHYSICS'");
  await pool.query("UPDATE subjects SET slug = 'hoa' WHERE code = 'CHEMISTRY'");
  await pool.query("UPDATE subjects SET slug = 'tiengtrung-xahoi' WHERE code = 'CHINESE_SOC'");
  await pool.query("UPDATE subjects SET slug = 'tiengtrung-tunhien' WHERE code = 'CHINESE_SCI'");
  console.log('Slugs updated');
  process.exit(0);
}
run();
