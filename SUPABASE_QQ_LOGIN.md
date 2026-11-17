# QQ 登录接入说明（保留 GitHub 登录，二者并存）

当前状态：**前端 + 云函数代码已全部写好，只差 QQ 互联的 AppID / AppKey 和一个能备案的回调域名。**
未配置时点击「使用 QQ 登录」只会弹提示，不影响站点其他功能。

---

## 1. 链路长什么样

```
浏览器                 QQ 互联                  Supabase Edge Function         Supabase Auth
  │ 点击「使用 QQ 登录」    │                              │                            │
  ├─ 带 state 跳转 ───────▶│                              │                            │
  │                       │ 用户授权                      │                            │
  │◀── 回跳 ?code=&state= ─┤                              │                            │
  ├─ POST /functions/v1/qq-auth {code, redirect_uri} ─────▶│                            │
  │                       │◀─ 换 access_token ────────────┤                            │
  │                       │◀─ 换 openid / 昵称 / 头像 ─────┤                            │
  │                       │                              ├─ 建号 / 登录 ─────────────▶│
  │◀── access_token + refresh_token ──────────────────────┤                            │
  ├─ supabase.auth.setSession() ─────────────────────────────────────────────────────▶│
  │◀── 正常登录态，后续 RLS 全部照旧 ────────────────────────────────────────────────────┤
```

- 前端只传 `code`，**AppKey 永远不出现在 index.html**。
- 每个 QQ 用户在本站对应一个确定性账号：`qq_<openid>@oauth.bonvoyage.click`，
  密码由 `HMAC-SHA256(openid, AppKey)` 推导，服务端可复现，库里不存明文。
- 与用户名登录（`用户名@bonvoyage.click`）用不同邮箱后缀，不会撞号。
- GitHub 登录代码一行没动，两种方式可同时使用；同一自然人在两边是两个账号（如需合并要另做账号绑定）。

## 2. 你需要准备

| 项目 | 说明 |
|---|---|
| QQ互联 网站应用 | 到 <https://connect.qq.com> 注册开发者 → 创建「网站应用」→ 拿 `AppID` / `AppKey` |
| 回调地址 | 必须与页面实际地址完全一致，当前代码自动取 `location.origin + location.pathname`，即 `https://bonvoyage.click/index.html` |
| ICP 备案 | **硬门槛**：QQ 互联要求网站已备案，而 `.click` 后缀工信部不予备案 |

> 如果 `.click` 确实备案不下来，两条替代路线：
> 1. 用已备案域名做跳板（例如 `auth.你的备案域名.com` 放一个只负责回跳的页面，回调登记它，前端再把 code 转给主站）；
> 2. 走聚合身份服务（Authing / Logto 等）代理 QQ 登录，回调落在它们已备案的域名上。

## 3. 填配置（3 步）

### ① 前端只填 AppID

[js/00-config.js](js/00-config.js) 里搜 `QQ_APP_ID`：

```js
const QQ_APP_ID = ''          // ← 填 QQ互联 的 AppID
const QQ_REDIRECT_URI = window.location.origin + window.location.pathname
```

> 如果回调必须固定成别的地址（比如跳板域名），把 `QQ_REDIRECT_URI` 改成那个常量，并同步 QQ 后台。

### ② 云函数设密钥

```bash
supabase login
supabase link --project-ref xmyhgelfuxlvzpxqoaer

supabase secrets set QQ_APP_ID=你的AppID
supabase secrets set QQ_APP_KEY=你的AppKey
# 可选：锁定来源和回调，防止被别的站点复用
supabase secrets set ALLOWED_ORIGIN=https://bonvoyage.click
supabase secrets set QQ_REDIRECT_URI=https://bonvoyage.click/index.html
```

### ③ 部署云函数

```bash
supabase functions deploy qq-auth
```

`supabase/config.toml` 里已写 `[functions.qq-auth] verify_jwt = false`，
所以不用再手动加 `--no-verify-jwt`。这一步是必须的：前端用的是 publishable key 而不是 JWT；
函数内部靠 `code` 只能被真实 AppKey 兑换，匿名请求无法伪造登录。

## 4. 自测清单

1. 打开站点 → 用户中心 → 出现「使用 QQ 登录」按钮，GitHub 按钮仍在。
2. 未填 AppID 时点击 → 提示「QQ 登录尚未配置」，控制台无报错。
3. 填好并部署后点击 → 跳转 `graph.qq.com`，授权后回到站点并自动登录。
4. 用户中心「账号」页能看到 `qq_xxx@oauth.bonvoyage.click`。
5. 侧边栏昵称/头像来自 QQ 昵称与 `figureurl_qq_2`（已升级为 https）。
6. 退出后再次用 QQ 登录 → 还是同一个账号（不是新建）。

## 5. 已知风险

- **Supabase 项目当前疑似不可用**：`xmyhgelfuxlvzpxqoaer.supabase.co` 在本机 DNS 解析失败，
  部署云函数前先确认项目没被暂停/删除，否则 `supabase link` 和 `functions deploy` 都会失败。
- QQ 的 `figureurl` 是 http 协议，代码已替换为 https；若某些地区 CDN 不支持 https，头像会退回默认图。
- 未做账号合并：QQ 与 GitHub/用户名是三个独立账号。
- 生产环境建议把 `ALLOWED_ORIGIN` 收紧到正式域名。
