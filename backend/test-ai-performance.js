/**
 * AI Performance Test Script - Full Comparison
 * So sánh hiệu suất gpt-5.4-mini trên Beeknoee
 * Chạy: node test-ai-performance.js
 */

const axios = require('axios');

const API_KEY = 'sk-bee-d32a3f4bc08544b4945bee85e9bb3ff82f3ca9a6bb1c42fd8c2dc4ef5e7a2e9a';
const MODEL = 'gpt-5.4-mini';
const BASE = 'https://platform.beeknoee.com/api/v1';

async function callAI(prompt, options = {}) {
  const { maxTokens = 1000, temperature = 0.3, label } = options;
  
  const startTime = Date.now();
  
  try {
    const res = await axios.post(
      `${BASE}/chat/completions`,
      {
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature,
      },
      {
        timeout: 60000,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
      }
    );
    
    const endTime = Date.now();
    const latency = endTime - startTime;
    const text = res.data?.choices?.[0]?.message?.content || '';
    
    return {
      success: true,
      latency,
      responseLength: text.length,
      text: text.substring(0, 300),
    };
  } catch (err) {
    const endTime = Date.now();
    return {
      success: false,
      latency: endTime - startTime,
      error: err.message,
      status: err.response?.status,
      data: err.response?.data,
    };
  }
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('AI PERFORMANCE TEST - gpt-5.4-mini');
  console.log('='.repeat(60));
  console.log(`Model: ${MODEL}`);
  console.log(`Provider: ${BASE}`);
  console.log('='.repeat(60));
  console.log('');

  const tests = [
    {
      name: 'Test 1: Phân tích kết quả thi HSK',
      label: 'Exam Analysis',
      prompt: `Phân tích kết quả bài thi HSK với 50 câu, đúng 35 câu, sai 15 câu.
      Trả lời ngắn bằng tiếng Việt.`,
      maxTokens: 500,
      temperature: 0.3,
    },
    {
      name: 'Test 2: Giải thích câu sai',
      label: 'Wrong Answer Explain',
      prompt: `Bạn là giáo viên tiếng Trung. Giải thích bằng TIẾNG VIỆT.
      
      Câu sai: Đề bài: Tôi muốn đi ___ Tokyo.
      Lựa chọn: A. với  B. đến  C. bằng  D. từ
      Bạn chọn: A
      Đúng: B
      
      Giải thích tại sao sai và kiến thức liên quan.`,
      maxTokens: 500,
      temperature: 0.4,
    },
    {
      name: 'Test 3: Chat hỏi đáp AI',
      label: 'Chat Q&A',
      prompt: `Bạn là giáo viên dạy tiếng Trung cho học sinh Việt Nam. Trả lời BẰNG TIẾNG VIỆT.
      
      Câu hỏi: "đi" và "đến" trong tiếng Trung khác nhau như thế nào?
      
      Trả lời ngắn gọn, có ví dụ.`,
      maxTokens: 500,
      temperature: 0.6,
    },
    {
      name: 'Test 4: Gợi ý học tập',
      label: 'Study Recommendations',
      prompt: `Bạn là chuyên gia giáo dục. Gợi ý 3 bài học cho học sinh yếu về ngữ pháp tiếng Trung.
      Trả lời bằng tiếng Việt, mỗi gợi ý 1-2 câu.`,
      maxTokens: 500,
      temperature: 0.5,
    },
    {
      name: 'Test 5: So sánh tiến bộ',
      label: 'Progress Analysis',
      prompt: `So sánh tiến bộ: Lần 1 được 50%, lần 2 được 65%, lần 3 được 70%.
      Nhận xét bằng tiếng Việt, 2-3 câu.`,
      maxTokens: 500,
      temperature: 0.3,
    },
  ];

  const results = [];
  let totalLatency = 0;
  let successCount = 0;
  let failCount = 0;

  for (const test of tests) {
    console.log(`\n⏳ ${test.name}`);
    console.log('-'.repeat(50));
    
    const result = await callAI(test.prompt, {
      maxTokens: test.maxTokens,
      temperature: test.temperature,
      label: test.label,
    });
    
    results.push({ name: test.name, ...result });
    
    if (result.success) {
      successCount++;
      totalLatency += result.latency;
      console.log(`✅ Thành công!`);
      console.log(`   ⏱️  Latency: ${result.latency}ms`);
      console.log(`   📝 Response length: ${result.responseLength} chars`);
      console.log(`   📄 Preview: ${result.text.substring(0, 150)}...`);
    } else {
      failCount++;
      console.log(`❌ Thất bại!`);
      console.log(`   ⏱️  Latency: ${result.latency}ms`);
      console.log(`   ❌ Error: ${result.error}`);
      if (result.status) console.log(`   📊 Status: ${result.status}`);
    }
    
    // Delay between tests
    await new Promise(r => setTimeout(r, 500));
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 PERFORMANCE SUMMARY');
  console.log('='.repeat(60));
  
  console.log(`\nModel: ${MODEL}`);
  console.log(`Total tests: ${results.length}`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  
  if (successCount > 0) {
    const avgLatency = totalLatency / successCount;
    const minLatency = Math.min(...results.filter(r => r.success).map(r => r.latency));
    const maxLatency = Math.max(...results.filter(r => r.success).map(r => r.latency));
    const totalResponseLength = results.filter(r => r.success).reduce((sum, r) => sum + r.responseLength, 0);
    
    console.log(`\n📈 Latency Stats:`);
    console.log(`   ├─ Average: ${avgLatency.toFixed(0)}ms`);
    console.log(`   ├─ Min: ${minLatency}ms`);
    console.log(`   ├─ Max: ${maxLatency}ms`);
    console.log(`   └─ Total: ${totalLatency}ms`);
    
    console.log(`\n📝 Response Stats:`);
    console.log(`   ├─ Total chars: ${totalResponseLength}`);
    console.log(`   └─ Avg chars/test: ${(totalResponseLength / successCount).toFixed(0)}`);
    
    console.log(`\n⚡ Performance Rating:`);
    if (avgLatency < 2000) {
      console.log(`   🚀 Excellent (< 2s avg)`);
    } else if (avgLatency < 4000) {
      console.log(`   ⚡ Good (2-4s avg)`);
    } else {
      console.log(`   🐢 Slow (> 4s avg)`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Return exit code
  process.exit(failCount > 0 ? 1 : 0);
}

runTests().catch(console.error);
