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
