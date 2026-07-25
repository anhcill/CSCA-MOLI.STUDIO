function requireCoursePreviewAdmin(req, res, next) {
  if (req.user?.role === 'admin') return next();

  return res.status(423).json({
    success: false,
    code: 'COURSES_COMING_SOON',
    message: 'Khóa học đang được chuẩn bị và sẽ ra mắt trong tháng 8.',
  });
}

module.exports = { requireCoursePreviewAdmin };
