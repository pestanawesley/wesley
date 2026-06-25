import { useState } from 'react'
import { useStore } from '../store'
import { brl, formatDate } from '../lib/format'
import Sheet from '../components/Sheet'

export default function Goals() {
  const { state, dispatch } = useStore()
  const [adding, setAdding] = useState(false)
  const [contrib, setContrib] = useState(null)

  return (
    <div>
      <div className="topbar"><h1>Metas & Objetivos</h1></div>
      <p className="muted" style={{ fontSize: 13, margin: '0 4px 14px' }}>
        Defina objetivos (reserva de emergência, viagem, carro) e acompanhe o quanto já guardou.
      </p>

      <button className="btn primary full" onClick={() => setAdding(true)}>+ Nova meta</button>

      <div className="list" style={{ marginTop: 14 }}>
        {state.goals.length === 0 ? (
          <div className="empty"><div className="big">🎯</div>Nenhuma meta ainda.<br />Comece pela reserva de emergência!</div>
        ) : (
          state.goals.map((g) => {
            const pct = g.target ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0
            return (
              <div className="card" key={g.id}>
                <div className="spread">
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 24 }}>{g.icon || '🎯'}</span>
                    <div>
                      <div style={{ fontWeight: 700 }}>{g.name}</div>
                      {g.deadline && <div className="muted" style={{ fontSize: 12 }}>até {formatDate(g.deadline)}</div>}
                    </div>
                  </div>
                  <button className="del" onClick={() => confirm('Excluir meta?') && dispatch({ type: 'DELETE_GOAL', id: g.id })}>🗑️</button>
                </div>
                <div className="bar"><div style={{ width: `${pct}%` }} /></div>
                <div className="spread" style={{ marginTop: 8, fontSize: 13 }}>
                  <span><b>{brl(g.saved)}</b> <span className="muted">de {brl(g.target)}</span></span>
                  <span className="muted">{pct}%</span>
                </div>
                <button className="btn full mt" onClick={() => setContrib(g)}>＋ Guardar dinheiro</button>
              </div>
            )
          })
        )}
      </div>

      {adding && <GoalForm onClose={() => setAdding(false)} />}
      {contrib && <ContribForm goal={contrib} onClose={() => setContrib(null)} />}
    </div>
  )
}

function GoalForm({ onClose }) {
  const { dispatch } = useStore()
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [deadline, setDeadline] = useState('')
  const [icon, setIcon] = useState('🎯')
  const icons = ['🎯', '🛟', '✈️', '🚗', '🏠', '💍', '🎓', '💻', '🏖️', '👶']

  const submit = (e) => {
    e.preventDefault()
    const value = parseFloat(String(target).replace(/\./g, '').replace(',', '.'))
    if (!name.trim()) return alert('Dê um nome à meta.')
    if (!(value > 0)) return alert('Informe o valor alvo.')
    dispatch({ type: 'ADD_GOAL', payload: { name: name.trim(), target: value, deadline: deadline || null, icon } })
    onClose()
  }

  return (
    <Sheet title="Nova meta" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label>Ícone</label>
          <div className="chips">
            {icons.map((i) => (
              <button type="button" key={i} className={`chip ${icon === i ? 'active' : ''}`} onClick={() => setIcon(i)} style={{ fontSize: 18 }}>{i}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Nome da meta</label>
          <input placeholder="Ex.: Reserva de emergência" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Quanto quer juntar</label>
            <input inputMode="decimal" placeholder="0,00" value={target} onChange={(e) => setTarget(e.target.value)} />
          </div>
          <div className="field">
            <label>Prazo (opcional)</label>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
        </div>
        <button type="submit" className="btn primary full">Criar meta</button>
      </form>
    </Sheet>
  )
}

function ContribForm({ goal, onClose }) {
  const { dispatch } = useStore()
  const [amount, setAmount] = useState('')
  const submit = (e) => {
    e.preventDefault()
    const value = parseFloat(String(amount).replace(/\./g, '').replace(',', '.'))
    if (!(value > 0)) return alert('Informe um valor.')
    dispatch({ type: 'CONTRIBUTE_GOAL', id: goal.id, amount: value })
    onClose()
  }
  return (
    <Sheet title={`Guardar em "${goal.name}"`} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <input className="amount-input" inputMode="decimal" placeholder="R$ 0,00" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </div>
        <button type="submit" className="btn primary full">Guardar</button>
      </form>
    </Sheet>
  )
}
