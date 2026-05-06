// Test Beeknoee với đúng endpoint + auth
const axios = require('axios');

const API_KEY = 'sk-bee-d32a3f4bc08544b4945bee85e9bb3ff82f3ca9a6bb1c42fd8c2dc4ef5e7a2e9a';
const MODEL = 'deepseek/deepseek-r1';
const BASE = 'https://platform.beeknoee.com/api/v1';

async function test(prompt, label) {
  const start = Date.now();
  try {
    const res = await axios.post(
      `${BASE}/chat/completions`,
      {
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.3,
      },
      {
        timeout: 60000,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
      }
    );

    const text = res.data?.choices?.[0]?.message?.content || '';
    console.log(`✅ ${label} (${Date.now() - start}ms)`);
    console.log(`   ${text.substring(0, 200)}`);
    console.log('');
    return true;
  } catch (err) {
    console.log(`❌ ${label} (${Date.now() - start}ms)`);
    console.log(`   Status: ${err.response?.status} | ${err.message}`);
    console.log(`   ${JSON.stringify(err.response?.data)?.substring(0, 200)}`);
    console.log('');
    return false;
  }
}

async function main() {
  console.log('🚀 Test Beeknoee API — DeepSeek R1\n');

  await test('Chào bạn! Bạn là AI gì?', 'AI Identity');

  await test(
    'Phân tích kết quả bài thi: 8/10 đúng, 2 sai (câu 3 và câu 7). ' +
    'Câu 3: chọn B (密度) nhưng đúng là C (质量). ' +
    'Câu 7: chọn A nhưng đúng là D. ' +
    'Đây là bài thi tiếng Trung. Trả lời ngắn bằng tiếng Việt.',
    'Exam Analysis'
  );

  await test(
    'Câu hỏi: 水在4°C时____最大。Đáp án đúng: 密度 (B). ' +
    'Bạn chọn: 体积 (D). Giải thích tại sao sai bằng tiếng Việt.',
    'Wrong Answer Explain'
  );

  console.log('✅ Test xong!');
}

main();
