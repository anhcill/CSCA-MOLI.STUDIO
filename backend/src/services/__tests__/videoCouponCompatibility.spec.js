jest.mock('../../config/database',()=>({query:jest.fn()}));
const db=require('../../config/database');
const controller=require('../../controllers/couponController');
beforeEach(()=>jest.clearAllMocks());
test.each(['VIP Math','Premium'])('video-only voucher cannot validate or apply to legacy %s',async name=>{
  db.query.mockImplementation(async sql=>({rows:sql.includes('FROM coupons')?[{id:9,code:'VIDEO20',is_active:true,discount_type:'percentage',discount_value:20,
    applicable_tiers:['video_only'],applicable_packages:null,max_uses:null,user_limit:1,used_count:0}]:sql.includes('FROM vip_packages')?[{id:1,name,price:100000}]:[]}));
  for(const method of ['validate','apply']){
    const res={status:jest.fn().mockReturnThis(),json:jest.fn()};
    await controller[method]({query:{code:'VIDEO20',package_id:'1'},body:{code:'VIDEO20',package_id:1},user:{id:7}},res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({success:false}));
  }
  expect(db.query.mock.calls.some(([sql])=>/INSERT|UPDATE/.test(sql))).toBe(false);
});
