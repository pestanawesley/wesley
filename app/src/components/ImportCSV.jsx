import { useState } from 'react'
import { useStore } from '../store'
import { parseCSV, parseBRNumber, parseDate, guessColumns, suggestCategory } from '../lib/csv'
import { brl, formatDate } from '../lib/format'

// Fluxo de importação de extrato CSV, dentro de um Sheet.
export default function ImportCSV({ onClose }) {
  const { state, dispatch } = useStore()
  const [step, setStep] = useState('upload') // upload | map | review
  const [parsed, setParsed] = useState(null) // { headers, rows }
  const [map, setMap] = useState({ dateCol: 0, valCol: 1, descCol: 2 })
  const [accountId, setAccountId] = useState(state.accounts[0]?.id || '')
  const [negIsExpense, setNegIsExpense] = useState(true)
  const [items, setItems] = useState([])

  const onFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const p = parseCSV(reader.result)
      if (!p.rows.length) return alert('Não consegui ler linhas nesse arquivo.')
      setParsed(p)
      setMap(guessColumns(p.headers, p.rows))
      setStep('map')
    }
    reader.readAsText(file, 'utf-8')
  }

  const buildItems = () => {
    const built = []
    for (const r of parsed.rows) {
      const date = parseDate(r[map.dateCol])
      const value = parseBRNumber(r[map.valCol])
      if (date == null || value == null || value === 0) continue
      const isExpense = negIsExpense ? value < 0 : value > 0
      const type = isExpense ? 'gasto' : 'ganho'
      const description = (r[map.descCol] || '').slice(0, 80)
      built.push({
        type,
        amount: Math.abs(value),
        date,
        description,
        accountId,
        categoryId: suggestCategory(description, state.categories, type),
        include: true,
      })
    }
    if (!built.length) return alert('Nenhuma linha válida encontrada. Confira o mapeamento das colunas.')
    setItems(built)
    setStep('review')
  }

  const doImport = () => {
    const toImport = items.filter((i) => i.include).map(({ include, ...t }) => t)
    if (!toImport.length) return alert('Selecione ao menos um lançamento.')
    dispatch({ type: 'IMPORT_TX', payload: toImport })
    alert(`${toImport.length} lançamento(s) importado(s)!`)
    onClose()
  }

  // ---- Passo 1: upload ----
  if (step === 'upload') {
    return (
      <div>
        <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
          Baixe o extrato do seu banco em <b>CSV</b> e selecione o arquivo aqui. Eu detecto
          as colunas, sugiro categorias e você confere antes de importar.
        </p>
        <label className="btn primary full" style={{ display: 'block', textAlign: 'center' }}>
          📄 Escolher arquivo CSV
          <input type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: 'none' }} />
        </label>
      </div>
    )
  }

  // ---- Passo 2: mapeamento ----
  if (step === 'map') {
    const ColSelect = ({ label, value, onChange }) => (
      <div className="field">
        <label>{label}</label>
        <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
          {parsed.headers.map((h, i) => <option key={i} value={i}>{h || `Coluna ${i + 1}`}</option>)}
        </select>
      </div>
    )
    return (
      <div>
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>Confirme qual coluna é cada coisa:</p>
        <ColSelect label="Data" value={map.dateCol} onChange={(v) => setMap({ ...map, dateCol: v })} />
        <ColSelect label="Valor" value={map.valCol} onChange={(v) => setMap({ ...map, valCol: v })} />
        <ColSelect label="Descrição" value={map.descCol} onChange={(v) => setMap({ ...map, descCol: v })} />
        <div className="field">
          <label>Importar para a conta</label>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {state.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <label className="spread" style={{ background: 'var(--card)', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)', marginBottom: 14 }}>
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>Valores negativos são gastos</span>
          <input type="checkbox" checked={negIsExpense} onChange={(e) => setNegIsExpense(e.target.checked)} style={{ width: 22, height: 22, flex: 'none' }} />
        </label>
        {/* prévia das primeiras linhas */}
        <div className="card" style={{ overflowX: 'auto', fontSize: 12, marginBottom: 14 }}>
          {parsed.rows.slice(0, 3).map((r, i) => (
            <div key={i} className="muted" style={{ whiteSpace: 'nowrap', marginBottom: 4 }}>
              {formatDate(parseDate(r[map.dateCol])) || '?'} · {r[map.descCol] || '?'} · {parseBRNumber(r[map.valCol]) ?? '?'}
            </div>
          ))}
        </div>
        <div className="field-row">
          <button className="btn" onClick={() => setStep('upload')}>Voltar</button>
          <button className="btn primary" onClick={buildItems}>Continuar</button>
        </div>
      </div>
    )
  }

  // ---- Passo 3: revisão ----
  const cats = state.categories
  const selCount = items.filter((i) => i.include).length
  return (
    <div>
      <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
        {items.length} lançamentos encontrados. Ajuste categorias e desmarque o que não quer importar.
      </p>
      <div className="list" style={{ maxHeight: '52vh', overflowY: 'auto', marginBottom: 14 }}>
        {items.map((it, idx) => (
          <div className="item" key={idx} style={{ opacity: it.include ? 1 : 0.4 }}>
            <input
              type="checkbox"
              checked={it.include}
              onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, include: e.target.checked } : x))}
              style={{ width: 20, height: 20, flex: 'none' }}
            />
            <div className="body">
              <div className="t">{it.description || '(sem descrição)'}</div>
              <div className="s">{formatDate(it.date)}</div>
              <select
                value={it.categoryId}
                onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, categoryId: e.target.value } : x))}
                style={{ marginTop: 6, padding: '6px 8px', fontSize: 12 }}
              >
                {cats.filter((c) => c.type === it.type).map((c) => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>
            <div className={`amt ${it.type === 'ganho' ? 'pos' : 'neg'}`}>
              {it.type === 'ganho' ? '+' : '-'} {brl(it.amount)}
            </div>
          </div>
        ))}
      </div>
      <div className="field-row">
        <button className="btn" onClick={() => setStep('map')}>Voltar</button>
        <button className="btn primary" onClick={doImport}>Importar {selCount}</button>
      </div>
    </div>
  )
}
