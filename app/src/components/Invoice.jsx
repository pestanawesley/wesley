import { useState } from 'react'
import { useStore, cardInvoices, categoryById } from '../store'
import { brl, formatDate, formatDateShort, monthLabel, daysUntil } from '../lib/format'

// Faturas de um cartão de crédito, com opção de pagar.
export default function Invoice({ card, onClose }) {
  const { state, dispatch } = useStore()
  const [paying, setPaying] = useState(null) // fatura a pagar
  const invoices = cardInvoices(state, card.id)

  return (
    <div>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
        Fecha dia {card.closingDay} · vence dia {card.dueDay}. As compras entram na
        fatura do mês conforme a data.
      </p>

      {invoices.length === 0 ? (
        <div className="empty"><div className="big">💳</div>Nenhuma compra neste cartão ainda.</div>
      ) : (
        invoices.map((inv) => {
          const d = daysUntil(inv.dueDate)
          return (
            <div className="card" key={inv.key} style={{ marginBottom: 12 }}>
              <div className="spread">
                <div>
                  <div style={{ fontWeight: 700 }}>Fatura de {monthLabel(inv.key)}</div>
                  <div className="muted" style={{ fontSize: 12 }}>Vence {formatDate(inv.dueDate)}</div>
                </div>
                {inv.isPaid
                  ? <span className="badge ok">Paga ✓</span>
                  : d < 0 ? <span className="badge late">Atrasada</span>
                    : <span className="badge soon">Em aberto</span>}
              </div>
              <div className="spread mt">
                <span className="muted" style={{ fontSize: 13 }}>Total</span>
                <span style={{ fontWeight: 800, fontSize: 20 }}>{brl(inv.total)}</span>
              </div>
              {inv.paid > 0 && !inv.isPaid && (
                <div className="spread" style={{ fontSize: 12 }}>
                  <span className="muted">Já pago</span><span className="pos">{brl(inv.paid)}</span>
                </div>
              )}

              <details style={{ marginTop: 10 }}>
                <summary className="muted" style={{ fontSize: 13, cursor: 'pointer' }}>
                  {inv.purchases.length} compra(s)
                </summary>
                <div className="list" style={{ marginTop: 8 }}>
                  {inv.purchases.sort((a, b) => b.date.localeCompare(a.date)).map((p) => {
                    const cat = categoryById(state, p.categoryId)
                    return (
                      <div className="spread" key={p.id} style={{ fontSize: 13, padding: '4px 0' }}>
                        <span>{cat?.icon} {p.description || cat?.name} <span className="muted">· {formatDateShort(p.date)}</span></span>
                        <span className="neg">{brl(p.amount)}</span>
                      </div>
                    )
                  })}
                </div>
              </details>

              {!inv.isPaid && (
                <button className="btn primary full mt" onClick={() => setPaying(inv)}>Pagar fatura</button>
              )}
            </div>
          )
        })
      )}

      {paying && (
        <PayInvoice card={card} invoice={paying} onClose={() => setPaying(null)} onPaid={() => setPaying(null)} />
      )}
    </div>
  )
}

function PayInvoice({ card, invoice, onClose, onPaid }) {
  const { state, dispatch } = useStore()
  const banks = state.accounts.filter((a) => a.id !== card.id && a.type !== 'cartao')
  const [fromId, setFromId] = useState(banks[0]?.id || '')
  const remaining = invoice.total - invoice.paid

  const pay = (e) => {
    e.preventDefault()
    if (!fromId) return alert('Escolha a conta de onde sai o dinheiro.')
    dispatch({
      type: 'ADD_TX',
      payload: {
        type: 'transferencia', amount: remaining, accountId: fromId, toAccountId: card.id,
        date: new Date().toISOString().slice(0, 10), invoiceKey: invoice.key,
        description: `Pagamento fatura ${card.name}`,
      },
    })
    onPaid()
  }

  return (
    <div className="overlay" onClick={onClose} style={{ zIndex: 60 }}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grip" />
        <h2>Pagar fatura</h2>
        <form onSubmit={pay}>
          <div className="card" style={{ marginBottom: 14, textAlign: 'center' }}>
            <div className="muted" style={{ fontSize: 13 }}>Valor a pagar</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{brl(remaining)}</div>
          </div>
          <div className="field">
            <label>Pagar com</label>
            <select value={fromId} onChange={(e) => setFromId(e.target.value)}>
              {banks.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <button type="submit" className="btn primary full">Confirmar pagamento</button>
        </form>
      </div>
    </div>
  )
}
