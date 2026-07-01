import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { applyThemeFromSettings } from './hooks/useAppTheme'
import { DEFAULT_STREAM_SETTINGS } from './types'
import { migrateStreamSettings } from './lib/audioGain'
import './styles/global.css'

try {
  const saved = localStorage.getItem('nova-stream-settings')
  if (saved) {
    applyThemeFromSettings({
      ...DEFAULT_STREAM_SETTINGS,
      ...migrateStreamSettings(JSON.parse(saved))
    })
  } else {
    applyThemeFromSettings(DEFAULT_STREAM_SETTINGS)
  }
} catch {
  applyThemeFromSettings(DEFAULT_STREAM_SETTINGS)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
