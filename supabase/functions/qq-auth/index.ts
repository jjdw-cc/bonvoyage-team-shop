// Supabase Edge Function: qq-auth
//
// 作用：把前端的 QQ 授权码换成 openid，创建/复用本站用户，并签发 Supabase session。
// 为什么需要它：Supabase Auth 没有内置 QQ provider，QQ 互联也不是 OIDC，
//              只能用云函数当「中转」，用 AppKey 在服务端完成换 token。
//
// 部署：supabase functions deploy qq-auth --no-verify-jwt
// 环境变量：
//   QQ_APP_ID               QQ互联 网站应用 AppID（必填）
//   QQ_APP_KEY              QQ互联 网站应用 AppKey（必填，绝不下发到前端）
//   QQ_EMAIL_DOMAIN         本站账号邮箱后缀，默认 oauth.bonvoyage.click
//   QQ_REDIRECT_URI         固定回调地址（可选，填了则强制校验）
//   ALLOWED_ORIGIN          CORS 允许来源，默认 *（建议线上改成 https://bonvoyage.click）
//   SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY 由平台自动注入

import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2'

const DEFAULT_EMAIL_DOMAIN = 'oauth.bonvoyage.click'
const QQ_TOKEN_URL = 'https://graph.qq.com/oauth2.0/token'
const QQ_ME_URL = 'https://graph.qq.com/oauth2.0/me'
const QQ_USERINFO_URL = 'https://graph.qq.com/user/get_user_info'

const corsHeaders = (origin: string) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
})

function respond(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json; charset=utf-8' },
  })
}

async function readJson(res: Response): Promise<any> {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    // QQ 不加 fmt=json 时会返回 callback({...})，这里兜底解析一次
    const m = text.match(/\{[\s\S]*\}/)
    if (m) {
      try {
        return JSON.parse(m[0])
      } catch {
        /* fallthrough */
      }
    }
    throw new Error(`QQ 返回了非 JSON 内容：${text.slice(0, 180)}`)
  }
}

async function exchangeCode(code: string, redirectUri: string, appId: string, appKey: string) {
  const url = new URL(QQ_TOKEN_URL)
  url.searchParams.set('grant_type', 'authorization_code')
  url.searchParams.set('client_id', appId)
  url.searchParams.set('client_secret', appKey)
  url.searchParams.set('code', code)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('fmt', 'json')

  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  const data = await readJson(res)
  if (!res.ok || data.error || !data.access_token) {
    throw new Error(data.error_description || data.error || `换取 access_token 失败（HTTP ${res.status}）`)
  }
  return data as { access_token: string; expires_in?: number; refresh_token?: string }
}

async function fetchOpenId(accessToken: string): Promise<string> {
  const url = new URL(QQ_ME_URL)
  url.searchParams.set('access_token', accessToken)
  url.searchParams.set('fmt', 'json')

  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  const data = await readJson(res)
  if (!res.ok || !data.openid) {
    throw new Error(data.error_description || '获取 QQ openid 失败')
  }
  return String(data.openid)
}

async function fetchQqProfile(accessToken: string, appId: string, openid: string) {
  const url = new URL(QQ_USERINFO_URL)
  url.searchParams.set('access_token', accessToken)
  url.searchParams.set('oauth_consumer_key', appId)
  url.searchParams.set('openid', openid)

  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    const data = await readJson(res)
    if (!res.ok || (data.ret !== undefined && data.ret !== 0)) return { nickname: '', avatarUrl: '' }
    const hd = String(data.figureurl_qq_2 || data.figureurl_qq_1 || '')
    return {
      nickname: String(data.nickname || '').slice(0, 40),
      // QQ 返回 http://，站点是 https，必须升级协议否则头像会被浏览器拦
      avatarUrl: hd.replace(/^http:\/\//, 'https://'),
    }
  } catch (_e) {
    return { nickname: '', avatarUrl: '' }
  }
}

async function findUserByEmail(admin: SupabaseClient, email: string): Promise<User | null> {
  const target = email.toLowerCase()
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const users = data?.users ?? []
    const hit = users.find((u) => (u.email || '').toLowerCase() === target)
    if (hit) return hit
    if (users.length < 200) return null
  }
  return null
}

Deno.serve(async (req: Request) => {
  const origin = Deno.env.get('ALLOWED_ORIGIN') || '*'

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) })
  if (req.method !== 'POST') return respond({ error: 'method_not_allowed' }, 405, origin)

  const appId = Deno.env.get('QQ_APP_ID') || ''
  const appKey = Deno.env.get('QQ_APP_KEY') || ''
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || serviceKey
  const emailDomain = Deno.env.get('QQ_EMAIL_DOMAIN') || DEFAULT_EMAIL_DOMAIN
  const fixedRedirect = Deno.env.get('QQ_REDIRECT_URI') || ''

  if (!appId || !appKey) {
    return respond({ error: 'server_not_configured', error_description: '云函数缺少 QQ_APP_ID / QQ_APP_KEY' }, 500, origin)
  }
  if (!supabaseUrl || !serviceKey) {
    return respond({ error: 'server_not_configured', error_description: '缺少 Supabase 服务端环境变量' }, 500, origin)
  }

  let payload: { code?: string; redirect_uri?: string }
  try {
    payload = await req.json()
  } catch {
    return respond({ error: 'invalid_request', error_description: '请求体不是合法 JSON' }, 400, origin)
  }

  const code = (payload.code || '').trim()
  const redirectUri = (payload.redirect_uri || '').trim() || fixedRedirect
  if (!code) return respond({ error: 'invalid_request', error_description: '缺少 code' }, 400, origin)
  if (!redirectUri) return respond({ error: 'invalid_request', error_description: '缺少 redirect_uri' }, 400, origin)
  if (fixedRedirect && redirectUri !== fixedRedirect) {
    return respond({ error: 'invalid_request', error_description: 'redirect_uri 与允许值不一致' }, 400, origin)
  }

  try {
    const token = await exchangeCode(code, redirectUri, appId, appKey)
    const openid = await fetchOpenId(token.access_token)
    const profile = await fetchQqProfile(token.access_token, appId, openid)

    const email = `qq_${openid}@${emailDomain}`

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const anon = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 1) 找账号，没有就建（email 由 openid 决定，天然幂等）
    let user = await findUserByEmail(admin, email)
    if (!user) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          nickname: profile.nickname || `QQ用户${openid.slice(-4)}`,
          avatar_url: profile.avatarUrl || null,
          provider: 'qq',
          qq_openid: openid,
        },
      })
      if (error) {
        if (!/already|exists|registered/i.test(error.message)) throw error
        user = await findUserByEmail(admin, email)
        if (!user) throw error
      } else {
        user = data.user
      }
    } else {
      // 老用户：同步昵称/头像，避免 QQ 改资料后本站还是旧图
      await admin.auth.admin
        .updateUserById(user.id, {
          user_metadata: {
            nickname: profile.nickname || undefined,
            avatar_url: profile.avatarUrl || undefined,
            provider: 'qq',
            qq_openid: openid,
          },
        })
        .catch(() => {})
    }

    // 2) 用 magiclink 一次性 token 换正式 session（不依赖密码，最稳）
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })
    if (linkErr) throw linkErr

    const { data: verified, error: verifyErr } = await anon.auth.verifyOtp({
      token_hash: link.properties!.hashed_token!,
      type: 'magiclink',
    })
    if (verifyErr || !verified.session) {
      throw new Error(verifyErr?.message || '签发 session 失败')
    }

    const session = verified.session
    return respond({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      expires_at: session.expires_at,
      user: {
        id: session.user.id,
        email: session.user.email,
        nickname: profile.nickname || null,
        avatar_url: profile.avatarUrl || null,
      },
    }, 200, origin)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[qq-auth] failed:', message)
    return respond({ error: 'qq_auth_failed', error_description: message }, 400, origin)
  }
})
