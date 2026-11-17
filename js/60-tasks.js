/* ─────────────────────────────────────────────────────────────
 * 60-tasks.js · 任务与工作台
 * 该文件由原 index.html 内联脚本按顺序拆分而来，文件编号即执行顺序。
 * ───────────────────────────────────────────────────────────── */
'use strict'

async function loadTasks() {
  if (!currentUser) { tasks = []; return }
  const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false })
  tasks = (data || []).map((t) => ({ ...t, tags: t.tags || [], reports: t.reports || [] }))
}

function countStats() {
  return {
    pending: tasks.filter((t) => !t.done).length,
    done: tasks.filter((t) => t.done).length,
    reported: tasks.filter((t) => t.reports?.length > 0).length,
    total: tasks.length,
  }
}

function updateStats() {
  const { pending, done, reported, total } = countStats()
  statPending.textContent = String(pending)
  statDone.textContent = String(done)
  statReported.textContent = String(reported)
  statTotal.textContent = String(total)
  taskSummary.textContent = `共 ${total} 个任务，${pending} 个进行中`
}

function renderDashboard() {
  const { pending, done, reported } = countStats()
  const now = new Date()
  const h = now.getHours()
  let g = '你好'
  if (h < 6) g = '凌晨好'
  else if (h < 12) g = '早上好'
  else if (h < 14) g = '中午好'
  else if (h < 18) g = '下午好'
  else g = '晚上好'
  dashGreeting.textContent = pending > 0 ? `${g}，今天有 ${pending} 件事要做` : `${g}，今天没有待办`
  dashDate.textContent = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
  dashTodayList.innerHTML = ''
  const focus = tasks.filter((t) => !t.done).slice(0, 4)
  if (focus.length === 0) {
    const li = document.createElement('li')
    li.innerHTML = '<span class="text-white/70 text-sm">今日暂无待办</span>'
    dashTodayList.appendChild(li)
  } else {
    focus.forEach((t) => {
      const li = document.createElement('li')
      li.className = 'flex items-start gap-3'
      li.innerHTML = `<span class="mt-1 w-2 h-2 rounded-full bg-white/70 shrink-0"></span><span>${escHtml(t.title)}</span>`
      dashTodayList.appendChild(li)
    })
  }
  dashPending.textContent = String(pending)
  dashDone.textContent = String(done)
  dashReported.textContent = String(reported)
  dashActivity.innerHTML = ''
  const activities = []
  tasks.forEach((t) => { (t.reports || []).forEach((r) => activities.push({ title: t.title, time: r.time })) })
  activities.sort((a, b) => b.time - a.time)
  const recent = activities.slice(0, 3)
  if (recent.length === 0) {
    const li = document.createElement('li')
    li.textContent = '暂无动态'
    dashActivity.appendChild(li)
  } else {
    recent.forEach((item) => {
      const li = document.createElement('li')
      li.className = 'flex justify-between gap-4'
      li.innerHTML = `<span class="truncate">上报了「${escHtml(item.title)}」</span><span class="text-zinc-400 dark:text-zinc-500 text-xs shrink-0">${fmtRel(item.time)}</span>`
      dashActivity.appendChild(li)
    })
  }
}

function matchesKeyword(t) {
  if (!keyword) return true
  const k = keyword.toLowerCase()
  if (t.title.toLowerCase().includes(k)) return true
  return (t.tags || []).some((tag) => tag.toLowerCase().includes(k))
}

function createTagChip(text) {
  const c = document.createElement('span')
  c.className = 'px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-500 text-xs whitespace-nowrap'
  c.textContent = text
  return c
}

      function getReportedUsers(reports) {
  const seen = new Set()
  const users = []
  ;(reports || []).forEach((r) => {
    const key = r.user_id || r.nickname || r.avatar_url
    if (!key || seen.has(key)) return
    seen.add(key)
    users.push({ avatar_url: r.avatar_url, nickname: r.nickname || '用户' })
  })
  return users
}

function createAvatarStack(reports) {
  const users = getReportedUsers(reports)
  const wrap = document.createElement('div')
  wrap.className = 'flex items-center shrink-0'
  if (users.length === 0) return wrap
  const max = 3
  const shown = users.slice(0, max)
  const rest = users.length - shown.length
  shown.forEach((u, idx) => {
    const a = document.createElement('div')
    a.className = 'w-6 h-6 rounded-full overflow-hidden border-2 border-white dark:border-zinc-900 bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center'
    if (idx > 0) a.style.marginLeft = '-8px'
    if (u.avatar_url) {
      const img = document.createElement('img')
      img.src = u.avatar_url
      img.alt = u.nickname
      img.className = 'w-full h-full object-cover'
      a.appendChild(img)
    } else {
      a.innerHTML = '<svg class="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 016-6h4a6 6 0 016 6v1" /></svg>'
    }
    a.title = u.nickname
    wrap.appendChild(a)
  })
  if (rest > 0) {
    const more = document.createElement('div')
    more.className = 'w-6 h-6 rounded-full border-2 border-white dark:border-zinc-900 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-medium text-zinc-600 dark:text-zinc-300'
    more.style.marginLeft = '-8px'
    more.textContent = '+' + rest
    more.title = `还有 ${rest} 人`
    wrap.appendChild(more)
  }
  return wrap
}

function renderTasks() {
  taskList.innerHTML = ''
  const visible = tasks.filter(matchesKeyword)
  if (visible.length === 0) {
    const empty = document.createElement('li')
    empty.className = 'text-sm text-zinc-400 dark:text-zinc-500 py-6 text-center'
    empty.textContent = keyword ? '没有匹配的任务' : currentUser ? '暂无任务，添加一个吧' : '请先登录'
    taskList.appendChild(empty); updateStats(); renderDashboard(); return
  }
  visible.forEach((task) => {
    const li = document.createElement('li')
    li.className = 'flex items-center justify-between gap-3 py-3'
    const left = document.createElement('div')
    left.className = 'flex items-center gap-3 min-w-0 flex-1'
    const dot = document.createElement('span')
    dot.className = task.done ? 'w-2 h-2 rounded-full bg-green-500 shrink-0' : 'w-2 h-2 rounded-full bg-blue-500 shrink-0'
    const title = document.createElement('span')
    title.className = task.done ? 'text-sm text-zinc-400 dark:text-zinc-500 truncate line-through' : 'text-sm text-zinc-900 dark:text-zinc-100 truncate'
    title.textContent = task.title
    left.appendChild(dot); left.appendChild(title)
    if (task.tags?.length > 0) {
      const wrap = document.createElement('div')
      wrap.className = 'flex items-center gap-3 shrink-0'
      task.tags.forEach((t) => wrap.appendChild(createTagChip(t)))
      left.appendChild(wrap)
    }
    if (task.reports?.length > 0) {
      left.appendChild(createAvatarStack(task.reports))
    }

    const actions = document.createElement('div')
    actions.className = 'flex items-center gap-1 shrink-0'

    const eBtn = document.createElement('button')
    eBtn.type = 'button'
    eBtn.setAttribute('aria-label', '编辑任务')
    eBtn.className = 'p-2 rounded-xl text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-blue-500 active:scale-95 transition-all duration-200'
    eBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>'
    eBtn.addEventListener('click', () => openTaskModal(task.id))
    actions.appendChild(eBtn)

    const mBtn = document.createElement('button')
    mBtn.type = 'button'
    mBtn.setAttribute('aria-label', '查看任务明细')
    mBtn.className = 'p-2 rounded-xl text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200 active:scale-95 transition-all duration-200'
    mBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5" fill="currentColor" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /><circle cx="19" cy="12" r="1.5" fill="currentColor" /></svg>'
    mBtn.addEventListener('click', () => openTaskDetail(task.id))
    actions.appendChild(mBtn)

    const rBtn = document.createElement('button')
    rBtn.type = 'button'
    rBtn.className = 'px-3 py-1.5 rounded-xl font-medium text-xs text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95 transition-all duration-200'
    rBtn.textContent = '上报'
    rBtn.addEventListener('click', () => openReport(task.id))
    actions.appendChild(rBtn)

    const dBtn = document.createElement('button')
    dBtn.type = 'button'
    dBtn.setAttribute('aria-label', '删除任务')
    dBtn.className = 'p-2 rounded-xl text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-red-500 active:scale-95 transition-all duration-200'
    dBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M6 6l1 14a2 2 0 002 2h6a2 2 0 002-2l1-14" /></svg>'
              dBtn.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: '删除任务',
        message: `确定要删除任务「${task.title || '未命名'}」吗？此操作不可恢复。`,
        okText: '删除',
      })
      if (!ok) return
      await supabase.from('tasks').delete().eq('id', task.id)
      tasks = tasks.filter((t) => t.id !== task.id)
      renderTasks()
    })
    actions.appendChild(dBtn)

    li.appendChild(left); li.appendChild(actions)
    taskList.appendChild(li)
  })
  updateStats(); renderDashboard()
}

function openTaskDetail(taskId) {
  const task = tasks.find((t) => t.id === taskId)
  if (!task) return
  currentDetailTaskId = taskId
  taskDetailSubtitle.textContent = task.title
  taskDetailBody.innerHTML = ''

  const headWrap = document.createElement('div')
  headWrap.className = 'rounded-2xl border border-zinc-100 dark:border-zinc-800 p-4 bg-zinc-50 dark:bg-zinc-800/50'
  const headTitle = document.createElement('p')
  headTitle.className = 'text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1'
  headTitle.textContent = task.title
  headWrap.appendChild(headTitle)
  const statusEl = document.createElement('p')
  statusEl.className = 'text-xs ' + (task.done ? 'text-green-500' : 'text-blue-500')
  statusEl.textContent = task.done ? '已完成' : '进行中'
  headWrap.appendChild(statusEl)
  taskDetailBody.appendChild(headWrap)

  const descSection = document.createElement('div')
  const descLabel = document.createElement('p')
  descLabel.className = 'text-xs text-zinc-500 dark:text-zinc-400 mb-1'
  descLabel.textContent = '任务简介'
  const descText = document.createElement('p')
  descText.className = 'text-sm text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap break-words'
  descText.textContent = task.description || '（未填写）'
  descSection.appendChild(descLabel); descSection.appendChild(descText)
  taskDetailBody.appendChild(descSection)

  if (task.tags?.length > 0) {
    const tagSection = document.createElement('div')
    const tagLabel = document.createElement('p')
    tagLabel.className = 'text-xs text-zinc-500 dark:text-zinc-400 mb-2'
    tagLabel.textContent = '标签'
    const tagWrap = document.createElement('div')
    tagWrap.className = 'flex flex-wrap gap-2'
    task.tags.forEach((t) => tagWrap.appendChild(createTagChip(t)))
    tagSection.appendChild(tagLabel); tagSection.appendChild(tagWrap)
    taskDetailBody.appendChild(tagSection)
  }

  const reportSection = document.createElement('div')
  const reportLabel = document.createElement('p')
  reportLabel.className = 'text-xs text-zinc-500 dark:text-zinc-400 mb-2'
  reportLabel.textContent = `上报记录（${(task.reports || []).length}）`
  reportSection.appendChild(reportLabel)
  const reports = task.reports || []
  if (reports.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'text-sm text-zinc-400 dark:text-zinc-500 py-2'
    empty.textContent = '暂无上报记录'
    reportSection.appendChild(empty)
  } else {
    reports.slice().reverse().forEach((r) => {
      const item = document.createElement('div')
      item.className = 'rounded-2xl border border-zinc-100 dark:border-zinc-800 p-3 bg-zinc-50 dark:bg-zinc-800/50 mb-2'
      const meta = document.createElement('div')
      meta.className = 'flex items-center gap-2 mb-2'
      const av = document.createElement('div')
      av.className = 'w-6 h-6 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center shrink-0'
      if (r.avatar_url) {
        const img = document.createElement('img')
        img.src = r.avatar_url
        img.alt = r.nickname || '用户'
        img.className = 'w-full h-full object-cover'
        av.appendChild(img)
      } else {
        av.innerHTML = '<svg class="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 016-6h4a6 6 0 016 6v1" /></svg>'
      }
      const nameEl = document.createElement('span')
      nameEl.className = 'text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate'
      nameEl.textContent = r.nickname || '未知用户'
      const timeEl = document.createElement('span')
      timeEl.className = 'text-xs text-zinc-400 dark:text-zinc-500 ml-auto shrink-0'
      timeEl.textContent = new Date(r.time).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      meta.appendChild(av); meta.appendChild(nameEl); meta.appendChild(timeEl)
      item.appendChild(meta)
      if (r.note) {
        const note = document.createElement('p')
        note.className = 'text-sm text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap break-words mb-2'
        note.textContent = r.note
        item.appendChild(note)
      }
      if (r.images?.length > 0) {
        const grid = document.createElement('div')
        grid.className = 'grid grid-cols-3 gap-2'
        r.images.forEach((src) => {
          const img = document.createElement('img')
          img.src = src
          img.alt = '上报图片'
          img.className = 'w-full aspect-square object-cover rounded-lg border border-zinc-100 dark:border-zinc-800 cursor-pointer hover:opacity-90 transition-opacity'
          img.addEventListener('click', () => {
            openPreview({ name: '上报图片', url: src, category: '图片', size: 0, type: 'image/jpeg' })
          })
          grid.appendChild(img)
        })
        item.appendChild(grid)
      }
      reportSection.appendChild(item)
    })
  }
  taskDetailBody.appendChild(reportSection)

          document.getElementById('task-detail-modal').classList.remove('hidden')
  syncBodyScroll()
}
function closeTaskDetail() {
          document.getElementById('task-detail-modal').classList.add('hidden')
  currentDetailTaskId = null
  syncBodyScroll()
}

      document.getElementById('task-detail-close').addEventListener('click', closeTaskDetail)
document.getElementById('task-detail-backdrop').addEventListener('click', closeTaskDetail)

taskSearch.addEventListener('input', () => { keyword = taskSearch.value.trim(); renderTasks() })

function renderDraftTags() {
  taskTagList.innerHTML = ''
  draftTags.forEach((tag, idx) => {
    const chip = document.createElement('span')
    chip.className = 'inline-flex items-center gap-3 px-3 py-1 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-500 text-xs'
    const text = document.createElement('span')
    text.textContent = tag
    const del = document.createElement('button')
    del.type = 'button'
    del.setAttribute('aria-label', '移除标签')
    del.className = 'hover:text-red-500 transition-colors duration-200'
    del.innerHTML = '<svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>'
    del.addEventListener('click', () => { draftTags.splice(idx, 1); renderDraftTags() })
    chip.appendChild(text); chip.appendChild(del); taskTagList.appendChild(chip)
  })
}

function addDraftTag() {
  const v = taskTagInput.value.trim()
  if (!v) return
  if (draftTags.includes(v)) { taskTagInput.value = ''; return }
  draftTags.push(v); taskTagInput.value = ''; renderDraftTags()
}
taskTagAdd.addEventListener('click', addDraftTag)
taskTagInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addDraftTag() } })

      function openTaskModal(taskId) {
  if (!currentUser) { openUserModal(); return }
  if (taskId) {
    const t = tasks.find((x) => x.id === taskId)
    if (!t) return
    currentEditingTaskId = taskId
    taskModalTitle.textContent = '编辑任务'
    taskTitleInput.value = t.title || ''
    taskDescInput.value = t.description || ''
    draftTags = (t.tags || []).slice()
    renderDraftTags()
    taskSubmit.textContent = '保存修改'
  } else {
    currentEditingTaskId = null
    taskModalTitle.textContent = '添加任务'
    taskTitleInput.value = ''
    taskDescInput.value = ''
    draftTags = []
    renderDraftTags()
    taskSubmit.textContent = '创建任务'
  }
  taskModalEl.classList.remove('hidden'); syncBodyScroll(); taskTitleInput.focus()
}
function closeTaskModal() {
  taskModalEl.classList.add('hidden')
  currentEditingTaskId = null
  syncBodyScroll()
}

      taskAddOpen.addEventListener('click', () => openTaskModal())
taskClose.addEventListener('click', closeTaskModal)
taskBackdrop.addEventListener('click', closeTaskModal)
      dashAddTask.addEventListener('click', () => openTaskModal())
      dashNewTask.addEventListener('click', () => openTaskModal())

      taskSubmit.addEventListener('click', async () => {
  const title = taskTitleInput.value.trim()
  const description = taskDescInput.value.trim()
  if (!title) { taskTitleInput.focus(); return }
  taskSubmit.disabled = true
  if (currentEditingTaskId) {
    const { data, error } = await supabase
      .from('tasks')
      .update({ title, description: description || null, tags: draftTags.slice() })
      .eq('id', currentEditingTaskId)
      .select()
      .single()
    taskSubmit.disabled = false
    if (error) { alert('保存失败：' + error.message); return }
    const i = tasks.findIndex((t) => t.id === currentEditingTaskId)
    if (i >= 0) tasks[i] = { ...data, tags: data.tags || [], reports: data.reports || [] }
    renderTasks(); closeTaskModal()
  } else {
    const { data, error } = await supabase
      .from('tasks')
      .insert({ title, description: description || null, tags: draftTags.slice(), done: false, reports: [] })
      .select()
      .single()
    taskSubmit.disabled = false
    if (error) { alert('创建失败：' + error.message); return }
    tasks.unshift({ ...data, tags: data.tags || [], reports: data.reports || [] })
    renderTasks(); closeTaskModal()
  }
})
taskTitleInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); taskSubmit.click() } })


const taskDetailSubtitle = document.getElementById('task-detail-subtitle')
const taskDetailBody = document.getElementById('task-detail-body')
const reportClose = document.getElementById('report-close')
const reportBackdrop = document.getElementById('report-backdrop')
const reportTaskTitle = document.getElementById('report-task-title')
const reportHistory = document.getElementById('report-history')
const reportNote = document.getElementById('report-note')
const reportImages = document.getElementById('report-images')
const reportPreview = document.getElementById('report-preview')
const reportDone = document.getElementById('report-done')
const reportSubmit = document.getElementById('report-submit')
      let currentTaskId = null
let pendingImages = []
let currentEditingTaskId = null
let currentDetailTaskId = null
