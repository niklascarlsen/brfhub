import '@fontsource-variable/merriweather/wght.css';
import './index.css';

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';

import {App} from '@/App';
import {trackInputModality} from '@/lib/inputModality';
import {registerServiceWorker} from '@/lib/serviceWorker';

trackInputModality();
registerServiceWorker();

const container = document.getElementById('root');

if (!container) {
  throw new Error('Missing #root element');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
