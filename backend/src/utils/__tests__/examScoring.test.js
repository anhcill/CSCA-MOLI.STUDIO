const { scorePercentage, scaleTenPointScore } = require("../examScoring");

describe("exam scoring math", () => {
  test("normalizes weighted points against the actual maximum", () => {
    expect(scorePercentage(7.5, 10)).toBe(75);
    expect(scorePercentage(30, 40)).toBe(75);
  });

  test("handles invalid and zero maximum scores safely", () => {
    expect(scorePercentage(10, 0)).toBe(0);
    expect(scorePercentage("bad", 10)).toBe(0);
  });

  test("clamps percentages to the public 0-100 range", () => {
    expect(scorePercentage(-1, 10)).toBe(0);
    expect(scorePercentage(12, 10)).toBe(100);
  });

  test("scales an AI ten-point grade to question points", () => {
    expect(scaleTenPointScore(8, 2.5)).toBe(2);
    expect(scaleTenPointScore(15, 3)).toBe(3);
    expect(scaleTenPointScore(-2, 3)).toBe(0);
  });
});
