const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createBunnyMediaService } = require('../src/services/bunnyMediaService');

test('preview rejects students, teachers and wildcard-only admins before reading video', async () => {
  const service = createBunnyMediaService({ database: { query() { throw Error('Must not read'); } } });
  for (const actor of [{id:1}, {id:2,rbacRoles:['teacher']}, {id:3,permissions:['*']}]) {
    await assert.rejects(service.preview(7, actor), {code:'SUPER_ADMIN_REQUIRED'});
  }
});

test('super admin gets an expiring preview of a ready draft asset', async () => {
  const row = {id:7,course_id:2,lesson_id:3,provider:'bunny',bunny_library_id:'123',bunny_video_id:'video',status:'ready'};
  const service = createBunnyMediaService({
    database: {query:async()=>({rows:[row]})}, config:{libraryId:'123'}, authorize:async()=>{},
    adapter:{createEmbedUrl:(id,ttl)=>{assert.equal(id,'video');assert.equal(ttl,300);return {url:'https://player.mediadelivery.net/embed/123/video?token=test',expiresAt:'2099-01-01'};}},
  });
  const result=await service.preview(7,{id:5,rbacRoles:['super_admin']});
  assert.equal(result.viewerCode,'ADMIN-5');assert.equal(result.lessonId,3);
  row.status='processing';
  await assert.rejects(service.preview(7,{id:5,rbacRoles:['super_admin']}),{code:'VIDEO_NOT_READY'});
});
