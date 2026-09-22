const MODEL = '@cf/qwen/qwen3.8-27b';

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    main_error_tag: { type: 'string' },
    confidence: { type: 'string', enum: ['高', '中', '低'] },
    context: { type: 'object', properties: { status: { type: 'string', enum: ['通过', '可接受', '未通过', '信息不足'] }, note: { type: 'string' } }, required: ['status', 'note'] },
    location: { type: 'object', properties: { status: { type: 'string', enum: ['通过', '可接受', '未通过', '信息不足'] }, note: { type: 'string' } }, required: ['status', 'note'] },
    reaction: { type: 'object', properties: { status: { type: 'string', enum: ['通过', '可接受', '未通过', '信息不足'] }, note: { type: 'string' } }, required: ['status', 'note'] },
    entry: { type: 'object', properties: { status: { type: 'string', enum: ['通过', '可接受', '未通过', '信息不足'] }, note: { type: 'string' } }, required: ['status', 'note'] },
    management: { type: 'object', properties: { status: { type: 'string', enum: ['通过', '可接受', '未通过', '信息不足'] }, note: { type: 'string' } }, required: ['status', 'note'] },
    evidence: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 6 },
    limitations: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 5 },
    corrective_rule: { type: 'string' },
    training_focus: { type: 'string' },
    training_type: { type: 'string', enum: ['liquidity', 'structure', 'entry', 'management', 'context', 'other'] }
  },
  required: ['summary', 'main_error_tag', 'confidence', 'context', 'location', 'reaction', 'entry', 'management', 'evidence', 'limitations', 'corrective_rule', 'training_focus', 'training_type']
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  return btoa(binary);
}

function cleanText(value, max = 300) { return String(value ?? '').trim().slice(0, max); }

function parseModelPayload(result) {
  let value = result?.response ?? result?.result?.response ?? result?.choices?.[0]?.message?.content ?? result?.result ?? result;
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') throw new Error('AI response format was not recognized');
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

function inferSide(entry, sl, tp) {
  const e=Number(entry), s=Number(sl), t=Number(tp);
  if (![e,s,t].every(Number.isFinite)) return null;
  if (s < e && t > e) return 'Buy';
  if (s > e && t < e) return 'Sell';
  return 'Invalid';
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

  if (!(image instanceof File) || !image.type.startsWith('image/')) return json({ error: '请上传 PNG / JPG 交易截图。' }, 400);
  if (!entry || !sl || !tp) return json({ error: 'Entry、SL、TP 为必填项。' }, 400);
  if (side === 'Invalid') return json({ error: 'Entry / SL / TP 价格关系不成立。Buy 应为 SL < Entry < TP；Sell 应为 TP < Entry < SL。' }, 400);
  if (!side) return json({ error: 'Entry、SL、TP 请输入有效数字。' }, 400);
  if (image.size > 10 * 1024 * 1024) return json({ error: '截图超过 10MB，请压缩后重试。' }, 413);

  const bytes = new Uint8Array(await image.arrayBuffer());
  const dataUrl = `data:${image.type};base64,${bytesToBase64(bytes)}`;

  const system = `你是 T5 Quant Lab 的交易复盘引擎。任务是复盘用户已经提交的一笔交易决策，而不是预测未来行情。\n\n硬规则：\n1. 只能使用截图中可见的信息和用户明确填写的 Entry、SL、TP。看不到的周期、未来K线、新闻背景都不得猜测。\n2. 交易方向由价格关系推断：Buy = SL < Entry < TP；Sell = TP < Entry < SL。\n3. 用户不再填写入场日期时间。如果截图没有清晰标出入场时刻，Entry Timing 必须写“信息不足”或降低置信度，绝不能把截图右侧后来出现的K线当成入场前证据。\n4. 盈亏结果不能反推当时决策是否正确。重点拆分 Context、Location、Reaction、Entry、Management。\n5. 信息不足时必须明确写“信息不足”，不要补全隐藏背景。\n6. 禁止给出“现在买/卖”、未来涨跌预测、保证收益或胜率承诺。\n7. 输出要短、具体、可复核。优先指出最主要的一类错误；如果没有足够证据判定错误，main_error_tag 使用 INSUFFICIENT_CONTEXT。\n8. corrective_rule 必须写成下一次可以执行的规则，而不是“耐心”“控制情绪”这类空话。`;

  const userText = `请复盘这笔交易。\n用户填写：\n- 推断方向：${side}\n- Entry：${entry}\n- Stop Loss：${sl}\n- Take Profit：${tp}\n- 入场时间：未提供\n\n请先判断截图里实际能看见哪些信息。若无法确定哪些K线属于入场前，必须明确限制，不要用事后走势反推。`;

  const result = await env.AI.run(MODEL, {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: [ { type: 'image_url', image_url: { url: dataUrl } }, { type: 'text', text: userText } ] }
    ],
    reasoning_effort: 'low',
    temperature: 0.1,
    max_completion_tokens: 1200,
    response_format: { type: 'json_schema', json_schema: REVIEW_SCHEMA }
  });

  const review = parseModelPayload(result);
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
      return json({ error: '复盘暂时生成失败，请稍后重试。', detail: String(error?.message || error) }, 500);
    }
  }
};
