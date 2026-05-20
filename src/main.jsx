import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// window.storage shim for local browser storage
window.storage = {
  get: async (key, shared = false) => {
    const val = localStorage.getItem(key);
    return val ? { value: val } : null;
  },
  set: async (key, value, shared = false) => {
    localStorage.setItem(key, value);
  },
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
