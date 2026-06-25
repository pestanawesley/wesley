import { useState } from 'react'
import { useStore, accountBalance, totalBalance } from '../store'
import { brl } from '../lib/format'
import * as db from '../lib/db'
import { seed } from '../lib/seed'
import Sheet from '../components/Sheet'

const TYPES = [
  { v: 'banco', l: 'Conta de banco', icon: '🏦' },
  { v: 'carteira', l: 'Dinheiro / Carteira', icon: '👛' },
  { v: 'cartao', l: 'Cartão de crédito', icon: '💳' },
  { v: 'investimento', l: 'Investimento', icon: '📈' },
]
const iconFor = (t) => TYPES.find((x) => x.v === t)?.icon || '🏦'

export default function Accounts() {
  const { state, dispatch } = useStore()
  const [adding, setAdding] = useState(false)

  const exportData = () => {
    const blob = new Blob([db.exportJSON(state)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `minha-carteira-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importData = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = db.importJSON(reader.result)
        dispatch({ type: 'RESET', payload: data })
        alert('Dados importados com sucesso!')
      } catch {
        alert('Arquivo inválido.')
      }
    }
    reader.readAsText(file)
  }

  const reset = () => {
    if (confirm('Apagar TODOS os dados e recomeçar do zero? Isso não pode ser desfeito.')) {
      dispatch({ type: 'RESET', payload: seed() })
    }
  }

  return (
    <div>
      <div className="topbar"><h1>Contas & Cartões</h1></div>

      <div className="hero-balance">
        <div className="lbl">Patrimônio em contas</div>
        <div className="val">{brl(totalBalance(state))}</div>
      </div>

      <button className="btn primary full mt" onClick={() => setAdding(true)}>+ Nova conta</button>

      <div className="list" style={{ marginTop: 14 }}>
        {state.accounts.map((a) => {
          const bal = accountBalance(state, a.id)
          return (
            <div className="item" key={a.id}>
              <div className="ic" style={{ background: (a.color || '#334') + '33' }}>{iconFor(a.type)}</div>
              <div className="body">
                <div className="t">{a.name}</div>
                <div className="s">{TYPES.find((t) => t.v === a.type)?.l}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className={`amt ${bal < 0 ? 'neg' : ''}`}>{brl(bal)}</div>
                <button
                  className="del"
                  onClick={() => {
                    const has = state.transactions.some((t) => t.accountId === a.id)
                    if (has) return alert('Esta conta tem lançamentos. Exclua-os antes de remover a conta.')
                    if (confirm('Excluir conta?')) dispatch({ type: 'DELETE_ACCOUNT', id: a.id })
                  }}
                >🗑️</button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="section-title">Seus dados</div>
      <div className="card">
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          Seus dados ficam salvos só neste aparelho. Faça backup de vez em quando exportando o arquivo.
        </p>
        <button className="btn full" onClick={exportData}>⬇️ Exportar backup (.json)</button>
        <label className="btn full mt" style={{ display: 'block', textAlign: 'center' }}>
          ⬆️ Importar backup
          <input type="file" accept="application/json" onChange={importData} style={{ display: 'none' }} />
        </label>
        <button className="btn danger full mt" onClick={reset}>🗑️ Zerar tudo</button>
      </div>

      {adding && <AccountForm onClose={() => setAdding(false)} />}
    </div>
  )
}

function AccountForm({ onClose }) {
  const { dispatch } = useStore()
  const [name, setName] = useState('')
  const [type, setType] = useState('banco')
  const [initialBalance, setInitialBalance] = useState('')
  const colors = ['#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#ec4899', '#14b8a6']
  const [color, setColor] = useState(colors[0])

  const submit = (e) => {
    e.preventDefault()
    if (!name.trim()) return alert('Dê um nome à conta.')
    const bal = parseFloat(String(initialBalance).replace(/\./g, '').replace(',', '.')) || 0
    dispatch({ type: 'ADD_ACCOUNT', payload: { name: name.trim(), type, initialBalance: bal, color } })
    onClose()
  }

  return (
    <Sheet title="Nova conta" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label>Tipo</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => <option key={t.v} value={t.v}>{t.icon} {t.l}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Nome</label>
          <input placeholder="Ex.: Nubank, Itaú, Dinheiro..." value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label>Saldo atual (quanto tem hoje)</label>
          <input inputMode="decimal" placeholder="0,00" value={initialBalance} onChange={(e) => setInitialBalance(e.target.value)} />
        </div>
        <div className="field">
          <label>Cor</label>
          <div className="chips">
            {colors.map((c) => (
              <button type="button" key={c} onClick={() => setColor(c)}
                style={{ width: 34, height: 34, borderRadius: '50%', background: c, border: color === c ? '3px solid #fff' : '1px solid #243154' }} />
            ))}
          </div>
        </div>
        <button type="submit" className="btn primary full">Adicionar conta</button>
      </form>
    </Sheet>
  )
}
