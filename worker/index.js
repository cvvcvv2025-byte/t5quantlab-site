const MODEL = '@cf/qwen/qwen3.8-27b';

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    main_error_tag: { type: 'string' },
    confidence: { type: 'string', enum: ['高', '中', '低'] },
    context: {
      type: 'object',
      properties: { status: { type: 'string', enum: ['通过', '可接受', '未通过', '信息不足'] }, note: { type: 'string' } },
      required: ['status', 'note']
    },
    location: {
      type: 'object',
      properties: { status: { type: 'string', enum: ['通过', '可接受', '未通过', '信息不足'] }, note: { type: 'string' } },
      required: ['status', 'note']
    },
    reaction: {
      type: 'object',
      properties: { status: { type: 'string', enum: ['通过', '可接受', '未通过', '信息不足'] }, note: { type: 'string' } },
      required: ['status', 'note']
    },
    entry: {
      type: 'object',
      properties: { status: { type: 'string', enum: ['通过', '可接受', '未通过', '信息不足'] }, note: { type: 'string' } },
      required: ['status', 'note']
    },
    management: {
      type: 'object',
      properties: { status: { type: 'string', enum: ['通过', '可接受', '未通过', '信息不足'] }, note: { type: 'string' } },
      required: ['status', 'note']
    },
    evidence: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 6 },
    limitations: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 5 },
    corrective_rule: { type: 'string' },
    training_focus: { type: 'string' },
    training_type: { type: 'string', enum: ['liquidity', 'structure', 'entry', 'management', 'context', 'other'] }
  },
  required: ['summary', 'main_error_tag', 'confidence', 'context', 'location', 'reaction', 'entry', 'management', 'evidence', 'limitations', 'corrective_rule', 'training_focus', 'training_type']
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
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

function parseModelPayload(result) {
  let value = result?.response ?? result?.result?.response ?? result?.choices?.[0]?.message?.content ?? result?.result ?? result;
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') throw new Error('AI response format was not recognized');
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

async function reviewTrade(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!env.AI) return json({ error: 'AI binding is not available in this deployment.' }, 503);

  const form = await request.formData();
  const image = form.get('image');
  const side = cleanText(form.get('side'), 10);
  const entry = cleanText(form.get('entry'), 40);
  const tradeTime = cleanText(form.get('tradeTime'), 80);
  const sltp = cleanText(form.get('sltp'), 120);

  if (!(image instanceof File) || !image.type.startsWith('image/')) return json({ error: '请上传 PNG / JPG 交易截图。' }, 400);
  if (!side || !entry || !tradeTime) return json({ error: '方向、Entry 和入场时间为必填项。' }, 400);
  if (image.size > 10 * 1024 * 1024) return json({ error: '截图超过 10MB，请压缩后重试。' }, 413);

  const bytes = new Uint8Array(await image.arrayBuffer());
  const dataUrl = `data:${image.type};base64,${bytesToBase64(bytes)}`;

  const system = `你是 T5 Quant Lab 的交易复盘引擎。任务是复盘用户已经提交的一笔交易决策，而不是预测未来行情。\n\n硬规则：\n1. 只能使用截图中可见的信息和用户明确填写的字段。看不到的周期、未来K线、成交细节、新闻背景都不得猜测。\n2. 盈亏结果不能反推当时决策是否正确。重点拆分 Context、Location、Reaction、Entry、Management。\n3. 信息不足时必须明确写“信息不足”，不要补全隐藏背景。\n4. 禁止给出“现在买/卖”、未来涨跌预测、保证收益或胜率承诺。\n5. 输出要短、具体、可复核。优先指出最主要的一类错误；如果没有足够证据判定错误，main_error_tag 使用 INSUFFICIENT_CONTEXT。\n6. 错误标签使用简短英文大写，例如 EARLY_ENTRY、MID_RANGE_ENTRY、HTF_CONFLICT、NO_RECLAIM、SL_TOO_TIGHT、TARGET_MISMATCH、INSUFFICIENT_CONTEXT。\n7. corrective_rule 必须写成下一次可以执行的规则，而不是“耐心”“控制情绪”这类空话。\n8. training_focus 必须对应这笔交易最值得训练的一个环节。`;

  const userText = `请复盘这笔交易。\n用户填写：\n- 方向：${side}\n- Entry：${entry}\n- 入场时间：${tradeTime}（用户未提供时区时，不要自行推断）\n- SL / TP：${sltp || '未提供'}\n\n请先判断截图里实际能看见哪些信息，再按结构化字段输出。`;

  const result = await env.AI.run(MODEL, {
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: dataUrl } },
          { type: 'text', text: userText }
        ]
      }
    ],
    reasoning_effort: 'low',
    temperature: 0.1,
    max_completion_tokens: 1200,
    response_format: {
      type: 'json_schema',
      json_schema: REVIEW_SCHEMA
    }
  });

  const review = parseModelPayload(result);
  return json({ review, model: MODEL });
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
