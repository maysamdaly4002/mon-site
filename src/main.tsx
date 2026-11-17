/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { SiteConfigProvider } from './context/SiteConfigContext';

createRoot(document.getElementById('root')!).render(
  <SiteConfigProvider>
    <App />
  </SiteConfigProvider>
);
