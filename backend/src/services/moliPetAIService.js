const axios = require('axios');
const aiConfig = require('../config/aiConfig');
const aiUsageService = require('./aiUsageService');

const BEE = aiConfig.beeknoee;
const ADMIN_EXAM_AI = aiConfig.adminExam || {};
const MOLI = aiConfig.moliPet || {};

let beeknoeeKeyIndex = 0;
let nineRouterKeyIndex = 0;

const AI_ACCURACY_PROMPT_RULES = `- Đọc kỹ đề gốc, đáp án và ngữ cảnh trước khi suy luận.
- Giữ nguyên ký hiệu toán/logic và điều kiện trong đề: <, <=, <=, >, >=, >=, =, !=, in, not in, union, intersection, empty set, |.
- Không đổi <= thành <, >= thành >, không đổi dấu âm, số mũ, chỉ số, miền xác định, tập nghiệm hoặc đáp án.
- Với câu Toán/Khoa học, đối chiếu lại điều kiện gốc và các lựa chọn trước khi kết luận.
- Nếu thiếu dữ kiện, thiếu hình/bảng/biểu đồ hoặc đáp án không khớp dữ liệu, nói rõ phần thiếu; không đoán.`;

function getChatCompletionsUrl(baseUrl) {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  if (!base) return '';
  if (/\/chat\/completions$/i.test(base)) return base;
  if (/\/(?:v1|api\/v1)$/i.test(base)) return `${base}/chat/completions`;
  return `${base}/v1/chat/completions`;
}

function getNextBeeknoeeKey() {
  const keys = (BEE.apiKeys || []).filter(Boolean);
  if (!keys.length) return '';
  const key = keys[beeknoeeKeyIndex % keys.length];
  beeknoeeKeyIndex += 1;
  return key;
}

function getNextNineRouterKey() {
  const keys = (ADMIN_EXAM_AI.apiKeys || []).filter(Boolean);
  if (!keys.length) return '';
  const key = keys[nineRouterKeyIndex % keys.length];
  nineRouterKeyIndex += 1;
  return key;
}

function getProviderConfig(provider) {
  if (provider === '9router') {
    return {
      baseUrl: ADMIN_EXAM_AI.baseUrl,
      apiKey: getNextNineRouterKey(),
      model: MOLI.model || 'ag/gemini-3-flash-agent',
      timeout: MOLI.timeout || ADMIN_EXAM_AI.timeout || BEE.timeout || 45000,
    };
  }

  return {
    baseUrl: BEE.baseUrl,
    apiKey: getNextBeeknoeeKey(),
    model: MOLI.fallbackModel || BEE.petChatModel || BEE.model,
    timeout: MOLI.timeout || BEE.timeout || 45000,
  };
}

function extractOpenAICompatibleText(data) {
  if (!data) return '';
  if (typeof data !== 'string') {
    const messageText = data?.choices?.[0]?.message?.content;
    if (typeof messageText === 'string') return messageText.trim();
    const deltaText = data?.choices?.[0]?.delta?.content;
    if (typeof deltaText === 'string') return deltaText.trim();
    return '';
  }

  const text = data.trim();
  if (!text) return '';
  if (!text.startsWith('data:')) {
    try {
      return extractOpenAICompatibleText(JSON.parse(text));
    } catch {
      return text;
    }
  }

  let out = '';
  for (const line of text.split(/\r?\n/)) {
    const payload = line.trim().replace(/^data:\s*/, '');
    if (!payload || payload === '[DONE]') continue;
    try {
      const chunk = JSON.parse(payload);
      out += chunk?.choices?.[0]?.delta?.content || chunk?.choices?.[0]?.message?.content || '';
    } catch {}
  }
  return out.trim();
}

function buildVisionUserMessage(prompt, imageDataUrl, imageText = 'Read the image and answer accurately.') {
  if (!imageDataUrl) return { role: 'user', content: prompt };
  return {
    role: 'user',
    content: [
      { type: 'text', text: `${prompt}\n\n${imageText}` },
      { type: 'image_url', image_url: { url: imageDataUrl } },
    ],
  };
}

async function callProvider(provider, messages, options = {}) {
  const config = getProviderConfig(provider);
  if (!config.baseUrl || !config.apiKey) throw new Error(`${provider.toUpperCase()}_NOT_CONFIGURED`);
  const startedAt = Date.now();
  const model = options.model || config.model;

  const response = await axios.post(
    getChatCompletionsUrl(config.baseUrl),
    {
      model,
      messages,
      max_tokens: options.maxTokens || MOLI.maxTokens || BEE.petChatMaxTokens || 3000,
      temperature: options.temperature ?? 0.35,
    },
    {
      timeout: Math.min(options.timeout || config.timeout || 45000, 45000),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
    },
  );

  const text = extractOpenAICompatibleText(response.data);
  if (!text) throw new Error(`${provider.toUpperCase()}_EMPTY_RESPONSE`);
  aiUsageService.logUsageFromResponse(response.data, {
    provider,
    model,
    feature: options.feature || 'moli_pet',
    durationMs: Date.now() - startedAt,
  });
  return { text, model, provider };
}

async function callMoliMessages(messages, options = {}) {
  const primary = String(MOLI.provider || '9router').trim().toLowerCase();
  const fallback = String(MOLI.fallbackProvider || 'beeknoee').trim().toLowerCase();
  const providers = [...new Set([primary, fallback].filter(value => ['9router', 'beeknoee'].includes(value)))];
  let lastError = null;

  for (const provider of providers) {
    try {
      return await callProvider(provider, messages, options);
    } catch (error) {
      lastError = error;
      console.warn(`Moli pet AI ${provider} failed:`, error.message);
    }
  }

  throw lastError || new Error('MOLI_PET_AI_FAILED');
}

async function callProviderStream(provider, messages, options = {}, onDelta) {
  const config = getProviderConfig(provider);
  if (!config.baseUrl || !config.apiKey) throw new Error(`${provider.toUpperCase()}_NOT_CONFIGURED`);
  const startedAt = Date.now();
  const model = options.model || config.model;
  let emittedText = false;

  try {
    const response = await axios.post(
      getChatCompletionsUrl(config.baseUrl),
      {
        model,
        messages,
        max_tokens: options.maxTokens || MOLI.maxTokens || BEE.petChatMaxTokens || 3000,
        temperature: options.temperature ?? 0.35,
        stream: true,
      },
      {
        timeout: Math.min(options.timeout || config.timeout || 45000, 45000),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        responseType: 'stream',
      },
    );

    const result = await new Promise((resolve, reject) => {
      let buffer = '';
      let rawResponse = '';
      let fullText = '';
      let usage = null;
      let settled = false;

      const rejectOnce = (error) => {
        if (settled) return;
        settled = true;
        error.moliStreamStarted = emittedText;
        reject(error);
      };
      const pushText = (value) => {
        const text = typeof value === 'string' ? value : '';
        if (!text) return;
        emittedText = true;
        fullText += text;
        onDelta(text);
      };
      const processLine = (line) => {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) return;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') return;
        try {
          const chunk = JSON.parse(payload);
          if (chunk?.error) {
            throw new Error(typeof chunk.error === 'string' ? chunk.error : chunk.error.message || 'MOLI_PET_STREAM_FAILED');
          }
          usage = chunk?.usage || usage;
          pushText(chunk?.choices?.[0]?.delta?.content || chunk?.choices?.[0]?.message?.content || '');
        } catch (error) {
          if (error instanceof SyntaxError) return;
          throw error;
        }
      };

      response.data.on('data', (chunk) => {
        if (settled) return;
        try {
          const text = chunk.toString('utf8');
          rawResponse += text;
          buffer += text;
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || '';
          lines.forEach(processLine);
        } catch (error) {
          response.data.destroy();
          rejectOnce(error);
        }
      });
      response.data.on('end', () => {
        if (settled) return;
        try {
          if (buffer) processLine(buffer);
          if (!fullText) pushText(extractOpenAICompatibleText(rawResponse));
          if (!fullText) throw new Error(`${provider.toUpperCase()}_EMPTY_RESPONSE`);
          settled = true;
          resolve({ text: fullText, usage });
        } catch (error) {
          rejectOnce(error);
        }
      });
      response.data.on('error', rejectOnce);
    });

    if (result.usage) {
      aiUsageService.logUsageFromResponse({ usage: result.usage }, {
        provider,
        model,
        feature: options.feature || 'moli_pet',
        durationMs: Date.now() - startedAt,
      });
    }
    return { text: result.text, model, provider };
  } catch (error) {
    error.moliStreamStarted = error.moliStreamStarted || emittedText;
    throw error;
  }
}

async function callMoliMessagesStream(messages, options = {}, onDelta) {
  const primary = String(MOLI.provider || '9router').trim().toLowerCase();
  const fallback = String(MOLI.fallbackProvider || 'beeknoee').trim().toLowerCase();
  const providers = [...new Set([primary, fallback].filter(value => ['9router', 'beeknoee'].includes(value)))];
  let lastError = null;

  for (const provider of providers) {
    try {
      return await callProviderStream(provider, messages, options, onDelta);
    } catch (error) {
      lastError = error;
      console.warn(`Moli pet AI ${provider} stream failed:`, error.message);
      if (error.moliStreamStarted) throw error;
    }
  }

  throw lastError || new Error('MOLI_PET_AI_FAILED');
}

function buildConversationHistoryContext(history = []) {
  if (!Array.isArray(history) || !history.length) return '';
  return history
    .slice(-6)
    .map(item => {
      const role = item.role === 'assistant' ? 'Moly' : 'User';
      const content = String(item.content || item.message || '').trim().slice(0, 260);
      return content ? `${role}: ${content}` : '';
    })
    .filter(Boolean)
    .join('\n');
}

function pickStable(items, seedText = '') {
  if (!Array.isArray(items) || !items.length) return '';
  const seed = String(seedText || '')
    .split('')
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return items[seed % items.length];
}

function buildMoliStyleCue(message, context = {}) {
  const pageType = String(context.pageType || '').toLowerCase();
  const seedText = `${message || ''}|${context.page || ''}|${Date.now().toString().slice(0, -4)}`;
  const opener = pickStable([
    'Vào thẳng ý chính, thêm một nét mềm ở cuối.',
    'Nói như đang ngồi cạnh bạn học, không đọc kịch bản.',
    'Mở đầu bằng chi tiết cụ thể trong câu hỏi của user.',
    'Nếu user đang rối, trấn an một câu ngắn rồi giải.',
  ], seedText);
  const cuteLevel = pageType.includes('exam') || pageType.includes('thi')
    ? 'cute nhẹ, ưu tiên rõ đáp án và bước làm'
    : pickStable(['cute nhỏ xíu', 'ấm áp gọn', 'tươi nhưng không nhí nhảnh'], seedText);

  return `- Nhịp lượt này: ${opener}
- Độ cute: ${cuteLevel}; được dùng "nè", "nhé", "xíu" vừa phải, không spam.
- Không dùng opener/câu chốt rập khuôn như "Mình hiểu rồi", "Bạn cần hỗ trợ gì thêm?", "Hy vọng giúp được bạn".
- Tránh trả lời y chang format cũ. Nếu câu hỏi đơn giản thì 2-4 câu tự nhiên; nếu bài khó mới chia bước.
- Mỗi câu trả lời phải bám ít nhất 1 chi tiết thật từ lời user, trang hiện tại, môn học hoặc ảnh đính kèm.`;
}

function sanitizeMoliPetAnswer(text) {
  return String(text || '')
    .replace(/^\s*(với vai trò là|là một|as an)\s+(ai|mô hình|trợ lý)[^\n.?!]*[.?!]\s*/i, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildMoliPetPrompt(message, context = {}) {
  const {
    petName = 'Moly',
    userName = '',
    page = '/',
    pageType = '',
    subject = '',
    routeHint = '',
    localTime = '',
    mood = 'friendly',
    conversationHistory = [],
  } = context;
  const history = buildConversationHistoryContext(conversationHistory);
  const styleCue = buildMoliStyleCue(message, context);

  return `Bạn là ${petName}, một pet học tập cực dễ thương của CSCA MOLI.STUDIO.
Trả lời bằng tiếng Việt có dấu, tự nhiên, thông minh, ấm áp, ngắn gọn và chính xác.

Tính cách:
Phong cách lần này:
${styleCue}

${AI_ACCURACY_PROMPT_RULES}
- Xưng hô mình/bạn, có thể thêm một câu hỏi thăm nhẹ nếu hợp ngữ cảnh.
- Nói như bạn đồng hành nhỏ: đáng yêu nhưng không nhảm nhí, không làm màu quá đà.
- Biết bám vào môn học/trang hiện tại để gợi ý đúng việc user đang làm.
- Nếu user hỏi bài tập: tóm tắt ý chính, giải từng bước ngắn, chỉ ra lỗi hay sai, và nếu thiếu dữ kiện thì hỏi lại.
- Nếu user hỏi từ vựng/tiếng Trung: có nghĩa, pinyin nếu cần, ví dụ ngắn, mẹo nhớ.
- Nếu user hỏi kế hoạch học: đưa 2-4 việc cụ thể có thể làm ngay.
- Nếu user hỏi ngoài học tập: trả lời lịch sự, ngắn gọn, an toàn.
- Không nói mình là AI model. Không nhắc quota/model/key.
- Không bịa điểm số, lỗi sai, hồ sơ, hoặc dữ liệu riêng nếu không có trong ngữ cảnh.

Giới hạn:
- Mặc định 3-6 câu. Nếu giải bài hoặc giải thích chi tiết, được dùng 8-12 câu với các bước rõ ràng.
- Không dùng markdown phức tạp; được dùng bullet ngắn khi cần.
- Nếu câu trả lời có đáp án số/cú pháp, đặt đáp án cuối cùng thật rõ ở câu đầu hoặc câu cuối.
- LUÔN hoàn thành câu trả lời đầy đủ, không bao giờ dừng giữa chừng.

Ngữ cảnh:
- Tên user: ${userName || 'bạn'}
- Trang hiện tại: ${page || '/'}
- Loại trang: ${pageType || 'học tập chung'}
- Môn học: ${subject || '(chưa rõ)'}
- Gợi ý UI hiện tại: ${routeHint || '(không có)'}
- Giờ địa phương user: ${localTime || '(không rõ)'}
- Tâm trạng pet: ${mood || 'friendly'}
- Lịch sử gần đây:
${history || '(không có)'}

User nói: ${message}`;
}

async function askMoliPet(message, context = {}) {
  const prompt = buildMoliPetPrompt(message, context);
  try {
    const result = await callMoliMessages(
      [buildVisionUserMessage(prompt, context.imageDataUrl, 'User pasted an image into MolyPet chat. Read the image carefully. Answer naturally, cutely but not in a template, and keep every academic detail accurate.')],
      {
        temperature: 0.58,
        maxTokens: 3000,
      },
    );
    return {
      answer: sanitizeMoliPetAnswer(result.text),
      model: result.model,
      provider: result.provider,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return {
      answer: 'Moly đang hơi mệt xíu. Bạn chờ mình một chút rồi nói tiếp nhé.',
      timestamp: new Date().toISOString(),
      error: true,
    };
  }
}

async function streamMoliPet(message, context = {}, onDelta) {
  const prompt = buildMoliPetPrompt(message, context);
  return callMoliMessagesStream(
    [buildVisionUserMessage(prompt, context.imageDataUrl, 'User pasted an image into MolyPet chat. Read the image carefully. Answer naturally, cutely but not in a template, and keep every academic detail accurate.')],
    {
      temperature: 0.58,
      maxTokens: 3000,
    },
    onDelta,
  );
}

function getDailyGiftFallback(giftDate = '') {
  const seed = String(giftDate || new Date().toISOString().slice(0, 10))
    .split('')
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const titles = ['Lá thư nhỏ cho ngày học mới', 'Gói năng lượng pastel đã tới', 'Hộp quà học tập từ Moly', 'Một chút may mắn cho hôm nay'];
  const encouragements = [
    'Hôm nay bạn chỉ cần hiểu thêm một ý nhỏ, sửa một lỗi sai, hoặc học thêm vài từ mới là đã có tiến bộ rồi. Hành trình CSCA không cần lúc nào cũng bùng nổ; quan trọng là mình quay lại bàn học đều đặn. Moly tin những bước nhỏ đang âm thầm gom thành một phiên bản tự tin hơn của bạn.',
    'Mỗi phiên học ngắn đều đang cộng thêm một viên gạch cho mục tiêu CSCA của bạn. Nếu hôm nay chưa thấy mình giỏi lên ngay, cũng không sao, vì não cần thời gian để xếp lại kiến thức. Cứ đi chậm, chắc, và giữ nhịp học tử tế với bản thân nhé.',
    'Nếu não hơi đầy, hãy bắt đầu bằng phần dễ nhất và giữ nhịp 15-20 phút thôi. Một câu đúng, một dòng ghi chú rõ, một lỗi cũ được sửa cũng đáng được tính là chiến thắng. Bạn không cần hoàn hảo hôm nay, chỉ cần không bỏ rơi mục tiêu của mình.',
    'CSCA là hành trình gồm ngôn ngữ, Toán, tư duy và thói quen học đều. Mình nhặt từng mảnh nhỏ là đủ: một công thức, một cấu trúc câu, một mẹo suy luận. Moly ở đây để nhắc bạn rằng tiến bộ thật thường đến rất lặng, nhưng đến rất chắc.',
  ];
  const reminders = [
    'Chọn 1 mục tiêu nhỏ, học 20 phút thật gọn rồi đánh dấu hoàn thành nhé. Nếu còn sức, làm thêm 1 câu ôn lại là đẹp.',
    'Ôn lại 5 từ hoặc 1 dạng bài vừa sai để lỗi cũ không lặp lại. Học ít nhưng trúng chỗ yếu sẽ lời hơn học lan man.',
    'Làm một câu dễ trước để khởi động, sau đó mới đến phần khó hơn. Đừng quên ghi lại lý do mình sai nếu có.',
    'Uống nước, mở bài học, và cho bản thân một lượt tập trung không bị chen ngang. Moly canh tinh thần cho bạn nè.',
  ];
  const blessings = [
    'Chúc bạn gặp đúng dạng bài mình đã ôn và giữ cái đầu thật sáng. Hôm nay cứ bình tĩnh, bạn làm được nhiều hơn bạn nghĩ.',
    'Chúc bạn học đâu nhớ đó, làm bài bình tĩnh và thêm tự tin. Một chút may mắn mềm mại đang được Moly gói sẵn cho bạn.',
    'Chúc hôm nay nhẹ nhàng, có tiến bộ nhỏ và nhiều động lực hơn hôm qua. Điểm sáng bé xíu cũng là điểm sáng.',
    'Chúc bạn gom đủ năng lượng, đủ kiên nhẫn và đủ may mắn cho buổi học này. Moly tin ngày hôm nay sẽ có điều đáng khen.',
  ];

  return {
    title: titles[seed % titles.length],
    greeting: 'Gửi bạn học viên chăm chỉ,',
    encouragement: encouragements[seed % encouragements.length],
    study_reminder: reminders[(seed + 1) % reminders.length],
    blessing: blessings[(seed + 2) % blessings.length],
    mood: ['sparkly', 'soft', 'focus', 'lucky'][seed % 4],
    source_model: 'fallback',
    raw_payload: { fallback: true, giftDate },
  };
}

function parseAIMaybeJSON(text) {
  try {
    return JSON.parse(text);
  } catch {}
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function normalizeDailyGiftLetter(value, giftDate) {
  const fallback = getDailyGiftFallback(giftDate);
  const safe = value && typeof value === 'object' ? value : {};
  const asString = (item, fallbackValue = '') => String(item || fallbackValue || '').trim();
  return {
    title: asString(safe.title, fallback.title).slice(0, 140),
    greeting: asString(safe.greeting, fallback.greeting).slice(0, 180),
    encouragement: asString(safe.encouragement, fallback.encouragement).slice(0, 700),
    study_reminder: asString(safe.study_reminder || safe.studyReminder, fallback.study_reminder).slice(0, 280),
    blessing: asString(safe.blessing, fallback.blessing).slice(0, 240),
    mood: asString(safe.mood, fallback.mood).slice(0, 60),
  };
}

function buildDailyGiftLetterPrompt(giftDate, recentLetters = []) {
  const recentContext = recentLetters.length
    ? recentLetters.map((item, index) => `${index + 1}. ${item.title || ''} | ${item.encouragement || ''} | ${item.study_reminder || ''}`).join('\n')
    : '(chưa có thư gần đây)';

  return `Bạn là Moly, pet học tập của CSCA MOLI.STUDIO.
Hãy viết một Daily Gift Letter bằng tiếng Việt có dấu cho học viên ôn thi CSCA.

Yêu cầu:
- Bắt buộc dùng tiếng Việt có đầy đủ dấu. Không viết tiếng Việt không dấu.
- Giọng văn cute, ấm áp, thông minh, sạch và dễ thương nhưng không trẻ con quá.
- Nói về hành trình CSCA, ngôn ngữ/tiếng Trung, Toán, tư duy logic, và thói quen học đều.
- Không hứa điểm cao, không bịa số liệu học viên, lịch thi, học bổng, giá khóa học, hồ sơ riêng.
- Không nhắc mình là AI/model/API.
- Không dùng markdown.
- Nội dung phải đủ đầy, không trả lời cụt.

Ngày sinh nội dung: ${giftDate}
Thư gần đây cần tránh trùng lặp:
${recentContext}

Trả về JSON hợp lệ duy nhất, đúng schema:
{
  "title": "tiêu đề cute tối đa 10 từ, có dấu",
  "greeting": "lời chào chung, chưa cần tên riêng, có dấu",
  "encouragement": "đoạn động viên 3-4 câu đầy đặn về CSCA/ngôn ngữ/Toán, cute và không trùng lặp",
  "study_reminder": "1-2 câu nhắc học nhẹ nhàng hôm nay, có hành động cụ thể",
  "blessing": "1-2 câu chúc may mắn ấm áp, có dấu",
  "mood": "sparkly|soft|focus|lucky"
}`;
}

async function generateDailyGiftLetter(giftDate, context = {}) {
  const prompt = buildDailyGiftLetterPrompt(giftDate, context.recentLetters || []);
  try {
    const result = await callMoliMessages([{ role: 'user', content: prompt }], {
      temperature: 0.72,
      maxTokens: 1600,
    });
    const parsed = parseAIMaybeJSON(result.text);
    const letter = normalizeDailyGiftLetter(parsed, giftDate);
    if (!parsed) {
      return {
        ...letter,
        source_model: 'fallback',
        raw_payload: {
          fallback: true,
          failed_model: result.model,
          raw: String(result.text || '').slice(0, 1200),
        },
      };
    }
    return {
      ...letter,
      source_model: result.model,
      raw_payload: parsed || { raw: String(result.text || '').slice(0, 1200) },
    };
  } catch (err) {
    const fallback = getDailyGiftFallback(giftDate);
    return {
      ...fallback,
      raw_payload: {
        ...fallback.raw_payload,
        error: err.message || 'DAILY_GIFT_GENERATION_FAILED',
      },
    };
  }
}

module.exports = {
  askMoliPet,
  streamMoliPet,
  generateDailyGiftLetter,
  getDailyGiftFallback,
};
