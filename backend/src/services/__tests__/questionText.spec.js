const { removeTrailingEmptyAnswerMarker } = require("../../utils/questionText");

describe("removeTrailingEmptyAnswerMarker", () => {
  test.each([
    ["Chọn đáp án đúng ()", "Chọn đáp án đúng"],
    ["正确的一项是:()", "正确的一项是:"],
    ["正确的一项是（ ）", "正确的一项是"],
    ["正确的一项是（）。", "正确的一项是。"],
    ["Câu hỏi?  (   )  ", "Câu hỏi?"],
  ])("removes a trailing empty answer marker from %p", (input, expected) => {
    expect(removeTrailingEmptyAnswerMarker(input)).toBe(expected);
  });

  test.each([
    "Evaluate f()",
    "P()",
    "Khoảng (x, y)",
    String.raw`Giá trị của \(x\)`,
    "()",
    null,
  ])("preserves non-placeholder content %p", (input) => {
    expect(removeTrailingEmptyAnswerMarker(input)).toBe(input);
  });
});
