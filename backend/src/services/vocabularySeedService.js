const db = require("../config/database");

const LAUNCH_VOCABULARY = [
  ["你好", "nǐ hǎo", "xin chào", "hello", "tieng-trung-tn", "Giao tiếp cơ bản", "你好，我叫明。", "Xin chào, tôi tên Minh."],
  ["谢谢", "xiè xie", "cảm ơn", "thank you", "tieng-trung-tn", "Giao tiếp cơ bản", "谢谢你的帮助。", "Cảm ơn sự giúp đỡ của bạn."],
  ["学习", "xué xí", "học tập", "study", "tieng-trung-tn", "Học tập", "我每天学习中文。", "Tôi học tiếng Trung mỗi ngày."],
  ["考试", "kǎo shì", "kỳ thi", "exam", "tieng-trung-tn", "Học tập", "明天有考试。", "Ngày mai có kỳ thi."],
  ["学校", "xué xiào", "trường học", "school", "tieng-trung-tn", "Học tập", "学校很大。", "Trường học rất lớn."],
  ["学生", "xué sheng", "học sinh, sinh viên", "student", "tieng-trung-tn", "Học tập", "他是学生。", "Anh ấy là học sinh."],
  ["老师", "lǎo shī", "giáo viên", "teacher", "tieng-trung-tn", "Học tập", "老师讲得很清楚。", "Giáo viên giảng rất rõ."],
  ["汉语", "hàn yǔ", "tiếng Hán", "Chinese language", "tieng-trung-tn", "Ngôn ngữ", "汉语不难。", "Tiếng Hán không khó."],
  ["中文", "zhōng wén", "tiếng Trung", "Chinese", "tieng-trung-tn", "Ngôn ngữ", "我会说中文。", "Tôi biết nói tiếng Trung."],
  ["词汇", "cí huì", "từ vựng", "vocabulary", "tieng-trung-tn", "Ngôn ngữ", "这个词汇很常用。", "Từ vựng này rất thường dùng."],
  ["语法", "yǔ fǎ", "ngữ pháp", "grammar", "tieng-trung-tn", "Ngôn ngữ", "语法需要多练。", "Ngữ pháp cần luyện nhiều."],
  ["阅读", "yuè dú", "đọc hiểu", "reading", "tieng-trung-tn", "Kỹ năng", "阅读题有点长。", "Bài đọc hiểu hơi dài."],
  ["写作", "xiě zuò", "viết", "writing", "tieng-trung-tn", "Kỹ năng", "写作要注意结构。", "Viết cần chú ý cấu trúc."],
  ["听力", "tīng lì", "nghe hiểu", "listening", "tieng-trung-tn", "Kỹ năng", "听力每天练十分钟。", "Nghe hiểu luyện mười phút mỗi ngày."],
  ["口语", "kǒu yǔ", "khẩu ngữ", "speaking", "tieng-trung-tn", "Kỹ năng", "口语要大胆说。", "Khẩu ngữ cần mạnh dạn nói."],
  ["问题", "wèn tí", "vấn đề, câu hỏi", "question", "tieng-trung-tn", "Bài thi", "这个问题很重要。", "Vấn đề này rất quan trọng."],
  ["答案", "dá àn", "đáp án", "answer", "tieng-trung-tn", "Bài thi", "请选择正确答案。", "Hãy chọn đáp án đúng."],
  ["选择", "xuǎn zé", "lựa chọn", "choose", "tieng-trung-tn", "Bài thi", "选择一个答案。", "Chọn một đáp án."],
  ["句子", "jù zi", "câu văn", "sentence", "tieng-trung-tn", "Ngôn ngữ", "这个句子很短。", "Câu này rất ngắn."],
  ["翻译", "fān yì", "dịch", "translate", "tieng-trung-tn", "Kỹ năng", "请翻译这句话。", "Hãy dịch câu này."],
  ["练习", "liàn xí", "luyện tập", "practice", "tieng-trung-tn", "Học tập", "多做练习。", "Làm nhiều bài luyện tập."],
  ["复习", "fù xí", "ôn tập", "review", "tieng-trung-tn", "Học tập", "考试前要复习。", "Trước kỳ thi cần ôn tập."],
  ["通过", "tōng guò", "vượt qua, thông qua", "pass", "tieng-trung-tn", "Bài thi", "他通过了考试。", "Anh ấy đã vượt qua kỳ thi."],
  ["成绩", "chéng jì", "thành tích, điểm số", "score", "tieng-trung-tn", "Bài thi", "成绩提高了。", "Điểm số đã tăng."],
  ["计划", "jì huà", "kế hoạch", "plan", "tieng-trung-tn", "Học tập", "我们需要学习计划。", "Chúng ta cần kế hoạch học tập."],
  ["目标", "mù biāo", "mục tiêu", "goal", "tieng-trung-tn", "Học tập", "目标要明确。", "Mục tiêu cần rõ ràng."],
  ["奖学金", "jiǎng xué jīn", "học bổng", "scholarship", "tieng-trung-tn", "Du học", "她申请奖学金。", "Cô ấy xin học bổng."],
  ["大学", "dà xué", "đại học", "university", "tieng-trung-tn", "Du học", "这所大学很有名。", "Trường đại học này rất nổi tiếng."],
  ["专业", "zhuān yè", "chuyên ngành", "major", "tieng-trung-tn", "Du học", "你的专业是什么？", "Chuyên ngành của bạn là gì?"],
  ["科学", "kē xué", "khoa học", "science", "tieng-trung-tn", "Chủ đề học thuật", "科学改变生活。", "Khoa học thay đổi đời sống."],
  ["社会", "shè huì", "xã hội", "society", "tieng-trung-xh", "Xã hội", "社会发展很快。", "Xã hội phát triển rất nhanh."],
  ["文化", "wén huà", "văn hóa", "culture", "tieng-trung-xh", "Xã hội", "文化交流很重要。", "Giao lưu văn hóa rất quan trọng."],
  ["经济", "jīng jì", "kinh tế", "economy", "tieng-trung-xh", "Xã hội", "经济正在增长。", "Kinh tế đang tăng trưởng."],
  ["历史", "lì shǐ", "lịch sử", "history", "tieng-trung-xh", "Xã hội", "历史课很有意思。", "Môn lịch sử rất thú vị."],
  ["地理", "dì lǐ", "địa lý", "geography", "tieng-trung-xh", "Xã hội", "地理位置很重要。", "Vị trí địa lý rất quan trọng."],
  ["政治", "zhèng zhì", "chính trị", "politics", "tieng-trung-xh", "Xã hội", "政治制度不同。", "Chế độ chính trị khác nhau."],
  ["环境", "huán jìng", "môi trường", "environment", "tieng-trung-xh", "Xã hội", "保护环境。", "Bảo vệ môi trường."],
  ["发展", "fā zhǎn", "phát triển", "develop", "tieng-trung-xh", "Xã hội", "城市发展很快。", "Thành phố phát triển rất nhanh."],
  ["比较", "bǐ jiào", "so sánh", "compare", "tieng-trung-xh", "Kỹ năng bài thi", "比较两个观点。", "So sánh hai quan điểm."],
  ["影响", "yǐng xiǎng", "ảnh hưởng", "influence", "tieng-trung-xh", "Kỹ năng bài thi", "气候影响生活。", "Khí hậu ảnh hưởng đời sống."],

  ["集合", "jí hé", "tập hợp", "set", "toan", "Tập hợp", "A是一个集合。", "A là một tập hợp."],
  ["元素", "yuán sù", "phần tử", "element", "toan", "Tập hợp", "x是集合A的元素。", "x là phần tử của tập hợp A."],
  ["子集", "zǐ jí", "tập con", "subset", "toan", "Tập hợp", "B是A的子集。", "B là tập con của A."],
  ["交集", "jiāo jí", "giao", "intersection", "toan", "Tập hợp", "A和B的交集。", "Giao của A và B."],
  ["并集", "bìng jí", "hợp", "union", "toan", "Tập hợp", "A和B的并集。", "Hợp của A và B."],
  ["差集", "chā jí", "hiệu hai tập hợp", "difference", "toan", "Tập hợp", "A和B的差集。", "Hiệu của A và B."],
  ["函数", "hán shù", "hàm số", "function", "toan", "Hàm số", "这是一次函数。", "Đây là hàm số bậc nhất."],
  ["定义域", "dìng yì yù", "tập xác định", "domain", "toan", "Hàm số", "求函数的定义域。", "Tìm tập xác định của hàm số."],
  ["值域", "zhí yù", "tập giá trị", "range", "toan", "Hàm số", "函数的值域是什么？", "Tập giá trị của hàm số là gì?"],
  ["方程", "fāng chéng", "phương trình", "equation", "toan", "Phương trình", "解这个方程。", "Giải phương trình này."],
  ["不等式", "bù děng shì", "bất đẳng thức", "inequality", "toan", "Bất đẳng thức", "证明不等式。", "Chứng minh bất đẳng thức."],
  ["根", "gēn", "nghiệm", "root", "toan", "Phương trình", "方程有两个根。", "Phương trình có hai nghiệm."],
  ["导数", "dǎo shù", "đạo hàm", "derivative", "toan", "Đạo hàm", "求函数的导数。", "Tính đạo hàm của hàm số."],
  ["极值", "jí zhí", "cực trị", "extremum", "toan", "Đạo hàm", "函数有极值。", "Hàm số có cực trị."],
  ["数列", "shù liè", "dãy số", "sequence", "toan", "Dãy số", "这是一个数列。", "Đây là một dãy số."],
  ["等差数列", "děng chā shù liè", "cấp số cộng", "arithmetic sequence", "toan", "Cấp số cộng", "等差数列的公差为2。", "Cấp số cộng có công sai bằng 2."],
  ["等比数列", "děng bǐ shù liè", "cấp số nhân", "geometric sequence", "toan", "Cấp số nhân", "等比数列的公比为3。", "Cấp số nhân có công bội bằng 3."],
  ["极限", "jí xiàn", "giới hạn", "limit", "toan", "Giới hạn", "求数列的极限。", "Tìm giới hạn của dãy số."],
  ["概率", "gài lǜ", "xác suất", "probability", "toan", "Xác suất", "这个事件的概率是二分之一。", "Xác suất của biến cố này là một phần hai."],
  ["向量", "xiàng liàng", "véc-tơ", "vector", "toan", "Vectơ", "两个向量平行。", "Hai vectơ song song."],

  ["物理", "wù lǐ", "vật lý", "physics", "vat-ly", "Khái niệm cơ bản", "物理研究自然现象。", "Vật lý nghiên cứu hiện tượng tự nhiên."],
  ["力", "lì", "lực", "force", "vat-ly", "Cơ học", "力可以改变运动状态。", "Lực có thể thay đổi trạng thái chuyển động."],
  ["速度", "sù dù", "vận tốc", "velocity", "vat-ly", "Cơ học", "速度等于路程除以时间。", "Vận tốc bằng quãng đường chia thời gian."],
  ["加速度", "jiā sù dù", "gia tốc", "acceleration", "vat-ly", "Cơ học", "加速度表示速度变化。", "Gia tốc biểu thị sự thay đổi vận tốc."],
  ["能量", "néng liàng", "năng lượng", "energy", "vat-ly", "Cơ học", "能量守恒。", "Năng lượng được bảo toàn."],
  ["功", "gōng", "công", "work", "vat-ly", "Cơ học", "力做功。", "Lực sinh công."],
  ["功率", "gōng lǜ", "công suất", "power", "vat-ly", "Cơ học", "功率越大，做功越快。", "Công suất càng lớn, sinh công càng nhanh."],
  ["电流", "diàn liú", "dòng điện", "current", "vat-ly", "Điện học", "电流通过电阻。", "Dòng điện đi qua điện trở."],
  ["电压", "diàn yā", "hiệu điện thế", "voltage", "vat-ly", "Điện học", "电压单位是伏特。", "Đơn vị hiệu điện thế là vôn."],
  ["电阻", "diàn zǔ", "điện trở", "resistance", "vat-ly", "Điện học", "电阻会消耗能量。", "Điện trở tiêu hao năng lượng."],
  ["磁场", "cí chǎng", "từ trường", "magnetic field", "vat-ly", "Điện từ", "磁场有方向。", "Từ trường có hướng."],
  ["频率", "pín lǜ", "tần số", "frequency", "vat-ly", "Sóng", "频率单位是赫兹。", "Đơn vị tần số là héc."],

  ["化学", "huà xué", "hóa học", "chemistry", "hoa-hoc", "Khái niệm cơ bản", "化学研究物质变化。", "Hóa học nghiên cứu sự biến đổi vật chất."],
  ["原子", "yuán zǐ", "nguyên tử", "atom", "hoa-hoc", "Cấu tạo chất", "原子很小。", "Nguyên tử rất nhỏ."],
  ["分子", "fēn zǐ", "phân tử", "molecule", "hoa-hoc", "Cấu tạo chất", "水分子由氢和氧组成。", "Phân tử nước gồm hiđro và oxi."],
  ["离子", "lí zǐ", "ion", "ion", "hoa-hoc", "Cấu tạo chất", "离子带电。", "Ion mang điện."],
  ["化合物", "huà hé wù", "hợp chất", "compound", "hoa-hoc", "Cấu tạo chất", "水是化合物。", "Nước là hợp chất."],
  ["反应", "fǎn yìng", "phản ứng", "reaction", "hoa-hoc", "Phản ứng hóa học", "发生化学反应。", "Xảy ra phản ứng hóa học."],
  ["方程式", "fāng chéng shì", "phương trình hóa học", "chemical equation", "hoa-hoc", "Phản ứng hóa học", "配平化学方程式。", "Cân bằng phương trình hóa học."],
  ["酸", "suān", "axit", "acid", "hoa-hoc", "Axit - bazơ", "盐酸是一种酸。", "Axit clohiđric là một axit."],
  ["碱", "jiǎn", "bazơ", "base", "hoa-hoc", "Axit - bazơ", "氢氧化钠是碱。", "Natri hiđroxit là bazơ."],
  ["盐", "yán", "muối", "salt", "hoa-hoc", "Axit - bazơ", "酸和碱反应生成盐。", "Axit và bazơ phản ứng tạo muối."],
  ["溶液", "róng yè", "dung dịch", "solution", "hoa-hoc", "Dung dịch", "这是盐溶液。", "Đây là dung dịch muối."],
  ["浓度", "nóng dù", "nồng độ", "concentration", "hoa-hoc", "Dung dịch", "求溶液浓度。", "Tính nồng độ dung dịch."],
  ["氧化", "yǎng huà", "oxi hóa", "oxidation", "hoa-hoc", "Oxi hóa - khử", "金属被氧化。", "Kim loại bị oxi hóa."],
  ["还原", "huán yuán", "khử", "reduction", "hoa-hoc", "Oxi hóa - khử", "氧化铜被还原。", "Đồng oxit bị khử."],
];

async function seedLaunchVocabulary(pool = db) {
  const table = await pool.query("SELECT to_regclass('public.vocabulary_items') AS table_name");
  if (!table.rows[0]?.table_name) return { inserted: 0, skipped: true };

  const columnsPerRow = 11;
  const params = [];
  const values = LAUNCH_VOCABULARY.map((item, rowIndex) => {
    const offset = rowIndex * columnsPerRow;
    params.push(
      item[0],
      item[1],
      item[2],
      item[3],
      item[4],
      item[5],
      item[6],
      item[7],
      false,
      "basic",
      null,
    );
    return `(${Array.from({ length: columnsPerRow }, (_, col) => `$${offset + col + 1}`).join(", ")})`;
  }).join(",\n");

  const result = await pool.query(
    `INSERT INTO vocabulary_items (
       word_cn, pinyin, word_vn, word_en, subject, topic,
       example_cn, example_vn, is_premium, vip_tier, created_by
     )
     VALUES ${values}
     ON CONFLICT (word_cn, subject) DO NOTHING`,
    params,
  );

  return { inserted: result.rowCount || 0, skipped: false };
}

module.exports = {
  LAUNCH_VOCABULARY,
  seedLaunchVocabulary,
};
