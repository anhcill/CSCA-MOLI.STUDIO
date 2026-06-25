const { SOURCE_REVIEW_STATUSES } = require("./types");

function isSourceReviewStatus(status) {
  return SOURCE_REVIEW_STATUSES.includes(String(status || ""));
}

function getSourceAnswerFixSkipReason(fix, review) {
  const status = review?.status || fix?.reviewStatus;
  if (!isSourceReviewStatus(status)) return "";
  if (status === "missing_from_db") {
    return "File gốc báo có khả năng thiếu câu trong DB; không tự thêm/sửa đáp án ở bước này.";
  }
  if (status === "needs_source_review") {
    return "Cần xem file gốc thủ công trước khi sửa đáp án.";
  }
  const confidence = Math.max(Number(fix?.confidence) || 0, Number(review?.confidence) || 0);
  if (confidence < 0.75) {
    return "Độ tin cậy đối chiếu file gốc dưới 75%, không tự sửa đáp án.";
  }
  if (!fix?.correctAnswer && !review?.suggestedCorrectAnswer) {
    return "File gốc chưa cho đáp án rõ, không tự sửa đáp án.";
  }
  return "";
}

module.exports = {
  isSourceReviewStatus,
  getSourceAnswerFixSkipReason,
};
