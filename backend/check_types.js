const { Client } = require('pg');
const client = new Client('postgresql://postgres:yREnxOwrFSmIQCSdRDghFjAcSFAhoorK@nozomi.proxy.rlwy.net:47269/railway');

async function run() {
  await client.connect();
  const res = await client.query('SELECT DISTINCT question_type FROM questions');
  console.log(res.rows);
  await client.end();
}
run().catch(console.error);
