import { useState } from 'react'
import { useStore, categoryById, accountById, monthSummary, scopeState } from '../store'
import { brl, monthKey, currentMonthKey, monthLabel, shiftMonth, formatDate } from '../lib/format'
import Sheet from '../components/Sheet'
import TransactionForm from '../components/TransactionForm'
import ImportCSV from '../components/ImportCSV'
import WalletFilter from '../components/WalletFilter'
import { delPhoto } from '../lib/photos'

export default function Transactions() {
  const { state: fullState, dispatch } = useStore()
  const state = scopeState(fullState, fullState.viewWallet)
  const [key, setKey] = useState(currentMonthKey())
  const [filter, setFilter] = useState('todos') // todos | gasto | ganho
  const [editing, setEditing] = useState(null)
  const [importing, setImporting] = useState(false)

  const txs = state.transactions
    .filter((t) => monthKey(t.date) === key)
    .filter((t) => filter === 'todos' || t.type === filter)
    .sort((a, b) => b.date.localeCompare(a.date))

  const sum = monthSummary(state, key)

  return (
    <div>
      <div className="spread" style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>Lançamentos</h1>
        <button className="chip" onClick={() => setImporting(true)}>⬆️ Importar CSV</button>
      </div>

      <WalletFilter />

      {/* Navegação de mês */}
      <div className="spread card" style={{ padding: '10px 14px' }}>
        <button className="btn ghost" onClick={() => setKey(shiftMonth(key, -1))}>‹</button>
        <b>{monthLabel(key)}</b>
        <button className="btn ghost" onClick={() => setKey(shiftMonth(key, 1))}>›</button>
      </div>

      <div className="grid-2" style={{ marginTop: 12 }}>
        <div className="stat"><div className="k">↗ Entrou</div><div className="v pos">{brl(sum.income)}</div></div>
        <div className="stat"><div className="k">↘ Saiu</div><div className="v neg">{brl(sum.expense)}</div></div>
      </div>

      <div className="chips" style={{ marginTop: 14 }}>
        {[['todos', 'Todos'], ['gasto', 'Gastos'], ['ganho', 'Ganhos']].map(([v, l]) => (
          <button key={v} className={`chip ${filter === v ? 'active' : ''}`} onClick={() => setFilter(v)}>{l}</button>
        ))}
      </div>

      <div className="list" style={{ marginTop: 14 }}>
        {txs.length === 0 ? (
          <div className="empty"><div className="big">🗂️</div>Nenhum lançamento neste mês.</div>
        ) : (
          txs.map((t) => {
            const acc = accountById(state, t.accountId)
            if (t.type === 'transferencia') {
              const to = accountById(state, t.toAccountId)
              return (
                <div className="item" key={t.id} onClick={() => {
                  if (confirm('Excluir esta transferência?')) dispatch({ type: 'DELETE_TX', id: t.id })
                }}>
                  <div className="ic" style={{ background: '#5b8cff22' }}>🔄</div>
                  <div className="body">
                    <div className="t">{t.description || 'Transferência'}</div>
                    <div className="s">{formatDate(t.date)} · {acc?.name} → {to?.name}</div>
                  </div>
                  <div className="amt muted">{brl(t.amount)}</div>
                </div>
              )
            }
            const cat = categoryById(state, t.categoryId)
            return (
              <div className="item" key={t.id} onClick={() => setEditing(t)}>
                <div className="ic" style={{ background: (cat?.color || '#334') + '33' }}>{cat?.icon || '📦'}</div>
                <div className="body">
                  <div className="t">{t.description || cat?.name || 'Lançamento'} {t.photoId && '📎'}</div>
                  <div className="s">{formatDate(t.date)} · {cat?.name} · {acc?.name}</div>
                </div>
                <div className={`amt ${t.type === 'ganho' ? 'pos' : 'neg'}`}>
                  {t.type === 'ganho' ? '+' : '-'} {brl(t.amount)}
                </div>
              </div>
            )
          })
        )}
      </div>

      {editing && (
        <Sheet title="Editar lançamento" onClose={() => setEditing(null)}>
          <TransactionForm editing={editing} onDone={() => setEditing(null)} />
          <button
            className="btn danger full mt"
            onClick={() => {
              if (confirm('Excluir este lançamento?')) {
                if (editing.photoId) delPhoto(editing.photoId)
                dispatch({ type: 'DELETE_TX', id: editing.id })
                setEditing(null)
              }
            }}
          >
            🗑️ Excluir lançamento
          </button>
        </Sheet>
      )}

      {importing && (
        <Sheet title="Importar extrato CSV" onClose={() => setImporting(false)}>
          <ImportCSV onClose={() => setImporting(false)} />
        </Sheet>
      )}
    </div>
  )
}
