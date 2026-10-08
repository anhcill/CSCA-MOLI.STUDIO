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
  proof?: {
    label: string;
    url: string;
  };
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
  {
    id: 'nguyen-bao-lam',
    name: 'Nguyễn Bảo Lam',
    role: 'Gia sư Hóa học & Tiếng Trung Xã hội CSCA',
    tagline: 'Kết nối tư duy khoa học với nền tảng tiếng Trung vững chắc',
    bio: 'Sinh viên Chương trình tiên tiến Kỹ thuật Thực phẩm, Trường Đại học Bách khoa Hà Nội. Đồng hành cùng học sinh ôn Hóa học và Tiếng Trung Xã hội CSCA bằng lộ trình rõ ràng, sát mục tiêu điểm số.',
    subjects: ['CSCA Hóa học', 'CSCA Tiếng Trung Xã hội'],
    experience: 'Ôn thi CSCA và hỗ trợ chuyên đề',
    teachingLanguage: 'Tiếng Việt và Tiếng Trung',
    avatarUrl: 'https://res.cloudinary.com/dvrgrmais/image/upload/v1791443580/moly/tutors/nguyen-bao-lam.png',
    accent: 'from-rose-500 to-orange-400',
    teachingStyle: 'Giải thích theo từng lớp kiến thức, liên hệ giữa thuật ngữ tiếng Trung và bản chất Hóa học để học sinh dễ hiểu, dễ nhớ và tự tin xử lý đề.',
    achievements: [
      'HSK 8: 380/500 điểm (08/11/2025)',
      'Giải Nhì Học sinh giỏi Quốc gia môn Tiếng Trung',
      '9,25 điểm Hóa học kỳ thi tốt nghiệp THPT',
      'Chương trình tiên tiến Kỹ thuật Thực phẩm · Đại học Bách khoa Hà Nội',
    ],
    proof: {
      label: 'Minh chứng HSK 8',
      url: 'https://res.cloudinary.com/dvrgrmais/image/upload/v1791443716/moly/tutors/proofs/nguyen-bao-lam-hsk8.png',
    },
    courses: [
      { title: 'Hóa học CSCA', detail: 'Nắm chắc bản chất, công thức và dạng bài trọng tâm' },
      { title: 'Tiếng Trung Xã hội CSCA', detail: 'Củng cố thuật ngữ và kỹ năng xử lý đề' },
    ],
  },
  {
    id: 'le-ba-quang-sang',
    name: 'Lê Bá Quang Sang',
    role: 'Gia sư Toán CSCA',
    tagline: 'Học chắc bản chất, làm Toán CSCA nhanh và chính xác',
    bio: 'Sinh viên Trường Đại học Bách khoa Hà Nội có nền tảng Toán tốt và kinh nghiệm học tập bằng cả tiếng Anh lẫn tiếng Trung. Hỗ trợ học sinh xây chắc tư duy và luyện các dạng bài Toán CSCA trọng tâm.',
    subjects: ['CSCA Toán'],
    experience: 'Ôn tập Toán nền tảng và luyện đề',
    teachingLanguage: 'Tiếng Việt',
    avatarUrl: 'https://res.cloudinary.com/dvrgrmais/image/upload/v1791443608/moly/tutors/le-ba-quang-sang.png',
    accent: 'from-cyan-500 to-blue-500',
    teachingStyle: 'Đi từ bản chất đến phương pháp, trình bày lời giải ngắn gọn và rèn kỹ năng nhận dạng nhanh từng dạng Toán thường gặp trong đề CSCA.',
    achievements: [
      'IELTS 6.0 · HSK 4',
      '9,0 điểm Toán kỳ thi tốt nghiệp THPT',
      'GPA Toán: 9,5',
      'Điểm A, B+ các môn Toán cao cấp · Đại học Bách khoa Hà Nội',
    ],
    courses: [
      { title: 'Toán CSCA nền tảng', detail: 'Hệ thống kiến thức và phương pháp theo từng dạng' },
      { title: 'Luyện đề Toán CSCA', detail: 'Rèn tốc độ, độ chính xác và chiến thuật làm bài' },
    ],
  },
  {
    id: 'nguyen-my-an',
    name: 'Nguyễn Mỹ An',
    role: 'Gia sư Vật lý & Toán CSCA',
    tagline: 'Hiểu đúng bản chất Lý, vững tư duy Toán',
    bio: 'Cựu học sinh chuyên Lý, Trường THPT Chuyên Nguyễn Huệ và hiện là sinh viên Trường Đại học Bách khoa Hà Nội. Đồng hành cùng học sinh ôn Vật lý và Toán CSCA theo hướng hiểu bản chất, không học thuộc máy móc.',
    subjects: ['CSCA Vật lý', 'CSCA Toán'],
    experience: 'Củng cố nền tảng và luyện bài tập CSCA',
    teachingLanguage: 'Tiếng Việt',
    avatarUrl: 'https://res.cloudinary.com/dvrgrmais/image/upload/v1791443626/moly/tutors/nguyen-my-an.png',
    accent: 'from-violet-500 to-indigo-500',
    teachingStyle: 'Phân tích hiện tượng và dữ kiện trước khi dùng công thức, sau đó hướng dẫn học sinh tự xây dựng lời giải và kiểm tra kết quả.',
    achievements: [
      'HSK 5: 287 điểm · HSKK cao cấp',
      '9,0 điểm Vật lý kỳ thi tốt nghiệp THPT',
      'GPA Vật lý: 9,3 · GPA Toán: 9,8',
      'Chuyên Lý · THPT Chuyên Nguyễn Huệ',
      'Sinh viên Đại học Bách khoa Hà Nội',
    ],
    courses: [
      { title: 'Vật lý CSCA', detail: 'Học từ hiện tượng, bản chất đến công thức' },
      { title: 'Toán CSCA', detail: 'Củng cố tư duy và luyện bài theo chuyên đề' },
    ],
  },
  {
    id: 'thai-chau-minh',
    name: 'Thái Châu Minh',
    role: 'Gia sư Toán & Tiếng Trung CSCA',
    tagline: 'Kết hợp tư duy Toán với năng lực tiếng Trung học thuật',
    bio: 'Sinh viên ngành Tiếng Trung Khoa học và Công nghệ, Trường Đại học Bách khoa Hà Nội. Đồng hành cùng học sinh ở cả Toán, Tiếng Trung Xã hội và Tiếng Trung Tự nhiên CSCA.',
    subjects: ['CSCA Toán', 'CSCA Tiếng Trung Xã hội', 'CSCA Tiếng Trung Tự nhiên'],
    experience: 'Ôn thi đa môn và hỗ trợ tiếng Trung học thuật',
    teachingLanguage: 'Tiếng Việt và Tiếng Trung',
    avatarUrl: 'https://res.cloudinary.com/dvrgrmais/image/upload/v1791443715/moly/tutors/thai-chau-minh.png',
    accent: 'from-emerald-500 to-teal-500',
    teachingStyle: 'Kết hợp giải thích kiến thức với thuật ngữ tiếng Trung chuyên ngành, giúp học sinh vừa hiểu bài vừa tăng khả năng đọc và xử lý đề CSCA.',
    achievements: [
      'HSK 6 · HSKK cao cấp',
      '9,25 điểm Tiếng Trung kỳ thi tốt nghiệp THPT',
      'Thành viên đội tuyển Học sinh giỏi Toán tỉnh',
      'Tham gia Hội nghị hợp tác trao đổi tại Trùng Khánh, Trung Quốc · Hành trình đỏ',
      'Sinh viên ngành Tiếng Trung Khoa học và Công nghệ · Đại học Bách khoa Hà Nội',
    ],
    courses: [
      { title: 'Tiếng Trung CSCA', detail: 'Rèn đọc hiểu và thuật ngữ cho khối Xã hội, Tự nhiên' },
      { title: 'Toán CSCA', detail: 'Kết hợp tư duy Toán với ngôn ngữ đề thi' },
    ],
  },
];
