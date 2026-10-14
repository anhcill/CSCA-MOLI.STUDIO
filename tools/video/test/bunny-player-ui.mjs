// Local UI with mocked backend and iframe protocol; never contacts Bunny.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.VIDEO_UI_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.VIDEO_UI_BASE_URL || 'http://127.0.0.1:8130';
if (!['localhost','127.0.0.1'].includes(new URL(base).hostname)) throw Error('Local server required');
const browser = await chromium.launch({ headless:true, ...(process.env.VIDEO_UI_BROWSER_PATH ? {executablePath:process.env.VIDEO_UI_BROWSER_PATH} : {}) });
const context = await browser.newContext({viewport:{width:390,height:844}});
const user = {id:7,email:'test@example.invalid',full_name:'Video test',role:'user'};
const token = `test.${Buffer.from(JSON.stringify({exp:4102444800,userId:7})).toString('base64url')}.test`;
await context.addInitScript(({user,token})=>{
  localStorage.setItem('auth-storage',JSON.stringify({state:{user,token,isAuthenticated:true},version:0}));
  sessionStorage.setItem('token',token);
  localStorage.setItem('moli:online-class-announcement:hidden-version','online-classes-2026-09');
  for(const id of [7,'guest'])localStorage.setItem(`moly:exam-countdown-notice:v2:${id}:last-shown-at`,String(Date.now()));
},{user,token});
const progress={completionPct:0,completedLessons:0,totalLessons:1,lastPositionSeconds:12};
const lesson={id:1,title:'Bài học Bunny',lessonType:'video',durationSeconds:120,progressStatus:'not_started',resources:[],isRequired:true};
const room={course:{id:1,slug:'bunny-test',title:'Khóa học thử',subjectCode:'MATH'},enrollment:{id:1,status:'active',progress},curriculum:[{id:1,title:'Chương 1',lessons:[lesson]}],lesson};
let calls=0, deny=false; const writes=[],errors=[];
await context.route('**/*',async route=>{
  const url=new URL(route.request().url()),p=url.pathname;
  const data=value=>route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,data:value})});
  if(url.origin==='https://player.mediadelivery.net')return route.fulfill({contentType:'text/html',body:`<html><body style="background:#122c32;color:white">Bunny test player<script>
    window.commands=[]; window.emit=(event,value)=>parent.postMessage(JSON.stringify({context:'player.js',event,value}),'*');
    window.addEventListener('message',event=>{try{window.commands.push(JSON.parse(event.data))}catch{}});
    setTimeout(()=>window.emit('ready',{}),150);
  </script></body></html>`});
  if(p.includes('/api/')){
    if(p.endsWith('/auth/me')||p.endsWith('/auth/profile'))return data({user});
    if(p.endsWith('/playback-session')){
      calls++;
      if(calls===1||deny)return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({success:false,code:'ENTITLEMENT_EXPIRED'})});
      return data({sessionId:`bunny-${calls}`,viewerCode:'CSCA-7',lessonId:1,deliveryType:'bunny',embedUrl:'https://player.mediadelivery.net/embed/123/11111111-1111-4111-8111-111111111111?token=mock',manifestUrl:'',variants:[],expiresAt:new Date(Date.now()+3600000).toISOString(),resumePositionSeconds:12});
    }
    if(p.endsWith('/lessons/1/progress')) { writes.push(route.request().postDataJSON());return data({...progress,status:'in_progress'}); }
    if(p.endsWith('/lessons/1'))return data(room);
    if(p.endsWith('/courses/1/progress'))return data(progress);
    if(p.endsWith('/questions'))return data([]);
    return data({items:[],unreadCount:0});
  }
  if(url.origin!==new URL(base).origin)return route.abort();
  return route.continue();
});
const page=await context.newPage(); page.on('pageerror',e=>errors.push(e.message)); page.setDefaultTimeout(45000);
try {
  await page.goto(`${base}/hoc/bunny-test/bai-hoc/1`,{waitUntil:'domcontentloaded',timeout:120000});
  await page.getByRole('button',{name:'Thử lại',exact:true}).click();
  const iframe=page.locator('iframe[title="Video bài học"]'); await iframe.waitFor();
  let frame=await iframe.elementHandle().then(handle=>handle.contentFrame());
  await page.waitForTimeout(500);
  assert.ok(await frame.evaluate(()=>window.commands.some(x=>x.method==='setCurrentTime'&&x.value===12)),'restores saved position after initial failure');
  await frame.evaluate(()=>{window.emit('play');window.emit('timeupdate',{seconds:12,duration:120});});
  await page.waitForTimeout(1100);
  await frame.evaluate(()=>window.emit('timeupdate',{seconds:13,duration:120}));
  await page.waitForTimeout(1100);
  await frame.evaluate(()=>{window.emit('timeupdate',{seconds:14,duration:120});window.emit('pause');});
  await page.waitForTimeout(500);
  assert.ok(writes.some(x=>x.watchedDeltaSeconds>=1),'retry attaches progress tracking');
  await frame.evaluate(()=>{window.emit('play');window.emit('timeupdate',{seconds:119,duration:120});window.emit('pause');});
  await page.waitForTimeout(500);
  assert.equal(writes.at(-1).watchedDeltaSeconds,0,'seek is not watched time');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'mobile overflow');
  const watermark=page.locator('[data-video-watermark]');
  assert.match(await watermark.innerText(),/CSCA-7/,'server viewer code is visible');
  assert.equal(await iframe.getAttribute('allowfullscreen'),null,'iframe cannot fullscreen outside watermark');
  assert.match(await iframe.getAttribute('allow'),/picture-in-picture 'none'/);
  assert.deepEqual(await watermark.evaluate(el=>({left:getComputedStyle(el).left,top:getComputedStyle(el).top})),{left:'8px',top:'8px'},'watermark stays in the corner');
  assert.equal(await page.getByRole('button',{name:'Phóng to video',exact:true}).innerText(),'','fullscreen control uses an icon');
  // Simulate mobile browsers without element fullscreen; preserve the same iframe.
  await page.evaluate(()=>{document.querySelector('[data-protected-video]').requestFullscreen=undefined;});
  await page.getByRole('button',{name:'Phóng to video',exact:true}).click();
  assert.equal(await page.locator('[data-protected-video]').evaluate(el=>getComputedStyle(el).position),'fixed');
  assert.ok(await watermark.isVisible(),'watermark survives mobile expansion');
  assert.equal(await iframe.elementHandle().then(handle=>handle.contentFrame()),frame,'expansion preserves player');
  await page.getByRole('button',{name:'Thu nhỏ video',exact:true}).click();
  for (const width of [390,1440]) {
    await page.setViewportSize({width,height:844});
    await frame.evaluate(()=>{window.commands=[];window.emit('play');});
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
    await page.locator('[data-video-shield]').waitFor();
    await page.waitForFunction(()=>true);
    await frame.waitForFunction(()=>window.commands.some(x=>x.method==='pause'));
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
    assert.ok(await page.locator('[data-video-shield]').isVisible(),'returning does not auto resume');
    await page.getByRole('button',{name:'Tiếp tục xem',exact:true}).click();
    assert.equal(await page.locator('[data-video-shield]').count(),0);
  }
  await page.keyboard.press('PrintScreen');
  await page.locator('[data-video-shield]').waitFor();
  await page.getByRole('button',{name:'Tiếp tục xem',exact:true}).click();
  await page.emulateMedia({media:'print'});
  assert.equal(await page.locator('[data-protected-video]').evaluate(el=>getComputedStyle(el).visibility),'hidden');
  await page.emulateMedia({media:'screen'});
  await page.setViewportSize({width:390,height:844});
  await frame.evaluate(()=>window.emit('error'));
  await page.getByRole('button',{name:'Thử lại',exact:true}).click();
  await page.waitForTimeout(700);
  frame=await iframe.elementHandle().then(handle=>handle.contentFrame());
  assert.ok(await frame.evaluate(()=>window.commands.some(x=>x.method==='setCurrentTime'&&x.value===119)),'refresh keeps position');
  assert.equal(await frame.evaluate(()=>window.commands.some(x=>x.method==='play')),false,'paused refresh stays paused');
  await frame.evaluate(()=>{window.emit('play');window.emit('error');});
  await page.getByRole('button',{name:'Thử lại',exact:true}).click();
  await page.waitForTimeout(700);
  frame=await iframe.elementHandle().then(handle=>handle.contentFrame());
  assert.ok(await frame.evaluate(()=>window.commands.some(x=>x.method==='play')),'playing refresh resumes');
  await page.screenshot({path:path.join(process.env.TEMP||'/tmp','bunny-day4-player.png'),fullPage:true});
  deny=true; await frame.evaluate(()=>window.emit('error'));
  await page.getByRole('button',{name:'Thử lại',exact:true}).click();
  await page.getByText('Không thể gia hạn phiên phát.',{exact:false}).waitFor();
  assert.equal(errors.length,0,errors.join('\n'));
  console.log(JSON.stringify({passed:true,checks:['initial failure retry','resume','watch progress','seek exclusion','mobile overflow','corner watermark and icon fullscreen','iframe fullscreen/PiP denied','mobile expansion retains watermark/player','mobile and desktop hidden pause/shield','manual return','delivered screenshot shortcut shield','print concealment','paused refresh preserves position','playing refresh resumes','revoked refresh stops playback']},null,2));
} catch(error) {
  console.error(JSON.stringify({pageErrors:errors,body:(await page.locator('body').innerText()).slice(0,2500)}));
  await page.screenshot({path:path.join(process.env.TEMP||'/tmp','bunny-day5-failure.png'),fullPage:true});
  throw error;
} finally { await browser.close(); }
