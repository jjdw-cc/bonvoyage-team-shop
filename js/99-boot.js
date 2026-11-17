/* ─────────────────────────────────────────────────────────────
 * 99-boot.js · 启动：等 SDK 就绪后创建客户端并初始化
 * 该文件由原 index.html 内联脚本按顺序拆分而来，文件编号即执行顺序。
 * ───────────────────────────────────────────────────────────── */
'use strict'

async function loadAllForUser() {
  updateSidebarUser()
  await upsertProfile()
  await loadTasks()
  await loadSchedules()
  await loadFiles()
  await loadProjects()
  await loadFriends()
  renderTasks()
  renderFiles()
  updateFileStats()
  renderProjects()
  renderFriends()
  renderUserModal()
}

async function init() {
  let session = null

  // QQ 登录回调优先处理：成功后直接复用后面的加载流程
  try {
    session = await handleQqCallback()
  } catch (e) {
    console.error('[init] qq callback error', e)
  }

  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
  const hashParams = new URLSearchParams(hash)
  const accessToken = hashParams.get('access_token')
  const refreshToken = hashParams.get('refresh_token')

  if (accessToken && refreshToken) {
    try {
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      if (error) {
        console.error('[init] setSession error', error)
      } else {
        session = data.session
      }
    } catch (e) {
      console.error('[init] setSession exception', e)
    }
    try {
      window.history.replaceState(null, '', window.location.pathname)
    } catch (_) {}
  }

  if (!session) {
    try {
      const res = await supabase.auth.getSession()
      session = res.data.session
    } catch (e) {
      console.error('getSession error', e)
    }
  }

  const urlHasToken =
    window.location.hash.includes('access_token') ||
    window.location.search.includes('code=')
  if (!session && urlHasToken) {
    await new Promise((r) => setTimeout(r, 800))
    const retry = await supabase.auth.getSession()
    session = retry.data.session
  }

  if (session) {
    currentUser = session.user
    await loadAllForUser()
  } else {
    renderTasks()
    renderUserModal()
    renderFiles()
    updateFileStats()
    renderProjects()
    renderFriends()
  }

  if (!currentUser) {
    try {
      const qqError = sessionStorage.getItem(QQ_ERROR_KEY)
      if (qqError) {
        sessionStorage.removeItem(QQ_ERROR_KEY)
        openUserModal()
        showLoginMessage(qqError, 'error')
      }
    } catch (_) {}
  }

  supabase.auth.onAuthStateChange(async (event, newSession) => {
    const wasLoggedIn = Boolean(currentUser)
    currentUser = newSession ? newSession.user : null
    updateSidebarUser()
    renderUserModal()
    if (currentUser && !wasLoggedIn) {
      await loadAllForUser()
    } else if (currentUser) {
      await upsertProfile()
      await loadFriends()
      renderFriends()
    } else {
      tasks = []; schedules = {}; files = []; projects = []; friends = []
      activeProjectId = null
      renderTasks()
      renderFiles()
      updateFileStats()
      renderProjects()
      renderFriends()
    }
  })
}

// ── 启动 ────────────────────────────────────────────────────────────
// 业务脚本先行加载并注册好事件，这里等 Supabase SDK 就绪后再创建客户端、恢复登录态。
;(async function boot() {
  try {
    await Promise.race([
      window.__sbReady,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase SDK 加载超时')), 15000)),
    ])
    if (typeof window.__sbCreateClient !== 'function') throw new Error('Supabase SDK 未就绪')
    supabase = window.__sbCreateClient(SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_OPTIONS)
    await init()
  } catch (e) {
    console.error('[boot] 启动失败', e)
    document.body.insertAdjacentHTML('afterbegin', '<div style="position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:#fafafa;color:#3f3f46;font:14px/1.6 system-ui,sans-serif;padding:24px;text-align:center">Supabase 加载失败，请检查网络后刷新页面</div>')
  }
})()

