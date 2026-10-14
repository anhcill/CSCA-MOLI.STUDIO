const fs=require('fs');
const path=require('path');
const {Client}=require('pg');

const MIGRATION_FILE=path.join(__dirname,'../../database/migrations/068_video_commerce_payments.sql');
const TABLES=['video_coupon_scopes','video_commerce_orders','video_payment_outbox','video_payment_config_audit'];
async function applyMigration(client){
  for(const table of ['video_packages','combo_packages','user_video_entitlements','coupons','coupon_usages','coin_ledger','transactions','user_vip_entitlements']){
    if(!(await client.query('SELECT to_regclass($1) AS relation',[table])).rows[0].relation)throw new Error(`Missing prerequisite: ${table}`);
  }
  await client.query('BEGIN');
  try{await client.query(fs.readFileSync(MIGRATION_FILE,'utf8'));await client.query('COMMIT');}
  catch(error){await client.query('ROLLBACK');throw error;}
}
async function main(){
  if(!['--check','--apply'].includes(process.argv[2]) || process.argv.length!==3)throw new Error('Expected --check or --apply');
  if(!process.env.VIDEO_COMMERCE_DATABASE_URL)throw new Error('Explicit VIDEO_COMMERCE_DATABASE_URL required');
  const client=new Client({connectionString:process.env.VIDEO_COMMERCE_DATABASE_URL,connectionTimeoutMillis:10000});
  try{
    await client.connect();
    if(process.argv[2]==='--apply')await applyMigration(client);
    const result=await client.query('SELECT table_name FROM information_schema.tables WHERE table_schema=current_schema() AND table_name=ANY($1::text[])',[TABLES]);
    const missing=TABLES.filter(table=>!result.rows.some(row=>row.table_name===table));
    console.log(JSON.stringify({migration:path.basename(MIGRATION_FILE),ready:!missing.length,missing},null,2));
    if(missing.length)process.exitCode=1;
  }finally{await client.end();}
}
if(require.main===module)main().catch(error=>{console.error(error.code?`Migration failed (${error.code}).`:'Check arguments, prerequisites and explicit target database.');process.exitCode=1;});
module.exports={applyMigration,MIGRATION_FILE,TABLES};
