/* ─────────────────────────────────────────────────────────────
 * 80-files.js · 文件库与存储用量
 * 该文件由原 index.html 内联脚本按顺序拆分而来，文件编号即执行顺序。
 * ───────────────────────────────────────────────────────────── */
'use strict'

async function loadFiles() {
  if (!currentUser) { files = []; renderFiles(); updateFileStats(); return }
  const { data } = await supabase.from('files').select('*').order('created_at', { ascending: false })
  files = data || []
  renderFiles(); updateFileStats()
}

function updateFileStats() {
  const total = files.reduce((s, f) => s + (f.size || 0), 0)
  const ratio = Math.min(total / STORAGE_LIMIT, 1)
  const offset = RING_CIRC * (1 - ratio)
  storageRing.style.strokeDasharray = String(RING_CIRC)
  storageRing.style.strokeDashoffset = String(offset)
  storagePercent.textContent = `${Math.round(ratio * 100)}%`
  storageUsed.textContent = fmtBytes(total)
  storageTotal.textContent = '1 GB'
  storageRemaining.textContent = fmtBytes(Math.max(STORAGE_LIMIT - total, 0))
  fileCountEl.textContent = String(files.length)
  fileSubtitle.textContent = files.length > 0 ? `共 ${files.length} 个文件，占用 ${fmtBytes(total)}` : '管理团队文件与存储空间'
}

function renderFiles() {
  fileGroups.innerHTML = ''
  if (!currentUser) {
    const empty = document.createElement('div')
    empty.className = 'rounded-2xl border border-zinc-100 dark:border-zinc-800 p-8 bg-white dark:bg-zinc-900 text-center'
    empty.innerHTML = '<p class="text-sm text-zinc-400 dark:text-zinc-500">请先登录以查看文件</p>'
    fileGroups.appendChild(empty)
    return
  }
  if (files.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'rounded-2xl border border-zinc-100 dark:border-zinc-800 p-8 bg-white dark:bg-zinc-900 text-center'
    empty.innerHTML = '<p class="text-sm text-zinc-400 dark:text-zinc-500 mb-2">暂无文件</p><p class="text-xs text-zinc-400 dark:text-zinc-500">点击右上角「上传」开始</p>'
    fileGroups.appendChild(empty)
    return
  }
  const groups = {}
  files.forEach((f) => {
    const cat = f.category || '其他'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(f)
  })
  FILE_CATEGORIES.forEach((cat) => {
    const items = groups[cat]
    if (!items?.length) return
    const style = CATEGORY_STYLE[cat] || CATEGORY_STYLE['其他']
    const section = document.createElement('div')
    section.className = 'rounded-2xl border border-zinc-100 dark:border-zinc-800 p-3 md:p-4 bg-white dark:bg-zinc-900'
    const header = document.createElement('div')
    header.className = 'flex items-center gap-3 mb-3'
    const iconWrap = document.createElement('div')
    iconWrap.className = `p-2 rounded-xl ${style.bg}`
    iconWrap.innerHTML = `<div class="w-5 h-5 ${style.fg}"><svg class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" /><path d="M13 2v7h7" /></svg></div>`
    const titleWrap = document.createElement('div')
    titleWrap.className = 'flex-1 min-w-0'
    titleWrap.innerHTML = `<h3 class="font-semibold text-zinc-900 dark:text-zinc-100 text-sm md:text-base">${cat}</h3><p class="text-zinc-600 dark:text-zinc-400 text-xs">${items.length} 个文件</p>`
    header.appendChild(iconWrap); header.appendChild(titleWrap); section.appendChild(header)
    const list = document.createElement('ul')
    list.className = 'divide-y divide-zinc-100 dark:divide-zinc-800'
    items.forEach((file) => {
      const li = document.createElement('li')
      li.className = 'flex items-center justify-between gap-3 py-2'
      const left = document.createElement('div')
      left.className = 'flex items-center gap-3 min-w-0 flex-1'

      const nameEl = document.createElement('button')
      nameEl.type = 'button'
      nameEl.className = 'text-sm text-zinc-900 dark:text-zinc-100 truncate hover:text-blue-500 transition-colors duration-200 text-left'
      nameEl.textContent = file.name
      nameEl.title = '点击预览'
      nameEl.addEventListener('click', () => openPreview(file))
      left.appendChild(nameEl)

      const actions = document.createElement('div')
      actions.className = 'flex items-center gap-2 shrink-0'

      const size = document.createElement('span')
      size.className = 'text-xs text-zinc-400 dark:text-zinc-500 whitespace-nowrap mr-1 hidden sm:inline'
      size.textContent = fmtBytes(file.size || 0)

      const previewBtn = document.createElement('button')
      previewBtn.type = 'button'
      previewBtn.setAttribute('aria-label', '预览')
      previewBtn.className = 'p-2 rounded-xl text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-blue-500 active:scale-95 transition-all duration-200'
      previewBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>'
      previewBtn.addEventListener('click', () => openPreview(file))

      const dlBtn = document.createElement('a')
      dlBtn.href = file.url
      dlBtn.setAttribute('download', file.name)
      dlBtn.setAttribute('aria-label', '下载')
      dlBtn.className = 'p-2 rounded-xl text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-blue-500 active:scale-95 transition-all duration-200'
      dlBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><path d="M7 10l5 5 5-5M12 15V3" /></svg>'

      const delBtn = document.createElement('button')
      delBtn.type = 'button'
      delBtn.setAttribute('aria-label', '删除文件')
      delBtn.className = 'p-2 rounded-xl text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-red-500 active:scale-95 transition-all duration-200'
      delBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M6 6l1 14a2 2 0 002 2h6a2 2 0 002-2l1-14" /></svg>'
                  delBtn.addEventListener('click', async () => {
        const ok = await confirmDialog({
          title: '删除文件',
          message: `确定要删除文件「${file.name || '未命名'}」吗？此操作不可恢复。`,
          okText: '删除',
        })
        if (!ok) return
        await supabase.storage.from('uploads').remove([file.path])
        await supabase.from('files').delete().eq('id', file.id)
        files = files.filter((f) => f.id !== file.id)
        renderFiles(); updateFileStats()
      })

      actions.appendChild(size)
      actions.appendChild(previewBtn)
      actions.appendChild(dlBtn)
      actions.appendChild(delBtn)
      li.appendChild(left); li.appendChild(actions); list.appendChild(li)
    })
    section.appendChild(list); fileGroups.appendChild(section)
  })
}

function renderFileCategories() {
  fileCategoryList.innerHTML = ''
  FILE_CATEGORIES.forEach((cat) => {
    const style = CATEGORY_STYLE[cat] || CATEGORY_STYLE['其他']
    const isA = cat === pendingCategory
    const chip = document.createElement('button')
    chip.type = 'button'
    chip.textContent = cat
    chip.className = isA ? `px-3 py-1 rounded-xl ${style.bg} ${style.fg} text-xs font-medium active:scale-95 transition-all duration-200 ring-2 ring-blue-500/20` : 'px-3 py-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95 transition-all duration-200'
    chip.addEventListener('click', () => { pendingCategory = cat; renderFileCategories() })
    fileCategoryList.appendChild(chip)
  })
}

function openFileModal() {
  if (!currentUser) { openUserModal(); return }
  pendingFile = null; fileInput.value = ''
  fileSelectedName.textContent = '点击选择文件'
  fileSelectedSize.textContent = '支持任意格式'
  fileMessage.textContent = ''; fileMessage.className = 'hidden text-sm mb-4'
  fileSubmit.disabled = true
  pendingCategory = '其他'; renderFileCategories()
  fileModal.classList.remove('hidden'); syncBodyScroll()
}
function closeFileModal() { fileModal.classList.add('hidden'); syncBodyScroll() }

fileUploadOpen.addEventListener('click', openFileModal)
fileClose.addEventListener('click', closeFileModal)
fileBackdrop.addEventListener('click', closeFileModal)

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0]
  if (!file) return
  pendingFile = file
  fileSelectedName.textContent = file.name
  fileSelectedSize.textContent = fmtBytes(file.size)
  pendingCategory = guessCategory(file.name)
  renderFileCategories()
  fileSubmit.disabled = false
})

fileSubmit.addEventListener('click', async () => {
  if (!pendingFile) return
  fileSubmit.disabled = true; fileSubmit.textContent = '上传中...'
  const safeName = pendingFile.name.replace(/[^\w.\-\u4e00-\u9fa5]/g, '_')
  const path = `files/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`
  const { data: ud, error: ue } = await supabase.storage.from('uploads').upload(path, pendingFile, { cacheControl: '3600', upsert: false, contentType: pendingFile.type || 'application/octet-stream' })
  if (ue) { fileSubmit.disabled = false; fileSubmit.textContent = '上传'; fileMessage.textContent = `上传失败：${ue.message}`; fileMessage.className = 'text-sm mb-4 text-red-500'; return }
  const { data: u } = supabase.storage.from('uploads').getPublicUrl(ud.path)
  const { data: row, error: de } = await supabase.from('files').insert({ name: pendingFile.name, category: pendingCategory, path: ud.path, url: u.publicUrl, size: pendingFile.size, type: pendingFile.type || null }).select().single()
  fileSubmit.disabled = false; fileSubmit.textContent = '上传'
  if (de) { fileMessage.textContent = `保存失败：${de.message}`; fileMessage.className = 'text-sm mb-4 text-red-500'; return }
  files.unshift(row); renderFiles(); updateFileStats(); closeFileModal()
})

async function loadStorageUsage() {
  if (!currentUser) return
  const { data, error } = await supabase.rpc('get_db_size')
  if (error) return
  dbSizeEl.textContent = fmtBytes(data)
}

const userOpen = document.getElementById('user-open')
const userClose = document.getElementById('user-close')
const userBackdrop = document.getElementById('user-backdrop')
const userLoginView = document.getElementById('user-page-login')
const userProfileView = document.getElementById('user-page-profile')
const userAccountView = document.getElementById('user-page-account')
const userNavItems = document.querySelectorAll('[data-user-page]')
const userGithubLogin = document.getElementById('user-github-login')
const userQqLogin = document.getElementById('user-qq-login')
const userQqLoginLabel = document.getElementById('user-qq-login-label')
const userLogout = document.getElementById('user-logout')
const sidebarUsername = document.getElementById('sidebar-username')
const userAvatarPreview = document.getElementById('user-avatar-preview')
const userAvatarInput = document.getElementById('user-avatar-input')
const userNicknameInput = document.getElementById('user-nickname-input')
const userSaveProfile = document.getElementById('user-save-profile')
const avatarMessage = document.getElementById('avatar-message')
const profileMessage = document.getElementById('profile-message')
const userAccountEmail = document.getElementById('user-account-email')
const userAccountId = document.getElementById('user-account-id')
const userAccountProvider = document.getElementById('user-account-provider')
const userAccountCreated = document.getElementById('user-account-created')
const userSecurityView = document.getElementById('user-page-security')
const userCurrentPasswordWrap = document.getElementById('user-current-password-wrap')
const userCurrentPassword = document.getElementById('user-current-password')
const userNewPassword = document.getElementById('user-new-password')
const userConfirmPassword = document.getElementById('user-confirm-password')
const passwordMessage = document.getElementById('password-message')
const userSavePassword = document.getElementById('user-save-password')
const loginUsername = document.getElementById('login-username')
const loginPassword = document.getElementById('login-password')
const loginSubmit = document.getElementById('login-submit')
const loginMessage = document.getElementById('login-message')

const userNav = document.getElementById('user-nav')
const userNavToggle = document.getElementById('user-nav-toggle')
const userNavOverlay = document.getElementById('user-nav-overlay')
