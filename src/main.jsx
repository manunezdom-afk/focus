import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { registerServiceWorker } from './lib/pwa'
import { setupIOSKeyboard } from './lib/iosKeyboard'

// Marca runtime nativo en el <html> para que el CSS pueda apagar
// animaciones caras (aurora, backdrop-blur). El WKWebView de iOS sufre
// con backdrop-blur sobre contenido en scroll y con CSS keyframes
// continuas en blobs grandes — el resultado son animaciones que se
// "pegan segundos" mientras el GPU se libera. Browser web: no toca.
if (Capacitor?.isNativePlatform?.()) {
  document.documentElement.classList.add('is-capacitor')
  const platform = Capacitor.getPlatform?.()
  if (platform) document.documentElement.classList.add(`is-${platform}`)
}

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
