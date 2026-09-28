(()=>{
'use strict';
const MAX_BYTES=512*1024;
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cleanCode=s=>s.replace(/\/\*[\s\S]*?\*\//g,' ').replace(/\/\/.*$/gm,' ');
function count(re,s){const m=s.match(re);return m?m.length:0;}
function has(re,s){return re.test(s);}
function detectPlatform(name,code){const n=name.toLowerCase();if(n.endsWith('.mq4'))return'MT4';if(n.endsWith('.mq5'))return'MT5';if(n.endsWith('.pine'))return'TradingView';if(/#property\s+strict|OrderSend\s*\(|MarketInfo\s*\(/i.test(code))return'MT4';if(/#include\s*<Trade\/Trade\.mqh>|\bCTrade\b|PositionSelect\s*\(/i.test(code))return'MT5';if(/@version\s*=|\bstrategy\s*\(|\bindicator\s*\(|request\.security|ta\./i.test(code))return'TradingView';return'未知';}
const MODULES=[
 ['entry','入场 / 下单',/\b(OrderSend|trade\.(Buy|Sell)|PositionOpen|strategy\.(entry|order))\b/i,3],
 ['exit','退出 / 平仓',/\b(OrderClose|PositionClose|trade\.PositionClose|strategy\.close|strategy\.exit)\b/i,2],
 ['sltp','SL / TP',/\b(StopLoss|TakeProfit|stoploss|takeprofit|strategy\.exit|PositionModify|OrderModify)\b/i,2],
 ['risk','风险 / 手数',/\b(lots?|volume|risk|AccountBalance|AccountEquity|SYMBOL_VOLUME|OrderCalcMargin|OrderCalcProfit)\b/i,2],
 ['position','持仓管理',/\b(PositionSelect|PositionsTotal|OrderSelect|OrdersTotal|HistorySelect|POSITION_|ORDER_|DEAL_)\b/i,3],
 ['partial','部分平仓',/\b(PositionClosePartial|OrderClose\s*\([^,]+,[^,]+|partial|half\s*close|closepartial)\b/i,3],
 ['breakeven','保本 / BE',/\b(breakeven|break[_ ]?even|move.*(?:sl|stop).*entry|entry.*(?:sl|stop))\b/i,3],
 ['trailing','移动止损',/\b(trailing|trailstop|trail[_ ]?stop|PositionModify|OrderModify)\b/i,2],
 ['state','状态机 / 状态变量',/\b(enum\s+|state|status|phase|stage|probe|wait|armed|triggered|T1Done|runner)\b/i,4],
 ['mtf','多周期',/\b(request\.security|iTime|iOpen|iHigh|iLow|iClose|CopyRates|CopyBuffer|PERIOD_[A-Z0-9]+)\b/i,2],
 ['indicator','指标调用',/\b(iMA|iATR|iRSI|iMACD|iCustom|ta\.[A-Za-z_]+|indicator\s*\()\b/i,1],
 ['alerts','提醒 / 邮件 / 推送',/\b(Alert|SendNotification|SendMail|alertcondition|alert\s*\()\b/i,1],
 ['file','CSV / 文件写入',/\b(FileOpen|FileWrite|FileRead|FILE_CSV|csv|\.csv)\b/i,2],
 ['chart','显示 / 面板',/\b(ObjectCreate|Comment\s*\(|table\.|label\.|plot\s*\(|plotshape|line\.)\b/i,1],
 ['session','时间 / Session',/\b(TimeCurrent|TimeHour|TimeDayOfWeek|session\.|input\.session|timestamp\s*\()\b/i,1],
 ['web','Web / API',/\b(WebRequest|http[s]?:\/\/|fetch\s*\(|XMLHttpRequest)\b/i,4],
 ['dll','DLL / 外部库',/#import[^\n]*\.dll|\bLoadLibrary\b/i,5]
];
function detectModules(code){return MODULES.filter(([, ,re])=>re.test(code)).map(([key,name,,weight])=>({key,name,weight}));}
function detectHandlers(platform,code){const out=[];const defs=platform==='TradingView'?[]:['OnInit','OnDeinit','OnTick','OnTimer','OnTrade','OnTradeTransaction','start','init','deinit'];for(const h of defs)if(new RegExp('\\b'+h+'\\s*\\(','i').test(code))out.push(h);if(platform==='TradingView'){if(/\bstrategy\s*\(/i.test(code))out.push('strategy');if(/\bindicator\s*\(/i.test(code))out.push('indicator');}return out;}
function detectFunctions(platform,code){if(platform==='TradingView')return count(/^[ \t]*[A-Za-z_][A-Za-z0-9_]*\s*\([^\n]*\)\s*=>/gm,code);return count(/^[ \t]*(?:void|bool|int|double|string|datetime|long|ulong|ENUM_[A-Za-z0-9_]+|[A-Za-z_][A-Za-z0-9_<>]*)[ \t]+[A-Za-z_][A-Za-z0-9_]*\s*\([^;\n]*\)\s*\{/gm,code);}
function detectInputs(platform,code){if(platform==='TradingView')return count(/\binput\.(?:int|float|bool|string|time|timeframe|session|color|source)\b/g,code);return count(/^\s*(?:input|extern)\s+/gm,code);}
function riskFlags(platform,raw,code){const flags=[];
 const push=(level,title,detail)=>flags.push({level,title,detail});
 if(/\b(api[_-]?key|secret|password|passwd|token)\b\s*(?:=|:)/i.test(raw))push('high','疑似硬编码凭据','上传AI前应移除真实 Key / Token / Password，并改用Secret或环境配置。');
 if(/#import[^\n]*\.dll/i.test(raw))push('high','检测到 DLL 依赖','需要确认第三方库来源、部署方式和授权边界。');
 if(/\bWebRequest\s*\(|https?:\/\//i.test(code))push('medium','检测到外部网络访问','应检查发送内容、URL白名单、失败处理和是否泄露账户/源码信息。');
 if(/\b(AccountNumber|ACCOUNT_LOGIN|AccountInfoInteger\s*\(\s*ACCOUNT_LOGIN)/i.test(code))push('medium','检测到账户标识访问','分享或上传前确认没有把真实账户号写入日志或文件。');
 if(/\bwhile\s*\(\s*true\s*\)|\bfor\s*\(\s*;\s*;\s*\)/i.test(code))push('medium','发现潜在无限循环','需要确认循环存在明确退出条件，避免EA卡死或终端占用。');
 if(/\bSleep\s*\(/i.test(code))push('low','检测到 Sleep','EA事件线程中的Sleep可能阻塞处理，需确认是否必要。');
 if(platform==='MT5'&&/\btrade\.(Buy|Sell|PositionClose|PositionModify)\s*\(/i.test(code)&&!/ResultRetcode|ResultDeal|ResultOrder|GetLastError/i.test(code))push('high','交易请求结果检查不足迹象','发现CTrade调用，但未明显识别到Retcode/Deal/Order结果校验。静态扫描不能证明一定缺失，但应优先审计。');
 if(platform==='MT4'&&/\bOrderSend\s*\(/i.test(code)&&!/GetLastError|ticket|result|ret/i.test(code))push('medium','OrderSend返回结果检查不足迹象','发送订单后应确认ticket/错误码，不应只假设请求成功。');
 if(/\bFileWrite\s*\(/i.test(code)&&!/FileClose\s*\(/i.test(code))push('low','文件关闭路径需核对','检测到FileWrite，但未明显识别到FileClose。');
 if(platform==='TradingView'&&/request\.security/i.test(code)&&/(lookahead_on|barmerge\.lookahead_on)/i.test(code))push('high','检测到 lookahead_on','回测/历史信号可能出现未来数据污染，必须人工确认用途。');
 return flags;
}
function impactFromRequest(req,modules){const s=req.toLowerCase().trim();if(!s)return{items:[],level:'未填写',note:'填写“想修改什么”后，本地体检会估算最可能受影响的模块。'};
 const rules=[
  ['Entry / 信号',['entry','state','mtf'],/(入场|进场|entry|signal|信号|bos|choch|fvg|流动性|liquidity|过滤)/i],
  ['SL / TP / 退出',['exit','sltp','position'],/(止损|止盈|sl|tp|退出|exit|平仓)/i],
  ['持仓管理',['position','partial','breakeven','trailing','state'],/(减仓|部分平仓|保本|be|runner|移动止损|trailing|加仓|持仓管理)/i],
  ['多周期 / 数据',['mtf','indicator'],/(m1|m5|m15|h1|h4|多周期|timeframe|security|copybuffer|指标)/i],
  ['提醒 / 显示',['alerts','chart'],/(邮件|提醒|推送|alert|面板|显示|plot|label)/i],
  ['CSV / 审计',['file','state','position'],/(csv|审计|统计|日志|记录)/i],
  ['平台迁移',['entry','exit','position','state','mtf'],/(mt4.*mt5|mt5.*mt4|pine.*mql|转换|迁移|port)/i]
 ];
 const found=[];for(const [label,keys,re] of rules)if(re.test(req))found.push({label,keys});
 const keys=new Set(found.flatMap(x=>x.keys));const present=new Set(modules.map(x=>x.key));const overlap=[...keys].filter(k=>present.has(k));
 const level=found.some(x=>x.label==='平台迁移')||overlap.some(k=>['state','position','partial','breakeven'].includes(k))?'高':overlap.length>=3?'中高':overlap.length?'中':'低';
 return{items:found,level,note:found.length?`预计会触及 ${[...keys].length} 类模块；其中 ${overlap.length} 类已在当前源码中检测到。`:'未从文字中识别到典型修改关键词，可把要求写得更具体。'};
}
function selfServiceDecision(profile,impact){const complex=profile.complexityScore;const highRisk=profile.flags.some(f=>f.level==='high');const stateful=profile.moduleKeys.has('state')||profile.moduleKeys.has('position')||profile.moduleKeys.has('partial')||profile.moduleKeys.has('breakeven');
 if(impact.level==='高'||highRisk||stateful||complex>=12)return{grade:'建议 AI 深度分析',tone:'high',why:'涉及状态、持仓、平台语义或高风险依赖。简单文本替换容易破坏原算法或账户状态。'};
 if(impact.level==='中高'||complex>=7)return{grade:'建议先做依赖核对',tone:'medium',why:'多个模块互相连接。即使修改范围不大，也应先确认调用链和保持不变的逻辑。'};
 return{grade:'可能可自行处理',tone:'low',why:'结构相对集中。如果只是文案、显示或独立提醒，可先在副本中修改并编译验证；涉及交易规则时仍应人工复核。'};
}
function analyze(name,raw,req){const code=cleanCode(raw);const platform=detectPlatform(name,code);const lines=raw.split(/\r?\n/);const nonEmpty=lines.filter(x=>x.trim()).length;const comments=count(/\/\/.*$/gm,raw)+count(/\/\*[\s\S]*?\*\//g,raw);const functions=detectFunctions(platform,code);const inputs=detectInputs(platform,code);const handlers=detectHandlers(platform,code);const modules=detectModules(code);const moduleKeys=new Set(modules.map(x=>x.key));const flags=riskFlags(platform,raw,code);let score=0;if(lines.length>800)score++;if(lines.length>2000)score+=2;if(lines.length>5000)score+=2;if(functions>20)score++;if(functions>60)score+=2;score+=modules.reduce((s,x)=>s+x.weight,0);score+=flags.filter(f=>f.level==='high').length*2;const complexity=score>=16?'高':score>=9?'中':'低';const impact=impactFromRequest(req,modules);const profile={platform,bytes:new Blob([raw]).size,lines:lines.length,nonEmpty,comments,functions,inputs,handlers,modules,moduleKeys,flags,complexityScore:score,complexity};profile.decision=selfServiceDecision(profile,impact);profile.impact=impact;return profile;}
function chip(txt,cls=''){return`<span class="si-chip ${cls}">${esc(txt)}</span>`;}
function render(p,name,req){const high=p.flags.filter(x=>x.level==='high').length,med=p.flags.filter(x=>x.level==='medium').length;const modules=p.modules.length?p.modules.map(m=>chip(m.name,'good')).join(''):chip('未识别到典型交易模块');const handlers=p.handlers.length?p.handlers.map(x=>chip(x)).join(''):chip('未识别到标准事件入口');const flags=p.flags.length?p.flags.map(f=>`<div class="si-risk ${f.level}"><b>${esc(f.title)}</b><span>${esc(f.detail)}</span></div>`).join(''):'<div class="si-risk good"><b>未发现明显高风险标记</b><span>仍不代表源码已通过安全或逻辑审计。</span></div>';
 const impact=p.impact.items.length?p.impact.items.map(x=>chip(x.label,'warn')).join(''):chip('等待修改要求');const decisionClass=p.decision.tone==='high'?'high':p.decision.tone==='medium'?'warn':'good';
 const report=`T5 Quant Lab 免费源码体检\n文件：${name}\n平台：${p.platform}\n行数：${p.lines}\n函数：${p.functions}\n参数：${p.inputs}\n复杂度：${p.complexity} (${p.complexityScore})\n模块：${p.modules.map(x=>x.name).join('、')||'未识别'}\n风险：${p.flags.map(x=>x.title).join('、')||'未发现明显标记'}\n修改影响：${p.impact.note}\n本地建议：${p.decision.grade} - ${p.decision.why}\n\n注意：此报告为规则驱动静态扫描，不判断策略盈利能力，也不能证明源码逻辑正确。`;
 sessionStorage.setItem('t5_local_inspection_report',report);sessionStorage.setItem('t5_local_inspection_request',req||'');
 $('result').innerHTML=`<div class="si-top"><div><small>LOCAL REPORT</small><h2>${esc(name)}</h2><p>规则驱动静态扫描 · 0 API · 源码未上传</p></div><div class="si-grade ${decisionClass}">${esc(p.decision.grade)}</div></div>
 <div class="si-stats"><div><b>${esc(p.platform)}</b><span>平台</span></div><div><b>${p.lines.toLocaleString()}</b><span>源码行数</span></div><div><b>${p.functions}</b><span>函数/方法</span></div><div><b>${p.inputs}</b><span>输入参数</span></div><div><b>${p.complexity}</b><span>结构复杂度</span></div><div><b>${high}/${med}</b><span>高/中风险提示</span></div></div>
 <section class="si-section"><h3>1. 源码结构画像</h3><p>识别到 ${p.modules.length} 类功能模块，${p.handlers.length} 个标准事件/入口。</p><div class="si-chips">${modules}</div><div class="si-sub">事件入口</div><div class="si-chips">${handlers}</div></section>
 <section class="si-section"><h3>2. 明显风险与依赖</h3>${flags}</section>
 <section class="si-section"><h3>3. 你这次修改可能影响哪里</h3><p><b>影响等级：${esc(p.impact.level)}</b> · ${esc(p.impact.note)}</p><div class="si-chips">${impact}</div></section>
 <section class="si-section"><h3>4. 免费阶段建议</h3><div class="si-decision ${decisionClass}"><b>${esc(p.decision.grade)}</b><p>${esc(p.decision.why)}</p></div><ul class="si-list"><li>先保存原始源码副本和可编译基线版本。</li><li>如果只改显示/文字/独立Alert，可先在副本中修改并重新编译。</li><li>如果涉及Entry、状态机、部分平仓、保本、重启恢复或平台迁移，不建议只靠搜索替换。</li><li>正式修改前写清楚“要改什么”和“哪些逻辑必须保持不变”。</li></ul></section>
 <section class="si-section"><h3>5. AI深度分析会多做什么</h3><div class="si-compare"><div><b>免费静态体检</b><span>识别模块、明显风险、复杂度、修改影响范围</span></div><div><b>AI深度分析</b><span>重建 Entry / Exit / Risk / State，定位函数变量和调用链，冻结修改范围</span></div></div><div class="si-actions"><a class="btn" href="/tools/strategy-builder/why-ai-analysis/">先看免费 vs AI区别</a><a class="btn primary" href="/tools/strategy-builder/">进入 Builder</a></div></section>
 <div class="si-foot">静态扫描不运行源码、不编译、不回测，也不会判断策略是否盈利。高风险提示是启发式线索，需要人工确认。</div>`;
 $('copyReport').disabled=false;$('downloadReport').disabled=false;
 $('copyReport').onclick=async()=>{try{await navigator.clipboard.writeText(report);$('status').textContent='体检报告已复制。';}catch{$('status').textContent='复制失败，请手动复制。';}};
 $('downloadReport').onclick=()=>{const b=new Blob([report],{type:'text/plain;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='T5_source_inspection.txt';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),800);};
}
async function inspect(){const f=$('sourceFile').files[0];if(!f){$('status').textContent='请选择源码文件。';return;}if(f.size>MAX_BYTES){$('status').textContent='文件超过512 KB上限。';return;}$('status').textContent='正在浏览器本地读取并扫描…';$('result').innerHTML='<div class="si-empty">正在生成源码结构画像…</div>';try{const raw=await f.text();if(!raw.trim())throw new Error('源码文件为空');render(analyze(f.name,raw,$('changeRequest').value),f.name,$('changeRequest').value.trim());$('status').textContent='免费本地体检完成：源码没有上传，也没有调用AI。';}catch(e){$('result').innerHTML=`<div class="si-empty warn">${esc(e.message||'体检失败')}</div>`;$('status').textContent='体检失败。';}}
function init(){const input=$('sourceFile');if(!input)return;input.addEventListener('change',()=>{const f=input.files[0];$('fileMeta').textContent=f?`${f.name} · ${Math.max(1,Math.round(f.size/1024))} KB`:'尚未选择文件';if(f)inspect();});$('runInspect').addEventListener('click',inspect);$('changeRequest').addEventListener('input',()=>{if(input.files[0])$('status').textContent='修改要求已变化，可重新生成体检报告。';});}
init();
})();