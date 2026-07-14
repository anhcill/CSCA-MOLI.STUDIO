const fs = require('fs');
const path = require('path');
const db = require('../src/config/database');

async function main() {
  const migrationPath = path.resolve(
    __dirname,
    '../../database/migrations/20260714_create_seo_blog_posts.sql',
  );
  const sql = fs.readFileSync(migrationPath, 'utf8');
  await db.query(sql);
  const { rows } = await db.query(
    "SELECT to_regclass('public.seo_blog_posts') AS table_name",
  );
  if (!rows[0]?.table_name) throw new Error('seo_blog_posts was not created');
  console.log('SEO_MIGRATION_OK');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
