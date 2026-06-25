import { useState } from 'react'
import { useStore, categoryById } from '../store'
import { brl, todayISO } from '../lib/format'

// Gerencia lançamentos recorrentes. Renderizado dentro de um Sheet.
export default function Recurrences() {
  const { state, dispatch } = useStore()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)

  return (
    <div>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
        Cadastre o que se repete todo mês (salário, aluguel, assinaturas). O app gera
        as contas/lançamentos automaticamente nas datas certas. Toque pra editar.
      </p>

      {!adding && !editing && (
        <button className="btn primary full" onClick={() => setAdding(true)}>+ Novo recorrente</button>
      )}

      {(adding || editing) && <RecForm editing={editing} onClose={() => { setAdding(false); setEditing(null) }} />}

      <div className="list" style={{ marginTop: 14 }}>
        {state.recurrences.length === 0 ? (
          <div className="empty"><div className="big">🔁</div>Nenhum recorrente ainda.</div>
        ) : (
          state.recurrences.map((r) => {
            const cat = categoryById(state, r.categoryId)
            return (
              <div className="item" key={r.id} style={{ cursor: 'pointer' }} onClick={() => setEditing(r)}>
                <div className="ic" style={{ background: (r.type === 'ganho' ? '#22c55e' : '#ef4444') + '22' }}>
                  {r.type === 'ganho' ? '📥' : '📤'}
                </div>
                <div className="body">
                  <div className="t">{r.description} {r.linkMinWage && <span className="badge ok">💡 mín.</span>}</div>
                  <div className="s">
                    Todo dia {r.dayOfMonth} · {cat?.name || 'Sem categoria'}
                    {r.autoConfirm ? ' · auto' : ' · confirmar'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className={`amt ${r.type === 'ganho' ? 'pos' : 'neg'}`}>{brl(r.amount)}</div>
                  <button className="del" onClick={(e) => { e.stopPropagation(); confirm('Excluir recorrente? (não apaga o que já foi gerado)') && dispatch({ type: 'DELETE_RECURRENCE', id: r.id }) }}>🗑️</button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function RecForm({ onClose, editing }) {
  const { state, dispatch } = useStore()
  const fmt = (n) => (n ? String(Number(n)).replace('.', ',') : '')
  const [type, setType] = useState(editing?.type || 'gasto')
  const [description, setDescription] = useState(editing?.description || '')
  const [amount, setAmount] = useState(editing ? fmt(editing.amount) : '')
  const [dayOfMonth, setDayOfMonth] = useState(editing ? String(editing.dayOfMonth) : '5')
  const [categoryId, setCategoryId] = useState(editing?.categoryId || '')
  const [accountId, setAccountId] = useState(editing?.accountId || state.accounts[0]?.id || '')
  const [autoConfirm, setAutoConfirm] = useState(editing?.autoConfirm ?? false)

  const cats = state.categories.filter((c) => c.type === type)

  const submit = (e) => {
    e.preventDefault()
    const value = parseFloat(String(amount).replace(/\./g, '').replace(',', '.'))
    const day = Math.min(31, Math.max(1, parseInt(dayOfMonth, 10) || 1))
    if (!description.trim()) return alert('Dê um nome.')
    if (!(value > 0)) return alert('Informe o valor.')
    if (editing) {
      dispatch({ type: 'UPDATE_RECURRENCE', payload: { id: editing.id, type, description: description.trim(), amount: value, dayOfMonth: day, categoryId, accountId, autoConfirm } })
    } else {
      dispatch({
        type: 'ADD_RECURRENCE',
        payload: {
          type, description: description.trim(), amount: value, dayOfMonth: day,
          categoryId, accountId, startDate: todayISO(), active: true, autoConfirm,
        },
      })
    }
    // Gera imediatamente as ocorrências pendentes.
    setTimeout(() => dispatch({ type: 'MATERIALIZE' }), 0)
    onClose()
  }

  return (
    <form onSubmit={submit} className="card" style={{ marginBottom: 14 }}>
      <div className="toggle">
        <button type="button" className={type === 'gasto' ? 'on-gasto' : ''} onClick={() => { setType('gasto'); setCategoryId('') }}>📤 Gasto fixo</button>
        <button type="button" className={type === 'ganho' ? 'on-ganho' : ''} onClick={() => { setType('ganho'); setCategoryId('') }}>📥 Renda fixa</button>
      </div>
      <div className="field">
        <label>Descrição</label>
        <input placeholder="Ex.: Salário, Aluguel, Netflix..." value={description} onChange={(e) => setDescription(e.target.value)} autoFocus />
      </div>
      <div className="field-row">
        <div className="field">
          <label>Valor</label>
          <input inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="field">
          <label>Dia do mês</label>
          <input type="number" min="1" max="31" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} />
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
        <label>Conta</label>
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {state.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <label className="spread" style={{ background: 'var(--card)', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)', marginBottom: 14 }}>
        <span style={{ color: 'var(--text)', fontWeight: 600 }}>
          Lançar automático
          <div className="muted" style={{ fontWeight: 400, fontSize: 12, marginTop: 2 }}>
            {autoConfirm ? 'Entra direto como realizado' : 'Vira conta pendente p/ você confirmar'}
          </div>
        </span>
        <input type="checkbox" checked={autoConfirm} onChange={(e) => setAutoConfirm(e.target.checked)} style={{ width: 22, height: 22, flex: 'none' }} />
      </label>
      <div className="field-row">
        <button type="button" className="btn" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn primary">{editing ? 'Salvar alterações' : 'Salvar'}</button>
      </div>
    </form>
  )
}
