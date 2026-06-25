// Helpers de formatação (moeda BRL, datas e números)

export const brl = (value) =>
  (Number(value) || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })

// Versão compacta para cartões grandes: R$ 1,2 mil / R$ 3,4 mi
export const brlCompact = (value) => {
  const v = Number(value) || 0
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace('.', ',')} mi`
  if (abs >= 1_000) return `R$ ${(v / 1_000).toFixed(1).replace('.', ',')} mil`
  return brl(v)
}

export const todayISO = () => new Date().toISOString().slice(0, 10)

export const monthKey = (isoDate) => (isoDate || '').slice(0, 7) // "2026-06"

export const currentMonthKey = () => todayISO().slice(0, 7)

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export const monthLabel = (key) => {
  const [y, m] = key.split('-')
  return `${MESES[Number(m) - 1]} de ${y}`
}

export const monthShort = (key) => {
  const [, m] = key.split('-')
  return MESES[Number(m) - 1].slice(0, 3)
}

// Soma/subtrai meses de uma chave "YYYY-MM"
export const shiftMonth = (key, delta) => {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export const formatDate = (iso) => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export const formatDateShort = (iso) => {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

// Dias até a data (negativo = atrasado)
export const daysUntil = (iso) => {
  const target = new Date(iso + 'T00:00:00')
  const now = new Date(todayISO() + 'T00:00:00')
  return Math.round((target - now) / 86_400_000)
}

export const uid = () =>
  `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`

// ---------- Helpers de calendário ----------

export const daysInMonth = (year, month1to12) => new Date(year, month1to12, 0).getDate()

// Garante um dia válido dentro do mês (ex.: dia 31 em fevereiro vira 28/29)
export const isoForDay = (key, day) => {
  const [y, m] = key.split('-').map(Number)
  const d = Math.min(day, daysInMonth(y, m))
  return `${key}-${String(d).padStart(2, '0')}`
}

export const addDaysISO = (iso, days) => {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// Soma N meses a uma data ISO (preserva o dia, com clamp no fim do mês).
export const addMonthsISO = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number)
  const target = new Date(y, m - 1 + n, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  const day = Math.min(d, lastDay)
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// Diferença em meses entre duas chaves "YYYY-MM" (b - a).
export const monthsDiffKeys = (a, b) => {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return (by - ay) * 12 + (bm - am)
}

// ---------- Frequência / períodos (mensal, semanal, quinzenal) ----------

// Avança uma data ISO em um período conforme a frequência.
export const addPeriodISO = (iso, freq) => {
  const d = new Date(iso + 'T00:00:00')
  if (freq === 'semanal') d.setDate(d.getDate() + 7)
  else if (freq === 'quinzenal') d.setDate(d.getDate() + 14)
  else d.setMonth(d.getMonth() + 1)
  return d.toISOString().slice(0, 10)
}

// Quantos períodos cabem num mês (para converter juros/valores para mensal).
export const periodsPerMonth = (freq) =>
  freq === 'semanal' ? 30.44 / 7 : freq === 'quinzenal' ? 30.44 / 14 : 1

export const freqNoun = (freq) =>
  ({ semanal: 'semana', quinzenal: 'quinzena', mensal: 'mês' }[freq] || 'mês')

export const freqLabel = (freq) =>
  ({ semanal: 'Semanal', quinzenal: 'Quinzenal', mensal: 'Mensal' }[freq] || 'Mensal')

export const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

// Matriz do mês: array de semanas, cada uma com 7 células {iso, day, inMonth}
export const monthMatrix = (key) => {
  const [y, m] = key.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const startDow = first.getDay() // 0 = domingo
  const total = daysInMonth(y, m)
  const cells = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= total; d++) {
    cells.push({ iso: `${key}-${String(d).padStart(2, '0')}`, day: d, inMonth: true })
  }
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}
