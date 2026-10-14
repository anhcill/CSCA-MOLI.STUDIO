const express = require('express');
const { sendData, sendCourseError } = require('../utils/courseResponses');

function createVideoCommerceRoutes({ service, authenticate, authorizePermission }) {
  const router = express.Router();
  const handle = (work, status = 200) => async (req, res) => {
    try { return sendData(res, await work(req), { status }); }
    catch (error) { return sendCourseError(res, error); }
  };
  router.get('/catalog/:type', handle(req => service.list(req.params.type, req.query)));
  router.use('/admin', authenticate, authorizePermission('users.manage'));
  router.get('/admin/:type', handle(req => service.list(req.params.type, req.query, { admin: true })));
  router.post('/admin/:type', handle(req => service.saveDraft(req.params.type, req.body, req.user.id), 201));
  router.patch('/admin/:type/:id', handle(req => service.saveDraft(req.params.type, req.body, req.user.id, req.params.id)));
  return router;
}

module.exports = { createVideoCommerceRoutes };
