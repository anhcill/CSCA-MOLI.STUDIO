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
  title: '2025 年 12 月 CSCA 文科（中文）试卷',
  title_cn: '2025 年 12 月 CSCA 文科（中文）试卷',
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
    'Đề thi chính thức CSCA Văn khoa (Tiếng Trung Xã hội) tháng 12/2025 (Đầy đủ 80 câu). Bao gồm 3 phần: Chọn đáp án thích hợp theo ngữ cảnh (Từ vựng - Thành ngữ - Ngữ pháp), Đọc điền từ tổng hợp và Đọc hiểu chuyên sâu. Đã kiểm định QA/QC 100% kèm lời giải chi tiết.',
};

const QUESTIONS_DATA = [
  // ── 一、根据语境，选择最恰当的答案（1—40 题） ──
  {
    num: 1,
    type: 'single_choice',
    category: 'Từ vựng & Ngữ cảnh',
    text: '年复一年的电视直播，并不总有新鲜、刺激的内容，很容易感到 ______ 难耐。而电视播音员最 ______ 的弱点，就是丧失了在镜头前的新鲜感，______ 新鲜感就丧失了激情。',
    options: [
      { key: 'A', text: '枯寂   要命   缺陷' },
      { key: 'B', text: '枯涩   送命   缺少' },
      { key: 'C', text: '枯燥   致命   缺乏' },
      { key: 'D', text: '枯竭   认命   没有' },
    ],
    correct: 'C',
    explanation:
      '1. “枯燥难耐” (kūzào nánnài): khô khan, tẻ nhạt đến mức khó chịu đựng nổi. (枯寂: vắng lặng cô quạnh; 枯涩: khô khốc; 枯竭: cạn kiệt).\n2. “致命的弱点” (zhìmìng de ruòdiǎn): điểm yếu chí mạng / tử huyệt (cụm cố định).\n3. “缺乏新鲜感” (quēfá xīnxiāngǎn): thiếu hụt cảm giác mới mẻ (缺乏 thường đi với danh từ trừu tượng).\n=> Đáp án đúng: (C).',
  },
  {
    num: 2,
    type: 'single_choice',
    category: 'Từ vựng & Ngữ cảnh',
    text: '在成年人的眼中，灰色、黑色服装 ______：平衡、安静、严肃、稳重，是一种思想成熟的 ______；而在少女们看来，它的 ______ 却是脱俗、清新、淡漠、空虚，甚至有点颓废，可其中也不乏有 ______ 成熟的含义。',
    options: [
      { key: 'A', text: '显示   标记   意义   追忆' },
      { key: 'B', text: '表示   标志   含义   追求' },
      { key: 'C', text: '暗示   标准   定义   追寻' },
      { key: 'D', text: '揭示   标明   要义   追随' },
    ],
    correct: 'B',
    explanation:
      '1. “表示” (biǎoshì): biểu thị, thể hiện ý nghĩa.\n2. “标志” (biāozhì): biểu tượng, dấu hiệu đặc trưng (思想成熟的标志).\n3. “含义” (hányì): hàm ý, ý nghĩa ẩn chứa bên trong (khớp với cụm 成熟的含义 ở cuối câu).\n4. “追求成熟” (zhuīqiú chéngshú): theo đuổi, hướng tới sự trưởng thành.\n=> Đáp án đúng: (B).',
  },
  {
    num: 3,
    type: 'single_choice',
    category: 'Từ vựng & Ngữ cảnh',
    text: '离开百花村前夕，主人置酒为我 ______。席间饮用的就是主人 ______ 的家酿荔枝酒。这酒果然 ______。可以毫不夸张地说，这是我有生以来喝到的最令人 ______ 的果酒了。',
    options: [
      { key: 'A', text: '饯行   珍藏   名不虚传   难忘' },
      { key: 'B', text: '辞行   珍贵   名副其实   遗忘' },
      { key: 'C', text: '送行   珍视   货真价实   淡忘' },
      { key: 'D', text: '饯别   珍奇   名声过实   不忘' },
    ],
    correct: 'A',
    explanation:
      '1. “置酒为我饯行” (jiànxíng): bày tiệc rượu tiễn chân người sắp đi xa (饯行 chuyên dùng cho việc 设宴送行; còn 辞行 là người đi chào tạm biệt người ở lại).\n2. “珍藏” (zhēncáng): cất giữ trân quý (làm định ngữ cho 家酿荔枝酒).\n3. “名不虚传” (míngbùxūchuán): danh bất hư truyền, tiếng đồn quả không sai.\n4. “最令人难忘” (zuì lìngrén nánwàng): khiến người ta khó quên nhất.\n=> Đáp án đúng: (A).',
  },
  {
    num: 4,
    type: 'single_choice',
    category: 'Từ vựng & Ngữ cảnh',
    text: '黄果树大瀑布的 ______ 主要由瀑布、水帘洞和犀牛潭三部分组成。瀑布高 74 米、宽 81 米。夏季河水暴涨时，瀑布 ______ 黄河倾泻，谷底轰鸣，发出 ______ 的响声，数里外就能听见。',
    options: [
      { key: 'A', text: '景象   仿佛   倒海翻江' },
      { key: 'B', text: '景物   犹如   暴风骤雨' },
      { key: 'C', text: '景色   好比   紧锣密鼓' },
      { key: 'D', text: '景致   有如   惊天动地' },
    ],
    correct: 'D',
    explanation:
      '⚠️ Lưu ý kiểm định QA/QC (File PDF gốc khoanh nhầm A, đáp án chuẩn xác 100% là D):\n1. “景致” (jǐngzhì): cảnh trí, thắng cảnh (bao gồm 3 điểm cảnh quan cụ thể: 瀑布、水帘洞和犀牛潭; còn 景象 chỉ hiện tượng/tình cảnh).\n2. “有如” (yǒurú): tựa như, giống như (有如黄河倾泻).\n3. “惊天动地” (jīngtiān-dòngdì): vang trời lở đất -> bổ nghĩa chuẩn xác cho “响声” (发出惊天动地的响声). Ngược lại “倒海翻江” ở A chỉ thế nước cuộn trào chứ không bổ nghĩa cho 响声.\n=> Đáp án đúng: (D).',
  },
  {
    num: 5,
    type: 'single_choice',
    category: 'Từ vựng & Ngữ cảnh',
    text: '戏曲是综合艺术，而一个演员很难在几个方面都达到 ______ 的境界，因而演员在发展自己的技艺时 ______ 根据自己的生理特点，有的以唱念 ______，有的重做工，有的善武打等等，因而所形成的流派自然也形形色色，______。',
    options: [
      { key: 'A', text: '空前绝后   大概   为主   各显神通' },
      { key: 'B', text: '登峰造极   大都   见长   各有千秋' },
      { key: 'C', text: '泰山北斗   大多   享誉   独挡一面' },
      { key: 'D', text: '首屈一指   大致   突出   匠心独运' },
    ],
    correct: 'B',
    explanation:
      '1. “登峰造极” (dēngfēng-zàojí): đạt tới đỉnh cao nhất của nghệ thuật/kỹ năng (达到登峰造极的境界).\n2. “大都” (dàdōu): đa phần, hầu hết.\n3. “以……见长” (yǐ... jiàncháng): lấy cái gì làm sở trường, thế mạnh (以唱念见长).\n4. “各有千秋” (gèyǒu-qiānqiū): mỗi trường phái đều có ưu điểm và giá trị đặc sắc riêng.\n=> Đáp án đúng: (B).',
  },
  {
    num: 6,
    type: 'single_choice',
    category: 'Từ vựng & Ngữ cảnh',
    text: '孔子对学生的求实精神，也是 ______ 的。如对公冶长，他认为公冶长人好；虽然被 ______ 进过监狱，但事实上系 ______ 不白之冤。由于孔子能正确对待这一问题，他不但不 ______ 公冶长，反而把自己的女儿嫁给他。',
    options: [
      { key: 'A', text: '一言难尽   送   遭受   近视' },
      { key: 'B', text: '无可比拟   蹲   忍受   蔑视' },
      { key: 'C', text: '不可企及   押   消受   仇视' },
      { key: 'D', text: '难能可贵   关   蒙受   歧视' },
    ],
    correct: 'D',
    explanation:
      '1. “难能可贵” (nánnéng-kěguì): hiếm có và đáng trân quý.\n2. “被关进过监狱”: bị nhốt/giam vào tù.\n3. “蒙受不白之冤” (méngshòu bùbái zhī yuān): chịu đựng nỗi oan khuất (cụm cố định 蒙受不白之冤).\n4. “歧视” (qíshì): kỳ thị, phân biệt đối xử.\n=> Đáp án đúng: (D).',
  },
  {
    num: 7,
    type: 'single_choice',
    category: 'Từ vựng & Ngữ cảnh',
    text: '人的头发中可分离出 ______ 物质，这是一种较手指指纹更具有特异性的生物学 ______，除了同卵双胞胎之外，任何人的遗传 ______ 都不可能一样。因此，通过查头发的“基因指纹”技术，科学家可以 ______ 人们的血缘关系。',
    options: [
      { key: 'A', text: '留给   目标   消息   证明' },
      { key: 'B', text: '遗传   指标   资料   解释' },
      { key: 'C', text: '遗留   目的   情报   说明' },
      { key: 'D', text: '留下   标准   资料   解释' },
    ],
    correct: 'B',
    explanation:
      '1. “遗传物质” (yíchuán wùzhì): vật chất di truyền (ADN).\n2. “生物学指标” (shēngwùxué zhǐbiāo): chỉ số/chỉ tiêu sinh học.\n3. “遗传资料” (yíchuán zīliào): thông tin, dữ liệu di truyền.\n4. “解释” (jiěshì): giải thích, làm sáng tỏ mối quan hệ huyết thống.\n=> Đáp án đúng: (B).',
  },
  {
    num: 8,
    type: 'single_choice',
    category: 'Từ vựng & Ngữ cảnh',
    text: '北京口语里 ______ 不用含有古语成分的名词，______ 这些名词在书面上常常使用。例如北京公共电汽车的站牌上写“首班车”和“末班车”几点到几点，口语里只有“末班车” ______，“首班车”改叫“头班车”或“第一班车”。原因在于“首”是古语成分，______ 不说。',
    options: [
      { key: 'A', text: '尽量   尽管   行得通   一般' },
      { key: 'B', text: '常常   但是   说得上   一律' },
      { key: 'C', text: '大概   虽然   听得懂   一概' },
      { key: 'D', text: '有时   因为   叫得开   一致' },
    ],
    correct: 'A',
    explanation:
      '1. “尽量” (jǐnliàng): cố gắng hết mức (hạn chế dùng từ cổ trong khẩu ngữ).\n2. “尽管” (jǐnguǎn): mặc dù (đặt đầu mệnh đề nhượng bộ bổ sung).\n3. “行得通” (xíngdetōng): thông dụng, dùng được trong khẩu ngữ thực tế.\n4. “一般不说” (yībān bù shuō): thông thường không nói.\n=> Đáp án đúng: (A).',
  },
  {
    num: 9,
    type: 'single_choice',
    category: 'Từ vựng & Ngữ cảnh',
    text: '一 ______ 最能真实反映母亲形象和性格的画像，总是 ______ 在我的身旁，她那亲切的目光 ______ 着我，那棱角分明的面颊和口唇，透着她那特有的刚毅和善良。仰望着她，耳边就响起母亲的谆谆 ______，告诉我去善待人生和世人。',
    options: [
      { key: 'A', text: '方   追随   平视   教授' },
      { key: 'B', text: '张   相伴   凝视   教益' },
      { key: 'C', text: '幅   伴随   注视   教诲' },
      { key: 'D', text: '贴   跟随   珍视   教育' },
    ],
    correct: 'C',
    explanation:
      '1. “一幅画像” (yì fú huàxiàng): lượng từ chuẩn của tranh vẽ là 幅.\n2. “伴随在我的身旁” (bànsuí): bầu bạn, đồng hành bên cạnh.\n3. “目光注视着我” (zhùshì): ánh mắt chăm chú dõi nhìn.\n4. “谆谆教诲” (zhūnzhūn jiàohuì): lời răn dạy, chỉ bảo ân cần tha thiết (cụm cố định).\n=> Đáp án đúng: (C).',
  },
  {
    num: 10,
    type: 'single_choice',
    category: 'Từ vựng & Ngữ cảnh',
    text: '白云观堪称北京最大的道观，观内十分 ______。过去很少开放，近代又逐渐 ______，往往不为人们 ______ 了。它 ______ 座落在广播大楼后面、西便门外约两里多路的地方。',
    options: [
      { key: 'A', text: '轩敞   衰弱   所晓   岿然' },
      { key: 'B', text: '宽敞   衰败   所道   蔚然' },
      { key: 'C', text: '宏敞   衰落   所知   巍然' },
      { key: 'D', text: '宽阔   衰竭   所识   赦然' },
    ],
    correct: 'C',
    explanation:
      '⚠️ Lưu ý kiểm định QA/QC (File PDF gốc khoanh nhầm D, đáp án chuẩn xác 100% là C):\n1. “宏敞” (hóngchǎng): rộng lớn, cao ráo bề thế (chuyên dùng cho cung điện, đền quán).\n2. “衰落” (shuāiluò): suy tàn, sa sút (dùng cho công trình, triều đại; còn “衰竭” ở D là suy kiệt nội tạng như 心力衰竭).\n3. “不为人们所知”: cấu trúc cố định “不为……所知” (không được ai biết đến).\n4. “巍然座落” (wēirán zuòluò): uy nghi sừng sững tọa lạc (chữ “赦然” ở D là từ sai chính tả không tồn tại).\n=> Đáp án đúng: (C).',
  },
  {
    num: 11,
    type: 'single_choice',
    category: 'Từ vựng & Ngữ cảnh',
    text: '“别着急，别着急，你站在那儿别动，让我找找看”。他 ______ 着我。他打着手电在地上 ______ 着，终于在一片芦苇边 ______ 又发现了脚印。当我又听到和田河的水声时，______ 感到了一种轻松和快慰。',
    options: [
      { key: 'A', text: '安抚   搜寻   头   瞬时' },
      { key: 'B', text: '安慰   搜索   上   顿时' },
      { key: 'C', text: '安置   搜捕   前   刹时' },
      { key: 'D', text: '安排   搜罗   右   登时' },
    ],
    correct: 'B',
    explanation:
      '1. “安慰” (ānwèi): an ủi bằng lời nói.\n2. “搜索” (sōusuǒ): rà soát, tìm kiếm kỹ lưỡng.\n3. “芦苇边上” (biānshang): ở mép, ở ven đám lau sậy.\n4. “顿时” (dùnshí): lập tức, bỗng chốc cảm thấy nhẹ nhõm.\n=> Đáp án đúng: (B).',
  },
  {
    num: 12,
    type: 'single_choice',
    category: 'Từ vựng & Ngữ cảnh',
    text: '流行音乐的旋律普遍都很简单，一般是以人声为主，而人声 ______ 追求如何使听众激动。经典音乐主要是用乐器来确定并 ______ 旋律的，即使歌剧演唱，也必须以旋律性器乐为 ______；流行音乐则相反，由歌曲主导旋律、______ 旋律，即使器乐引子以及间或出现的过门，也无非是重复歌曲的某一 ______。',
    options: [
      { key: 'A', text: '偏重   引导   依托   支配   部分' },
      { key: 'B', text: '侧重   编导   依据   支持   阶段' },
      { key: 'C', text: '注重   指导   依附   支援   过程' },
      { key: 'D', text: '看重   诱导   依靠   支使   曲调' },
    ],
    correct: 'A',
    explanation:
      '1. “偏重” (piānzhòng): thiên về, nghiêng trọng tâm về.\n2. “引导旋律” (yǐndǎo): dẫn dắt giai điệu.\n3. “以……为依托” (yītuō): lấy cái gì làm chỗ dựa, nền tảng nâng đỡ.\n4. “支配旋律” (zhīpèi): chi phối, làm chủ giai điệu.\n5. “某一部分” (bùfen): một phần nào đó của bài hát.\n=> Đáp án đúng: (A).',
  },
  {
    num: 13,
    type: 'single_choice',
    category: 'Từ vựng & Ngữ cảnh',
    text: '现代工业的飞速发展 ______ 给人类带来高质量的物质享受，但对我们赖以 ______ 的环境也带来了极大的破坏，这使人们更加 ______ 自身的健康。功能性食品、绿色食品和学生营养配餐食品 ______，代表食品工业另一发展方向。',
    options: [
      { key: 'A', text: '固然   生息   关系   不破不立' },
      { key: 'B', text: '倒是   生活   关心   根深叶茂' },
      { key: 'C', text: '尽管   生计   关怀   水到渠成' },
      { key: 'D', text: '虽然   生存   关注   应运而生' },
    ],
    correct: 'D',
    explanation:
      '1. “虽然……但……”: cặp liên từ nhượng bộ - chuyển ngoặt.\n2. “赖以生存的环境”: môi trường dựa vào đó để sinh tồn (cụm cố định 赖以生存).\n3. “关注自身的健康”: quan tâm, chú ý đến sức khỏe bản thân.\n4. “应运而生” (yìngyùn\'érshēng): ra đời đúng vào lúc thời thế/nhu cầu đòi hỏi.\n=> Đáp án đúng: (D).',
  },
  {
    num: 14,
    type: 'single_choice',
    category: 'Từ vựng & Ngữ cảnh',
    text: '许多优秀人才仅仅因在招聘面试过程中的小小失误就失去了 ______ 的工作机会。尽管面试形式多种多样，主考官的提问 ______，目前尚无 ______ 的应试方法可供应聘者借鉴，但以下要点 ______ 可以使应聘者提高应试能力，增加成功率。',
    options: [
      { key: 'A', text: '幸好   纷至沓来   无可争辩   一定' },
      { key: 'B', text: '较好   俯拾皆是   十拿九稳   肯定' },
      { key: 'C', text: '良好   五花八门   万无一失   无疑' },
      { key: 'D', text: '大好   不胜枚举   不在话下   必然' },
    ],
    correct: 'C',
    explanation:
      '1. “良好的工作机会”: cơ hội việc làm tốt đẹp.\n2. “五花八门” (wǔhuā-bāmén): muôn hình vạn trạng, đủ mọi kiểu đa dạng (bổ nghĩa cho 提问).\n3. “万无一失” (wànwú-yīshī): chắc chắn tuyệt đối, không một sơ suất nhỏ.\n4. “无疑” (wúyí): không còn nghi ngờ gì nữa, chắc chắn.\n=> Đáp án đúng: (C).',
  },
  {
    num: 15,
    type: 'single_choice',
    category: 'Từ vựng & Ngữ cảnh',
    text: '东方文化是比较 ______ 谦虚和待人宽厚的。所以，我们一般 ______ 接受那种态度平和的主持人，而对咄咄逼人的主持人则会 ______。同样面对采访提问，我们比较喜欢回答平易友善的问题，而 ______ 欣赏那种尖锐挑战的追问。',
    options: [
      { key: 'A', text: '崇拜   容易   等闲视之   不会' },
      { key: 'B', text: '注重   喜欢   漠然置之   未必' },
      { key: 'C', text: '注视   喜欢   漠然置之   不太' },
      { key: 'D', text: '崇尚   乐于   敬而远之   不大' },
    ],
    correct: 'D',
    explanation:
      '1. “崇尚” (chóngshàng): tôn sùng, đề cao (giá trị văn hóa, đạo đức).\n2. “乐于接受” (lèyú jiēshòu): vui vẻ, sẵn lòng tiếp nhận.\n3. “敬而远之” (jìng\'éryuǎnzhī): bề ngoài giữ phép lịch sự nhưng thực chất giữ khoảng cách tránh xa.\n4. “不大欣赏”: không mấy tán thưởng.\n=> Đáp án đúng: (D).',
  },
  {
    num: 16,
    type: 'single_choice',
    category: 'Từ vựng & Ngữ cảnh',
    text: '______ 的事实已经证明，对自然的无情和残酷，是要受到 ______ 的。人类在发展农业方面，必须注重 ______ 自然的协调，不能只是 ______ 地向大自然索取甚至掠夺。',
    options: [
      { key: 'A', text: '严重   教训   同   一并' },
      { key: 'B', text: '残酷   惩罚   跟   一贯' },
      { key: 'C', text: '严峻   报应   与   一味' },
      { key: 'D', text: '严明   鞭挞   和   一概' },
    ],
    correct: 'C',
    explanation:
      '1. “严峻的事实” (yánjùn de shìshí): sự thật khắc nghiệt, nghiêm trọng.\n2. “受到报应” (shòudào bàoyìng): nhận lấy quả báo, sự trả giá.\n3. “与自然的协调”: sự phối hợp hài hòa với tự nhiên.\n4. “一味地” (yíwèi de): chỉ một mực, cứ mù quáng làm mãi theo một chiều hướng.\n=> Đáp án đúng: (C).',
  },
  {
    num: 17,
    type: 'single_choice',
    category: 'Từ vựng & Ngữ cảnh',
    text: '______ 的最佳时间是饭后 30 分钟。首先，人们 ______ 吃过饭后，大量食物集中在胃里，需要大量的消化液和血液来帮助胃把食物消化掉。若饭后 ______ 外出散步，血液会被运送到全身的各个部位，使胃肠血液供应不足，食物得不到很好的消化。其次，肠胃消化液的产生，是因食物刺激的条件反射，才分泌旺盛；若饭后马上散步，肠胃会在活动中加快蠕动，而把没有经过充分消化的食物过早地推进小肠，______ 不但增加了小肠的负担，______ 食物中的营养素也得不到充分消化和吸收。',
    options: [
      { key: 'A', text: '散步   刚刚   立即   这样   而且' },
      { key: 'B', text: '漫步   刚才   迅即   这些   而已' },
      { key: 'C', text: '遛达   方才   即时   这个   而况' },
      { key: 'D', text: '遛弯   适才   立时   这里   而后' },
    ],
    correct: 'A',
    explanation:
      '1. “散步” (sànbù): đi dạo bộ (khớp với từ 外出散步, 马上散步 trong đoạn).\n2. “刚刚吃过饭后”: vừa mới ăn cơm xong (刚刚 là phó từ đứng sau chủ ngữ 人们).\n3. “立即” (lìjí): ngay lập tức.\n4. “这样” (zhèyàng): như vậy (thay thế cho tình huống ở vế trước).\n5. “不但……，而且……”: không những..., mà còn...\n=> Đáp án đúng: (A).',
  },
  {
    num: 18,
    type: 'single_choice',
    category: 'Từ vựng & Ngữ cảnh',
    text: '边想边说不容易。______，想在嘴上说得出话来，得在脑子里想清楚。想清楚了，说起话来，______，词句妥贴、在理。______，脑子里含混不清，说起话来自然抓不住中心，______，漏洞百出。',
    options: [
      { key: 'A', text: '必须   慢条斯理   另外   蜻蜓点水' },
      { key: 'B', text: '开始   条理分明   反之   鼠目寸光' },
      { key: 'C', text: '首先   有条不紊   相反   支离破碎' },
      { key: 'D', text: '最初   滔滔不绝   相对   泛泛而谈' },
    ],
    correct: 'C',
    explanation:
      '1. “首先” (shǒuxiān): trước hết, đầu tiên.\n2. “有条不紊” (yǒutiáo-bùwěn): đâu vào đấy, mạch lạc trật tự.\n3. “相反” (xiāngfǎn): ngược lại.\n4. “支离破碎” (zhīlí-pòsuì): rời rạc, vụn vặt, manh mún.\n=> Đáp án đúng: (C).',
  },
  {
    num: 19,
    type: 'single_choice',
    category: 'Từ vựng & Ngữ cảnh',
    text: '儒家思想在中国文化中 ______ 主流地位，从孔子开始，逐渐形成塑造了中国人的行为 ______，______ 中国人的日常伦理与所追寻的价值贡献甚大。______，孔子被尊称为“至圣先师”。',
    options: [
      { key: 'A', text: '居   模式   对   为此' },
      { key: 'B', text: '占   规范   给   因此' },
      { key: 'C', text: '有   模样   使   故而' },
      { key: 'D', text: '拥   方式   从   所以' },
    ],
    correct: 'B',
    explanation:
      '- Theo barem đề thi CSCA: Chọn (B) với các cụm “占主流地位” (chiếm địa vị chủ lưu), “行为规范” (chuẩn mực hành vi), “因此” (vì vậy).\n- Lưu ý mở rộng theo ngân hàng đề HSK Cao cấp gốc: Ở vị trí trống thứ 3 (“______ 中国人的日常伦理与所追寻的价值贡献甚大”), giới từ chuẩn đi với “贡献甚大” là “对” (“对……贡献甚大”), cùng với “居主流地位” và “行为模式” ở phương án (A).\n=> Đáp án theo barem đề: (B).',
  },
  {
    num: 20,
    type: 'single_choice',
    category: 'Từ vựng & Ngữ cảnh',
    text: '坐办公室，除了工作，最重要的 ______ 与周围同事和睦相处，为大家和自己 ______ 宽松愉悦的环境。______，一生中的大部分光阴要在办公室中度过。过了十几年的校园生活，我一向对人 ______，口没遮拦，初进大机关时，还真吃了不少 ______。',
    options: [
      { key: 'A', text: '就是   创造   毕竟   心无芥蒂   苦头' },
      { key: 'B', text: '即是   编织   因为   诚心诚意   甜头' },
      { key: 'C', text: '便是   建造   虽然   心安理得   说头' },
      { key: 'D', text: '还是   营造   即使   心有余悸   话头' },
    ],
    correct: 'A',
    explanation:
      '1. “最重要的就是……”: điều quan trọng nhất chính là...\n2. “创造……环境”: tạo ra môi trường.\n3. “毕竟” (bìjìng): suy cho cùng, xét cho cùng.\n4. “心无芥蒂” (xīnwú-jièdì): trong lòng không chút khúc mắc, vô tư thẳng thắn.\n5. “吃苦头” (chī kǔtou): nếm mùi cay đắng, chịu thiệt thòi.\n=> Đáp án đúng: (A).',
  },
  {
    num: 21,
    type: 'single_choice',
    category: 'Ngữ pháp & Hư từ',
    text: '在中国，传统医药一直发挥 ______ 十分重要的作用。',
    options: [
      { key: 'A', text: '了' },
      { key: 'B', text: '着' },
      { key: 'C', text: '一下' },
      { key: 'D', text: '过' },
    ],
    correct: 'B',
    explanation:
      'Phó từ “一直” (luôn luôn, suốt từ trước tới nay) kết hợp với trợ từ động thái “着” (“一直发挥着……作用”) để biểu thị trạng thái/tác dụng đang tiếp diễn liên tục.\n=> Đáp án đúng: (B) 着.',
  },
  {
    num: 22,
    type: 'single_choice',
    category: 'Ngữ pháp & Hư từ',
    text: '在谈判桌上双方 ______ 代表着自己的利益。',
    options: [
      { key: 'A', text: '互相' },
      { key: 'B', text: '各自' },
      { key: 'C', text: '彼此' },
      { key: 'D', text: '各个' },
    ],
    correct: 'B',
    explanation:
      'Đại từ “各自” (mỗi bên tự, ai nấy riêng phần mình): Trên bàn đàm phán, hai bên mỗi bên tự đại diện cho lợi ích của chính mình.\n=> Đáp án đúng: (B) 各自.',
  },
  {
    num: 23,
    type: 'single_choice',
    category: 'Ngữ pháp & Hư từ',
    text: '请他来吃饭，我倒是可以去，可他要是不肯来 ______？',
    options: [
      { key: 'A', text: '吧' },
      { key: 'B', text: '吗' },
      { key: 'C', text: '呢' },
      { key: 'D', text: '啊' },
    ],
    correct: 'C',
    explanation:
      'Trợ từ ngữ khí “呢” dùng ở cuối câu hỏi giả định tỉnh lược hệ quả (“可他要是不肯来呢？” = Nhưng nhỡ anh ta không chịu đến thì tính sao?).\n=> Đáp án đúng: (C) 呢.',
  },
  {
    num: 24,
    type: 'single_choice',
    category: 'Ngữ pháp & Hư từ',
    text: '我低着头在剧场门口 ______ 地走着。',
    options: [
      { key: 'A', text: '来回来回' },
      { key: 'B', text: '回来回来' },
      { key: 'C', text: '来来回回' },
      { key: 'D', text: '来回回来' },
    ],
    correct: 'C',
    explanation:
      'Hình thức láy AABB chuẩn của động từ “来回” là “来来回回” (đi qua đi lại, đi đi lại lại).\n=> Đáp án đúng: (C) 来来回回.',
  },
  {
    num: 25,
    type: 'single_choice',
    category: 'Ngữ pháp & Hư từ',
    text: '你知道鳄鱼 ______ 经常张开嘴巴“微笑”着晒太阳吗？',
    options: [
      { key: 'A', text: '怎么' },
      { key: 'B', text: '怎么样' },
      { key: 'C', text: '为什么' },
      { key: 'D', text: '怎样' },
    ],
    correct: 'C',
    explanation:
      'Câu hỏi tìm hiểu nguyên nhân của hiện tượng tự nhiên (cá sấu há miệng khi phơi nắng để tản nhiệt điều hòa thân nhiệt) -> dùng “为什么” (tại sao).\n=> Đáp án đúng: (C) 为什么.',
  },
  {
    num: 26,
    type: 'single_choice',
    category: 'Ngữ pháp & Hư từ',
    text: '妈，今天我跟姐要进城办点事儿，说不准什么时候回来，晚饭就别等 ______ 了。',
    options: [
      { key: 'A', text: '咱们' },
      { key: 'B', text: '我们' },
      { key: 'C', text: '人家' },
      { key: 'D', text: '别人' },
    ],
    correct: 'B',
    explanation:
      'Phân biệt “咱们” (bao gồm cả người nghe) và “我们” (có thể loại trừ người nghe). Người con nói với mẹ rằng mình và chị gái đi vào nội thành, tối mẹ ở nhà đừng chờ cơm hai chị em -> không bao gồm người nghe (mẹ), bắt buộc dùng “我们”.\n=> Đáp án đúng: (B) 我们.',
  },
  {
    num: 27,
    type: 'single_choice',
    category: 'Ngữ pháp & Hư từ',
    text: '经过抢救，孩子终于苏醒了 ______，大夫、护士和孩子的父母都松了一口气。',
    options: [
      { key: 'A', text: '下来' },
      { key: 'B', text: '过来' },
      { key: 'C', text: '下去' },
      { key: 'D', text: '过去' },
    ],
    correct: 'B',
    explanation:
      'Bổ ngữ xu hướng kép “过来” sau động từ “苏醒 / 醒” biểu thị chuyển từ trạng thái hôn mê trở về trạng thái tỉnh táo bình thường (“苏醒过来”).\n=> Đáp án đúng: (B) 过来.',
  },
  {
    num: 28,
    type: 'single_choice',
    category: 'Ngữ pháp & Hư từ',
    text: '这种淳朴的农村生活 ______ 我带来了不可估量的好处，我从此懂得了友情。',
    options: [
      { key: 'A', text: '向' },
      { key: 'B', text: '将' },
      { key: 'C', text: '给' },
      { key: 'D', text: '让' },
    ],
    correct: 'C',
    explanation:
      'Cấu trúc cố định “给 + Tân ngữ chỉ người + 带来……” (mang lại lợi ích/ảnh hưởng gì cho ai).\n=> Đáp án đúng: (C) 给.',
  },
  {
    num: 29,
    type: 'single_choice',
    category: 'Ngữ pháp & Hư từ',
    text: '近年来，高科技含量的数码类礼品最 ______ 顾客欢迎。',
    options: [
      { key: 'A', text: '被' },
      { key: 'B', text: '由' },
      { key: 'C', text: '受' },
      { key: 'D', text: '给' },
    ],
    correct: 'C',
    explanation:
      'Cấu trúc cố định “最受（顾客/大家）欢迎” (được khách hàng/mọi người ưa chuộng, chào đón nhất).\n=> Đáp án đúng: (C) 受.',
  },
  {
    num: 30,
    type: 'single_choice',
    category: 'Ngữ pháp & Hư từ',
    text: '这件事 ______ 讨论来讨论去，也没作出什么决定。',
    options: [
      { key: 'A', text: '自己' },
      { key: 'B', text: '本人' },
      { key: 'C', text: '大家' },
      { key: 'D', text: '人家' },
    ],
    correct: 'C',
    explanation:
      'Hành động “讨论来讨论去” (thảo luận qua thảo luận lại) phải do một tập thể nhiều người thực hiện -> dùng đại từ “大家” (mọi người).\n=> Đáp án đúng: (C) 大家.',
  },
  {
    num: 31,
    type: 'single_choice',
    category: 'Ngữ pháp & Hư từ',
    text: '前年他住院 ______ 都是他侄子照顾他，他的儿女连个影儿都没见着。',
    options: [
      { key: 'A', text: '那会儿' },
      { key: 'B', text: '这会儿' },
      { key: 'C', text: '一会儿' },
      { key: 'D', text: '过会儿' },
    ],
    correct: 'A',
    explanation:
      'Danh từ thời gian “那会儿” đặt sau cụm “前年他住院” chỉ mốc thời gian trong quá khứ (hồi đó, lúc ông ấy nằm viện năm kia).\n=> Đáp án đúng: (A) 那会儿.',
  },
  {
    num: 32,
    type: 'single_choice',
    category: 'Ngữ pháp & Hư từ',
    text: '跟她见面以前我还 ______ 她的家庭温馨美满，没想到已濒临破裂的边缘了。',
    options: [
      { key: 'A', text: '认为' },
      { key: 'B', text: '以为' },
      { key: 'C', text: '觉得' },
      { key: 'D', text: '感到' },
    ],
    correct: 'B',
    explanation:
      'Động từ “以为” chuyên dùng để chỉ nhận định, tưởng tượng chủ quan trong quá khứ mà sau đó phát hiện ra là trái ngược với sự thật (đi với 没想到 / 原来).\n=> Đáp án đúng: (B) 以为.',
  },
  {
    num: 33,
    type: 'single_choice',
    category: 'Ngữ pháp & Hư từ',
    text: '他的母亲是一个美丽的女人，______ 自己高贵的出身，她总是感到非常骄傲。',
    options: [
      { key: 'A', text: '至于' },
      { key: 'B', text: '作为' },
      { key: 'C', text: '自从' },
      { key: 'D', text: '对于' },
    ],
    correct: 'D',
    explanation:
      'Giới từ “对于” dùng để dẫn ra đối tượng mà chủ ngữ hướng thái độ, tình cảm tới (“对于自己高贵的出身，她总是感到非常骄傲”).\n=> Đáp án đúng: (D) 对于.',
  },
  {
    num: 34,
    type: 'single_choice',
    category: 'Ngữ pháp & Hư từ',
    text: '天气一天比一天暖和 ______，户外阳光灿烂，鸟语花香，姑娘们也穿上了各式春装。',
    options: [
      { key: 'A', text: '得多' },
      { key: 'B', text: '一点儿' },
      { key: 'C', text: '了' },
      { key: 'D', text: '极了' },
    ],
    correct: 'C',
    explanation:
      'Khi phía trước tính từ đã có trạng ngữ so sánh tịnh tiến “一天比一天” (ngày một...), phía sau tính từ chỉ dùng trợ từ ngữ khí “了” để chỉ sự biến đổi trạng thái.\n=> Đáp án đúng: (C) 了.',
  },
  {
    num: 35,
    type: 'single_choice',
    category: 'Ngữ pháp & Hư từ',
    text: '最近首都电影院推出了一种新的购票形式——电影月票，它 ______ 一张印制精美的纪念卡和四张半价优惠券组成。',
    options: [
      { key: 'A', text: '从' },
      { key: 'B', text: '自' },
      { key: 'C', text: '由' },
      { key: 'D', text: '被' },
    ],
    correct: 'C',
    explanation:
      'Cấu trúc cố định “由……组成” (được cấu thành/hợp thành từ những bộ phận nào).\n=> Đáp án đúng: (C) 由.',
  },
  {
    num: 36,
    type: 'single_choice',
    category: 'Ngữ pháp & Hư từ',
    text: '她 ______ 认为在这一个多月的实习时间里自己的工作态度是认真的。',
    options: [
      { key: 'A', text: '早晚' },
      { key: 'B', text: '先后' },
      { key: 'C', text: '终于' },
      { key: 'D', text: '始终' },
    ],
    correct: 'D',
    explanation:
      'Phó từ “始终” (từ đầu chí cuối, trước sau như một) bổ nghĩa cho động từ tâm lý “认为” (“始终认为” - luôn luôn cho rằng).\n=> Đáp án đúng: (D) 始终.',
  },
  {
    num: 37,
    type: 'single_choice',
    category: 'Ngữ pháp & Hư từ',
    text: '他下星期要去桂林，______ 他想放松一下紧张的心情，______ 想回家探望一下父母。',
    options: [
      { key: 'A', text: '一边……一边……' },
      { key: 'B', text: '又……又……' },
      { key: 'C', text: '既……也……' },
      { key: 'D', text: '一来……二来……' },
    ],
    correct: 'D',
    explanation:
      'Cặp từ nối “一来……，二来……” dùng để liệt kê hai nguyên nhân hoặc mục đích của một quyết định, và đứng trước được chủ ngữ “他”.\n=> Đáp án đúng: (D) 一来……二来…….',
  },
  {
    num: 38,
    type: 'single_choice',
    category: 'Ngữ pháp & Hư từ',
    text: '______ 索尼公司对“投诉”事件曾做过一些不尽人意的“客观”解释，______ 至少有一点是让人服气的：它最后真的把消费者的意见当做改善其产品及其服务质量的财富。',
    options: [
      { key: 'A', text: '尽管……但……' },
      { key: 'B', text: '只有……才……' },
      { key: 'C', text: '如果……就……' },
      { key: 'D', text: '无论……都……' },
    ],
    correct: 'A',
    explanation:
      'Vế trước nêu hạn chế (từng đưa ra lời giải thích chưa thỏa đáng), vế sau khẳng định điểm đáng khâm phục -> quan hệ nhượng bộ - chuyển ngoặt: “尽管……，但……” (Mặc dù..., nhưng...).\n=> Đáp án đúng: (A) 尽管……但…….',
  },
  {
    num: 39,
    type: 'single_choice',
    category: 'Ngữ pháp & Hư từ',
    text: '你们 ______ 那儿只是一片铺满了白砂的海底。那儿生长着最奇异的树木和植物。',
    options: [
      { key: 'A', text: '要千万不以为' },
      { key: 'B', text: '千万不要以为' },
      { key: 'C', text: '千万不以为' },
      { key: 'D', text: '不要千万以为' },
    ],
    correct: 'B',
    explanation:
      'Trật tự chuẩn của cụm phó từ khuyên can nhấn mạnh: 千万 (tuyệt đối) + 不要 (đừng) + 以为 (tưởng rằng) -> “千万不要以为”.\n=> Đáp án đúng: (B) 千万不要以为.',
  },
  {
    num: 40,
    type: 'single_choice',
    category: 'Ngữ pháp & Hư từ',
    text: '现在他又搬到漂亮的房间里去住，又 ______。',
    options: [
      { key: 'A', text: '穿起来漂亮的衣服了' },
      { key: 'B', text: '穿漂亮的衣服起来了' },
      { key: 'C', text: '穿起漂亮的衣服来了' },
      { key: 'D', text: '起来穿了漂亮的衣服' },
    ],
    correct: 'C',
    explanation:
      'Quy tắc vị trí tân ngữ với bổ ngữ xu hướng kép “起来”: Tân ngữ danh từ (漂亮的衣服) bắt buộc phải chèn vào giữa “起” và “来”: 穿 + 起 + 漂亮的衣服 + 来 + 了.\n=> Đáp án đúng: (C) 穿起漂亮的衣服来了.',
  },

  // ── 二、综合选择，根据文意，选择正确答案（41—60 题） ──
  {
    num: -1,
    type: 'reading_passage',
    category: 'Đọc điền từ tổng hợp',
    text: '综合选择（41—50 题）',
    passage_text:
      '那是大学三年级的时候，他同时喜欢上了两个女孩子：一个家里很穷，另一个则【41】较好。她们两个都爱他，而在他眼里，她们也都很【42】。他不知道应该选谁做妻子。有一次，他到那个很穷的女孩家玩，她的房间非常【43】，没什么像样的家具。但当他走到窗前时，发现窗台上放了一瓶花——瓶子只是一个【44】的水杯，花也是在田野里【45】来的野花。\n就在那一瞬，他下【46】决心，【47】那个穷女孩为自己终身所依。促使他下这个决心的【48】很简单，那个女孩子虽然穷，却是个懂得如何生活的人，将来，无论他们【49】什么困难，他相信她都不会失去对生活的【50】。',
    children: [
      {
        num: 41,
        text: '请选出填入文中【41】处最恰当的一项（“一个家里很穷，另一个则【41】较好。”）：',
        options: [
          { key: 'A', text: '家境' },
          { key: 'B', text: '家园' },
          { key: 'C', text: '家庭' },
          { key: 'D', text: '情境' },
        ],
        correct: 'A',
        explanation:
          '“家境” (jiājìng) = hoàn cảnh kinh tế gia đình, đối lập trực tiếp với “家里很穷” ở vế trước (“家境较好” = hoàn cảnh gia đình khá giả hơn).\n=> Đáp án đúng: (A) 家境.',
      },
      {
        num: 42,
        text: '请选出填入文中【42】处最恰当的一项（“而在他眼里，她们也都很【42】。”）：',
        options: [
          { key: 'A', text: '优美' },
          { key: 'B', text: '优越' },
          { key: 'C', text: '优良' },
          { key: 'D', text: '优秀' },
        ],
        correct: 'D',
        explanation:
          '“优秀” (yōuxiù) = ưu tú, xuất sắc (dùng để khen phẩm chất, năng lực con người).\n=> Đáp án đúng: (D) 优秀.',
      },
      {
        num: 43,
        text: '请选出填入文中【43】处最恰当的一项（“她的房间非常【43】，没什么像样的家具。”）：',
        options: [
          { key: 'A', text: '简单' },
          { key: 'B', text: '简直' },
          { key: 'C', text: '简陋' },
          { key: 'D', text: '简朴' },
        ],
        correct: 'C',
        explanation:
          '“简陋” (jiǎnlòu) = đơn sơ, tuềnh toàng, thiếu thốn tiện nghi (khớp với vế sau “没什么像样的家具”).\n=> Đáp án đúng: (C) 简陋.',
      },
      {
        num: 44,
        text: '请选出填入文中【44】处最恰当的一项（“瓶子只是一个【44】的水杯”）：',
        options: [
          { key: 'A', text: '普通' },
          { key: 'B', text: '普遍' },
          { key: 'C', text: '通常' },
          { key: 'D', text: '时常' },
        ],
        correct: 'A',
        explanation:
          '“普通的水杯” (pǔtōng de shuǐbēi) = một chiếc cốc uống nước bình thường.\n=> Đáp án đúng: (A) 普通.',
      },
      {
        num: 45,
        text: '请选出填入文中【45】处最恰当的一项（“花也是在田野里【45】来的野花。”）：',
        options: [
          { key: 'A', text: '取' },
          { key: 'B', text: '拿' },
          { key: 'C', text: '彩' },
          { key: 'D', text: '采' },
        ],
        correct: 'D',
        explanation:
          '“采” (cǎi) = hái (hoa, lá): “在田野里采来的野花” (hoa dại hái từ ngoài đồng).\n=> Đáp án đúng: (D) 采.',
      },
      {
        num: 46,
        text: '请选出填入文中【46】处最恰当的一项（“就在那一瞬，他下【46】决心”）：',
        options: [
          { key: 'A', text: '定' },
          { key: 'B', text: '准' },
          { key: 'C', text: '好' },
          { key: 'D', text: '完' },
        ],
        correct: 'A',
        explanation:
          'Cụm cố định “下定决心” (hạ quyết tâm).\n=> Đáp án đúng: (A) 定.',
      },
      {
        num: 47,
        text: '请选出填入文中【47】处最恰当的一项（“【47】那个穷女孩为自己终身所依。”）：',
        options: [
          { key: 'A', text: '选择' },
          { key: 'B', text: '选取' },
          { key: 'C', text: '挑选' },
          { key: 'D', text: '挑拣' },
        ],
        correct: 'A',
        explanation:
          '“选择……为自己终身所依” (lựa chọn làm người bạn đời / chỗ dựa trọn đời).\n=> Đáp án đúng: (A) 选择.',
      },
      {
        num: 48,
        text: '请选出填入文中【48】处最恰当的一项（“促使他下这个决心的【48】很简单”）：',
        options: [
          { key: 'A', text: '道理' },
          { key: 'B', text: '原理' },
          { key: 'C', text: '理由' },
          { key: 'D', text: '由来' },
        ],
        correct: 'C',
        explanation:
          '“促使他下这个决心的理由” = lý do thúc đẩy anh đưa ra quyết định này.\n=> Đáp án đúng: (C) 理由.',
      },
      {
        num: 49,
        text: '请选出填入文中【49】处最恰当的一项（“将来，无论他们【49】什么困难”）：',
        options: [
          { key: 'A', text: '得到' },
          { key: 'B', text: '见到' },
          { key: 'C', text: '遇见' },
          { key: 'D', text: '遇到' },
        ],
        correct: 'D',
        explanation:
          '“遇到困难” = gặp phải khó khăn (còn 遇见 thường đi với tân ngữ chỉ người).\n=> Đáp án đúng: (D) 遇到.',
      },
      {
        num: 50,
        text: '请选出填入文中【50】处最恰当的一项（“他相信她都不会失去对生活的【50】。”）：',
        options: [
          { key: 'A', text: '决心' },
          { key: 'B', text: '信心' },
          { key: 'C', text: '信仰' },
          { key: 'D', text: '信任' },
        ],
        correct: 'B',
        explanation:
          '“失去对生活的信心” = đánh mất niềm tin vào cuộc sống.\n=> Đáp án đúng: (B) 信心.',
      },
    ],
  },
  {
    num: -2,
    type: 'reading_passage',
    category: 'Đọc điền từ tổng hợp',
    text: '综合选择（51—57 题）',
    passage_text:
      '尽管近年来各种快餐【51】红火，但是，“自带午饭”这一传统仍然为众多的家庭所【52】。只是随着科技的进步，一种新型的保温便当盒正逐渐取代了传统的饭盒。\n这种新型保温便当盒外壳多【53】耐撞击原料制成，坚固耐用。内胆有多种材料类型，能经受冷热冲击，盛装食品无味，【54】卫生。而最主要的是它具有上佳的保温【55】，使饭菜能在长时间内【56】温热新鲜，不走味，省去了热饭的负担。不过，使用时应注意【57】接近火源及放置沸水锅中滚烫，以免发生软化。',
    children: [
      {
        num: 51,
        text: '请选出填入文中【51】处最恰当的一项（“尽管近年来各种快餐【51】红火”）：',
        options: [
          { key: 'A', text: '商业' },
          { key: 'B', text: '营业' },
          { key: 'C', text: '生意' },
          { key: 'D', text: '经营' },
        ],
        correct: 'C',
        explanation:
          '“生意红火” = việc làm ăn buôn bán phát đạt, đông khách.\n=> Đáp án đúng: (C) 生意.',
      },
      {
        num: 52,
        text: '请选出填入文中【52】处最恰当的一项（“‘自带午饭’这一传统仍然为众多的家庭所【52】。”）：',
        options: [
          { key: 'A', text: '保留' },
          { key: 'B', text: '留下' },
          { key: 'C', text: '保护' },
          { key: 'D', text: '维持' },
        ],
        correct: 'A',
        explanation:
          '“为众多的家庭所保留” = được đông đảo các gia đình giữ lại, lưu giữ.\n=> Đáp án đúng: (A) 保留.',
      },
      {
        num: 53,
        text: '请选出填入文中【53】处最恰当的一项（“这种新型保温便当盒外壳多【53】耐撞击原料制成”）：',
        options: [
          { key: 'A', text: '运用' },
          { key: 'B', text: '采用' },
          { key: 'C', text: '动用' },
          { key: 'D', text: '启用' },
        ],
        correct: 'B',
        explanation:
          '“采用……原料制成” = sử dụng loại nguyên liệu nào để chế tạo.\n=> Đáp án đúng: (B) 采用.',
      },
      {
        num: 54,
        text: '请选出填入文中【54】处最恰当的一项（“盛装食品无味，【54】卫生。”）：',
        options: [
          { key: 'A', text: '平安' },
          { key: 'B', text: '安心' },
          { key: 'C', text: '安定' },
          { key: 'D', text: '安全' },
        ],
        correct: 'D',
        explanation:
          '“安全卫生” = an toàn vệ sinh thực phẩm.\n=> Đáp án đúng: (D) 安全.',
      },
      {
        num: 55,
        text: '请选出填入文中【55】处最恰当的一项（“而最主要的是它具有上佳的保温【55】”）：',
        options: [
          { key: 'A', text: '能力' },
          { key: 'B', text: '性能' },
          { key: 'C', text: '性质' },
          { key: 'D', text: '才能' },
        ],
        correct: 'B',
        explanation:
          '“保温性能” = tính năng / hiệu năng giữ nhiệt của sản phẩm.\n=> Đáp án đúng: (B) 性能.',
      },
      {
        num: 56,
        text: '请选出填入文中【56】处最恰当的一项（“使饭菜能在长时间内【56】温热新鲜”）：',
        options: [
          { key: 'A', text: '保障' },
          { key: 'B', text: '保存' },
          { key: 'C', text: '保持' },
          { key: 'D', text: '保留' },
        ],
        correct: 'C',
        explanation:
          '“保持温热新鲜” = giữ / duy trì trạng thái ấm nóng và tươi ngon.\n=> Đáp án đúng: (C) 保持.',
      },
      {
        num: 57,
        text: '请选出填入文中【57】处最恰当的一项（“使用时应注意【57】接近火源及放置沸水锅中滚烫”）：',
        options: [
          { key: 'A', text: '不免' },
          { key: 'B', text: '难免' },
          { key: 'C', text: '以免' },
          { key: 'D', text: '避免' },
        ],
        correct: 'D',
        explanation:
          '“注意避免……” = chú ý tránh làm việc gì (còn 以免 đứng ở đầu vế sau để chỉ mục đích phòng ngừa).\n=> Đáp án đúng: (D) 避免.',
      },
    ],
  },
  {
    num: -3,
    type: 'reading_passage',
    category: 'Đọc điền từ tổng hợp',
    text: '综合选择（58—60 题）',
    passage_text:
      '在生活中，很多妇女喜欢把漂亮的宝石作为装饰品【58】在身上。但是，由于宝石在【59】过程中常受到某种物质放射作用，所以越是漂亮、贵重的宝石，对人体健康的【60】越大。',
    children: [
      {
        num: 58,
        text: '请选出填入文中【58】处最恰当的一项（“把漂亮的宝石作为装饰品【58】在身上”）：',
        options: [
          { key: 'A', text: '带' },
          { key: 'B', text: '穿' },
          { key: 'C', text: '放' },
          { key: 'D', text: '戴' },
        ],
        correct: 'D',
        explanation:
          'Đeo đồ trang sức, mũ, kính, đồng hồ lên người bắt buộc dùng động từ “戴” (còn 带 là mang theo bên mình, 穿 là mặc quần áo/giày tất).\n=> Đáp án đúng: (D) 戴.',
      },
      {
        num: 59,
        text: '请选出填入文中【59】处最恰当的一项（“由于宝石在【59】过程中常受到某种物质放射作用”）：',
        options: [
          { key: 'A', text: '形成' },
          { key: 'B', text: '产生' },
          { key: 'C', text: '合成' },
          { key: 'D', text: '融合' },
        ],
        correct: 'A',
        explanation:
          '“在形成过程中” = trong quá trình hình thành địa chất tự nhiên của đá quý.\n=> Đáp án đúng: (A) 形成.',
      },
      {
        num: 60,
        text: '请选出填入文中【60】处最恰当的一项（“所以越是漂亮、贵重的宝石，对人体健康的【60】越大。”）：',
        options: [
          { key: 'A', text: '危险' },
          { key: 'B', text: '危害' },
          { key: 'C', text: '损失' },
          { key: 'D', text: '破坏' },
        ],
        correct: 'B',
        explanation:
          '“对人体健康的危害越大” = tác hại / mối nguy hại đối với sức khỏe con người càng lớn.\n=> Đáp án đúng: (B) 危害.',
      },
    ],
  },

  // ── 三、阅读，请根据文章意思，选出正确答案（61—80 题） ──
  {
    num: -4,
    type: 'reading_passage',
    category: 'Đọc hiểu',
    text: '阅读理解（61—62 题）',
    passage_text:
      '现在有一种流行说法，说嚼无糖口香糖可以预防龋齿，还有人说可以代替刷牙，事实果真如此吗？\n嚼口香糖可以促进人口腔内唾液的分泌，并通过唾液“稀释”吃过食物后人口腔内残留的酸。而酸是破坏人的牙齿、导致龋齿产生的主要“罪魁”。但通过咀嚼口香糖产生的唾液只能对口腔内的酸起到“稀释”作用，对牙齿的保护作用有限；而且，嚼口香糖也无法全部带走口腔内的细菌。因此不提倡以咀嚼无糖口香糖代替刷牙。',
    children: [
      {
        num: 61,
        text: '根据本文，现在流行的是什么？',
        options: [
          { key: 'A', text: '龋齿' },
          { key: 'B', text: '嚼口香糖' },
          { key: 'C', text: '用嚼口香糖代替刷牙' },
          { key: 'D', text: '嚼无糖口香糖可以预防龋齿的说法' },
        ],
        correct: 'D',
        explanation:
          'Câu đầu tiên nêu rõ: “现在有一种流行说法，说嚼无糖口香糖可以预防龋齿” (Hiện nay có một lời đồn đang lưu hành rằng nhai kẹo cao su không đường có thể ngừa sâu răng).\n=> Đáp án đúng: (D).',
      },
      {
        num: 62,
        text: '为什么不提倡用嚼口香糖代替刷牙？',
        options: [
          { key: 'A', text: '影响食物的消化' },
          { key: 'B', text: '破坏环境卫生' },
          { key: 'C', text: '嚼口香糖对牙齿的保护作用很小' },
          { key: 'D', text: '嚼口香糖会产生破坏牙齿的“酸”' },
        ],
        correct: 'C',
        explanation:
          'Nguyên văn: “但通过咀嚼口香糖产生的唾液只能对口腔内的酸起到‘稀释’作用，对牙齿的保护作用有限；而且，嚼口香糖也无法全部带走口腔内的细菌” (Tác dụng bảo vệ răng rất hạn chế).\n=> Đáp án đúng: (C).',
      },
    ],
  },
  {
    num: -5,
    type: 'reading_passage',
    category: 'Đọc hiểu',
    text: '阅读理解（63—64 题）',
    passage_text:
      '在旅行中开展一场恋爱最容易。单身出门的人，多是抱着某些幻想的，觉得有一个与自己心心相印的人，也在路上。如果没有 90%，那也会有 80%。剩下的那 20%，嘴上不肯承认，心里也未必没有想法。陌生人结伴旅游，因为和对方不熟，所以迁就多而苛求少，考虑对方的种种现实因素少，路途艰苦而景色壮丽，充满了浪漫的元素，所以相依相伴，同甘共苦，很容易就擦出了火花。恋爱中的男女去经历一段艰苦旅途，也最能看出彼此的本性。所以最不好的旅行是蜜月旅行了。再发现什么问题都晚了，每个人都不想刚刚结婚就离婚吧。所以蜜月旅行只能选择那种豪华旅行，阳光海滩，五星级酒店，让婚姻生活的开端很梦幻或者说很不真实，很不切实际。',
    children: [
      {
        num: 63,
        text: '为什么在旅行中开展恋爱最容易？',
        options: [
          { key: 'A', text: '旅途中会降低对恋爱对象的要求' },
          { key: 'B', text: '旅途中有机会同甘共苦' },
          { key: 'C', text: '单身旅行的人越来越多' },
          { key: 'D', text: '单身旅行的人都很浪漫' },
        ],
        correct: 'A',
        explanation:
          'Nguyên văn chỉ rõ: “陌生人结伴旅游，因为和对方不熟，所以迁就多而苛求少，考虑对方的种种现实因素少” (Vì không quen biết kỹ đối phương nên nhường nhịn nhiều mà đòi hỏi khắt khe ít -> hạ thấp yêu cầu đối với đối tượng hẹn hò).\n=> Đáp án đúng: (A).',
      },
      {
        num: 64,
        text: '根据这段文字，为什么说蜜月旅行是最不好的旅行？',
        options: [
          { key: 'A', text: '太豪华' },
          { key: 'B', text: '不真实' },
          { key: 'C', text: '不实际' },
          { key: 'D', text: '可能导致离婚' },
        ],
        correct: 'D',
        explanation:
          'Nguyên văn: “恋爱中的男女去经历一段艰苦旅途，也最能看出彼此的本性。所以最不好的旅行是蜜月旅行了。再发现什么问题都晚了，每个人都不想刚刚结婚就离婚吧。” (Có thể dẫn đến vừa kết hôn xong đã ly hôn).\n=> Đáp án đúng: (D).',
      },
    ],
  },
  {
    num: -6,
    type: 'reading_passage',
    category: 'Đọc hiểu',
    text: '阅读理解（65—66 题）',
    passage_text:
      '传说在很早以前，天上有一只神鹅落到人间，被一猎人射伤。玉皇大帝为了替神鹅报仇，下旨在正月十五派天兵天将来人间放火，把牲畜财产全部烧光。\n当时，天宫中有一个善良的仙女，十分同情人间平民，便把这一不幸的消息告诉了凡间的人们。人们聚在一起，想出一个阻止玉皇施暴的办法：在正月十五日前后三天，家家户户门前挂红灯，同时，燃放烟花和火炮，做出人间已经起火的样子。果然，这种办法很奏效，玉帝见人间已经起火了，连声叫好，不再派天兵天将下凡放火了。这样，人们的生命财产得以保全。为了纪念这一胜利，从此以后，每年的正月十五前后三天晚上，家家户户都张灯结彩，放鞭炮烟火，一直延续到现在。',
    children: [
      {
        num: 65,
        text: '玉皇大帝派天兵天将来人间放火的目的是',
        options: [
          { key: 'A', text: '替受伤的神鹅报仇' },
          { key: 'B', text: '把牲畜财产全部烧光' },
          { key: 'C', text: '惩罚善良的仙女' },
          { key: 'D', text: '让家家户户张灯结彩' },
        ],
        correct: 'A',
        explanation:
          'Nguyên văn câu đầu: “玉皇大帝为了替神鹅报仇，下旨在正月十五派天兵天将来人间放火” (Để trả thù cho ngỗng thần bị bắn thương).\n=> Đáp án đúng: (A).',
      },
      {
        num: 66,
        text: '玉皇大帝最后没有派天兵天将来人间放火是因为',
        options: [
          { key: 'A', text: '同情人间平民' },
          { key: 'B', text: '仙女把消息告诉了人们' },
          { key: 'C', text: '人间已经起火' },
          { key: 'D', text: '家家户户挂红灯，放花炮，像起火的样子' },
        ],
        correct: 'D',
        explanation:
          'Nguyên văn: “家家户户门前挂红灯，同时，燃放烟花和火炮，做出人间已经起火的样子……玉帝见人间已经起火了，连声叫好，不再派天兵天将下凡放火了”.\n=> Đáp án đúng: (D).',
      },
    ],
  },
  {
    num: -7,
    type: 'reading_passage',
    category: 'Đọc hiểu',
    text: '阅读理解（67—69 题）',
    passage_text:
      '中国的茅台酒首次参加巴拿马博览会时，由于知名度低，起初无人问津，参展人员虽经努力推销，成交量仍甚少，眼看整个博览会就要结束了，中方参展人员不甘空手而归，急中生智，故意打翻了一瓶茅台酒，顿时整个展览大厅酒香扑鼻，沁人心脾，许多客商纷纷与茅台酒厂签订了供货合同，这一招，不仅使茅台酒夺得了金奖，而且由此一举成名，走向世界。如此促销方式，看似很“拙”其实很巧。日本丰田汽车公司开拓美国市场时也是运用了这一营销方式而一举成功的，他们录下了这样一个镜头：一位司机驾驶着一辆丰田车从 10 多米高的地方开了下去，正当人们震惊之余，又见驾驶员安然无恙，丰田车也完好无损。当这一录像通过电视台播放到美国的千家万户时，产生了意想不到的好效果。在美国，汽车多而车祸也多，缺乏安全感，丰田车有如此优良的性能，于是，美国掀起了一股购买丰田车的热潮。眼下我们不少企业的产品之所以不能够畅销，很重要的一个原因也许在于积极推销的点子不多。',
    children: [
      {
        num: 67,
        text: '中国茅台酒的出名是由于',
        options: [
          { key: 'A', text: '报纸、电视上大量广告的作用' },
          { key: 'B', text: '一次别出心裁的促销手段' },
          { key: 'C', text: '名人品尝后大力宣传的结果' },
          { key: 'D', text: '到世界各地广为推销的结果' },
        ],
        correct: 'B',
        explanation:
          'Nhờ sáng kiến cố tình làm vỡ bình rượu để hương thơm lan tỏa khắp sảnh triển lãm — một phương thức xúc tiến bán hàng vô cùng độc đáo, sáng tạo (“一次别出心裁的促销手段”).\n=> Đáp án đúng: (B).',
      },
      {
        num: 68,
        text: '美国掀起购买丰田车热潮的原因是',
        options: [
          { key: 'A', text: '外观漂亮' },
          { key: 'B', text: '价格合理' },
          { key: 'C', text: '安全性好' },
          { key: 'D', text: '经久耐用' },
        ],
        correct: 'C',
        explanation:
          'Đoạn quảng cáo chứng minh xe rơi từ độ cao hơn 10m mà cả tài xế và xe đều bình an vô sự, đánh trúng tâm lý cần sự an toàn của người Mỹ (“在美国，汽车多而车祸也多，缺乏安全感，丰田车有如此优良的性能”).\n=> Đáp án đúng: (C).',
      },
      {
        num: 69,
        text: '作者认为多数企业产品销路不好的重要原因是',
        options: [
          { key: 'A', text: '经济不景气' },
          { key: 'B', text: '没有竞争力' },
          { key: 'C', text: '质量欠佳' },
          { key: 'D', text: '促销手段少' },
        ],
        correct: 'D',
        explanation:
          'Câu kết bài nêu rõ: “眼下我们不少企业的产品之所以不能够畅销，很重要的一个原因也许在于积极推销的点子不多” (Ít ý tưởng/biện pháp xúc tiến bán hàng).\n=> Đáp án đúng: (D).',
      },
    ],
  },
  {
    num: -8,
    type: 'reading_passage',
    category: 'Đọc hiểu',
    text: '阅读理解（70—72 题）',
    passage_text:
      '通信港是为用户提供环境、技术网络、人员、维护为一体的通信服务方面的“港湾”。在现代通信手段十分丰富、便捷的条件下，一些大的集团用户往往需要在庞大的公用数据网中找一块适合自身信息传递要求的空间。座落在北京电报大楼内的“通信港”，便能满足这些大客户的需求。\n这个“港湾”设立在电报大楼的计算机机房内。每一个租用“港湾”的用户，可以将自己的专用通信设备安装在这里。在这个“港湾”里，北京电报局为用户提供适合计算机运行的温度、湿度及 24 小时不间断电源的环境；提供国际、国内、市内线路及丰富网络资源；提供各种计算机通信的手段；提供一批具有维护经验和计算机软、硬件开发设计的专业技术人员，确保通信港中每一个用户网络的正常运行。\n用户在通信港中，既可以有自己的专网，也可以经过授权以后，同公用网上的用户相连，使它四通八达，上至可与国际信息网相连接，下至可与国内、市内任何一个用户相通。目前，北京已有一批大公司、金融系统和企业应用通信港业务。',
    children: [
      {
        num: 70,
        text: '通信港是什么？',
        options: [
          { key: 'A', text: '一种现代交通设施' },
          { key: 'B', text: '一种现代港口设施' },
          { key: 'C', text: '一种环境保护系统' },
          { key: 'D', text: '一种现代通讯信息网络系统' },
        ],
        correct: 'D',
        explanation:
          'Là một hệ thống mạng thông tin viễn thông hiện đại tích hợp môi trường, kỹ thuật, nhân sự và bảo trì (“一种现代通讯信息网络系统”).\n=> Đáp án đúng: (D).',
      },
      {
        num: 71,
        text: '通信港的建立是为了',
        options: [
          { key: 'A', text: '计算机网络运转正常' },
          { key: 'B', text: '快捷而准确地进行信息传递' },
          { key: 'C', text: '丰富国际、国内网络资源' },
          { key: 'D', text: '扩大电信业务范围' },
        ],
        correct: 'B',
        explanation:
          'Đoạn 1 nêu: đáp ứng yêu cầu truyền tải thông tin nhanh chóng, chuẩn xác của các tập đoàn lớn (“满足自身信息传递要求”).\n=> Đáp án đúng: (B).',
      },
      {
        num: 72,
        text: '根据本文，通信港业务已在下列哪种行业中使用？',
        options: [
          { key: 'A', text: '金融' },
          { key: 'B', text: '交通' },
          { key: 'C', text: '环境' },
          { key: 'D', text: '教学' },
        ],
        correct: 'A',
        explanation:
          'Câu cuối cùng của bài: “目前，北京已有一批大公司、金融系统和企业应用通信港业务” (Ngành tài chính - 金融).\n=> Đáp án đúng: (A).',
      },
    ],
  },
  {
    num: -9,
    type: 'reading_passage',
    category: 'Đọc hiểu',
    text: '阅读理解（73—75 题）',
    passage_text:
      '常州市老年公寓目前已收养社会老人 80 人，而由于床位紧张暂不能进公寓的老人就达 200 余人。\n目前，该市 60 岁以上老人有 41 万余人，占全市总人口的 12%，并每年以 3.5% 的速度递增。但是现代家庭日趋小型化，子女由于工作忙等原因，很难抽出时间照料老人，而老人深居单元楼，左邻右舍又无同龄人，晚年生活难免孤寂。住进老年公寓，老人不仅洗衣、送开水、卫生有人照料，生活难以自理的还有人帮助洗浴、喂水，而且周围都是老人，娱乐、谈天儿都有伴，所以老年公寓深受老年人欢迎。但老年公寓床位爆满的背后却是经济状况的窘迫，该市老年公寓由于考虑到老年人的经济承受能力，收费偏低，这样每年公寓靠三产贴补老人生活开支就达 30 万元。',
    children: [
      {
        num: 73,
        text: '常州市老年公寓爆满的原因是什么？',
        options: [
          { key: 'A', text: '床位紧张' },
          { key: 'B', text: '老人太少' },
          { key: 'C', text: '生活窘迫' },
          { key: 'D', text: '费用太高' },
        ],
        correct: 'A',
        explanation:
          'Câu đầu bài nêu rõ: “由于床位紧张暂不能进公寓的老人就达 200 余人” (Do số giường/chỗ ở hạn hẹp).\n=> Đáp án đúng: (A).',
      },
      {
        num: 74,
        text: '目前能住进老年公寓的老人的比例有多高？',
        options: [
          { key: 'A', text: '3/5' },
          { key: 'B', text: '2/5' },
          { key: 'C', text: '12%' },
          { key: 'D', text: '3.5%' },
        ],
        correct: 'B',
        explanation:
          'Bài nêu có 80 người đã vào ở và 200 người chưa vào được: $80 \\div 200 = \\frac{2}{5}$.\n=> Đáp án đúng: (B) 2/5.',
      },
      {
        num: 75,
        text: '什么原因使许多老年人选择去住老年公寓？',
        options: [
          { key: 'A', text: '生活窘迫' },
          { key: 'B', text: '不能工作' },
          { key: 'C', text: '生活孤寂' },
          { key: 'D', text: '经济独立' },
        ],
        correct: 'C',
        explanation:
          'Con cái bận làm việc, người già sống trong các căn hộ không có bạn đồng trang lứa nên tuổi già cô đơn (“晚年生活难免孤寂”), trong khi vào chung cư có người chăm sóc và có bạn bè trò chuyện.\n=> Đáp án đúng: (C).',
      },
    ],
  },
  {
    num: -10,
    type: 'reading_passage',
    category: 'Đọc hiểu',
    text: '阅读理解（76—80 题）',
    passage_text:
      '中国现已成为当今世界经济舞台上的重要一员，以每年 9% 的增长速度发展达 20 多年之久，理所当然地应该在世界经济体系中占有举足轻重的地位。\n中国人口约占世界总人口的 21%，对鱼类、大米以及家禽肉类的消耗量巨大。许多生产农产品的国家将受益于中国日渐庞大的消费群体。\n中国被称为“世界工厂”。全世界大约 2/3 的复印机、微波炉和 DVD 播放机，1/2 的服装和数码相机，1/3 左右的移动电话，近 2/5 的个人电脑，都产自中国。\n有关经济增长与发展的理论指出，为使经济获得持续增长，发展中国家必须出口大量农产品，同时从发达国家进口高技术工业产品。而中国的经济发展模式似乎与这样的理论背道而驰。去年中国出口到美国最多的商品是电脑配件，而从美国大量进口的是大豆。\n在改革进程中，中国人行事小心谨慎。不盲从当今权威国际机构专家的意见，而是根据中国的实际情况进行切实的改革，并以国家利益作为行动的指南。\n在许多专家眼里，中国的体制中存在着缺陷，这不利于吸引外资。然而，涌向中国的外资仍是源源不断。此外，中国政府还积极鼓励本国企业从外国合伙者那里学习新技术。\n在不久的将来，本地合作伙伴有可能作为竞争对手出现。对于这一点，许多外国投资者似乎并不介意。因为他们觉得，为进入中国市场从而获得短期的经济利益，并为长远的经营战略做准备，付出这样的代价是值得的。\n最初，外国公司说它们将中国视为低成本的生产基地。如今，这些公司又声称，之所以要到中国投资是因为它是一个巨大的消费市场。\n中国经济持续增长必然意味着，所有其他国家有必要调整它们的外交政策，制定“中国战略”，以应对这一新兴超级大国。',
    children: [
      {
        num: 76,
        text: '中国的经济增长速度为',
        options: [
          { key: 'A', text: '12%' },
          { key: 'B', text: '21%' },
          { key: 'C', text: '18%' },
          { key: 'D', text: '9%' },
        ],
        correct: 'D',
        explanation:
          'Đoạn 1 nêu: “以每年 9% 的增长速度发展达 20 多年之久”.\n=> Đáp án đúng: (D) 9%.',
      },
      {
        num: 77,
        text: '下面哪种产自中国的产品是文中没有提到的？',
        options: [
          { key: 'A', text: '大豆' },
          { key: 'B', text: '服装' },
          { key: 'C', text: '电脑配件' },
          { key: 'D', text: '微波炉' },
        ],
        correct: 'A',
        explanation:
          'Quần áo (服装), linh kiện máy tính (电脑配件) và lò vi sóng (微波炉) đều được nêu là sản xuất/xuất khẩu từ Trung Quốc; riêng đậu tương (大豆) là nông sản Trung Quốc nhập khẩu từ Mỹ (“从美国大量进口的是大豆”).\n=> Đáp án đúng: (A) 大豆.',
      },
      {
        num: 78,
        text: '中国的经济发展模式是',
        options: [
          { key: 'A', text: '出口畜产品，进口农产品' },
          { key: 'B', text: '出口农产品，进口高新产品' },
          { key: 'C', text: '出口高新产品，进口农产品' },
          { key: 'D', text: '出口农产品，进口畜产品' },
        ],
        correct: 'C',
        explanation:
          'Đoạn 4 nêu: Ngược với lý thuyết truyền thống, Trung Quốc xuất khẩu sản phẩm công nghệ cao (như linh kiện máy tính 电脑配件) sang Mỹ và nhập khẩu nông sản (大豆 - đậu tương) từ Mỹ.\n=> Đáp án đúng: (C).',
      },
      {
        num: 79,
        text: '虽然中国体制中存在缺陷，但对外资的吸引',
        options: [
          { key: 'A', text: '影响不大' },
          { key: 'B', text: '影响不小' },
          { key: 'C', text: '影响很大' },
          { key: 'D', text: '影响加大' },
        ],
        correct: 'A',
        explanation:
          'Đoạn 6 nêu: “在许多专家眼里，中国的体制中存在着缺陷，这不利于吸引外资。然而，涌向中国的外资仍是源源不断。” (Vốn nước ngoài đổ vào Trung Quốc vẫn dồi dào không ngớt -> ảnh hưởng không lớn).\n=> Đáp án đúng: (A).',
      },
      {
        num: 80,
        text: '在中国最早吸引外商投资的原因是',
        options: [
          { key: 'A', text: '生产成本低' },
          { key: 'B', text: '消费群体大' },
          { key: 'C', text: '代价小' },
          { key: 'D', text: '人口多' },
        ],
        correct: 'A',
        explanation:
          'Đoạn 8 nêu rõ: “最初，外国公司说它们将中国视为低成本的生产基地。” (Ban đầu, các công ty nước ngoài coi Trung Quốc là cơ sở sản xuất có chi phí thấp).\n=> Đáp án đúng: (A).',
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
      const code = `TTXH202512_${Math.floor(Date.now() / 1000) % 100000}`;
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
