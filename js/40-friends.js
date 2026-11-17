/* ─────────────────────────────────────────────────────────────
 * 40-friends.js · 好友
 * 该文件由原 index.html 内联脚本按顺序拆分而来，文件编号即执行顺序。
 * ───────────────────────────────────────────────────────────── */
'use strict'

function showFriendsMessage(text, type) {
  friendsMessage.textContent = text
  friendsMessage.className = type === 'success'
    ? 'text-sm mt-2 text-green-500'
    : 'text-sm mt-2 text-red-500'
}
function clearFriendsMessage() {
  friendsMessage.textContent = ''
  friendsMessage.className = 'hidden text-sm mt-2'
}

async function loadFriends() {
  if (!currentUser) { friends = []; return }
  const { data, error } = await supabase.from('friends').select('*')
  if (error) { friends = []; return }
  const rows = data || []
  const otherIds = rows.map((r) => (r.user_id === currentUser.id ? r.friend_id : r.user_id))
  let profMap = {}
  if (otherIds.length > 0) {
    const { data: profs } = await supabase.from('profiles').select('*').in('id', otherIds)
    ;(profs || []).forEach((p) => { profMap[p.id] = p })
  }
  friends = rows.map((r) => {
    const otherId = r.user_id === currentUser.id ? r.friend_id : r.user_id
    const p = profMap[otherId] || {}
              return {
      id: otherId,
      nickname: p.nickname || '未知用户',
      avatar_url: p.avatar_url || null,
      remark: p.remark || '',
      status: r.status || 'pending',
      direction: r.user_id === currentUser.id ? 'out' : 'in',
      recordId: r.id,
    }
  })
}

function renderFriends() {
  friendsList.innerHTML = ''
  if (!currentUser) {
    const li = document.createElement('li')
    li.className = 'text-sm text-zinc-400 dark:text-zinc-500 py-6 text-center'
    li.textContent = '请先登录'
    friendsList.appendChild(li)
    return
  }
  if (friends.length === 0) {
    const li = document.createElement('li')
    li.className = 'text-sm text-zinc-400 dark:text-zinc-500 py-6 text-center'
    li.textContent = '还没有好友，试试添加一个吧'
    friendsList.appendChild(li)
    return
  }
  const sorted = friends.slice().sort((a, b) => {
    const w = (x) => (x.status === 'pending' && x.direction === 'in' ? 0 : 1)
    return w(a) - w(b)
  })
          sorted.forEach((f) => {
            const li = document.createElement('li')
            li.className = 'flex items-center gap-3 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-[0.99] transition-all duration-200'
            li.dataset.friendId = f.id
            li.setAttribute('role', 'button')
            li.setAttribute('tabindex', '0')

    const avatar = document.createElement('div')
    avatar.className = 'w-10 h-10 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center shrink-0'
    if (f.avatar_url) {
      const img = document.createElement('img')
      img.src = f.avatar_url
      img.alt = f.nickname
      img.className = 'w-full h-full object-cover'
      avatar.appendChild(img)
    } else {
      avatar.innerHTML = '<svg class="w-5 h-5 text-zinc-500 dark:text-zinc-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 016-6h4a6 6 0 016 6v1" /></svg>'
    }

    const info = document.createElement('div')
    info.className = 'flex-1 min-w-0'
    const nameEl = document.createElement('p')
    nameEl.className = 'text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate'
    nameEl.textContent = f.nickname
    const statusEl = document.createElement('p')
    statusEl.className = 'text-xs text-zinc-500 dark:text-zinc-400 truncate'
    if (f.status === 'accepted') statusEl.textContent = '好友'
    else if (f.status === 'pending' && f.direction === 'out') statusEl.textContent = '等待对方确认'
    else if (f.status === 'pending' && f.direction === 'in') statusEl.textContent = '请求添加你为好友'
    else statusEl.textContent = f.status
    info.appendChild(nameEl)
    info.appendChild(statusEl)

    const actions = document.createElement('div')
    actions.className = 'flex items-center gap-2 shrink-0'

    if (f.status === 'pending' && f.direction === 'in') {
      const acceptBtn = document.createElement('button')
      acceptBtn.type = 'button'
      acceptBtn.className = 'px-3 py-1 rounded-xl text-xs font-medium bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 active:scale-95 transition-all duration-200'
                  acceptBtn.textContent = '接受'
      acceptBtn.addEventListener('click', (e) => { e.stopPropagation(); acceptFriend(f) })

      const rejectBtn = document.createElement('button')
      rejectBtn.type = 'button'
      rejectBtn.className = 'px-3 py-1 rounded-xl text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95 transition-all duration-200'
                  rejectBtn.textContent = '拒绝'
      rejectBtn.addEventListener('click', (e) => { e.stopPropagation(); rejectFriend(f) })

      actions.appendChild(acceptBtn)
      actions.appendChild(rejectBtn)
    } else if (f.status === 'accepted') {
      const removeBtn = document.createElement('button')
      removeBtn.type = 'button'
      removeBtn.setAttribute('aria-label', '删除好友')
      removeBtn.className = 'p-2 rounded-xl text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-red-500 active:scale-95 transition-all duration-200'
      removeBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M6 6l1 14a2 2 0 002 2h6a2 2 0 002-2l1-14" /></svg>'
      removeBtn.addEventListener('click', (e) => { e.stopPropagation(); removeFriend(f) })
      actions.appendChild(removeBtn)
    } else if (f.status === 'pending' && f.direction === 'out') {
      const cancelBtn = document.createElement('button')
      cancelBtn.type = 'button'
      cancelBtn.className = 'px-3 py-1 rounded-xl text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95 transition-all duration-200'
                  cancelBtn.textContent = '取消'
      cancelBtn.addEventListener('click', (e) => { e.stopPropagation(); rejectFriend(f) })
      actions.appendChild(cancelBtn)
    }

    li.appendChild(avatar)
    li.appendChild(info)
    li.appendChild(actions)
    friendsList.appendChild(li)
  })
}

async function addFriendById(rawId) {
  if (!currentUser) return
  const id = rawId.trim()
  if (!id) return
  if (id === currentUser.id) { showFriendsMessage('不能添加自己为好友', 'error'); return }
  if (!UUID_RE.test(id)) { showFriendsMessage('用户 ID 格式不正确', 'error'); return }
  if (friends.some((f) => f.id === id)) { showFriendsMessage('已存在好友关系或待确认请求', 'error'); return }
  const { data: prof } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
  if (!prof) { showFriendsMessage('未找到该用户', 'error'); return }
  const { error } = await supabase.from('friends').insert({
    user_id: currentUser.id,
    friend_id: id,
    status: 'pending',
  })
  if (error) { showFriendsMessage(`添加失败：${error.message}`, 'error'); return }
  showFriendsMessage('已发送好友请求', 'success')
  friendsIdInput.value = ''
  await loadFriends()
  renderFriends()
  renderProjectFriendSelect()
}

async function acceptFriend(f) {
  await supabase.from('friends').update({ status: 'accepted' }).eq('id', f.recordId)
  await loadFriends()
  renderFriends()
  renderProjectFriendSelect()
}
      async function rejectFriend(f) {
  const isCancel = f.status === 'pending' && f.direction === 'out'
  const isReject = f.status === 'pending' && f.direction === 'in'
  const name = getFriendDisplayName(f)
  const title = isCancel ? '取消好友请求' : '拒绝好友请求'
  const message = isCancel
    ? `确定要取消向「${name}」发送的好友请求吗？`
    : `确定要拒绝「${name}」的好友请求吗？`
  const ok = await confirmDialog({ title, message, okText: isCancel ? '取消请求' : '拒绝' })
  if (!ok) return false
  await supabase.from('friends').delete().eq('id', f.recordId)
  await loadFriends()
  renderFriends()
  renderProjectFriendSelect()
  return true
}
async function removeFriend(f) {
  const ok = await confirmDialog({
    title: '删除好友',
    message: `确定要删除好友「${getFriendDisplayName(f)}」吗？此操作不可恢复。`,
    okText: '删除',
  })
  if (!ok) return false
  await supabase.from('friends').delete().eq('id', f.recordId)
  await loadFriends()
  renderFriends()
  renderProjectFriendSelect()
  return true
}

let activeFriendHomeId = null

function getFriendDisplayName(f) {
  if (!f) return '未知用户'
  return (f.remark && f.remark.trim()) ? f.remark.trim() : (f.nickname || '未知用户')
}

function friendStatusText(f) {
  if (f.status === 'accepted') return { text: '好友', cls: 'bg-green-50 dark:bg-green-900/20 text-green-500' }
  if (f.status === 'pending' && f.direction === 'out') return { text: '等待对方确认', cls: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400' }
  if (f.status === 'pending' && f.direction === 'in') return { text: '请求添加你为好友', cls: 'bg-blue-50 dark:bg-blue-900/20 text-blue-500' }
  return { text: f.status || '未知', cls: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400' }
}

function matchesFriendReport(report, friend) {
  if (!report || !friend) return false
  if (report.user_id && report.user_id === friend.id) return true
  if (report.nickname && report.nickname === friend.nickname) return true
  return false
}

function collectFriendActivity(friend) {
  const activities = []
  tasks.forEach((t) => {
    ;(t.reports || []).forEach((r) => {
      if (matchesFriendReport(r, friend)) {
        activities.push({ taskTitle: t.title, time: r.time || 0, note: r.note || '' })
      }
    })
  })
  activities.sort((a, b) => b.time - a.time)
  return activities
}

function collectSharedProjects(friend) {
  const name = (friend.nickname || '').trim()
  if (!name) return []
  return projects.filter((p) => (p.invitees || []).some((n) => String(n).trim() === name))
}

function createStatCard(label, value, accent) {
  const box = document.createElement('div')
  box.className = 'rounded-2xl border border-zinc-100 dark:border-zinc-800 p-4 bg-zinc-50 dark:bg-zinc-800/50'
  const v = document.createElement('p')
  v.className = 'font-semibold text-2xl ' + (accent || 'text-zinc-900 dark:text-zinc-100')
  v.textContent = String(value)
  const l = document.createElement('p')
  l.className = 'text-xs text-zinc-500 dark:text-zinc-400 mt-1'
  l.textContent = label
  box.appendChild(v); box.appendChild(l)
  return box
}

function renderFriendHome(f) {
  if (!f) return
  friendsHomeBody.innerHTML = ''

  const header = document.createElement('div')
  header.className = 'flex items-center gap-4'
  const avatar = document.createElement('div')
  avatar.className = 'w-16 h-16 rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0'
  if (f.avatar_url) {
    const img = document.createElement('img')
    img.src = f.avatar_url
    img.alt = f.nickname
    img.className = 'w-full h-full object-cover'
    avatar.appendChild(img)
  } else {
    avatar.innerHTML = '<svg class="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 016-6h4a6 6 0 016 6v1" /></svg>'
  }
  const info = document.createElement('div')
  info.className = 'min-w-0 flex-1'
  const nameEl = document.createElement('h3')
  nameEl.className = 'font-semibold text-zinc-900 dark:text-zinc-100 text-xl truncate'
  nameEl.textContent = getFriendDisplayName(f)
  info.appendChild(nameEl)
  if (f.remark) {
    const orig = document.createElement('p')
    orig.className = 'text-xs text-zinc-400 dark:text-zinc-500 truncate mt-0.5'
    orig.textContent = '昵称：' + (f.nickname || '未知用户')
    info.appendChild(orig)
  }
  const status = friendStatusText(f)
  const badge = document.createElement('span')
  badge.className = 'inline-block px-3 py-1 rounded-xl text-xs mt-2 ' + status.cls
  badge.textContent = status.text
  info.appendChild(badge)
  header.appendChild(avatar); header.appendChild(info)
  friendsHomeBody.appendChild(header)

  const idLine = document.createElement('div')
  idLine.className = 'flex items-center gap-2'
  const idText = document.createElement('span')
  idText.className = 'text-xs text-zinc-500 dark:text-zinc-400 font-mono break-all flex-1 min-w-0'
  idText.textContent = f.id || '-'
  const copyBtn = document.createElement('button')
  copyBtn.type = 'button'
  copyBtn.className = 'shrink-0 px-3 py-1 rounded-xl text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95 transition-all duration-200'
  copyBtn.textContent = '复制 ID'
  copyBtn.addEventListener('click', async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(f.id)
      else {
        const ta = document.createElement('textarea')
        ta.value = f.id
        ta.style.position = 'fixed'; ta.style.opacity = '0'
        document.body.appendChild(ta); ta.select()
        document.execCommand('copy'); document.body.removeChild(ta)
      }
      copyBtn.textContent = '已复制'
      setTimeout(() => { copyBtn.textContent = '复制 ID' }, 1500)
    } catch (_) {}
  })
  idLine.appendChild(idText); idLine.appendChild(copyBtn)
  friendsHomeBody.appendChild(idLine)

  const activity = collectFriendActivity(f)
  const shared = collectSharedProjects(f)
  const statsWrap = document.createElement('div')
  statsWrap.className = 'grid grid-cols-3 gap-3'
  statsWrap.appendChild(createStatCard('共同项目', shared.length, 'text-blue-500'))
  statsWrap.appendChild(createStatCard('上报次数', activity.length, 'text-purple-500'))
  statsWrap.appendChild(createStatCard('参与任务', new Set(activity.map((a) => a.taskTitle)).size, 'text-green-500'))
  friendsHomeBody.appendChild(statsWrap)

  const remarkSection = document.createElement('div')
  const remarkLabel = document.createElement('p')
  remarkLabel.className = 'text-xs text-zinc-500 dark:text-zinc-400 mb-2'
  remarkLabel.textContent = '备注'
  const remarkRow = document.createElement('div')
  remarkRow.className = 'flex items-center gap-3'
  const remarkInput = document.createElement('input')
  remarkInput.type = 'text'
  remarkInput.maxLength = 24
  remarkInput.value = f.remark || ''
  remarkInput.placeholder = '给该好友添加备注名...'
  remarkInput.className = 'flex-1 min-w-0 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all'
  const remarkSave = document.createElement('button')
  remarkSave.type = 'button'
  remarkSave.className = 'shrink-0 px-4 py-2 rounded-xl font-medium text-sm bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 active:scale-95 transition-all duration-200'
  remarkSave.textContent = '保存'
  const remarkMsg = document.createElement('p')
  remarkMsg.className = 'hidden text-xs mt-2'
  const saveRemark = async () => {
    const val = remarkInput.value.trim()
    if (val.length > 24) {
      remarkMsg.textContent = '备注最多 24 个字符'
      remarkMsg.className = 'text-xs mt-2 text-red-500'
      return
    }
    remarkSave.disabled = true
    remarkSave.textContent = '保存中...'
    const { error } = await supabase.from('profiles').update({ remark: val || null }).eq('id', f.id)
    remarkSave.disabled = false
    remarkSave.textContent = '保存'
    if (error) {
      remarkMsg.textContent = '保存失败：' + error.message
      remarkMsg.className = 'text-xs mt-2 text-red-500'
      return
    }
    const target = friends.find((x) => x.id === f.id)
    if (target) target.remark = val
    remarkMsg.textContent = '已保存'
    remarkMsg.className = 'text-xs mt-2 text-green-500'
    setTimeout(() => remarkMsg.classList.add('hidden'), 2000)
    const nameNode = friendsHomeBody.querySelector('h3')
    if (nameNode) nameNode.textContent = getFriendDisplayName({ ...f, remark: val })
  }
  remarkSave.addEventListener('click', saveRemark)
  remarkInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveRemark() } })
  remarkRow.appendChild(remarkInput); remarkRow.appendChild(remarkSave)
  remarkSection.appendChild(remarkLabel); remarkSection.appendChild(remarkRow); remarkSection.appendChild(remarkMsg)
  friendsHomeBody.appendChild(remarkSection)

  const activitySection = document.createElement('div')
  activitySection.className = 'pt-4 border-t border-zinc-100 dark:border-zinc-800'
  const activityLabel = document.createElement('h4')
  activityLabel.className = 'font-semibold text-zinc-900 dark:text-zinc-100 text-sm mb-3'
  activityLabel.textContent = '近期动态'
  activitySection.appendChild(activityLabel)
  if (activity.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'text-sm text-zinc-400 dark:text-zinc-500 py-2'
    empty.textContent = '暂无动态'
    activitySection.appendChild(empty)
  } else {
    const ul = document.createElement('ul')
    ul.className = 'flex flex-col'
    activity.slice(0, 5).forEach((a) => {
      const li = document.createElement('li')
      li.className = 'flex items-start justify-between gap-4 py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0'
      const left = document.createElement('span')
      left.className = 'text-sm text-zinc-900 dark:text-zinc-100 truncate'
      left.textContent = `上报了「${a.taskTitle}」`
      const right = document.createElement('span')
      right.className = 'text-xs text-zinc-400 dark:text-zinc-500 shrink-0'
      right.textContent = a.time ? fmtRel(a.time) : ''
      li.appendChild(left); li.appendChild(right); ul.appendChild(li)
    })
    activitySection.appendChild(ul)
  }
  friendsHomeBody.appendChild(activitySection)

  const sharedSection = document.createElement('div')
  sharedSection.className = 'pt-4 border-t border-zinc-100 dark:border-zinc-800'
  const sharedLabel = document.createElement('h4')
  sharedLabel.className = 'font-semibold text-zinc-900 dark:text-zinc-100 text-sm mb-3'
  sharedLabel.textContent = '共同项目'
  sharedSection.appendChild(sharedLabel)
  if (shared.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'text-sm text-zinc-400 dark:text-zinc-500 py-2'
    empty.textContent = '暂无共同项目'
    sharedSection.appendChild(empty)
  } else {
    const chipWrap = document.createElement('div')
    chipWrap.className = 'flex flex-wrap gap-2'
    shared.forEach((p) => {
      const chip = document.createElement('span')
      chip.className = 'px-3 py-1 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-500 text-xs'
      chip.textContent = p.name
      chipWrap.appendChild(chip)
    })
    sharedSection.appendChild(chipWrap)
  }
  friendsHomeBody.appendChild(sharedSection)

  const actions = document.createElement('div')
  actions.className = 'pt-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap gap-3'
  if (f.status === 'accepted') {
    const removeBtn = document.createElement('button')
    removeBtn.type = 'button'
    removeBtn.className = 'px-4 py-2 rounded-xl font-medium text-sm bg-zinc-100 dark:bg-zinc-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-95 transition-all duration-200'
              removeBtn.textContent = '删除好友'
    removeBtn.addEventListener('click', async () => { const done = await removeFriend(f); if (done) closeFriendHome() })
    actions.appendChild(removeBtn)
  } else if (f.status === 'pending' && f.direction === 'in') {
    const acceptBtn = document.createElement('button')
    acceptBtn.type = 'button'
    acceptBtn.className = 'px-4 py-2 rounded-xl font-medium text-sm bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 active:scale-95 transition-all duration-200'
              acceptBtn.textContent = '接受'
    acceptBtn.addEventListener('click', async () => { await acceptFriend(f); refreshFriendHome(f.id) })
    const rejectBtn = document.createElement('button')
    rejectBtn.type = 'button'
    rejectBtn.className = 'px-4 py-2 rounded-xl font-medium text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95 transition-all duration-200'
    rejectBtn.textContent = '拒绝'
    rejectBtn.addEventListener('click', async () => { const done = await rejectFriend(f); if (done) closeFriendHome() })
    actions.appendChild(acceptBtn); actions.appendChild(rejectBtn)
  } else if (f.status === 'pending' && f.direction === 'out') {
    const cancelBtn = document.createElement('button')
    cancelBtn.type = 'button'
    cancelBtn.className = 'px-4 py-2 rounded-xl font-medium text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95 transition-all duration-200'
              cancelBtn.textContent = '取消请求'
    cancelBtn.addEventListener('click', async () => { const done = await rejectFriend(f); if (done) closeFriendHome() })
    actions.appendChild(cancelBtn)
  }
  friendsHomeBody.appendChild(actions)
}

function refreshFriendHome(friendId) {
  const f = friends.find((x) => x.id === friendId)
  if (f) {
    activeFriendHomeId = friendId
    renderFriendHome(f)
  } else {
    closeFriendHome()
  }
}

function openFriendHome(f) {
  activeFriendHomeId = f.id
  renderFriendHome(f)
  friendsMain.classList.add('hidden')
  friendsHome.classList.remove('hidden')
}

function closeFriendHome() {
  activeFriendHomeId = null
  friendsHome.classList.add('hidden')
  friendsMain.classList.remove('hidden')
}

      function openFriendsModal() {
  if (!currentUser) { openUserModal(); return }
  clearFriendsMessage()
  friendsIdInput.value = ''
  closeFriendHome()
  friendsModal.classList.remove('hidden')
  syncBodyScroll()
  loadFriends().then(() => {
    renderFriends()
    if (activeFriendHomeId) refreshFriendHome(activeFriendHomeId)
  })
  setTimeout(() => friendsIdInput.focus(), 50)
}
function closeFriendsModal() {
  friendsModal.classList.add('hidden')
  closeFriendHome()
  syncBodyScroll()
}

      friendsOpen.addEventListener('click', openFriendsModal)
      friendsClose.addEventListener('click', closeFriendsModal)
      friendsBackdrop.addEventListener('click', closeFriendsModal)
      friendsHomeBack.addEventListener('click', closeFriendHome)
      friendsHomeClose.addEventListener('click', closeFriendsModal)
      friendsList.addEventListener('click', (e) => {
        const row = e.target.closest('[data-friend-id]')
        if (!row || !friendsList.contains(row)) return
        const f = friends.find((x) => x.id === row.dataset.friendId)
        if (f) openFriendHome(f)
      })
      friendsList.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        const row = e.target.closest('[data-friend-id]')
        if (!row || !friendsList.contains(row)) return
        e.preventDefault()
        const f = friends.find((x) => x.id === row.dataset.friendId)
        if (f) openFriendHome(f)
      })
friendsAdd.addEventListener('click', () => addFriendById(friendsIdInput.value))
friendsIdInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); addFriendById(friendsIdInput.value) }
})

const projectAddOpen = document.getElementById('project-add-open')
const projectClose = document.getElementById('project-close')
const projectBackdrop = document.getElementById('project-backdrop')
const projectList = document.getElementById('project-list')
const projectDetail = document.getElementById('project-detail')
const projectSubtitle = document.getElementById('project-subtitle')
      const projectNameInput = document.getElementById('project-name-input')
const projectFieldInput = document.getElementById('project-field-input')
const projectModalTitle = document.getElementById('project-modal-title')
const projectInviteInput = document.getElementById('project-invite-input')
const projectInviteAdd = document.getElementById('project-invite-add')
const projectInviteList = document.getElementById('project-invite-list')
const projectFriendSelect = document.getElementById('project-friend-select')
const projectCreatedPreview = document.getElementById('project-created-preview')
const projectMessage = document.getElementById('project-message')
const projectSubmit = document.getElementById('project-submit')
