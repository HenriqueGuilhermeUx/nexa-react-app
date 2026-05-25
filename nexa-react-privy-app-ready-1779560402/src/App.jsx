import { useEffect, useMemo, useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import {
  Copy,
  RefreshCcw,
  ShieldCheck,
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
      localStorage.getItem(
        'nexa_user',
      ) || 'null',
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
        'Content-Type':
          'application/json',

        Authorization: `Bearer ${token}`,

        ...(options.headers || {}),
      },
    },
  );

  const data =
    await response
      .json()
      .catch(() => null);

  if (!response.ok) {
    throw new Error(
      Array.isArray(data?.message)
        ? data.message.join(', ')
        : data?.message ||
            'Erro na API',
    );
  }

  return data;
}

function moneyBRL(value) {
  return Number(
    value || 0,
  ).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function Landing({ onEnter }) {
  return (
    <div className="page">
      <nav className="nav">
        <div className="nav-inner">
          <div className="brand">
            <div className="logo">
              N
            </div>

            Nexa
          </div>

          <button
            className="btn btn-primary"
            onClick={onEnter}
          >
            Entrar
          </button>
        </div>
      </nav>

      <section className="container hero">
        <div>
          <div className="badge">
            Pix + USDC
          </div>

          <h1>
            Conta digital cripto invisível
          </h1>

          <p className="subtitle">
            Pix em reais convertido
            automaticamente para
            dólar digital.
          </p>

          <button
            className="btn btn-primary"
            onClick={onEnter}
          >
            Começar
          </button>
        </div>
      </section>
    </div>
  );
}

function Login({ onLogged }) {
  const [email, setEmail] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [message, setMessage] =
    useState('');

  async function submit(e) {
    e.preventDefault();

    try {
      const response = await fetch(
        `${API_URL}/auth/login`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            email,
            password,
          }),
        },
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            'Erro login',
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
        style={{
          maxWidth: 420,
        }}
      >
        <form
          className="card"
          onSubmit={submit}
        >
          <h2>Entrar</h2>

          <input
            className="input"
            placeholder="E-mail"
            value={email}
            onChange={(e) =>
              setEmail(
                e.target.value,
              )
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

          <button className="btn btn-primary">
            Entrar
          </button>

          <p className="muted">
            {message}
          </p>
        </form>
      </div>
    </div>
  );
}

function Dashboard({ onLogout }) {
  const {
    login,
    logout,
    authenticated,
    user: privyUser,
    ready,
  } = usePrivy();

  const { wallets } = useWallets();

  const storedUser =
    useMemo(getStoredUser, []);

  const [profile, setProfile] =
    useState(null);

  const [balance, setBalance] =
    useState(null);

  const [transactions, setTransactions] =
    useState([]);

  const [adminOverview, setAdminOverview] =
    useState(null);

  const [adminUsers, setAdminUsers] =
    useState([]);

  const [adminDeposits, setAdminDeposits] =
    useState([]);

  const [
    depositAmount,
    setDepositAmount,
  ] = useState('');

  const [message, setMessage] =
    useState('');

  const privyWallet =
    wallets?.[0];

  const userId =
    storedUser?.id;

  const userEmail =
    storedUser?.email;

  const isAdmin =
    userEmail ===
    'henriquecampos66@gmail.com';

  async function refresh() {
    try {
      const me =
        await api('/user/me');

      setProfile(me);

      const balanceData =
        await api(
          `/wallet/balance?userId=${userId}`,
        );

      setBalance(balanceData);

      const tx =
        await api(
          `/transaction/history?userId=${userId}`,
        );

      setTransactions(
        Array.isArray(tx)
          ? tx
          : [],
      );

      if (isAdmin) {
        const overview =
          await api(
            '/admin/overview',
          );

        setAdminOverview(
          overview,
        );

        const users =
          await api(
            '/admin/users',
          );

        setAdminUsers(users);

        const deposits =
          await api(
            '/admin/deposits',
          );

        setAdminDeposits(
          deposits,
        );
      }
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function activateWallet() {
    if (!ready) return;

    if (!authenticated) {
      await login();
      return;
    }

    if (!privyWallet?.address)
      return;

    try {
      await api(
        '/user/link-privy-wallet',
        {
          method: 'POST',

          body: JSON.stringify({
            userId,

            email: userEmail,

            privyUserId:
              privyUser?.id,

            walletAddress:
              privyWallet.address,

            privyWalletId:
              privyWallet.id,

            walletProvider:
              'privy',

            walletNetwork:
              'polygon',
          }),
        },
      );

      refresh();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function createDeposit() {
    try {
      const amount =
        Number(depositAmount);

      const result = await api(
        '/deposit/pix',
        {
          method: 'POST',

          body: JSON.stringify({
            userId,

            email: userEmail,

            amount,

            amountBrl: amount,
          }),
        },
      );

      setMessage(
        `Depositado ${Number(
          result.amountUsdc,
        ).toFixed(2)} USDC`,
      );

      setDepositAmount('');

      refresh();
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
            <div className="logo">
              N
            </div>

            Nexa
          </div>

          <div
            style={{
              display: 'flex',
              gap: 12,
            }}
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
        <h1>
          Painel Nexa
        </h1>

        <div
          className="grid grid-4"
          style={{
            marginTop: 24,
          }}
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
              Saldo BRL
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
              {profile?.wallet
                ?.address
                ? 'Ativa'
                : 'Pendente'}
            </div>
          </div>

          <div className="card">
            <div className="metric-label">
              KYC
            </div>

            <div className="metric-value">
              {profile?.kycStatus}
            </div>
          </div>
        </div>

        <section
          className="card"
          style={{
            marginTop: 24,
          }}
        >
          <h2>
            Conta Digital
          </h2>

          {!profile?.wallet
            ?.address && (
            <button
              className="btn btn-primary"
              onClick={
                activateWallet
              }
            >
              <ShieldCheck size={16} />
              Ativar conta digital
            </button>
          )}

          {profile?.wallet
            ?.address && (
            <>
              <p className="muted">
                Wallet criada
                automaticamente
              </p>

              <div className="wallet-box">
                {
                  profile.wallet
                    .address
                }
              </div>

              <button
                className="btn"
                onClick={() =>
                  navigator.clipboard.writeText(
                    profile
                      .wallet
                      .address,
                  )
                }
              >
                <Copy size={16} />
                Copiar
              </button>
            </>
          )}
        </section>

        <div
          className="grid grid-2"
          style={{
            marginTop: 24,
          }}
        >
          <section className="card">
            <h2>
              Depositar Pix
            </h2>

            <input
              className="input"
              placeholder="Valor"
              value={depositAmount}
              onChange={(e) =>
                setDepositAmount(
                  e.target.value,
                )
              }
            />

            <button
              className="btn btn-primary"
              onClick={
                createDeposit
              }
            >
              Depositar
            </button>
          </section>

          <section className="card">
            <h2>Histórico</h2>

            {transactions.map(
              (tx) => (
                <div
                  key={tx.id}
                  className="tx"
                >
                  <strong>
                    {tx.type}
                  </strong>

                  <div className="muted">
                    {Number(
                      tx.amountUsdc ||
                        0,
                    ).toFixed(2)}{' '}
                    USDC
                  </div>
                </div>
              ),
            )}
          </section>
        </div>

        {isAdmin && (
          <section
            className="card"
            style={{
              marginTop: 32,
            }}
          >
            <h2>
              Painel Admin
            </h2>

            <div
              className="grid grid-4"
              style={{
                marginTop: 20,
              }}
            >
              <div className="card">
                <div className="metric-label">
                  Usuários
                </div>

                <div className="metric-value">
                  {
                    adminOverview
                      ?.metrics
                      ?.totalUsers
                  }
                </div>
              </div>

              <div className="card">
                <div className="metric-label">
                  Transações
                </div>

                <div className="metric-value">
                  {
                    adminOverview
                      ?.metrics
                      ?.totalTransactions
                  }
                </div>
              </div>

              <div className="card">
                <div className="metric-label">
                  Total BRL
                </div>

                <div className="metric-value">
                  {moneyBRL(
                    adminOverview
                      ?.metrics
                      ?.totalBrl ||
                      0,
                  )}
                </div>
              </div>

              <div className="card">
                <div className="metric-label">
                  Total USDC
                </div>

                <div className="metric-value">
                  {Number(
                    adminOverview
                      ?.metrics
                      ?.totalUsdc ||
                      0,
                  ).toFixed(2)}
                </div>
              </div>
            </div>

            <h3
              style={{
                marginTop: 28,
              }}
            >
              Usuários
            </h3>

            {adminUsers.map(
              (user) => (
                <div
                  key={user.id}
                  className="card"
                  style={{
                    marginTop: 12,
                  }}
                >
                  <strong>
                    {
                      user.fullName
                    }
                  </strong>

                  <div className="muted">
                    {user.email}
                  </div>

                  <div className="muted">
                    Wallet:{' '}
                    {
                      user.walletAddress
                    }
                  </div>

                  <div className="muted">
                    Saldo:{' '}
                    {Number(
                      user.availableBalanceUsdc ||
                        0,
                    ).toFixed(2)}{' '}
                    USDC
                  </div>
                </div>
              ),
            )}

            <h3
              style={{
                marginTop: 28,
              }}
            >
              Depósitos
            </h3>

            {adminDeposits.map(
              (deposit) => (
                <div
                  key={
                    deposit.id
                  }
                  className="card"
                  style={{
                    marginTop: 12,
                  }}
                >
                  <div>
                    User:{' '}
                    {
                      deposit.userId
                    }
                  </div>

                  <div>
                    BRL:{' '}
                    {moneyBRL(
                      deposit.amountBrl,
                    )}
                  </div>

                  <div>
                    USDC:{' '}
                    {Number(
                      deposit.amountUsdc,
                    ).toFixed(2)}
                  </div>

                  <div>
                    Status:{' '}
                    {
                      deposit.status
                    }
                  </div>
                </div>
              ),
            )}
          </section>
        )}

        {message && (
          <div
            className="card"
            style={{
              marginTop: 24,
            }}
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
      <Login
        onLogged={() =>
          setScreen(
            'dashboard',
          )
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
