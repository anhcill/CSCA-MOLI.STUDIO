const db = require("../config/database");
const { buildMaterialHtmlFromText, normalizeMaterialText } = require("./materialContentService");

const LAUNCH_THEORY_MATERIALS = [
  {
    title: "Tập hợp",
    subject: "toan",
    topic: "Tập hợp",
    description: "Khái niệm tập hợp, phần tử, tập con, giao, hợp và hiệu.",
    content: `Tập hợp
Tập hợp là một nhóm các đối tượng xác định. Mỗi đối tượng trong tập hợp gọi là phần tử.
- Ký hiệu x ∈ A nghĩa là x thuộc tập A.
- Ký hiệu x ∉ A nghĩa là x không thuộc tập A.
- B ⊂ A nghĩa là B là tập con của A.

Các phép toán cơ bản
- A ∪ B là hợp của hai tập hợp.
- A ∩ B là giao của hai tập hợp.
- A \\ B là phần thuộc A nhưng không thuộc B.

Khi làm bài, đọc kỹ điều kiện của tập xác định và chú ý các mốc biên như khoảng đóng, khoảng mở.`,
  },
  {
    title: "Cấp số cộng",
    subject: "toan",
    topic: "Cấp số cộng",
    description: "Công sai, số hạng tổng quát và tổng n số hạng đầu.",
    content: `Cấp số cộng
Cấp số cộng là dãy số mà hiệu giữa hai số hạng liên tiếp không đổi. Hiệu không đổi đó gọi là công sai d.

Công thức cần nhớ
- u_n = u_1 + (n - 1)d.
- S_n = n(u_1 + u_n) / 2.
- S_n = n[2u_1 + (n - 1)d] / 2.

Mẹo làm bài
Nếu đề cho hai số hạng khác nhau, lập hệ để tìm u_1 và d trước, sau đó mới tính đại lượng được hỏi.`,
  },
  {
    title: "Cấp số nhân",
    subject: "toan",
    topic: "Cấp số nhân",
    description: "Công bội, số hạng tổng quát và tổng cấp số nhân.",
    content: `Cấp số nhân
Cấp số nhân là dãy số mà tỉ số giữa hai số hạng liên tiếp không đổi. Tỉ số đó gọi là công bội q.

Công thức cần nhớ
- u_n = u_1 q^(n - 1).
- Nếu q ≠ 1 thì S_n = u_1(1 - q^n) / (1 - q).
- Nếu q = 1 thì S_n = n u_1.

Chú ý dấu của q. Khi q âm, dấu các số hạng sẽ luân phiên.`,
  },
  {
    title: "Hàm số và tập xác định",
    subject: "toan",
    topic: "Hàm số",
    description: "Cách tìm tập xác định và đọc điều kiện của hàm số.",
    content: `Hàm số và tập xác định
Tập xác định là tập tất cả giá trị của biến làm cho biểu thức có nghĩa.

Các điều kiện thường gặp
- Mẫu số khác 0.
- Biểu thức trong căn bậc chẵn lớn hơn hoặc bằng 0.
- Biểu thức trong logarit lớn hơn 0.

Khi có nhiều điều kiện, lấy giao của tất cả điều kiện để ra tập xác định cuối cùng.`,
  },
  {
    title: "Đạo hàm cơ bản",
    subject: "toan",
    topic: "Đạo hàm",
    description: "Quy tắc đạo hàm và ứng dụng xét biến thiên.",
    content: `Đạo hàm cơ bản
Đạo hàm cho biết tốc độ thay đổi của hàm số và dùng để xét tính đơn điệu, cực trị.

Quy tắc thường dùng
- (x^n)' = n x^(n-1).
- (u + v)' = u' + v'.
- (uv)' = u'v + uv'.
- (u/v)' = (u'v - uv') / v^2.

Ứng dụng
Nếu f'(x) > 0 trên khoảng thì hàm đồng biến. Nếu f'(x) < 0 trên khoảng thì hàm nghịch biến.`,
  },
  {
    title: "Phương trình bậc hai",
    subject: "toan",
    topic: "Phương trình",
    description: "Biệt thức delta, số nghiệm và công thức nghiệm.",
    content: `Phương trình bậc hai
Phương trình bậc hai có dạng ax^2 + bx + c = 0 với a ≠ 0.

Biệt thức
- Δ = b^2 - 4ac.
- Δ < 0: phương trình vô nghiệm thực.
- Δ = 0: phương trình có nghiệm kép.
- Δ > 0: phương trình có hai nghiệm phân biệt.

Công thức nghiệm
x = (-b ± √Δ) / 2a.`,
  },
  {
    title: "Chuyển động thẳng đều",
    subject: "vat-ly",
    topic: "Cơ học",
    description: "Vận tốc, quãng đường và thời gian trong chuyển động đều.",
    content: `Chuyển động thẳng đều
Chuyển động thẳng đều là chuyển động trên đường thẳng với vận tốc không đổi.

Công thức
- s = v t.
- v = s / t.
- t = s / v.

Đơn vị cần thống nhất trước khi tính: mét, giây, mét trên giây hoặc kilômét, giờ, kilômét trên giờ.`,
  },
  {
    title: "Nồng độ dung dịch",
    subject: "hoa-hoc",
    topic: "Dung dịch",
    description: "Công thức nồng độ phần trăm và nồng độ mol.",
    content: `Nồng độ dung dịch
Nồng độ cho biết lượng chất tan có trong một lượng dung dịch nhất định.

Công thức cơ bản
- C% = m chất tan / m dung dịch × 100%.
- C_M = n / V, với V tính bằng lít.

Khi pha loãng, số mol chất tan thường không đổi nếu không có phản ứng hóa học xảy ra.`,
  },
];

async function seedLaunchTheoryMaterials(pool = db) {
  const table = await pool.query("SELECT to_regclass('public.materials') AS table_name");
  if (!table.rows[0]?.table_name) return { inserted: 0, skipped: true };

  let inserted = 0;
  for (const item of LAUNCH_THEORY_MATERIALS) {
    const contentText = normalizeMaterialText(item.content);
    const contentHtml = buildMaterialHtmlFromText(contentText);
    const result = await pool.query(
      `INSERT INTO materials (
         title, description, file_url, file_type, category, subject, topic,
         is_active, is_premium, content_text, content_html, content_source, content_meta
       )
       SELECT $1::varchar, $2::text, '', 'web', 'ly-thuyet', $3::varchar, $4::varchar,
              TRUE, FALSE, $5::text, $6::text, 'seed', '{}'::jsonb
       WHERE NOT EXISTS (
         SELECT 1 FROM materials
         WHERE category = 'ly-thuyet'
           AND subject = $3::varchar
           AND topic = $4::varchar
           AND title = $1::varchar
       )`,
      [item.title, item.description, item.subject, item.topic, contentText, contentHtml],
    );
    inserted += result.rowCount || 0;
  }

  return { inserted, skipped: false };
}

module.exports = {
  LAUNCH_THEORY_MATERIALS,
  seedLaunchTheoryMaterials,
};
