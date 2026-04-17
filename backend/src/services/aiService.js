const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

if (!process.env.GEMINI_API_KEY) {
  console.warn(
    "⚠️  GEMINI_API_KEY không được cấu hình trong .env — AI features sẽ không hoạt động",
  );
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const hasGeminiConfig = Boolean(process.env.GEMINI_API_KEY);

// Server-level rate limit state — persist sang file để survive nodemon restart
const RATE_LIMIT_FILE = path.join(__dirname, "../../.ai_ratelimit");
const RATE_LIMIT_BACKOFF_MS = 90_000; // 90 giây sau khi bị 429

let rateLimitedUntil = 0;

// Khôi phục state từ file khi module load (survive server restart)
try {
  const saved = JSON.parse(fs.readFileSync(RATE_LIMIT_FILE, "utf8"));
  if (saved.until > Date.now()) {
    rateLimitedUntil = saved.until;
    console.log(
      `📋 Khôi phục AI rate limit state — còn ${Math.ceil((saved.until - Date.now()) / 1000)}s`,
    );
  }
} catch {
  /* không có file — bình thường */
}

/**
 * Kiểm tra xem hiện tại có đang trong thời gian backoff không
 */
function isRateLimited() {
  return Date.now() < rateLimitedUntil;
}

function setRateLimited(backoffMs) {
  rateLimitedUntil = Date.now() + backoffMs;
  try {
    fs.writeFileSync(
      RATE_LIMIT_FILE,
      JSON.stringify({ until: rateLimitedUntil }),
    );
  } catch {}
}

/** Trả về số giây còn lại của backoff (0 nếu không bị rate limit) */
function getRateLimitRemaining() {
  return Math.max(0, Math.ceil((rateLimitedUntil - Date.now()) / 1000));
}

// ── Global Gemini mutex ───────────────────────────────────────────────────────
// Chỉ cho phép 1 call Gemini tại bất kỳ thời điểm nào (bất kể user).
// Nếu đang có call in-flight, request mới sẽ đợi rồi re-check isRateLimited().
let geminiMutexPromise = null;

/**
 * Gọi Gemini — fail fast nếu đang trong backoff hoặc bị 429
 */
async function callGemini(model, prompt) {
  // Nếu đang trong backoff window — throw ngay, không gọi API
  if (isRateLimited()) {
    const remainSec = Math.ceil((rateLimitedUntil - Date.now()) / 1000);
    console.warn(`⏳ Gemini đang trong backoff, còn ${remainSec}s — bỏ qua`);
    const e = new Error("RATE_LIMITED");
    e.isRateLimit = true;
    throw e;
  }

  // Nếu đang có 1 call khác chạy — đợi nó xong rồi re-check
  if (geminiMutexPromise) {
    await geminiMutexPromise.catch(() => {});
    // Sau khi call kia xong, kiểm tra lại (có thể đã set rateLimitedUntil)
    if (isRateLimited()) {
      const remainSec = Math.ceil((rateLimitedUntil - Date.now()) / 1000);
      console.warn(`⏳ Gemini backoff sau mutex, còn ${remainSec}s — bỏ qua`);
      const e = new Error("RATE_LIMITED");
      e.isRateLimit = true;
      throw e;
    }
  }

  // Đăng ký mutex ĐỒNG BỘ trước khi await bất kỳ điều gì
  let resolveMutex;
  geminiMutexPromise = new Promise((r) => {
    resolveMutex = r;
  });

  try {
    const result = await model.generateContent(prompt);
    return result.response;
  } catch (err) {
    const is429 =
      err.status === 429 || (err.message && err.message.includes("429"));
    if (is429) {
      const retryMatch =
        err.message && err.message.match(/"retryDelay":"(\d+)s"/);
      const backoffMs = retryMatch
        ? (parseInt(retryMatch[1]) + 5) * 1000
        : RATE_LIMIT_BACKOFF_MS;
      setRateLimited(backoffMs);
      console.warn(
        `⚠️  Gemini 429 — backoff ${Math.ceil(backoffMs / 1000)}s (mọi request sẽ trả cache ngay)`,
      );
      const e = new Error("RATE_LIMITED");
      e.isRateLimit = true;
      throw e;
    }
    throw err;
  } finally {
    resolveMutex();
    // Xóa mutex sau 100ms để tránh các request mới bị đợi vô ích
    setTimeout(() => {
      if (geminiMutexPromise) geminiMutexPromise = null;
    }, 100);
  }
}

// Alias cũ để không cần sửa các chỗ gọi
const callGeminiWithRetry = callGemini;

function buildRuleBasedWeaknessAnalysis(examAttempts, subjectStats) {
  const normalized = Object.entries(subjectStats)
    .map(([subject, stats]) => {
      const avg = stats.count > 0 ? (stats.total / stats.count) : 0;
      return {
        subject,
        percentage: Math.max(0, Math.min(100, Math.round(avg))),
        count: stats.count,
      };
    })
    .sort((a, b) => a.percentage - b.percentage);

  const weaknesses = normalized
    .filter((item) => item.percentage < 75)
    .slice(0, 3)
    .map((item) => ({
      subject: item.subject,
      percentage: item.percentage,
      advice:
        item.percentage < 55
          ? "Nên học lại ly thuyet nen tang va lam bo de muc do co ban moi ngay."
          : "Tap trung luyen de co giai thich dap an va ghi lai loi sai thuong gap.",
    }));

  const strengths = normalized
    .filter((item) => item.percentage >= 80)
    .slice(-2)
    .reverse()
    .map((item) => ({
      subject: item.subject,
      percentage: item.percentage,
      praise: "Ban dang duy tri ket qua tot, hay tiep tuc giu nhip luyen de deu dan.",
    }));

  const suggestions = [];
  if (weaknesses.length > 0) {
    suggestions.push(
      `Uu tien 60 phut moi ngay cho mon ${weaknesses[0].subject} trong 7 ngay toi.`,
    );
  }
  suggestions.push("Sau moi de, tong hop 5 cau sai vao so tay va on lai vao hom sau.");
  suggestions.push(
    "Lam it nhat 1 de tong hop moi 2 ngay de theo doi tien bo va dieu chinh lo trinh.",
  );

  return {
    hasEnoughData: true,
    totalExams: examAttempts.length,
    subjectStats: normalized.map((item) => ({
      subject: item.subject,
      average: item.percentage.toFixed(1),
      count: item.count,
    })),
    weaknesses,
    strengths,
    suggestions,
  };
}

function buildRuleBasedRoadmap(weaknesses) {
  const weakestSubject =
    weaknesses?.weaknesses?.[0]?.subject || "mon can cai thien";

  return {
    roadmap: [
      {
        phase: 1,
        days: "1-3",
        title: "Cung co nen tang",
        description: `On lai ly thuyet cot loi cua ${weakestSubject}.`,
        tasks: [
          "On lai cong thuc/chu de trong 45-60 phut moi ngay",
          "Lam 20 cau co ban va cham lai tung cau sai",
          "Ghi chu cac loi sai lap lai",
        ],
      },
      {
        phase: 2,
        days: "4-6",
        title: "Luyen theo dang bai",
        description: "Chia nho theo tung dang cau hoi de tang do chinh xac.",
        tasks: [
          "Moi ngay chon 2 dang bai de luyen sau",
          "Dat muc tieu do chinh xac toi thieu 70%",
          "Danh dau nhung cau mat nhieu thoi gian",
        ],
      },
      {
        phase: 3,
        days: "7-9",
        title: "Tang toc do",
        description: "Luyen de co gioi han thoi gian de toi uu toc do lam bai.",
        tasks: [
          "Lam de mini 30-40 phut",
          "Review dap an trong 20 phut ngay sau khi nop bai",
          "Toi uu thu tu lam cau de tranh mat diem de",
        ],
      },
      {
        phase: 4,
        days: "10-12",
        title: "De tong hop",
        description: "Mo rong sang de tong hop gan voi de thi that.",
        tasks: [
          "Moi 2 ngay lam 1 de tong hop",
          "So sanh diem voi lan truoc de do tien bo",
          "Tap trung sua nhom cau sai cao nhat",
        ],
      },
      {
        phase: 5,
        days: "13-15",
        title: "Chot chien luoc",
        description: "On tap co trong tam va chot chien luoc phong thi.",
        tasks: [
          "On lai so tay loi sai trong toan bo 2 tuan",
          "Lam 1 de tong duyet cuoi cung",
          "Chuan bi ke hoach phan bo thoi gian khi thi",
        ],
      },
    ],
  };
}

/**
 * Phân tích điểm yếu từ lịch sử làm bài
 * @param {Array} examAttempts - Mảng các lần thi
 * @returns {Promise<Object>} - Phân tích điểm yếu
 */
async function analyzeWeaknesses(examAttempts) {
  if (!examAttempts || examAttempts.length === 0) {
    return {
      hasEnoughData: false,
      message: "Bạn cần làm ít nhất 3 đề thi để AI phân tích",
    };
  }

  if (examAttempts.length < 3) {
    return {
      hasEnoughData: false,
      message: `Bạn đã làm ${examAttempts.length} đề. Cần thêm ${3 - examAttempts.length} đề nữa để AI phân tích chính xác.`,
    };
  }

  // Tính điểm trung bình theo môn
  const subjectStats = {};
  examAttempts.forEach((attempt) => {
    const subject = attempt.subject || "Tổng hợp";
    if (!subjectStats[subject]) {
      subjectStats[subject] = { total: 0, count: 0, scores: [] };
    }
    // score là điểm trên thang 100, hoặc tính từ total_correct/total_questions
    const percentage =
      attempt.total_questions > 0
        ? (attempt.total_correct / attempt.total_questions) * 100
        : parseFloat(attempt.score) || 0;
    subjectStats[subject].total += percentage;
    subjectStats[subject].count += 1;
    subjectStats[subject].scores.push(percentage);
  });

  // Tạo prompt cho GPT
  const subjectSummary = Object.entries(subjectStats)
    .map(([subject, stats]) => {
      const avg = (stats.total / stats.count).toFixed(1);
      return `- ${subject}: ${avg}% (${stats.count} lần thi)`;
    })
    .join("\n");

  const prompt = `Bạn là chuyên gia tư vấn học tập cho kỳ thi CSCA (China Scholarship Council Assessment). 
Phân tích kết quả học tập của học viên dưới đây và đưa ra lời khuyên cụ thể.

KẾT QUẢ HỌC TẬP:
Tổng số đề thi đã làm: ${examAttempts.length}
Điểm trung bình theo môn:
${subjectSummary}

YÊU CẦU:
1. Phân tích 2-3 điểm yếu nhất (môn/chủ đề dưới 70%)
2. Khen ngợi 1-2 điểm mạnh (môn/chủ đề trên 80%)
3. Đưa ra 3 gợi ý học tập cụ thể, ngắn gọn
4. Trả lời BẰNG TIẾNG VIỆT, ngắn gọn, thân thiện

Trả về JSON format:
{
  "weaknesses": [
    {"subject": "Tên môn", "percentage": 45, "advice": "Gợi ý ngắn gọn"}
  ],
  "strengths": [
    {"subject": "Tên môn", "percentage": 90, "praise": "Lời khen"}
  ],
  "suggestions": [
    "Gợi ý 1 - ngắn gọn, cụ thể",
    "Gợi ý 2 - ngắn gọn, cụ thể",
    "Gợi ý 3 - ngắn gọn, cụ thể"
  ]
}`;

  if (!hasGeminiConfig) {
    return buildRuleBasedWeaknessAnalysis(examAttempts, subjectStats);
  }

  try {
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.7,
        responseMimeType: "application/json",
      },
    });

    const response = await callGeminiWithRetry(model, prompt);
    const aiResponse = JSON.parse(response.text());

    return {
      hasEnoughData: true,
      totalExams: examAttempts.length,
      subjectStats: Object.entries(subjectStats).map(([subject, stats]) => ({
        subject,
        average: (stats.total / stats.count).toFixed(1),
        count: stats.count,
      })),
      ...aiResponse,
    };
  } catch (error) {
    if (error.isRateLimit) {
      throw error;
    }
    console.error("Gemini API Error (fallback mode):", error.message);
    return buildRuleBasedWeaknessAnalysis(examAttempts, subjectStats);
  }
}

/**
 * Tạo lộ trình học 15 ngày
 * @param {Object} weaknesses - Điểm yếu từ analyzeWeaknesses
 * @returns {Promise<Object>} - Lộ trình học
 */
async function generateRoadmap(weaknesses) {
  if (
    !weaknesses ||
    !weaknesses.weaknesses ||
    weaknesses.weaknesses.length === 0
  ) {
    return {
      roadmap: [],
      message: "Bạn đang học rất tốt! Tiếp tục duy trì.",
    };
  }

  const weaknessesText = weaknesses.weaknesses
    .map((w) => `- ${w.subject} (${w.percentage}%): ${w.advice}`)
    .join("\n");

  const prompt = `Tạo lộ trình học 15 ngày để cải thiện điểm yếu sau:

ĐIỂM YẾU:
${weaknessesText}

YÊU CẦU:
- Chia thành 5 giai đoạn (mỗi giai đoạn 3 ngày)
- Mỗi giai đoạn có: tiêu đề ngắn, mô tả, 2-3 checklist
- Bắt đầu từ dễ → khó
- Cụ thể, dễ làm theo
- TIẾNG VIỆT

Trả về JSON:
{
  "roadmap": [
    {
      "phase": 1,
      "days": "1-3",
      "title": "Tiêu đề ngắn",
      "description": "Mô tả 1 câu",
      "tasks": ["Task 1", "Task 2", "Task 3"]
    }
  ]
}`;

  if (!hasGeminiConfig) {
    return buildRuleBasedRoadmap(weaknesses);
  }

  try {
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.8,
        responseMimeType: "application/json",
      },
    });

    const response = await callGeminiWithRetry(model, prompt);
    const aiResponse = JSON.parse(response.text());

    return aiResponse;
  } catch (error) {
    if (error.isRateLimit) {
      throw error;
    }
    console.error("Gemini API Error (fallback roadmap):", error.message);
    return buildRuleBasedRoadmap(weaknesses);
  }
}

/**
 * Gợi ý tài liệu phù hợp
 * @param {Object} weaknesses - Điểm yếu
 * @param {Array} allMaterials - Danh sách tài liệu
 * @returns {Promise<Array>} - Tài liệu gợi ý
 */
async function recommendMaterials(weaknesses, allMaterials) {
  if (
    !weaknesses ||
    !weaknesses.weaknesses ||
    weaknesses.weaknesses.length === 0
  ) {
    return [];
  }

  if (!allMaterials || allMaterials.length === 0) {
    return [];
  }

  const weakSubjects = weaknesses.weaknesses.map((w) =>
    w.subject.toLowerCase(),
  );

  // Simple rule-based recommendation (không cần call API)
  const recommended = allMaterials
    .filter((material) => {
      const title = material.title.toLowerCase();
      const subject = (material.subject || "").toLowerCase();
      const category = (material.category || "").toLowerCase();

      return weakSubjects.some((ws) => {
        return (
          title.includes(ws) ||
          subject.includes(ws) ||
          category.includes("ly-thuyet")
        );
      });
    })
    .slice(0, 5); // Top 5

  return recommended;
}

module.exports = {
  analyzeWeaknesses,
  generateRoadmap,
  recommendMaterials,
  isRateLimited,
  getRateLimitRemaining,
};
