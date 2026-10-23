import React from 'react';
import ReactDOM from 'react-dom/client';
import {PrivyProvider} from '@privy-io/react-auth';
import App from './App.jsx';
import QaWalletConnectApp from './QaWalletConnectApp.jsx';
import QaInjectedWalletApp from './QaInjectedWalletApp.jsx';
import RedemptionPortal from './RedemptionPortal.jsx';
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
      accentColor: '#31D7FF',
      showWalletLoginFirst: false,
    },
    embeddedWallets: {
      ethereum: {
        createOnLogin: 'users-without-wallets',
      },
    },
  },
};

// In injected-wallet QA mode, never start Privy or use a production Privy app.
const injectedQa = import.meta.env.VITE_WALLET_CONNECT_LAB_ENABLED === 'true' &&
  import.meta.env.VITE_WALLET_CONNECT_QA_INJECTED === 'true';
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {injectedQa ? (
      <QaInjectedWalletApp />
    ) : (
      <PrivyProvider {...providerProps}>
        {import.meta.env.VITE_WALLET_CONNECT_LAB_ENABLED === 'true' ? (
          <QaWalletConnectApp />
        ) : (
          <><App /><RedemptionPortal /></>
        )}
      </PrivyProvider>
    )}
  </React.StrictMode>,
);
