jest.mock("../../repositories/courseAssignmentRepository", () => ({
  findLesson: jest.fn(),
  listResources: jest.fn(),
  findAssignmentByLesson: jest.fn(),
  listAssignmentAttachments: jest.fn(),
  listSubmissions: jest.fn(),
  findUserSubmission: jest.fn(),
  upsertAssignment: jest.fn(),
  replaceSubmission: jest.fn(),
}));
jest.mock("../../repositories/learningRepository", () => ({ findPublishedLesson: jest.fn() }));
jest.mock("../courseService", () => ({
  positiveInteger: (value) => Number(value),
  requireLearningAccess: jest.fn(),
}));
jest.mock("../courseFileStorageService", () => ({
  uploadMany: jest.fn(),
  remove: jest.fn(),
}));

const repository = require("../../repositories/courseAssignmentRepository");
const learningRepository = require("../../repositories/learningRepository");
const courseService = require("../courseService");
const storage = require("../courseFileStorageService");
const service = require("../courseAssignmentService");

const assignmentRow = {
  id: 8,
  lesson_id: 4,
  title: "Bài luyện tập",
  instructions: null,
  due_at: null,
  max_score: 10,
  is_published: true,
};

describe("course lesson assignments", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repository.findLesson.mockResolvedValue({ id: 4, course_id: 2 });
    repository.listAssignmentAttachments.mockResolvedValue([]);
    repository.listSubmissions.mockResolvedValue([]);
    repository.findUserSubmission.mockResolvedValue(null);
  });

  test("teacher can create an assignment without a prompt file", async () => {
    repository.upsertAssignment.mockResolvedValue(assignmentRow);

    const result = await service.saveAssignment(2, 4, {
      title: "Bài luyện tập",
      instructions: "Làm vào vở rồi chụp ảnh.",
      maxScore: 10,
      isPublished: true,
    }, { id: 99 });

    expect(repository.upsertAssignment).toHaveBeenCalledWith(4, expect.objectContaining({
      title: "Bài luyện tập",
      isPublished: true,
      createdBy: 99,
    }));
    expect(result.attachments).toEqual([]);
  });

  test("learner can submit text without a file", async () => {
    learningRepository.findPublishedLesson.mockResolvedValue({ id: 4, course_id: 2 });
    courseService.requireLearningAccess.mockResolvedValue({});
    repository.findAssignmentByLesson.mockResolvedValue(assignmentRow);
    storage.uploadMany.mockResolvedValue([]);
    repository.replaceSubmission.mockResolvedValue({
      submission: {
        id: 15, assignment_id: 8, user_id: 7, text_content: "Lời giải",
        status: "submitted", submitted_at: new Date().toISOString(), attachments: [],
      },
      replacedFiles: [],
    });

    const result = await service.submitAssignment(4, { textContent: "Lời giải" }, [], { id: 7 });

    expect(repository.replaceSubmission).toHaveBeenCalledWith(8, 7, "Lời giải", []);
    expect(result.status).toBe("submitted");
  });

  test("empty learner submission is rejected", async () => {
    learningRepository.findPublishedLesson.mockResolvedValue({ id: 4, course_id: 2 });
    courseService.requireLearningAccess.mockResolvedValue({});
    repository.findAssignmentByLesson.mockResolvedValue(assignmentRow);

    await expect(service.submitAssignment(4, { textContent: "" }, [], { id: 7 }))
      .rejects.toMatchObject({ status: 422, code: "COURSE_SUBMISSION_EMPTY" });
  });
});
