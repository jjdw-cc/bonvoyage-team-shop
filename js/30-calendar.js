/* ─────────────────────────────────────────────────────────────
 * 30-calendar.js · 日历与日程
 * 该文件由原 index.html 内联脚本按顺序拆分而来，文件编号即执行顺序。
 * ───────────────────────────────────────────────────────────── */
'use strict'

async function loadSchedules() {
  if (!currentUser) { schedules = {}; return }
  const { data } = await supabase.from('schedules').select('*')
  schedules = {}
  ;(data || []).forEach((row) => {
    if (!schedules[row.date_key]) schedules[row.date_key] = []
    schedules[row.date_key].push({ id: row.id, content: row.content })
  })
}

function renderCalendar() {
  calendarMonthLabel.textContent = `${calYear} 年 ${calMonth + 1} 月`
  calendarDates.innerHTML = ''
  const firstDay = new Date(calYear, calMonth, 1).getDay()
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  for (let i = 0; i < firstDay; i++) {
    const b = document.createElement('div'); b.className = 'aspect-square'; calendarDates.appendChild(b)
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const key = toKey(calYear, calMonth, day)
    const isToday = calYear === today.getFullYear() && calMonth === today.getMonth() && day === today.getDate()
    const isSel = key === selectedDateKey
    const hasEv = schedules[key]?.length > 0
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'group/day aspect-square rounded-xl text-sm flex flex-col items-center justify-center relative text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 active:scale-95 transition-all duration-200'
    if (isToday && !isSel) btn.className += ' ring-1 ring-blue-500'
    if (isSel) btn.className += ' bg-blue-400 text-white dark:bg-blue-500'
    btn.textContent = String(day)
    if (hasEv) {
      const dot = document.createElement('span')
      dot.className = isSel ? 'absolute bottom-1 w-1 h-1 rounded-full bg-white' : 'absolute bottom-1 w-1 h-1 rounded-full bg-blue-500'
      btn.appendChild(dot)
    }
    btn.addEventListener('click', () => { selectedDateKey = key; renderCalendar(); renderSchedules() })
    calendarDates.appendChild(btn)
  }
}

function renderSchedules() {
  const [y, m, d] = selectedDateKey.split('-').map(Number)
  calendarSelectedLabel.textContent = `${y} 年 ${m} 月 ${d} 日`
  calendarList.innerHTML = ''
  const items = schedules[selectedDateKey] || []
  calendarSelectedCount.textContent = `${items.length} 个日程`
  if (items.length === 0) {
    const li = document.createElement('li')
    li.className = 'text-sm text-zinc-400 dark:text-zinc-500 py-4 text-center'
    li.textContent = '暂无日程'
    calendarList.appendChild(li)
    return
  }
  items.forEach((item) => {
    const li = document.createElement('li')
    li.className = 'flex items-center justify-between gap-4 py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0'
    const span = document.createElement('span')
    span.className = 'text-sm text-zinc-900 dark:text-zinc-100 truncate'
    span.textContent = item.content
    const del = document.createElement('button')
    del.type = 'button'
    del.setAttribute('aria-label', '删除日程')
    del.className = 'shrink-0 p-2 rounded-xl text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-red-500 active:scale-95 transition-all duration-200'
    del.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>'
    del.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: '删除日程',
        message: `确定要删除日程「${item.title || '未命名'}」吗？此操作不可恢复。`,
        okText: '删除',
      })
      if (!ok) return
      await supabase.from('schedules').delete().eq('id', item.id)
      await loadSchedules(); renderCalendar(); renderSchedules()
    })
    li.appendChild(span); li.appendChild(del); calendarList.appendChild(li)
  })
}

async function addSchedule() {
  const value = calendarInput.value.trim()
  if (!value) return
  if (!currentUser) { calendarInput.focus(); return }
  await supabase.from('schedules').insert({ date_key: selectedDateKey, content: value })
  calendarInput.value = ''
  await loadSchedules(); renderCalendar(); renderSchedules()
}
calendarAdd.addEventListener('click', addSchedule)
calendarInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addSchedule() } })
calendarPrev.addEventListener('click', () => { calMonth -= 1; if (calMonth < 0) { calMonth = 11; calYear -= 1 } renderCalendar() })
calendarNext.addEventListener('click', () => { calMonth += 1; if (calMonth > 11) { calMonth = 0; calYear += 1 } renderCalendar() })
async function openCalendar() { calendarModal.classList.remove('hidden'); syncBodyScroll(); await loadSchedules(); renderCalendar(); renderSchedules(); calendarInput.focus() }
function closeCalendar() { calendarModal.classList.add('hidden'); syncBodyScroll() }
calendarOpen.addEventListener('click', openCalendar)
calendarClose.addEventListener('click', closeCalendar)
calendarBackdrop.addEventListener('click', closeCalendar)

const friendsOpen = document.getElementById('friends-open')
const friendsClose = document.getElementById('friends-close')
const friendsBackdrop = document.getElementById('friends-backdrop')
const friendsIdInput = document.getElementById('friends-id-input')
const friendsAdd = document.getElementById('friends-add')
      const friendsMessage = document.getElementById('friends-message')
const friendsList = document.getElementById('friends-list')
const friendsMain = document.getElementById('friends-main')
const friendsHome = document.getElementById('friends-home')
const friendsHomeBody = document.getElementById('friends-home-body')
const friendsHomeBack = document.getElementById('friends-home-back')
const friendsHomeClose = document.getElementById('friends-home-close')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
