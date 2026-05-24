import React from 'react';
import ReactDOM from 'react-dom/client';
import { PrivyProvider } from '@privy-io/react-auth';

import App from './App.jsx';
import './styles.css';

const privyAppId =
  import.meta.env.VITE_PRIVY_APP_ID ||
  'COLE_SEU_PRIVY_APP_ID_AQUI';

ReactDOM.createRoot(
  document.getElementById('root'),
).render(
  <React.StrictMode>
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethods: ['email', 'google'],

        appearance: {
          theme: 'dark',
          accentColor: '#6366F1',
        },

        embeddedWallets: {
          ethereum: {
            createOnLogin:
              'users-without-wallets',
          },
        },
      }}
    >
      <App />
    </PrivyProvider>
  </React.StrictMode>,
);
