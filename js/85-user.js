/* ─────────────────────────────────────────────────────────────
 * 85-user.js · 用户中心：登录 / 资料 / 账号 / 安全 / 头像裁剪
 * 该文件由原 index.html 内联脚本按顺序拆分而来，文件编号即执行顺序。
 * ───────────────────────────────────────────────────────────── */
'use strict'

function openUserNav() {
  userNav.setAttribute('data-mobile-open', 'true')
  userNavOverlay.classList.remove('hidden')
}
function closeUserNav() {
  userNav.setAttribute('data-mobile-open', 'false')
  userNavOverlay.classList.add('hidden')
}
userNavToggle.addEventListener('click', openUserNav)
userNavOverlay.addEventListener('click', closeUserNav)
window.addEventListener('resize', () => {
  if (window.innerWidth >= 768) closeUserNav()
})

const getDisplayName = (u) => {
  if (!u) return '未登录'
  if (u.user_metadata?.nickname) return u.user_metadata.nickname
  if (u.user_metadata?.user_name) return u.user_metadata.user_name
  if (u.user_metadata?.name) return u.user_metadata.name
  if (u.email) return u.email.split('@')[0]
  return '用户'
}
const getAvatarUrl = (u) => u?.user_metadata?.avatar_url || null

function showLoginMessage(text, type) {
  loginMessage.textContent = text
  loginMessage.className = type === 'success'
    ? 'text-sm text-green-500'
    : 'text-sm text-red-500'
}
function clearLoginMessage() {
  loginMessage.textContent = ''
  loginMessage.className = 'hidden text-sm'
}

async function handleUsernameLogin() {
  const raw = loginUsername.value.trim()
  const pwd = loginPassword.value
  if (!raw) { showLoginMessage('请输入用户名', 'error'); loginUsername.focus(); return }
  if (!pwd) { showLoginMessage('请输入密码', 'error'); loginPassword.focus(); return }
  let email
  if (raw.includes('@')) {
    email = raw.toLowerCase()
  } else {
    const username = raw.toLowerCase().replace(/[^a-z0-9._-]/g, '')
    if (!username) { showLoginMessage('用户名只能包含字母、数字、下划线', 'error'); return }
    email = `${username}@${EMAIL_DOMAIN}`
  }
  loginSubmit.disabled = true
  loginSubmit.textContent = '登录中...'
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pwd })
  loginSubmit.disabled = false
  loginSubmit.textContent = '登录'
  if (error) {
    showLoginMessage(`登录失败：${error.message}`, 'error')
    return
  }
  currentUser = data.user
  clearLoginMessage()
  loginUsername.value = ''
  loginPassword.value = ''
  await loadAllForUser()
}
loginSubmit.addEventListener('click', handleUsernameLogin)
loginPassword.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); handleUsernameLogin() }
})
loginUsername.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); loginPassword.focus() }
})

async function upsertProfile() {
  if (!currentUser) return
  await supabase.from('profiles').upsert({
    id: currentUser.id,
    nickname: getDisplayName(currentUser),
    avatar_url: getAvatarUrl(currentUser),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })
}

function renderSidebarAvatar() {
  const url = getAvatarUrl(currentUser)
  const icon = document.querySelector('#user-open > svg')
  if (!icon) return
  if (url) {
    const existing = document.getElementById('sidebar-avatar-img')
    if (existing) { existing.src = url; return }
    icon.classList.add('hidden')
    const img = document.createElement('img')
    img.id = 'sidebar-avatar-img'
    img.src = url
    img.alt = '头像'
    img.className = 'w-8 h-8 shrink-0 rounded-full object-cover group-hover/item:scale-110 transition-all duration-200'
    icon.parentElement.insertBefore(img, icon)
  } else {
    icon.classList.remove('hidden')
    document.getElementById('sidebar-avatar-img')?.remove()
  }
}

function updateSidebarUser() {
  sidebarUsername.textContent = currentUser ? getDisplayName(currentUser) : '未登录'
  renderSidebarAvatar()
}

function renderAvatarPreview() {
  const url = getAvatarUrl(currentUser)
  if (url) {
    userAvatarPreview.innerHTML = ''
    const img = document.createElement('img')
    img.src = url
    img.alt = '头像'
    img.className = 'w-full h-full object-cover'
    userAvatarPreview.appendChild(img)
  } else {
    userAvatarPreview.innerHTML = '<svg class="w-10 h-10 text-zinc-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 016-6h4a6 6 0 016 6v1" /></svg>'
  }
}

function fillProfileForm() {
  if (!currentUser) return
  userNicknameInput.value = currentUser.user_metadata?.nickname || currentUser.user_metadata?.user_name || currentUser.user_metadata?.name || ''
  renderAvatarPreview()
}

function fillAccountView() {
  if (!currentUser) return
  userAccountEmail.textContent = currentUser.email ? currentUser.email.split('@')[0] : '未设置'
  userAccountId.textContent = currentUser.id || '-'
  userAccountProvider.textContent = currentUser.app_metadata?.provider || '未知'
  userAccountCreated.textContent = currentUser.created_at ? new Date(currentUser.created_at).toLocaleString('zh-CN') : '-'
}

function fillSecurityView() {
  if (!currentUser) return
  // 管理员开的密码账号（@bonvoyage.click）才需要验旧密码；
  // GitHub / QQ 登录的账号本来没有可用密码，这里相当于「设置密码」
  const isEmailAccount = currentUser.app_metadata?.provider === 'email' &&
    String(currentUser.email || '').endsWith(`@${EMAIL_DOMAIN}`)
  userCurrentPasswordWrap.classList.toggle('hidden', !isEmailAccount)
  userCurrentPassword.value = ''
  userNewPassword.value = ''
  userConfirmPassword.value = ''
  passwordMessage.textContent = ''
  passwordMessage.className = 'hidden text-sm mb-4'
}

function setUserPage(page) {
  userNavItems.forEach((b) => b.setAttribute('data-active', String(b.dataset.userPage === page)))
  userProfileView.classList.toggle('hidden', page !== 'profile')
  userAccountView.classList.toggle('hidden', page !== 'account')
  userSecurityView.classList.toggle('hidden', page !== 'security')
  if (page === 'profile') fillProfileForm()
  if (page === 'account') fillAccountView()
  if (page === 'security') fillSecurityView()
}

function renderUserModal() {
  const logged = Boolean(currentUser)
  userLoginView.classList.toggle('hidden', logged)
  if (logged) setUserPage('profile')
  else {
    userProfileView.classList.add('hidden')
    userAccountView.classList.add('hidden')
    userSecurityView.classList.add('hidden')
  }
}

function openUserModal() { renderUserModal(); userModal.classList.remove('hidden'); syncBodyScroll() }
function closeUserModal() { userModal.classList.add('hidden'); closeUserNav(); syncBodyScroll() }

userOpen.addEventListener('click', openUserModal)
userOpen.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openUserModal() }
})
userClose.addEventListener('click', closeUserModal)
userBackdrop.addEventListener('click', closeUserModal)
userNavItems.forEach((b) => b.addEventListener('click', () => {
  setUserPage(b.dataset.userPage)
  if (window.innerWidth < 768) closeUserNav()
}))

const cropModal = document.getElementById('crop-modal')
const cropBackdrop = document.getElementById('crop-backdrop')
const cropClose = document.getElementById('crop-close')
const cropCancel = document.getElementById('crop-cancel')
const cropConfirm = document.getElementById('crop-confirm')
const cropStage = document.getElementById('crop-stage')
const cropImage = document.getElementById('crop-image')
const cropZoom = document.getElementById('crop-zoom')
const userAvatarChange = document.getElementById('user-avatar-change')

let cropState = null
let cropDrag = null

userAvatarChange.addEventListener('click', () => { userAvatarInput.click() })

userAvatarInput.addEventListener('change', () => {
  const file = userAvatarInput.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    avatarMessage.textContent = '请选择图片文件'
    avatarMessage.className = 'text-sm mt-3 text-red-500'
    userAvatarInput.value = ''
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    avatarMessage.textContent = '图片不能超过 5 MB'
    avatarMessage.className = 'text-sm mt-3 text-red-500'
    userAvatarInput.value = ''
    return
  }
  const reader = new FileReader()
  reader.onload = (ev) => openCropModal(ev.target.result)
  reader.readAsDataURL(file)
  userAvatarInput.value = ''
})

function applyCropTransform() {
  if (!cropState) return
  const totalScale = cropState.baseScale * cropState.scale
  const w = cropState.imgW * totalScale
  const h = cropState.imgH * totalScale
  cropImage.style.width = w + 'px'
  cropImage.style.height = h + 'px'
  cropImage.style.transform = `translate(${cropState.x}px, ${cropState.y}px)`
}

function openCropModal(src) {
  cropModal.classList.remove('hidden')
  syncBodyScroll()
  cropImage.onload = () => {
    const stageSize = cropStage.clientWidth
    const imgW = cropImage.naturalWidth
    const imgH = cropImage.naturalHeight
    const baseScale = Math.max(stageSize / imgW, stageSize / imgH)
    cropState = {
      stageSize,
      imgW,
      imgH,
      baseScale,
      scale: 1,
      x: (stageSize - imgW * baseScale) / 2,
      y: (stageSize - imgH * baseScale) / 2,
    }
    cropZoom.value = 1
    applyCropTransform()
  }
  cropImage.src = src
  avatarMessage.className = 'hidden text-sm mt-3'
}

function closeCropModal() {
  cropModal.classList.add('hidden')
  syncBodyScroll()
  cropState = null
  cropDrag = null
  cropImage.src = ''
  cropConfirm.disabled = false
  cropConfirm.textContent = '确定'
}

cropClose.addEventListener('click', closeCropModal)
cropCancel.addEventListener('click', closeCropModal)
cropBackdrop.addEventListener('click', closeCropModal)

cropStage.addEventListener('pointerdown', (e) => {
  if (!cropState) return
  e.preventDefault()
  cropStage.setPointerCapture(e.pointerId)
  cropDrag = {
    startX: e.clientX,
    startY: e.clientY,
    origX: cropState.x,
    origY: cropState.y,
  }
})

cropStage.addEventListener('pointermove', (e) => {
  if (!cropDrag || !cropState) return
  cropState.x = cropDrag.origX + (e.clientX - cropDrag.startX)
  cropState.y = cropDrag.origY + (e.clientY - cropDrag.startY)
  applyCropTransform()
})

cropStage.addEventListener('pointerup', () => { cropDrag = null })
cropStage.addEventListener('pointercancel', () => { cropDrag = null })

cropZoom.addEventListener('input', () => {
  if (!cropState) return
  const newScale = parseFloat(cropZoom.value)
  const totalScale = cropState.baseScale * cropState.scale
  const centerX = cropState.x + (cropState.imgW * totalScale) / 2
  const centerY = cropState.y + (cropState.imgH * totalScale) / 2
  cropState.scale = newScale
  const newW = cropState.imgW * cropState.baseScale * newScale
  const newH = cropState.imgH * cropState.baseScale * newScale
  cropState.x = centerX - newW / 2
  cropState.y = centerY - newH / 2
  applyCropTransform()
})

cropConfirm.addEventListener('click', () => {
  if (!cropState) return
  const stageSize = cropState.stageSize
  const totalScale = cropState.baseScale * cropState.scale
  const sx = -cropState.x / totalScale
  const sy = -cropState.y / totalScale
  const sSize = stageSize / totalScale

  const out = 400
  const canvas = document.createElement('canvas')
  canvas.width = out
  canvas.height = out
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  try {
    ctx.drawImage(cropImage, sx, sy, sSize, sSize, 0, 0, out, out)
  } catch (err) {
    avatarMessage.textContent = '裁剪失败，请重试'
    avatarMessage.className = 'text-sm mt-3 text-red-500'
    return
  }

  canvas.toBlob(async (blob) => {
    if (!blob) return
    cropConfirm.disabled = true
    cropConfirm.textContent = '上传中...'
    try {
      const path = `avatars/${currentUser.id}-${Date.now()}.jpg`
      const { data: ud, error: ue } = await supabase.storage.from('uploads').upload(path, blob, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'image/jpeg',
      })
      if (ue) throw ue

      const { data: u } = supabase.storage.from('uploads').getPublicUrl(ud.path)

      const oldUrl = getAvatarUrl(currentUser)
      if (oldUrl && oldUrl.includes('/uploads/')) {
        const oldPath = oldUrl.split('/uploads/').pop().split('?')[0]
        if (oldPath && oldPath !== ud.path) {
          await supabase.storage.from('uploads').remove([oldPath]).catch(() => {})
        }
      }

      const { data: updated, error: e2 } = await supabase.auth.updateUser({ data: { avatar_url: u.publicUrl } })
      if (e2) throw e2

      currentUser = updated.user
      await upsertProfile()
      renderAvatarPreview()
      updateSidebarUser()
      closeCropModal()
      avatarMessage.textContent = '头像已更新'
      avatarMessage.className = 'text-sm mt-3 text-green-500'
      setTimeout(() => avatarMessage.classList.add('hidden'), 2000)
    } catch (err) {
      avatarMessage.textContent = `上传失败：${err.message}`
      avatarMessage.className = 'text-sm mt-3 text-red-500'
      cropConfirm.disabled = false
      cropConfirm.textContent = '确定'
    }
  }, 'image/jpeg', 0.9)
})

userSaveProfile.addEventListener('click', async () => {
  const nick = userNicknameInput.value.trim()
  if (nick.length > 24) { profileMessage.textContent = '昵称最多 24 个字符'; profileMessage.className = 'text-sm mb-4 text-red-500'; return }
  userSaveProfile.disabled = true
  userSaveProfile.textContent = '保存中...'
  try {
    const { data: updated, error } = await supabase.auth.updateUser({ data: { nickname: nick || null } })
    if (error) throw error
    currentUser = updated.user
    await upsertProfile()
    updateSidebarUser()
    profileMessage.textContent = '已保存'
    profileMessage.className = 'text-sm mb-4 text-green-500'
    setTimeout(() => profileMessage.classList.add('hidden'), 2000)
  } catch (err) {
    profileMessage.textContent = `保存失败：${err.message}`
    profileMessage.className = 'text-sm mb-4 text-red-500'
  } finally {
    userSaveProfile.disabled = false
    userSaveProfile.textContent = '保存修改'
  }
})

function showPasswordMessage(text, ok) {
  passwordMessage.textContent = text
  passwordMessage.className = ok ? 'text-sm text-green-500 mb-4' : 'text-sm text-red-500 mb-4'
}

async function handlePasswordUpdate() {
  if (!currentUser) return
  const needsCurrent = !userCurrentPasswordWrap.classList.contains('hidden')
  const current = userCurrentPassword.value
  const next = userNewPassword.value
  const confirm = userConfirmPassword.value

  if (needsCurrent && !current) { showPasswordMessage('请输入当前密码', false); userCurrentPassword.focus(); return }
  if (!next) { showPasswordMessage('请输入新密码', false); userNewPassword.focus(); return }
  if (next.length < 8) { showPasswordMessage('新密码至少 8 位', false); userNewPassword.focus(); return }
  if (next !== confirm) { showPasswordMessage('两次输入的新密码不一致', false); userConfirmPassword.focus(); return }
  if (needsCurrent && next === current) { showPasswordMessage('新密码不能与当前密码相同', false); return }

  userSavePassword.disabled = true
  userSavePassword.textContent = '更新中...'
  try {
    if (needsCurrent) {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: currentUser.email,
        password: current,
      })
      if (authError) { showPasswordMessage('当前密码不正确', false); return }
    }
    const { error } = await supabase.auth.updateUser({ password: next })
    if (error) { showPasswordMessage(`更新失败：${error.message}`, false); return }
    userCurrentPassword.value = ''
    userNewPassword.value = ''
    userConfirmPassword.value = ''
    showPasswordMessage('密码已更新，下次登录请使用新密码。', true)
  } catch (e) {
    showPasswordMessage(`更新失败：${e?.message || '未知错误'}`, false)
  } finally {
    userSavePassword.disabled = false
    userSavePassword.textContent = '更新密码'
  }
}

userSavePassword.addEventListener('click', handlePasswordUpdate)
;[userCurrentPassword, userNewPassword, userConfirmPassword].forEach((input) => {
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handlePasswordUpdate() }
  })
})

userGithubLogin.addEventListener('click', async () => {
  const base = window.location.origin + window.location.pathname
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo: base },
  })
  if (error) console.error(error.message)
})

// ── QQ 登录（授权码流程）─────────────────────────────────────────────
const QQ_AUTHORIZE_URL = 'https://graph.qq.com/oauth2.0/authorize'
