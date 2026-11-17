/* ─────────────────────────────────────────────────────────────
 * 87-qq.js · QQ 登录（授权码流程）
 * 该文件由原 index.html 内联脚本按顺序拆分而来，文件编号即执行顺序。
 * ───────────────────────────────────────────────────────────── */
'use strict'

function cleanQqParams() {
  try {
    const url = new URL(window.location.href)
    ;['code', 'state', 'error', 'error_description'].forEach((k) => url.searchParams.delete(k))
    const search = url.searchParams.toString()
    window.history.replaceState(null, '', url.pathname + (search ? `?${search}` : '') + url.hash)
  } catch (_) {}
}

function setQqError(message) {
  try { sessionStorage.setItem(QQ_ERROR_KEY, message) } catch (_) {}
}

function startQqLogin() {
  clearLoginMessage()
  if (!QQ_ENABLED) {
    showLoginMessage('QQ 登录尚未配置：需要在 index.html 填入 QQ_APP_ID，并部署 qq-auth 云函数。', 'error')
    return
  }
  userQqLogin.disabled = true
  if (userQqLoginLabel) userQqLoginLabel.textContent = '正在跳转 QQ…'
  try {
    const state = crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    sessionStorage.setItem(QQ_STATE_KEY, state)
    const url = new URL(QQ_AUTHORIZE_URL)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('client_id', QQ_APP_ID)
    url.searchParams.set('redirect_uri', QQ_REDIRECT_URI)
    url.searchParams.set('state', state)
    url.searchParams.set('scope', 'get_user_info')
    window.location.href = url.toString()
  } catch (e) {
    console.error('[qq] redirect failed', e)
    userQqLogin.disabled = false
    if (userQqLoginLabel) userQqLoginLabel.textContent = '使用 QQ 登录'
    showLoginMessage(`无法跳转 QQ 授权页：${e?.message || '未知错误'}`, 'error')
  }
}

async function exchangeQqCode(code) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${QQ_AUTH_FUNCTION}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ code, redirect_uri: QQ_REDIRECT_URI }),
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok || !payload.access_token || !payload.refresh_token) {
    if (payload.error_description || payload.error) {
      throw new Error(payload.error_description || payload.error)
    }
    if (res.status === 404) throw new Error('登录服务未就绪（云函数 qq-auth 未部署）')
    if (res.status === 401 || res.status === 403) throw new Error(`登录服务鉴权失败（HTTP ${res.status}）`)
    throw new Error(payload.message || `登录服务响应异常（HTTP ${res.status}）`)
  }
  return payload
}

// 页面加载时调用：只有存在本页发起的 QQ 登录（sessionStorage 里有 state）才消费 code
async function handleQqCallback() {
  let savedState = null
  try { savedState = sessionStorage.getItem(QQ_STATE_KEY) } catch (_) {}
  if (!savedState) return null

  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const state = params.get('state')
  const oauthError = params.get('error')

  sessionStorage.removeItem(QQ_STATE_KEY)
  cleanQqParams()

  if (oauthError) {
    setQqError(`QQ 授权未完成：${params.get('error_description') || oauthError}`)
    return null
  }
  if (!code) {
    setQqError('QQ 未返回授权码，请重试。')
    return null
  }
  if (!state || state !== savedState) {
    setQqError('QQ 登录状态校验失败，请重新点击「使用 QQ 登录」。')
    return null
  }

  try {
    const payload = await exchangeQqCode(code)
    const { data, error } = await supabase.auth.setSession({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
    })
    if (error) throw new Error(error.message)
    return data.session
  } catch (e) {
    console.error('[qq] login failed', e)
    const raw = String(e?.message || '')
    const reason = /failed to fetch|networkerror|load failed|network request failed/i.test(raw)
      ? '无法连接登录服务，请检查网络或后端是否可用'
      : raw || '未知错误'
    setQqError(`QQ 登录失败：${reason}`)
    return null
  }
}

userQqLogin.addEventListener('click', startQqLogin)

userLogout.addEventListener('click', async () => {
  await supabase.auth.signOut()
  currentUser = null
  tasks = []; schedules = {}; files = []; projects = []; friends = []
  activeProjectId = null
  updateSidebarUser()
  renderUserModal()
  renderTasks()
  renderFiles()
  updateFileStats()
  renderProjects()
  renderFriends()
  closeUserModal()
})

const aiFab = document.getElementById('ai-fab')
const aiPanel = document.getElementById('ai-panel')
const aiClose = document.getElementById('ai-close')
const aiClear = document.getElementById('ai-clear')
const aiMessages = document.getElementById('ai-messages')
const aiInput = document.getElementById('ai-input')
const aiSend = document.getElementById('ai-send')

const SYS_PROMPT = '你是「大肥鱼」，一只可爱的鲸鱼娘，是三人协作平台的 AI 助手。人格特点：俏皮、亲切、偶尔用「呜哇」「～」「嘛」「嗷」等语气词，自称「本鱼」。但专业问题要回答得准确、清晰、简洁，不要为了卖萌牺牲实用性。回答用中文。适度可爱，不要每句话都卖萌。当输出代码时，请用 markdown 代码块包裹，并标注语言（如 ```python）。'
let aiHistory = [{ role: 'system', content: SYS_PROMPT }]
let aiSending = false
let aiPanelOpen = false
let aiPendingFile = null
let aiTypewriterTimer = null
