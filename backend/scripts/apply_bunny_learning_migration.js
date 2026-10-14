const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
async function main() {
  if (!['--check','--apply'].includes(process.argv[2]) || process.argv.length !== 3 || !process.env.VIDEO_COMMERCE_DATABASE_URL)
    throw new Error('Explicit database and --check or --apply required');
  const client = new Client({ connectionString: process.env.VIDEO_COMMERCE_DATABASE_URL, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    if (process.argv[2] === '--apply') {
      await client.query('BEGIN');
      try { await client.query(fs.readFileSync(path.join(__dirname,'../../database/migrations/070_bunny_learning.sql'),'utf8')); await client.query('COMMIT'); }
      catch (error) { await client.query('ROLLBACK'); throw error; }
    }
    const expected = ['provider','bunny_library_id','bunny_video_id','bunny_status','bunny_checked_at','bunny_thumbnail_file'];
    const columns = (await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='video_assets'")).rows;
    const missing = expected.filter(name => !columns.some(row => row.column_name === name));
    const constraint = (await client.query("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='course_enrollments'::regclass AND conname='chk_course_enrollments_source'")).rows[0];
    if (!constraint?.definition.includes("'video'")) missing.push('enrollment video source');
    console.log(JSON.stringify({migration:'070_bunny_learning.sql',ready:missing.length===0,missing},null,2));
    if (missing.length) process.exitCode=1;
  } finally { await client.end(); }
}
main().catch(error => { console.error(error.code ? `Migration failed (${error.code}).` : 'Check arguments and explicit target database.'); process.exitCode=1; });
