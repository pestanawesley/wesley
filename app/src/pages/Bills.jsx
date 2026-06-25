import { useState } from 'react'
import { useStore, openBills, categoryById } from '../store'
import { brl, formatDate, daysUntil, todayISO } from '../lib/format'
import Sheet from '../components/Sheet'
import Calendar from './Calendar'
import Recurrences from '../components/Recurrences'

export default function Bills() {
  const { state, dispatch } = useStore()
  const [adding, setAdding] = useState(false)
  const [view, setView] = useState('lista') // lista | calendario
  const [showRec, setShowRec] = useState(false)

  const bills = openBills(state)
  const toPay = bills.filter((b) => b.type === 'pagar').reduce((s, b) => s + b.amount, 0)
  const toReceive = bills.filter((b) => b.type === 'receber').reduce((s, b) => s + b.amount, 0)

  const settle = (b) => {
    if (confirm(`Marcar "${b.description}" como ${b.type === 'pagar' ? 'paga' : 'recebida'}? Vai virar um lançamento real.`)) {
      dispatch({ type: 'SETTLE_BILL', id: b.id })
    }
  }

  return (
    <div>
      <div className="spread" style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>Contas futuras</h1>
        <button className="chip" onClick={() => setShowRec(true)}>🔁 Recorrentes</button>
      </div>

      <div className="toggle">
        <button type="button" className={view === 'lista' ? 'on-ganho' : ''} onClick={() => setView('lista')}>📋 Lista</button>
        <button type="button" className={view === 'calendario' ? 'on-ganho' : ''} onClick={() => setView('calendario')}>📅 Calendário</button>
      </div>

      {showRec && (
        <Sheet title="Recorrentes" onClose={() => setShowRec(false)}>
          <Recurrences />
        </Sheet>
      )}

      {view === 'calendario' ? (
        <Calendar />
      ) : (
      <>
      <div className="grid-2">
        <div className="stat"><div className="k">📥 A receber</div><div className="v pos">{brl(toReceive)}</div></div>
        <div className="stat"><div className="k">📤 A pagar</div><div className="v neg">{brl(toPay)}</div></div>
      </div>

      <button className="btn primary full mt" onClick={() => setAdding(true)}>+ Nova conta futura</button>

      <div className="list" style={{ marginTop: 14 }}>
        {bills.length === 0 ? (
          <div className="empty"><div className="big">📅</div>Nenhuma conta agendada.<br />Cadastre boletos, assinaturas ou valores a receber.</div>
        ) : (
          bills.map((b) => {
            const cat = categoryById(state, b.categoryId)
            const d = daysUntil(b.dueDate)
            const badge = d < 0
              ? <span className="badge late">Atrasada {Math.abs(d)}d</span>
              : d === 0
                ? <span className="badge soon">Vence hoje</span>
                : d <= 5
                  ? <span className="badge soon">Em {d}d</span>
                  : <span className="badge ok">Em {d}d</span>
            return (
              <div className="item" key={b.id}>
                <div className="ic" style={{ background: (b.type === 'pagar' ? '#ef4444' : '#22c55e') + '22' }}>
                  {b.type === 'pagar' ? '📤' : '📥'}
                </div>
                <div className="body">
                  <div className="t">{b.description} {b.recurrenceId && <span className="badge ok">🔁</span>}</div>
                  <div className="s">{formatDate(b.dueDate)} · {cat?.name || 'Sem categoria'} {badge}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <div className={`amt ${b.type === 'receber' ? 'pos' : 'neg'}`}>{brl(b.amount)}</div>
                  <button className="chip" onClick={() => settle(b)}>✓ {b.type === 'pagar' ? 'Paguei' : 'Recebi'}</button>
                </div>
              </div>
            )
          })
        )}
      </div>
      </>
      )}

      {adding && <BillForm onClose={() => setAdding(false)} />}
    </div>
  )
}

function BillForm({ onClose }) {
  const { state, dispatch } = useStore()
  const [type, setType] = useState('pagar')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState(todayISO())
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState(state.accounts[0]?.id || '')

  const cats = state.categories.filter((c) => c.type === (type === 'pagar' ? 'gasto' : 'ganho'))

  const submit = (e) => {
    e.preventDefault()
    const value = parseFloat(String(amount).replace(/\./g, '').replace(',', '.'))
    if (!(value > 0)) return alert('Informe um valor.')
    if (!description.trim()) return alert('Dê um nome à conta.')
    dispatch({
      type: 'ADD_BILL',
      payload: { type, description: description.trim(), amount: value, dueDate, categoryId, accountId, status: 'pendente' },
    })
    onClose()
  }

  return (
    <Sheet title="Nova conta futura" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="toggle">
          <button type="button" className={type === 'pagar' ? 'on-gasto' : ''} onClick={() => { setType('pagar'); setCategoryId('') }}>📤 A pagar</button>
          <button type="button" className={type === 'receber' ? 'on-ganho' : ''} onClick={() => { setType('receber'); setCategoryId('') }}>📥 A receber</button>
        </div>
        <div className="field">
          <label>Descrição</label>
          <input placeholder="Ex.: Aluguel, Netflix, Salário..." value={description} onChange={(e) => setDescription(e.target.value)} autoFocus />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Valor</label>
            <input inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="field">
            <label>Vencimento</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Categoria</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Sem categoria</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Conta (quando quitar)</label>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {state.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <button type="submit" className="btn primary full">Agendar conta</button>
      </form>
    </Sheet>
  )
}
