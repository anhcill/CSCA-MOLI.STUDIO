export type TutorProfile = {
  id: string;
  name: string;
  role: string;
  tagline: string;
  bio: string;
  subjects: string[];
  experience: string;
  teachingLanguage: string;
  avatarUrl: string;
  accent: string;
  teachingStyle: string;
  achievements: string[];
  courses: Array<{
    title: string;
    detail: string;
  }>;
};

// Hồ sơ giảng viên hiển thị tại trang khóa học MOLY.
export const MOLY_TUTORS: TutorProfile[] = [
  {
    id: 'nguyen-ta-tam',
    name: 'Nguyễn Tạ Tâm',
    role: 'Giáo viên Tiếng Trung Xã hội CSCA',
    tagline: 'Chắc nền tiếng Trung, tự tin chinh phục CSCA',
    bio: 'Đồng hành cùng học sinh luyện Tiếng Trung Xã hội CSCA theo từng chuyên đề, giúp hệ thống kiến thức rõ ràng và luyện đề đúng trọng tâm.',
    subjects: ['Tiếng Trung Xã hội CSCA', 'Luyện thi CSCA'],
    experience: 'Lớp online và hỗ trợ ôn thi',
    teachingLanguage: 'Tiếng Trung',
    avatarUrl: '/images/tutors/nguyen-ta-tam.png',
    accent: 'from-rose-500 to-orange-400',
    teachingStyle: 'Tập trung vào phần kiến thức trọng tâm, tăng phản xạ làm bài và chữa rõ từng lỗi để học sinh tiến bộ vững vàng.',
    achievements: ['HSK 6 (bản 3.0): 262/300 · HSKK: 80/100', 'CSCA Tiếng Trung: 100/100', 'Giải Ba HSG Quốc gia và Giải Nhì HSG tỉnh 2025–2026'],
    courses: [
      { title: 'Tiếng Trung Xã hội CSCA', detail: 'Luyện kiến thức và dạng bài trọng tâm' },
      { title: 'Luyện đề Tiếng Trung CSCA', detail: 'Chữa đề, củng cố điểm yếu và chiến thuật làm bài' },
    ],
  },
  {
    id: 'nguyen-van-dung',
    name: 'Nguyễn Văn Dũng',
    role: 'Giáo viên Toán CSCA',
    tagline: 'Bám sát đề thật, học chắc kiến thức Toán Trung Quốc',
    bio: 'Hỗ trợ học sinh có dự định du học đại học tại Trung Quốc, chuẩn bị cho kỳ thi CSCA với nội dung Toán bám sát cấu trúc tuyển sinh quốc tế.',
    subjects: ['CSCA Toán', 'CSCA Tiếng Trung Xã hội'],
    experience: 'Hỗ trợ ôn thi, chữa đề và cập nhật đề thật',
    teachingLanguage: 'Tiếng Trung',
    avatarUrl: '/images/tutors/nguyen-van-dung.png',
    accent: 'from-cyan-500 to-blue-500',
    teachingStyle: 'Giảng dạy bằng giáo trình bám sát kiến thức Toán Trung Quốc, cập nhật đề thi thật và đáp án sớm; học sinh được luyện từ kho đề của MOLY.STUDIO.',
    achievements: ['CSCA Toán: 90/100 · CSCA TTXH: 97.5/100', 'HSK 6: 236/300 · HSKKCC: 70/100', 'Học bổng Nam Khai, Đông Nam và SGS loại A Đại học Đồng Tế'],
    courses: [
      { title: 'Ôn thi CSCA Toán', detail: 'Giáo trình bám sát kiến thức Toán Trung Quốc' },
      { title: 'Kho đề CSCA MOLY', detail: 'Đề thi thử, đề thật và đáp án cập nhật sớm' },
    ],
  },
  {
    id: 'nguyen-thi-quyen',
    name: 'Nguyễn Thị Quyên',
    role: 'Giáo viên Toán CSCA',
    tagline: 'Cùng bạn học Toán chắc nền, hiểu kỹ và tiến bộ từng bước',
    bio: 'Tốt nghiệp ngành Sư phạm Toán học, Trường Đại học Sư phạm Hà Nội 2. Đồng hành cùng học sinh ôn Toán CSCA với lộ trình rõ ràng và sát từng dạng bài.',
    subjects: ['Toán CSCA', 'Luyện nền tảng'],
    experience: 'Giáo viên, gia sư Toán THCS–THPT và lớp online',
    teachingLanguage: 'Tiếng Trung',
    avatarUrl: '/images/tutors/nguyen-thi-quyen.png',
    accent: 'from-violet-500 to-indigo-500',
    teachingStyle: 'Giải thích từng bước, khuyến khích học sinh đặt câu hỏi và chủ động trình bày lại kiến thức bằng tiếng Trung.',
    achievements: ['Cử nhân Sư phạm Toán học · Đại học Sư phạm Hà Nội 2', '5 năm kinh nghiệm gia sư Toán các cấp THCS và THPT', 'Giải Ba hội thi Nghiệp vụ Sư phạm khoa Toán'],
    courses: [
      { title: 'Toán CSCA nền tảng', detail: 'Xây chắc kiến thức theo từng dạng bài' },
      { title: 'Luyện đề Toán CSCA', detail: 'Chữa bài và nâng tốc độ làm đề' },
    ],
  },
  {
    id: 'nguyen-minh-duc',
    name: 'Nguyễn Minh Đức',
    role: 'Giáo viên Toán & Vật lý CSCA',
    tagline: 'Học tư duy Toán – Lý CSCA bằng tiếng Anh',
    bio: 'Sinh viên ngành Kỹ thuật Điện tử – Viễn thông, Trường Đại học Bách khoa Hà Nội (HUST); đồng hành cùng học sinh cần củng cố Toán và Vật lý cho CSCA.',
    subjects: ['CSCA Toán', 'CSCA Vật lý'],
    experience: 'Giảng dạy và hỗ trợ bài tập CSCA',
    teachingLanguage: 'Tiếng Anh',
    avatarUrl: '/images/tutors/nguyen-minh-duc.png',
    accent: 'from-emerald-500 to-teal-500',
    teachingStyle: 'Giải thích bằng tiếng Anh, đi từ bản chất đến công thức và dùng bài tập để rèn tư duy giải quyết vấn đề.',
    achievements: ['Giải Ba môn Toán HSG tỉnh Quảng Ninh', 'Giải Ba môn Vật lý 9.25', 'IELTS 7.0 · Học bổng khuyến khích học tập loại Xuất sắc ĐH Bách khoa Hà Nội'],
    courses: [
      { title: 'Toán CSCA bằng tiếng Anh', detail: 'Củng cố tư duy và bài tập trọng tâm' },
      { title: 'Vật lý CSCA bằng tiếng Anh', detail: 'Học công thức từ bản chất vấn đề' },
    ],
  },
];
