import { useEffect, useMemo, useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import {
  Copy,
  RefreshCcw,
} from 'lucide-react';

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
              className="btn btn-primary"
              onClick={onEnter}
            >
              Entrar
            </button>
          </div>
        </div>
      </nav>

      <section className="container hero">
        <div>
          <div className="badge">
            Pix + Dólar Digital
          </div>

          <h1>Cripto sem complicação.</h1>

          <p className="subtitle">
            Deposite Pix em reais e
            tenha saldo em dólar digital
            sem seed phrase, bridge,
            rede, carteira externa ou
            burocracia.
          </p>

          <div className="actions">
            <button
              className="btn btn-primary"
              onClick={onEnter}
            >
              Começar em 30s
            </button>
          </div>
        </div>

        <div className="card">
          <div className="metric-label">
            Conta digital global
          </div>

          <div className="metric-value">
            USDC + Pix
          </div>

          <p className="muted">
            Simples como um banco digital.
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

          <p className="muted">
            Conta digital em dólar com
            Pix integrado.
          </p>

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
  const { logout } = usePrivy();

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

    logout();

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
              Conta digital
            </div>

            <div className="metric-value">
              Ativa
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
          <h2>
            Sua conta digital Nexa
          </h2>

          <p className="muted">
            Sua conta está preparada
            para guardar dólar digital
            e usar Pix sem precisar
            lidar com rede, seed
            phrase, bridge ou carteira
            externa.
          </p>

          <div
            className="grid grid-2"
            style={{ marginTop: 20 }}
          >
            <div className="card">
              <div className="metric-label">
                Status da conta
              </div>

              <div className="metric-value">
                Ativa
              </div>
            </div>

            <div className="card">
              <div className="metric-label">
                Tipo de saldo
              </div>

              <div className="metric-value">
                USDC
              </div>
            </div>
          </div>

          <details
            style={{ marginTop: 20 }}
          >
            <summary className="muted">
              Ver endereço técnico da
              carteira
            </summary>

            <div
              className="wallet-box"
              style={{ marginTop: 12 }}
            >
              {wallets?.[0]?.address ||
                'Endereço técnico ainda não criado'}
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
              Copiar endereço técnico
            </button>
          </details>
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
