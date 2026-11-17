/* ─────────────────────────────────────────────────────────────
 * 55-project-files.js · 项目文件（类 GitHub 仓库）
 * 该文件由原 index.html 内联脚本按顺序拆分而来，文件编号即执行顺序。
 * ───────────────────────────────────────────────────────────── */
'use strict'

// 文件通过 files.project_id 归属到项目。同一张 files 表同时服务两个视图：
//   · 「文件」页  → 全局文件库，显示所有文件
//   · 项目详情页 → 项目仓库，只显示 project_id 等于当前项目的文件
// project_id 为 null 的文件只出现在全局文件库里。

const CODE_EXTENSIONS = [
  'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'h', 'hpp', 'cpp', 'cc',
  'cs', 'go', 'rs', 'php', 'rb', 'sh', 'bash', 'zsh', 'html', 'htm', 'css', 'scss',
  'less', 'json', 'xml', 'yml', 'yaml', 'toml', 'ini', 'conf', 'sql', 'md', 'markdown', 'txt',
]

function fileExtension(name) {
  const m = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/)
  return m ? m[1] : ''
}

function projectFilesOf(projectId) {
  return (files || []).filter((f) => f && f.project_id === projectId)
}

function projectFileIcon(file) {
  const ext = fileExtension(file.name)
  if (CODE_EXTENSIONS.includes(ext)) {
    return {
      bg: 'bg-purple-50 dark:bg-purple-900/20',
      fg: 'text-purple-500',
      inner: '<path d="M8 9l-3 3 3 3M16 9l3 3-3 3M13 4l-2 16" />',
    }
  }
  if ((file.category || '') === '图片') {
    return {
      bg: 'bg-orange-50 dark:bg-orange-900/20',
      fg: 'text-orange-500',
      inner: '<rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />',
    }
  }
  if ((file.category || '') === '压缩包') {
    return {
      bg: 'bg-red-50 dark:bg-red-900/20',
      fg: 'text-red-500',
      inner: '<path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" />',
    }
  }
  return {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    fg: 'text-blue-500',
    inner: '<path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" /><path d="M13 2v7h7" />',
  }
}

function openProjectUpload(proj) {
  if (!currentUser) { openUserModal(); return }
  openFileModal(proj.id, proj.name)
}

async function deleteProjectFile(file) {
  const ok = await confirmDialog({
    title: '删除项目文件',
    message: `确定要删除「${file.name}」吗？该文件会从项目仓库和文件库中同时移除。`,
    okText: '删除',
  })
  if (!ok) return
  const { error: se } = await supabase.storage.from('uploads').remove([file.path])
  if (se) console.error('[project-file] storage remove failed', se.message)
  const { error: de } = await supabase.from('files').delete().eq('id', file.id)
  if (de) {
    console.error('[project-file] db delete failed', de.message)
    return
  }
  files = files.filter((f) => f.id !== file.id)
  renderProjects()
  renderFiles()
  updateFileStats()
}

function renderProjectFilesSection(container, proj) {
  const list = projectFilesOf(proj.id)

  const section = document.createElement('div')
  section.className = 'pt-6 mt-6 border-t border-zinc-100 dark:border-zinc-800'

  const header = document.createElement('div')
  header.className = 'flex items-center justify-between gap-3 mb-3'

  const titleWrap = document.createElement('div')
  titleWrap.className = 'flex items-center gap-2 min-w-0'
  titleWrap.innerHTML =
    '<h3 class="font-semibold text-zinc-900 dark:text-zinc-100 text-sm md:text-base">项目文件</h3>' +
    `<span class="px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs">${list.length}</span>`

  const uploadBtn = document.createElement('button')
  uploadBtn.type = 'button'
  uploadBtn.className = 'shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl font-medium text-xs md:text-sm bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 active:scale-95 transition-all duration-200'
  uploadBtn.innerHTML =
    '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">' +
    '<path d="M12 5v14M5 12h14" /></svg>上传文件'
  uploadBtn.addEventListener('click', () => openProjectUpload(proj))

  header.appendChild(titleWrap)
  header.appendChild(uploadBtn)
  section.appendChild(header)

  if (list.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700 p-6 text-center'
    empty.innerHTML =
      '<p class="text-sm text-zinc-500 dark:text-zinc-400 mb-1">这个项目还没有文件</p>' +
      '<p class="text-xs text-zinc-400 dark:text-zinc-500">代码、文档、图片、压缩包都可以上传，点右上角「上传文件」</p>'
    section.appendChild(empty)
    container.appendChild(section)
    return
  }

  const box = document.createElement('div')
  box.className = 'rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 md:px-4'
  const ul = document.createElement('ul')
  ul.className = 'divide-y divide-zinc-100 dark:divide-zinc-800'

  list
    .slice()
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
    .forEach((file) => {
      const icon = projectFileIcon(file)
      const li = document.createElement('li')
      li.className = 'flex items-center gap-3 py-2.5'

      const iconWrap = document.createElement('div')
      iconWrap.className = `p-2 rounded-lg shrink-0 ${icon.bg}`
      iconWrap.innerHTML =
        `<svg class="w-4 h-4 ${icon.fg}" fill="none" stroke="currentColor" stroke-width="2" ` +
        `viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">${icon.inner}</svg>`

      const main = document.createElement('div')
      main.className = 'min-w-0 flex-1'

      const nameBtn = document.createElement('button')
      nameBtn.type = 'button'
      nameBtn.className = 'block max-w-full text-sm text-zinc-900 dark:text-zinc-100 truncate text-left hover:text-blue-500 transition-colors duration-200'
      nameBtn.textContent = file.name
      nameBtn.title = '点击打开'
      nameBtn.addEventListener('click', () => openPreview(file))

      const meta = document.createElement('p')
      meta.className = 'text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5'
      const bits = [fmtBytes(file.size || 0)]
      if (file.created_at) bits.push(fmtRel(new Date(file.created_at).getTime()))
      if (currentUser && file.uploaded_by === currentUser.id) bits.push('我上传的')
      meta.textContent = bits.join(' · ')

      main.appendChild(nameBtn)
      main.appendChild(meta)

      const actions = document.createElement('div')
      actions.className = 'flex items-center gap-1 shrink-0'

      const openBtn = document.createElement('button')
      openBtn.type = 'button'
      openBtn.setAttribute('aria-label', '打开')
      openBtn.className = 'p-2 rounded-xl text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-blue-500 active:scale-95 transition-all duration-200'
      openBtn.innerHTML =
        '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">' +
        '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>'
      openBtn.addEventListener('click', () => openPreview(file))

      const dlBtn = document.createElement('a')
      dlBtn.href = file.url
      dlBtn.setAttribute('download', file.name)
      dlBtn.setAttribute('aria-label', '下载')
      dlBtn.className = 'p-2 rounded-xl text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-blue-500 active:scale-95 transition-all duration-200'
      dlBtn.innerHTML =
        '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">' +
        '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><path d="M7 10l5 5 5-5M12 15V3" /></svg>'

      const delBtn = document.createElement('button')
      delBtn.type = 'button'
      delBtn.setAttribute('aria-label', '删除')
      delBtn.className = 'p-2 rounded-xl text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-red-500 active:scale-95 transition-all duration-200'
      delBtn.innerHTML =
        '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">' +
        '<path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M6 6l1 14a2 2 0 002 2h6a2 2 0 002-2l1-14" /></svg>'
      delBtn.addEventListener('click', () => deleteProjectFile(file))

      actions.appendChild(openBtn)
      actions.appendChild(dlBtn)
      actions.appendChild(delBtn)

      li.appendChild(iconWrap)
      li.appendChild(main)
      li.appendChild(actions)
      ul.appendChild(li)
    })

  box.appendChild(ul)
  section.appendChild(box)
  container.appendChild(section)
}
