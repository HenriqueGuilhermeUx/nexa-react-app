import React from 'react';
import ReactDOM from 'react-dom/client';
import QaInjectedWalletApp from './QaInjectedWalletApp.jsx';
import './styles.css';

// A dedicated QA entrypoint. This is intentionally independent of Privy,
// App.jsx, redemption, customer sessions and production wallet operations.
if (import.meta.env.VITE_WALLET_CONNECT_LAB_ENABLED !== 'true' ||
    import.meta.env.VITE_WALLET_CONNECT_QA_INJECTED !== 'true') {
  throw new Error('QA_MODE_NOT_ENABLED');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><QaInjectedWalletApp /></React.StrictMode>,
);
