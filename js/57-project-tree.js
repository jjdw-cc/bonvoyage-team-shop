/* ─────────────────────────────────────────────────────────────
 * 57-project-tree.js · 项目知识树（节点 = 固定大小的小窗口）
 * · 右键空白处新建主根
 * · 节点窗口：白底、彩色边框、顶部节点名，右侧堆叠便签
 * · 便签悬停自动展开；可换色、==高亮==、插图
 * · 节点右侧「+」拖到另一个节点即可连线；连线可拖弯
 * ───────────────────────────────────────────────────────────── */
'use strict'

const TREE_WIN_W = 380
const TREE_WIN_H = 360
const nodeW = (n) => (n && n.width) || TREE_WIN_W
const nodeH = (n) => (n && n.height) || TREE_WIN_H

const TREE_BORDER_COLORS = {
  gray: { label: '灰', value: '#a1a1aa' },
  sky: { label: '蓝', value: '#3b82f6' },
  emerald: { label: '绿', value: '#10b981' },
  amber: { label: '橙', value: '#f59e0b' },
  rose: { label: '红', value: '#f43f5e' },
  violet: { label: '紫', value: '#8b5cf6' },
}

const NOTE_COLORS = {
  yellow: { label: '黄', bg: '#FFE08A', edge: '#F2C94C', text: '#3D2F00' },
  orange: { label: '橙', bg: '#FFB570', edge: '#F2994A', text: '#4A2500' },
  pink: { label: '粉', bg: '#F49AC2', edge: '#EB7BB0', text: '#4A0F2A' },
  blue: { label: '蓝', bg: '#A9D6E5', edge: '#7FBED1', text: '#123B47' },
  green: { label: '绿', bg: '#B7E4C7', edge: '#8FD3A8', text: '#123D22' },
  purple: { label: '紫', bg: '#D7C4F0', edge: '#BFA4E6', text: '#2E1A4A' },
}

let treeProjectId = null
let treeProjectName = ''
let treeNodes = []
let treeLinks = []
let treeNotes = []
let treeNodeFiles = []
let treeVotes = []
let treeProfiles = {}
let treeSelectedId = null
let treeZoom = 1
let treePan = { x: 0, y: 0 }
let treeEls = null
let treeMenuPoint = null
let treePeekTimer = null
let treeEditingNote = null
let treeNewNotePos = null
let treeCollapsed = {}
let treeEditorNodeId = null
let treeFilesNode = null

const treeW = () => TREE_WIN_W
const treeH = () => TREE_WIN_H

function treeEl(tag, cls, text) {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text != null) e.textContent = text
  return e
}


function treeIcon(name, size) {
  const span = document.createElement('span')
  span.style.display = 'inline-block'
  span.style.width = (size || 16) + 'px'
  span.style.height = (size || 16) + 'px'
  span.style.flexShrink = '0'
  const url = `url("./assets/icons/${name}.svg")`
  span.style.webkitMaskImage = url
  span.style.maskImage = url
  span.style.webkitMaskRepeat = 'no-repeat'
  span.style.maskRepeat = 'no-repeat'
  span.style.webkitMaskPosition = 'center'
  span.style.maskPosition = 'center'
  span.style.webkitMaskSize = 'contain'
  span.style.maskSize = 'contain'
  span.style.backgroundColor = 'currentColor'
  return span
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

function treeBorderColor(node) {
  const c = TREE_BORDER_COLORS[node.color] || TREE_BORDER_COLORS.gray
  return c.value
}

function treeViewCenter() {
  const rect = treeEls.stage.getBoundingClientRect()
  return { x: (rect.width / 2 - treePan.x) / treeZoom, y: (rect.height / 2 - treePan.y) / treeZoom }
}

function treeNodeById(id) {
  return treeNodes.find((n) => n.id === id) || null
}

function treeNotesOf(nodeId) {
  return treeNotes.filter((n) => n.node_id === nodeId)
}

function treeFilesOf(nodeId) {
  return treeNodeFiles.filter((f) => f.node_id === nodeId)
}

function treeAuthorName(id) {
  if (!id) return '匿名'
  if (currentUser && id === currentUser.id) return '我'
  const p = treeProfiles[id]
  return (p && (p.nickname || p.name)) || '成员'
}

// ── 外壳 ───────────────────────────────────────────────────────────────
function treeMount() {
  if (treeEls) return treeEls

  const modal = treeEl('div', 'fixed inset-0 z-[120] bg-zinc-100 dark:bg-zinc-950 flex flex-col')

  const header = treeEl('header', 'h-14 shrink-0 flex items-center gap-3 px-3 md:px-4 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800')
  const back = treeEl('button', 'p-2 rounded-xl text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition-all')
  back.type = 'button'
  back.setAttribute('aria-label', '关闭知识树')
  back.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>'

  const titleBox = treeEl('div', 'min-w-0')
  const title = treeEl('p', 'font-semibold text-sm md:text-base text-zinc-900 dark:text-zinc-100 truncate', '知识树')
  const sub = treeEl('p', 'text-xs text-zinc-500 dark:text-zinc-400 truncate', '')
  titleBox.appendChild(title)
  titleBox.appendChild(sub)

  const tools = treeEl('div', 'ml-auto flex items-center gap-1.5 md:gap-2')
  const btnBase = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs md:text-sm font-medium active:scale-95 transition-all'
  const addRoot = treeEl('button', btnBase + ' bg-zinc-900 text-white hover:bg-zinc-800')
  addRoot.type = 'button'
  addRoot.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>主根'
  const addChild = treeEl('button', btnBase + ' bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700')
  addChild.type = 'button'
  addChild.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>分支'
  const zoomOut = treeEl('button', 'w-8 h-8 rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition-all', '−')
  zoomOut.type = 'button'
  const zoomLabel = treeEl('span', 'text-xs text-zinc-500 dark:text-zinc-400 w-10 text-center', '100%')
  const zoomIn = treeEl('button', 'w-8 h-8 rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition-all', '+')
  zoomIn.type = 'button'
  const fitBtn = treeEl('button', 'px-2.5 py-1.5 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition-all', '居中')
  fitBtn.type = 'button'

  tools.appendChild(addRoot)
  tools.appendChild(addChild)
  tools.appendChild(zoomOut)
  tools.appendChild(zoomLabel)
  tools.appendChild(zoomIn)
  tools.appendChild(fitBtn)

  header.appendChild(back)
  header.appendChild(titleBox)
  header.appendChild(tools)

  const body = treeEl('div', 'flex-1 flex min-h-0')
  const stage = treeEl('div', 'relative flex-1 overflow-hidden')
  stage.id = 'tree-stage'
  stage.style.backgroundImage = 'radial-gradient(circle, #d4d4d8 1px, transparent 1px)'
  stage.style.backgroundSize = '22px 22px'
  stage.style.cursor = 'grab'

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('class', 'absolute inset-0 w-full h-full pointer-events-none')
  const edgeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  const tempGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  const layer = treeEl('div', 'absolute inset-0 origin-top-left')
  const peek = treeEl('div', 'hidden fixed z-[140]')
  peek.addEventListener('pointerenter', () => {
    if (treePeekTimer) { clearTimeout(treePeekTimer); treePeekTimer = null }
  })
  peek.addEventListener('pointerleave', () => scheduleHideNotePeek())
  const hint = treeEl('p', 'absolute bottom-3 left-3 right-3 text-[11px] text-zinc-400 dark:text-zinc-500 pointer-events-none truncate',
    '右键新建主根 · 节点右侧 + 拖出连线 · 便签悬停展开')

  const menu = treeEl('div', 'hidden absolute z-40 w-52 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl p-1')

  stage.appendChild(svg)
  svg.appendChild(edgeGroup)
  svg.appendChild(tempGroup)
  stage.appendChild(layer)
  document.body.appendChild(peek)
  stage.appendChild(menu)
  stage.appendChild(hint)

  const toolbar = treeEl('div', 'absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2 py-2 rounded-2xl bg-white/95 dark:bg-zinc-800/95 shadow-xl border border-zinc-200/70 dark:border-zinc-700')
  toolbar.id = 'tree-toolbar'

  const primary = treeEl('button', 'inline-flex items-center gap-1.5 pl-2.5 pr-3.5 h-9 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 active:scale-95 transition-all text-[12.5px] font-medium')
  primary.type = 'button'
  primary.appendChild(treeIcon('sticky-note', 16))
  primary.appendChild(treeEl('span', '', '便签'))

  const iconBtn = (icon, title) => {
    const b = treeEl('button', 'w-9 h-9 rounded-xl inline-flex items-center justify-center text-zinc-500 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white active:scale-95 transition-all')
    b.type = 'button'
    b.title = title
    b.appendChild(treeIcon(icon, 18))
    return b
  }

  const tbRoot = iconBtn('circle-plus', '新建主根')
  const tbFit = iconBtn('maximize', '视图居中')
  const sep = treeEl('div', 'w-px h-6 bg-zinc-200 dark:bg-zinc-700 mx-0.5')

  toolbar.appendChild(primary)
  toolbar.appendChild(tbRoot)
  toolbar.appendChild(sep)
  toolbar.appendChild(tbFit)
  stage.appendChild(toolbar)

  primary.addEventListener('click', (e) => { e.stopPropagation(); openTreeNoteEditor(null, null) })
  tbRoot.addEventListener('click', (e) => {
    e.stopPropagation()
    const c = treeViewCenter()
    createRootAt(c.x, c.y)
  })
  tbFit.addEventListener('click', (e) => { e.stopPropagation(); fitTreeView() })

  body.appendChild(stage)
  modal.appendChild(header)
  modal.appendChild(body)
  document.body.appendChild(modal)

  treeEls = { modal, back, title, sub, addRoot, addChild, zoomOut, zoomIn, zoomLabel, fitBtn, stage, svg, edgeGroup, tempGroup, layer, peek, menu, hint, toolbar }

  back.addEventListener('click', closeTree)
  addRoot.addEventListener('click', () => {
    const rect = stage.getBoundingClientRect()
    createRootAt((rect.width / 2 - treePan.x) / treeZoom, (rect.height / 2 - treePan.y) / treeZoom)
  })
  addChild.addEventListener('click', () => {
    const parent = treeNodeById(treeSelectedId)
    if (!parent) {
      treeEls.hint.textContent = '先点一下某个节点，再点「分支」'
      return
    }
    createTreeNode({ kind: 'node', parent })
  })
  zoomOut.addEventListener('click', () => setTreeZoom(treeZoom - 0.1))
  zoomIn.addEventListener('click', () => setTreeZoom(treeZoom + 0.1))
  fitBtn.addEventListener('click', fitTreeView)

  stage.addEventListener('pointerdown', onStagePointerDown)
  stage.addEventListener('wheel', onStageWheel, { passive: false })
  stage.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    openTreeMenu(e.clientX, e.clientY)
  })
  document.addEventListener('pointerdown', (e) => {
    if (!treeEls || treeEls.modal.classList.contains('hidden')) return
    if (!treeEls.menu.classList.contains('hidden') && !treeEls.menu.contains(e.target)) closeTreeMenu()
  })
  window.addEventListener('resize', () => hideNotePeek())
  window.addEventListener('keydown', onTreeKeydown)

  return treeEls
}

function onTreeKeydown(e) {
  if (!treeEls || treeEls.modal.classList.contains('hidden')) return
  if (e.key !== 'Escape') return
  const focusEl = document.getElementById('tree-node-focus')
  if (focusEl && !focusEl.classList.contains('hidden')) { closeNodeFocus(); return }
  if (!treeEls.menu.classList.contains('hidden')) { closeTreeMenu(); return }
  const noteEd = document.getElementById('tree-note-editor')
  if (noteEd && !noteEd.classList.contains('hidden')) { closeTreeNoteEditor(); return }
  const filesEd = document.getElementById('tree-files-modal')
  if (filesEd && !filesEd.classList.contains('hidden')) { closeTreeFiles(); return }
  closeTree()
}

// ── 打开 / 关闭 ────────────────────────────────────────────────────────
async function openTree(proj) {
  if (!currentUser) { openUserModal(); return }
  treeMount()
  treeProjectId = proj.id
  treeProjectName = proj.name || '项目'
  treeEls.title.textContent = `${treeProjectName} · 知识树`
  treeEls.sub.textContent = proj.research_field || '每个窗口是一个节点，右侧是便签'
  treeEls.modal.classList.remove('hidden')
  document.body.style.overflow = 'hidden'
  const cm = document.getElementById('confirm-modal')
  if (cm) cm.style.zIndex = '150'
  treeSelectedId = null
  closeTreeMenu()
  hideNotePeek()
  await loadTree()
  loadTreeCollapsed()
  renderTree()
  fitTreeView()
}

function closeTree() {
  if (!treeEls) return
  hideNotePeek()
  closeTreeMenu()
  closeTreeNoteEditor()
  closeTreeFiles()
  closeTreePopover()
  closeNoteViewer()
  treeEls.modal.classList.add('hidden')
  document.body.style.overflow = ''
  const cm = document.getElementById('confirm-modal')
  if (cm) cm.style.zIndex = ''
  treeSelectedId = null
}

// ── 数据 ───────────────────────────────────────────────────────────────
async function loadTree() {
  const { data: nodes, error } = await supabase
    .from('tree_nodes')
    .select('*')
    .eq('project_id', treeProjectId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[tree] 加载节点失败', error.message)
    treeNodes = []
    treeEls.hint.textContent = '加载失败：' + error.message + '（请先执行 supabase/migrations/setup_all.sql）'
  } else {
    treeNodes = nodes || []
  }

  const { data: links } = await supabase.from('tree_links').select('*').eq('project_id', treeProjectId)
  treeLinks = links || []

  if (treeNodes.length === 0) {
    const root = await insertTreeNode({ kind: 'root', title: treeProjectName, parent: null, x: 0, y: 0 })
    if (root) treeNodes.push(root)
  }

  await loadAllNotes()
  await loadAllNodeFiles()
  await loadAllNodeVotes()
  await loadTreeProfiles()
  renderTree()
}

async function loadAllNotes() {
  const { data } = await supabase.from('node_notes').select('*').eq('project_id', treeProjectId).order('created_at', { ascending: true })
  treeNotes = data || []
  treeNotes.forEach((n, i) => {
    if (n.x == null || n.y == null) {
      const node = n.node_id ? treeNodeById(n.node_id) : null
      n.x = (node ? node.x : 0) + nodeW(node) / 2 + 28 + (i % 3) * 24
      n.y = (node ? node.y : 0) - nodeH(node) / 2 - 10 + (i % 4) * 24
    }
    if (!n.width) n.width = 200
    if (!n.height) n.height = 200
  })
}

async function loadAllNodeFiles() {
  const ids = treeNodes.map((n) => n.id)
  if (ids.length === 0) { treeNodeFiles = []; return }
  const { data } = await supabase.from('node_files').select('*').in('node_id', ids)
  treeNodeFiles = data || []
}

async function loadAllNodeVotes() {
  const ids = treeNodeFiles.map((f) => f.id)
  if (ids.length === 0) { treeVotes = []; return }
  const { data } = await supabase.from('node_file_votes').select('*').in('file_id', ids)
  treeVotes = data || []
}

function treeVotesOf(fileId) {
  return treeVotes.filter((v) => v.file_id === fileId)
}

function treeMyVote(fileId) {
  if (!currentUser) return false
  return treeVotes.some((v) => v.file_id === fileId && v.user_id === currentUser.id)
}

async function toggleTreeVote(file) {
  if (!currentUser) return
  const mine = treeVotes.find((v) => v.file_id === file.id && v.user_id === currentUser.id)
  if (mine) {
    await supabase.from('node_file_votes').delete().eq('id', mine.id)
    treeVotes = treeVotes.filter((v) => v.id !== mine.id)
  } else {
    const { data, error } = await supabase.from('node_file_votes').insert({ file_id: file.id, user_id: currentUser.id }).select().single()
    if (error) { treeEls.hint.textContent = '投票失败：' + error.message; return }
    if (data) treeVotes.push(data)
  }
  renderTreeNodes()
  const fm = document.getElementById('tree-files-modal')
  if (fm && !fm.classList.contains('hidden')) await renderTreeFiles()
}

async function loadTreeProfiles() {
  const ids = new Set()
  const add = (v) => { if (v) ids.add(v) }
  if (currentUser) add(currentUser.id)
  treeNodes.forEach((n) => add(n.created_by))
  treeNotes.forEach((n) => add(n.author_id))
  treeNodeFiles.forEach((f) => add(f.author_id))
  if (ids.size === 0) return
  const { data } = await supabase.from('profiles').select('*').in('id', Array.from(ids))
  treeProfiles = {}
  ;(data || []).forEach((p) => { treeProfiles[p.id] = p })
}

async function insertTreeNode({ kind, title, parent, x, y }) {
  const payload = {
    project_id: treeProjectId,
    parent_id: parent ? parent.id : null,
    title: title || (kind === 'root' ? '新主根' : '新分支'),
    shape: 'rect',
    color: kind === 'root' ? 'sky' : 'gray',
    width: TREE_WIN_W,
    height: TREE_WIN_H,
    x: x == null ? 0 : x,
    y: y == null ? 0 : y,
    kind,
    created_by: currentUser ? currentUser.id : null,
  }
  const { data, error } = await supabase.from('tree_nodes').insert(payload).select().single()
  if (error) {
    console.error('[tree] 创建节点失败', error.message)
    treeEls.hint.textContent = '创建失败：' + error.message
    return null
  }
  return data
}

async function createRootAt(x, y) {
  closeTreeMenu()
  const node = await insertTreeNode({ kind: 'root', title: '新主根', parent: null, x, y })
  if (!node) return
  treeNodes.push(node)
  renderTree()
  treeEls.hint.textContent = '已创建主根：双击标题可改名'
}

async function createTreeNode({ kind, parent }) {
  let x = 0
  let y = 0
  if (kind === 'root') {
    const roots = treeNodes.filter((n) => n.kind === 'root')
    x = roots.length === 0 ? 0 : Math.max.apply(null, roots.map((r) => r.x)) + 380
    y = 0
  } else if (parent) {
    const siblings = treeNodes.filter((n) => n.parent_id === parent.id)
    const n = siblings.length
    const offset = n === 0 ? 0 : (n % 2 === 1 ? 1 : -1) * Math.ceil(n / 2) * 340
    x = parent.x + offset
    y = parent.y + 270
  }

  const node = await insertTreeNode({ kind, title: kind === 'root' ? '新主根' : '新分支', parent, x, y })
  if (!node) return
  treeNodes.push(node)
  renderTree()
}

// ── 渲染 ───────────────────────────────────────────────────────────────
function applyTreeTransform() {
  if (!treeEls) return
  const t = `translate(${treePan.x}px, ${treePan.y}px) scale(${treeZoom})`
  const tf = `translate(${treePan.x},${treePan.y}) scale(${treeZoom})`
  treeEls.layer.style.transform = t
  treeEls.edgeGroup.setAttribute('transform', tf)
  treeEls.tempGroup.setAttribute('transform', tf)
  treeEls.zoomLabel.textContent = Math.round(treeZoom * 100) + '%'
  hideNotePeek()
}


function applyTreeSelection() {
  if (!treeEls || !treeEls.layer) return
  treeEls.layer.querySelectorAll('[data-node-id]').forEach((el) => {
    const win = el.firstElementChild
    if (!win) return
    if (el.dataset.nodeId === treeSelectedId) {
      win.style.boxShadow = '0 0 0 2px #60a5fa, 0 1px 2px rgba(15,23,42,.05)'
    } else {
      win.style.boxShadow = '0 1px 2px rgba(15,23,42,.05)'
    }
  })
}

function renderTree() {
  if (!treeEls) return
  applyTreeTransform()
  renderTreeNodes()
  renderTreeNotes()
  renderTreeEdges()
  applyTreeSelection()
}

function treeHeaderTextColor(hex) {
  const h = String(hex).replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.66 ? '#1f2937' : '#ffffff'
}


function loadTreeCollapsed() {
  treeCollapsed = {}
  treeNodes.forEach((n) => {
    const c = n.collapsed || {}
    if (c.notes) treeCollapsed[n.id + ':notes'] = true
    if (c.files) treeCollapsed[n.id + ':files'] = true
  })
}

async function persistNodeCollapsed(node) {
  const state = {
    notes: Boolean(treeCollapsed[node.id + ':notes']),
    files: Boolean(treeCollapsed[node.id + ':files']),
  }
  node.collapsed = state
  const { error } = await supabase.from('tree_nodes').update({ collapsed: state }).eq('id', node.id)
  if (error) treeEls.hint.textContent = '折叠状态同步失败：' + error.message
}

function nodeEffH(node) {
  const both = treeCollapsed[node.id + ':notes'] && treeCollapsed[node.id + ':files']
  return both ? 244 : nodeH(node)
}

function treeNodeIsMine(node) {
  return Boolean(currentUser && node.created_by === currentUser.id)
}

function startEditNodeDescription(node, el) {
  if (!treeNodeIsMine(node)) return
  const ta = document.createElement('textarea')
  ta.value = node.description || ''
  ta.rows = 2
  ta.maxLength = 120
  ta.placeholder = '一句话说明这个节点要做什么'
  ta.className = 'w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-2 py-1 text-[11.5px] text-zinc-800 dark:text-zinc-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/25'
  el.replaceWith(ta)
  ta.focus()
  if (ta.setSelectionRange) ta.setSelectionRange(ta.value.length, ta.value.length)

  let done = false
  const commit = async (save) => {
    if (done) return
    done = true
    if (save) {
      const v = ta.value.trim()
      node.description = v || null
      const { error } = await supabase.from('tree_nodes').update({ description: v || null }).eq('id', node.id)
      if (error) treeEls.hint.textContent = '保存失败：' + error.message
    }
    renderTreeNodes()
  }
  ta.addEventListener('blur', () => commit(true))
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(true) }
    if (e.key === 'Escape') { e.preventDefault(); commit(false) }
  })
  ta.addEventListener('pointerdown', (e) => e.stopPropagation())
}

function onNodeResizeDown(e, node, wrapEl) {
  e.stopPropagation()
  e.preventDefault()
  const sx = e.clientX
  const sy = e.clientY
  const w0 = nodeW(node)
  const h0 = nodeH(node)

  const onMove = (ev) => {
    node.width = Math.round(Math.max(280, Math.min(640, w0 + (ev.clientX - sx) / treeZoom)))
    node.height = Math.round(Math.max(240, Math.min(680, h0 + (ev.clientY - sy) / treeZoom)))
    wrapEl.style.width = node.width + 'px'
    wrapEl.style.height = node.height + 'px'
    wrapEl.style.left = (node.x - node.width / 2) + 'px'
    wrapEl.style.top = (node.y - node.height / 2) + 'px'
    renderTreeEdges()
  }
  const onUp = async () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    await supabase.from('tree_nodes').update({ width: node.width, height: node.height }).eq('id', node.id)
    renderTreeNodes()
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

function renderTreeNodes() {
  const layer = treeEls.layer
  layer.innerHTML = ''

  treeNodes.forEach((node) => {
    const color = treeBorderColor(node)
    const notes = treeNotesOf(node.id)
    const files = treeFilesOf(node.id)
    const headText = treeHeaderTextColor(color)
    const mine = treeNodeIsMine(node)
    const w = nodeW(node)
    const h = nodeEffH(node)

    const wrap = treeEl('div', 'group absolute select-none')
    wrap.dataset.nodeId = node.id
    wrap.style.left = (node.x - w / 2) + 'px'
    wrap.style.top = (node.y - h / 2) + 'px'
    wrap.style.width = w + 'px'
    wrap.style.height = h + 'px'

    const win = treeEl('div', 'absolute inset-0 rounded-lg bg-white dark:bg-zinc-900 overflow-hidden border border-zinc-200/70 dark:border-zinc-700/60')
    win.style.boxShadow = '0 1px 2px rgba(15,23,42,.05)'

    // 标题条
    const head = treeEl('div', 'flex items-center gap-2 px-3 h-11 shrink-0')
    head.style.background = color
    head.title = '双击放大查看'
    head.addEventListener('dblclick', (e) => { e.stopPropagation(); openNodeFocus(node) })

    const dot = treeEl('button', 'w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-white/60 hover:ring-2 transition-all')
    dot.type = 'button'
    dot.style.background = 'rgba(255,255,255,.9)'
    dot.title = '换标题颜色'
    dot.addEventListener('pointerdown', (e) => e.stopPropagation())
    dot.addEventListener('click', (e) => { e.stopPropagation(); openNodeColorPicker(node, wrap) })

    const titleBox = treeEl('div', 'min-w-0 flex-1')
    const title = treeEl('p', 'text-[15px] font-semibold truncate leading-tight', node.title || '未命名')
    title.style.color = headText
    const kindLabel = treeEl('p', 'text-[10px] leading-tight truncate', node.kind === 'root' ? '主根' : '分支')
    kindLabel.style.color = headText
    kindLabel.style.opacity = '0.7'
    titleBox.appendChild(title)
    titleBox.appendChild(kindLabel)

    const headIcon = (icon, label, fn) => {
      const b = treeEl('button', 'shrink-0 w-6 h-6 rounded-md inline-flex items-center justify-center opacity-0 group-hover:opacity-80 hover:opacity-100 transition-opacity')
      b.type = 'button'
      b.title = label
      b.style.color = headText
      b.appendChild(treeIcon(icon, 13))
      b.addEventListener('pointerdown', (e) => e.stopPropagation())
      b.addEventListener('click', (e) => { e.stopPropagation(); fn() })
      return b
    }

    const renameBtn = headIcon('pencil', '重命名', () => startRenameNode(node, title))
    const expandBtn = headIcon('maximize', '放大查看', () => openNodeFocus(node))
    const delNode = headIcon('x', '删除节点', () => deleteTreeNode(node))

    head.appendChild(dot)
    head.appendChild(titleBox)
    head.appendChild(renameBtn)
    head.appendChild(expandBtn)
    head.appendChild(delNode)
    win.appendChild(head)

    const bodyEl = treeEl('div', 'px-3 pt-2 pb-2 flex flex-col overflow-hidden')
    bodyEl.style.height = (h - 40) + 'px'

    // 功能块：纯色背景（与节点颜色一致）
    const descPanel = treeEl('div', 'rounded-lg px-3 py-2.5 mb-3 shrink-0')
    descPanel.style.background = color
    const descLabel = treeEl('p', 'text-[11px] mb-0.5', '功能简述')
    descLabel.style.color = headText
    descLabel.style.opacity = '0.75'
    const desc = treeEl('div', 'text-[13.5px] leading-snug whitespace-pre-wrap break-words')
    desc.style.color = headText
    if (node.description) {
      desc.textContent = node.description
    } else {
      desc.textContent = mine ? '点击填写…' : '（未填写）'
      desc.style.opacity = '0.7'
    }
    if (mine) {
      desc.style.cursor = 'text'
      desc.title = '点击编辑，只有创建人能改'
      desc.addEventListener('pointerdown', (e) => e.stopPropagation())
      desc.addEventListener('click', (e) => { e.stopPropagation(); startEditNodeDescription(node, desc) })
    }
    descPanel.appendChild(descLabel)
    descPanel.appendChild(desc)
    bodyEl.appendChild(descPanel)

    // 功能块 1：功能实现
    const noteKey = node.id + ':notes'
    const notePanel = treeEl('div', 'rounded-lg border border-zinc-200/80 dark:border-zinc-700/70 bg-zinc-50/70 dark:bg-zinc-800/20 px-2 pt-1.5 pb-1.5')
    const noteHead = makeBlockHead(noteKey, 'lightbulb', '功能实现', notes.length, () => openTreeNoteEditor(null, node))
    notePanel.appendChild(noteHead.row)
    const noteList = treeEl('div', 'mt-1 space-y-0.5')
    if (treeCollapsed[noteKey]) noteList.style.display = 'none'
    noteHead.row.addEventListener('click', () => {
      treeCollapsed[noteKey] = !treeCollapsed[noteKey]
      persistNodeCollapsed(node)
      renderTreeNodes()
      renderTreeEdges()
    })
    if (notes.length === 0) {
      noteList.appendChild(treeEl('p', 'text-[12px] text-zinc-300 dark:text-zinc-600', '还没有想法'))
    } else {
      notes.slice(-3).forEach((n) => {
        const c = NOTE_COLORS[n.color] || NOTE_COLORS.yellow
        const row = treeEl('button', 'flex items-start gap-2 w-full text-left rounded px-1 -mx-1 py-0.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors')
        row.type = 'button'
        const av = treeEl('span', 'shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold')
        av.style.background = c.bg
        av.style.color = c.text
        av.textContent = String(treeAuthorName(n.author_id)).slice(0, 1)
        const txt = treeEl('span', 'min-w-0 flex-1 text-[13px] text-zinc-600 dark:text-zinc-300 truncate')
        txt.textContent = treeAuthorName(n.author_id) + '：' + summarizeNote(n.content)
        row.appendChild(av)
        row.appendChild(txt)
        row.addEventListener('pointerdown', (e) => e.stopPropagation())
        row.addEventListener('click', (e) => { e.stopPropagation(); openTreeNoteEditor(n, node) })
        noteList.appendChild(row)
      })
    }
    notePanel.appendChild(noteList)
    bodyEl.appendChild(notePanel)

    // 功能块 2：文件传输
    const fileKey = node.id + ':files'
    const filePanel = treeEl('div', 'mt-2 rounded-lg border border-zinc-200/80 dark:border-zinc-700/70 bg-zinc-50/70 dark:bg-zinc-800/20 px-2 pt-1.5 pb-1.5')
    const fileHeadCtl = makeBlockHead(fileKey, 'paperclip', '文件传输', files.length, () => openTreeFiles(node))
    filePanel.appendChild(fileHeadCtl.row)
    const fileList = treeEl('div', 'mt-1 space-y-0.5')
    if (treeCollapsed[fileKey]) fileList.style.display = 'none'
    fileHeadCtl.row.addEventListener('click', () => {
      treeCollapsed[fileKey] = !treeCollapsed[fileKey]
      persistNodeCollapsed(node)
      renderTreeNodes()
      renderTreeEdges()
    })
    if (files.length === 0) {
      fileList.appendChild(treeEl('p', 'text-[12px] text-zinc-300 dark:text-zinc-600', '还没有文件'))
    } else {
      files.slice(0, 3).forEach((f) => {
        const votes = treeVotesOf(f.id).length
        const voted = treeMyVote(f.id)
        const row = treeEl('div', 'flex items-center gap-2 rounded px-1 -mx-1 py-0.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors')
        const ic = treeEl('span', 'shrink-0 inline-flex text-zinc-400 dark:text-zinc-500')
        ic.appendChild(treeIcon('file', 15))
        const name = treeEl('button', 'min-w-0 flex-1 text-left text-[13px] text-zinc-700 dark:text-zinc-200 truncate hover:text-blue-500 transition-colors', f.name)
        name.type = 'button'
        name.title = '点击打开查看'
        name.addEventListener('pointerdown', (e) => e.stopPropagation())
        name.addEventListener('click', (e) => { e.stopPropagation(); previewNodeFile(f) })
        const vote = treeEl('button', 'shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] tabular-nums transition-colors ' +
          (voted ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300' : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'))
        vote.type = 'button'
        vote.appendChild(treeIcon('thumbs-up', 12))
        vote.appendChild(treeEl('span', '', String(votes)))
        vote.title = voted ? '取消投票' : '投票'
        vote.addEventListener('pointerdown', (e) => e.stopPropagation())
        vote.addEventListener('click', (e) => { e.stopPropagation(); toggleTreeVote(f) })
        const dl = document.createElement('a')
        dl.href = f.url
        dl.setAttribute('download', f.name)
        dl.className = 'shrink-0 inline-flex p-0.5 text-zinc-400 hover:text-blue-500 transition-colors'
        dl.title = '下载'
        dl.appendChild(treeIcon('download', 15))
        dl.addEventListener('pointerdown', (e) => e.stopPropagation())
        row.appendChild(ic)
        row.appendChild(name)
        row.appendChild(vote)
        row.appendChild(dl)
        fileList.appendChild(row)
      })
    }
    filePanel.appendChild(fileList)
    bodyEl.appendChild(filePanel)

    // 创建人
    const foot = treeEl('div', 'mt-auto pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-1.5 text-[11px] text-zinc-400 dark:text-zinc-500')
    const fdot = treeEl('span', 'w-2 h-2 rounded-full shrink-0')
    fdot.style.background = color
    foot.appendChild(fdot)
    foot.appendChild(treeEl('span', 'truncate', '创建人：' + treeAuthorName(node.created_by)))
    bodyEl.appendChild(foot)

    win.appendChild(bodyEl)
    wrap.appendChild(win)

    // 右下角缩放柄
    const grip = treeEl('div', 'absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity')
    grip.style.background = 'linear-gradient(135deg, transparent 50%, rgba(0,0,0,.22) 50%)'
    grip.title = '拖动改变节点大小'
    grip.addEventListener('pointerdown', (e) => onNodeResizeDown(e, node, wrap))
    wrap.appendChild(grip)

    // 添加子节点
    const addChildBtn = treeEl('button', 'absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 text-zinc-500 dark:text-zinc-300 text-[13px] leading-none shadow-sm opacity-0 group-hover:opacity-100 hover:text-blue-500 hover:border-blue-400 active:scale-95 transition-all')
    addChildBtn.type = 'button'
    addChildBtn.textContent = '+'
    addChildBtn.title = '添加子节点'
    addChildBtn.addEventListener('pointerdown', (e) => e.stopPropagation())
    addChildBtn.addEventListener('click', (e) => { e.stopPropagation(); createTreeNode({ kind: 'node', parent: node }) })
    wrap.appendChild(addChildBtn)

    // 连线手柄
    const inPort = treeEl('div', 'absolute -left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-zinc-300 pointer-events-none')
    wrap.appendChild(inPort)

    const handle = treeEl('button', 'absolute -right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-blue-500 hover:bg-blue-500 cursor-crosshair transition-all opacity-0 group-hover:opacity-100')
    handle.type = 'button'
    handle.setAttribute('data-link-handle', '1')
    handle.title = '拖到另一个节点连线'
    handle.addEventListener('pointerdown', (e) => onLinkHandleDown(e, node))
    wrap.appendChild(handle)

    wrap.addEventListener('pointerdown', (e) => onNodePointerDown(e, node, wrap))
    layer.appendChild(wrap)
  })
}


function makeBlockHead(key, icon, label, count, onPlus) {
  const row = treeEl('div', 'flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 cursor-pointer select-none rounded -mx-1 px-1 py-0.5 hover:bg-zinc-100/80 dark:hover:bg-zinc-700/40 transition-colors')
  const ic = treeEl('span', 'shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400')
  ic.appendChild(treeIcon(icon, 11))
  const lbl = treeEl('span', 'text-[12px] font-medium tracking-wide ml-0.5', label)
  const cnt = treeEl('span', 'text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500', String(count))
  const spacer = treeEl('span', 'flex-1')

  const plus = treeEl('button', 'shrink-0 w-5 h-5 rounded-md inline-flex items-center justify-center text-zinc-400 hover:text-blue-500 hover:bg-white dark:hover:bg-zinc-700 transition-colors')
  plus.type = 'button'
  plus.title = '新建'
  plus.appendChild(treeIcon('plus', 12))
  plus.addEventListener('pointerdown', (e) => e.stopPropagation())
  plus.addEventListener('click', (e) => { e.stopPropagation(); onPlus() })

  const chev = treeEl('span', 'shrink-0 w-4 text-[10px] text-center text-zinc-400', treeCollapsed[key] ? '▸' : '▾')

  row.appendChild(ic)
  row.appendChild(lbl)
  row.appendChild(cnt)
  row.appendChild(spacer)
  row.appendChild(plus)
  row.appendChild(chev)
  return { row, chev }
}

function sectionHead(icon, label, count) {
  const row = treeEl('div', 'flex items-center gap-1.5 text-zinc-400 dark:text-zinc-500')
  const ic = treeEl('span', 'shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400')
  ic.appendChild(treeIcon(icon, 11))
  row.appendChild(ic)
  row.appendChild(treeEl('span', 'text-[12px] font-medium tracking-wide ml-0.5', label))
  row.appendChild(treeEl('span', 'ml-auto text-[11px] tabular-nums', String(count)))
  return row
}

function summarizeNote(content) {
  const first = String(content || '').split('\n').find((l) => l.trim() && !l.trim().startsWith('!['))
  if (!first) return '（图片）'
  return first.replace(/==/g, '').slice(0, 60)
}

function startRenameNode(node, nameEl) {
  const input = document.createElement('input')
  input.type = 'text'
  input.value = node.title || ''
  input.maxLength = 40
  input.className = 'flex-1 min-w-0 bg-white dark:bg-zinc-800 border border-blue-400 rounded px-1 py-0.5 text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none'
  nameEl.replaceWith(input)
  input.focus()
  input.select()
  const commit = async (save) => {
    if (save) {
      const v = input.value.trim() || '未命名'
      const { error } = await supabase.from('tree_nodes').update({ title: v }).eq('id', node.id)
      if (error) treeEls.hint.textContent = '保存标题失败：' + error.message
      node.title = v
    }
    renderTreeNodes()
  }
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(true) }
    if (e.key === 'Escape') { e.preventDefault(); commit(false) }
  })
  input.addEventListener('blur', () => commit(true))
  input.addEventListener('pointerdown', (e) => e.stopPropagation())
}

// ── 连线 ───────────────────────────────────────────────────────────────
let treeLinkViews = {}

function treeLinkBase(link) {
  const a = treeNodeById(link.from_node)
  const b = treeNodeById(link.to_node)
  if (!a || !b) return null
  return { a, b, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }
}

function treeLinkPath(base, link) {
  const hx = base.mx + (link.bend_x || 0)
  const hy = base.my + (link.bend_y || 0)
  const cx = 2 * hx - base.mx
  const cy = 2 * hy - base.my
  return { d: `M ${base.a.x} ${base.a.y} Q ${cx} ${cy} ${base.b.x} ${base.b.y}`, hx, hy }
}

function updateTreeLinkVisual(link) {
  const view = treeLinkViews[link.id]
  const base = treeLinkBase(link)
  if (!view || !base) return
  const p = treeLinkPath(base, link)
  view.hit.setAttribute('d', p.d)
  view.path.setAttribute('d', p.d)
  view.knob.setAttribute('cx', p.hx)
  view.knob.setAttribute('cy', p.hy)
}

function treeEdgeBase(parent, child) {
  const pw = nodeW(parent), ph = nodeEffH(parent), cw = nodeW(child), ch = nodeEffH(child)
  const dx = child.x - parent.x
  const dy = child.y - parent.y
  const vertical = Math.abs(dy) >= Math.abs(dx) * 0.6
  let sx, sy, ex, ey, c1x, c1y, c2x, c2y

  if (vertical) {
    const down = dy >= 0
    sx = parent.x
    sy = parent.y + (down ? ph / 2 : -ph / 2)
    ex = child.x
    ey = child.y + (down ? -ch / 2 : ch / 2)
    const k = Math.max(50, Math.abs(ey - sy) * 0.45)
    c1x = sx; c1y = sy + (down ? k : -k)
    c2x = ex; c2y = ey + (down ? -k : k)
  } else {
    const right = dx >= 0
    sx = parent.x + (right ? pw / 2 : -pw / 2)
    sy = parent.y
    ex = child.x + (right ? -cw / 2 : cw / 2)
    ey = child.y
    const k = Math.max(60, Math.abs(ex - sx) * 0.45)
    c1x = sx + (right ? k : -k); c1y = sy
    c2x = ex + (right ? -k : k); c2y = ey
  }

  return {
    sx, sy, ex, ey, c1x, c1y, c2x, c2y,
    midX: (sx + 3 * c1x + 3 * c2x + ex) / 8,
    midY: (sy + 3 * c1y + 3 * c2y + ey) / 8,
  }
}

function treeEdgePath(parent, child) {
  const b = treeEdgeBase(parent, child)
  const bx = child.link_bend_x || 0
  const by = child.link_bend_y || 0
  return {
    d: `M ${b.sx} ${b.sy} C ${b.c1x + bx} ${b.c1y + by}, ${b.c2x + bx} ${b.c2y + by}, ${b.ex} ${b.ey}`,
    hx: b.midX + 0.75 * bx,
    hy: b.midY + 0.75 * by,
  }
}

function onTreeEdgeKnobDown(e, parent, child) {
  e.stopPropagation()
  e.preventDefault()
  const rect = treeEls.stage.getBoundingClientRect()
  const base = treeEdgeBase(parent, child)
  const onMove = (ev) => {
    const lx = (ev.clientX - rect.left - treePan.x) / treeZoom
    const ly = (ev.clientY - rect.top - treePan.y) / treeZoom
    child.link_bend_x = Math.round(((lx - base.midX) / 0.75) * 10) / 10
    child.link_bend_y = Math.round(((ly - base.midY) / 0.75) * 10) / 10
    renderTreeEdges()
  }
  const onUp = async () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    await supabase.from('tree_nodes').update({
      link_bend_x: child.link_bend_x || 0,
      link_bend_y: child.link_bend_y || 0,
    }).eq('id', child.id)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

function onTreeLinkKnobDown(e, link) {
  e.stopPropagation()
  e.preventDefault()
  const rect = treeEls.stage.getBoundingClientRect()
  const base = treeLinkBase(link)
  if (!base) return
  const onMove = (ev) => {
    const lx = (ev.clientX - rect.left - treePan.x) / treeZoom
    const ly = (ev.clientY - rect.top - treePan.y) / treeZoom
    link.bend_x = Math.round((lx - base.mx) * 10) / 10
    link.bend_y = Math.round((ly - base.my) * 10) / 10
    updateTreeLinkVisual(link)
  }
  const onUp = async () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    await supabase.from('tree_links').update({ bend_x: link.bend_x, bend_y: link.bend_y }).eq('id', link.id)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

function renderTreeEdges() {
  const g = treeEls.edgeGroup
  g.innerHTML = ''
  treeLinkViews = {}
  const byId = {}
  treeNodes.forEach((n) => { byId[n.id] = n })
  const ns = 'http://www.w3.org/2000/svg'

  treeNodes.forEach((node) => {
    if (!node.parent_id) return
    const parent = byId[node.parent_id]
    if (!parent) return
    const p = treeEdgePath(parent, node)

    const hit = document.createElementNS(ns, 'path')
    hit.setAttribute('d', p.d)
    hit.setAttribute('fill', 'none')
    hit.setAttribute('stroke', 'transparent')
    hit.setAttribute('stroke-width', '16')
    hit.style.pointerEvents = 'stroke'
    hit.style.cursor = 'move'

    const path = document.createElementNS(ns, 'path')
    path.setAttribute('d', p.d)
    path.setAttribute('fill', 'none')
    path.setAttribute('stroke', '#94a3b8')
    path.setAttribute('stroke-width', '2')
    path.style.pointerEvents = 'none'

    const knob = document.createElementNS(ns, 'circle')
    knob.setAttribute('cx', p.hx)
    knob.setAttribute('cy', p.hy)
    knob.setAttribute('r', '4.5')
    knob.setAttribute('fill', '#ffffff')
    knob.setAttribute('stroke', '#94a3b8')
    knob.setAttribute('stroke-width', '1.8')
    knob.style.pointerEvents = 'all'
    knob.style.cursor = 'move'
    knob.style.opacity = '0.55'

    hit.addEventListener('pointerenter', () => { path.setAttribute('stroke-width', '3'); knob.style.opacity = '1' })
    hit.addEventListener('pointerleave', () => { path.setAttribute('stroke-width', '2'); knob.style.opacity = '0.55' })
    hit.addEventListener('pointerdown', (e) => onTreeEdgeKnobDown(e, parent, node))
    knob.addEventListener('pointerdown', (e) => onTreeEdgeKnobDown(e, parent, node))
    knob.addEventListener('dblclick', async (e) => {
      e.stopPropagation()
      node.link_bend_x = 0
      node.link_bend_y = 0
      renderTreeEdges()
      await supabase.from('tree_nodes').update({ link_bend_x: 0, link_bend_y: 0 }).eq('id', node.id)
    })

    g.appendChild(hit)
    g.appendChild(path)
    g.appendChild(knob)
  })

  // 便签与节点的归属连线
  treeNotes.forEach((note) => {
    if (!note.node_id) return
    const node = byId[note.node_id]
    if (!node) return
    const line = document.createElementNS(ns, 'line')
    line.setAttribute('x1', note.x + (note.width || 200) / 2)
    line.setAttribute('y1', note.y + (note.height || 200) / 2)
    line.setAttribute('x2', node.x)
    line.setAttribute('y2', node.y)
    line.setAttribute('stroke', '#cbd5e1')
    line.setAttribute('stroke-width', '1.5')
    line.setAttribute('stroke-dasharray', '4 6')
    g.appendChild(line)
  })

  treeLinks.forEach((link) => {
    const base = treeLinkBase(link)
    if (!base) return
    const p = treeLinkPath(base, link)

    const hit = document.createElementNS(ns, 'path')
    hit.setAttribute('d', p.d)
    hit.setAttribute('fill', 'none')
    hit.setAttribute('stroke', 'transparent')
    hit.setAttribute('stroke-width', '18')
    hit.style.pointerEvents = 'stroke'
    hit.style.cursor = 'move'

    const path = document.createElementNS(ns, 'path')
    path.setAttribute('d', p.d)
    path.setAttribute('fill', 'none')
    path.setAttribute('stroke', '#60a5fa')
    path.setAttribute('stroke-width', '2.5')
    path.setAttribute('stroke-dasharray', '7 6')
    path.setAttribute('stroke-linecap', 'round')
    path.style.pointerEvents = 'none'

    const knob = document.createElementNS(ns, 'circle')
    knob.setAttribute('cx', p.hx)
    knob.setAttribute('cy', p.hy)
    knob.setAttribute('r', '5')
    knob.setAttribute('fill', '#ffffff')
    knob.setAttribute('stroke', '#3b82f6')
    knob.setAttribute('stroke-width', '2')
    knob.style.pointerEvents = 'all'
    knob.style.cursor = 'move'

    hit.addEventListener('pointerenter', () => path.setAttribute('stroke-width', '3.5'))
    hit.addEventListener('pointerleave', () => path.setAttribute('stroke-width', '2.5'))
    hit.addEventListener('pointerdown', (e) => onTreeLinkKnobDown(e, link))
    knob.addEventListener('pointerdown', (e) => onTreeLinkKnobDown(e, link))

    g.appendChild(hit)
    g.appendChild(path)
    g.appendChild(knob)
    treeLinkViews[link.id] = { hit, path, knob }
  })
}

// ── 拖动 / 平移 / 缩放 ─────────────────────────────────────────────────
function onNodePointerDown(e, node, wrapEl) {
  if (e.button !== 0) return
  if (e.target.closest && e.target.closest('[data-link-handle]')) return
  e.stopPropagation()
  closeTreeMenu()
  hideNotePeek()
  treeSelectedId = node.id
  applyTreeSelection()

  const startX = e.clientX
  const startY = e.clientY
  const nx = node.x
  const ny = node.y
  let moved = false

  const onMove = (ev) => {
    const dx = (ev.clientX - startX) / treeZoom
    const dy = (ev.clientY - startY) / treeZoom
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true
    node.x = nx + dx
    node.y = ny + dy
    if (wrapEl) {
      wrapEl.style.left = (node.x - nodeW(node) / 2) + 'px'
      wrapEl.style.top = (node.y - nodeH(node) / 2) + 'px'
    }
    renderTreeEdges()
  }

  const onUp = async () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    if (moved) {
      await supabase.from('tree_nodes').update({ x: node.x, y: node.y }).eq('id', node.id)
    }
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

function onStagePointerDown(e) {
  if (e.button !== 0) return
  if (e.target !== treeEls.stage && e.target !== treeEls.svg && e.target !== treeEls.layer) return
  closeTreeMenu()
  hideNotePeek()
  const startX = e.clientX
  const startY = e.clientY
  const px = treePan.x
  const py = treePan.y
  treeEls.stage.style.cursor = 'grabbing'

  const onMove = (ev) => {
    treePan.x = px + (ev.clientX - startX)
    treePan.y = py + (ev.clientY - startY)
    applyTreeTransform()
  }
  const onUp = () => {
    treeEls.stage.style.cursor = 'grab'
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

function onStageWheel(e) {
  e.preventDefault()
  setTreeZoom(treeZoom + (e.deltaY > 0 ? -0.08 : 0.08), { x: e.clientX, y: e.clientY })
}

function setTreeZoom(z, anchor) {
  const next = Math.min(1.8, Math.max(0.4, Math.round(z * 100) / 100))
  if (anchor && treeEls && treeEls.stage) {
    const rect = treeEls.stage.getBoundingClientRect()
    const mx = anchor.x - rect.left
    const my = anchor.y - rect.top
    const wx = (mx - treePan.x) / treeZoom
    const wy = (my - treePan.y) / treeZoom
    treeZoom = next
    treePan.x = mx - wx * treeZoom
    treePan.y = my - wy * treeZoom
  } else {
    treeZoom = next
  }
  applyTreeTransform()
}

function fitTreeView() {
  if (!treeEls) return
  if (treeNodes.length === 0) { treePan = { x: 200, y: 160 }; treeZoom = 1; applyTreeTransform(); return }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  treeNodes.forEach((n) => {
    minX = Math.min(minX, n.x - nodeW(n) / 2)
    maxX = Math.max(maxX, n.x + nodeW(n) / 2)
    minY = Math.min(minY, n.y - nodeEffH(n) / 2)
    maxY = Math.max(maxY, n.y + nodeEffH(n) / 2)
  })
  const w = Math.max(1, maxX - minX)
  const h = Math.max(1, maxY - minY)
  const rect = treeEls.stage.getBoundingClientRect()
  const pad = 70
  const z = Math.min(1.15, Math.max(0.4, Math.min((rect.width - pad * 2) / w, (rect.height - pad * 2) / h)))
  treeZoom = Math.round(z * 100) / 100
  treePan.x = rect.width / 2 - ((minX + maxX) / 2) * treeZoom
  treePan.y = rect.height / 2 - ((minY + maxY) / 2) * treeZoom
  applyTreeTransform()
}

// ── 右键菜单 ───────────────────────────────────────────────────────────
function openTreeMenu(clientX, clientY) {
  const rect = treeEls.stage.getBoundingClientRect()
  const lx = (clientX - rect.left - treePan.x) / treeZoom
  const ly = (clientY - rect.top - treePan.y) / treeZoom
  treeMenuPoint = { x: lx, y: ly }

  const menu = treeEls.menu
  menu.innerHTML = ''
  const mk = (label, fn) => {
    const b = treeEl('button', 'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left')
    b.type = 'button'
    b.textContent = label
    b.addEventListener('click', fn)
    menu.appendChild(b)
  }
  mk('在这里新建主根', () => createRootAt(lx, ly))
  if (treeSelectedId) {
    const sel = treeNodeById(treeSelectedId)
    mk('在选中节点下加分支', () => {
      closeTreeMenu()
      if (sel) createTreeNode({ kind: 'node', parent: sel })
    })
  }
  menu.appendChild(treeEl('div', 'my-1 h-px bg-zinc-100 dark:bg-zinc-800'))
  mk('视图居中', () => { closeTreeMenu(); fitTreeView() })

  menu.style.left = Math.min(Math.max(8, clientX - rect.left), rect.width - 210) + 'px'
  menu.style.top = Math.min(Math.max(8, clientY - rect.top), rect.height - 160) + 'px'
  menu.classList.remove('hidden')
}

function closeTreeMenu() {
  if (treeEls) treeEls.menu.classList.add('hidden')
}

// ── 连线手柄 ───────────────────────────────────────────────────────────
function onLinkHandleDown(e, node) {
  e.stopPropagation()
  e.preventDefault()
  closeTreeMenu()
  hideNotePeek()
  const rect = treeEls.stage.getBoundingClientRect()
  const ns = 'http://www.w3.org/2000/svg'
  const line = document.createElementNS(ns, 'line')
  line.setAttribute('stroke', '#3b82f6')
  line.setAttribute('stroke-width', '2')
  line.setAttribute('stroke-dasharray', '6 6')
  const sx = node.x + nodeW(node) / 2
  const sy = node.y
  line.setAttribute('x1', sx); line.setAttribute('y1', sy)
  line.setAttribute('x2', sx); line.setAttribute('y2', sy)
  treeEls.tempGroup.appendChild(line)

  const onMove = (ev) => {
    line.setAttribute('x2', (ev.clientX - rect.left - treePan.x) / treeZoom)
    line.setAttribute('y2', (ev.clientY - rect.top - treePan.y) / treeZoom)
  }
  const onUp = async (ev) => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    line.remove()
    const el = document.elementFromPoint(ev.clientX, ev.clientY)
    const wrap = el && el.closest ? el.closest('[data-node-id]') : null
    const targetId = wrap ? wrap.dataset.nodeId : null
    if (!targetId || targetId === node.id) { treeEls.hint.textContent = '连线取消：请拖到另一个节点上'; return }
    await createTreeLink(node.id, targetId)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

async function createTreeLink(fromId, toId) {
  const exists = treeLinks.some((l) =>
    (l.from_node === fromId && l.to_node === toId) || (l.from_node === toId && l.to_node === fromId))
  if (exists) { treeEls.hint.textContent = '这两个节点已经连过了'; return }
  const { data, error } = await supabase.from('tree_links').insert({
    project_id: treeProjectId, from_node: fromId, to_node: toId,
  }).select().single()
  if (error) { treeEls.hint.textContent = '连线失败：' + error.message; return }
  treeLinks.push(Object.assign({ bend_x: 0, bend_y: 0 }, data))
  renderTreeEdges()
  treeEls.hint.textContent = '连线成功'
}

// ── 便签：悬停预览 ─────────────────────────────────────────────────────
function renderNoteLines(container, content, noteColor) {
  const c = NOTE_COLORS[noteColor] || NOTE_COLORS.yellow
  const lines = String(content || '').split('\n')
  lines.forEach((line) => {
    const img = line.match(/^!\[[^\]]*\]\(([^)]+)\)\s*$/)
    if (img) {
      const wrap = document.createElement('div')
      wrap.style.padding = '4px 0 8px'
      const el = document.createElement('img')
      el.src = img[1]
      el.style.maxWidth = '100%'
      el.style.borderRadius = '6px'
      el.style.border = '1px solid ' + c.edge
      wrap.appendChild(el)
      container.appendChild(wrap)
      return
    }
    const row = document.createElement('div')
    row.style.height = '24px'
    row.style.lineHeight = '24px'
    row.style.borderBottom = '1px solid rgba(0,0,0,0.12)'
    row.style.fontSize = '13px'
    row.style.color = c.text
    row.style.whiteSpace = 'pre-wrap'
    row.style.overflow = 'hidden'
    row.innerHTML = escapeHtml(line).replace(/==([^=]+)==/g, '<mark style="background:linear-gradient(180deg,transparent 40%,#fde047 40%,#fde047 90%,transparent 90%);padding:0">$1</mark>')
    container.appendChild(row)
  })
}

function showNotePeek(note, anchor) {
  if (treePeekTimer) { clearTimeout(treePeekTimer); treePeekTimer = null }
  const peek = treeEls.peek
  const c = NOTE_COLORS[note.color] || NOTE_COLORS.yellow
  peek.innerHTML = ''
  peek.className = 'fixed z-[140] w-[260px] rounded-lg shadow-xl overflow-hidden'
  peek.style.background = c.bg
  peek.style.border = '2px solid ' + c.edge

  const head = treeEl('div', 'px-2.5 py-1 flex items-center gap-2')
  head.style.borderBottom = '1px solid ' + c.edge
  head.appendChild(treeEl('span', 'text-[11px] font-medium', treeAuthorName(note.author_id))).style.color = c.text
  const time = treeEl('span', 'text-[10px] opacity-70 ml-auto', fmtRel(new Date(note.created_at).getTime()))
  time.style.color = c.text
  head.appendChild(time)

  const bodyEl = treeEl('div', 'px-2.5 py-1 max-h-[280px] overflow-auto')
  renderNoteLines(bodyEl, note.content, note.color)

  peek.appendChild(head)
  peek.appendChild(bodyEl)

  const r = anchor.getBoundingClientRect()
  let left = r.right + 10
  if (left + 268 > window.innerWidth - 8) left = r.left - 270
  let top = r.top
  top = Math.max(8, Math.min(top, window.innerHeight - 240))
  peek.style.left = Math.max(8, left) + 'px'
  peek.style.top = top + 'px'
  peek.classList.remove('hidden')
}

function scheduleHideNotePeek() {
  if (treePeekTimer) clearTimeout(treePeekTimer)
  treePeekTimer = setTimeout(() => hideNotePeek(), 120)
}

function hideNotePeek() {
  if (treePeekTimer) { clearTimeout(treePeekTimer); treePeekTimer = null }
  if (treeEls && treeEls.peek) {
    treeEls.peek.classList.add('hidden')
    treeEls.peek.innerHTML = ''
  }
}

// ── 便签编辑器 ─────────────────────────────────────────────────────────
function ensureNoteEditor() {
  let modal = document.getElementById('tree-note-editor')
  if (modal) return modal
  modal = treeEl('div', 'hidden fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/40')
  modal.id = 'tree-note-editor'

  const card = treeEl('div', 'w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-2xl overflow-hidden')
  const head = treeEl('div', 'flex items-center gap-2 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800')
  head.appendChild(treeEl('p', 'text-sm font-medium text-zinc-900 dark:text-zinc-100', '便签'))
  const close = treeEl('button', 'ml-auto p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95', '×')
  close.type = 'button'
  head.appendChild(close)

  const bodyEl = treeEl('div', 'p-4 space-y-3')
  const colorRow = treeEl('div', 'flex items-center gap-1.5')
  const ta = document.createElement('textarea')
  ta.rows = 7
  ta.placeholder = '写点东西… 用 ==文字== 做荧光标记'
  ta.className = 'w-full rounded-xl px-3 py-2 text-[13px] text-zinc-800 border focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none'
  ta.style.lineHeight = '24px'
  ta.style.backgroundImage = 'repeating-linear-gradient(to bottom, transparent 0, transparent 23px, rgba(0,0,0,0.08) 23px, rgba(0,0,0,0.08) 24px)'
  ta.style.backgroundAttachment = 'local'

  const tools = treeEl('div', 'flex items-center gap-1.5')
  const hlBtn = treeEl('button', 'px-2 py-1 rounded-lg text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700', '🖍 高亮')
  hlBtn.type = 'button'
  const imgBtn = treeEl('button', 'px-2 py-1 rounded-lg text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700', '🖼 图片')
  imgBtn.type = 'button'
  const fileInput = document.createElement('input')
  fileInput.type = 'file'
  fileInput.accept = 'image/*'
  fileInput.className = 'hidden'
  const delBtn = treeEl('button', 'ml-auto px-2 py-1 rounded-lg text-[11px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20', '删除')
  delBtn.type = 'button'

  tools.appendChild(hlBtn)
  tools.appendChild(imgBtn)
  tools.appendChild(fileInput)
  tools.appendChild(delBtn)

  const actions = treeEl('div', 'flex items-center gap-2 pt-1')
  const cancel = treeEl('button', 'flex-1 px-3 py-2 rounded-xl text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 active:scale-95', '取消')
  cancel.type = 'button'
  const save = treeEl('button', 'flex-1 px-3 py-2 rounded-xl text-sm font-medium bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 active:scale-95', '保存')
  save.type = 'button'
  actions.appendChild(cancel)
  actions.appendChild(save)

  const nodeRow = treeEl('div', 'flex items-center gap-2')
  nodeRow.appendChild(treeEl('span', 'text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0', '关联节点'))
  const nodeSel = document.createElement('select')
  nodeSel.id = 'tree-note-node'
  nodeSel.className = 'flex-1 min-w-0 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-[12px] text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20'
  nodeRow.appendChild(nodeSel)

  bodyEl.appendChild(colorRow)
  bodyEl.appendChild(nodeRow)
  bodyEl.appendChild(ta)
  bodyEl.appendChild(tools)
  bodyEl.appendChild(actions)

  card.appendChild(head)
  card.appendChild(bodyEl)
  modal.appendChild(card)
  document.body.appendChild(modal)

  treeEls.noteEditor = { modal, ta, colorRow, nodeSel, hlBtn, imgBtn, fileInput, delBtn, save, cancel, close }
  close.addEventListener('click', closeTreeNoteEditor)
  cancel.addEventListener('click', closeTreeNoteEditor)
  modal.addEventListener('pointerdown', (e) => { if (e.target === modal) closeTreeNoteEditor() })
  return modal
}

function openTreeNoteEditor(note, node) {
  ensureNoteEditor()
  const center = treeViewCenter()
  treeNewNotePos = note ? null : (node
    ? { x: node.x + nodeW(node) / 2 + 24, y: node.y - 90, width: 210, height: 210 }
    : { x: center.x - 100, y: center.y - 100, width: 200, height: 200 })
  const ed = treeEls.noteEditor
  treeEditingNote = note || null
  treeEditorNodeId = node ? node.id : null
  const cur = note ? (note.color || 'yellow') : 'yellow'

  ed.colorRow.innerHTML = ''
  Object.keys(NOTE_COLORS).forEach((key) => {
    const c = NOTE_COLORS[key]
    const b = treeEl('button', 'w-6 h-6 rounded-full border-2 transition-transform active:scale-95')
    b.type = 'button'
    b.style.background = c.bg
    b.style.borderColor = key === cur ? c.edge : 'transparent'
    b.title = c.label
    b.dataset.color = key
    b.addEventListener('click', () => {
      ed.colorRow.dataset.selected = key
      Array.from(ed.colorRow.children).forEach((x) => {
        x.style.borderColor = x.dataset.color === key ? NOTE_COLORS[x.dataset.color].edge : 'transparent'
      })
    })
    ed.colorRow.appendChild(b)
  })
  ed.colorRow.dataset.selected = cur

  ed.nodeSel.innerHTML = ''
  const optNone = document.createElement('option')
  optNone.value = ''
  optNone.textContent = '不关联节点'
  ed.nodeSel.appendChild(optNone)
  treeNodes.forEach((n) => {
    const o = document.createElement('option')
    o.value = n.id
    o.textContent = n.title || '未命名'
    ed.nodeSel.appendChild(o)
  })
  ed.nodeSel.value = note ? (note.node_id || '') : (node ? node.id : '')

  ed.ta.value = note ? note.content : ''
  ed.delBtn.style.display = note ? '' : 'none'
  ed.modal.classList.remove('hidden')
  ed.ta.focus()

  ed.hlBtn.onclick = () => {
    const s = ed.ta.selectionStart
    const e = ed.ta.selectionEnd
    if (s === e) return
    const v = ed.ta.value
    ed.ta.value = v.slice(0, s) + '==' + v.slice(s, e) + '==' + v.slice(e)
    ed.ta.focus()
  }
  ed.imgBtn.onclick = () => ed.fileInput.click()
  ed.fileInput.onchange = async () => {
    const f = ed.fileInput.files && ed.fileInput.files[0]
    if (!f) return
    ed.fileInput.value = ''
    const safe = f.name.replace(/[^\w.\-]/g, '_')
    const path = `notes/${treeEditorNodeId}/${Date.now()}-${safe}`
    const { data: ud, error } = await supabase.storage.from('uploads').upload(path, f, { cacheControl: '3600', upsert: false, contentType: f.type || 'image/png' })
    if (error) { treeEls.hint.textContent = '图片上传失败：' + error.message; return }
    const { data: pub } = supabase.storage.from('uploads').getPublicUrl(ud.path)
    ed.ta.value += (ed.ta.value ? '\n' : '') + `![](${pub.publicUrl})`
  }
  ed.save.onclick = () => saveTreeNote(ed)
  ed.delBtn.onclick = () => deleteTreeNote(note)
}

function closeTreeNoteEditor() {
  const modal = document.getElementById('tree-note-editor')
  if (modal) modal.classList.add('hidden')
  treeEditingNote = null
  treeEditorNodeId = null
}

async function saveTreeNote(ed) {
  const content = ed.ta.value.trim()
  if (!content) { closeTreeNoteEditor(); return }
  const color = ed.colorRow.dataset.selected || 'yellow'
  const nodeId = ed.nodeSel ? (ed.nodeSel.value || null) : null
  const note = treeEditingNote
  if (note) {
    const { error } = await supabase.from('node_notes').update({ content, color, node_id: nodeId }).eq('id', note.id)
    if (error) { treeEls.hint.textContent = '保存失败：' + error.message; return }
    note.content = content
    note.color = color
    note.node_id = nodeId
  } else {
    const { data, error } = await supabase.from('node_notes').insert(Object.assign({
      node_id: nodeId,
      project_id: treeProjectId,
      author_id: currentUser ? currentUser.id : null,
      content,
      color,
    }, treeNewNotePos || {})).select().single()
    if (error) { treeEls.hint.textContent = '保存失败：' + error.message; return }
    if (data) treeNotes.push(data)
  }
  closeTreeNoteEditor()
  await loadTreeProfiles()
  renderTreeNodes()
  if (treePopoverNode) renderTreePopover(treePopoverNode)
  treeEls.hint.textContent = '便签已保存'
}

async function deleteTreeNote(note) {
  if (!note) return
  const ok = await confirmDialog({ title: '删除便签', message: '确定删除这条便签吗？', okText: '删除' })
  if (!ok) return
  await supabase.from('node_notes').delete().eq('id', note.id)
  treeNotes = treeNotes.filter((n) => n.id !== note.id)
  closeTreeNoteEditor()
  renderTree()
  if (treePopoverNode) renderTreePopover(treePopoverNode)
}

// ── 节点附件 ───────────────────────────────────────────────────────────
function ensureTreeFilesModal() {
  let modal = document.getElementById('tree-files-modal')
  if (modal) return modal
  modal = treeEl('div', 'hidden fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/40')
  modal.id = 'tree-files-modal'
  const card = treeEl('div', 'w-full max-w-md max-h-[80vh] rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-2xl flex flex-col overflow-hidden')
  const head = treeEl('div', 'flex items-center gap-2 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0')
  const t = treeEl('p', 'text-sm font-medium text-zinc-900 dark:text-zinc-100', '节点附件')
  const up = treeEl('button', 'ml-auto px-2 py-1 rounded-lg text-[11px] font-medium bg-zinc-900 text-white dark:bg-white dark:text-zinc-900', '上传')
  up.type = 'button'
  const close = treeEl('button', 'p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800', '×')
  close.type = 'button'
  const input = document.createElement('input')
  input.type = 'file'
  input.className = 'hidden'
  head.appendChild(t)
  head.appendChild(up)
  head.appendChild(close)
  head.appendChild(input)
  const list = treeEl('div', 'p-4 space-y-2 overflow-y-auto')
  card.appendChild(head)
  card.appendChild(list)
  modal.appendChild(card)
  document.body.appendChild(modal)
  treeEls.filesModal = { modal, list, up, input, close }
  close.addEventListener('click', closeTreeFiles)
  modal.addEventListener('pointerdown', (e) => { if (e.target === modal) closeTreeFiles() })
  return modal
}

async function openTreeFiles(node) {
  ensureTreeFilesModal()
  treeFilesNode = node
  const fm = treeEls.filesModal
  fm.modal.classList.remove('hidden')
  await renderTreeFiles()
}

function closeTreeFiles() {
  const modal = document.getElementById('tree-files-modal')
  if (modal) modal.classList.add('hidden')
  treeFilesNode = null
}

async function renderTreeFiles() {
  const fm = treeEls.filesModal
  const node = treeFilesNode
  if (!node) return

  const files = treeFilesOf(node.id)
    .slice()
    .sort((a, b) => treeVotesOf(b.id).length - treeVotesOf(a.id).length)

  fm.list.innerHTML = ''
  if (files.length === 0) {
    fm.list.appendChild(treeEl('p', 'text-xs text-zinc-400 text-center py-6', '还没有附件'))
    fm.up.onclick = () => fm.input.click()
    fm.input.onchange = async () => {
      const file = fm.input.files && fm.input.files[0]
      if (!file) return
      fm.input.value = ''
      await uploadNodeFile(node, file)
      await renderTreeFiles()
      renderTreeNodes()
    }
    return
  }

  const topVotes = treeVotesOf(files[0].id).length

  files.forEach((f, idx) => {
    const votes = treeVotesOf(f.id).length
    const voted = treeMyVote(f.id)

    const row = treeEl('div', 'rounded-xl border border-zinc-100 dark:border-zinc-800 px-3 py-2')

    const top = treeEl('div', 'flex items-center gap-2')
    const name = treeEl('button', 'text-sm text-zinc-900 dark:text-zinc-100 truncate flex-1 text-left hover:text-blue-500 transition-colors', f.name)
    name.type = 'button'
    name.title = '点击打开查看'
    name.addEventListener('click', () => previewNodeFile(f))
    top.appendChild(name)
    if (idx === 0 && topVotes > 0) {
      const badge = treeEl('span', 'shrink-0 px-1.5 py-0.5 rounded-md text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200', '票数最高')
      top.appendChild(badge)
    }
    if (f.status === 'approved') {
      top.appendChild(treeEl('span', 'shrink-0 px-1.5 py-0.5 rounded-md text-[10px] bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200', '已入库'))
    }
    row.appendChild(top)

    const meta = treeEl('p', 'text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5',
      `${fmtBytes(f.size || 0)} · ${treeAuthorName(f.author_id)} · ${treeVotesOf(f.id).length} 票`)
    row.appendChild(meta)

    const actions = treeEl('div', 'flex items-center gap-2 mt-1.5')

    const vote = treeEl('button', 'text-[11px] px-2 py-0.5 rounded-lg font-medium ' +
      (voted ? 'bg-blue-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200'),
      (voted ? '已投 · ' : '👍 ') + votes)
    vote.type = 'button'
    vote.addEventListener('click', () => toggleTreeVote(f))

    const dl = document.createElement('a')
    dl.href = f.url
    dl.setAttribute('download', f.name)
    dl.className = 'text-[11px] text-zinc-600 dark:text-zinc-300 hover:underline'
    dl.textContent = '下载'

    const approve = treeEl('button', 'text-[11px] text-blue-600 dark:text-blue-300 hover:underline',
      f.status === 'approved' ? '重新入库' : '上传到项目库')
    approve.type = 'button'
    approve.addEventListener('click', async () => {
      await approveNodeFile(f)
      await renderTreeFiles()
      renderTreeNodes()
    })

    const del = treeEl('button', 'ml-auto text-[11px] text-red-500 hover:underline', '删除')
    del.type = 'button'
    del.addEventListener('click', async () => {
      await supabase.storage.from('uploads').remove([f.path])
      await supabase.from('node_files').delete().eq('id', f.id)
      treeNodeFiles = treeNodeFiles.filter((x) => x.id !== f.id)
      treeVotes = treeVotes.filter((v) => v.file_id !== f.id)
      renderTreeNodes()
      await renderTreeFiles()
    })

    actions.appendChild(vote)
    actions.appendChild(dl)
    actions.appendChild(approve)
    actions.appendChild(del)
    row.appendChild(actions)

    fm.list.appendChild(row)
  })

  fm.up.onclick = () => fm.input.click()
  fm.input.onchange = async () => {
    const file = fm.input.files && fm.input.files[0]
    if (!file) return
    fm.input.value = ''
    await uploadNodeFile(node, file)
    await renderTreeFiles()
    renderTreeNodes()
  }
}

async function uploadNodeFile(node, file) {
  const safe = file.name.replace(/[^\w.\-\u4e00-\u9fa5]/g, '_')
  const path = `nodes/${node.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`
  const { data: ud, error: ue } = await supabase.storage.from('uploads').upload(path, file, {
    cacheControl: '3600', upsert: false, contentType: file.type || 'application/octet-stream',
  })
  if (ue) { treeEls.hint.textContent = '上传失败：' + ue.message; return }
  const { data: pub } = supabase.storage.from('uploads').getPublicUrl(ud.path)
  const { data: row, error } = await supabase.from('node_files').insert({
    node_id: node.id,
    author_id: currentUser ? currentUser.id : null,
    name: file.name,
    path: ud.path,
    url: pub.publicUrl,
    size: file.size,
    type: file.type || null,
    status: 'pending',
  }).select().single()
  if (error) { treeEls.hint.textContent = '保存失败：' + error.message; return }
  if (row) treeNodeFiles.push(row)
}

async function approveNodeFile(f) {
  const { error: ie } = await supabase.from('files').insert({
    name: f.name,
    category: guessCategory(f.name),
    path: f.path,
    url: f.url,
    size: f.size,
    type: f.type,
    project_id: treeProjectId,
    uploaded_by: f.author_id,
  })
  if (ie) { treeEls.hint.textContent = '入库失败：' + ie.message; return }
  await supabase.from('node_files').update({ status: 'approved' }).eq('id', f.id)
  f.status = 'approved'
  const { data: rows } = await supabase.from('files').select('*').eq('project_id', treeProjectId).order('created_at', { ascending: false })
  if (rows) {
    files = rows
    renderFiles()
    updateFileStats()
    if (typeof renderProjects === 'function') renderProjects()
  }
  treeEls.hint.textContent = '已并入项目文件：' + f.name
}

async function deleteTreeNode(node) {
  const ok = await confirmDialog({
    title: '删除节点',
    message: `确定删除「${node.title}」吗？它下面的分支、便签和附件都会一起删除。`,
    okText: '删除',
  })
  if (!ok) return
  const { error } = await supabase.from('tree_nodes').delete().eq('id', node.id)
  if (error) { treeEls.hint.textContent = '删除失败：' + error.message; return }
  treeNodes = treeNodes.filter((n) => n.id !== node.id && n.parent_id !== node.id)
  treeNotes = treeNotes.filter((n) => n.node_id !== node.id)
  treeLinks = treeLinks.filter((l) => l.from_node !== node.id && l.to_node !== node.id)
  treeSelectedId = null
  renderTree()
}
function openNodeColorPicker(node, wrap) {
  const old = wrap.querySelector('.node-color-pop')
  if (old) { old.remove(); return }
  const pop = treeEl('div', 'node-color-pop absolute z-30 flex items-center gap-1 p-1 rounded-lg bg-white dark:bg-zinc-800 shadow-lg border border-zinc-200 dark:border-zinc-700')
  pop.style.top = '32px'
  pop.style.left = '6px'
  Object.keys(TREE_BORDER_COLORS).forEach((key) => {
    const c = TREE_BORDER_COLORS[key]
    const b = treeEl('button', 'w-4 h-4 rounded-full border border-white/60')
    b.type = 'button'
    b.style.background = c.value
    b.title = c.label
    b.addEventListener('pointerdown', (e) => e.stopPropagation())
    b.addEventListener('click', async (e) => {
      e.stopPropagation()
      node.color = key
      pop.remove()
      renderTreeNodes()
      const { error } = await supabase.from('tree_nodes').update({ color: key }).eq('id', node.id)
      if (error) treeEls.hint.textContent = '保存颜色失败：' + error.message
    })
    pop.appendChild(b)
  })
  wrap.appendChild(pop)
  setTimeout(() => {
    const close = (ev) => {
      if (!pop.contains(ev.target)) { pop.remove(); document.removeEventListener('pointerdown', close) }
    }
    document.addEventListener('pointerdown', close)
  }, 0)
}
// ── 节点详情弹窗（保留的浮窗）─────────────────────────────────────────
let treePopoverNode = null

function ensureTreePopover() {
  let el = document.getElementById('tree-popover')
  if (el) return el
  el = treeEl('div', 'hidden fixed z-[138] w-[330px] max-h-[70vh] overflow-y-auto rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl')
  el.id = 'tree-popover'
  document.body.appendChild(el)
  document.addEventListener('pointerdown', (e) => {
    if (el.classList.contains('hidden')) return
    if (el.contains(e.target)) return
    if (e.target.closest && e.target.closest('[data-node-id]')) return
    closeTreePopover()
  })
  return el
}

function openTreePopover(node) {
  const el = ensureTreePopover()
  treePopoverNode = node
  el.classList.remove('hidden')
  renderTreePopover(node)

  const rect = treeEls.stage.getBoundingClientRect()
  const w = TREE_WIN_W
  let left = rect.left + treePan.x + (node.x + w / 2) * treeZoom + 52
  let top = rect.top + treePan.y + (node.y - TREE_WIN_H / 2) * treeZoom
  if (left + 340 > window.innerWidth - 8) {
    left = rect.left + treePan.x + (node.x - w / 2) * treeZoom - 342
  }
  el.style.left = Math.max(8, left) + 'px'
  el.style.top = Math.max(72, Math.min(top, window.innerHeight - 240)) + 'px'
}

function closeTreePopover() {
  const el = document.getElementById('tree-popover')
  if (el) el.classList.add('hidden')
  treePopoverNode = null
}

function renderTreePopover(node) {
  const el = ensureTreePopover()
  const color = treeBorderColor(node)
  const notes = treeNotesOf(node.id)
  const files = treeFilesOf(node.id)
  el.innerHTML = ''

  const head = treeEl('div', 'flex items-center gap-2 px-3 py-2.5 sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800')
  const dot = treeEl('span', 'w-3 h-3 rounded-full shrink-0')
  dot.style.background = color
  const name = treeEl('p', 'text-sm font-semibold truncate flex-1 text-zinc-900 dark:text-zinc-100', node.title || '未命名')
  const close = treeEl('button', 'p-1 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800', '×')
  close.type = 'button'
  close.addEventListener('click', closeTreePopover)
  head.appendChild(dot)
  head.appendChild(name)
  head.appendChild(close)
  el.appendChild(head)

  const bodyEl = treeEl('div', 'p-3 space-y-3')

  // 边框颜色
  const colorRow = treeEl('div', '')
  colorRow.appendChild(treeEl('p', 'text-[11px] text-zinc-500 dark:text-zinc-400 mb-1', '边框颜色'))
  const sw = treeEl('div', 'flex items-center gap-1.5')
  Object.keys(TREE_BORDER_COLORS).forEach((key) => {
    const c = TREE_BORDER_COLORS[key]
    const b = treeEl('button', 'w-5 h-5 rounded-full transition-transform active:scale-90')
    b.type = 'button'
    b.style.background = c.value
    b.style.border = node.color === key ? '2px solid #18181b' : '2px solid transparent'
    b.title = c.label
    b.addEventListener('click', async () => {
      node.color = key
      renderTreeNodes()
      renderTreePopover(node)
      await supabase.from('tree_nodes').update({ color: key }).eq('id', node.id)
    })
    sw.appendChild(b)
  })
  colorRow.appendChild(sw)
  bodyEl.appendChild(colorRow)

  // 便签
  const noteSec = treeEl('div', 'pt-2 border-t border-zinc-100 dark:border-zinc-800')
  const noteHead = treeEl('div', 'flex items-center justify-between mb-1.5')
  noteHead.appendChild(treeEl('p', 'text-xs font-medium text-zinc-900 dark:text-zinc-100', `便签 · ${notes.length}`))
  const addBtn = treeEl('button', 'text-[11px] text-blue-600 dark:text-blue-300 hover:underline', '+ 新建')
  addBtn.type = 'button'
  addBtn.addEventListener('click', () => { closeTreePopover(); openTreeNoteEditor(null, node) })
  noteHead.appendChild(addBtn)
  noteSec.appendChild(noteHead)

  if (notes.length === 0) {
    noteSec.appendChild(treeEl('p', 'text-[11px] text-zinc-400 dark:text-zinc-500 py-2 text-center', '还没有便签'))
  } else {
    notes.slice().reverse().forEach((n) => {
      const c = NOTE_COLORS[n.color] || NOTE_COLORS.yellow
      const item = treeEl('button', 'w-full text-left rounded-lg px-2 py-1.5 mb-1.5 last:mb-0 transition-transform hover:translate-x-0.5')
      item.type = 'button'
      item.style.background = c.bg
      item.style.border = '1.5px solid ' + c.edge
      const meta = treeEl('p', 'text-[10px] mb-0.5', treeAuthorName(n.author_id) + ' · ' + fmtRel(new Date(n.created_at).getTime()))
      meta.style.color = c.text
      meta.style.opacity = '0.75'
      const text = treeEl('p', 'text-[12px] truncate', summarizeNote(n.content))
      text.style.color = c.text
      item.appendChild(meta)
      item.appendChild(text)
      item.addEventListener('click', () => { closeTreePopover(); openNoteViewer(n) })
      noteSec.appendChild(item)
    })
  }
  bodyEl.appendChild(noteSec)

  // 附件
  const fileSec = treeEl('div', 'pt-2 border-t border-zinc-100 dark:border-zinc-800')
  const fileHead = treeEl('div', 'flex items-center justify-between mb-1.5')
  fileHead.appendChild(treeEl('p', 'text-xs font-medium text-zinc-900 dark:text-zinc-100', `附件 · ${files.length}`))
  const up = treeEl('button', 'text-[11px] text-blue-600 dark:text-blue-300 hover:underline', '上传')
  up.type = 'button'
  up.addEventListener('click', () => openTreeFiles(node))
  fileHead.appendChild(up)
  fileSec.appendChild(fileHead)

  files.slice(0, 4).forEach((f) => {
    const row = treeEl('div', 'flex items-center gap-2 py-0.5')
    row.appendChild(treeEl('span', 'text-[11px] text-zinc-600 dark:text-zinc-300 truncate flex-1', f.name))
    const dl = document.createElement('a')
    dl.href = f.url
    dl.setAttribute('download', f.name)
    dl.className = 'text-[11px] text-zinc-400 hover:text-blue-500'
    dl.textContent = '下载'
    row.appendChild(dl)
    fileSec.appendChild(row)
  })
  if (files.length === 0) fileSec.appendChild(treeEl('p', 'text-[11px] text-zinc-400 dark:text-zinc-500 py-1 text-center', '还没有附件'))
  bodyEl.appendChild(fileSec)

  el.appendChild(bodyEl)
}

// ── 便签放大弹窗 ───────────────────────────────────────────────────────
function ensureNoteViewer() {
  let el = document.getElementById('tree-note-view')
  if (el) return el
  el = treeEl('div', 'hidden fixed inset-0 z-[136] items-center justify-center bg-black/40 p-4')
  el.id = 'tree-note-view'
  const card = treeEl('div', 'w-full max-w-lg max-h-[80vh] overflow-auto rounded-2xl shadow-2xl')
  card.id = 'tree-note-view-card'
  el.appendChild(card)
  document.body.appendChild(el)
  el.addEventListener('pointerdown', (e) => { if (e.target === el) closeNoteViewer() })
  return el
}

function openNoteViewer(note) {
  const el = ensureNoteViewer()
  const card = document.getElementById('tree-note-view-card')
  const c = NOTE_COLORS[note.color] || NOTE_COLORS.yellow
  card.innerHTML = ''
  card.style.background = c.bg
  card.style.border = '2px solid ' + c.edge
  card.style.transform = 'scale(.86)'
  card.style.opacity = '0'
  card.style.transition = 'transform .18s cubic-bezier(.2,.8,.3,1), opacity .18s ease'

  const head = treeEl('div', 'flex items-center gap-2 px-4 py-2.5')
  head.style.borderBottom = '1px solid ' + c.edge
  const who = treeEl('span', 'text-xs font-medium', treeAuthorName(note.author_id))
  who.style.color = c.text
  const when = treeEl('span', 'text-[11px] ml-2 opacity-70', fmtRel(new Date(note.created_at).getTime()))
  when.style.color = c.text
  const close = treeEl('button', 'ml-auto text-lg leading-none opacity-60 hover:opacity-100', '×')
  close.type = 'button'
  close.style.color = c.text
  close.addEventListener('click', closeNoteViewer)
  head.appendChild(who)
  head.appendChild(when)
  head.appendChild(close)

  const bodyEl = treeEl('div', 'px-4 py-2 max-h-[52vh] overflow-auto')
  renderNoteLines(bodyEl, note.content, note.color)

  const foot = treeEl('div', 'flex items-center gap-3 px-4 py-2.5')
  foot.style.borderTop = '1px solid ' + c.edge
  const edit = treeEl('button', 'text-xs font-medium hover:underline', '编辑')
  edit.type = 'button'
  edit.style.color = c.text
  edit.addEventListener('click', () => { closeNoteViewer(); openTreeNoteEditor(note, treeNodeById(note.node_id)) })
  const del = treeEl('button', 'text-xs font-medium hover:underline ml-auto', '删除')
  del.type = 'button'
  del.style.color = '#b91c1c'
  del.addEventListener('click', () => { closeNoteViewer(); deleteTreeNote(note) })
  foot.appendChild(edit)
  foot.appendChild(del)

  card.appendChild(head)
  card.appendChild(bodyEl)
  card.appendChild(foot)

  el.classList.remove('hidden')
  el.classList.add('flex')
  requestAnimationFrame(() => {
    card.style.transform = 'scale(1)'
    card.style.opacity = '1'
  })
}

function closeNoteViewer() {
  const el = document.getElementById('tree-note-view')
  if (!el) return
  el.classList.add('hidden')
  el.classList.remove('flex')
}

// ── 便签卡片（可拖动 / 可缩放）────────────────────────────────────────
function renderTreeNotes() {
  const layer = treeEls.layer
  layer.querySelectorAll('[data-note-card]').forEach((el) => el.remove())

  treeNotes.forEach((note) => {
    const c = NOTE_COLORS[note.color] || NOTE_COLORS.yellow
    const card = treeEl('div', 'group/note absolute rounded flex flex-col transition-transform duration-200 hover:-translate-y-0.5')
    card.dataset.noteCard = '1'
    card.style.left = note.x + 'px'
    card.style.top = note.y + 'px'
    card.style.width = (note.width || 200) + 'px'
    card.style.height = (note.height || 200) + 'px'
    card.style.background = c.bg
    card.style.boxShadow = '0 2px 4px rgba(0,0,0,.10), 0 8px 20px -12px rgba(0,0,0,.35)'
    card.style.cursor = 'grab'

    const inner = treeEl('div', 'flex-1 flex flex-col p-3 overflow-hidden')
    const contentEl = treeEl('div', 'flex-1 overflow-hidden')
    contentEl.style.fontSize = '14px'
    contentEl.style.lineHeight = '1.55'
    contentEl.style.color = c.text
    contentEl.style.fontFamily = '"Segoe Print", "Bradley Hand", "Comic Sans MS", "PingFang SC", "Microsoft YaHei", sans-serif'
    renderNotePlain(contentEl, note.content, c)

    const author = treeEl('p', 'mt-2 text-[10px] opacity-60 truncate', treeAuthorName(note.author_id))
    author.style.color = c.text

    inner.appendChild(contentEl)
    inner.appendChild(author)

    const actions = treeEl('div', 'absolute top-1 right-1 hidden group-hover/note:flex items-center gap-0.5')
    const editBtn = treeEl('button', 'w-4 h-4 rounded text-[10px] leading-none bg-white/70 hover:bg-white')
    editBtn.type = 'button'
    editBtn.textContent = '✎'
    editBtn.title = '编辑'
    editBtn.style.color = c.text
    editBtn.addEventListener('pointerdown', (e) => e.stopPropagation())
    editBtn.addEventListener('click', (e) => { e.stopPropagation(); openTreeNoteEditor(note, note.node_id ? treeNodeById(note.node_id) : null) })
    const delBtn = treeEl('button', 'w-4 h-4 rounded text-[11px] leading-none bg-white/70 hover:bg-white')
    delBtn.type = 'button'
    delBtn.textContent = '×'
    delBtn.title = '删除'
    delBtn.style.color = c.text
    delBtn.addEventListener('pointerdown', (e) => e.stopPropagation())
    delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteTreeNote(note) })
    actions.appendChild(editBtn)
    actions.appendChild(delBtn)

    const grip = treeEl('div', 'absolute bottom-0 right-0 w-3.5 h-3.5 cursor-nwse-resize opacity-0 group-hover/note:opacity-100')
    grip.dataset.noteResize = '1'
    grip.style.background = 'linear-gradient(135deg, transparent 50%, rgba(0,0,0,.22) 50%)'
    grip.addEventListener('pointerdown', (e) => onNoteResizeDown(e, note, card))

    card.appendChild(inner)
    card.appendChild(actions)
    card.appendChild(grip)

    card.addEventListener('pointerdown', (e) => onNoteDragDown(e, note, card))
    card.addEventListener('dblclick', (e) => {
      e.stopPropagation()
      openTreeNoteEditor(note, note.node_id ? treeNodeById(note.node_id) : null)
    })
    layer.appendChild(card)
  })
}

function renderNotePlain(container, content, c) {
  const lines = String(content || '').split('\n')
  lines.forEach((line) => {
    const img = line.match(/^!\[[^\]]*\]\(([^)]+)\)\s*$/)
    if (img) {
      const el = document.createElement('img')
      el.src = img[1]
      el.style.maxWidth = '100%'
      el.style.borderRadius = '2px'
      el.style.margin = '4px 0'
      container.appendChild(el)
      return
    }
    const p = document.createElement('p')
    p.style.margin = '0'
    p.style.whiteSpace = 'pre-wrap'
    p.style.wordBreak = 'break-word'
    p.innerHTML = escapeHtml(line).replace(/==([^=]+)==/g, '<mark style="background:linear-gradient(180deg,transparent 45%,rgba(255,255,255,.72) 45%,rgba(255,255,255,.72) 92%,transparent 92%);color:inherit;padding:0">$1</mark>')
    container.appendChild(p)
  })
}

function onNoteDragDown(e, note, card) {
  if (e.button !== 0) return
  e.stopPropagation()
  e.preventDefault()
  const sx = e.clientX
  const sy = e.clientY
  const nx = note.x
  const ny = note.y
  let moved = false

  const onMove = (ev) => {
    const dx = (ev.clientX - sx) / treeZoom
    const dy = (ev.clientY - sy) / treeZoom
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true
    note.x = nx + dx
    note.y = ny + dy
    card.style.left = note.x + 'px'
    card.style.top = note.y + 'px'
  }
  const onUp = async () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    if (moved) await supabase.from('node_notes').update({ x: note.x, y: note.y }).eq('id', note.id)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

function onNoteResizeDown(e, note, card) {
  if (e.button !== 0) return
  e.stopPropagation()
  e.preventDefault()
  const sx = e.clientX
  const sy = e.clientY
  const w0 = note.width || 200
  const h0 = note.height || 150

  const onMove = (ev) => {
    note.width = Math.round(Math.max(140, Math.min(560, w0 + (ev.clientX - sx) / treeZoom)))
    note.height = Math.round(Math.max(90, Math.min(460, h0 + (ev.clientY - sy) / treeZoom)))
    card.style.width = note.width + 'px'
    card.style.height = note.height + 'px'
  }
  const onUp = async () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    await supabase.from('node_notes').update({ width: note.width, height: note.height }).eq('id', note.id)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}


// 节点附件 -> 站内预览（复用 20-preview.js 的 openPreview，代码文件会高亮）
function previewNodeFile(f) {
  if (!f || !f.url) return
  const view = {
    id: f.id,
    name: f.name,
    url: f.url,
    size: f.size,
    type: f.type || '',
    category: guessCategory(f.name),
    path: f.path,
  }
  if (typeof openPreview === 'function') {
    const modal = document.getElementById('preview-modal')
    if (modal) modal.style.zIndex = '140'
    openPreview(view)
  }
  else window.open(f.url, '_blank', 'noopener')
}

// ── 节点放大查看 ────────────────────────────────────────────────────
function openNodeFocus(node) {
  let el = document.getElementById('tree-node-focus')
  if (!el) {
    el = treeEl('div', 'hidden fixed inset-0 z-[135] items-center justify-center bg-black/50 p-4')
    el.id = 'tree-node-focus'
    document.body.appendChild(el)
    el.addEventListener('pointerdown', (e) => { if (e.target === el) closeNodeFocus() })
  }

  const color = treeBorderColor(node)
  const headText = treeHeaderTextColor(color)
  const notes = treeNotesOf(node.id)
  const files = treeFilesOf(node.id)
  const mine = treeNodeIsMine(node)

  el.innerHTML = ''
  const card = treeEl('div', 'w-full max-w-3xl max-h-[86vh] rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden flex flex-col')
  card.style.border = '1px solid rgba(0,0,0,.06)'

  const head = treeEl('div', 'flex items-center gap-3 px-5 h-16 shrink-0')
  head.style.background = color
  const title = treeEl('p', 'text-[20px] font-semibold truncate flex-1', node.title || '未命名')
  title.style.color = headText
  const kind = treeEl('span', 'shrink-0 px-2 py-0.5 rounded-md text-[11px]', node.kind === 'root' ? '主根' : '分支')
  kind.style.color = headText
  kind.style.background = 'rgba(255,255,255,.18)'
  const close = treeEl('button', 'shrink-0 w-8 h-8 rounded-lg text-[20px] leading-none opacity-80 hover:opacity-100')
  close.type = 'button'
  close.textContent = '×'
  close.style.color = headText
  close.addEventListener('click', closeNodeFocus)
  head.appendChild(kind)
  head.appendChild(title)
  head.appendChild(close)

  const body = treeEl('div', 'flex-1 overflow-y-auto p-5 space-y-4')

  // 功能简述
  const desc = treeEl('div', 'rounded-xl px-4 py-3')
  desc.style.background = color
  const dl = treeEl('p', 'text-[11px] mb-1', '功能简述')
  dl.style.color = headText
  dl.style.opacity = '0.75'
  const dv = treeEl('p', 'text-[14px] leading-relaxed whitespace-pre-wrap break-words', node.description || (mine ? '（还没写，回到画布点一下就能编辑）' : '（未填写）'))
  dv.style.color = headText
  if (!node.description) dv.style.opacity = '0.75'
  desc.appendChild(dl)
  desc.appendChild(dv)
  body.appendChild(desc)

  // 便签
  const noteSec = treeEl('div', '')
  noteSec.appendChild(treeEl('p', 'text-[12px] font-medium text-zinc-500 dark:text-zinc-400 mb-2', `功能实现 · ${notes.length}`))
  if (notes.length === 0) {
    noteSec.appendChild(treeEl('p', 'text-[12px] text-zinc-300 dark:text-zinc-600', '还没有便签'))
  } else {
    notes.slice().reverse().forEach((n) => {
      const c = NOTE_COLORS[n.color] || NOTE_COLORS.yellow
      const row = treeEl('button', 'w-full text-left rounded-xl px-3 py-2 mb-2 transition-transform hover:translate-x-0.5')
      row.type = 'button'
      row.style.background = c.bg
      const meta = treeEl('p', 'text-[10px] mb-0.5', treeAuthorName(n.author_id) + ' · ' + fmtRel(new Date(n.created_at).getTime()))
      meta.style.color = c.text
      meta.style.opacity = '0.7'
      const text = treeEl('div', 'text-[13px] leading-relaxed whitespace-pre-wrap break-words')
      text.style.color = c.text
      renderNotePlain(text, n.content, c)
      row.appendChild(meta)
      row.appendChild(text)
      row.addEventListener('click', () => { closeNodeFocus(); openTreeNoteEditor(n, node) })
      noteSec.appendChild(row)
    })
  }
  body.appendChild(noteSec)

  // 文件
  const fileSec = treeEl('div', '')
  fileSec.appendChild(treeEl('p', 'text-[12px] font-medium text-zinc-500 dark:text-zinc-400 mb-2', `文件传输 · ${files.length}`))
  if (files.length === 0) {
    fileSec.appendChild(treeEl('p', 'text-[12px] text-zinc-300 dark:text-zinc-600', '还没有文件'))
  } else {
    files.forEach((f) => {
      const row = treeEl('div', 'flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/60')
      const ic = treeEl('span', 'shrink-0 inline-flex text-zinc-400')
      ic.appendChild(treeIcon('file', 15))
      const name = treeEl('button', 'flex-1 min-w-0 text-left text-[13px] text-zinc-700 dark:text-zinc-200 truncate hover:text-blue-500', f.name)
      name.type = 'button'
      name.addEventListener('click', () => previewNodeFile(f))
      const meta = treeEl('span', 'shrink-0 text-[11px] text-zinc-400', treeAuthorName(f.author_id))
      const dl = document.createElement('a')
      dl.href = f.url
      dl.setAttribute('download', f.name)
      dl.className = 'shrink-0 inline-flex p-1 text-zinc-400 hover:text-blue-500'
      dl.appendChild(treeIcon('download', 15))
      row.appendChild(ic)
      row.appendChild(name)
      row.appendChild(meta)
      row.appendChild(dl)
      fileSec.appendChild(row)
    })
  }
  body.appendChild(fileSec)

  const foot = treeEl('div', 'px-5 py-3 border-t border-zinc-100 dark:border-zinc-800 text-[11px] text-zinc-400 flex items-center gap-2')
  const fdot = treeEl('span', 'w-2 h-2 rounded-full')
  fdot.style.background = color
  foot.appendChild(fdot)
  foot.appendChild(treeEl('span', '', '创建人：' + treeAuthorName(node.created_by)))
  body.appendChild(foot)

  card.appendChild(head)
  card.appendChild(body)
  el.appendChild(card)
  el.classList.remove('hidden')
  el.classList.add('flex')
}

function closeNodeFocus() {
  const el = document.getElementById('tree-node-focus')
  if (!el) return
  el.classList.add('hidden')
  el.classList.remove('flex')
}
