import os
import sys
import json
import time
from dotenv import load_dotenv
import psycopg

sys.stdout.reconfigure(encoding='utf-8')
load_dotenv('backend/.env')
db_url = os.getenv('DATABASE_URL') or os.getenv('DATABASE_PUBLIC_URL')

if not db_url:
    print("Error: DATABASE_URL not found!")
    sys.exit(1)

EXAM_DATA = {
    "title": "2025 年 12 月 CSCA 理科（中文）试卷",
    "title_cn": "2025 年 12 月 CSCA 理科（中文）试卷",
    "subject_id": 5, # Tiếng Trung Tự nhiên
    "duration": 90,
    "total_questions": 45,
    "total_points": 100.0,
    "difficulty_level": "medium",
    "status": "published",
    "is_premium": False,
    "language_mode": "zh",
    "explanation_language_mode": "vi",
    "description": "Đề thi chính thức CSCA Lý khoa (Tiếng Trung Tự nhiên) tháng 12/2025. Bao gồm các phần Ngữ âm, Ngữ pháp, Từ vựng KHTN Toán - Lý - Hóa, Đọc điền từ và Đọc hiểu khoa học tự nhiên. Có giải thích chi tiết và phân tích QA/QC.",
}

# 45 questions data definition
QUESTIONS_DATA = [
    # ── PHẦN 1: Ngữ âm & Ngữ pháp (Câu 1 - 6) ──
    {
        "num": 1,
        "type": "single_choice",
        "category": "Ngữ âm",
        "text": "“这只猫长得真可爱！”句中的“长”怎么读？",
        "options": [
            {"key": "A", "text": "zhǎn"},
            {"key": "B", "text": "chán"},
            {"key": "C", "text": "zhǎng"},
            {"key": "D", "text": "cháng"},
        ],
        "correct": "C",
        "explanation": "Chữ “长” là chữ đa âm trong tiếng Hán:\n- Đọc là cháng (dài) khi chỉ chiều dài không gian/thời gian (长城, 长度).\n- Đọc là zhǎng (lớn lên, diện mạo) trong cụm bổ ngữ miêu tả ngoại hình “长得 + Tính từ” (trông như thế nào) hoặc “长大” (lớn lên).\nTrong câu “这只猫长得真可爱”, “长得” miêu tả diện mạo bên ngoài của con mèo, đọc thanh 3: zhǎng.\n=> Đáp án đúng: (C) zhǎng.",
    },
    {
        "num": 2,
        "type": "single_choice",
        "category": "Ngữ nghĩa từ vựng",
        "text": "请选出“熟”字意义不同的一项。",
        "options": [
            {"key": "A", "text": "这个舞蹈的每个动作她都很熟练。"},
            {"key": "B", "text": "果园里的苹果都成熟了。"},
            {"key": "C", "text": "他熟悉这里的每条路。"},
            {"key": "D", "text": "他们是多年的老熟人。"},
        ],
        "correct": "C",
        "explanation": "Theo đáp án chính thức của kỳ thi CSCA: Chọn C.\n- Phân tích theo barem đề thi: Trong C (“熟悉” - động từ vị ngữ), “熟” biểu thị sự nhận biết, nắm rõ thông tin khách quan (đường sá). Còn trong A (熟练 - tính từ), B (成熟 - trạng thái quả chín), D (熟人 - danh từ), chữ “熟” biểu thị tính chất hoặc trạng thái nội tại đạt độ thuần thục, chín muồi.\n- Lưu ý mở rộng theo từ điển: B mang nghĩa sinh học quả chín, A-C-D mang nghĩa quen thuộc. Tuy nhiên thí sinh cần chọn C theo đúng barem chính thức của đề thi CSCA.\n=> Đáp án đúng: (C).",
    },
    {
        "num": 3,
        "type": "single_choice",
        "category": "Từ đồng nghĩa",
        "text": "“在任何时刻，都必须重视学生安全问题。”与“重视”意思相近的词是：",
        "options": [
            {"key": "A", "text": "改进"},
            {"key": "B", "text": "关注"},
            {"key": "C", "text": "加强"},
            {"key": "D", "text": "公开"},
        ],
        "correct": "B",
        "explanation": "“重视” (zhòngshì) nghĩa là coi trọng, để tâm, xem là vấn đề quan trọng hàng đầu.\n- Từ đồng nghĩa gần gũi nhất trong ngữ cảnh an toàn học sinh là “关注” (guānzhù - quan tâm, chú ý tới).\n- “改进” nghĩa là đổi mới/cải tiến; “加强” là làm mạnh thêm (thường dùng: 加强管理); “公开” là công khai rộng rãi.\n=> Đáp án đúng: (B) 关注.",
    },
    {
        "num": 4,
        "type": "single_choice",
        "category": "Bổ ngữ kết quả",
        "text": "考试的题目太多了，我没有做 ______。",
        "options": [
            {"key": "A", "text": "完"},
            {"key": "B", "text": "错"},
            {"key": "C", "text": "会"},
            {"key": "D", "text": "多"},
        ],
        "correct": "A",
        "explanation": "Bổ ngữ kết quả: “做完” = làm xong, hoàn thành.\nNgữ cảnh: Vế trước nêu nguyên nhân “题目太多了” (đề thi quá nhiều câu), dẫn đến kết quả tất yếu là không đủ thời gian làm hết -> “没有做完” (chưa làm xong).\n=> Đáp án đúng: (A) 完.",
    },
    {
        "num": 5,
        "type": "single_choice",
        "category": "Vật lý & Cấu trúc ngữ pháp",
        "text": "物体的质量 ______ 它的位置、形状、状态等 ______。",
        "options": [
            {"key": "A", "text": "从……起"},
            {"key": "B", "text": "以……无关"},
            {"key": "C", "text": "与……成反比"},
            {"key": "D", "text": "与……无关"},
        ],
        "correct": "D",
        "explanation": "Kiến thức Vật lý & Ngữ pháp:\n- Về vật lý: Khối lượng (m) là lượng chất cấu tạo nên vật, là thuộc tính cố hữu của vật, không thay đổi theo vị trí địa lý, hình dạng hình học hay trạng thái nhiệt/pha (rắn, lỏng, khí).\n- Cấu trúc cố định tiếng Trung: “与……无关” (không liên quan gì tới... / độc lập với...).\n=> Đáp án đúng: (D) 与……无关.",
    },
    {
        "num": 6,
        "type": "single_choice",
        "category": "Phó từ ngữ khí",
        "text": "“这个实验 ______ 很有趣，就是一点也不省时间”。",
        "options": [
            {"key": "A", "text": "把"},
            {"key": "B", "text": "虽"},
            {"key": "C", "text": "也"},
            {"key": "D", "text": "了"},
        ],
        "correct": "C",
        "explanation": "Ngữ khí khẩu ngữ tiếng Trung: Thường dùng phó từ “也” để thừa nhận một khía cạnh tích cực trước khi dùng “就是 / 不过 / 但是” đưa ra một khuyết điểm nhỏ:\n“...也很有趣，就是...” (cũng rất thú vị đấy, chỉ có điều...).\n=> Đáp án đúng: (C) 也.",
    },

    # ── PHẦN 2: Từ vựng KHTN - Nhóm 1 (Câu 11 - 15) ──
    # Container fill_blank_pool 1
    {
        "num": -1,
        "type": "fill_blank_pool",
        "category": "Từ vựng KHTN",
        "text": "选词填空（11-15 题）",
        "passage_text": "11. +、-、×、÷ 这些 ______ 用于数学运算。\n12. 为什么水在 4℃ 时 ______ 最大？\n13. ______ 的方法能检验电的现象是什么？\n14. ______ 是指力能使物体沿着一条直线进行移动。\n15. 筷子插在水里看上去不直了，这是光的什么 ______？",
        "linked_options": [
            {"key": "A", "text": "平移", "textCn": "平移"},
            {"key": "B", "text": "符号", "textCn": "符号"},
            {"key": "C", "text": "现象", "textCn": "现象"},
            {"key": "D", "text": "密度", "textCn": "密度"},
            {"key": "E", "text": "结合", "textCn": "结合"},
            {"key": "F", "text": "摩擦", "textCn": "摩擦"},
        ],
        "children": [
            {
                "num": 11,
                "text": "+、-、×、÷ 这些 ______ 用于数学运算。",
                "correct": "B",
                "explanation": "Các phép toán cộng, trừ, nhân, chia (+, -, ×, ÷) là các “ký hiệu toán học” (数学符号). Đáp án đúng: (B) 符号.",
            },
            {
                "num": 12,
                "text": "为什么水在 4℃ 时 ______ 最大？",
                "correct": "D",
                "explanation": "⚠️ Lưu ý kiểm định QA/QC: Bảng đáp án gốc in nhầm chữ A (lỗi gõ phím lặp lại của câu 14). Về mặt vật lý học, do hiện tượng giãn nở dị thường của nước, ở 4℃ nước có thể tích nhỏ nhất nên khối lượng riêng / mật độ (密度) đạt giá trị cực đại (1.00 g/cm³). Đáp án chuẩn xác tuyệt đối là: (D) 密度.",
            },
            {
                "num": 13,
                "text": "______ 的方法能检验电的现象是什么？",
                "correct": "F",
                "explanation": "Thí nghiệm cơ bản về tĩnh điện là cọ xát nhiễm điện (摩擦起电). Phương pháp cọ xát/ma sát (摩擦) sinh ra điện tích giúp kiểm nghiệm hiện tượng điện. Đáp án đúng: (F) 摩擦.",
            },
            {
                "num": 14,
                "text": "______ 是指力能使物体沿着一条直线进行移动。",
                "correct": "A",
                "explanation": "Trong cơ học, chuyển động thẳng tịnh tiến (平移) chỉ việc lực làm cho vật thể chuyển dời dọc theo một đường thẳng. Đáp án đúng: (A) 平移.",
            },
            {
                "num": 15,
                "text": "筷子插在水里看上去不直了，这是光的什么 ______？",
                "correct": "C",
                "explanation": "Chiếc đũa cắm vào nước nhìn bị gãy khúc là hiện tượng khúc xạ ánh sáng (光的折射现象). Từ cần điền là “hiện tượng” (现象). Đáp án đúng: (C) 现象.",
            },
        ],
    },

    # ── PHẦN 3: Từ vựng KHTN - Nhóm 2 (Câu 16 - 20) ──
    # Container fill_blank_pool 2
    {
        "num": -2,
        "type": "fill_blank_pool",
        "category": "Từ vựng KHTN",
        "text": "选词填空（16-20 题）",
        "passage_text": "16. 汽油的 ______ 是一种物理变化。\n17. 一个面和一条 ______ 会产生两个公共点。\n18. 三角形的 ______ 两边之和大于第三边。\n19. 正方形的 ______ 中心点就是两条对角线的交点。\n20. 在化学反应过程中，原有的物质经过反应会 ______ 新的物质。",
        "linked_options": [
            {"key": "A", "text": "相交", "textCn": "相交"},
            {"key": "B", "text": "对称", "textCn": "对称"},
            {"key": "C", "text": "任意", "textCn": "任意"},
            {"key": "D", "text": "生成", "textCn": "生成"},
            {"key": "E", "text": "代替", "textCn": "代替"},
            {"key": "F", "text": "挥发", "textCn": "挥发"},
        ],
        "children": [
            {
                "num": 16,
                "text": "汽油的 ______ 是一种物理变化。",
                "correct": "F",
                "explanation": "Xăng bốc hơi/bay hơi (挥发) là quá trình chuyển trạng thái từ lỏng sang khí, không tạo ra chất mới, nên là biến đổi vật lý. Đáp án đúng: (F) 挥发.",
            },
            {
                "num": 17,
                "text": "一个面和一条 ______ 会产生两个公共点。",
                "correct": "A",
                "explanation": "Trong hình học không gian, khi một đường cong/đường tròn cắt (相交) với một mặt phẳng hoặc mặt cầu, chúng có thể giao nhau tại hai điểm chung (公共点). Đáp án đúng: (A) 相交.",
            },
            {
                "num": 18,
                "text": "三角形的 ______ 两边之和大于第三边。",
                "correct": "C",
                "explanation": "Bất đẳng thức tam giác: “三角形的任意两边之和大于第三边” (Tổng hai cạnh bất kỳ trong tam giác luôn lớn hơn cạnh thứ ba). Đáp án đúng: (C) 任意.",
            },
            {
                "num": 19,
                "text": "正方形的 ______ 中心点就是两条对角线的交点。",
                "correct": "B",
                "explanation": "Hình vuông là hình có tâm đối xứng. Tâm đối xứng (对称中心) của hình vuông chính là giao điểm của hai đường chéo. Đáp án đúng: (B) 对称.",
            },
            {
                "num": 20,
                "text": "在化学反应过程中，原有的物质经过反应会 ______ 新的物质。",
                "correct": "D",
                "explanation": "Bản chất của phản ứng hóa học là sự biến đổi chất ban đầu để sinh ra/tạo thành (生成) chất mới: “生成新的物质”. Đáp án đúng: (D) 生成.",
            },
        ],
    },

    # ── PHẦN 4: Từ vựng KHTN - Nhóm 3 (Câu 21 - 25) ──
    # Container fill_blank_pool 3
    {
        "num": -3,
        "type": "fill_blank_pool",
        "category": "Từ vựng KHTN",
        "text": "选词填空（21-25 题）",
        "passage_text": "21. 碳元素是一种非金属元素，它有几种不同的 ______。\n22. 人能站在地球上行走的主要原因是 ______ 的作用。\n23. ______ 与物体的体积、液体的密度和重力有关。\n24. 能量表示物体 ______ 能力的大小，它有很多种形式。\n25. 音量是说话的声音 ______ 的大小。",
        "linked_options": [
            {"key": "A", "text": "做功", "textCn": "做功"},
            {"key": "B", "text": "形态", "textCn": "形态"},
            {"key": "C", "text": "重力", "textCn": "重力"},
            {"key": "D", "text": "浮力", "textCn": "浮力"},
            {"key": "E", "text": "发挥", "textCn": "发挥"},
            {"key": "F", "text": "量度", "textCn": "量度"},
        ],
        "children": [
            {
                "num": 21,
                "text": "碳元素是一种非金属元素，它有几种不同的 ______。",
                "correct": "B",
                "explanation": "Nguyên tố cacbon có nhiều dạng thù hình khác nhau (kim cương, than chì, fullerene...), trong tiếng Hán gọi là các hình thái (形态) khác nhau. Đáp án đúng: (B) 形态.",
            },
            {
                "num": 22,
                "text": "人能站在地球上行走的主要原因是 ______ 的作用。",
                "correct": "C",
                "explanation": "Con người đứng và đi lại được trên Trái Đất là nhờ tác dụng của trọng lực (重力) kéo giữ con người bám trên bề mặt đất và tạo ra áp lực giúp sinh ma sát để đi lại. Đáp án đúng: (C) 重力.",
            },
            {
                "num": 23,
                "text": "______ 与物体的体积、液体的密度和重力有关。",
                "correct": "D",
                "explanation": "Theo định luật Ác-si-mét: F_浮 = ρ_液 * g * V_排. Lực đẩy nổi (浮力) phụ thuộc vào thể tích vật chiếm chỗ, khối lượng riêng của chất lỏng và gia tốc trọng trường. Đáp án đúng: (D) 浮力.",
            },
            {
                "num": 24,
                "text": "能量表示物体 ______ 能力的大小，它有很多种形式。",
                "correct": "A",
                "explanation": "Trong vật lý học, năng lượng được định nghĩa là thước đo khả năng sinh công / thực hiện công (做功能力) của một vật. Đáp án đúng: (A) 做功.",
            },
            {
                "num": 25,
                "text": "音量是说话的声音 ______ 的大小。",
                "correct": "F",
                "explanation": "Âm lượng (loudness/volume) là đại lượng đo lường (量度) độ to nhỏ hay cường độ của âm thanh tiếng nói. Đáp án đúng: (F) 量度.",
            },
        ],
    },

    # ── PHẦN 5: Đọc điền từ Đoạn 1 - Đơn vị Lực Newton (Câu 34 - 37) ──
    # Container fill_blank_pool 4
    {
        "num": -4,
        "type": "fill_blank_pool",
        "category": "Đọc điền từ KHTN",
        "text": "阅读填空（34-37 题）",
        "passage_text": "牛顿是国际单位制中一种用于衡量力的大小的 {34}。这个单位是用科学家艾萨克·牛顿（Isaac Newton）的名字命名。牛顿的 {35} 是 N。{36} 1 牛顿，就是使 1 千克质量的物体产生 1 米/秒² {37} 的力。",
        "linked_options": [
            {"key": "A", "text": "简称", "textCn": "简称"},
            {"key": "B", "text": "所谓", "textCn": "所谓"},
            {"key": "C", "text": "加速度", "textCn": "加速度"},
            {"key": "D", "text": "符号", "textCn": "符号"},
            {"key": "E", "text": "单位", "textCn": "单位"},
        ],
        "children": [
            {
                "num": 34,
                "text": "牛顿是国际单位制中一种用于衡量力的大小的 {34}。",
                "correct": "E",
                "explanation": "“用于衡量力的大小的单位” = đơn vị dùng để đo độ lớn của lực. Đáp án đúng: (E) 单位.",
            },
            {
                "num": 35,
                "text": "牛顿的 {35} 是 N。",
                "correct": "D",
                "explanation": "“牛顿的符号是 N” = ký hiệu của đơn vị Newton là chữ N. Đáp án đúng: (D) 符号.",
            },
            {
                "num": 36,
                "text": "{36} 1 牛顿，就是使 1 千克质量的物体产生 1 米/秒²...",
                "correct": "B",
                "explanation": "“所谓 1 牛顿...” = Cái gọi là / Định nghĩa về 1 Newton chính là... Đáp án đúng: (B) 所谓.",
            },
            {
                "num": 37,
                "text": "产生 1 米/秒² {37} 的力。",
                "correct": "C",
                "explanation": "Đơn vị m/s² là đơn vị của gia tốc (加速度). Theo định luật II Newton (F = m * a), 1 N làm vật 1 kg sinh gia tốc 1 m/s². Đáp án đúng: (C) 加速度.",
            },
        ],
    },

    # ── PHẦN 6: Đọc điền từ Đoạn 2 - Mạch điện & Điện trở (Câu 39 - 43) ──
    # Container fill_blank_pool 5
    {
        "num": -5,
        "type": "fill_blank_pool",
        "category": "Đọc điền từ KHTN",
        "text": "阅读填空（39-43 题）",
        "passage_text": "我们用金属材料做了一个小实验，先计算了金属片的 {39}，然后给它加上 {40}，观察到 {41} 通过时，{42} 发生了变化。我们接着讨论了电阻和电压的关系，学习了怎样 {43} 电流太大。这个过程很有趣。",
        "linked_options": [
            {"key": "A", "text": "电压", "textCn": "电压"},
            {"key": "B", "text": "电流", "textCn": "电流"},
            {"key": "C", "text": "电阻", "textCn": "电阻"},
            {"key": "D", "text": "防止", "textCn": "防止"},
            {"key": "E", "text": "面积", "textCn": "面积"},
        ],
        "children": [
            {
                "num": 39,
                "text": "先计算了金属片的 {39}，然后给它加上 {40}...",
                "correct": "E",
                "explanation": "Đo diện tích / tiết diện (面积) của tấm kim loại trước khi khảo sát điện trở (R = ρ * L / S). Đáp án đúng: (E) 面积.",
            },
            {
                "num": 40,
                "text": "然后给它加上 {40}，观察到 {41} 通过时...",
                "correct": "A",
                "explanation": "“加上电压” = đặt vào hai đầu tấm kim loại một hiệu điện thế / điện áp. Đáp án đúng: (A) 电压.",
            },
            {
                "num": 41,
                "text": "观察到 {41} 通过时，{42} 发生了变化。",
                "correct": "B",
                "explanation": "“电流通过时” = khi có dòng điện chạy qua vật dẫn. Đáp án đúng: (B) 电流.",
            },
            {
                "num": 42,
                "text": "观察到 {41} 通过时，{42} 发生了变化。",
                "correct": "C",
                "explanation": "Dòng điện chạy qua sinh nhiệt làm nhiệt độ tấm kim loại tăng lên, dẫn đến điện trở (电阻) bị thay đổi. Đáp án đúng: (C) 电阻.",
            },
            {
                "num": 43,
                "text": "学习了怎样 {43} 电流太大。",
                "correct": "D",
                "explanation": "“怎样防止电流太大” = học cách phòng ngừa / ngăn chặn dòng điện quá tải để bảo vệ mạch. Đáp án đúng: (D) 防止.",
            },
        ],
    },

    # ── PHẦN 7: Đọc điền từ Đoạn 3 - Động cơ & Quán tính xe (Câu 44 - 48) ──
    # Container fill_blank_pool 6
    {
        "num": -6,
        "type": "fill_blank_pool",
        "category": "Đọc điền từ KHTN",
        "text": "阅读填空（44-48 题）",
        "passage_text": "汽车如果有强大的 {44}，就能开得很快。当汽车 {45} 行驶状态时，可以通过 {46} 装置来调整速度。如果汽车失去动力，汽车仍在 {47} 作用下 {48} 前进一段距离。",
        "linked_options": [
            {"key": "A", "text": "惯性", "textCn": "惯性"},
            {"key": "B", "text": "持续", "textCn": "持续"},
            {"key": "C", "text": "变速", "textCn": "变速"},
            {"key": "D", "text": "动力", "textCn": "动力"},
            {"key": "E", "text": "处于", "textCn": "处于"},
        ],
        "children": [
            {
                "num": 44,
                "text": "汽车如果有强大的 {44}，就能开得很快。",
                "correct": "D",
                "explanation": "“强大的动力” = động lực / công suất kéo mạnh mẽ giúp ô tô chạy nhanh. Đáp án đúng: (D) 动力.",
            },
            {
                "num": 45,
                "text": "当汽车 {45} 行驶状态时...",
                "correct": "E",
                "explanation": "Cấu trúc cố định: “处于……状态” = ở vào trạng thái đang di chuyển. Đáp án đúng: (E) 处于.",
            },
            {
                "num": 46,
                "text": "可以通过 {46} 装置来调整速度。",
                "correct": "C",
                "explanation": "“变速装置” = cơ cấu biến tốc / hộp số để điều chỉnh vận tốc ô tô. Đáp án đúng: (C) 变速.",
            },
            {
                "num": 47,
                "text": "如果汽车失去动力，汽车仍在 {47} 作用下...",
                "correct": "A",
                "explanation": "Theo Định luật I Newton: khi mất lực kéo, nhờ quán tính (惯性) xe vẫn tiếp tục chuyển động. Đáp án đúng: (A) 惯性.",
            },
            {
                "num": 48,
                "text": "汽车仍在 {47} 作用下 {48} 前进一段距离。",
                "correct": "B",
                "explanation": "“持续前进” = tiếp tục lăn bánh về phía trước thêm một đoạn. Đáp án đúng: (B) 持续.",
            },
        ],
    },

    # ── PHẦN 8: Đọc hiểu 1 - Kỹ năng phỏng vấn xin việc (Câu 71 - 72) ──
    # Container reading_passage 1
    {
        "num": -7,
        "type": "reading_passage",
        "category": "Đọc hiểu",
        "text": "阅读文段（71-72 题）",
        "passage_text": "你知道去找工作时需要注意什么吗？首先，你最好穿一套正式的衣服，这样会给大家留下一个好印象，至少让别人觉得你是一个认真的人。其次，介绍自己或者回答问题的时候不要紧张，说话速度不要太快，声音也不要太小。另外，还有一点也很重要，一定要真实地回答每一个问题。",
        "children": [
            {
                "num": 71,
                "text": "短文主要介绍了找工作时（ ）",
                "options": [
                    {"key": "A", "text": "适应变化的方法"},
                    {"key": "B", "text": "如何保持好心情"},
                    {"key": "C", "text": "需注意的方面"},
                    {"key": "D", "text": "穿衣服的要求"},
                ],
                "correct": "C",
                "explanation": "Đoạn văn mở đầu bằng câu hỏi: “你知道去找工作时需要注意什么吗？”, sau đó dùng các từ nối “首先, 其次, 另外” để trình bày toàn diện các khía cạnh cần lưu ý khi đi tìm việc (需注意的方面). Phương án D chỉ là một chi tiết nhỏ ở ý thứ nhất. Đáp án đúng: (C) 需注意的方面.",
            },
            {
                "num": 72,
                "text": "回答面试官的问题时需要（ ）",
                "options": [
                    {"key": "A", "text": "节约时间"},
                    {"key": "B", "text": "真实回答"},
                    {"key": "C", "text": "小声说话"},
                    {"key": "D", "text": "简单介绍"},
                ],
                "correct": "B",
                "explanation": "Câu cuối đoạn văn nêu rõ: “一定要真实地回答每一个问题” (nhất định phải trả lời thật lòng / chân thật từng câu hỏi). Đáp án đúng: (B) 真实回答.",
            },
        ],
    },

    # ── PHẦN 9: Đọc hiểu 2 - Kế hoạch chạy bộ của Vương Lượng (Câu 73 - 75) ──
    # Container reading_passage 2
    {
        "num": -8,
        "type": "reading_passage",
        "category": "Đọc hiểu",
        "text": "阅读文段（73-75 题）",
        "passage_text": "王亮是个上班族，每天工作都很忙，但他一直想保持健康的生活方式。最近，他决定开始一个运动计划，他选择了跑步，因为觉得跑步简单又方便，时间灵活，还不需要特别的设备，只要一双舒服的鞋和一条合适的路线就行。\n王亮开始了每天跑五公里的计划，第一个星期，甲跑起路来很慢，常常跑一公里就累得不行，乙王亮没有放弃，他告诉自己，只要坚持，就会有进步。慢慢地，他的速度越来越快，能够轻松跑完五公里，都不觉得很累。\n除了跑步，王亮还开始注意饮食，少吃高热量的食物，比如少吃油腻的点心，丙多吃蔬菜和水果等富含维生素的食物。他还坚持每天喝足够的水，保持身体的水分平衡。王亮发现，多喝水可以让他的皮肤更好，也不再感到口渴。\n一个月后，王亮发现自己瘦了一些，身体也更有活力，丁能够更长时间地集中精力工作，晚上也能更快睡着。除了继续坚持跑步，他还想尝试其他运动，比如游泳、跳舞、打球，——丰富休闲生活。王亮相信，只要坚持下去，就能拥有更健康的身体和更好的精力。",
        "children": [
            {
                "num": 73,
                "text": "“然而”填入短文中哪一处比较合适？",
                "options": [
                    {"key": "A", "text": "丁"},
                    {"key": "B", "text": "丙"},
                    {"key": "C", "text": "乙"},
                    {"key": "D", "text": "甲"},
                ],
                "correct": "C",
                "explanation": "Vế trước [乙] nói về khó khăn: “常常跑一公里就累得不行” (chạy 1km đã mệt không chịu nổi). Vế sau [乙] là ý chí kiên trì: “王亮没有放弃，他告诉自己，只要坚持，就会有进步”. Đây là quan hệ chuyển ngoặt đối lập (nghịch cảnh vs ý chí), nên điền liên từ “然而” (tuy nhiên) vào vị trí [乙] là chuẩn xác nhất. Đáp án đúng: (C) 乙.",
            },
            {
                "num": 74,
                "text": "填入文中“——”处，最合适的词语是？",
                "options": [
                    {"key": "A", "text": "从而"},
                    {"key": "B", "text": "即使"},
                    {"key": "C", "text": "竟然"},
                    {"key": "D", "text": "如此"},
                ],
                "correct": "A",
                "explanation": "“从而” (cóng'ér) là liên từ biểu thị kết quả tự nhiên hoặc mục đích đạt được thông qua hành động đi trước: tham gia nhiều môn thể thao khác (bơi lội, nhảy múa, đánh bóng) -> nhờ đó mà làm phong phú đời sống giải trí (“从而丰富休闲生活”). Đáp án đúng: (A) 从而.",
            },
            {
                "num": 75,
                "text": "王亮在跑步过程中遇到了什么困难？",
                "options": [
                    {"key": "A", "text": "找不到合适的公园"},
                    {"key": "B", "text": "开始跑得很慢，容易累"},
                    {"key": "C", "text": "没有合适的跑鞋"},
                    {"key": "D", "text": "总是跑得太快"},
                ],
                "correct": "B",
                "explanation": "Đoạn 2 nêu rõ: “第一个星期，跑起路来很慢，常常跑一公里就累得不行” (tuần đầu chạy rất chậm, thường chạy 1km đã mệt lả). Đáp án đúng: (B) 开始跑得很慢，容易累.",
            },
        ],
    },

    # ── PHẦN 10: Đọc hiểu 3 - Cấu trúc phân tử nước và băng đá (Câu 76 - 77) ──
    # Container reading_passage 3
    {
        "num": -9,
        "type": "reading_passage",
        "category": "Đọc hiểu KHTN",
        "text": "阅读文段（76-77 题）",
        "passage_text": "当水结冰时，水分子的形状和极性使它们连接成了六边形的环，形成了六边形的雪花。这很独特，因为大多数物质的固态密度都比它们的液态密度要高，冰的密度比水低，所以它可以浮在水面上。由于冰的密度只稍微比水低一点，所以，冰山的 90% 都在水的表面之下。",
        "children": [
            {
                "num": 76,
                "text": "大多数物质都有什么样的特点？",
                "options": [
                    {"key": "A", "text": "可以连接成六边形的环"},
                    {"key": "B", "text": "可以形成六边形的雪花"},
                    {"key": "C", "text": "形状和极性都非常独特"},
                    {"key": "D", "text": "固态密度比液态密度高"},
                ],
                "correct": "D",
                "explanation": "Văn bản nêu rõ đặc điểm chung của đa số chất: “...因为大多数物质的固态密度都比它们的液态密度要高...” (khối lượng riêng thể rắn của hầu hết các chất đều cao hơn ở thể lỏng). Đáp án đúng: (D) 固态密度比液态密度高.",
            },
            {
                "num": 77,
                "text": "冰为什么可以浮在水面上？",
                "options": [
                    {"key": "A", "text": "冰的密度等于水的密度"},
                    {"key": "B", "text": "冰的密度与水的差很多"},
                    {"key": "C", "text": "冰的密度比水的密度大"},
                    {"key": "D", "text": "冰的密度比水的密度低"},
                ],
                "correct": "D",
                "explanation": "Bài đọc giải thích trực tiếp: “...冰的密度比水低，所以它可以浮在水面上” (mật độ của băng thấp hơn nước, vì vậy nó có thể nổi trên mặt nước). Đáp án đúng: (D) 冰的密度比水的密度低.",
            },
        ],
    },

    # ── PHẦN 11: Đọc hiểu 4 - Nhiệt động lực học khi ôm nhau (Câu 78 - 80) ──
    # Container reading_passage 4
    {
        "num": -10,
        "type": "reading_passage",
        "category": "Đọc hiểu KHTN",
        "text": "阅读文段（78-80 题）",
        "passage_text": "冬天为什么两个人抱在一起会感到更暖和呢？\n从物理学的角度来看，这是一个热力学过程。由于两个人构成了一个相对封闭的系统，在一定程度上减少了和外界的热交换，从而保持了较高的体温水平。\n首先，拥抱促进了热传导。拥抱时的身体接触促进了热量在两个人之间传递，由于无一人是冷的，使在一定程度内两个人的体温变得更差不多，从而减少了因体温差异导致的热量散失。从热传导的角度来看，当两个人拥抱在一起时，人与空气的接触面积小了，空气流动带走的热量也减少了。\n其次，拥抱减少了对流传热。从对流传热的角度来看，当两个人拥抱在一起时，拥抱减少了辐射换热。根据斯特藩-玻尔兹曼定律，人体以热辐射的方式向周围环境传热。拥抱时两个人减少了向外界辐射热量的表面积，使得热辐射的热量损失降低。\n可见，两个人抱在一起时，通过促进热传递、减少对流传热和辐射散热，会使人感觉更温暖。这就是在寒冷的环境里，需要注意的是，虽然两个人抱在一起更暖和，但在非常寒冷的环境下，还是需要采取其他措施。",
        "children": [
            {
                "num": 78,
                "text": "从热传导的角度看，两个人抱在一起为什么会更暖和？",
                "options": [
                    {"key": "A", "text": "促进热量在人体中传递"},
                    {"key": "B", "text": "加快热量散失"},
                    {"key": "C", "text": "增加与外界的热交换"},
                    {"key": "D", "text": "提高两人的体温差异"},
                ],
                "correct": "A",
                "explanation": "Đoạn 3 bài đọc nêu rõ: “首先，拥抱促进了热传导。拥抱时的身体接触促进了热量在两个人之间传递...” (tiếp xúc cơ thể thúc đẩy nhiệt lượng truyền giữa hai người). Đáp án đúng: (A) 促进热量在人体中传递.",
            },
            {
                "num": 79,
                "text": "从热对流的角度来看，两个人抱在一起为什么会更暖和？",
                "options": [
                    {"key": "A", "text": "与冷空气的接触面积增大"},
                    {"key": "B", "text": "组成了更大的散热系统"},
                    {"key": "C", "text": "空气流动带走的热量少"},
                    {"key": "D", "text": "对流传热不断增加"},
                ],
                "correct": "C",
                "explanation": "Bài đọc chỉ rõ: “...人与空气的接触面积小了，空气流动带走的热量也减少了” (diện tích tiếp xúc với không khí giảm đi, nhiệt lượng mà luồng không khí lưu động mang đi cũng giảm bớt). Đáp án đúng: (C) 空气流动带走的热量少.",
            },
            {
                "num": 80,
                "text": "从热辐射的角度来看，两个人抱在一起为什么会更暖和？",
                "options": [
                    {"key": "A", "text": "增大了辐射散热的表面积"},
                    {"key": "B", "text": "加快了辐射散热的速度"},
                    {"key": "C", "text": "提高了辐射散热效率"},
                    {"key": "D", "text": "降低了热辐射的热量"},
                ],
                "correct": "D",
                "explanation": "Đoạn 4 bài đọc nêu rõ: “...拥抱时两个人减少了向外界辐射热量的表面积，使得热辐射的热量损失降低” (ôm nhau làm giảm diện tích bức xạ, làm hạ thấp lượng nhiệt hao tổn do bức xạ nhiệt). Đáp án đúng: (D) 降低了热辐射的热量.",
            },
        ],
    },
]

def main():
    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            # 1. Check if exam already exists
            cur.execute("SELECT id FROM exams WHERE title = %s AND subject_id = %s AND deleted_at IS NULL;", 
                        (EXAM_DATA["title"], EXAM_DATA["subject_id"]))
            existing = cur.fetchone()
            if existing:
                exam_id = existing[0]
                print(f"Exam '{EXAM_DATA['title']}' already exists with ID={exam_id}. Updating/replacing questions...")
                # Delete old questions for clean replace
                cur.execute("DELETE FROM questions WHERE exam_id = %s;", (exam_id,))
                cur.execute("""
                    UPDATE exams
                    SET title_cn = %s, duration = %s, total_questions = %s, total_points = %s,
                        difficulty_level = %s, status = %s, is_premium = %s, language_mode = %s,
                        explanation_language_mode = %s, description = %s, updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s;
                """, (
                    EXAM_DATA["title_cn"], EXAM_DATA["duration"], EXAM_DATA["total_questions"],
                    EXAM_DATA["total_points"], EXAM_DATA["difficulty_level"], EXAM_DATA["status"],
                    EXAM_DATA["is_premium"], EXAM_DATA["language_mode"], EXAM_DATA["explanation_language_mode"],
                    EXAM_DATA["description"], exam_id
                ))
            else:
                code = f"TTTN202512_{int(time.time()) % 100000}"
                cur.execute("""
                    INSERT INTO exams (
                        subject_id, code, title, title_cn, description, duration,
                        total_questions, total_points, difficulty_level, status,
                        is_premium, language_mode, explanation_language_mode, publish_date, created_at, updated_at
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s,
                        %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                    ) RETURNING id;
                """, (
                    EXAM_DATA["subject_id"], code, EXAM_DATA["title"], EXAM_DATA["title_cn"],
                    EXAM_DATA["description"], EXAM_DATA["duration"], EXAM_DATA["total_questions"],
                    EXAM_DATA["total_points"], EXAM_DATA["difficulty_level"], EXAM_DATA["status"],
                    EXAM_DATA["is_premium"], EXAM_DATA["language_mode"], EXAM_DATA["explanation_language_mode"]
                ))
                exam_id = cur.fetchone()[0]
                print(f"Created new exam with ID={exam_id}, Code={code}")

            # Calculate points per question: 100 / 45 ≈ 2.22
            points_per_q = round(100.0 / 45.0, 2)
            inserted_count = 0

            for item in QUESTIONS_DATA:
                qtype = item["type"]

                if qtype == "single_choice":
                    cur.execute("""
                        INSERT INTO questions (
                            exam_id, question_number, question_type, question_category,
                            question_text, question_text_cn, question_text_en,
                            points, difficulty, explanation, created_at
                        ) VALUES (
                            %s, %s, %s, %s,
                            %s, %s, NULL,
                            %s, 'medium', %s, CURRENT_TIMESTAMP
                        ) RETURNING id;
                    """, (
                        exam_id, item["num"], qtype, item["category"],
                        item["text"], item["text"], points_per_q, item["explanation"]
                    ))
                    qid = cur.fetchone()[0]

                    # Insert answers
                    for opt in item["options"]:
                        is_cor = (opt["key"] == item["correct"])
                        cur.execute("""
                            INSERT INTO answers (
                                question_id, answer_key, answer_text, answer_text_cn, answer_text_en, is_correct, created_at
                            ) VALUES (%s, %s, %s, %s, NULL, %s, CURRENT_TIMESTAMP);
                        """, (qid, opt["key"], opt["text"], opt["text"], is_cor))
                    inserted_count += 1

                elif qtype in ("fill_blank_pool", "reading_passage"):
                    # Insert container question
                    linked_opts_json = json.dumps(item.get("linked_options")) if item.get("linked_options") else None
                    cur.execute("""
                        INSERT INTO questions (
                            exam_id, question_number, question_type, question_category,
                            question_text, question_text_cn, question_text_en,
                            passage_text, linked_options,
                            points, difficulty, created_at
                        ) VALUES (
                            %s, %s, %s, %s,
                            %s, %s, NULL,
                            %s, %s::jsonb,
                            0, 'medium', CURRENT_TIMESTAMP
                        ) RETURNING id;
                    """, (
                        exam_id, item["num"], qtype, item["category"],
                        item["text"], item["text"], item["passage_text"], linked_opts_json
                    ))
                    container_id = cur.fetchone()[0]
                    # Self-reference passage_group_id
                    cur.execute("UPDATE questions SET passage_group_id = id WHERE id = %s;", (container_id,))

                    # Insert children
                    for child in item["children"]:
                        child_type = "fill_blank_item" if qtype == "fill_blank_pool" else "reading_item"
                        cur.execute("""
                            INSERT INTO questions (
                                exam_id, question_number, sub_question_number, passage_group_id,
                                question_type, question_category,
                                question_text, question_text_cn, question_text_en,
                                points, difficulty, explanation, created_at
                            ) VALUES (
                                %s, %s, %s, %s,
                                %s, %s,
                                %s, %s, NULL,
                                %s, 'medium', %s, CURRENT_TIMESTAMP
                            ) RETURNING id;
                        """, (
                            exam_id, child["num"], child["num"], container_id,
                            child_type, item["category"],
                            child["text"], child["text"],
                            points_per_q, child["explanation"]
                        ))
                        child_id = cur.fetchone()[0]

                        # Options for child
                        if qtype == "fill_blank_pool":
                            # Use linked_options from pool
                            opts = item["linked_options"]
                        else:
                            # Use child's own options
                            opts = child["options"]

                        for opt in opts:
                            is_cor = (opt["key"] == child["correct"])
                            cur.execute("""
                                INSERT INTO answers (
                                    question_id, answer_key, answer_text, answer_text_cn, answer_text_en, is_correct, created_at
                                ) VALUES (%s, %s, %s, %s, NULL, %s, CURRENT_TIMESTAMP);
                            """, (child_id, opt["key"], opt["text"], opt["text"], is_cor))
                        inserted_count += 1

            conn.commit()
            print(f"Successfully populated exam {exam_id} with {inserted_count} active questions!")

            # Verify integrity
            cur.execute("""
                SELECT q.question_number, q.question_type, q.passage_group_id, q.question_text,
                       count(a.id) as answer_count,
                       (SELECT a2.answer_key FROM answers a2 WHERE a2.question_id = q.id AND a2.is_correct = TRUE LIMIT 1) as correct_key
                FROM questions q
                LEFT JOIN answers a ON a.question_id = q.id
                WHERE q.exam_id = %s
                GROUP BY q.id, q.question_number, q.question_type, q.passage_group_id, q.question_text
                ORDER BY q.question_number ASC;
            """, (exam_id,))
            rows = cur.fetchall()
            print(f"\nVerification: Total {len(rows)} rows (containers + items):")
            for r in rows:
                print(f"  Q{r[0]:02d} [{r[1]}] pid={r[2]} answers={r[4]} correct={r[5]} text={r[3][:30]}")

if __name__ == "__main__":
    main()
