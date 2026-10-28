import {useEffect, useMemo, useState} from 'react';
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
  const [verified, setVerified] = useState(null);
  const options = useMemo(() => externalWallets(wallets), [wallets]);
  const emailMatches = authenticated &&
    !!nexaEmail &&
    accountEmail(user) === String(nexaEmail).trim().toLowerCase();
  const current = options.find(wallet =>
    wallet.address.toLowerCase() === selected.toLowerCase());

  // Never display a previously selected address as verified after account changes.
  useEffect(() => {setSelected(''); setVerified(null);}, [accessToken, nexaEmail]);
  useEffect(() => {
    if (!current || typeof current.getEthereumProvider !== 'function') return;
    let live = true;
    let provider;
    current.getEthereumProvider().then(connected => {
      if (!live || typeof connected?.on !== 'function') return;
      provider = connected;
      connected.on('accountsChanged', invalidate);
      connected.on('chainChanged', invalidate);
      connected.on('disconnect', invalidate);
    }).catch(() => {});
    function invalidate() {setVerified(null);}
    return () => {
      live = false;
      if (typeof provider?.removeListener === 'function') {
        provider.removeListener('accountsChanged', invalidate);
        provider.removeListener('chainChanged', invalidate);
        provider.removeListener('disconnect', invalidate);
      }
    };
  }, [current]);

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

  async function verifyActiveWallet() {
    setError('');
    setVerified(null);
    if (!authenticated || !emailMatches || !accessToken || !current) {
      setError('Entre na Nexa e escolha uma carteira externa antes de verificar.');
      return;
    }
    try {
      const provider = typeof current.getEthereumProvider === 'function'
        ? await current.getEthereumProvider()
        : typeof current.getProvider === 'function'
          ? await current.getProvider() : null;
      if (typeof provider?.request !== 'function') throw Error('Carteira sem provedor de leitura disponível.');
      // Read-only EIP-1193 calls: no message signature, transaction or network switch.
      const accounts = await provider.request({method:'eth_accounts'});
      if (!Array.isArray(accounts) || !accounts.some(value =>
        typeof value === 'string' && value.toLowerCase() === current.address.toLowerCase())) {
        throw Error('O endereço selecionado não está ativo nessa carteira. Reconecte e tente novamente.');
      }
      const chainId = await provider.request({method:'eth_chainId'});
      if (typeof chainId !== 'string' || !/^0x[0-9a-f]+$/i.test(chainId)) {
        throw Error('A carteira não informou uma rede EVM válida.');
      }
      setVerified({address:current.address, chainId:chainId.toLowerCase()});
    } catch(e) {setError(e?.message || 'Não foi possível verificar a carteira externa.');}
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
      <select value={selected} onChange={event => {setSelected(event.target.value); setVerified(null);}}>
        <option value="">Selecione um endereço</option>
        {options.map(wallet => <option key={wallet.address} value={wallet.address}>
          {wallet.walletClientType || 'Carteira externa'} · {compact(wallet.address)}
        </option>)}
      </select>
    </label>}
    {emailMatches && current && <div>
      <button type="button" className="secondary-button" onClick={verifyActiveWallet}>
        Verificar endereço e rede (somente leitura)
      </button>
      {verified?.address?.toLowerCase() === current.address.toLowerCase() && <p className="muted">
        Endereço ativo: <strong>{verified.address}</strong>.
        Rede informada pela carteira: {verified.chainId === '0x89' ? 'Polygon (137)' : verified.chainId + ' (não Polygon)'}.
        Esta verificação local não comprova propriedade no servidor nem cria vínculo permanente.
      </p>}
    </div>}
    {error && <p role="alert" className="notice notice-warning">{error}</p>}
  </section>;
}
