import { useState } from 'react'
import { vaultExists, createVault, openVault, saveVault, destroyVault } from '../lib/vault'
import { currentBalance, totalPaid, monthlyInterest, annualRate, simulatePayoff } from '../lib/debt'
import { brl, todayISO, formatDate, uid } from '../lib/format'

const parseNum = (s) => {
  const n = parseFloat(String(s).replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

export default function Vault({ onClose }) {
  const [data, setData] = useState(null) // dados descriptografados (null = trancado)
  const [pin, setPin] = useState('') // senha em memória enquanto aberto

  if (!data) return <Unlock onClose={onClose} onOpen={(d, p) => { setData(d); setPin(p) }} />

  // Persiste (cifra) a cada alteração.
  const update = (next) => {
    setData(next)
    saveVault(pin, next)
  }

  return <VaultHome data={data} update={update} onClose={onClose} />
}

// ----------------------------------------------------------------------------
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
        const d = await createVault(pin)
        onOpen(d, pin)
      }
    } catch {
      setBusy(false)
      setErr('Não foi possível abrir (precisa de https ou localhost).')
    }
  }

  const reset = () => {
    if (confirm2('⚠️ Esquecer a senha APAGA tudo da área particular (não dá pra recuperar). Continuar?')) {
      destroyVault()
      setErr('Área apagada. Crie uma nova senha.')
      location.reload()
    }
  }

  return (
    <div className="vault-screen">
      <button className="vault-x" onClick={onClose}>✕</button>
      <div className="vault-lock">
        <div className="vault-emoji">🔒</div>
        <h2>Área particular</h2>
        <p className="muted" style={{ fontSize: 13, textAlign: 'center', marginBottom: 18 }}>
          {exists
            ? 'Digite sua senha para acessar.'
            : 'Crie uma senha. Os dados ficam criptografados — sem ela, ninguém vê.'}
        </p>
        <form onSubmit={submit}>
          <input
            type="password" inputMode="numeric" autoFocus placeholder="Senha"
            value={pin} onChange={(e) => setPin(e.target.value)} className="amount-input"
            style={{ letterSpacing: 4 }}
          />
          {!exists && (
            <input
              type="password" inputMode="numeric" placeholder="Confirmar senha"
              value={confirm} onChange={(e) => setConfirm(e.target.value)} style={{ marginTop: 10 }}
            />
          )}
          {err && <div className="vault-err">{err}</div>}
          <button type="submit" className="btn primary full mt" disabled={busy}>
            {busy ? '...' : exists ? 'Entrar' : 'Criar área particular'}
          </button>
        </form>
        {exists && (
          <button className="btn ghost full mt" style={{ fontSize: 12 }} onClick={reset}>
            Esqueci a senha (apaga tudo)
          </button>
        )}
      </div>
    </div>
  )
}

// confirm com fallback (alguns navegadores em modo app)
function confirm2(msg) { return window.confirm(msg) }

// ----------------------------------------------------------------------------
function VaultHome({ data, update, onClose }) {
  const [adding, setAdding] = useState(false)
  const [paying, setPaying] = useState(null)
  const [budget, setBudget] = useState('')

  const debts = data.debts || []
  const totalDebt = debts.reduce((s, d) => s + currentBalance(d), 0)
  const totalMonthInterest = debts.reduce((s, d) => s + monthlyInterest(d), 0)
  const totalPago = debts.reduce((s, d) => s + totalPaid(d), 0)
  const priority = [...debts].filter((d) => currentBalance(d) > 0).sort((a, b) => b.rate - a.rate)[0]

  const sim = budget ? simulatePayoff(debts, parseNum(budget)) : null

  const addDebt = (d) => update({ ...data, debts: [...debts, { ...d, id: uid(), payments: [] }] })
  const delDebt = (id) => update({ ...data, debts: debts.filter((d) => d.id !== id) })
  const addPayment = (debtId, amount, date) =>
    update({
      ...data,
      debts: debts.map((d) =>
        d.id === debtId ? { ...d, payments: [...(d.payments || []), { id: uid(), amount, date }] } : d,
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
          <div style={{ flex: 1, background: 'rgba(239,68,68,.12)', borderRadius: 12, padding: '10px 12px' }}>
            <div className="muted" style={{ fontSize: 11 }}>Juros por mês</div>
            <div className="neg" style={{ fontWeight: 700, marginTop: 2 }}>{brl(totalMonthInterest)}</div>
          </div>
          <div style={{ flex: 1, background: 'rgba(34,197,94,.12)', borderRadius: 12, padding: '10px 12px' }}>
            <div className="muted" style={{ fontSize: 11 }}>Já pago</div>
            <div className="pos" style={{ fontWeight: 700, marginTop: 2 }}>{brl(totalPago)}</div>
          </div>
        </div>
      </div>

      {/* Consultoria */}
      {debts.length > 0 && (
        <div className="card" style={{ marginTop: 12, borderColor: 'rgba(91,140,255,.4)' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>💡 Plano pra quitar</div>
          {priority && (
            <p style={{ fontSize: 13.5, lineHeight: 1.45 }}>
              Ataque primeiro <b>{priority.credor}</b> — é o juro mais alto
              (<b>{priority.rate}%/mês</b>, ou seja <b>{annualRate(priority.rate).toFixed(0)}% ao ano</b>).
              Cada mês que passa, essa é a dívida que mais cresce.
            </p>
          )}
          <div className="vault-sim">
            <label>Quanto você consegue pagar por mês (no total)?</label>
            <input inputMode="decimal" placeholder="R$ 0,00" value={budget} onChange={(e) => setBudget(e.target.value)} />
            {sim && (
              <div style={{ marginTop: 10, fontSize: 13.5, lineHeight: 1.5 }}>
                {sim.done ? (
                  <span className="pos">Tudo quitado! 🎉</span>
                ) : sim.impossible ? (
                  <span className="neg">
                    Esse valor não cobre nem os juros (≈ {brl(sim.minNeeded || 0)}/mês). A dívida só cresceria —
                    tente um valor maior.
                  </span>
                ) : (
                  <>
                    Pagando <b>{brl(parseNum(budget))}/mês</b>, você quita tudo em{' '}
                    <b>{sim.months} {sim.months === 1 ? 'mês' : 'meses'}</b>
                    {sim.months >= 12 && <> (~{Math.floor(sim.months / 12)}a {sim.months % 12}m)</>}, pagando{' '}
                    <b className="neg">{brl(sim.interest)}</b> só de juros no caminho.
                  </>
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
          debts.map((d) => {
            const bal = currentBalance(d)
            const pago = totalPaid(d)
            const pct = (pago + bal) > 0 ? Math.round((pago / (pago + bal)) * 100) : 0
            return (
              <div className="card" key={d.id} style={{ marginBottom: 0 }}>
                <div className="spread">
                  <div>
                    <div style={{ fontWeight: 700 }}>{d.credor}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {d.rate}%/mês · {annualRate(d.rate).toFixed(0)}%/ano
                    </div>
                  </div>
                  <div className="right">
                    <div className={bal > 0 ? 'neg' : 'pos'} style={{ fontWeight: 800, fontSize: 18 }}>{brl(bal)}</div>
                    <div className="muted" style={{ fontSize: 11 }}>{bal > 0 ? 'em aberto' : 'quitado ✓'}</div>
                  </div>
                </div>
                <div className="bar"><div style={{ width: `${pct}%` }} /></div>
                <div className="spread" style={{ fontSize: 12, marginTop: 6 }}>
                  <span className="muted">Pago: {brl(pago)}</span>
                  <span className="muted">+{brl(monthlyInterest(d))}/mês de juros</span>
                </div>
                {d.notes && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>📝 {d.notes}</div>}
                <div className="field-row" style={{ marginTop: 12 }}>
                  <button className="btn primary" onClick={() => setPaying(d)}>Registrar pagamento</button>
                  <button className="btn danger" onClick={() => confirm2('Excluir esta dívida?') && delDebt(d.id)}>Excluir</button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {adding && <DebtForm onClose={() => setAdding(false)} onSave={(d) => { addDebt(d); setAdding(false) }} />}
      {paying && (
        <PaymentForm
          debt={paying}
          onClose={() => setPaying(null)}
          onSave={(amount, date) => { addPayment(paying.id, amount, date); setPaying(null) }}
        />
      )}
    </div>
  )
}

// ----------------------------------------------------------------------------
function DebtForm({ onClose, onSave }) {
  const [credor, setCredor] = useState('')
  const [balance0, setBalance0] = useState('')
  const [rate, setRate] = useState('')
  const [asOf, setAsOf] = useState(todayISO())
  const [notes, setNotes] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (!credor.trim()) return alert('Dê um nome/apelido ao credor.')
    const b = parseNum(balance0)
    if (!(b > 0)) return alert('Informe quanto você deve hoje.')
    onSave({ credor: credor.trim(), balance0: b, rate: parseNum(rate), asOf, notes: notes.trim() })
  }

  return (
    <Overlay title="Nova dívida" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label>Credor (apelido)</label>
          <input placeholder="Ex.: João, Zé do bairro..." value={credor} onChange={(e) => setCredor(e.target.value)} autoFocus />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Quanto deve hoje</label>
            <input inputMode="decimal" placeholder="0,00" value={balance0} onChange={(e) => setBalance0(e.target.value)} />
          </div>
          <div className="field">
            <label>Juros (% ao mês)</label>
            <input inputMode="decimal" placeholder="Ex.: 20" value={rate} onChange={(e) => setRate(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Saldo registrado em</label>
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </div>
        <div className="field">
          <label>Observações (opcional)</label>
          <input placeholder="Ex.: combinado pagar toda sexta" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <button type="submit" className="btn primary full">Salvar dívida</button>
      </form>
    </Overlay>
  )
}

function PaymentForm({ debt, onClose, onSave }) {
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const submit = (e) => {
    e.preventDefault()
    const a = parseNum(amount)
    if (!(a > 0)) return alert('Informe o valor pago.')
    onSave(a, date)
  }
  return (
    <Overlay title={`Pagamento · ${debt.credor}`} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <input className="amount-input" inputMode="decimal" placeholder="R$ 0,00" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label>Data</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <button type="submit" className="btn primary full">Registrar pagamento</button>
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
