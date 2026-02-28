import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';

const normalizedBase = (() => {
  const raw = import.meta.env.BASE_URL || '/';
  if (raw === '/') {
    return '/';
  }
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
})();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={normalizedBase}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
