# T5 Quant Lab Account + Payment + Marketing Setup

当前身份与支付主链：

`email code login -> user_id -> T5 order -> provider payment -> verified capture/webhook -> grant -> account-bound Builder access`

公开内容和免费源码体检仍然免登录；购买 Builder Pass、查看订单、管理邮件订阅需要邮箱账户。

## Email account login

T5 使用“邮箱验证码登录”，不设置密码。第一次验证码验证成功会自动创建账户。

需要 Cloudflare Secrets / Variables：

- `ACCOUNT_AUTH_SECRET`：至少 32 字节随机密钥。用于验证码哈希、IP限流哈希、账户到Builder grant的派生令牌、退订链接签名。不要放进前端。
- `RESEND_API_KEY`：Resend API Key。
- `AUTH_EMAIL_FROM`：已在 Resend 验证可发送的 From，例如 `T5 Quant Lab <login@t5quantlab.com>`。

未配置以上任意一项时：

- `/api/auth/config` 返回 `email_login_ready=false`
- `/api/auth/request-code` fail closed
- 登录页明确显示“邮件登录尚未配置”
- 系统绝不伪装“验证码已发送”

账户接口：

- `GET /api/auth/config`
- `POST /api/auth/request-code`
- `POST /api/auth/verify-code`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/account/summary`
- `POST /api/account/marketing`
- `POST /api/marketing/unsubscribe`
- `GET /api/admin/accounts`（需要 `X-Builder-Access-Key`）

登录会话：HttpOnly + Secure + SameSite=Lax，默认 30 天。

验证码：6位数字、10分钟有效、最多6次尝试；邮箱/IP均有请求频率限制。

## Marketing consent

账户注册和营销订阅必须分开：

- `marketing_consent` 默认 `0`
- 登录页营销勾选框默认不勾选
- 用户可以在 `/account/` 随时开启/关闭
- 所有变化记录到 `marketing_consent_events`
- 营销退订不会影响验证码、付款、权限等必要服务邮件

管理员客户列表：

`/admin/accounts/`

必须输入现有 `BUILDER_ACCESS_KEY` 才能读取。管理员密钥只写入当前标签页 `sessionStorage`，不写入 localStorage。

## Scheduled marketing campaigns

管理员营销后台：

`/admin/campaigns/`

功能：

- 查看当前 `marketing_consent=1` 的可营销用户数量
- 创建主题 + 纯文本正文 + 发送时间
- 浏览器本地时间自动转 UTC ISO 后提交
- 查看 scheduled / sending / completed / canceled 状态
- 查看成功与最终失败数量
- 尚未开始发送的任务可取消

Cloudflare cron：

`*/15 * * * *`

即每15分钟扫描一次到期Campaign。因此实际发送可能比后台设置的时间晚几分钟。

营销发送规则：

1. 只读取 `users.status='active' AND marketing_consent=1`
2. 每批最多40个用户
3. 下一批发送前重新检查订阅状态，中途退订会自动排除
4. 每个Campaign + User使用唯一 Resend `Idempotency-Key`，防止重复发送
5. 单个收件人失败最多重试3次
6. 每封营销邮件自动加入带签名的取消订阅链接
7. 退订只关闭营销邮件，不影响验证码、付款和必要服务邮件
8. `marketing_deliveries` 保存每个用户的发送状态、尝试次数、Provider Message ID和失败原因

可选邮件发件人：

- `MARKETING_EMAIL_FROM`：营销专用已验证发件地址，例如 `T5 Quant Lab <updates@t5quantlab.com>`
- 如果未配置，会回退使用 `AUTH_EMAIL_FROM`

但营销模块仍必须同时具备：

- `RESEND_API_KEY`
- `ACCOUNT_AUTH_SECRET`
- `MARKETING_EMAIL_FROM` 或 `AUTH_EMAIL_FROM`

否则创建Campaign会 fail closed，不会假装已经排程成功。

营销API（全部需要 `X-Builder-Access-Key`）：

- `GET /api/admin/campaigns`
- `POST /api/admin/campaigns`
- `POST /api/admin/campaigns/cancel`

## Account-bound orders

新的 Builder Pass 订单必须先登录：

1. 登录得到 `t5_session`
2. `POST /api/orders/create`
3. `src/account-worker.js` 强制把订单邮箱改为当前 T5 账户邮箱
4. 订单写入 `orders.user_id`
5. account worker 剥离 legacy gated worker 在 pending 阶段设置的 Builder cookie
6. PayPal 付款成功后仍由原支付栈创建 `builder_access_grants`
7. 登录用户访问 `/api/builder/*` 时，account worker 只从该 `user_id` 的 granted order 解析有效 grant，并向内层门禁注入派生 Builder token

因此 PayPal 付款邮箱可以和 T5 登录邮箱不同；产品权限以 T5 `user_id` 为准。

旧版已有 `t5_builder_access` token 仍由原 gated worker 兼容，不需要立即迁移旧客户。

## Product pricing

价格不写死在前端。Cloudflare Worker 环境变量：

- `CODE_WORKSHOP_PRICE_CNY_MINOR`
- `CODE_WORKSHOP_PRICE_USD_MINOR`

首发默认由 commercial worker 固定为 `$14.90 / 30天 / 3次分析 + 2次修改`；如果使用环境价格覆盖，仍需通过支付合同检查。

未配置有效价格时真实付款订单必须 fail closed。

## PayPal

当前代码已实现 PayPal Orders v2、服务端 capture、Webhook 验签、成功付款自动 grant、全额退款/付款 reversal 撤销 grant。

Cloudflare Secrets：

- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID`

Cloudflare variable：

- `PAYPAL_ENVIRONMENT=sandbox`
- `PAYPAL_ENVIRONMENT=live`

Webhook URL：

`https://t5quantlab.com/api/payment/paypal/webhook`

至少订阅：

- `PAYMENT.CAPTURE.COMPLETED`
- `PAYMENT.CAPTURE.REFUNDED`
- `PAYMENT.CAPTURE.REVERSED`
- dispute相关事件（当前 commercial/final workers 已处理创建、更新与解决）

## Order / Grant protections

必须保持：

- 新订单必须绑定登录 `user_id`
- pending 订单不得获得 Builder 权限cookie
- `provider_trade_id` 唯一
- `payment_events.event_key` 唯一，防 Webhook replay
- 金额与币种完全匹配才发 Grant
- 未付款订单不能使用 AI
- 全额退款后 Grant 状态改为 `revoked`
- PayPal dispute 打开时暂停、按最终结果恢复或撤销
- 重复 AI analyze/modify 请求阻止重复烧 Token
- AI 请求失败时恢复预留额度
- 管理员测试付款只有 `ENABLE_PAYMENT_TEST_MODE=true` 时才允许

## Test-only / Admin

管理员 Secret：

- `BUILDER_ACCESS_KEY`

付款测试如需启用：

- `ENABLE_PAYMENT_TEST_MODE=true`

正式环境应关闭 `ENABLE_PAYMENT_TEST_MODE`。

## Main files

- `src/marketing-worker.js`：定时Campaign、opt-in收件人过滤、Resend发送、退订链接、重试与投递记录
- `src/account-worker.js`：邮箱登录、user_id、营销许可、订单绑定、账户到Builder grant桥接
- `src/final-worker.js`：退款资格与最终 dispute safeguard
- `src/commercial-worker.js`：Builder Pass商业合同、审计与争议逻辑
- `src/gated-worker.js`：原支付门禁、订单、Grant、PayPal适配器、旧token兼容
- `builder-schema.sql`：D1 schema
- `account/login/index.html`：邮箱验证码登录
- `account/index.html`：My T5
- `admin/accounts/index.html`：管理员客户邮箱/订阅状态视图
- `admin/campaigns/index.html`：定时营销Campaign后台
- `checkout/index.html`：账户绑定的PayPal结账
- `.github/workflows/syntax-check.yml`：Worker / 页面 JS / Account / Marketing / Payment 合同检查
