import { useState } from 'react'
import { StoreProvider } from './store'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Bills from './pages/Bills'
import Goals from './pages/Goals'
import Accounts from './pages/Accounts'
import Vault from './pages/Vault'
import Sheet from './components/Sheet'
import TransactionForm from './components/TransactionForm'

const TABS = [
  { id: 'home', label: 'Início', icon: '🏠' },
  { id: 'tx', label: 'Lançamentos', icon: '📊' },
  { id: 'bills', label: 'Futuras', icon: '📅' },
  { id: 'goals', label: 'Metas', icon: '🎯' },
  { id: 'accounts', label: 'Contas', icon: '🏦' },
]

function Shell() {
  const [tab, setTab] = useState('home')
  const [quickAdd, setQuickAdd] = useState(false)
  const [vault, setVault] = useState(false)

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

      {/* Botão flutuante: lançamento rápido (visível nas telas principais) */}
      {tab !== 'accounts' && (
        <button className="fab" onClick={() => setQuickAdd(true)} aria-label="Novo lançamento">＋</button>
      )}

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

      {quickAdd && (
        <Sheet title="Novo lançamento" onClose={() => setQuickAdd(false)}>
          <TransactionForm onDone={() => setQuickAdd(false)} />
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
