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
