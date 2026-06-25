const { attachSourceToReviewContext, loadExamSourceReviewContext } = require("./examReviewLoader");

async function buildStoredExamReviewContext(client, examId, context = {}) {
  const sourceFile = await loadExamSourceReviewContext(client, examId);
  return {
    reviewContext: attachSourceToReviewContext(context, sourceFile),
    sourceFile,
  };
}

module.exports = {
  buildStoredExamReviewContext,
};
