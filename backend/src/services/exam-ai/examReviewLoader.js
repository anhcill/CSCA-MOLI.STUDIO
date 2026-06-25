const { getLatestExamSourceForReview } = require("./examSourceService");

async function loadExamSourceReviewContext(client, examId) {
  return getLatestExamSourceForReview(client, examId);
}

function attachSourceToReviewContext(context = {}, sourceFile) {
  if (!sourceFile?.textContent) return context;
  return {
    ...context,
    sourceFile,
  };
}

module.exports = {
  loadExamSourceReviewContext,
  attachSourceToReviewContext,
};
