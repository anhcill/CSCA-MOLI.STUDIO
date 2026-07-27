const { createCourseMediaService } = require("../services/courseMediaService");
const { sendCourseError, sendData } = require("../utils/courseResponses");

async function createUpload(req, res) {
  try {
    const service = createCourseMediaService();
    return sendData(res, await service.requestDirectUpload(req.body || {}, req.user), { status: 201 });
  } catch (error) {
    return sendCourseError(res, error);
  }
}

async function completeUpload(req, res) {
  try {
    const service = createCourseMediaService();
    return sendData(res, await service.completeDirectUpload(req.params.sessionId, req.user));
  } catch (error) {
    return sendCourseError(res, error);
  }
}

async function finalizeHls(req, res) {
  try {
    const service = createCourseMediaService();
    return sendData(
      res,
      await service.finalizeHlsAsset(req.params.assetId, req.body || {}, req.user),
    );
  } catch (error) {
    return sendCourseError(res, error);
  }
}

async function deleteAsset(req, res) {
  try {
    const service = createCourseMediaService();
    return sendData(res, await service.deleteVideoAsset(req.params.assetId, req.user));
  } catch (error) {
    return sendCourseError(res, error);
  }
}

module.exports = { completeUpload, createUpload, deleteAsset, finalizeHls };
