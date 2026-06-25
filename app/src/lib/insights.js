// Gera "alertas inteligentes" a partir dos dados: avisos de gasto, vencimentos,
// comparações com meses anteriores e reforço positivo.
import {
  monthSummary, projectedBalance, openBills, expensesByCategory,
} from '../store'
import { currentMonthKey, shiftMonth, monthKey, daysUntil } from './format'

// Média de gastos dos N meses anteriores (exclui o mês atual)
function avgExpense(state, months = 3) {
  let key = shiftMonth(currentMonthKey(), -1)
  let sum = 0
  let n = 0
  for (let i = 0; i < months; i++) {
    const s = monthSummary(state, key)
    if (s.count > 0) { sum += s.expense; n++ }
    key = shiftMonth(key, -1)
  }
  return n ? sum / n : 0
}

// Média histórica de uma categoria nos meses anteriores
function avgCategory(state, categoryName, months = 3) {
  let key = shiftMonth(currentMonthKey(), -1)
  let sum = 0
  let n = 0
  for (let i = 0; i < months; i++) {
    const cats = expensesByCategory(state, key)
    const found = cats.find((c) => c.name === categoryName)
    if (cats.length) { sum += found?.value || 0; n++ }
    key = shiftMonth(key, -1)
  }
  return n ? sum / n : 0
}

export function insights(state) {
  const out = []
  const key = currentMonthKey()
  const m = monthSummary(state, key)
  const proj = projectedBalance(state, key)
  const bills = openBills(state)

  // Contas atrasadas
  const late = bills.filter((b) => b.type === 'pagar' && daysUntil(b.dueDate) < 0)
  if (late.length) {
    const total = late.reduce((s, b) => s + b.amount, 0)
    out.push({ level: 'danger', icon: '⏰', text: `${late.length} conta(s) atrasada(s), somando R$ ${fmt(total)}. Quite o quanto antes.` })
  }

  // Vencendo nos próximos 3 dias
  const soon = bills.filter((b) => b.type === 'pagar' && daysUntil(b.dueDate) >= 0 && daysUntil(b.dueDate) <= 3)
  if (soon.length) {
    const total = soon.reduce((s, b) => s + b.amount, 0)
    out.push({ level: 'warn', icon: '🔔', text: `${soon.length} conta(s) vencem em até 3 dias (R$ ${fmt(total)}).` })
  }

  // Gastando mais do que ganha
  if (m.income > 0 && m.expense > m.income) {
    out.push({ level: 'danger', icon: '🚨', text: `Você já gastou mais do que ganhou este mês (R$ ${fmt(m.expense - m.income)} no vermelho).` })
  }

  // Projeção negativa
  if (proj.projected < 0) {
    out.push({ level: 'danger', icon: '📉', text: `Sua projeção para o fim do mês está negativa (R$ ${fmt(proj.projected)}). Segure os gastos.` })
  }

  // Gastos acima da média
  const avg = avgExpense(state)
  if (avg > 0 && m.expense > avg * 1.2) {
    const pct = Math.round(((m.expense - avg) / avg) * 100)
    out.push({ level: 'warn', icon: '📊', text: `Seus gastos estão ${pct}% acima da sua média dos últimos meses.` })
  }

  // Categoria estourando a média
  const cats = expensesByCategory(state, key)
  for (const c of cats.slice(0, 4)) {
    const cAvg = avgCategory(state, c.name)
    if (cAvg > 0 && c.value > cAvg * 1.4) {
      const pct = Math.round(((c.value - cAvg) / cAvg) * 100)
      out.push({ level: 'warn', icon: c.icon, text: `${c.name}: ${pct}% acima do normal este mês (R$ ${fmt(c.value)}).` })
      break // mostra só a mais relevante
    }
  }

  // Reforço positivo
  if (m.income > 0 && m.balance > 0 && out.filter((a) => a.level === 'danger').length === 0) {
    out.push({ level: 'good', icon: '🎉', text: `Boa! Você está sobrando R$ ${fmt(m.balance)} este mês. Que tal mandar pra uma meta?` })
  }

  return out
}

const fmt = (v) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
