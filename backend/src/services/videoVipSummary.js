const {normalizeTier}=require('../utils/vipEntitlements');

// Capture profile-only legacy access as a separate source before a new combo.
// This lets later source-scoped revocation retain the pre-existing membership.
async function preserveLegacyVip(client,user) {
  if(!(user.is_vip || ['vip','premium'].includes(user.subscription_tier)) || (user.vip_expires_at && new Date(user.vip_expires_at)<=new Date()))return;
  const active=(await client.query('SELECT id FROM user_vip_entitlements WHERE user_id=$1 AND is_active=TRUE AND (expires_at IS NULL OR expires_at>NOW()) LIMIT 1',[user.id])).rows;
  if(!active.length)await client.query(`INSERT INTO user_vip_entitlements(user_id,package_id,tier,allowed_subjects,starts_at,expires_at,source)
    VALUES ($1,$2,$3,$4,NOW(),$5,'manual')`,[user.id,user.vip_package_id,normalizeTier(user.subscription_tier)==='premium'?'premium':'vip',user.vip_allowed_subjects?.length?user.vip_allowed_subjects:['*'],user.vip_expires_at]);
}
async function recalculateVideoVip(client,userId,recalculateVip) {
  await recalculateVip(userId,client);
  await client.query(`UPDATE users SET vip_expires_at=NULL WHERE id=$1 AND EXISTS
    (SELECT 1 FROM user_vip_entitlements WHERE user_id=$1 AND is_active=TRUE AND expires_at IS NULL)`,[userId]);
}
module.exports={preserveLegacyVip,recalculateVideoVip};
