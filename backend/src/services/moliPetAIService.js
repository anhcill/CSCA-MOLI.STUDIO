const axios = require('axios');
const aiConfig = require('../config/aiConfig');

const BEE = aiConfig.beeknoee;
const ADMIN_EXAM_AI = aiConfig.adminExam || {};
const MOLI = aiConfig.moliPet || {};

let beeknoeeKeyIndex = 0;
let nineRouterKeyIndex = 0;

const AI_ACCURACY_PROMPT_RULES = `- Doc ky de goc, dap an va ngu canh truoc khi suy luan.
- Giu nguyen ky hieu toan/logic va dieu kien trong de: <, <=, <=, >, >=, >=, =, !=, in, not in, union, intersection, empty set, |.
- Khong doi <= thanh <, >= thanh >, khong doi dau am, so mu, chi so, mien xac dinh, tap nghiem hoac dap an.
- Voi cau Toan/Khoa hoc, doi chieu lai dieu kien goc va cac lua chon truoc khi ket luan.
- Neu thieu du kien, thieu hinh/bang/bieu do hoac dap an khong khop du lieu, noi ro phan thieu; khong doan.`;

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

  const response = await axios.post(
    getChatCompletionsUrl(config.baseUrl),
    {
      model: options.model || config.model,
      messages,
      max_tokens: options.maxTokens || MOLI.maxTokens || BEE.petChatMaxTokens || 700,
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
  return { text, model: options.model || config.model, provider };
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

  return `Ban la ${petName}, mot pet hoc tap cuc de thuong cua CSCA MOLI.STUDIO.
Tra loi bang tieng Viet co dau, tu nhien, thong minh, am ap, ngan gon va chinh xac.

Tinh cach:
${AI_ACCURACY_PROMPT_RULES}
- Xung ho minh/ban, co the them mot cau hoi tham nhe neu hop ngu canh.
- Noi nhu ban dong hanh nho: dang yeu nhung khong nham nhi, khong lam mau qua da.
- Biet bam vao mon hoc/trang hien tai de goi y dung viec user dang lam.
- Neu user hoi bai tap: tom tat y chinh, giai tung buoc ngan, chi ra loi hay sai, va neu thieu du kien thi hoi lai.
- Neu user hoi tu vung/tieng Trung: co nghia, pinyin neu can, vi du ngan, meo nho.
- Neu user hoi ke hoach hoc: dua 2-4 viec cu the co the lam ngay.
- Neu user hoi ngoai hoc tap: tra loi lich su, ngan gon, an toan.
- Khong noi minh la AI model. Khong nhac quota/model/key.
- Khong bia diem so, loi sai, ho so, hoac du lieu rieng neu khong co trong ngu canh.

Gioi han:
- Mac dinh toi da 5 cau ngan. Neu can giai bai, dung cac buoc 1-3 ngan gon.
- Khong dung markdown phuc tap; duoc dung bullet ngan khi can.
- Neu cau tra loi co dap an so/cu phap, dat dap an cuoi cung that ro o cau dau hoac cau cuoi.

Ngu canh:
- Ten user: ${userName || 'ban'}
- Trang hien tai: ${page || '/'}
- Loai trang: ${pageType || 'hoc tap chung'}
- Mon hoc: ${subject || '(chua ro)'}
- Goi y UI hien tai: ${routeHint || '(khong co)'}
- Gio dia phuong user: ${localTime || '(khong ro)'}
- Tam trang pet: ${mood || 'friendly'}
- Lich su gan day:
${history || '(khong co)'}

User noi: ${message}`;
}

async function askMoliPet(message, context = {}) {
  const prompt = buildMoliPetPrompt(message, context);
  try {
    const result = await callMoliMessages(
      [buildVisionUserMessage(prompt, context.imageDataUrl, 'User pasted an image into MolyPet chat. Read the image and answer warmly, briefly, and accurately.')],
      {
        temperature: 0.35,
        maxTokens: Math.min(MOLI.maxTokens || BEE.petChatMaxTokens || 700, 900),
      },
    );
    return {
      answer: result.text,
      model: result.model,
      provider: result.provider,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return {
      answer: 'Moly dang hoi met xiu. Ban cho minh mot chut roi noi tiep nhe.',
      timestamp: new Date().toISOString(),
      error: true,
    };
  }
}

function getDailyGiftFallback(giftDate = '') {
  const seed = String(giftDate || new Date().toISOString().slice(0, 10))
    .split('')
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const titles = ['La thu nho cho ngay hoc moi', 'Goi nang luong pastel da toi', 'Hop qua hoc tap tu Moly', 'Mot chut may man cho hom nay'];
  const encouragements = [
    'Hom nay ban chi can hieu them mot y nho, sua mot loi sai, hoac hoc them vai tu moi la da co tien bo.',
    'Moi phien hoc ngan deu dang cong them mot vien gach cho muc tieu CSCA cua ban.',
    'Neu nao hoi day, hay bat dau bang phan de nhat va giu nhip 15-20 phut thoi.',
    'CSCA la hanh trinh gom ngon ngu, Toan, tu duy va thoi quen. Minh nhat tung manh nho la du.',
  ];
  const reminders = [
    'Chon 1 muc tieu nho, hoc 20 phut that gon roi danh dau hoan thanh nhe.',
    'On lai 5 tu hoac 1 dang bai vua sai de loi cu khong lap lai.',
    'Lam mot cau de truoc de khoi dong, sau do moi den phan kho hon.',
    'Uong nuoc, mo bai hoc, va cho ban than mot luot tap trung khong bi chen ngang.',
  ];
  const blessings = [
    'Chuc ban gap dung dang bai minh da on va giu cai dau that sang.',
    'Chuc ban hoc dau nho do, lam bai binh tinh va them tu tin.',
    'Chuc hom nay nhe nhang, co tien bo nho va nhieu dong luc hon hom qua.',
    'Chuc ban gom du nang luong, du kien nhan va du may man cho buoi hoc nay.',
  ];

  return {
    title: titles[seed % titles.length],
    greeting: 'Gui ban hoc vien cham chi,',
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
    : '(chua co thu gan day)';

  return `Ban la Moly, pet hoc tap cua CSCA MOLI.STUDIO.
Hay viet mot Daily Gift Letter bang tieng Viet co dau cho hoc vien on thi CSCA.

Yeu cau:
- Giong van cute, am ap, thong minh, sach va de thuong nhung khong tre con qua.
- Noi ve hanh trinh CSCA, ngon ngu/tieng Trung, Toan, tu duy logic, va thoi quen hoc deu.
- Khong hua diem cao, khong bia so lieu hoc vien, lich thi, hoc bong, gia khoa hoc, ho so rieng.
- Khong nhac minh la AI/model/API.
- Khong dung markdown.
- Do dai vua phai.

Ngay sinh noi dung: ${giftDate}
Thu gan day can tranh trung lap:
${recentContext}

Tra ve JSON hop le duy nhat, dung schema:
{
  "title": "tieu de cute toi da 10 tu",
  "greeting": "loi chao chung, chua can ten rieng",
  "encouragement": "doan dong vien 3-4 cau ve CSCA/ngon ngu/Toan, cute va khong trung lap",
  "study_reminder": "mot cau nhac hoc nhe nhang hom nay",
  "blessing": "mot cau chuc may man",
  "mood": "sparkly|soft|focus|lucky"
}`;
}

async function generateDailyGiftLetter(giftDate, context = {}) {
  const prompt = buildDailyGiftLetterPrompt(giftDate, context.recentLetters || []);
  try {
    const result = await callMoliMessages([{ role: 'user', content: prompt }], {
      temperature: 0.72,
      maxTokens: 650,
    });
    const parsed = parseAIMaybeJSON(result.text);
    const letter = normalizeDailyGiftLetter(parsed, giftDate);
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
  generateDailyGiftLetter,
  getDailyGiftFallback,
};
