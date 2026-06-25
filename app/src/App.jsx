import { useState } from 'react'
import { StoreProvider } from './store'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Bills, { BillForm, InstallmentForm } from './pages/Bills'
import Goals from './pages/Goals'
import Accounts from './pages/Accounts'
import Vault from './pages/Vault'
import Sheet from './components/Sheet'
import TransactionForm from './components/TransactionForm'
import TransferForm from './components/TransferForm'

const TABS = [
  { id: 'home', label: 'Início', icon: '🏠' },
  { id: 'tx', label: 'Lançamentos', icon: '📊' },
  { id: 'bills', label: 'Futuras', icon: '📅' },
  { id: 'goals', label: 'Metas', icon: '🎯' },
  { id: 'accounts', label: 'Contas', icon: '🏦' },
]

// Opções do botão + (adicionar de qualquer tela).
const QUICK = [
  { id: 'tx', icon: '💸', label: 'Gasto ou ganho' },
  { id: 'bill', icon: '📅', label: 'Conta futura' },
  { id: 'inst', icon: '🧩', label: 'Parcelado' },
  { id: 'transfer', icon: '🔄', label: 'Transferência' },
]

function Shell() {
  const [tab, setTab] = useState('home')
  const [quick, setQuick] = useState(null) // null | 'menu' | 'tx' | 'bill' | 'inst' | 'transfer'
  const [vault, setVault] = useState(false)
  const close = () => setQuick(null)

  const page = {
    home: <Dashboard onSecret={() => setVault(true)} />,
    tx: <Transactions />,
    bills: <Bills />,
    goals: <Goals />,
    accounts: <Accounts />,
  }[tab]

  return (
    <>
      <div className="app">{page}</div>

      <button className="fab" onClick={() => setQuick('menu')} aria-label="Adicionar">＋</button>

      <nav className="nav">
        <div className="nav-inner">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              <span className="ic">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Menu rápido do + */}
      {quick === 'menu' && (
        <Sheet title="O que você quer adicionar?" onClose={close}>
          <div className="quick-grid">
            {QUICK.map((q) => (
              <button key={q.id} className="quick-item" onClick={() => setQuick(q.id)}>
                <span className="qi">{q.icon}</span>
                {q.label}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {quick === 'tx' && (
        <Sheet title="Novo lançamento" onClose={close}>
          <TransactionForm onDone={close} />
        </Sheet>
      )}
      {quick === 'bill' && <BillForm onClose={close} />}
      {quick === 'inst' && <InstallmentForm onClose={close} />}
      {quick === 'transfer' && (
        <Sheet title="Transferir entre contas" onClose={close}>
          <TransferForm onDone={close} />
        </Sheet>
      )}

      {vault && <Vault onClose={() => setVault(false)} />}
    </>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
