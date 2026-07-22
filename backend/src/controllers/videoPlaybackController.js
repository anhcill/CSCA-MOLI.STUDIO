const videoPlaybackSessionService = require("../services/videoPlaybackSessionService");
const { sendData, sendCourseError } = require("../utils/courseResponses");

async function createPlaybackSession(req, res) {
  try {
    return sendData(
      res,
      await videoPlaybackSessionService.createLessonPlaybackSession(req.params.lessonId, req.user),
    );
  } catch (error) {
    return sendCourseError(res, error);
  }
}

module.exports = { createPlaybackSession };
