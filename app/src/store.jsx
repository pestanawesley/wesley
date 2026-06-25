import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import * as db from './lib/db'
import { seed } from './lib/seed'
import { uid, currentMonthKey, monthKey, todayISO, isoForDay, addDaysISO, shiftMonth, addMonthsISO, monthsDiffKeys, daysUntil } from './lib/format'

// Datas em que uma recorrência mensal "acontece", do início até o horizonte.
function recurrenceOccurrences(rec, horizonISO) {
  const out = []
  let key = monthKey(rec.startDate)
  const horizonKey = monthKey(horizonISO)
  let guard = 0
  while (key <= horizonKey && guard++ < 240) {
    const iso = isoForDay(key, rec.dayOfMonth)
    if (iso >= rec.startDate && iso <= horizonISO && (!rec.endDate || iso <= rec.endDate)) {
      out.push(iso)
    }
    key = shiftMonth(key, 1)
  }
  return out
}

const StoreContext = createContext(null)

function init() {
  return db.load() || seed()
}

function reducer(state, action) {
  switch (action.type) {
    case 'RESET':
      return action.payload

    // ---- Transações (gastos / ganhos) ----
    case 'ADD_TX':
      return { ...state, transactions: [{ ...action.payload, id: uid() }, ...state.transactions] }
    case 'IMPORT_TX':
      return {
        ...state,
        transactions: [...action.payload.map((t) => ({ ...t, id: uid() })), ...state.transactions],
      }
    case 'UPDATE_TX':
      return {
        ...state,
        transactions: state.transactions.map((t) =>
          t.id === action.payload.id ? { ...t, ...action.payload } : t,
        ),
      }
    case 'DELETE_TX':
      return { ...state, transactions: state.transactions.filter((t) => t.id !== action.id) }

    // ---- Contas / cartões ----
    case 'ADD_ACCOUNT':
      return { ...state, accounts: [...state.accounts, { ...action.payload, id: uid() }] }
    case 'UPDATE_ACCOUNT':
      return {
        ...state,
        accounts: state.accounts.map((a) =>
          a.id === action.payload.id ? { ...a, ...action.payload } : a,
        ),
      }
    case 'DELETE_ACCOUNT':
      return { ...state, accounts: state.accounts.filter((a) => a.id !== action.id) }

    // ---- Categorias ----
    case 'ADD_CATEGORY':
      return { ...state, categories: [...state.categories, { ...action.payload, id: uid() }] }
    case 'DELETE_CATEGORY':
      return { ...state, categories: state.categories.filter((c) => c.id !== action.id) }

    // ---- Contas futuras (a pagar / a receber) ----
    case 'ADD_BILL':
      return { ...state, bills: [{ ...action.payload, id: uid() }, ...state.bills] }
    case 'UPDATE_BILL':
      return {
        ...state,
        bills: state.bills.map((b) =>
          b.id === action.payload.id ? { ...b, ...action.payload } : b,
        ),
      }
    case 'DELETE_BILL':
      return { ...state, bills: state.bills.filter((b) => b.id !== action.id) }

    // Marca uma conta futura como paga/recebida -> vira transação real
    case 'SETTLE_BILL': {
      const bill = state.bills.find((b) => b.id === action.id)
      if (!bill) return state
      const tx = {
        id: uid(),
        type: bill.type === 'pagar' ? 'gasto' : 'ganho',
        amount: bill.amount,
        date: action.date || todayISO(),
        categoryId: bill.categoryId,
        accountId: action.accountId || bill.accountId,
        description: bill.description,
        fromBill: bill.id,
      }
      return {
        ...state,
        transactions: [tx, ...state.transactions],
        bills: state.bills.map((b) =>
          b.id === action.id ? { ...b, status: 'pago', settledAt: tx.date } : b,
        ),
      }
    }

    // ---- Recorrências (salário, aluguel, assinaturas) ----
    case 'ADD_RECURRENCE':
      return { ...state, recurrences: [...state.recurrences, { ...action.payload, id: uid() }] }
    case 'UPDATE_RECURRENCE':
      return {
        ...state,
        recurrences: state.recurrences.map((r) =>
          r.id === action.payload.id ? { ...r, ...action.payload } : r,
        ),
      }
    case 'DELETE_RECURRENCE':
      return { ...state, recurrences: state.recurrences.filter((r) => r.id !== action.id) }

    // ---- Parcelados (pensão, financiamento, compras parceladas) ----
    case 'ADD_INSTALLMENT':
      return { ...state, installments: [...(state.installments || []), { ...action.payload, id: uid() }] }
    case 'UPDATE_INSTALLMENT':
      return {
        ...state,
        installments: (state.installments || []).map((i) =>
          i.id === action.payload.id ? { ...i, ...action.payload } : i,
        ),
      }
    case 'DELETE_INSTALLMENT':
      return { ...state, installments: (state.installments || []).filter((i) => i.id !== action.id) }

    // Salário mínimo: atualiza o valor e recalcula itens vinculados (ex.: pensão).
    case 'SET_MINWAGE': {
      const mw = action.value
      const r2 = (n) => Math.round(n * 100) / 100
      return {
        ...state,
        settings: { ...state.settings, minWage: mw },
        recurrences: state.recurrences.map((r) =>
          r.linkMinWage ? { ...r, amount: r2(mw * (r.minWageFraction || 0)) } : r,
        ),
        installments: (state.installments || []).map((i) =>
          i.linkMinWage ? { ...i, installmentValue: r2(mw * (i.minWageFraction || 0)) } : i,
        ),
      }
    }

    // Gera lançamentos/contas das recorrências ativas (idempotente).
    case 'MATERIALIZE': {
      const horizon = addDaysISO(todayISO(), 45)
      const today = todayISO()
      // Chaves já existentes para não duplicar (recorrência + data).
      const seen = new Set([
        ...state.bills.filter((b) => b.recurrenceId).map((b) => `${b.recurrenceId}:${b.recurDate}`),
        ...state.transactions.filter((t) => t.recurrenceId).map((t) => `${t.recurrenceId}:${t.recurDate}`),
      ])
      const newBills = []
      const newTxs = []
      for (const rec of state.recurrences.filter((r) => r.active !== false)) {
        for (const iso of recurrenceOccurrences(rec, horizon)) {
          const k = `${rec.id}:${iso}`
          if (seen.has(k)) continue
          seen.add(k)
          if (rec.autoConfirm && iso <= today) {
            newTxs.push({
              id: uid(),
              type: rec.type,
              amount: rec.amount,
              date: iso,
              categoryId: rec.categoryId,
              accountId: rec.accountId,
              description: rec.description,
              recurrenceId: rec.id,
              recurDate: iso,
            })
          } else {
            newBills.push({
              id: uid(),
              type: rec.type === 'ganho' ? 'receber' : 'pagar',
              description: rec.description,
              amount: rec.amount,
              dueDate: iso,
              categoryId: rec.categoryId,
              accountId: rec.accountId,
              status: 'pendente',
              recurrenceId: rec.id,
              recurDate: iso,
            })
          }
        }
      }
      if (!newBills.length && !newTxs.length) return state
      return {
        ...state,
        bills: [...newBills, ...state.bills],
        transactions: [...newTxs, ...state.transactions],
      }
    }

    // ---- Metas ----
    case 'ADD_GOAL':
      return { ...state, goals: [...state.goals, { ...action.payload, id: uid(), saved: 0 }] }
    case 'UPDATE_GOAL':
      return {
        ...state,
        goals: state.goals.map((g) =>
          g.id === action.payload.id ? { ...g, ...action.payload } : g,
        ),
      }
    case 'CONTRIBUTE_GOAL':
      return {
        ...state,
        goals: state.goals.map((g) =>
          g.id === action.id ? { ...g, saved: (g.saved || 0) + action.amount } : g,
        ),
      }
    case 'DELETE_GOAL':
      return { ...state, goals: state.goals.filter((g) => g.id !== action.id) }

    default:
      return state
  }
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, init)

  // Ao abrir o app, gera os lançamentos/contas das recorrências pendentes.
  useEffect(() => {
    dispatch({ type: 'MATERIALIZE' })
  }, [])

  // Persiste no localStorage a cada mudança.
  useEffect(() => {
    db.save(state)
  }, [state])

  const value = useMemo(() => ({ state, dispatch }), [state])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore precisa estar dentro de <StoreProvider>')
  return ctx
}

// =====================  SELETORES / CÁLCULOS  ===============================

export function categoryById(state, id) {
  return state.categories.find((c) => c.id === id)
}
export function accountById(state, id) {
  return state.accounts.find((a) => a.id === id)
}

// Saldo atual de uma conta = saldo inicial +/- transações (inclui transferências).
// Para cartão de crédito, o saldo fica negativo (dívida = fatura em aberto).
export function accountBalance(state, accountId) {
  const acc = accountById(state, accountId)
  if (!acc) return 0
  return state.transactions.reduce((sum, t) => {
    if (t.type === 'transferencia') {
      if (t.accountId === accountId) return sum - t.amount // saiu
      if (t.toAccountId === accountId) return sum + t.amount // entrou
      return sum
    }
    if (t.accountId !== accountId) return sum
    return sum + (t.type === 'ganho' ? t.amount : -t.amount)
  }, Number(acc.initialBalance) || 0)
}

// Saldo total disponível (soma de todas as contas)
export function totalBalance(state) {
  return state.accounts.reduce((sum, a) => sum + accountBalance(state, a.id), 0)
}

// Resumo de um mês: entradas, saídas e o que sobrou (transferências não contam)
export function monthSummary(state, key = currentMonthKey()) {
  const txs = state.transactions.filter((t) => monthKey(t.date) === key)
  const income = txs.filter((t) => t.type === 'ganho').reduce((s, t) => s + t.amount, 0)
  const expense = txs.filter((t) => t.type === 'gasto').reduce((s, t) => s + t.amount, 0)
  const count = txs.filter((t) => t.type === 'ganho' || t.type === 'gasto').length
  return { income, expense, balance: income - expense, count }
}

// Gastos do mês agrupados por categoria (para o gráfico)
export function expensesByCategory(state, key = currentMonthKey()) {
  const map = new Map()
  state.transactions
    .filter((t) => t.type === 'gasto' && monthKey(t.date) === key)
    .forEach((t) => {
      const cat = categoryById(state, t.categoryId)
      const name = cat?.name || 'Sem categoria'
      const cur = map.get(name) || { name, value: 0, color: cat?.color || '#94a3b8', icon: cat?.icon || '📦' }
      cur.value += t.amount
      map.set(name, cur)
    })
  return [...map.values()].sort((a, b) => b.value - a.value)
}

// Contas futuras em aberto (pendentes)
export function openBills(state) {
  return state.bills
    .filter((b) => b.status !== 'pago')
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
}

// ---- Cartão de crédito / faturas ----

// Em qual fatura (competência YYYY-MM) cai uma compra, dado o dia de fechamento.
export function invoiceKeyFor(dateISO, closingDay) {
  let [y, m, d] = dateISO.split('-').map(Number)
  if (d > closingDay) { m++; if (m > 12) { m = 1; y++ } }
  return `${y}-${String(m).padStart(2, '0')}`
}

// Vencimento de uma fatura (competência key), dado o dia de vencimento e fechamento.
function invoiceDueDate(key, dueDay, closingDay) {
  let [y, m] = key.split('-').map(Number)
  if (dueDay <= closingDay) { m++; if (m > 12) { m = 1; y++ } } // vence no mês seguinte
  const day = Math.min(dueDay, new Date(y, m, 0).getDate())
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// Faturas de um cartão: agrupa compras por competência, calcula total e se foi paga.
export function cardInvoices(state, cardId) {
  const card = accountById(state, cardId)
  if (!card) return []
  const closingDay = card.closingDay || 1
  const dueDay = card.dueDay || 10

  const groups = new Map()
  // Compras (gastos no cartão)
  state.transactions
    .filter((t) => t.type === 'gasto' && t.accountId === cardId)
    .forEach((t) => {
      const key = invoiceKeyFor(t.date, closingDay)
      const g = groups.get(key) || { key, total: 0, purchases: [], paid: 0 }
      g.total += t.amount
      g.purchases.push(t)
      groups.set(key, g)
    })
  // Parcelados vinculados a este cartão: cada parcela já lançada entra na fatura.
  const nowK = currentMonthKey()
  for (const inst of state.installments || []) {
    if (inst.target !== 'cartao' || inst.cardId !== cardId) continue
    for (let n = 1; n <= inst.totalInstallments; n++) {
      const due = addMonthsISO(inst.firstDate, n - 1)
      if (monthKey(due) > nowK) break // parcelas futuras ainda não foram lançadas
      const key = invoiceKeyFor(due, closingDay)
      const g = groups.get(key) || { key, total: 0, purchases: [], paid: 0 }
      g.total += inst.installmentValue
      g.purchases.push({ id: `${inst.id}-${n}`, description: `${inst.description} (${n}/${inst.totalInstallments})`, amount: inst.installmentValue, date: due, categoryId: inst.categoryId })
      groups.set(key, g)
    }
  }

  // Pagamentos (transferências para o cartão), associados pela invoiceKey
  state.transactions
    .filter((t) => t.type === 'transferencia' && t.toAccountId === cardId && t.invoiceKey)
    .forEach((t) => {
      const g = groups.get(t.invoiceKey) || { key: t.invoiceKey, total: 0, purchases: [], paid: 0 }
      g.paid += t.amount
      groups.set(t.invoiceKey, g)
    })

  return [...groups.values()]
    .map((g) => ({
      ...g,
      dueDate: invoiceDueDate(g.key, dueDay, closingDay),
      isPaid: g.paid >= g.total - 0.005 && g.total > 0,
    }))
    .filter((g) => g.total > 0)
    .sort((a, b) => b.key.localeCompare(a.key))
}

// Total da fatura em aberto (não paga) de um cartão.
export function openInvoiceTotal(state, cardId) {
  return cardInvoices(state, cardId)
    .filter((inv) => !inv.isPaid)
    .reduce((s, inv) => s + (inv.total - inv.paid), 0)
}

// Todas as contas (pagas e pendentes) com vencimento num mês — para o calendário
export function billsInMonth(state, key) {
  return state.bills
    .filter((b) => monthKey(b.dueDate) === key)
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
}

// ---- Parcelados ----
// Situação de um parcelamento: conta como pagas as parcelas cuja data já passou.
export function installmentStatus(inst, today = todayISO()) {
  const total = inst.totalInstallments
  let pagas = 0
  for (let n = 1; n <= total; n++) {
    if (addMonthsISO(inst.firstDate, n - 1) <= today) pagas++
    else break
  }
  const restantes = total - pagas
  const current = Math.min(total, pagas + 1)
  return {
    total, pagas, restantes, current,
    nextDue: addMonthsISO(inst.firstDate, Math.min(pagas, total - 1)),
    totalRestante: restantes * inst.installmentValue,
    done: restantes <= 0,
  }
}

export function activeInstallments(state) {
  return (state.installments || [])
    .filter((i) => !installmentStatus(i).done)
    .sort((a, b) => installmentStatus(a).nextDue.localeCompare(installmentStatus(b).nextDue))
}

// Parcelas (fora do cartão) que vencem no mês — entram na projeção como "a pagar".
function installmentsToPay(state, key) {
  return (state.installments || []).reduce((s, i) => {
    if (i.target === 'cartao') return s // já contam via fatura do cartão
    const st = installmentStatus(i, key)
    return st.done ? s : monthKey(st.nextDue) === key ? s + i.installmentValue : s
  }, 0)
}

// Saldo projetado para o fim do mês = saldo de hoje + a receber - a pagar (pendentes do mês)
export function projectedBalance(state, key = currentMonthKey()) {
  const base = totalBalance(state)
  const pend = openBills(state).filter((b) => monthKey(b.dueDate) === key)
  const toReceive = pend.filter((b) => b.type === 'receber').reduce((s, b) => s + b.amount, 0)
  const toPay = pend.filter((b) => b.type === 'pagar').reduce((s, b) => s + b.amount, 0) + installmentsToPay(state, key)
  return { projected: base + toReceive - toPay, toReceive, toPay, base }
}

// Plano do mês: renda fixa (recorrentes ganho) vs compromissos fixos
// (recorrentes gasto + parcelas), e a sobra prevista para guardar.
export function monthlyPlan(state) {
  const rec = state.recurrences || []
  const income = rec.filter((r) => r.type === 'ganho' && r.active !== false).reduce((s, r) => s + (r.amount || 0), 0)
  const recOut = rec.filter((r) => r.type === 'gasto' && r.active !== false).reduce((s, r) => s + (r.amount || 0), 0)
  const instOut = activeInstallments(state).reduce((s, i) => s + (i.installmentValue || 0), 0)
  const fixedOut = recOut + instOut
  return { income, recOut, instOut, fixedOut, leftover: income - fixedOut }
}

// Linha do tempo: quando cada parcelado acaba e quanto libera por mês.
export function payoffTimeline(state) {
  return activeInstallments(state)
    .map((i) => ({
      id: i.id,
      description: i.description,
      end: addMonthsISO(i.firstDate, i.totalInstallments - 1),
      freed: i.installmentValue,
      restantes: installmentStatus(i).restantes,
    }))
    .sort((a, b) => a.end.localeCompare(b.end))
}

// Vencimentos nos próximos N dias (contas futuras + parcelas).
export function upcomingDues(state, days = 7) {
  const list = []
  for (const b of openBills(state)) {
    const d = daysUntil(b.dueDate)
    if (d <= days) list.push({ desc: b.description, date: b.dueDate, amount: b.amount, kind: b.type, days: d })
  }
  for (const i of activeInstallments(state)) {
    const st = installmentStatus(i)
    const d = daysUntil(st.nextDue)
    if (d <= days) list.push({ desc: i.description, date: st.nextDue, amount: i.installmentValue, kind: 'pagar', days: d })
  }
  return list.sort((a, b) => (a.date || '').localeCompare(b.date || ''))
}

// Sugestão de reserva de emergência = N meses dos compromissos fixos.
export function emergencyTarget(state, months = 3) {
  return monthlyPlan(state).fixedOut * months
}

// Patrimônio líquido = saldo das contas + guardado em metas - dívidas em aberto (a pagar)
export function netWorth(state) {
  const cash = totalBalance(state)
  const saved = state.goals.reduce((s, g) => s + (g.saved || 0), 0)
  const debts = openBills(state).filter((b) => b.type === 'pagar').reduce((s, b) => s + b.amount, 0)
  return { netWorth: cash + saved - debts, cash, saved, debts }
}

// Série dos últimos N meses (entrou/saiu) para gráfico de evolução
export function monthlyTrend(state, months = 6) {
  const out = []
  const now = new Date()
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const s = monthSummary(state, key)
    out.push({ key, entrou: s.income, saiu: s.expense, sobrou: s.balance })
  }
  return out
}
