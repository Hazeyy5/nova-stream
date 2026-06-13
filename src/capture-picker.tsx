import React from 'react'
import ReactDOM from 'react-dom/client'
import CapturePickerWindow from './components/CapturePickerWindow'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CapturePickerWindow />
  </React.StrictMode>
)
