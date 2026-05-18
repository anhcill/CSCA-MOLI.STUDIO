const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const client = new Client({ connectionString: process.env.DATABASE_URL });

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
