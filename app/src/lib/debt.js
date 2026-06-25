// Cálculos das dívidas particulares.
// Modelo único: a dívida tem um principal, um juro por período (% ou R$ fixo,
// ou SEM juros) e uma frequência (mensal/semanal/quinzenal). A cada período o
// juro corre; quando um pagamento entra, ele cobre primeiro o juro acumulado e
// o que sobra abate o principal. Assim, pagar só o juro mantém a dívida igual.
import { todayISO, addPeriodISO, periodsPerMonth } from './format'

const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0)

// Processa a dívida no tempo e devolve a situação atual + divisão de cada pagamento.
export function computeDebt(debt, today = todayISO()) {
  const semJuros = !!debt.semJuros
  const events = []

  // Eventos de juros: um a cada período, a partir do asOf até hoje.
  if (!semJuros) {
    let d = debt.asOf
    let guard = 0
    while (guard++ < 3000) {
      d = addPeriodISO(d, debt.frequencia)
      if (d > today) break
      events.push({ date: d, t: 'i' })
    }
  }
  // Eventos de pagamento.
  for (const p of debt.payments || []) {
    events.push({ date: p.date, t: 'p', amount: num(p.amount), id: p.id, kind: p.kind })
  }
  // Ordena por data; no mesmo dia, o juro vem antes do pagamento.
  events.sort((a, b) => (a.date === b.date ? (a.t === 'i' ? -1 : 1) : a.date.localeCompare(b.date)))

  let principal = num(debt.principal)
  let unpaid = 0 // juro acumulado ainda não pago
  let interestPaid = 0
  let principalPaid = 0
  const alloc = {} // divisão de cada pagamento: { [id]: {interest, principal} }

  const periodInterest = (base) =>
    debt.juroTipo === 'percent' ? base * (num(debt.juroPercent) / 100) : base > 0 ? num(debt.juroValor) : 0

  for (const e of events) {
    if (e.t === 'i') {
      unpaid += periodInterest(principal + unpaid)
    } else if (e.kind === 'juros') {
      // Pagamento explícito de juros: nunca abate o principal.
      unpaid = Math.max(0, unpaid - e.amount)
      interestPaid += e.amount
      alloc[e.id] = { interest: e.amount, principal: 0 }
    } else {
      // Pagamento normal: cobre o juro acumulado, o resto abate o principal.
      let amt = e.amount
      const ti = Math.min(amt, unpaid); unpaid -= ti; interestPaid += ti; amt -= ti
      const tp = Math.min(amt, principal); principal -= tp; principalPaid += tp
      alloc[e.id] = { interest: ti, principal: tp }
    }
  }

  const balance = principal + unpaid
  const perPeriodInterest = semJuros ? 0 : periodInterest(balance)
  const monthlyInterest = perPeriodInterest * periodsPerMonth(debt.frequencia)
  return { balance, interestPaid, principalPaid, perPeriodInterest, monthlyInterest, alloc, semJuros }
}

export const currentBalance = (debt, today) => computeDebt(debt, today).balance
export const totalInterestPaid = (debt) => computeDebt(debt).interestPaid
export const monthlyInterest = (debt) => computeDebt(debt).monthlyInterest
export const perPeriodInterest = (debt) => computeDebt(debt).perPeriodInterest
export const totalPaid = (debt) => (debt.payments || []).reduce((s, p) => s + num(p.amount), 0)

// Taxa mensal efetiva (para priorizar). Sem juros -> 0.
export function effRateMonthly(debt) {
  const s = computeDebt(debt)
  if (s.semJuros || s.balance <= 0) return 0
  return (s.monthlyInterest / s.balance) * 100
}

export function annualRate(monthlyPct) {
  return (Math.pow(1 + num(monthlyPct) / 100, 12) - 1) * 100
}

// Simulador de quitação (mensal, avalanche pelo maior juro). Estimativa.
export function simulatePayoff(debts, budget) {
  const items = debts
    .map((d) => {
      const s = computeDebt(d)
      const fixed = !s.semJuros && d.juroTipo !== 'percent'
      return { bal: s.balance, mInt: s.monthlyInterest, fixed, semJuros: s.semJuros }
    })
    .filter((x) => x.bal > 0.01)

  if (!items.length) return { months: 0, interest: 0, totalPaid: 0, done: true }

  const monthInt = (x) => (x.semJuros ? 0 : x.fixed ? (x.bal > 0 ? x.mInt : 0) : x.bal * (x.mInt / (x.bal || 1)))
  const rateOf = (x) => (x.bal > 0 ? monthInt(x) / x.bal : 0)

  const interest0 = items.reduce((s, x) => s + monthInt(x), 0)
  if (budget <= interest0 && interest0 > 0) return { impossible: true, minNeeded: interest0 }

  let months = 0, interest = 0, paid = 0
  while (items.some((x) => x.bal > 0.01) && months < 1200) {
    let left = budget
    for (const x of items) {
      const i = monthInt(x)
      interest += i
      x.bal += i // capitaliza; será reduzido pelos pagamentos abaixo
    }
    const order = [...items].sort((a, b) => rateOf(b) - rateOf(a))
    for (const x of order) {
      if (left <= 0) break
      const pay = Math.min(left, x.bal)
      x.bal -= pay; left -= pay; paid += pay
    }
    months++
  }
  return { months, interest, totalPaid: paid }
}
