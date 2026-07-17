import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Initialize PWA service worker
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('Eine neue Version der App ist verfügbar. Möchtest du jetzt aktualisieren?')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('App ist bereit für den Offline-Betrieb (PWA Caching aktiv).');
  },
  onRegisteredSW(swUrl, registration) {
    console.log('PWA Service Worker registered at', swUrl);
    if (registration) {
      registration.update();
    }
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
