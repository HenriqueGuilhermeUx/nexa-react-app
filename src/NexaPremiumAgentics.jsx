import {useCallback, useEffect, useRef, useState} from 'react';

/**
 * Nexa Premium financial consultant (read-only).
 * The host supplies its authenticated Nexa access token; this component never
 * persists credentials, invokes payment routes, or infers missing balances.
 */
export default function NexaPremiumAgentics({accessToken, apiBaseUrl}) {
  const [availability, setAvailability] = useState(null);
  const requestRef = useRef(null);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const base = String(apiBaseUrl || import.meta.env.VITE_API_URL ||
    'https://nexa-backend-p2u0.onrender.com/api/v1').replace(/\/$/, '');

  const load = useCallback(async (path, signal) => {
    const response = await fetch(base + path, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      headers: {Authorization: 'Bearer ' + accessToken, Accept: 'application/json'},
      signal,
    });
    if (!response.ok) {
      if (response.status === 401) throw new Error('Sua sessão expirou. Entre novamente na Nexa.');
      if (response.status === 403) throw new Error('Acesso Premium não autorizado para esta conta.');
      throw new Error('Serviço indisponível. Tente novamente mais tarde.');
    }
    return response.json();
  }, [accessToken, base]);

  useEffect(() => {
    requestRef.current?.abort();
    setAvailability(null);
    setReport(null);
    setBusy(false);
    setError('');
    if (!accessToken) return;
    const controller = new AbortController();
    requestRef.current = controller;
    load('/agentic/accounts/availability', controller.signal)
      .then(setAvailability)
      .catch(e => {if (e.name !== 'AbortError') setError(e.message);});
    return () => controller.abort();
  }, [accessToken, load]);

  async function consult() {
    if (!accessToken || !availability?.available || busy) return;
    const controller = new AbortController();
    requestRef.current?.abort();
    requestRef.current = controller;
    setBusy(true);
    setError('');
    setReport(null);
    try {
      const data = await load('/agentic/consultant-review/my-finances', controller.signal);
      if (data?.financialExecutionEnabled !== false) {
        throw new Error('Resposta inesperada do serviço de consulta.');
      }
      if (!controller.signal.aborted) setReport(data);
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return <section aria-label="Consultor Nexa Premium" className="nexa-agentics-panel">
    <h2>Seu consultor Nexa</h2>
    <p>Consulte informações financeiras e análises de sua conta. Nenhuma operação é executada.</p>
    {!accessToken && <p>Entre na sua conta para consultar.</p>}
    {accessToken && !availability && !error && <p>Verificando disponibilidade…</p>}
    {availability?.available === false && <p>Consultor ainda não disponível para esta conta.</p>}
    {availability?.available === true && <button type="button" disabled={busy} onClick={consult}>
      {busy ? 'Analisando…' : 'Consultar minhas finanças'}
    </button>}
    {error && <p role="alert">{error}</p>}
    {report && <div aria-live="polite">
      <h3>Resumo da consulta</h3>
      {Array.isArray(report.observations) && report.observations.length > 0
        ? <ul>{report.observations.map((item, index) =>
          <li key={index}>{typeof item === 'string' ? item : String(item?.message || item?.text || item?.summary || 'Observação disponível')}</li>)}</ul>
        : <p>Não há observações disponíveis para esta consulta.</p>}
      {Array.isArray(report.warnings) && report.warnings.length > 0 &&
        <p>Algumas fontes podem estar indisponíveis ou desatualizadas. Confira os dados na sua conta.</p>}
      <small>Consulta informativa, sem movimentações ou recomendações de investimento.</small>
    </div>}
  </section>;
}
