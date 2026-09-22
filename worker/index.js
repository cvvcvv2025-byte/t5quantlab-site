const MODEL = '@cf/google/gemma-4-26b-a4b-it';

const REQUIRED_KEYS = [
  'summary','main_error_tag','confidence','context','location','reaction','entry','management',
  'evidence','limitations','corrective_rule','training_focus','training_type'
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(binary);
}

function cleanText(value, max = 300) {
  return String(value ?? '').trim().slice(0, max);
}

function inferSide(entry, sl, tp) {
  const e = Number(entry), s = Number(sl), t = Number(tp);
  if (![e, s, t].every(Number.isFinite)) return null;
  if (s < e && t > e) return 'Buy';
  if (s > e && t < e) return 'Sell';
  return 'Invalid';
}

function looksLikeReview(value) {
  return !!(value && typeof value === 'object' && !Array.isArray(value) &&
    typeof value.summary === 'string' &&
    value.context && value.location && value.reaction && value.entry && value.management);
}

function parseJsonString(text) {
  if (typeof text !== 'string') return null;
  let cleaned = text.trim()
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first >= 0 && last > first) cleaned = cleaned.slice(first, last + 1);

  try { return JSON.parse(cleaned); } catch { return null; }
}

function extractReview(value, depth = 0) {
  if (depth > 8 || value == null) return null;
  if (looksLikeReview(value)) return value;

  if (typeof value === 'string') {
    const parsed = parseJsonString(value);
    return parsed ? extractReview(parsed, depth + 1) : null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extractReview(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  if (typeof value === 'object') {
    const preferred = [
      value.response,
      value.result,
      value.output,
      value.output_text,
      value.content,
      value.message,
      value.choices?.[0]?.message,
      value.choices?.[0]?.message?.content,
      value.choices?.[0]?.text,
      value.data
    ];
    for (const candidate of preferred) {
      const found = extractReview(candidate, depth + 1);
      if (found) return found;
    }
    for (const candidate of Object.values(value)) {
      const found = extractReview(candidate, depth + 1);
      if (found) return found;
    }
  }

  return null;
}

function validateReview(review) {
  if (!looksLikeReview(review)) throw new Error('AI returned data, but not a usable review object');
  for (const key of REQUIRED_KEYS) {
    if (!(key in review)) throw new Error(`AI review missing field: ${key}`);
  }
  for (const key of ['context','location','reaction','entry','management']) {
    if (!review[key] || typeof review[key].status !== 'string' || typeof review[key].note !== 'string') {
      throw new Error(`AI review has invalid section: ${key}`);
    }
  }
  if (!Array.isArray(review.evidence) || !Array.isArray(review.limitations)) {
    throw new Error('AI review evidence/limitations format is invalid');
  }
  return review;
}

async function reviewTrade(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!env.AI) return json({ error: 'AI binding is not available in this deployment.' }, 503);

  const form = await request.formData();
  const image = form.get('image');
  const entry = cleanText(form.get('entry'), 40);
  const sl = cleanText(form.get('sl'), 40);
  const tp = cleanText(form.get('tp'), 40);
  const side = inferSide(entry, sl, tp);

  if (!(image instanceof File) || !image.type.startsWith('image/')) {
    return json({ error: '请上传 PNG / JPG 交易截图。' }, 400);
  }
  if (!entry || !sl || !tp) return json({ error: 'Entry、SL、TP 为必填项。' }, 400);
  if (side === 'Invalid') {
    return json({ error: 'Entry / SL / TP 价格关系不成立。Buy 应为 SL < Entry < TP；Sell 应为 TP < Entry < SL。' }, 400);
  }
  if (!side) return json({ error: 'Entry、SL、TP 请输入有效数字。' }, 400);
  if (image.size > 10 * 1024 * 1024) return json({ error: '截图超过 10MB，请压缩后重试。' }, 413);

  const bytes = new Uint8Array(await image.arrayBuffer());
  const dataUrl = `data:${image.type};base64,${bytesToBase64(bytes)}`;

  const system = `你是 T5 Quant Lab 的交易复盘引擎。任务是复盘用户已经提交的一笔交易决策，而不是预测未来行情。\n\n硬规则：\n1. 只能使用截图中可见的信息和用户明确填写的 Entry、SL、TP。看不到的周期、未来K线、新闻背景都不得猜测。\n2. 交易方向由价格关系推断：Buy = SL < Entry < TP；Sell = TP < Entry < SL。\n3. 用户没有填写入场日期时间。如果截图没有清晰标出入场时刻，Entry Timing 必须写“信息不足”或降低置信度，绝不能把截图右侧后来出现的K线当成入场前证据。\n4. 盈亏结果不能反推当时决策是否正确。重点拆分 Context、Location、Reaction、Entry、Management。\n5. 信息不足时必须明确写“信息不足”，不要补全隐藏背景。\n6. 禁止给出“现在买/卖”、未来涨跌预测、保证收益或胜率承诺。\n7. 输出要短、具体、可复核。优先指出最主要的一类错误；如果没有足够证据判定错误，main_error_tag 使用 INSUFFICIENT_CONTEXT。\n8. corrective_rule 必须写成下一次可以执行的规则，而不是“耐心”“控制情绪”这类空话。\n9. 只输出一个有效 JSON 对象，不要 Markdown，不要代码块，不要解释 JSON。`;

  const userText = `请复盘这笔交易。\n用户填写：\n- 推断方向：${side}\n- Entry：${entry}\n- Stop Loss：${sl}\n- Take Profit：${tp}\n- 入场时间：未提供\n\n先认真读取随请求提供的交易截图。截图是主要证据。请先判断截图里实际能看见哪些结构、区间、流动性位置、价格反应和 Entry/SL/TP 相对位置。若无法确定哪些K线属于入场前，必须明确限制，不要用事后走势反推。\n\n严格输出以下 JSON 结构：\n{\n  "summary":"一句话结论",\n  "main_error_tag":"EARLY_ENTRY 或 MID_RANGE_ENTRY 或 HTF_CONFLICT 或 NO_RECLAIM 或 SL_TOO_TIGHT 或 TARGET_MISMATCH 或 INSUFFICIENT_CONTEXT 等",\n  "confidence":"高|中|低",\n  "context":{"status":"通过|可接受|未通过|信息不足","note":"..."},\n  "location":{"status":"通过|可接受|未通过|信息不足","note":"..."},\n  "reaction":{"status":"通过|可接受|未通过|信息不足","note":"..."},\n  "entry":{"status":"通过|可接受|未通过|信息不足","note":"..."},\n  "management":{"status":"通过|可接受|未通过|信息不足","note":"..."},\n  "evidence":["截图里能直接指出的证据1","截图里能直接指出的证据2"],\n  "limitations":["截图无法支持的判断1"],\n  "corrective_rule":"如果重来一次，具体应满足什么条件再执行",\n  "training_focus":"下一轮最值得训练的一件事",\n  "training_type":"liquidity|structure|entry|management|context|other"\n}`;

  // Cloudflare's documented Workers AI vision pattern passes the image as the
  // top-level `image` field. The previous implementation used an OpenAI-style
  // image_url part inside messages, which was not reliably reaching the vision encoder.
  const result = await env.AI.run(
    MODEL,
    {
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userText }
      ],
      image: dataUrl,
      temperature: 0.1,
      max_tokens: 1200
    },
    { rejectIfBusy: true }
  );

  const extracted = extractReview(result);
  if (!extracted) {
    console.error('T5 review unrecognized AI envelope', JSON.stringify(result).slice(0, 4000));
    throw new Error('模型已返回内容，但无法解析为复盘结果');
  }

  const review = validateReview(extracted);
  return json({ review, side, model: MODEL });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/review') return await reviewTrade(request, env);
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error('T5 review error', error);
      const detail = String(error?.message || error);
      if (/busy|capacity|429|3040/i.test(detail)) {
        return json({ error: 'AI 当前繁忙，没有让你一直空等。请稍后再点一次生成复盘。', detail }, 503);
      }
      return json({
        error: '复盘生成失败：模型没有返回可用的结构化结果。',
        detail
      }, 500);
    }
  }
};