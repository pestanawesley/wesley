import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from 'recharts'
import {
  useStore, totalBalance, monthSummary, expensesByCategory,
  projectedBalance, netWorth, monthlyTrend, categoryById, accountById,
} from '../store'
import { insights } from '../lib/insights'
import { brl, currentMonthKey, monthLabel, monthShort, formatDateShort } from '../lib/format'

export default function Dashboard() {
  const { state } = useStore()
  const key = currentMonthKey()

  const total = totalBalance(state)
  const month = monthSummary(state, key)
  const byCat = expensesByCategory(state, key)
  const proj = projectedBalance(state, key)
  const nw = netWorth(state)
  const trend = monthlyTrend(state, 6)
  const recent = state.transactions.filter((t) => t.type !== 'transferencia').slice(0, 5)
  const alerts = insights(state)

  return (
    <div>
      <div className="topbar">
        <div className="logo">
          <div className="mark">💰</div>
          <div>
            <h1>Minha Carteira</h1>
            <div className="sub">{monthLabel(key)}</div>
          </div>
        </div>
      </div>

      <div className="dash-grid">
        {/* Saldo total */}
        <div className="block">
          <div className="hero-balance">
            <div className="lbl">Saldo disponível</div>
            <div className="val">{brl(total)}</div>
            <div className="row">
              <div>
                <div className="k">↗ Entrou no mês</div>
                <div className="v pos">{brl(month.income)}</div>
              </div>
              <div>
                <div className="k">↘ Saiu no mês</div>
                <div className="v neg">{brl(month.expense)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Alertas inteligentes */}
        {alerts.length > 0 && (
          <div className="block">
            <div className="alerts">
              {alerts.map((a, i) => (
                <div className={`alert ${a.level}`} key={i}>
                  <span className="ai">{a.icon}</span>
                  <span>{a.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sobrou / Projeção */}
        <div className="block">
          <div className="grid-2">
            <div className="stat">
              <div className="k">💵 Sobrou este mês</div>
              <div className={`v ${month.balance >= 0 ? 'pos' : 'neg'}`}>{brl(month.balance)}</div>
            </div>
            <div className="stat">
              <div className="k">🔮 Projeção fim do mês</div>
              <div className={`v ${proj.projected >= 0 ? 'pos' : 'neg'}`}>{brl(proj.projected)}</div>
            </div>
          </div>
          {(proj.toReceive > 0 || proj.toPay > 0) && (
            <div className="card" style={{ marginTop: 12, fontSize: 13 }}>
              <div className="spread">
                <span className="muted">Ainda a receber este mês</span>
                <span className="pos">{brl(proj.toReceive)}</span>
              </div>
              <div className="spread mt">
                <span className="muted">Ainda a pagar este mês</span>
                <span className="neg">{brl(proj.toPay)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Patrimônio */}
        <div className="block">
          <div className="section-title">Patrimônio líquido</div>
          <div className="card">
            <div className="spread">
              <div>
                <div className="muted" style={{ fontSize: 12 }}>O que você tem, menos o que deve</div>
                <div className="val" style={{ fontSize: 28, fontWeight: 800, marginTop: 4 }}>{brl(nw.netWorth)}</div>
              </div>
              <div style={{ fontSize: 34 }}>🏦</div>
            </div>
            <div className="row" style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <Mini k="Em contas" v={nw.cash} />
              <Mini k="Guardado" v={nw.saved} cls="pos" />
              <Mini k="A pagar" v={nw.debts} cls="neg" />
            </div>
          </div>
        </div>

        {/* Gráfico de gastos por categoria */}
        {byCat.length > 0 && (
          <div className="block">
            <div className="section-title">Para onde foi seu dinheiro</div>
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 130, height: 130 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={byCat} dataKey="value" nameKey="name" innerRadius={38} outerRadius={62} paddingAngle={2}>
                        {byCat.map((c, i) => <Cell key={i} fill={c.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {byCat.slice(0, 5).map((c) => {
                    const pct = month.expense ? Math.round((c.value / month.expense) * 100) : 0
                    return (
                      <div key={c.name} className="spread" style={{ fontSize: 13 }}>
                        <span><span style={{ marginRight: 6 }}>{c.icon}</span>{c.name}</span>
                        <span className="muted">{pct}% · {brl(c.value)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Evolução dos últimos meses */}
        {trend.some((t) => t.entrou || t.saiu) && (
          <div className="block">
            <div className="section-title">Últimos 6 meses</div>
            <div className="card">
              <div style={{ width: '100%', height: 160 }}>
                <ResponsiveContainer>
                  <BarChart data={trend} barGap={2}>
                    <XAxis dataKey="key" tickFormatter={monthShort} tick={{ fill: '#93a0c2', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(v, n) => [brl(v), n === 'entrou' ? 'Entrou' : 'Saiu']}
                      labelFormatter={(k) => monthLabel(k)}
                      contentStyle={{ background: '#161f38', border: '1px solid #243154', borderRadius: 12, fontSize: 12 }}
                    />
                    <Bar dataKey="entrou" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="saiu" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Últimos lançamentos */}
        <div className="block">
          <div className="section-title">Últimos lançamentos</div>
          {recent.length === 0 ? (
            <div className="empty">
              <div className="big">📝</div>
              Nenhum lançamento ainda.<br />Toque no <b>+</b> para começar.
            </div>
          ) : (
            <div className="list">
              {recent.map((t) => {
                const cat = categoryById(state, t.categoryId)
                const acc = accountById(state, t.accountId)
                return (
                  <div className="item" key={t.id}>
                    <div className="ic" style={{ background: (cat?.color || '#334') + '33' }}>{cat?.icon || '📦'}</div>
                    <div className="body">
                      <div className="t">{t.description || cat?.name || 'Lançamento'}</div>
                      <div className="s">{formatDateShort(t.date)} · {acc?.name}</div>
                    </div>
                    <div className={`amt ${t.type === 'ganho' ? 'pos' : 'neg'}`}>
                      {t.type === 'ganho' ? '+' : '-'} {brl(t.amount)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Mini({ k, v, cls = '' }) {
  return (
    <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '10px 12px' }}>
      <div className="muted" style={{ fontSize: 11 }}>{k}</div>
      <div className={cls} style={{ fontWeight: 700, marginTop: 2, fontSize: 14 }}>{brl(v)}</div>
    </div>
  )
}
