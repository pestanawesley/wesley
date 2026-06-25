import { useState } from 'react'
import { useStore } from '../store'
import { todayISO } from '../lib/format'

// Transferência entre contas: não conta como gasto nem ganho.
export default function TransferForm({ onDone }) {
  const { state, dispatch } = useStore()
  const [amount, setAmount] = useState('')
  const [fromId, setFromId] = useState(state.accounts[0]?.id || '')
  const [toId, setToId] = useState(state.accounts[1]?.id || state.accounts[0]?.id || '')
  const [date, setDate] = useState(todayISO())
  const [description, setDescription] = useState('')

  const submit = (e) => {
    e.preventDefault()
    const value = parseFloat(String(amount).replace(/\./g, '').replace(',', '.'))
    if (!(value > 0)) return alert('Informe um valor.')
    if (fromId === toId) return alert('Escolha contas diferentes.')
    dispatch({
      type: 'ADD_TX',
      payload: {
        type: 'transferencia', amount: value, accountId: fromId, toAccountId: toId,
        date, description: description.trim() || 'Transferência',
      },
    })
    onDone?.()
  }

  return (
    <form onSubmit={submit}>
      <div className="field">
        <input className="amount-input" inputMode="decimal" placeholder="R$ 0,00" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
      </div>
      <div className="field">
        <label>De (sai daqui)</label>
        <select value={fromId} onChange={(e) => setFromId(e.target.value)}>
          {state.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Para (entra aqui)</label>
        <select value={toId} onChange={(e) => setToId(e.target.value)}>
          {state.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <div className="field-row">
        <div className="field">
          <label>Data</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Descrição (opcional)</label>
          <input placeholder="Ex.: saque" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>
      <button type="submit" className="btn primary full">🔄 Transferir</button>
    </form>
  )
}
