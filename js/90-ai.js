/* ─────────────────────────────────────────────────────────────
 * 90-ai.js · AI 助手「大肥鱼」
 * 该文件由原 index.html 内联脚本按顺序拆分而来，文件编号即执行顺序。
 * ───────────────────────────────────────────────────────────── */
'use strict'

const aiFileBtn = document.getElementById('ai-file-btn')
const aiFileInput = document.getElementById('ai-file-input')
const aiAttachmentPreview = document.getElementById('ai-attachment-preview')
const aiModelLabel = document.getElementById('ai-model-label')

const AI_MODEL_DISPLAY = {
  'deepseek-chat': 'DeepSeek Chat',
  'deepseek-flash': 'DeepSeek Flash',
  'deepseek-reasoner': 'DeepSeek R1',
}
function updateAiModelLabel(model) {
  if (!model || !aiModelLabel) return
  const display = AI_MODEL_DISPLAY[model] || model
  aiModelLabel.textContent = `${display} · DeepSeek 驱动`
}

function typewriterReveal(bubble, fullText, onDone) {
  if (aiTypewriterTimer) { clearInterval(aiTypewriterTimer); aiTypewriterTimer = null }
  bubble.innerHTML = ''
  const wrap = document.createElement('div')
  wrap.className = 'whitespace-pre-wrap break-words'
  bubble.appendChild(wrap)
  const len = fullText.length
  let i = 0
  let chunk = 1
  let interval = 22
  if (len > 1500) { chunk = 6; interval = 12 }
  else if (len > 800) { chunk = 4; interval = 14 }
  else if (len > 300) { chunk = 2; interval = 18 }
  aiTypewriterTimer = setInterval(() => {
    i += chunk
    if (i >= len) {
      i = len
      wrap.textContent = fullText
      clearInterval(aiTypewriterTimer)
      aiTypewriterTimer = null
      if (typeof onDone === 'function') onDone()
      return
    }
    wrap.textContent = fullText.slice(0, i)
    aiMessages.scrollTop = aiMessages.scrollHeight
  }, interval)
}

function closeCodeDownloadMenu() {
  const existing = document.getElementById('code-download-menu')
  if (existing) existing.remove()
}

function langToExt(lang) {
  const map = {
    js: 'js', javascript: 'js', ts: 'ts', typescript: 'ts',
    jsx: 'jsx', tsx: 'tsx', py: 'py', python: 'py',
    java: 'java', c: 'c', cpp: 'cpp', 'c++': 'cpp',
    go: 'go', rs: 'rs', rust: 'rs', php: 'php', rb: 'rb', ruby: 'rb',
    sh: 'sh', bash: 'sh', shell: 'sh', zsh: 'sh',
    html: 'html', css: 'css', scss: 'scss', less: 'less',
    json: 'json', xml: 'xml', yaml: 'yml', yml: 'yml',
    md: 'md', markdown: 'md', sql: 'sql', txt: 'txt', text: 'txt',
  }
  return map[(lang || '').toLowerCase()] || 'txt'
}

function downloadCodeToLocal(lang, code) {
  const ext = langToExt(lang)
  const blob = new Blob([code], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `code-${Date.now()}.${ext}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function saveCodeToFiles(lang, code) {
  if (!currentUser) {
    alert('请先登录再保存到文件栏')
    return
  }
  const ext = langToExt(lang)
  const defaultName = `code-${new Date().toISOString().slice(0, 10)}.${ext}`
  const name = prompt('保存到文件栏，请输入文件名：', defaultName)
  if (!name || !name.trim()) return
  const finalName = name.trim()
  const blob = new Blob([code], { type: 'text/plain' })
  const safeName = finalName.replace(/[^\w.\-\u4e00-\u9fa5]/g, '_')
  const path = `files/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`
  try {
    const { data: ud, error: ue } = await supabase.storage.from('uploads').upload(path, blob, {
      cacheControl: '3600',
      upsert: false,
      contentType: 'text/plain',
    })
    if (ue) throw ue
    const { data: u } = supabase.storage.from('uploads').getPublicUrl(ud.path)
    const { data: row, error: de } = await supabase.from('files').insert({
      name: finalName,
      category: '代码',
      path: ud.path,
      url: u.publicUrl,
      size: blob.size,
      type: 'text/plain',
    }).select().single()
    if (de) throw de
    files.unshift(row)
    renderFiles()
    updateFileStats()
    alert(`已保存到文件栏：${finalName}`)
  } catch (err) {
    alert('保存失败：' + (err.message || err))
  }
}

function openCodeDownloadMenu(anchorEl, lang, code) {
  closeCodeDownloadMenu()
  const rect = anchorEl.getBoundingClientRect()
  const menu = document.createElement('div')
  menu.id = 'code-download-menu'
  menu.className = 'fixed z-[200] w-44 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-xl overflow-hidden'
  const menuW = 176
  const left = Math.max(8, Math.min(rect.right - menuW, window.innerWidth - menuW - 8))
  const top = rect.bottom + 6
  menu.style.left = left + 'px'
  menu.style.top = top + 'px'

  const optLocal = document.createElement('button')
  optLocal.type = 'button'
  optLocal.className = 'w-full text-left px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 active:scale-[0.98] transition-all duration-150'
  optLocal.innerHTML = '<svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><path d="M7 10l5 5 5-5M12 15V3" /></svg><span>下载到本地</span>'
  optLocal.addEventListener('click', (e) => {
    e.stopPropagation()
    downloadCodeToLocal(lang, code)
    closeCodeDownloadMenu()
  })
  menu.appendChild(optLocal)

  const optSave = document.createElement('button')
  optSave.type = 'button'
  optSave.className = 'w-full text-left px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 border-t border-zinc-100 dark:border-zinc-800 active:scale-[0.98] transition-all duration-150'
  optSave.innerHTML = '<svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" /><path d="M17 21v-8H7v8M7 3v5h8" /></svg><span>保存到文件栏</span>'
  optSave.addEventListener('click', async (e) => {
    e.stopPropagation()
    closeCodeDownloadMenu()
    await saveCodeToFiles(lang, code)
  })
  menu.appendChild(optSave)

  document.body.appendChild(menu)

  setTimeout(() => {
    document.addEventListener('click', closeCodeDownloadMenu, { once: true })
    document.addEventListener('scroll', closeCodeDownloadMenu, { once: true, capture: true })
  }, 0)
}

function createCodeBlock(lang, code) {
  const wrap = document.createElement('div')
  wrap.className = 'ai-code-block my-2 rounded-xl overflow-hidden border border-zinc-700/50 bg-zinc-900 max-w-full'

  const header = document.createElement('div')
  header.className = 'flex items-center justify-between gap-2 px-3 py-1.5 bg-zinc-800 text-zinc-300 text-xs'

  const langLabel = document.createElement('span')
  langLabel.className = 'font-mono lowercase tracking-wide'
  langLabel.textContent = (lang || 'text').toLowerCase()
  header.appendChild(langLabel)

  const btns = document.createElement('div')
  btns.className = 'flex items-center gap-0.5'

  const copyBtn = document.createElement('button')
  copyBtn.type = 'button'
  copyBtn.className = 'inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-zinc-700 active:scale-95 transition-all duration-150 text-zinc-300 hover:text-white'
  copyBtn.title = '复制代码'
  copyBtn.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg><span>复制</span>'
  copyBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    const doCopy = () => {
      const textarea = document.createElement('textarea')
      textarea.value = code
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      let ok = false
      try { ok = document.execCommand('copy') } catch (_) { ok = false }
      document.body.removeChild(textarea)
      return ok
    }
    const setDone = () => {
      const original = copyBtn.innerHTML
      copyBtn.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg><span>已复制</span>'
      copyBtn.classList.add('text-green-400')
      setTimeout(() => {
        copyBtn.innerHTML = original
        copyBtn.classList.remove('text-green-400')
      }, 1500)
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(setDone).catch(() => {
        if (doCopy()) setDone()
      })
    } else {
      if (doCopy()) setDone()
    }
  })
  btns.appendChild(copyBtn)

  const dlBtn = document.createElement('button')
  dlBtn.type = 'button'
  dlBtn.className = 'inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-zinc-700 active:scale-95 transition-all duration-150 text-zinc-300 hover:text-white'
  dlBtn.title = '下载 / 保存'
  dlBtn.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><path d="M7 10l5 5 5-5M12 15V3" /></svg><span>下载</span>'
  dlBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    openCodeDownloadMenu(dlBtn, lang, code)
  })
  btns.appendChild(dlBtn)

  header.appendChild(btns)
  wrap.appendChild(header)

  const pre = document.createElement('pre')
  pre.className = 'p-3 text-xs leading-relaxed'
  const codeEl = document.createElement('code')
  codeEl.className = 'language-' + ((lang || 'plaintext').toLowerCase() || 'plaintext')
  codeEl.textContent = code
  pre.appendChild(codeEl)
  wrap.appendChild(pre)

  
          try {
    if (window.hljs && typeof window.hljs.highlightElement === 'function') {
      window.hljs.highlightElement(codeEl)
    }
  } catch (e) {
    console.warn('highlight failed', e)
  }

  return wrap
}

function appendPlainText(parent, text) {
  if (!text) return
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  parts.forEach((part) => {
    if (!part) return
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      const el = document.createElement('strong')
      el.className = 'font-semibold'
      el.textContent = part.slice(2, -2)
      parent.appendChild(el)
    } else if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      const el = document.createElement('em')
      el.textContent = part.slice(1, -1)
      parent.appendChild(el)
    } else {
      const el = document.createElement('div')
      el.className = 'whitespace-pre-wrap break-words'
      el.textContent = part
      parent.appendChild(el)
    }
  })
}

function renderAiMessageContent(bubble, text) {
  bubble.innerHTML = ''
  if (!text) return
  const regex = /(`{3,})[ \t]*([a-zA-Z0-9_+\-#.]*)[^\n]*\n([\s\S]*?)\1/g
  let lastIndex = 0
  let match
  let hasCode = false
  let safety = 0
  while ((match = regex.exec(text)) !== null && safety < 200) {
    safety++
    hasCode = true
    if (match.index > lastIndex) {
      appendPlainText(bubble, text.slice(lastIndex, match.index))
    }
    const lang = match[2] || ''
    let code = match[3] || ''
    code = code.replace(/\n$/, '')
    bubble.appendChild(createCodeBlock(lang, code))
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) {
    appendPlainText(bubble, text.slice(lastIndex))
  }
  if (!hasCode) {
    const simpleIdx = text.indexOf('```')
    if (simpleIdx === -1) {
      bubble.textContent = text
    } else {
      const el = document.createElement('div')
      el.className = 'whitespace-pre-wrap break-words'
      el.textContent = text
      bubble.appendChild(el)
    }
  }
}

function renderAiPendingFile() {
  aiAttachmentPreview.innerHTML = ''
  if (!aiPendingFile) {
    aiAttachmentPreview.classList.add('hidden')
    return
  }
  aiAttachmentPreview.classList.remove('hidden')
  const isImage = (aiPendingFile.type || '').startsWith('image/')
  if (isImage) {
    const thumb = document.createElement('img')
    thumb.src = aiPendingFile.url
    thumb.alt = aiPendingFile.name
    thumb.className = 'w-8 h-8 rounded-lg object-cover shrink-0'
    aiAttachmentPreview.appendChild(thumb)
  } else {
    const icon = document.createElement('div')
    icon.className = 'w-8 h-8 rounded-lg bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center shrink-0'
    icon.innerHTML = '<svg class="w-4 h-4 text-zinc-600 dark:text-zinc-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" /><path d="M13 2v7h7" /></svg>'
    aiAttachmentPreview.appendChild(icon)
  }
  const nameEl = document.createElement('span')
  nameEl.className = 'flex-1 min-w-0 truncate text-zinc-700 dark:text-zinc-300'
  nameEl.textContent = aiPendingFile.name
  aiAttachmentPreview.appendChild(nameEl)
  const del = document.createElement('button')
  del.type = 'button'
  del.setAttribute('aria-label', '移除附件')
  del.className = 'shrink-0 p-1 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-red-500 active:scale-95 transition-all duration-200'
  del.innerHTML = '<svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>'
  del.addEventListener('click', () => { aiPendingFile = null; renderAiPendingFile() })
  aiAttachmentPreview.appendChild(del)
}

function renderAiPendingFile_loading(text) {
  aiAttachmentPreview.innerHTML = ''
  aiAttachmentPreview.classList.remove('hidden')
  const spinner = document.createElement('div')
  spinner.className = 'w-4 h-4 rounded-full border-2 border-zinc-300 dark:border-zinc-600 border-t-blue-500 animate-spin shrink-0'
  aiAttachmentPreview.appendChild(spinner)
  const textEl = document.createElement('span')
  textEl.className = 'text-zinc-600 dark:text-zinc-400'
  textEl.textContent = text || '处理中...'
  aiAttachmentPreview.appendChild(textEl)
}

function compressAiImage(file) {
  return new Promise((resolve) => {
    if (!(file.type || '').startsWith('image/')) { resolve(file); return }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        const maxW = 1200
        let w = img.width
        let h = img.height
        if (w > maxW) { h = Math.round((h * maxW) / w); w = maxW }
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, w, h)
        canvas.toBlob((blob) => {
          if (!blob) { resolve(file); return }
          if (blob.size >= file.size) { resolve(file); return }
          const newName = (file.name || 'image').replace(/\.[^.]+$/, '') + '.jpg'
          resolve(new File([blob], newName, { type: 'image/jpeg' }))
        }, 'image/jpeg', 0.8)
      }
      img.onerror = () => resolve(file)
      img.src = ev.target.result
    }
    reader.onerror = () => resolve(file)
    reader.readAsDataURL(file)
  })
}

async function uploadAiFile(file) {
  if (!currentUser) {
    alert('请先登录再上传文件')
    return
  }
  const MAX = 20 * 1024 * 1024
  if (file.size > MAX) {
    alert('文件不能超过 20 MB')
    return
  }
  aiFileBtn.disabled = true
  const isImg = (file.type || '').startsWith('image/')
  if (isImg) {
    renderAiPendingFile_loading('压缩中...')
    file = await compressAiImage(file)
  }
  renderAiPendingFile_loading('上传中...')
  const safeName = file.name.replace(/[^\w.\-\u4e00-\u9fa5]/g, '_')
  const path = `ai/${currentUser.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`
  const { data, error } = await supabase.storage
    .from('uploads')
    .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || 'application/octet-stream' })
  aiFileBtn.disabled = false
  if (error) {
    alert('上传失败：' + error.message)
    aiPendingFile = null
    renderAiPendingFile()
    return
  }
  const { data: u } = supabase.storage.from('uploads').getPublicUrl(data.path)
  aiPendingFile = { url: u.publicUrl, name: file.name, type: file.type || '', size: file.size }
  renderAiPendingFile()
}

aiFileBtn.addEventListener('click', () => aiFileInput.click())
aiFileInput.addEventListener('change', () => {
  const file = aiFileInput.files?.[0]
  if (!file) return
  uploadAiFile(file)
  aiFileInput.value = ''
})

function openAiPanel() { aiPanel.classList.remove('hidden'); aiPanelOpen = true; setTimeout(() => aiInput.focus(), 50) }
function closeAiPanel() { aiPanel.classList.add('hidden'); aiPanelOpen = false; closeCodeDownloadMenu() }

function appendAiMessage(role, text, imageUrl) {
  const wrap = document.createElement('div')
  wrap.className = 'flex gap-3'
  const avatar = document.createElement('div')
  if (role === 'user') {
    avatar.className = 'shrink-0 w-7 h-7 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-base leading-none'
    avatar.textContent = '🙂'
  } else {
    avatar.className = 'shrink-0 w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center overflow-hidden'
    const img = document.createElement('img')
    img.src = 'whale.png'
    img.alt = '大肥鱼'
    img.className = 'w-full h-full object-cover'
    avatar.appendChild(img)
  }
  const bubble = document.createElement('div')
  bubble.className = role === 'user'
    ? 'rounded-2xl px-3 py-2 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm max-w-[80%] whitespace-pre-wrap break-words'
    : 'rounded-2xl px-3 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm max-w-[80%] whitespace-pre-wrap break-words min-w-0'
  if (text) {
    const textNode = document.createElement('div')
    textNode.textContent = text
    bubble.appendChild(textNode)
  }
  if (imageUrl) {
    const img = document.createElement('img')
    img.src = imageUrl
    img.alt = '上传的图片'
    img.className = 'mt-2 max-w-full max-h-60 rounded-xl object-contain cursor-pointer'
    img.addEventListener('click', () => {
      openPreview({ name: '上传的图片', url: imageUrl, category: '图片', size: 0, type: 'image/jpeg' })
    })
    bubble.appendChild(img)
  }
  wrap.appendChild(avatar); wrap.appendChild(bubble)
  aiMessages.appendChild(wrap)
  aiMessages.scrollTop = aiMessages.scrollHeight
  return bubble
}

const stringifyErr = (e) => e == null ? '未知错误' : (typeof e === 'string' ? e : (e.message || (() => { try { return JSON.stringify(e) } catch (_) { return String(e) } })()))

async function sendAiMessage() {
  const text = aiInput.value.trim()
  if ((!text && !aiPendingFile) || aiSending) return
  aiSending = true
  aiSend.disabled = true
  const pendingFileSnapshot = aiPendingFile
  const userText = text || (pendingFileSnapshot ? `[上传了文件：${pendingFileSnapshot.name}]` : '')
  const imageUrl = pendingFileSnapshot && (pendingFileSnapshot.type || '').startsWith('image/') ? pendingFileSnapshot.url : null
  aiInput.value = ''
  aiInput.style.height = 'auto'
  aiPendingFile = null
  renderAiPendingFile()
  appendAiMessage('user', userText, imageUrl)
  aiHistory.push({ role: 'user', content: userText })
  const bubble = appendAiMessage('assistant', '思考中...')
  let full = ''
  try {
    const body = { messages: aiHistory, stream: false }
    if (pendingFileSnapshot) body.fileUrl = pendingFileSnapshot.url
    const { data, error } = await supabase.functions.invoke('super-responder', { body })
    if (error) throw error
    if (data?.model) updateAiModelLabel(data.model)
    if (data?.choices?.[0]?.message?.content) full = data.choices[0].message.content
    else if (data?.error) full = `错误：${stringifyErr(data.error)}`
    else full = `未获取到回复，原始返回：${stringifyErr(data)}`
  } catch (err) {
    full = `请求失败：${stringifyErr(err)}`
  }
    if (full.indexOf('```') !== -1) {
    renderAiMessageContent(bubble, full)
    aiMessages.scrollTop = aiMessages.scrollHeight
  } else {
  typewriterReveal(bubble, full, () => {
      renderAiMessageContent(bubble, full)
      aiMessages.scrollTop = aiMessages.scrollHeight
    })
  }
  aiHistory.push({ role: 'assistant', content: full })
  aiSending = false
  aiSend.disabled = false
  aiInput.focus()
}

function resetAiChat() {
  if (aiTypewriterTimer) { clearInterval(aiTypewriterTimer); aiTypewriterTimer = null }
  aiHistory = [{ role: 'system', content: SYS_PROMPT }]
  aiMessages.innerHTML = ''
  aiPendingFile = null
  renderAiPendingFile()
  const hello = document.createElement('div')
  hello.className = 'flex gap-3'
  hello.innerHTML = '<div class="shrink-0 w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center overflow-hidden"><img src="whale.png" alt="大肥鱼" class="w-full h-full object-cover" /></div><div class="rounded-2xl px-3 py-2 bg-zinc-100 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 max-w-[80%]">呜哇～我是大肥鱼，有什么能帮你的嘛？</div>'
  aiMessages.appendChild(hello)
}

aiFab.addEventListener('click', () => { aiPanelOpen ? closeAiPanel() : openAiPanel() })
aiClose.addEventListener('click', closeAiPanel)
aiClear.addEventListener('click', resetAiChat)
aiSend.addEventListener('click', sendAiMessage)
aiInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAiMessage() } })
aiInput.addEventListener('input', () => { aiInput.style.height = 'auto'; aiInput.style.height = Math.min(aiInput.scrollHeight, 100) + 'px' })
document.addEventListener('click', (e) => {
  if (!aiPanelOpen) return
  if (aiPanel.contains(e.target)) return
  if (aiFab.contains(e.target)) return
  if (e.target.closest && e.target.closest('#code-download-menu')) return
  closeAiPanel()
})
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && aiPanelOpen) closeAiPanel() })

      document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return
  const previewModalEl = document.getElementById('preview-modal')
  const cropModalEl = document.getElementById('crop-modal')
  if (!confirmModal.classList.contains('hidden')) closeConfirm(false)
  else if (previewModalEl && !previewModalEl.classList.contains('hidden')) closePreview()
  else if (cropModalEl && !cropModalEl.classList.contains('hidden')) closeCropModal()
  else if (!userModal.classList.contains('hidden')) closeUserModal()
  else if (!friendsModal.classList.contains('hidden')) {
    if (!friendsHome.classList.contains('hidden')) closeFriendHome()
    else closeFriendsModal()
  }
  else if (!fileModal.classList.contains('hidden')) closeFileModal()
  else if (!reportModal.classList.contains('hidden')) closeReport()
                  else if (document.getElementById('task-detail-modal') && !document.getElementById('task-detail-modal').classList.contains('hidden')) closeTaskDetail()
  else if (!taskModal.classList.contains('hidden')) closeTaskModal()
  else if (!projectModal.classList.contains('hidden')) closeProjectModal()
  else if (!calendarModal.classList.contains('hidden')) closeCalendar()
  else if (sidebar.getAttribute('data-mobile-open') === 'true') closeMobileSidebar()
})
