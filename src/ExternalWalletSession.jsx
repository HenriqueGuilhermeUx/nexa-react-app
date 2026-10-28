import {useMemo, useState} from 'react';
import {useConnectWallet, usePrivy, useWallets} from '@privy-io/react-auth';

// View-only pilot: no challenge, no server-side binding and no transfer methods.
// The feature is entirely absent from the UI unless explicitly enabled at build time.
const ENABLED = import.meta.env.VITE_NEXA_EXTERNAL_WALLET_VIEW_ENABLED === 'true';
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

function accountEmail(user) {
  return String(user?.email?.address ||
    user?.linkedAccounts?.find(account => account?.type === 'email')?.address ||
    '').trim().toLowerCase();
}
function externalWallets(wallets) {
  return wallets.filter(wallet => ADDRESS.test(String(wallet?.address || '')) &&
    wallet?.walletClientType !== 'privy' &&
    wallet?.walletClientType !== 'embedded' &&
    wallet?.connectorType !== 'privy' &&
    wallet?.connectorType !== 'embedded');
}
function compact(address) {
  return address.slice(0, 8) + '…' + address.slice(-6);
}

export default function ExternalWalletSession({accessToken, nexaEmail}) {
  const {ready, authenticated, user, login} = usePrivy();
  const {wallets, ready: walletsReady} = useWallets();
  const {connectWallet} = useConnectWallet();
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const options = useMemo(() => externalWallets(wallets), [wallets]);
  const emailMatches = authenticated &&
    !!nexaEmail &&
    accountEmail(user) === String(nexaEmail).trim().toLowerCase();
  const current = options.find(wallet =>
    wallet.address.toLowerCase() === selected.toLowerCase());

  if (!ENABLED || !accessToken || !nexaEmail) return null;

  async function connect() {
    setError('');
    if (!ready) { setError('A autenticação ainda está carregando.'); return; }
    if (!authenticated) { login(); return; }
    if (!emailMatches) {
      setError('Entre no Privy com o mesmo e-mail da sua conta Nexa.');
      return;
    }
    try {
      await connectWallet();
    } catch {
      setError('Não foi possível abrir o seletor de carteiras.');
    }
  }

  return <section className="content-card" aria-label="Carteiras externas em visualização">
    <h2>Conectar carteira externa</h2>
    <p className="muted">
      Conecte MetaMask, Coinbase Wallet, Rabby ou outra carteira oferecida pelo Privy
      para visualizar seu endereço nesta sessão. A conexão é gratuita.
    </p>
    <p className="notice notice-info">
      Modo de visualização: esta conexão não vincula a carteira permanentemente à Nexa,
      não consulta nem credita saldos e não autoriza transferências, taxas ou Pix.
      Nunca informe sua frase de recuperação.
    </p>
    {!authenticated && <p className="muted">Confirme sua identidade Privy antes de continuar.</p>}
    {authenticated && !emailMatches && <p className="notice notice-warning">
      O e-mail Privy não corresponde à conta Nexa. A conexão está bloqueada.
    </p>}
    <button type="button" className="secondary-button"
      disabled={!ready} onClick={connect}>
      {authenticated ? 'Escolher carteira externa' : 'Confirmar e-mail Privy'}
    </button>
    {walletsReady && emailMatches && options.length > 0 && <label>
      <span className="muted">Carteira conectada nesta sessão</span>
      <select value={selected} onChange={event => setSelected(event.target.value)}>
        <option value="">Selecione um endereço</option>
        {options.map(wallet => <option key={wallet.address} value={wallet.address}>
          {wallet.walletClientType || 'Carteira externa'} · {compact(wallet.address)}
        </option>)}
      </select>
    </label>}
    {emailMatches && current && <p className="muted">
      Endereço externo: <strong>{current.address}</strong>.
      Rede e posse on-chain não verificadas nesta etapa.
    </p>}
    {error && <p role="alert" className="notice notice-warning">{error}</p>}
  </section>;
}
