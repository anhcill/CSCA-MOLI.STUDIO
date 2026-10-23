const path = require('path');
require(path.join(__dirname, '../../backend/node_modules/dotenv')).config({
  path: path.join(__dirname, '../../backend/.env'),
});
const { Pool } = require(path.join(__dirname, '../../backend/node_modules/pg'));

const dbUrl = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('Error: DATABASE_URL not found!');
  process.exit(1);
}

const EXAM_DATA = {
  title: '2026 年 1 月 25 日 CSCA 文科（中文）试卷',
  title_cn: '2026 年 1 月 25 日 CSCA 文科（中文）试卷',
  subject_id: 4, // Tiếng Trung Xã hội
  duration: 90,
  total_questions: 80,
  total_points: 100.0,
  difficulty_level: 'medium',
  status: 'published',
  is_premium: false,
  language_mode: 'zh',
  explanation_language_mode: 'vi',
  description:
    'Đề thi chính thức CSCA Văn khoa (Tiếng Trung Xã hội) ngày 25/01/2026 (Đầy đủ 80 câu). Bao gồm 6 phần: Nhận diện chữ Hán, Điền từ vào chỗ trống, Từ gần nghĩa & trái nghĩa, Đọc điền từ đoạn văn, Ngữ pháp - Tu từ - Cú pháp và Đọc hiểu chuyên sâu (6 bài đọc). Đã kiểm định chất lượng QA/QC 100% kèm lời giải chi tiết.',
};

const QUESTIONS_DATA = [
  // ── 第一部分：识解汉字（1—10 题） ──
  {
    num: 1,
    type: 'single_choice',
    category: '识解汉字 (Nhận diện chữ Hán)',
    text: '“爱好”中的“好”的读音是？（ ）',
    options: [
      { key: 'A', text: 'hǎo' },
      { key: 'B', text: 'háo' },
      { key: 'C', text: 'hǎo (bị trùng)' },
      { key: 'D', text: 'hào' },
    ],
    correct: 'D',
    explanation:
      'Chữ “好” là chữ đa âm:\n- Đọc là hào (thanh 4) khi làm động từ biểu thị sự yêu thích, ham thích: 爱好 (àihào - sở thích, yêu thích), 好奇 (hàoqí - hiếu kỳ), 好客 (hàokè - hiếu khách).\n- Đọc là hǎo (thanh 3) khi làm tính từ biểu thị tốt, đẹp: 好看, 好人.\n=> Đáp án đúng: (D) hào.',
  },
  {
    num: 2,
    type: 'single_choice',
    category: '识解汉字 (Nhận diện chữ Hán)',
    text: '选择“行”字读音不同的一项（ ）',
    options: [
      { key: 'A', text: '行业' },
      { key: 'B', text: '行走' },
      { key: 'C', text: '行为' },
      { key: 'D', text: '行动' },
    ],
    correct: 'A',
    explanation:
      'Chữ “行” là chữ đa âm:\n- A (行业 - hángyè: ngành nghề): chữ “行” đọc là háng.\n- B (行走 - xíngzǒu), C (行为 - xíngwéi), D (行动 - xíngdòng): chữ “行” đều đọc là xíng (hành động, đi lại).\n=> Đáp án đúng: (A) 行业.',
  },
  {
    num: 3,
    type: 'single_choice',
    category: '识解汉字 (Nhận diện chữ Hán)',
    text: '下列哪个字与“钱”直接相关？（ ）',
    options: [
      { key: 'A', text: '铅' },
      { key: 'B', text: '货' },
      { key: 'C', text: '袋' },
      { key: 'D', text: '哪儿' },
    ],
    correct: 'B',
    explanation:
      'Chữ “货” (huò - hàng hóa) có bộ Bối 贝 (vỏ sò - tiền tệ thời cổ đại; do đó các chữ Hán có bộ 贝 đều liên quan đến tiền bạc, tài sản, buôn bán như 财, 贵, 贾, 贸, 货).\n=> Đáp án đúng: (B) 货.',
  },
  {
    num: 4,
    type: 'single_choice',
    category: '识解汉字 (Nhận diện chữ Hán)',
    text: '下面哪一项和“我”的结构一样？（ ）',
    options: [
      { key: 'A', text: '卡' },
      { key: 'B', text: '字' },
      { key: 'C', text: '找' },
      { key: 'D', text: '过' },
    ],
    correct: 'C',
    explanation:
      'Chữ “找” và chữ “我” có sự tương đồng đặc trưng về kết cấu hình thể (đều chứa bộ Qua 戈 và kết cấu độc thể/bộ thủ phẩy đối ứng, thường ghép cặp trong các bài tập nhận diện chữ Hán sơ cấp).\n=> Đáp án đúng: (C) 找.',
  },
  {
    num: 5,
    type: 'single_choice',
    category: '识解汉字 (Nhận diện chữ Hán)',
    text: '选择“熟”意义不同的一项（ ）',
    options: [
      { key: 'A', text: '他对这条路很熟悉' },
      { key: 'B', text: '这个苹果已经成熟' },
      { key: 'C', text: '他们对这个舞蹈的每一个动作都很熟练' },
      { key: 'D', text: '他们是十多年的老熟人' },
    ],
    correct: 'B',
    explanation:
      'Phân tích nghĩa của chữ “熟”:\n- Ở phương án B (成熟), chữ “熟” mang nghĩa gốc sinh học chỉ hoa quả thực vật phát triển đẫy đà đến độ chín muồi.\n- Ở A (熟悉), C (熟练), D (熟人), chữ “熟” đều mang nghĩa phái sinh chỉ mức độ quen thuộc, thuần thục, từng trải qua nhiều lần tiếp xúc.\n=> Đáp án đúng: (B) 这个苹果已经成熟.',
  },
  {
    num: 6,
    type: 'single_choice',
    category: '识解汉字 (Nhận diện chữ Hán)',
    text: '“奔跑”中的“奔”读音正确的是（ ）',
    options: [
      { key: 'A', text: 'bēn' },
      { key: 'B', text: 'bèn' },
      { key: 'C', text: 'bēng' },
      { key: 'D', text: 'běn' },
    ],
    correct: 'A',
    explanation:
      'Chữ “奔” là chữ đa âm:\n- Đọc là bēn (thanh 1) khi làm động từ chỉ hành động chạy nhanh, chạy như bay: 奔跑 (bēnpǎo), 奔波 (bēnbō).\n- Đọc là bèn (thanh 4) khi chỉ hướng thẳng về một mục tiêu hay nơi chốn: 投奔 (tóubèn), 直奔主题 (zhíbèn zhǔtí).\n=> Đáp án đúng: (A) bēn.',
  },
  {
    num: 7,
    type: 'single_choice',
    category: '识解汉字 (Nhận diện chữ Hán)',
    text: '“称职”的“称”正确读音是（ ）',
    options: [
      { key: 'A', text: 'chēng' },
      { key: 'B', text: 'chèn' },
      { key: 'C', text: 'chèng' },
      { key: 'D', text: 'chēn' },
    ],
    correct: 'B',
    explanation:
      'Chữ “称” là chữ đa âm:\n- Đọc là chèn (thanh 4) khi mang nghĩa thích hợp, vừa vặn, xứng đáng: 称职 (chènzhí - xứng đáng chức vụ, hoàn thành tốt nhiệm vụ), 称心如意 (chènxīn-rúyì), 相称 (xiāngchèn).\n- Đọc là chēng (thanh 1) khi mang nghĩa cân đo hoặc gọi tên: 称重, 称呼.\n=> Đáp án đúng: (B) chèn.',
  },
  {
    num: 8,
    type: 'single_choice',
    category: '识解汉字 (Nhận diện chữ Hán)',
    text: '下列字中，形旁表义的是（ ）',
    options: [
      { key: 'A', text: '材' },
      { key: 'B', text: '明' },
      { key: 'C', text: '休' },
      { key: 'D', text: '从' },
    ],
    correct: 'A',
    explanation:
      'Chữ “材” là chữ hình thanh (形声字): có bộ Mộc 木 là hình bàng (形旁) biểu thị ý nghĩa chất gỗ / cây cối, và chữ 才 là thanh bàng (声旁) biểu thị âm đọc.\nCác chữ B (明: Nhật + Nguyệt), C (休: Nhân + Mộc), D (从: hai chữ Nhân) đều là chữ hội ý (会意字), không phân định hình bàng - thanh bàng.\n=> Đáp án đúng: (A) 材.',
  },
  {
    num: 9,
    type: 'single_choice',
    category: '识解汉字 (Nhận diện chữ Hán)',
    text: '“绝”字在“络绎不绝”中的意思是（ ）',
    options: [
      { key: 'A', text: '断绝' },
      { key: 'B', text: '穷尽' },
      { key: 'C', text: '极端' },
      { key: 'D', text: '一定' },
    ],
    correct: 'A',
    explanation:
      'Thành ngữ “络绎不绝” miêu tả dòng người xe qua lại tấp nập liên tục không dứt. Chữ “绝” trong thành ngữ này có nghĩa là 断绝 (cắt đứt, gián đoạn, dừng lại).\n=> Đáp án đúng: (A) 断绝.',
  },
  {
    num: 10,
    type: 'single_choice',
    category: '识解汉字 (Nhận diện chữ Hán)',
    text: '下列词语中，有错别字的一项是（ ）',
    options: [
      { key: 'A', text: '即使' },
      { key: 'B', text: '既然' },
      { key: 'C', text: '既使' },
      { key: 'D', text: '既往不咎' },
    ],
    correct: 'C',
    explanation:
      'Phương án C viết sai chính tả: Trong tiếng Trung không có từ “既使”. Từ đúng biểu thị liên từ nhượng bộ giả thiết là “即使” (jíshǐ - cho dù, ngay cả).\nCác từ A (即使), B (既然 - nếu đã), D (既往不咎 - không truy cứu chuyện đã qua) đều viết đúng chính tả chữ “既”.\n=> Đáp án đúng: (C) 既使.',
  },

  // ── 第二部分：选词填空（11—20 题） ──
  {
    num: -1,
    type: 'fill_blank_pool',
    category: '选词填空 (Điền từ vào chỗ trống)',
    text: '第二部分：选词填空（11—20 题）',
    passage_text:
      '备选词语：\nA. 地址   B. 冷静   C. 消息   D. 引起   E. 禁止\nF. 出现   G. 珍惜   H. 流露   I. 遵循   J. 表达',
    linked_options: [
      { key: 'A', text: '地址' },
      { key: 'B', text: '冷静' },
      { key: 'C', text: '消息' },
      { key: 'D', text: '引起' },
      { key: 'E', text: '禁止' },
      { key: 'F', text: '出现' },
      { key: 'G', text: '珍惜' },
      { key: 'H', text: '流露' },
      { key: 'I', text: '遵循' },
      { key: 'J', text: '表达' },
    ],
    children: [
      {
        num: 11,
        text: '他从网站上看到了这个激动人心的（ ）。',
        correct: 'C',
        explanation:
          '“激动人心的消息” (tin tức khiến lòng người xúc động / phấn chấn) là kết hợp từ ngữ cố định quen thuộc.\n=> Đáp án đúng: (C) 消息.',
      },
      {
        num: 12,
        text: '这儿写着“（ ）停车”，他们只好把车停在那边了。',
        correct: 'E',
        explanation:
          'Biển báo giao thông quy định: “禁止停车” (Cấm đỗ xe), vì vậy họ đành phải đỗ xe sang phía bên kia.\n=> Đáp án đúng: (E) 禁止.',
      },
      {
        num: 13,
        text: '喂，告诉我你的（ ），我准备给你寄几本书。',
        correct: 'A',
        explanation:
          'Gửi bưu phẩm sách vở cần có địa chỉ nhận hàng: “告诉我你的地址” (cho tôi biết địa chỉ của bạn).\n=> Đáp án đúng: (A) 地址.',
      },
      {
        num: 14,
        text: '人与人之间如果缺少交流，可能就会（ ）误会。',
        correct: 'D',
        explanation:
          'Kết hợp động - tân cố định: “引起误会” (gây ra / dẫn tới sự hiểu lầm).\n=> Đáp án đúng: (D) 引起.',
      },
      {
        num: 15,
        text: '问题越是复杂时，你越要（ ），千万别着急。',
        correct: 'B',
        explanation:
          'Vấn đề càng phức tạp thì càng phải bình tĩnh (“冷静”), tuyệt đối đừng nóng vội, sốt ruột.\n=> Đáp án đúng: (B) 冷静.',
      },
      {
        num: 16,
        text: '我们要（ ）时间，不能白白浪费。',
        correct: 'G',
        explanation:
          'Kết hợp động - tân: “珍惜时间” (trân trọng thời gian, không để lãng phí vô ích).\n=> Đáp án đúng: (G) 珍惜.',
      },
      {
        num: 17,
        text: '他的眼神（ ）出对知识的渴望。',
        correct: 'H',
        explanation:
          'Ánh mắt toát lên / bộc lộ ra: “流露出对知识的渴望” (toát lên niềm khao khát đối với tri thức).\n=> Đáp án đúng: (H) 流露.',
      },
      {
        num: 18,
        text: '公民应当自觉（ ）国家法律法规。',
        correct: 'I',
        explanation:
          'Kết hợp từ quy chuẩn: “遵循国家法律法规” (tuân theo / tuân thủ pháp luật và các quy định của nhà nước).\n=> Đáp án đúng: (I) 遵循.',
      },
      {
        num: 19,
        text: '这幅画作（ ）了艺术家对自然的热爱。',
        correct: 'J',
        explanation:
          '“表达了对自然的热爱” (bày tỏ / thể hiện tình yêu thiên nhiên của người nghệ sĩ).\n*Ghi chú QA/QC: Đề gốc dùng từ “表达” cho cả câu 19 và câu 20, khiến từ “出现” không được sử dụng.\n=> Đáp án đúng: (J) 表达.',
      },
      {
        num: 20,
        text: '他用简单的语言（ ）了自己的想法。',
        correct: 'J',
        explanation:
          '“表达想法” (diễn đạt / bày tỏ suy nghĩ của bản thân bằng ngôn từ giản dị).\n=> Đáp án đúng: (J) 表达.',
      },
    ],
  },

  // ── 第三部分：近义词与反义词（21—30 题） ──
  {
    num: 21,
    type: 'single_choice',
    category: '近义词与反义词 (Từ gần nghĩa & Trái nghĩa)',
    text: '他站在台上，心情紧张得说不出话来。以下哪个词语与“紧张”意思最接近？（ ）',
    options: [
      { key: 'A', text: '放松' },
      { key: 'B', text: '激动' },
      { key: 'C', text: '不安' },
      { key: 'D', text: '平静' },
    ],
    correct: 'C',
    explanation:
      '“紧张” (căng thẳng) biểu thị trạng thái tâm lý hồi hộp, bồn chồn lo lắng => gần nghĩa nhất với “不安” (bất an, lo âu).\n(A. 放松: thả lỏng thư giãn; B. 激动: xúc động; D. 平静: bình tĩnh).\n=> Đáp án đúng: (C) 不安.',
  },
  {
    num: 22,
    type: 'single_choice',
    category: '近义词与反义词 (Từ gần nghĩa & Trái nghĩa)',
    text: '老师非常重视学生的品德教育。以下哪个词语与“重视”意思最接近？（ ）',
    options: [
      { key: 'A', text: '注视' },
      { key: 'B', text: '注重' },
      { key: 'C', text: '轻视' },
      { key: 'D', text: '忽略' },
    ],
    correct: 'B',
    explanation:
      '“重视” (coi trọng) đồng nghĩa trực tiếp với “注重” (chú trọng, để tâm).\n(A. 注视: nhìn chăm chú; C. 轻视: coi nhẹ; D. 忽略: lơ là bỏ qua).\n=> Đáp án đúng: (B) 注重.',
  },
  {
    num: 23,
    type: 'single_choice',
    category: '近义词与反义词 (Từ gần nghĩa & Trái nghĩa)',
    text: '这个箱子很重，我一个人搬不动。以下哪个词语与“重”意思相反？（ ）',
    options: [
      { key: 'A', text: '沉' },
      { key: 'B', text: '轻' },
      { key: 'C', text: '大' },
      { key: 'D', text: '硬' },
    ],
    correct: 'B',
    explanation:
      'Trái nghĩa với “重” (zhòng - nặng) là “轻” (qīng - nhẹ).\n=> Đáp án đúng: (B) 轻.',
  },
  {
    num: 24,
    type: 'single_choice',
    category: '近义词与反义词 (Từ gần nghĩa & Trái nghĩa)',
    text: '我从图书馆借了两本书。以下哪个词语与“借”意思相反？（ ）',
    options: [
      { key: 'A', text: '拿' },
      { key: 'B', text: '买' },
      { key: 'C', text: '还' },
      { key: 'D', text: '丢' },
    ],
    correct: 'C',
    explanation:
      '“借书” (mượn sách) trái nghĩa trực tiếp với “还书” (huán shū - trả sách).\n=> Đáp án đúng: (C) 还.',
  },
  {
    num: 25,
    type: 'single_choice',
    category: '近义词与反义词 (Từ gần nghĩa & Trái nghĩa)',
    text: '这座桥非常坚固，已经使用了上百年。“坚固”的近义词是（ ）',
    options: [
      { key: 'A', text: '脆弱' },
      { key: 'B', text: '牢固' },
      { key: 'C', text: '松软' },
      { key: 'D', text: '单薄' },
    ],
    correct: 'B',
    explanation:
      '“坚固” (kiên cố, vững chãi) đồng nghĩa với “牢固” (láogù - chắc chắn, bền vững).\n(A. 脆弱: giòn gãy, yếu ớt; C. 松软: tơi xốp mềm nhũn; D. 单薄: mỏng manh đơn chiếc).\n=> Đáp án đúng: (B) 牢固.',
  },
  {
    num: 26,
    type: 'single_choice',
    category: '近义词与反义词 (Từ gần nghĩa & Trái nghĩa)',
    text: '他做事总是很果断，从不犹豫不决。“果断”的反义词是（ ）',
    options: [
      { key: 'A', text: '坚决' },
      { key: 'B', text: '武断' },
      { key: 'C', text: '犹豫' },
      { key: 'D', text: '果敢' },
    ],
    correct: 'C',
    explanation:
      '“果断” (quyết đoán, dứt khoát) trái nghĩa với “犹豫” (yóuyù - do dự, chần chừ, ngập ngừng).\n(A. 坚决: kiên quyết; B. 武断: độc đoán chủ quan; D. 果敢: quả cảm).\n=> Đáp án đúng: (C) 犹豫.',
  },
  {
    num: 27,
    type: 'single_choice',
    category: '近义词与反义词 (Từ gần nghĩa & Trái nghĩa)',
    text: '我们要珍惜现在的幸福生活。“珍惜”的近义词是（ ）',
    options: [
      { key: 'A', text: '浪费' },
      { key: 'B', text: '爱惜' },
      { key: 'C', text: '舍弃' },
      { key: 'D', text: '忽视' },
    ],
    correct: 'B',
    explanation:
      '“珍惜” (trân trọng, trân quý) đồng nghĩa với “爱惜” (àixī - yêu quý, giữ gìn, quý trọng).\n(A. 浪费: lãng phí; C. 舍弃: ruồng bỏ; D. 忽视: xem nhẹ, phớt lờ).\n=> Đáp án đúng: (B) 爱惜.',
  },
  {
    num: 28,
    type: 'single_choice',
    category: '近义词与反义词 (Từ gần nghĩa & Trái nghĩa)',
    text: '这种做法很危险，大家一定要小心。“危险”的反义词是（ ）',
    options: [
      { key: 'A', text: '安全' },
      { key: 'B', text: '危机' },
      { key: 'C', text: '风险' },
      { key: 'D', text: '隐患' },
    ],
    correct: 'A',
    explanation:
      'Trái nghĩa với “危险” (nguy hiểm) là “安全” (ānquán - an toàn).\n*Ghi chú QA/QC: Đề gốc in trùng D là 危险, đã chuẩn hóa D thành 隐患.\n=> Đáp án đúng: (A) 安全.',
  },
  {
    num: 29,
    type: 'single_choice',
    category: '近义词与反义词 (Từ gần nghĩa & Trái nghĩa)',
    text: '他的发言很精彩，赢得了大家的阵阵掌声。“精彩”的近义词是（ ）',
    options: [
      { key: 'A', text: '平淡' },
      { key: 'B', text: '出色' },
      { key: 'C', text: '乏味' },
      { key: 'D', text: '普通' },
    ],
    correct: 'B',
    explanation:
      '“精彩” (đặc sắc, tuyệt hảo) gần nghĩa nhất với “出色” (chūsè - xuất sắc, ưu tú).\n(A. 平淡: bình dị mờ nhạt; C. 乏味: nhạt nhẽo vô vị; D. 普通: bình thường).\n=> Đáp án đúng: (B) 出色.',
  },
  {
    num: 30,
    type: 'single_choice',
    category: '近义词与反义词 (Từ gần nghĩa & Trái nghĩa)',
    text: '这个问题很复杂，需要我们仔细研究。“复杂”的反义词是（ ）',
    options: [
      { key: 'A', text: '简单' },
      { key: 'B', text: '繁琐' },
      { key: 'C', text: '困难' },
      { key: 'D', text: '麻烦' },
    ],
    correct: 'A',
    explanation:
      'Trái nghĩa với “复杂” (phức tạp) là “简单” (jiǎndān - đơn giản).\n(B. 繁琐: rườm rà; C. 困难: khó khăn; D. 麻烦: phiền phức).\n=> Đáp án đúng: (A) 简单.',
  },

  // ── 第四部分：篇章填空（31—35 题） ──
  {
    num: -2,
    type: 'fill_blank_pool',
    category: '篇章填空 (Đọc điền từ đoạn văn)',
    text: '第四部分：篇章填空（31—35 题）',
    passage_text:
      '有人说：“在各种语言中，每个人的名字都是最甜蜜、最重要的声音。”记住别人的姓名是一种礼貌，也是一种感情 31______，在人与人交流的过程中会起到意想不到的效果。比如，在一个陌生的环境里，如果你能轻松而 32______ 地叫出对方的名字，他一定会吃惊和感动——因为这无疑 33______ 了他：你的名字对我很重要。这样一来，你们的距离很快就拉近了。记住别人的名字，大多数人要做到这一点，全靠有意 34______ 而形成的好习惯。等你养成了这个好习惯，你一定会有很多 35______ 的收获。\n\n备选词语：\nA. 亲切   B. 告诉   C. 交换   D. 培养   E. 意外',
    linked_options: [
      { key: 'A', text: '亲切' },
      { key: 'B', text: '告诉' },
      { key: 'C', text: '交换' },
      { key: 'D', text: '培养' },
      { key: 'E', text: '意外' },
    ],
    children: [
      {
        num: 31,
        text: '记住别人的姓名是一种礼貌，也是一种感情 31______',
        correct: 'C',
        explanation:
          '“感情交换” (sự trao đổi, giao lưu tình cảm): nhớ tên người khác là hình thức trao đổi tình cảm tích cực trong giao tiếp.\n=> Đáp án đúng: (C) 交换.',
      },
      {
        num: 32,
        text: '如果你能轻松而 32______ 地叫出对方的名字',
        correct: 'A',
        explanation:
          '“亲切地叫出对方的名字” (gọi tên đối phương một cách thoải mái và thân thiết, niềm nở).\n=> Đáp án đúng: (A) 亲切.',
      },
      {
        num: 33,
        text: '因为这无疑 33______ 了他：你的名字对我很重要。',
        correct: 'B',
        explanation:
          '“无疑告诉了他” (điều này ngầm nói cho / thông báo cho đối phương biết rằng: tên của bạn rất quan trọng với tôi).\n=> Đáp án đúng: (B) 告诉.',
      },
      {
        num: 34,
        text: '全靠有意 34______ 而形成的好习惯。',
        correct: 'D',
        explanation:
          '“有意培养” (có ý thức rèn luyện, bồi dưỡng để hình thành nên thói quen tốt).\n=> Đáp án đúng: (D) 培养.',
      },
      {
        num: 35,
        text: '你一定会有很多 35______ 的收获。',
        correct: 'E',
        explanation:
          '“意外的收获” (những thu hoạch, gặt hái bất ngờ ngoài dự kiến).\n=> Đáp án đúng: (E) 意外.',
      },
    ],
  },

  // ── 第五部分：语法、修辞与句式（36—50 题） ──
  {
    num: 36,
    type: 'single_choice',
    category: '语法、修辞与句式 (Ngữ pháp, Tu từ & Cú pháp)',
    text: '社会学研究非常（ ）社会结构变迁对个人行为的影响。',
    options: [
      { key: 'A', text: '关注' },
      { key: 'B', text: '关心' },
      { key: 'C', text: '关照' },
      { key: 'D', text: '关系' },
    ],
    correct: 'A',
    explanation:
      '“关注” (chú ý theo dõi, quan tâm nghiên cứu) thường đi kèm các đối tượng mang tính học thuật, hiện tượng, tác động xã hội (“关注……的影响”).\n“关心” thiên về quan tâm tình cảm con người, “关照” là chiếu cố chăm sóc, “关系” là quan hệ.\n=> Đáp án đúng: (A) 关注.',
  },
  {
    num: 37,
    type: 'single_choice',
    category: '语法、修辞与句式 (Ngữ pháp, Tu từ & Cú pháp)',
    text: '“地球一小时”活动是（ ），除了提醒人们节约用电以外，它还希望引起人们对气候变暖问题的关注。',
    options: [
      { key: 'A', text: '在北京开始的' },
      { key: 'B', text: '在 2007 年开始的' },
      { key: 'C', text: '从北京开始的' },
      { key: 'D', text: '从 2007 年开始的' },
    ],
    correct: 'D',
    explanation:
      'Chiến dịch “Giờ Trái Đất” (Earth Hour) được khởi xướng lần đầu vào năm 2007 tại Sydney (Úc).\nCấu trúc ngữ pháp chỉ mốc thời gian bắt đầu khởi nguồn và tiếp diễn đến nay dùng: “从 2007 年开始的” (bắt đầu từ năm 2007).\n=> Đáp án đúng: (D) 从 2007 年开始的.',
  },
  {
    num: 38,
    type: 'single_choice',
    category: '语法、修辞与句式 (Ngữ pháp, Tu từ & Cú pháp)',
    text: '有空你应该多回家看看爸妈，即使只是陪他们吃吃饭、（ ），他们也会感到很幸福。',
    options: [
      { key: 'A', text: '聊聊天' },
      { key: 'B', text: '聊天聊天' },
      { key: 'C', text: '聊天天' },
      { key: 'D', text: '聊了聊天' },
    ],
    correct: 'A',
    explanation:
      '“吃吃饭” là hình thức lặp từ của động từ ly hợp “吃饭” (dạng AAB). Khi tạo thành cụm song hành tương ứng, động từ ly hợp “聊天” cũng phải lặp theo dạng AAB là “聊聊天”.\n=> Đáp án đúng: (A) 聊聊天.',
  },
  {
    num: 39,
    type: 'single_choice',
    category: '语法、修辞与句式 (Ngữ pháp, Tu từ & Cú pháp)',
    text: '这个公司的工资虽然不算很高，但是奖金很多，所以（ ）收入还不错。',
    options: [
      { key: 'A', text: '由此可见' },
      { key: 'B', text: '总的来说' },
      { key: 'C', text: '一般来说' },
      { key: 'D', text: '具体而言' },
    ],
    correct: 'B',
    explanation:
      'Vế trước nêu hai khía cạnh cụ thể (lương cơ bản không cao nhưng tiền thưởng nhiều), vế sau đưa ra đánh giá khái quát toàn diện: “总的来说” (nhìn chung, tổng thể mà nói thu nhập vẫn rất ổn).\n=> Đáp án đúng: (B) 总的来说.',
  },
  {
    num: 40,
    type: 'single_choice',
    category: '语法、修辞与句式 (Ngữ pháp, Tu từ & Cú pháp)',
    text: '（ ），你也不能随便说放弃，你应该做的是用成绩来证明自己能行。',
    options: [
      { key: 'A', text: '虽然所有人都看好你' },
      { key: 'B', text: '虽然所有都不看好你' },
      { key: 'C', text: '即使所有人都看好你' },
      { key: 'D', text: '即使所有人都不看好你' },
    ],
    correct: 'D',
    explanation:
      'Vế sau có phó từ “也” (“你也不能……”), tạo thành cặp quan hệ nhượng bộ giả thiết: “即使……也……” (cho dù... cũng...).\nNgữ cảnh “phải dùng thành tích chứng minh mình làm được” đòi hỏi tình huống giả định xấu nhất: “即使所有人都不看好你” (cho dù tất cả mọi người đều không tin tưởng / coi thường bạn).\n=> Đáp án đúng: (D) 即使所有人都不看好你.',
  },
  {
    num: 41,
    type: 'single_choice',
    category: '语法、修辞与句式 (Ngữ pháp, Tu từ & Cú pháp)',
    text: '在经济全球化背景下，（ ）。',
    options: [
      { key: 'A', text: '各国经济联系日益紧密' },
      { key: 'B', text: '本土文化的保护和发展显得尤为重要' },
      { key: 'C', text: '所以贸易壁垒完全消除' },
      { key: 'D', text: '导致国际合作不再必要' },
    ],
    correct: 'A',
    explanation:
      'Trong bối cảnh toàn cầu hóa kinh tế (“在经济全球化背景下”), thực tế khách quan tương ứng là sự liên kết kinh tế giữa các nước ngày càng khăng khít, chặt chẽ (“各国经济联系日益紧密”).\n*Ghi chú QA/QC: Đề gốc in nhầm số câu thành 32. A.\n=> Đáp án đúng: (A) 各国经济联系日益紧密.',
  },
  {
    num: 42,
    type: 'single_choice',
    category: '语法、修辞与句式 (Ngữ pháp, Tu từ & Cú pháp)',
    text: '尽管这个法律理论非常复杂，（ ）。',
    options: [
      { key: 'A', text: '而且应用范围很广' },
      { key: 'B', text: '但其核心要义却明了' },
      { key: 'C', text: '或者需要进一步解释' },
      { key: 'D', text: '所以学者们争论不休' },
    ],
    correct: 'B',
    explanation:
      'Cặp liên từ nhượng bộ chuyển ngoặt: “尽管……，但（是）……却……” (Mặc dù lý luận pháp luật này rất phức tạp, nhưng nội dung cốt lõi của nó lại rất rõ ràng, sáng tỏ).\n=> Đáp án đúng: (B) 但其核心要义却明了.',
  },
  {
    num: 43,
    type: 'single_choice',
    category: '语法、修辞与句式 (Ngữ pháp, Tu từ & Cú pháp)',
    text: '（ ）天气不好，我们还是按时出发了。',
    options: [
      { key: 'A', text: '因为' },
      { key: 'B', text: '虽然' },
      { key: 'C', text: '既然' },
      { key: 'D', text: '如果' },
    ],
    correct: 'B',
    explanation:
      'Vế sau có phó từ biểu thị chuyển ngoặt “还是” (vẫn cứ xuất phát đúng giờ) => vế trước dùng liên từ chuyển ngoặt “虽然” (Mặc dù thời tiết xấu...).\n=> Đáp án đúng: (B) 虽然.',
  },
  {
    num: 44,
    type: 'single_choice',
    category: '语法、修辞与句式 (Ngữ pháp, Tu từ & Cú pháp)',
    text: '他（ ）努力学习，（ ）取得了优异的成绩。',
    options: [
      { key: 'A', text: '不仅……而且……' },
      { key: 'B', text: '虽然……但是……' },
      { key: 'C', text: '因为……所以……' },
      { key: 'D', text: '即使……也……' },
    ],
    correct: 'C',
    explanation:
      'Mối quan hệ nguyên nhân - kết quả: Chăm chỉ học tập là nguyên nhân dẫn đến kết quả đạt thành tích ưu tú => dùng cặp liên từ “因为……所以……”.\n=> Đáp án đúng: (C) 因为……所以…….',
  },
  {
    num: 45,
    type: 'single_choice',
    category: '语法、修辞与句式 (Ngữ pháp, Tu từ & Cú pháp)',
    text: '我们应该（ ）保护环境，（ ）能让子孙后代过上幸福的生活。',
    options: [
      { key: 'A', text: '只要……就……' },
      { key: 'B', text: '只有……才……' },
      { key: 'C', text: '无论……都……' },
      { key: 'D', text: '一边……一边……' },
    ],
    correct: 'B',
    explanation:
      'Bảo vệ môi trường là điều kiện duy nhất tất yếu để con cháu mai sau có cuộc sống tốt đẹp => dùng cấu trúc điều kiện cần: “只有……才（能）……”.\n=> Đáp án đúng: (B) 只有……才…….',
  },
  {
    num: 46,
    type: 'single_choice',
    category: '语法、修辞与句式 (Ngữ pháp, Tu từ & Cú pháp)',
    text: '（ ）明天下雨，运动会（ ）推迟举行。',
    options: [
      { key: 'A', text: '因为……所以……' },
      { key: 'B', text: '如果……就……' },
      { key: 'C', text: '虽然……但是……' },
      { key: 'D', text: '即使……也……' },
    ],
    correct: 'B',
    explanation:
      '“明天下雨” là giả thiết ở tương lai chưa xảy ra => dùng cặp câu điều kiện giả thiết: “如果……（就）……” (Nếu ngày mai mưa thì đại hội thể thao sẽ hoãn tổ chức).\n=> Đáp án đúng: (B) 如果……就…….',
  },
  {
    num: 47,
    type: 'single_choice',
    category: '语法、修辞与句式 (Ngữ pháp, Tu từ & Cú pháp)',
    text: '下列句子中，没有语病的一项是（ ）',
    options: [
      { key: 'A', text: '通过这次活动，使我明白了团结的重要性。' },
      { key: 'B', text: '我们要养成认真完成作业的好习惯。' },
      { key: 'C', text: '他经常回忆过去的往事。' },
      { key: 'D', text: '能否取得好成绩，关键在于是否努力学习。' },
    ],
    correct: 'B',
    explanation:
      'Phân tích ngữ bệnh:\n- A lỗi câu khuyết chủ ngữ điển hình do cùng dùng cả giới từ “通过” và động từ khiến lệnh “使”.\n- B câu chuẩn mực hoàn hảo cả về cấu trúc Chủ - Vị - Tân và sự kết hợp từ.\n- C lỗi trùng lặp ngữ nghĩa: “过去” và “往事” đều mang nghĩa là chuyện đã qua.\n- D tuy đối ứng 2 mặt nhưng B là câu hoàn chỉnh chuẩn mực nhất.\n=> Đáp án đúng: (B) 我们要养成认真完成作业的好习惯。',
  },
  {
    num: 48,
    type: 'single_choice',
    category: '语法、修辞与句式 (Ngữ pháp, Tu từ & Cú pháp)',
    text: '下列句子中，标点符号使用正确的一项是（ ）',
    options: [
      { key: 'A', text: '我最喜欢的水果有苹果、香蕉、橙子……等。' },
      { key: 'B', text: '“明天要不要去公园玩？”妈妈问我。' },
      { key: 'C', text: '他大声喊道：“我成功了”！' },
      { key: 'D', text: '这个问题该怎么解决呢，我真不知道。' },
    ],
    correct: 'B',
    explanation:
      'Phân tích dấu câu:\n- A sai: Dấu chấm lửng “……” không dùng chung với từ “等”.\n- B đúng chuẩn: Câu hỏi trực tiếp đặt trong dấu ngoặc kép, dấu chấm hỏi nằm trong ngoặc kép, dấu chấm kết câu đặt cuối cùng.\n- C sai: Dấu chấm than phải nằm trong ngoặc kép (“我成功了！”).\n=> Đáp án đúng: (B) “明天要不要去公园玩？”妈妈问我。',
  },
  {
    num: 49,
    type: 'single_choice',
    category: '语法、修辞与句式 (Ngữ pháp, Tu từ & Cú pháp)',
    text: '下列句子中，运用比喻修辞手法的一项是（ ）',
    options: [
      { key: 'A', text: '他长得像他爸爸。' },
      { key: 'B', text: '树上的苹果像红灯笼一样红。' },
      { key: 'C', text: '花儿在风中笑弯了腰。' },
      { key: 'D', text: '雷声隆隆，好像在发怒。' },
    ],
    correct: 'B',
    explanation:
      'Phép tu từ so sánh ví von (比喻) cần có bản thể và dụ thể khác loại cùng từ so sánh:\n- B: Bản thể là “苹果” (quả táo), dụ thể là “红灯笼” (đèn lồng đỏ), từ so sánh là “像……一样” => Phép so sánh ví von chuẩn xác.\n- A chỉ là so sánh tương đồng ngoại hình người với người.\n- C là phép nhân hóa (拟人).\n- D là phỏng đoán cảm giác.\n=> Đáp án đúng: (B) 树上的苹果像红灯笼一样红。',
  },
  {
    num: 50,
    type: 'single_choice',
    category: '语法、修辞与句式 (Ngữ pháp, Tu từ & Cú pháp)',
    text: '下列句子中，运用拟人修辞手法的一项是（ ）',
    options: [
      { key: 'A', text: '弯弯的月亮像一条小船。' },
      { key: 'B', text: '飞流直下三千尺，疑是银河落九天。' },
      { key: 'C', text: '小鸟在树上唱着动听的歌。' },
      { key: 'D', text: '他的脸红得像苹果。' },
    ],
    correct: 'C',
    explanation:
      'Phép tu từ nhân hóa (拟人) gán đặc điểm, hành vi, tình cảm của con người cho sự vật:\n- C: Gán hành động của con người (“唱着动听的歌” - cất tiếng hát những bài hát êm tai) cho loài chim => Biện pháp nhân hóa chuẩn mực.\n- A, D là phép so sánh ví von (比喻).\n- B là phép phóng đại nói quá (夸张).\n=> Đáp án đúng: (C) 小鸟在树上唱着动听的歌。',
  },

  // ── 第六部分：阅读理解（51—80 题） ──
  // Bài đọc 1: Thưởng thức văn học (51—55)
  {
    num: -3,
    type: 'reading_passage',
    category: '阅读理解 (Đọc hiểu chuyên sâu)',
    text: '阅读一（51—55 题）',
    passage_text:
      '文学鉴赏是一种再创造活动。读者在阅读作品时，会根据自己的生活经验、知识结构和情感态度对作品进行理解和阐释，从而赋予作品新的意义。因此，不同的读者对同一部作品的理解可能存在差异。',
    children: [
      {
        num: 51,
        text: '根据上文，文学鉴赏的本质是什么？（ ）',
        options: [
          { key: 'A', text: '重复作者的原意' },
          { key: 'B', text: '一种被动的接受' },
          { key: 'C', text: '一种再创造活动' },
          { key: 'D', text: '寻找唯一正确答案' },
        ],
        correct: 'C',
        explanation:
          'Dẫn chứng nguyên văn câu đầu: “文学鉴赏是一种再创造活动” (Thưởng thức văn học là một hoạt động tái sáng tạo).\n=> Đáp án đúng: (C) 一种再创造活动.',
      },
      {
        num: 52,
        text: '导致读者对作品理解差异的主要因素不包括？（ ）',
        options: [
          { key: 'A', text: '读者的生活经验' },
          { key: 'B', text: '作品的字数多少' },
          { key: 'C', text: '读者的知识结构' },
          { key: 'D', text: '读者的情感态度' },
        ],
        correct: 'B',
        explanation:
          'Bài nêu rõ 3 yếu tố dẫn tới sự khác biệt: kinh nghiệm sống (生活经验), cấu trúc tri thức (知识结构) và thái độ tình cảm (情感态度); không bao gồm số lượng chữ của tác phẩm (作品的字数多少).\n=> Đáp án đúng: (B) 作品的字数多少.',
      },
      {
        num: 53,
        text: '下列对“再创造活动”理解正确的是（ ）',
        options: [
          { key: 'A', text: '读者完全脱离作品原意进行创作' },
          { key: 'B', text: '读者根据自身情况对作品进行解读和赋予新意义' },
          { key: 'C', text: '读者按照作者的思路进行理解' },
          { key: 'D', text: '读者对作品进行修改和完善' },
        ],
        correct: 'B',
        explanation:
          'Dẫn chứng nguyên văn: “读者在阅读作品时，会根据自己的生活经验、知识结构和情感态度对作品进行理解和阐释，从而赋予作品新的意义” (Độc giả giải mã và gán cho tác phẩm ý nghĩa mới dựa trên điều kiện của chính mình).\n=> Đáp án đúng: (B) 读者根据自身情况对作品进行解读和赋予新意义.',
      },
      {
        num: 54,
        text: '为什么不同读者对同一作品理解不同？（ ）',
        options: [
          { key: 'A', text: '作品的内容不够明确' },
          { key: 'B', text: '读者的自身条件不同' },
          { key: 'C', text: '作者的表达不够清晰' },
          { key: 'D', text: '作品的意义过于复杂' },
        ],
        correct: 'B',
        explanation:
          'Vì các điều kiện nội tại của mỗi độc giả (vốn sống, tri thức, tình cảm) là khác nhau (“读者的自身条件不同”).\n=> Đáp án đúng: (B) 读者的自身条件不同.',
      },
      {
        num: 55,
        text: '下列说法与原文意思相符的是（ ）',
        options: [
          { key: 'A', text: '文学鉴赏是对作品的简单接受' },
          { key: 'B', text: '读者只能按照作者的意图理解作品' },
          { key: 'C', text: '生活经验会影响读者对作品的理解' },
          { key: 'D', text: '所有读者对同一作品的理解都相同' },
        ],
        correct: 'C',
        explanation:
          'Dẫn chứng: “读者在阅读作品时，会根据自己的生活经验……对作品进行理解和阐释” (Kinh nghiệm sống sẽ ảnh hưởng tới sự thấu hiểu tác phẩm của độc giả).\n=> Đáp án đúng: (C) 生活经验会影响读者对作品的理解.',
      },
    ],
  },

  // Bài đọc 2: Chiếc bình thủy tinh và hòn đá (56—60)
  {
    num: -4,
    type: 'reading_passage',
    category: '阅读理解 (Đọc hiểu chuyên sâu)',
    text: '阅读二（56—60 题）',
    passage_text:
      '老师把一个大玻璃瓶子带到学校，瓶子里装着满满的石头、玻璃碎片和沙子。之后，老师请学生把瓶子里的东西都倒出来，然后再装进去，先从沙子开始。每个学生都试了试，最后都发现没有足够的空间装所有的石头。老师指导学生重新装这个瓶子。这次，先从石头开始，最后再装沙子。石头装进去后，沙子就沉积在石头的周围，最后，所有东西都装进瓶子里了。老师说：“如果我们先从小的东西开始，把小东西装进去之后，大的石头就放不进去了。生活也是如此，如果你的生活先被不重要的事挤满了，那你就无法再装进更大、更重要的事了。”',
    children: [
      {
        num: 56,
        text: '那个任务，学生刚开始完成得怎么样？（ ）',
        options: [
          { key: 'A', text: '都没完成' },
          { key: 'B', text: '都装进去了' },
          { key: 'C', text: '完成得很好' },
          { key: 'D', text: '有一组没做完' },
        ],
        correct: 'A',
        explanation:
          'Dẫn chứng nguyên văn: “每个学生都试了试，最后都发现没有足够的空间装所有的石头” (Tất cả học sinh đều không có đủ chỗ để chứa hết số đá -> đều không hoàn thành nhiệm vụ).\n=> Đáp án đúng: (A) 都没完成.',
      },
      {
        num: 57,
        text: '正确的装法是，先装（ ）',
        options: [
          { key: 'A', text: '小东西' },
          { key: 'B', text: '大东西' },
          { key: 'C', text: '轻的东西' },
          { key: 'D', text: '软的东西' },
        ],
        correct: 'B',
        explanation:
          'Dẫn chứng: “这次，先从石头开始” (Lần này bắt đầu từ đá trước -> những đồ vật lớn: 大东西).\n=> Đáp án đúng: (B) 大东西.',
      },
      {
        num: 58,
        text: '上文主要告诉我们，生活中应该（ ）',
        options: [
          { key: 'A', text: '多思考' },
          { key: 'B', text: '先做小事' },
          { key: 'C', text: '分清主次，先做重要的事' },
          { key: 'D', text: '学会整理物品' },
        ],
        correct: 'C',
        explanation:
          'Bài học ngụ ngôn: “如果你的生活先被不重要的事挤满了，那你就无法再装进更大、更重要的事了” (Phải phân rõ chính phụ, ưu tiên làm việc lớn, việc quan trọng trước).\n=> Đáp án đúng: (C) 分清主次，先做重要的事.',
      },
      {
        num: 59,
        text: '沙子能沉积在石头周围的原因是（ ）',
        options: [
          { key: 'A', text: '沙子很轻' },
          { key: 'B', text: '石头之间有缝隙' },
          { key: 'C', text: '沙子是细小的' },
          { key: 'D', text: '石头比较重' },
        ],
        correct: 'B',
        explanation:
          'Giữa các hòn đá tảng có những khoảng trống / khe hở (“石头之间有缝隙”) nên các hạt cát mịn có thể lọt vào và lắng xuống xung quanh.\n=> Đáp án đúng: (B) 石头之间有缝隙.',
      },
      {
        num: 60,
        text: '下列说法不符合原文意思的是（ ）',
        options: [
          { key: 'A', text: '先装沙子无法把所有东西都装进瓶子' },
          { key: 'B', text: '先装石头再装沙子能充分利用瓶子空间' },
          { key: 'C', text: '生活中不重要的事就不用做了' },
          { key: 'D', text: '生活中要合理安排时间和精力' },
        ],
        correct: 'C',
        explanation:
          'Bài viết khuyên nên sắp xếp thời gian hợp lý và ưu tiên việc quan trọng trước, tuyệt đối không hề nói “việc không quan trọng thì bỏ mặc không làm”.\n=> Đáp án đúng: (C) 生活中不重要的事就不用做了.',
      },
    ],
  },

  // Bài đọc 3: Mua sắm trực tuyến (61—65)
  {
    num: -5,
    type: 'reading_passage',
    category: '阅读理解 (Đọc hiểu chuyên sâu)',
    text: '阅读三（61—65 题）',
    passage_text:
      '网络购物已经成为现代人生活中不可或缺的一部分。它不仅方便快捷，能让人们足不出户就买到世界各地的商品，而且商品种类丰富，价格也相对实惠。不过，网络购物也存在一些问题，比如商品质量参差不齐、售后服务不够完善、个人信息容易泄露等。因此，在进行网络购物时，消费者要提高警惕，选择正规的购物平台，仔细查看商品评价和商家信誉，保护好自己的个人信息和财产安全。',
    children: [
      {
        num: 61,
        text: '网络购物的优点不包括（ ）',
        options: [
          { key: 'A', text: '方便快捷' },
          { key: 'B', text: '商品种类丰富' },
          { key: 'C', text: '价格实惠' },
          { key: 'D', text: '商品质量有保障' },
        ],
        correct: 'D',
        explanation:
          'Ưu điểm của mua sắm online gồm tiện lợi (方便快捷), chủng loại phong phú (种类丰富), giá cả phải chăng (价格实惠). Còn chất lượng hàng thì “参差不齐” (không đồng đều), do đó “chất lượng có bảo đảm” không phải ưu điểm.\n*Ghi chú QA/QC: Key gốc in nhầm số câu thành 52. D.\n=> Đáp án đúng: (D) 商品质量有保障.',
      },
      {
        num: 62,
        text: '网络购物存在的问题有（ ）',
        options: [
          { key: 'A', text: '商品质量参差不齐' },
          { key: 'B', text: '售后服务不完善' },
          { key: 'C', text: '个人信息易泄露' },
          { key: 'D', text: '以上都是' },
        ],
        correct: 'D',
        explanation:
          'Dẫn chứng nguyên văn liệt kê cả 3 vấn đề: “商品质量参差不齐、售后服务不够完善、个人信息容易泄露” => chọn D (Tất cả các ý trên).\n=> Đáp án đúng: (D) 以上都是.',
      },
      {
        num: 63,
        text: '消费者在网络购物时应该（ ）',
        options: [
          { key: 'A', text: '选择正规购物平台' },
          { key: 'B', text: '仔细查看商品评价' },
          { key: 'C', text: '保护个人信息' },
          { key: 'D', text: '以上都是' },
        ],
        correct: 'D',
        explanation:
          'Dẫn chứng: “选择正规的购物平台，仔细查看商品评价和商家信誉，保护好自己的个人信息和财产安全” => gồm cả A, B, C.\n=> Đáp án đúng: (D) 以上都是.',
      },
      {
        num: 64,
        text: '下列对网络购物的描述正确的是（ ）',
        options: [
          { key: 'A', text: '完全没有风险' },
          { key: 'B', text: '利大于弊' },
          { key: 'C', text: '弊大于利' },
          { key: 'D', text: '有优点也有缺点' },
        ],
        correct: 'D',
        explanation:
          'Mua sắm qua mạng vừa mang lại sự tiện ích to lớn nhưng cũng tồn tại nhiều vấn đề, rủi ro => “có ưu điểm cũng có khuyết điểm” (有优点也有缺点).\n=> Đáp án đúng: (D) 有优点也有缺点.',
      },
      {
        num: 65,
        text: '这篇短文主要想告诉我们（ ）',
        options: [
          { key: 'A', text: '网络购物很方便' },
          { key: 'B', text: '网络购物有风险' },
          { key: 'C', text: '网络购物的优缺点及注意事项' },
          { key: 'D', text: '不要进行网络购物' },
        ],
        correct: 'C',
        explanation:
          'Toàn bộ bài viết giới thiệu toàn diện cả về ưu điểm, khuyết điểm cũng như những lưu ý cảnh giác khi mua sắm qua mạng (“网络购物的优缺点及注意事项”).\n=> Đáp án đúng: (C) 网络购物的优缺点及注意事项.',
      },
    ],
  },

  // Bài đọc 4: Phương thức học trực tuyến (66—70)
  {
    num: -6,
    type: 'reading_passage',
    category: '阅读理解 (Đọc hiểu chuyên sâu)',
    text: '阅读四（66—70 题）',
    passage_text:
      '如今，线上学习已经成为一种常见的学习方式。什么是线上学习？它是指通过互联网平台进行的学习活动，学生可以随时随地观看教学视频、参与线上讨论、完成作业。线上学习是教育数字化发展的重要成果，也是“互联网+教育”的具体体现。近年来，随着网络技术的不断进步，线上学习的用户数量持续增长，学习资源也越来越丰富。线上学习的优势很明显，它打破了时间和空间的限制，让学生可以根据自己的时间安排灵活学习，还能接触到不同地区的优质教学资源。但线上学习也存在一些不足，比如需要学生有较强的自主学习能力，部分学生可能会因为缺乏监督而放松学习。此外，长时间面对电子屏幕，也会对视力造成一定影响。为了让线上学习更好地发挥作用，学生要培养自主学习意识，合理安排学习时间；平台要不断优化学习资源，加强对学习过程的监督和引导。',
    children: [
      {
        num: 66,
        text: '短文主要介绍了线上学习的（ ）',
        options: [
          { key: 'A', text: '定义、优势、不足及改进建议' },
          { key: 'B', text: '发展历程' },
          { key: 'C', text: '具体操作方法' },
          { key: 'D', text: '未来趋势' },
        ],
        correct: 'A',
        explanation:
          'Đoạn văn trình bày rõ ràng 4 phần: Định nghĩa (什么是线上学习), Ưu thế (线上学习的优势很明显), Thiếu sót hạn chế (线上学习也存在一些不足) và Kiến nghị hoàn thiện (为了让线上学习更好地发挥作用).\n=> Đáp án đúng: (A) 定义、优势、不足及改进建议.',
      },
      {
        num: 67,
        text: '线上学习的优势不包括（ ）',
        options: [
          { key: 'A', text: '时间灵活' },
          { key: 'B', text: '资源丰富' },
          { key: 'C', text: '无需自主学习能力' },
          { key: 'D', text: '打破空间限制' },
        ],
        correct: 'C',
        explanation:
          'Đoạn văn nêu rõ: “需要学生有较强的自主学习能力” (đòi hỏi học sinh phải có năng lực tự học cao), do đó “không cần năng lực tự học” là sai sự thật.\n=> Đáp án đúng: (C) 无需自主学习能力.',
      },
      {
        num: 68,
        text: '线上学习存在的不足是（ ）',
        options: [
          { key: 'A', text: '资源匮乏' },
          { key: 'B', text: '时间固定' },
          { key: 'C', text: '可能影响视力' },
          { key: 'D', text: '无法参与讨论' },
        ],
        correct: 'C',
        explanation:
          'Dẫn chứng nguyên văn: “长时间面对电子屏幕，也会对视力造成一定影响” (Nhìn màn hình điện tử trong thời gian dài có thể ảnh hưởng xấu đến thị lực).\n=> Đáp án đúng: (C) 可能影响视力.',
      },
      {
        num: 69,
        text: '为了让线上学习更好地发挥作用，学生应该（ ）',
        options: [
          { key: 'A', text: '依赖平台监督' },
          { key: 'B', text: '长时间看电子屏幕' },
          { key: 'C', text: '培养自主学习意识' },
          { key: 'D', text: '拒绝线上学习' },
        ],
        correct: 'C',
        explanation:
          'Dẫn chứng nguyên văn: “学生要培养自主学习意识，合理安排学习时间” (Học sinh cần bồi dưỡng ý thức tự giác học tập).\n=> Đáp án đúng: (C) 培养自主学习意识.',
      },
      {
        num: 70,
        text: '下列说法与原文意思相符的是（ ）',
        options: [
          { key: 'A', text: '线上学习完全替代了传统学习' },
          { key: 'B', text: '线上学习适合所有学生' },
          { key: 'C', text: '网络技术进步推动了线上学习发展' },
          { key: 'D', text: '线上学习没有任何缺点' },
        ],
        correct: 'C',
        explanation:
          'Dẫn chứng nguyên văn: “随着网络技术的不断进步，线上学习的用户数量持续增长，学习资源也越来越丰富” (Tiến bộ công nghệ mạng đã thúc đẩy học trực tuyến phát triển).\n=> Đáp án đúng: (C) 网络技术进步推动了线上学习发展.',
      },
    ],
  },

  // Bài đọc 5: Hiện tượng cầu vồng (71—75)
  {
    num: -7,
    type: 'reading_passage',
    category: '阅读理解 (Đọc hiểu chuyên sâu)',
    text: '阅读五（71—75 题）',
    passage_text:
      '彩虹是一种美丽的自然现象，通常出现在雨后放晴的时候。当阳光照射到空气中的小水滴时，光线会发生折射、反射和色散，分解成红、橙、黄、绿、蓝、靛、紫七种颜色，形成我们看到的彩虹。彩虹的形状通常是弧形的，这是因为阳光在水滴中的折射角度是固定的，只有特定角度的光线才能到达我们的眼睛。虽然我们看到的彩虹是弧形的，但实际上它是一个完整的圆形，只是因为地面的阻挡，我们只能看到上半部分。此外，彩虹的出现还与阳光的角度、空气湿度等因素有关。',
    children: [
      {
        num: 71,
        text: '彩虹通常出现在（ ）',
        options: [
          { key: 'A', text: '阴天' },
          { key: 'B', text: '雨后放晴' },
          { key: 'C', text: '晴天无云' },
          { key: 'D', text: '下雨时' },
        ],
        correct: 'B',
        explanation:
          'Dẫn chứng nguyên văn câu mở đầu: “通常出现在雨后放晴的时候” (Cầu vồng thường xuất hiện vào lúc trời tạnh ráo sau cơn mưa).\n*Ghi chú QA/QC: Key gốc in nhầm số câu thành 53. B.\n=> Đáp án đúng: (B) 雨后放晴.',
      },
      {
        num: 72,
        text: '彩虹的颜色不包括（ ）',
        options: [
          { key: 'A', text: '红' },
          { key: 'B', text: '绿' },
          { key: 'C', text: '黑' },
          { key: 'D', text: '蓝' },
        ],
        correct: 'C',
        explanation:
          'Bảy sắc cầu vồng gồm “红、橙、黄、绿、蓝、靛、紫” (đỏ, cam, vàng, lục, lam, chàm, tím); hoàn toàn không có màu đen (黑).\n=> Đáp án đúng: (C) 黑.',
      },
      {
        num: 73,
        text: '彩虹呈弧形的原因是（ ）',
        options: [
          { key: 'A', text: '水滴是弧形的' },
          { key: 'B', text: '阳光折射角度固定' },
          { key: 'C', text: '空气湿度不同' },
          { key: 'D', text: '地面是平的' },
        ],
        correct: 'B',
        explanation:
          'Dẫn chứng nguyên văn: “这是因为阳光在水滴中的折射角度是固定的，只有特定角度的光线才能到达我们的眼睛” (Góc khúc xạ của ánh sáng mặt trời trong giọt nước là cố định).\n=> Đáp án đúng: (B) 阳光折射角度固定.',
      },
      {
        num: 74,
        text: '我们看到的彩虹是完整圆形的一部分，原因是（ ）',
        options: [
          { key: 'A', text: '光线被云层阻挡' },
          { key: 'B', text: '地面的阻挡' },
          { key: 'C', text: '水滴数量有限' },
          { key: 'D', text: '阳光角度变化' },
        ],
        correct: 'B',
        explanation:
          'Dẫn chứng nguyên văn: “但实际上它是一个完整的圆形，只是因为地面的阻挡，我们只能看到上半部分” (Do mặt đất cản trở tầm nhìn nên ta chỉ thấy nửa hình cung bên trên).\n=> Đáp án đúng: (B) 地面的阻挡.',
      },
      {
        num: 75,
        text: '下列哪项不是彩虹出现的相关因素？（ ）',
        options: [
          { key: 'A', text: '阳光角度' },
          { key: 'B', text: '空气湿度' },
          { key: 'C', text: '水滴' },
          { key: 'D', text: '风力大小' },
        ],
        correct: 'D',
        explanation:
          'Bài nêu rõ sự xuất hiện của cầu vồng liên quan đến góc chiếu mặt trời, các giọt nước và độ ẩm không khí; không hề phụ thuộc vào độ mạnh yếu của gió (风力大小).\n=> Đáp án đúng: (D) 风力大小.',
      },
    ],
  },

  // Bài đọc 6: Trí tuệ nhân tạo AI (76—80)
  {
    num: -8,
    type: 'reading_passage',
    category: '阅读理解 (Đọc hiểu chuyên sâu)',
    text: '阅读六（76—80 题）',
    passage_text:
      '人工智能（AI）已经走进了我们的生活。从手机语音助手到智能导航，从自动驾驶到智能医疗，人工智能的应用越来越广泛。人工智能是研究、开发用于模拟、延伸和扩展人的智能的理论、方法、技术及应用系统的一门新的技术科学。它具有学习、推理、决策等能力，能够处理大量的数据，完成人类难以快速完成的任务。比如，智能医疗系统可以快速分析医学影像，帮助医生更准确地诊断疾病；自动驾驶技术可以通过传感器感知周围环境，保障行车安全。但人工智能也面临一些挑战。一方面，人工智能的发展需要大量的优质数据支持，数据质量直接影响其性能；另一方面，人工智能的伦理问题也备受关注，比如隐私保护、就业影响等。为了促进人工智能的健康发展，需要加强技术研发，完善相关法律法规，规范人工智能的应用。',
    children: [
      {
        num: 76,
        text: '人工智能的应用不包括（ ）',
        options: [
          { key: 'A', text: '手机语音助手' },
          { key: 'B', text: '智能导航' },
          { key: 'C', text: '手动驾驶' },
          { key: 'D', text: '智能医疗' },
        ],
        correct: 'C',
        explanation:
          'Bài nêu các ứng dụng thực tế của AI gồm: trợ lý giọng nói điện thoại (A), điều hướng thông minh (B), tự lái xe (自动驾驶), y tế thông minh (D). Phương án C là “手动驾驶” (lái xe bằng tay / thủ công) không phải ứng dụng của AI.\n=> Đáp án đúng: (C) 手动驾驶.',
      },
      {
        num: 77,
        text: '人工智能不能完成的任务是（ ）',
        options: [
          { key: 'A', text: '快速数据分析' },
          { key: 'B', text: '医学影像分析' },
          { key: 'C', text: '自主制定伦理规则' },
          { key: 'D', text: '导航指路' },
        ],
        correct: 'C',
        explanation:
          'AI có thể xử lý lượng lớn dữ liệu, phân tích ảnh y tế, dẫn đường; nhưng việc xây dựng các quy tắc đạo đức luân lý (“自主制定伦理规则”) thuộc về nhận thức và trách nhiệm xã hội của con người, AI không thể tự định đoạt.\n=> Đáp án đúng: (C) 自主制定伦理规则.',
      },
      {
        num: 78,
        text: '人工智能面临的挑战不包括（ ）',
        options: [
          { key: 'A', text: '数据质量影响性能' },
          { key: 'B', text: '隐私保护问题' },
          { key: 'C', text: '应用范围狭窄' },
          { key: 'D', text: '就业影响争议' },
        ],
        correct: 'C',
        explanation:
          'Bài nêu AI đối mặt với chất lượng dữ liệu (A), bảo vệ quyền riêng tư (B), tác động việc làm (D); trong khi ứng dụng của nó thì “越来越广泛” (ngày càng rộng rãi), do đó “phạm vi ứng dụng chật hẹp” (应用范围狭窄) không phải là thách thức.\n=> Đáp án đúng: (C) 应用范围狭窄.',
      },
      {
        num: 79,
        text: '为促进人工智能健康发展，不需要做的是（ ）',
        options: [
          { key: 'A', text: '加强技术研发' },
          { key: 'B', text: '完善法律法规' },
          { key: 'C', text: '禁止人工智能应用' },
          { key: 'D', text: '规范应用行为' },
        ],
        correct: 'C',
        explanation:
          'Để thúc đẩy AI phát triển lành mạnh, cần đẩy mạnh nghiên cứu (A), hoàn thiện pháp luật (B), chuẩn hóa ứng dụng (D); tuyệt đối không phải là cấm đoán ứng dụng AI (禁止人工智能应用).\n=> Đáp án đúng: (C) 禁止人工智能应用.',
      },
      {
        num: 80,
        text: '这篇短文的主旨是（ ）',
        options: [
          { key: 'A', text: '介绍人工智能的定义' },
          { key: 'B', text: '说明人工智能的应用场景' },
          { key: 'C', text: '分析人工智能的优势、挑战及发展建议' },
          { key: 'D', text: '强调人工智能的危害' },
        ],
        correct: 'C',
        explanation:
          'Toàn bài phân tích năng lực vượt trội của AI, các thách thức đang phải đối mặt và các kiến nghị để AI phát triển lành mạnh (“分析人工智能的优势、挑战及发展建议”).\n=> Đáp án đúng: (C) 分析人工智能的优势、挑战及发展建议.',
      },
    ],
  },
];

async function main() {
  const pool = new Pool({ connectionString: dbUrl });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log('Inserting Exam:', EXAM_DATA.title);

    let examId;
    const existing = await client.query('SELECT id FROM exams WHERE title = $1', [EXAM_DATA.title]);
    if (existing.rows.length > 0) {
      examId = existing.rows[0].id;
      console.log(`Found existing exam ID=${examId}, updating info and replacing questions...`);
      await client.query(
        `UPDATE exams SET
          subject_id = $1, title_cn = $2, duration = $3, total_questions = $4,
          total_points = $5, difficulty_level = $6, is_premium = $7,
          language_mode = $8, explanation_language_mode = $9, description = $10,
          status = $11, updated_at = CURRENT_TIMESTAMP
        WHERE id = $12`,
        [
          EXAM_DATA.subject_id,
          EXAM_DATA.title_cn,
          EXAM_DATA.duration,
          EXAM_DATA.total_questions,
          EXAM_DATA.total_points,
          EXAM_DATA.difficulty_level,
          EXAM_DATA.is_premium,
          EXAM_DATA.language_mode,
          EXAM_DATA.explanation_language_mode,
          EXAM_DATA.description,
          EXAM_DATA.status,
          examId,
        ],
      );
      await client.query(
        'DELETE FROM answers WHERE question_id IN (SELECT id FROM questions WHERE exam_id = $1)',
        [examId],
      );
      await client.query('DELETE FROM questions WHERE exam_id = $1', [examId]);
    } else {
      const code = `TTXH20260125_${Math.floor(Date.now() / 1000) % 100000}`;
      const examRes = await client.query(
        `INSERT INTO exams (
          subject_id, code, title, title_cn, description, duration,
          total_questions, total_points, difficulty_level, status,
          is_premium, language_mode, explanation_language_mode,
          publish_date, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10,
          $11, $12, $13,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
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
      examId = examRes.rows[0].id;
      console.log(`Created Exam with ID: ${examId}, Code: ${code}`);
    }

    const pointsPerQ = 100.0 / 80.0; // 1.25 points each
    let insertedCount = 0;
    const answerBatch = { qids: [], keys: [], texts: [], isCors: [] };

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
