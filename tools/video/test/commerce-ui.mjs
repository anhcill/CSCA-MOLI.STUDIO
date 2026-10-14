// Run against a local Next dev server. Every API request is intercepted;
// this tests UI behavior, not live payments or production permissions.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.VIDEO_UI_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.VIDEO_UI_BASE_URL||'http://127.0.0.1:8130';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw new Error('Use a local UI server.');
const output=process.env.VIDEO_UI_OUTPUT_DIR||path.join(process.env.TEMP||'/tmp','video-commerce-day3-ui');
await fs.mkdir(output,{recursive:true});
const user={id:7,email:'test@example.invalid',full_name:'Học viên thử nghiệm',role:'admin',permissions:['users.manage','admin.dashboard.view'],coins:500};
const token=`test.${Buffer.from(JSON.stringify({exp:4102444800,userId:7})).toString('base64url')}.test`;
const video={id:1,type:'video',name:'Video Toán CSCA',description:'Từ nền tảng đến luyện tập, học theo từng bài và nhịp riêng của bạn.',features:['Lộ trình theo từng chương','Theo dõi tiến độ học'],status:'active',priceVnd:100000,originalPriceVnd:120000,sortOrder:0,durationMode:'days',durationDays:90,allowedSubjects:['MATH'],requiresSubjectChoice:true,courseIds:[1]};
const product={...video,renewalMode:'new_period',subjectPrices:{},video,vip:null,configurationIssues:[],canPurchase:true,courses:[{id:1,title:'Toán CSCA nền tảng',slug:'toan-csca',subject_code:'MATH'}]};
const combo={...product,id:2,type:'combo',name:'Combo Toán CSCA',vip:{id:1,name:'Gói Toán'},vipDurationDays:90};
const snapshot={version:1,type:'video',productId:1,name:video.name,originalAmount:100000,renewalMode:'new_period',video:{packageId:1,name:video.name,subjects:['MATH'],courseIds:[1],durationMode:'days',durationDays:90},vip:null,couponCode:null,couponId:null,couponDiscountAmount:0,coinsUsed:0,coinDiscountAmount:0,amount:100000,quoteHash:'a'.repeat(64)};
const order={orderId:'VIDEO_UI_TEST',type:'video',productId:1,status:'pending',amount:100000,snapshot,expiresAt:new Date(Date.now()+300000).toISOString(),payment:{orderCode:1,status:'PENDING',amount:100000,qrCode:null,checkoutUrl:'https://pay.payos.vn/web/0123456789abcdef0123456789abcdef'},rights:null,fulfillmentError:null};
const right={id:1,userId:7,email:user.email,userName:user.full_name,type:'video',name:video.name,source:'payment',status:'active',startsAt:new Date().toISOString(),expiresAt:'2027-01-01T00:00:00Z',subjects:['MATH'],courseIds:[1],vipExpiresAt:null,vipActive:null,reason:null,transactionId:1};
const coupon={id:1,code:'VIDEO20',description:'Ưu đãi học video',discount_type:'percentage',discount_value:20,min_order_amount:0,max_uses:20,user_limit:1,used_count:0,valid_from:null,valid_until:null,is_active:true,videoOnly:true,scopes:[{type:'video',productIds:[]}]};
const pageData=items=>({items,page:1,limit:20,hasMore:false});
const browser=await chromium.launch({headless:true,...(process.env.VIDEO_UI_BROWSER_PATH?{executablePath:process.env.VIDEO_UI_BROWSER_PATH}:{})});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(({user,token})=>{
  localStorage.setItem('auth-storage',JSON.stringify({state:{user,token,refreshToken:'test-refresh',isAuthenticated:true},version:0}));
  sessionStorage.setItem('token',token);sessionStorage.setItem('refreshToken','test-refresh');
  localStorage.setItem('admin_daily_letter_date',new Date().toDateString());
  localStorage.setItem('moli:online-class-announcement:hidden-version','online-classes-2026-09');
  for(const id of [user.id,'guest'])localStorage.setItem(`moly:exam-countdown-notice:v2:${id}:last-shown-at`,String(Date.now()));
},{user,token});
const writes=[],errors=[];let simulateTimeout=true;
await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url()),p=url.pathname;
  if(p.includes('/api/')){
    const payload=async data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data})});
    if(request.method()!=='GET')writes.push({path:p,body:request.postDataJSON()});
    if(p.endsWith('/auth/me')||p.endsWith('/auth/profile'))return payload({user});
    if(p.includes('/video-commerce/shop/catalog/'))return payload(pageData(p.endsWith('/combo')?[combo]:[product]));
    if(p.includes('/video-commerce/shop/products/'))return payload(product);
    if(p.includes('/video-commerce/shop/promotion/'))return payload({title:'Học theo nhịp của bạn',content:'Chọn gói và xem ưu đãi trước khi thanh toán.',coupon_code:'VIDEO20'});
    if(p.endsWith('/video-commerce/payments/quote'))return payload({...snapshot,salesEnabled:true});
    if(p.endsWith('/video-commerce/payments/orders')&&request.method()==='POST'){
      if(simulateTimeout){simulateTimeout=false;return route.abort('failed');}return payload(order);
    }
    if(p.endsWith('/video-commerce/payments/orders'))return payload(pageData([order]));
    if(p.endsWith('/qr'))return payload({dataUrl:null});
    if(p.includes('/video-commerce/payments/orders/'))return payload(order);
    if(p.endsWith('/video-commerce/me/rights')||p.endsWith('/video-commerce/manage/rights'))return payload(pageData([right]));
    if(p.includes('/video-commerce/manage/products/'))return payload(request.method()==='GET'?pageData(p.endsWith('/combo')?[combo]:[product]):product);
    if(p.endsWith('/video-commerce/manage/stats'))return payload([{type:'video',orders:1,completed:1,revenue:100000,review:0}]);
    if(p.endsWith('/video-commerce/manage/orders'))return payload(pageData([{...order,name:video.name,email:user.email,createdAt:new Date().toISOString()}]));
    if(p.endsWith('/video-commerce/manage/events'))return payload(pageData([{id:1,actor:user.email,action:'manual_grant',entity_type:'entitlement',entity_id:1,details:{reason:'Thử nghiệm'},created_at:new Date().toISOString()}]));
    if(p.endsWith('/video-commerce/manage/coupons'))return payload(request.method()==='GET'?pageData([coupon]):{id:2});
    if(p.includes('/video-commerce/manage/promotions/'))return payload(null);
    if(p.includes('/video-commerce/manage/lookup/'))return payload(pageData([{id:1,name:p.endsWith('/users')?'Học viên mẫu':'Toán CSCA nền tảng',email:p.endsWith('/users')?'student@example.invalid':undefined,subject_code:p.endsWith('/courses')?'MATH':undefined,status:p.endsWith('/courses')?'published':undefined}]));
    if(p.endsWith('/video-commerce/manage/grants'))return payload({id:2});
    if(p.endsWith('/revoke'))return payload({id:1,status:'revoked'});
    return payload({items:[],unreadCount:0});
  }
  if(url.origin!==new URL(base).origin)return route.abort();
  return route.continue();
});
const page=await context.newPage();
page.on('pageerror',e=>errors.push(e.message));
page.setDefaultTimeout(30000);
async function goto(url){await page.goto(base+url,{waitUntil:'domcontentloaded',timeout:120000});}
async function screenshot(name){await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(400);await page.screenshot({path:path.join(output,name+'.png'),fullPage:true});}
async function noOverflow(){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1),false,'Horizontal page overflow');}
try{
  await goto('/goi-video');await page.getByRole('heading',{name:video.name,exact:true}).waitFor();await noOverflow();await screenshot('catalog-desktop');
  await page.getByRole('button',{name:'Combo gói + video',exact:true}).click();await page.getByRole('heading',{name:combo.name,exact:true}).waitFor();
  await page.setViewportSize({width:390,height:844});await noOverflow();await screenshot('catalog-mobile');
  await goto('/thanh-toan-khoa-hoc?type=video&productId=1');await page.getByLabel('Môn muốn học').selectOption('MATH');
  await page.getByRole('button',{name:'Kiểm tra giá & ưu đãi'}).click();await page.getByRole('button',{name:'Xác nhận & tạo thanh toán'}).click();
  await page.getByRole('button',{name:'Thử lại yêu cầu thanh toán'}).waitFor();await page.reload();
  await page.getByRole('button',{name:'Thử lại yêu cầu thanh toán'}).click();await page.getByRole('link',{name:'Mở cổng thanh toán ↗'}).waitFor();
  const creates=writes.filter(w=>w.path.endsWith('/payments/orders'));assert.equal(creates.length,2);assert.deepEqual(creates[0].body,creates[1].body);
  await noOverflow();await screenshot('checkout-mobile');
  await page.setViewportSize({width:1440,height:1000});await screenshot('checkout-desktop');
  await goto('/tai-khoan/goi-video');await page.getByRole('heading',{name:video.name,exact:true}).waitFor();await noOverflow();
  await page.getByRole('button',{name:'Lịch sử thanh toán'}).click();await page.getByRole('link',{name:'Xem đơn hàng'}).waitFor();
  await goto('/admin/video-commerce');await page.getByRole('button',{name:'Sửa / bật tắt bán'}).waitFor();await screenshot('admin-desktop');
  await page.getByRole('button',{name:'+ Tạo gói video'}).click();await page.getByLabel('Tên gói',{exact:true}).fill('Gói nháp thử nghiệm');await page.getByRole('button',{name:'Lưu gói',exact:true}).click();
  await page.getByText('Đã lưu thành công.',{exact:true}).waitFor();
  const draft=writes.find(w=>w.path.endsWith('/manage/products/video'));assert.equal(draft.body.priceVnd,null);assert.equal(draft.body.durationMode,'unconfigured');assert.equal(draft.body.status,'draft');
  await page.getByRole('button',{name:'Học viên & quyền',exact:true}).click();await page.getByRole('button',{name:'+ Cấp quyền thủ công'}).click();
  await page.getByRole('group',{name:'Học viên',exact:true}).getByRole('radio',{name:/Học viên mẫu/}).check();await page.getByRole('radio',{name:video.name,exact:true}).check();
  await page.getByLabel('Môn (chỉ chọn nếu gói yêu cầu)').selectOption('MATH');await page.getByLabel('Hết hạn video',{exact:true}).fill('2027-01-01T12:00');await page.getByLabel('Lý do cấp',{exact:true}).fill('Cấp theo hỗ trợ học viên');
  await page.getByLabel('Tôi đã kiểm tra học viên, gói và thời hạn của từng phần.').check();await page.getByRole('button',{name:'Xác nhận cấp quyền',exact:true}).click();await page.getByText('Đã lưu thành công.',{exact:true}).waitFor();
  assert.equal(writes.filter(w=>w.path.endsWith('/manage/grants')).length,1);
  await page.getByRole('button',{name:'Thu hồi nguồn quyền này'}).click();await page.getByLabel('Lý do',{exact:true}).fill('Thử thu hồi theo nguồn');await page.getByRole('button',{name:'Xác nhận thu hồi'}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Voucher',exact:true}).click();await page.getByRole('button',{name:'+ Tạo voucher video/combo'}).click();
  await page.getByLabel('Mã',{exact:true}).fill('NEWVIDEO');await page.getByLabel('Mức giảm',{exact:true}).fill('20');await page.getByLabel('Gói video',{exact:true}).check();await page.getByRole('button',{name:'Lưu voucher'}).click();
  await page.getByText('Đã lưu thành công.',{exact:true}).waitFor();assert.equal(writes.find(w=>w.path.endsWith('/manage/coupons')).body.scopes[0].type,'video');
  await page.setViewportSize({width:360,height:800});await noOverflow();await screenshot('admin-mobile');
  await page.getByRole('button',{name:'Banner',exact:true}).click();await page.getByLabel('Tiêu đề',{exact:true}).waitFor();await noOverflow();
  assert.deepEqual(errors,[],'Browser runtime errors');
  console.log(JSON.stringify({passed:true,checks:['catalog video/combo','desktop and 390/360px overflow','checkout timeout and reload keep same request','owned rights and history','admin draft without price/duration','manual grant','source revoke','video voucher','banner form'],screenshots:output},null,2));
}catch(error){await screenshot('failure');throw error;}finally{await browser.close();}
