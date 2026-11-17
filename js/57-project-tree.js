/* ─────────────────────────────────────────────────────────────
 * 57-project-tree.js · 项目知识树（记忆节点图）
 * · 右键空白处新建主根
 * · 节点右侧「+」拖到另一个节点即可连线
 * · 主根可换形状、调大小、换颜色
 * · 节点信息是贴在节点右侧的浮动弹窗，可收起成小圆点，不遮挡画布操作
 * ───────────────────────────────────────────────────────────── */
'use strict'

const TREE_ROOT_W = 240
const TREE_ROOT_H = 90
const TREE_NODE_W = 196
const TREE_NODE_H = 66

const TREE_SHAPES = {
  rect: { label: '圆角', cls: 'rounded-2xl', style: '' },
  pill: { label: '胶囊', cls: 'rounded-full', style: '' },
  hex: { label: '六边形', cls: '', style: 'clip-path:polygon(14% 0,86% 0,100% 50%,86% 100%,14% 100%,0 50%)' },
  diamond: { label: '菱形', cls: '', style: 'clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)' },
}

const TREE_COLORS = {
  plain: { label: '默认', cls: 'bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 border-zinc-200 dark:border-zinc-700', swatch: 'bg-white border border-zinc-300' },
  indigo: { label: '蓝紫', cls: 'bg-gradient-to-br from-blue-500 to-purple-600 text-white border-transparent shadow-md', swatch: 'bg-gradient-to-br from-blue-500 to-purple-600' },
  sky: { label: '天蓝', cls: 'bg-gradient-to-br from-sky-500 to-blue-600 text-white border-transparent shadow-md', swatch: 'bg-gradient-to-br from-sky-500 to-blue-600' },
  emerald: { label: '翠绿', cls: 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-transparent shadow-md', swatch: 'bg-gradient-to-br from-emerald-500 to-teal-600' },
  amber: { label: '橙黄', cls: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white border-transparent shadow-md', swatch: 'bg-gradient-to-br from-amber-500 to-orange-600' },
  rose: { label: '玫红', cls: 'bg-gradient-to-br from-rose-500 to-pink-600 text-white border-transparent shadow-md', swatch: 'bg-gradient-to-br from-rose-500 to-pink-600' },
  slate: { label: '石墨', cls: 'bg-gradient-to-br from-zinc-600 to-zinc-900 text-white border-transparent shadow-md', swatch: 'bg-gradient-to-br from-zinc-600 to-zinc-900' },
}

let treeProjectId = null
let treeProjectName = ''
let treeNodes = []
let treeLinks = []
let treeNotes = []
let treeNodeFiles = []
let treeProfiles = {}
let treeSelectedId = null
let treePopoverNodeId = null
let treePopoverCollapsed = false
let treeZoom = 1
let treePan = { x: 0, y: 0 }
let treeEls = null
let treeMenuPoint = null
let treeLinkDrag = null

const treeW = (n) => (n.width || (n.kind === 'root' ? TREE_ROOT_W : TREE_NODE_W))
const treeH = (n) => (n.height || (n.kind === 'root' ? TREE_ROOT_H : TREE_NODE_H))
const treeColor = (n) => TREE_COLORS[n.color] || (n.kind === 'root' ? TREE_COLORS.indigo : TREE_COLORS.plain)

function treeEl(tag, cls, text) {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text != null) e.textContent = text
  return e
}

function treeAuthorName(id) {
  if (!id) return '匿名'
  if (currentUser && id === currentUser.id) return '我'
  const p = treeProfiles[id]
  return (p && (p.nickname || p.name)) || '成员'
}

function treeNodeById(id) {
  return treeNodes.find((n) => n.id === id) || null
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

  const addRoot = treeEl('button', btnBase + ' bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200')
  addRoot.type = 'button'
  addRoot.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>主根'

  const addChild = treeEl('button', btnBase + ' bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-40')
  addChild.type = 'button'
  addChild.disabled = true
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

  const hint = treeEl('p', 'absolute bottom-3 left-3 right-3 text-[11px] text-zinc-400 dark:text-zinc-500 pointer-events-none truncate',
    '右键新建主根 · 节点右侧 + 拖出连线 · 拖连线上的圆点可弯曲（双击复位） · 滚轮缩放')

  const popover = treeEl('div', 'hidden absolute z-30')
  const menu = treeEl('div', 'hidden absolute z-40 w-52 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl p-1')

  stage.appendChild(svg)
  svg.appendChild(edgeGroup)
  svg.appendChild(tempGroup)
  stage.appendChild(layer)
  stage.appendChild(popover)
  stage.appendChild(menu)
  stage.appendChild(hint)

  body.appendChild(stage)
  modal.appendChild(header)
  modal.appendChild(body)
  document.body.appendChild(modal)

  treeEls = { modal, back, title, sub, addRoot, addChild, zoomOut, zoomIn, zoomLabel, fitBtn, stage, svg, edgeGroup, tempGroup, layer, popover, menu, hint }

  back.addEventListener('click', closeTree)
  addRoot.addEventListener('click', () => {
    const rect = stage.getBoundingClientRect()
    const x = (rect.width / 2 - treePan.x) / treeZoom
    const y = (rect.height / 2 - treePan.y) / treeZoom
    createRootAt(x, y)
  })
  addChild.addEventListener('click', () => {
    const parent = treeNodeById(treeSelectedId)
    if (parent) createTreeNode({ kind: 'node', parent })
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
  window.addEventListener('resize', () => updateTreePopoverPosition())
  window.addEventListener('keydown', onTreeKeydown)

  return treeEls
}

function onTreeKeydown(e) {
  if (!treeEls || treeEls.modal.classList.contains('hidden')) return
  if (e.key === 'Escape') {
    if (!treeEls.menu.classList.contains('hidden')) { closeTreeMenu(); return }
    if (treePopoverCollapsed === false && treePopoverNodeId) { treePopoverCollapsed = true; openTreePopover(treePopoverNodeId); return }
    closeTree()
  }
}

// ── 打开 / 关闭 ────────────────────────────────────────────────────────
async function openTree(proj) {
  if (!currentUser) { openUserModal(); return }
  treeMount()
  treeProjectId = proj.id
  treeProjectName = proj.name || '项目'
  treeEls.title.textContent = `${treeProjectName} · 知识树`
  treeEls.sub.textContent = proj.research_field || '右键空白处新建主根'
  treeEls.modal.classList.remove('hidden')
  document.body.style.overflow = 'hidden'
  treeSelectedId = null
  treePopoverNodeId = null
  treePopoverCollapsed = false
  treeEls.popover.classList.add('hidden')
  closeTreeMenu()
  await loadTree()
  fitTreeView()
}

function closeTree() {
  if (!treeEls) return
  treeEls.modal.classList.add('hidden')
  treeEls.popover.classList.add('hidden')
  closeTreeMenu()
  document.body.style.overflow = ''
  treeSelectedId = null
  treePopoverNodeId = null
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
    treeEls.hint.textContent = '加载失败：' + error.message + '（请先执行 supabase/migrations/20261118_project_tree.sql）'
  } else {
    treeNodes = nodes || []
  }

  const { data: links } = await supabase.from('tree_links').select('*').eq('project_id', treeProjectId)
  treeLinks = links || []

  if (treeNodes.length === 0) {
    const root = await insertTreeNode({ kind: 'root', title: treeProjectName, parent: null, x: 0, y: 0 })
    if (root) treeNodes.push(root)
  }

  await loadTreeProfiles()
  renderTree()
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
    color: kind === 'root' ? 'indigo' : 'plain',
    width: kind === 'root' ? TREE_ROOT_W : TREE_NODE_W,
    height: kind === 'root' ? TREE_ROOT_H : TREE_NODE_H,
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
  selectTreeNode(node.id)
  treeEls.hint.textContent = '已创建主根，可以拖动、调大小、换形状和颜色'
}

async function createTreeNode({ kind, parent }) {
  let x = 0
  let y = 0
  if (kind === 'root') {
    const roots = treeNodes.filter((n) => n.kind === 'root')
    x = roots.length === 0 ? 0 : Math.max.apply(null, roots.map((r) => r.x)) + 340
    y = 0
  } else if (parent) {
    const siblings = treeNodes.filter((n) => n.parent_id === parent.id)
    const n = siblings.length
    const offset = n === 0 ? 0 : (n % 2 === 1 ? 1 : -1) * Math.ceil(n / 2) * 240
    x = parent.x + offset
    y = parent.y + 170
  }

  const node = await insertTreeNode({ kind, title: kind === 'root' ? '新主根' : '新分支', parent, x, y })
  if (!node) return
  treeNodes.push(node)
  renderTree()
  selectTreeNode(node.id)
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
  updateTreePopoverPosition()
}

function renderTree() {
  if (!treeEls) return
  applyTreeTransform()
  renderTreeNodes()
  renderTreeEdges()
  treeEls.addChild.disabled = !treeSelectedId
}

function renderTreeNodes() {
  const layer = treeEls.layer
  layer.innerHTML = ''

  treeNodes.forEach((node) => {
    const shape = TREE_SHAPES[node.shape] || TREE_SHAPES.rect
    const color = treeColor(node)
    const isRoot = node.kind === 'root'
    const isSel = node.id === treeSelectedId
    const w = treeW(node)
    const h = treeH(node)

    const wrap = treeEl('div', 'group absolute select-none')
    wrap.dataset.nodeId = node.id
    wrap.style.left = (node.x - w / 2) + 'px'
    wrap.style.top = (node.y - h / 2) + 'px'
    wrap.style.width = w + 'px'

    const card = treeEl('div', 'relative px-3 py-2 text-center border shadow-sm transition-shadow ' + shape.cls + ' ' + color.cls)
    card.style.minHeight = h + 'px'
    card.style.display = 'flex'
    card.style.flexDirection = 'column'
    card.style.justifyContent = 'center'
    if (shape.style) card.style.cssText += ';' + shape.style
    if (w < 200) { card.style.paddingLeft = '10px'; card.style.paddingRight = '10px' }
    if (isSel) card.classList.add('ring-2', 'ring-blue-400', 'ring-offset-2', 'ring-offset-zinc-100', 'dark:ring-offset-zinc-950')

    const titleSize = Math.max(12, Math.min(19, Math.round(w / 15)))
    const badge = treeEl('span', 'text-[10px] uppercase tracking-wide opacity-70', isRoot ? '主根' : '分支')
    const title = treeEl('p', 'font-medium leading-snug mt-0.5', node.title || '未命名')
    title.style.fontSize = titleSize + 'px'
    title.style.overflow = 'hidden'
    title.style.display = '-webkit-box'
    title.style.webkitLineClamp = '3'
    title.style.webkitBoxOrient = 'vertical'

    card.appendChild(badge)
    card.appendChild(title)
    wrap.appendChild(card)

    // 下边加分支
    const addBtn = treeEl('button', 'absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 text-zinc-500 dark:text-zinc-300 text-sm leading-none shadow-sm opacity-0 group-hover:opacity-100 hover:bg-blue-500 hover:text-white hover:border-blue-500 transition-all')
    addBtn.type = 'button'
    addBtn.textContent = '+'
    addBtn.title = '在下面加一个分支'
    addBtn.addEventListener('pointerdown', (e) => e.stopPropagation())
    addBtn.addEventListener('click', (e) => { e.stopPropagation(); createTreeNode({ kind: 'node', parent: node }) })
    wrap.appendChild(addBtn)

    // 右边连线手柄
    const handle = treeEl('button', 'absolute -right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white dark:bg-zinc-800 border-2 border-blue-500 text-blue-500 text-[11px] font-bold leading-none shadow-sm transition-opacity ' +
      (isRoot ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'))
    handle.type = 'button'
    handle.setAttribute('data-link-handle', '1')
    handle.textContent = '+'
    handle.title = '按住拖到另一个节点即可连线'
    handle.addEventListener('pointerdown', (e) => onLinkHandleDown(e, node))
    wrap.appendChild(handle)

    wrap.addEventListener('pointerdown', (e) => onNodePointerDown(e, node))
    layer.appendChild(wrap)
  })
}

let treeLinkViews = {}

function treeLinkBase(link) {
  const a = treeNodeById(link.from_node)
  const b = treeNodeById(link.to_node)
  if (!a || !b) return null
  return { a, b, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }
}

// 二次贝塞尔：让曲线严格穿过拖动后的手柄位置
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

// 父子连线：按相对位置自动选接边（上下或左右），并支持弯曲
function treeEdgeBase(parent, child) {
  const pw = treeW(parent), ph = treeH(parent), cw = treeW(child), ch = treeH(child)
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
    const { error } = await supabase.from('tree_nodes').update({
      link_bend_x: child.link_bend_x || 0,
      link_bend_y: child.link_bend_y || 0,
    }).eq('id', child.id)
    if (error) treeEls.hint.textContent = '保存连线形状失败：' + error.message
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
    const { error } = await supabase.from('tree_links').update({
      bend_x: link.bend_x,
      bend_y: link.bend_y,
    }).eq('id', link.id)
    if (error) treeEls.hint.textContent = '保存连线形状失败：' + error.message
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

  // 父子连线：按节点相对位置自动选择接边，可拖弯
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

    hit.addEventListener('pointerenter', () => {
      path.setAttribute('stroke-width', '3')
      knob.style.opacity = '1'
    })
    hit.addEventListener('pointerleave', () => {
      path.setAttribute('stroke-width', '2')
      knob.style.opacity = '0.55'
    })
    knob.addEventListener('pointerenter', () => { knob.style.opacity = '1' })
    hit.addEventListener('pointerdown', (e) => onTreeEdgeKnobDown(e, parent, node))
    knob.addEventListener('pointerdown', (e) => onTreeEdgeKnobDown(e, parent, node))
    knob.addEventListener('dblclick', async (e) => {
      e.stopPropagation()
      node.link_bend_x = 0
      node.link_bend_y = 0
      renderTreeEdges()
      await supabase.from('tree_nodes').update({ link_bend_x: 0, link_bend_y: 0 }).eq('id', node.id)
      treeEls.hint.textContent = '连线已拉直（双击圆点可复位）'
    })

    g.appendChild(hit)
    g.appendChild(path)
    g.appendChild(knob)
  })

  // 跨树连线：可拖弯的曲线
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
    knob.addEventListener('dblclick', async (e) => {
      e.stopPropagation()
      link.bend_x = 0
      link.bend_y = 0
      updateTreeLinkVisual(link)
      await supabase.from('tree_links').update({ bend_x: 0, bend_y: 0 }).eq('id', link.id)
      treeEls.hint.textContent = '连线已拉直（双击可复位）'
    })

    g.appendChild(hit)
    g.appendChild(path)
    g.appendChild(knob)
    treeLinkViews[link.id] = { hit, path, knob }
  })
}

// ── 拖动 / 平移 / 缩放 ─────────────────────────────────────────────────
function onNodePointerDown(e, node) {
  if (e.button !== 0) return
  if (e.target.closest && e.target.closest('[data-link-handle]')) return
  e.stopPropagation()
  closeTreeMenu()

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
    const el = treeEls.layer.querySelector('[data-node-id="' + node.id + '"]')
    if (el) {
      el.style.left = (node.x - treeW(node) / 2) + 'px'
      el.style.top = (node.y - treeH(node) / 2) + 'px'
    }
    renderTreeEdges()
    updateTreePopoverPosition()
  }

  const onUp = async () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    if (moved) {
      const { error } = await supabase.from('tree_nodes').update({ x: node.x, y: node.y }).eq('id', node.id)
      if (error) console.error('[tree] 保存位置失败', error.message)
    } else {
      selectTreeNode(node.id)
    }
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

function onStagePointerDown(e) {
  if (e.button !== 0) return
  if (e.target !== treeEls.stage && e.target !== treeEls.svg && e.target !== treeEls.layer) return
  closeTreeMenu()

  const startX = e.clientX
  const startY = e.clientY
  const px = treePan.x
  const py = treePan.y
  let moved = false
  treeEls.stage.style.cursor = 'grabbing'

  const onMove = (ev) => {
    const dx = ev.clientX - startX
    const dy = ev.clientY - startY
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true
    treePan.x = px + dx
    treePan.y = py + dy
    applyTreeTransform()
  }
  const onUp = () => {
    treeEls.stage.style.cursor = 'grab'
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    if (!moved) deselectTreeNode()
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

function onStageWheel(e) {
  e.preventDefault()
  const delta = e.deltaY > 0 ? -0.08 : 0.08
  setTreeZoom(treeZoom + delta)
}

function setTreeZoom(z) {
  treeZoom = Math.min(1.8, Math.max(0.4, Math.round(z * 100) / 100))
  applyTreeTransform()
}

function fitTreeView() {
  if (!treeEls) return
  if (treeNodes.length === 0) { treePan = { x: 200, y: 160 }; treeZoom = 1; applyTreeTransform(); return }

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  treeNodes.forEach((n) => {
    minX = Math.min(minX, n.x - treeW(n) / 2)
    maxX = Math.max(maxX, n.x + treeW(n) / 2)
    minY = Math.min(minY, n.y - treeH(n) / 2)
    maxY = Math.max(maxY, n.y + treeH(n) / 2)
  })

  const w = Math.max(1, maxX - minX)
  const h = Math.max(1, maxY - minY)
  const rect = treeEls.stage.getBoundingClientRect()
  const pad = 70
  const z = Math.min(1.2, Math.max(0.4, Math.min((rect.width - pad * 2) / w, (rect.height - pad * 2) / h)))
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

  const mk = (label, fn, icon) => {
    const b = treeEl('button', 'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-[0.99] transition-all text-left')
    b.type = 'button'
    if (icon) {
      const s = treeEl('span', 'w-4 h-4 shrink-0 text-zinc-400')
      s.innerHTML = icon
      b.appendChild(s)
    }
    b.appendChild(treeEl('span', '', label))
    b.addEventListener('click', fn)
    menu.appendChild(b)
  }

  mk('在这里新建主根', () => createRootAt(lx, ly),
    '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/></svg>')

  if (treeSelectedId) {
    const sel = treeNodeById(treeSelectedId)
    mk(`在「${(sel && sel.title) || '选中节点'}」下加分支`, () => {
      closeTreeMenu()
      if (sel) createTreeNode({ kind: 'node', parent: sel })
    }, '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>')
  }

  menu.appendChild(treeEl('div', 'my-1 h-px bg-zinc-100 dark:bg-zinc-800'))

  mk('视图居中', () => { closeTreeMenu(); fitTreeView() },
    '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="4"/></svg>')

  const left = Math.min(Math.max(8, clientX - rect.left), rect.width - 230)
  const top = Math.min(Math.max(8, clientY - rect.top), rect.height - 170)
  menu.style.left = left + 'px'
  menu.style.top = top + 'px'
  menu.classList.remove('hidden')
}

function closeTreeMenu() {
  if (treeEls) treeEls.menu.classList.add('hidden')
}

// ── 连线（拖手柄） ─────────────────────────────────────────────────────
function onLinkHandleDown(e, node) {
  e.stopPropagation()
  e.preventDefault()
  closeTreeMenu()
  const rect = treeEls.stage.getBoundingClientRect()
  const ns = 'http://www.w3.org/2000/svg'
  const line = document.createElementNS(ns, 'line')
  line.setAttribute('stroke', '#3b82f6')
  line.setAttribute('stroke-width', '2')
  line.setAttribute('stroke-dasharray', '6 6')
  const sx = node.x + treeW(node) / 2
  const sy = node.y
  line.setAttribute('x1', sx)
  line.setAttribute('y1', sy)
  line.setAttribute('x2', sx)
  line.setAttribute('y2', sy)
  treeEls.tempGroup.appendChild(line)

  const onMove = (ev) => {
    const lx = (ev.clientX - rect.left - treePan.x) / treeZoom
    const ly = (ev.clientY - rect.top - treePan.y) / treeZoom
    line.setAttribute('x2', lx)
    line.setAttribute('y2', ly)
  }
  const onUp = async (ev) => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    line.remove()
    const el = document.elementFromPoint(ev.clientX, ev.clientY)
    const wrap = el && el.closest ? el.closest('[data-node-id]') : null
    const targetId = wrap ? wrap.dataset.nodeId : null
    if (!targetId || targetId === node.id) {
      treeEls.hint.textContent = '连线取消：请拖到另一个节点上'
      return
    }
    await createTreeLink(node.id, targetId)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

async function createTreeLink(fromId, toId) {
  const exists = treeLinks.some((l) =>
    (l.from_node === fromId && l.to_node === toId) ||
    (l.from_node === toId && l.to_node === fromId))
  if (exists) { treeEls.hint.textContent = '这两个节点已经连过了'; return }

  const { data, error } = await supabase.from('tree_links').insert({
    project_id: treeProjectId,
    from_node: fromId,
    to_node: toId,
  }).select().single()

  if (error) { treeEls.hint.textContent = '连线失败：' + error.message; return }
  treeLinks.push(Object.assign({ bend_x: 0, bend_y: 0 }, data))
  renderTreeEdges()
  treeEls.hint.textContent = '连线成功'
}

// ── 节点信息浮窗 ───────────────────────────────────────────────────────
function deselectTreeNode() {
  treeSelectedId = null
  treePopoverNodeId = null
  renderTreeNodes()
  treeEls.popover.classList.add('hidden')
}

function updateTreePopoverPosition() {
  if (!treeEls) return
  const pop = treeEls.popover
  if (pop.classList.contains('hidden') || !treePopoverNodeId) return
  const node = treeNodeById(treePopoverNodeId)
  if (!node) return

  const rect = treeEls.stage.getBoundingClientRect()
  const w = treeW(node)
  const rightX = treePan.x + (node.x + w / 2) * treeZoom + 14
  const leftX = treePan.x + (node.x - w / 2) * treeZoom - pop.offsetWidth - 14
  let left = rightX
  if (left + pop.offsetWidth > rect.width - 8) left = Math.max(8, leftX)
  let top = treePan.y + (node.y - treeH(node) / 2) * treeZoom
  top = Math.max(8, Math.min(top, rect.height - Math.min(pop.offsetHeight, 240) - 8))

  pop.style.left = left + 'px'
  pop.style.top = top + 'px'
}

async function selectTreeNode(id) {
  treeSelectedId = id
  renderTreeNodes()
  treeEls.addChild.disabled = !id
  treePopoverCollapsed = false
  await openTreePopover(id)
}

async function openTreePopover(nodeId) {
  const node = treeNodeById(nodeId)
  if (!node) return
  treePopoverNodeId = nodeId

  const { data: notes } = await supabase.from('node_notes').select('*').eq('node_id', nodeId).order('created_at', { ascending: true })
  const { data: nfiles } = await supabase.from('node_files').select('*').eq('node_id', nodeId).order('created_at', { ascending: false })
  treeNotes = notes || []
  treeNodeFiles = nfiles || []
  await loadTreeProfiles()

  if (treePopoverNodeId !== nodeId) return
  renderTreePopover(node)
}

function renderTreePopover(node) {
  const pop = treeEls.popover
  pop.innerHTML = ''
  pop.classList.remove('hidden')

  if (treePopoverCollapsed) {
    pop.className = 'absolute z-30'
    const btn = treeEl('button', 'w-9 h-9 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-md text-zinc-500 dark:text-zinc-300 hover:text-blue-500 active:scale-95 transition-all', '⋯')
    btn.type = 'button'
    btn.title = '展开节点信息'
    btn.addEventListener('click', () => { treePopoverCollapsed = false; renderTreePopover(node); updateTreePopoverPosition() })
    pop.appendChild(btn)
    updateTreePopoverPosition()
    return
  }

  pop.className = 'absolute z-30 w-[320px] max-h-[calc(100%-16px)] overflow-y-auto rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl'

  // 头部
  const head = treeEl('div', 'flex items-center gap-2 px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 sticky top-0 bg-white dark:bg-zinc-900 z-10')
  const badge = treeEl('span', 'px-2 py-0.5 rounded-lg text-[11px] font-medium ' +
    (node.kind === 'root' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'),
    node.kind === 'root' ? '主根' : '分支')

  const collapseBtn = treeEl('button', 'ml-auto p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition-all')
  collapseBtn.type = 'button'
  collapseBtn.title = '收起'
  collapseBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>'
  collapseBtn.addEventListener('click', () => { treePopoverCollapsed = true; renderTreePopover(node); updateTreePopoverPosition() })

  const delBtn = treeEl('button', 'p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-95 transition-all')
  delBtn.type = 'button'
  delBtn.title = '删除节点'
  delBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M6 6l1 14a2 2 0 002 2h6a2 2 0 002-2l1-14"/></svg>'
  delBtn.addEventListener('click', () => deleteTreeNode(node))

  head.appendChild(badge)
  head.appendChild(collapseBtn)
  head.appendChild(delBtn)
  pop.appendChild(head)

  // 标题
  const body = treeEl('div', 'p-3 space-y-3')
  const titleInput = document.createElement('input')
  titleInput.type = 'text'
  titleInput.value = node.title || ''
  titleInput.maxLength = 40
  titleInput.placeholder = '节点大标题'
  titleInput.className = 'w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
  titleInput.addEventListener('change', async () => {
    const v = titleInput.value.trim() || '未命名节点'
    const { error } = await supabase.from('tree_nodes').update({ title: v }).eq('id', node.id)
    if (error) { treeEls.hint.textContent = '保存标题失败：' + error.message; return }
    node.title = v
    renderTreeNodes()
  })
  body.appendChild(titleInput)

  // 主根形状
  if (node.kind === 'root') {
    const shapeRow = treeEl('div', '')
    shapeRow.appendChild(treeEl('p', 'text-[11px] text-zinc-500 dark:text-zinc-400 mb-1', '形状'))
    const wrap = treeEl('div', 'flex flex-wrap gap-1.5')
    Object.keys(TREE_SHAPES).forEach((key) => {
      const s = TREE_SHAPES[key]
      const b = treeEl('button', 'px-2 py-0.5 rounded-lg text-[11px] border transition-all active:scale-95 ' +
        (node.shape === key
          ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white'
          : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'),
        s.label)
      b.type = 'button'
      b.addEventListener('click', async () => {
        const { error } = await supabase.from('tree_nodes').update({ shape: key }).eq('id', node.id)
        if (error) { treeEls.hint.textContent = '保存形状失败：' + error.message; return }
        node.shape = key
        renderTreeNodes()
        renderTreePopover(node)
      })
      wrap.appendChild(b)
    })
    shapeRow.appendChild(wrap)
    body.appendChild(shapeRow)
  }

  // 颜色
  const colorRow = treeEl('div', '')
  colorRow.appendChild(treeEl('p', 'text-[11px] text-zinc-500 dark:text-zinc-400 mb-1', '颜色'))
  const swatches = treeEl('div', 'flex flex-wrap gap-1.5')
  Object.keys(TREE_COLORS).forEach((key) => {
    const c = TREE_COLORS[key]
    const b = treeEl('button', 'w-6 h-6 rounded-full border transition-all active:scale-95 ' + c.swatch +
      (node.color === key ? ' ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-zinc-900' : ' border-transparent'))
    b.type = 'button'
    b.title = c.label
    b.addEventListener('click', async () => {
      const { error } = await supabase.from('tree_nodes').update({ color: key }).eq('id', node.id)
      if (error) { treeEls.hint.textContent = '保存颜色失败：' + error.message; return }
      node.color = key
      renderTreeNodes()
      renderTreePopover(node)
    })
    swatches.appendChild(b)
  })
  colorRow.appendChild(swatches)
  body.appendChild(colorRow)

  // 尺寸
  const sizeRow = treeEl('div', 'space-y-2')
  const mkRange = (label, value, min, max, onInput, onChange) => {
    const wrap = treeEl('div', '')
    const top = treeEl('div', 'flex items-center justify-between mb-0.5')
    top.appendChild(treeEl('span', 'text-[11px] text-zinc-500 dark:text-zinc-400', label))
    const val = treeEl('span', 'text-[11px] text-zinc-500 dark:text-zinc-400', value + 'px')
    top.appendChild(val)
    const input = document.createElement('input')
    input.type = 'range'
    input.min = String(min)
    input.max = String(max)
    input.step = '2'
    input.value = String(value)
    input.className = 'w-full h-1.5 accent-blue-500'
    input.addEventListener('input', () => {
      val.textContent = input.value + 'px'
      onInput(Number(input.value))
    })
    input.addEventListener('change', () => onChange(Number(input.value)))
    wrap.appendChild(top)
    wrap.appendChild(input)
    return wrap
  }

  sizeRow.appendChild(mkRange('宽度', treeW(node), 140, 360,
    (v) => {
      node.width = v
      renderTreeNodes(); renderTreeEdges(); updateTreePopoverPosition()
    },
    async (v) => {
      const { error } = await supabase.from('tree_nodes').update({ width: v }).eq('id', node.id)
      if (error) treeEls.hint.textContent = '保存宽度失败：' + error.message
    }))

  sizeRow.appendChild(mkRange('高度', treeH(node), 56, 180,
    (v) => {
      node.height = v
      renderTreeNodes(); renderTreeEdges(); updateTreePopoverPosition()
    },
    async (v) => {
      const { error } = await supabase.from('tree_nodes').update({ height: v }).eq('id', node.id)
      if (error) treeEls.hint.textContent = '保存高度失败：' + error.message
    }))
  body.appendChild(sizeRow)

  // 想法
  const noteSection = treeEl('div', 'pt-1 border-t border-zinc-100 dark:border-zinc-800')
  noteSection.appendChild(treeEl('p', 'text-xs font-medium text-zinc-900 dark:text-zinc-100 mt-2 mb-1.5', `大家的想法 · ${treeNotes.length}`))

  const ta = document.createElement('textarea')
  ta.rows = 2
  ta.placeholder = '写下你的想法…'
  ta.className = 'w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none'
  noteSection.appendChild(ta)

  const noteBtn = treeEl('button', 'mt-1.5 w-full px-3 py-1.5 rounded-xl text-sm font-medium bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 active:scale-95 transition-all', '添加想法')
  noteBtn.type = 'button'
  noteBtn.addEventListener('click', async () => {
    const content = ta.value.trim()
    if (!content) return
    noteBtn.disabled = true
    const { error } = await supabase.from('node_notes').insert({
      node_id: node.id,
      author_id: currentUser ? currentUser.id : null,
      content,
    })
    noteBtn.disabled = false
    if (error) { treeEls.hint.textContent = '添加失败：' + error.message; return }
    ta.value = ''
    await openTreePopover(node.id)
  })
  noteSection.appendChild(noteBtn)

  if (treeNotes.length > 0) {
    const list = treeEl('div', 'mt-2 space-y-2')
    treeNotes.forEach((n) => {
      const item = treeEl('div', 'rounded-xl bg-zinc-50 dark:bg-zinc-800/60 px-3 py-2')
      const meta = treeEl('div', 'text-[11px] text-zinc-500 dark:text-zinc-400 mb-0.5',
        `${treeAuthorName(n.author_id)} · ${fmtRel(new Date(n.created_at).getTime())}`)
      const text = treeEl('p', 'text-sm text-zinc-800 dark:text-zinc-100 whitespace-pre-wrap break-words', n.content)
      item.appendChild(meta)
      item.appendChild(text)
      list.appendChild(item)
    })
    noteSection.appendChild(list)
  }
  body.appendChild(noteSection)

  // 文件
  const fileSection = treeEl('div', 'pt-1 border-t border-zinc-100 dark:border-zinc-800')
  const fileHead = treeEl('div', 'flex items-center justify-between gap-2 mt-2 mb-1.5')
  fileHead.appendChild(treeEl('p', 'text-xs font-medium text-zinc-900 dark:text-zinc-100', `文件 · ${treeNodeFiles.length}`))

  const upBtn = treeEl('button', 'inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95 transition-all')
  upBtn.type = 'button'
  upBtn.textContent = '上传'
  const fileInput = document.createElement('input')
  fileInput.type = 'file'
  fileInput.className = 'hidden'
  upBtn.addEventListener('click', () => fileInput.click())
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files && fileInput.files[0]
    if (!f) return
    await uploadNodeFile(node, f)
    fileInput.value = ''
  })
  fileHead.appendChild(upBtn)
  fileHead.appendChild(fileInput)
  fileSection.appendChild(fileHead)

  fileSection.appendChild(treeEl('p', 'text-[11px] text-zinc-400 dark:text-zinc-500 mb-1.5',
    node.kind === 'root' ? '根节点文件可直接下载' : '同名文件可共存，按上传人区分'))

  if (treeNodeFiles.length === 0) {
    fileSection.appendChild(treeEl('p', 'text-xs text-zinc-400 dark:text-zinc-500 py-2 text-center', '还没有文件'))
  } else {
    const list = treeEl('div', 'space-y-1.5')
    treeNodeFiles.forEach((f) => {
      const item = treeEl('div', 'rounded-xl border border-zinc-100 dark:border-zinc-800 px-2.5 py-1.5')
      const top = treeEl('div', 'flex items-start gap-2')
      const info = treeEl('div', 'min-w-0 flex-1')
      info.appendChild(treeEl('p', 'text-sm text-zinc-900 dark:text-zinc-100 truncate', f.name))
      info.appendChild(treeEl('p', 'text-[11px] text-zinc-500 dark:text-zinc-400 truncate',
        `${fmtBytes(f.size || 0)} · ${treeAuthorName(f.author_id)}${f.status === 'approved' ? ' · 已通过' : ''}`))
      top.appendChild(info)
      if (f.status === 'approved') top.appendChild(treeEl('span', 'px-1.5 py-0.5 rounded-md text-[10px] bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-300 shrink-0', '已入库'))
      item.appendChild(top)

      const actions = treeEl('div', 'flex items-center gap-1 mt-1')
      const dl = document.createElement('a')
      dl.href = f.url
      dl.setAttribute('download', f.name)
      dl.className = 'px-1.5 py-0.5 rounded-lg text-[11px] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors'
      dl.textContent = '下载'
      const approve = treeEl('button', 'px-1.5 py-0.5 rounded-lg text-[11px] text-blue-600 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors',
        f.status === 'approved' ? '重新入库' : '通过并入库')
      approve.type = 'button'
      approve.addEventListener('click', () => approveNodeFile(f))
      const del = treeEl('button', 'ml-auto p-1 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors', '×')
      del.type = 'button'
      del.title = '删除文件'
      del.addEventListener('click', () => deleteNodeFile(f))

      actions.appendChild(dl)
      actions.appendChild(approve)
      actions.appendChild(del)
      item.appendChild(actions)
      list.appendChild(item)
    })
    fileSection.appendChild(list)
  }
  body.appendChild(fileSection)

  pop.appendChild(body)
  updateTreePopoverPosition()
  setTimeout(updateTreePopoverPosition, 0)
}

// ── 节点操作 ───────────────────────────────────────────────────────────
async function uploadNodeFile(node, file) {
  const safe = file.name.replace(/[^\w.\-\u4e00-\u9fa5]/g, '_')
  const path = `nodes/${node.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`
  const { data: ud, error: ue } = await supabase.storage.from('uploads').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'application/octet-stream',
  })
  if (ue) { treeEls.hint.textContent = '上传失败：' + ue.message; return }
  const { data: pub } = supabase.storage.from('uploads').getPublicUrl(ud.path)
  const { error } = await supabase.from('node_files').insert({
    node_id: node.id,
    author_id: currentUser ? currentUser.id : null,
    name: file.name,
    path: ud.path,
    url: pub.publicUrl,
    size: file.size,
    type: file.type || null,
    status: 'pending',
  })
  if (error) { treeEls.hint.textContent = '保存失败：' + error.message; return }
  treeEls.hint.textContent = '已上传：' + file.name
  await openTreePopover(node.id)
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
  await openTreePopover(f.node_id)
}

async function deleteNodeFile(f) {
  const ok = await confirmDialog({ title: '删除文件', message: `确定删除「${f.name}」吗？`, okText: '删除' })
  if (!ok) return
  await supabase.storage.from('uploads').remove([f.path])
  await supabase.from('node_files').delete().eq('id', f.id)
  if (treePopoverNodeId) await openTreePopover(treePopoverNodeId)
}

async function deleteTreeNode(node) {
  const ok = await confirmDialog({
    title: '删除节点',
    message: `确定删除「${node.title}」吗？它下面的分支、想法和文件都会一起删除。`,
    okText: '删除',
  })
  if (!ok) return
  const { error } = await supabase.from('tree_nodes').delete().eq('id', node.id)
  if (error) { treeEls.hint.textContent = '删除失败：' + error.message; return }
  treeNodes = treeNodes.filter((n) => n.id !== node.id && n.parent_id !== node.id)
  treeLinks = treeLinks.filter((l) => l.from_node !== node.id && l.to_node !== node.id)
  treeSelectedId = null
  treePopoverNodeId = null
  treeEls.popover.classList.add('hidden')
  renderTree()
}
