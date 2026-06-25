// ============================================================================
//  Cofre particular (área privada criptografada)
// ----------------------------------------------------------------------------
//  Os dados são cifrados com AES-GCM usando uma chave derivada da senha (PIN)
//  via PBKDF2. Sem a senha, o conteúdo no localStorage é ilegível.
//  Requer contexto seguro (https ou localhost) — o GitHub Pages já é https.
// ============================================================================

const KEY = 'minha-carteira:vault'
const enc = new TextEncoder()
const dec = new TextDecoder()

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function deriveKey(pin, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export function vaultExists() {
  return !!localStorage.getItem(KEY)
}

export function destroyVault() {
  localStorage.removeItem(KEY)
}

// Cria um cofre novo com a senha escolhida e retorna os dados vazios.
export async function createVault(pin) {
  const data = { debts: [], createdAt: new Date().toISOString() }
  await saveVault(pin, data)
  return data
}

// Salva (cifra) os dados. Reaproveita o salt existente, se houver.
export async function saveVault(pin, data) {
  const existing = localStorage.getItem(KEY)
  const salt = existing ? unb64(JSON.parse(existing).salt) : crypto.getRandomValues(new Uint8Array(16))
  const key = await deriveKey(pin, salt)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(data)))
  localStorage.setItem(KEY, JSON.stringify({ v: 1, salt: b64(salt), iv: b64(iv), ct: b64(ct) }))
}

// Tenta abrir com a senha. Retorna os dados, ou null se a senha estiver errada.
export async function openVault(pin) {
  const raw = localStorage.getItem(KEY)
  if (!raw) return null
  try {
    const { salt, iv, ct } = JSON.parse(raw)
    const key = await deriveKey(pin, unb64(salt))
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, key, unb64(ct))
    return JSON.parse(dec.decode(pt))
  } catch {
    return null // senha incorreta / dados corrompidos
  }
}
