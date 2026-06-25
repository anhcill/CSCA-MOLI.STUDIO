function getExplanationSourceNote(sourceFile) {
  if (!sourceFile?.textContent) return "";
  return `Có file gốc ${sourceFile.fileName || ""}; chỉ dùng để đối chiếu, không chép lời giải nếu file gốc không có dữ kiện rõ.`;
}

module.exports = {
  getExplanationSourceNote,
};
