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
    const wrap = document.createElement('div')
    wrap.className = 'w-full max-w-3xl bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-4'
    const pre = document.createElement('pre')
    pre.className = 'text-xs md:text-sm font-mono whitespace-pre-wrap break-words text-zinc-800 dark:text-zinc-200'
    pre.textContent = '加载中...'
    wrap.appendChild(pre)
    previewBody.appendChild(wrap)
    try {
      const res = await fetch(file.url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      const MAX = 200000
      pre.textContent = text.length > MAX ? text.slice(0, MAX) + '\n\n... (内容过长，已截断，请下载查看完整文件)' : text
    } catch (err) {
      pre.textContent = `无法加载文件内容：${err.message}\n\n请点击右上角「下载」或「新标签打开」查看。`
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
