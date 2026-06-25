// Parser de CSV de extrato bancário, tolerante a formatos brasileiros.

// Detecta o separador mais provável (; ou , ou tab) pela primeira linha.
function detectDelimiter(line) {
  const counts = { ';': 0, ',': 0, '\t': 0 }
  for (const ch of line) if (ch in counts) counts[ch]++
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] || ','
}

// Quebra uma linha de CSV respeitando aspas.
function splitLine(line, delim) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === delim && !inQuotes) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

export function parseCSV(text) {
  const clean = text.replace(/^﻿/, '') // remove BOM
  const lines = clean.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (!lines.length) return { headers: [], rows: [] }
  const delim = detectDelimiter(lines[0])
  const all = lines.map((l) => splitLine(l, delim))
  // Heurística: se a primeira linha não tem nenhum número, é cabeçalho.
  const firstHasNumber = all[0].some((c) => /\d/.test(c) && parseBRNumber(c) !== null)
  const headers = firstHasNumber ? all[0].map((_, i) => `Coluna ${i + 1}`) : all[0]
  const rows = firstHasNumber ? all : all.slice(1)
  return { headers, rows }
}

// "1.234,56" -> 1234.56 ; "-45.00" -> -45 ; "R$ 12,90" -> 12.9
export function parseBRNumber(raw) {
  if (raw == null) return null
  let s = String(raw).replace(/[R$\s]/g, '').replace(/[^\d.,-]/g, '')
  if (!s || !/\d/.test(s)) return null
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  if (hasComma && hasDot) {
    // assume "." milhar e "," decimal (padrão BR)
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (hasComma) {
    s = s.replace(',', '.')
  }
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

// Tenta converter várias formas de data para ISO (YYYY-MM-DD).
export function parseDate(raw) {
  if (!raw) return null
  const s = String(raw).trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/) // ISO
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/) // dd/mm/aaaa
  if (m) {
    let [, d, mo, y] = m
    if (y.length === 2) y = '20' + y
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return null
}

// Adivinha qual coluna é data / valor / descrição.
export function guessColumns(headers, rows) {
  const sample = rows.slice(0, 8)
  const score = headers.map((_, i) => ({
    date: sample.filter((r) => parseDate(r[i])).length,
    num: sample.filter((r) => parseBRNumber(r[i]) !== null).length,
    text: sample.reduce((s, r) => s + (r[i] && parseBRNumber(r[i]) === null && !parseDate(r[i]) ? (r[i].length) : 0), 0),
  }))
  const best = (kind) => {
    let idx = -1
    let max = -1
    score.forEach((sc, i) => { if (sc[kind] > max) { max = sc[kind]; idx = i } })
    return idx
  }
  // header hints
  const hint = (re) => headers.findIndex((h) => re.test((h || '').toLowerCase()))
  const dateCol = hint(/data|date|dia/) >= 0 ? hint(/data|date|dia/) : best('date')
  const valCol = hint(/valor|amount|value|montante|cr[eé]dito|d[eé]bito/) >= 0 ? hint(/valor|amount|value|montante/) : best('num')
  const descCol = hint(/descri|hist[oó]rico|lan[cç]|memo|estabelecimento/) >= 0 ? hint(/descri|hist[oó]rico|lan[cç]|memo|estabelecimento/) : best('text')
  return { dateCol, valCol, descCol }
}

// Dicionário simples para auto-categorização por palavra-chave.
const KEYWORDS = {
  Alimentação: ['ifood', 'restaurante', 'lanche', 'pizza', 'burger', 'mc donalds', 'mcdonald', 'bar ', 'cafe', 'café', 'padaria', 'rappi'],
  Mercado: ['supermerc', 'mercado', 'atacad', 'carrefour', 'pao de acucar', 'assai', 'hortifruti', 'big '],
  Transporte: ['uber', '99', 'posto', 'combust', 'gasolina', 'estacion', 'metro', 'metrô', 'onibus', 'ônibus', 'pedagio', '99app'],
  Moradia: ['aluguel', 'condominio', 'condomínio', 'luz', 'energia', 'agua', 'água', 'gas', 'iptu'],
  'Contas & Assinaturas': ['netflix', 'spotify', 'amazon prime', 'disney', 'internet', 'vivo', 'claro', 'tim', 'telefon', 'assinatura', 'youtube'],
  Saúde: ['farmac', 'drogaria', 'hospital', 'clinic', 'clínic', 'consulta', 'exame', 'plano de saude'],
  Lazer: ['cinema', 'show', 'bar', 'balada', 'viagem', 'hotel', 'ingresso', 'game', 'steam'],
  Educação: ['curso', 'faculdade', 'escola', 'livro', 'udemy', 'alura'],
  Compras: ['shopping', 'loja', 'magazine', 'americanas', 'mercado livre', 'aliexpress', 'shopee', 'renner', 'riachuelo'],
  Salário: ['salario', 'salário', 'pagamento', 'provento', 'remuner'],
}

export function suggestCategory(description, categories, type) {
  const desc = (description || '').toLowerCase()
  for (const [catName, words] of Object.entries(KEYWORDS)) {
    if (words.some((w) => desc.includes(w))) {
      const cat = categories.find((c) => c.name === catName && c.type === type)
      if (cat) return cat.id
    }
  }
  // fallback: "Outros" ou "Presente / Outros"
  const fallback = categories.find((c) => c.type === type && /outros/i.test(c.name))
  return fallback?.id || categories.find((c) => c.type === type)?.id || ''
}
