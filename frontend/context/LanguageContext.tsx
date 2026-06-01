'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type AppLanguage = 'vi' | 'en' | 'zh';

type CopyValue = string | Partial<Record<AppLanguage, string>>;
type CopyMap = Record<string, CopyValue>;

const STORAGE_KEY = 'moly.study.language';

export const LANGUAGES: Array<{ code: AppLanguage; label: string; shortLabel: string; nativeName: string }> = [
  { code: 'vi', label: 'Tiếng Việt', shortLabel: 'VI', nativeName: 'Tiếng Việt' },
  { code: 'en', label: 'English', shortLabel: 'EN', nativeName: 'English' },
  { code: 'zh', label: '中文', shortLabel: '中', nativeName: '中文' },
];

const COPY: CopyMap = {
  'common.language': { vi: 'Ngôn ngữ', en: 'Language', zh: '语言' },
  'common.search': { vi: 'Tìm kiếm', en: 'Search', zh: '搜索' },
  'common.back': { vi: 'Quay lại', en: 'Back', zh: '返回' },
  'common.close': { vi: 'Đóng', en: 'Close', zh: '关闭' },
  'common.save': { vi: 'Lưu thay đổi', en: 'Save changes', zh: '保存更改' },
  'common.cancel': { vi: 'Hủy', en: 'Cancel', zh: '取消' },
  'common.refresh': { vi: 'Làm mới', en: 'Refresh', zh: '刷新' },
  'common.loading': { vi: 'Đang tải...', en: 'Loading...', zh: '正在加载...' },
  'common.points': { vi: 'điểm', en: 'points', zh: '分' },
  'common.days': { vi: 'ngày', en: 'days', zh: '天' },
  'common.minutes': { vi: 'phút', en: 'minutes', zh: '分钟' },

  'nav.home': { vi: 'Trang chủ', en: 'Home', zh: '首页' },
  'nav.courses': { vi: 'Khóa học', en: 'Courses', zh: '课程' },
  'nav.chooseSubject': { vi: 'Chọn môn học', en: 'Choose a subject', zh: '选择科目' },
  'nav.roadmap': { vi: 'Lộ trình', en: 'Roadmap', zh: '学习路径' },
  'nav.examRoom': { vi: 'Phòng thi', en: 'Exam room', zh: '考试中心' },
  'nav.games': { vi: 'Game học tập', en: 'Learning games', zh: '学习游戏' },
  'nav.docs': { vi: 'Tài liệu', en: 'Materials', zh: '资料' },
  'nav.forum': { vi: 'Diễn đàn', en: 'Forum', zh: '论坛' },
  'nav.qa': { vi: 'Hỏi đáp VIP', en: 'VIP Q&A', zh: 'VIP问答' },
  'nav.blog': { vi: 'Blog', en: 'Blog', zh: '博客' },
  'nav.ranking': { vi: 'Bảng xếp hạng', en: 'Leaderboard', zh: '排行榜' },
  'nav.more': { vi: 'Khác:', en: 'More:', zh: '更多：' },
  'nav.upgrade': { vi: 'Nâng cấp', en: 'Upgrade', zh: '升级' },
  'nav.upgradeVip': { vi: 'Nâng cấp VIP', en: 'Upgrade to VIP', zh: '升级VIP' },
  'nav.login': { vi: 'Đăng nhập', en: 'Log in', zh: '登录' },
  'nav.register': { vi: 'Đăng ký', en: 'Sign up', zh: '注册' },
  'nav.logout': { vi: 'Đăng xuất', en: 'Log out', zh: '退出登录' },
  'nav.profile': { vi: 'Hồ sơ cá nhân', en: 'Profile', zh: '个人资料' },
  'nav.admin': { vi: 'Trang quản trị', en: 'Admin panel', zh: '管理后台' },
  'nav.darkMode': { vi: 'Chế độ tối', en: 'Dark mode', zh: '深色模式' },
  'nav.mobileUpgradeTitle': { vi: 'Nâng cấp tài khoản VIP', en: 'Upgrade your VIP account', zh: '升级VIP账号' },
  'nav.mobileUpgradeDesc': { vi: 'Mở khóa đề VIP, video giải đề và hỏi giảng viên', en: 'Unlock VIP exams, solution videos and instructor Q&A', zh: '解锁VIP试卷、视频解析和教师问答' },
  'nav.viewNow': { vi: 'Xem ngay', en: 'View now', zh: '立即查看' },

  'subject.math': { vi: 'Toán', en: 'Math', zh: '数学' },
  'subject.physics': { vi: 'Vật Lý', en: 'Physics', zh: '物理' },
  'subject.chemistry': { vi: 'Hóa Học', en: 'Chemistry', zh: '化学' },
  'subject.chineseSoc': { vi: 'Tiếng Trung XH', en: 'Chinese Social', zh: '中文（文）' },
  'subject.chineseSci': { vi: 'Tiếng Trung TN', en: 'Chinese Science', zh: '中文（理）' },
  'subject.forum': { vi: 'Diễn đàn', en: 'Forum', zh: '论坛' },

  'home.hero.platform': { vi: 'Nền tảng CSCA', en: 'CSCA Platform', zh: 'CSCA 平台' },
  'home.hero.platformDesc': { vi: 'Luyện thi học bổng Trung Quốc', en: 'Scholarship exam prep for China', zh: '中国奖学金考试备考' },
  'home.hero.signup': { vi: 'Đăng ký miễn phí', en: 'Sign up free', zh: '免费注册' },
  'home.hero.subjectCount': { vi: '4 môn thi', en: '4 exam subjects', zh: '4个考试科目' },
  'home.hero.passRate': { vi: 'Tỷ lệ học viên đậu', en: 'Student pass rate', zh: '学员通过率' },
  'home.stats.students': { vi: 'Học viên', en: 'Students', zh: '学员' },
  'home.stats.exams': { vi: 'Đề thi', en: 'Exams', zh: '套试卷' },
  'home.stats.materials': { vi: 'Tài liệu', en: 'Materials', zh: '资料' },
  'home.stats.passRate': { vi: 'Tỷ lệ đậu', en: 'Pass rate', zh: '通过率' },
  'home.subjects.badge': { vi: '6 môn thi', en: '6 subjects', zh: '6个科目' },
  'home.subjects.title': { vi: 'Chọn môn học của bạn', en: 'Choose your subject', zh: '选择你的科目' },
  'home.subjects.desc': { vi: 'Nội dung chuẩn đề thi CSCA, cập nhật liên tục', en: 'CSCA-aligned content, updated continuously', zh: '贴近CSCA考试内容，持续更新' },
  'home.subjects.studyNow': { vi: 'Học ngay', en: 'Study now', zh: '开始学习' },
  'home.hot.badge': { vi: 'Nổi bật', en: 'Popular', zh: '热门' },
  'home.hot.title': { vi: 'Đề thi hot tuần này', en: 'Popular exams this week', zh: '本周热门试卷' },
  'home.hot.desc': { vi: 'Được nhiều học viên luyện tập nhất', en: 'Most practiced by students', zh: '最多学员练习' },
  'home.hot.all': { vi: 'Xem tất cả', en: 'View all', zh: '查看全部' },
  'home.hot.start': { vi: 'Làm ngay', en: 'Start now', zh: '立即练习' },
  'home.hot.attempts': { vi: 'lượt làm', en: 'attempts', zh: '次练习' },
  'home.countdown.label': { vi: 'CSCA 2026', en: 'CSCA 2026', zh: 'CSCA 2026' },
  'home.countdown.title': { vi: 'Thời gian còn lại đến ngày thi', en: 'Time left until the exam', zh: '距离考试剩余时间' },
  'home.countdown.desc': { vi: 'Đừng để thời gian trôi qua, bắt đầu ôn tập ngay hôm nay', en: 'Do not let time slip away. Start preparing today', zh: '不要让时间流逝，从今天开始备考' },
  'home.countdown.start': { vi: 'Làm ngay', en: 'Start now', zh: '立即做题' },
  'home.countdown.plan': { vi: 'Lên lịch ôn thi', en: 'Plan my study', zh: '制定复习计划' },
  'home.countdown.days': { vi: 'Ngày', en: 'Days', zh: '天' },
  'home.countdown.hours': { vi: 'Giờ', en: 'Hours', zh: '小时' },
  'home.countdown.minutes': { vi: 'Phút', en: 'Minutes', zh: '分钟' },
  'home.countdown.seconds': { vi: 'Giây', en: 'Seconds', zh: '秒' },
  'home.ai.badge': { vi: 'Powered by Gemini AI', en: 'Powered by Gemini AI', zh: '由 Gemini AI 支持' },
  'home.ai.title': { vi: 'Lộ trình học tập', en: 'Personalized', zh: '个性化' },
  'home.ai.titleAccent': { vi: 'cá nhân hóa', en: 'study roadmap', zh: '学习路径' },
  'home.ai.desc': { vi: 'AI phân tích hành vi làm bài của bạn và đưa ra kế hoạch ôn thi chính xác theo điểm yếu.', en: 'AI analyzes your exam history and builds a precise plan around your weak areas.', zh: 'AI分析你的做题记录，并根据薄弱点制定精准备考计划。' },
  'home.ai.try': { vi: 'Thử AI lộ trình', en: 'Try AI roadmap', zh: '试用AI学习路径' },
  'home.features.badge': { vi: 'Tại sao CSCA?', en: 'Why CSCA?', zh: '为什么选择CSCA？' },
  'home.features.title': { vi: 'Học thông minh, đậu chắc', en: 'Study smarter, pass stronger', zh: '智能学习，稳步通过' },
  'home.steps.badge': { vi: '3 bước đơn giản', en: '3 simple steps', zh: '简单三步' },
  'home.steps.title': { vi: 'Bắt đầu ngay hôm nay', en: 'Start today', zh: '今天开始' },
  'home.testimonials.badge': { vi: 'Học viên nói gì', en: 'Student stories', zh: '学员反馈' },
  'home.testimonials.title': { vi: 'Câu chuyện thành công', en: 'Success stories', zh: '成功故事' },
  'home.vip.badge': { vi: 'Premium Access', en: 'Premium Access', zh: '高级权限' },
  'home.vip.title': { vi: 'Nâng cấp CSCA PRO ngay hôm nay', en: 'Upgrade to CSCA PRO today', zh: '立即升级 CSCA PRO' },
  'home.vip.desc': { vi: 'Mở khóa toàn bộ đề thi, lời giải chi tiết và chữa bài tự luận bằng AI. Thành viên VIP và Pre dùng chung đề VIP, Pre có thêm video giải đề và hỏi giảng viên.', en: 'Unlock all exams, detailed solutions and AI essay grading. VIP and Pre share the same VIP exams; Pre also gets solution videos and instructor Q&A.', zh: '解锁全部试卷、详细解析和AI作文批改。VIP和Pre共用VIP试卷，Pre额外包含视频解析和教师问答。' },
  'home.vip.join': { vi: 'Trở thành viên PRO', en: 'Become PRO', zh: '成为PRO会员' },
  'home.final.title': { vi: 'Sẵn sàng chinh phục CSCA?', en: 'Ready to conquer CSCA?', zh: '准备好攻克CSCA了吗？' },
  'home.final.desc': { vi: 'Tham gia cùng hơn 10,000 học viên đang ôn thi mỗi ngày', en: 'Join 10,000+ students preparing every day', zh: '加入超过10,000名每日备考的学员' },
  'home.final.tryExam': { vi: 'Thử làm đề ngay', en: 'Try an exam now', zh: '立即试做' },
  'home.final.freeNote': { vi: 'Miễn phí hoàn toàn · Không cần thẻ tín dụng', en: 'Completely free · No credit card required', zh: '完全免费 · 无需信用卡' },

  'exam.languageHint': { vi: 'Ngôn ngữ đề', en: 'Exam language', zh: '试卷语言' },
  'exam.question': { vi: 'Câu hỏi', en: 'Question', zh: '题目' },
  'exam.sharedPassage': { vi: 'Đoạn văn đọc hiểu dùng chung', en: 'Shared reading passage', zh: '共用阅读材料' },
  'exam.sharedContent': { vi: 'Nội dung dùng chung', en: 'Shared content', zh: '共用内容' },
  'exam.submit': { vi: 'Nộp bài', en: 'Submit', zh: '交卷' },
  'exam.submitEnd': { vi: 'Nộp bài kết thúc', en: 'Submit and finish', zh: '交卷结束' },
  'exam.submitting': { vi: 'Đang nộp', en: 'Submitting', zh: '正在交卷' },
  'exam.completed': { vi: 'Hoàn thành', en: 'Completed', zh: '已完成' },
  'exam.previous': { vi: 'Câu trước đó', en: 'Previous', zh: '上一题' },
  'exam.next': { vi: 'Câu tiếp theo', en: 'Next', zh: '下一题' },
  'exam.progress': { vi: 'Tiến độ', en: 'Progress', zh: '进度' },
  'exam.questionMap': { vi: 'Biểu đồ câu hỏi', en: 'Question map', zh: '题目导航' },
  'exam.selected': { vi: 'Đã chọn', en: 'Selected', zh: '已选' },
  'exam.current': { vi: 'Hiện tại', en: 'Current', zh: '当前' },
  'exam.unanswered': { vi: 'Chưa làm', en: 'Unanswered', zh: '未答' },
  'exam.print': { vi: 'Tải / In đề thi', en: 'Download / Print exam', zh: '下载/打印试卷' },
  'exam.allUsed': { vi: 'Tất cả các lựa chọn đã được sử dụng.', en: 'All options have been used.', zh: '所有选项已使用。' },
  'exam.essayPlaceholder': { vi: 'Nhập câu trả lời tự luận vào đây...', en: 'Enter your essay answer here...', zh: '在此输入主观题答案...' },
  'exam.translationPlaceholder': { vi: 'Nhập câu dịch tiếng Trung vào đây...', en: 'Enter your Chinese translation here...', zh: '在此输入中文翻译...' },
  'exam.autoSave': { vi: 'Câu trả lời được lưu tự động khi bạn gõ', en: 'Your answer is saved automatically as you type', zh: '输入时答案会自动保存' },
  'exam.confirmTitle': { vi: 'Nộp bài thi?', en: 'Submit exam?', zh: '确认交卷？' },
  'exam.confirmDesc': { vi: 'Sau khi nộp bạn không thể sửa đáp án.', en: 'After submitting, you cannot change your answers.', zh: '交卷后无法修改答案。' },
  'exam.reviewAgain': { vi: 'Kiểm tra lại', en: 'Review again', zh: '再检查' },
  'exam.submitNow': { vi: 'Nộp ngay', en: 'Submit now', zh: '立即交卷' },
  'exam.remaining': { vi: 'Còn lại', en: 'Remaining', zh: '剩余' },

  'auth.loginTitle': { vi: 'Chào mừng trở lại!', en: 'Welcome back!', zh: '欢迎回来！' },
  'auth.loginSubtitle': { vi: 'Đăng nhập để tiếp tục học tập', en: 'Log in to keep studying', zh: '登录后继续学习' },
  'auth.registerTitle': { vi: 'Tạo tài khoản mới', en: 'Create a new account', zh: '创建新账号' },
  'auth.registerSubtitle': { vi: 'Bắt đầu hành trình học tập của bạn', en: 'Start your learning journey', zh: '开启你的学习之旅' },
  'auth.emailLogin': { vi: 'Hoặc đăng nhập bằng email', en: 'Or log in with email', zh: '或使用邮箱登录' },
  'auth.emailRegister': { vi: 'Hoặc đăng ký bằng email', en: 'Or sign up with email', zh: '或使用邮箱注册' },
  'auth.facebookLogin': { vi: 'Đăng nhập với Facebook', en: 'Log in with Facebook', zh: '使用 Facebook 登录' },
  'auth.facebookRegister': { vi: 'Đăng ký với Facebook', en: 'Sign up with Facebook', zh: '使用 Facebook 注册' },
  'auth.email': { vi: 'Email', en: 'Email', zh: '邮箱' },
  'auth.password': { vi: 'Mật khẩu', en: 'Password', zh: '密码' },
  'auth.confirmPassword': { vi: 'Xác nhận mật khẩu', en: 'Confirm password', zh: '确认密码' },
  'auth.username': { vi: 'Tên đăng nhập', en: 'Username', zh: '用户名' },
  'auth.fullName': { vi: 'Họ và tên', en: 'Full name', zh: '姓名' },
  'auth.optional': { vi: 'Tùy chọn', en: 'Optional', zh: '可选' },
  'auth.fullNamePlaceholder': { vi: 'Nguyễn Văn A', en: 'Your full name', zh: '张三' },
  'auth.remember': { vi: 'Ghi nhớ đăng nhập', en: 'Remember me', zh: '记住登录状态' },
  'auth.forgot': { vi: 'Quên mật khẩu?', en: 'Forgot password?', zh: '忘记密码？' },
  'auth.login': { vi: 'Đăng nhập', en: 'Log in', zh: '登录' },
  'auth.loggingIn': { vi: 'Đang đăng nhập...', en: 'Logging in...', zh: '正在登录...' },
  'auth.createAccount': { vi: 'Tạo tài khoản', en: 'Create account', zh: '创建账号' },
  'auth.registering': { vi: 'Đang đăng ký...', en: 'Signing up...', zh: '正在注册...' },
  'auth.noAccount': { vi: 'Chưa có tài khoản?', en: 'Do not have an account?', zh: '还没有账号？' },
  'auth.haveAccount': { vi: 'Đã có tài khoản?', en: 'Already have an account?', zh: '已有账号？' },
  'auth.registerNow': { vi: 'Đăng ký ngay', en: 'Sign up now', zh: '立即注册' },
  'auth.loginNow': { vi: 'Đăng nhập ngay', en: 'Log in now', zh: '立即登录' },
  'auth.loginConsentPrefix': { vi: 'Bằng việc đăng nhập, bạn đồng ý với', en: 'By logging in, you agree to our', zh: '登录即表示你同意我们的' },
  'auth.registerConsentPrefix': { vi: 'Khi đăng ký, bạn đồng ý với', en: 'By signing up, you agree to our', zh: '注册即表示你同意我们的' },
  'auth.and': { vi: 'và', en: 'and', zh: '和' },
  'auth.consentSuffix': { vi: ' của chúng tôi.', en: '.', zh: '。' },
  'auth.terms': { vi: 'Điều khoản sử dụng', en: 'Terms of Use', zh: '使用条款' },
  'auth.privacy': { vi: 'Chính sách bảo mật', en: 'Privacy Policy', zh: '隐私政策' },
  'auth.otpTitle': { vi: 'Nhập mã xác thực', en: 'Enter verification code', zh: '输入验证码' },
  'auth.otpSent': { vi: 'Mã OTP đã được gửi đến email của bạn.', en: 'The OTP code was sent to your email.', zh: '验证码已发送到你的邮箱。' },
  'auth.noOtp': { vi: 'Không nhận được mã?', en: 'Did not receive the code?', zh: '没有收到验证码？' },
  'auth.resendCode': { vi: 'Gửi lại mã', en: 'Resend code', zh: '重新发送验证码' },
  'auth.resending': { vi: 'Đang gửi...', en: 'Sending...', zh: '正在发送...' },
  'auth.resendIn': { vi: 'Gửi lại sau {seconds}s', en: 'Resend in {seconds}s', zh: '{seconds}秒后重发' },
  'auth.backToLogin': { vi: 'Quay lại đăng nhập', en: 'Back to log in', zh: '返回登录' },
  'auth.waitBeforeRetry': { vi: 'Vui lòng chờ {minutes} phút trước khi thử lại.', en: 'Please wait {minutes} minutes before trying again.', zh: '请等待{minutes}分钟后再试。' },
  'auth.tooManyAttempts': { vi: 'Quá nhiều lần thử. Vui lòng chờ {minutes} phút.', en: 'Too many attempts. Please wait {minutes} minutes.', zh: '尝试次数过多。请等待{minutes}分钟。' },
  'auth.failedWithRemaining': { vi: '{message} (Còn {remaining} lần thử)', en: '{message} ({remaining} attempts left)', zh: '{message}（还可尝试{remaining}次）' },
  'auth.requiredEmail': { vi: 'Email là bắt buộc', en: 'Email is required', zh: '请输入邮箱' },
  'auth.invalidEmail': { vi: 'Email không hợp lệ', en: 'Invalid email', zh: '邮箱格式不正确' },
  'auth.requiredPassword': { vi: 'Mật khẩu là bắt buộc', en: 'Password is required', zh: '请输入密码' },
  'auth.passwordMin6': { vi: 'Mật khẩu phải có ít nhất 6 ký tự', en: 'Password must be at least 6 characters', zh: '密码至少需要6个字符' },
  'auth.passwordMin8': { vi: 'Mật khẩu phải có ít nhất 8 ký tự', en: 'Password must be at least 8 characters', zh: '密码至少需要8个字符' },
  'auth.requiredUsername': { vi: 'Tên đăng nhập là bắt buộc', en: 'Username is required', zh: '请输入用户名' },
  'auth.usernameMin3': { vi: 'Tên đăng nhập phải có ít nhất 3 ký tự', en: 'Username must be at least 3 characters', zh: '用户名至少需要3个字符' },
  'auth.usernameInvalid': { vi: 'Tên đăng nhập chỉ chứa chữ cái, số và dấu gạch dưới', en: 'Username can only contain letters, numbers and underscores', zh: '用户名只能包含字母、数字和下划线' },
  'auth.confirmRequired': { vi: 'Vui lòng xác nhận mật khẩu', en: 'Please confirm your password', zh: '请确认密码' },
  'auth.passwordMismatch': { vi: 'Mật khẩu không khớp', en: 'Passwords do not match', zh: '两次输入的密码不一致' },
  'auth.loginFailed': { vi: 'Đăng nhập thất bại. Vui lòng thử lại.', en: 'Login failed. Please try again.', zh: '登录失败，请重试。' },
  'auth.googleLoginFailed': { vi: 'Đăng nhập Google thất bại. Vui lòng thử lại.', en: 'Google login failed. Please try again.', zh: 'Google 登录失败，请重试。' },
  'auth.facebookLoginNotConfigured': { vi: 'Đăng nhập Facebook chưa được cấu hình.', en: 'Facebook login is not configured.', zh: 'Facebook 登录尚未配置。' },
  'auth.otpInvalid': { vi: 'Mã OTP không đúng. Vui lòng thử lại.', en: 'Incorrect OTP code. Please try again.', zh: '验证码不正确，请重试。' },
  'auth.otpResendFailed': { vi: 'Không thể gửi lại mã. Vui lòng thử lại.', en: 'Could not resend the code. Please try again.', zh: '无法重新发送验证码，请重试。' },
  'auth.registerFailed': { vi: 'Đăng ký thất bại. Vui lòng thử lại.', en: 'Sign up failed. Please try again.', zh: '注册失败，请重试。' },
  'auth.googleRegisterFailed': { vi: 'Đăng ký Google thất bại. Vui lòng thử lại.', en: 'Google sign up failed. Please try again.', zh: 'Google 注册失败，请重试。' },
  'auth.facebookRegisterNotConfigured': { vi: 'Đăng ký Facebook chưa được cấu hình.', en: 'Facebook sign up is not configured.', zh: 'Facebook 注册尚未配置。' },
  'auth.passwordStrength.veryWeak': { vi: 'Rất yếu', en: 'Very weak', zh: '很弱' },
  'auth.passwordStrength.weak': { vi: 'Yếu', en: 'Weak', zh: '弱' },
  'auth.passwordStrength.fair': { vi: 'Trung bình', en: 'Fair', zh: '一般' },
  'auth.passwordStrength.strong': { vi: 'Mạnh', en: 'Strong', zh: '强' },
  'auth.passwordStrength.veryStrong': { vi: 'Rất mạnh', en: 'Very strong', zh: '很强' },
  'auth.passwordFeedback.enter': { vi: 'Nhập mật khẩu', en: 'Enter a password', zh: '请输入密码' },
  'auth.passwordFeedback.min8': { vi: 'Ít nhất 8 ký tự', en: 'At least 8 characters', zh: '至少8个字符' },
  'auth.passwordFeedback.case': { vi: 'Bao gồm chữ hoa và chữ thường', en: 'Include uppercase and lowercase letters', zh: '包含大小写字母' },
  'auth.passwordFeedback.number': { vi: 'Bao gồm số', en: 'Include a number', zh: '包含数字' },
  'auth.passwordFeedback.special': { vi: 'Bao gồm ký tự đặc biệt', en: 'Include a special character', zh: '包含特殊字符' },

  'vocab.reviewTitle': { vi: 'Lịch ôn thông minh', en: 'Smart review schedule', zh: '智能复习计划' },
  'vocab.reviewDesc': { vi: 'SM-2 tự động đẩy từ khó về gần hơn', en: 'SM-2 brings difficult words back sooner', zh: 'SM-2 会让难词更快回到复习队列' },
  'vocab.refreshStats': { vi: 'Tải lại thống kê', en: 'Refresh stats', zh: '刷新统计' },
  'vocab.dueToday': { vi: 'Cần ôn hôm nay', en: 'Due today', zh: '今日待复习' },
  'vocab.weakWords': { vi: 'Từ yếu', en: 'Weak words', zh: '薄弱词' },
  'vocab.mastered': { vi: 'Đã nhớ', en: 'Mastered', zh: '已掌握' },
  'vocab.started': { vi: 'Đã học', en: 'Started', zh: '已开始' },
  'vocab.topic': { vi: 'Chủ đề', en: 'Topic', zh: '主题' },
  'vocab.due': { vi: 'Cần ôn', en: 'Due', zh: '待复习' },
  'vocab.weak': { vi: 'Yếu', en: 'Weak', zh: '薄弱' },
  'vocab.flashcardTitle': { vi: 'Flashcard', en: 'Flashcards', zh: '闪卡' },
  'vocab.flashcardDesc': { vi: 'Lật thẻ Hán tự, pinyin, nghĩa', en: 'Flip Chinese characters, pinyin and meaning', zh: '翻看汉字、拼音和释义' },
  'vocab.autoSpeak': { vi: 'Tự phát âm', en: 'Auto speak', zh: '自动朗读' },
  'vocab.start': { vi: 'Bắt đầu', en: 'Start', zh: '开始' },
  'vocab.speak': { vi: 'Phát âm', en: 'Speak', zh: '朗读' },
  'vocab.flipHint': { vi: 'Nhấn để lật thẻ', en: 'Tap to flip', zh: '点击翻卡' },
  'vocab.newWord': { vi: 'Từ mới', en: 'New word', zh: '新词' },
  'vocab.dueReview': { vi: 'Đến lịch ôn', en: 'Due for review', zh: '到期复习' },
  'vocab.wrong': { vi: 'Sai', en: 'Wrong', zh: '错误' },
  'vocab.hard': { vi: 'Khó nhớ', en: 'Hard', zh: '较难' },
  'vocab.remembered': { vi: 'Đã nhớ', en: 'Remembered', zh: '已记住' },
  'vocab.noSession': { vi: 'Chưa có phiên flashcard', en: 'No flashcard session yet', zh: '暂无闪卡练习' },
  'vocab.startHint': { vi: 'Bấm Bắt đầu để lấy từ mới và từ đến lịch ôn.', en: 'Press Start to load new words and due reviews.', zh: '点击开始加载新词和到期复习。' },
  'vocab.previousCard': { vi: 'Thẻ trước', en: 'Previous card', zh: '上一张卡' },
  'vocab.nextCard': { vi: 'Thẻ tiếp theo', en: 'Next card', zh: '下一张卡' },
  'vocab.loginRequiredFlashcard': { vi: 'Đăng nhập để dùng flashcard.', en: 'Log in to use flashcards.', zh: '请登录后使用闪卡。' },
  'vocab.loadFlashcardError': { vi: 'Không tải được flashcard.', en: 'Could not load flashcards.', zh: '无法加载闪卡。' },
  'vocab.saveReviewError': { vi: 'Không lưu được kết quả ôn tập.', en: 'Could not save review result.', zh: '无法保存复习结果。' },
  'vocab.miniTestTitle': { vi: 'Mini test từ vựng', en: 'Vocabulary mini test', zh: '词汇小测' },
  'vocab.miniTestDesc': { vi: 'Chọn nghĩa đúng, kết quả sẽ cập nhật lịch ôn', en: 'Choose the correct meaning; results update the review schedule', zh: '选择正确释义，结果会更新复习计划' },
  'vocab.createTest': { vi: 'Tạo đề', en: 'Create test', zh: '生成测试' },
  'vocab.correctCount': { vi: '{score}/{total} câu đúng', en: '{score}/{total} correct', zh: '答对 {score}/{total} 题' },
  'vocab.answerLabel': { vi: 'đáp án:', en: 'answer:', zh: '答案：' },
  'vocab.submitTest': { vi: 'Nộp bài', en: 'Submit', zh: '提交' },
  'vocab.emptyTest': { vi: 'Bấm Tạo đề để làm bài test nhanh.', en: 'Press Create test to start a quick test.', zh: '点击生成测试开始快速练习。' },
  'vocab.loginRequiredTest': { vi: 'Đăng nhập để làm mini test.', en: 'Log in to take the mini test.', zh: '请登录后参加小测。' },
  'vocab.loadTestError': { vi: 'Không tải được mini test.', en: 'Could not load the mini test.', zh: '无法加载小测。' },
  'vocab.submitTestError': { vi: 'Không nộp được mini test.', en: 'Could not submit the mini test.', zh: '无法提交小测。' },

  'profile.languageTitle': { vi: 'Ngôn ngữ hiển thị', en: 'Display language', zh: '显示语言' },
  'profile.languageDesc': { vi: 'Áp dụng cho trang user, navbar, trang chủ, hồ sơ và nội dung đề thi có đủ dữ liệu.', en: 'Applies to user pages, navbar, homepage, profile and exam content when data exists.', zh: '适用于用户页面、导航栏、首页、个人资料及已有多语言数据的试题内容。' },
  'profile.info': { vi: 'Thông tin', en: 'Info', zh: '信息' },
  'profile.stats': { vi: 'Thống kê', en: 'Stats', zh: '统计' },
  'profile.wallet': { vi: 'Ví xu', en: 'Coin wallet', zh: '金币钱包' },
  'profile.vip': { vi: 'VIP', en: 'VIP', zh: 'VIP' },
  'profile.devices': { vi: 'Thiết bị', en: 'Devices', zh: '设备' },
  'profile.settings': { vi: 'Cài đặt', en: 'Settings', zh: '设置' },
  'profile.edit': { vi: 'Chỉnh sửa', en: 'Edit', zh: '编辑' },
  'profile.joined': { vi: 'Tham gia', en: 'Joined', zh: '加入于' },
  'profile.target': { vi: 'Mục tiêu', en: 'Target', zh: '目标' },
  'profile.fullName': { vi: 'Họ và tên', en: 'Full name', zh: '姓名' },
  'profile.username': { vi: 'Tên đăng nhập', en: 'Username', zh: '用户名' },
  'profile.bio': { vi: 'Giới thiệu', en: 'Bio', zh: '简介' },
  'profile.noBio': { vi: 'Chưa có giới thiệu', en: 'No bio yet', zh: '暂无简介' },
  'profile.targetScore': { vi: 'Điểm mục tiêu', en: 'Target score', zh: '目标分数' },
  'profile.notSet': { vi: 'Chưa đặt', en: 'Not set', zh: '未设置' },
  'profile.vipExpiry': { vi: 'Hạn VIP', en: 'VIP expiry', zh: 'VIP到期日' },
  'profile.examsDone': { vi: 'Đề thi đã làm', en: 'Completed exams', zh: '已完成试卷' },
  'profile.avgScore': { vi: 'Điểm trung bình', en: 'Average score', zh: '平均分' },
  'profile.highestScore': { vi: 'Điểm cao nhất', en: 'Highest score', zh: '最高分' },
  'profile.posts': { vi: 'Bài viết', en: 'Posts', zh: '帖子' },
  'profile.detailStats': { vi: 'Xem thống kê chi tiết toàn bộ', en: 'View full detailed stats', zh: '查看完整详细统计' },
};

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (key: string) => string;
  format: (key: string, values: Record<string, string | number>) => string;
  pick: (value: Partial<Record<AppLanguage, string | null | undefined>>) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function normalizeLanguage(value: string | null | undefined): AppLanguage {
  return value === 'en' || value === 'zh' || value === 'vi' ? value : 'vi';
}

export function pickLocalizedText(
  value: Partial<Record<AppLanguage, string | null | undefined>>,
  language: AppLanguage,
): string {
  const preferred = value[language]?.trim();
  if (preferred) return preferred;
  return value.vi?.trim() || value.en?.trim() || value.zh?.trim() || '';
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>('vi');

  useEffect(() => {
    setLanguageState(normalizeLanguage(window.localStorage.getItem(STORAGE_KEY)));
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : language;
    window.localStorage.setItem(STORAGE_KEY, language);
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage: setLanguageState,
    t: (key: string) => {
      const copy = COPY[key];
      if (!copy) return key;
      if (typeof copy === 'string') return copy;
      return pickLocalizedText(copy, language);
    },
    format: (key, values) => {
      const copy = COPY[key];
      const text = typeof copy === 'string' ? copy : copy ? pickLocalizedText(copy, language) : key;
      return Object.entries(values).reduce(
        (message, [name, value]) => message.split(`{${name}}`).join(String(value)),
        text,
      );
    },
    pick: (text) => pickLocalizedText(text, language),
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used inside LanguageProvider');
  }
  return ctx;
}
