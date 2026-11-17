/* ─────────────────────────────────────────────────────────────
 * 50-projects.js · 项目
 * 该文件由原 index.html 内联脚本按顺序拆分而来，文件编号即执行顺序。
 * ───────────────────────────────────────────────────────────── */
'use strict'

async function loadProjects() {
  if (!currentUser) {
    projects = []
    activeProjectId = null
    renderProjects()
    return
  }
  const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
  if (error) {
    console.error(error.message)
    projects = []
  } else {
    projects = (data || []).map((p) => ({ ...p, invitees: p.invitees || [] }))
  }
  if (!projects.some((p) => p.id === activeProjectId)) activeProjectId = projects[0]?.id || null
  renderProjects()
}

function renderProjects() {
  projectSubtitle.textContent = currentUser
    ? (projects.length > 0 ? `共 ${projects.length} 个项目` : '管理团队研究项目')
    : '管理团队研究项目'

  projectList.innerHTML = ''
  if (!currentUser) {
    const li = document.createElement('li')
    li.className = 'text-sm text-zinc-400 dark:text-zinc-500 py-6 text-center'
    li.textContent = '请先登录'
    projectList.appendChild(li)
  } else if (projects.length === 0) {
    const li = document.createElement('li')
    li.className = 'text-sm text-zinc-400 dark:text-zinc-500 py-6 text-center'
    li.textContent = '暂无项目'
    projectList.appendChild(li)
  } else {
    projects.forEach((p) => {
      const li = document.createElement('li')
      const btn = document.createElement('button')
      btn.type = 'button'
      const active = p.id === activeProjectId
      btn.className = 'w-full text-left rounded-xl px-3 py-2 transition-all duration-200 ' +
        (active ? 'bg-zinc-100 dark:bg-zinc-800' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800')
      const name = document.createElement('p')
      name.className = 'text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate'
      name.textContent = p.name
      const field = document.createElement('p')
      field.className = 'text-xs text-zinc-500 dark:text-zinc-400 truncate mt-1'
      field.textContent = p.research_field || '未填写研究方向'
      btn.appendChild(name); btn.appendChild(field)
      btn.addEventListener('click', () => { activeProjectId = p.id; renderProjects() })
      li.appendChild(btn)
      projectList.appendChild(li)
    })
  }
  renderProjectDetail()
}

function renderProjectDetail() {
  projectDetail.innerHTML = ''
  if (!currentUser) {
    const p = document.createElement('p')
    p.className = 'text-sm text-zinc-400 dark:text-zinc-500 py-10 text-center'
    p.textContent = '请先登录以查看项目详情'
    projectDetail.appendChild(p)
    return
  }
  const proj = projects.find((x) => x.id === activeProjectId)
  if (!proj) {
    const p = document.createElement('p')
    p.className = 'text-sm text-zinc-400 dark:text-zinc-500 py-10 text-center'
    p.textContent = '选择左侧项目查看详情，或新建一个项目'
    projectDetail.appendChild(p)
    return
  }

  const head = document.createElement('div')
  head.className = 'flex items-start justify-between gap-4 mb-6'
  const info = document.createElement('div')
  info.className = 'min-w-0'
  const title = document.createElement('h2')
  title.className = 'font-semibold text-zinc-900 dark:text-zinc-100 text-xl md:text-2xl truncate'
  title.textContent = proj.name
  const fieldLine = document.createElement('p')
  fieldLine.className = 'text-zinc-600 dark:text-zinc-400 text-sm mt-1 truncate'
  fieldLine.textContent = `研究方向：${proj.research_field || '未填写'}`
  info.appendChild(title); info.appendChild(fieldLine)

          const headActions = document.createElement('div')
  headActions.className = 'flex items-center gap-2 shrink-0'

  const editBtn = document.createElement('button')
  editBtn.type = 'button'
  editBtn.setAttribute('aria-label', '编辑项目')
  editBtn.className = 'shrink-0 p-2 rounded-xl text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-blue-500 active:scale-95 transition-all duration-200'
  editBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z" /></svg>'
  editBtn.addEventListener('click', () => openProjectEdit(proj))

  const delBtn = document.createElement('button')
  delBtn.type = 'button'
  delBtn.setAttribute('aria-label', '删除项目')
  delBtn.className = 'shrink-0 p-2 rounded-xl text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-red-500 active:scale-95 transition-all duration-200'
  delBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M6 6l1 14a2 2 0 002 2h6a2 2 0 002-2l1-14" /></svg>'
          delBtn.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: '删除项目',
      message: `确定要删除项目「${proj.name || '未命名'}」吗？此操作不可恢复。`,
      okText: '删除',
    })
    if (!ok) return
    await supabase.from('projects').delete().eq('id', proj.id)
    projects = projects.filter((x) => x.id !== proj.id)
    if (activeProjectId === proj.id) activeProjectId = projects[0]?.id || null
    renderProjects()
  })
  headActions.appendChild(editBtn); headActions.appendChild(delBtn)
  head.appendChild(info); head.appendChild(headActions)
  projectDetail.appendChild(head)

  const stats = document.createElement('div')
  stats.className = 'flex flex-wrap gap-6 mb-6'
  const mkStat = (label, value) => {
    const box = document.createElement('div')
    const l = document.createElement('p')
    l.className = 'text-xs text-zinc-500 dark:text-zinc-400 mb-1'
    l.textContent = label
    const v = document.createElement('p')
    v.className = 'text-sm text-zinc-900 dark:text-zinc-100'
    v.textContent = value
    box.appendChild(l); box.appendChild(v)
    return box
  }
  stats.appendChild(mkStat('研究方向', proj.research_field || '未填写'))
  stats.appendChild(mkStat('创建时间', fmtDateTime(proj.created_at)))
  stats.appendChild(mkStat('邀请人数', `${(proj.invitees || []).length} 人`))
  projectDetail.appendChild(stats)

  const inviteSection = document.createElement('div')
  inviteSection.className = 'pt-6 border-t border-zinc-100 dark:border-zinc-800'
  const inviteLabel = document.createElement('p')
  inviteLabel.className = 'text-sm text-zinc-600 dark:text-zinc-400 mb-3'
  inviteLabel.textContent = '邀请好友'
  inviteSection.appendChild(inviteLabel)
  const chipWrap = document.createElement('div')
  chipWrap.className = 'flex flex-wrap gap-3'
  const invitees = proj.invitees || []
  if (invitees.length === 0) {
    const empty = document.createElement('span')
    empty.className = 'text-sm text-zinc-400 dark:text-zinc-500'
    empty.textContent = '暂未邀请好友'
    chipWrap.appendChild(empty)
  } else {
    invitees.forEach((name) => {
      const chip = document.createElement('span')
      chip.className = 'px-3 py-1 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-500 text-xs'
      chip.textContent = name
      chipWrap.appendChild(chip)
    })
  }
  inviteSection.appendChild(chipWrap)
  projectDetail.appendChild(inviteSection)
}

function renderDraftInvitees() {
  projectInviteList.innerHTML = ''
  draftInvitees.forEach((name, idx) => {
    const chip = document.createElement('span')
    chip.className = 'inline-flex items-center gap-3 px-3 py-1 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-500 text-xs'
    const text = document.createElement('span')
    text.textContent = name
    const del = document.createElement('button')
    del.type = 'button'
    del.setAttribute('aria-label', '移除邀请')
    del.className = 'hover:text-red-500 transition-colors duration-200'
    del.innerHTML = '<svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>'
    del.addEventListener('click', () => { draftInvitees.splice(idx, 1); renderDraftInvitees(); renderProjectFriendSelect() })
    chip.appendChild(text); chip.appendChild(del)
    projectInviteList.appendChild(chip)
  })
}

function renderProjectFriendSelect() {
  projectFriendSelect.innerHTML = ''
  if (!currentUser) return
  const accepted = friends.filter((f) => f.status === 'accepted')
  if (accepted.length === 0) {
    const p = document.createElement('p')
    p.className = 'text-xs text-zinc-400 dark:text-zinc-500 py-1'
    p.textContent = '暂无好友，先在侧边栏「好友」中添加'
    projectFriendSelect.appendChild(p)
    return
  }
  accepted.forEach((f) => {
    const selected = draftInvitees.includes(f.nickname)
    const chip = document.createElement('button')
    chip.type = 'button'
    chip.className = selected
      ? 'inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 active:scale-95 transition-all duration-200'
      : 'inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95 transition-all duration-200'
    const av = document.createElement('span')
    av.className = 'w-4 h-4 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center shrink-0'
    if (f.avatar_url) {
      const img = document.createElement('img')
      img.src = f.avatar_url
      img.alt = f.nickname
      img.className = 'w-full h-full object-cover'
      av.appendChild(img)
    }
    chip.appendChild(av)
    const txt = document.createElement('span')
    txt.textContent = f.nickname
    chip.appendChild(txt)
    chip.addEventListener('click', () => {
      const idx = draftInvitees.indexOf(f.nickname)
      if (idx >= 0) draftInvitees.splice(idx, 1)
      else draftInvitees.push(f.nickname)
      renderDraftInvitees()
      renderProjectFriendSelect()
    })
    projectFriendSelect.appendChild(chip)
  })
}

function addDraftInvitee() {
  const v = projectInviteInput.value.trim()
  if (!v) return
  if (draftInvitees.includes(v)) { projectInviteInput.value = ''; return }
  draftInvitees.push(v)
  projectInviteInput.value = ''
  renderDraftInvitees()
  renderProjectFriendSelect()
}
projectInviteAdd.addEventListener('click', addDraftInvitee)
projectInviteInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addDraftInvitee() } })

      function openProjectModal() {
  if (!currentUser) { openUserModal(); return }
  editingProjectId = null
  projectModalTitle.textContent = '新建项目'
  projectNameInput.value = ''
  projectFieldInput.value = ''
  projectInviteInput.value = ''
  draftInvitees = []
  renderDraftInvitees()
  renderProjectFriendSelect()
  projectCreatedPreview.textContent = fmtDateTime(Date.now())
  projectMessage.textContent = ''
  projectMessage.className = 'hidden text-sm mb-4'
  projectSubmit.disabled = false
  projectSubmit.textContent = '创建项目'
  projectModal.classList.remove('hidden')
  syncBodyScroll()
  projectNameInput.focus()
}
function openProjectEdit(proj) {
  if (!proj) return
  editingProjectId = proj.id
  projectModalTitle.textContent = '编辑项目'
  projectNameInput.value = proj.name || ''
  projectFieldInput.value = proj.research_field || ''
  projectInviteInput.value = ''
  draftInvitees = (proj.invitees || []).slice()
  renderDraftInvitees()
  renderProjectFriendSelect()
  projectCreatedPreview.textContent = fmtDateTime(proj.created_at || Date.now())
  projectMessage.textContent = ''
  projectMessage.className = 'hidden text-sm mb-4'
  projectSubmit.disabled = false
  projectSubmit.textContent = '保存修改'
  projectModal.classList.remove('hidden')
  syncBodyScroll()
  projectNameInput.focus()
}
function closeProjectModal() {
  projectModal.classList.add('hidden')
  editingProjectId = null
  syncBodyScroll()
}

projectAddOpen.addEventListener('click', openProjectModal)
projectClose.addEventListener('click', closeProjectModal)
projectBackdrop.addEventListener('click', closeProjectModal)

      projectSubmit.addEventListener('click', async () => {
  const name = projectNameInput.value.trim()
  if (!name) { projectNameInput.focus(); return }
  const researchField = projectFieldInput.value.trim()
  const isEdit = Boolean(editingProjectId)
  projectSubmit.disabled = true
  projectSubmit.textContent = isEdit ? '保存中...' : '创建中...'
  if (isEdit) {
    const { data, error } = await supabase
      .from('projects')
      .update({
        name,
        research_field: researchField || null,
        invitees: draftInvitees.slice(),
      })
      .eq('id', editingProjectId)
      .select()
      .single()
    projectSubmit.disabled = false
    projectSubmit.textContent = '保存修改'
    if (error) {
      projectMessage.textContent = `保存失败：${error.message}`
      projectMessage.className = 'text-sm mb-4 text-red-500'
      return
    }
    const idx = projects.findIndex((x) => x.id === editingProjectId)
    if (idx >= 0) projects[idx] = { ...data, invitees: data.invitees || [] }
    renderProjects()
    closeProjectModal()
    return
  }
  const { data, error } = await supabase
    .from('projects')
    .insert({
      name,
      research_field: researchField || null,
      invitees: draftInvitees.slice(),
      created_at: new Date().toISOString(),
    })
    .select()
    .single()
  projectSubmit.disabled = false
  projectSubmit.textContent = '创建项目'
  if (error) {
    projectMessage.textContent = `创建失败：${error.message}`
    projectMessage.className = 'text-sm mb-4 text-red-500'
    return
  }
  projects.unshift({ ...data, invitees: data.invitees || [] })
  activeProjectId = data.id
  renderProjects()
  closeProjectModal()
})
projectNameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); projectSubmit.click() } })

const taskSummary = document.getElementById('task-summary')
const taskSearch = document.getElementById('task-search')
const taskAddOpen = document.getElementById('task-add-open')
const taskList = document.getElementById('task-list')
const statPending = document.getElementById('stat-pending')
const statDone = document.getElementById('stat-done')
const statReported = document.getElementById('stat-reported')
const statTotal = document.getElementById('stat-total')
const taskModalEl = document.getElementById('task-modal')
const taskClose = document.getElementById('task-close')
const taskBackdrop = document.getElementById('task-backdrop')
const taskTitleInput = document.getElementById('task-title-input')
const taskDescInput = document.getElementById('task-desc-input')
const taskModalTitle = document.getElementById('task-modal-title')
const taskTagInput = document.getElementById('task-tag-input')
const taskTagAdd = document.getElementById('task-tag-add')
const taskTagList = document.getElementById('task-tag-list')
const taskSubmit = document.getElementById('task-submit')
const dashGreeting = document.getElementById('dash-greeting')
const dashDate = document.getElementById('dash-date')
const dashTodayList = document.getElementById('dash-today-list')
const dashPending = document.getElementById('dash-pending')
const dashDone = document.getElementById('dash-done')
const dashReported = document.getElementById('dash-reported')
const dashActivity = document.getElementById('dash-activity')
const dashAddTask = document.getElementById('dash-add-task')
const dashNewTask = document.getElementById('dash-new-task')
