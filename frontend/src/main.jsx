// index.css must be imported first: it holds the design tokens and the shared
// .btn-pill / .icon-btn / .field base classes that component stylesheets override.
// CSS is emitted in module-evaluation order, so anything imported later wins.
import './index.css';

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider>
      <ConfirmProvider>
        <App />
      </ConfirmProvider>
    </ToastProvider>
  </React.StrictMode>
);
