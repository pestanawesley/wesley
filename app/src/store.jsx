import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import * as db from './lib/db'
import { seed } from './lib/seed'
import { uid, currentMonthKey, monthKey, todayISO } from './lib/format'

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

// Saldo atual de uma conta = saldo inicial +/- transações já realizadas
export function accountBalance(state, accountId) {
  const acc = accountById(state, accountId)
  if (!acc) return 0
  return state.transactions
    .filter((t) => t.accountId === accountId)
    .reduce((sum, t) => sum + (t.type === 'ganho' ? t.amount : -t.amount), Number(acc.initialBalance) || 0)
}

// Saldo total disponível (soma de todas as contas)
export function totalBalance(state) {
  return state.accounts.reduce((sum, a) => sum + accountBalance(state, a.id), 0)
}

// Resumo de um mês: entradas, saídas e o que sobrou
export function monthSummary(state, key = currentMonthKey()) {
  const txs = state.transactions.filter((t) => monthKey(t.date) === key)
  const income = txs.filter((t) => t.type === 'ganho').reduce((s, t) => s + t.amount, 0)
  const expense = txs.filter((t) => t.type === 'gasto').reduce((s, t) => s + t.amount, 0)
  return { income, expense, balance: income - expense, count: txs.length }
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

// Saldo projetado para o fim do mês = saldo de hoje + a receber - a pagar (pendentes do mês)
export function projectedBalance(state, key = currentMonthKey()) {
  const base = totalBalance(state)
  const pend = openBills(state).filter((b) => monthKey(b.dueDate) === key)
  const toReceive = pend.filter((b) => b.type === 'receber').reduce((s, b) => s + b.amount, 0)
  const toPay = pend.filter((b) => b.type === 'pagar').reduce((s, b) => s + b.amount, 0)
  return { projected: base + toReceive - toPay, toReceive, toPay, base }
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
