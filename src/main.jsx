import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { registerServiceWorker } from './lib/pwa'
import { setupIOSKeyboard } from './lib/iosKeyboard'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)

// Registrar service worker para convertir la web en app instalable y offline-capable
registerServiceWorker()

// iOS nativo: propaga altura del teclado a CSS para que las sheets sigan la
// curva de animación de iOS al aparecer/desaparecer el teclado.
setupIOSKeyboard()
