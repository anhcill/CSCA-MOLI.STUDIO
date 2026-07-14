const router=require('express').Router();
const c=require('../controllers/seoBlogController');
const {authenticate,authorizePermission}=require('../middleware/authMiddleware');
router.use(authenticate,authorizePermission('content.manage'));
router.get('/',c.adminList); router.post('/',c.create); router.post('/generate',c.generate); router.post('/suggest-ideas',c.suggestIdeas); router.get('/image-search',c.imageSearch); router.post('/validate',c.validate);
router.get('/:id',c.adminGet); router.put('/:id',c.update); router.patch('/:id',c.update); router.delete('/:id',c.remove); router.post('/:id/schedule',c.schedule); router.post('/:id/publish',c.publish); router.post('/:id/validate',c.validate);
module.exports=router;
