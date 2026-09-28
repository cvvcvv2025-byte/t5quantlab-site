# T5 Quant Lab Payment Setup

支付主链冻结为：

`T5 order -> provider payment -> verified callback/capture -> amount+currency check -> idempotent grant -> AI access`

未获得有效 `builder_access_grants` 前，`/api/builder/upload`、`/api/builder/analyze`、`/api/builder/modify` 均不得进入收费 AI 流程。

## Product pricing

价格不写死在前端。Cloudflare Worker 环境变量：

- `CODE_WORKSHOP_PRICE_CNY_MINOR`：人民币最小货币单位，例如 `9900` = ¥99.00
- `CODE_WORKSHOP_PRICE_USD_MINOR`：美元最小货币单位，例如 `1900` = $19.00

未配置价格时 `/api/orders/create` 必须 fail closed，不能创建真实付款订单。

## PayPal

当前代码已实现 PayPal Orders v2、服务端 capture、Webhook 验签、成功付款自动 grant、全额退款/付款 reversal 撤销 grant。

Cloudflare Secrets：

- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID`

Cloudflare variable：

- `PAYPAL_ENVIRONMENT=sandbox`：测试
- `PAYPAL_ENVIRONMENT=live`：正式

Webhook URL：

`https://t5quantlab.com/api/payment/paypal/webhook`

至少订阅：

- `PAYMENT.CAPTURE.COMPLETED`
- `PAYMENT.CAPTURE.REFUNDED`
- `PAYMENT.CAPTURE.REVERSED`

客户端流程：

1. `POST /api/orders/create`
2. `POST /api/payment/paypal/create`
3. 跳转 PayPal 的 approval URL
4. PayPal 返回 `/checkout/`
5. `POST /api/payment/paypal/capture`
6. 服务端核对本地订单号、USD 金额、currency、PayPal capture
7. `completePaidOrder()` 发放 Grant
8. Webhook 作为异步兜底，同一付款不得重复发放 Grant

## China mainland payment adapter contract

支付宝/微信目前只保留接口，不在未确定商户收单方案时伪装为可用。

候选服务商必须同时满足：

1. 正规商户签约 / 商户号
2. 服务端 API 创建付款订单
3. 每笔交易可绑定 T5 `order_id`
4. HTTPS 异步支付成功通知
5. 官方验签机制
6. 主动订单查询 API
7. 退款 API 或可靠退款通知
8. 支付成功通知包含可核对的金额与币种
9. provider transaction id 唯一

最终适配器必须只负责“验证支付事实”，验证成功后统一调用现有 `completePaidOrder()`，禁止为支付宝/微信复制另一套 Grant 逻辑。

预留 Webhook：

- `/api/payment/alipay/webhook`
- `/api/payment/wechat/webhook`

在适配器未完成前必须返回 `PAYMENT_ADAPTER_NOT_CONFIGURED`，不得发放权限。

## Order / Grant protections

必须保持：

- `provider_trade_id` 唯一
- `payment_events.event_key` 唯一，防 Webhook replay
- 金额完全匹配才发 Grant
- 币种完全匹配才发 Grant
- 未付款订单不能使用 AI
- 全额退款后 Grant 状态改为 `revoked`
- 重复 AI analyze/modify 请求阻止重复烧 Token
- AI 请求失败时恢复预留额度
- 管理员测试付款只有 `ENABLE_PAYMENT_TEST_MODE=true` 时才允许

## Test-only settings

管理员测试需要单独 Secret：

- `BUILDER_ACCESS_KEY`

并显式设置：

- `ENABLE_PAYMENT_TEST_MODE=true`

正式环境应关闭 `ENABLE_PAYMENT_TEST_MODE`。

## Files

- `src/gated-worker.js`：支付门禁、订单、Grant、支付适配器
- `builder-schema.sql`：D1 schema
- `checkout/index.html`：客户结账与付款状态页面
- `tools/strategy-builder/index.html`：付费权限状态与 AI 使用入口
- `.github/workflows/syntax-check.yml`：Worker / 页面 JS 语法检查
