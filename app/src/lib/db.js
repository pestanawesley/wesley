// ============================================================================
//  Camada de dados (local-first)
// ----------------------------------------------------------------------------
//  Hoje os dados ficam no navegador (localStorage). Esta camada existe para
//  isolar o "onde" os dados moram do resto do app. Quando ligarmos o Supabase,
//  basta reimplementar estas funções (load/save) chamando o cliente do Supabase
//  e o restante do app continua igual.
// ============================================================================

const STORAGE_KEY = 'minha-carteira:v1'

const empty = () => ({
  accounts: [],
  categories: [],
  transactions: [],
  bills: [], // contas futuras (a pagar / a receber)
  goals: [], // metas / objetivos
  meta: { createdAt: new Date().toISOString() },
})

export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    return { ...empty(), ...data }
  } catch (e) {
    console.error('Falha ao ler dados locais:', e)
    return null
  }
}

export function save(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    return true
  } catch (e) {
    console.error('Falha ao salvar dados locais:', e)
    return false
  }
}

export function exportJSON(state) {
  return JSON.stringify(state, null, 2)
}

export function importJSON(text) {
  const data = JSON.parse(text)
  return { ...empty(), ...data }
}

export { empty, STORAGE_KEY }
