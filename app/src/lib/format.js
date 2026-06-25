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
