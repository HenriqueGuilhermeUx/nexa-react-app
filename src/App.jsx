import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  useCreateWallet,
  useLoginWithEmail,
  usePrivy,
  useWallets,
} from '@privy-io/react-auth';

const API_URL =
  import.meta.env.VITE_API_URL ||
  'https://nexa-backend-p2u0.onrender.com/api/v1';

const ACCESS_TOKEN_KEYS = ['nexa_access_token', 'nexa_token'];

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function readAccessToken() {
  for (const key of ACCESS_TOKEN_KEYS) {
    const sessionValue = sessionStorage.getItem(key);
    if (sessionValue) return sessionValue;
    const localValue = localStorage.getItem(key);
    if (localValue) return localValue;
  }
  return '';
}

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('nexa_user') || 'null');
  } catch {
    return null;
  }
}

function persistNexaSession(data) {
  const accessToken = String(data?.accessToken || data?.token || '').trim();
  if (!accessToken) throw new Error('A API não retornou um token de acesso.');

  for (const key of ACCESS_TOKEN_KEYS) {
    sessionStorage.setItem(key, accessToken);
    localStorage.setItem(key, accessToken);
  }

  if (data?.refreshToken) {
    localStorage.setItem('nexa_refresh_token', data.refreshToken);
  }
  if (data?.user) {
    localStorage.setItem('nexa_user', JSON.stringify(data.user));
  }

  return {accessToken, user: data?.user || null};
}

function clearNexaSession() {
  for (const key of ACCESS_TOKEN_KEYS) {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  }
  localStorage.removeItem('nexa_refresh_token');
  localStorage.removeItem('nexa_user');
}

function extractError(data, fallback = 'Não foi possível concluir a solicitação.') {
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (typeof data.message === 'string') return data.message;
  if (Array.isArray(data.message)) return data.message.join(', ');
  if (typeof data.error === 'string') return data.error;
  if (typeof data.response?.message === 'string') return data.response.message;
  return fallback;
}

async function apiFetch(path, token, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? {'Content-Type': 'application/json'} : {}),
      ...(token ? {Authorization: `Bearer ${token}`} : {}),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const error = new Error(extractError(data));
    error.status = response.status;
    error.code = data?.code || data?.message?.code || null;
    error.data = data;
    throw error;
  }

  return data;
}

function getPrivyEmail(user) {
  const direct = user?.email?.address;
  if (direct) return normalizeEmail(direct);
  const account = user?.linkedAccounts?.find(
    (item) => item?.type === 'email' && item?.address,
  );
  return normalizeEmail(account?.address);
}

function getEmbeddedWallet(wallets) {
  return (
    wallets.find(
      (wallet) =>
        wallet?.walletClientType === 'privy' ||
        wallet?.walletClientType === 'embedded' ||
        wallet?.connectorType === 'embedded',
    ) || null
  );
}

function getWalletId(wallet) {
  return String(
    wallet?.id || wallet?.walletId || wallet?.meta?.id || '',
  ).trim();
}

function shortenAddress(address) {
  if (!address) return 'Não vinculada';
  return `${address.slice(0, 7)}…${address.slice(-5)}`;
}

function StatusPill({tone = 'neutral', children}) {
  return <span className={`status status-${tone}`}>{children}</span>;
}

function NexaAuth({onAuthenticated}) {
  const [mode, setMode] = useState('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setMessage(mode === 'login' ? 'Entrando…' : 'Criando sua conta…');

    try {
      const body =
        mode === 'login'
          ? {email: normalizeEmail(email), password}
          : {
              fullName: fullName.trim(),
              email: normalizeEmail(email),
              cpf: cpf.trim(),
              phone: phone.trim(),
              password,
            };

      const data = await apiFetch(
        `/auth/${mode === 'login' ? 'login' : 'register'}`,
        '',
        {
          method: 'POST',
          body: JSON.stringify(body),
        },
      );

      const session = persistNexaSession(data);
      setMessage('Conta confirmada. Preparando sua experiência Nexa…');
      onAuthenticated(session);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-copy">
        <a className="brand" href="https://trynexa.com.br">
          <span className="brand-mark">N</span>
          <span>Nexa</span>
        </a>
        <StatusPill tone="info">Cripto sem complicação</StatusPill>
        <h1>Uma conta. Uma carteira. Em qualquer lugar.</h1>
        <p>
          Use o mesmo acesso no site e no aplicativo. A tecnologia de carteira
          funciona por trás da experiência, sem rede, bridge ou seed phrase no
          seu caminho.
        </p>
      </section>

      <form className="auth-card" onSubmit={submit}>
        <div className="segmented" role="tablist" aria-label="Acesso Nexa">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => setMode('login')}
          >
            Entrar
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'active' : ''}
            onClick={() => setMode('register')}
          >
            Abrir conta
          </button>
        </div>

        <h2>{mode === 'login' ? 'Acesse sua Nexa' : 'Abra sua conta'}</h2>
        <p className="muted">
          {mode === 'login'
            ? 'Use o mesmo e-mail e senha do aplicativo.'
            : 'Seu acesso web também funcionará no app.'}
        </p>

        {mode === 'register' && (
          <>
            <label>
              Nome completo
              <input
                required
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                autoComplete="name"
              />
            </label>
            <div className="field-grid">
              <label>
                CPF
                <input
                  required
                  value={cpf}
                  onChange={(event) => setCpf(event.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                />
              </label>
              <label>
                Telefone
                <input
                  required
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                />
              </label>
            </div>
          </>
        )}

        <label>
          E-mail
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
        </label>
        <label>
          Senha
          <input
            required
            minLength={6}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </label>

        <button className="primary-button" disabled={submitting}>
          {submitting
            ? 'Só um instante…'
            : mode === 'login'
              ? 'Entrar'
              : 'Criar minha conta'}
        </button>
        <p className="form-message" aria-live="polite">
          {message}
        </p>
      </form>
    </main>
  );
}

function WalletActivation({
  email,
  code,
  setCode,
  otpState,
  message,
  onConfirm,
  onResend,
  onSwitchPrivy,
  emailMismatch,
}) {
  return (
    <main className="center-page">
      <section className="activation-card">
        <div className="progress-ring">N</div>
        <StatusPill tone="info">Proteção da conta</StatusPill>
        <h1>Estamos preparando sua carteira</h1>
        <p>
          Enviamos um código para <strong>{email}</strong>. Essa confirmação
          acontece apenas na primeira ativação deste navegador.
        </p>

        {emailMismatch ? (
          <div className="notice notice-warning">
            Há outra sessão Privy neste navegador. Para proteger sua conta,
            precisamos usar o mesmo e-mail cadastrado na Nexa.
            <button className="secondary-button" onClick={onSwitchPrivy}>
              Usar meu e-mail Nexa
            </button>
          </div>
        ) : (
          <>
            <label className="otp-label">
              Código de confirmação
              <input
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, '').slice(0, 8))
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
              />
            </label>
            <button
              className="primary-button"
              onClick={onConfirm}
              disabled={code.length < 4 || otpState === 'confirming'}
            >
              {otpState === 'confirming'
                ? 'Confirmando…'
                : 'Confirmar e continuar'}
            </button>
            <button
              className="text-button"
              onClick={onResend}
              disabled={otpState === 'sending'}
            >
              Reenviar código
            </button>
          </>
        )}

        <p className="form-message" aria-live="polite">
          {message}
        </p>
        <p className="security-note">
          A Nexa nunca pedirá chave privada ou frase-semente.
        </p>
      </section>
    </main>
  );
}

function Dashboard({session, user, profile, history, onRefresh, onLogout}) {
  const wallet = profile?.wallet || {};
  const isLegacy = Boolean(profile?.isLegacyBeta);
  const directReady = Boolean(profile?.directSettlementReady);
  const executable = Boolean(profile?.executable);

  return (
    <div className="portal-page">
      <header className="topbar">
        <a className="brand" href="https://trynexa.com.br">
          <span className="brand-mark">N</span>
          <span>Portal Nexa</span>
        </a>
        <div className="topbar-actions">
          <button className="secondary-button" onClick={onRefresh}>
            Atualizar
          </button>
          <button className="text-button" onClick={onLogout}>
            Sair
          </button>
        </div>
      </header>

      <main className="portal-content">
        <section className="hero-card">
          <div>
            <StatusPill tone={isLegacy ? 'neutral' : 'success'}>
              {isLegacy ? 'Conta Beta preservada' : 'Carteira individual'}
            </StatusPill>
            <h1>Olá, {user?.fullName || session?.user?.fullName || user?.email}.</h1>
            <p>
              Sua conta Nexa está conectada. A infraestrutura financeira segue
              protegida pelas regras de auditoria e conciliação.
            </p>
          </div>
          <div className="wallet-summary">
            <span>Carteira</span>
            <strong>{shortenAddress(wallet.address || user?.walletAddress)}</strong>
            <small>{wallet.network || user?.walletNetwork || 'Polygon'}</small>
          </div>
        </section>

        <section className="metric-grid">
          <article className="metric-card">
            <span>Perfil</span>
            <strong>{isLegacy ? 'Beta / Legado' : 'Direct settlement'}</strong>
          </article>
          <article className="metric-card">
            <span>Vínculo da carteira</span>
            <strong>{wallet.linked || user?.walletAddress ? 'Confirmado' : 'Pendente'}</strong>
          </article>
          <article className="metric-card">
            <span>Auditoria</span>
            <strong>{directReady ? 'Concluída' : isLegacy ? 'Fluxo preservado' : 'Em homologação'}</strong>
          </article>
          <article className="metric-card">
            <span>Execução financeira</span>
            <strong>{executable ? 'Disponível' : 'Protegida'}</strong>
          </article>
        </section>

        {!executable && !isLegacy && (
          <div className="notice notice-info">
            Sua carteira já pode ser usada como identidade patrimonial. Entradas,
            saídas e liquidações reais continuam bloqueadas até a homologação
            contábil e operacional ser concluída.
          </div>
        )}

        <section className="content-grid">
          <article className="content-card">
            <h2>Minha carteira</h2>
            <p className="wallet-address">
              {wallet.address || user?.walletAddress || 'Carteira não encontrada'}
            </p>
            <p className="muted">
              Provider: {wallet.provider || user?.walletProvider || (isLegacy ? 'legado' : 'Privy')}
            </p>
          </article>

          <article className="content-card">
            <h2>Últimas movimentações</h2>
            {history.length ? (
              <div className="history-list">
                {history.slice(0, 6).map((item, index) => (
                  <div className="history-item" key={item.id || item.reference || index}>
                    <div>
                      <strong>{item.description || item.type || 'Movimentação'}</strong>
                      <small>
                        {item.createdAt
                          ? new Date(item.createdAt).toLocaleString('pt-BR')
                          : 'Registro Nexa'}
                      </small>
                    </div>
                    <span>
                      {Number(item.amountUsdc ?? item.amount ?? 0).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 8,
                      })}{' '}
                      {item.asset || 'USDC'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">Nenhuma movimentação carregada.</p>
            )}
          </article>
        </section>
      </main>
    </div>
  );
}

export default function App() {
  const {
    ready: privyReady,
    authenticated,
    user: privyUser,
    getAccessToken,
    logout: privyLogout,
  } = usePrivy();
  const {wallets, ready: walletsReady} = useWallets();
  const {sendCode, loginWithCode} = useLoginWithEmail();
  const {createWallet} = useCreateWallet();

  const [session, setSession] = useState(() => {
    const accessToken = readAccessToken();
    return accessToken
      ? {accessToken, user: readStoredUser()}
      : null;
  });
  const [user, setUser] = useState(() => readStoredUser());
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(Boolean(readAccessToken()));
  const [message, setMessage] = useState('');
  const [otpState, setOtpState] = useState('idle');
  const [code, setCode] = useState('');

  const creatingWalletRef = useRef(false);
  const linkingWalletRef = useRef(false);
  const auditedRef = useRef(false);

  const nexaEmail = normalizeEmail(user?.email || session?.user?.email);
  const privyEmail = getPrivyEmail(privyUser);
  const embeddedWallet = useMemo(() => getEmbeddedWallet(wallets), [wallets]);
  const isDirect = profile?.settlementProfile === 'direct_settlement';
  const needsWallet = Boolean(isDirect && !profile?.wallet?.linked);
  const emailMismatch = Boolean(
    authenticated && privyEmail && nexaEmail && privyEmail !== nexaEmail,
  );

  const loadContext = useCallback(async () => {
    const token = readAccessToken();
    if (!token) {
      setSession(null);
      setUser(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [meData, profileData] = await Promise.all([
        apiFetch('/user/me', token),
        apiFetch('/direct-settlement/profile', token),
      ]);
      const nextUser = meData?.user || meData;
      const nextProfile = profileData?.profile || profileData;
      setSession({accessToken: token, user: nextUser});
      setUser(nextUser);
      setProfile(nextProfile);
      localStorage.setItem('nexa_user', JSON.stringify(nextUser));

      try {
        const historyData = await apiFetch('/transaction/history', token);
        const list =
          historyData?.transactions ||
          historyData?.history ||
          historyData?.data ||
          historyData;
        setHistory(Array.isArray(list) ? list : []);
      } catch {
        setHistory([]);
      }
    } catch (error) {
      if (error.status === 401) {
        clearNexaSession();
        setSession(null);
        setUser(null);
        setProfile(null);
      } else {
        setMessage(error.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.accessToken) loadContext();
  }, [session?.accessToken, loadContext]);

  const requestOtp = useCallback(
    async (force = false) => {
      if (!nexaEmail || !privyReady || authenticated) return;
      const markerKey = `nexa_privy_otp_sent:${nexaEmail}`;
      const lastSent = Number(sessionStorage.getItem(markerKey) || 0);
      if (!force && Date.now() - lastSent < 90_000) {
        setOtpState('sent');
        setMessage(`Use o código enviado para ${nexaEmail}.`);
        return;
      }

      setOtpState('sending');
      setMessage('Enviando o código de confirmação…');
      try {
        await sendCode({email: nexaEmail});
        sessionStorage.setItem(markerKey, String(Date.now()));
        setOtpState('sent');
        setMessage(`Código enviado para ${nexaEmail}.`);
      } catch (error) {
        setOtpState('error');
        setMessage(error.message || 'Não foi possível enviar o código.');
      }
    },
    [authenticated, nexaEmail, privyReady, sendCode],
  );

  useEffect(() => {
    if (needsWallet && privyReady && !authenticated && otpState === 'idle') {
      requestOtp(false);
    }
  }, [authenticated, needsWallet, otpState, privyReady, requestOtp]);

  async function confirmOtp() {
    if (code.length < 4) return;
    setOtpState('confirming');
    setMessage('Confirmando sua identidade…');
    try {
      await loginWithCode({code});
      setOtpState('authenticated');
      setMessage('Identidade confirmada. Preparando sua carteira…');
    } catch (error) {
      setOtpState('sent');
      setMessage(error.message || 'Código inválido ou expirado.');
    }
  }

  async function switchPrivyAccount() {
    setMessage('Trocando para o e-mail da sua conta Nexa…');
    await privyLogout();
    setCode('');
    setOtpState('idle');
    sessionStorage.removeItem(`nexa_privy_otp_sent:${nexaEmail}`);
  }

  useEffect(() => {
    if (
      !needsWallet ||
      !authenticated ||
      !walletsReady ||
      embeddedWallet ||
      emailMismatch ||
      creatingWalletRef.current
    ) {
      return;
    }

    creatingWalletRef.current = true;
    setMessage('Criando sua carteira individual…');
    createWallet()
      .then(() => {
        setMessage('Carteira criada. Concluindo a proteção da conta…');
      })
      .catch((error) => {
        creatingWalletRef.current = false;
        setMessage(error.message || 'Não foi possível criar a carteira.');
      });
  }, [
    authenticated,
    createWallet,
    emailMismatch,
    embeddedWallet,
    needsWallet,
    walletsReady,
  ]);

  const linkWallet = useCallback(async () => {
    if (
      !needsWallet ||
      !session?.accessToken ||
      !authenticated ||
      !embeddedWallet?.address ||
      emailMismatch ||
      linkingWalletRef.current
    ) {
      return;
    }

    const privyWalletId = getWalletId(embeddedWallet);
    if (!privyWalletId) {
      setMessage('A carteira foi criada, mas o identificador ainda está sendo carregado.');
      return;
    }

    linkingWalletRef.current = true;
    setMessage('Finalizando a proteção da sua conta…');

    try {
      const privyAccessToken = await getAccessToken();
      if (!privyAccessToken) {
        throw new Error('A sessão Privy expirou. Confirme seu e-mail novamente.');
      }

      await apiFetch('/direct-settlement/wallet/link', session.accessToken, {
        method: 'POST',
        headers: {
          'x-privy-access-token': `Bearer ${privyAccessToken}`,
        },
        body: JSON.stringify({
          privyWalletId,
          walletAddress: embeddedWallet.address,
        }),
      });

      try {
        await apiFetch('/direct-settlement/wallet/audit', session.accessToken, {
          method: 'POST',
        });
      } catch {
        // O vínculo permanece válido; a auditoria pode ficar pendente enquanto
        // as flags financeiras e o modelo de custódia continuam bloqueados.
      }

      setMessage('Carteira vinculada. Sua conta está pronta.');
      await loadContext();
    } catch (error) {
      setMessage(error.message);
      linkingWalletRef.current = false;
    }
  }, [
    authenticated,
    emailMismatch,
    embeddedWallet,
    getAccessToken,
    loadContext,
    needsWallet,
    session?.accessToken,
  ]);

  useEffect(() => {
    linkWallet();
  }, [linkWallet]);

  useEffect(() => {
    if (
      !session?.accessToken ||
      !isDirect ||
      !profile?.wallet?.linked ||
      auditedRef.current
    ) {
      return;
    }

    auditedRef.current = true;
    apiFetch('/direct-settlement/wallet/audit', session.accessToken, {
      method: 'POST',
    })
      .then(() => loadContext())
      .catch(() => null);
  }, [isDirect, loadContext, profile?.wallet?.linked, session?.accessToken]);

  async function logoutAll() {
    clearNexaSession();
    setSession(null);
    setUser(null);
    setProfile(null);
    setHistory([]);
    setCode('');
    setOtpState('idle');
    creatingWalletRef.current = false;
    linkingWalletRef.current = false;
    auditedRef.current = false;
    if (authenticated) await privyLogout();
  }

  if (!session?.accessToken) {
    return (
      <NexaAuth
        onAuthenticated={(nextSession) => {
          setSession(nextSession);
          setUser(nextSession.user);
          setLoading(true);
        }}
      />
    );
  }

  if (loading || !profile) {
    return (
      <main className="center-page">
        <section className="activation-card compact">
          <div className="progress-ring">N</div>
          <h1>Preparando sua Nexa…</h1>
          <p>{message || 'Carregando sua conta com segurança.'}</p>
        </section>
      </main>
    );
  }

  if (needsWallet) {
    return (
      <WalletActivation
        email={nexaEmail}
        code={code}
        setCode={setCode}
        otpState={otpState}
        message={message}
        onConfirm={confirmOtp}
        onResend={() => requestOtp(true)}
        onSwitchPrivy={switchPrivyAccount}
        emailMismatch={emailMismatch}
      />
    );
  }

  return (
    <Dashboard
      session={session}
      user={user}
      profile={profile}
      history={history}
      onRefresh={loadContext}
      onLogout={logoutAll}
    />
  );
}
