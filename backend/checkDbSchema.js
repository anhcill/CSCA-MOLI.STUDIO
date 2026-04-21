const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:yREnxOwrFSmIQCSdRDghFjAcSFAhoorK@nozomi.proxy.rlwy.net:47269/railway' });
async function check() {
  await client.connect();
  const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'questions'");
  console.table(res.rows);
  await client.end();
}
check().catch(console.error);
