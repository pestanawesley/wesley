import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Registra o service worker (offline / instalável) apenas em produção.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  let reloaded = false
  // Quando uma versão nova assumir o controle, recarrega uma vez sozinho.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return
    reloaded = true
    window.location.reload()
  })
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then((reg) => {
      // Verifica atualização ao abrir e a cada 1 min.
      reg.update()
      setInterval(() => reg.update(), 60000)
    }).catch(() => {})
  })
}
