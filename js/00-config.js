/* ─────────────────────────────────────────────────────────────
 * 00-config.js · 站点配置与 Supabase 初始化参数
 * 该文件由原 index.html 内联脚本按顺序拆分而来，文件编号即执行顺序。
 * ───────────────────────────────────────────────────────────── */
'use strict'


const SUPABASE_URL = 'https://xmyhgelfuxlvzpxqoaer.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_717gtd0jY6aoeEGx2sAi-Q_DD7tlM9n'

// Supabase SDK 是 ES Module，加载完成时间晚于下面的普通脚本；
// 所以这里只保存初始化参数，真正的客户端实例由 99-boot.js 在 SDK 就绪后创建。
const SUPABASE_OPTIONS = {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    flowType: 'implicit',
  },
}
let supabase = null

const EMAIL_DOMAIN = 'bonvoyage.click'

// ── QQ 登录配置 ───────────────────────────────────────────────────────
// 上线前只需做两件事：
//   1. 到 https://connect.qq.com 创建「网站应用」，把 AppID 填到下面；
//   2. AppKey 不要写进这个文件，只设为 Supabase 云函数的环境变量。
// 详见项目根目录 SUPABASE_QQ_LOGIN.md
const QQ_APP_ID = ''
// 回调地址必须与 QQ 互联后台填写的「回调地址」一字不差
const QQ_REDIRECT_URI = window.location.origin + window.location.pathname
// Supabase Edge Function 名称（代码见 supabase/functions/qq-auth）
const QQ_AUTH_FUNCTION = 'qq-auth'
const QQ_STATE_KEY = 'bonvoyage.qq.oauth.state'
const QQ_ERROR_KEY = 'bonvoyage.qq.oauth.error'
const QQ_ENABLED = Boolean(QQ_APP_ID)
