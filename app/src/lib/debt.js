// Cálculos das dívidas particulares (juros compostos mensais).
import { monthKey, currentMonthKey, shiftMonth } from './format'

// Saldo devedor atual: parte do saldo registrado (balance0 em asOf) e, a cada
// mês seguinte, aplica os juros e subtrai os pagamentos daquele mês.
export function currentBalance(debt, today = currentMonthKey()) {
  let bal = Number(debt.balance0) || 0
  const r = (Number(debt.rate) || 0) / 100
  const startK = monthKey(debt.asOf)

  const payByMonth = {}
  for (const p of debt.payments || []) {
    const mk = monthKey(p.date)
    payByMonth[mk] = (payByMonth[mk] || 0) + (Number(p.amount) || 0)
  }

  let k = startK
  let guard = 0
  while (k <= today && guard++ < 1200) {
    if (k !== startK) bal += bal * r // juros a partir do mês seguinte
    bal -= payByMonth[k] || 0
    if (bal < 0) bal = 0
    k = shiftMonth(k, 1)
  }
  return bal
}

export function totalPaid(debt) {
  return (debt.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0)
}

// Juros do mês corrente sobre o saldo atual (quanto a dívida "engorda" por mês).
export function monthlyInterest(debt) {
  return currentBalance(debt) * ((Number(debt.rate) || 0) / 100)
}

// Taxa efetiva anual a partir da mensal: (1+i)^12 - 1.
export function annualRate(monthlyPct) {
  const r = (Number(monthlyPct) || 0) / 100
  return (Math.pow(1 + r, 12) - 1) * 100
}

// Simula quitar TODAS as dívidas pagando `budget` por mês, priorizando a de
// maior juro (método avalanche). Retorna meses, juros totais e total pago.
export function simulatePayoff(debts, budget) {
  const items = debts
    .map((d) => ({ rate: (Number(d.rate) || 0) / 100, b: currentBalance(d) }))
    .filter((x) => x.b > 0.01)

  if (!items.length) return { months: 0, interest: 0, totalPaid: 0, done: true }

  const interest0 = items.reduce((s, x) => s + x.b * x.rate, 0)
  if (budget <= interest0) return { impossible: true, minNeeded: interest0 }

  let months = 0
  let interest = 0
  let paid = 0
  while (items.some((x) => x.b > 0.01) && months < 1200) {
    items.forEach((x) => {
      const i = x.b * x.rate
      x.b += i
      interest += i
    })
    let left = budget
    items.sort((a, b) => b.rate - a.rate)
    for (const x of items) {
      if (left <= 0) break
      const pay = Math.min(left, x.b)
      x.b -= pay
      left -= pay
      paid += pay
    }
    months++
  }
  return { months, interest, totalPaid: paid }
}
