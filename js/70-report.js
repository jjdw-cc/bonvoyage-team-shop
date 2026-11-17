/* ─────────────────────────────────────────────────────────────
 * 70-report.js · 任务上报
 * 该文件由原 index.html 内联脚本按顺序拆分而来，文件编号即执行顺序。
 * ───────────────────────────────────────────────────────────── */
'use strict'

function compressImage(file) {
  return new Promise((res) => {
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        const maxW = 1200
        let w = img.width, h = img.height
        if (w > maxW) { h = Math.round((h * maxW) / w); w = maxW }
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        canvas.toBlob((b) => res(b), 'image/jpeg', 0.8)
      }
      img.src = ev.target.result
    }
    reader.readAsDataURL(file)
  })
}

function renderPreview() {
  reportPreview.innerHTML = ''
  pendingImages.forEach((item, idx) => {
    const wrap = document.createElement('div')
    wrap.className = 'relative group/img'
    const img = document.createElement('img')
    img.src = item.previewUrl
    img.alt = '待上传图片'
    img.className = 'w-full aspect-square object-cover rounded-xl border border-zinc-100 dark:border-zinc-800'
    const del = document.createElement('button')
    del.type = 'button'
    del.setAttribute('aria-label', '移除图片')
    del.className = 'absolute -top-2 -right-2 p-1 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm active:scale-95 transition-all duration-200'
    del.innerHTML = '<svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>'
    del.addEventListener('click', () => {
      URL.revokeObjectURL(item.previewUrl)
      pendingImages.splice(idx, 1)
      renderPreview()
    })
    wrap.appendChild(img); wrap.appendChild(del); reportPreview.appendChild(wrap)
  })
}

function renderReportHistory(task) {
  reportHistory.innerHTML = ''
  if (!task.reports?.length) {
    const p = document.createElement('p')
    p.className = 'text-sm text-zinc-400 dark:text-zinc-500 py-2'
    p.textContent = '暂无上报记录'
    reportHistory.appendChild(p)
    return
  }
  task.reports.slice().reverse().forEach((r) => {
    const item = document.createElement('div')
    item.className = 'rounded-2xl border border-zinc-100 dark:border-zinc-800 p-4 bg-zinc-50 dark:bg-zinc-800/50'
    const meta = document.createElement('div')
    meta.className = 'flex items-center justify-between gap-3 mb-2'
    const time = document.createElement('span')
    time.className = 'text-xs text-zinc-400 dark:text-zinc-500'
    time.textContent = new Date(r.time).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    meta.appendChild(time); item.appendChild(meta)
    if (r.note) {
      const note = document.createElement('p')
      note.className = 'text-sm text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap break-words mb-2'
      note.textContent = r.note
      item.appendChild(note)
    }
    if (r.images?.length > 0) {
      const grid = document.createElement('div')
      grid.className = 'grid grid-cols-3 gap-3'
      r.images.forEach((src) => {
        const img = document.createElement('img')
        img.src = src
        img.alt = '上报图片'
        img.className = 'w-full aspect-square object-cover rounded-xl border border-zinc-100 dark:border-zinc-800 cursor-pointer hover:opacity-90 transition-opacity'
        img.addEventListener('click', () => {
          openPreview({ name: '上报图片', url: src, category: '图片', size: 0, type: 'image/jpeg' })
        })
        grid.appendChild(img)
      })
      item.appendChild(grid)
    }
    reportHistory.appendChild(item)
  })
}

function openReport(taskId) {
  const task = tasks.find((t) => t.id === taskId)
  if (!task) return
  currentTaskId = taskId
  pendingImages = []
  reportTaskTitle.textContent = task.title
  reportNote.value = ''
  reportDone.checked = true
  reportImages.value = ''
  renderPreview(); renderReportHistory(task)
  reportModal.classList.remove('hidden'); syncBodyScroll(); reportNote.focus()
}
function closeReport() { reportModal.classList.add('hidden'); syncBodyScroll() }

reportClose.addEventListener('click', closeReport)
reportBackdrop.addEventListener('click', closeReport)

reportImages.addEventListener('change', async (e) => {
  const list = Array.from(e.target.files || [])
  for (const file of list) {
    if (!file.type.startsWith('image/')) continue
    const blob = await compressImage(file)
    pendingImages.push({ blob, previewUrl: URL.createObjectURL(blob) })
  }
  reportImages.value = ''
  renderPreview()
})

reportSubmit.addEventListener('click', async () => {
  const task = tasks.find((t) => t.id === currentTaskId)
  if (!task) return
  const note = reportNote.value.trim()
  if (!note && pendingImages.length === 0) { reportNote.focus(); return }
  reportSubmit.disabled = true
  reportSubmit.textContent = '上传中...'
  const urls = []
  for (const item of pendingImages) {
    const path = `task-${task.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
    const { data, error } = await supabase.storage.from('uploads').upload(path, item.blob, { cacheControl: '3600', upsert: false, contentType: 'image/jpeg' })
    if (!error) {
      const { data: u } = supabase.storage.from('uploads').getPublicUrl(data.path)
      urls.push(u.publicUrl)
    }
  }
  
  const reports = task.reports || []
  const me = currentUser || {}
  reports.push({
    id: 'r' + Date.now(),
    note,
    images: urls,
    time: Date.now(),
    user_id: me.id || null,
    avatar_url: me.user_metadata?.avatar_url || null,
    nickname: (me.user_metadata?.nickname || me.user_metadata?.user_name || me.user_metadata?.name || (me.email ? me.email.split('@')[0] : '用户')),
  })
  const patch = { reports }
  if (reportDone.checked) patch.done = true
  const { data, error } = await supabase.from('tasks').update(patch).eq('id', task.id).select().single()
  reportSubmit.disabled = false
  reportSubmit.textContent = '提交上报'
  if (error) return
  const i = tasks.findIndex((t) => t.id === task.id)
  if (i >= 0) tasks[i] = { ...data, tags: data.tags || [], reports: data.reports || [] }
  pendingImages.forEach((item) => URL.revokeObjectURL(item.previewUrl))
  pendingImages = []
  renderTasks(); closeReport()
})

const storageRing = document.getElementById('storage-ring')
const storagePercent = document.getElementById('storage-percent')
const storageUsed = document.getElementById('storage-used')
const storageTotal = document.getElementById('storage-total')
const storageRemaining = document.getElementById('storage-remaining')
const dbSizeEl = document.getElementById('db-size')
const fileGroups = document.getElementById('file-groups')
const fileCountEl = document.getElementById('file-count')
const fileSubtitle = document.getElementById('file-subtitle')
const fileUploadOpen = document.getElementById('file-upload-open')
const fileClose = document.getElementById('file-close')
const fileBackdrop = document.getElementById('file-backdrop')
const fileInput = document.getElementById('file-input')
const fileSelectedName = document.getElementById('file-selected-name')
const fileSelectedSize = document.getElementById('file-selected-size')
const fileCategoryList = document.getElementById('file-category-list')
const fileMessage = document.getElementById('file-message')
const fileSubmit = document.getElementById('file-submit')

const RING_R = 80
const RING_CIRC = 2 * Math.PI * RING_R
const STORAGE_LIMIT = 1024 * 1024 * 1024
let pendingFile = null
let pendingCategory = '其他'
