const { body, validationResult } = require("express-validator");

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }

  next();
};

/**
 * Validate registration input
 */
const validateRegister = [
  body("username")
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage("Username must be between 3 and 50 characters")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username can only contain letters, numbers, and underscores"),

  body("email")
    .trim()
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(),

  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),

  body("full_name")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Full name must be between 1 and 100 characters"),

  handleValidationErrors,
];

/**
 * Validate login input
 */
const validateLogin = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email hoặc tên đăng nhập không được để trống"),

  body("password").notEmpty().withMessage("Mật khẩu không được để trống"),

  handleValidationErrors,
];

/**
 * Validate update profile input
 */
const validateUpdateProfile = [
  body("full_name")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Full name must be between 1 and 100 characters"),

  body("bio")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Bio must not exceed 500 characters"),

  body("phone")
    .optional()
    .trim()
    .matches(/^[0-9+\-\s()]+$/)
    .withMessage("Invalid phone number format"),

  body("study_goal")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Study goal must not exceed 500 characters"),

  body("target_score")
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage("Target score must be between 0 and 100"),

  handleValidationErrors,
];

/**
 * Validate post creation
 */
const validatePost = [
  body("title")
    .trim()
    .isLength({ min: 5, max: 255 })
    .withMessage("Title must be between 5 and 255 characters"),

  body("content")
    .trim()
    .isLength({ min: 10 })
    .withMessage("Content must be at least 10 characters long"),

  body("category")
    .isIn(["Toán", "Vật Lí", "Hóa Học", "Tiếng Trung", "Thắc mắc", "Thông báo"])
    .withMessage("Invalid category"),

  body("tags").optional().isArray().withMessage("Tags must be an array"),

  handleValidationErrors,
];

/**
 * Validate comment creation
 */
const validateComment = [
  body("content")
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage("Comment must be between 1 and 1000 characters"),

  handleValidationErrors,
];

/**
 * Validate exam submission
 */
const validateExamSubmission = [
  body("answers")
    .isArray({ min: 1 })
    .withMessage("Answers must be a non-empty array"),

  body("answers.*.question_id").isInt().withMessage("Invalid question ID"),

  body("answers.*.user_answer").notEmpty().withMessage("Answer is required"),

  body("time_taken")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Time taken must be a positive number"),

  handleValidationErrors,
];

module.exports = {
  validateRegister,
  validateLogin,
  validateUpdateProfile,
  validatePost,
  validateComment,
  validateExamSubmission,
  handleValidationErrors,
};
