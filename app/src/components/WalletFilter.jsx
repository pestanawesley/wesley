import { useStore, hasMultipleWallets } from '../store'

// Seletor Tudo | Pessoal | Empresa. Só aparece se existir conta de "empresa".
export default function WalletFilter() {
  const { state, dispatch } = useStore()
  if (!hasMultipleWallets(state)) return null
  const cur = state.viewWallet || 'tudo'
  const opts = [['tudo', 'Tudo'], ['pessoal', '👤 Pessoal'], ['empresa', '🏢 Empresa']]
  return (
    <div className="chips" style={{ marginBottom: 14 }}>
      {opts.map(([v, l]) => (
        <button key={v} className={`chip ${cur === v ? 'active' : ''}`} onClick={() => dispatch({ type: 'SET_WALLET', value: v })}>{l}</button>
      ))}
    </div>
  )
}
