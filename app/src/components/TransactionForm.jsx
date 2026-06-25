import { useState, useEffect } from 'react'
import { useStore } from '../store'
import { todayISO, uid } from '../lib/format'
import { compressImage, putPhoto, getPhoto, delPhoto } from '../lib/photos'

// Formulário de lançamento rápido de gasto ou ganho.
// `editing` (opcional) preenche os campos para edição.
export default function TransactionForm({ onDone, editing }) {
  const { state, dispatch } = useStore()
  const [type, setType] = useState(editing?.type || 'gasto')
  const [amount, setAmount] = useState(editing ? String(editing.amount).replace('.', ',') : '')
  const [categoryId, setCategoryId] = useState(editing?.categoryId || '')
  const [accountId, setAccountId] = useState(editing?.accountId || state.accounts[0]?.id || '')
  const [date, setDate] = useState(editing?.date || todayISO())
  const [description, setDescription] = useState(editing?.description || '')
  const [photo, setPhoto] = useState(null) // dataURL em memória
  const [photoChanged, setPhotoChanged] = useState(false)

  // Carrega a foto existente (quando editando).
  useEffect(() => {
    if (editing?.photoId) getPhoto(editing.photoId).then(setPhoto)
  }, [editing])

  const onPhoto = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setPhoto(await compressImage(file))
      setPhotoChanged(true)
    } catch {
      alert('Não consegui processar a imagem.')
    }
  }

  const removePhoto = () => { setPhoto(null); setPhotoChanged(true) }

  const cats = state.categories.filter((c) => c.type === type)

  const parseAmount = (s) => {
    const n = parseFloat(String(s).replace(/\./g, '').replace(',', '.'))
    return Number.isFinite(n) ? n : 0
  }

  const submit = async (e) => {
    e.preventDefault()
    const value = parseAmount(amount)
    if (value <= 0) return alert('Informe um valor maior que zero.')
    if (!categoryId) return alert('Escolha uma categoria.')
    if (!accountId) return alert('Escolha uma conta.')

    // Resolve a foto: mantém a antiga, troca por nova, ou remove.
    let photoId = editing?.photoId || null
    if (photoChanged) {
      if (editing?.photoId) await delPhoto(editing.photoId)
      if (photo) { photoId = uid(); await putPhoto(photoId, photo) }
      else photoId = null
    }

    const payload = { type, amount: value, categoryId, accountId, date, description: description.trim(), photoId }
    if (editing) dispatch({ type: 'UPDATE_TX', payload: { ...payload, id: editing.id } })
    else dispatch({ type: 'ADD_TX', payload })
    onDone?.()
  }

  return (
    <form onSubmit={submit}>
      <div className="toggle">
        <button type="button" className={type === 'gasto' ? 'on-gasto' : ''} onClick={() => { setType('gasto'); setCategoryId('') }}>
          ➖ Gasto
        </button>
        <button type="button" className={type === 'ganho' ? 'on-ganho' : ''} onClick={() => { setType('ganho'); setCategoryId('') }}>
          ➕ Ganho
        </button>
      </div>

      <div className="field">
        <input
          className="amount-input"
          inputMode="decimal"
          placeholder="R$ 0,00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          autoFocus
        />
      </div>

      <div className="field">
        <label>Categoria</label>
        <div className="catgrid">
          {cats.map((c) => (
            <button
              type="button"
              key={c.id}
              className={categoryId === c.id ? 'sel' : ''}
              onClick={() => setCategoryId(c.id)}
            >
              <span className="e">{c.icon}</span>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label>Conta</label>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {state.accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Data</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label>Descrição (opcional)</label>
        <input
          placeholder="Ex.: almoço com a equipe"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="field">
        <label>Comprovante (opcional)</label>
        {photo ? (
          <div style={{ position: 'relative' }}>
            <img src={photo} alt="comprovante" onClick={() => window.open(photo, '_blank')}
              style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--border)' }} />
            <button type="button" onClick={removePhoto}
              style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,.6)', borderRadius: 8, padding: '4px 8px', color: '#fff' }}>✕</button>
          </div>
        ) : (
          <label className="btn full" style={{ display: 'block', textAlign: 'center' }}>
            📷 Tirar foto / anexar
            <input type="file" accept="image/*" capture="environment" onChange={onPhoto} style={{ display: 'none' }} />
          </label>
        )}
      </div>

      <button type="submit" className="btn primary full">
        {editing ? 'Salvar alterações' : 'Adicionar lançamento'}
      </button>
    </form>
  )
}
