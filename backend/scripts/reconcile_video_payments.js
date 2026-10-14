// Explicit maintenance entry point; does not run at app startup or create orders.
async function main(){
  if(process.argv[2]!=='--run' || !process.env.VIDEO_COMMERCE_DATABASE_URL)throw new Error('Explicit --run and VIDEO_COMMERCE_DATABASE_URL required');
  const {Pool}=require('pg');
  const db=new Pool({connectionString:process.env.VIDEO_COMMERCE_DATABASE_URL,connectionTimeoutMillis:10000});
  const {createVideoPaymentService}=require('../src/services/videoPaymentService');
  const {createVideoPayosGateway}=require('../src/services/videoPayosGateway');
  const User=require('../src/models/User');
  const email=require('../src/services/emailService');
  const service=createVideoPaymentService({db:{pool:db,query:(...args)=>db.query(...args)},gateway:createVideoPayosGateway(),
    recalculateVip:(id,client)=>User.recalculateVipSummary(id,client),sendEmail:data=>email.sendVideoPurchaseEmail(data)});
  try{
    const payments=await service.maintenance();
    const {createVideoCommerceRepository}=require('../src/repositories/videoCommerceRepository');
    const {createVideoAdminService}=require('../src/services/videoAdminService');
    const adapter={pool:db,query:(...args)=>db.query(...args)};
    const admin=createVideoAdminService({db:adapter,repository:createVideoCommerceRepository(adapter),payments:service,
      recalculateVip:(id,client)=>User.recalculateVipSummary(id,client),sendRightsEmail:data=>email.sendVideoRightsEmail(data)});
    const rightsEmails=await admin.retryRightsEmails();
    console.log(JSON.stringify({payments,rightsEmails},null,2));
  }finally{await db.end();}
}
main().catch(error=>{console.error(error.code||'VIDEO_MAINTENANCE_FAILED');process.exitCode=1;});
