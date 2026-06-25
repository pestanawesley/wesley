// Cálculos das dívidas particulares — modelo dirigido por pagamento.
//
// A dívida tem um saldo (principal) e um juro por período (% do saldo, R$ fixo,
// ou sem juros). Em CADA pagamento, uma parte é juros (sai primeiro) e o resto
// ABATE o saldo. Assim:
//   - pagar só o juro  -> saldo não muda
//   - pagar mais       -> o excedente abate o saldo
//   - juro %  -> acompanha o saldo (cai quando você abate)  [Lucas]
//   - juro R$ -> fixo enquanto houver saldo                  [Betinho]
//   - sem juros -> tudo abate                                [Fernando]
// O juros de cada pagamento fica guardado (e é editável na tela), então não
// depende de "quanto tempo passou" — depende do que foi combinado.
import { periodsPerMonth } from './format'

const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0)

// Juros "do período" sobre um saldo, conforme a configuração da dívida.
export function periodInterestOn(debt, balance) {
  if (debt.semJuros) return 0
  if (debt.juroTipo === 'percent') return balance * (num(debt.juroPercent) / 100)
  return balance > 0 ? num(debt.juroValor) : 0
}

export function computeDebt(debt) {
  let balance = num(debt.principal)
  let interestPaid = 0
  let principalPaid = 0
  const alloc = {}

  const pays = [...(debt.payments || [])].sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  for (const p of pays) {
    const amt = num(p.amount)
    const juros = debt.semJuros ? 0 : Math.min(amt, num(p.juros)) // juros não passa do total pago
    const abate = Math.min(Math.max(0, amt - juros), balance)
    balance -= abate
    interestPaid += juros
    principalPaid += abate
    alloc[p.id] = { interest: juros, principal: abate }
  }
  balance = Math.max(0, balance)

  const perPeriodInterest = periodInterestOn(debt, balance)
  const monthlyInterest = perPeriodInterest * periodsPerMonth(debt.frequencia)
  return { balance, interestPaid, principalPaid, perPeriodInterest, monthlyInterest, alloc, semJuros: !!debt.semJuros }
}

export const currentBalance = (debt) => computeDebt(debt).balance
export const totalInterestPaid = (debt) => computeDebt(debt).interestPaid
export const monthlyInterest = (debt) => computeDebt(debt).monthlyInterest
export const perPeriodInterest = (debt) => computeDebt(debt).perPeriodInterest
export const totalPaid = (debt) => (debt.payments || []).reduce((s, p) => s + num(p.amount), 0)

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
      return {
        balance: s.balance,
        semJuros: s.semJuros,
        percent: !s.semJuros && d.juroTipo === 'percent' ? num(d.juroPercent) / 100 : 0,
        valor: !s.semJuros && d.juroTipo !== 'percent' ? num(d.juroValor) : 0,
        ppm: periodsPerMonth(d.frequencia),
      }
    })
    .filter((x) => x.balance > 0.01)

  if (!items.length) return { months: 0, interest: 0, totalPaid: 0, done: true }

  const monthInt = (x) =>
    x.semJuros ? 0 : (x.percent ? x.balance * x.percent : x.balance > 0 ? x.valor : 0) * x.ppm
  const rateOf = (x) => (x.balance > 0 ? monthInt(x) / x.balance : 0)

  const interest0 = items.reduce((s, x) => s + monthInt(x), 0)
  if (budget <= interest0 && interest0 > 0) return { impossible: true, minNeeded: interest0 }

  let months = 0, interest = 0, paid = 0
  while (items.some((x) => x.balance > 0.01) && months < 1200) {
    let left = budget
    for (const x of items) {
      const j = monthInt(x)
      interest += j
      const pay = Math.min(left, j); left -= pay; paid += pay // juros pagos (queimados)
    }
    const order = [...items].sort((a, b) => rateOf(b) - rateOf(a))
    for (const x of order) {
      if (left <= 0) break
      const pay = Math.min(left, x.balance); x.balance -= pay; left -= pay; paid += pay
    }
    months++
  }
  return { months, interest, totalPaid: paid }
}
