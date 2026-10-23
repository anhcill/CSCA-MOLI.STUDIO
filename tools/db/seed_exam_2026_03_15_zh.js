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
  title: '2026 年 3 月 15 日 CSCA 理科（中文）试卷',
  title_cn: '2026 年 3 月 15 日 CSCA 理科（中文）试卷',
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
    'Đề thi CSCA Lý khoa (Tiếng Trung Tự nhiên) mã đề 20260315 (Đầy đủ 80 câu). Bao gồm 6 phần: Nhận diện chữ Hán, Điền từ vào câu, Từ đồng nghĩa - trái nghĩa, Chọn từ điền chỗ trống KHTN, Hoàn thành câu và Đọc hiểu khoa học tự nhiên. Đã kiểm định QA/QC 100% kèm lời giải chi tiết.',
};

const QUESTIONS_DATA = [
  // ── 第一部分：识解汉字（1–10 题） ──
  {
    num: 1,
    type: 'single_choice',
    category: 'Nhận diện chữ Hán',
    text: '“这个实验的结果测量得很准，误差很小。”句中的“量”怎么读？（ ）',
    options: [
      { key: 'A', text: 'liáng' },
      { key: 'B', text: 'liàng' },
      { key: 'C', text: 'liang' },
      { key: 'D', text: 'lián' },
    ],
    correct: 'A',
    explanation:
      'Chữ “量” là chữ đa âm:\n- Đọc là liáng (thanh 2) khi làm động từ chỉ hành động đo đạc bằng dụng cụ: 测量 (cèliáng - đo lường), 量体温 (liáng tǐwēn - đo thân nhiệt).\n- Đọc là liàng (thanh 4) khi làm danh từ chỉ số lượng, khối lượng, dung tích: 质量 (zhìliàng - khối lượng), 容量 (róngliàng - dung tích), 数量 (shùliàng - số lượng).\nTrong từ “测量”, chữ “量” đọc là liáng.\n=> Đáp án đúng: (A) liáng.',
  },
  {
    num: 2,
    type: 'single_choice',
    category: 'Nhận diện chữ Hán',
    text: '“他调好了显微镜，开始观察细胞结构。”句中的“调”怎么读？（ ）',
    options: [
      { key: 'A', text: 'diào' },
      { key: 'B', text: 'tiáo' },
      { key: 'C', text: 'tiǎo' },
      { key: 'D', text: 'diāo' },
    ],
    correct: 'B',
    explanation:
      'Chữ “调” là chữ đa âm:\n- Đọc là tiáo (thanh 2) khi mang nghĩa điều chỉnh, căn chỉnh, hòa hợp: 调好 (tiáohǎo - chỉnh xong), 调节 (tiáojié - điều tiết/điều chỉnh), 调整 (tiáozhěng).\n- Đọc là diào (thanh 4) khi mang nghĩa điều động, khảo sát hoặc giai điệu: 调查 (diàochá - điều tra), 声调 (shēngdiào - thanh điệu).\nCăn chỉnh tiêu cự kính hiển vi (“调好显微镜”) đọc là tiáo.\n=> Đáp án đúng: (B) tiáo.',
  },
  {
    num: 3,
    type: 'single_choice',
    category: 'Nhận diện chữ Hán',
    text: '“盛”读音不同的一项是：（ ）',
    options: [
      { key: 'A', text: '盛水' },
      { key: 'B', text: '盛器' },
      { key: 'C', text: '盛开' },
      { key: 'D', text: '盛饭' },
    ],
    correct: 'C',
    explanation:
      '- (A) 盛水 (chéng shuǐ): múc/chứa nước -> đọc là chéng (động từ: chứa, đựng, làm đầy).\n- (B) 盛器 (chéng qì): vật chứa, đồ đựng -> đọc là chéng.\n- (C) 盛开 (shèng kāi): nở rộ (hoa) -> đọc là shèng (tính từ/phó từ: hưng thịnh, mạnh mẽ, rực rỡ).\n- (D) 盛饭 (chéng fàn): xới cơm vào bát -> đọc là chéng.\n=> Đáp án đúng: (C) 盛开.',
  },
  {
    num: 4,
    type: 'single_choice',
    category: 'Nhận diện chữ Hán',
    text: '“数”读音不同的一项是：（ ）',
    options: [
      { key: 'A', text: '数字' },
      { key: 'B', text: '数学' },
      { key: 'C', text: '数星星' },
      { key: 'D', text: '数据' },
    ],
    correct: 'C',
    explanation:
      '- (A) 数字 (shùzì - chữ số, con số): danh từ -> đọc là shù (thanh 4).\n- (B) 数学 (shùxué - toán học): danh từ -> đọc là shù (thanh 4).\n- (C) 数星星 (shǔ xīngxing - đếm sao): động từ đếm từng cái một -> đọc là shǔ (thanh 3).\n- (D) 数据 (shùjù - dữ liệu, số liệu): danh từ -> đọc là shù (thanh 4).\n=> Đáp án đúng: (C) 数星星.',
  },
  {
    num: 5,
    type: 'single_choice',
    category: 'Nhận diện chữ Hán',
    text: '“这个公式的计（suàn）过程一定要仔细，不能出错。”正确的汉字是：（ ）',
    options: [
      { key: 'A', text: '算' },
      { key: 'B', text: '篡' },
      { key: 'C', text: '蒜' },
      { key: 'D', text: '笋' },
    ],
    correct: 'A',
    explanation:
      '- 计算 (jìsuàn): tính toán công thức.\n- Phân biệt hình tự: 篡 (cuàn - soán đoạt), 蒜 (suàn - củ tỏi, có bộ Thảo đầu), 笋 (sǔn - măng tre).\n=> Đáp án đúng: (A) 算.',
  },
  {
    num: 6,
    type: 'single_choice',
    category: 'Nhận diện chữ Hán',
    text: '“实验前要检查仪（qì）是否正常运行。”正确的汉字是：（ ）',
    options: [
      { key: 'A', text: '气' },
      { key: 'B', text: '器' },
      { key: 'C', text: '汽' },
      { key: 'D', text: '泣' },
    ],
    correct: 'B',
    explanation:
      '- 仪器 (yíqì): dụng cụ, thiết bị khoa học/thí nghiệm.\n- Phân biệt đồng âm: 气 (khí/không khí), 汽 (hơi nước), 泣 (khóc).\n=> Đáp án đúng: (B) 器.',
  },
  {
    num: 7,
    type: 'single_choice',
    category: 'Nhận diện chữ Hán',
    text: '“烧杯中的液体达到了指定的容（liàng）。”正确的汉字是：（ ）',
    options: [
      { key: 'A', text: '量' },
      { key: 'B', text: '凉' },
      { key: 'C', text: '亮' },
      { key: 'D', text: '梁' },
    ],
    correct: 'A',
    explanation:
      '- 容量 (róngliàng): dung lượng, dung tích chứa của cốc đốt.\n- Phân biệt: 凉 (liáng - mát/lạnh), 亮 (liàng - sáng), 梁 (liáng - xà nhà/cầu).\n=> Đáp án đúng: (A) 量.',
  },
  {
    num: 8,
    type: 'single_choice',
    category: 'Nhận diện chữ Hán',
    text: '“完成实验后，要及时记（lù）数据和现象。”正确的汉字是：（ ）',
    options: [
      { key: 'A', text: '录' },
      { key: 'B', text: '陆' },
      { key: 'C', text: '禄' },
      { key: 'D', text: '碌' },
    ],
    correct: 'A',
    explanation:
      '- 记录 (jìlù): ghi chép dữ liệu và hiện tượng.\n- Phân biệt: 陆 (lù - đất liền/lục địa), 禄 (lù - bổng lộc), 碌 (lù - bận rộn trong 忙碌).\n=> Đáp án đúng: (A) 录.',
  },
  {
    num: 9,
    type: 'single_choice',
    category: 'Nhận diện chữ Hán',
    text: '下列哪个汉字的意思与“火/热”有关？（ ）',
    options: [
      { key: 'A', text: '河' },
      { key: 'B', text: '熔' },
      { key: 'C', text: '木' },
      { key: 'D', text: '土' },
    ],
    correct: 'B',
    explanation:
      'Chữ “熔” (róng - nóng chảy, nung chảy kim loại/chất rắn bằng nhiệt độ cao) có bộ Hỏa (火) ở bên trái, biểu thị ý nghĩa trực tiếp liên quan đến lửa và nhiệt năng (ví dụ: 熔化 - nóng chảy, 熔点 - nhiệt độ nóng chảy).\n- 河 có bộ Thủy (nước), 木 là cây gỗ, 土 là đất.\n=> Đáp án đúng: (B) 熔.',
  },
  {
    num: 10,
    type: 'single_choice',
    category: 'Nhận diện chữ Hán',
    text: '请选出“化”字意义不同的一项：（ ）',
    options: [
      { key: 'A', text: '这个物质发生了化学反应，生成了新物质。' },
      { key: 'B', text: '我们要学会化繁为简，梳理实验步骤。' },
      { key: 'C', text: '催化剂能加快反应速率，且本身性质不变。' },
      { key: 'D', text: '水遇冷会凝结，这是物理变化，不是化学变化。' },
    ],
    correct: 'B',
    explanation:
      '- Trong (A) 化学反应, (C) 催化剂, (D) 化学变化: Chữ “化” đều thuộc thuật ngữ chuyên ngành Hóa học (sự biến đổi tính chất chất/phản ứng hóa học).\n- Trong (B) 化繁为简 (hóa phồn vi giản): Chữ “化” dùng như một động từ độc lập trong cấu trúc thành ngữ “化 A 为 B” (chuyển đổi/biến đổi từ trạng thái phức tạp sang đơn giản trong tư duy, phương pháp làm việc).\n=> Đáp án đúng: (B).',
  },

  // ── 第二部分：词语填空（11–25 题） ──
  {
    num: -1,
    type: 'fill_blank_pool',
    category: 'Điền từ vào câu KHTN',
    text: '词语填空（11–15 题）',
    passage_text:
      '11. 做化学实验时，用玻璃棒 ______ 液体，能让溶质更快溶解。\n12. 实验结束后，我们需要对收集到的数据进行 ______，总结规律。\n13. 用刻度尺 ______ 物体的长度，要注意视线与刻度线相平。\n14. 混合溶液中的不溶性杂质，需要通过 ______ 的方法分离。\n15. 根据已知条件 ______ 出物体的运动速度，这是物理计算题的基础。',
    linked_options: [
      { key: 'A', text: '测量', textCn: '测量' },
      { key: 'B', text: '分析', textCn: '分析' },
      { key: 'C', text: '溶解', textCn: '溶解' },
      { key: 'D', text: '过滤', textCn: '过滤' },
      { key: 'E', text: '计算', textCn: '计算' },
      { key: 'F', text: '搅拌', textCn: '搅拌' },
    ],
    children: [
      {
        num: 11,
        text: '做化学实验时，用玻璃棒 ______ 液体，能让溶质更快溶解。',
        correct: 'F',
        explanation:
          'Khi làm thí nghiệm hóa học, dùng đũa thủy tinh khuấy (搅拌 - jiǎobàn) chất lỏng sẽ giúp chất tan hòa tan nhanh hơn.\n=> Đáp án đúng: (F) 搅拌.',
      },
      {
        num: 12,
        text: '实验结束后，我们需要对收集到的数据进行 ______，总结规律。',
        correct: 'B',
        explanation:
          'Sau khi kết thúc thí nghiệm, chúng ta cần tiến hành phân tích (分析 - fēnxī) các dữ liệu thu thập được để tổng kết quy luật.\n=> Đáp án đúng: (B) 分析.',
      },
      {
        num: 13,
        text: '用刻度尺 ______ 物体的长度，要注意视线与刻度线相平。',
        correct: 'A',
        explanation:
          'Dùng thước chia vạch để đo (测量 - cèliáng) chiều dài vật thể, cần chú ý tầm mắt ngang bằng với vạch chia.\n=> Đáp án đúng: (A) 测量.',
      },
      {
        num: 14,
        text: '混合溶液中的不溶性杂质，需要通过 ______ 的方法分离。',
        correct: 'D',
        explanation:
          'Tạp chất không tan trong dung dịch hỗn hợp cần được tách ra bằng phương pháp lọc (过滤 - guòlǜ).\n=> Đáp án đúng: (D) 过滤.',
      },
      {
        num: 15,
        text: '根据已知条件 ______ 出物体的运动速度，这是物理计算题的基础。',
        correct: 'E',
        explanation:
          'Dựa vào các điều kiện đã biết để tính toán (计算 - jìsuàn) ra vận tốc chuyển động của vật, đây là cơ sở của bài toán tính toán vật lý.\n=> Đáp án đúng: (E) 计算.',
      },
    ],
  },
  {
    num: -2,
    type: 'fill_blank_pool',
    category: 'Điền từ vào câu KHTN',
    text: '词语填空（16–20 题）',
    passage_text:
      '16. 玻璃容器的特点是 ______，能清晰观察到内部的实验现象。\n17. 做电学实验时，要选择 ______ 性能好的导线，保证电路通畅。\n18. 实验中使用的仪器要保持状态 ______，否则会影响实验结果。\n19. 刻度尺的刻度标注很 ______，能满足精细测量的需求。\n20. 酒精是 ______ 物质，实验时要远离明火，注意安全。',
    linked_options: [
      { key: 'A', text: '稳定', textCn: '稳定' },
      { key: 'B', text: '精确', textCn: '精确' },
      { key: 'C', text: '透明', textCn: '透明' },
      { key: 'D', text: '坚硬', textCn: '坚硬' },
      { key: 'E', text: '导电', textCn: '导电' },
      { key: 'F', text: '易燃', textCn: '易燃' },
    ],
    children: [
      {
        num: 16,
        text: '玻璃容器的特点是 ______，能清晰观察到内部的实验现象。',
        correct: 'C',
        explanation:
          'Đặc điểm của bình chứa bằng thủy tinh là trong suốt (透明 - tòumíng), có thể quan sát rõ hiện tượng thí nghiệm bên trong.\n=> Đáp án đúng: (C) 透明.',
      },
      {
        num: 17,
        text: '做电学实验时，要选择 ______ 性能好的导线，保证电路通畅。',
        correct: 'E',
        explanation:
          'Khi làm thí nghiệm điện học, cần chọn dây dẫn có tính năng dẫn điện (导电 - dǎodiàn) tốt để đảm bảo mạch điện thông suốt.\n=> Đáp án đúng: (E) 导电.',
      },
      {
        num: 18,
        text: '实验中使用的仪器要保持状态 ______，否则会影响实验结果。',
        correct: 'A',
        explanation:
          'Thiết bị sử dụng trong thí nghiệm phải duy trì trạng thái ổn định (稳定 - wěndìng), nếu không sẽ ảnh hưởng đến kết quả thí nghiệm.\n=> Đáp án đúng: (A) 稳定.',
      },
      {
        num: 19,
        text: '刻度尺的刻度标注很 ______，能满足精细测量的需求。',
        correct: 'B',
        explanation:
          'Vạch chia của thước được đánh dấu rất chuẩn xác (精确 - jīngquè), có thể đáp ứng nhu cầu đo đạc tinh vi.\n=> Đáp án đúng: (B) 精确.',
      },
      {
        num: 20,
        text: '酒精是 ______ 物质，实验时要远离明火，注意安全。',
        correct: 'F',
        explanation:
          'Cồn là chất dễ cháy (易燃 - yìrán), khi làm thí nghiệm phải tránh xa ngọn lửa trần, chú ý an toàn.\n=> Đáp án đúng: (F) 易燃.',
      },
    ],
  },
  {
    num: -3,
    type: 'fill_blank_pool',
    category: 'Điền từ vào câu KHTN',
    text: '词语填空（21–25 题）',
    passage_text:
      '21. 做对比实验时，要控制好单一 ______，确保实验结果的有效性。\n22. 实验前要检查实验 ______ 是否安装正确，避免出现故障。\n23. 化学实验中，使用的 ______ 要贴好标签，防止混淆。\n24. 经过多次实验和验证，我们最终得出了科学的 ______。\n25. 研究生物特性时，要采集足够数量的 ______，保证研究的普遍性。',
    linked_options: [
      { key: 'A', text: '原理', textCn: '原理' },
      { key: 'B', text: '装置', textCn: '装置' },
      { key: 'C', text: '变量', textCn: '变量' },
      { key: 'D', text: '结论', textCn: '结论' },
      { key: 'E', text: '试剂', textCn: '试剂' },
      { key: 'F', text: '样本', textCn: '样本' },
    ],
    children: [
      {
        num: 21,
        text: '做对比实验时，要控制好单一 ______，确保实验结果的有效性。',
        correct: 'C',
        explanation:
          'Khi làm thí nghiệm đối chứng, cần kiểm soát tốt biến số (变量 - biànliàng) duy nhất (phương pháp kiểm soát biến số - 控制变量法) để đảm bảo tính hiệu lực của kết quả thí nghiệm.\n=> Đáp án đúng: (C) 变量.',
      },
      {
        num: 22,
        text: '实验前要检查实验 ______ 是否安装正确，避免出现故障。',
        correct: 'B',
        explanation:
          'Trước khi thí nghiệm phải kiểm tra xem bộ thiết bị (装置 - zhuāngzhì) thí nghiệm đã được lắp đặt đúng chưa, tránh xảy ra sự cố.\n=> Đáp án đúng: (B) 装置.',
      },
      {
        num: 23,
        text: '化学实验中，使用的 ______ 要贴好标签，防止混淆。',
        correct: 'E',
        explanation:
          'Trong thí nghiệm hóa học, các thuốc thử/hóa chất (试剂 - shìjì) được sử dụng phải dán nhãn cẩn thận để tránh nhầm lẫn.\n=> Đáp án đúng: (E) 试剂.',
      },
      {
        num: 24,
        text: '经过多次实验和验证，我们最终得出了科学的 ______。',
        correct: 'D',
        explanation:
          'Trải qua nhiều lần thí nghiệm và kiểm chứng, cuối cùng chúng tôi đã rút ra được kết luận (结论 - jiélùn) khoa học.\n=> Đáp án đúng: (D) 结论.',
      },
      {
        num: 25,
        text: '研究生物特性时，要采集足够数量的 ______，保证研究的普遍性。',
        correct: 'F',
        explanation:
          'Khi nghiên cứu đặc tính sinh học, cần thu thập đủ số lượng mẫu vật (样本 - yàngběn) để đảm bảo tính phổ quát của nghiên cứu.\n=> Đáp án đúng: (F) 样本.',
      },
    ],
  },

  // ── 第三部分：近义反义词（26–33 题） ──
  {
    num: 26,
    type: 'single_choice',
    category: 'Từ đồng nghĩa - trái nghĩa',
    text: '“这个实验的结果非常准确，没有偏差。”与“准确”意思相近的词是：（ ）',
    options: [
      { key: 'A', text: '模糊' },
      { key: 'B', text: '精确' },
      { key: 'C', text: '大概' },
      { key: 'D', text: '错误' },
    ],
    correct: 'B',
    explanation:
      '“准确” (chính xác) đồng nghĩa với “精确” (chuẩn xác, độ chính xác cao).\n- 模糊: mơ hồ; 大概: đại khái; 错误: sai lầm.\n=> Đáp án đúng: (B) 精确.',
  },
  {
    num: 27,
    type: 'single_choice',
    category: 'Từ đồng nghĩa - trái nghĩa',
    text: '“在实验过程中，我们必须严格遵守操作规范。”与“严格”意思相近的词是：（ ）',
    options: [
      { key: 'A', text: '宽松' },
      { key: 'B', text: '随意' },
      { key: 'C', text: '严谨' },
      { key: 'D', text: '马虎' },
    ],
    correct: 'C',
    explanation:
      '“严格” (nghiêm ngặt, khắt khe) gần nghĩa nhất với “严谨” (nghiêm cẩn, chặt chẽ, cẩn trọng).\n- 宽松 (lỏng lẻo), 随意 (tùy tiện), 马虎 (cẩu thả) đều mang nghĩa trái ngược.\n=> Đáp án đúng: (C) 严谨.',
  },
  {
    num: 28,
    type: 'single_choice',
    category: 'Từ đồng nghĩa - trái nghĩa',
    text: '“这种材料的韧性很好，不容易断裂。”与“韧性”意思相近的词是：（ ）',
    options: [
      { key: 'A', text: '脆性' },
      { key: 'B', text: '弹性' },
      { key: 'C', text: '硬度' },
      { key: 'D', text: '密度' },
    ],
    correct: 'B',
    explanation:
      'Trong cơ học vật liệu, “韧性” (độ dẻo dai, khả năng chịu biến dạng lớn mà không đứt gãy) gần nghĩa nhất với “弹性” (tính đàn hồi).\n- 脆性 (tính giòn, dễ gãy vỡ) là từ trái nghĩa; 硬度 là độ cứng; 密度 là khối lượng riêng.\n=> Đáp án đúng: (B) 弹性.',
  },
  {
    num: 29,
    type: 'single_choice',
    category: 'Từ đồng nghĩa - trái nghĩa',
    text: '“我们要逐步推进实验，不能急于求成。”与“逐步”意思相近的词是：（ ）',
    options: [
      { key: 'A', text: '突然' },
      { key: 'B', text: '渐渐' },
      { key: 'C', text: '立刻' },
      { key: 'D', text: '快速' },
    ],
    correct: 'B',
    explanation:
      '“逐步” (từng bước một, tuần tự) gần nghĩa với “渐渐” (dần dần, từ từ).\n- 突然: đột nhiên; 立刻: ngay lập tức; 快速: nhanh chóng.\n=> Đáp án đúng: (B) 渐渐.',
  },
  {
    num: 30,
    type: 'single_choice',
    category: 'Từ đồng nghĩa - trái nghĩa',
    text: '“实验数据必须真实，不能伪造和修改。”与“真实”意思相近的词是：（ ）',
    options: [
      { key: 'A', text: '虚假' },
      { key: 'B', text: '客观' },
      { key: 'C', text: '片面' },
      { key: 'D', text: '主观' },
    ],
    correct: 'B',
    explanation:
      'Trong nghiên cứu khoa học, tính “真实” (chân thực, phản ánh đúng sự thật) tương ứng với tính “客观” (khách quan, tôn trọng thực tế).\n- 虚假: giả dối; 片面: phiến diện; 主观: chủ quan.\n=> Đáp án đúng: (B) 客观.',
  },
  {
    num: 31,
    type: 'single_choice',
    category: 'Từ đồng nghĩa - trái nghĩa',
    text: '“这个反应的速率很快，几分钟就完成了。”与“快”意思相反的词是：（ ）',
    options: [
      { key: 'A', text: '慢' },
      { key: 'B', text: '久' },
      { key: 'C', text: '长' },
      { key: 'D', text: '短' },
    ],
    correct: 'A',
    explanation:
      'Trái nghĩa với “快” (nhanh - chỉ tốc độ phản ứng) là “慢” (chậm).\n=> Đáp án đúng: (A) 慢.',
  },
  {
    num: 32,
    type: 'single_choice',
    category: 'Từ đồng nghĩa - trái nghĩa',
    text: '“纯水中的杂质含量很低，水质很纯净。”与“纯净”意思相反的词是：（ ）',
    options: [
      { key: 'A', text: '干净' },
      { key: 'B', text: '清澈' },
      { key: 'C', text: '浑浊' },
      { key: 'D', text: '透明' },
    ],
    correct: 'C',
    explanation:
      '“纯净” (tinh khiết, trong sạch không lẫn tạp chất) trái nghĩa với “浑浊” (vẩn đục do chứa nhiều tạp chất lơ lửng).\n=> Đáp án đúng: (C) 浑浊.',
  },
  {
    num: 33,
    type: 'single_choice',
    category: 'Từ đồng nghĩa - trái nghĩa',
    text: '“这种金属的熔点很高，不容易熔化。”与“高”意思相反的词是：（ ）',
    options: [
      { key: 'A', text: '大' },
      { key: 'B', text: '低' },
      { key: 'C', text: '小' },
      { key: 'D', text: '矮' },
    ],
    correct: 'B',
    explanation:
      'Khi nói về chỉ số nhiệt độ, điểm nóng chảy (熔点), điểm sôi (沸点), từ trái nghĩa với “高” (cao) bắt buộc dùng “低” (thấp), không dùng “矮” (chỉ chiều cao người/vật).\n=> Đáp án đúng: (B) 低.',
  },

  // ── 第四部分：选词填空（34–48 题） ──
  {
    num: -4,
    type: 'fill_blank_pool',
    category: 'Chọn từ điền chỗ trống KHTN',
    text: '选词填空（34–38 题）',
    passage_text:
      '34. 做实验时，要仔细 ______ 实验现象，不放过任何细节。\n35. 把每一组数据准确 ______ 下来，是后续分析的基础。\n36. 根据实验结果 ______ 出相关公式，实现理论与实践结合。\n37. 用新的实验方法 ______ 之前的结论，确保其科学性。\n38. 发现实验方案的不足后，要及时 ______，提高实验效率。',
    linked_options: [
      { key: 'A', text: '观察', textCn: '观察' },
      { key: 'B', text: '记录', textCn: '记录' },
      { key: 'C', text: '验证', textCn: '验证' },
      { key: 'D', text: '推导', textCn: '推导' },
      { key: 'E', text: '改进', textCn: '改进' },
    ],
    children: [
      {
        num: 34,
        text: '做实验时，要仔细 ______ 实验现象，不放过任何细节。',
        correct: 'A',
        explanation:
          'Khi làm thí nghiệm, phải quan sát (观察 - guānchá) kỹ hiện tượng thí nghiệm, không bỏ qua bất kỳ chi tiết nào.\n=> Đáp án đúng: (A) 观察.',
      },
      {
        num: 35,
        text: '把每一组数据准确 ______ 下来，是后续分析的基础。',
        correct: 'B',
        explanation:
          'Việc ghi chép (记录 - jìlù) chính xác từng nhóm dữ liệu lại là cơ sở cho việc phân tích tiếp theo.\n=> Đáp án đúng: (B) 记录.',
      },
      {
        num: 36,
        text: '根据实验结果 ______ 出相关公式，实现理论与实践结合。',
        correct: 'D',
        explanation:
          'Dựa vào kết quả thí nghiệm để suy diễn/thiết lập (推导 - tuīdǎo) ra công thức liên quan, thực hiện kết hợp lý thuyết với thực tiễn.\n=> Đáp án đúng: (D) 推导.',
      },
      {
        num: 37,
        text: '用新的实验方法 ______ 之前的结论，确保其科学性。',
        correct: 'C',
        explanation:
          'Dùng phương pháp thí nghiệm mới để kiểm chứng (验证 - yànzhèng) kết luận trước đó, đảm bảo tính khoa học của nó.\n=> Đáp án đúng: (C) 验证.',
      },
      {
        num: 38,
        text: '发现实验方案的不足后，要及时 ______，提高实验效率。',
        correct: 'E',
        explanation:
          'Sau khi phát hiện điểm thiếu sót của phương án thí nghiệm, cần kịp thời cải tiến (改进 - gǎijìn) để nâng cao hiệu suất thí nghiệm.\n=> Đáp án đúng: (E) 改进.',
      },
    ],
  },
  {
    num: -5,
    type: 'fill_blank_pool',
    category: 'Chọn từ điền chỗ trống KHTN',
    text: '选词填空（39–43 题）',
    passage_text:
      '39. 水的沸点会随外界 ______ 的变化而变化，气压越低，沸点越低。\n40. 物体所含物质的多少，叫做物体的 ______，其单位是千克。\n41. 单位体积的某种物质的质量，叫做这种物质的 ______。\n42. 酒精灯的火焰能提供 ______，使烧杯中的水温度升高。\n43. 测量液体的 ______ 时，要使用温度计，且玻璃泡不能接触容器壁。',
    linked_options: [
      { key: 'A', text: '能量', textCn: '能量' },
      { key: 'B', text: '质量', textCn: '质量' },
      { key: 'C', text: '温度', textCn: '温度' },
      { key: 'D', text: '压强', textCn: '压强' },
      { key: 'E', text: '密度', textCn: '密度' },
    ],
    children: [
      {
        num: 39,
        text: '水的沸点会随外界 ______ 的变化而变化，气压越低，沸点越低。',
        correct: 'D',
        explanation:
          'Nhiệt độ sôi của nước sẽ thay đổi theo sự thay đổi của áp suất (压强 - yāqiáng) bên ngoài; khí áp càng thấp thì nhiệt độ sôi càng thấp.\n=> Đáp án đúng: (D) 压强.',
      },
      {
        num: 40,
        text: '物体所含物质的多少，叫做物体的 ______，其单位是千克。',
        correct: 'B',
        explanation:
          'Lượng vật chất chứa trong vật thể được gọi là khối lượng (质量 - zhìliàng) của vật thể, đơn vị là kilôgam (kg).\n=> Đáp án đúng: (B) 质量.',
      },
      {
        num: 41,
        text: '单位体积的某种物质的质量，叫做这种物质的 ______。',
        correct: 'E',
        explanation:
          'Khối lượng của một đơn vị thể tích một chất nào đó được gọi là khối lượng riêng / mật độ (密度 - mìdù, $\\rho = \\frac{m}{V}$) của chất đó.\n=> Đáp án đúng: (E) 密度.',
      },
      {
        num: 42,
        text: '酒精灯的火焰能提供 ______，使烧杯中的水温度升高。',
        correct: 'A',
        explanation:
          'Ngọn lửa của đèn cồn có thể cung cấp năng lượng (能量 - néngliàng / nhiệt năng), làm cho nước trong cốc đốt tăng nhiệt độ.\n=> Đáp án đúng: (A) 能量.',
      },
      {
        num: 43,
        text: '测量液体的 ______ 时，要使用温度计，且玻璃泡不能接触容器壁。',
        correct: 'C',
        explanation:
          'Khi đo nhiệt độ (温度 - wēndù) của chất lỏng, phải sử dụng nhiệt kế và bầu thủy tinh không được chạm vào thành bình.\n=> Đáp án đúng: (C) 温度.',
      },
    ],
  },
  {
    num: -6,
    type: 'fill_blank_pool',
    category: 'Chọn từ điền chỗ trống KHTN',
    text: '选词填空（44–48 题）',
    passage_text:
      '44. 科学家们不断 ______ 未知的科学领域，推动科技进步。\n45. 掌握正确的实验 ______ 方法，是保证实验安全的前提。\n46. 经过多年的 ______，他终于发现了这种新的元素。\n47. 把科学理论转化为实际 ______，能为生活带来便利。\n48. 爱迪生经过上千次实验，终于 ______ 了电灯，照亮了世界。',
    linked_options: [
      { key: 'A', text: '操作', textCn: '操作' },
      { key: 'B', text: '研究', textCn: '研究' },
      { key: 'C', text: '应用', textCn: '应用' },
      { key: 'D', text: '探索', textCn: '探索' },
      { key: 'E', text: '发明', textCn: '发明' },
    ],
    children: [
      {
        num: 44,
        text: '科学家们不断 ______ 未知的科学领域，推动科技进步。',
        correct: 'D',
        explanation:
          'Các nhà khoa học không ngừng khám phá (探索 - tànsuǒ) những lĩnh vực khoa học chưa biết, thúc đẩy tiến bộ khoa học kỹ thuật.\n=> Đáp án đúng: (D) 探索.',
      },
      {
        num: 45,
        text: '掌握正确的实验 ______ 方法，是保证实验安全的前提。',
        correct: 'A',
        explanation:
          'Nắm vững phương pháp thao tác (操作 - cāozuò) thí nghiệm đúng đắn là tiền đề đảm bảo an toàn thí nghiệm.\n=> Đáp án đúng: (A) 操作.',
      },
      {
        num: 46,
        text: '经过多年的 ______，他终于发现了这种新的元素。',
        correct: 'B',
        explanation:
          'Trải qua nhiều năm nghiên cứu (研究 - yánjiū), cuối cùng ông đã phát hiện ra nguyên tố mới này.\n=> Đáp án đúng: (B) 研究.',
      },
      {
        num: 47,
        text: '把科学理论转化为实际 ______，能为生活带来便利。',
        correct: 'C',
        explanation:
          'Chuyển hóa lý thuyết khoa học thành ứng dụng (应用 - yìngyòng) thực tế có thể mang lại sự tiện lợi cho cuộc sống.\n=> Đáp án đúng: (C) 应用.',
      },
      {
        num: 48,
        text: '爱迪生经过上千次实验，终于 ______ 了电灯，照亮了世界。',
        correct: 'E',
        explanation:
          'Edison trải qua hàng ngàn lần thí nghiệm, cuối cùng đã phát minh (发明 - fāmíng) ra bóng đèn điện, thắp sáng thế giới.\n=> Đáp án đúng: (E) 发明.',
      },
    ],
  },

  // ── 第五部分：补全语句（49–70 题） ──
  {
    num: 49,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '这个实验太复杂了，我没有做 ______。（ ）',
    options: [
      { key: 'A', text: '完' },
      { key: 'B', text: '好' },
      { key: 'C', text: '成' },
      { key: 'D', text: '透' },
    ],
    correct: 'A',
    explanation:
      'Bổ ngữ kết quả “做完” (làm xong, hoàn tất). Do thí nghiệm quá phức tạp nên chưa hoàn thành xong (“没有做完”).\n=> Đáp án đúng: (A) 完.',
  },
  {
    num: 50,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '他 ______ 昨天完成的这个重要实验。（ ）',
    options: [
      { key: 'A', text: '才' },
      { key: 'B', text: '是' },
      { key: 'C', text: '刚' },
      { key: 'D', text: '都' },
    ],
    correct: 'B',
    explanation:
      'Cấu trúc câu nhấn mạnh “是……的” (“他是昨天完成的这个重要实验” = “他是昨天完成这个重要实验的”), dùng để nhấn mạnh thời gian (“昨天”) của một hành động đã hoàn tất trong quá khứ.\n=> Đáp án đúng: (B) 是.',
  },
  {
    num: 51,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '我花了三个小时 ______ 把这个物理模型做好。（ ）',
    options: [
      { key: 'A', text: '就' },
      { key: 'B', text: '又' },
      { key: 'C', text: '才' },
      { key: 'D', text: '也' },
    ],
    correct: 'C',
    explanation:
      'Phân biệt phó từ “就” và “才”:\n- “就” biểu thị thời gian ngắn, diễn ra sớm và dễ dàng.\n- “才” biểu thị thời gian kéo dài, tốn nhiều công sức/thời gian (“花了三个小时” - mất 3 tiếng) thì hành động mới hoàn thành.\n=> Đáp án đúng: (C) 才.',
  },
  {
    num: 52,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '公式 ______ 解决力学问题非常有用。（ ）',
    options: [
      { key: 'A', text: '对' },
      { key: 'B', text: '跟' },
      { key: 'C', text: '比' },
      { key: 'D', text: '和' },
    ],
    correct: 'A',
    explanation:
      'Cấu trúc giới từ cố định: “对……（非常）有用” (có ích/hữu ích đối với việc gì).\n- Lưu ý QA/QC: Bản in gốc bị rơi chữ “公” ở đầu câu, câu chuẩn là “公式对解决力学问题非常有用。”\n=> Đáp án đúng: (A) 对.',
  },
  {
    num: 53,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '在标准大气压下，水的沸点比酒精的沸点 ______。（ ）',
    options: [
      { key: 'A', text: '高' },
      { key: 'B', text: '更高' },
      { key: 'C', text: '很高' },
      { key: 'D', text: '一点儿高' },
    ],
    correct: 'B',
    explanation:
      '- Về kiến thức Vật lý - Hóa học: Ở $1\\text{ atm}$, nhiệt độ sôi của nước là $100^\\circ\\text{C}$, còn của cồn (ethanol) là khoảng $78.3^\\circ\\text{C}$.\n- Về ngữ pháp: Trong câu so sánh hơn với phó từ mức độ, dùng “更高” (cao hơn).\n=> Đáp án đúng: (B) 更高.',
  },
  {
    num: 54,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '外国人 ______ 喜欢中国的航天技术，中国人更是引以为傲。（ ）',
    options: [
      { key: 'A', text: '不但现在' },
      { key: 'B', text: '现在不但' },
      { key: 'C', text: '不但中国人' },
      { key: 'D', text: '中国人不但' },
    ],
    correct: 'B',
    explanation:
      '- Đầu câu đã có chủ ngữ “外国人”, nên loại ngay (C) và (D).\n- Ở đây so sánh tăng tiến giữa “外国人” và “中国人”, nên danh từ chỉ thời gian “现在” đứng trước liên từ “不但”: “外国人现在不但喜欢……，中国人更是……”.\n=> Đáp án đúng: (B) 现在不但.',
  },
  {
    num: 55,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '做完实验后，我想 ______。（ ）',
    options: [
      { key: 'A', text: '个手洗' },
      { key: 'B', text: '洗手个' },
      { key: 'C', text: '洗个手' },
      { key: 'D', text: '手个洗' },
    ],
    correct: 'C',
    explanation:
      '“洗手” (rửa tay) là động từ ly hợp (离合词: 洗 là động từ, 手 là tân ngữ). Khi thêm lượng từ “个” để biểu thị hành động diễn ra nhẹ nhàng, nhanh gọn, phải chèn “个” vào giữa động từ và tân ngữ: “洗个手”.\n=> Đáp án đúng: (C) 洗个手.',
  },
  {
    num: 56,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '我永远忘不了那个 ______。（ ）',
    options: [
      { key: 'A', text: '在实验室认真做实验的年轻科学家' },
      { key: 'B', text: '认真做实验在实验室年轻的科学家' },
      { key: 'C', text: '在实验室年轻认真做实验的科学家' },
      { key: 'D', text: '年轻在实验室做实验认真的科学家' },
    ],
    correct: 'A',
    explanation:
      'Quy tắc trật tự nhiều định ngữ (多项定语顺序) trong tiếng Trung:\n1. Đại từ chỉ thị/số lượng (那个)\n2. Cụm giới từ chỉ địa điểm + cụm động từ miêu tả hành động + 的 (在实验室认真做实验的)\n3. Tính từ chỉ tính chất đặc điểm trực tiếp (年轻)\n4. Danh từ trung tâm (科学家)\n=> Đáp án đúng: (A) 在实验室认真做实验的年轻科学家.',
  },
  {
    num: 57,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '我们希望同学们能够 ______。（ ）',
    options: [
      { key: 'A', text: '一直保持严谨的实验态度下去' },
      { key: 'B', text: '把严谨的实验态度一直保持下去' },
      { key: 'C', text: '一直保持下去严谨的实验态度' },
      { key: 'D', text: '把严谨的实验态度保持一直下去' },
    ],
    correct: 'B',
    explanation:
      'Khi động từ kết hợp với bổ ngữ xu hướng kép chỉ sự tiếp diễn (保持下去) và có tân ngữ dài (严谨的实验态度), tiếng Trung dùng câu chữ “把” đưa tân ngữ lên trước động từ, và phó từ “一直” đứng ngay trước động từ “保持”:\n把 + 严谨的实验态度 + 一直 + 保持 + 下去.\n=> Đáp án đúng: (B) 把严谨的实验态度一直保持下去.',
  },
  {
    num: 58,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '他的实验成果获得了国家科技奖，同事们都来向他 ______。（ ）',
    options: [
      { key: 'A', text: '表示祝贺' },
      { key: 'B', text: '赢得支持' },
      { key: 'C', text: '送上感谢' },
      { key: 'D', text: '付出关心' },
    ],
    correct: 'A',
    explanation:
      'Khi một người đạt giải thưởng lớn, đồng nghiệp đến chúc mừng theo cấu trúc cố định: “向某人表示祝贺” (gửi lời chúc mừng tới ai đó).\n=> Đáp án đúng: (A) 表示祝贺.',
  },
  {
    num: 59,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '科学实验是一件很有意义的事，我们要 ______ 实验的乐趣。（ ）',
    options: [
      { key: 'A', text: '宣传文化' },
      { key: 'B', text: '充分享受' },
      { key: 'C', text: '相当精彩' },
      { key: 'D', text: '诸多方面' },
    ],
    correct: 'B',
    explanation:
      'Cụm kết hợp Động - Tân chuẩn xác với tân ngữ “乐趣” (niềm vui) là “充分享受……的乐趣” (tận hưởng trọn vẹn niềm vui của...).\n=> Đáp án đúng: (B) 充分享受.',
  },
  {
    num: 60,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '学好数学很重要，它就像一把钥匙，让我明白了 ______。（ ）',
    options: [
      { key: 'A', text: '数学的无用' },
      { key: 'B', text: '理科学习的重要性' },
      { key: 'C', text: '学习的枯燥' },
      { key: 'D', text: '实验的麻烦' },
    ],
    correct: 'B',
    explanation:
      'Vế trước khẳng định vai trò tích cực của Toán học (“很重要，像一把钥匙”), nên vế sau phải mang ý nghĩa tích cực tương ứng: “理科学习的重要性” (tầm quan trọng của việc học tự nhiên).\n=> Đáp án đúng: (B) 理科学习的重要性.',
  },
  {
    num: 61,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '牛顿的万有引力定律充满智慧和思考，读懂它就能感受到 ______。（ ）',
    options: [
      { key: 'A', text: '科学的魅力' },
      { key: 'B', text: '文学的优美' },
      { key: 'C', text: '艺术的浪漫' },
      { key: 'D', text: '历史的厚重' },
    ],
    correct: 'A',
    explanation:
      'Định luật vạn vật hấp dẫn (万有引力定律) là định luật Vật lý - Khoa học, nên giúp cảm nhận được “科学的魅力” (sức hấp dẫn của khoa học).\n=> Đáp án đúng: (A) 科学的魅力.',
  },
  {
    num: 62,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '理科生要学会观察与思考，这些都是他们进行 ______ 的重要能力。（ ）',
    options: [
      { key: 'A', text: '文学创作' },
      { key: 'B', text: '艺术欣赏' },
      { key: 'C', text: '科学研究' },
      { key: 'D', text: '历史考证' },
    ],
    correct: 'C',
    explanation:
      'Chủ thể là “理科生” (học sinh ban Khoa học Tự nhiên), kỹ năng quan sát và tư duy phục vụ trực tiếp cho “科学研究” (nghiên cứu khoa học).\n=> Đáp án đúng: (C) 科学研究.',
  },
  {
    num: 63,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '实验比赛快开始了，同学们正 ______ 地准备着实验器材。（ ）',
    options: [
      { key: 'A', text: '开开心心' },
      { key: 'B', text: '急急忙忙' },
      { key: 'C', text: '整整齐齐' },
      { key: 'D', text: '干干净净' },
    ],
    correct: 'B',
    explanation:
      'Bối cảnh “比赛快开始了” (cuộc thi sắp bắt đầu tới nơi) đòi hỏi trạng ngữ chỉ sự khẩn trương, gấp gáp chuẩn bị dụng cụ: “急急忙忙” (vội vàng, khẩn trương).\n=> Đáp án đúng: (B) 急急忙忙.',
  },
  {
    num: 64,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '不管是居里夫人发现镭，还是屠呦呦提取青蒿素，都深深印在我心里，让我 ______。（ ）',
    options: [
      { key: 'A', text: '非常开心' },
      { key: 'B', text: '难以忘记' },
      { key: 'C', text: '特别舒服' },
      { key: 'D', text: '不会难过' },
    ],
    correct: 'B',
    explanation:
      'Cụm “深深印在我心里” (in đậm sâu sắc trong tâm trí tôi) tương ứng trực tiếp với hệ quả “难以忘记” (khó lòng quên được).\n=> Đáp án đúng: (B) 难以忘记.',
  },
  {
    num: 65,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '实验室里有很多仪器，有的是显微镜，有的是烧杯，______ 是酒精灯，用途各不相同。（ ）',
    options: [
      { key: 'A', text: '再有的' },
      { key: 'B', text: '还有的' },
      { key: 'C', text: '其他的' },
      { key: 'D', text: '另有的' },
    ],
    correct: 'B',
    explanation:
      'Cấu trúc liệt kê nhiều đối tượng trong tiếng Trung: “有的是……，有的是……，还有的是……” (có cái là..., có cái là..., còn có cái là...).\n=> Đáp án đúng: (B) 还有的.',
  },
  {
    num: 66,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '爱因斯坦的相对论指出，时间和空间不是独立的，而是互相 ______。（ ）',
    options: [
      { key: 'A', text: '没关系' },
      { key: 'B', text: '有关系' },
      { key: 'C', text: '能分开' },
      { key: 'D', text: '相矛盾' },
    ],
    correct: 'B',
    explanation:
      'Cấu trúc đối lập “不是……，而是……” (không phải là..., mà là...). Trái ngược với “独立的” (độc lập, tách biệt) là “互相有关系” (có mối quan hệ/liên hệ lẫn nhau).\n=> Đáp án đúng: (B) 有关系.',
  },
  {
    num: 67,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '天平是一种 ______，放在水平台上，调节平衡螺母，就能测量物体的质量。（ ）',
    options: [
      { key: 'A', text: '测量工具' },
      { key: 'B', text: '绘画材料' },
      { key: 'C', text: '书写工具' },
      { key: 'D', text: '演奏乐器' },
    ],
    correct: 'A',
    explanation:
      'Cân đĩa (天平) dùng để đo khối lượng vật thể (测量物体的质量), nên nó là một “测量工具” (dụng cụ đo lường).\n=> Đáp án đúng: (A) 测量工具.',
  },
  {
    num: 68,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '元素周期表由门捷列夫编制，按原子序数排列，是化学领域一套 ______。（ ）',
    options: [
      { key: 'A', text: '绘画体系' },
      { key: 'B', text: '文字系统' },
      { key: 'C', text: '音乐体系' },
      { key: 'D', text: '科学体系' },
    ],
    correct: 'D',
    explanation:
      'Bảng tuần hoàn các nguyên tố hóa học (元素周期表) do Mendeleev biên soạn thuộc lĩnh vực Hóa học, là một “科学体系” (hệ thống khoa học).\n=> Đáp án đúng: (D) 科学体系.',
  },
  {
    num: 69,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '《昆虫记》是一部科学著作，里面的法布尔很细心，他 ______，观察昆虫的生活习性。（ ）',
    options: [
      { key: 'A', text: '走来走去' },
      { key: 'B', text: '蹲来蹲去' },
      { key: 'C', text: '游来游去' },
      { key: 'D', text: '飞来飞去' },
    ],
    correct: 'B',
    explanation:
      'Nhà côn trùng học Jean-Henri Fabre quan sát côn trùng nhỏ bé dưới mặt đất/bụi cỏ một cách tỉ mỉ (很细心), nên hành động đặc trưng của ông là ngồi xổm sát mặt đất hết chỗ này sang chỗ khác (“蹲来蹲去”).\n=> Đáp án đúng: (B) 蹲来蹲去.',
  },
  {
    num: 70,
    type: 'single_choice',
    category: 'Hoàn thành câu',
    text: '理科有四个重要的学科：物理、化学、生物、数学，每个学科都有自己特别的 ______。（ ）',
    options: [
      { key: 'A', text: '庆祝方式' },
      { key: 'B', text: '研究方法' },
      { key: 'C', text: '相同意义' },
      { key: 'D', text: '唱歌跳舞' },
    ],
    correct: 'B',
    explanation:
      'Mỗi bộ môn khoa học tự nhiên (Toán, Lý, Hóa, Sinh) đều có “研究方法” (phương pháp nghiên cứu) đặc trưng riêng.\n=> Đáp án đúng: (B) 研究方法.',
  },

  // ── 第六部分：阅读理解（71–80 题） ──
  {
    num: -7,
    type: 'reading_passage',
    category: 'Đọc hiểu KHTN',
    text: '阅读理解（71–72 题）',
    passage_text:
      '你知道做科学实验时需要注意什么吗？首先，实验前要认真检查实验器材，确认仪器完好、试剂齐全，避免实验中出现故障。其次，操作时要严格按照实验步骤进行，不能随意更改，否则会导致实验结果偏差。另外，一定要及时、准确地记录实验数据和现象，数据是分析结论的重要依据，不能遗漏或伪造。最后，实验结束后要整理好器材，清理实验台，保持实验室整洁。',
    children: [
      {
        num: 71,
        text: '短文主要介绍了做科学实验时：（ ）',
        options: [
          { key: 'A', text: '如何整理实验台' },
          { key: 'B', text: '需注意的方面' },
          { key: 'C', text: '如何选择试剂' },
          { key: 'D', text: '器材的种类' },
        ],
        correct: 'B',
        explanation:
          'Câu mở đầu nêu rõ chủ đề toàn đoạn: “你知道做科学实验时需要注意什么吗？” (Bạn có biết khi làm thí nghiệm khoa học cần chú ý những gì không?), tiếp theo liệt kê 4 lưu ý qua 首先、其次、另外、最后.\n=> Đáp án đúng: (B) 需注意的方面.',
      },
      {
        num: 72,
        text: '实验数据的作用是：（ ）',
        options: [
          { key: 'A', text: '装饰实验报告' },
          { key: 'B', text: '分析结论的依据' },
          { key: 'C', text: '随意记录即可' },
          { key: 'D', text: '展示给同学看' },
        ],
        correct: 'B',
        explanation:
          'Trích dẫn nguyên văn trong bài: “数据是分析结论的重要依据” (Dữ liệu là căn cứ quan trọng để phân tích kết luận).\n=> Đáp án đúng: (B) 分析结论的依据.',
      },
    ],
  },
  {
    num: -8,
    type: 'reading_passage',
    category: 'Đọc hiểu KHTN',
    text: '阅读理解（73–75 题）',
    passage_text:
      '在理科研究中，观察是非常重要的方法，很多发现都源于细致的观察。不过，科学观察并不是简单的“看”，而是有目的、有计划的感知活动。【甲】观察前要明确观察目标，确定观察的对象和范围；【乙】与日常观察不同，科学观察需要使用工具，比如用显微镜观察细胞，用望远镜观察星空；【丙】使用观察工具，主要是为了突破人类感官的限制，看到更细微、更遥远的事物；【丁】有工具辅助，但观察者的细心和耐心至今仍不可或缺，______ 是观察短暂的实验现象，需要高度集中注意力，才能捕捉到关键信息。观察结束后，还要对观察结果进行整理和分析，才能为研究提供有效支持。',
    children: [
      {
        num: 73,
        text: '“尽管”填入短文中哪一处比较合适？（ ）',
        options: [
          { key: 'A', text: '甲' },
          { key: 'B', text: '乙' },
          { key: 'C', text: '丙' },
          { key: 'D', text: '丁' },
        ],
        correct: 'D',
        explanation:
          'Tại vị trí 【丁】, vế sau có liên từ chuyển ngoặt “但” (“但观察者的细心和耐心至今仍不可或缺”). Điền “尽管” vào 【丁】 tạo thành cặp liên từ nhượng bộ - chuyển ngoặt kinh điển “尽管……，但……” (Mặc dù có công cụ hỗ trợ, nhưng sự tỉ mỉ và kiên nhẫn của người quan sát vẫn không thể thiếu).\n=> Đáp án đúng: (D) 丁.',
      },
      {
        num: 74,
        text: '填入文中“______”处，最合适的词语是：（ ）',
        options: [
          { key: 'A', text: '尤其' },
          { key: 'B', text: '究竟' },
          { key: 'C', text: '反而' },
          { key: 'D', text: '甚至' },
        ],
        correct: 'A',
        explanation:
          'Vế trước khẳng định sự tỉ mỉ và kiên nhẫn là không thể thiếu, vế sau nhấn mạnh thêm một trường hợp điển hình bậc nhất (“是观察短暂的实验现象” - là khi quan sát các hiện tượng thí nghiệm diễn ra trong chốc lát). Phó từ “尤其” (đặc biệt là / nhất là) dùng để nhấn mạnh tầng ý sâu hơn.\n=> Đáp án đúng: (A) 尤其.',
      },
      {
        num: 75,
        text: '科学观察为什么需要使用工具？（ ）',
        options: [
          { key: 'A', text: '为了让观察更有趣' },
          { key: 'B', text: '突破人类感官的限制' },
          { key: 'C', text: '为了节省观察时间' },
          { key: 'D', text: '方便与同学交流' },
        ],
        correct: 'B',
        explanation:
          'Trích dẫn nguyên văn trong bài: “使用观察工具，主要是为了突破人类感官的限制，看到更细微、更遥远的事物” (Sử dụng công cụ quan sát chủ yếu là để vượt qua giới hạn giác quan của con người).\n=> Đáp án đúng: (B) 突破人类感官的限制.',
      },
    ],
  },
  {
    num: -9,
    type: 'reading_passage',
    category: 'Đọc hiểu KHTN',
    text: '阅读理解（76–77 题）',
    passage_text:
      '不知道你发现了没有，在理科实验中，实验仪器的铭牌上都会标注关键参数，由字母、数字和单位共同组成。比如“200mL”这个标识，“mL”是体积单位毫升，代表这个烧杯的最大容量是 200 毫升。所以，看仪器铭牌上的参数，就能知道这款仪器的性能和使用范围，避免因超量程使用导致仪器损坏。',
    children: [
      {
        num: 76,
        text: '理科实验仪器的铭牌上包含什么？（ ）',
        options: [
          { key: 'A', text: '仪器颜色' },
          { key: 'B', text: '生产厂家' },
          { key: 'C', text: '关键参数' },
          { key: 'D', text: '实验者姓名' },
        ],
        correct: 'C',
        explanation:
          'Trích dẫn nguyên văn câu đầu: “实验仪器的铭牌上都会标注关键参数” (Trên nhãn của thiết bị thí nghiệm đều ghi chú các thông số then chốt).\n=> Đáp án đúng: (C) 关键参数.',
      },
      {
        num: 77,
        text: '通过仪器铭牌，我们可以知道什么？（ ）',
        options: [
          { key: 'A', text: '仪器的使用范围' },
          { key: 'B', text: '仪器的购买价格' },
          { key: 'C', text: '仪器的摆放位置' },
          { key: 'D', text: '仪器的生产时间' },
        ],
        correct: 'A',
        explanation:
          'Trích dẫn nguyên văn câu cuối: “看仪器铭牌上的参数，就能知道这款仪器的性能和使用范围” (Nhìn thông số trên nhãn thiết bị sẽ biết được tính năng và phạm vi sử dụng của thiết bị đó).\n=> Đáp án đúng: (A) 仪器的使用范围.',
      },
    ],
  },
  {
    num: -10,
    type: 'reading_passage',
    category: 'Đọc hiểu KHTN',
    text: '阅读理解（78–80 题）',
    passage_text:
      '科学实验室，是理科学习和研究的重要阵地。它们分布在校园和科研院所的各个区域，为师生和科研人员提供了专业、安全的实验研究空间。在这里，仪器不仅是实验的工具，更是科学探索的桥梁，引领着研究者们揭开自然的奥秘。科学实验室的意义深远。首先，它们为理科学习提供了实践平台，让学习者把理论知识转化为实际操作能力，加深对知识的理解。在抽象的理科学习中，实验室成为了连接理论与实践的重要纽带。其次，科学实验室还是科研创新的核心场所。各类科学实验、技术研发、课题研究等活动在这里开展，研究者们可以在这里验证猜想、探索未知，推动科学技术的创新与发展。此外，科学实验室还能培养研究者的科学素养。在实验过程中，研究者会养成严谨、认真、求实的态度，提升观察、分析和解决问题的能力。同时，实验室的团队合作实验，还能培养研究者的协作意识。总之，科学实验室不仅是做实验的场所，更是科学精神的传承地。它们以其专业的配置，为理科研究和学习注入了动力，成为理科领域不可或缺的一部分。',
    children: [
      {
        num: 78,
        text: '科学实验室的主要功能是：（ ）',
        options: [
          { key: 'A', text: '提供实验研究空间' },
          { key: 'B', text: '销售实验仪器' },
          { key: 'C', text: '举办文艺活动' },
          { key: 'D', text: '存放图书资料' },
        ],
        correct: 'A',
        explanation:
          'Trích dẫn nguyên văn câu thứ hai: “为师生和科研人员提供了专业、安全的实验研究空间” (Cung cấp không gian nghiên cứu thí nghiệm chuyên nghiệp, an toàn cho thầy trò và nhân viên nghiên cứu).\n=> Đáp án đúng: (A) 提供实验研究空间.',
      },
      {
        num: 79,
        text: '科学实验室的意义包括以下哪一项？（ ）',
        options: [
          { key: 'A', text: '成为旅游景点' },
          { key: 'B', text: '提供理科实践平台' },
          { key: 'C', text: '销售理科书籍' },
          { key: 'D', text: '举办体育比赛' },
        ],
        correct: 'B',
        explanation:
          'Trích dẫn nguyên văn: “科学实验室的意义深远。首先，它们为理科学习提供了实践平台” (Trước hết, chúng cung cấp nền tảng thực hành cho việc học các môn tự nhiên).\n=> Đáp án đúng: (B) 提供理科实践平台.',
      },
      {
        num: 80,
        text: '科学实验室通过什么方式推动科学技术的创新与发展？（ ）',
        options: [
          { key: 'A', text: '举办书法比赛' },
          { key: 'B', text: '开展科学实验和技术研发' },
          { key: 'C', text: '销售电子产品' },
          { key: 'D', text: '组织旅游活动' },
        ],
        correct: 'B',
        explanation:
          'Trích dẫn nguyên văn: “各类科学实验、技术研发、课题研究等活动在这里开展，研究者们可以在这里验证猜想、探索未知，推动科学技术的创新与发展” (Triển khai các hoạt động thí nghiệm khoa học và nghiên cứu phát triển công nghệ).\n=> Đáp án đúng: (B) 开展科学实验和技术研发.',
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
      const code = `TTTN20260315_${Math.floor(Date.now() / 1000) % 100000}`;
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
          const isCor = opt.key === item.correct;
          await client.query(
            `INSERT INTO answers (
              question_id, answer_key, answer_text, answer_text_cn, answer_text_en, is_correct, created_at
            ) VALUES ($1, $2, $3, $4, NULL, $5, CURRENT_TIMESTAMP)`,
            [qid, opt.key, opt.text, opt.text, isCor],
          );
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
            const isCor = opt.key === child.correct;
            await client.query(
              `INSERT INTO answers (
                question_id, answer_key, answer_text, answer_text_cn, answer_text_en, is_correct, created_at
              ) VALUES ($1, $2, $3, $4, NULL, $5, CURRENT_TIMESTAMP)`,
              [childId, opt.key, opt.text, opt.text, isCor],
            );
          }
          insertedCount += 1;
        }
      }
    }

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
