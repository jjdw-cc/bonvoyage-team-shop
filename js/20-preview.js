/* ─────────────────────────────────────────────────────────────
 * 20-preview.js · 文件分类与预览
 * 该文件由原 index.html 内联脚本按顺序拆分而来，文件编号即执行顺序。
 * ───────────────────────────────────────────────────────────── */
'use strict'

function guessCategory(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase()
  if (['pdf', 'doc', 'docx', 'txt', 'md', 'rtf', 'odt'].includes(ext)) return '文档'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) return '图片'
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return '表格'
  if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'py', 'java', 'c', 'cpp', 'go', 'rs', 'php', 'rb', 'sh', 'json', 'xml', 'yml', 'yaml'].includes(ext)) return '代码'
  if (['mp4', 'mp3', 'avi', 'mov', 'wav', 'flac', 'mkv', 'webm'].includes(ext)) return '音视频'
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) return '压缩包'
  return '其他'
}

const previewModal = document.getElementById('preview-modal')
const previewBackdrop = document.getElementById('preview-backdrop')
const previewClose = document.getElementById('preview-close')
const previewName = document.getElementById('preview-name')
const previewMeta = document.getElementById('preview-meta')
const previewBody = document.getElementById('preview-body')
const previewDownload = document.getElementById('preview-download')
const previewOpen = document.getElementById('preview-open')

function isImageFile(file) {
  if ((file.type || '').startsWith('image/')) return true
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(file.name)
}
function isPdfFile(file) {
  if ((file.type || '') === 'application/pdf') return true
  return /\.pdf$/i.test(file.name)
}
function isTextFile(file) {
  if ((file.type || '').startsWith('text/')) return true
  return /\.(txt|md|markdown|json|xml|yml|yaml|html|htm|css|scss|less|js|mjs|cjs|ts|tsx|jsx|py|java|c|cpp|h|hpp|go|rs|php|rb|sh|bash|log|csv|ini|conf|env|sql)$/i.test(file.name)
}

// ── 代码查看器 ────────────────────────────────────────────────────────
const PREVIEW_LANGS = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
  ts: 'typescript', tsx: 'typescript', py: 'python', java: 'java',
  c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', hpp: 'cpp',
  go: 'go', rs: 'rust', php: 'php', rb: 'ruby',
  sh: 'bash', bash: 'bash', zsh: 'bash',
  html: 'xml', htm: 'xml', xml: 'xml', svg: 'xml',
  css: 'css', scss: 'scss', less: 'less',
  json: 'json', yml: 'yaml', yaml: 'yaml', toml: 'ini', ini: 'ini', conf: 'ini', env: 'ini',
  md: 'markdown', markdown: 'markdown', sql: 'sql', csv: 'plaintext', txt: 'plaintext', log: 'plaintext',
}

function previewExt(name) {
  const m = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/)
  return m ? m[1] : ''
}

function escapePreviewHtml(s) {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
}

function buildCodeView(raw, fileName) {
  const ext = previewExt(fileName)
  const lang = PREVIEW_LANGS[ext] || ''

  let html = null
  if (typeof hljs !== 'undefined' && lang && lang !== 'plaintext') {
    try { html = hljs.highlight(raw, { language: lang }).value } catch (_) { html = null }
  }
  if (html === null) html = escapePreviewHtml(raw)

  const lineCount = raw.split('\n').length

  const wrap = document.createElement('div')
  wrap.className = 'w-full min-h-[55vh] flex flex-col rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'

  const bar = document.createElement('div')
  bar.className = 'flex items-center justify-between gap-3 px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 shrink-0'

  const left = document.createElement('div')
  left.className = 'flex items-center gap-2 min-w-0'
  left.innerHTML =
    `<span class="px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-mono">${escapePreviewHtml(lang || ext || 'text')}</span>` +
    `<span class="text-xs text-zinc-400 dark:text-zinc-500">${lineCount} 行</span>` +
    (typeof hljs === 'undefined' ? '<span class="text-xs text-amber-500">（高亮组件未加载，显示纯文本）</span>' : '')

  const copyBtn = document.createElement('button')
  copyBtn.type = 'button'
  copyBtn.className = 'shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95 transition-all duration-200'
  copyBtn.textContent = '复制'
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(raw)
      copyBtn.textContent = '已复制'
    } catch (_) {
      copyBtn.textContent = '复制失败'
    }
    setTimeout(() => { copyBtn.textContent = '复制' }, 1500)
  })

  bar.appendChild(left)
  bar.appendChild(copyBtn)

  const scroll = document.createElement('div')
  scroll.className = 'flex-1 overflow-auto max-h-[70vh]'

  const inner = document.createElement('div')
  inner.className = 'flex min-w-max'

  const gutter = document.createElement('div')
  gutter.className = 'sticky left-0 z-10 shrink-0 select-none whitespace-pre bg-zinc-50 dark:bg-zinc-900 px-3 py-3 text-right font-mono text-xs leading-5 text-zinc-400 dark:text-zinc-600 border-r border-zinc-100 dark:border-zinc-800'
  gutter.textContent = Array.from({ length: lineCount }, (_, i) => i + 1).join('\n')

  const pre = document.createElement('pre')
  pre.className = 'm-0 py-3 px-4 font-mono text-xs leading-5 whitespace-pre text-zinc-800 dark:text-zinc-200'
  const code = document.createElement('code')
  code.className = 'hljs bg-transparent'
  code.innerHTML = html
  pre.appendChild(code)

  inner.appendChild(gutter)
  inner.appendChild(pre)
  scroll.appendChild(inner)
  wrap.appendChild(bar)
  wrap.appendChild(scroll)
  return wrap
}
function resetPreviewBody() {
  previewBody.classList.add('items-center', 'justify-center')
  previewBody.innerHTML = ''
}

async function openPreview(file) {
  previewName.textContent = file.name
  previewMeta.textContent = `${file.category || '其他'} · ${fmtBytes(file.size || 0)}`
  previewDownload.href = file.url
  previewDownload.setAttribute('download', file.name)
  previewOpen.href = file.url
  resetPreviewBody()
  previewModal.classList.remove('hidden')
  syncBodyScroll()

  if (isImageFile(file)) {
    const img = document.createElement('img')
    img.src = file.url
    img.alt = file.name
    img.className = 'max-w-full max-h-full object-contain rounded-xl'
    previewBody.appendChild(img)
    return
  }
  if (isPdfFile(file)) {
    previewBody.classList.remove('items-center', 'justify-center')
    const iframe = document.createElement('iframe')
    iframe.src = file.url
    iframe.className = 'w-full h-full rounded-xl border-0'
    iframe.style.minHeight = '70vh'
    previewBody.appendChild(iframe)
    return
  }
  if (isTextFile(file)) {
    previewBody.classList.remove('items-center', 'justify-center')
    const holder = document.createElement('div')
    holder.className = 'w-full text-sm text-zinc-400 dark:text-zinc-500 py-10 text-center'
    holder.textContent = '加载中...'
    previewBody.appendChild(holder)
    try {
      const res = await fetch(file.url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      let text = await res.text()
      const MAX = 200000
      if (text.length > MAX) text = text.slice(0, MAX) + '\n\n... (内容过长，已截断，请下载查看完整文件)'
      holder.replaceWith(buildCodeView(text, file.name))
    } catch (err) {
      holder.className = 'w-full max-w-3xl'
      holder.innerHTML =
        `<div class="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 text-sm text-zinc-600 dark:text-zinc-400">` +
        `无法加载文件内容：${escapePreviewHtml(err.message)}<br><span class="text-xs text-zinc-400 dark:text-zinc-500">请点击右上角「下载」或「新标签打开」查看。</span></div>`
    }
    return
  }
  const wrap = document.createElement('div')
  wrap.className = 'text-center max-w-sm'
  wrap.innerHTML =
    '<div class="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 inline-block mb-5">' +
    '<svg class="w-12 h-12 text-zinc-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">' +
    '<path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />' +
    '<path d="M13 2v7h7" /></svg></div>' +
    '<p class="text-sm text-zinc-600 dark:text-zinc-400 mb-5">此文件类型不支持在线预览</p>'
  const dlBtn = document.createElement('a')
  dlBtn.href = file.url
  dlBtn.setAttribute('download', file.name)
  dlBtn.className = 'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm font-medium active:scale-95 transition-all duration-200'
  dlBtn.innerHTML =
    '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">' +
    '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />' +
    '<path d="M7 10l5 5 5-5M12 15V3" /></svg>下载文件'
  wrap.appendChild(dlBtn)
  previewBody.appendChild(wrap)
}

function closePreview() {
  previewModal.style.zIndex = ''
  previewModal.classList.add('hidden')
  previewBody.innerHTML = ''
  previewBody.classList.add('items-center', 'justify-center')
  syncBodyScroll()
}
previewClose.addEventListener('click', closePreview)
previewBackdrop.addEventListener('click', closePreview)

const calendarOpen = document.getElementById('calendar-open')
const calendarClose = document.getElementById('calendar-close')
const calendarBackdrop = document.getElementById('calendar-backdrop')
const calendarPrev = document.getElementById('calendar-prev')
const calendarNext = document.getElementById('calendar-next')
const calendarMonthLabel = document.getElementById('calendar-month-label')
const calendarDates = document.getElementById('calendar-dates')
const calendarSelectedLabel = document.getElementById('calendar-selected-label')
const calendarSelectedCount = document.getElementById('calendar-selected-count')
const calendarInput = document.getElementById('calendar-input')
const calendarAdd = document.getElementById('calendar-add')
const calendarList = document.getElementById('calendar-list')

const toKey = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const today = new Date()
let calYear = today.getFullYear()
let calMonth = today.getMonth()
let selectedDateKey = toKey(today.getFullYear(), today.getMonth(), today.getDate())
