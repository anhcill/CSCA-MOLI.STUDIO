const path = require('path');
require(path.join(__dirname, '../../backend/node_modules/dotenv')).config({
  path: path.join(__dirname, '../../backend/.env'),
});
const { Pool } = require(path.join(__dirname, '../../backend/node_modules/pg'));

const dbUrl = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;
if (!dbUrl) {
  console.error('Error: DATABASE_URL not found!');
  process.exit(1);
}

const EXAM_DATA = {
  title: '2026 年 4 月 25 日 CSCA 理科（中文）试卷',
  title_cn: '2026 年 4 月 25 日 CSCA 理科（中文）试卷',
  subject_id: 5, // Tiếng Trung Tự nhiên
  duration: 90,
  total_questions: 80,
  total_points: 100.0,
  difficulty_level: 'medium',
  status: 'published',
  is_premium: false,
  language_mode: 'zh',
  explanation_language_mode: 'vi',
  description:
    'Đề thi CSCA Lý khoa (Tiếng Trung Tự nhiên) mã đề 2026-04-25 (Đầy đủ 80 câu). Bao gồm 6 phần: Nhận diện chữ Hán, Điền từ vào câu, Từ đồng nghĩa - trái nghĩa, Chọn từ điền chỗ trống KHTN, Hoàn thành câu và Đọc hiểu khoa học tự nhiên. Đã kiểm định QA/QC 100% kèm lời giải chi tiết.',
};

const QUESTIONS_DATA = [
  // ── 第一部分：识解汉字（1—10 题） ──
  {
    num: 1,
    type: 'single_choice',
    category: 'Nhận diện chữ Hán',
    text: '“这朵花开得真好看！”句中“得”的读音是（ ）',
    options: [
      { key: 'A', text: 'de' },
      { key: 'B', text: 'dé' },
      { key: 'C', text: 'děi' },
      { key: 'D', text: 'dē' },
    ],
    correct: 'A',
    explanation:
      'Chữ “得” là chữ đa âm:\n- Đọc thanh nhẹ de khi làm trợ từ kết cấu đứng sau động từ để nối bổ ngữ trạng thái/mức độ (开得真好看 - nở thật đẹp).\n- Đọc là dé (thanh 2) khi làm động từ mang nghĩa “nhận được, đạt được” (得到, 获得).\n- Đọc là děi (thanh 3) khi làm động từ năng nguyện mang nghĩa “phải, cần phải”.\n=> Đáp án đúng: (A) de.',
  },
  {
    num: 2,
    type: 'single_choice',
    category: 'Nhận diện chữ Hán',
    text: '“小明爱好观察自然现象。”句中“好”的读音是（ ）',
    options: [
      { key: 'A', text: 'hǎo' },
      { key: 'B', text: 'hào' },
      { key: 'C', text: 'háo' },
      { key: 'D', text: 'hāo' },
    ],
    correct: 'B',
    explanation:
      '- Chữ “好” đọc là hào (thanh 4) khi mang nghĩa “yêu thích, ham thích” (爱好 - àihào: sở thích/yêu thích; 好奇 - hàoqí: hiếu kỳ, tò mò).\n- Đọc là hǎo (thanh 3) khi mang nghĩa “tốt, đẹp” (好看, 好人).\n=> Đáp án đúng: (B) hào.',
  },
  {
    num: 3,
    type: 'single_choice',
    category: 'Nhận diện chữ Hán',
    text: '下列“还”读音不同的一项是（ ）',
    options: [
      { key: 'A', text: '还在' },
      { key: 'B', text: '还有' },
      { key: 'C', text: '还是' },
      { key: 'D', text: '还原料' },
    ],
    correct: 'D',
    explanation:
      '- A (还在 - vẫn còn ở), B (还有 - vẫn còn có), C (还是 - vẫn là / hay là): chữ “还” là phó từ, đều đọc là hái.\n- D (还原料 - hoàn trả lại nguyên liệu / hoàn nguyên): chữ “还” là động từ (trả lại, hoàn lại), đọc là huán.\n=> Đáp án đúng: (D) 还原料.',
  },
  {
    num: 4,
    type: 'single_choice',
    category: 'Nhận diện chữ Hán',
    text: '下列“要”读音不同的一项是（ ）',
    options: [
      { key: 'A', text: '要求' },
      { key: 'B', text: '只要' },
      { key: 'C', text: '需要' },
      { key: 'D', text: '主要' },
    ],
    correct: 'A',
    explanation:
      '- A (要求 - yāoqiú: yêu cầu, đòi hỏi): chữ “要” đọc thanh 1 là yāo.\n- B (只要 - zhǐyào: chỉ cần), C (需要 - xūyào: cần), D (主要 - zhǔyào: chủ yếu): chữ “要” đều đọc thanh 4 là yào.\n=> Đáp án đúng: (A) 要求.',
  },
  {
    num: 5,
    type: 'single_choice',
    category: 'Nhận diện chữ Hán',
    text: '两次实验的结果不（tóng）。正确汉字是（ ）',
    options: [
      { key: 'A', text: '问' },
      { key: 'B', text: '同' },
      { key: 'C', text: '间' },
      { key: 'D', text: '闻' },
    ],
    correct: 'B',
    explanation:
      '不同 (bùtóng): khác nhau, không giống nhau.\n- Phân biệt: 问 (wèn - hỏi), 间 (jiān - khoảng giữa), 闻 (wén - nghe/ngửi).\n=> Đáp án đúng: (B) 同.',
  },
  {
    num: 6,
    type: 'single_choice',
    category: 'Nhận diện chữ Hán',
    text: '这个科学道理我很明（bai）。正确汉字是（ ）',
    options: [
      { key: 'A', text: '自' },
      { key: 'B', text: '百' },
      { key: 'C', text: '白' },
      { key: 'D', text: '目' },
    ],
    correct: 'C',
    explanation:
      '明白 (míngbai): hiểu rõ, rõ ràng.\n- Phân biệt hình tự: 自 (zì), 百 (bǎi), 目 (mù).\n=> Đáp án đúng: (C) 白.',
  },
  {
    num: 7,
    type: 'single_choice',
    category: 'Nhận diện chữ Hán',
    text: '仪器使用前要标（zhǔn）。正确汉字是（ ）',
    options: [
      { key: 'A', text: '谁' },
      { key: 'B', text: '推' },
      { key: 'C', text: '准' },
      { key: 'D', text: '难' },
    ],
    correct: 'C',
    explanation:
      '标准 (biāozhǔn - tiêu chuẩn) / 校准 (jiàozhǔn - hiệu chuẩn). Chữ có âm đọc zhǔn là 准.\n- Phân biệt: 谁 (shuí), 推 (tuī), 难 (nán).\n=> Đáp án đúng: (C) 准.',
  },
  {
    num: 8,
    type: 'single_choice',
    category: 'Nhận diện chữ Hán',
    text: '我们要认真（xué）习物理知识。正确汉字是（ ）',
    options: [
      { key: 'A', text: '学' },
      { key: 'B', text: '字' },
      { key: 'C', text: '完' },
      { key: 'D', text: '觉' },
    ],
    correct: 'A',
    explanation:
      '学习 (xuéxí): học tập.\n- Phân biệt: 字 (zì), 完 (wán), 觉 (jué/jiào).\n=> Đáp án đúng: (A) 学.',
  },
  {
    num: 9,
    type: 'single_choice',
    category: 'Nhận diện chữ Hán',
    text: '下列汉字与“水”有关的是（ ）',
    options: [
      { key: 'A', text: '海' },
      { key: 'B', text: '火' },
      { key: 'C', text: '土' },
      { key: 'D', text: '石' },
    ],
    correct: 'A',
    explanation:
      'Chữ “海” (hǎi - biển) có bộ Thủy 氵 (三点水 - ba chấm nước) ở bên trái, biểu thị ý nghĩa gắn liền với nước.\n=> Đáp án đúng: (A) 海.',
  },
  {
    num: 10,
    type: 'single_choice',
    category: 'Nhận diện chữ Hán',
    text: '下列“发”意义不同的一项是（ ）',
    options: [
      { key: 'A', text: '发数据' },
      { key: 'B', text: '发言' },
      { key: 'C', text: '发报告' },
      { key: 'D', text: '发邮件' },
    ],
    correct: 'B',
    explanation:
      '- Trong A (发数据), C (发报告), D (发邮件): chữ “发” đều mang nghĩa 发送 (gửi đi, chuyển đi).\n- Trong B (发言): chữ “发” có nghĩa là 发表 / 表达 (phát biểu ý kiến).\n=> Đáp án đúng: (B) 发言.',
  },

  // ── 第二部分：词语填空（11—25 题） ──
  {
    num: -1,
    type: 'fill_blank_pool',
    category: 'Điền từ vào câu KHTN',
    text: '词语填空（11—15 题）',
    passage_text:
      '11. 做实验要 ______ 误差。\n12. 用仪器 ______ 物体的质量。\n13. 实验室准备 ______ 的器材。\n14. 多练习可以 ______ 实验能力。\n15. 显微镜帮助我们 ______ 微观世界。',
    linked_options: [
      { key: 'A', text: '避免', textCn: '避免' },
      { key: 'B', text: '测量', textCn: '测量' },
      { key: 'C', text: '足够', textCn: '足够' },
      { key: 'D', text: '提高', textCn: '提高' },
      { key: 'E', text: '观察', textCn: '观察' },
      { key: 'F', text: '缓解', textCn: '缓解' },
    ],
    children: [
      {
        num: 11,
        text: '做实验要 ______ 误差。',
        correct: 'A',
        explanation:
          'Làm thí nghiệm cần phải tránh (避免 - bìmiǎn) sai số (避免误差).\n=> Đáp án đúng: (A) 避免.',
      },
      {
        num: 12,
        text: '用仪器 ______ 物体的质量。',
        correct: 'B',
        explanation:
          'Dùng dụng cụ để đo (测量 - cèliáng) khối lượng của vật thể.\n=> Đáp án đúng: (B) 测量.',
      },
      {
        num: 13,
        text: '实验室准备 ______ 的器材。',
        correct: 'C',
        explanation:
          'Phòng thí nghiệm chuẩn bị dụng cụ đầy đủ (足够 - zúgòu).\n=> Đáp án đúng: (C) 足够.',
      },
      {
        num: 14,
        text: '多练习可以 ______ 实验能力。',
        correct: 'D',
        explanation:
          'Luyện tập nhiều có thể nâng cao (提高 - tígāo) năng lực thực hành thí nghiệm.\n=> Đáp án đúng: (D) 提高.',
      },
      {
        num: 15,
        text: '显微镜帮助我们 ______ 微观世界。',
        correct: 'E',
        explanation:
          'Kính hiển vi giúp chúng ta quan sát (观察 - guānchá) thế giới vi mô.\n=> Đáp án đúng: (E) 观察.',
      },
    ],
  },
  {
    num: -2,
    type: 'fill_blank_pool',
    category: 'Điền từ vào câu KHTN',
    text: '词语填空（16—20 题）',
    passage_text:
      '16. 物体冷热程度用 ______ 表示。\n17. 单位体积的质量叫做 ______。\n18. 物体运动的快慢是 ______。\n19. 物体所含物质的多少是 ______。\n20. 单位面积受到的压力是 ______。',
    linked_options: [
      { key: 'A', text: '温度', textCn: '温度' },
      { key: 'B', text: '密度', textCn: '密度' },
      { key: 'C', text: '能量', textCn: '能量' },
      { key: 'D', text: '压强', textCn: '压强' },
      { key: 'E', text: '质量', textCn: '质量' },
      { key: 'F', text: '速度', textCn: '速度' },
    ],
    children: [
      {
        num: 16,
        text: '物体冷热程度用 ______ 表示。',
        correct: 'A',
        explanation:
          'Mức độ nóng lạnh của vật thể được biểu thị bằng nhiệt độ (温度 - wēndù).\n=> Đáp án đúng: (A) 温度.',
      },
      {
        num: 17,
        text: '单位体积的质量叫做 ______。',
        correct: 'B',
        explanation:
          'Khối lượng của một đơn vị thể tích được gọi là khối lượng riêng / mật độ (密度 - mìdù, $\\rho = \\frac{m}{V}$).\n=> Đáp án đúng: (B) 密度.',
      },
      {
        num: 18,
        text: '物体运动的快慢是 ______。',
        correct: 'F',
        explanation:
          'Sự nhanh hay chậm của chuyển động vật thể là vận tốc / tốc độ (速度 - sùdù, $v = \\frac{s}{t}$).\n=> Đáp án đúng: (F) 速度.',
      },
      {
        num: 19,
        text: '物体所含物质的多少是 ______。',
        correct: 'E',
        explanation:
          'Lượng vật chất chứa trong vật thể là khối lượng (质量 - zhìliàng).\n=> Đáp án đúng: (E) 质量.',
      },
      {
        num: 20,
        text: '单位面积受到的压力是 ______。',
        correct: 'D',
        explanation:
          'Áp lực tác dụng lên một đơn vị diện tích là áp suất (压强 - yāqiáng, $p = \\frac{F}{S}$).\n=> Đáp án đúng: (D) 压强.',
      },
    ],
  },
  {
    num: -3,
    type: 'fill_blank_pool',
    category: 'Điền từ vào câu KHTN',
    text: '词语填空（21—25 题）',
    passage_text:
      '21. 盐在水里会 ______。\n22. 两种物质混合会发生化学 ______。\n23. 金属容易 ______。\n24. 用酒精灯 ______ 可以加快反应。\n25. 杠杆保持 ______ 需要两边力相等。',
    linked_options: [
      { key: 'A', text: '分解', textCn: '分解' },
      { key: 'B', text: '溶解', textCn: '溶解' },
      { key: 'C', text: '反应', textCn: '反应' },
      { key: 'D', text: '加热', textCn: '加热' },
      { key: 'E', text: '导电', textCn: '导电' },
      { key: 'F', text: '平衡', textCn: '平衡' },
    ],
    children: [
      {
        num: 21,
        text: '盐在水里会 ______。',
        correct: 'B',
        explanation:
          'Muối ở trong nước sẽ hòa tan (溶解 - róngjiě).\n=> Đáp án đúng: (B) 溶解.',
      },
      {
        num: 22,
        text: '两种物质混合会发生化学 ______。',
        correct: 'C',
        explanation:
          'Hai chất trộn lẫn với nhau sẽ xảy ra phản ứng hóa học (化学反应 - huàxué fǎnyìng).\n=> Đáp án đúng: (C) 反应.',
      },
      {
        num: 23,
        text: '金属容易 ______。',
        correct: 'E',
        explanation:
          'Kim loại là vật dẫn điện tốt nên rất dễ dẫn điện (导电 - dǎodiàn).\n=> Đáp án đúng: (E) 导电.',
      },
      {
        num: 24,
        text: '用酒精灯 ______ 可以加快反应。',
        correct: 'D',
        explanation:
          'Dùng đèn cồn đun nóng (加热 - jiārè) có thể làm tăng tốc độ phản ứng.\n=> Đáp án đúng: (D) 加热.',
      },
      {
        num: 25,
        text: '杠杆保持 ______ 需要两边力相等。',
        correct: 'F',
        explanation:
          'Đòn bẩy giữ trạng thái cân bằng (平衡 - pínghéng) cần lực ở hai bên bằng nhau.\n=> Đáp án đúng: (F) 平衡.',
      },
    ],
  },

  // ── 第三部分：近义反义词（26—33 题） ──
  {
    num: 26,
    type: 'single_choice',
    category: 'Từ đồng nghĩa - trái nghĩa',
    text: '与“准确”意思相近的是（ ）',
    options: [
      { key: 'A', text: '精确' },
      { key: 'B', text: '大概' },
      { key: 'C', text: '模糊' },
      { key: 'D', text: '简单' },
    ],
    correct: 'A',
    explanation:
      'Đồng nghĩa với “准确” (chính xác) là “精确” (chuẩn xác).\n- 大概: đại khái; 模糊: mơ hồ; 简单: đơn giản.\n=> Đáp án đúng: (A) 精确.',
  },
  {
    num: 27,
    type: 'single_choice',
    category: 'Từ đồng nghĩa - trái nghĩa',
    text: '与“安全”意思相近的是（ ）',
    options: [
      { key: 'A', text: '危险' },
      { key: 'B', text: '平安' },
      { key: 'C', text: '快速' },
      { key: 'D', text: '困难' },
    ],
    correct: 'B',
    explanation:
      'Đồng nghĩa với “安全” (an toàn) là “平安” (bình an, an toàn).\n- 危险: nguy hiểm; 快速: nhanh chóng; 困难: khó khăn.\n=> Đáp án đúng: (B) 平安.',
  },
  {
    num: 28,
    type: 'single_choice',
    category: 'Từ đồng nghĩa - trái nghĩa',
    text: '与“保存”意思相近的是（ ）',
    options: [
      { key: 'A', text: '保留' },
      { key: 'B', text: '破坏' },
      { key: 'C', text: '丢弃' },
      { key: 'D', text: '改变' },
    ],
    correct: 'A',
    explanation:
      'Đồng nghĩa với “保存” (bảo tồn, lưu giữ) là “保留” (giữ lại, lưu lại).\n- 破坏: phá hoại; 丢弃: vứt bỏ; 改变: thay đổi.\n=> Đáp án đúng: (A) 保留.',
  },
  {
    num: 29,
    type: 'single_choice',
    category: 'Từ đồng nghĩa - trái nghĩa',
    text: '与“立刻”意思相近的是（ ）',
    options: [
      { key: 'A', text: '马上' },
      { key: 'B', text: '缓慢' },
      { key: 'C', text: '暂时' },
      { key: 'D', text: '长久' },
    ],
    correct: 'A',
    explanation:
      'Đồng nghĩa với “立刻” (ngay lập tức) là “马上” (ngay lập tức).\n- 缓慢: chậm chạp; 暂时: tạm thời; 长久: lâu dài.\n=> Đáp án đúng: (A) 马上.',
  },
  {
    num: 30,
    type: 'single_choice',
    category: 'Từ đồng nghĩa - trái nghĩa',
    text: '与“必须”意思相近的是（ ）',
    options: [
      { key: 'A', text: '务必' },
      { key: 'B', text: '不必' },
      { key: 'C', text: '可以' },
      { key: 'D', text: '不要' },
    ],
    correct: 'A',
    explanation:
      'Đồng nghĩa với “必须” (bắt buộc phải) là “务必” (nhất định phải, cốt phải).\n=> Đáp án đúng: (A) 务必.',
  },
  {
    num: 31,
    type: 'single_choice',
    category: 'Từ đồng nghĩa - trái nghĩa',
    text: '与“上升”意思相反的是（ ）',
    options: [
      { key: 'A', text: '下降' },
      { key: 'B', text: '静止' },
      { key: 'C', text: '运动' },
      { key: 'D', text: '漂浮' },
    ],
    correct: 'A',
    explanation:
      'Trái nghĩa với “上升” (đi lên, tăng lên) là “下降” (đi xuống, hạ xuống).\n=> Đáp án đúng: (A) 下降.',
  },
  {
    num: 32,
    type: 'single_choice',
    category: 'Từ đồng nghĩa - trái nghĩa',
    text: '与“干燥”意思相反的是（ ）',
    options: [
      { key: 'A', text: '潮湿' },
      { key: 'B', text: '寒冷' },
      { key: 'C', text: '高温' },
      { key: 'D', text: '坚硬' },
    ],
    correct: 'A',
    explanation:
      'Trái nghĩa với “干燥” (khô ráo, hanh khô) là “潮湿” (ẩm ướt).\n=> Đáp án đúng: (A) 潮湿.',
  },
  {
    num: 33,
    type: 'single_choice',
    category: 'Từ đồng nghĩa - trái nghĩa',
    text: '与“加快”意思相反的是（ ）',
    options: [
      { key: 'A', text: '减慢' },
      { key: 'B', text: '停止' },
      { key: 'C', text: '开始' },
      { key: 'D', text: '继续' },
    ],
    correct: 'A',
    explanation:
      'Trái nghĩa với “加快” (đẩy nhanh, tăng tốc) là “减慢” (làm chậm lại, giảm tốc).\n=> Đáp án đúng: (A) 减慢.',
  },

  // ── 第四部分：选词填空（34—48 题） ──
  {
    num: -4,
    type: 'fill_blank_pool',
    category: 'Chọn từ điền chỗ trống KHTN',
    text: '选词填空（34—38 题）',
    passage_text:
      '34. 实验要及时 ______ 过程和结果。\n35. 报告内容要 ______ 可靠。\n36. 整理 ______ 可以得出结论。\n37. 对结果进行 ______，找出规律。\n38. 同学之间互相 ______ 经验。',
    linked_options: [
      { key: 'A', text: '记录', textCn: '记录' },
      { key: 'B', text: '真实', textCn: '真实' },
      { key: 'C', text: '数据', textCn: '数据' },
      { key: 'D', text: '分析', textCn: '分析' },
      { key: 'E', text: '交流', textCn: '交流' },
    ],
    children: [
      {
        num: 34,
        text: '实验要及时 ______ 过程和结果。',
        correct: 'A',
        explanation:
          'Thí nghiệm cần kịp thời ghi chép (记录 - jìlù) quá trình và kết quả.\n=> Đáp án đúng: (A) 记录.',
      },
      {
        num: 35,
        text: '报告内容要 ______ 可靠。',
        correct: 'B',
        explanation:
          'Nội dung báo cáo phải chân thực (真实 - zhēnshí), đáng tin cậy.\n=> Đáp án đúng: (B) 真实.',
      },
      {
        num: 36,
        text: '整理 ______ 可以得出结论。',
        correct: 'C',
        explanation:
          'Chỉnh lý/tổng hợp dữ liệu (数据 - shùjù) có thể rút ra kết luận.\n=> Đáp án đúng: (C) 数据.',
      },
      {
        num: 37,
        text: '对结果进行 ______，找出规律。',
        correct: 'D',
        explanation:
          'Tiến hành phân tích (分析 - fēnxī) kết quả để tìm ra quy luật.\n=> Đáp án đúng: (D) 分析.',
      },
      {
        num: 38,
        text: '同学之间互相 ______ 经验。',
        correct: 'E',
        explanation:
          'Giữa các bạn học cùng nhau trao đổi (交流 - jiāoliú) kinh nghiệm.\n=> Đáp án đúng: (E) 交流.',
      },
    ],
  },
  {
    num: -5,
    type: 'fill_blank_pool',
    category: 'Chọn từ điền chỗ trống KHTN',
    text: '选词填空（39—43 题）',
    passage_text:
      '39. 实验室 ______ 要定期检查。\n40. 正确 ______ 仪器很重要。\n41. 科学需要 ______ 精神。\n42. 我们要 ______ 自然规律。\n43. 要继承优秀 ______ 科技文化。',
    linked_options: [
      { key: 'A', text: '创新', textCn: '创新' },
      { key: 'B', text: '设备', textCn: '设备' },
      { key: 'C', text: '操作', textCn: '操作' },
      { key: 'D', text: '传统', textCn: '传统' },
      { key: 'E', text: '认识', textCn: '认识' },
    ],
    children: [
      {
        num: 39,
        text: '实验室 ______ 要定期检查。',
        correct: 'B',
        explanation:
          'Thiết bị (设备 - shèbèi) phòng thí nghiệm cần phải kiểm tra định kỳ.\n=> Đáp án đúng: (B) 设备.',
      },
      {
        num: 40,
        text: '正确 ______ 仪器很重要。',
        correct: 'C',
        explanation:
          'Việc thao tác/vận hành (操作 - cāozuò) dụng cụ đúng cách là rất quan trọng.\n=> Đáp án đúng: (C) 操作.',
      },
      {
        num: 41,
        text: '科学需要 ______ 精神。',
        correct: 'A',
        explanation:
          'Khoa học cần có tinh thần đổi mới sáng tạo (创新 - chuàngxīn).\n=> Đáp án đúng: (A) 创新.',
      },
      {
        num: 42,
        text: '我们要 ______ 自然规律。',
        correct: 'E',
        explanation:
          'Chúng ta cần nhận thức (认识 - rènshi) các quy luật tự nhiên.\n=> Đáp án đúng: (E) 认识.',
      },
      {
        num: 43,
        text: '要继承优秀 ______ 科技文化。',
        correct: 'D',
        explanation:
          'Cần kế thừa văn hóa khoa học kỹ thuật truyền thống (传统 - chuántǒng) ưu tú.\n=> Đáp án đúng: (D) 传统.',
      },
    ],
  },
  {
    num: -6,
    type: 'fill_blank_pool',
    category: 'Chọn từ điền chỗ trống KHTN',
    text: '选词填空（44—48 题）',
    passage_text:
      '44. 科学家 ______ 新的理论模型。\n45. 实验要 ______ 安全和规范。\n46. 老师 ______ 我们大胆提问。\n47. 大家一起 ______ 发现与成果。\n48. 人类不断 ______ 宇宙的奥秘。',
    linked_options: [
      { key: 'A', text: '构建', textCn: '构建' },
      { key: 'B', text: '注重', textCn: '注重' },
      { key: 'C', text: '鼓励', textCn: '鼓励' },
      { key: 'D', text: '分享', textCn: '分享' },
      { key: 'E', text: '探索', textCn: '探索' },
    ],
    children: [
      {
        num: 44,
        text: '科学家 ______ 新的理论模型。',
        correct: 'A',
        explanation:
          'Các nhà khoa học xây dựng (构建 - gòujiàn) mô hình lý thuyết mới.\n=> Đáp án đúng: (A) 构建.',
      },
      {
        num: 45,
        text: '实验要 ______ 安全和规范。',
        correct: 'B',
        explanation:
          'Thí nghiệm cần phải chú trọng (注重 - zhùzhòng) sự an toàn và quy phạm.\n=> Đáp án đúng: (B) 注重.',
      },
      {
        num: 46,
        text: '老师 ______ 我们大胆提问。',
        correct: 'C',
        explanation:
          'Giáo viên khuyến khích (鼓励 - gǔlì) chúng tôi mạnh dạn đặt câu hỏi.\n=> Đáp án đúng: (C) 鼓励.',
      },
      {
        num: 47,
        text: '大家一起 ______ 发现与成果。',
        correct: 'D',
        explanation:
          'Mọi người cùng nhau chia sẻ (分享 - fēnxiǎng) những phát hiện và thành quả.\n=> Đáp án đúng: (D) 分享.',
      },
      {
        num: 48,
        text: '人类不断 ______ 宇宙的奥秘。',
        correct: 'E',
        explanation:
          'Nhân loại không ngừng khám phá (探索 - tànsuǒ) những bí ẩn của vũ trụ.\n=> Đáp án đúng: (E) 探索.',
      },
    ],
  },

  // ── 第五部分：补全语句（49—70 题） ──
  {
    num: 49,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '实验步骤太多，我没做 ______。（ ）',
    options: [
      { key: 'A', text: '完' },
      { key: 'B', text: '好' },
      { key: 'C', text: '到' },
      { key: 'D', text: '过' },
    ],
    correct: 'A',
    explanation:
      'Bổ ngữ kết quả “做完” (làm xong). Vì quá nhiều bước nên chưa làm xong (“没做完”).\n=> Đáp án đúng: (A) 完.',
  },
  {
    num: 50,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '他 ______ 昨天完成的实验。（ ）',
    options: [
      { key: 'A', text: '是' },
      { key: 'B', text: '才' },
      { key: 'C', text: '刚' },
      { key: 'D', text: '都' },
    ],
    correct: 'A',
    explanation:
      'Cấu trúc nhấn mạnh thời gian “是……的”: “他是昨天完成的实验” (Chính hôm qua anh ấy đã hoàn thành thí nghiệm).\n=> Đáp án đúng: (A) 是.',
  },
  {
    num: 51,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '我花了三小时 ______ 做完这个模型。（ ）',
    options: [
      { key: 'A', text: '才' },
      { key: 'B', text: '又' },
      { key: 'C', text: '就' },
      { key: 'D', text: '都' },
    ],
    correct: 'A',
    explanation:
      'Phó từ “才” biểu thị hành động tốn nhiều thời gian (“花了三小时” - mất 3 tiếng) mới hoàn thành xong.\n=> Đáp án đúng: (A) 才.',
  },
  {
    num: 52,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '这个规定 ______ 所有实验人员有效。（ ）',
    options: [
      { key: 'A', text: '跟' },
      { key: 'B', text: '比' },
      { key: 'C', text: '对' },
      { key: 'D', text: '和' },
    ],
    correct: 'C',
    explanation:
      'Cấu trúc giới từ cố định: “对……有效” (có hiệu lực đối với ai/cái gì).\n=> Đáp án đúng: (C) 对.',
  },
  {
    num: 53,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '用机器测量比手工 ______。（ ）',
    options: [
      { key: 'A', text: '更准确' },
      { key: 'B', text: '一点儿准确' },
      { key: 'C', text: '很准确' },
      { key: 'D', text: '准确准确' },
    ],
    correct: 'A',
    explanation:
      'Câu so sánh hơn: Dùng máy móc đo đạc thì chính xác hơn (“更准确”) so với làm thủ công.\n=> Đáp án đúng: (A) 更准确.',
  },
  {
    num: 54,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '______ 学生要懂安全，老师也要重视。（ ）',
    options: [
      { key: 'A', text: '不但' },
      { key: 'B', text: '不但学生' },
      { key: 'C', text: '学生不但' },
      { key: 'D', text: '不但学习' },
    ],
    correct: 'A',
    explanation:
      'Cặp liên từ tăng tiến có 2 chủ ngữ khác nhau (学生 và 老师): “不但 + Chủ ngữ 1……，Chủ ngữ 2 + 也……” (Không những học sinh phải hiểu về an toàn, mà giáo viên cũng phải coi trọng). Vì sau gạch trống đã có chữ “学生” nên chỉ điền “不但”.\n=> Đáp án đúng: (A) 不但.',
  },
  {
    num: 55,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '下课我想去实验室 ______。（ ）',
    options: [
      { key: 'A', text: '做个实验' },
      { key: 'B', text: '个做实验' },
      { key: 'C', text: '实验个做' },
      { key: 'D', text: '做实验个' },
    ],
    correct: 'A',
    explanation:
      'Trật tự cụm Động - Lượng - Danh: Động từ (做) + Lượng từ (个) + Tân ngữ (实验) -> “做个实验” (làm một cái thí nghiệm).\n=> Đáp án đúng: (A) 做个实验.',
  },
  {
    num: 56,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '我忘不了 ______。（ ）',
    options: [
      { key: 'A', text: '在实验室认真工作的老师' },
      { key: 'B', text: '认真在实验室工作的老师' },
      { key: 'C', text: '在实验室工作认真的老师' },
      { key: 'D', text: '认真工作在实验室的老师' },
    ],
    correct: 'A',
    explanation:
      'Trật tự nhiều định ngữ chuẩn trong tiếng Trung: Cụm giới từ chỉ địa điểm (在实验室) + Trạng ngữ chỉ phương thức (认真) + Động từ (工作) + 的 + Danh từ trung tâm (老师) -> “在实验室认真工作的老师”.\n=> Đáp án đúng: (A) 在实验室认真工作的老师.',
  },
  {
    num: 57,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '我们要 ______。（ ）',
    options: [
      { key: 'A', text: '一直把注意下去' },
      { key: 'B', text: '把实验安全一直注意下去' },
      { key: 'C', text: '一直注意下去实验安全' },
      { key: 'D', text: '把一直注意下去' },
    ],
    correct: 'B',
    explanation:
      'Công thức câu chữ “把”: 把 + Tân ngữ (实验安全) + Phó từ (一直) + Động từ (注意) + Bổ ngữ xu hướng (下去).\n=> Đáp án đúng: (B) 把实验安全一直注意下去.',
  },
  {
    num: 58,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '他的发明成功了，大家来向他 ______。（ ）',
    options: [
      { key: 'A', text: '表示祝贺' },
      { key: 'B', text: '赢得支持' },
      { key: 'C', text: '送上感谢' },
      { key: 'D', text: '付出关心' },
    ],
    correct: 'A',
    explanation:
      'Cấu trúc cố định “向某人表示祝贺” (gửi lời chúc mừng tới ai đó khi họ đạt thành tựu).\n=> Đáp án đúng: (A) 表示祝贺.',
  },
  {
    num: 59,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '我们要 ______ 科学探索的乐趣。（ ）',
    options: [
      { key: 'A', text: '充分享受' },
      { key: 'B', text: '宣传文化' },
      { key: 'C', text: '相当精彩' },
      { key: 'D', text: '诸多方面' },
    ],
    correct: 'A',
    explanation:
      'Cụm Động - Tân chuẩn xác: “充分享受……的乐趣” (tận hưởng trọn vẹn niềm vui của việc khám phá khoa học).\n=> Đáp án đúng: (A) 充分享受.',
  },
  {
    num: 60,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '实验安全 ______。（ ）',
    options: [
      { key: 'A', text: '非常重要' },
      { key: 'B', text: '十分一般' },
      { key: 'C', text: '多多少少' },
      { key: 'D', text: '不太重要' },
    ],
    correct: 'A',
    explanation:
      'An toàn trong phòng thí nghiệm là vô cùng quan trọng (“非常重要”).\n=> Đáp án đúng: (A) 非常重要.',
  },
  {
    num: 61,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '科学研究需要 ______ 的态度。（ ）',
    options: [
      { key: 'A', text: '严谨认真' },
      { key: 'B', text: '随便马虎' },
      { key: 'C', text: '激动热情' },
      { key: 'D', text: '自由散漫' },
    ],
    correct: 'A',
    explanation:
      'Nghiên cứu khoa học đòi hỏi thái độ nghiêm cẩn, nghiêm túc (“严谨认真”).\n=> Đáp án đúng: (A) 严谨认真.',
  },
  {
    num: 62,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '观察、记录、分析是科学的 ______。（ ）',
    options: [
      { key: 'A', text: '重要技能' },
      { key: 'B', text: '快乐回忆' },
      { key: 'C', text: '宝贵资源' },
      { key: 'D', text: '有趣玩具' },
    ],
    correct: 'A',
    explanation:
      'Quan sát, ghi chép và phân tích là những kỹ năng quan trọng (“重要技能”) của nghiên cứu khoa học.\n=> Đáp án đúng: (A) 重要技能.',
  },
  {
    num: 63,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '做实验时大家 ______ 准备器材。（ ）',
    options: [
      { key: 'A', text: '认认真真' },
      { key: 'B', text: '休息休息' },
      { key: 'C', text: '打扫打扫' },
      { key: 'D', text: '整整齐齐' },
    ],
    correct: 'A',
    explanation:
      'Tính từ láy AABB “认认真真” làm trạng ngữ bổ nghĩa cho động từ “准备” (mọi người chuẩn bị dụng cụ một cách thật nghiêm túc, cẩn thận).\n=> Đáp án đúng: (A) 认认真真.',
  },
  {
    num: 64,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '这个科学现象让我 ______。（ ）',
    options: [
      { key: 'A', text: '难以忘记' },
      { key: 'B', text: '非常高兴' },
      { key: 'C', text: '不会受伤' },
      { key: 'D', text: '特别舒服' },
    ],
    correct: 'A',
    explanation:
      'Hiện tượng khoa học gây ấn tượng sâu sắc khiến người xem khó lòng quên được (“难以忘记”).\n=> Đáp án đúng: (A) 难以忘记.',
  },
  {
    num: 65,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '实验器材有的是玻璃，______ 是塑料，______ 是金属。（ ）',
    options: [
      { key: 'A', text: '有的' },
      { key: 'B', text: '还有的' },
      { key: 'C', text: '其他的' },
      { key: 'D', text: '另有的' },
    ],
    correct: 'A',
    explanation:
      'Cấu trúc liệt kê đẳng lập: “有的是……，有的是……，有的是……” (có cái là thủy tinh, có cái là nhựa, có cái là kim loại).\n=> Đáp án đúng: (A) 有的.',
  },
  {
    num: 66,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '实验结果与操作方法 ______。（ ）',
    options: [
      { key: 'A', text: '有关系' },
      { key: 'B', text: '没联系' },
      { key: 'C', text: '能分开' },
      { key: 'D', text: '相矛盾' },
    ],
    correct: 'A',
    explanation:
      'Kết quả thí nghiệm có mối liên hệ (“有关系”) với phương pháp thao tác.\n=> Đáp án đúng: (A) 有关系.',
  },
  {
    num: 67,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '物理实验是一项 ______。（ ）',
    options: [
      { key: 'A', text: '有趣的活动' },
      { key: 'B', text: '优美的舞蹈' },
      { key: 'C', text: '好听的歌曲' },
      { key: 'D', text: '开心的事业' },
    ],
    correct: 'A',
    explanation:
      'Lượng từ “一项” đi với danh từ “活动”: Thí nghiệm vật lý là một hoạt động thú vị (“有趣的活动”).\n=> Đáp án đúng: (A) 有趣的活动.',
  },
  {
    num: 68,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '科学理论是一套完整的 ______。（ ）',
    options: [
      { key: 'A', text: '知识系统' },
      { key: 'B', text: '书写材料' },
      { key: 'C', text: '书法字体' },
      { key: 'D', text: '色彩搭配' },
    ],
    correct: 'A',
    explanation:
      'Lượng từ “一套” đi với “系统”: Lý thuyết khoa học là một hệ thống tri thức (“知识系统”) hoàn chỉnh.\n=> Đáp án đúng: (A) 知识系统.',
  },
  {
    num: 69,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '小水滴在锅里 ______，慢慢变成水蒸气。（ ）',
    options: [
      { key: 'A', text: '滚来滚去' },
      { key: 'B', text: '爬来爬去' },
      { key: 'C', text: '跑来跑去' },
      { key: 'D', text: '走来走去' },
    ],
    correct: 'A',
    explanation:
      'Khi đun nóng trong nồi, các giọt nước nhỏ lăn qua lăn lại (“滚来滚去”) rồi dần dần hóa hơi thành hơi nước.\n=> Đáp án đúng: (A) 滚来滚去.',
  },
  {
    num: 70,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '每个科学实验都有自己的 ______。（ ）',
    options: [
      { key: 'A', text: '操作步骤' },
      { key: 'B', text: '语言文字' },
      { key: 'C', text: '相同意义' },
      { key: 'D', text: '唱歌跳舞' },
    ],
    correct: 'A',
    explanation:
      'Mỗi thí nghiệm khoa học đều có trình tự / các bước thao tác (“操作步骤”) riêng của nó.\n=> Đáp án đúng: (A) 操作步骤.',
  },

  // ── 第六部分：阅读理解（71—80 题） ──
  {
    num: -7,
    type: 'reading_passage',
    category: 'Đọc hiểu KHTN',
    text: '阅读理解（71—72 题）',
    passage_text:
      '做科学实验要注意四点。第一，穿好实验服，戴好护目镜，保护自己安全。第二，按照步骤操作，不随意改变流程。第三，如实记录数据，不编造结果。第四，实验结束后整理台面，保持整洁。',
    children: [
      {
        num: 71,
        text: '短文主要讲实验的（ ）',
        options: [
          { key: 'A', text: '操作步骤' },
          { key: 'B', text: '注意事项' },
          { key: 'C', text: '器材介绍' },
          { key: 'D', text: '结果分析' },
        ],
        correct: 'B',
        explanation:
          'Toàn bộ đoạn văn liệt kê những điều cần chú ý (“注意事项”) khi làm thí nghiệm khoa học.\n=> Đáp án đúng: (B) 注意事项.',
      },
      {
        num: 72,
        text: '记录数据要（ ）',
        options: [
          { key: 'A', text: '编造' },
          { key: 'B', text: '真实' },
          { key: 'C', text: '模糊' },
          { key: 'D', text: '随意' },
        ],
        correct: 'B',
        explanation:
          'Nguyên văn: “如实记录数据，不编造结果” (ghi chép dữ liệu đúng sự thật, không bịa đặt kết quả) -> 真实 (chân thực).\n=> Đáp án đúng: (B) 真实.',
      },
    ],
  },
  {
    num: -8,
    type: 'reading_passage',
    category: 'Đọc hiểu KHTN',
    text: '阅读理解（73—75 题）',
    passage_text:
      '温度计可以测量物体温度。使用时，要把感温部分完全放入被测物体，等待示数稳定再读数。读数时视线要与刻度相平，不能仰视或俯视，否则结果不准确。',
    children: [
      {
        num: 73,
        text: '温度计的作用是（ ）',
        options: [
          { key: 'A', text: '测量质量' },
          { key: 'B', text: '测量温度' },
          { key: 'C', text: '测量长度' },
          { key: 'D', text: '测量时间' },
        ],
        correct: 'B',
        explanation:
          'Nguyên văn câu đầu: “温度计可以测量物体温度” (Nhiệt kế dùng để đo nhiệt độ).\n=> Đáp án đúng: (B) 测量温度.',
      },
      {
        num: 74,
        text: '读数时视线要（ ）',
        options: [
          { key: 'A', text: '仰视' },
          { key: 'B', text: '俯视' },
          { key: 'C', text: '与刻度相平' },
          { key: 'D', text: '随便看' },
        ],
        correct: 'C',
        explanation:
          'Nguyên văn: “读数时视线要与刻度相平” (Khi đọc số đo tầm mắt phải ngang bằng với vạch chia độ).\n=> Đáp án đúng: (C) 与刻度相平.',
      },
      {
        num: 75,
        text: '示数不稳定时（ ）',
        options: [
          { key: 'A', text: '马上读数' },
          { key: 'B', text: '等待稳定' },
          { key: 'C', text: '估计读数' },
          { key: 'D', text: '停止测量' },
        ],
        correct: 'B',
        explanation:
          'Nguyên văn: “等待示数稳定再读数” (Chờ cho chỉ số ổn định rồi mới đọc).\n=> Đáp án đúng: (B) 等待稳定.',
      },
    ],
  },
  {
    num: -9,
    type: 'reading_passage',
    category: 'Đọc hiểu KHTN',
    text: '阅读理解（76—80 题）',
    passage_text:
      '实验室是学习科学的重要场所。这里有各种仪器、药品和材料。同学们可以做实验、观察现象、记录数据、得出结论。实验室帮助我们理解知识，提高动手能力，培养科学精神。',
    children: [
      {
        num: 76,
        text: '实验室主要用来（ ）',
        options: [
          { key: 'A', text: '做实验' },
          { key: 'B', text: '休息' },
          { key: 'C', text: '吃饭' },
          { key: 'D', text: '运动' },
        ],
        correct: 'A',
        explanation:
          'Nguyên văn: “同学们可以做实验……” (Phòng thí nghiệm chủ yếu dùng để làm thí nghiệm).\n=> Đáp án đúng: (A) 做实验.',
      },
      {
        num: 77,
        text: '实验室里没有（ ）',
        options: [
          { key: 'A', text: '仪器' },
          { key: 'B', text: '药品' },
          { key: 'C', text: '器材' },
          { key: 'D', text: '玩具' },
        ],
        correct: 'D',
        explanation:
          'Bài đọc nêu phòng thí nghiệm có “仪器、药品和材料” (dụng cụ, hóa chất và vật liệu), không có đồ chơi (“玩具”).\n=> Đáp án đúng: (D) 玩具.',
      },
      {
        num: 78,
        text: '做实验不能（ ）',
        options: [
          { key: 'A', text: '记录数据' },
          { key: 'B', text: '遵守规则' },
          { key: 'C', text: '随意操作' },
          { key: 'D', text: '整理台面' },
        ],
        correct: 'C',
        explanation:
          'Khi làm thí nghiệm khoa học, tuyệt đối không được thao tác tùy tiện (“随意操作”).\n=> Đáp án đúng: (C) 随意操作.',
      },
      {
        num: 79,
        text: '实验室可以帮助我们（ ）',
        options: [
          { key: 'A', text: '提高动手能力' },
          { key: 'B', text: '浪费时间' },
          { key: 'C', text: '破坏环境' },
          { key: 'D', text: '玩耍打闹' },
        ],
        correct: 'A',
        explanation:
          'Nguyên văn câu cuối: “实验室帮助我们理解知识，提高动手能力，培养科学精神” (nâng cao năng lực thực hành).\n=> Đáp án đúng: (A) 提高动手能力.',
      },
      {
        num: 80,
        text: '实验室的意义是（ ）',
        options: [
          { key: 'A', text: '学习科学知识' },
          { key: 'B', text: '娱乐休闲' },
          { key: 'C', text: '销售物品' },
          { key: 'D', text: '锻炼身体' },
        ],
        correct: 'A',
        explanation:
          'Nguyên văn câu đầu và câu cuối: “实验室是学习科学的重要场所……帮助我们理解知识” (ý nghĩa của phòng thí nghiệm là học tập tri thức khoa học).\n=> Đáp án đúng: (A) 学习科学知识.',
      },
    ],
  },
];

async function main() {
  const pool = new Pool({ connectionString: dbUrl });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT id FROM exams WHERE title = $1 AND subject_id = $2 LIMIT 1',
      [EXAM_DATA.title, EXAM_DATA.subject_id],
    );

    let examId;
    if (existing.rows.length > 0) {
      examId = existing.rows[0].id;
      console.log(`Found existing exam ID=${examId}. Cleaning up old questions...`);
      await client.query(
        'DELETE FROM answers WHERE question_id IN (SELECT id FROM questions WHERE exam_id = $1)',
        [examId],
      );
      await client.query('DELETE FROM questions WHERE exam_id = $1', [examId]);
      await client.query(
        `UPDATE exams
         SET title_cn = $1, duration = $2, total_questions = $3, total_points = $4,
             is_premium = $5, language_mode = $6, explanation_language_mode = $7,
             description = $8, status = $9, updated_at = CURRENT_TIMESTAMP
         WHERE id = $10`,
        [
          EXAM_DATA.title_cn,
          EXAM_DATA.duration,
          EXAM_DATA.total_questions,
          EXAM_DATA.total_points,
          EXAM_DATA.is_premium,
          EXAM_DATA.language_mode,
          EXAM_DATA.explanation_language_mode,
          EXAM_DATA.description,
          EXAM_DATA.status,
          examId,
        ],
      );
    } else {
      const code = `TTTN20260425_${Math.floor(Date.now() / 1000) % 100000}`;
      const insertExam = await client.query(
        `INSERT INTO exams (
          subject_id, code, title, title_cn, description, duration,
          total_questions, total_points, difficulty_level, status,
          is_premium, language_mode, explanation_language_mode, publish_date, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10,
          $11, $12, $13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) RETURNING id`,
        [
          EXAM_DATA.subject_id,
          code,
          EXAM_DATA.title,
          EXAM_DATA.title_cn,
          EXAM_DATA.description,
          EXAM_DATA.duration,
          EXAM_DATA.total_questions,
          EXAM_DATA.total_points,
          EXAM_DATA.difficulty_level,
          EXAM_DATA.status,
          EXAM_DATA.is_premium,
          EXAM_DATA.language_mode,
          EXAM_DATA.explanation_language_mode,
        ],
      );
      examId = insertExam.rows[0].id;
      console.log(`Created new exam with ID=${examId}, Code=${code}`);
    }

    const pointsPerQ = Number((100.0 / 80.0).toFixed(2)); // 1.25
    let insertedCount = 0;
    const answerBatch = {
      qids: [],
      keys: [],
      texts: [],
      isCors: [],
    };

    for (const item of QUESTIONS_DATA) {
      const qtype = item.type;

      if (qtype === 'single_choice') {
        const qRes = await client.query(
          `INSERT INTO questions (
            exam_id, question_number, question_type, question_category,
            question_text, question_text_cn, question_text_en,
            points, difficulty, explanation, created_at
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, NULL,
            $7, 'medium', $8, CURRENT_TIMESTAMP
          ) RETURNING id`,
          [
            examId,
            item.num,
            qtype,
            item.category,
            item.text,
            item.text,
            pointsPerQ,
            item.explanation,
          ],
        );
        const qid = qRes.rows[0].id;

        for (const opt of item.options) {
          answerBatch.qids.push(qid);
          answerBatch.keys.push(opt.key);
          answerBatch.texts.push(opt.text);
          answerBatch.isCors.push(opt.key === item.correct);
        }
        insertedCount += 1;
      } else if (qtype === 'fill_blank_pool' || qtype === 'reading_passage') {
        const linkedOptsJson = item.linked_options ? JSON.stringify(item.linked_options) : null;
        const containerRes = await client.query(
          `INSERT INTO questions (
            exam_id, question_number, question_type, question_category,
            question_text, question_text_cn, question_text_en,
            passage_text, linked_options,
            points, difficulty, created_at
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, NULL,
            $7, $8::jsonb,
            0, 'medium', CURRENT_TIMESTAMP
          ) RETURNING id`,
          [
            examId,
            item.num,
            qtype,
            item.category,
            item.text,
            item.text,
            item.passage_text,
            linkedOptsJson,
          ],
        );
        const containerId = containerRes.rows[0].id;
        await client.query('UPDATE questions SET passage_group_id = id WHERE id = $1', [
          containerId,
        ]);

        const childType = qtype === 'fill_blank_pool' ? 'fill_blank_item' : 'reading_item';
        for (const child of item.children) {
          const childRes = await client.query(
            `INSERT INTO questions (
              exam_id, question_number, sub_question_number, passage_group_id,
              question_type, question_category,
              question_text, question_text_cn, question_text_en,
              points, difficulty, explanation, created_at
            ) VALUES (
              $1, $2, $3, $4,
              $5, $6,
              $7, $8, NULL,
              $9, 'medium', $10, CURRENT_TIMESTAMP
            ) RETURNING id`,
            [
              examId,
              child.num,
              child.num,
              containerId,
              childType,
              item.category,
              child.text,
              child.text,
              pointsPerQ,
              child.explanation,
            ],
          );
          const childId = childRes.rows[0].id;
          const opts = qtype === 'fill_blank_pool' ? item.linked_options : child.options;

          for (const opt of opts) {
            answerBatch.qids.push(childId);
            answerBatch.keys.push(opt.key);
            answerBatch.texts.push(opt.text);
            answerBatch.isCors.push(opt.key === child.correct);
          }
          insertedCount += 1;
        }
      }
    }

    await client.query(
      `INSERT INTO answers (question_id, answer_key, answer_text, answer_text_cn, answer_text_en, is_correct, created_at)
       SELECT qid, akey, atext, atext, NULL, is_cor, CURRENT_TIMESTAMP
       FROM UNNEST($1::int[], $2::text[], $3::text[], $4::boolean[]) AS t(qid, akey, atext, is_cor)`,
      [answerBatch.qids, answerBatch.keys, answerBatch.texts, answerBatch.isCors],
    );

    await client.query('COMMIT');
    console.log(`Successfully populated exam ID=${examId} with ${insertedCount} scorable questions!`);

    const verify = await client.query(
      `SELECT count(*) FILTER (WHERE question_number > 0) AS scorable_count,
              count(*) FILTER (WHERE question_number < 0) AS container_count,
              sum(points) FILTER (WHERE question_number > 0) AS total_points
       FROM questions WHERE exam_id = $1`,
      [examId],
    );
    console.log('Verification summary:', verify.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error seeding exam:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
