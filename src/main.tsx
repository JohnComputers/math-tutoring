import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Order matters: tokens define the custom properties everything else consumes.
import './styles/tokens.css';
import './styles/base.css';
import './styles/utilities.css';
import './styles/components.css';
import './styles/sections.css';
import './styles/pages.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root was not found in index.html.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
