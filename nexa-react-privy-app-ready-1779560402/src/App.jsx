import { useEffect, useMemo, useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Copy, RefreshCcw, Wallet } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://nexa-backend-p2u0.onrender.com/api/v1';

function getToken() {
  return localStorage.getItem('nexa_access_token');
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('nexa_user') || 'null');
  } catch {
    return null;
  }
}

async function api(path, options = {}) {
  const token = getToken();

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(Array.isArray(data?.message) ? data.message.join(', ') : data?.message || 'Erro na API');
  }

  return data;
}

function moneyBRL(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function Landing({ onEnter }) {
  const { login, authenticated, user } = usePrivy();

  return (
    <div className="page">
      <nav className="nav">
        <div className="nav-inner">
          <div className="brand"><div className="logo">N</div>Nexa</div>
          <div className="actions" style={{ marginTop: 0 }}>
            <button className="btn" onClick={onEnter}>Entrar com Nexa</button>
            <button className="btn btn-primary" onClick={login}>
              {authenticated ? 'Privy conectado' : 'Entrar com Privy'}
            </button>
          </div>
        </div>
      </nav>

      <section className="container hero">
        <div>
          <div className="badge">Pix + USDC + Privy</div>
          <h1>Cripto sem complicação.</h1>
          <p className="subtitle">
            Guarde em dólar digital, use no Pix e acesse cripto sem precisar entender pontes,
            redes, gas fee, seed phrase ou análise técnica.
          </p>

          <div className="actions">
            <button className="btn btn-primary" onClick={login}>Criar wallet com Privy</button>
            <button className="btn" onClick={onEnter}>Usar login Nexa</button>
          </div>

          {authenticated && (
            <p className="muted small" style={{ marginTop: 20 }}>
              Privy autenticado: {user?.email?.address || user?.id}
            </p>
          )}
        </div>

        <div className="card">
          <div className="metric-label">Conta em dólar digital</div>
          <div className="metric-value">$ 238.12</div>
          <p className="muted">Pix ⇄ USDC em uma experiência simples.</p>
          <div className="grid grid-2" style={{ marginTop: 24 }}>
            <div className="card"><strong>⚡ Depositar Pix</strong><p className="muted small">Pix para USDC</p></div>
            <div className="card"><strong>📲 Pagar Pix</strong><p className="muted small">USDC para Pix</p></div>
          </div>
        </div>
      </section>
    </div>
  );
}

function NexaLogin({ onLogged }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [mode, setMode] = useState('login');
  const [message, setMessage] = useState('');

  async function submit(event) {
    event.preventDefault();
    setMessage(mode === 'login' ? 'Entrando...' : 'Criando conta...');

    try {
      const body = mode === 'login' ? { email, password } : { email, password, fullName, cpf, phone };
      const response = await fetch(`${API_URL}/auth/${mode === 'login' ? 'login' : 'register'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Erro');

      localStorage.setItem('nexa_access_token', data.accessToken);
      localStorage.setItem('nexa_user', JSON.stringify(data.user));
      onLogged();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 520 }}>
        <form className="card" onSubmit={submit}>
          <div className="brand" style={{ marginBottom: 24 }}><div className="logo">N</div>Nexa</div>
          <h2>{mode === 'login' ? 'Entrar' : 'Começar em 30s'}</h2>
          <p className="muted">{mode === 'login' ? 'Acesse sua conta Nexa.' : 'Crie sua conta para testar o dólar digital.'}</p>

          {mode === 'register' && (
            <>
              <input className="input" placeholder="Nome completo" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              <input className="input" placeholder="CPF" value={cpf} onChange={(e) => setCpf(e.target.value)} />
              <input className="input" placeholder="Telefone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </>
          )}

          <input className="input" placeholder="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="input" placeholder="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

          <button className="btn btn-primary" style={{ width: '100%' }}>{mode === 'login' ? 'Entrar' : 'Criar conta'}</button>
          <p className="muted small" style={{ marginTop: 16 }}>{message}</p>
          <button type="button" className="btn" style={{ width: '100%', marginTop: 12 }} onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Criar conta' : 'Já tenho conta'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Dashboard({ onLogout }) {
  const { login, logout: privyLogout, authenticated, user: privyUser } = usePrivy();
  const { wallets } = useWallets();

  const [profile, setProfile] = useState(null);
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [depositAmount, setDepositAmount] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [message, setMessage] = useState('');

  const storedUser = useMemo(getStoredUser, []);
  const privyWallet = wallets?.[0];

  async function refresh() {
    try {
      const [profileData, balanceData, txData] = await Promise.all([
        api('/user/me'),
        api('/wallet/balance'),
        api('/transaction/history'),
      ]);
      setProfile(profileData);
      setBalance(balanceData);
      setTransactions(Array.isArray(txData) ? txData : []);
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function linkPrivyWallet() {
    try {
      if (!authenticated) {
        await login();
        return;
      }

      if (!privyWallet?.address) {
        setMessage('Privy conectado, mas wallet ainda não encontrada. Tente novamente em alguns segundos.');
        return;
      }

      const result = await api('/user/link-privy-wallet', {
        method: 'POST',
        body: JSON.stringify({
          privyUserId: privyUser?.id,
          walletAddress: privyWallet.address,
          privyWalletId: privyWallet.id,
          walletProvider: 'privy',
          walletNetwork: 'polygon',
        }),
      });

      setMessage(result.message);
      await refresh();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function createDeposit() {
    try {
      const amount = Number(depositAmount);
      if (!amount || amount < 10) {
        setMessage('Depósito mínimo: R$ 10,00');
        return;
      }
      const result = await api('/deposit/pix', { method: 'POST', body: JSON.stringify({ amount, amountBrl: amount }) });
      setMessage(`Depósito criado: ${Number(result.amountUsdc || 0).toFixed(4)} USDC`);
      setDepositAmount('');
      await refresh();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function payPix() {
    try {
      const amount = Number(paymentAmount);
      if (!amount || amount <= 0) {
        setMessage('Valor inválido');
        return;
      }
      if (!pixKey) {
        setMessage('Digite a chave Pix');
        return;
      }
      const result = await api('/payment/pix', { method: 'POST', body: JSON.stringify({ amount, amountBrl: amount, pixKey }) });
      setMessage(`Pix sandbox pago: ${Number(result.amountUsdc || 0).toFixed(4)} USDC`);
      setPaymentAmount('');
      setPixKey('');
      await refresh();
    } catch (error) {
      setMessage(error.message);
    }
  }

  function logoutAll() {
    localStorage.clear();
    privyLogout();
    onLogout();
  }

  const walletAddress = profile?.wallet?.address || privyWallet?.address || 'Wallet ainda não vinculada';

  return (
    <div className="page">
      <nav className="nav">
        <div className="nav-inner">
          <div className="brand"><div className="logo">N</div>Nexa</div>
          <div className="actions" style={{ marginTop: 0 }}>
            <button className="btn" onClick={refresh}><RefreshCcw size={16} /> Atualizar</button>
            <button className="btn" onClick={logoutAll}>Sair</button>
          </div>
        </div>
      </nav>

      <main className="container">
        <div className="badge">Conta em dólar digital</div>
        <h1 style={{ fontSize: 48 }}>Painel Nexa</h1>
        <p className="muted">Olá, {profile?.fullName || storedUser?.fullName || storedUser?.email}. Sua conta está conectada ao backend.</p>

        <div className="grid grid-4" style={{ marginTop: 28 }}>
          <div className="card"><div className="metric-label">Saldo USDC</div><div className="metric-value">$ {Number(balance?.balances?.USDC || 0).toFixed(2)}</div></div>
          <div className="card"><div className="metric-label">Saldo estimado</div><div className="metric-value">{moneyBRL(balance?.balances?.BRL || 0)}</div></div>
          <div className="card"><div className="metric-label">KYC</div><div className="metric-value">{profile?.kycStatus || 'pending'}</div></div>
          <div className="card"><div className="metric-label">Provider</div><div className="metric-value">{profile?.wallet?.provider || 'sandbox'}</div></div>
        </div>

        <section className="card" style={{ marginTop: 24 }}>
          <h2>Sua carteira Nexa</h2>
          <p className="muted">Esta área já está preparada para wallet real da Privy.</p>
          <div className="grid grid-2">
            <div>
              <div className="metric-label">Endereço</div>
              <div className="wallet-box">{walletAddress}</div>
              <button className="btn" style={{ marginTop: 12 }} onClick={() => navigator.clipboard.writeText(walletAddress)}>
                <Copy size={16} /> Copiar endereço
              </button>
            </div>
            <div>
              <div className="metric-label">Privy</div>
              <p className="muted small">Status: {authenticated ? 'Conectado' : 'Não conectado'}</p>
              <p className="muted small">Wallet: {privyWallet?.address || 'ainda não criada'}</p>
              <button className="btn btn-primary" onClick={linkPrivyWallet}>
                <Wallet size={16} /> Vincular wallet Privy
              </button>
            </div>
          </div>
        </section>

        <div className="grid grid-2" style={{ marginTop: 24 }}>
          <section className="card">
            <h2>Depositar via Pix</h2>
            <p className="muted">Gere um depósito sandbox e credite USDC.</p>
            <input className="input" placeholder="Valor em R$" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={createDeposit}>Gerar depósito Pix</button>
          </section>
          <section className="card">
            <h2>Pagar Pix com USDC</h2>
            <p className="muted">Simule um pagamento Pix debitando USDC.</p>
            <input className="input" placeholder="Valor em R$" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
            <input className="input" placeholder="Chave Pix" value={pixKey} onChange={(e) => setPixKey(e.target.value)} />
            <button className="btn btn-green" style={{ width: '100%' }} onClick={payPix}>Pagar Pix sandbox</button>
          </section>
        </div>

        {message && <p className="card" style={{ marginTop: 24 }}>{message}</p>}

        <section className="card" style={{ marginTop: 24 }}>
          <h2>Histórico</h2>
          {transactions.length === 0 && <p className="muted">Nenhuma transação ainda.</p>}
          {transactions.map((tx) => {
            const incoming = ['onramp', 'deposit_crypto', 'yield'].includes(String(tx.type).toLowerCase());
            return (
              <div key={tx.id || tx.reference} className={`tx ${incoming ? 'tx-in' : 'tx-out'}`}>
                <div>
                  <strong>{tx.description || tx.type}</strong>
                  <div className="muted small">{new Date(tx.createdAt).toLocaleString('pt-BR')}</div>
                  <div className="muted small">Status: {tx.status}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <strong className={incoming ? 'green' : 'red'}>{incoming ? '+' : '-'} {Number(tx.amountUsdc || 0).toFixed(2)} USDC</strong>
                  <div className="muted small">{moneyBRL(tx.amountBrl || 0)}</div>
                </div>
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState(getToken() ? 'dashboard' : 'landing');

  if (screen === 'login') return <NexaLogin onLogged={() => setScreen('dashboard')} />;
  if (screen === 'dashboard') return <Dashboard onLogout={() => setScreen('landing')} />;
  return <Landing onEnter={() => setScreen('login')} />;
}
