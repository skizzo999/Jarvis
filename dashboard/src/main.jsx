import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { installApiInterceptor } from './api.js'

// Inietta X-API-Key su tutte le chiamate /api/ se presente in localStorage.
// Niente effetti collaterali se nessuna chiave è configurata.
installApiInterceptor()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
