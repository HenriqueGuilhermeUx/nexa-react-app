import {useCallback, useEffect, useMemo, useState} from 'react';

const API_URL =
  import.meta.env.VITE_API_URL ||
  'https://nexa-backend-p2u0.onrender.com/api/v1';

function brl(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function usdc(value) {
  return `${Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  })} USDC`;
}

function statusLabel(status) {
  const labels = {
    pending: 'Solicitado',
    processing: 'Em processamento',
    completed: 'Pix concluído',
    failed: 'Cancelado',
  };
  return labels[String(status || '').toLowerCase()] || String(status || 'Registrado');
}

function statusTone(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'completed') return 'success';
  if (normalized === 'failed') return 'danger';
  return 'warning';
}

function referenceOf(payment) {
  return (
    payment.endToEndId ||
    payment.externalId ||
    payment.pixReference ||
    payment.id
  );
}

function ValueRow({label, value, strong = false}) {
  return (
    <div className="redemption-value-row">
      <span>{label}</span>
      <strong className={strong ? 'redemption-value-strong' : ''}>{value}</strong>
    </div>
  );
}

function RedemptionCard({payment}) {
  const finalPayout = payment.settledAmountBrl;
  const saleProceeds = payment.saleProceedsBrl;
  const hasActualSettlement =
    finalPayout !== null &&
    finalPayout !== undefined &&
    saleProceeds !== null &&
    saleProceeds !== undefined;
  const estimate = payment.estimatedAmountBrl ?? payment.amountBrl;
  const completed = String(payment.status || '').toLowerCase() === 'completed';

  return (
    <article className="redemption-card">
      <div className="redemption-header">
        <div>
          <small>RESGATE USDC → PIX</small>
          <h3>{usdc(payment.amountUsdc)}</h3>
          <p>
            {payment.createdAt
              ? new Date(payment.createdAt).toLocaleString('pt-BR')
              : 'Registro Nexa'}
          </p>
        </div>
        <span className={`status status-${statusTone(payment.status)}`}>
          {statusLabel(payment.status)}
        </span>
      </div>

      <div className="redemption-settlement-box">
        <span>
          {hasActualSettlement
            ? 'Valor final confirmado'
            : 'Estimativa antes da venda'}
        </span>
        <strong>{hasActualSettlement ? brl(finalPayout) : brl(estimate)}</strong>
        <p>
          {hasActualSettlement
            ? 'Calculado sobre o BRL líquido realmente recebido na venda do USDC.'
            : 'Este valor não é garantido. O Pix final será definido somente após a venda real.'}
        </p>
      </div>

      {hasActualSettlement ? (
        <div className="redemption-values">
          <ValueRow label="BRL líquido da venda" value={brl(saleProceeds)} />
          <ValueRow label="Fee Nexa" value={`− ${brl(payment.nexaFeeBrl)}`} />
          <ValueRow label="Pix Out" value={`− ${brl(payment.pixOutFeeBrl)}`} />
          <ValueRow label="Pix enviado" value={brl(finalPayout)} strong />
          <ValueRow
            label="Cotação efetiva"
            value={`${brl(payment.exchangeRate)} por USDC`}
          />
        </div>
      ) : (
        <div className="redemption-values">
          <ValueRow label="Estimativa líquida" value={brl(estimate)} />
          <ValueRow label="USDC reservado" value={usdc(payment.amountUsdc)} />
          <ValueRow label="Prazo operacional" value="Até 1 dia útil" />
        </div>
      )}

      <div className="redemption-reference">
        <span>Referência</span>
        <code>{referenceOf(payment)}</code>
      </div>

      {completed && payment.completedAt ? (
        <p className="redemption-completed">
          Concluído em {new Date(payment.completedAt).toLocaleString('pt-BR')}
        </p>
      ) : null}
      {payment.failureReason && !completed ? (
        <p className="redemption-failure">{payment.failureReason}</p>
      ) : null}
    </article>
  );
}

export default function RedemptionHistory({accessToken}) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/payment/user`, {
        headers: {Authorization: `Bearer ${accessToken}`},
      });
      const text = await response.text();
      let data = [];
      try {
        data = text ? JSON.parse(text) : [];
      } catch {
        data = [];
      }
      if (!response.ok) {
        const message =
          data?.message || data?.error || 'Não foi possível carregar os resgates.';
        throw new Error(Array.isArray(message) ? message.join(', ') : String(message));
      }
      setPayments(Array.isArray(data) ? data : []);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível carregar os resgates.',
      );
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  const ordered = useMemo(
    () =>
      [...payments].sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
      ),
    [payments],
  );

  return (
    <section className="content-card redemption-section">
      <div className="redemption-section-header">
        <div>
          <h2>Resgates Pix</h2>
          <p className="muted">
            Estimativa, venda real, fee Nexa, Pix Out e valor final no mesmo
            extrato.
          </p>
        </div>
        <button className="secondary-button" onClick={load} disabled={loading}>
          {loading ? 'Atualizando…' : 'Atualizar'}
        </button>
      </div>

      {ordered.length ? (
        <div className="redemption-list">
          {ordered.map((payment) => (
            <RedemptionCard key={payment.id} payment={payment} />
          ))}
        </div>
      ) : (
        <p className="muted">
          {loading
            ? 'Carregando resgates…'
            : 'Nenhum resgate Pix registrado nesta conta.'}
        </p>
      )}
      {error ? <div className="notice notice-warning">{error}</div> : null}
    </section>
  );
}
