import {useEffect, useState} from 'react';
import {MAYA_BENEFITS_DISCOVERY_ENABLED, parseMayaAgenticsBenefits} from './mayaAgenticsBenefitsContract.js';

/**
 * Maya planning discovery is always non-executable. The optional, server-side
 * eligibility read is disabled unless independently enabled after the backend
 * benefits endpoint has been deployed. Existing financial consultant untouched.
 */
const EXAMPLES = [
  ['Pesquisa orientada', 'Transformar um tema complexo em tópicos para conferir.'],
  ['Organização de agenda', 'Dividir uma semana em prioridades e etapas sugeridas.'],
  ['Comunicação', 'Preparar um rascunho de mensagem para sua revisão.'],
  ['Comparação de opções', 'Organizar critérios e alternativas sem iniciar compras.'],
];
export default function MayaAgenticsPlanningBenefit({accessToken, userId, apiBaseUrl}) {
  const [entitlement, setEntitlement] = useState(null);
  useEffect(() => {
    setEntitlement(null);
    if (!MAYA_BENEFITS_DISCOVERY_ENABLED || !accessToken || !userId) return;
    const controller = new AbortController();
    // The same authenticated Nexa backend as the existing portal; no Agentics
    // staging origin, no financial data, no user-supplied URL or storage.
    const api = String(apiBaseUrl || '').replace(/\\/$/, '');
    if (!api.startsWith('https://') || !/^https:\\/\\/[^/]+\\/api\\/v1$/.test(api)) return;
    fetch(api + '/maya/agentics/benefits', {
      method:'GET', cache:'no-store', credentials:'omit',
      headers:{Authorization:'Bearer ' + accessToken,Accept:'application/json'},
      signal:controller.signal,
    }).then(async response => {
      if (!response.ok) return null;
      return parseMayaAgenticsBenefits(await response.json(), userId);
    }).then(data => {if (!controller.signal.aborted) setEntitlement(data);})
      .catch(() => {if (!controller.signal.aborted) setEntitlement(null);});
    return () => controller.abort();
  }, [accessToken,userId,apiBaseUrl]);
  return (
    <section className="hero-card" aria-label="Novidade Maya Agentics Premium em homologação" style={{marginBottom:16}}>
      <span className="status-pill" style={{display:'inline-block',marginBottom:12}}>Benefício Premium · em homologação</span>
      <h2 style={{marginTop:0}}>Maya + Agentics: da pergunta ao plano</h2>
      <p>A Maya continua disponível com seus recursos atuais. Estamos preparando o planejamento avançado com Agentics como um benefício adicional do Nexa Premium.</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:12,margin:'18px 0'}}>
        <div style={{padding:16,borderRadius:16,border:'1px solid rgba(148,163,184,.23)'}}>
          <strong>Maya para todos</strong>
          <p style={{fontSize:13}}>Conversar, pesquisar e utilizar as funcionalidades da assistente já disponíveis.</p>
        </div>
        <div style={{padding:16,borderRadius:16,border:'1px solid rgba(34,211,238,.55)'}}>
          <strong>Maya + Agentics Premium</strong>
          <p style={{fontSize:13}}>Organizar solicitações complexas em etapas, com rascunhos e aprovação humana.</p>
        </div>
      </div>
      <h3 style={{fontSize:16}}>Exemplos do planejamento em desenvolvimento</h3>
      <ul>{EXAMPLES.map(([name,description])=><li key={name}><strong>{name}:</strong> {description}</li>)}</ul>
      <p role="status" style={{fontSize:13,opacity:.9}}>
        {entitlement?.verified
          ? entitlement.premiumActive
            ? 'Seu Premium foi reconhecido pela Nexa. O planejamento Agentics ainda está em homologação.'
            : 'A Maya continua para todos. O planejamento Agentics está planejado para o Premium.'
          : 'Benefício em preparação. Nenhuma consulta de elegibilidade foi confirmada.'}
      </p>
      <p style={{fontSize:13,opacity:.85}}>Esta apresentação é informativa. O novo planejamento ainda não está disponível para contas reais. Não autoriza envio de mensagens, execução de tarefas ou movimentações financeiras.</p>
      <button className="secondary-button" type="button" disabled aria-disabled="true">Planejamento Agentics — em breve</button>
    </section>
  );
}
