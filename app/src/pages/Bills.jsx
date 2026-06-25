import { useState } from 'react'
import { useStore, openBills, categoryById, accountById, activeInstallments, installmentStatus } from '../store'
import { brl, formatDate, daysUntil, todayISO } from '../lib/format'
import Sheet from '../components/Sheet'
import Calendar from './Calendar'
import Recurrences from '../components/Recurrences'

export default function Bills() {
  const { state, dispatch } = useStore()
  const [adding, setAdding] = useState(false)
  const [addingInst, setAddingInst] = useState(false)
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

      {/* Parcelados */}
      <div className="section-title" style={{ marginTop: 22 }}>Parcelados</div>
      <p className="muted" style={{ fontSize: 12.5, margin: '0 4px 10px' }}>
        Pensão, financiamento, compras parceladas — acompanhe quantas parcelas faltam.
      </p>
      <button className="btn full" onClick={() => setAddingInst(true)}>+ Novo parcelado</button>
      <div className="list" style={{ marginTop: 12 }}>
        {activeInstallments(state).length === 0 ? (
          <div className="empty" style={{ padding: 24 }}>Nenhum parcelado em andamento.</div>
        ) : (
          activeInstallments(state).map((inst) => (
            <InstallmentCard
              key={inst.id} inst={inst}
              onDelete={() => confirm('Excluir este parcelado?') && dispatch({ type: 'DELETE_INSTALLMENT', id: inst.id })}
            />
          ))
        )}
      </div>
      </>
      )}

      {adding && <BillForm onClose={() => setAdding(false)} />}
      {addingInst && <InstallmentForm onClose={() => setAddingInst(false)} />}
    </div>
  )
}

function InstallmentCard({ inst, onDelete }) {
  const { state } = useStore()
  const st = installmentStatus(inst)
  const cat = categoryById(state, inst.categoryId)
  const where = inst.target === 'cartao' ? accountById(state, inst.cardId)?.name : accountById(state, inst.accountId)?.name
  const pct = Math.round((st.pagas / st.total) * 100)
  const d = daysUntil(st.nextDue)
  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <div className="spread">
        <div>
          <div style={{ fontWeight: 700 }}>{inst.description} {inst.target === 'cartao' && <span className="badge ok">💳</span>}</div>
          <div className="muted" style={{ fontSize: 12 }}>{cat?.name || 'Sem categoria'}{where ? ` · ${where}` : ''}</div>
        </div>
        <div className="right">
          <div className="amt neg">{brl(inst.installmentValue)}</div>
          <div className="muted" style={{ fontSize: 11 }}>por parcela</div>
        </div>
      </div>
      <div className="bar"><div style={{ width: `${pct}%` }} /></div>
      <div className="spread" style={{ fontSize: 12.5, marginTop: 6 }}>
        <span><b>Parcela {st.current} de {st.total}</b> · faltam {st.restantes}</span>
        <span className="muted">restam {brl(st.totalRestante)}</span>
      </div>
      <div className="spread" style={{ marginTop: 6, fontSize: 12 }}>
        <span className="muted">
          Próxima: {formatDate(st.nextDue)}{' '}
          {d < 0 ? <span className="badge late">atrasada</span> : d <= 5 ? <span className="badge soon">em {d}d</span> : <span className="badge ok">em {d}d</span>}
        </span>
        <button className="del" style={{ fontSize: 12 }} onClick={onDelete}>🗑️</button>
      </div>
    </div>
  )
}

export function InstallmentForm({ onClose }) {
  const { state, dispatch } = useStore()
  const cards = state.accounts.filter((a) => a.type === 'cartao')
  const nonCards = state.accounts.filter((a) => a.type !== 'cartao')
  const [description, setDescription] = useState('')
  const [installmentValue, setInstallmentValue] = useState('')
  const [totalInstallments, setTotalInstallments] = useState('')
  const [firstDate, setFirstDate] = useState(todayISO())
  const [categoryId, setCategoryId] = useState('')
  const [target, setTarget] = useState(cards.length ? 'cartao' : 'conta')
  const [cardId, setCardId] = useState(cards[0]?.id || '')
  const [accountId, setAccountId] = useState(nonCards[0]?.id || '')

  const parse = (s) => { const n = parseFloat(String(s).replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0 }

  const submit = (e) => {
    e.preventDefault()
    if (!description.trim()) return alert('Dê um nome ao parcelado.')
    const v = parse(installmentValue)
    const tot = parseInt(totalInstallments, 10)
    if (!(v > 0)) return alert('Informe o valor da parcela.')
    if (!(tot > 0)) return alert('Informe o total de parcelas.')
    dispatch({
      type: 'ADD_INSTALLMENT',
      payload: {
        description: description.trim(), installmentValue: v, totalInstallments: tot,
        firstDate, categoryId, target,
        cardId: target === 'cartao' ? cardId : undefined,
        accountId: target === 'conta' ? accountId : undefined,
      },
    })
    onClose()
  }

  return (
    <Sheet title="Novo parcelado" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label>O que é</label>
          <input placeholder="Ex.: Financiamento carro, Pensão, Sofá 10x" value={description} onChange={(e) => setDescription(e.target.value)} autoFocus />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Valor da parcela</label>
            <input inputMode="decimal" placeholder="0,00" value={installmentValue} onChange={(e) => setInstallmentValue(e.target.value)} />
          </div>
          <div className="field">
            <label>Total de parcelas</label>
            <input type="number" min="1" placeholder="Ex.: 48" value={totalInstallments} onChange={(e) => setTotalInstallments(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Data da 1ª parcela</label>
          <input type="date" value={firstDate} onChange={(e) => setFirstDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Categoria</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Sem categoria</option>
            {state.categories.filter((c) => c.type === 'gasto').map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Como você paga</label>
          <div className="toggle" style={{ marginBottom: 0 }}>
            <button type="button" className={target === 'cartao' ? 'on-gasto' : ''} onClick={() => setTarget('cartao')} disabled={!cards.length}>💳 No cartão</button>
            <button type="button" className={target === 'conta' ? 'on-ganho' : ''} onClick={() => setTarget('conta')}>🏦 Conta/boleto</button>
          </div>
        </div>
        {target === 'cartao' ? (
          <div className="field">
            <label>Cartão (entra na fatura)</label>
            {cards.length ? (
              <select value={cardId} onChange={(e) => setCardId(e.target.value)}>
                {cards.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            ) : <p className="muted" style={{ fontSize: 12 }}>Cadastre um cartão na aba Contas primeiro.</p>}
          </div>
        ) : (
          <div className="field">
            <label>Conta</label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {nonCards.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        )}
        <button type="submit" className="btn primary full">Salvar parcelado</button>
      </form>
    </Sheet>
  )
}

export function BillForm({ onClose }) {
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
