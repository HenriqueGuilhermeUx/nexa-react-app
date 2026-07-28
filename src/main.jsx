import React from 'react';
import ReactDOM from 'react-dom/client';
import {PrivyProvider} from '@privy-io/react-auth';
import App from './App.jsx';
import './styles.css';

const appId = import.meta.env.VITE_PRIVY_APP_ID || 'cmpen2gm3007v0cjswjlyefji';
const clientId = String(
  import.meta.env.VITE_PRIVY_CLIENT_ID ||
    'client-WY6ZY2Ptr39FTjXumMRAfqM2Bx8m9DUWxcSgXg6CWaMyT',
).trim();

const providerProps = {
  appId,
  clientId,
  config: {
    loginMethods: ['email'],
    appearance: {
      theme: 'dark',
      accentColor: '#6366f1',
      showWalletLoginFirst: false,
    },
    embeddedWallets: {
      ethereum: {
        createOnLogin: 'users-without-wallets',
      },
    },
  },
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PrivyProvider {...providerProps}>
      <App />
    </PrivyProvider>
  </React.StrictMode>,
);
