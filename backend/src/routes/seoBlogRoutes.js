const router=require('express').Router();
const c=require('../controllers/seoBlogController');
router.get('/',c.publicList); router.get('/:slug',c.publicGet);
module.exports=router;
