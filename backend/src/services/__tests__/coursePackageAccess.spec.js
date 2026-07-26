jest.mock("../../repositories/courseRepository", () => ({
  findPublishedById: jest.fn(),
  findEnrollment: jest.fn(),
  findActivePackageEntitlement: jest.fn(),
  createEnrollment: jest.fn(),
  getCourseProgress: jest.fn(),
}));

const repository = require("../../repositories/courseRepository");
const service = require("../courseService");

const course = {
  id: 12,
  slug: "toan-csca",
  access_type: "package",
  subject_code: "MATH",
};
const user = { id: 7, role: "user" };
const activeEnrollment = {
  id: 30,
  user_id: user.id,
  course_id: course.id,
  source: "package",
  status: "active",
  starts_at: "2026-01-01T00:00:00.000Z",
  expires_at: "2099-01-01T00:00:00.000Z",
};

describe("course package entitlement enforcement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repository.findPublishedById.mockResolvedValue(course);
    repository.getCourseProgress.mockResolvedValue({
      required_lessons: 0,
      completed_lessons: 0,
    });
  });

  test("an old active enrollment does not bypass a missing/expired entitlement", async () => {
    repository.findEnrollment.mockResolvedValue(activeEnrollment);
    repository.findActivePackageEntitlement.mockResolvedValue(null);

    await expect(service.enroll(course.id, user)).rejects.toMatchObject({
      status: 403,
      code: "PACKAGE_REQUIRED",
    });
    expect(repository.createEnrollment).not.toHaveBeenCalled();
  });

  test("package enrollment uses the matching entitlement expiry", async () => {
    const entitlement = {
      id: 90,
      package_id: 3,
      expires_at: "2027-05-01T00:00:00.000Z",
    };
    repository.findEnrollment.mockResolvedValue(null);
    repository.findActivePackageEntitlement.mockResolvedValue(entitlement);
    repository.createEnrollment.mockImplementation(async ({ userId, courseId, source, expiresAt }) => ({
      ...activeEnrollment,
      user_id: userId,
      course_id: courseId,
      source,
      expires_at: expiresAt,
    }));

    await service.enroll(course.id, user);

    expect(repository.createEnrollment).toHaveBeenCalledWith({
      userId: user.id,
      courseId: course.id,
      source: "package",
      expiresAt: entitlement.expires_at,
    });
  });

  test("learning access rechecks package entitlement after enrollment", async () => {
    repository.findEnrollment.mockResolvedValue(activeEnrollment);
    repository.findActivePackageEntitlement.mockResolvedValue(null);

    await expect(service.requireLearningAccess(course.id, user)).rejects.toMatchObject({
      status: 403,
      code: "ENTITLEMENT_EXPIRED",
    });
  });

  test("package access is never inferred from legacy VIP profile fields", () => {
    expect(service.hasEntitlement({
      ...user,
      is_vip: true,
      subscription_tier: "premium",
      vip_allowed_subjects: ["*"],
      vip_expires_at: "2099-01-01T00:00:00.000Z",
    }, course, activeEnrollment, null)).toBe(false);
  });
});
