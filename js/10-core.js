/* ─────────────────────────────────────────────────────────────
 * 10-core.js · 基础：DOM 引用、侧边栏、确认弹窗、格式化、全局状态
 * 该文件由原 index.html 内联脚本按顺序拆分而来，文件编号即执行顺序。
 * ───────────────────────────────────────────────────────────── */
'use strict'

const sidebar = document.getElementById('sidebar')
const toggle = document.getElementById('sidebar-toggle')
const mobileMenuBtn = document.getElementById('mobile-menu-btn')
const sidebarOverlay = document.getElementById('sidebar-overlay')
const navItems = document.querySelectorAll('[data-page]')
const views = document.querySelectorAll('[data-view]')
const calendarModal = document.getElementById('calendar-modal')
const taskModal = document.getElementById('task-modal')
const reportModal = document.getElementById('report-modal')
const userModal = document.getElementById('user-modal')
const fileModal = document.getElementById('file-modal')
const projectModal = document.getElementById('project-modal')
const friendsModal = document.getElementById('friends-modal')

function syncBodyScroll() {
          const cropModalEl = document.getElementById('crop-modal')
  const previewModalEl = document.getElementById('preview-modal')
          const taskDetailModalEl = document.getElementById('task-detail-modal')
  const confirmModalEl = document.getElementById('confirm-modal')
  const anyModalOpen =
    !calendarModal.classList.contains('hidden') ||
    !taskModal.classList.contains('hidden') ||
    !reportModal.classList.contains('hidden') ||
    !userModal.classList.contains('hidden') ||
    !fileModal.classList.contains('hidden') ||
    !projectModal.classList.contains('hidden') ||
    !friendsModal.classList.contains('hidden') ||
    (taskDetailModalEl && !taskDetailModalEl.classList.contains('hidden')) ||
    (cropModalEl && !cropModalEl.classList.contains('hidden')) ||
    (confirmModalEl && !confirmModalEl.classList.contains('hidden')) ||
    (previewModalEl && !previewModalEl.classList.contains('hidden'))
  const mobileSidebarOpen = sidebar.getAttribute('data-mobile-open') === 'true'
  document.body.style.overflow = (anyModalOpen || mobileSidebarOpen) ? 'hidden' : ''
}

                  function openMobileSidebar() {
  sidebar.setAttribute('data-mobile-open', 'true')
  sidebarOverlay.classList.remove('hidden')
  syncBodyScroll()
}
function closeMobileSidebar() {
  sidebar.setAttribute('data-mobile-open', 'false')
  sidebarOverlay.classList.add('hidden')
  syncBodyScroll()
}
      mobileMenuBtn.addEventListener('click', openMobileSidebar)
sidebarOverlay.addEventListener('click', closeMobileSidebar)
window.addEventListener('resize', () => {
  if (window.innerWidth >= 768 && sidebar.getAttribute('data-mobile-open') === 'true') closeMobileSidebar()
})

const confirmModal = document.getElementById('confirm-modal')
const confirmBackdrop = document.getElementById('confirm-backdrop')
const confirmTitle = document.getElementById('confirm-title')
const confirmMessage = document.getElementById('confirm-message')
const confirmOk = document.getElementById('confirm-ok')
const confirmCancel = document.getElementById('confirm-cancel')
let confirmResolver = null

function closeConfirm(result) {
  confirmModal.classList.add('hidden')
  syncBodyScroll()
  const resolve = confirmResolver
  confirmResolver = null
  if (resolve) resolve(result)
}
function confirmDialog({ title = '确认操作', message = '', okText = '确定', cancelText = '取消' } = {}) {
  confirmTitle.textContent = title
  confirmMessage.textContent = message
  confirmOk.textContent = okText
  confirmCancel.textContent = cancelText
  confirmModal.classList.remove('hidden')
  syncBodyScroll()
  return new Promise((resolve) => { confirmResolver = resolve })
}
confirmOk.addEventListener('click', () => closeConfirm(true))
confirmCancel.addEventListener('click', () => closeConfirm(false))
confirmBackdrop.addEventListener('click', () => closeConfirm(false))

toggle.addEventListener('click', () => {
  const collapsed = sidebar.getAttribute('data-collapsed') === 'true'
  sidebar.setAttribute('data-collapsed', String(!collapsed))
})

navItems.forEach((item) => {
  item.addEventListener('click', async (e) => {
    e.preventDefault()
    const page = item.dataset.page
    navItems.forEach((nav) => nav.setAttribute('data-active', String(nav === item)))
    views.forEach((v) => v.classList.toggle('hidden', v.dataset.view !== page))
    if (page === 'files') { await loadFiles(); await loadStorageUsage() }
    if (page === 'projects') { await loadProjects() }
    if (sidebar.getAttribute('data-mobile-open') === 'true') closeMobileSidebar()
  })
})

const fmtRel = (ts) => {
  const d = Date.now() - ts, m = 60000, h = 60 * m, day = 24 * h
  if (d < m) return '刚刚'
  if (d < h) return `${Math.floor(d / m)} 分钟前`
  if (d < day) return `${Math.floor(d / h)} 小时前`
  if (d < 7 * day) return `${Math.floor(d / day)} 天前`
  return new Date(ts).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}
const fmtBytes = (b) => {
  if (!b || b <= 0) return '0 B'
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`
}
const fmtDateTime = (ts) => new Date(ts).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

let currentUser = null
let tasks = []
let schedules = {}
let files = []
let projects = []
let friends = []
      let activeProjectId = null
let draftInvitees = []
let editingProjectId = null
let keyword = ''
let draftTags = []

const FILE_CATEGORIES = ['文档', '图片', '表格', '代码', '音视频', '压缩包', '其他']
const CATEGORY_STYLE = {
  '文档': { bg: 'bg-blue-50 dark:bg-blue-900/20', fg: 'text-blue-500' },
  '图片': { bg: 'bg-orange-50 dark:bg-orange-900/20', fg: 'text-orange-500' },
  '表格': { bg: 'bg-green-50 dark:bg-green-900/20', fg: 'text-green-500' },
  '代码': { bg: 'bg-purple-50 dark:bg-purple-900/20', fg: 'text-purple-500' },
  '音视频': { bg: 'bg-cyan-50 dark:bg-cyan-900/20', fg: 'text-cyan-500' },
  '压缩包': { bg: 'bg-red-50 dark:bg-red-900/20', fg: 'text-red-500' },
  '其他': { bg: 'bg-zinc-100 dark:bg-zinc-800', fg: 'text-zinc-700 dark:text-zinc-300' },
}
