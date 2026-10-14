// Real admin UI and TUS client, local mocked provider; no remote video is created.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.VIDEO_UI_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.VIDEO_UI_BASE_URL||'http://127.0.0.1:8130';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local server required');
const browser=await chromium.launch({headless:true,...(process.env.VIDEO_UI_BROWSER_PATH?{executablePath:process.env.VIDEO_UI_BROWSER_PATH}:{})});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const user={id:7,role:'admin',email:'test@example.invalid',full_name:'Video test',permissions:['*'],roles:['super_admin']};
const token=`test.${Buffer.from(JSON.stringify({exp:4102444800,userId:7})).toString('base64url')}.test`;
await context.addInitScript(({user,token})=>{
  localStorage.setItem('auth-storage',JSON.stringify({state:{user,token,isAuthenticated:true},version:0}));sessionStorage.setItem('token',token);
  localStorage.setItem('admin_daily_letter_date',new Date().toDateString());
},{user,token});
let linked=false,offset=0,fail=true,heads=0,creates=0,ready=false;
const size=8*1024*1024+256, errors=[];
const asset=()=>({videoAssetId:1,provider:'bunny',status:ready?'ready':'uploading',assetExternalKey:'test',durationSeconds:ready?120:0,providerVideoId:'11111111-1111-4111-8111-111111111111'});
const ticket=()=>({...asset(),upload:{endpoint:'https://video.bunnycdn.com/tusupload',headers:{AuthorizationSignature:'mock',AuthorizationExpire:'4102444800',LibraryId:'123',VideoId:'11111111-1111-4111-8111-111111111111'},expiresAt:'2099-01-01'}});
await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),p=url.pathname;
  const data=value=>route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,data:value})});
  if(url.origin==='https://video.bunnycdn.com'){
    const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST,PATCH,HEAD,OPTIONS','Access-Control-Allow-Headers':'*','Access-Control-Expose-Headers':'Location,Upload-Offset,Upload-Length,Tus-Resumable','Tus-Resumable':'1.0.0'};
    if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
    if(req.method()==='POST')return route.fulfill({status:201,headers:{...headers,Location:'https://video.bunnycdn.com/tusupload/test'}});
    if(req.method()==='HEAD'){heads++;return route.fulfill({status:200,headers:{...headers,'Upload-Offset':String(offset),'Upload-Length':String(size)}});}
    if(req.method()==='PATCH'){
      if(fail&&offset>0)return route.abort('failed');
      assert.equal(Number(req.headers()['upload-offset']),offset);
      offset+=req.postDataBuffer().length;
      return route.fulfill({status:204,headers:{...headers,'Upload-Offset':String(offset)}});
    }
  }
  if(p.includes('/api/')){
    if(p.endsWith('/auth/me')||p.endsWith('/auth/profile'))return data({user});
    if(p.endsWith('/admin/courses/1'))return data({id:1,title:'Bunny test',slug:'bunny-test',status:'draft',curriculum:[{id:1,title:'Chapter',lessons:[{id:1,slug:'one',title:'Lesson',lessonType:'video',videoAssetId:linked?1:null,estimatedDurationSeconds:0}]}]});
    if(p.endsWith('/admin/bunny-media/uploads')){creates++;linked=true;return data(ticket());}
    if(p.endsWith('/authorization'))return data(ticket());
    if(p.endsWith('/sync')){ready=offset===size;return data(asset());}
    if(p.includes('/admin/bunny-media/assets/'))return data(asset());
    if(p.endsWith('/lessons/1')&&req.method()==='PATCH')return data({id:1});
    return data({items:[],attachments:[],questions:[],unreadCount:0});
  }
  if(url.origin!==new URL(base).origin)return route.abort();
  return route.continue();
});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(60000);
const file={name:'test.mp4',mimeType:'video/mp4',buffer:Buffer.alloc(size,1)};
try{
  await page.goto(base+'/admin/courses/1/curriculum',{waitUntil:'domcontentloaded',timeout:180000});
  await page.getByLabel('Kho video').selectOption('bunny');
  await page.locator('input[type=file]').first().setInputFiles(file);
  await page.getByRole('button',{name:'Tải lên Bunny',exact:true}).click();
  await page.getByText('Chưa hoàn tất.',{exact:false}).waitFor();
  assert.equal(offset,8*1024*1024,'first chunk retained');
  fail=false;
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Chỉnh sửa & gắn video',exact:true}).click();
  await page.getByText('Video Bunny Stream',{exact:true}).waitFor();
  await page.locator('input[type=file]').first().setInputFiles(file);
  await page.getByRole('button',{name:'Tiếp tục tải',exact:true}).click();
  await page.getByText('Sẵn sàng · 120 giây',{exact:true}).waitFor();
  assert.equal(offset,size);assert.equal(creates,1);assert.ok(heads>0,'resume checks remote offset');
  assert.equal(errors.length,0,errors.join('\n'));
  await page.setViewportSize({width:390,height:844});
  await page.getByText('Video Bunny Stream',{exact:true}).scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'mobile overflow');
  await page.screenshot({path:path.join(process.env.TEMP||'/tmp','bunny-day4-upload.png')});
  console.log(JSON.stringify({passed:true,checks:['TUS chunk retained on network loss','reload provider recovery','same-file resume','single remote allocation','ready duration']},null,2));
}finally{await browser.close();}
