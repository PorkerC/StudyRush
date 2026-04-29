import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './StudyRush'


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
