import { useState } from 'react'
import { StoreProvider } from './store'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Bills from './pages/Bills'
import Goals from './pages/Goals'
import Accounts from './pages/Accounts'
import Sheet from './components/Sheet'
import TransactionForm from './components/TransactionForm'

const TABS = [
  { id: 'home', label: 'Início', icon: '🏠', el: <Dashboard /> },
  { id: 'tx', label: 'Lançamentos', icon: '📊', el: <Transactions /> },
  { id: 'bills', label: 'Futuras', icon: '📅', el: <Bills /> },
  { id: 'goals', label: 'Metas', icon: '🎯', el: <Goals /> },
  { id: 'accounts', label: 'Contas', icon: '🏦', el: <Accounts /> },
]

function Shell() {
  const [tab, setTab] = useState('home')
  const [quickAdd, setQuickAdd] = useState(false)

  return (
    <>
      <div className="app">{TABS.find((t) => t.id === tab)?.el}</div>

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
