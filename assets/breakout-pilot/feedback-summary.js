// Accept only feedback already released by the caller. Never infer sealed grades.
export const dimensions = [
  { key: 'action', name: '状态判断', advice: '把“等待”“条件满足”“取消”的条件分别列出，再回到本题检查。' },
  { key: 'reason', name: '证据依据', advice: '逐项核对已收盘K线与回踩证据，不用方向标签或后续涨跌补写依据。' },
  { key: 'condition', name: '失效边界', advice: '先写出什么会撤销当前候选，以及重建时需要哪些新证据。' }
];
const validGrade = grade => grade && dimensions.every(d => typeof grade[d.key] === 'boolean');
export function summarizeFeedback(rows) {
  const released = rows.filter(r => validGrade(r.firstGrade) && validGrade(r.latestGrade));
  return {
    assessed: released.length,
    pending: rows.length - released.length,
    dimensions: dimensions.map(d => ({ ...d,
      firstMatched: released.filter(r => r.firstGrade[d.key]).length,
      latestMatched: released.filter(r => r.latestGrade[d.key]).length,
      repairIds: released.filter(r => !r.latestGrade[d.key]).map(r => r.id)
    }))
  };
}
export function summaryMarkup(summary) {
  if (!summary.assessed) return `<p>${summary.pending ? '已提交的记录还在等待整组完成；评分开放前，不推断任何错因。' : '完成情境后，这里会按状态、依据、边界分别反馈。尚未作答不代表存在盲点。'}</p>`;
  return '<div class="dimension-grid">' + summary.dimensions.map(d => `<article><h3>${d.name}</h3><p>首次匹配 <b>${d.firstMatched}/${summary.assessed}</b><br>最近匹配 <b>${d.latestMatched}/${summary.assessed}</b></p><p>${d.repairIds.length ? d.advice : '已开放反馈的情境中，这项最近作答均匹配本期规则。'}</p></article>`).join('') + '</div>' + `<p class="muted">仅根据${summary.assessed}个已开放评分的情境反馈；不代表你对某个交易流派的掌握程度或实盘能力。${summary.pending ? `另有${summary.pending}个已提交情境待整组完成，未计入本次反馈。` : ''}补做不覆盖首次记录。</p>`;
}
