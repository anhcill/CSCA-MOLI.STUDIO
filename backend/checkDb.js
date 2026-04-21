const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:yREnxOwrFSmIQCSdRDghFjAcSFAhoorK@nozomi.proxy.rlwy.net:47269/railway' });

async function check() {
  await client.connect();
  const res = await client.query(`SELECT id, user_id, transaction_code, amount, status, created_at FROM transactions WHERE payment_method = 'bank_transfer' ORDER BY created_at DESC LIMIT 5`);
  console.table(res.rows);
  await client.end();
}
check().catch(console.error);
