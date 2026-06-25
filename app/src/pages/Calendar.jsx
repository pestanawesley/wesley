import { useState } from 'react'
import { useStore, billsInMonth, categoryById } from '../store'
import { brl, monthMatrix, WEEKDAYS, monthLabel, shiftMonth, currentMonthKey, todayISO, formatDate } from '../lib/format'

export default function Calendar() {
  const { state, dispatch } = useStore()
  const [key, setKey] = useState(currentMonthKey())
  const [selected, setSelected] = useState(todayISO())

  const weeks = monthMatrix(key)
  const bills = billsInMonth(state, key)
  const byDay = new Map()
  for (const b of bills) {
    const arr = byDay.get(b.dueDate) || []
    arr.push(b)
    byDay.set(b.dueDate, arr)
  }

  const toPay = bills.filter((b) => b.type === 'pagar').reduce((s, b) => s + b.amount, 0)
  const toReceive = bills.filter((b) => b.type === 'receber').reduce((s, b) => s + b.amount, 0)
  const dayBills = byDay.get(selected) || []

  return (
    <div>
      <div className="spread card" style={{ padding: '10px 14px' }}>
        <button className="btn ghost" onClick={() => setKey(shiftMonth(key, -1))}>‹</button>
        <b>{monthLabel(key)}</b>
        <button className="btn ghost" onClick={() => setKey(shiftMonth(key, 1))}>›</button>
      </div>

      <div className="grid-2" style={{ marginTop: 12 }}>
        <div className="stat"><div className="k">📥 A receber</div><div className="v pos">{brl(toReceive)}</div></div>
        <div className="stat"><div className="k">📤 A pagar</div><div className="v neg">{brl(toPay)}</div></div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="cal-head">
          {WEEKDAYS.map((w, i) => <div key={i} className="cal-dow">{w}</div>)}
        </div>
        {weeks.map((week, wi) => (
          <div className="cal-row" key={wi}>
            {week.map((cell, ci) => {
              if (!cell) return <div className="cal-cell empty-cell" key={ci} />
              const items = byDay.get(cell.iso) || []
              const hasPay = items.some((b) => b.type === 'pagar' && b.status !== 'pago')
              const hasRec = items.some((b) => b.type === 'receber' && b.status !== 'pago')
              const allPaid = items.length > 0 && items.every((b) => b.status === 'pago')
              const isToday = cell.iso === todayISO()
              const isSel = cell.iso === selected
              return (
                <button
                  key={ci}
                  className={`cal-cell ${isSel ? 'sel' : ''} ${isToday ? 'today' : ''}`}
                  onClick={() => setSelected(cell.iso)}
                >
                  <span className="d">{cell.day}</span>
                  <span className="dots">
                    {hasPay && <i style={{ background: 'var(--red)' }} />}
                    {hasRec && <i style={{ background: 'var(--green)' }} />}
                    {allPaid && <i style={{ background: 'var(--muted)' }} />}
                  </span>
                </button>
              )
            })}
          </div>
        ))}
      </div>

      <div className="section-title">{formatDate(selected)}</div>
      <div className="list">
        {dayBills.length === 0 ? (
          <div className="empty" style={{ padding: 24 }}>Nenhuma conta neste dia.</div>
        ) : (
          dayBills.map((b) => {
            const cat = categoryById(state, b.categoryId)
            return (
              <div className="item" key={b.id}>
                <div className="ic" style={{ background: (b.type === 'pagar' ? '#ef4444' : '#22c55e') + '22' }}>
                  {b.type === 'pagar' ? '📤' : '📥'}
                </div>
                <div className="body">
                  <div className="t">{b.description} {b.recurrenceId && <span className="badge ok">🔁</span>}</div>
                  <div className="s">{cat?.name || 'Sem categoria'} · {b.status === 'pago' ? 'Pago ✓' : 'Pendente'}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <div className={`amt ${b.type === 'receber' ? 'pos' : 'neg'}`}>{brl(b.amount)}</div>
                  {b.status !== 'pago' && (
                    <button className="chip" onClick={() => {
                      if (confirm(`Marcar "${b.description}" como ${b.type === 'pagar' ? 'paga' : 'recebida'}?`))
                        dispatch({ type: 'SETTLE_BILL', id: b.id })
                    }}>✓ {b.type === 'pagar' ? 'Paguei' : 'Recebi'}</button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
