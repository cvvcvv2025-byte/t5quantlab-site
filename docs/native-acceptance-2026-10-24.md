# 原生运行验收记录 — 2026-10-24

MT4 和 MT5 均已核验为已连接的模拟账户。本次没有向券商发送订单。

| 平台 | EA | 历史模拟成交 |
|---|---|---:|
| MT5 | Attack Completion C | 45 |
| MT5 | Trend Capture | 20 |
| MT5 | Range Martingale | 114 |
| MT5 | Range Boundary Aggressive | 118 |
| MT4 | Range Martingale | 111 |
| MT4 | Range Boundary Aggressive | 121 |

测试区间为 2026-01-05 至 2026-03-01，XAUUSD / M5。MT5 使用 M1 OHLC；MT4 使用历史分钟柱生成的模拟 tick、33 点固定点差。数据存在交易时段缺口，此记录用于软件运行路径检查，不能作为盈利或真实成交验证。

MT5 实际覆盖：Attack 29 次止损、22 次持仓修改；Trend 19 次止损、1 次止盈、45 次持仓修改；Range 5 次止损。激进版未覆盖止损触发，不能将该路径标记为已验收。六个版本在该区间未发现越界、除零、非法指针、非法止损、资金不足或订单函数错误日志。

八个原版指标均已在原生终端加载并计算。MT5 四款各完成 77,723 根历史柱计算、27,578 个测试 tick，并输出图表对象；另有独立终端截图。MT4 四款均有独立图表记录。

发现 MT5 高 DPI 字体与固定像素面板不匹配，正在验证独立显示修复版本。四款候选版历史计算和对象文本输出与原版逐行一致；候选版尚未上线。

MT4 当前 Wine 环境的中文图形对象存在乱码。原版 Structure Map 设置 ChineseText=false 后可正常显示英文。编码重编译候选未作为有效修复发布。

独立原生授权探针通过 18 项断言，0 失败。测试器按设计绕过在线授权，因此不能替代带持仓的真实运行时到期、断网、迁移组合验收。

尚未完成：券商模拟账户实时报价驱动的端到端开平仓、授权状态变化组合验收，以及显示修复的线上交付闭环。周末无连续报价，历史模拟与上述验收分别记录。

原始报告可能包含模拟账户信息，保留在私有目录，不直接发布。

Display maintenance build 1: all four candidate charts reviewed at native pixel size; historical regression output text matches original. Previous verified packages remain available during the upload transition. Delivery catalog is the source of truth for uploaded availability.
