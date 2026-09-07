import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

// Capture once before React mounts; never persist bearer invitation credentials.
const fragment = new URLSearchParams(window.location.hash.slice(1));
const invitationToken = fragment.get('invite');
if (window.location.hash)
  window.history.replaceState(
    null,
    '',
    window.location.pathname + window.location.search,
  );

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App token={invitationToken} />
  </StrictMode>,
);
