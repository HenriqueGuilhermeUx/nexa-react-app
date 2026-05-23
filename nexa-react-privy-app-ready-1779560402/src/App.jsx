import { useEffect, useMemo, useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Copy, RefreshCcw } from 'lucide-react';

const API_URL =
  import.meta.env.VITE_API_URL ||
  'https://nexa-backend-p2u0.onrender.com/api/v1';

function getToken() {
  return localStorage.getItem(
    'nexa_access_token',
  );
}

function getStoredUser() {
  try {
    return JSON.parse(
      localStorage.getItem('nexa_user') ||
        'null',
    );
  } catch {
    return null;
  }
}

async function api(path, options = {}) {
  const token = getToken();

  const response = await fetch(
    `${API_URL}${path}`,
    {
      ...options,

      headers: {
        'Content-Type': 'application/json',

        Authorization: `Bearer ${token}`,

        ...(options.headers || {}),
      },
    },
  );

  const data = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    throw new Error(
      Array.isArray(data?.message)
        ? data.message.join(', ')
        : data?.message || 'Erro na API',
    );
  }

  return data;
}

function moneyBRL(value) {
  return Number(value || 0).toLocaleString(
    'pt-BR',
    {
      style: 'currency',
      currency: 'BRL',
    },
  );
}

function Landing({ onEnter }) {
  const {
    login,
    authenticated,
    user,
  } = usePrivy();

  return (
    <div className="page">
      <nav className="nav">
        <div className="nav-inner">
          <div className="brand">
            <div className="logo">N</div>
            Nexa
          </div>

          <div
            className="actions"
            style={{ marginTop: 0 }}
          >
            <button
              className="btn"
              onClick={onEnter}
            >
              Entrar
            </button>

            <button
              className="btn btn-primary"
              onClick={login}
            >
              {authenticated
                ? 'Privy conectado'
                : 'Entrar com Privy'}
            </button>
          </div>
        </div>
      </nav>

      <section className="container hero">
        <div>
          <div className="badge">
            Pix + USDC + Privy
          </div>

          <h1>Cripto sem complicação.</h1>

          <p className="subtitle">
            Guarde em dólar digital,
            use no Pix e acesse cripto
            sem seed phrase, bridge,
            rede ou burocracia.
          </p>

          <div className="actions">
            <button
              className="btn btn-primary"
              onClick={onEnter}
            >
              Começar em 30s
            </button>
          </div>

          {authenticated && (
            <p
              className="muted small"
              style={{ marginTop: 20 }}
            >
              Privy autenticado:{' '}
              {user?.email?.address ||
                user?.id}
            </p>
          )}
        </div>

        <div className="card">
          <div className="metric-label">
            Conta em dólar digital
          </div>

          <div className="metric-value">
            $ 238.12
          </div>

          <p className="muted">
            Pix ⇄ USDC em experiência
            simples.
          </p>
        </div>
      </section>
    </div>
  );
}

function NexaLogin({ onLogged }) {
  const [email, setEmail] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [fullName, setFullName] =
    useState('');

  const [cpf, setCpf] = useState('');

  const [phone, setPhone] =
    useState('');

  const [mode, setMode] =
    useState('login');

  const [message, setMessage] =
    useState('');

  async function submit(event) {
    event.preventDefault();

    setMessage(
      mode === 'login'
        ? 'Entrando...'
        : 'Criando conta...',
    );

    try {
      const body =
        mode === 'login'
          ? {
              email,
              password,
            }
          : {
              email,
              password,
              fullName,
              cpf,
              phone,
            };

      const response = await fetch(
        `${API_URL}/auth/${
          mode === 'login'
            ? 'login'
            : 'register'
        }`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify(body),
        },
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          Array.isArray(data.message)
            ? data.message.join(', ')
            : data.message || 'Erro',
        );
      }

      localStorage.setItem(
        'nexa_access_token',
        data.accessToken,
      );

      localStorage.setItem(
        'nexa_user',
        JSON.stringify(data.user),
      );

      onLogged();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="page">
      <div
        className="container"
        style={{ maxWidth: 520 }}
      >
        <form
          className="card"
          onSubmit={submit}
        >
          <div
            className="brand"
            style={{ marginBottom: 24 }}
          >
            <div className="logo">N</div>
            Nexa
          </div>

          <h2>
            {mode === 'login'
              ? 'Entrar'
              : 'Começar em 30s'}
          </h2>

          {mode === 'register' && (
            <>
              <input
                className="input"
                placeholder="Nome completo"
                value={fullName}
                onChange={(e) =>
                  setFullName(
                    e.target.value,
                  )
                }
              />

              <input
                className="input"
                placeholder="CPF"
                value={cpf}
                onChange={(e) =>
                  setCpf(e.target.value)
                }
              />

              <input
                className="input"
                placeholder="Telefone"
                value={phone}
                onChange={(e) =>
                  setPhone(
                    e.target.value,
                  )
                }
              />
            </>
          )}

          <input
            className="input"
            placeholder="E-mail"
            type="email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
          />

          <input
            className="input"
            placeholder="Senha"
            type="password"
            value={password}
            onChange={(e) =>
              setPassword(
                e.target.value,
              )
            }
          />

          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
          >
            {mode === 'login'
              ? 'Entrar'
              : 'Criar conta'}
          </button>

          <p
            className="muted small"
            style={{ marginTop: 16 }}
          >
            {message}
          </p>

          <button
            type="button"
            className="btn"
            style={{
              width: '100%',
              marginTop: 12,
            }}
            onClick={() =>
              setMode(
                mode === 'login'
                  ? 'register'
                  : 'login',
              )
            }
          >
            {mode === 'login'
              ? 'Criar conta'
              : 'Já tenho conta'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Dashboard({ onLogout }) {
  const { logout: privyLogout } =
    usePrivy();

  const { wallets } = useWallets();

  const [profile, setProfile] =
    useState(null);

  const [balance, setBalance] =
    useState(null);

  const [
    transactions,
    setTransactions,
  ] = useState([]);

  const [
    depositAmount,
    setDepositAmount,
  ] = useState('');

  const [message, setMessage] =
    useState('');

  const storedUser = useMemo(
    getStoredUser,
    [],
  );

  async function refresh() {
    const [
      profileResult,
      balanceResult,
      txResult,
    ] = await Promise.allSettled([
      api('/user/me'),

      api('/wallet/balance'),

      api('/transaction/history'),
    ]);

    if (
      profileResult.status ===
      'fulfilled'
    ) {
      setProfile(profileResult.value);
    }

    if (
      balanceResult.status ===
      'fulfilled'
    ) {
      setBalance(balanceResult.value);
    }

    if (
      txResult.status === 'fulfilled'
    ) {
      setTransactions(
        Array.isArray(
          txResult.value,
        )
          ? txResult.value
          : [],
      );
    }

    const errors = [
      profileResult,
      balanceResult,
      txResult,
    ]
      .filter(
        (r) => r.status === 'rejected',
      )
      .map((r) => r.reason?.message)
      .filter(Boolean);

    const visibleErrors =
      errors.filter(
        (error) =>
          !String(error)
            .toLowerCase()
            .includes('forbidden'),
      );

    if (visibleErrors.length) {
      setMessage(
        visibleErrors.join(' | '),
      );
    } else {
      setMessage('');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function createDeposit() {
    try {
      const amount = Number(
        depositAmount,
      );

      if (!amount || amount < 10) {
        setMessage(
          'Depósito mínimo: R$ 10',
        );

        return;
      }

      const result = await api(
        '/deposit/pix',
        {
          method: 'POST',

          body: JSON.stringify({
            amount,
            amountBrl: amount,
          }),
        },
      );

      setMessage(
        `Depósito criado: ${Number(
          result.amountUsdc || 0,
        ).toFixed(2)} USDC`,
      );

      setDepositAmount('');

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

  return (
    <div className="page">
      <nav className="nav">
        <div className="nav-inner">
          <div className="brand">
            <div className="logo">N</div>
            Nexa
          </div>

          <div
            className="actions"
            style={{ marginTop: 0 }}
          >
            <button
              className="btn"
              onClick={refresh}
            >
              <RefreshCcw size={16} />
              Atualizar
            </button>

            <button
              className="btn"
              onClick={logoutAll}
            >
              Sair
            </button>
          </div>
        </div>
      </nav>

      <main className="container">
        <div className="badge">
          Conta em dólar digital
        </div>

        <h1 style={{ fontSize: 48 }}>
          Painel Nexa
        </h1>

        <p className="muted">
          Olá,{' '}
          {profile?.fullName ||
            storedUser?.fullName ||
            storedUser?.email}
          .
        </p>

        <div
          className="grid grid-4"
          style={{ marginTop: 28 }}
        >
          <div className="card">
            <div className="metric-label">
              Saldo USDC
            </div>

            <div className="metric-value">
              $
              {Number(
                balance?.balances
                  ?.USDC || 0,
              ).toFixed(2)}
            </div>
          </div>

          <div className="card">
            <div className="metric-label">
              Saldo estimado
            </div>

            <div className="metric-value">
              {moneyBRL(
                balance?.balances
                  ?.BRL || 0,
              )}
            </div>
          </div>

          <div className="card">
            <div className="metric-label">
              Wallet
            </div>

            <div className="metric-value">
              {wallets?.[0]?.address
                ? 'Conectada'
                : 'Sandbox'}
            </div>
          </div>

          <div className="card">
            <div className="metric-label">
              KYC
            </div>

            <div className="metric-value">
              {profile?.kycStatus ||
                'pending'}
            </div>
          </div>
        </div>

        <section
          className="card"
          style={{ marginTop: 24 }}
        >
          <h2>Sua carteira Nexa</h2>

          <div className="wallet-box">
            {wallets?.[0]?.address ||
              'Wallet automática invisível para o usuário'}
          </div>

          <button
            className="btn"
            style={{ marginTop: 12 }}
            onClick={() =>
              navigator.clipboard.writeText(
                wallets?.[0]?.address ||
                  '',
              )
            }
          >
            <Copy size={16} />
            Copiar endereço
          </button>
        </section>

        <div
          className="grid grid-2"
          style={{ marginTop: 24 }}
        >
          <section className="card">
            <h2>
              Depositar via Pix
            </h2>

            <input
              className="input"
              placeholder="Valor em R$"
              value={depositAmount}
              onChange={(e) =>
                setDepositAmount(
                  e.target.value,
                )
              }
            />

            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={createDeposit}
            >
              Gerar depósito Pix
            </button>
          </section>

          <section className="card">
            <h2>Histórico</h2>

            {transactions.length ===
              0 && (
              <p className="muted">
                Nenhuma transação ainda.
              </p>
            )}

            {transactions.map((tx) => (
              <div
                key={
                  tx.id ||
                  tx.reference
                }
                className="tx"
              >
                <div>
                  <strong>
                    {tx.description ||
                      tx.type}
                  </strong>

                  <div className="muted small">
                    {Number(
                      tx.amountUsdc ||
                        0,
                    ).toFixed(2)}{' '}
                    USDC
                  </div>
                </div>
              </div>
            ))}
          </section>
        </div>

        {message && (
          <div
            className="card"
            style={{ marginTop: 24 }}
          >
            {message}
          </div>
        )}
      </main>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] =
    useState(
      getToken()
        ? 'dashboard'
        : 'landing',
    );

  if (screen === 'login') {
    return (
      <NexaLogin
        onLogged={() =>
          setScreen('dashboard')
        }
      />
    );
  }

  if (screen === 'dashboard') {
    return (
      <Dashboard
        onLogout={() =>
          setScreen('landing')
        }
      />
    );
  }

  return (
    <Landing
      onEnter={() =>
        setScreen('login')
      }
    />
  );
}
