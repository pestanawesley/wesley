import { useState } from 'react'
import { vaultExists, createVault, openVault, saveVault, destroyVault } from '../lib/vault'
import {
  computeDebt, currentBalance, totalInterestPaid, monthlyInterest, perPeriodInterest,
  effRateMonthly, annualRate, simulatePayoff,
} from '../lib/debt'
import { brl, todayISO, formatDate, formatDateShort, uid, addPeriodISO, periodsPerMonth, freqNoun, freqLabel, daysUntil } from '../lib/format'

const parseNum = (s) => {
  const n = parseFloat(String(s).replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0)
const confirm2 = (m) => window.confirm(m)

export default function Vault({ onClose }) {
  const [data, setData] = useState(null)
  const [pin, setPin] = useState('')

  if (!data) return <Unlock onClose={onClose} onOpen={(d, p) => { setData(d); setPin(p) }} />

  const update = (next) => { setData(next); saveVault(pin, next) }
  return <VaultHome data={data} update={update} onClose={onClose} />
}

// ---------------------------------------------------------------- desbloqueio
function Unlock({ onClose, onOpen }) {
  const exists = vaultExists()
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    if (pin.length < 4) return setErr('Use ao menos 4 dígitos.')
    setBusy(true)
    try {
      if (exists) {
        const d = await openVault(pin)
        if (!d) { setBusy(false); return setErr('Senha incorreta.') }
        onOpen(d, pin)
      } else {
        if (pin !== confirm) { setBusy(false); return setErr('As senhas não conferem.') }
        onOpen(await createVault(pin), pin)
      }
    } catch {
      setBusy(false)
      setErr('Não foi possível abrir (precisa de https ou localhost).')
    }
  }

  const reset = () => {
    if (confirm2('⚠️ Esquecer a senha APAGA tudo da área particular (sem recuperação). Continuar?')) {
      destroyVault(); location.reload()
    }
  }

  return (
    <div className="vault-screen">
      <button className="vault-x" onClick={onClose}>✕</button>
      <div className="vault-lock">
        <div className="vault-emoji">🔒</div>
        <h2>Área particular</h2>
        <p className="muted" style={{ fontSize: 13, textAlign: 'center', marginBottom: 18 }}>
          {exists ? 'Digite sua senha para acessar.' : 'Crie uma senha. Os dados ficam criptografados — sem ela, ninguém vê.'}
        </p>
        <form onSubmit={submit}>
          <input type="password" inputMode="numeric" autoFocus placeholder="Senha" value={pin}
            onChange={(e) => setPin(e.target.value)} className="amount-input" style={{ letterSpacing: 4 }} />
          {!exists && (
            <input type="password" inputMode="numeric" placeholder="Confirmar senha" value={confirm}
              onChange={(e) => setConfirm(e.target.value)} style={{ marginTop: 10 }} />
          )}
          {err && <div className="vault-err">{err}</div>}
          <button type="submit" className="btn primary full mt" disabled={busy}>
            {busy ? '...' : exists ? 'Entrar' : 'Criar área particular'}
          </button>
        </form>
        {exists && <button className="btn ghost full mt" style={{ fontSize: 12 }} onClick={reset}>Esqueci a senha (apaga tudo)</button>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- início cofre
function VaultHome({ data, update, onClose }) {
  const [adding, setAdding] = useState(false)
  const [paying, setPaying] = useState(null) // { debt, prefill }
  const [budget, setBudget] = useState('')

  const debts = data.debts || []
  const calc = debts.map((d) => ({ d, s: computeDebt(d) }))
  const totalDebt = calc.reduce((a, x) => a + x.s.balance, 0)
  const totalMonthInterest = calc.reduce((a, x) => a + x.s.monthlyInterest, 0)
  const totalBurned = calc.reduce((a, x) => a + x.s.interestPaid, 0)

  const dueWeek = debts
    .filter((d) => d.proximoVencimento && currentBalance(d) > 0 && daysUntil(d.proximoVencimento) <= 7)
    .reduce((a, d) => a + (num(d.valorCombinado) || perPeriodInterest(d)), 0)
  const perMonth = debts.reduce((a, d) => {
    if (currentBalance(d) <= 0) return a
    const v = num(d.valorCombinado)
    return a + (v > 0 ? v * periodsPerMonth(d.frequencia) : monthlyInterest(d))
  }, 0)

  const priority = calc.filter((x) => !x.s.semJuros && x.s.balance > 0)
    .sort((a, b) => effRateMonthly(b.d) - effRateMonthly(a.d))[0]?.d
  const sim = budget ? simulatePayoff(debts, parseNum(budget)) : null

  const addDebt = (d) => update({ ...data, debts: [...debts, { ...d, id: uid(), payments: [] }] })
  const delDebt = (id) => update({ ...data, debts: debts.filter((d) => d.id !== id) })
  const addPayment = (debtId, { amount, juros, date }) =>
    update({
      ...data,
      debts: debts.map((d) =>
        d.id === debtId
          ? {
              ...d,
              payments: [...(d.payments || []), { id: uid(), amount, juros, date }],
              proximoVencimento: d.proximoVencimento ? addPeriodISO(d.proximoVencimento, d.frequencia) : d.proximoVencimento,
            }
          : d,
      ),
    })

  return (
    <div className="vault-screen">
      <div className="vault-top">
        <div>
          <h2 style={{ fontSize: 18 }}>🔒 Área particular</h2>
          <div className="muted" style={{ fontSize: 12 }}>Criptografado neste aparelho</div>
        </div>
        <button className="vault-x rel" onClick={onClose}>✕</button>
      </div>

      {/* Resumo */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="muted" style={{ fontSize: 12 }}>Total que você ainda deve</div>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.5 }}>{brl(totalDebt)}</div>
        <div className="row" style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <Mini k="Juros por mês" v={totalMonthInterest} cls="neg" bg="rgba(239,68,68,.12)" />
          <Mini k="🔥 Já queimei em juros" v={totalBurned} cls="" bg="rgba(245,158,11,.12)" />
        </div>
      </div>

      {/* Vencimentos */}
      {(dueWeek > 0 || perMonth > 0) && (
        <div className="card" style={{ marginTop: 12, fontSize: 13 }}>
          <div className="spread"><span className="muted">Vence nos próximos 7 dias</span><b className={dueWeek > 0 ? 'neg' : ''}>{brl(dueWeek)}</b></div>
          <div className="spread mt"><span className="muted">Por mês p/ manter em dia</span><b>{brl(perMonth)}</b></div>
        </div>
      )}

      {/* Consultoria */}
      {debts.length > 0 && (
        <div className="card" style={{ marginTop: 12, borderColor: 'rgba(91,140,255,.4)' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>💡 Plano pra quitar</div>
          {priority ? (
            <p style={{ fontSize: 13.5, lineHeight: 1.45 }}>
              Ataque primeiro <b>{priority.credor}</b> — é o juro mais alto
              (<b>{effRateMonthly(priority).toFixed(1)}%/mês</b> ≈ <b>{annualRate(effRateMonthly(priority)).toFixed(0)}%/ano</b>).
              É a dívida que mais cresce.
            </p>
          ) : (
            <p style={{ fontSize: 13.5 }}>Foque em abater o principal — sem juros, cada real pago te tira da dívida. 💪</p>
          )}
          <div className="vault-sim">
            <label>Quanto consegue pagar por mês (no total)?</label>
            <input inputMode="decimal" placeholder="R$ 0,00" value={budget} onChange={(e) => setBudget(e.target.value)} />
            {sim && (
              <div style={{ marginTop: 10, fontSize: 13.5, lineHeight: 1.5 }}>
                {sim.done ? <span className="pos">Tudo quitado! 🎉</span>
                  : sim.impossible ? (
                    <span className="neg">Esse valor não cobre nem os juros (≈ {brl(sim.minNeeded || 0)}/mês). A dívida só cresceria — tente um valor maior.</span>
                  ) : (
                    <>Pagando <b>{brl(parseNum(budget))}/mês</b>, quita tudo em <b>{sim.months} {sim.months === 1 ? 'mês' : 'meses'}</b>
                      {sim.months >= 12 && <> (~{Math.floor(sim.months / 12)}a {sim.months % 12}m)</>}, pagando <b className="neg">{brl(sim.interest)}</b> de juros no caminho.</>
                  )}
              </div>
            )}
          </div>
        </div>
      )}

      <button className="btn primary full mt" onClick={() => setAdding(true)}>+ Adicionar dívida</button>

      {/* Lista */}
      <div className="list" style={{ marginTop: 12 }}>
        {debts.length === 0 ? (
          <div className="empty"><div className="big">📒</div>Nenhuma dívida cadastrada aqui.</div>
        ) : (
          calc.map(({ d, s }) => (
            <DebtCard
              key={d.id} d={d} s={s}
              onPayInterest={() => setPaying({ debt: d, mode: 'juros' })}
              onPay={() => setPaying({ debt: d, mode: 'normal' })}
              onDelete={() => confirm2('Excluir esta dívida?') && delDebt(d.id)}
            />
          ))
        )}
      </div>

      {adding && <DebtForm onClose={() => setAdding(false)} onSave={(d) => { addDebt(d); setAdding(false) }} />}
      {paying && (
        <PaymentForm
          debt={paying.debt} mode={paying.mode}
          onClose={() => setPaying(null)}
          onSave={(pay) => { addPayment(paying.debt.id, pay); setPaying(null) }}
        />
      )}
    </div>
  )
}

function Mini({ k, v, cls, bg }) {
  return (
    <div style={{ flex: 1, background: bg, borderRadius: 12, padding: '10px 12px' }}>
      <div className="muted" style={{ fontSize: 11 }}>{k}</div>
      <div className={cls} style={{ fontWeight: 700, marginTop: 2 }}>{brl(v)}</div>
    </div>
  )
}

function juroLabel(d) {
  if (d.semJuros) return 'sem juros'
  const per = freqNoun(d.frequencia)
  return d.juroTipo === 'percent' ? `${d.juroPercent}%/${per}` : `${brl(d.juroValor)}/${per}`
}

function DebtCard({ d, s, onPayInterest, onPay, onDelete }) {
  const [open, setOpen] = useState(false)
  const pct = (s.principalPaid + s.balance) > 0 ? Math.round((s.principalPaid / (s.principalPaid + s.balance)) * 100) : 0
  const dn = d.proximoVencimento ? daysUntil(d.proximoVencimento) : null
  const payments = [...(d.payments || [])].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <div className="spread">
        <div>
          <div style={{ fontWeight: 700 }}>{d.credor}</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {juroLabel(d)}{!d.semJuros && d.juroTipo === 'percent' && ` · ${annualRate(effRateMonthly(d)).toFixed(0)}%/ano`}
          </div>
        </div>
        <div className="right">
          <div className={s.balance > 0 ? 'neg' : 'pos'} style={{ fontWeight: 800, fontSize: 18 }}>{brl(s.balance)}</div>
          <div className="muted" style={{ fontSize: 11 }}>{s.balance > 0 ? 'em aberto' : 'quitado ✓'}</div>
        </div>
      </div>

      <div className="bar"><div style={{ width: `${pct}%` }} /></div>
      <div className="spread" style={{ fontSize: 12, marginTop: 6 }}>
        <span className="muted">Abatido: {brl(s.principalPaid)} · juros pagos: {brl(s.interestPaid)}</span>
        {!s.semJuros && s.balance > 0 && <span className="muted">+{brl(s.perPeriodInterest)}/{freqNoun(d.frequencia)}</span>}
      </div>

      {/* Vencimento */}
      {d.proximoVencimento && s.balance > 0 && (
        <div style={{ marginTop: 8, fontSize: 12.5 }}>
          {dn < 0
            ? <span className="badge late">Atrasado {Math.abs(dn)}d</span>
            : dn === 0 ? <span className="badge soon">Vence hoje</span>
              : dn <= 3 ? <span className="badge soon">Vence em {dn}d</span>
                : <span className="badge ok">Vence em {dn}d</span>}
          <span className="muted"> · {formatDate(d.proximoVencimento)}{num(d.valorCombinado) > 0 && ` · combinado ${brl(d.valorCombinado)}`}</span>
        </div>
      )}
      {d.notes && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>📝 {d.notes}</div>}

      {/* Ações */}
      <div className="field-row" style={{ marginTop: 12 }}>
        {!s.semJuros && s.balance > 0 && <button className="btn" onClick={onPayInterest}>Pagar só os juros</button>}
        <button className="btn primary" onClick={onPay}>Registrar pagamento</button>
      </div>

      {/* Histórico */}
      {payments.length > 0 && (
        <details style={{ marginTop: 10 }} open={open} onToggle={(e) => setOpen(e.target.open)}>
          <summary className="muted" style={{ fontSize: 13, cursor: 'pointer' }}>{payments.length} pagamento(s)</summary>
          <div style={{ marginTop: 8 }}>
            {payments.map((p) => {
              const a = s.alloc[p.id] || { interest: 0, principal: 0 }
              return (
                <div className="spread" key={p.id} style={{ fontSize: 12.5, padding: '4px 0' }}>
                  <span className="muted">{formatDateShort(p.date)}</span>
                  <span>{brl(p.amount)} <span className="muted">({brl(a.interest)} juros · {brl(a.principal)} abateu)</span></span>
                </div>
              )
            })}
          </div>
        </details>
      )}

      <button className="del" style={{ marginTop: 8, fontSize: 13 }} onClick={onDelete}>🗑️ Excluir dívida</button>
    </div>
  )
}

// ---------------------------------------------------------------- formulários
function DebtForm({ onClose, onSave }) {
  const [credor, setCredor] = useState('')
  const [principal, setPrincipal] = useState('')
  const [semJuros, setSemJuros] = useState(false)
  const [juroTipo, setJuroTipo] = useState('valor') // valor | percent
  const [juro, setJuro] = useState('')
  const [frequencia, setFrequencia] = useState('mensal')
  const [valorCombinado, setValorCombinado] = useState('')
  const [proximoVencimento, setProximoVencimento] = useState(todayISO())
  const [notes, setNotes] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (!credor.trim()) return alert('Dê um nome/apelido ao credor.')
    const p = parseNum(principal)
    if (!(p > 0)) return alert('Informe quanto você deve hoje.')
    onSave({
      credor: credor.trim(),
      principal: p,
      semJuros,
      juroTipo: semJuros ? undefined : juroTipo,
      juroPercent: !semJuros && juroTipo === 'percent' ? parseNum(juro) : undefined,
      juroValor: !semJuros && juroTipo === 'valor' ? parseNum(juro) : undefined,
      frequencia,
      valorCombinado: parseNum(valorCombinado),
      proximoVencimento: proximoVencimento || null,
      asOf: todayISO(),
      notes: notes.trim(),
    })
  }

  const per = freqNoun(frequencia)
  return (
    <Overlay title="Nova dívida" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label>Credor (apelido)</label>
          <input placeholder="Ex.: Betinho, Fernando..." value={credor} onChange={(e) => setCredor(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label>Quanto você deve hoje</label>
          <input inputMode="decimal" placeholder="0,00" value={principal} onChange={(e) => setPrincipal(e.target.value)} />
        </div>

        <div className="field">
          <label>Frequência (pagamento e juros)</label>
          <select value={frequencia} onChange={(e) => setFrequencia(e.target.value)}>
            <option value="mensal">Mensal</option>
            <option value="quinzenal">Quinzenal (a cada 15 dias)</option>
            <option value="semanal">Semanal</option>
          </select>
        </div>

        <label className="spread" style={{ background: 'var(--card)', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)', marginBottom: 14 }}>
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>Sem juros
            <div className="muted" style={{ fontWeight: 400, fontSize: 12, marginTop: 2 }}>Tipo Fernando — todo pagamento abate direto</div>
          </span>
          <input type="checkbox" checked={semJuros} onChange={(e) => setSemJuros(e.target.checked)} style={{ width: 22, height: 22, flex: 'none' }} />
        </label>

        {!semJuros && (
          <>
            <div className="toggle">
              <button type="button" className={juroTipo === 'valor' ? 'on-ganho' : ''} onClick={() => setJuroTipo('valor')}>R$ fixo</button>
              <button type="button" className={juroTipo === 'percent' ? 'on-ganho' : ''} onClick={() => setJuroTipo('percent')}>Porcentagem</button>
            </div>
            <div className="field">
              <label>{juroTipo === 'percent' ? `Juros (% por ${per})` : `Juros (R$ por ${per})`}</label>
              <input inputMode="decimal" placeholder={juroTipo === 'percent' ? 'Ex.: 20' : 'Ex.: 400'} value={juro} onChange={(e) => setJuro(e.target.value)} />
            </div>
          </>
        )}

        <div className="field-row">
          <div className="field">
            <label>Valor combinado por vez</label>
            <input inputMode="decimal" placeholder="Opcional" value={valorCombinado} onChange={(e) => setValorCombinado(e.target.value)} />
          </div>
          <div className="field">
            <label>Próximo vencimento</label>
            <input type="date" value={proximoVencimento} onChange={(e) => setProximoVencimento(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label>Observações (opcional)</label>
          <input placeholder="Ex.: pago toda sexta" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <button type="submit" className="btn primary full">Salvar dívida</button>
      </form>
    </Overlay>
  )
}

function PaymentForm({ debt, mode, onClose, onSave }) {
  const fmt = (n) => (n ? String(Number(n).toFixed(2)).replace('.', ',') : '')
  const periodJuros = perPeriodInterest(debt)
  const [juros, setJuros] = useState(debt.semJuros ? '0' : fmt(periodJuros))
  const [amount, setAmount] = useState(mode === 'juros' ? fmt(periodJuros) : '')
  const [date, setDate] = useState(todayISO())

  const jurosN = debt.semJuros ? 0 : parseNum(juros)
  const abate = Math.max(0, parseNum(amount) - jurosN)

  const submit = (e) => {
    e.preventDefault()
    const a = parseNum(amount)
    if (!(a > 0)) return alert('Informe o valor pago.')
    if (jurosN > a) return alert('O juros não pode ser maior que o valor pago.')
    onSave({ amount: a, juros: jurosN, date })
  }

  return (
    <Overlay title={`${mode === 'juros' ? 'Pagar juros' : 'Pagamento'} · ${debt.credor}`} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label>Valor total pago</label>
          <input className="amount-input" inputMode="decimal" placeholder="R$ 0,00" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </div>
        {!debt.semJuros && (
          <div className="field">
            <label>Quanto desse valor é juros?</label>
            <input inputMode="decimal" placeholder="0,00" value={juros} onChange={(e) => setJuros(e.target.value)} />
          </div>
        )}
        <div className="card" style={{ fontSize: 13, marginBottom: 14 }}>
          <div className="spread"><span className="muted">Juros (não abate)</span><span>{brl(jurosN)}</span></div>
          <div className="spread mt"><span className="muted">Abate da dívida</span><span className="pos">{brl(abate)}</span></div>
        </div>
        <div className="field">
          <label>Data</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <button type="submit" className="btn primary full">Registrar</button>
      </form>
    </Overlay>
  )
}

function Overlay({ title, onClose, children }) {
  return (
    <div className="overlay" onClick={onClose} style={{ zIndex: 80 }}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grip" />
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}
