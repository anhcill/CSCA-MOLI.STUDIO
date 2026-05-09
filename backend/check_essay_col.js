const { Client } = require('pg');
const client = new Client('postgresql://postgres:yREnxOwrFSmIQCSdRDghFjAcSFAhoorK@nozomi.proxy.rlwy.net:47269/railway');

async function run() {
  await client.connect();
  const q = await client.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'user_answers'
    ORDER BY ordinal_position
  `);
  console.log(JSON.stringify(q.rows, null, 2));
  await client.end();
}
run().catch(console.error);
