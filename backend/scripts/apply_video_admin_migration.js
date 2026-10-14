const fs=require('fs');
const path=require('path');
const {Client}=require('pg');
const MIGRATION_FILE=path.join(__dirname,'../../database/migrations/069_video_commerce_admin.sql');
async function main(){
  if(!['--check','--apply'].includes(process.argv[2])||process.argv.length!==3)throw new Error('Expected --check or --apply');
  if(!process.env.VIDEO_COMMERCE_DATABASE_URL)throw new Error('Explicit VIDEO_COMMERCE_DATABASE_URL required');
  const client=new Client({connectionString:process.env.VIDEO_COMMERCE_DATABASE_URL,connectionTimeoutMillis:10000});
  try{
    await client.connect();
    if(process.argv[2]==='--apply'){
      await client.query('BEGIN');
      try{await client.query(fs.readFileSync(MIGRATION_FILE,'utf8'));await client.query('COMMIT');}
      catch(error){await client.query('ROLLBACK');throw error;}
    }
    const tables=['video_admin_requests','video_admin_events','video_promotions','video_rights_outbox'];
    const found=(await client.query('SELECT table_name FROM information_schema.tables WHERE table_schema=current_schema() AND table_name=ANY($1::text[])',[tables])).rows;
    const columns=(await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='user_video_entitlements' AND column_name IN ('vip_entitlement_id','snapshot')")).rows;
    const missing=tables.filter(t=>!found.some(r=>r.table_name===t));
    for(const c of ['vip_entitlement_id','snapshot'])if(!columns.some(r=>r.column_name===c))missing.push(`user_video_entitlements.${c}`);
    console.log(JSON.stringify({migration:path.basename(MIGRATION_FILE),ready:!missing.length,missing},null,2));
    if(missing.length)process.exitCode=1;
  }finally{await client.end();}
}
if(require.main===module)main().catch(error=>{console.error(error.code?`Migration failed (${error.code}).`:'Check arguments, prerequisites and explicit target database.');process.exitCode=1;});
