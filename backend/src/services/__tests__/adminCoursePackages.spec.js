jest.mock("../../repositories/adminCourseRepository", () => ({
  transaction: jest.fn(),
  findById: jest.fn(),
  findPreviewAsset: jest.fn(),
  createCourse: jest.fn(),
  updateCourse: jest.fn(),
  replacePackageAccess: jest.fn(),
}));

const repository = require("../../repositories/adminCourseRepository");
const service = require("../adminCourseService");

const baseRow = {
  id: 11,
  external_key: "course_1",
  slug: "toan-csca",
  title: "Toan CSCA",
  subject_code: "MATH",
  level: "basic",
  access_type: "package",
  required_tier: "basic",
  package_ids: [2, 4],
  price_vnd: 0,
  status: "draft",
};

describe("admin course package mappings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repository.transaction.mockImplementation((work) => work({ query: jest.fn() }));
    repository.findById.mockResolvedValue(baseRow);
    repository.createCourse.mockResolvedValue(baseRow);
    repository.updateCourse.mockResolvedValue(baseRow);
    repository.replacePackageAccess.mockResolvedValue(undefined);
  });

  test("package access requires at least one package", async () => {
    await expect(service.createCourse({
      slug: "toan-csca",
      title: "Toan CSCA",
      subjectCode: "MATH",
      accessType: "package",
      packageIds: [],
    })).rejects.toMatchObject({
      status: 422,
      code: "ADMIN_COURSE_PACKAGE_REQUIRED",
    });
  });

  test("create writes package mappings in the same transaction", async () => {
    const result = await service.createCourse({
      slug: "toan-csca",
      title: "Toan CSCA",
      subjectCode: "MATH",
      accessType: "package",
      packageIds: [4, 2, 4],
    });

    expect(repository.replacePackageAccess).toHaveBeenCalledWith(
      baseRow.id,
      [4, 2],
      expect.anything(),
    );
    expect(result.packageIds).toEqual([2, 4]);
  });

  test("packageIds-only updates are persisted atomically", async () => {
    await service.updateCourse(baseRow.id, { packageIds: [3] });

    expect(repository.replacePackageAccess).toHaveBeenCalledWith(
      baseRow.id,
      [3],
      expect.anything(),
    );
  });
});
